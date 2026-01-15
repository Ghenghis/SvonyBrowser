/**
 * Svony Browser - Proxy Monitor Service
 * Monitor Fiddler proxy connection at 127.0.0.1:8888
 */

const net = require('net');
const EventEmitter = require('events');

class ProxyMonitor extends EventEmitter {
    constructor() {
        super();
        this.host = '127.0.0.1';
        this.port = 8888;
        this.isAvailable = false;
        this.monitorInterval = null;
        this.throughputInterval = null;
        
        // Throughput tracking
        this.throughputKBps = 0;
        this.bytesTransferred = 0;
        this.bytesHistory = [];
        this.historyWindowMs = 5000; // 5 second rolling window
        
        // Connection stats
        this.stats = {
            totalConnections: 0,
            successfulConnections: 0,
            failedConnections: 0,
            lastCheckTime: null,
            lastSuccessTime: null,
            uptime: 0,
            downtime: 0
        };
        
        // State tracking
        this.lastStatus = null;
        this.statusChangeTime = null;
    }

    /**
     * Start monitoring the proxy
     */
    start(intervalMs = 5000) {
        console.log(`[ProxyMonitor] Starting monitoring on ${this.host}:${this.port}`);
        
        // Clear any existing intervals
        this.stop();
        
        // Start status check interval
        this.monitorInterval = setInterval(() => {
            this.checkProxyStatus();
        }, intervalMs);
        
        // Start throughput calculation interval
        this.throughputInterval = setInterval(() => {
            this.calculateThroughput();
        }, 1000);
        
        // Initial check
        this.checkProxyStatus();
        
        this.emit('monitoringStarted', { host: this.host, port: this.port });
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        if (this.throughputInterval) {
            clearInterval(this.throughputInterval);
            this.throughputInterval = null;
        }
        
        this.emit('monitoringStopped');
        console.log('[ProxyMonitor] Monitoring stopped');
    }

    /**
     * Check if proxy is responding
     */
    async checkProxyStatus() {
        this.stats.totalConnections++;
        this.stats.lastCheckTime = Date.now();
        
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const startTime = Date.now();
            
            socket.setTimeout(2000);

            socket.on('connect', () => {
                const latency = Date.now() - startTime;
                const wasAvailable = this.isAvailable;
                
                this.isAvailable = true;
                this.stats.successfulConnections++;
                this.stats.lastSuccessTime = Date.now();
                
                socket.destroy();
                
                // Track status change
                if (!wasAvailable) {
                    this.statusChangeTime = Date.now();
                    console.log(`[ProxyMonitor] Proxy connected (latency: ${latency}ms)`);
                }
                
                // Update uptime
                if (this.statusChangeTime) {
                    this.stats.uptime += Date.now() - this.statusChangeTime;
                }
                
                // Emit status change if changed
                if (wasAvailable !== this.isAvailable) {
                    this.emit('statusChanged', {
                        available: true,
                        latency,
                        timestamp: Date.now()
                    });
                }
                
                this.lastStatus = true;
                resolve(true);
            });

            socket.on('error', (error) => {
                const wasAvailable = this.isAvailable;
                
                this.isAvailable = false;
                this.stats.failedConnections++;
                
                socket.destroy();
                
                // Track status change
                if (wasAvailable) {
                    this.statusChangeTime = Date.now();
                    console.log(`[ProxyMonitor] Proxy disconnected: ${error.message}`);
                }
                
                // Update downtime
                if (this.statusChangeTime && !wasAvailable) {
                    this.stats.downtime += Date.now() - this.statusChangeTime;
                }
                
                // Emit status change if changed
                if (wasAvailable !== this.isAvailable) {
                    this.emit('statusChanged', {
                        available: false,
                        error: error.message,
                        timestamp: Date.now()
                    });
                }
                
                this.lastStatus = false;
                resolve(false);
            });

            socket.on('timeout', () => {
                const wasAvailable = this.isAvailable;
                
                this.isAvailable = false;
                this.stats.failedConnections++;
                
                socket.destroy();
                
                if (wasAvailable) {
                    this.statusChangeTime = Date.now();
                    console.log('[ProxyMonitor] Proxy timeout');
                }
                
                if (wasAvailable !== this.isAvailable) {
                    this.emit('statusChanged', {
                        available: false,
                        error: 'Connection timeout',
                        timestamp: Date.now()
                    });
                }
                
                this.lastStatus = false;
                resolve(false);
            });

            socket.connect(this.port, this.host);
        });
    }

    /**
     * Record bytes transferred for throughput calculation
     */
    recordBytes(bytes, direction = 'both') {
        const now = Date.now();
        
        this.bytesHistory.push({
            bytes,
            direction,
            timestamp: now
        });
        
        this.bytesTransferred += bytes;
        
        // Clean up old entries
        this.bytesHistory = this.bytesHistory.filter(
            entry => now - entry.timestamp < this.historyWindowMs
        );
    }

    /**
     * Calculate current throughput in KB/s
     */
    calculateThroughput() {
        const now = Date.now();
        
        // Filter to entries within window
        const recentEntries = this.bytesHistory.filter(
            entry => now - entry.timestamp < this.historyWindowMs
        );
        
        // Sum bytes
        const totalBytes = recentEntries.reduce((sum, entry) => sum + entry.bytes, 0);
        
        // Calculate KB/s (window is in ms, so convert to seconds)
        this.throughputKBps = (totalBytes / 1024) / (this.historyWindowMs / 1000);
        
        // Emit throughput update
        this.emit('throughputUpdate', {
            kbps: this.throughputKBps,
            totalBytes: this.bytesTransferred,
            timestamp: now
        });
        
        return this.throughputKBps;
    }

    /**
     * Get current throughput formatted
     */
    getFormattedThroughput() {
        if (this.throughputKBps < 1) {
            return `${(this.throughputKBps * 1024).toFixed(0)} B/s`;
        } else if (this.throughputKBps < 1024) {
            return `${this.throughputKBps.toFixed(1)} KB/s`;
        } else {
            return `${(this.throughputKBps / 1024).toFixed(2)} MB/s`;
        }
    }

    /**
     * Configure proxy settings
     */
    configure(options = {}) {
        if (options.host) this.host = options.host;
        if (options.port) this.port = options.port;
        
        console.log(`[ProxyMonitor] Configured: ${this.host}:${this.port}`);
        
        // Restart monitoring if active
        if (this.monitorInterval) {
            this.start();
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            host: this.host,
            port: this.port,
            available: this.isAvailable,
            throughputKBps: this.throughputKBps,
            formattedThroughput: this.getFormattedThroughput(),
            totalBytesTransferred: this.bytesTransferred,
            stats: { ...this.stats },
            isMonitoring: this.monitorInterval !== null
        };
    }

    /**
     * Get connection statistics
     */
    getStats() {
        const successRate = this.stats.totalConnections > 0
            ? (this.stats.successfulConnections / this.stats.totalConnections * 100).toFixed(1)
            : 0;
            
        const totalTime = this.stats.uptime + this.stats.downtime;
        const uptimePercent = totalTime > 0
            ? (this.stats.uptime / totalTime * 100).toFixed(1)
            : 0;
        
        return {
            ...this.stats,
            successRate: `${successRate}%`,
            uptimePercent: `${uptimePercent}%`
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalConnections: 0,
            successfulConnections: 0,
            failedConnections: 0,
            lastCheckTime: null,
            lastSuccessTime: null,
            uptime: 0,
            downtime: 0
        };
        
        this.bytesTransferred = 0;
        this.bytesHistory = [];
        this.throughputKBps = 0;
        
        this.emit('statsReset');
    }

    /**
     * Test proxy connection with HTTP request
     */
    async testConnection() {
        return new Promise((resolve) => {
            const http = require('http');
            
            const options = {
                host: this.host,
                port: this.port,
                path: 'http://www.google.com/',
                method: 'GET',
                timeout: 5000
            };
            
            const req = http.request(options, (res) => {
                resolve({
                    success: true,
                    statusCode: res.statusCode,
                    headers: res.headers
                });
            });
            
            req.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve({
                    success: false,
                    error: 'Request timeout'
                });
            });
            
            req.end();
        });
    }
}

module.exports = new ProxyMonitor();
