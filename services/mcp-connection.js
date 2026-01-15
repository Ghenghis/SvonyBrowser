/**
 * Svony Browser - MCP Connection Manager
 * Connect to MCP servers for AI-powered features
 */

const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class McpConnectionManager extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();  // serverName -> connection
        this.configPath = path.join(__dirname, '../config/mcp-config.json');
        this.config = null;
        this.initialized = false;
    }

    /**
     * Load MCP configuration from file
     */
    async loadConfig() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            console.log('[McpConnection] Config loaded:', Object.keys(this.config.mcpServers || {}));
            return this.config;
        } catch (error) {
            console.warn('[McpConnection] Config not found, creating default');
            await this.createDefaultConfig();
            return this.loadConfig();
        }
    }

    /**
     * Create default MCP configuration
     */
    async createDefaultConfig() {
        const defaultConfig = {
            mcpServers: {
                "evony-knowledge": {
                    command: "node",
                    args: ["./mcp-servers/evony-knowledge/server.js"],
                    env: {
                        EVONY_KB_PATH: "./data/evony-knowledge"
                    },
                    autoConnect: true,
                    description: "Evony game knowledge base"
                },
                "memory": {
                    command: "node",
                    args: ["./mcp-servers/memory/server.js"],
                    env: {
                        MEMORY_FILE: "./data/memory.json"
                    },
                    autoConnect: true,
                    description: "Persistent memory storage"
                }
            },
            settings: {
                reconnectInterval: 5000,
                maxReconnectAttempts: 3,
                requestTimeout: 30000
            }
        };

        const dir = path.dirname(this.configPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
        console.log('[McpConnection] Created default config');
    }

    /**
     * Initialize and connect to configured servers
     */
    async initialize() {
        await this.loadConfig();
        
        if (!this.config || !this.config.mcpServers) {
            console.warn('[McpConnection] No MCP servers configured');
            return;
        }

        for (const [name, serverConfig] of Object.entries(this.config.mcpServers)) {
            if (serverConfig.autoConnect) {
                try {
                    await this.connectServer(name, serverConfig);
                } catch (error) {
                    console.error(`[McpConnection] Failed to connect to ${name}:`, error.message);
                }
            }
        }

        this.initialized = true;
        this.emit('initialized');
    }

    /**
     * Connect to an MCP server via stdio
     */
    async connectServer(serverName, serverConfig) {
        console.log(`[McpConnection] Connecting to ${serverName}...`);

        // Check if already connected
        if (this.connections.has(serverName)) {
            console.log(`[McpConnection] ${serverName} already connected`);
            return true;
        }

        try {
            const proc = spawn(serverConfig.command, serverConfig.args || [], {
                env: { ...process.env, ...(serverConfig.env || {}) },
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: path.join(__dirname, '..')
            });

            const connection = {
                process: proc,
                reader: readline.createInterface({ input: proc.stdout }),
                writer: proc.stdin,
                requestId: 0,
                pendingRequests: new Map(),
                tools: [],
                resources: [],
                status: 'connecting'
            };

            // Handle incoming messages
            connection.reader.on('line', (line) => {
                try {
                    const message = JSON.parse(line);
                    this.handleMessage(serverName, message);
                } catch (error) {
                    console.error(`[McpConnection] Parse error from ${serverName}:`, error.message);
                }
            });

            // Handle process errors
            proc.on('error', (error) => {
                console.error(`[McpConnection] Process error for ${serverName}:`, error.message);
                connection.status = 'error';
                this.emit('serverError', { server: serverName, error: error.message });
            });

            proc.on('exit', (code) => {
                console.log(`[McpConnection] ${serverName} exited with code ${code}`);
                connection.status = 'disconnected';
                this.connections.delete(serverName);
                this.emit('serverDisconnected', { server: serverName, code });
            });

            proc.stderr.on('data', (data) => {
                console.error(`[McpConnection] ${serverName} stderr:`, data.toString());
            });

            this.connections.set(serverName, connection);

            // Send initialize request
            const initResult = await this.sendRequest(serverName, 'initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {},
                    resources: {}
                },
                clientInfo: {
                    name: 'Svony Browser',
                    version: '2.0.0'
                }
            });

            // Send initialized notification
            await this.sendNotification(serverName, 'notifications/initialized', {});

            // Get available tools
            try {
                const toolsResult = await this.sendRequest(serverName, 'tools/list', {});
                connection.tools = toolsResult.tools || [];
                console.log(`[McpConnection] ${serverName} tools:`, connection.tools.map(t => t.name));
            } catch (e) {
                console.warn(`[McpConnection] Could not list tools for ${serverName}`);
            }

            connection.status = 'connected';
            this.emit('serverConnected', { server: serverName, tools: connection.tools });
            console.log(`[McpConnection] Connected to ${serverName}`);

            return true;
        } catch (error) {
            console.error(`[McpConnection] Connection failed for ${serverName}:`, error.message);
            this.emit('serverError', { server: serverName, error: error.message });
            return false;
        }
    }

    /**
     * Handle incoming message from MCP server
     */
    handleMessage(serverName, message) {
        const connection = this.connections.get(serverName);
        if (!connection) return;

        if (message.id !== undefined) {
            // Response to a request
            const pending = connection.pendingRequests.get(message.id);
            if (pending) {
                connection.pendingRequests.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(message.error.message || 'Unknown error'));
                } else {
                    pending.resolve(message.result);
                }
            }
        } else if (message.method) {
            // Notification from server
            this.emit('notification', { server: serverName, method: message.method, params: message.params });
        }
    }

    /**
     * Send JSON-RPC request to server
     */
    async sendRequest(serverName, method, params = {}) {
        const connection = this.connections.get(serverName);
        if (!connection) {
            throw new Error(`Server ${serverName} not connected`);
        }

        const id = ++connection.requestId;
        const request = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };

        const timeout = this.config?.settings?.requestTimeout || 30000;

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                connection.pendingRequests.delete(id);
                reject(new Error(`Request timeout for ${method}`));
            }, timeout);

            connection.pendingRequests.set(id, {
                resolve: (result) => {
                    clearTimeout(timer);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timer);
                    reject(error);
                }
            });

            connection.writer.write(JSON.stringify(request) + '\n');
        });
    }

    /**
     * Send notification (no response expected)
     */
    async sendNotification(serverName, method, params = {}) {
        const connection = this.connections.get(serverName);
        if (!connection) {
            throw new Error(`Server ${serverName} not connected`);
        }

        const notification = {
            jsonrpc: '2.0',
            method,
            params
        };

        connection.writer.write(JSON.stringify(notification) + '\n');
    }

    /**
     * Call an MCP tool
     */
    async callTool(serverName, toolName, args = {}) {
        console.log(`[McpConnection] Calling ${serverName}/${toolName}`, args);
        
        const result = await this.sendRequest(serverName, 'tools/call', {
            name: toolName,
            arguments: args
        });

        return result;
    }

    /**
     * Read a resource from MCP server
     */
    async readResource(serverName, uri) {
        return this.sendRequest(serverName, 'resources/read', { uri });
    }

    /**
     * Get available tools from a server
     */
    getTools(serverName) {
        const connection = this.connections.get(serverName);
        return connection ? connection.tools : [];
    }

    /**
     * Get all connected servers
     */
    getConnectedServers() {
        const servers = [];
        for (const [name, connection] of this.connections) {
            servers.push({
                name,
                status: connection.status,
                tools: connection.tools.length
            });
        }
        return servers;
    }

    /**
     * Check if a server is connected
     */
    isConnected(serverName) {
        const connection = this.connections.get(serverName);
        return connection && connection.status === 'connected';
    }

    /**
     * Disconnect from a server
     */
    async disconnectServer(serverName) {
        const connection = this.connections.get(serverName);
        if (connection) {
            connection.process.kill();
            this.connections.delete(serverName);
            this.emit('serverDisconnected', { server: serverName });
            console.log(`[McpConnection] Disconnected from ${serverName}`);
        }
    }

    /**
     * Disconnect from all servers
     */
    async disconnectAll() {
        for (const serverName of this.connections.keys()) {
            await this.disconnectServer(serverName);
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            connectedServers: this.getConnectedServers(),
            configPath: this.configPath
        };
    }
}

module.exports = new McpConnectionManager();
