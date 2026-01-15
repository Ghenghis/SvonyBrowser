/**
 * CLI Access Service
 * Provides full command-line interface access for the chatbot
 * Fallback when LM Studio is not available
 * v2.2.1 - Added by Cascade
 */

const { EventEmitter } = require('events');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * CLI Access Service
 * Enables direct command execution, script running, and system operations
 */
class CLIAccessService extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            shell: config.shell || (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'),
            timeout: config.timeout || 60000,
            maxOutputSize: config.maxOutputSize || 1024 * 1024, // 1MB
            workingDir: config.workingDir || process.cwd(),
            allowedCommands: config.allowedCommands || null, // null = allow all
            blockedCommands: config.blockedCommands || ['rm -rf /', 'format', 'del /s'],
            historySize: config.historySize || 100,
            ...config
        };
        
        this.commandHistory = [];
        this.runningProcesses = new Map();
        this.isInitialized = false;
        
        console.log('[CLIAccessService] Created');
    }
    
    /**
     * Initialize the service
     */
    async initialize() {
        this.isInitialized = true;
        this.emit('initialized');
        console.log('[CLIAccessService] Initialized');
        return true;
    }
    
    /**
     * Execute a command and return the result
     */
    async executeCommand(command, options = {}) {
        // Security check
        if (!this.isCommandAllowed(command)) {
            return {
                success: false,
                error: 'Command blocked for security reasons',
                command
            };
        }
        
        const startTime = Date.now();
        const execOptions = {
            cwd: options.cwd || this.config.workingDir,
            timeout: options.timeout || this.config.timeout,
            maxBuffer: this.config.maxOutputSize,
            shell: this.config.shell,
            env: { ...process.env, ...options.env }
        };
        
        return new Promise((resolve) => {
            exec(command, execOptions, (error, stdout, stderr) => {
                const duration = Date.now() - startTime;
                
                const result = {
                    success: !error,
                    command,
                    stdout: stdout?.toString() || '',
                    stderr: stderr?.toString() || '',
                    error: error?.message || null,
                    exitCode: error?.code || 0,
                    duration,
                    timestamp: new Date().toISOString()
                };
                
                // Add to history
                this.addToHistory(result);
                
                // Emit event
                this.emit('command-executed', result);
                
                resolve(result);
            });
        });
    }
    
    /**
     * Execute command with streaming output
     */
    async executeCommandStreaming(command, options = {}) {
        if (!this.isCommandAllowed(command)) {
            return {
                success: false,
                error: 'Command blocked for security reasons'
            };
        }
        
        const id = `cmd-${Date.now()}`;
        const cwd = options.cwd || this.config.workingDir;
        
        return new Promise((resolve) => {
            const args = process.platform === 'win32' 
                ? ['-Command', command]
                : ['-c', command];
            
            const proc = spawn(this.config.shell, args, {
                cwd,
                env: { ...process.env, ...options.env }
            });
            
            this.runningProcesses.set(id, proc);
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;
                this.emit('command-output', { id, type: 'stdout', data: chunk });
            });
            
            proc.stderr.on('data', (data) => {
                const chunk = data.toString();
                stderr += chunk;
                this.emit('command-output', { id, type: 'stderr', data: chunk });
            });
            
            proc.on('close', (code) => {
                this.runningProcesses.delete(id);
                
                const result = {
                    id,
                    success: code === 0,
                    command,
                    stdout,
                    stderr,
                    exitCode: code,
                    timestamp: new Date().toISOString()
                };
                
                this.addToHistory(result);
                this.emit('command-completed', result);
                resolve(result);
            });
            
            proc.on('error', (error) => {
                this.runningProcesses.delete(id);
                resolve({
                    id,
                    success: false,
                    command,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            });
            
            // Timeout handling
            if (options.timeout || this.config.timeout) {
                setTimeout(() => {
                    if (this.runningProcesses.has(id)) {
                        proc.kill();
                        resolve({
                            id,
                            success: false,
                            command,
                            error: 'Command timed out',
                            stdout,
                            stderr,
                            timestamp: new Date().toISOString()
                        });
                    }
                }, options.timeout || this.config.timeout);
            }
        });
    }
    
    /**
     * Kill a running process
     */
    killProcess(id) {
        const proc = this.runningProcesses.get(id);
        if (proc) {
            proc.kill();
            this.runningProcesses.delete(id);
            return { success: true, id };
        }
        return { success: false, error: 'Process not found' };
    }
    
    /**
     * Kill all running processes
     */
    killAllProcesses() {
        for (const [id, proc] of this.runningProcesses) {
            proc.kill();
        }
        const count = this.runningProcesses.size;
        this.runningProcesses.clear();
        return { success: true, killed: count };
    }
    
    /**
     * Check if command is allowed
     */
    isCommandAllowed(command) {
        const lowerCommand = command.toLowerCase();
        
        // Check blocked commands
        for (const blocked of this.config.blockedCommands) {
            if (lowerCommand.includes(blocked.toLowerCase())) {
                return false;
            }
        }
        
        // If allowedCommands is set, check whitelist
        if (this.config.allowedCommands) {
            return this.config.allowedCommands.some(allowed => 
                lowerCommand.startsWith(allowed.toLowerCase())
            );
        }
        
        return true;
    }
    
    /**
     * Run a script file
     */
    async runScript(scriptPath, args = [], options = {}) {
        if (!fs.existsSync(scriptPath)) {
            return { success: false, error: 'Script file not found' };
        }
        
        const ext = path.extname(scriptPath).toLowerCase();
        let command;
        
        switch (ext) {
            case '.js':
                command = `node "${scriptPath}" ${args.join(' ')}`;
                break;
            case '.py':
                command = `python "${scriptPath}" ${args.join(' ')}`;
                break;
            case '.ps1':
                command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" ${args.join(' ')}`;
                break;
            case '.bat':
            case '.cmd':
                command = `"${scriptPath}" ${args.join(' ')}`;
                break;
            case '.sh':
                command = `bash "${scriptPath}" ${args.join(' ')}`;
                break;
            default:
                command = `"${scriptPath}" ${args.join(' ')}`;
        }
        
        return this.executeCommand(command, options);
    }
    
    /**
     * Get system information
     */
    getSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            uptime: os.uptime(),
            userInfo: os.userInfo(),
            homeDir: os.homedir(),
            tempDir: os.tmpdir(),
            shell: this.config.shell
        };
    }
    
    /**
     * List directory contents
     */
    async listDirectory(dirPath, options = {}) {
        const targetPath = dirPath || this.config.workingDir;
        
        try {
            const entries = fs.readdirSync(targetPath, { withFileTypes: true });
            
            const items = entries.map(entry => ({
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
                path: path.join(targetPath, entry.name)
            }));
            
            // Get file stats if requested
            if (options.includeStats) {
                for (const item of items) {
                    try {
                        const stats = fs.statSync(item.path);
                        item.size = stats.size;
                        item.modified = stats.mtime;
                        item.created = stats.birthtime;
                    } catch (e) {
                        item.statsError = e.message;
                    }
                }
            }
            
            return { success: true, path: targetPath, items };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Read file contents
     */
    async readFile(filePath, options = {}) {
        try {
            const encoding = options.encoding || 'utf8';
            const content = fs.readFileSync(filePath, encoding);
            
            return {
                success: true,
                path: filePath,
                content,
                size: content.length
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Write file contents
     */
    async writeFile(filePath, content, options = {}) {
        try {
            const encoding = options.encoding || 'utf8';
            
            // Create directory if needed
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, content, encoding);
            
            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Check if path exists
     */
    pathExists(targetPath) {
        return {
            exists: fs.existsSync(targetPath),
            path: targetPath
        };
    }
    
    /**
     * Get environment variables
     */
    getEnvironment() {
        return { ...process.env };
    }
    
    /**
     * Set working directory
     */
    setWorkingDirectory(dir) {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            this.config.workingDir = dir;
            return { success: true, workingDir: dir };
        }
        return { success: false, error: 'Invalid directory' };
    }
    
    /**
     * Add command to history
     */
    addToHistory(result) {
        this.commandHistory.unshift(result);
        
        // Trim history
        if (this.commandHistory.length > this.config.historySize) {
            this.commandHistory = this.commandHistory.slice(0, this.config.historySize);
        }
    }
    
    /**
     * Get command history
     */
    getHistory(limit = 20) {
        return this.commandHistory.slice(0, limit);
    }
    
    /**
     * Clear history
     */
    clearHistory() {
        this.commandHistory = [];
        return { success: true };
    }
    
    /**
     * Get running processes
     */
    getRunningProcesses() {
        return Array.from(this.runningProcesses.keys());
    }
    
    /**
     * Get service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            shell: this.config.shell,
            workingDir: this.config.workingDir,
            runningProcesses: this.runningProcesses.size,
            historySize: this.commandHistory.length,
            platform: os.platform()
        };
    }
}

// Singleton
let instance = null;

function getCLIAccessService() {
    if (!instance) {
        instance = new CLIAccessService();
    }
    return instance;
}

module.exports = {
    CLIAccessService,
    getCLIAccessService
};

