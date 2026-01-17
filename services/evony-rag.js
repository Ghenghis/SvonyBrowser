/**
 * Evony RAG (Retrieval-Augmented Generation) Service
 * Provides intelligent search and analysis of Evony knowledge base
 * 
 * Features:
 * - Search 339,160+ Evony data chunks
 * - Protocol analysis and command lookup
 * - Account pattern recognition
 * - Script generation assistance
 */

const { ipcRenderer } = require('electron');

class EvonyRAGService {
    constructor() {
        this.mode = 'research';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minute cache
        this.stats = null;
        this.initialized = false;
    }

    /**
     * Initialize the RAG service
     */
    async initialize() {
        try {
            // Get knowledge base stats
            this.stats = await this.getStats();
            console.log('[EvonyRAG] Initialized with', this.stats.chunks, 'chunks');
            
            // Pre-cache common queries
            await this.preCacheCommonQueries();
            
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('[EvonyRAG] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Get knowledge base statistics
     */
    async getStats() {
        try {
            const stats = await ipcRenderer.invoke('evony-rag-stats');
            return stats;
        } catch (error) {
            console.error('[EvonyRAG] Failed to get stats:', error);
            return { chunks: 0, symbols: 0, mode: 'unknown' };
        }
    }

    /**
     * Set RAG mode (research, forensics, full_access)
     */
    async setMode(mode) {
        try {
            await ipcRenderer.invoke('evony-rag-mode', mode);
            this.mode = mode;
            console.log('[EvonyRAG] Mode set to:', mode);
            return true;
        } catch (error) {
            console.error('[EvonyRAG] Failed to set mode:', error);
            return false;
        }
    }

    /**
     * Search the Evony knowledge base
     * @param {string} query - Search query
     * @param {number} k - Number of results (default: 10)
     * @returns {Promise<Array>} Search results
     */
    async search(query, k = 10) {
        const cacheKey = `search_${query}_${k}`;
        
        // Check cache
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log('[EvonyRAG] Cache hit for:', query);
            return cached;
        }

        try {
            const results = await ipcRenderer.invoke('evony-rag-search', query, k);
            this.setCache(cacheKey, results);
            return results;
        } catch (error) {
            console.error('[EvonyRAG] Search failed:', error);
            return [];
        }
    }

    /**
     * Search for protocol/command information
     */
    async searchProtocol(commandOrAction) {
        return await this.search(`Evony protocol command ${commandOrAction}`, 10);
    }

    /**
     * Search for script examples
     */
    async searchScripts(task) {
        return await this.search(`RoboEvony script ${task}`, 15);
    }

    /**
     * Search for account patterns
     */
    async searchAccountPatterns(pattern) {
        return await this.search(`account data ${pattern}`, 10);
    }

    /**
     * Get protocol command information
     */
    async getProtocolInfo(commandId) {
        const results = await this.search(`AMF3 command ID ${commandId}`, 5);
        return this.parseProtocolResults(results);
    }

    /**
     * Get script templates for a task
     */
    async getScriptTemplates(task) {
        const results = await this.search(`RoboEvony script template ${task}`, 10);
        return this.parseScriptResults(results);
    }

    /**
     * Analyze account data patterns
     */
    async analyzeAccountPattern(accountData) {
        // Search for similar patterns
        const patterns = await this.search('account optimization patterns', 10);
        
        // Generate analysis based on patterns
        return {
            patterns: patterns,
            recommendations: this.generateRecommendations(accountData, patterns)
        };
    }

    /**
     * Get building information
     */
    async getBuildingInfo(buildingType) {
        return await this.search(`building ${buildingType} requirements levels`, 8);
    }

    /**
     * Get troop information
     */
    async getTroopInfo(troopType) {
        return await this.search(`troop ${troopType} stats training`, 8);
    }

    /**
     * Get hero information
     */
    async getHeroInfo(heroName) {
        return await this.search(`hero ${heroName} stats skills`, 8);
    }

    /**
     * Get research information
     */
    async getResearchInfo(researchName) {
        return await this.search(`research ${researchName} requirements`, 8);
    }

    /**
     * Parse protocol search results
     */
    parseProtocolResults(results) {
        if (!results || results.length === 0) {
            return null;
        }

        return {
            raw: results,
            commands: results.filter(r => r.snippet.includes('command')),
            parameters: results.filter(r => r.snippet.includes('param')),
            examples: results.filter(r => r.snippet.includes('example'))
        };
    }

    /**
     * Parse script search results
     */
    parseScriptResults(results) {
        if (!results || results.length === 0) {
            return [];
        }

        return results.map(r => ({
            file: r.file,
            lines: r.lines,
            category: r.category,
            snippet: r.snippet,
            score: r.score
        }));
    }

    /**
     * Generate recommendations based on account data and patterns
     */
    generateRecommendations(accountData, patterns) {
        const recommendations = [];

        // Basic recommendations based on patterns
        if (patterns && patterns.length > 0) {
            patterns.forEach(pattern => {
                if (pattern.snippet.includes('optimization')) {
                    recommendations.push({
                        type: 'optimization',
                        description: 'Consider optimizing based on pattern',
                        source: pattern.file
                    });
                }
            });
        }

        return recommendations;
    }

    /**
     * Pre-cache common queries for faster access
     */
    async preCacheCommonQueries() {
        const commonQueries = [
            'sessionToken authentication',
            'AMF3 packet structure',
            'login protocol',
            'city commands',
            'army march',
            'hero recruitment',
            'building upgrade',
            'research tree'
        ];

        console.log('[EvonyRAG] Pre-caching common queries...');
        
        for (const query of commonQueries) {
            try {
                await this.search(query, 5);
            } catch (error) {
                console.warn('[EvonyRAG] Failed to cache:', query);
            }
        }

        console.log('[EvonyRAG] Pre-caching complete');
    }

    /**
     * Get from cache with expiry check
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Set cache with timestamp
     */
    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('[EvonyRAG] Cache cleared');
    }

    /**
     * Get cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            timeout: this.cacheTimeout
        };
    }
}

// Protocol categories for organized searching
const PROTOCOL_CATEGORIES = {
    city: ['getInfo', 'upgrade', 'build', 'demolish', 'rename'],
    army: ['march', 'recall', 'train', 'dismiss', 'reinforce'],
    hero: ['recruit', 'fire', 'equip', 'levelup', 'assign'],
    alliance: ['join', 'leave', 'donate', 'chat', 'help'],
    research: ['start', 'cancel', 'queue'],
    quest: ['accept', 'complete', 'claim'],
    mail: ['read', 'delete', 'send'],
    shop: ['buy', 'sell', 'refresh']
};

// Script templates for common tasks
const SCRIPT_TEMPLATES = {
    resourceFeeding: {
        name: 'Resource Feeding',
        description: 'Feed resources to a target city',
        searchQuery: 'resource feeding transport'
    },
    troopTraining: {
        name: 'Troop Training',
        description: 'Automated troop training',
        searchQuery: 'troop training automation'
    },
    buildingQueue: {
        name: 'Building Queue',
        description: 'Manage building construction queue',
        searchQuery: 'building queue management'
    },
    heroManagement: {
        name: 'Hero Management',
        description: 'Recruit and manage heroes',
        searchQuery: 'hero recruitment management'
    },
    allianceHelp: {
        name: 'Alliance Help',
        description: 'Auto-help alliance members',
        searchQuery: 'alliance help automation'
    }
};

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EvonyRAGService,
        PROTOCOL_CATEGORIES,
        SCRIPT_TEMPLATES
    };
}

// Also expose to window for browser context
if (typeof window !== 'undefined') {
    window.EvonyRAGService = EvonyRAGService;
    window.PROTOCOL_CATEGORIES = PROTOCOL_CATEGORIES;
    window.SCRIPT_TEMPLATES = SCRIPT_TEMPLATES;
}
