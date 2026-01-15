/**
 * Svony Browser - Packet Analysis Engine
 * Deep packet inspection with pattern detection
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class PacketAnalysisEngine extends EventEmitter {
    constructor() {
        super();
        
        // Packet storage
        this.packetHistory = [];
        this.maxHistorySize = 10000;
        
        // Pattern detection
        this.patterns = new Map();
        this.breakpoints = [];
        
        // Capture state
        this.isCapturing = false;
        this.captureStartTime = null;
        
        // Statistics
        this.stats = {
            totalPackets: 0,
            decodedPackets: 0,
            errorPackets: 0,
            packetsPerSecond: 0,
            bytesReceived: 0,
            bytesSent: 0,
            actionCounts: new Map(),
            lastPacketTime: null
        };
        
        // Rate calculation
        this.packetTimestamps = [];
        this.rateWindowMs = 5000;
        
        // Protocol handler reference
        this.protocolHandler = null;
        
        // Initialize default patterns
        this.initializeDefaultPatterns();
    }

    /**
     * Initialize default detection patterns
     */
    initializeDefaultPatterns() {
        // Login pattern
        this.addPattern('login', {
            name: 'Login Detected',
            match: (packet) => packet.action && packet.action.includes('Login'),
            priority: 'high',
            notify: true
        });
        
        // March pattern
        this.addPattern('march', {
            name: 'March Started',
            match: (packet) => packet.action === 'army.march',
            priority: 'medium',
            notify: true
        });
        
        // Attack pattern
        this.addPattern('attack', {
            name: 'Attack Detected',
            match: (packet) => {
                if (!packet.decoded) return false;
                return packet.decoded.type === 'attack' || 
                       (packet.action && packet.action.includes('attack'));
            },
            priority: 'high',
            notify: true
        });
        
        // Resource collection
        this.addPattern('resource', {
            name: 'Resource Collection',
            match: (packet) => packet.action && packet.action.includes('Resource'),
            priority: 'low',
            notify: false
        });
        
        // Error pattern
        this.addPattern('error', {
            name: 'Server Error',
            match: (packet) => {
                if (!packet.decoded) return false;
                return packet.decoded.error || packet.decoded.errorCode;
            },
            priority: 'high',
            notify: true
        });
    }

    /**
     * Initialize with protocol handler
     */
    async initialize() {
        try {
            this.protocolHandler = require('./protocol-handler');
            await this.protocolHandler.initialize();
            console.log('[PacketAnalysis] Initialized');
            this.emit('initialized');
            return true;
        } catch (error) {
            console.error('[PacketAnalysis] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Start packet capture
     */
    startCapture() {
        this.isCapturing = true;
        this.captureStartTime = Date.now();
        this.packetTimestamps = [];
        
        console.log('[PacketAnalysis] Capture started');
        this.emit('captureStateChanged', true);
    }

    /**
     * Stop packet capture
     */
    stopCapture() {
        this.isCapturing = false;
        
        const duration = Date.now() - this.captureStartTime;
        console.log(`[PacketAnalysis] Capture stopped. Duration: ${duration}ms, Packets: ${this.stats.totalPackets}`);
        
        this.emit('captureStateChanged', false);
        
        return {
            duration,
            packetCount: this.stats.totalPackets,
            decodedCount: this.stats.decodedPackets,
            errorCount: this.stats.errorPackets
        };
    }

    /**
     * Process incoming packet
     */
    processPacket(rawData, direction = 'unknown', metadata = {}) {
        if (!this.isCapturing) return null;
        
        const timestamp = Date.now();
        
        // Create packet object
        const packet = {
            id: ++this.stats.totalPackets,
            timestamp,
            direction,
            rawData: rawData,
            rawHex: this.toHexString(rawData),
            size: rawData.length || (typeof rawData === 'string' ? rawData.length : 0),
            decoded: null,
            action: null,
            error: null,
            patterns: [],
            metadata
        };
        
        // Update byte counts
        if (direction === 'outbound' || direction === 'request') {
            this.stats.bytesSent += packet.size;
        } else {
            this.stats.bytesReceived += packet.size;
        }
        
        // Attempt to decode
        try {
            packet.decoded = this.decodePacket(rawData);
            packet.action = packet.decoded?.action || this.extractAction(rawData);
            this.stats.decodedPackets++;
            
            // Track action counts
            if (packet.action) {
                const count = this.stats.actionCounts.get(packet.action) || 0;
                this.stats.actionCounts.set(packet.action, count + 1);
            }
        } catch (error) {
            packet.error = error.message;
            this.stats.errorPackets++;
        }
        
        // Check breakpoints
        const breakpointHit = this.checkBreakpoints(packet);
        if (breakpointHit) {
            packet.breakpointHit = breakpointHit;
        }
        
        // Detect patterns
        const detectedPatterns = this.detectPatterns(packet);
        packet.patterns = detectedPatterns;
        
        // Add to history
        this.packetHistory.push(packet);
        this.trimHistory();
        
        // Update rate calculation
        this.packetTimestamps.push(timestamp);
        this.updatePacketRate();
        
        this.stats.lastPacketTime = timestamp;
        
        // Emit events
        this.emit('packetCaptured', packet);
        
        if (detectedPatterns.length > 0) {
            for (const pattern of detectedPatterns) {
                this.emit('patternDetected', { pattern, packet });
            }
        }
        
        return packet;
    }

    /**
     * Decode packet data
     */
    decodePacket(rawData) {
        if (!rawData) return null;
        
        // If it's already an object, return it
        if (typeof rawData === 'object' && !Buffer.isBuffer(rawData)) {
            return rawData;
        }
        
        // Try JSON parsing first
        if (typeof rawData === 'string') {
            try {
                return JSON.parse(rawData);
            } catch (e) {
                // Not JSON
            }
        }
        
        // Try AMF3 decoding via protocol handler
        if (this.protocolHandler && Buffer.isBuffer(rawData)) {
            return this.protocolHandler.decodeAmf3(rawData);
        }
        
        // Return raw as string
        return {
            raw: rawData.toString ? rawData.toString() : String(rawData)
        };
    }

    /**
     * Extract action name from raw data
     */
    extractAction(rawData) {
        if (!rawData) return null;
        
        // Try to find action in string data
        const str = rawData.toString ? rawData.toString() : String(rawData);
        
        // Look for common patterns
        const patterns = [
            /action["\s:=]+["']?(\w+\.\w+)/i,
            /command["\s:=]+["']?(\w+\.\w+)/i,
            /"method"["\s:]+["'](\w+\.\w+)/i,
            /(\w+\.\w+)(?:Request|Response)/
        ];
        
        for (const pattern of patterns) {
            const match = str.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    }

    /**
     * Convert data to hex string
     */
    toHexString(data) {
        if (Buffer.isBuffer(data)) {
            return data.toString('hex');
        }
        if (typeof data === 'string') {
            return Buffer.from(data).toString('hex');
        }
        if (typeof data === 'object') {
            return Buffer.from(JSON.stringify(data)).toString('hex');
        }
        return '';
    }

    /**
     * Add detection pattern
     */
    addPattern(id, config) {
        this.patterns.set(id, {
            id,
            name: config.name || id,
            match: config.match,
            priority: config.priority || 'medium',
            notify: config.notify !== false,
            enabled: config.enabled !== false,
            count: 0
        });
    }

    /**
     * Remove pattern
     */
    removePattern(id) {
        this.patterns.delete(id);
    }

    /**
     * Detect patterns in packet
     */
    detectPatterns(packet) {
        const detected = [];
        
        for (const [id, pattern] of this.patterns) {
            if (!pattern.enabled) continue;
            
            try {
                if (pattern.match(packet)) {
                    pattern.count++;
                    detected.push({
                        id,
                        name: pattern.name,
                        priority: pattern.priority
                    });
                    
                    if (pattern.notify) {
                        this.emit('notification', {
                            type: 'pattern',
                            pattern: pattern.name,
                            packet: packet.id
                        });
                    }
                }
            } catch (error) {
                console.error(`[PacketAnalysis] Pattern ${id} error:`, error);
            }
        }
        
        return detected;
    }

    /**
     * Add breakpoint
     */
    addBreakpoint(config) {
        const breakpoint = {
            id: Date.now(),
            action: config.action || null,
            condition: config.condition || null,
            direction: config.direction || null,
            enabled: config.enabled !== false,
            hitCount: 0
        };
        
        this.breakpoints.push(breakpoint);
        return breakpoint;
    }

    /**
     * Remove breakpoint
     */
    removeBreakpoint(id) {
        this.breakpoints = this.breakpoints.filter(bp => bp.id !== id);
    }

    /**
     * Check breakpoints
     */
    checkBreakpoints(packet) {
        for (const bp of this.breakpoints) {
            if (!bp.enabled) continue;
            
            let matches = true;
            
            // Check action
            if (bp.action && packet.action !== bp.action) {
                matches = false;
            }
            
            // Check direction
            if (bp.direction && packet.direction !== bp.direction) {
                matches = false;
            }
            
            // Check custom condition
            if (bp.condition && typeof bp.condition === 'function') {
                try {
                    if (!bp.condition(packet)) {
                        matches = false;
                    }
                } catch (e) {
                    matches = false;
                }
            }
            
            if (matches) {
                bp.hitCount++;
                this.emit('breakpointHit', { breakpoint: bp, packet });
                return bp;
            }
        }
        
        return null;
    }

    /**
     * Update packet rate calculation
     */
    updatePacketRate() {
        const now = Date.now();
        const windowStart = now - this.rateWindowMs;
        
        // Filter to recent timestamps
        this.packetTimestamps = this.packetTimestamps.filter(t => t > windowStart);
        
        // Calculate rate
        this.stats.packetsPerSecond = (this.packetTimestamps.length / this.rateWindowMs) * 1000;
    }

    /**
     * Get packet history with filters
     */
    getHistory(filter = {}) {
        let results = [...this.packetHistory];
        
        // Filter by action
        if (filter.action) {
            results = results.filter(p => 
                p.action && p.action.toLowerCase().includes(filter.action.toLowerCase())
            );
        }
        
        // Filter by direction
        if (filter.direction) {
            results = results.filter(p => p.direction === filter.direction);
        }
        
        // Filter by time range
        if (filter.startTime) {
            results = results.filter(p => p.timestamp >= filter.startTime);
        }
        if (filter.endTime) {
            results = results.filter(p => p.timestamp <= filter.endTime);
        }
        
        // Filter by pattern
        if (filter.pattern) {
            results = results.filter(p => 
                p.patterns.some(pat => pat.id === filter.pattern)
            );
        }
        
        // Filter by error
        if (filter.hasError !== undefined) {
            results = results.filter(p => 
                filter.hasError ? p.error !== null : p.error === null
            );
        }
        
        // Apply limit
        if (filter.limit) {
            results = results.slice(-filter.limit);
        }
        
        return results;
    }

    /**
     * Search packets
     */
    searchPackets(query) {
        const lowerQuery = query.toLowerCase();
        
        return this.packetHistory.filter(packet => {
            // Search in action
            if (packet.action && packet.action.toLowerCase().includes(lowerQuery)) {
                return true;
            }
            
            // Search in decoded data
            if (packet.decoded) {
                const decodedStr = JSON.stringify(packet.decoded).toLowerCase();
                if (decodedStr.includes(lowerQuery)) {
                    return true;
                }
            }
            
            // Search in raw hex
            if (packet.rawHex && packet.rawHex.includes(lowerQuery)) {
                return true;
            }
            
            return false;
        });
    }

    /**
     * Get packet by ID
     */
    getPacket(id) {
        return this.packetHistory.find(p => p.id === id);
    }

    /**
     * Get statistics
     */
    getStats() {
        const actionCountsObj = {};
        for (const [action, count] of this.stats.actionCounts) {
            actionCountsObj[action] = count;
        }
        
        return {
            totalPackets: this.stats.totalPackets,
            decodedPackets: this.stats.decodedPackets,
            errorPackets: this.stats.errorPackets,
            decodeRate: this.stats.totalPackets > 0 
                ? ((this.stats.decodedPackets / this.stats.totalPackets) * 100).toFixed(1) + '%'
                : '0%',
            packetsPerSecond: this.stats.packetsPerSecond.toFixed(1),
            bytesReceived: this.stats.bytesReceived,
            bytesSent: this.stats.bytesSent,
            totalBytes: this.stats.bytesReceived + this.stats.bytesSent,
            isCapturing: this.isCapturing,
            captureTime: this.captureStartTime ? Date.now() - this.captureStartTime : 0,
            historySize: this.packetHistory.length,
            patternCount: this.patterns.size,
            breakpointCount: this.breakpoints.length,
            topActions: Object.entries(actionCountsObj)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
        };
    }

    /**
     * Get action frequency analysis
     */
    getActionAnalysis() {
        const analysis = [];
        
        for (const [action, count] of this.stats.actionCounts) {
            const packets = this.packetHistory.filter(p => p.action === action);
            const avgSize = packets.reduce((sum, p) => sum + p.size, 0) / packets.length;
            
            analysis.push({
                action,
                count,
                percentage: ((count / this.stats.totalPackets) * 100).toFixed(1),
                avgSize: Math.round(avgSize),
                lastSeen: packets.length > 0 ? packets[packets.length - 1].timestamp : null
            });
        }
        
        return analysis.sort((a, b) => b.count - a.count);
    }

    /**
     * Trim history to max size
     */
    trimHistory() {
        if (this.packetHistory.length > this.maxHistorySize) {
            this.packetHistory = this.packetHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Clear history
     */
    clearHistory() {
        this.packetHistory = [];
        this.stats.totalPackets = 0;
        this.stats.decodedPackets = 0;
        this.stats.errorPackets = 0;
        this.stats.bytesReceived = 0;
        this.stats.bytesSent = 0;
        this.stats.actionCounts.clear();
        this.packetTimestamps = [];
        
        this.emit('historyCleared');
    }

    /**
     * Export history to file
     */
    async exportHistory(filePath, format = 'json') {
        const data = {
            exportTime: Date.now(),
            stats: this.getStats(),
            packets: this.packetHistory.map(p => ({
                id: p.id,
                timestamp: p.timestamp,
                direction: p.direction,
                action: p.action,
                size: p.size,
                decoded: p.decoded,
                error: p.error,
                patterns: p.patterns
            }))
        };
        
        if (format === 'json') {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } else if (format === 'csv') {
            const csv = this.toCsv(data.packets);
            await fs.writeFile(filePath, csv);
        }
        
        return filePath;
    }

    /**
     * Convert packets to CSV
     */
    toCsv(packets) {
        const headers = ['id', 'timestamp', 'direction', 'action', 'size', 'error'];
        const rows = packets.map(p => [
            p.id,
            new Date(p.timestamp).toISOString(),
            p.direction,
            p.action || '',
            p.size,
            p.error || ''
        ]);
        
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    /**
     * Import history from file
     */
    async importHistory(filePath) {
        const data = await fs.readFile(filePath, 'utf8');
        const imported = JSON.parse(data);
        
        if (imported.packets) {
            this.packetHistory = imported.packets;
            this.stats.totalPackets = imported.packets.length;
            this.emit('historyImported', this.getStats());
        }
    }

    /**
     * Get patterns list
     */
    getPatterns() {
        return Array.from(this.patterns.values());
    }

    /**
     * Get breakpoints list
     */
    getBreakpoints() {
        return [...this.breakpoints];
    }

    /**
     * Reset all state
     */
    reset() {
        this.clearHistory();
        this.isCapturing = false;
        this.captureStartTime = null;
        
        // Reset pattern counts
        for (const pattern of this.patterns.values()) {
            pattern.count = 0;
        }
        
        // Reset breakpoint counts
        for (const bp of this.breakpoints) {
            bp.hitCount = 0;
        }
        
        this.emit('reset');
    }
}

module.exports = new PacketAnalysisEngine();
