/**
 * Chatbot Service
 * Evony Co-Pilot with full MCP integration, LM Studio support, and Playwright scraping
 */

const { EventEmitter } = require('events');
const path = require('path');

// Lazy-loaded dependencies
let IntentRouter = null;
let MCPClientManager = null;
let PlaywrightService = null;

class ChatbotService extends EventEmitter {
    constructor() {
        super();
        this.lmStudioClient = null;
        this.mcpManager = null;
        this.intentRouter = null;
        this.playwrightService = null;
        this.protocolHandler = null;
        this.gameState = null;
        this.isInitialized = false;
        this.isProcessing = false;
        this.conversationHistory = [];
        this.maxHistoryLength = 50;
        this.currentContext = {};
        
        // Quick actions configuration
        this.quickActions = [
            { 
                id: 'protocol', 
                label: 'Protocol Lookup', 
                icon: '📡',
                description: 'Search Evony protocol commands',
                command: '/protocol'
            },
            { 
                id: 'training', 
                label: 'Training Calculator', 
                icon: '🔢',
                description: 'Calculate troop training costs',
                command: '/training'
            },
            { 
                id: 'combat', 
                label: 'Combat Simulator', 
                icon: '⚔️',
                description: 'Simulate battle outcomes',
                command: '/combat'
            },
            { 
                id: 'march', 
                label: 'March Time', 
                icon: '🏃',
                description: 'Calculate march times',
                command: '/march'
            },
            { 
                id: 'decode', 
                label: 'Decode Packet', 
                icon: '🔓',
                description: 'Decode AMF packet data',
                command: '/decode'
            },
            { 
                id: 'search', 
                label: 'Knowledge Search', 
                icon: '📚',
                description: 'Search game knowledge',
                command: '/search'
            },
            { 
                id: 'scrape', 
                label: 'Web Scrape', 
                icon: '🌐',
                description: 'Scrape web for info',
                command: '/scrape'
            },
            { 
                id: 'status', 
                label: 'Status', 
                icon: '📊',
                description: 'Show service status',
                command: '/status'
            }
        ];
        
        // Command handlers
        this.commandHandlers = {
            '/training': this.handleTrainingCalc.bind(this),
            '/march': this.handleMarchCalc.bind(this),
            '/combat': this.handleCombatSim.bind(this),
            '/protocol': this.handleProtocolLookup.bind(this),
            '/decode': this.handleDecodePacket.bind(this),
            '/search': this.handleKnowledgeSearch.bind(this),
            '/scrape': this.handleWebScrape.bind(this),
            '/help': this.handleHelp.bind(this),
            '/clear': this.handleClear.bind(this),
            '/status': this.handleStatus.bind(this)
        };
    }
    
    /**
     * Initialize the chatbot with all services
     */
    async initialize(lmStudioClient, appPath) {
        this.lmStudioClient = lmStudioClient;
        
        // Load protocol handler
        try {
            this.protocolHandler = require('./protocol-handler');
        } catch (e) {
            console.warn('[ChatbotService] Protocol handler not available');
        }
        
        // Initialize MCP Manager
        try {
            const { getMCPClientManager } = require('./mcp-client-manager');
            this.mcpManager = getMCPClientManager();
            await this.mcpManager.initialize(appPath);
            console.log('[ChatbotService] MCP servers initialized');
        } catch (error) {
            console.warn('[ChatbotService] MCP initialization failed:', error.message);
        }
        
        // Initialize Intent Router
        try {
            const { IntentRouter: IR } = require('./intent-router');
            this.intentRouter = new IR(this.mcpManager, this.lmStudioClient);
            
            this.intentRouter.on('intent-classified', (classification) => {
                this.emit('intent', classification);
            });
        } catch (error) {
            console.warn('[ChatbotService] Intent router not available:', error.message);
        }
        
        // Playwright is lazy-loaded when needed
        
        this.isInitialized = true;
        this.emit('initialized');
        
        return true;
    }
    
    /**
     * Set LM Studio client (for dynamic connection)
     */
    setLMStudioClient(client) {
        this.lmStudioClient = client;
        if (this.intentRouter) {
            this.intentRouter.lmStudioClient = client;
        }
    }
    
    /**
     * Set game state for context-aware responses
     */
    setGameState(state) {
        this.gameState = state;
        this.currentContext.gameState = state;
        if (this.intentRouter) {
            this.intentRouter.setGameContext(state);
        }
    }
    
    /**
     * Process user message
     */
    async processMessage(userMessage, context = {}) {
        if (!userMessage || typeof userMessage !== 'string') {
            return { 
                id: Date.now(),
                role: 'assistant',
                content: 'Please enter a message.',
                type: 'error' 
            };
        }
        
        if (this.isProcessing) {
            return { 
                id: Date.now(),
                role: 'assistant',
                content: 'Already processing a message. Please wait.',
                type: 'error' 
            };
        }
        
        this.isProcessing = true;
        this.emit('processingStarted');
        
        const trimmedMessage = userMessage.trim();
        
        // Add user message to history
        const userEntry = {
            id: Date.now(),
            role: 'user',
            content: trimmedMessage,
            timestamp: Date.now(),
            context: { ...this.currentContext, ...context }
        };
        this.conversationHistory.push(userEntry);
        this.emit('messageAdded', userEntry);
        
        try {
            let result;
            
            // Check for quick actions (commands starting with /)
            if (trimmedMessage.startsWith('/')) {
                const [command, ...args] = trimmedMessage.split(' ');
                const handler = this.commandHandlers[command.toLowerCase()];
                
                if (handler) {
                    result = await handler(args.join(' '));
                } else {
                    result = {
                        content: `Unknown command: ${command}. Type /help for available commands.`,
                        type: 'error'
                    };
                }
            } else if (this.intentRouter) {
                // Route through intent router for intelligent response
                const routeResult = await this.intentRouter.route(trimmedMessage);
                result = {
                    content: routeResult.response,
                    type: 'success',
                    intent: routeResult.intent,
                    mcpResults: routeResult.mcpResults,
                    confidence: routeResult.confidence
                };
            } else {
                // Fallback if intent router not available
                result = await this.handleGeneralQuery(trimmedMessage);
            }
            
            // Add assistant response to history
            const assistantEntry = {
                id: Date.now(),
                role: 'assistant',
                content: result.content || result.response || result,
                timestamp: Date.now(),
                type: result.type || 'success',
                intent: result.intent,
                data: result.data
            };
            this.conversationHistory.push(assistantEntry);
            this.emit('messageAdded', assistantEntry);
            
            // Trim history if too long
            this.trimHistory();
            
            return assistantEntry;
            
        } catch (error) {
            console.error('[ChatbotService] Error processing message:', error);
            
            const errorEntry = {
                id: Date.now(),
                role: 'assistant',
                content: `Error: ${error.message}`,
                timestamp: Date.now(),
                type: 'error'
            };
            this.conversationHistory.push(errorEntry);
            this.emit('messageAdded', errorEntry);
            
            return errorEntry;
            
        } finally {
            this.isProcessing = false;
            this.emit('processingFinished');
        }
    }
    
    /**
     * Handle training calculation command
     */
    async handleTrainingCalc(args) {
        const parts = args.split(' ');
        const quantity = parseInt(parts[0]) || 1000;
        const troopType = parts[1] || 'cavalry';
        
        // Try MCP first
        if (this.mcpManager && this.mcpManager.isInitialized) {
            try {
                const result = await this.mcpManager.calcTraining(troopType, quantity);
                return {
                    content: this.formatTrainingResult(result),
                    type: 'calculation',
                    data: result
                };
            } catch (error) {
                console.warn('[ChatbotService] MCP training calc failed:', error.message);
            }
        }
        
        // Fallback to local calculation
        const troopCosts = {
            worker: { food: 50, lumber: 0, stone: 0, iron: 0, time: 15, tier: 1 },
            warrior: { food: 100, lumber: 0, stone: 0, iron: 20, time: 30, tier: 1 },
            scout: { food: 50, lumber: 0, stone: 0, iron: 0, time: 20, tier: 1 },
            pikeman: { food: 150, lumber: 0, stone: 0, iron: 50, time: 60, tier: 2 },
            swordsman: { food: 200, lumber: 50, stone: 0, iron: 100, time: 90, tier: 2 },
            archer: { food: 150, lumber: 100, stone: 0, iron: 50, time: 75, tier: 2 },
            cavalry: { food: 300, lumber: 0, stone: 0, iron: 150, time: 120, tier: 3 },
            cataphract: { food: 500, lumber: 0, stone: 0, iron: 300, time: 180, tier: 3 },
            ballista: { food: 500, lumber: 500, stone: 0, iron: 200, time: 300, tier: 4 },
            ram: { food: 600, lumber: 600, stone: 0, iron: 300, time: 360, tier: 4 },
            catapult: { food: 800, lumber: 800, stone: 0, iron: 400, time: 450, tier: 4 }
        };
        
        const type = troopType.toLowerCase();
        if (!troopCosts[type]) {
            return {
                content: `Unknown troop type: ${troopType}\n\nAvailable: ${Object.keys(troopCosts).join(', ')}\n\nUsage: /training <quantity> <troop_type>\nExample: /training 10000 cavalry`,
                type: 'error'
            };
        }
        
        const cost = troopCosts[type];
        const totalTime = cost.time * quantity;
        const hours = Math.floor(totalTime / 3600);
        const minutes = Math.floor((totalTime % 3600) / 60);
        
        const result = {
            troopType: type,
            tier: cost.tier,
            quantity,
            formattedTime: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
            resources: {
                food: cost.food * quantity,
                lumber: cost.lumber * quantity,
                stone: cost.stone * quantity,
                iron: cost.iron * quantity
            }
        };
        
        return {
            content: this.formatTrainingResult(result),
            type: 'calculation',
            data: result
        };
    }
    
    /**
     * Handle march calculation command
     */
    async handleMarchCalc(args) {
        const coords = args.match(/(\d+)/g);
        
        if (!coords || coords.length < 4) {
            return {
                content: 'Usage: /march <fromX> <fromY> <toX> <toY>\nExample: /march 100 200 300 400',
                type: 'error'
            };
        }
        
        const fromX = parseInt(coords[0]);
        const fromY = parseInt(coords[1]);
        const toX = parseInt(coords[2]);
        const toY = parseInt(coords[3]);
        
        // Try MCP first
        if (this.mcpManager && this.mcpManager.isInitialized) {
            try {
                const result = await this.mcpManager.calcMarch(fromX, fromY, toX, toY, { cavalry: 1000 });
                return {
                    content: this.formatMarchResult(result),
                    type: 'calculation',
                    data: result
                };
            } catch (error) {
                console.warn('[ChatbotService] MCP march calc failed:', error.message);
            }
        }
        
        // Fallback calculation
        const distance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
        const baseSpeed = 200; // tiles per hour for cavalry
        const timeHours = distance / baseSpeed;
        const hours = Math.floor(timeHours);
        const minutes = Math.floor((timeHours - hours) * 60);
        
        const result = {
            from: { x: fromX, y: fromY },
            to: { x: toX, y: toY },
            distance: Math.round(distance * 100) / 100,
            formattedTime: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
            slowestTroop: 'cavalry'
        };
        
        return {
            content: this.formatMarchResult(result),
            type: 'calculation',
            data: result
        };
    }
    
    /**
     * Handle combat simulation command
     */
    async handleCombatSim(args) {
        const [attackerStr, defenderStr] = args.split(/\s+vs\s+/i);
        
        if (!attackerStr || !defenderStr) {
            return {
                content: 'Usage: /combat <attacker_troops> vs <defender_troops>\nExample: /combat 10000 cavalry vs 8000 archer',
                type: 'error'
            };
        }
        
        const parseArmy = (str) => {
            const match = str.match(/(\d+)\s+(\w+)/);
            if (match) {
                return { [match[2].toLowerCase()]: parseInt(match[1]) };
            }
            return { cavalry: 1000 };
        };
        
        // Try MCP first
        if (this.mcpManager && this.mcpManager.isInitialized) {
            try {
                const result = await this.mcpManager.calcCombat(
                    { troops: parseArmy(attackerStr) },
                    { troops: parseArmy(defenderStr) }
                );
                return {
                    content: this.formatCombatResult(result),
                    type: 'combat',
                    data: result
                };
            } catch (error) {
                console.warn('[ChatbotService] MCP combat calc failed:', error.message);
            }
        }
        
        // Fallback simulation
        try {
            const combatSimulator = require('./combat-simulator');
            const result = combatSimulator.simulate(
                parseArmy(attackerStr),
                parseArmy(defenderStr)
            );
            return {
                content: this.formatCombatResult(result),
                type: 'combat',
                data: result
            };
        } catch (error) {
            return {
                content: `Combat simulation failed: ${error.message}`,
                type: 'error'
            };
        }
    }
    
    /**
     * Handle protocol lookup command
     */
    async handleProtocolLookup(args) {
        if (!args) {
            return {
                content: 'Usage: /protocol <action_name or command_id>\nExample: /protocol city.getInfo\nExample: /protocol 2001',
                type: 'error'
            };
        }
        
        // Try MCP first
        if (this.mcpManager && this.mcpManager.isInitialized) {
            try {
                const result = await this.mcpManager.lookupProtocol(args);
                if (result.found) {
                    return {
                        content: this.formatProtocolResult(result.action),
                        type: 'protocol',
                        data: result.action
                    };
                }
            } catch (error) {
                console.warn('[ChatbotService] MCP protocol lookup failed:', error.message);
            }
        }
        
        // Fallback to local protocol handler
        if (this.protocolHandler) {
            const action = this.protocolHandler.lookupAction(args);
            if (action) {
                return {
                    content: this.formatProtocolResult(action),
                    type: 'protocol',
                    data: action
                };
            }
            
            const results = this.protocolHandler.searchActions(args);
            if (results.length > 0) {
                return {
                    content: this.formatProtocolSearchResults(results),
                    type: 'protocol',
                    data: results
                };
            }
        }
        
        return {
            content: `Protocol "${args}" not found. Try a different search term.`,
            type: 'error'
        };
    }
    
    /**
     * Handle packet decode command
     */
    async handleDecodePacket(args) {
        const hexData = args.replace(/\s/g, '');
        
        if (!hexData || hexData.length < 8) {
            return {
                content: 'Usage: /decode <hex_data>\nExample: /decode 00030000000100',
                type: 'error'
            };
        }
        
        // Try MCP first
        if (this.mcpManager && this.mcpManager.isInitialized) {
            try {
                const result = await this.mcpManager.decodePacket(hexData);
                return {
                    content: this.formatDecodeResult(result),
                    type: 'decode',
                    data: result
                };
            } catch (error) {
                console.warn('[ChatbotService] MCP decode failed:', error.message);
            }
        }
        
        // Fallback to local decoder
        try {
            const { AMF3Decoder } = require('./amf3-decoder');
            const decoder = new AMF3Decoder();
            const result = decoder.decodePacket(hexData);
            return {
                content: this.formatDecodeResult(result),
                type: 'decode',
                data: result
            };
        } catch (error) {
            return {
                content: `Decode failed: ${error.message}`,
                type: 'error'
            };
        }
    }
    
    /**
     * Handle knowledge search command
     */
    async handleKnowledgeSearch(args) {
        if (!args) {
            return {
                content: 'Usage: /search <query>\nExample: /search cavalry training',
                type: 'error'
            };
        }
        
        // Try MCP first
        if (this.mcpManager && this.mcpManager.isInitialized) {
            try {
                const result = await this.mcpManager.searchKnowledge(args, 5);
                if (result.results && result.results.length > 0) {
                    return {
                        content: this.formatSearchResults(result.results),
                        type: 'search',
                        data: result.results
                    };
                }
            } catch (error) {
                console.warn('[ChatbotService] MCP search failed:', error.message);
            }
        }
        
        return {
            content: `No results found for "${args}". Try different keywords.`,
            type: 'info'
        };
    }
    
    /**
     * Handle web scrape command
     */
    async handleWebScrape(args) {
        if (!args) {
            return {
                content: 'Usage: /scrape <topic>\nExample: /scrape cavalry guide',
                type: 'error'
            };
        }
        
        try {
            // Lazy load Playwright
            const { getPlaywrightService } = require('./playwright-service');
            this.playwrightService = getPlaywrightService();
            
            if (!this.playwrightService.isInitialized) {
                await this.playwrightService.initialize({ headless: true });
            }
            
            const results = await this.playwrightService.scrapeEvonyWiki(args);
            
            if (results.length > 0) {
                let content = `**Web Search Results for "${args}"**:\n\n`;
                for (const result of results) {
                    content += `**Source**: ${result.source}\n`;
                    content += `**Title**: ${result.title}\n`;
                    content += `${result.content.substring(0, 500)}...\n\n`;
                }
                return {
                    content,
                    type: 'scrape',
                    data: results
                };
            } else {
                return {
                    content: `No web results found for "${args}".`,
                    type: 'info'
                };
            }
        } catch (error) {
            return {
                content: `Web scrape failed: ${error.message}. Playwright may not be installed.\n\nInstall with: npm install playwright`,
                type: 'error'
            };
        }
    }
    
    /**
     * Handle help command
     */
    async handleHelp() {
        const helpText = `**Evony Co-Pilot Commands**

**Calculations:**
• \`/training <qty> <troop>\` - Calculate training time/resources
• \`/march <x1> <y1> <x2> <y2>\` - Calculate march time
• \`/combat <troops> vs <troops>\` - Simulate combat

**Protocol Analysis:**
• \`/protocol <name|id>\` - Look up protocol action
• \`/decode <hex>\` - Decode AMF packet

**Knowledge:**
• \`/search <query>\` - Search knowledge base
• \`/scrape <topic>\` - Scrape web for info

**System:**
• \`/status\` - Show service status
• \`/clear\` - Clear conversation
• \`/help\` - Show this help

**Natural Language:**
Just type your question naturally! Examples:
• "How do I train cavalry?"
• "What's the protocol for city.getInfo?"
• "Calculate training 10000 archers"`;

        return {
            content: helpText,
            type: 'help'
        };
    }
    
    /**
     * Handle clear command
     */
    async handleClear() {
        this.conversationHistory = [];
        if (this.intentRouter) {
            this.intentRouter.clearHistory();
        }
        this.emit('historyCleared');
        
        return {
            content: 'Conversation cleared.',
            type: 'info'
        };
    }
    
    /**
     * Handle status command
     */
    async handleStatus() {
        const status = {
            chatbot: this.isInitialized,
            lmStudio: this.lmStudioClient?.isConnected?.() || false,
            mcp: this.mcpManager?.getStatus?.() || { initialized: false },
            playwright: this.playwrightService?.getStatus?.() || { initialized: false },
            gameState: !!this.gameState
        };
        
        let content = '**Service Status**\n\n';
        content += `• Chatbot: ${status.chatbot ? '✅ Ready' : '❌ Not initialized'}\n`;
        content += `• LM Studio: ${status.lmStudio ? '✅ Connected' : '❌ Disconnected'}\n`;
        content += `• MCP Manager: ${status.mcp.initialized ? '✅ Initialized' : '❌ Not initialized'}\n`;
        
        if (status.mcp.servers) {
            for (const [name, serverStatus] of Object.entries(status.mcp.servers)) {
                content += `  - ${name}: ${serverStatus.connected ? '✅' : '❌'} (${serverStatus.tools} tools)\n`;
            }
        }
        
        content += `• Playwright: ${status.playwright.initialized ? '✅ Ready' : '⚪ Not started'}\n`;
        content += `• Game State: ${status.gameState ? '✅ Available' : '⚪ Not set'}\n`;
        
        return {
            content,
            type: 'status',
            data: status
        };
    }
    
    /**
     * Handle general query (fallback)
     */
    async handleGeneralQuery(message) {
        // Try LM Studio if connected
        if (this.lmStudioClient && this.lmStudioClient.isConnected()) {
            try {
                const systemPrompt = `You are the Evony Co-Pilot, an AI assistant for the Evony game analysis suite. 
You help players with game strategies, troop training, combat calculations, protocol analysis, and more.
Be concise and helpful.`;

                const response = await this.lmStudioClient.chat([
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ]);
                
                return {
                    content: response,
                    type: 'ai'
                };
            } catch (error) {
                console.warn('[ChatbotService] LM Studio query failed:', error.message);
            }
        }
        
        // Fallback responses
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
            return {
                content: "Hello! I'm the Evony Co-Pilot. How can I help you today? Type /help for available commands.",
                type: 'greeting'
            };
        }
        
        if (lowerMessage.includes('thank')) {
            return {
                content: "You're welcome! Let me know if you need anything else.",
                type: 'acknowledgment'
            };
        }
        
        return {
            content: "I'm here to help with Evony game analysis. Try asking about training, combat, protocols, or type /help for commands.\n\nConnect to LM Studio for AI-powered responses!",
            type: 'fallback'
        };
    }
    
    // Formatting helpers
    formatTrainingResult(result) {
        return `**Training Calculation**

**Troop**: ${result.troopType} (Tier ${result.tier})
**Quantity**: ${result.quantity?.toLocaleString() || 0}
**Time**: ${result.formattedTime}

**Resources Required**:
• Food: ${result.resources?.food?.toLocaleString() || 0}
• Lumber: ${result.resources?.lumber?.toLocaleString() || 0}
• Stone: ${result.resources?.stone?.toLocaleString() || 0}
• Iron: ${result.resources?.iron?.toLocaleString() || 0}`;
    }
    
    formatMarchResult(result) {
        return `**March Calculation**

**From**: (${result.from?.x || 0}, ${result.from?.y || 0})
**To**: (${result.to?.x || 0}, ${result.to?.y || 0})
**Distance**: ${result.distance} tiles
**Time**: ${result.formattedTime}
**Slowest Troop**: ${result.slowestTroop || 'N/A'}`;
    }
    
    formatCombatResult(result) {
        return `**Combat Simulation**

**Winner**: ${(result.winner || 'unknown').toUpperCase()}
**Rounds**: ${result.rounds || 'N/A'}

**Attacker**:
• Losses: ${result.attacker?.lossPercentage || result.attackerLosses || 'N/A'}%

**Defender**:
• Losses: ${result.defender?.lossPercentage || result.defenderLosses || 'N/A'}%`;
    }
    
    formatProtocolResult(action) {
        let content = `**Protocol: ${action.name}**

**Command ID**: ${action.commandId}
**Category**: ${action.category}
**Description**: ${action.description}`;

        if (action.request && Object.keys(action.request).length > 0) {
            content += `\n\n**Request Parameters**:\n`;
            for (const [key, type] of Object.entries(action.request)) {
                content += `• ${key}: ${type}\n`;
            }
        }
        
        if (action.response && Object.keys(action.response).length > 0) {
            content += `\n**Response Fields**:\n`;
            for (const [key, type] of Object.entries(action.response)) {
                content += `• ${key}: ${type}\n`;
            }
        }
        
        return content;
    }
    
    formatProtocolSearchResults(results) {
        let content = `**Found ${results.length} protocols**:\n\n`;
        
        for (const action of results.slice(0, 10)) {
            content += `• **${action.name}** (${action.commandId}) - ${action.description || action.category}\n`;
        }
        
        return content;
    }
    
    formatDecodeResult(result) {
        if (result.error) {
            return `**Decode Error**: ${result.error}`;
        }
        
        let content = `**Decoded Packet**

**Length**: ${result.rawLength || 'N/A'} bytes`;

        if (result.version !== undefined) {
            content += `\n**Version**: ${result.version}`;
        }
        
        if (result.messages && result.messages.length > 0) {
            content += `\n**Messages**: ${result.messages.length}`;
            for (const msg of result.messages.slice(0, 3)) {
                content += `\n• Target: ${msg.targetURI || 'N/A'}`;
                if (msg.value) {
                    content += ` = ${JSON.stringify(msg.value).substring(0, 100)}`;
                }
            }
        }
        
        return content;
    }
    
    formatSearchResults(results) {
        let content = `**Found ${results.length} results**:\n\n`;
        
        for (const result of results) {
            content += `**${result.category || 'Info'}** (Score: ${result.score?.toFixed(2) || 'N/A'})\n`;
            content += `${result.content?.substring(0, 200) || ''}\n\n`;
        }
        
        return content;
    }
    
    /**
     * Trim conversation history
     */
    trimHistory() {
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }
    }
    
    /**
     * Get conversation history
     */
    getHistory() {
        return this.conversationHistory;
    }
    
    /**
     * Get quick actions
     */
    getQuickActions() {
        return this.quickActions;
    }
    
    /**
     * Get service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            lmStudioConnected: this.lmStudioClient?.isConnected?.() || false,
            mcpStatus: this.mcpManager?.getStatus?.() || null,
            hasGameState: !!this.gameState,
            historyLength: this.conversationHistory.length
        };
    }
    
    /**
     * Cleanup
     */
    async cleanup() {
        if (this.mcpManager) {
            await this.mcpManager.shutdown?.();
        }
        
        if (this.playwrightService) {
            await this.playwrightService.close?.();
        }
        
        this.isInitialized = false;
    }
}

// Singleton instance
let instance = null;

function getChatbotService() {
    if (!instance) {
        instance = new ChatbotService();
    }
    return instance;
}

module.exports = {
    ChatbotService,
    getChatbotService
};
