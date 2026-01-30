/**
 * Error Handler Integration for SvonyBrowser
 * Integrates the ErrorHandler into the main application
 */

const { getErrorHandler } = require('./error-handler');

class ErrorIntegration {
    constructor() {
        this.errorHandler = getErrorHandler();
        this.setupIntegration();
    }

    setupIntegration() {
        // Override console methods to capture logs
        this.interceptConsole();
        
        // Setup application-specific error handlers
        this.setupApplicationErrorHandlers();
    }

    interceptConsole() {
        const originalConsole = {
            error: console.error,
            warn: console.warn,
            log: console.log
        };

        console.error = (...args) => {
            originalConsole.error(...args);
            const message = args.join(' ');
            this.errorHandler.logError(message, { source: 'console.error' });
        };

        console.warn = (...args) => {
            originalConsole.warn(...args);
            const message = args.join(' ');
            this.errorHandler.logWarning(message, { source: 'console.warn' });
        };

        // Keep original console.log for normal logging
        console.log = originalConsole.log;
    }

    setupApplicationErrorHandlers() {
        // Handle Flash/SWF related errors
        this.setupFlashErrorHandling();
        
        // Handle network/traffic analysis errors
        this.setupNetworkErrorHandling();
        
        // Handle file system errors
        this.setupFileSystemErrorHandling();
    }

    setupFlashErrorHandling() {
        // Monitor Flash player errors and crashes
        const originalFlashError = global.onFlashError;
        global.onFlashError = (error) => {
            this.errorHandler.handleError('FLASH_ERROR', new Error(error.message), {
                flashVersion: error.version,
                swfUrl: error.url,
                errorCode: error.code
            }, 'error');
            
            if (originalFlashError) originalFlashError(error);
        };
    }

    setupNetworkErrorHandling() {
        // Monitor network and traffic analysis errors
        const { net } = require('electron');
        
        const originalFetch = global.fetch;
        if (originalFetch) {
            global.fetch = async (...args) => {
                try {
                    return await originalFetch(...args);
                } catch (error) {
                    this.errorHandler.handleError('NETWORK_ERROR', error, {
                        url: args[0],
                        method: args[1]?.method || 'GET'
                    }, 'error');
                    throw error;
                }
            };
        }
    }

    setupFileSystemErrorHandling() {
        const fs = require('fs').promises;
        const originalReadFile = fs.readFile;
        
        fs.readFile = async (...args) => {
            try {
                return await originalReadFile(...args);
            } catch (error) {
                this.errorHandler.handleError('FILE_READ_ERROR', error, {
                    path: args[0],
                    encoding: args[1]
                }, 'warning');
                throw error;
            }
        };
    }

    // Public methods for application-specific error reporting
    reportFlashError(message, context = {}) {
        return this.errorHandler.handleError('FLASH_ERROR', new Error(message), context, 'error');
    }

    reportEvonyError(message, context = {}) {
        return this.errorHandler.handleError('EVONY_ERROR', new Error(message), context, 'error');
    }

    reportTrafficAnalysisError(message, context = {}) {
        return this.errorHandler.handleError('TRAFFIC_ANALYSIS_ERROR', new Error(message), context, 'error');
    }

    reportUIError(message, context = {}) {
        return this.errorHandler.handleError('UI_ERROR', new Error(message), context, 'warning');
    }

    reportPerformanceWarning(message, context = {}) {
        return this.errorHandler.handleError('PERFORMANCE_WARNING', new Error(message), context, 'warning');
    }
}

// Initialize error integration
let errorIntegration = null;

function initializeErrorIntegration() {
    if (!errorIntegration) {
        errorIntegration = new ErrorIntegration();
    }
    return errorIntegration;
}

module.exports = {
    ErrorIntegration,
    initializeErrorIntegration
};
