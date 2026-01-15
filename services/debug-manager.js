/**
 * Debug Manager Service
 * Central coordination for all debugging features
 * v2.0.9
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

// Log levels
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
};

const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
const LEVEL_COLORS = {
    DEBUG: '#6c757d',
    INFO: '#17a2b8',
    WARN: '#ffc107',
    ERROR: '#dc3545',
    FATAL: '#721c24'
};

/**
 * Log Entry class
 */
class LogEntry {
    constructor(level, source, message, meta = {}) {
        this.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        this.timestamp = new Date().toISOString();
        this.level = level;
        this.levelName = LEVEL_NAMES[level] || 'UNKNOWN';
        this.source = source;
        this.message = message;
        this.meta = meta;
        this.stack = meta.stack || null;
    }

    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            level: this.level,
            levelName: this.levelName,
            source: this.source,
            message: this.message,
            meta: this.meta,
            stack: this.stack
        };
    }

    toString() {
        return `[${this.timestamp}] [${this.levelName}] [${this.source}] ${this.message}`;
    }
}

/**
 * Breakpoint class
 */
class Breakpoint {
    constructor(id, type, condition, options = {}) {
        this.id = id;
        this.type = type; // 'event', 'log', 'network', 'error'
        this.condition = condition; // Function or string pattern
        this.enabled = true;
        this.hitCount = 0;
        this.options = options;
        this.createdAt = new Date().toISOString();
    }

    matches(data) {
        if (!this.enabled) return false;
        
        if (typeof this.condition === 'function') {
            try {
                return this.condition(data);
            } catch (e) {
                return false;
            }
        } else if (typeof this.condition === 'string') {
            const str = JSON.stringify(data);
            return str.includes(this.condition);
        }
        return false;
    }

    hit() {
        this.hitCount++;
        return this.hitCount;
    }
}

/**
 * Watch Expression class
 */
class WatchExpression {
    constructor(id, expression, context = 'global') {
        this.id = id;
        this.expression = expression;
        this.context = context;
        this.lastValue = undefined;
        this.lastError = null;
        this.history = [];
        this.maxHistory = 100;
    }

    evaluate(contextObj = {}) {
        try {
            // Safe evaluation using Function constructor
            const fn = new Function(...Object.keys(contextObj), `return ${this.expression}`);
            const value = fn(...Object.values(contextObj));
            
            // Track history
            if (this.lastValue !== value) {
                this.history.push({
                    timestamp: new Date().toISOString(),
                    value: this.lastValue,
                    newValue: value
                });
                if (this.history.length > this.maxHistory) {
                    this.history.shift();
                }
            }
            
            this.lastValue = value;
            this.lastError = null;
            return { success: true, value };
        } catch (error) {
            this.lastError = error.message;
            return { success: false, error: error.message };
        }
    }
}

/**
 * Debug Manager - Main class
 */
class DebugManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxLogs: options.maxLogs || 10000,
            logLevel: options.logLevel || LOG_LEVELS.DEBUG,
            persistLogs: options.persistLogs !== false,
            logDir: options.logDir || path.join(process.cwd(), 'logs'),
            autoExport: options.autoExport || false,
            exportInterval: options.exportInterval || 3600000, // 1 hour
            ...options
        };

        // Storage
        this.logs = [];
        this.breakpoints = new Map();
        this.watches = new Map();
        this.metrics = {
            startTime: Date.now(),
            logCount: 0,
            errorCount: 0,
            warnCount: 0,
            breakpointHits: 0
        };

        // State
        this.isPaused = false;
        this.pauseReason = null;
        this.pendingBreakpoint = null;

        // Services registry
        this.services = new Map();

        // Initialize
        this._ensureLogDir();
        this._setupAutoExport();
        this._interceptConsole();
    }

    /**
     * Ensure log directory exists
     */
    _ensureLogDir() {
        if (this.options.persistLogs && !fs.existsSync(this.options.logDir)) {
            fs.mkdirSync(this.options.logDir, { recursive: true });
        }
    }

    /**
     * Setup auto export
     */
    _setupAutoExport() {
        if (this.options.autoExport) {
            this.exportInterval = setInterval(() => {
                this.exportLogs('json');
            }, this.options.exportInterval);
        }
    }

    /**
     * Intercept console methods
     */
    _interceptConsole() {
        const self = this;
        const originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        };

        // Store original for restoration
        this.originalConsole = originalConsole;

        // Override console methods
        console.log = function(...args) {
            self.log(LOG_LEVELS.INFO, 'Console', args.map(a => self._stringify(a)).join(' '));
            originalConsole.log.apply(console, args);
        };

        console.info = function(...args) {
            self.log(LOG_LEVELS.INFO, 'Console', args.map(a => self._stringify(a)).join(' '));
            originalConsole.info.apply(console, args);
        };

        console.warn = function(...args) {
            self.log(LOG_LEVELS.WARN, 'Console', args.map(a => self._stringify(a)).join(' '));
            originalConsole.warn.apply(console, args);
        };

        console.error = function(...args) {
            self.log(LOG_LEVELS.ERROR, 'Console', args.map(a => self._stringify(a)).join(' '));
            originalConsole.error.apply(console, args);
        };

        console.debug = function(...args) {
            self.log(LOG_LEVELS.DEBUG, 'Console', args.map(a => self._stringify(a)).join(' '));
            originalConsole.debug.apply(console, args);
        };
    }

    /**
     * Stringify value for logging
     */
    _stringify(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return value;
        if (value instanceof Error) {
            return `${value.name}: ${value.message}\n${value.stack}`;
        }
        try {
            return JSON.stringify(value, null, 2);
        } catch (e) {
            return String(value);
        }
    }

    /**
     * Register a service for debugging
     */
    registerService(name, service) {
        this.services.set(name, {
            service,
            registeredAt: new Date().toISOString(),
            logCount: 0
        });
        this.log(LOG_LEVELS.DEBUG, 'DebugManager', `Service registered: ${name}`);
    }

    /**
     * Create a logger for a specific source
     */
    createLogger(source) {
        const self = this;
        return {
            debug: (msg, meta) => self.log(LOG_LEVELS.DEBUG, source, msg, meta),
            info: (msg, meta) => self.log(LOG_LEVELS.INFO, source, msg, meta),
            warn: (msg, meta) => self.log(LOG_LEVELS.WARN, source, msg, meta),
            error: (msg, meta) => self.log(LOG_LEVELS.ERROR, source, msg, meta),
            fatal: (msg, meta) => self.log(LOG_LEVELS.FATAL, source, msg, meta)
        };
    }

    /**
     * Log a message
     */
    log(level, source, message, meta = {}) {
        // Check log level filter
        if (level < this.options.logLevel) return;

        // Create log entry
        const entry = new LogEntry(level, source, message, meta);
        
        // Add to storage
        this.logs.push(entry);
        this.metrics.logCount++;

        // Update metrics
        if (level === LOG_LEVELS.ERROR || level === LOG_LEVELS.FATAL) {
            this.metrics.errorCount++;
        } else if (level === LOG_LEVELS.WARN) {
            this.metrics.warnCount++;
        }

        // Update service log count
        if (this.services.has(source)) {
            this.services.get(source).logCount++;
        }

        // Trim logs if exceeding max
        if (this.logs.length > this.options.maxLogs) {
            this.logs.shift();
        }

        // Check breakpoints
        this._checkBreakpoints('log', entry);

        // Emit event
        this.emit('log', entry);

        return entry;
    }

    /**
     * Check breakpoints
     */
    _checkBreakpoints(type, data) {
        for (const [id, bp] of this.breakpoints) {
            if (bp.type === type && bp.matches(data)) {
                bp.hit();
                this.metrics.breakpointHits++;
                
                if (bp.options.pause) {
                    this.pause(`Breakpoint hit: ${id}`);
                    this.pendingBreakpoint = bp;
                }

                this.emit('breakpoint-hit', { breakpoint: bp, data });
            }
        }
    }

    /**
     * Add a breakpoint
     */
    addBreakpoint(type, condition, options = {}) {
        const id = `bp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const bp = new Breakpoint(id, type, condition, options);
        this.breakpoints.set(id, bp);
        this.emit('breakpoint-added', bp);
        return bp;
    }

    /**
     * Remove a breakpoint
     */
    removeBreakpoint(id) {
        const bp = this.breakpoints.get(id);
        if (bp) {
            this.breakpoints.delete(id);
            this.emit('breakpoint-removed', bp);
            return true;
        }
        return false;
    }

    /**
     * Enable/disable a breakpoint
     */
    toggleBreakpoint(id, enabled) {
        const bp = this.breakpoints.get(id);
        if (bp) {
            bp.enabled = enabled;
            this.emit('breakpoint-toggled', bp);
            return true;
        }
        return false;
    }

    /**
     * Get all breakpoints
     */
    getBreakpoints() {
        return Array.from(this.breakpoints.values());
    }

    /**
     * Add a watch expression
     */
    addWatch(expression, context = 'global') {
        const id = `watch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const watch = new WatchExpression(id, expression, context);
        this.watches.set(id, watch);
        this.emit('watch-added', watch);
        return watch;
    }

    /**
     * Remove a watch expression
     */
    removeWatch(id) {
        const watch = this.watches.get(id);
        if (watch) {
            this.watches.delete(id);
            this.emit('watch-removed', watch);
            return true;
        }
        return false;
    }

    /**
     * Evaluate all watches
     */
    evaluateWatches(context = {}) {
        const results = [];
        for (const [id, watch] of this.watches) {
            const result = watch.evaluate(context);
            results.push({ id, expression: watch.expression, ...result });
        }
        return results;
    }

    /**
     * Get all watches
     */
    getWatches() {
        return Array.from(this.watches.values());
    }

    /**
     * Pause execution
     */
    pause(reason = 'Manual pause') {
        this.isPaused = true;
        this.pauseReason = reason;
        this.emit('paused', { reason });
    }

    /**
     * Resume execution
     */
    resume() {
        this.isPaused = false;
        this.pauseReason = null;
        this.pendingBreakpoint = null;
        this.emit('resumed');
    }

    /**
     * Step over (continue to next log)
     */
    stepOver() {
        // Add temporary breakpoint for next log
        const tempBp = this.addBreakpoint('log', () => true, { pause: true, temporary: true });
        this.resume();
        return tempBp;
    }

    /**
     * Get logs with filtering
     */
    getLogs(options = {}) {
        let logs = [...this.logs];

        // Filter by level
        if (options.level !== undefined) {
            logs = logs.filter(l => l.level >= options.level);
        }

        // Filter by source
        if (options.source) {
            const sources = Array.isArray(options.source) ? options.source : [options.source];
            logs = logs.filter(l => sources.includes(l.source));
        }

        // Filter by search term
        if (options.search) {
            const term = options.search.toLowerCase();
            logs = logs.filter(l => 
                l.message.toLowerCase().includes(term) ||
                l.source.toLowerCase().includes(term)
            );
        }

        // Filter by time range
        if (options.startTime) {
            logs = logs.filter(l => new Date(l.timestamp) >= new Date(options.startTime));
        }
        if (options.endTime) {
            logs = logs.filter(l => new Date(l.timestamp) <= new Date(options.endTime));
        }

        // Limit results
        if (options.limit) {
            logs = logs.slice(-options.limit);
        }

        return logs;
    }

    /**
     * Clear logs
     */
    clearLogs() {
        this.logs = [];
        this.emit('logs-cleared');
    }

    /**
     * Export logs to file
     */
    exportLogs(format = 'json', filename = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultFilename = `svony-logs-${timestamp}`;
        const outputFilename = filename || defaultFilename;
        
        let content;
        let extension;

        switch (format) {
            case 'json':
                content = JSON.stringify(this.logs.map(l => l.toJSON()), null, 2);
                extension = 'json';
                break;
            case 'csv':
                const headers = ['timestamp', 'level', 'source', 'message'];
                const rows = this.logs.map(l => [
                    l.timestamp,
                    l.levelName,
                    l.source,
                    `"${l.message.replace(/"/g, '""')}"`
                ].join(','));
                content = [headers.join(','), ...rows].join('\n');
                extension = 'csv';
                break;
            case 'html':
                content = this._generateHtmlReport();
                extension = 'html';
                break;
            default:
                content = this.logs.map(l => l.toString()).join('\n');
                extension = 'txt';
        }

        const filepath = path.join(this.options.logDir, `${outputFilename}.${extension}`);
        fs.writeFileSync(filepath, content);
        
        this.emit('logs-exported', { filepath, format, count: this.logs.length });
        return filepath;
    }

    /**
     * Generate HTML report
     */
    _generateHtmlReport() {
        const levelColors = LEVEL_COLORS;
        const logsHtml = this.logs.map(l => `
            <tr style="color: ${levelColors[l.levelName] || '#000'}">
                <td>${l.timestamp}</td>
                <td>${l.levelName}</td>
                <td>${l.source}</td>
                <td><pre>${this._escapeHtml(l.message)}</pre></td>
            </tr>
        `).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <title>Svony Browser Debug Log</title>
    <style>
        body { font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #333; }
        th { background: #2d2d2d; }
        pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
        .header { margin-bottom: 20px; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat { background: #2d2d2d; padding: 10px 20px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Svony Browser Debug Log</h1>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>
    <div class="stats">
        <div class="stat">Total Logs: ${this.metrics.logCount}</div>
        <div class="stat">Errors: ${this.metrics.errorCount}</div>
        <div class="stat">Warnings: ${this.metrics.warnCount}</div>
    </div>
    <table>
        <thead>
            <tr>
                <th>Timestamp</th>
                <th>Level</th>
                <th>Source</th>
                <th>Message</th>
            </tr>
        </thead>
        <tbody>
            ${logsHtml}
        </tbody>
    </table>
</body>
</html>`;
    }

    /**
     * Escape HTML
     */
    _escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Get metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.startTime,
            logCount: this.logs.length,
            breakpointCount: this.breakpoints.size,
            watchCount: this.watches.size,
            serviceCount: this.services.size,
            isPaused: this.isPaused,
            pauseReason: this.pauseReason
        };
    }

    /**
     * Get service info
     */
    getServices() {
        const services = [];
        for (const [name, info] of this.services) {
            services.push({
                name,
                registeredAt: info.registeredAt,
                logCount: info.logCount
            });
        }
        return services;
    }

    /**
     * Set log level
     */
    setLogLevel(level) {
        if (typeof level === 'string') {
            level = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.DEBUG;
        }
        this.options.logLevel = level;
        this.emit('log-level-changed', level);
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: true,
            logLevel: LEVEL_NAMES[this.options.logLevel],
            logCount: this.logs.length,
            maxLogs: this.options.maxLogs,
            breakpointCount: this.breakpoints.size,
            watchCount: this.watches.size,
            isPaused: this.isPaused,
            metrics: this.getMetrics()
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        // Restore original console
        if (this.originalConsole) {
            console.log = this.originalConsole.log;
            console.info = this.originalConsole.info;
            console.warn = this.originalConsole.warn;
            console.error = this.originalConsole.error;
            console.debug = this.originalConsole.debug;
        }

        // Clear interval
        if (this.exportInterval) {
            clearInterval(this.exportInterval);
        }

        // Clear storage
        this.logs = [];
        this.breakpoints.clear();
        this.watches.clear();
        this.services.clear();

        this.emit('destroyed');
    }
}

// Export singleton and class
let instance = null;

module.exports = {
    DebugManager,
    LOG_LEVELS,
    LEVEL_NAMES,
    
    getInstance(options) {
        if (!instance) {
            instance = new DebugManager(options);
        }
        return instance;
    },
    
    createLogger(source) {
        return module.exports.getInstance().createLogger(source);
    }
};
