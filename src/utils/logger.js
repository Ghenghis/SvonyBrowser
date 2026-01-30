/**
 * Centralized Logging System
 * Integrates with monitoring and error handling for comprehensive logging
 * SvonyBrowser v2.2.13
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logDir = path.join(app.getPath('userData'), 'logs');
        this.currentLogFile = null;
        this.logBuffer = [];
        this.bufferSize = 100;
        this.flushInterval = 5000; // 5 seconds
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = 5;
        
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            fatal: 4
        };
        
        this.initializeLogger();
    }

    async initializeLogger() {
        // Ensure log directory exists
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create log directory:', error);
        }

        // Initialize log file
        await this.rotateLogFile();
        
        // Start periodic flushing
        this.startPeriodicFlush();
        
        // Handle process shutdown
        process.on('beforeExit', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }

    async rotateLogFile() {
        const timestamp = new Date().toISOString().split('T')[0];
        const logFileName = `svony-${timestamp}.log`;
        this.currentLogFile = path.join(this.logDir, logFileName);
        
        // Check if we need to rotate based on size
        try {
            const stats = await fs.stat(this.currentLogFile);
            if (stats.size > this.maxLogSize) {
                const rotatedName = `svony-${timestamp}-${Date.now()}.log`;
                await fs.rename(this.currentLogFile, path.join(this.logDir, rotatedName));
                await this.cleanupOldLogs();
            }
        } catch (error) {
            // File doesn't exist yet, which is fine
        }
    }

    async cleanupOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const logFiles = files
                .filter(f => f.startsWith('svony-') && f.endsWith('.log'))
                .map(f => ({ name: f, path: path.join(this.logDir, f) }))
                .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name descending

            if (logFiles.length > this.maxLogFiles) {
                const filesToDelete = logFiles.slice(this.maxLogFiles);
                for (const file of filesToDelete) {
                    await fs.unlink(file.path);
                }
            }
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }

    startPeriodicFlush() {
        setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    shouldLog(level) {
        return this.levels[level] >= this.levels[this.logLevel];
    }

    formatLogEntry(level, message, context = {}, module = 'APP') {
        const timestamp = new Date().toISOString();
        const processInfo = {
            pid: process.pid,
            version: app.getVersion(),
            platform: process.platform
        };

        return {
            timestamp,
            level: level.toUpperCase(),
            module,
            message,
            context,
            process: processInfo,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
    }

    log(level, message, context = {}, module = 'APP') {
        if (!this.shouldLog(level)) return;

        const logEntry = this.formatLogEntry(level, message, context, module);
        
        // Add to buffer
        this.logBuffer.push(logEntry);
        
        // Console output with colors
        this.consoleLog(logEntry);
        
        // Flush buffer if it's full
        if (this.logBuffer.length >= this.bufferSize) {
            this.flush();
        }
        
        return logEntry;
    }

    consoleLog(logEntry) {
        const colors = {
            DEBUG: '\x1b[36m',    // Cyan
            INFO: '\x1b[32m',     // Green  
            WARN: '\x1b[33m',     // Yellow
            ERROR: '\x1b[31m',    // Red
            FATAL: '\x1b[41m',    // Red background
            RESET: '\x1b[0m'      // Reset
        };

        const color = colors[logEntry.level] || colors.RESET;
        const prefix = `${color}[${logEntry.level}]${colors.RESET}`;
        const modulePrefix = `[${logEntry.module}]`;
        
        console.log(`${logEntry.timestamp} ${prefix} ${modulePrefix} ${logEntry.message}`);
        
        if (Object.keys(logEntry.context).length > 0) {
            console.log('  Context:', JSON.stringify(logEntry.context, null, 2));
        }
    }

    async flush() {
        if (this.logBuffer.length === 0 || !this.currentLogFile) return;

        try {
            const logLines = this.logBuffer.map(entry => JSON.stringify(entry)).join('\n') + '\n';
            await fs.appendFile(this.currentLogFile, logLines);
            this.logBuffer = [];
            
            // Check if we need to rotate
            await this.rotateLogFile();
        } catch (error) {
            console.error('Failed to flush logs:', error);
        }
    }

    // Convenience methods
    debug(message, context = {}, module = 'APP') {
        return this.log('debug', message, context, module);
    }

    info(message, context = {}, module = 'APP') {
        return this.log('info', message, context, module);
    }

    warn(message, context = {}, module = 'APP') {
        return this.log('warn', message, context, module);
    }

    error(message, context = {}, module = 'APP') {
        return this.log('error', message, context, module);
    }

    fatal(message, context = {}, module = 'APP') {
        return this.log('fatal', message, context, module);
    }

    // Specialized logging methods
    logPerformance(operation, duration, context = {}) {
        return this.info(`Performance: ${operation} completed in ${duration}ms`, {
            ...context,
            performance: {
                operation,
                duration,
                timestamp: Date.now()
            }
        }, 'PERF');
    }

    logUserAction(action, details = {}) {
        return this.info(`User action: ${action}`, {
            ...details,
            userAction: true,
            sessionId: this.getSessionId()
        }, 'USER');
    }

    logSystemEvent(event, details = {}) {
        return this.info(`System event: ${event}`, {
            ...details,
            systemEvent: true
        }, 'SYSTEM');
    }

    logNetworkRequest(method, url, statusCode, duration, details = {}) {
        const level = statusCode >= 400 ? 'error' : 'info';
        return this.log(level, `${method} ${url} - ${statusCode} (${duration}ms)`, {
            ...details,
            network: {
                method,
                url,
                statusCode,
                duration,
                timestamp: Date.now()
            }
        }, 'NETWORK');
    }

    logFlashEvent(event, details = {}) {
        return this.info(`Flash event: ${event}`, {
            ...details,
            flashEvent: true,
            swfUrl: details.swfUrl || 'unknown'
        }, 'FLASH');
    }

    logEvonyEvent(event, details = {}) {
        return this.info(`Evony event: ${event}`, {
            ...details,
            evonyEvent: true,
            gameState: details.gameState || 'unknown'
        }, 'EVONY');
    }

    // Query methods for log analysis
    async queryLogs(criteria = {}) {
        try {
            const files = await fs.readdir(this.logDir);
            const logFiles = files.filter(f => f.startsWith('svony-') && f.endsWith('.log'));
            
            const results = [];
            
            for (const file of logFiles.slice(0, 5)) { // Only search recent files
                const content = await fs.readFile(path.join(this.logDir, file), 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const entry = JSON.parse(line);
                        if (this.matchesCriteria(entry, criteria)) {
                            results.push(entry);
                        }
                    } catch (error) {
                        // Skip malformed entries
                    }
                }
            }
            
            return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            this.error('Failed to query logs', { error: error.message });
            return [];
        }
    }

    matchesCriteria(entry, criteria) {
        if (criteria.level && entry.level !== criteria.level.toUpperCase()) return false;
        if (criteria.module && entry.module !== criteria.module) return false;
        if (criteria.message && !entry.message.includes(criteria.message)) return false;
        if (criteria.since && new Date(entry.timestamp) < criteria.since) return false;
        if (criteria.until && new Date(entry.timestamp) > criteria.until) return false;
        
        return true;
    }

    async getLogStatistics(hoursBack = 24) {
        const since = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
        const logs = await this.queryLogs({ since });
        
        const stats = {
            total: logs.length,
            byLevel: {},
            byModule: {},
            errorRate: 0,
            timeRange: {
                from: since.toISOString(),
                to: new Date().toISOString(),
                hours: hoursBack
            }
        };
        
        logs.forEach(log => {
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
            stats.byModule[log.module] = (stats.byModule[log.module] || 0) + 1;
        });
        
        const errorCount = (stats.byLevel.ERROR || 0) + (stats.byLevel.FATAL || 0);
        stats.errorRate = logs.length > 0 ? (errorCount / logs.length) : 0;
        
        return stats;
    }

    getSessionId() {
        // Generate or retrieve session identifier
        if (!this._sessionId) {
            this._sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        return this._sessionId;
    }

    async shutdown() {
        await this.flush();
        console.log('Logger shut down');
    }
}

// Singleton instance
let logger = null;

function getLogger() {
    if (!logger) {
        logger = new Logger();
    }
    return logger;
}

module.exports = {
    Logger,
    getLogger
};
