/**
 * MCP Client Manager
 * Manages connections to all MCP servers and provides unified tool access
 * Integrates evony-rag, evony-rte, and evony-tools servers
 */

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

/**
 * MCP Server Connection
 */
class MCPServerConnection extends EventEmitter {
    constructor(name, serverPath) {
        super();
        this.name = name;
        this.serverPath = serverPath;
        this.process = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.tools = [];
        this.isConnected = false;
        this.rl = null;
    }
    
    /**
     * Start the MCP server process
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.process = spawn('node', [this.serverPath], {
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
                    console.log(`[MCP:${this.name}] ${data.toString().trim()}`);
                });
                
                this.process.on('error', (error) => {
                    console.error(`[MCP:${this.name}] Process error:`, error);
                    this.isConnected = false;
                    this.emit('error', error);
                });
                
                this.process.on('exit', (code) => {
                    console.log(`[MCP:${this.name}] Process exited with code ${code}`);
                    this.isConnected = false;
                    this.emit('disconnected');
                });
                
                // Initialize the connection
                this.initialize().then(() => {
                    this.isConnected = true;
                    this.emit('connected');
                    resolve(true);
                }).catch(reject);
                
            } catch (error) {
                reject(error);
            }
        });
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
     * Send request and wait for response
     */
    async sendRequest(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request ${method} timed out`));
            }, 30000);
            
            this.pendingRequests.set(id, { resolve, reject, timeout });
            
            this.sendMessage({
                jsonrpc: '2.0',
                id,
                method,
                params
            });
        });
    }
    
    /**
     * Handle incoming message
     */
    handleMessage(line) {
        try {
            const message = JSON.parse(line);
            
            if (message.id && this.pendingRequests.has(message.id)) {
                const { resolve, reject, timeout } = this.pendingRequests.get(message.id);
                clearTimeout(timeout);
                this.pendingRequests.delete(message.id);
                
                if (message.error) {
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
                version: '2.0.6'
            }
        });
        
        // Send initialized notification
        this.sendMessage({
            jsonrpc: '2.0',
            method: 'initialized'
        });
        
        // Get available tools
        const toolsResult = await this.sendRequest('tools/list');
        this.tools = toolsResult.tools || [];
        
        console.log(`[MCP:${this.name}] Initialized with ${this.tools.length} tools`);
        return result;
    }
    
    /**
     * Call a tool
     */
    async callTool(toolName, args = {}) {
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
    }
    
    /**
     * Get available tools
     */
    getTools() {
        return this.tools;
    }
    
    /**
     * Stop the server
     */
    async stop() {
        if (this.rl) {
            this.rl.close();
        }
        
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        
        this.isConnected = false;
        this.pendingRequests.clear();
    }
}

/**
 * MCP Client Manager - manages all MCP server connections
 */
class MCPClientManager extends EventEmitter {
    constructor() {
        super();
        this.servers = new Map();
        this.toolRegistry = new Map(); // tool name -> server name
        this.isInitialized = false;
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
                const server = new MCPServerConnection(config.name, config.path);
                
                server.on('connected', () => {
                    this.emit('server-connected', config.name);
                });
                
                server.on('disconnected', () => {
                    this.emit('server-disconnected', config.name);
                });
                
                server.on('error', (error) => {
                    this.emit('server-error', { server: config.name, error });
                });
                
                await server.start();
                this.servers.set(config.name, server);
                
                // Register tools
                for (const tool of server.getTools()) {
                    this.toolRegistry.set(tool.name, config.name);
                }
                
                results.push({ name: config.name, status: 'connected', tools: server.getTools().length });
            } catch (error) {
                console.error(`[MCPManager] Failed to start ${config.name}:`, error.message);
                results.push({ name: config.name, status: 'failed', error: error.message });
            }
        }
        
        this.isInitialized = true;
        this.emit('initialized', results);
        return results;
    }
    
    /**
     * Call a tool by name (automatically routes to correct server)
     */
    async callTool(toolName, args = {}) {
        const serverName = this.toolRegistry.get(toolName);
        
        if (!serverName) {
            throw new Error(`Unknown tool: ${toolName}`);
        }
        
        const server = this.servers.get(serverName);
        
        if (!server || !server.isConnected) {
            throw new Error(`Server ${serverName} not connected`);
        }
        
        return await server.callTool(toolName, args);
    }
    
    /**
     * Get all available tools across all servers
     */
    getAllTools() {
        const tools = [];
        
        for (const [serverName, server] of this.servers) {
            for (const tool of server.getTools()) {
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
            servers: {}
        };
        
        for (const [name, server] of this.servers) {
            status.servers[name] = {
                connected: server.isConnected,
                tools: server.getTools().length
            };
        }
        
        return status;
    }
    
    /**
     * Evony RAG - Search knowledge base
     */
    async searchKnowledge(query, limit = 5) {
        return await this.callTool('evony_search', { query, limit });
    }
    
    /**
     * Evony RAG - Lookup specific topic
     */
    async lookupTopic(topic) {
        return await this.callTool('evony_lookup', { topic });
    }
    
    /**
     * Evony RAG - Get context for situation
     */
    async getContext(situation) {
        return await this.callTool('evony_context', { situation });
    }
    
    /**
     * Evony RTE - Lookup protocol action
     */
    async lookupProtocol(identifier) {
        return await this.callTool('protocol_lookup', { identifier });
    }
    
    /**
     * Evony RTE - Search protocols
     */
    async searchProtocol(query, category = null) {
        return await this.callTool('protocol_search', { query, category });
    }
    
    /**
     * Evony RTE - Decode packet
     */
    async decodePacket(hexData) {
        return await this.callTool('decode_packet', { hexData });
    }
    
    /**
     * Evony RTE - Analyze traffic
     */
    async analyzeTraffic(packets) {
        return await this.callTool('analyze_traffic', { packets });
    }
    
    /**
     * Evony Tools - Calculate training
     */
    async calcTraining(troopType, quantity, buffs = {}) {
        return await this.callTool('calc_training', { troopType, quantity, buffs });
    }
    
    /**
     * Evony Tools - Calculate march time
     */
    async calcMarch(fromX, fromY, toX, toY, troops, buffs = {}) {
        return await this.callTool('calc_march', { fromX, fromY, toX, toY, troops, buffs });
    }
    
    /**
     * Evony Tools - Calculate combat
     */
    async calcCombat(attacker, defender, options = {}) {
        return await this.callTool('calc_combat', { attacker, defender, options });
    }
    
    /**
     * Evony Tools - Calculate resources
     */
    async calcResources(buildings, buffs = {}) {
        return await this.callTool('calc_resources', { buildings, buffs });
    }
    
    /**
     * Evony Tools - Calculate building
     */
    async calcBuilding(buildingType, targetLevel, currentLevel = 0, buffs = {}) {
        return await this.callTool('calc_building', { buildingType, targetLevel, currentLevel, buffs });
    }
    
    /**
     * Shutdown all servers
     */
    async shutdown() {
        for (const [name, server] of this.servers) {
            await server.stop();
        }
        
        this.servers.clear();
        this.toolRegistry.clear();
        this.isInitialized = false;
        this.emit('shutdown');
    }
}

// Singleton instance
let instance = null;

function getMCPClientManager() {
    if (!instance) {
        instance = new MCPClientManager();
    }
    return instance;
}

module.exports = {
    MCPClientManager,
    MCPServerConnection,
    getMCPClientManager
};
