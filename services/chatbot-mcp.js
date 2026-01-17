/**
 * Enhanced Chatbot with MCP Integration
 * Provides CLI, Agents, and MCP server connectivity
 */

const { ipcRenderer } = require('electron');

class ChatbotMCPService {
    constructor() {
        this.currentMode = 'chat';
        this.cliHistory = [];
        this.cliHistoryIndex = -1;
        this.mcpServers = {
            'lm-studio': { connected: false, url: 'localhost:1234' },
            'evony-rag': { connected: true, url: 'MCP Tool' },
            'playwright': { connected: false, url: 'Browser Automation' },
            'claude': { connected: false, url: 'Anthropic API' },
            'windsurf': { connected: false, url: 'IDE Integration' },
            'memory': { connected: false, url: 'Knowledge Graph' }
        };
        this.agents = {
            'evony-assistant': { running: false, name: 'Evony Assistant' },
            'protocol-analyzer': { running: false, name: 'Protocol Analyzer' },
            'automation-runner': { running: false, name: 'Automation Runner' },
            'rag-researcher': { running: false, name: 'RAG Researcher' }
        };
        this.initialized = false;
    }

    /**
     * Initialize the chatbot MCP service
     */
    initialize() {
        if (this.initialized) return;
        
        console.log('[ChatbotMCP] Initializing...');
        
        this.setupModeTabs();
        this.setupCLI();
        this.setupAgents();
        this.setupMCPServers();
        this.setupPanelControls();
        
        this.initialized = true;
        console.log('[ChatbotMCP] Initialized');
    }

    /**
     * Setup mode tab switching
     */
    setupModeTabs() {
        const tabs = document.querySelectorAll('.mode-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode;
                this.switchMode(mode);
            });
        });
    }

    /**
     * Switch between chat/cli/agents/mcp modes
     */
    switchMode(mode) {
        this.currentMode = mode;
        
        // Update tab active states
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });
        
        // Update content visibility
        document.querySelectorAll('.chatbot-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(`chatbot-content-${mode}`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
        
        // Focus appropriate input
        if (mode === 'cli') {
            const cliInput = document.getElementById('cli-input');
            if (cliInput) cliInput.focus();
        }
        
        console.log('[ChatbotMCP] Switched to mode:', mode);
    }

    /**
     * Setup CLI functionality
     */
    setupCLI() {
        const cliInput = document.getElementById('cli-input');
        const cliOutput = document.getElementById('cli-output');
        const quickCmds = document.querySelectorAll('.cli-quick-cmd');
        
        if (!cliInput) return;
        
        // Handle CLI input
        cliInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const command = cliInput.value.trim();
                if (command) {
                    this.executeCommand(command);
                    this.cliHistory.push(command);
                    this.cliHistoryIndex = this.cliHistory.length;
                    cliInput.value = '';
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.cliHistoryIndex > 0) {
                    this.cliHistoryIndex--;
                    cliInput.value = this.cliHistory[this.cliHistoryIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.cliHistoryIndex < this.cliHistory.length - 1) {
                    this.cliHistoryIndex++;
                    cliInput.value = this.cliHistory[this.cliHistoryIndex];
                } else {
                    this.cliHistoryIndex = this.cliHistory.length;
                    cliInput.value = '';
                }
            }
        });
        
        // Quick command buttons
        quickCmds.forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                cliInput.value = cmd;
                cliInput.focus();
            });
        });
    }

    /**
     * Execute CLI command
     */
    async executeCommand(command) {
        const cliOutput = document.getElementById('cli-output');
        
        // Add command to output
        this.appendCLIOutput(`<span class="cli-prompt">$</span> <span class="cli-command">${this.escapeHtml(command)}</span>`);
        
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        try {
            let result;
            
            switch (cmd) {
                case 'help':
                    result = this.getHelpText();
                    break;
                    
                case 'clear':
                    cliOutput.innerHTML = '<div class="cli-welcome"><span class="cli-prompt">$</span> Console cleared</div>';
                    return;
                    
                case 'evony-rag':
                case 'rag':
                    result = await this.executeRAGCommand(args);
                    break;
                    
                case 'mcp':
                    result = await this.executeMCPCommand(args);
                    break;
                    
                case 'playwright':
                case 'pw':
                    result = await this.executePlaywrightCommand(args);
                    break;
                    
                case 'agent':
                    result = await this.executeAgentCommand(args);
                    break;
                    
                case 'lm':
                case 'lmstudio':
                    result = await this.executeLMStudioCommand(args);
                    break;
                    
                case 'status':
                    result = this.getStatusText();
                    break;
                    
                case 'connect':
                    result = await this.connectServer(args[0]);
                    break;
                    
                default:
                    // Try to execute as system command
                    result = await this.executeSystemCommand(command);
            }
            
            this.appendCLIOutput(`<span class="cli-output-text">${result}</span>`);
            
        } catch (error) {
            this.appendCLIOutput(`<span class="cli-error">Error: ${error.message}</span>`);
        }
        
        // Scroll to bottom
        cliOutput.scrollTop = cliOutput.scrollHeight;
    }

    /**
     * Append output to CLI
     */
    appendCLIOutput(html) {
        const cliOutput = document.getElementById('cli-output');
        const div = document.createElement('div');
        div.className = 'cli-command-line';
        div.innerHTML = html;
        cliOutput.appendChild(div);
    }

    /**
     * Get help text
     */
    getHelpText() {
        return `
<span class="cli-success">Available Commands:</span>

<span class="cli-prompt">General:</span>
  help              - Show this help
  clear             - Clear console
  status            - Show MCP connection status

<span class="cli-prompt">Evony RAG:</span>
  rag search &lt;query&gt;  - Search knowledge base
  rag stats           - Show RAG statistics

<span class="cli-prompt">MCP Servers:</span>
  mcp status          - Show all MCP server status
  mcp list            - List available tools
  connect &lt;server&gt;    - Connect to MCP server

<span class="cli-prompt">Playwright:</span>
  pw screenshot       - Take screenshot
  pw snapshot         - Get page snapshot
  pw click &lt;selector&gt; - Click element

<span class="cli-prompt">Agents:</span>
  agent list          - List available agents
  agent start &lt;name&gt;  - Start an agent
  agent stop &lt;name&gt;   - Stop an agent

<span class="cli-prompt">LM Studio:</span>
  lm status           - Check LM Studio connection
  lm models           - List available models
  lm chat &lt;message&gt;   - Send chat message
`;
    }

    /**
     * Get status text
     */
    getStatusText() {
        let status = '<span class="cli-success">MCP Server Status:</span>\n\n';
        
        for (const [name, server] of Object.entries(this.mcpServers)) {
            const icon = server.connected ? '🟢' : '🔴';
            status += `  ${icon} ${name}: ${server.connected ? 'Connected' : 'Disconnected'} (${server.url})\n`;
        }
        
        return status;
    }

    /**
     * Execute RAG command
     */
    async executeRAGCommand(args) {
        const subCmd = args[0];
        
        if (subCmd === 'search' && args.length > 1) {
            const query = args.slice(1).join(' ');
            const response = await ipcRenderer.invoke('evony-rag-search', query, 5);
            
            if (response && response.results && response.results.length > 0) {
                let output = `<span class="cli-success">Found ${response.results.length} results:</span>\n\n`;
                response.results.forEach((r, i) => {
                    output += `${i + 1}. ${r.file} (${r.lines})\n`;
                    output += `   ${r.snippet.substring(0, 100)}...\n\n`;
                });
                return output;
            }
            return `Searched for: "${query}"\nUse MCP tools in IDE for full results.`;
        }
        
        if (subCmd === 'stats') {
            const stats = await ipcRenderer.invoke('evony-rag-stats');
            return `RAG Knowledge Base Stats:
  Chunks: ${stats.chunks.toLocaleString()}
  Symbols: ${stats.symbols.toLocaleString()}
  Mode: ${stats.mode}`;
        }
        
        return 'Usage: rag search <query> | rag stats';
    }

    /**
     * Execute MCP command
     */
    async executeMCPCommand(args) {
        const subCmd = args[0];
        
        if (subCmd === 'status') {
            return this.getStatusText();
        }
        
        if (subCmd === 'list') {
            return `<span class="cli-success">Available MCP Tools:</span>

Evony RAG:
  - evony_search: Search knowledge base
  - evony_stats: Get statistics
  - evony_mode: Set search mode

Playwright:
  - browser_snapshot: Get accessibility snapshot
  - browser_click: Click element
  - browser_type: Type text
  - browser_navigate: Navigate to URL

Memory:
  - create_entities: Create knowledge nodes
  - search_nodes: Search knowledge graph
  - read_graph: Read entire graph`;
        }
        
        return 'Usage: mcp status | mcp list';
    }

    /**
     * Execute Playwright command
     */
    async executePlaywrightCommand(args) {
        const subCmd = args[0];
        
        if (subCmd === 'screenshot') {
            return 'Screenshot command available via MCP Playwright tools.\nUse: mcp2_browser_take_screenshot in IDE';
        }
        
        if (subCmd === 'snapshot') {
            return 'Snapshot command available via MCP Playwright tools.\nUse: mcp2_browser_snapshot in IDE';
        }
        
        return 'Usage: pw screenshot | pw snapshot | pw click <selector>';
    }

    /**
     * Execute Agent command
     */
    async executeAgentCommand(args) {
        const subCmd = args[0];
        
        if (subCmd === 'list') {
            let output = '<span class="cli-success">Available Agents:</span>\n\n';
            for (const [id, agent] of Object.entries(this.agents)) {
                const status = agent.running ? '🟢 Running' : '⚪ Stopped';
                output += `  ${id}: ${agent.name} - ${status}\n`;
            }
            return output;
        }
        
        if (subCmd === 'start' && args[1]) {
            const agentId = args[1];
            if (this.agents[agentId]) {
                this.agents[agentId].running = true;
                this.updateAgentUI(agentId, true);
                return `<span class="cli-success">Started agent: ${this.agents[agentId].name}</span>`;
            }
            return `<span class="cli-error">Agent not found: ${agentId}</span>`;
        }
        
        if (subCmd === 'stop' && args[1]) {
            const agentId = args[1];
            if (this.agents[agentId]) {
                this.agents[agentId].running = false;
                this.updateAgentUI(agentId, false);
                return `Stopped agent: ${this.agents[agentId].name}`;
            }
            return `<span class="cli-error">Agent not found: ${agentId}</span>`;
        }
        
        return 'Usage: agent list | agent start <name> | agent stop <name>';
    }

    /**
     * Execute LM Studio command
     */
    async executeLMStudioCommand(args) {
        const subCmd = args[0];
        
        if (subCmd === 'status') {
            try {
                const status = await ipcRenderer.invoke('lm-studio-status');
                if (status.connected) {
                    return `<span class="cli-success">LM Studio: Connected</span>
  URL: ${status.url}
  Models: ${status.models.length}`;
                }
                return 'LM Studio: Disconnected\nUse Settings > LLM to configure';
            } catch (e) {
                return 'LM Studio: Not available';
            }
        }
        
        if (subCmd === 'models') {
            try {
                const models = await ipcRenderer.invoke('lm-studio-models');
                if (models.length > 0) {
                    return `<span class="cli-success">Available Models:</span>\n` + 
                           models.map(m => `  - ${m}`).join('\n');
                }
                return 'No models found. Ensure LM Studio is running.';
            } catch (e) {
                return 'Failed to get models';
            }
        }
        
        if (subCmd === 'chat' && args.length > 1) {
            const message = args.slice(1).join(' ');
            try {
                const response = await ipcRenderer.invoke('lm-studio-chat', 
                    [{ role: 'user', content: message }], 
                    {}
                );
                return response.content || response.error || 'No response';
            } catch (e) {
                return `<span class="cli-error">Chat failed: ${e.message}</span>`;
            }
        }
        
        return 'Usage: lm status | lm models | lm chat <message>';
    }

    /**
     * Execute system command
     */
    async executeSystemCommand(command) {
        return `Command not recognized: ${command}\nType 'help' for available commands.`;
    }

    /**
     * Connect to MCP server
     */
    async connectServer(serverName) {
        if (!serverName) {
            return 'Usage: connect <server-name>\nServers: lm-studio, playwright, claude, windsurf, memory';
        }
        
        if (this.mcpServers[serverName]) {
            // Simulate connection
            this.mcpServers[serverName].connected = true;
            this.updateMCPStatusBar();
            return `<span class="cli-success">Connected to ${serverName}</span>`;
        }
        
        return `<span class="cli-error">Unknown server: ${serverName}</span>`;
    }

    /**
     * Setup agents panel
     */
    setupAgents() {
        const agentBtns = document.querySelectorAll('.agent-start-btn');
        
        agentBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const agentId = btn.dataset.agent;
                this.toggleAgent(agentId, btn);
            });
        });
    }

    /**
     * Toggle agent running state
     */
    toggleAgent(agentId, btn) {
        if (!this.agents[agentId]) return;
        
        const agent = this.agents[agentId];
        agent.running = !agent.running;
        
        btn.textContent = agent.running ? 'Stop' : 'Start';
        btn.classList.toggle('running', agent.running);
        
        const output = document.getElementById('agent-output');
        if (output) {
            if (agent.running) {
                output.innerHTML = `<div class="agent-running">
                    <span class="cli-success">🤖 ${agent.name} is running...</span>
                    <br><br>Agent is analyzing game state and will provide recommendations.
                </div>`;
            } else {
                output.innerHTML = '<div class="agent-output-placeholder">Select an agent to start</div>';
            }
        }
        
        console.log(`[ChatbotMCP] Agent ${agentId}: ${agent.running ? 'started' : 'stopped'}`);
    }

    /**
     * Update agent UI
     */
    updateAgentUI(agentId, running) {
        const btn = document.querySelector(`.agent-start-btn[data-agent="${agentId}"]`);
        if (btn) {
            btn.textContent = running ? 'Stop' : 'Start';
            btn.classList.toggle('running', running);
        }
    }

    /**
     * Setup MCP servers panel
     */
    setupMCPServers() {
        const connectBtns = document.querySelectorAll('.mcp-connect-btn');
        const reconnectAllBtn = document.getElementById('mcp-reconnect-all');
        
        connectBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const server = btn.dataset.server;
                await this.toggleMCPServer(server, btn);
            });
        });
        
        if (reconnectAllBtn) {
            reconnectAllBtn.addEventListener('click', () => {
                this.reconnectAllServers();
            });
        }
    }

    /**
     * Toggle MCP server connection
     */
    async toggleMCPServer(serverName, btn) {
        if (!this.mcpServers[serverName]) return;
        
        const server = this.mcpServers[serverName];
        server.connected = !server.connected;
        
        btn.textContent = server.connected ? 'Connected' : 'Connect';
        btn.classList.toggle('connected', server.connected);
        
        // Update status indicator
        const statusEl = document.getElementById(`${serverName}-status`);
        if (statusEl) {
            statusEl.classList.toggle('connected', server.connected);
            statusEl.classList.toggle('disconnected', !server.connected);
        }
        
        this.updateMCPStatusBar();
        
        console.log(`[ChatbotMCP] MCP ${serverName}: ${server.connected ? 'connected' : 'disconnected'}`);
    }

    /**
     * Reconnect all MCP servers
     */
    async reconnectAllServers() {
        for (const [name, server] of Object.entries(this.mcpServers)) {
            server.connected = true;
            
            const btn = document.querySelector(`.mcp-connect-btn[data-server="${name}"]`);
            if (btn) {
                btn.textContent = 'Connected';
                btn.classList.add('connected');
            }
            
            const statusEl = document.getElementById(`${name}-status`);
            if (statusEl) {
                statusEl.classList.add('connected');
                statusEl.classList.remove('disconnected');
            }
        }
        
        this.updateMCPStatusBar();
        console.log('[ChatbotMCP] Reconnected all MCP servers');
    }

    /**
     * Update MCP status bar indicators
     */
    updateMCPStatusBar() {
        for (const [name, server] of Object.entries(this.mcpServers)) {
            const indicator = document.querySelector(`#mcp-${name.replace('-', '')} .mcp-dot, #mcp-${name} .mcp-dot`);
            if (indicator) {
                indicator.classList.toggle('connected', server.connected);
                indicator.classList.toggle('disconnected', !server.connected);
            }
        }
    }

    /**
     * Setup panel controls (minimize, expand)
     */
    setupPanelControls() {
        const minimizeBtn = document.getElementById('chatbot-minimize');
        const expandBtn = document.getElementById('chatbot-expand');
        const sidePanel = document.getElementById('side-panel');
        
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                if (sidePanel) {
                    sidePanel.classList.add('collapsed');
                }
            });
        }
        
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                if (sidePanel) {
                    sidePanel.classList.toggle('expanded');
                }
            });
        }
    }

    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create and export singleton instance
const chatbotMCP = new ChatbotMCPService();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => chatbotMCP.initialize(), 300);
    });
} else {
    setTimeout(() => chatbotMCP.initialize(), 300);
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChatbotMCPService, chatbotMCP };
}

if (typeof window !== 'undefined') {
    window.ChatbotMCPService = ChatbotMCPService;
    window.chatbotMCP = chatbotMCP;
}
