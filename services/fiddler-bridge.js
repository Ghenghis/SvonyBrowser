/**
 * Fiddler Bridge Service
 * Integrates with Fiddler for traffic capture and analysis
 * Supports both Fiddler Classic and Fiddler Everywhere
 */

const { EventEmitter } = require('events');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

class FiddlerBridge extends EventEmitter {
    constructor() {
        super();
        this.isConnected = false;
        this.fiddlerProcess = null;
        this.proxyPort = 8888;
        this.apiPort = 8889;
        this.capturedPackets = [];
        this.filters = {
            hosts: ['evony.com', 'evony2.com', 'cc2.evony.com'],
            contentTypes: ['application/x-amf', 'application/octet-stream']
        };
        this.isCapturing = false;
        this.socket = null;
        this.reconnectTimer = null;
        this.fiddlerPath = null;
    }
    
    /**
     * Find Fiddler installation
     */
    findFiddlerPath() {
        const possiblePaths = [
            'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Programs\\Fiddler\\Fiddler.exe',
            'C:\\Program Files\\Fiddler\\Fiddler.exe',
            'C:\\Program Files (x86)\\Fiddler\\Fiddler.exe',
            'C:\\Program Files\\Fiddler Everywhere\\Fiddler Everywhere.exe',
            process.env.FIDDLER_PATH
        ].filter(Boolean);
        
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }
        
        return null;
    }
    
    /**
     * Check if Fiddler is running
     */
    async isFiddlerRunning() {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(1000);
            
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            
            socket.on('error', () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.connect(this.proxyPort, '127.0.0.1');
        });
    }
    
    /**
     * Launch Fiddler
     */
    async launchFiddler() {
        this.fiddlerPath = this.findFiddlerPath();
        
        if (!this.fiddlerPath) {
            throw new Error('Fiddler not found. Please install Fiddler or set FIDDLER_PATH environment variable.');
        }
        
        return new Promise((resolve, reject) => {
            this.fiddlerProcess = spawn(this.fiddlerPath, [], { windowsHide: true, 
                detached: true,
                stdio: 'ignore'
             });
            
            this.fiddlerProcess.unref();
            
            // Wait for Fiddler to start
            let attempts = 0;
            const checkInterval = setInterval(async () => {
                attempts++;
                
                if (await this.isFiddlerRunning()) {
                    clearInterval(checkInterval);
                    this.emit('fiddler-launched');
                    resolve(true);
                } else if (attempts > 30) {
                    clearInterval(checkInterval);
                    reject(new Error('Fiddler failed to start within 30 seconds'));
                }
            }, 1000);
        });
    }
    
    /**
     * Connect to Fiddler's proxy
     */
    async connect(options = {}) {
        if (options.proxyPort) this.proxyPort = options.proxyPort;
        if (options.apiPort) this.apiPort = options.apiPort;
        
        // Check if Fiddler is running
        const isRunning = await this.isFiddlerRunning();
        
        if (!isRunning) {
            if (options.autoLaunch) {
                await this.launchFiddler();
            } else {
                throw new Error('Fiddler is not running. Start Fiddler or set autoLaunch: true');
            }
        }
        
        this.isConnected = true;
        this.emit('connected');
        
        // Start capturing if auto-capture enabled
        if (options.autoCapture) {
            this.startCapture();
        }
        
        return true;
    }
    
    /**
     * Start capturing traffic
     */
    startCapture() {
        if (this.isCapturing) return;
        
        this.isCapturing = true;
        this.capturedPackets = [];
        this.emit('capture-started');
        
        console.log('[FiddlerBridge] Capture started');
    }
    
    /**
     * Stop capturing traffic
     */
    stopCapture() {
        if (!this.isCapturing) return;
        
        this.isCapturing = false;
        this.emit('capture-stopped', {
            packetCount: this.capturedPackets.length
        });
        
        console.log('[FiddlerBridge] Capture stopped');
    }
    
    /**
     * Process incoming packet (called from traffic interceptor)
     */
    processPacket(packet) {
        if (!this.isCapturing) return;
        
        // Apply filters
        if (!this.matchesFilter(packet)) return;
        
        const processedPacket = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            direction: packet.direction || 'unknown',
            host: packet.host,
            path: packet.path,
            method: packet.method,
            contentType: packet.contentType,
            contentLength: packet.contentLength,
            headers: packet.headers,
            rawData: packet.body,
            hexData: packet.body ? Buffer.from(packet.body).toString('hex') : null,
            decoded: null,
            action: null
        };
        
        // Try to decode AMF data
        if (this.isAMFContent(packet.contentType)) {
            try {
                const { AMF3Decoder } = require('./amf3-decoder');
                const decoder = new AMF3Decoder();
                processedPacket.decoded = decoder.decodePacket(processedPacket.hexData);
                
                // Extract action name
                if (processedPacket.decoded.messages && processedPacket.decoded.messages.length > 0) {
                    processedPacket.action = processedPacket.decoded.messages[0].targetURI;
                }
            } catch (error) {
                processedPacket.decodeError = error.message;
            }
        }
        
        this.capturedPackets.push(processedPacket);
        this.emit('packet', processedPacket);
        
        // Emit action-specific event
        if (processedPacket.action) {
            this.emit('action', {
                action: processedPacket.action,
                packet: processedPacket
            });
        }
        
        return processedPacket;
    }
    
    /**
     * Check if packet matches filters
     */
    matchesFilter(packet) {
        // Host filter
        if (this.filters.hosts.length > 0) {
            const matchesHost = this.filters.hosts.some(h => 
                packet.host && packet.host.includes(h)
            );
            if (!matchesHost) return false;
        }
        
        // Content type filter
        if (this.filters.contentTypes.length > 0 && packet.contentType) {
            const matchesType = this.filters.contentTypes.some(t => 
                packet.contentType.includes(t)
            );
            if (!matchesType) return false;
        }
        
        return true;
    }
    
    /**
     * Check if content is AMF
     */
    isAMFContent(contentType) {
        if (!contentType) return false;
        return contentType.includes('x-amf') || 
               contentType.includes('octet-stream');
    }
    
    /**
     * Set capture filters
     */
    setFilters(filters) {
        if (filters.hosts) this.filters.hosts = filters.hosts;
        if (filters.contentTypes) this.filters.contentTypes = filters.contentTypes;
        this.emit('filters-updated', this.filters);
    }
    
    /**
     * Get captured packets
     */
    getPackets(options = {}) {
        let packets = [...this.capturedPackets];
        
        // Filter by action
        if (options.action) {
            packets = packets.filter(p => 
                p.action && p.action.includes(options.action)
            );
        }
        
        // Filter by direction
        if (options.direction) {
            packets = packets.filter(p => p.direction === options.direction);
        }
        
        // Filter by time range
        if (options.startTime) {
            packets = packets.filter(p => p.timestamp >= options.startTime);
        }
        if (options.endTime) {
            packets = packets.filter(p => p.timestamp <= options.endTime);
        }
        
        // Limit results
        if (options.limit) {
            packets = packets.slice(-options.limit);
        }
        
        return packets;
    }
    
    /**
     * Get packet by ID
     */
    getPacket(id) {
        return this.capturedPackets.find(p => p.id === id);
    }
    
    /**
     * Clear captured packets
     */
    clearPackets() {
        const count = this.capturedPackets.length;
        this.capturedPackets = [];
        this.emit('packets-cleared', { count });
        return count;
    }
    
    /**
     * Export packets to file
     */
    async exportPackets(filePath, format = 'json') {
        let content;
        
        switch (format) {
            case 'json':
                content = JSON.stringify(this.capturedPackets, null, 2);
                break;
            case 'csv':
                content = this.packetsToCSV();
                break;
            case 'har':
                content = JSON.stringify(this.packetsToHAR(), null, 2);
                break;
            default:
                throw new Error(`Unknown format: ${format}`);
        }
        
        fs.writeFileSync(filePath, content);
        return { filePath, format, packetCount: this.capturedPackets.length };
    }
    
    /**
     * Convert packets to CSV
     */
    packetsToCSV() {
        const headers = ['id', 'timestamp', 'direction', 'host', 'path', 'method', 'action', 'contentLength'];
        const rows = this.capturedPackets.map(p => [
            p.id,
            new Date(p.timestamp).toISOString(),
            p.direction,
            p.host,
            p.path,
            p.method,
            p.action || '',
            p.contentLength || 0
        ]);
        
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
    
    /**
     * Convert packets to HAR format
     */
    packetsToHAR() {
        return {
            log: {
                version: '1.2',
                creator: {
                    name: 'Svony Browser',
                    version: '2.0.6'
                },
                entries: this.capturedPackets.map(p => ({
                    startedDateTime: new Date(p.timestamp).toISOString(),
                    time: 0,
                    request: {
                        method: p.method || 'POST',
                        url: `https://${p.host}${p.path}`,
                        headers: p.headers || [],
                        bodySize: p.contentLength || 0
                    },
                    response: {
                        status: 200,
                        statusText: 'OK',
                        headers: [],
                        bodySize: 0
                    }
                }))
            }
        };
    }
    
    /**
     * Import packets from file
     */
    async importPackets(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const packets = JSON.parse(content);
        
        this.capturedPackets = [...this.capturedPackets, ...packets];
        this.emit('packets-imported', { count: packets.length });
        
        return packets.length;
    }
    
    /**
     * Analyze traffic patterns
     */
    analyzeTraffic() {
        const analysis = {
            totalPackets: this.capturedPackets.length,
            byDirection: { request: 0, response: 0 },
            byAction: {},
            byHost: {},
            timeline: [],
            averageSize: 0,
            totalSize: 0
        };
        
        for (const packet of this.capturedPackets) {
            // Direction stats
            if (packet.direction === 'request') analysis.byDirection.request++;
            else if (packet.direction === 'response') analysis.byDirection.response++;
            
            // Action stats
            if (packet.action) {
                analysis.byAction[packet.action] = (analysis.byAction[packet.action] || 0) + 1;
            }
            
            // Host stats
            if (packet.host) {
                analysis.byHost[packet.host] = (analysis.byHost[packet.host] || 0) + 1;
            }
            
            // Size stats
            if (packet.contentLength) {
                analysis.totalSize += packet.contentLength;
            }
        }
        
        analysis.averageSize = analysis.totalPackets > 0 
            ? Math.round(analysis.totalSize / analysis.totalPackets) 
            : 0;
        
        // Top actions
        analysis.topActions = Object.entries(analysis.byAction)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([action, count]) => ({ action, count }));
        
        return analysis;
    }
    
    /**
     * Get proxy settings for Electron
     */
    getProxyConfig() {
        return {
            proxyRules: `http=127.0.0.1:${this.proxyPort};https=127.0.0.1:${this.proxyPort}`,
            proxyBypassRules: 'localhost'
        };
    }
    
    /**
     * Get status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            capturing: this.isCapturing,
            proxyPort: this.proxyPort,
            packetCount: this.capturedPackets.length,
            filters: this.filters,
            fiddlerPath: this.fiddlerPath
        };
    }
    
    /**
     * Disconnect from Fiddler
     */
    disconnect() {
        this.stopCapture();
        
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        
        if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        this.isConnected = false;
        this.emit('disconnected');
    }
    
    /**
     * Cleanup
     */
    cleanup() {
        this.disconnect();
        this.capturedPackets = [];
    }
}

// Singleton instance
let instance = null;

function getFiddlerBridge() {
    if (!instance) {
        instance = new FiddlerBridge();
    }
    return instance;
}

module.exports = {
    FiddlerBridge,
    getFiddlerBridge
};

