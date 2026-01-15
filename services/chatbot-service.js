/**
 * Svony Browser - Chatbot Service (Co-Pilot)
 * AI-powered assistant with RAG knowledge retrieval
 */

const EventEmitter = require('events');
const path = require('path');

class ChatbotService extends EventEmitter {
    constructor() {
        super();
        this.mcpManager = null; // Lazy loaded
        this.protocolHandler = null; // Lazy loaded
        this.conversationHistory = [];
        this.currentContext = {};
        this.isProcessing = false;
        this.maxHistoryLength = 50;
        
        // Quick actions configuration
        this.quickActions = [
            { 
                id: 'protocol', 
                label: 'Protocol Lookup', 
                icon: '📡',
                description: 'Search Evony protocol commands',
                handler: 'handleProtocolLookup'
            },
            { 
                id: 'calculator', 
                label: 'Training Calculator', 
                icon: '🔢',
                description: 'Calculate troop training costs',
                handler: 'handleCalculator'
            },
            { 
                id: 'traffic', 
                label: 'Traffic Analysis', 
                icon: '📊',
                description: 'Analyze captured traffic',
                handler: 'handleTrafficAnalysis'
            },
            { 
                id: 'knowledge', 
                label: 'Knowledge Base', 
                icon: '📚',
                description: 'Search game knowledge',
                handler: 'handleKnowledgeSearch'
            },
            { 
                id: 'combat', 
                label: 'Combat Simulator', 
                icon: '⚔️',
                description: 'Simulate battle outcomes',
                handler: 'handleCombatSimulation'
            },
            { 
                id: 'march', 
                label: 'March Time', 
                icon: '🏃',
                description: 'Calculate march times',
                handler: 'handleMarchTime'
            }
        ];
        
        // System prompts for different contexts
        this.systemPrompts = {
            general: `You are Evony Co-Pilot, an AI assistant specialized in the game Evony: The King's Return. 
You help players with:
- Understanding game mechanics and strategies
- Analyzing protocol traffic and AMF data
- Calculating troop training costs and march times
- Optimizing city builds and hero development
- Combat simulation and battle predictions

Always be helpful, accurate, and provide specific game-related advice when possible.`,
            
            protocol: `You are analyzing Evony game protocol data. Help the user understand:
- What actions/commands are being sent
- The structure of request/response data
- How to interpret AMF3 encoded data
- Common patterns in game communication`,
            
            combat: `You are helping with combat analysis in Evony. Consider:
- Troop types and their counters
- Hero skills and buffs
- Wall defenses and traps
- March composition optimization`
        };
    }

    /**
     * Initialize the chatbot service
     */
    async initialize() {
        try {
            this.mcpManager = require('./mcp-connection');
            this.protocolHandler = require('./protocol-handler');
            
            console.log('[ChatbotService] Initialized');
            this.emit('initialized');
            return true;
        } catch (error) {
            console.error('[ChatbotService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Process user message and generate response
     */
    async processMessage(userMessage, context = {}) {
        if (this.isProcessing) {
            return { error: 'Already processing a message' };
        }
        
        this.isProcessing = true;
        this.emit('processingStarted');
        
        try {
            // Add user message to history
            const userEntry = {
                id: Date.now(),
                role: 'user',
                content: userMessage,
                timestamp: Date.now(),
                context: { ...this.currentContext, ...context }
            };
            this.conversationHistory.push(userEntry);
            this.emit('messageAdded', userEntry);
            
            // Detect intent and route to appropriate handler
            const intent = this.detectIntent(userMessage);
            let response;
            
            switch (intent.type) {
                case 'protocol_lookup':
                    response = await this.handleProtocolLookup(intent.query);
                    break;
                case 'calculator':
                    response = await this.handleCalculator(intent.params);
                    break;
                case 'combat':
                    response = await this.handleCombatSimulation(intent.params);
                    break;
                case 'march_time':
                    response = await this.handleMarchTime(intent.params);
                    break;
                case 'knowledge':
                    response = await this.handleKnowledgeSearch(userMessage);
                    break;
                default:
                    response = await this.handleGeneralQuery(userMessage);
            }
            
            // Add assistant response to history
            const assistantEntry = {
                id: Date.now(),
                role: 'assistant',
                content: response.text || response,
                timestamp: Date.now(),
                intent: intent.type,
                data: response.data || null
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
                content: `I encountered an error: ${error.message}. Please try again.`,
                timestamp: Date.now(),
                error: true
            };
            this.conversationHistory.push(errorEntry);
            
            return errorEntry;
            
        } finally {
            this.isProcessing = false;
            this.emit('processingFinished');
        }
    }

    /**
     * Detect user intent from message
     */
    detectIntent(message) {
        const lowerMessage = message.toLowerCase();
        
        // Protocol lookup patterns
        if (lowerMessage.includes('protocol') || 
            lowerMessage.includes('command') ||
            lowerMessage.includes('action') ||
            lowerMessage.match(/\b(city|hero|army|alliance|map|trade|quest|system)\.\w+/)) {
            
            const actionMatch = message.match(/\b(\w+\.\w+)\b/);
            return {
                type: 'protocol_lookup',
                query: actionMatch ? actionMatch[1] : message
            };
        }
        
        // Calculator patterns
        if (lowerMessage.includes('calculate') || 
            lowerMessage.includes('training') ||
            lowerMessage.includes('cost') ||
            lowerMessage.includes('how many') ||
            lowerMessage.includes('how much')) {
            
            return {
                type: 'calculator',
                params: this.extractCalculatorParams(message)
            };
        }
        
        // Combat patterns
        if (lowerMessage.includes('battle') || 
            lowerMessage.includes('attack') ||
            lowerMessage.includes('defend') ||
            lowerMessage.includes('combat') ||
            lowerMessage.includes('simulate')) {
            
            return {
                type: 'combat',
                params: this.extractCombatParams(message)
            };
        }
        
        // March time patterns
        if (lowerMessage.includes('march') || 
            lowerMessage.includes('travel') ||
            lowerMessage.includes('distance') ||
            lowerMessage.includes('how long')) {
            
            return {
                type: 'march_time',
                params: this.extractMarchParams(message)
            };
        }
        
        // Default to knowledge search
        return {
            type: 'knowledge',
            query: message
        };
    }

    /**
     * Handle protocol lookup requests
     */
    async handleProtocolLookup(query) {
        if (!this.protocolHandler) {
            this.protocolHandler = require('./protocol-handler');
        }
        
        // Try exact match first
        let action = this.protocolHandler.lookupAction(query);
        
        if (action) {
            return {
                text: this.formatProtocolAction(action),
                data: action
            };
        }
        
        // Try search
        const results = this.protocolHandler.searchActions(query);
        
        if (results.length > 0) {
            const formatted = results.slice(0, 5).map(a => 
                `• **${a.name}** (${a.category}): ${a.description}`
            ).join('\n');
            
            return {
                text: `Found ${results.length} matching protocol actions:\n\n${formatted}`,
                data: results.slice(0, 5)
            };
        }
        
        // List categories if no match
        const categories = this.protocolHandler.getCategories();
        return {
            text: `No protocol action found for "${query}".\n\nAvailable categories: ${categories.join(', ')}\n\nTry searching with a category name or action like "city.getInfo"`,
            data: { categories }
        };
    }

    /**
     * Format protocol action for display
     */
    formatProtocolAction(action) {
        let text = `## ${action.name}\n\n`;
        text += `**Category:** ${action.category}\n`;
        text += `**Command ID:** ${action.commandId}\n`;
        text += `**Description:** ${action.description}\n\n`;
        
        if (action.request && Object.keys(action.request).length > 0) {
            text += `### Request Parameters\n`;
            for (const [key, type] of Object.entries(action.request)) {
                text += `• \`${key}\`: ${type}\n`;
            }
            text += '\n';
        }
        
        if (action.response && Object.keys(action.response).length > 0) {
            text += `### Response Fields\n`;
            for (const [key, type] of Object.entries(action.response)) {
                text += `• \`${key}\`: ${type}\n`;
            }
        }
        
        return text;
    }

    /**
     * Handle calculator requests
     */
    async handleCalculator(params) {
        const troopCosts = {
            worker: { food: 50, gold: 0, lumber: 0, stone: 0, iron: 0, time: 15 },
            warrior: { food: 100, gold: 0, lumber: 0, stone: 0, iron: 20, time: 30 },
            scout: { food: 50, gold: 0, lumber: 0, stone: 0, iron: 0, time: 20 },
            pikeman: { food: 150, gold: 0, lumber: 0, stone: 0, iron: 50, time: 60 },
            swordsman: { food: 200, gold: 0, lumber: 50, stone: 0, iron: 100, time: 90 },
            archer: { food: 150, gold: 0, lumber: 100, stone: 0, iron: 50, time: 75 },
            cavalry: { food: 300, gold: 0, lumber: 0, stone: 0, iron: 150, time: 120 },
            cataphract: { food: 500, gold: 0, lumber: 0, stone: 0, iron: 300, time: 180 },
            ballista: { food: 500, gold: 0, lumber: 500, stone: 0, iron: 200, time: 300 },
            ram: { food: 600, gold: 0, lumber: 600, stone: 0, iron: 300, time: 360 },
            catapult: { food: 800, gold: 0, lumber: 800, stone: 0, iron: 400, time: 450 }
        };
        
        if (!params.troopType || !params.count) {
            // Return available troop types
            const types = Object.keys(troopCosts).join(', ');
            return {
                text: `Please specify a troop type and count.\n\n**Available troops:** ${types}\n\n**Example:** "Calculate cost for 10000 cavalry"`,
                data: { troopTypes: Object.keys(troopCosts) }
            };
        }
        
        const troopType = params.troopType.toLowerCase();
        const count = params.count;
        
        if (!troopCosts[troopType]) {
            return {
                text: `Unknown troop type: ${troopType}. Available: ${Object.keys(troopCosts).join(', ')}`,
                data: null
            };
        }
        
        const cost = troopCosts[troopType];
        const totalCost = {
            food: cost.food * count,
            gold: cost.gold * count,
            lumber: cost.lumber * count,
            stone: cost.stone * count,
            iron: cost.iron * count,
            time: cost.time * count // in seconds
        };
        
        const formatNumber = (n) => n.toLocaleString();
        const formatTime = (seconds) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        };
        
        let text = `## Training Cost: ${formatNumber(count)} ${troopType}\n\n`;
        text += `| Resource | Amount |\n`;
        text += `|----------|--------|\n`;
        text += `| Food | ${formatNumber(totalCost.food)} |\n`;
        if (totalCost.lumber > 0) text += `| Lumber | ${formatNumber(totalCost.lumber)} |\n`;
        if (totalCost.stone > 0) text += `| Stone | ${formatNumber(totalCost.stone)} |\n`;
        if (totalCost.iron > 0) text += `| Iron | ${formatNumber(totalCost.iron)} |\n`;
        text += `\n**Base Training Time:** ${formatTime(totalCost.time)}\n`;
        text += `\n*Note: Actual time depends on barracks level and buffs.*`;
        
        return { text, data: totalCost };
    }

    /**
     * Handle combat simulation requests
     */
    async handleCombatSimulation(params) {
        try {
            const combatSimulator = require('./combat-simulator');
            
            if (!params.attacker || !params.defender) {
                return {
                    text: `To simulate combat, please provide attacker and defender armies.\n\n**Example:** "Simulate 10000 cavalry vs 5000 pikeman"\n\nOr use the Combat Simulator tool in the Tools panel.`,
                    data: null
                };
            }
            
            const result = combatSimulator.simulate(params.attacker, params.defender, params.options || {});
            
            let text = `## Combat Simulation Results\n\n`;
            text += `**Winner:** ${result.winner === 'attacker' ? '⚔️ Attacker' : '🛡️ Defender'}\n`;
            text += `**Rounds:** ${result.rounds.length}\n\n`;
            
            text += `### Attacker Losses\n`;
            for (const [troop, count] of Object.entries(result.attackerLosses)) {
                if (count > 0) text += `• ${troop}: ${count.toLocaleString()}\n`;
            }
            
            text += `\n### Defender Losses\n`;
            for (const [troop, count] of Object.entries(result.defenderLosses)) {
                if (count > 0) text += `• ${troop}: ${count.toLocaleString()}\n`;
            }
            
            return { text, data: result };
            
        } catch (error) {
            return {
                text: `Combat simulation error: ${error.message}`,
                data: null
            };
        }
    }

    /**
     * Handle march time calculation
     */
    async handleMarchTime(params) {
        try {
            const combatSimulator = require('./combat-simulator');
            
            if (!params.distance) {
                return {
                    text: `To calculate march time, please provide the distance.\n\n**Example:** "How long to march 50 tiles with cavalry?"\n\nDistance is measured in tiles on the map.`,
                    data: null
                };
            }
            
            const troops = params.troops || { cavalry: 1 }; // Default to cavalry speed
            const distance = params.distance;
            const speedBuffs = params.speedBuffs || {};
            
            const seconds = combatSimulator.calculateMarchTime(troops, distance, speedBuffs);
            
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            
            let timeStr = '';
            if (hours > 0) timeStr += `${hours}h `;
            if (minutes > 0) timeStr += `${minutes}m `;
            timeStr += `${secs}s`;
            
            return {
                text: `## March Time Calculation\n\n**Distance:** ${distance} tiles\n**Estimated Time:** ${timeStr}\n\n*Note: Actual time depends on hero skills, research, and items.*`,
                data: { distance, seconds, formatted: timeStr }
            };
            
        } catch (error) {
            return {
                text: `March time calculation error: ${error.message}`,
                data: null
            };
        }
    }

    /**
     * Handle knowledge base search
     */
    async handleKnowledgeSearch(query) {
        try {
            if (this.mcpManager && this.mcpManager.isConnected('evony-knowledge')) {
                const result = await this.mcpManager.callTool(
                    'evony-knowledge',
                    'evony_search',
                    { query, k: 5 }
                );
                
                if (result && result.content) {
                    return {
                        text: result.content,
                        data: result
                    };
                }
            }
            
            // Fallback to built-in knowledge
            return this.handleGeneralQuery(query);
            
        } catch (error) {
            console.error('[ChatbotService] Knowledge search error:', error);
            return this.handleGeneralQuery(query);
        }
    }

    /**
     * Handle general queries with built-in knowledge or LM Studio
     */
    async handleGeneralQuery(message) {
        // Try LM Studio first if available
        if (this.lmStudioClient && this.lmStudioClient.isConnected) {
            try {
                const systemPrompt = this.systemPrompts.general;
                const messages = [
                    { role: 'system', content: systemPrompt },
                    ...this.conversationHistory.slice(-10).map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    { role: 'user', content: message }
                ];
                
                const response = await this.lmStudioClient.chatCompletion(messages);
                
                if (response && response.message && response.message.content) {
                    return {
                        text: response.message.content,
                        data: { source: 'lm-studio', model: response.model }
                    };
                }
            } catch (error) {
                console.warn('[ChatbotService] LM Studio error, falling back to built-in:', error.message);
            }
        }
        
        // Built-in knowledge base for common questions
        const knowledge = {
            'hero': `**Heroes in Evony**\n\nHeroes are essential for leading armies and managing cities. Key aspects:\n\n• **Attributes:** Politics, Attack, Defense, Intelligence\n• **Skills:** Each hero has unique skills that affect combat and city management\n• **Levels:** Heroes gain experience from battles and can be leveled up\n• **Equipment:** Equip gear to boost hero stats\n\nTop heroes for combat: Roland, Elektra, Hannibal Barca\nTop heroes for development: Queen Jindeok, Cleopatra`,
            
            'troops': `**Troop Types in Evony**\n\n| Type | Strong Against | Weak Against |\n|------|----------------|---------------|\n| Infantry | Cavalry | Archers |\n| Cavalry | Archers | Infantry |\n| Archers | Infantry | Cavalry |\n| Siege | Walls | All troops |\n\n**Training Tips:**\n• Train troops matching your hero's specialty\n• Balance your army composition\n• Use siege for attacking cities`,
            
            'resources': `**Resources in Evony**\n\n• **Food:** Required for troops and most buildings\n• **Lumber:** Used for buildings and siege weapons\n• **Stone:** Needed for walls and advanced buildings\n• **Iron:** Essential for troops and equipment\n• **Gold:** Used for research, healing, and speedups\n• **Gems:** Premium currency for special items\n\n**Tips:** Build resource tiles, join rallies, and complete events for resources.`,
            
            'alliance': `**Alliance System**\n\n• Join an alliance early for protection and benefits\n• Donate resources to earn alliance honor\n• Participate in alliance wars and events\n• Help alliance members with construction and research\n• Alliance territory provides buffs to members`,
            
            'combat': `**Combat Mechanics**\n\n1. **Scouting:** Always scout before attacking\n2. **Hero Selection:** Choose heroes with combat skills\n3. **Troop Composition:** Counter enemy troop types\n4. **Buffs:** Activate war buffs before major battles\n5. **Timing:** Coordinate with alliance for rallies\n\n**Attack Types:**\n• Solo attacks for farming\n• Rallies for strong targets\n• Reinforcements for defense`
        };
        
        // Check for keyword matches
        const lowerMessage = message.toLowerCase();
        for (const [key, response] of Object.entries(knowledge)) {
            if (lowerMessage.includes(key)) {
                return { text: response, data: { source: 'builtin' } };
            }
        }
        
        // Default response
        return {
            text: `I can help you with Evony gameplay! Try asking about:\n\n• **Protocol commands** - e.g., "lookup city.getInfo"\n• **Training costs** - e.g., "calculate 10000 cavalry cost"\n• **Combat simulation** - e.g., "simulate battle"\n• **March times** - e.g., "march time for 50 tiles"\n• **Game mechanics** - e.g., "how do heroes work?"\n\nOr use the quick action buttons below for common tasks.`,
            data: null
        };
    }

    /**
     * Extract calculator parameters from message
     */
    extractCalculatorParams(message) {
        const params = {};
        
        // Extract troop type
        const troopTypes = ['worker', 'warrior', 'scout', 'pikeman', 'swordsman', 
                          'archer', 'cavalry', 'cataphract', 'ballista', 'ram', 'catapult'];
        for (const troop of troopTypes) {
            if (message.toLowerCase().includes(troop)) {
                params.troopType = troop;
                break;
            }
        }
        
        // Extract count
        const countMatch = message.match(/(\d+(?:,\d{3})*|\d+k|\d+m)/i);
        if (countMatch) {
            let count = countMatch[1].replace(/,/g, '');
            if (count.toLowerCase().endsWith('k')) {
                count = parseInt(count) * 1000;
            } else if (count.toLowerCase().endsWith('m')) {
                count = parseInt(count) * 1000000;
            } else {
                count = parseInt(count);
            }
            params.count = count;
        }
        
        return params;
    }

    /**
     * Extract combat parameters from message
     */
    extractCombatParams(message) {
        // This is a simplified extraction - full implementation would parse complex army compositions
        return {
            attacker: null,
            defender: null,
            options: {}
        };
    }

    /**
     * Extract march parameters from message
     */
    extractMarchParams(message) {
        const params = {};
        
        // Extract distance
        const distanceMatch = message.match(/(\d+)\s*(?:tiles?|distance)/i);
        if (distanceMatch) {
            params.distance = parseInt(distanceMatch[1]);
        }
        
        return params;
    }

    /**
     * Execute a quick action
     */
    async executeQuickAction(actionId, params = {}) {
        const action = this.quickActions.find(a => a.id === actionId);
        if (!action) {
            return { error: `Unknown action: ${actionId}` };
        }
        
        switch (actionId) {
            case 'protocol':
                return this.handleProtocolLookup(params.query || '');
            case 'calculator':
                return this.handleCalculator(params);
            case 'combat':
                return this.handleCombatSimulation(params);
            case 'march':
                return this.handleMarchTime(params);
            case 'knowledge':
                return this.handleKnowledgeSearch(params.query || '');
            case 'traffic':
                return this.handleTrafficAnalysis(params);
            default:
                return { error: `Action not implemented: ${actionId}` };
        }
    }

    /**
     * Handle traffic analysis request
     */
    async handleTrafficAnalysis(params) {
        return {
            text: `Open the **Traffic Viewer** panel to capture and analyze game traffic.\n\n**Steps:**\n1. Start Fiddler proxy on port 8888\n2. Click "Start Capture" in Traffic Viewer\n3. Play the game to generate traffic\n4. Click on packets to view decoded data`,
            data: null
        };
    }

    /**
     * Get quick actions list
     */
    getQuickActions() {
        return this.quickActions;
    }

    /**
     * Get conversation history
     */
    getHistory() {
        return [...this.conversationHistory];
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
        this.emit('historyCleared');
    }

    /**
     * Trim history to max length
     */
    trimHistory() {
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }
    }

    /**
     * Set current context
     */
    setContext(context) {
        this.currentContext = { ...this.currentContext, ...context };
    }

    /**
     * Get current context
     */
    getContext() {
        return { ...this.currentContext };
    }

    /**
     * Clear context
     */
    clearContext() {
        this.currentContext = {};
    }
}

module.exports = new ChatbotService();
