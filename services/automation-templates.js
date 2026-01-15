/**
 * Automation Templates Service
 * Pre-built automation templates for Evony gameplay
 * v2.0.9
 */

const EventEmitter = require('events');

/**
 * Template Categories
 */
const CATEGORIES = {
    RESOURCE: 'resource',
    COMBAT: 'combat',
    BUILDING: 'building',
    RESEARCH: 'research',
    ALLIANCE: 'alliance',
    DAILY: 'daily',
    EVENT: 'event',
    UTILITY: 'utility'
};

/**
 * Template Definition
 */
class AutomationTemplate {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.category = data.category;
        this.tags = data.tags || [];
        this.parameters = data.parameters || [];
        this.actions = data.actions || [];
        this.estimatedDuration = data.estimatedDuration || 0;
        this.requirements = data.requirements || [];
        this.version = data.version || '1.0.0';
        this.author = data.author || 'Svony Browser';
    }

    /**
     * Generate script with parameters
     */
    generateScript(params = {}) {
        const actions = [];
        
        for (const action of this.actions) {
            const processedAction = this._processAction(action, params);
            if (processedAction) {
                actions.push(processedAction);
            }
        }
        
        return {
            name: `${this.name} - ${new Date().toISOString()}`,
            description: this.description,
            startUrl: params.startUrl || 'https://www.evony.com',
            tags: [...this.tags, 'generated'],
            actions
        };
    }

    /**
     * Process action with parameter substitution
     */
    _processAction(action, params) {
        const processed = JSON.parse(JSON.stringify(action));
        
        // Substitute parameters
        const substitute = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'string') {
                    obj[key] = obj[key].replace(/\{\{(\w+)\}\}/g, (match, param) => {
                        return params[param] !== undefined ? params[param] : match;
                    });
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    substitute(obj[key]);
                }
            }
        };
        
        substitute(processed);
        return processed;
    }

    /**
     * Validate parameters
     */
    validateParams(params) {
        const errors = [];
        
        for (const param of this.parameters) {
            if (param.required && (params[param.name] === undefined || params[param.name] === '')) {
                errors.push(`Missing required parameter: ${param.name}`);
            }
            
            if (params[param.name] !== undefined) {
                // Type validation
                if (param.type === 'number' && isNaN(Number(params[param.name]))) {
                    errors.push(`Parameter ${param.name} must be a number`);
                }
                
                // Range validation
                if (param.min !== undefined && Number(params[param.name]) < param.min) {
                    errors.push(`Parameter ${param.name} must be at least ${param.min}`);
                }
                if (param.max !== undefined && Number(params[param.name]) > param.max) {
                    errors.push(`Parameter ${param.name} must be at most ${param.max}`);
                }
                
                // Options validation
                if (param.options && !param.options.includes(params[param.name])) {
                    errors.push(`Parameter ${param.name} must be one of: ${param.options.join(', ')}`);
                }
            }
        }
        
        return { valid: errors.length === 0, errors };
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            category: this.category,
            tags: this.tags,
            parameters: this.parameters,
            estimatedDuration: this.estimatedDuration,
            requirements: this.requirements,
            version: this.version,
            author: this.author,
            actionCount: this.actions.length
        };
    }
}

/**
 * Built-in Templates
 */
const BUILT_IN_TEMPLATES = [
    // Resource Collection
    {
        id: 'collect-resources',
        name: 'Collect All Resources',
        description: 'Automatically collect resources from all production buildings',
        category: CATEGORIES.RESOURCE,
        tags: ['resources', 'collection', 'daily'],
        parameters: [
            { name: 'cityCount', type: 'number', default: 1, min: 1, max: 10, description: 'Number of cities to collect from' }
        ],
        estimatedDuration: 30000,
        actions: [
            { type: 'wait', data: { selector: '.city-view', timeout: 10000 } },
            { type: 'click', data: { selector: '[data-action="collect-all"]' } },
            { type: 'wait', data: { duration: 2000 } },
            { type: 'assert', data: { assertType: 'visible', selector: '.collection-complete' } }
        ]
    },
    
    // Daily Tasks
    {
        id: 'daily-login-rewards',
        name: 'Claim Daily Login Rewards',
        description: 'Claim all available daily login rewards and bonuses',
        category: CATEGORIES.DAILY,
        tags: ['daily', 'rewards', 'login'],
        parameters: [],
        estimatedDuration: 20000,
        actions: [
            { type: 'wait', data: { selector: '.main-ui', timeout: 15000 } },
            { type: 'click', data: { selector: '[data-menu="events"]' } },
            { type: 'wait', data: { duration: 1000 } },
            { type: 'click', data: { selector: '[data-tab="daily-rewards"]' } },
            { type: 'wait', data: { duration: 1000 } },
            { type: 'click', data: { selector: '.claim-reward-btn:not(.claimed)' } },
            { type: 'wait', data: { duration: 2000 } }
        ]
    },
    
    // Monster Hunting
    {
        id: 'hunt-monsters',
        name: 'Hunt Monsters',
        description: 'Automatically hunt monsters on the world map',
        category: CATEGORIES.COMBAT,
        tags: ['combat', 'monsters', 'hunting'],
        parameters: [
            { name: 'monsterLevel', type: 'number', default: 1, min: 1, max: 15, description: 'Monster level to hunt' },
            { name: 'huntCount', type: 'number', default: 5, min: 1, max: 20, description: 'Number of monsters to hunt' },
            { name: 'troopType', type: 'string', default: 'ranged', options: ['infantry', 'ranged', 'cavalry', 'siege'], description: 'Troop type to use' }
        ],
        estimatedDuration: 60000,
        requirements: ['Available stamina', 'Troops available'],
        actions: [
            { type: 'click', data: { selector: '[data-view="world-map"]' } },
            { type: 'wait', data: { selector: '.world-map-loaded', timeout: 10000 } },
            { type: 'click', data: { selector: '[data-action="search"]' } },
            { type: 'wait', data: { duration: 500 } },
            { type: 'click', data: { selector: '[data-search="monster"]' } },
            { type: 'input', data: { selector: '[data-field="monster-level"]', value: '{{monsterLevel}}' } },
            { type: 'click', data: { selector: '[data-action="search-go"]' } },
            { type: 'wait', data: { duration: 2000 } },
            { type: 'click', data: { selector: '.monster-result:first-child' } },
            { type: 'wait', data: { duration: 1000 } },
            { type: 'click', data: { selector: '[data-action="attack"]' } },
            { type: 'wait', data: { duration: 1000 } },
            { type: 'click', data: { selector: '[data-action="march"]' } }
        ]
    },
    
    // Building Upgrade
    {
        id: 'upgrade-building',
        name: 'Upgrade Building',
        description: 'Upgrade a specific building in your city',
        category: CATEGORIES.BUILDING,
        tags: ['building', 'upgrade', 'construction'],
        parameters: [
            { name: 'buildingName', type: 'string', required: true, description: 'Name of the building to upgrade' },
            { name: 'useSpeedup', type: 'boolean', default: false, description: 'Use speedup items if available' }
        ],
        estimatedDuration: 15000,
        requirements: ['Sufficient resources', 'Builder available'],
        actions: [
            { type: 'click', data: { selector: '[data-view="city"]' } },
            { type: 'wait', data: { selector: '.city-view-loaded', timeout: 10000 } },
            { type: 'click', data: { selector: '[data-building="{{buildingName}}"]' } },
            { type: 'wait', data: { duration: 1000 } },
            { type: 'click', data: { selector: '[data-action="upgrade"]' } },
            { type: 'wait', data: { duration: 1000 } },
            { type: 'click', data: { selector: '[data-action="confirm-upgrade"]' } }
        ]
    },
    
    // Research
    {
        id: 'start-research',
        name: 'Start Research',
        description: 'Start a research project in the academy',
        category: CATEGORIES.RESEARCH,
        tags: ['research', 'academy', 'technology'],
        parameters: [
            { name: 'researchCategory', type: 'string', default: 'military', options: ['military', 'defense', 'development', 'advancement'], description: 'Research category' },
            { name: 'researchName', type: 'string', required: true, description: 'Name of the research' }
        ],
        estimatedDuration: 20000,
        requirements: ['Academy available', 'Sufficient resources'],
        actions: [
            { type: 'click', data: { selector: '[data-building="academy"]' } },
            { type: 'wait', data: { selector: '.academy-panel', timeout: 5000 } },
            { type: 'click', data: { selector: '[data-category="{{researchCategory}}"]' } },
            { type: 'wait', data: { duration: 1000 } },
            { type: 'click', data: { selector: '[data-research="{{researchName}}"]' } },
            { type: 'wait', data: { duration: 500 } },
            { type: 'click', data: { selector: '[data-action="start-research"]' } }
        ]
    },
    
    // Alliance Help
    {
        id: 'alliance-help',
        name: 'Help Alliance Members',
        description: 'Click all alliance help requests',
        category: CATEGORIES.ALLIANCE,
        tags: ['alliance', 'help', 'social'],
        parameters: [],
        estimatedDuration: 10000,
        actions: [
            { type: 'click', data: { selector: '[data-menu="alliance"]' } },
            { type: 'wait', data: { selector: '.alliance-panel', timeout: 5000 } },
            { type: 'click', data: { selector: '[data-action="help-all"]' } },
            { type: 'wait', data: { duration: 2000 } }
        ]
    },
    
    // Gather Resources
    {
        id: 'gather-resources',
        name: 'Send Troops to Gather',
        description: 'Send troops to gather resources on the world map',
        category: CATEGORIES.RESOURCE,
        tags: ['resources', 'gathering', 'troops'],
        parameters: [
            { name: 'resourceType', type: 'string', default: 'food', options: ['food', 'wood', 'stone', 'iron', 'gold'], description: 'Resource type to gather' },
            { name: 'resourceLevel', type: 'number', default: 5, min: 1, max: 12, description: 'Resource tile level' },
            { name: 'marchCount', type: 'number', default: 1, min: 1, max: 5, description: 'Number of marches to send' }
        ],
        estimatedDuration: 45000,
        requirements: ['Available march slots', 'Troops available'],
        actions: [
            { type: 'click', data: { selector: '[data-view="world-map"]' } },
            { type: 'wait', data: { selector: '.world-map-loaded', timeout: 10000 } },
            { type: 'click', data: { selector: '[data-action="search"]' } },
            { type: 'click', data: { selector: '[data-search="resource"]' } },
            { type: 'click', data: { selector: '[data-resource="{{resourceType}}"]' } },
            { type: 'input', data: { selector: '[data-field="resource-level"]', value: '{{resourceLevel}}' } },
            { type: 'click', data: { selector: '[data-action="search-go"]' } },
            { type: 'wait', data: { duration: 2000 } },
            { type: 'click', data: { selector: '.resource-result:first-child' } },
            { type: 'wait', data: { duration: 1000 } },
            { type: 'click', data: { selector: '[data-action="gather"]' } },
            { type: 'wait', data: { duration: 1000 } },
            { type: 'click', data: { selector: '[data-action="march"]' } }
        ]
    },
    
    // Train Troops
    {
        id: 'train-troops',
        name: 'Train Troops',
        description: 'Train troops in barracks or other military buildings',
        category: CATEGORIES.COMBAT,
        tags: ['troops', 'training', 'military'],
        parameters: [
            { name: 'building', type: 'string', default: 'barracks', options: ['barracks', 'archery-range', 'stables', 'workshop'], description: 'Training building' },
            { name: 'troopTier', type: 'number', default: 1, min: 1, max: 14, description: 'Troop tier to train' },
            { name: 'quantity', type: 'number', default: 100, min: 1, max: 100000, description: 'Number of troops to train' }
        ],
        estimatedDuration: 20000,
        requirements: ['Sufficient resources', 'Building not busy'],
        actions: [
            { type: 'click', data: { selector: '[data-building="{{building}}"]' } },
            { type: 'wait', data: { selector: '.training-panel', timeout: 5000 } },
            { type: 'click', data: { selector: '[data-tier="{{troopTier}}"]' } },
            { type: 'wait', data: { duration: 500 } },
            { type: 'input', data: { selector: '[data-field="quantity"]', value: '{{quantity}}' } },
            { type: 'click', data: { selector: '[data-action="train"]' } }
        ]
    },
    
    // Auto-Shield
    {
        id: 'activate-shield',
        name: 'Activate Peace Shield',
        description: 'Activate a peace shield to protect your city',
        category: CATEGORIES.UTILITY,
        tags: ['shield', 'protection', 'defense'],
        parameters: [
            { name: 'shieldDuration', type: 'string', default: '8h', options: ['8h', '24h', '3d', '7d'], description: 'Shield duration' }
        ],
        estimatedDuration: 10000,
        requirements: ['Shield item available'],
        actions: [
            { type: 'click', data: { selector: '[data-menu="items"]' } },
            { type: 'wait', data: { selector: '.items-panel', timeout: 5000 } },
            { type: 'click', data: { selector: '[data-category="special"]' } },
            { type: 'wait', data: { duration: 500 } },
            { type: 'click', data: { selector: '[data-item="peace-shield-{{shieldDuration}}"]' } },
            { type: 'click', data: { selector: '[data-action="use-item"]' } },
            { type: 'wait', data: { duration: 1000 } }
        ]
    },
    
    // Event Participation
    {
        id: 'event-boss',
        name: 'Attack Event Boss',
        description: 'Participate in server event boss battles',
        category: CATEGORIES.EVENT,
        tags: ['event', 'boss', 'combat'],
        parameters: [
            { name: 'bossName', type: 'string', required: true, description: 'Name of the event boss' },
            { name: 'attackCount', type: 'number', default: 3, min: 1, max: 10, description: 'Number of attacks' }
        ],
        estimatedDuration: 60000,
        requirements: ['Event active', 'Stamina available'],
        actions: [
            { type: 'click', data: { selector: '[data-menu="events"]' } },
            { type: 'wait', data: { selector: '.events-panel', timeout: 5000 } },
            { type: 'click', data: { selector: '[data-event="boss-battle"]' } },
            { type: 'wait', data: { duration: 1000 } },
            { type: 'click', data: { selector: '[data-boss="{{bossName}}"]' } },
            { type: 'wait', data: { duration: 500 } },
            { type: 'click', data: { selector: '[data-action="attack-boss"]' } },
            { type: 'wait', data: { duration: 3000 } }
        ]
    }
];

/**
 * Automation Templates Manager
 */
class AutomationTemplates extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            customTemplatesDir: options.customTemplatesDir || null,
            ...options
        };

        // Storage
        this.templates = new Map();
        this.customTemplates = new Map();
        
        // Load built-in templates
        this._loadBuiltInTemplates();
    }

    /**
     * Load built-in templates
     */
    _loadBuiltInTemplates() {
        for (const templateData of BUILT_IN_TEMPLATES) {
            const template = new AutomationTemplate(templateData);
            this.templates.set(template.id, template);
        }
    }

    /**
     * Get all templates
     */
    getTemplates(options = {}) {
        let templates = Array.from(this.templates.values());
        
        // Add custom templates
        templates = templates.concat(Array.from(this.customTemplates.values()));
        
        // Filter by category
        if (options.category) {
            templates = templates.filter(t => t.category === options.category);
        }
        
        // Filter by tag
        if (options.tag) {
            templates = templates.filter(t => t.tags.includes(options.tag));
        }
        
        // Search by name/description
        if (options.search) {
            const searchLower = options.search.toLowerCase();
            templates = templates.filter(t => 
                t.name.toLowerCase().includes(searchLower) ||
                t.description.toLowerCase().includes(searchLower)
            );
        }
        
        return templates.map(t => t.toJSON());
    }

    /**
     * Get template by ID
     */
    getTemplate(templateId) {
        return this.templates.get(templateId) || this.customTemplates.get(templateId);
    }

    /**
     * Get categories
     */
    getCategories() {
        return Object.values(CATEGORIES);
    }

    /**
     * Get all tags
     */
    getTags() {
        const tags = new Set();
        for (const template of this.templates.values()) {
            template.tags.forEach(tag => tags.add(tag));
        }
        for (const template of this.customTemplates.values()) {
            template.tags.forEach(tag => tags.add(tag));
        }
        return Array.from(tags).sort();
    }

    /**
     * Generate script from template
     */
    generateScript(templateId, params = {}) {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        
        // Validate parameters
        const validation = template.validateParams(params);
        if (!validation.valid) {
            throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
        }
        
        // Apply defaults
        const finalParams = {};
        for (const param of template.parameters) {
            finalParams[param.name] = params[param.name] !== undefined 
                ? params[param.name] 
                : param.default;
        }
        
        return template.generateScript(finalParams);
    }

    /**
     * Create custom template
     */
    createCustomTemplate(data) {
        const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const template = new AutomationTemplate({
            ...data,
            id,
            author: 'User'
        });
        
        this.customTemplates.set(id, template);
        this.emit('template-created', template.toJSON());
        return template;
    }

    /**
     * Update custom template
     */
    updateCustomTemplate(templateId, updates) {
        const template = this.customTemplates.get(templateId);
        if (!template) {
            throw new Error(`Custom template not found: ${templateId}`);
        }
        
        Object.assign(template, updates);
        this.emit('template-updated', template.toJSON());
        return template;
    }

    /**
     * Delete custom template
     */
    deleteCustomTemplate(templateId) {
        if (this.customTemplates.has(templateId)) {
            this.customTemplates.delete(templateId);
            this.emit('template-deleted', templateId);
            return true;
        }
        return false;
    }

    /**
     * Import template from JSON
     */
    importTemplate(jsonData) {
        const template = new AutomationTemplate({
            ...jsonData,
            id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        });
        
        this.customTemplates.set(template.id, template);
        this.emit('template-imported', template.toJSON());
        return template;
    }

    /**
     * Export template to JSON
     */
    exportTemplate(templateId) {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        
        return {
            ...template.toJSON(),
            actions: template.actions
        };
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: true,
            builtInCount: this.templates.size,
            customCount: this.customTemplates.size,
            totalCount: this.templates.size + this.customTemplates.size,
            categories: this.getCategories(),
            tags: this.getTags()
        };
    }
}

// Export singleton and class
let instance = null;

module.exports = {
    AutomationTemplates,
    AutomationTemplate,
    CATEGORIES,
    
    getInstance(options) {
        if (!instance) {
            instance = new AutomationTemplates(options);
        }
        return instance;
    }
};
