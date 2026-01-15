/**
 * Centralized Logger v2.0.7
 * Provides consistent logging across all services with file output and log levels
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

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
    DEBUG: '\x1b[36m', // Cyan
    INFO: '\x1b[32m',  // Green
    WARN: '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m', // Red
    FATAL: '\x1b[35m'  // Magenta
};
const RESET_COLOR = '\x1b[0m';

/**
 * Logger class
 */
class Logger extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            level: options.level || LOG_LEVELS.INFO,
            name: options.name || 'app',
            logToConsole: options.logToConsole !== false,
            logToFile: options.logToFile || false,
            logDir: options.logDir || path.join(process.cwd(), 'logs'),
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
            maxFiles: options.maxFiles || 5,
            colorize: options.colorize !== false,
            timestamp: options.timestamp !== false
        };
        
        this.logBuffer = [];
        this.maxBufferSize = 1000;
        this.currentLogFile = null;
        this.currentFileSize = 0;
        
        // Create log directory if needed
        if (this.config.logToFile) {
            this.ensureLogDir();
            this.rotateLogFile();
        }
    }
    
    /**
     * Ensure log directory exists
     */
    ensureLogDir() {
        if (!fs.existsSync(this.config.logDir)) {
            fs.mkdirSync(this.config.logDir, { recursive: true });
        }
    }
    
    /**
     * Rotate log file
     */
    rotateLogFile() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        this.currentLogFile = path.join(
            this.config.logDir, 
            `${this.config.name}-${timestamp}.log`
        );
        this.currentFileSize = 0;
        
        // Check if file exists and get size
        if (fs.existsSync(this.currentLogFile)) {
            const stats = fs.statSync(this.currentLogFile);
            this.currentFileSize = stats.size;
        }
        
        // Clean up old log files
        this.cleanOldLogs();
    }
    
    /**
     * Clean up old log files
     */
    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.config.logDir)
                .filter(f => f.startsWith(this.config.name) && f.endsWith('.log'))
                .map(f => ({
                    name: f,
                    path: path.join(this.config.logDir, f),
                    time: fs.statSync(path.join(this.config.logDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time);
            
            // Remove files beyond maxFiles
            while (files.length > this.config.maxFiles) {
                const oldest = files.pop();
                fs.unlinkSync(oldest.path);
            }
        } catch (error) {
            console.error('Failed to clean old logs:', error.message);
        }
    }
    
    /**
     * Format log message
     */
    formatMessage(level, message, meta = {}) {
        const timestamp = this.config.timestamp 
            ? new Date().toISOString() 
            : '';
        
        const levelName = LEVEL_NAMES[level];
        const metaStr = Object.keys(meta).length > 0 
            ? ' ' + JSON.stringify(meta) 
            : '';
        
        return {
            timestamp,
            level: levelName,
            name: this.config.name,
            message,
            meta,
            formatted: `${timestamp} [${levelName}] [${this.config.name}] ${message}${metaStr}`
        };
    }
    
    /**
     * Write log entry
     */
    log(level, message, meta = {}) {
        if (level < this.config.level) {
            return;
        }
        
        const entry = this.formatMessage(level, message, meta);
        
        // Add to buffer
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }
        
        // Console output
        if (this.config.logToConsole) {
            const levelName = LEVEL_NAMES[level];
            const color = this.config.colorize ? LEVEL_COLORS[levelName] : '';
            const reset = this.config.colorize ? RESET_COLOR : '';
            console.log(`${color}${entry.formatted}${reset}`);
        }
        
        // File output
        if (this.config.logToFile && this.currentLogFile) {
            this.writeToFile(entry.formatted + '\n');
        }
        
        // Emit event
        this.emit('log', entry);
        
        return entry;
    }
    
    /**
     * Write to log file
     */
    writeToFile(text) {
        try {
            // Check if rotation needed
            if (this.currentFileSize > this.config.maxFileSize) {
                this.rotateLogFile();
            }
            
            fs.appendFileSync(this.currentLogFile, text);
            this.currentFileSize += text.length;
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }
    
    // Convenience methods
    debug(message, meta = {}) {
        return this.log(LOG_LEVELS.DEBUG, message, meta);
    }
    
    info(message, meta = {}) {
        return this.log(LOG_LEVELS.INFO, message, meta);
    }
    
    warn(message, meta = {}) {
        return this.log(LOG_LEVELS.WARN, message, meta);
    }
    
    error(message, meta = {}) {
        return this.log(LOG_LEVELS.ERROR, message, meta);
    }
    
    fatal(message, meta = {}) {
        return this.log(LOG_LEVELS.FATAL, message, meta);
    }
    
    /**
     * Get recent logs
     */
    getRecentLogs(count = 100, level = null) {
        let logs = this.logBuffer.slice(-count);
        
        if (level !== null) {
            const levelIndex = typeof level === 'string' 
                ? LOG_LEVELS[level.toUpperCase()] 
                : level;
            logs = logs.filter(l => LOG_LEVELS[l.level] >= levelIndex);
        }
        
        return logs;
    }
    
    /**
     * Clear log buffer
     */
    clearBuffer() {
        this.logBuffer = [];
    }
    
    /**
     * Set log level
     */
    setLevel(level) {
        if (typeof level === 'string') {
            this.config.level = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
        } else {
            this.config.level = level;
        }
    }
    
    /**
     * Create child logger with different name
     */
    child(name) {
        return new Logger({
            ...this.config,
            name: `${this.config.name}:${name}`
        });
    }
}

/**
 * LoggerManager - manages multiple loggers
 */
class LoggerManager {
    constructor() {
        this.loggers = new Map();
        this.defaultConfig = {
            level: LOG_LEVELS.INFO,
            logToConsole: true,
            logToFile: false
        };
    }
    
    /**
     * Get or create logger
     */
    getLogger(name, options = {}) {
        if (!this.loggers.has(name)) {
            const logger = new Logger({
                ...this.defaultConfig,
                ...options,
                name
            });
            this.loggers.set(name, logger);
        }
        return this.loggers.get(name);
    }
    
    /**
     * Set default configuration
     */
    setDefaultConfig(config) {
        this.defaultConfig = { ...this.defaultConfig, ...config };
    }
    
    /**
     * Set level for all loggers
     */
    setGlobalLevel(level) {
        for (const logger of this.loggers.values()) {
            logger.setLevel(level);
        }
    }
    
    /**
     * Get all logs from all loggers
     */
    getAllLogs(count = 100) {
        const allLogs = [];
        
        for (const logger of this.loggers.values()) {
            allLogs.push(...logger.getRecentLogs(count));
        }
        
        return allLogs
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .slice(-count);
    }
}

// Create default manager and logger
const manager = new LoggerManager();
const defaultLogger = manager.getLogger('app');

module.exports = {
    Logger,
    LoggerManager,
    LOG_LEVELS,
    LEVEL_NAMES,
    manager,
    logger: defaultLogger,
    getLogger: (name, options) => manager.getLogger(name, options)
};
