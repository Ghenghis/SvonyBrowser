/**
 * ErrorHelper Service
 * 
 * Provides intelligent error analysis and solution suggestions:
 * - Pattern-based solution matching
 * - Context-aware recommendations
 * - Step-by-step fix instructions
 * - Documentation links
 * - Related error grouping
 */

const EventEmitter = require('events');

/**
 * Solution template
 */
class Solution {
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.description = data.description;
        this.steps = data.steps || [];
        this.autoFixable = data.autoFixable || false;
        this.fixMethod = data.fixMethod || null;
        this.documentation = data.documentation || null;
        this.confidence = data.confidence || 0.5;
        this.category = data.category;
        this.tags = data.tags || [];
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            steps: this.steps,
            autoFixable: this.autoFixable,
            documentation: this.documentation,
            confidence: this.confidence,
            category: this.category
        };
    }
}

/**
 * ErrorHelper - Intelligent error analysis and suggestions
 */
class ErrorHelper extends EventEmitter {
    constructor() {
        super();
        
        this.solutions = new Map();
        this.patterns = [];
        this.initialized = false;
        
        // Load built-in solutions
        this.loadBuiltInSolutions();
    }

    /**
     * Initialize the helper
     */
    async initialize() {
        if (this.initialized) return;
        this.initialized = true;
        this.emit('initialized');
        return this;
    }

    /**
     * Load built-in solution database
     */
    loadBuiltInSolutions() {
        // Flash-related solutions
        this.addPattern({
            id: 'flash-not-found',
            category: 'flash',
            patterns: [/flash.*not found/i, /pepper.*not found/i, /ppapi.*not found/i],
            solution: new Solution({
                id: 'flash-not-found',
                title: 'Flash Player Plugin Not Found',
                description: 'The Flash Player plugin files are missing from the flashver directory.',
                category: 'flash',
                autoFixable: true,
                fixMethod: 'downloadFlashPlugin',
                confidence: 0.95,
                steps: [
                    'Download the Flash Player PPAPI plugin for your platform',
                    'For Windows 64-bit: Place pepflashplayer64.dll in flashver/',
                    'For Windows 32-bit: Place pepflashplayer32.dll in flashver/',
                    'For macOS: Place PepperFlashPlayer.plugin in flashver/',
                    'For Linux: Place libpepflashplayer.so in flashver/',
                    'Restart the application'
                ],
                documentation: 'See flashver/README.md for detailed instructions',
                tags: ['flash', 'plugin', 'missing']
            })
        });

        this.addPattern({
            id: 'flash-load-failed',
            category: 'flash',
            patterns: [/flash.*load.*fail/i, /plugin.*crash/i, /pepper.*error/i],
            solution: new Solution({
                id: 'flash-load-failed',
                title: 'Flash Player Failed to Load',
                description: 'The Flash plugin exists but failed to initialize.',
                category: 'flash',
                autoFixable: true,
                fixMethod: 'repairFlashPlugin',
                confidence: 0.85,
                steps: [
                    'Verify the Flash plugin version matches your system architecture',
                    'Check if SwiftShader libraries are present in flashver/swiftshader/',
                    'Try running the application as administrator',
                    'Clear the application cache and restart',
                    'If using Windows, install Visual C++ Redistributable'
                ],
                documentation: 'https://helpx.adobe.com/flash-player/kb/flash-player-issues.html',
                tags: ['flash', 'crash', 'load']
            })
        });

        this.addPattern({
            id: 'flash-swf-error',
            category: 'flash',
            patterns: [/swf.*error/i, /swf.*not.*load/i, /swf.*invalid/i],
            solution: new Solution({
                id: 'flash-swf-error',
                title: 'SWF File Error',
                description: 'The SWF file could not be loaded or is corrupted.',
                category: 'flash',
                autoFixable: true,
                fixMethod: 'reloadSWF',
                confidence: 0.80,
                steps: [
                    'Verify the SWF file exists in the swf/ directory',
                    'Check if the SWF file is corrupted (try opening in standalone Flash Player)',
                    'Clear browser cache and reload',
                    'Try switching to Web mode if SWF mode fails'
                ],
                tags: ['flash', 'swf', 'content']
            })
        });

        // LM Studio / AI solutions
        this.addPattern({
            id: 'lm-studio-connection',
            category: 'ai',
            patterns: [/lm.*studio.*connect/i, /econnrefused.*1234/i, /llm.*unavailable/i],
            solution: new Solution({
                id: 'lm-studio-connection',
                title: 'LM Studio Connection Failed',
                description: 'Cannot connect to LM Studio server.',
                category: 'ai',
                autoFixable: true,
                fixMethod: 'reconnectLMStudio',
                confidence: 0.90,
                steps: [
                    'Ensure LM Studio is running on your computer',
                    'Check that the server is started (Developer tab → Start Server)',
                    'Verify the URL in Settings → LLM matches LM Studio (default: http://localhost:1234)',
                    'If LM Studio is on another machine, use that machine\'s IP address',
                    'Check firewall settings are not blocking port 1234',
                    'Click "Test Connection" in Settings to verify'
                ],
                documentation: 'https://lmstudio.ai/docs',
                tags: ['ai', 'lm-studio', 'connection']
            })
        });

        this.addPattern({
            id: 'lm-studio-model',
            category: 'ai',
            patterns: [/model.*not.*loaded/i, /no.*model.*available/i, /inference.*fail/i],
            solution: new Solution({
                id: 'lm-studio-model',
                title: 'No AI Model Loaded',
                description: 'LM Studio is running but no model is loaded.',
                category: 'ai',
                autoFixable: false,
                confidence: 0.85,
                steps: [
                    'Open LM Studio application',
                    'Go to the "My Models" tab',
                    'Select a model and click "Load"',
                    'Wait for the model to fully load (check the status indicator)',
                    'Return to Svony Browser and try again'
                ],
                tags: ['ai', 'model', 'load']
            })
        });

        // Network solutions
        this.addPattern({
            id: 'network-timeout',
            category: 'network',
            patterns: [/timeout/i, /etimedout/i, /request.*timeout/i],
            solution: new Solution({
                id: 'network-timeout',
                title: 'Network Request Timeout',
                description: 'A network request took too long to complete.',
                category: 'network',
                autoFixable: true,
                fixMethod: 'retryWithTimeout',
                confidence: 0.75,
                steps: [
                    'Check your internet connection',
                    'The server may be slow or overloaded - try again later',
                    'If using a VPN, try disconnecting it',
                    'Check if the target server is accessible in a browser'
                ],
                tags: ['network', 'timeout', 'slow']
            })
        });

        this.addPattern({
            id: 'network-refused',
            category: 'network',
            patterns: [/econnrefused/i, /connection.*refused/i, /connect.*fail/i],
            solution: new Solution({
                id: 'network-refused',
                title: 'Connection Refused',
                description: 'The target server refused the connection.',
                category: 'network',
                autoFixable: true,
                fixMethod: 'checkServiceAndRetry',
                confidence: 0.85,
                steps: [
                    'Verify the target service is running',
                    'Check the port number is correct',
                    'Ensure firewall is not blocking the connection',
                    'If connecting to localhost, verify the service started successfully'
                ],
                tags: ['network', 'connection', 'refused']
            })
        });

        // MCP solutions
        this.addPattern({
            id: 'mcp-server-error',
            category: 'mcp',
            patterns: [/mcp.*server.*error/i, /mcp.*not.*running/i, /protocol.*server/i],
            solution: new Solution({
                id: 'mcp-server-error',
                title: 'MCP Server Error',
                description: 'One or more MCP servers failed to start or respond.',
                category: 'mcp',
                autoFixable: true,
                fixMethod: 'restartMCPServers',
                confidence: 0.80,
                steps: [
                    'Run "npm run setup:mcp" to install MCP server dependencies',
                    'Check the MCP server logs in the Debug tab',
                    'Verify Node.js is installed and accessible',
                    'Try restarting the application',
                    'Check if another process is using the same ports'
                ],
                tags: ['mcp', 'server', 'protocol']
            })
        });

        // Playwright solutions
        this.addPattern({
            id: 'playwright-browser',
            category: 'playwright',
            patterns: [/playwright.*browser/i, /chromium.*not.*found/i, /browser.*launch/i],
            solution: new Solution({
                id: 'playwright-browser',
                title: 'Playwright Browser Error',
                description: 'Playwright could not launch or connect to a browser.',
                category: 'playwright',
                autoFixable: true,
                fixMethod: 'installPlaywrightBrowsers',
                confidence: 0.85,
                steps: [
                    'Run "npx playwright install chromium" to install browser',
                    'Ensure you have sufficient disk space',
                    'Check if antivirus is blocking browser installation',
                    'Try running with administrator privileges'
                ],
                tags: ['playwright', 'browser', 'chromium']
            })
        });

        // File system solutions
        this.addPattern({
            id: 'file-not-found',
            category: 'filesystem',
            patterns: [/enoent/i, /file.*not.*found/i, /no such file/i],
            solution: new Solution({
                id: 'file-not-found',
                title: 'File Not Found',
                description: 'A required file or directory does not exist.',
                category: 'filesystem',
                autoFixable: true,
                fixMethod: 'createMissingPath',
                confidence: 0.70,
                steps: [
                    'Check if the file path is correct',
                    'Verify the file was not moved or deleted',
                    'Check file permissions',
                    'If it\'s a configuration file, it may be created on first run'
                ],
                tags: ['file', 'missing', 'path']
            })
        });

        this.addPattern({
            id: 'permission-denied',
            category: 'filesystem',
            patterns: [/eacces/i, /permission.*denied/i, /access.*denied/i],
            solution: new Solution({
                id: 'permission-denied',
                title: 'Permission Denied',
                description: 'Insufficient permissions to access a file or directory.',
                category: 'filesystem',
                autoFixable: false,
                confidence: 0.85,
                steps: [
                    'Run the application as administrator',
                    'Check file/folder permissions in your OS',
                    'Ensure the file is not locked by another program',
                    'Try moving the application to a user-writable location'
                ],
                tags: ['permission', 'access', 'denied']
            })
        });

        // IPC solutions
        this.addPattern({
            id: 'ipc-channel-error',
            category: 'ipc',
            patterns: [/ipc.*channel/i, /no handler.*registered/i, /invoke.*fail/i],
            solution: new Solution({
                id: 'ipc-channel-error',
                title: 'IPC Communication Error',
                description: 'Internal communication between components failed.',
                category: 'ipc',
                autoFixable: true,
                fixMethod: 'restartRenderer',
                confidence: 0.75,
                steps: [
                    'This is usually a temporary issue - try the action again',
                    'Refresh the application window (Ctrl+R)',
                    'If the issue persists, restart the application',
                    'Check the Debug console for more details'
                ],
                tags: ['ipc', 'internal', 'communication']
            })
        });
    }

    /**
     * Add a pattern-solution mapping
     */
    addPattern(config) {
        this.patterns.push({
            id: config.id,
            category: config.category,
            patterns: config.patterns,
            solution: config.solution
        });
        this.solutions.set(config.id, config.solution);
    }

    /**
     * Get solution suggestions for an error
     */
    getSuggestions(trackedError) {
        const suggestions = [];
        const message = trackedError.message;
        const category = trackedError.category;

        // Match against patterns
        for (const patternConfig of this.patterns) {
            // Category match bonus
            let categoryBonus = patternConfig.category === category ? 0.1 : 0;

            // Pattern matching
            for (const pattern of patternConfig.patterns) {
                if (pattern.test(message)) {
                    const solution = { ...patternConfig.solution.toJSON() };
                    solution.confidence = Math.min(1, solution.confidence + categoryBonus);
                    suggestions.push(solution);
                    break; // Only add once per pattern config
                }
            }
        }

        // Sort by confidence
        suggestions.sort((a, b) => b.confidence - a.confidence);

        // Add generic suggestion if no matches
        if (suggestions.length === 0) {
            suggestions.push({
                id: 'generic',
                title: 'General Troubleshooting',
                description: 'No specific solution found for this error.',
                steps: [
                    'Check the error message and location for clues',
                    'Look at the Debug tab for more context',
                    'Try restarting the application',
                    'Check if all required services are running',
                    'Search online for the specific error message'
                ],
                autoFixable: false,
                confidence: 0.1,
                category: 'general'
            });
        }

        return suggestions;
    }

    /**
     * Get solution by ID
     */
    getSolution(id) {
        return this.solutions.get(id);
    }

    /**
     * Get all solutions for a category
     */
    getSolutionsByCategory(category) {
        return Array.from(this.solutions.values())
            .filter(s => s.category === category);
    }

    /**
     * Analyze error and return comprehensive help
     */
    analyze(trackedError) {
        const suggestions = this.getSuggestions(trackedError);
        const primarySuggestion = suggestions[0];

        return {
            error: {
                id: trackedError.id,
                message: trackedError.message,
                category: trackedError.category,
                severity: trackedError.severity,
                location: trackedError.getLocation()
            },
            suggestions,
            primarySuggestion,
            canAutoFix: primarySuggestion?.autoFixable || false,
            fixMethod: primarySuggestion?.fixMethod || null,
            confidence: primarySuggestion?.confidence || 0
        };
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            patternCount: this.patterns.length,
            solutionCount: this.solutions.size
        };
    }
}

module.exports = { ErrorHelper, Solution };
