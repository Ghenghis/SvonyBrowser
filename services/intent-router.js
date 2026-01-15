/**
 * Intent Router
 * Routes user messages to appropriate MCP tools based on intent classification
 * Integrates with chatbot service for intelligent responses
 */

const { EventEmitter } = require('events');

// Intent patterns for classification
const INTENT_PATTERNS = {
    // Knowledge/RAG intents
    knowledge_search: {
        patterns: [
            /what (is|are) (?:the )?(.*)/i,
            /how (do|does|to) (.*)/i,
            /explain (.*)/i,
            /tell me about (.*)/i,
            /information (on|about) (.*)/i,
            /guide (for|to|on) (.*)/i
        ],
        tools: ['evony_search', 'evony_lookup'],
        server: 'evony-rag'
    },
    
    knowledge_lookup: {
        patterns: [
            /lookup (.*)/i,
            /find info (on|about) (.*)/i,
            /search (for )?(.*)/i
        ],
        tools: ['evony_lookup', 'evony_search'],
        server: 'evony-rag'
    },
    
    context_query: {
        patterns: [
            /what should i do (when|if|about) (.*)/i,
            /help (me )?(with )?(.*)/i,
            /advice (on|for|about) (.*)/i,
            /strategy (for )?(.*)/i,
            /best way to (.*)/i
        ],
        tools: ['evony_context'],
        server: 'evony-rag'
    },
    
    // Protocol/RTE intents
    protocol_lookup: {
        patterns: [
            /protocol (for )?(.*)/i,
            /command (id )?(for )?(.*)/i,
            /action (for )?(.*)/i,
            /what protocol (.*)/i,
            /packet (for )?(.*)/i
        ],
        tools: ['protocol_lookup', 'protocol_search'],
        server: 'evony-rte'
    },
    
    protocol_search: {
        patterns: [
            /find protocol(s)? (.*)/i,
            /search protocol(s)? (.*)/i,
            /list (.*) protocol(s)?/i,
            /show (.*) actions/i
        ],
        tools: ['protocol_search'],
        server: 'evony-rte'
    },
    
    decode_packet: {
        patterns: [
            /decode (packet |data )?(.*)/i,
            /parse (packet |amf )?(.*)/i,
            /what (is|does) (this )?(packet|data) (.*)/i,
            /analyze (packet |hex )?(.*)/i
        ],
        tools: ['decode_packet'],
        server: 'evony-rte'
    },
    
    traffic_analysis: {
        patterns: [
            /analyze traffic/i,
            /traffic (analysis|patterns)/i,
            /what('s| is) happening (in |with )?traffic/i
        ],
        tools: ['analyze_traffic'],
        server: 'evony-rte'
    },
    
    // Calculation/Tools intents
    calc_training: {
        patterns: [
            /train(ing)? (\d+) (.*)/i,
            /how (long|much) (to |for )?train(ing)? (.*)/i,
            /training (time|cost|resources) (for )?(.*)/i,
            /calculate training (.*)/i
        ],
        tools: ['calc_training'],
        server: 'evony-tools',
        extractParams: (match, message) => {
            const numMatch = message.match(/(\d+)/);
            const troopMatch = message.match(/(worker|warrior|scout|pikeman|swordsman|archer|cavalry|cataphract|ballista|ram|catapult|phalanx)/i);
            return {
                quantity: numMatch ? parseInt(numMatch[1]) : 1000,
                troopType: troopMatch ? troopMatch[1].toLowerCase() : 'cavalry'
            };
        }
    },
    
    calc_march: {
        patterns: [
            /march (time |from )?(.*)/i,
            /how long (to |for )?march (.*)/i,
            /travel time (from |to )?(.*)/i,
            /distance (from |to )?(.*)/i
        ],
        tools: ['calc_march'],
        server: 'evony-tools',
        extractParams: (match, message) => {
            const coords = message.match(/(\d+)[,\s]+(\d+)/g);
            if (coords && coords.length >= 2) {
                const [from, to] = coords.map(c => c.split(/[,\s]+/).map(Number));
                return { fromX: from[0], fromY: from[1], toX: to[0], toY: to[1] };
            }
            return { fromX: 0, fromY: 0, toX: 100, toY: 100 };
        }
    },
    
    calc_combat: {
        patterns: [
            /combat (sim|simulation|calculator)/i,
            /battle (sim|simulation|calculator)/i,
            /fight (sim|simulation)/i,
            /who (would |will )?win (.*)/i,
            /attack (.*) with (.*)/i,
            /simulate (battle|combat|attack)/i
        ],
        tools: ['calc_combat'],
        server: 'evony-tools'
    },
    
    calc_resources: {
        patterns: [
            /resource (production|calculation)/i,
            /how much (.*) (produce|make)/i,
            /production (rate|amount)/i
        ],
        tools: ['calc_resources'],
        server: 'evony-tools'
    },
    
    calc_building: {
        patterns: [
            /build(ing)? (upgrade |cost |time )?(.*)/i,
            /upgrade (.*) to (level )?(.*)/i,
            /how (long|much) (to |for )?upgrade (.*)/i,
            /building (time|cost|requirements)/i
        ],
        tools: ['calc_building'],
        server: 'evony-tools',
        extractParams: (match, message) => {
            const levelMatch = message.match(/level (\d+)/i);
            const buildingMatch = message.match(/(townhall|barracks|stable|workshop|forge|academy|warehouse|farm|sawmill|quarry|mine|wall|embassy|marketplace|inn|feasting_hall|rally_spot|beacon_tower)/i);
            return {
                targetLevel: levelMatch ? parseInt(levelMatch[1]) : 10,
                buildingType: buildingMatch ? buildingMatch[1].toLowerCase() : 'barracks'
            };
        }
    },
    
    // General chat (fallback)
    general_chat: {
        patterns: [/.*/],
        tools: [],
        server: null
    }
};

/**
 * Intent Router Class
 */
class IntentRouter extends EventEmitter {
    constructor(mcpManager, lmStudioClient) {
        super();
        this.mcpManager = mcpManager;
        this.lmStudioClient = lmStudioClient;
        this.conversationHistory = [];
        this.gameContext = null;
    }
    
    /**
     * Set current game context for enhanced responses
     */
    setGameContext(context) {
        this.gameContext = context;
    }
    
    /**
     * Classify user intent
     */
    classifyIntent(message) {
        const lowerMessage = message.toLowerCase().trim();
        
        for (const [intentName, config] of Object.entries(INTENT_PATTERNS)) {
            if (intentName === 'general_chat') continue; // Skip fallback
            
            for (const pattern of config.patterns) {
                const match = lowerMessage.match(pattern);
                if (match) {
                    return {
                        intent: intentName,
                        match,
                        tools: config.tools,
                        server: config.server,
                        extractParams: config.extractParams,
                        confidence: 0.8
                    };
                }
            }
        }
        
        // Fallback to general chat
        return {
            intent: 'general_chat',
            match: null,
            tools: [],
            server: null,
            confidence: 0.5
        };
    }
    
    /**
     * Route message and get response
     */
    async route(message) {
        const classification = this.classifyIntent(message);
        this.emit('intent-classified', classification);
        
        let mcpResults = [];
        let context = '';
        
        // Call MCP tools if applicable
        if (classification.tools.length > 0 && this.mcpManager) {
            for (const toolName of classification.tools) {
                try {
                    let params = {};
                    
                    // Extract parameters if extractor exists
                    if (classification.extractParams) {
                        params = classification.extractParams(classification.match, message);
                    } else {
                        // Default parameter extraction
                        params = this.extractDefaultParams(toolName, message, classification.match);
                    }
                    
                    const result = await this.mcpManager.callTool(toolName, params);
                    mcpResults.push({ tool: toolName, result });
                    
                    // Build context from results
                    context += this.formatMCPResult(toolName, result);
                    
                    // If we got good results, don't call more tools
                    if (this.isGoodResult(result)) break;
                    
                } catch (error) {
                    console.error(`[IntentRouter] Tool ${toolName} failed:`, error.message);
                    mcpResults.push({ tool: toolName, error: error.message });
                }
            }
        }
        
        // Add game context if available
        if (this.gameContext) {
            context += `\n\nCurrent Game State:\n${JSON.stringify(this.gameContext, null, 2)}`;
        }
        
        // Generate response using LM Studio if available
        let response;
        if (this.lmStudioClient && this.lmStudioClient.isConnected()) {
            response = await this.generateLLMResponse(message, context, classification);
        } else {
            response = this.generateFallbackResponse(message, mcpResults, classification);
        }
        
        // Add to conversation history
        this.conversationHistory.push({ role: 'user', content: message });
        this.conversationHistory.push({ role: 'assistant', content: response });
        
        // Keep history manageable
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }
        
        return {
            response,
            intent: classification.intent,
            mcpResults,
            confidence: classification.confidence
        };
    }
    
    /**
     * Extract default parameters for tools
     */
    extractDefaultParams(toolName, message, match) {
        switch (toolName) {
            case 'evony_search':
            case 'evony_lookup':
                return { query: message, limit: 5 };
            case 'evony_context':
                return { situation: message };
            case 'protocol_lookup':
            case 'protocol_search':
                return { query: message, identifier: message };
            case 'decode_packet':
                // Try to extract hex data
                const hexMatch = message.match(/[0-9a-fA-F]{8,}/);
                return { hexData: hexMatch ? hexMatch[0] : '' };
            default:
                return {};
        }
    }
    
    /**
     * Format MCP result for context
     */
    formatMCPResult(toolName, result) {
        if (!result) return '';
        
        let formatted = `\n\n[${toolName} Results]:\n`;
        
        if (typeof result === 'string') {
            formatted += result;
        } else if (result.results) {
            formatted += JSON.stringify(result.results, null, 2);
        } else if (result.found !== undefined) {
            formatted += result.found ? JSON.stringify(result, null, 2) : 'Not found';
        } else {
            formatted += JSON.stringify(result, null, 2);
        }
        
        return formatted;
    }
    
    /**
     * Check if MCP result is good enough
     */
    isGoodResult(result) {
        if (!result) return false;
        if (result.error) return false;
        if (result.found === false) return false;
        if (result.results && result.results.length === 0) return false;
        return true;
    }
    
    /**
     * Generate response using LM Studio
     */
    async generateLLMResponse(message, context, classification) {
        const systemPrompt = `You are the Evony Co-Pilot, an AI assistant for the Evony game analysis suite. 
You help players with:
- Game strategies and tactics
- Troop training and combat calculations
- Protocol analysis and traffic decoding
- Building and resource optimization
- Hero management and equipment

Be concise, helpful, and use the provided context to give accurate answers.
If calculation results are provided, explain them clearly.
If protocol information is provided, explain what the action does.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory.slice(-6),
            { role: 'user', content: context ? `Context:\n${context}\n\nUser Question: ${message}` : message }
        ];
        
        try {
            const response = await this.lmStudioClient.chat(messages);
            return response;
        } catch (error) {
            console.error('[IntentRouter] LLM response failed:', error);
            return this.generateFallbackResponse(message, [], classification);
        }
    }
    
    /**
     * Generate fallback response without LLM
     */
    generateFallbackResponse(message, mcpResults, classification) {
        // Check if we have MCP results to format
        if (mcpResults.length > 0) {
            const successResults = mcpResults.filter(r => !r.error && r.result);
            
            if (successResults.length > 0) {
                return this.formatResultsAsResponse(successResults, classification);
            }
        }
        
        // Fallback responses by intent
        const fallbacks = {
            knowledge_search: "I couldn't find specific information about that. Try being more specific or check the Evony wiki.",
            knowledge_lookup: "Topic not found in the knowledge base. Try a different search term.",
            context_query: "I need more context to provide advice. What specific situation are you facing?",
            protocol_lookup: "Protocol not found. Try searching by command ID or action name.",
            protocol_search: "No matching protocols found. Try a broader search term.",
            decode_packet: "Unable to decode the packet. Make sure you provide valid hex data.",
            traffic_analysis: "No traffic data available for analysis. Start capturing traffic first.",
            calc_training: "Please specify the troop type and quantity for training calculation.",
            calc_march: "Please provide coordinates (from and to) for march time calculation.",
            calc_combat: "Please provide attacker and defender troop compositions for combat simulation.",
            calc_resources: "Please specify your buildings for resource production calculation.",
            calc_building: "Please specify the building type and target level.",
            general_chat: "I'm the Evony Co-Pilot. I can help with game strategies, calculations, and protocol analysis. What would you like to know?"
        };
        
        return fallbacks[classification.intent] || fallbacks.general_chat;
    }
    
    /**
     * Format MCP results as readable response
     */
    formatResultsAsResponse(results, classification) {
        let response = '';
        
        for (const { tool, result } of results) {
            switch (tool) {
                case 'evony_search':
                    if (result.results && result.results.length > 0) {
                        response += `Found ${result.results.length} relevant results:\n\n`;
                        for (const r of result.results.slice(0, 3)) {
                            response += `**${r.category}**: ${r.content}\n\n`;
                        }
                    }
                    break;
                    
                case 'evony_lookup':
                    if (result.found && result.content) {
                        response += `**${result.category || 'Info'}**:\n${result.content}\n`;
                    }
                    break;
                    
                case 'calc_training':
                    response += `**Training Calculation**:\n`;
                    response += `- Troop: ${result.troopType} (Tier ${result.tier})\n`;
                    response += `- Quantity: ${result.quantity.toLocaleString()}\n`;
                    response += `- Time: ${result.formattedTime}\n`;
                    response += `- Resources: Food ${result.resources?.food?.toLocaleString() || 0}, `;
                    response += `Lumber ${result.resources?.lumber?.toLocaleString() || 0}, `;
                    response += `Stone ${result.resources?.stone?.toLocaleString() || 0}, `;
                    response += `Iron ${result.resources?.iron?.toLocaleString() || 0}\n`;
                    break;
                    
                case 'calc_march':
                    response += `**March Calculation**:\n`;
                    response += `- From: (${result.from?.x}, ${result.from?.y})\n`;
                    response += `- To: (${result.to?.x}, ${result.to?.y})\n`;
                    response += `- Distance: ${result.distance} tiles\n`;
                    response += `- Time: ${result.formattedTime}\n`;
                    response += `- Slowest: ${result.slowestTroop}\n`;
                    break;
                    
                case 'calc_combat':
                    response += `**Combat Simulation**:\n`;
                    response += `- Winner: ${result.winner?.toUpperCase()}\n`;
                    response += `- Rounds: ${result.rounds}\n`;
                    response += `- Attacker Loss: ${result.attacker?.lossPercentage}%\n`;
                    response += `- Defender Loss: ${result.defender?.lossPercentage}%\n`;
                    break;
                    
                case 'protocol_lookup':
                    if (result.found && result.action) {
                        response += `**Protocol: ${result.action.name}**\n`;
                        response += `- Command ID: ${result.action.commandId}\n`;
                        response += `- Category: ${result.action.category}\n`;
                        response += `- Description: ${result.action.description}\n`;
                    }
                    break;
                    
                case 'decode_packet':
                    if (!result.error) {
                        response += `**Decoded Packet**:\n`;
                        response += `- Action: ${result.action || 'Unknown'}\n`;
                        response += `- Length: ${result.rawLength} bytes\n`;
                        if (result.messages) {
                            response += `- Messages: ${result.messages.length}\n`;
                        }
                    }
                    break;
                    
                default:
                    response += JSON.stringify(result, null, 2);
            }
        }
        
        return response || "Results processed but no displayable content.";
    }
    
    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }
    
    /**
     * Get conversation history
     */
    getHistory() {
        return this.conversationHistory;
    }
}

module.exports = { IntentRouter, INTENT_PATTERNS };
