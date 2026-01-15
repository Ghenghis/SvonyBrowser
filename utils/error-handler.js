/**
 * Centralized Error Handler v2.0.7
 * Provides consistent error handling, reporting, and recovery across all services
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');

const logger = getLogger('error-handler');

// Error categories
const ERROR_CATEGORIES = {
    NETWORK: 'network',
    MCP: 'mcp',
    LLM: 'llm',
    TRAFFIC: 'traffic',
    GAME_STATE: 'game_state',
    STORAGE: 'storage',
    IPC: 'ipc',
    UI: 'ui',
    UNKNOWN: 'unknown'
};

// Error severity levels
const ERROR_SEVERITY = {
    LOW: 'low',         // Informational, can be ignored
    MEDIUM: 'medium',   // Should be addressed but not critical
    HIGH: 'high',       // Important, may affect functionality
    CRITICAL: 'critical' // Must be addressed immediately
};

/**
 * Custom application error class
 */
class AppError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'AppError';
        this.category = options.category || ERROR_CATEGORIES.UNKNOWN;
        this.severity = options.severity || ERROR_SEVERITY.MEDIUM;
        this.code = options.code || 'UNKNOWN_ERROR';
        this.details = options.details || {};
        this.recoverable = options.recoverable !== false;
        this.timestamp = Date.now();
        this.originalError = options.originalError || null;
        
        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }
    
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            category: this.category,
            severity: this.severity,
            code: this.code,
            details: this.details,
            recoverable: this.recoverable,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

/**
 * Error Handler class
 */
class ErrorHandler extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            maxErrorHistory: options.maxErrorHistory || 100,
            reportErrors: options.reportErrors || false,
            autoRecover: options.autoRecover !== false
        };
        
        // Error history
        this.errorHistory = [];
        
        // Error counts by category
        this.errorCounts = {};
        for (const category of Object.values(ERROR_CATEGORIES)) {
            this.errorCounts[category] = 0;
        }
        
        // Recovery handlers
        this.recoveryHandlers = new Map();
        
        // Statistics
        this.stats = {
            totalErrors: 0,
            recoveredErrors: 0,
            unrecoveredErrors: 0,
            startTime: Date.now()
        };
    }
    
    /**
     * Handle an error
     */
    handle(error, context = {}) {
        // Convert to AppError if needed
        const appError = this.normalizeError(error, context);
        
        // Log the error
        this.logError(appError);
        
        // Add to history
        this.addToHistory(appError);
        
        // Update statistics
        this.updateStats(appError);
        
        // Emit error event
        this.emit('error', appError);
        
        // Attempt recovery if enabled
        if (this.config.autoRecover && appError.recoverable) {
            this.attemptRecovery(appError, context);
        }
        
        return appError;
    }
    
    /**
     * Normalize error to AppError
     */
    normalizeError(error, context = {}) {
        if (error instanceof AppError) {
            return error;
        }
        
        // Determine category from error message or context
        const category = this.categorizeError(error, context);
        const severity = this.determineSeverity(error, context);
        
        return new AppError(error.message || String(error), {
            category,
            severity,
            code: error.code || this.generateErrorCode(category),
            details: {
                ...context,
                originalMessage: error.message,
                originalName: error.name
            },
            originalError: error
        });
    }
    
    /**
     * Categorize error based on message and context
     */
    categorizeError(error, context) {
        const message = (error.message || '').toLowerCase();
        
        if (context.category) {
            return context.category;
        }
        
        if (message.includes('network') || message.includes('fetch') || 
            message.includes('connection') || message.includes('timeout') ||
            message.includes('econnrefused') || message.includes('enotfound')) {
            return ERROR_CATEGORIES.NETWORK;
        }
        
        if (message.includes('mcp') || message.includes('tool')) {
            return ERROR_CATEGORIES.MCP;
        }
        
        if (message.includes('lm studio') || message.includes('llm') ||
            message.includes('chat completion') || message.includes('model')) {
            return ERROR_CATEGORIES.LLM;
        }
        
        if (message.includes('traffic') || message.includes('packet') ||
            message.includes('amf') || message.includes('decode')) {
            return ERROR_CATEGORIES.TRAFFIC;
        }
        
        if (message.includes('game state') || message.includes('player') ||
            message.includes('city') || message.includes('hero')) {
            return ERROR_CATEGORIES.GAME_STATE;
        }
        
        if (message.includes('storage') || message.includes('file') ||
            message.includes('write') || message.includes('read') ||
            message.includes('enoent') || message.includes('eacces')) {
            return ERROR_CATEGORIES.STORAGE;
        }
        
        if (message.includes('ipc') || message.includes('channel')) {
            return ERROR_CATEGORIES.IPC;
        }
        
        return ERROR_CATEGORIES.UNKNOWN;
    }
    
    /**
     * Determine error severity
     */
    determineSeverity(error, context) {
        if (context.severity) {
            return context.severity;
        }
        
        const message = (error.message || '').toLowerCase();
        
        // Critical errors
        if (message.includes('fatal') || message.includes('crash') ||
            message.includes('out of memory') || message.includes('unhandled')) {
            return ERROR_SEVERITY.CRITICAL;
        }
        
        // High severity
        if (message.includes('failed') || message.includes('error') ||
            message.includes('invalid') || message.includes('corrupt')) {
            return ERROR_SEVERITY.HIGH;
        }
        
        // Medium severity
        if (message.includes('warning') || message.includes('timeout') ||
            message.includes('retry')) {
            return ERROR_SEVERITY.MEDIUM;
        }
        
        return ERROR_SEVERITY.LOW;
    }
    
    /**
     * Generate error code
     */
    generateErrorCode(category) {
        const prefix = category.toUpperCase().substring(0, 3);
        const count = this.errorCounts[category] || 0;
        return `${prefix}_${String(count + 1).padStart(4, '0')}`;
    }
    
    /**
     * Log error
     */
    logError(appError) {
        const logMethod = appError.severity === ERROR_SEVERITY.CRITICAL ? 'fatal'
            : appError.severity === ERROR_SEVERITY.HIGH ? 'error'
            : appError.severity === ERROR_SEVERITY.MEDIUM ? 'warn'
            : 'info';
        
        logger[logMethod](`[${appError.code}] ${appError.message}`, {
            category: appError.category,
            severity: appError.severity,
            recoverable: appError.recoverable,
            details: appError.details
        });
    }
    
    /**
     * Add error to history
     */
    addToHistory(appError) {
        this.errorHistory.push(appError.toJSON());
        
        // Trim history
        if (this.errorHistory.length > this.config.maxErrorHistory) {
            this.errorHistory.shift();
        }
    }
    
    /**
     * Update statistics
     */
    updateStats(appError) {
        this.stats.totalErrors++;
        this.errorCounts[appError.category]++;
    }
    
    /**
     * Register recovery handler
     */
    registerRecoveryHandler(category, handler) {
        if (!this.recoveryHandlers.has(category)) {
            this.recoveryHandlers.set(category, []);
        }
        this.recoveryHandlers.get(category).push(handler);
    }
    
    /**
     * Attempt error recovery
     */
    async attemptRecovery(appError, context) {
        const handlers = this.recoveryHandlers.get(appError.category) || [];
        
        for (const handler of handlers) {
            try {
                const recovered = await handler(appError, context);
                if (recovered) {
                    this.stats.recoveredErrors++;
                    this.emit('recovered', appError);
                    logger.info(`Recovered from error: ${appError.code}`);
                    return true;
                }
            } catch (recoveryError) {
                logger.error(`Recovery handler failed: ${recoveryError.message}`);
            }
        }
        
        this.stats.unrecoveredErrors++;
        this.emit('unrecovered', appError);
        return false;
    }
    
    /**
     * Get error history
     */
    getHistory(options = {}) {
        let history = [...this.errorHistory];
        
        if (options.category) {
            history = history.filter(e => e.category === options.category);
        }
        
        if (options.severity) {
            history = history.filter(e => e.severity === options.severity);
        }
        
        if (options.since) {
            history = history.filter(e => e.timestamp >= options.since);
        }
        
        if (options.limit) {
            history = history.slice(-options.limit);
        }
        
        return history;
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            errorCounts: { ...this.errorCounts },
            recoveryRate: this.stats.totalErrors > 0
                ? ((this.stats.recoveredErrors / this.stats.totalErrors) * 100).toFixed(2) + '%'
                : '0%'
        };
    }
    
    /**
     * Clear error history
     */
    clearHistory() {
        this.errorHistory = [];
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalErrors: 0,
            recoveredErrors: 0,
            unrecoveredErrors: 0,
            startTime: Date.now()
        };
        
        for (const category of Object.values(ERROR_CATEGORIES)) {
            this.errorCounts[category] = 0;
        }
    }
}

/**
 * IPC Error wrapper for consistent error responses
 */
function wrapIPCHandler(handler, context = {}) {
    return async (...args) => {
        try {
            return await handler(...args);
        } catch (error) {
            const appError = errorHandler.handle(error, context);
            return {
                success: false,
                error: {
                    message: appError.message,
                    code: appError.code,
                    category: appError.category,
                    recoverable: appError.recoverable
                }
            };
        }
    };
}

/**
 * Create async error boundary
 */
function asyncErrorBoundary(fn, context = {}) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            errorHandler.handle(error, context);
            throw error;
        }
    };
}

// Create default error handler
const errorHandler = new ErrorHandler();

// Register default recovery handlers
errorHandler.registerRecoveryHandler(ERROR_CATEGORIES.NETWORK, async (error, context) => {
    // Network errors can often be recovered by retrying
    if (context.retry && typeof context.retry === 'function') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await context.retry();
        return true;
    }
    return false;
});

errorHandler.registerRecoveryHandler(ERROR_CATEGORIES.MCP, async (error, context) => {
    // MCP errors might be recovered by reconnecting
    if (context.reconnect && typeof context.reconnect === 'function') {
        await context.reconnect();
        return true;
    }
    return false;
});

module.exports = {
    ErrorHandler,
    AppError,
    ERROR_CATEGORIES,
    ERROR_SEVERITY,
    errorHandler,
    wrapIPCHandler,
    asyncErrorBoundary
};
