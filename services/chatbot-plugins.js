/**
 * Chatbot Plugins Service
 * Extensible plugin system for chatbot functionality
 * v2.0.9
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

/**
 * Plugin Base Class
 */
class ChatbotPlugin {
    constructor(config = {}) {
        this.id = config.id || `plugin-${Date.now()}`;
        this.name = config.name || 'Unnamed Plugin';
        this.description = config.description || '';
        this.version = config.version || '1.0.0';
        this.author = config.author || 'Unknown';
        this.enabled = config.enabled !== false;
        this.priority = config.priority || 50; // 0-100, higher = first
        
        // Commands this plugin handles
        this.commands = config.commands || [];
        
        // Intents this plugin handles
        this.intents = config.intents || [];
        
        // Keywords that trigger this plugin
        this.keywords = config.keywords || [];
        
        // Plugin state
        this.state = {};
        
        // References
        this.chatbot = null;
        this.services = {};
    }

    /**
     * Initialize plugin
     */
    async initialize(chatbot, services) {
        this.chatbot = chatbot;
        this.services = services;
    }

    /**
     * Check if this plugin can handle a message
     */
    canHandle(message, context) {
        const lower = message.toLowerCase();
        
        // Check commands
        for (const cmd of this.commands) {
            if (lower.startsWith(`/${cmd}`) || lower.startsWith(cmd)) {
                return { match: true, type: 'command', command: cmd };
            }
        }
        
        // Check keywords
        for (const keyword of this.keywords) {
            if (lower.includes(keyword.toLowerCase())) {
                return { match: true, type: 'keyword', keyword };
            }
        }
        
        // Check intents
        if (context.intent && this.intents.includes(context.intent)) {
            return { match: true, type: 'intent', intent: context.intent };
        }
        
        return { match: false };
    }

    /**
     * Handle a message
     */
    async handle(message, context) {
        throw new Error('Plugin must implement handle method');
    }

    /**
     * Get plugin info
     */
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            version: this.version,
            author: this.author,
            enabled: this.enabled,
            priority: this.priority,
            commands: this.commands,
            intents: this.intents,
            keywords: this.keywords
        };
    }

    /**
     * Cleanup
     */
    async destroy() {
        this.chatbot = null;
        this.services = {};
    }
}

/**
 * Built-in Plugins
 */

// Help Plugin
class HelpPlugin extends ChatbotPlugin {
    constructor() {
        super({
            id: 'help',
            name: 'Help Plugin',
            description: 'Provides help and command information',
            commands: ['help', 'commands', '?'],
            intents: ['help'],
            keywords: ['help me', 'what can you do', 'how do i'],
            priority: 100
        });
    }

    async handle(message, context) {
        const plugins = this.services.pluginManager?.getPlugins() || [];
        
        let response = '**Available Commands:**\n\n';
        
        for (const plugin of plugins) {
            if (plugin.enabled && plugin.commands.length > 0) {
                response += `**${plugin.name}**\n`;
                response += `Commands: ${plugin.commands.map(c => `\`/${c}\``).join(', ')}\n`;
                response += `${plugin.description}\n\n`;
            }
        }
        
        response += '\n**Tips:**\n';
        response += '- Ask about Evony strategies, troops, or buildings\n';
        response += '- Use voice commands by clicking the microphone\n';
        response += '- Type `/status` to see current game state\n';
        
        return {
            text: response,
            type: 'help'
        };
    }
}

// Status Plugin
class StatusPlugin extends ChatbotPlugin {
    constructor() {
        super({
            id: 'status',
            name: 'Status Plugin',
            description: 'Shows current game and system status',
            commands: ['status', 'state', 'info'],
            intents: ['status'],
            keywords: ['current status', 'game state', 'my status'],
            priority: 90
        });
    }

    async handle(message, context) {
        const gameState = this.services.gameState?.getSnapshot();
        const lmStatus = this.services.lmStudio?.getStatus();
        const mcpStatus = this.services.mcpManager?.getStatus();
        
        let response = '**Current Status:**\n\n';
        
        // Game State
        if (gameState) {
            response += '**Game State:**\n';
            response += `- Player: ${gameState.player?.name || 'Unknown'}\n`;
            response += `- Power: ${gameState.player?.power?.toLocaleString() || 'N/A'}\n`;
            response += `- Cities: ${gameState.cities?.length || 0}\n`;
            response += `- Alliance: ${gameState.alliance?.name || 'None'}\n\n`;
        }
        
        // LM Studio
        response += '**LM Studio:**\n';
        response += `- Connected: ${lmStatus?.connected ? '✅' : '❌'}\n`;
        response += `- Model: ${lmStatus?.model || 'None'}\n\n`;
        
        // MCP Servers
        response += '**MCP Servers:**\n';
        if (mcpStatus?.servers) {
            for (const [name, status] of Object.entries(mcpStatus.servers)) {
                response += `- ${name}: ${status.connected ? '✅' : '❌'}\n`;
            }
        }
        
        return {
            text: response,
            type: 'status'
        };
    }
}

// Calculator Plugin
class CalculatorPlugin extends ChatbotPlugin {
    constructor() {
        super({
            id: 'calculator',
            name: 'Calculator Plugin',
            description: 'Performs calculations for training, resources, etc.',
            commands: ['calc', 'calculate', 'math'],
            intents: ['calculate'],
            keywords: ['how many', 'how much', 'calculate', 'total'],
            priority: 80
        });
    }

    async handle(message, context) {
        const lower = message.toLowerCase();
        
        // Training time calculation
        if (lower.includes('train') || lower.includes('troops')) {
            return this._calculateTraining(message);
        }
        
        // Resource calculation
        if (lower.includes('resource') || lower.includes('cost')) {
            return this._calculateResources(message);
        }
        
        // General math
        const mathMatch = message.match(/calc(?:ulate)?\s+(.+)/i);
        if (mathMatch) {
            try {
                // Safe eval using Function
                const expr = mathMatch[1].replace(/[^0-9+\-*/().%\s]/g, '');
                const result = Function(`return ${expr}`)();
                return {
                    text: `**Result:** ${expr} = **${result}**`,
                    type: 'calculation'
                };
            } catch (e) {
                return {
                    text: 'Could not calculate. Please use format: `/calc 100 + 50 * 2`',
                    type: 'error'
                };
            }
        }
        
        return {
            text: 'Please specify what to calculate. Examples:\n- `/calc 100 * 50`\n- "How many troops to train 10000 T11?"',
            type: 'help'
        };
    }

    _calculateTraining(message) {
        // Extract numbers and troop tier
        const tierMatch = message.match(/t(\d+)/i);
        const quantityMatch = message.match(/(\d+(?:,\d+)*(?:k|m)?)\s*(?:troops?)?/i);
        
        if (!tierMatch || !quantityMatch) {
            return {
                text: 'Please specify tier and quantity. Example: "train 10000 T11"',
                type: 'help'
            };
        }
        
        const tier = parseInt(tierMatch[1]);
        let quantity = quantityMatch[1].replace(/,/g, '');
        if (quantity.endsWith('k')) quantity = parseFloat(quantity) * 1000;
        if (quantity.endsWith('m')) quantity = parseFloat(quantity) * 1000000;
        quantity = parseInt(quantity);
        
        // Base training times (seconds per troop)
        const baseTimes = {
            1: 10, 2: 15, 3: 20, 4: 30, 5: 45,
            6: 60, 7: 90, 8: 120, 9: 180, 10: 240,
            11: 300, 12: 360, 13: 420, 14: 480
        };
        
        const baseTime = baseTimes[tier] || 300;
        const totalSeconds = baseTime * quantity;
        
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        return {
            text: `**Training Calculation:**\n` +
                  `- Tier: T${tier}\n` +
                  `- Quantity: ${quantity.toLocaleString()}\n` +
                  `- Base Time: ${baseTime}s per troop\n` +
                  `- **Total Time: ${days}d ${hours}h ${minutes}m**\n\n` +
                  `*Note: Actual time depends on research, buffs, and VIP level.*`,
            type: 'calculation'
        };
    }

    _calculateResources(message) {
        return {
            text: 'Resource calculation coming soon. Please use the Training Calculator in the Tools tab.',
            type: 'info'
        };
    }
}

// Strategy Plugin
class StrategyPlugin extends ChatbotPlugin {
    constructor() {
        super({
            id: 'strategy',
            name: 'Strategy Plugin',
            description: 'Provides Evony strategy advice and tips',
            commands: ['strategy', 'tip', 'advice'],
            intents: ['strategy', 'howto'],
            keywords: ['best way', 'strategy', 'should i', 'recommend', 'tips'],
            priority: 70
        });
        
        this.strategies = {
            monsters: [
                'Use ranged troops for most monsters',
                'Bring a siege engine for boss monsters',
                'Higher level monsters give better rewards but cost more stamina',
                'Join rallies for boss monsters to share the cost'
            ],
            pvp: [
                'Scout before attacking to see troop composition',
                'Use counter troops: Cavalry > Ranged > Infantry > Cavalry',
                'Always have a shield up when offline',
                'Join an alliance for protection and rally support'
            ],
            building: [
                'Prioritize Keep upgrades for new building unlocks',
                'Build multiple barracks for faster troop training',
                'Upgrade resource buildings evenly',
                'Academy research provides permanent bonuses'
            ],
            troops: [
                'Focus on one troop type initially',
                'T11+ troops are significantly stronger',
                'Layer your troops with meat shields',
                'Keep hospital capacity high to minimize losses'
            ]
        };
    }

    async handle(message, context) {
        const lower = message.toLowerCase();
        
        // Determine category
        let category = null;
        if (lower.includes('monster') || lower.includes('hunt')) category = 'monsters';
        else if (lower.includes('attack') || lower.includes('pvp') || lower.includes('battle')) category = 'pvp';
        else if (lower.includes('build') || lower.includes('upgrade')) category = 'building';
        else if (lower.includes('troop') || lower.includes('train')) category = 'troops';
        
        if (category) {
            const tips = this.strategies[category];
            const randomTip = tips[Math.floor(Math.random() * tips.length)];
            
            return {
                text: `**${category.charAt(0).toUpperCase() + category.slice(1)} Strategy:**\n\n` +
                      `💡 ${randomTip}\n\n` +
                      `*Ask for more specific advice or type \`/strategy ${category}\` for all tips.*`,
                type: 'strategy'
            };
        }
        
        // General strategy
        return {
            text: '**Strategy Categories:**\n\n' +
                  '🐉 **Monsters** - `/strategy monsters`\n' +
                  '⚔️ **PvP** - `/strategy pvp`\n' +
                  '🏰 **Building** - `/strategy building`\n' +
                  '🪖 **Troops** - `/strategy troops`\n\n' +
                  '*Ask about specific topics for detailed advice!*',
            type: 'strategy'
        };
    }
}

// Automation Plugin
class AutomationPlugin extends ChatbotPlugin {
    constructor() {
        super({
            id: 'automation',
            name: 'Automation Plugin',
            description: 'Controls automation scripts and templates',
            commands: ['auto', 'run', 'script', 'template'],
            intents: ['start', 'stop', 'automation'],
            keywords: ['automate', 'run script', 'start automation'],
            priority: 85
        });
    }

    async handle(message, context) {
        const lower = message.toLowerCase();
        
        // List templates
        if (lower.includes('list') || lower.includes('templates')) {
            const templates = this.services.automationTemplates?.getTemplates() || [];
            
            let response = '**Available Automation Templates:**\n\n';
            for (const template of templates.slice(0, 10)) {
                response += `- **${template.name}** - ${template.description}\n`;
            }
            response += `\n*${templates.length} templates available. Use \`/auto run <name>\` to execute.*`;
            
            return { text: response, type: 'automation' };
        }
        
        // Run template
        const runMatch = message.match(/(?:run|start|execute)\s+(.+)/i);
        if (runMatch) {
            const templateName = runMatch[1].trim();
            const templates = this.services.automationTemplates?.getTemplates() || [];
            const template = templates.find(t => 
                t.name.toLowerCase().includes(templateName.toLowerCase())
            );
            
            if (template) {
                // Would trigger actual automation
                return {
                    text: `🚀 Starting automation: **${template.name}**\n\n` +
                          `Estimated duration: ${Math.round(template.estimatedDuration / 1000)}s\n` +
                          `Actions: ${template.actionCount}\n\n` +
                          `*Use \`/auto stop\` to cancel.*`,
                    type: 'automation',
                    action: { type: 'run-template', templateId: template.id }
                };
            }
            
            return {
                text: `Template "${templateName}" not found. Use \`/auto list\` to see available templates.`,
                type: 'error'
            };
        }
        
        // Stop automation
        if (lower.includes('stop') || lower.includes('cancel')) {
            return {
                text: '⏹️ Stopping all running automations...',
                type: 'automation',
                action: { type: 'stop-all' }
            };
        }
        
        return {
            text: '**Automation Commands:**\n\n' +
                  '- `/auto list` - Show available templates\n' +
                  '- `/auto run <name>` - Run a template\n' +
                  '- `/auto stop` - Stop running automations\n' +
                  '- `/script record` - Start recording a new script\n',
            type: 'help'
        };
    }
}

// Debug Plugin
class DebugPlugin extends ChatbotPlugin {
    constructor() {
        super({
            id: 'debug',
            name: 'Debug Plugin',
            description: 'Debug and diagnostic commands',
            commands: ['debug', 'log', 'inspect'],
            intents: ['debug'],
            keywords: ['debug', 'error', 'logs'],
            priority: 60
        });
    }

    async handle(message, context) {
        const lower = message.toLowerCase();
        
        // Show logs
        if (lower.includes('log')) {
            const logs = this.services.debugManager?.getLogs({ limit: 10 }) || [];
            
            let response = '**Recent Logs:**\n\n';
            for (const log of logs) {
                const level = log.level.toUpperCase().padEnd(5);
                response += `\`${level}\` ${log.message}\n`;
            }
            
            return { text: response, type: 'debug' };
        }
        
        // Show errors
        if (lower.includes('error')) {
            const errors = this.services.debugManager?.getLogs({ level: 'error', limit: 5 }) || [];
            
            let response = '**Recent Errors:**\n\n';
            if (errors.length === 0) {
                response += '✅ No recent errors!';
            } else {
                for (const error of errors) {
                    response += `❌ ${error.message}\n`;
                }
            }
            
            return { text: response, type: 'debug' };
        }
        
        // Performance
        if (lower.includes('perf') || lower.includes('performance')) {
            const perf = this.services.performanceProfiler?.getMetrics() || {};
            
            return {
                text: `**Performance Metrics:**\n\n` +
                      `- CPU: ${perf.cpu?.toFixed(1) || 'N/A'}%\n` +
                      `- Memory: ${perf.memory?.toFixed(1) || 'N/A'} MB\n` +
                      `- Uptime: ${Math.round((perf.uptime || 0) / 1000)}s\n`,
                type: 'debug'
            };
        }
        
        return {
            text: '**Debug Commands:**\n\n' +
                  '- `/debug logs` - Show recent logs\n' +
                  '- `/debug errors` - Show recent errors\n' +
                  '- `/debug performance` - Show performance metrics\n' +
                  '- `/debug inspect <element>` - Inspect an element\n',
            type: 'help'
        };
    }
}

/**
 * Plugin Manager
 */
class ChatbotPluginManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            pluginsDir: options.pluginsDir || path.join(process.cwd(), 'plugins'),
            autoLoad: options.autoLoad !== false,
            ...options
        };

        // Plugins
        this.plugins = new Map();
        
        // Services reference
        this.services = {};
        
        // Load built-in plugins
        this._loadBuiltInPlugins();
    }

    /**
     * Load built-in plugins
     */
    _loadBuiltInPlugins() {
        const builtIn = [
            new HelpPlugin(),
            new StatusPlugin(),
            new CalculatorPlugin(),
            new StrategyPlugin(),
            new AutomationPlugin(),
            new DebugPlugin()
        ];
        
        for (const plugin of builtIn) {
            this.registerPlugin(plugin);
        }
    }

    /**
     * Set services reference
     */
    setServices(services) {
        this.services = services;
        
        // Initialize all plugins with services
        for (const plugin of this.plugins.values()) {
            plugin.initialize(null, services);
        }
    }

    /**
     * Register a plugin
     */
    registerPlugin(plugin) {
        if (!(plugin instanceof ChatbotPlugin)) {
            throw new Error('Plugin must extend ChatbotPlugin');
        }
        
        this.plugins.set(plugin.id, plugin);
        plugin.services = this.services;
        
        this.emit('plugin-registered', plugin.getInfo());
        return plugin;
    }

    /**
     * Unregister a plugin
     */
    unregisterPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
            plugin.destroy();
            this.plugins.delete(pluginId);
            this.emit('plugin-unregistered', pluginId);
            return true;
        }
        return false;
    }

    /**
     * Enable/disable a plugin
     */
    togglePlugin(pluginId, enabled) {
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
            plugin.enabled = enabled;
            this.emit('plugin-toggled', { pluginId, enabled });
            return true;
        }
        return false;
    }

    /**
     * Get plugins sorted by priority
     */
    getPlugins() {
        return Array.from(this.plugins.values())
            .sort((a, b) => b.priority - a.priority)
            .map(p => p.getInfo());
    }

    /**
     * Get plugin by ID
     */
    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }

    /**
     * Process a message through plugins
     */
    async processMessage(message, context = {}) {
        const sortedPlugins = Array.from(this.plugins.values())
            .filter(p => p.enabled)
            .sort((a, b) => b.priority - a.priority);
        
        for (const plugin of sortedPlugins) {
            const canHandle = plugin.canHandle(message, context);
            
            if (canHandle.match) {
                try {
                    const response = await plugin.handle(message, {
                        ...context,
                        matchType: canHandle.type,
                        matchValue: canHandle.command || canHandle.keyword || canHandle.intent
                    });
                    
                    if (response) {
                        return {
                            ...response,
                            pluginId: plugin.id,
                            pluginName: plugin.name
                        };
                    }
                } catch (error) {
                    this.emit('plugin-error', { pluginId: plugin.id, error: error.message });
                }
            }
        }
        
        // No plugin handled the message
        return null;
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: true,
            pluginCount: this.plugins.size,
            enabledCount: Array.from(this.plugins.values()).filter(p => p.enabled).length,
            plugins: this.getPlugins()
        };
    }

    /**
     * Cleanup
     */
    async destroy() {
        for (const plugin of this.plugins.values()) {
            await plugin.destroy();
        }
        this.plugins.clear();
        this.emit('destroyed');
    }
}

// Export
let instance = null;

module.exports = {
    ChatbotPluginManager,
    ChatbotPlugin,
    HelpPlugin,
    StatusPlugin,
    CalculatorPlugin,
    StrategyPlugin,
    AutomationPlugin,
    DebugPlugin,
    
    getInstance(options) {
        if (!instance) {
            instance = new ChatbotPluginManager(options);
        }
        return instance;
    }
};
