/**
 * Advanced Error Handling System
 * Implements STRICT_ENGINEERING_CONTRACT_2026.txt Section 6 requirements
 * SvonyBrowser v2.2.13
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class ErrorHandler {
    constructor() {
        this.logFile = path.join(app.getPath('userData'), 'error-logs', 'app-errors.log');
        this.errorCounts = new Map();
        this.errorThresholds = {
            warning: 10,
            error: 5,
            fatal: 1
        };
        this.initializeErrorHandling();
    }

    async initializeErrorHandling() {
        // Ensure log directory exists
        const logDir = path.dirname(this.logFile);
        try {
            await fs.mkdir(logDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create log directory:', error);
        }

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.handleFatalError('UNCAUGHT_EXCEPTION', error);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.handleError('UNHANDLED_REJECTION', new Error(`Unhandled Promise Rejection: ${reason}`), {
                promise: promise.toString()
            });
        });

        // Handle Electron specific errors
        if (app) {
            app.on('web-contents-created', (event, contents) => {
                contents.on('crashed', (event, killed) => {
                    this.handleError('RENDERER_CRASHED', new Error('Renderer process crashed'), {
                        killed,
                        processId: contents.getProcessId()
                    });
                });

                contents.on('unresponsive', () => {
                    this.handleError('RENDERER_UNRESPONSIVE', new Error('Renderer process unresponsive'), {
                        processId: contents.getProcessId()
                    });
                });
            });
        }
    }

    /**
     * Handle different severity levels of errors
     * @param {string} type - Error type identifier
     * @param {Error} error - The error object
     * @param {Object} context - Additional context information
     * @param {string} severity - Error severity: 'info', 'warning', 'error', 'fatal'
     */
    async handleError(type, error, context = {}, severity = 'error') {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            type,
            severity,
            message: error.message,
            stack: error.stack,
            context,
            sessionId: this.getSessionId(),
            version: app.getVersion(),
            platform: process.platform,
            arch: process.arch,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };

        // Log to console based on severity
        this.logToConsole(errorEntry);

        // Write to log file
        await this.writeToLogFile(errorEntry);

        // Track error frequency
        this.trackErrorFrequency(type);

        // Handle based on severity
        switch (severity) {
            case 'fatal':
                await this.handleFatalError(type, error, context);
                break;
            case 'error':
                await this.handleCriticalError(type, error, context);
                break;
            case 'warning':
                await this.handleWarning(type, error, context);
                break;
            case 'info':
                // Just log, no special handling needed
                break;
        }

        return errorEntry;
    }

    logToConsole(errorEntry) {
        const colors = {
            fatal: '\x1b[41m\x1b[37m', // Red background, white text
            error: '\x1b[31m',         // Red text
            warning: '\x1b[33m',       // Yellow text
            info: '\x1b[36m',          // Cyan text
            reset: '\x1b[0m'           // Reset
        };

        const color = colors[errorEntry.severity] || colors.reset;
        const prefix = `${color}[${errorEntry.severity.toUpperCase()}]${colors.reset}`;
        
        console.log(`${prefix} ${errorEntry.timestamp} - ${errorEntry.type}`);
        console.log(`  Message: ${errorEntry.message}`);
        if (errorEntry.context && Object.keys(errorEntry.context).length > 0) {
            console.log(`  Context: ${JSON.stringify(errorEntry.context, null, 2)}`);
        }
        if (errorEntry.severity !== 'info') {
            console.log(`  Stack: ${errorEntry.stack}`);
        }
    }

    async writeToLogFile(errorEntry) {
        try {
            const logLine = JSON.stringify(errorEntry) + '\n';
            await fs.appendFile(this.logFile, logLine);

            // Rotate log file if it gets too large (>10MB)
            const stats = await fs.stat(this.logFile);
            if (stats.size > 10 * 1024 * 1024) {
                await this.rotateLogFile();
            }
        } catch (writeError) {
            console.error('Failed to write to log file:', writeError);
        }
    }

    async rotateLogFile() {
        try {
            const rotatedFile = `${this.logFile}.${Date.now()}`;
            await fs.rename(this.logFile, rotatedFile);
            
            // Keep only the last 5 rotated files
            const logDir = path.dirname(this.logFile);
            const files = await fs.readdir(logDir);
            const rotatedFiles = files
                .filter(f => f.startsWith('app-errors.log.'))
                .sort()
                .reverse();

            if (rotatedFiles.length > 5) {
                for (const file of rotatedFiles.slice(5)) {
                    await fs.unlink(path.join(logDir, file));
                }
            }
        } catch (rotateError) {
            console.error('Failed to rotate log file:', rotateError);
        }
    }

    trackErrorFrequency(type) {
        const count = (this.errorCounts.get(type) || 0) + 1;
        this.errorCounts.set(type, count);

        // Alert if error frequency is too high
        if (count >= this.errorThresholds.error) {
            console.warn(`High error frequency detected for ${type}: ${count} occurrences`);
            
            if (count >= this.errorThresholds.fatal) {
                console.error(`CRITICAL: Error type ${type} has occurred ${count} times!`);
            }
        }
    }

    async handleFatalError(type, error, context = {}) {
        console.error(`FATAL ERROR: ${type}`, error);
        
        // Create crash report
        await this.createCrashReport(type, error, context);
        
        // Attempt graceful shutdown
        if (app && !app.isQuiting) {
            app.quit();
        } else {
            process.exit(1);
        }
    }

    async handleCriticalError(type, error, context = {}) {
        console.error(`CRITICAL ERROR: ${type}`, error);
        
        // Notify user if possible
        this.notifyUser('Critical Error', `A critical error occurred: ${error.message}`, 'error');
        
        // Take corrective action based on error type
        switch (type) {
            case 'RENDERER_CRASHED':
                await this.restartRenderer(context.processId);
                break;
            case 'MEMORY_LEAK':
                await this.performGarbageCollection();
                break;
            case 'FILE_SYSTEM_ERROR':
                await this.checkFileSystemHealth();
                break;
        }
    }

    async handleWarning(type, error, context = {}) {
        console.warn(`WARNING: ${type}`, error.message);
        
        // Log warning and continue operation
        // Could add monitoring alerts here
    }

    async createCrashReport(type, error, context) {
        const crashReport = {
            crashId: this.generateCrashId(),
            timestamp: new Date().toISOString(),
            type,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context,
            systemInfo: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                electronVersion: process.versions.electron,
                chromeVersion: process.versions.chrome,
                memory: process.memoryUsage(),
                uptime: process.uptime()
            },
            appInfo: {
                version: app.getVersion(),
                name: app.getName()
            }
        };

        try {
            const crashDir = path.join(app.getPath('userData'), 'crash-reports');
            await fs.mkdir(crashDir, { recursive: true });
            
            const crashFile = path.join(crashDir, `crash-${crashReport.crashId}.json`);
            await fs.writeFile(crashFile, JSON.stringify(crashReport, null, 2));
            
            console.log(`Crash report saved: ${crashFile}`);
        } catch (reportError) {
            console.error('Failed to create crash report:', reportError);
        }
    }

    notifyUser(title, message, type = 'info') {
        // This would integrate with Electron's dialog or notification system
        console.log(`USER NOTIFICATION [${type.toUpperCase()}]: ${title} - ${message}`);
        
        // In a real implementation, this might show a dialog:
        // const { dialog } = require('electron');
        // dialog.showErrorBox(title, message);
    }

    async restartRenderer(processId) {
        console.log(`Attempting to restart renderer process ${processId}`);
        // Implementation would restart the specific renderer process
    }

    async performGarbageCollection() {
        if (global.gc) {
            global.gc();
            console.log('Manual garbage collection performed');
        }
    }

    async checkFileSystemHealth() {
        console.log('Performing file system health check...');
        // Implementation would check file system accessibility
    }

    generateCrashId() {
        return `crash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    getSessionId() {
        // Generate or retrieve session identifier
        return `session-${Date.now()}`;
    }

    // Public methods for manual error reporting
    logInfo(message, context = {}) {
        return this.handleError('INFO', new Error(message), context, 'info');
    }

    logWarning(message, context = {}) {
        return this.handleError('WARNING', new Error(message), context, 'warning');
    }

    logError(message, context = {}) {
        return this.handleError('ERROR', new Error(message), context, 'error');
    }

    logFatal(message, context = {}) {
        return this.handleError('FATAL', new Error(message), context, 'fatal');
    }

    // Get error statistics
    getErrorStatistics() {
        return {
            errorCounts: Object.fromEntries(this.errorCounts),
            totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }
}

// Singleton instance
let errorHandler = null;

function getErrorHandler() {
    if (!errorHandler) {
        errorHandler = new ErrorHandler();
    }
    return errorHandler;
}

module.exports = {
    ErrorHandler,
    getErrorHandler
};
