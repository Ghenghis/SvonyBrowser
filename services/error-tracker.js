/**
 * ErrorTracker Service
 * 
 * Comprehensive error tracking with:
 * - Stack trace parsing for file/line numbers
 * - Error categorization
 * - Error history with search
 * - Error patterns detection
 * - Integration with ErrorHelper and SelfHealer
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * Parsed error with file/line information
 */
class TrackedError {
    constructor(error, context = {}) {
        this.id = `err-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.timestamp = new Date().toISOString();
        this.message = error.message || String(error);
        this.name = error.name || 'Error';
        this.code = error.code || null;
        this.context = context;
        this.category = this.categorize();
        this.severity = context.severity || this.determineSeverity();
        this.stack = error.stack || null;
        this.frames = this.parseStackTrace(error.stack);
        this.primaryFrame = this.frames[0] || null;
        this.healed = false;
        this.healAttempts = [];
        this.resolved = false;
        this.resolutionMethod = null;
    }

    /**
     * Parse stack trace into structured frames
     */
    parseStackTrace(stack) {
        if (!stack) return [];
        
        const frames = [];
        const lines = stack.split('\n');
        
        // Skip first line (error message)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line.startsWith('at ')) continue;
            
            const frame = this.parseStackFrame(line);
            if (frame) {
                frames.push(frame);
            }
        }
        
        return frames;
    }

    /**
     * Parse a single stack frame
     */
    parseStackFrame(line) {
        // Pattern: at functionName (file:line:column)
        // or: at file:line:column
        const patterns = [
            /at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/,  // at func (file:line:col)
            /at\s+(.+):(\d+):(\d+)/,               // at file:line:col
            /at\s+(.+?)\s+\((.+)\)/,               // at func (file)
            /at\s+(.+)/                             // at something
        ];

        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                if (pattern === patterns[0]) {
                    return {
                        function: match[1],
                        file: this.normalizeFilePath(match[2]),
                        line: parseInt(match[3], 10),
                        column: parseInt(match[4], 10),
                        raw: line
                    };
                } else if (pattern === patterns[1]) {
                    return {
                        function: '<anonymous>',
                        file: this.normalizeFilePath(match[1]),
                        line: parseInt(match[2], 10),
                        column: parseInt(match[3], 10),
                        raw: line
                    };
                } else if (pattern === patterns[2]) {
                    return {
                        function: match[1],
                        file: this.normalizeFilePath(match[2]),
                        line: null,
                        column: null,
                        raw: line
                    };
                } else {
                    return {
                        function: match[1],
                        file: null,
                        line: null,
                        column: null,
                        raw: line
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Normalize file path for display
     */
    normalizeFilePath(filePath) {
        if (!filePath) return null;
        
        // Remove file:// prefix
        filePath = filePath.replace(/^file:\/\//, '');
        
        // Get relative path from project root
        const projectRoot = path.join(__dirname, '..');
        if (filePath.startsWith(projectRoot)) {
            return filePath.substring(projectRoot.length + 1);
        }
        
        // Just return filename if path is too long
        if (filePath.length > 100) {
            return path.basename(filePath);
        }
        
        return filePath;
    }

    /**
     * Categorize error by type
     */
    categorize() {
        const msg = this.message.toLowerCase();
        const name = this.name.toLowerCase();
        
        // Flash-related errors
        if (msg.includes('flash') || msg.includes('pepper') || msg.includes('ppapi') || msg.includes('swf')) {
            return 'flash';
        }
        
        // Network errors
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection') || 
            msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('socket')) {
            return 'network';
        }
        
        // LM Studio / AI errors
        if (msg.includes('lm studio') || msg.includes('llm') || msg.includes('model') || 
            msg.includes('inference') || msg.includes('openai')) {
            return 'ai';
        }
        
        // MCP errors
        if (msg.includes('mcp') || msg.includes('protocol server')) {
            return 'mcp';
        }
        
        // File system errors
        if (msg.includes('enoent') || msg.includes('file') || msg.includes('directory') || 
            msg.includes('permission') || msg.includes('access')) {
            return 'filesystem';
        }
        
        // Playwright errors
        if (msg.includes('playwright') || msg.includes('browser') || msg.includes('page') || 
            msg.includes('selector') || msg.includes('navigation')) {
            return 'playwright';
        }
        
        // IPC errors
        if (msg.includes('ipc') || msg.includes('channel') || msg.includes('invoke')) {
            return 'ipc';
        }
        
        // Syntax/Type errors
        if (name.includes('syntax') || name.includes('type') || name.includes('reference')) {
            return 'code';
        }
        
        return 'general';
    }

    /**
     * Determine error severity
     */
    determineSeverity() {
        const category = this.category;
        const msg = this.message.toLowerCase();
        
        // Critical - app may not function
        if (category === 'flash' && msg.includes('not found')) return 'critical';
        if (msg.includes('fatal') || msg.includes('crash')) return 'critical';
        
        // High - feature broken
        if (category === 'ai' && msg.includes('connection')) return 'high';
        if (category === 'network' && msg.includes('refused')) return 'high';
        
        // Medium - degraded functionality
        if (category === 'mcp') return 'medium';
        if (category === 'playwright') return 'medium';
        
        // Low - minor issues
        if (msg.includes('warning') || msg.includes('deprecated')) return 'low';
        
        return 'medium';
    }

    /**
     * Get formatted location string
     */
    getLocation() {
        if (!this.primaryFrame) return 'Unknown location';
        
        const frame = this.primaryFrame;
        let location = frame.file || 'Unknown file';
        
        if (frame.line) {
            location += `:${frame.line}`;
            if (frame.column) {
                location += `:${frame.column}`;
            }
        }
        
        if (frame.function && frame.function !== '<anonymous>') {
            location += ` in ${frame.function}()`;
        }
        
        return location;
    }

    /**
     * Convert to JSON for logging/display
     */
    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            message: this.message,
            name: this.name,
            code: this.code,
            category: this.category,
            severity: this.severity,
            location: this.getLocation(),
            file: this.primaryFrame?.file,
            line: this.primaryFrame?.line,
            column: this.primaryFrame?.column,
            function: this.primaryFrame?.function,
            context: this.context,
            healed: this.healed,
            resolved: this.resolved,
            frames: this.frames.slice(0, 5) // Limit frames for display
        };
    }
}

/**
 * ErrorTracker - Central error tracking service
 */
class ErrorTracker extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxErrors: options.maxErrors || 1000,
            logFile: options.logFile || null,
            enablePatternDetection: options.enablePatternDetection !== false,
            patternThreshold: options.patternThreshold || 3,
            patternWindow: options.patternWindow || 60000 // 1 minute
        };
        
        this.errors = [];
        this.errorPatterns = new Map();
        this.stats = {
            total: 0,
            byCategory: {},
            bySeverity: {},
            healed: 0,
            unresolved: 0
        };
        
        // Services for healing
        this.errorHelper = null;
        this.selfHealer = null;
        
        this.initialized = false;
    }

    /**
     * Initialize the tracker
     */
    async initialize() {
        if (this.initialized) return;
        
        // Set up global error handlers
        this.setupGlobalHandlers();
        
        this.initialized = true;
        this.emit('initialized');
        
        return this;
    }

    /**
     * Set up global error handlers
     */
    setupGlobalHandlers() {
        // Uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.track(error, { source: 'uncaughtException', severity: 'critical' });
        });
        
        // Unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            this.track(error, { source: 'unhandledRejection', severity: 'high' });
        });
    }

    /**
     * Set helper services
     */
    setErrorHelper(helper) {
        this.errorHelper = helper;
    }

    setSelfHealer(healer) {
        this.selfHealer = healer;
    }

    /**
     * Track an error
     */
    track(error, context = {}) {
        const trackedError = new TrackedError(error, context);
        
        // Add to history
        this.errors.unshift(trackedError);
        
        // Trim history
        if (this.errors.length > this.options.maxErrors) {
            this.errors.pop();
        }
        
        // Update stats
        this.updateStats(trackedError);
        
        // Detect patterns
        if (this.options.enablePatternDetection) {
            this.detectPattern(trackedError);
        }
        
        // Log to file if configured
        if (this.options.logFile) {
            this.logToFile(trackedError);
        }
        
        // Emit event
        this.emit('error', trackedError);
        
        // Try auto-healing if available
        if (this.selfHealer && !context.skipHealing) {
            this.attemptHealing(trackedError);
        }
        
        // Log to console with enhanced info
        this.logToConsole(trackedError);
        
        return trackedError;
    }

    /**
     * Log error to console with file/line info
     */
    logToConsole(trackedError) {
        const prefix = `[${trackedError.category.toUpperCase()}]`;
        const location = trackedError.getLocation();
        const severity = trackedError.severity.toUpperCase();
        
        const logMessage = `${prefix} [${severity}] ${trackedError.message}\n  → Location: ${location}`;
        
        switch (trackedError.severity) {
            case 'critical':
                console.error('\x1b[31m%s\x1b[0m', logMessage); // Red
                break;
            case 'high':
                console.error('\x1b[33m%s\x1b[0m', logMessage); // Yellow
                break;
            case 'medium':
                console.warn(logMessage);
                break;
            default:
                console.log(logMessage);
        }
    }

    /**
     * Log error to file
     */
    logToFile(trackedError) {
        try {
            const logEntry = JSON.stringify(trackedError.toJSON()) + '\n';
            fs.appendFileSync(this.options.logFile, logEntry);
        } catch (e) {
            console.error('Failed to write error log:', e.message);
        }
    }

    /**
     * Update statistics
     */
    updateStats(trackedError) {
        this.stats.total++;
        
        // By category
        this.stats.byCategory[trackedError.category] = 
            (this.stats.byCategory[trackedError.category] || 0) + 1;
        
        // By severity
        this.stats.bySeverity[trackedError.severity] = 
            (this.stats.bySeverity[trackedError.severity] || 0) + 1;
        
        if (!trackedError.resolved) {
            this.stats.unresolved++;
        }
    }

    /**
     * Detect error patterns
     */
    detectPattern(trackedError) {
        const key = `${trackedError.category}:${trackedError.message.substring(0, 50)}`;
        const now = Date.now();
        
        if (!this.errorPatterns.has(key)) {
            this.errorPatterns.set(key, []);
        }
        
        const occurrences = this.errorPatterns.get(key);
        occurrences.push(now);
        
        // Clean old occurrences
        const cutoff = now - this.options.patternWindow;
        const recent = occurrences.filter(t => t > cutoff);
        this.errorPatterns.set(key, recent);
        
        // Check if pattern detected
        if (recent.length >= this.options.patternThreshold) {
            this.emit('pattern-detected', {
                key,
                count: recent.length,
                error: trackedError,
                window: this.options.patternWindow
            });
        }
    }

    /**
     * Attempt auto-healing
     */
    async attemptHealing(trackedError) {
        if (!this.selfHealer) return;
        
        try {
            const result = await this.selfHealer.heal(trackedError);
            
            if (result.success) {
                trackedError.healed = true;
                trackedError.resolved = true;
                trackedError.resolutionMethod = result.method;
                trackedError.healAttempts.push({
                    timestamp: new Date().toISOString(),
                    method: result.method,
                    success: true
                });
                
                this.stats.healed++;
                this.stats.unresolved--;
                
                this.emit('healed', trackedError, result);
            } else {
                trackedError.healAttempts.push({
                    timestamp: new Date().toISOString(),
                    method: result.method,
                    success: false,
                    reason: result.reason
                });
            }
        } catch (e) {
            console.error('Healing attempt failed:', e.message);
        }
    }

    /**
     * Get errors by category
     */
    getByCategory(category) {
        return this.errors.filter(e => e.category === category);
    }

    /**
     * Get errors by severity
     */
    getBySeverity(severity) {
        return this.errors.filter(e => e.severity === severity);
    }

    /**
     * Get unresolved errors
     */
    getUnresolved() {
        return this.errors.filter(e => !e.resolved);
    }

    /**
     * Get recent errors
     */
    getRecent(count = 10) {
        return this.errors.slice(0, count);
    }

    /**
     * Search errors
     */
    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.errors.filter(e => 
            e.message.toLowerCase().includes(lowerQuery) ||
            e.category.includes(lowerQuery) ||
            (e.primaryFrame?.file || '').toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Get error by ID
     */
    getById(id) {
        return this.errors.find(e => e.id === id);
    }

    /**
     * Mark error as resolved
     */
    resolve(id, method = 'manual') {
        const error = this.getById(id);
        if (error && !error.resolved) {
            error.resolved = true;
            error.resolutionMethod = method;
            this.stats.unresolved--;
            this.emit('resolved', error);
        }
        return error;
    }

    /**
     * Clear all errors
     */
    clear() {
        this.errors = [];
        this.errorPatterns.clear();
        this.stats = {
            total: 0,
            byCategory: {},
            bySeverity: {},
            healed: 0,
            unresolved: 0
        };
        this.emit('cleared');
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errors.length,
            unresolvedCount: this.stats.unresolved,
            healedCount: this.stats.healed,
            hasHelper: !!this.errorHelper,
            hasHealer: !!this.selfHealer
        };
    }

    /**
     * Export errors to JSON
     */
    export() {
        return {
            exported: new Date().toISOString(),
            stats: this.getStats(),
            errors: this.errors.map(e => e.toJSON())
        };
    }
}

module.exports = { ErrorTracker, TrackedError };
