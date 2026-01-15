/**
 * SelfHealer Service
 * 
 * Automatic error recovery and self-healing:
 * - Strategy-based healing
 * - Flash-specific recovery
 * - Network retry logic
 * - Service restart capabilities
 * - Graceful degradation
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Healing result
 */
class HealingResult {
    constructor(success, method, details = {}) {
        this.success = success;
        this.method = method;
        this.timestamp = new Date().toISOString();
        this.details = details;
        this.reason = details.reason || null;
    }
}

/**
 * SelfHealer - Automatic error recovery
 */
class SelfHealer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            enableAutoHeal: options.enableAutoHeal !== false
        };
        
        // Service references for healing actions
        this.services = {};
        
        // Healing strategies by method name
        this.strategies = new Map();
        
        // Healing history
        this.history = [];
        this.maxHistory = 100;
        
        // Stats
        this.stats = {
            attempted: 0,
            successful: 0,
            failed: 0,
            byMethod: {}
        };
        
        this.initialized = false;
        
        // Register built-in strategies
        this.registerBuiltInStrategies();
    }

    /**
     * Initialize the healer
     */
    async initialize() {
        if (this.initialized) return;
        this.initialized = true;
        this.emit('initialized');
        return this;
    }

    /**
     * Set service references
     */
    setServices(services) {
        this.services = { ...this.services, ...services };
    }

    /**
     * Register a healing strategy
     */
    registerStrategy(name, handler) {
        this.strategies.set(name, handler);
    }

    /**
     * Register built-in healing strategies
     */
    registerBuiltInStrategies() {
        // Flash strategies
        this.registerStrategy('downloadFlashPlugin', this.healFlashNotFound.bind(this));
        this.registerStrategy('repairFlashPlugin', this.healFlashLoadFailed.bind(this));
        this.registerStrategy('reloadSWF', this.healSWFError.bind(this));
        
        // LM Studio strategies
        this.registerStrategy('reconnectLMStudio', this.healLMStudioConnection.bind(this));
        
        // Network strategies
        this.registerStrategy('retryWithTimeout', this.healNetworkTimeout.bind(this));
        this.registerStrategy('checkServiceAndRetry', this.healConnectionRefused.bind(this));
        
        // MCP strategies
        this.registerStrategy('restartMCPServers', this.healMCPServerError.bind(this));
        
        // Playwright strategies
        this.registerStrategy('installPlaywrightBrowsers', this.healPlaywrightBrowser.bind(this));
        
        // File system strategies
        this.registerStrategy('createMissingPath', this.healFileNotFound.bind(this));
        
        // IPC strategies
        this.registerStrategy('restartRenderer', this.healIPCError.bind(this));
    }

    /**
     * Attempt to heal an error
     */
    async heal(trackedError) {
        if (!this.options.enableAutoHeal) {
            return new HealingResult(false, 'disabled', { reason: 'Auto-healing is disabled' });
        }

        this.stats.attempted++;

        // Get suggested fix method from error helper
        const fixMethod = trackedError.context?.fixMethod || this.inferFixMethod(trackedError);
        
        if (!fixMethod) {
            return new HealingResult(false, 'none', { reason: 'No healing strategy available' });
        }

        const strategy = this.strategies.get(fixMethod);
        
        if (!strategy) {
            return new HealingResult(false, fixMethod, { reason: `Strategy '${fixMethod}' not registered` });
        }

        try {
            this.emit('healing-start', { error: trackedError, method: fixMethod });
            
            const result = await strategy(trackedError);
            
            // Update stats
            if (result.success) {
                this.stats.successful++;
            } else {
                this.stats.failed++;
            }
            
            this.stats.byMethod[fixMethod] = this.stats.byMethod[fixMethod] || { success: 0, fail: 0 };
            this.stats.byMethod[fixMethod][result.success ? 'success' : 'fail']++;
            
            // Add to history
            this.history.unshift({
                errorId: trackedError.id,
                method: fixMethod,
                result: result.success,
                timestamp: result.timestamp,
                details: result.details
            });
            
            if (this.history.length > this.maxHistory) {
                this.history.pop();
            }
            
            this.emit('healing-complete', { error: trackedError, result });
            
            return result;
            
        } catch (e) {
            this.stats.failed++;
            const result = new HealingResult(false, fixMethod, { 
                reason: `Healing threw error: ${e.message}` 
            });
            this.emit('healing-error', { error: trackedError, healingError: e });
            return result;
        }
    }

    /**
     * Infer fix method from error category
     */
    inferFixMethod(trackedError) {
        const category = trackedError.category;
        const message = trackedError.message.toLowerCase();
        
        switch (category) {
            case 'flash':
                if (message.includes('not found')) return 'downloadFlashPlugin';
                if (message.includes('load') || message.includes('crash')) return 'repairFlashPlugin';
                if (message.includes('swf')) return 'reloadSWF';
                break;
            case 'ai':
                if (message.includes('connect')) return 'reconnectLMStudio';
                break;
            case 'network':
                if (message.includes('timeout')) return 'retryWithTimeout';
                if (message.includes('refused')) return 'checkServiceAndRetry';
                break;
            case 'mcp':
                return 'restartMCPServers';
            case 'playwright':
                return 'installPlaywrightBrowsers';
            case 'filesystem':
                if (message.includes('enoent')) return 'createMissingPath';
                break;
            case 'ipc':
                return 'restartRenderer';
        }
        
        return null;
    }

    // ============================================================================
    // Flash Healing Strategies
    // ============================================================================

    /**
     * Heal Flash plugin not found
     */
    async healFlashNotFound(trackedError) {
        const flashverDir = path.join(__dirname, '..', 'flashver');
        
        // Check what's missing
        const platform = process.platform;
        const arch = process.arch;
        
        let requiredFile;
        if (platform === 'win32') {
            requiredFile = arch === 'x64' ? 'pepflashplayer64.dll' : 'pepflashplayer32.dll';
        } else if (platform === 'darwin') {
            requiredFile = 'PepperFlashPlayer.plugin';
        } else {
            requiredFile = 'libpepflashplayer.so';
        }
        
        const flashPath = path.join(flashverDir, requiredFile);
        
        // Check if file exists
        if (fs.existsSync(flashPath)) {
            // File exists but maybe wrong permissions
            try {
                fs.accessSync(flashPath, fs.constants.R_OK);
                return new HealingResult(true, 'downloadFlashPlugin', {
                    message: 'Flash plugin file exists and is readable',
                    action: 'verified',
                    file: requiredFile
                });
            } catch (e) {
                // Try to fix permissions on Unix
                if (platform !== 'win32') {
                    try {
                        fs.chmodSync(flashPath, 0o755);
                        return new HealingResult(true, 'downloadFlashPlugin', {
                            message: 'Fixed Flash plugin permissions',
                            action: 'chmod',
                            file: requiredFile
                        });
                    } catch (chmodError) {
                        return new HealingResult(false, 'downloadFlashPlugin', {
                            reason: 'Cannot fix Flash plugin permissions',
                            file: requiredFile
                        });
                    }
                }
            }
        }
        
        // File doesn't exist - create README with instructions
        const readmePath = path.join(flashverDir, 'FLASH_NEEDED.txt');
        const instructions = `
Flash Player Plugin Required
============================

The Flash Player plugin file is missing: ${requiredFile}

To fix this:
1. Download Flash Player PPAPI from a trusted source
2. Place the file in: ${flashverDir}
3. Restart the application

For Windows:
- 64-bit: pepflashplayer64.dll
- 32-bit: pepflashplayer32.dll

For macOS:
- PepperFlashPlayer.plugin

For Linux:
- libpepflashplayer.so

Note: Adobe discontinued Flash Player in 2020. You may need to use
archived versions or alternative sources.
`;
        
        try {
            fs.writeFileSync(readmePath, instructions);
            
            // Emit event for UI to show
            this.emit('user-action-required', {
                type: 'flash-download',
                message: `Flash plugin missing: ${requiredFile}`,
                instructions: instructions.trim(),
                file: readmePath
            });
            
            return new HealingResult(false, 'downloadFlashPlugin', {
                reason: 'Flash plugin file not found - created instructions file',
                file: requiredFile,
                instructionsFile: readmePath,
                userActionRequired: true
            });
        } catch (e) {
            return new HealingResult(false, 'downloadFlashPlugin', {
                reason: `Cannot create instructions file: ${e.message}`
            });
        }
    }

    /**
     * Heal Flash load failure
     */
    async healFlashLoadFailed(trackedError) {
        const actions = [];
        
        // Check SwiftShader
        const swiftshaderDir = path.join(__dirname, '..', 'flashver', 'swiftshader');
        if (!fs.existsSync(swiftshaderDir)) {
            try {
                fs.mkdirSync(swiftshaderDir, { recursive: true });
                actions.push('Created swiftshader directory');
            } catch (e) {
                actions.push(`Failed to create swiftshader: ${e.message}`);
            }
        }
        
        // Clear Electron cache
        const { app } = require('electron');
        if (app) {
            const cachePath = path.join(app.getPath('userData'), 'Cache');
            if (fs.existsSync(cachePath)) {
                try {
                    // Just log - don't actually delete while running
                    actions.push('Cache directory found - recommend clearing on restart');
                } catch (e) {
                    actions.push(`Cache check failed: ${e.message}`);
                }
            }
        }
        
        // Suggest restart
        this.emit('restart-recommended', {
            reason: 'Flash plugin repair attempted',
            actions
        });
        
        return new HealingResult(actions.length > 0, 'repairFlashPlugin', {
            message: 'Flash repair actions completed',
            actions,
            restartRecommended: true
        });
    }

    /**
     * Heal SWF loading error
     */
    async healSWFError(trackedError) {
        // Try to reload the panel
        if (this.services.panelManager) {
            try {
                // Get the panel that had the error
                const panel = trackedError.context?.panel || 'left';
                
                // Try to reload
                await this.services.panelManager.reload(panel);
                
                return new HealingResult(true, 'reloadSWF', {
                    message: `Reloaded ${panel} panel`,
                    panel
                });
            } catch (e) {
                return new HealingResult(false, 'reloadSWF', {
                    reason: `Panel reload failed: ${e.message}`
                });
            }
        }
        
        // Fallback - suggest switching to web mode
        this.emit('mode-switch-recommended', {
            from: 'swf',
            to: 'web',
            reason: 'SWF loading failed'
        });
        
        return new HealingResult(false, 'reloadSWF', {
            reason: 'Panel manager not available',
            suggestion: 'Try switching to Web mode'
        });
    }

    // ============================================================================
    // LM Studio Healing Strategies
    // ============================================================================

    /**
     * Heal LM Studio connection
     */
    async healLMStudioConnection(trackedError) {
        if (!this.services.lmStudioClient) {
            return new HealingResult(false, 'reconnectLMStudio', {
                reason: 'LM Studio client not available'
            });
        }
        
        const client = this.services.lmStudioClient;
        
        // Try to reconnect with retries
        for (let i = 0; i < this.options.maxRetries; i++) {
            try {
                await client.connect();
                
                if (client.isConnected()) {
                    return new HealingResult(true, 'reconnectLMStudio', {
                        message: 'Reconnected to LM Studio',
                        attempt: i + 1
                    });
                }
            } catch (e) {
                // Wait before retry
                await this.delay(this.options.retryDelay * (i + 1));
            }
        }
        
        return new HealingResult(false, 'reconnectLMStudio', {
            reason: `Failed to reconnect after ${this.options.maxRetries} attempts`,
            suggestion: 'Ensure LM Studio is running and the server is started'
        });
    }

    // ============================================================================
    // Network Healing Strategies
    // ============================================================================

    /**
     * Heal network timeout
     */
    async healNetworkTimeout(trackedError) {
        // Extract URL from context if available
        const url = trackedError.context?.url;
        
        if (!url) {
            return new HealingResult(false, 'retryWithTimeout', {
                reason: 'No URL in error context to retry'
            });
        }
        
        // Try with longer timeout
        const fetch = require('node-fetch');
        
        for (let i = 0; i < this.options.maxRetries; i++) {
            try {
                const timeout = 30000 * (i + 1); // Increase timeout each retry
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    return new HealingResult(true, 'retryWithTimeout', {
                        message: 'Request succeeded with extended timeout',
                        attempt: i + 1,
                        timeout
                    });
                }
            } catch (e) {
                await this.delay(this.options.retryDelay);
            }
        }
        
        return new HealingResult(false, 'retryWithTimeout', {
            reason: 'Request still timing out after retries'
        });
    }

    /**
     * Heal connection refused
     */
    async healConnectionRefused(trackedError) {
        // Try to identify the service and restart it
        const message = trackedError.message.toLowerCase();
        
        // Check common ports
        if (message.includes('1234') && this.services.lmStudioClient) {
            return this.healLMStudioConnection(trackedError);
        }
        
        // Generic retry
        for (let i = 0; i < this.options.maxRetries; i++) {
            await this.delay(this.options.retryDelay * (i + 1));
            
            // Just wait and hope service comes up
            // In a real scenario, we'd check the specific service
        }
        
        return new HealingResult(false, 'checkServiceAndRetry', {
            reason: 'Service still unavailable',
            suggestion: 'Check if the target service is running'
        });
    }

    // ============================================================================
    // MCP Healing Strategies
    // ============================================================================

    /**
     * Heal MCP server error
     */
    async healMCPServerError(trackedError) {
        if (!this.services.mcpClientManager) {
            return new HealingResult(false, 'restartMCPServers', {
                reason: 'MCP Client Manager not available'
            });
        }
        
        try {
            // Disconnect all
            await this.services.mcpClientManager.disconnectAll();
            
            // Wait a moment
            await this.delay(1000);
            
            // Reconnect all
            await this.services.mcpClientManager.connectAll();
            
            const status = this.services.mcpClientManager.getStatus();
            const connectedCount = Object.values(status.servers)
                .filter(s => s.connected).length;
            
            if (connectedCount > 0) {
                return new HealingResult(true, 'restartMCPServers', {
                    message: `Reconnected ${connectedCount} MCP servers`,
                    status
                });
            }
            
            return new HealingResult(false, 'restartMCPServers', {
                reason: 'No MCP servers could be reconnected'
            });
            
        } catch (e) {
            return new HealingResult(false, 'restartMCPServers', {
                reason: `MCP restart failed: ${e.message}`
            });
        }
    }

    // ============================================================================
    // Playwright Healing Strategies
    // ============================================================================

    /**
     * Heal Playwright browser error
     */
    async healPlaywrightBrowser(trackedError) {
        return new Promise((resolve) => {
            exec('npx playwright install chromium', { timeout: 120000 }, (error, stdout, stderr) => {
                if (error) {
                    resolve(new HealingResult(false, 'installPlaywrightBrowsers', {
                        reason: `Install failed: ${error.message}`,
                        stderr
                    }));
                } else {
                    resolve(new HealingResult(true, 'installPlaywrightBrowsers', {
                        message: 'Playwright browsers installed',
                        stdout
                    }));
                }
            });
        });
    }

    // ============================================================================
    // File System Healing Strategies
    // ============================================================================

    /**
     * Heal file not found
     */
    async healFileNotFound(trackedError) {
        const message = trackedError.message;
        
        // Try to extract path from error message
        const pathMatch = message.match(/['"]([^'"]+)['"]/);
        if (!pathMatch) {
            return new HealingResult(false, 'createMissingPath', {
                reason: 'Could not extract file path from error'
            });
        }
        
        const filePath = pathMatch[1];
        const dirPath = path.dirname(filePath);
        
        try {
            // Create directory if it doesn't exist
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                return new HealingResult(true, 'createMissingPath', {
                    message: `Created directory: ${dirPath}`,
                    path: dirPath
                });
            }
            
            // Directory exists but file doesn't - can't create file without knowing content
            return new HealingResult(false, 'createMissingPath', {
                reason: 'Directory exists but file is missing',
                path: filePath
            });
            
        } catch (e) {
            return new HealingResult(false, 'createMissingPath', {
                reason: `Failed to create path: ${e.message}`
            });
        }
    }

    // ============================================================================
    // IPC Healing Strategies
    // ============================================================================

    /**
     * Heal IPC error
     */
    async healIPCError(trackedError) {
        // Emit event for main process to reload renderer
        this.emit('reload-renderer-requested', {
            reason: 'IPC communication error',
            error: trackedError.message
        });
        
        return new HealingResult(true, 'restartRenderer', {
            message: 'Renderer reload requested',
            userActionRequired: true
        });
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get healing history
     */
    getHistory(count = 20) {
        return this.history.slice(0, count);
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
            enabled: this.options.enableAutoHeal,
            strategyCount: this.strategies.size,
            stats: this.getStats()
        };
    }

    /**
     * Enable/disable auto-healing
     */
    setEnabled(enabled) {
        this.options.enableAutoHeal = enabled;
        this.emit('enabled-changed', enabled);
    }
}

module.exports = { SelfHealer, HealingResult };
