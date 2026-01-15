/**
 * MCP Client Manager v2.0.7
 * Manages connections to all MCP servers with health checks, timeouts, and request queuing
 * Integrates evony-rag, evony-rte, and evony-tools servers
 */

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

/**
 * Request Queue for managing concurrent requests
 */
class RequestQueue {
    constructor(maxConcurrent = 3) {
        this.queue = [];
        this.running = 0;
        this.maxConcurrent = maxConcurrent;
    }
    
    async add(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.process();
        });
    }
    
    async process() {
        if (this.running >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }
        
        this.running++;
        const { fn, resolve, reject } = this.queue.shift();
        
        try {
            const result = await fn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            this.process();
        }
    }
    
    clear() {
        this.queue = [];
    }
    
    get size() {
        return this.queue.length;
    }
}

/**
 * MCP Server Connection with health checks and timeouts
 */
class MCPServerConnection extends EventEmitter {
    constructor(name, serverPath, options = {}) {
        super();
        this.name = name;
        this.serverPath = serverPath;
        this.process = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.tools = [];
        this.toolsCache = null;
        this.toolsCacheTime = 0;
        this.isConnected = false;
        this.rl = null;
        
        // Configuration
        this.config = {
            requestTimeout: options.requestTimeout || 30000,
            healthCheckInterval: options.healthCheckInterval || 60000,
            reconnectDelay: options.reconnectDelay || 5000,
            maxReconnectAttempts: options.maxReconnectAttempts || 5,
            toolsCacheTTL: options.toolsCacheTTL || 300000 // 5 minutes
        };
        
        // State
        this.reconnectAttempts = 0;
        this.healthCheckTimer = null;
        this.lastHealthCheck = 0;
        this.isHealthy = false;
        
        // Request queue
        this.requestQueue = new RequestQueue(3);
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgResponseTime: 0,
            lastError: null,
            startTime: null
        };
    }
    
    /**
     * Start the MCP server process
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                console.log(`[MCP:${this.name}] Starting server from ${this.serverPath}`);
                
                this.process = spawn('node', [this.serverPath], { windowsHide: true, 
                    stdio: ['pipe', 'pipe', 'pipe'],
                    cwd: path.dirname(this.serverPath)
                });
                
                // Set up readline for JSON-RPC communication
                this.rl = readline.createInterface({
                    input: this.process.stdout,
                    terminal: false
                });
                
                this.rl.on('line', (line) => {
                    this.handleMessage(line);
                });
                
                this.process.stderr.on('data', (data) => {
                    const msg = data.toString().trim();
                    if (msg) {
                        console.log(`[MCP:${this.name}] ${msg}`);
                    }
                });
                
                this.process.on('error', (error) => {
                    console.error(`[MCP:${this.name}] Process error:`, error);
                    this.isConnected = false;
                    this.isHealthy = false;
                    this.stats.lastError = error.message;
                    this.emit('error', error);
                    this.scheduleReconnect();
                });
                
                this.process.on('exit', (code) => {
                    console.log(`[MCP:${this.name}] Process exited with code ${code}`);
                    this.isConnected = false;
                    this.isHealthy = false;
                    this.emit('disconnected');
                    
                    if (code !== 0) {
                        this.scheduleReconnect();
                    }
                });
                
                // Initialize the connection with timeout
                const initTimeout = setTimeout(() => {
                    reject(new Error(`Initialization timeout for ${this.name}`));
                }, this.config.requestTimeout);
                
                this.initialize().then(() => {
                    clearTimeout(initTimeout);
                    this.isConnected = true;
                    this.isHealthy = true;
                    this.reconnectAttempts = 0;
                    this.stats.startTime = Date.now();
                    this.startHealthChecks();
                    this.emit('connected');
                    resolve(true);
                }).catch((error) => {
                    clearTimeout(initTimeout);
                    reject(error);
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error(`[MCP:${this.name}] Max reconnect attempts reached`);
            this.emit('max-reconnects');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.config.reconnectDelay * this.reconnectAttempts;
        
        console.log(`[MCP:${this.name}] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(async () => {
            try {
                await this.start();
            } catch (error) {
                console.error(`[MCP:${this.name}] Reconnect failed:`, error.message);
            }
        }, delay);
    }
    
    /**
     * Start health check timer
     */
    startHealthChecks() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        
        this.healthCheckTimer = setInterval(async () => {
            await this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }
    
    /**
     * Perform health check
     */
    async performHealthCheck() {
        if (!this.isConnected) {
            this.isHealthy = false;
            return false;
        }
        
        try {
            const start = Date.now();
            await this.sendRequest('ping', {}, 5000); // 5 second timeout for health check
            this.lastHealthCheck = Date.now();
            this.isHealthy = true;
            
            this.emit('health-check', {
                healthy: true,
                responseTime: Date.now() - start
            });
            
            return true;
        } catch (error) {
            this.isHealthy = false;
            this.stats.lastError = error.message;
            
            this.emit('health-check', {
                healthy: false,
                error: error.message
            });
            
            return false;
        }
    }
    
    /**
     * Send JSON-RPC message
     */
    sendMessage(message) {
        if (!this.process || !this.process.stdin.writable) {
            throw new Error(`MCP server ${this.name} not connected`);
        }
        
        const json = JSON.stringify(message);
        this.process.stdin.write(json + '\n');
    }
    
    /**
     * Send request with timeout
     */
    async sendRequest(method, params = {}, timeout = null) {
        const requestTimeout = timeout || this.config.requestTimeout;
        
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            const startTime = Date.now();
            
            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(id);
                this.stats.failedRequests++;
                reject(new Error(`Request ${method} timed out after ${requestTimeout}ms`));
            }, requestTimeout);
            
            this.pendingRequests.set(id, {
                resolve: (result) => {
                    clearTimeout(timeoutHandle);
                    const responseTime = Date.now() - startTime;
                    this.updateStats(true, responseTime);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeoutHandle);
                    this.updateStats(false);
                    reject(error);
                },
                timeout: timeoutHandle,
                method,
                startTime
            });
            
            this.stats.totalRequests++;
            
            try {
                this.sendMessage({
                    jsonrpc: '2.0',
                    id,
                    method,
                    params
                });
            } catch (error) {
                this.pendingRequests.delete(id);
                clearTimeout(timeoutHandle);
                this.stats.failedRequests++;
                reject(error);
            }
        });
    }
    
    /**
     * Update statistics
     */
    updateStats(success, responseTime = 0) {
        if (success) {
            this.stats.successfulRequests++;
            // Update rolling average
            const total = this.stats.successfulRequests;
            this.stats.avgResponseTime = 
                (this.stats.avgResponseTime * (total - 1) + responseTime) / total;
        } else {
            this.stats.failedRequests++;
        }
    }
    
    /**
     * Handle incoming message
     */
    handleMessage(line) {
        try {
            const message = JSON.parse(line);
            
            if (message.id && this.pendingRequests.has(message.id)) {
                const { resolve, reject } = this.pendingRequests.get(message.id);
                this.pendingRequests.delete(message.id);
                
                if (message.error) {
                    this.stats.lastError = message.error.message;
                    reject(new Error(message.error.message));
                } else {
                    resolve(message.result);
                }
            } else if (!message.id) {
                // Notification
                this.emit('notification', message);
            }
        } catch (error) {
            console.error(`[MCP:${this.name}] Failed to parse message:`, error);
        }
    }
    
    /**
     * Initialize MCP connection
     */
    async initialize() {
        const result = await this.sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'svony-browser',
                version: '2.0.7'
            }
        });
        
        // Send initialized notification
        this.sendMessage({
            jsonrpc: '2.0',
            method: 'initialized'
        });
        
        // Get available tools
        await this.refreshTools();
        
        console.log(`[MCP:${this.name}] Initialized with ${this.tools.length} tools`);
        return result;
    }
    
    /**
     * Refresh tools list
     */
    async refreshTools() {
        const toolsResult = await this.sendRequest('tools/list');
        this.tools = toolsResult.tools || [];
        this.toolsCache = this.tools;
        this.toolsCacheTime = Date.now();
        return this.tools;
    }
    
    /**
     * Call a tool with queuing
     */
    async callTool(toolName, args = {}) {
        return this.requestQueue.add(async () => {
            const result = await this.sendRequest('tools/call', {
                name: toolName,
                arguments: args
            });
            
            // Parse content from result
            if (result.content && result.content.length > 0) {
                const textContent = result.content.find(c => c.type === 'text');
                if (textContent) {
                    try {
                        return JSON.parse(textContent.text);
                    } catch {
                        return textContent.text;
                    }
                }
            }
            
            return result;
        });
    }
    
    /**
     * Get available tools (with caching)
     */
    getTools(forceRefresh = false) {
        if (forceRefresh || !this.toolsCache || 
            Date.now() - this.toolsCacheTime > this.config.toolsCacheTTL) {
            this.refreshTools().catch(err => {
                console.error(`[MCP:${this.name}] Failed to refresh tools:`, err.message);
            });
        }
        return this.tools;
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
            isConnected: this.isConnected,
            isHealthy: this.isHealthy,
            pendingRequests: this.pendingRequests.size,
            queueSize: this.requestQueue.size,
            successRate: this.stats.totalRequests > 0
                ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(2) + '%'
                : '0%'
        };
    }
    
    /**
     * Stop the server
     */
    async stop() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        
        if (this.rl) {
            this.rl.close();
        }
        
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        
        this.isConnected = false;
        this.isHealthy = false;
        this.pendingRequests.clear();
        this.requestQueue.clear();
    }
}

/**
 * MCP Client Manager - manages all MCP server connections
 */
class MCPClientManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.servers = new Map();
        this.toolRegistry = new Map(); // tool name -> server name
        this.isInitialized = false;
        
        // Configuration
        this.config = {
            requestTimeout: options.requestTimeout || 30000,
            healthCheckInterval: options.healthCheckInterval || 60000,
            reconnectDelay: options.reconnectDelay || 5000,
            maxReconnectAttempts: options.maxReconnectAttempts || 5
        };
        
        // Statistics
        this.stats = {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            startTime: Date.now()
        };
    }
    
    /**
     * Initialize all MCP servers
     */
    async initialize(basePath) {
        const serverConfigs = [
            {
                name: 'evony-rag',
                path: path.join(basePath, 'mcp-servers/evony-rag/index.js'),
                description: 'Knowledge base search and retrieval'
            },
            {
                name: 'evony-rte',
                path: path.join(basePath, 'mcp-servers/evony-rte/index.js'),
                description: 'Protocol analysis and traffic decoding'
            },
            {
                name: 'evony-tools',
                path: path.join(basePath, 'mcp-servers/evony-tools/index.js'),
                description: 'Game calculations and utilities'
            }
        ];
        
        const results = [];
        
        for (const config of serverConfigs) {
            try {
                const server = new MCPServerConnection(config.name, config.path, this.config);
                
                server.on('connected', () => {
                    this.emit('server-connected', config.name);
                });
                
                server.on('disconnected', () => {
                    this.emit('server-disconnected', config.name);
                });
                
                server.on('error', (error) => {
                    this.emit('server-error', { server: config.name, error });
                });
                
                server.on('health-check', (result) => {
                    this.emit('health-check', { server: config.name, ...result });
                });
                
                server.on('max-reconnects', () => {
                    this.emit('server-failed', config.name);
                });
                
                await server.start();
                this.servers.set(config.name, server);
                
                // Register tools
                for (const tool of server.getTools()) {
                    this.toolRegistry.set(tool.name, config.name);
                }
                
                results.push({ 
                    name: config.name, 
                    status: 'connected', 
                    tools: server.getTools().length 
                });
            } catch (error) {
                console.error(`[MCPManager] Failed to start ${config.name}:`, error.message);
                results.push({ 
                    name: config.name, 
                    status: 'failed', 
                    error: error.message 
                });
            }
        }
        
        this.isInitialized = true;
        this.emit('initialized', results);
        return results;
    }
    
    /**
     * Call a tool by name with timeout
     */
    async callTool(toolName, args = {}, timeout = null) {
        this.stats.totalCalls++;
        
        const serverName = this.toolRegistry.get(toolName);
        
        if (!serverName) {
            this.stats.failedCalls++;
            throw new Error(`Unknown tool: ${toolName}`);
        }
        
        const server = this.servers.get(serverName);
        
        if (!server || !server.isConnected) {
            this.stats.failedCalls++;
            throw new Error(`Server ${serverName} not connected`);
        }
        
        if (!server.isHealthy) {
            console.warn(`[MCPManager] Server ${serverName} is unhealthy, attempting call anyway`);
        }
        
        try {
            const result = await server.callTool(toolName, args);
            this.stats.successfulCalls++;
            return result;
        } catch (error) {
            this.stats.failedCalls++;
            throw error;
        }
    }
    
    /**
     * Get all available tools across all servers
     */
    getAllTools(forceRefresh = false) {
        const tools = [];
        
        for (const [serverName, server] of this.servers) {
            for (const tool of server.getTools(forceRefresh)) {
                tools.push({
                    ...tool,
                    server: serverName
                });
            }
        }
        
        return tools;
    }
    
    /**
     * Get tools by category/server
     */
    getToolsByServer(serverName) {
        const server = this.servers.get(serverName);
        return server ? server.getTools() : [];
    }
    
    /**
     * Get status of all servers
     */
    getStatus() {
        const status = {
            initialized: this.isInitialized,
            servers: {},
            stats: this.getStats()
        };
        
        for (const [name, server] of this.servers) {
            status.servers[name] = {
                connected: server.isConnected,
                healthy: server.isHealthy,
                tools: server.tools.length,
                stats: server.getStats()
            };
        }
        
        return status;
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            successRate: this.stats.totalCalls > 0
                ? ((this.stats.successfulCalls / this.stats.totalCalls) * 100).toFixed(2) + '%'
                : '0%'
        };
    }
    
    /**
     * Reconnect a specific server
     */
    async reconnectServer(serverName) {
        const server = this.servers.get(serverName);
        if (!server) {
            throw new Error(`Unknown server: ${serverName}`);
        }
        
        await server.stop();
        await server.start();
        
        // Re-register tools
        for (const tool of server.getTools()) {
            this.toolRegistry.set(tool.name, serverName);
        }
        
        return true;
    }
    
    /**
     * Reconnect all servers
     */
    async reconnectAll() {
        const results = [];
        
        for (const [name, server] of this.servers) {
            try {
                await this.reconnectServer(name);
                results.push({ name, status: 'reconnected' });
            } catch (error) {
                results.push({ name, status: 'failed', error: error.message });
            }
        }
        
        return results;
    }
    
    /**
     * Perform health check on all servers
     */
    async healthCheckAll() {
        const results = {};
        
        for (const [name, server] of this.servers) {
            results[name] = await server.performHealthCheck();
        }
        
        return results;
    }
    
    /**
     * Shutdown all servers
     */
    async shutdown() {
        for (const [name, server] of this.servers) {
            console.log(`[MCPManager] Stopping ${name}...`);
            await server.stop();
        }
        
        this.servers.clear();
        this.toolRegistry.clear();
        this.isInitialized = false;
    }
}

module.exports = { MCPClientManager, MCPServerConnection, RequestQueue };

