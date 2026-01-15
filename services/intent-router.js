/**
 * Intent Router v2.0.7
 * Routes user messages to appropriate MCP tools based on intent classification
 * Enhanced with confidence scoring, fallback chain, and intent logging
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

// Intent definitions with keywords, patterns, and weights
const INTENT_DEFINITIONS = {
    // Knowledge/RAG intents
    knowledge_search: {
        keywords: ['what', 'how', 'explain', 'tell', 'information', 'guide', 'about', 'learn', 'understand'],
        patterns: [
            /what (is|are) (?:the )?(.*)/i,
            /how (do|does|to) (.*)/i,
            /explain (.*)/i,
            /tell me about (.*)/i,
            /information (on|about) (.*)/i,
            /guide (for|to|on) (.*)/i,
            /what does (.*) mean/i,
            /describe (.*)/i
        ],
        tools: ['evony_search', 'evony_lookup'],
        server: 'evony-rag',
        weight: 1.0,
        threshold: 0.4
    },
    
    knowledge_lookup: {
        keywords: ['lookup', 'find', 'search', 'get', 'show', 'list'],
        patterns: [
            /lookup (.*)/i,
            /find info (on|about) (.*)/i,
            /search (for )?(.*)/i,
            /get (info|data|details) (on|about|for) (.*)/i
        ],
        tools: ['evony_lookup', 'evony_search'],
        server: 'evony-rag',
        weight: 0.9,
        threshold: 0.4
    },
    
    context_query: {
        keywords: ['should', 'help', 'advice', 'strategy', 'best', 'recommend', 'suggest', 'optimal'],
        patterns: [
            /what should i do (when|if|about) (.*)/i,
            /help (me )?(with )?(.*)/i,
            /advice (on|for|about) (.*)/i,
            /strategy (for )?(.*)/i,
            /best way to (.*)/i,
            /recommend(ation)? (for )?(.*)/i,
            /suggest(ion)? (for )?(.*)/i,
            /optimal (.*)/i
        ],
        tools: ['evony_context'],
        server: 'evony-rag',
        weight: 0.95,
        threshold: 0.45
    },
    
    // Protocol/RTE intents
    protocol_lookup: {
        keywords: ['protocol', 'command', 'action', 'packet', 'api', 'endpoint', 'request'],
        patterns: [
            /protocol (for )?(.*)/i,
            /command (id )?(for )?(.*)/i,
            /action (for )?(.*)/i,
            /what protocol (.*)/i,
            /packet (for )?(.*)/i,
            /api (for )?(.*)/i
        ],
        tools: ['protocol_lookup', 'protocol_search'],
        server: 'evony-rte',
        weight: 1.0,
        threshold: 0.5
    },
    
    protocol_search: {
        keywords: ['find protocol', 'search protocol', 'list protocol', 'show action'],
        patterns: [
            /find protocol(s)? (.*)/i,
            /search protocol(s)? (.*)/i,
            /list (.*) protocol(s)?/i,
            /show (.*) actions/i,
            /all (.*) protocols/i
        ],
        tools: ['protocol_search'],
        server: 'evony-rte',
        weight: 0.9,
        threshold: 0.5
    },
    
    decode_packet: {
        keywords: ['decode', 'parse', 'analyze', 'hex', 'amf', 'binary', 'bytes'],
        patterns: [
            /decode (packet |data )?(.*)/i,
            /parse (packet |amf )?(.*)/i,
            /what (is|does) (this )?(packet|data) (.*)/i,
            /analyze (packet |hex )?(.*)/i,
            /convert (hex|binary) (.*)/i
        ],
        tools: ['decode_packet'],
        server: 'evony-rte',
        weight: 1.0,
        threshold: 0.6
    },
    
    traffic_analysis: {
        keywords: ['traffic', 'network', 'capture', 'monitor', 'inspect'],
        patterns: [
            /analyze traffic/i,
            /traffic (analysis|patterns)/i,
            /what('s| is) happening (in |with )?traffic/i,
            /show traffic/i,
            /network (activity|analysis)/i
        ],
        tools: ['analyze_traffic'],
        server: 'evony-rte',
        weight: 0.85,
        threshold: 0.5
    },
    
    // Calculation/Tools intents
    calc_training: {
        keywords: ['train', 'training', 'troops', 'soldiers', 'army', 'recruit'],
        patterns: [
            /train(ing)? (\d+) (.*)/i,
            /how (long|much) (to |for )?train(ing)? (.*)/i,
            /training (time|cost|resources) (for )?(.*)/i,
            /calculate training (.*)/i,
            /recruit (\d+) (.*)/i
        ],
        tools: ['calc_training'],
        server: 'evony-tools',
        weight: 1.0,
        threshold: 0.5,
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
        keywords: ['march', 'travel', 'distance', 'move', 'walk', 'speed'],
        patterns: [
            /march (time |from )?(.*)/i,
            /how long (to |for )?march (.*)/i,
            /travel time (from |to )?(.*)/i,
            /distance (from |to )?(.*)/i,
            /how far (is |to )?(.*)/i
        ],
        tools: ['calc_march'],
        server: 'evony-tools',
        weight: 0.95,
        threshold: 0.5,
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
        keywords: ['combat', 'battle', 'fight', 'attack', 'defend', 'war', 'simulate', 'win'],
        patterns: [
            /combat (sim|simulation|calculator)/i,
            /battle (sim|simulation|calculator)/i,
            /fight (sim|simulation)/i,
            /who (would |will )?win (.*)/i,
            /attack (.*) with (.*)/i,
            /simulate (battle|combat|attack)/i,
            /can i (beat|defeat|win against) (.*)/i
        ],
        tools: ['calc_combat'],
        server: 'evony-tools',
        weight: 1.0,
        threshold: 0.55
    },
    
    calc_resources: {
        keywords: ['resource', 'production', 'gold', 'food', 'wood', 'stone', 'iron', 'income'],
        patterns: [
            /resource (production|calculation)/i,
            /how much (.*) (produce|make)/i,
            /production (rate|amount)/i,
            /(gold|food|wood|stone|iron) (production|income)/i
        ],
        tools: ['calc_resources'],
        server: 'evony-tools',
        weight: 0.9,
        threshold: 0.5
    },
    
    calc_building: {
        keywords: ['build', 'building', 'upgrade', 'construct', 'level'],
        patterns: [
            /build(ing)? (upgrade |cost |time )?(.*)/i,
            /upgrade (.*) to (level )?(.*)/i,
            /how (long|much) (to |for )?upgrade (.*)/i,
            /building (time|cost|requirements)/i,
            /construct (.*)/i
        ],
        tools: ['calc_building'],
        server: 'evony-tools',
        weight: 0.95,
        threshold: 0.5,
        extractParams: (match, message) => {
            const levelMatch = message.match(/level (\d+)/i);
            const buildingMatch = message.match(/(townhall|barracks|stable|workshop|forge|academy|warehouse|farm|sawmill|quarry|mine|wall|embassy|marketplace|inn|feasting_hall|rally_spot|beacon_tower)/i);
            return {
                targetLevel: levelMatch ? parseInt(levelMatch[1]) : 10,
                buildingType: buildingMatch ? buildingMatch[1].toLowerCase() : 'barracks'
            };
        }
    },
    
    // Hero intents
    hero_info: {
        keywords: ['hero', 'general', 'commander', 'skill', 'equipment', 'gear'],
        patterns: [
            /hero (info|stats|skills) (for |about )?(.*)/i,
            /best hero (for )?(.*)/i,
            /general (.*) (stats|skills|info)/i,
            /(.*) hero (build|setup|equipment)/i
        ],
        tools: ['evony_search', 'evony_lookup'],
        server: 'evony-rag',
        weight: 0.9,
        threshold: 0.45
    },
    
    // Event intents
    event_info: {
        keywords: ['event', 'boss', 'monster', 'rally', 'svs', 'kvk'],
        patterns: [
            /event (info|guide|strategy) (for )?(.*)/i,
            /how to (do |complete )?(.*) event/i,
            /boss (strategy|guide|tips)/i,
            /(svs|kvk|battlefield) (guide|strategy|tips)/i
        ],
        tools: ['evony_search', 'evony_context'],
        server: 'evony-rag',
        weight: 0.9,
        threshold: 0.45
    }
};

// Fallback chain configuration
const FALLBACK_CHAIN = [
    { type: 'mcp', server: 'evony-rag', tool: 'evony_search' },
    { type: 'mcp', server: 'evony-tools', tool: 'evony_context' },
    { type: 'llm' },
    { type: 'builtin' }
];

/**
 * Intent Router Class with confidence scoring
 */
class IntentRouter extends EventEmitter {
    constructor(mcpManager, lmStudioClient, options = {}) {
        super();
        this.mcpManager = mcpManager;
        this.lmStudioClient = lmStudioClient;
        this.conversationHistory = [];
        this.gameContext = null;
        
        // Configuration
        this.config = {
            minConfidence: options.minConfidence || 0.3,
            useFallbackChain: options.useFallbackChain !== false,
            logIntents: options.logIntents !== false,
            logPath: options.logPath || null,
            maxHistorySize: options.maxHistorySize || 20
        };
        
        // Intent logging
        this.intentLog = [];
        this.maxLogSize = 1000;
        
        // Statistics
        this.stats = {
            totalRouted: 0,
            byIntent: {},
            avgConfidence: 0,
            fallbackCount: 0,
            startTime: Date.now()
        };
        
        console.log('[IntentRouter] Initialized with confidence scoring');
    }
    
    /**
     * Set current game context for enhanced responses
     */
    setGameContext(context) {
        this.gameContext = context;
    }
    
    /**
     * Calculate keyword match score
     */
    calculateKeywordScore(message, keywords) {
        const words = message.toLowerCase().split(/\s+/);
        let matches = 0;
        
        for (const keyword of keywords) {
            if (keyword.includes(' ')) {
                // Multi-word keyword
                if (message.toLowerCase().includes(keyword)) {
                    matches += 2; // Higher weight for phrase matches
                }
            } else {
                // Single word keyword
                if (words.includes(keyword)) {
                    matches += 1;
                }
            }
        }
        
        return matches / Math.max(keywords.length, 1);
    }
    
    /**
     * Calculate pattern match score
     */
    calculatePatternScore(message, patterns) {
        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                // Longer matches get higher scores
                const matchLength = match[0].length;
                const messageLength = message.length;
                return 0.5 + (0.5 * (matchLength / messageLength));
            }
        }
        return 0;
    }
    
    /**
     * Classify user intent with confidence scoring
     */
    classifyIntent(message) {
        const lowerMessage = message.toLowerCase().trim();
        const scores = [];
        
        for (const [intentName, config] of Object.entries(INTENT_DEFINITIONS)) {
            const keywordScore = this.calculateKeywordScore(lowerMessage, config.keywords);
            const patternScore = this.calculatePatternScore(lowerMessage, config.patterns);
            
            // Combined score with weights
            const combinedScore = (keywordScore * 0.4 + patternScore * 0.6) * config.weight;
            
            // Find pattern match for parameter extraction
            let match = null;
            for (const pattern of config.patterns) {
                match = lowerMessage.match(pattern);
                if (match) break;
            }
            
            scores.push({
                intent: intentName,
                keywordScore,
                patternScore,
                combinedScore,
                confidence: Math.min(combinedScore, 1.0),
                match,
                tools: config.tools,
                server: config.server,
                threshold: config.threshold,
                extractParams: config.extractParams
            });
        }
        
        // Sort by confidence
        scores.sort((a, b) => b.confidence - a.confidence);
        
        // Get top result
        const top = scores[0];
        const secondBest = scores[1];
        
        // Calculate confidence gap
        const confidenceGap = top.confidence - (secondBest?.confidence || 0);
        
        // Adjust confidence based on gap
        let adjustedConfidence = top.confidence;
        if (confidenceGap > 0.2) {
            adjustedConfidence = Math.min(adjustedConfidence + 0.1, 1.0);
        } else if (confidenceGap < 0.05 && top.confidence < 0.6) {
            adjustedConfidence = Math.max(adjustedConfidence - 0.1, 0);
        }
        
        // Check if meets threshold
        const meetsThreshold = adjustedConfidence >= (top.threshold || this.config.minConfidence);
        
        const result = {
            intent: meetsThreshold ? top.intent : 'general_chat',
            confidence: adjustedConfidence,
            rawConfidence: top.confidence,
            keywordScore: top.keywordScore,
            patternScore: top.patternScore,
            match: top.match,
            tools: meetsThreshold ? top.tools : [],
            server: meetsThreshold ? top.server : null,
            extractParams: top.extractParams,
            alternatives: scores.slice(1, 4).map(s => ({
                intent: s.intent,
                confidence: s.confidence
            })),
            meetsThreshold
        };
        
        // Log intent
        if (this.config.logIntents) {
            this.logIntent(message, result);
        }
        
        return result;
    }
    
    /**
     * Log intent classification for analysis
     */
    logIntent(message, classification) {
        const entry = {
            timestamp: Date.now(),
            message: message.substring(0, 200),
            intent: classification.intent,
            confidence: classification.confidence,
            alternatives: classification.alternatives
        };
        
        this.intentLog.push(entry);
        
        // Trim log
        if (this.intentLog.length > this.maxLogSize) {
            this.intentLog = this.intentLog.slice(-this.maxLogSize);
        }
        
        // Update stats
        this.stats.totalRouted++;
        this.stats.byIntent[classification.intent] = 
            (this.stats.byIntent[classification.intent] || 0) + 1;
        this.stats.avgConfidence = 
            (this.stats.avgConfidence * (this.stats.totalRouted - 1) + classification.confidence) / 
            this.stats.totalRouted;
    }
    
    /**
     * Route message with fallback chain
     */
    async route(message) {
        const classification = this.classifyIntent(message);
        this.emit('intent-classified', classification);
        
        let mcpResults = [];
        let context = '';
        let response = null;
        let usedFallback = false;
        
        // Try primary tools if confidence is high enough
        if (classification.meetsThreshold && classification.tools.length > 0) {
            const toolResult = await this.tryTools(message, classification);
            mcpResults = toolResult.results;
            context = toolResult.context;
            
            if (toolResult.success) {
                // Generate response with context
                response = await this.generateResponse(message, context, classification, mcpResults);
            }
        }
        
        // Use fallback chain if needed
        if (!response && this.config.useFallbackChain) {
            usedFallback = true;
            this.stats.fallbackCount++;
            
            const fallbackResult = await this.tryFallbackChain(message, classification);
            response = fallbackResult.response;
            mcpResults = [...mcpResults, ...fallbackResult.mcpResults];
        }
        
        // Final fallback to built-in response
        if (!response) {
            response = this.generateBuiltinResponse(message, classification);
        }
        
        // Add to conversation history
        this.conversationHistory.push({ role: 'user', content: message });
        this.conversationHistory.push({ role: 'assistant', content: response });
        
        // Trim history
        if (this.conversationHistory.length > this.config.maxHistorySize * 2) {
            this.conversationHistory = this.conversationHistory.slice(-this.config.maxHistorySize * 2);
        }
        
        return {
            response,
            intent: classification.intent,
            confidence: classification.confidence,
            alternatives: classification.alternatives,
            mcpResults,
            usedFallback,
            meetsThreshold: classification.meetsThreshold
        };
    }
    
    /**
     * Try MCP tools
     */
    async tryTools(message, classification) {
        const results = [];
        let context = '';
        let success = false;
        
        if (!this.mcpManager) {
            return { results, context, success: false };
        }
        
        for (const toolName of classification.tools) {
            try {
                let params = {};
                
                if (classification.extractParams) {
                    params = classification.extractParams(classification.match, message);
                } else {
                    params = this.extractDefaultParams(toolName, message, classification.match);
                }
                
                const result = await this.mcpManager.callTool(toolName, params);
                results.push({ tool: toolName, result, success: true });
                
                context += this.formatMCPResult(toolName, result);
                
                if (this.isGoodResult(result)) {
                    success = true;
                    break;
                }
            } catch (error) {
                console.error(`[IntentRouter] Tool ${toolName} failed:`, error.message);
                results.push({ tool: toolName, error: error.message, success: false });
            }
        }
        
        return { results, context, success };
    }
    
    /**
     * Try fallback chain
     */
    async tryFallbackChain(message, classification) {
        let response = null;
        const mcpResults = [];
        
        for (const fallback of FALLBACK_CHAIN) {
            try {
                if (fallback.type === 'mcp' && this.mcpManager) {
                    const result = await this.mcpManager.callTool(fallback.tool, {
                        query: message,
                        topic: message
                    });
                    
                    mcpResults.push({ tool: fallback.tool, result, fallback: true });
                    
                    if (this.isGoodResult(result)) {
                        const context = this.formatMCPResult(fallback.tool, result);
                        response = await this.generateResponse(message, context, classification, mcpResults);
                        break;
                    }
                } else if (fallback.type === 'llm' && this.lmStudioClient?.isConnected) {
                    response = await this.generateLLMResponse(message, '', classification);
                    if (response) break;
                } else if (fallback.type === 'builtin') {
                    response = this.generateBuiltinResponse(message, classification);
                    break;
                }
            } catch (error) {
                console.error(`[IntentRouter] Fallback ${fallback.type} failed:`, error.message);
            }
        }
        
        return { response, mcpResults };
    }
    
    /**
     * Generate response using available methods
     */
    async generateResponse(message, context, classification, mcpResults) {
        // Try LLM first
        if (this.lmStudioClient?.isConnected) {
            try {
                return await this.generateLLMResponse(message, context, classification);
            } catch (error) {
                console.error('[IntentRouter] LLM response failed:', error.message);
            }
        }
        
        // Fall back to formatting MCP results
        if (mcpResults.length > 0) {
            return this.formatMCPResultsAsResponse(mcpResults, classification);
        }
        
        return null;
    }
    
    /**
     * Generate LLM response
     */
    async generateLLMResponse(message, context, classification) {
        const systemPrompt = `You are the Evony Co-Pilot, an AI assistant for the game Evony: The King's Return.
You help players with game mechanics, strategies, and calculations.
Be concise, helpful, and provide actionable advice.
${context ? `\nRelevant information:\n${context}` : ''}
${this.gameContext ? `\nCurrent game state:\n${JSON.stringify(this.gameContext, null, 2)}` : ''}`;
        
        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory.slice(-6),
            { role: 'user', content: message }
        ];
        
        const result = await this.lmStudioClient.chatCompletion(messages, {
            temperature: 0.7,
            maxTokens: 1024
        });
        
        return result.message.content;
    }
    
    /**
     * Generate built-in response
     */
    generateBuiltinResponse(message, classification) {
        const responses = {
            knowledge_search: "I can help you find information about Evony. Please make sure the MCP servers are connected for detailed answers.",
            protocol_lookup: "For protocol information, ensure the evony-rte MCP server is connected.",
            calc_training: "I can calculate training times and costs. Please provide the troop type and quantity.",
            calc_combat: "I can simulate combat scenarios. Please describe the attacking and defending forces.",
            general_chat: "I'm the Evony Co-Pilot. I can help with game strategies, calculations, and protocol analysis. What would you like to know?"
        };
        
        return responses[classification.intent] || responses.general_chat;
    }
    
    /**
     * Format MCP results as response
     */
    formatMCPResultsAsResponse(results, classification) {
        const successfulResults = results.filter(r => r.success && r.result);
        
        if (successfulResults.length === 0) {
            return this.generateBuiltinResponse('', classification);
        }
        
        let response = '';
        for (const { tool, result } of successfulResults) {
            if (typeof result === 'string') {
                response += result + '\n\n';
            } else if (result.content) {
                response += result.content + '\n\n';
            } else if (result.data) {
                response += JSON.stringify(result.data, null, 2) + '\n\n';
            }
        }
        
        return response.trim() || this.generateBuiltinResponse('', classification);
    }
    
    /**
     * Extract default parameters for tools
     */
    extractDefaultParams(toolName, message, match) {
        const params = {};
        
        switch (toolName) {
            case 'evony_search':
            case 'evony_lookup':
                params.query = match ? match[match.length - 1] : message;
                params.topic = message;
                break;
            case 'evony_context':
                params.situation = message;
                params.query = message;
                break;
            case 'protocol_lookup':
            case 'protocol_search':
                params.query = match ? match[match.length - 1] : message;
                params.action = message;
                break;
            case 'decode_packet':
                const hexMatch = message.match(/[0-9a-fA-F]{8,}/);
                params.data = hexMatch ? hexMatch[0] : '';
                break;
            default:
                params.query = message;
        }
        
        return params;
    }
    
    /**
     * Format MCP result for context
     */
    formatMCPResult(toolName, result) {
        if (!result) return '';
        
        let formatted = `\n[${toolName}]:\n`;
        
        if (typeof result === 'string') {
            formatted += result;
        } else if (result.content) {
            formatted += result.content;
        } else if (result.data) {
            formatted += JSON.stringify(result.data, null, 2);
        } else {
            formatted += JSON.stringify(result, null, 2);
        }
        
        return formatted + '\n';
    }
    
    /**
     * Check if result is good enough
     */
    isGoodResult(result) {
        if (!result) return false;
        
        if (typeof result === 'string') {
            return result.length > 50;
        }
        
        if (result.content) {
            return result.content.length > 50;
        }
        
        if (result.data) {
            return Object.keys(result.data).length > 0;
        }
        
        return false;
    }
    
    /**
     * Get intent log
     */
    getIntentLog(limit = 100) {
        return this.intentLog.slice(-limit);
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            intentLogSize: this.intentLog.length
        };
    }
    
    /**
     * Export intent log to file
     */
    exportLog(filePath) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, JSON.stringify({
                exportedAt: Date.now(),
                stats: this.getStats(),
                log: this.intentLog
            }, null, 2));
            
            return true;
        } catch (error) {
            console.error('[IntentRouter] Export failed:', error.message);
            return false;
        }
    }
    
    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRouted: 0,
            byIntent: {},
            avgConfidence: 0,
            fallbackCount: 0,
            startTime: Date.now()
        };
    }
}

module.exports = { IntentRouter, INTENT_DEFINITIONS, FALLBACK_CHAIN };
