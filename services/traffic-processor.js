/**
 * Traffic Processor Service
 * Processes captured traffic, decodes AMF3, and feeds to game state tracker
 * v2.0.7 - Critical integration component
 */

const EventEmitter = require('events');
const { AMF3Decoder } = require('./amf3-decoder');

/**
 * Traffic Processor - bridges traffic capture to game state
 */
class TrafficProcessor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.decoder = new AMF3Decoder();
        this.gameStateTracker = options.gameStateTracker;
        this.protocolHandler = options.protocolHandler;
        
        // Processing statistics
        this.stats = {
            totalProcessed: 0,
            successfulDecodes: 0,
            failedDecodes: 0,
            stateUpdates: 0,
            startTime: Date.now()
        };
        
        // Buffer for incomplete packets
        this.packetBuffer = new Map();
        
        // Action handlers for specific game actions
        this.actionHandlers = this.initializeActionHandlers();
        
        // Patterns to detect
        this.patterns = this.initializePatterns();
        
        // Processing queue for async handling
        this.processingQueue = [];
        this.isProcessing = false;
        this.maxQueueSize = 1000;
        
        console.log('[TrafficProcessor] Initialized');
    }
    
    /**
     * Initialize action handlers for specific game actions
     */
    initializeActionHandlers() {
        return {
            // Player actions
            'player.getInfo': this.handlePlayerInfo.bind(this),
            'player.login': this.handlePlayerLogin.bind(this),
            'player.logout': this.handlePlayerLogout.bind(this),
            
            // City actions
            'city.getInfo': this.handleCityInfo.bind(this),
            'city.getBuildings': this.handleCityBuildings.bind(this),
            'city.getTroops': this.handleCityTroops.bind(this),
            'city.getResources': this.handleCityResources.bind(this),
            
            // Hero actions
            'hero.getInfo': this.handleHeroInfo.bind(this),
            'hero.getList': this.handleHeroList.bind(this),
            'hero.levelUp': this.handleHeroLevelUp.bind(this),
            
            // Army actions
            'army.getInfo': this.handleArmyInfo.bind(this),
            'army.march': this.handleArmyMarch.bind(this),
            'army.recall': this.handleArmyRecall.bind(this),
            'army.arrived': this.handleArmyArrived.bind(this),
            
            // Combat actions
            'battle.report': this.handleBattleReport.bind(this),
            'battle.result': this.handleBattleResult.bind(this),
            
            // Resource actions
            'resource.gather': this.handleResourceGather.bind(this),
            'resource.update': this.handleResourceUpdate.bind(this),
            
            // Alliance actions
            'alliance.getInfo': this.handleAllianceInfo.bind(this),
            'alliance.getMembers': this.handleAllianceMembers.bind(this),
            
            // Map actions
            'map.getTile': this.handleMapTile.bind(this),
            'map.scan': this.handleMapScan.bind(this),
            
            // Mail actions
            'mail.getList': this.handleMailList.bind(this),
            'mail.read': this.handleMailRead.bind(this),
            
            // Quest actions
            'quest.getList': this.handleQuestList.bind(this),
            'quest.complete': this.handleQuestComplete.bind(this)
        };
    }
    
    /**
     * Initialize patterns for detection
     */
    initializePatterns() {
        return [
            {
                id: 'login',
                match: (action, data) => action === 'player.login' && data?.success,
                priority: 'high'
            },
            {
                id: 'attack_incoming',
                match: (action, data) => action === 'army.march' && data?.targetPlayerId,
                priority: 'critical'
            },
            {
                id: 'resources_low',
                match: (action, data) => {
                    if (action !== 'city.getResources') return false;
                    const resources = data?.resources || {};
                    return Object.values(resources).some(r => r < 10000);
                },
                priority: 'medium'
            },
            {
                id: 'hero_idle',
                match: (action, data) => action === 'hero.getList' && 
                    data?.heroes?.some(h => h.status === 'idle'),
                priority: 'low'
            },
            {
                id: 'battle_lost',
                match: (action, data) => action === 'battle.result' && !data?.victory,
                priority: 'high'
            }
        ];
    }
    
    /**
     * Process incoming traffic entry
     */
    async process(entry) {
        // Add to queue
        if (this.processingQueue.length >= this.maxQueueSize) {
            this.processingQueue.shift(); // Remove oldest
        }
        this.processingQueue.push(entry);
        
        // Process queue if not already processing
        if (!this.isProcessing) {
            await this.processQueue();
        }
    }
    
    /**
     * Process the queue
     */
    async processQueue() {
        this.isProcessing = true;
        
        while (this.processingQueue.length > 0) {
            const entry = this.processingQueue.shift();
            await this.processEntry(entry);
        }
        
        this.isProcessing = false;
    }
    
    /**
     * Process a single traffic entry
     */
    async processEntry(entry) {
        this.stats.totalProcessed++;
        
        try {
            // Extract and decode data
            const decoded = await this.decodeEntry(entry);
            
            if (!decoded) {
                this.stats.failedDecodes++;
                return;
            }
            
            this.stats.successfulDecodes++;
            
            // Determine action from entry
            const action = this.extractAction(entry, decoded);
            
            // Emit decoded event
            this.emit('decoded', {
                entry,
                decoded,
                action,
                timestamp: Date.now()
            });
            
            // Handle specific action
            if (action && this.actionHandlers[action]) {
                await this.actionHandlers[action](decoded, entry);
                this.stats.stateUpdates++;
            }
            
            // Check patterns
            this.checkPatterns(action, decoded);
            
            // Update game state tracker
            if (this.gameStateTracker) {
                this.gameStateTracker.processPacket({
                    action,
                    data: decoded,
                    direction: entry.direction,
                    timestamp: entry.timestamp || Date.now()
                });
            }
            
        } catch (error) {
            this.stats.failedDecodes++;
            this.emit('error', {
                entry,
                error: error.message
            });
        }
    }
    
    /**
     * Decode traffic entry data
     */
    async decodeEntry(entry) {
        // Get raw data
        let rawData = entry.body || entry.data || entry.payload;
        
        if (!rawData) {
            return null;
        }
        
        // Convert to hex if needed
        let hexData;
        if (Buffer.isBuffer(rawData)) {
            hexData = rawData.toString('hex');
        } else if (typeof rawData === 'string') {
            // Check if already hex
            if (/^[0-9a-fA-F]+$/.test(rawData.replace(/\s/g, ''))) {
                hexData = rawData;
            } else {
                // Try base64
                try {
                    hexData = Buffer.from(rawData, 'base64').toString('hex');
                } catch {
                    hexData = Buffer.from(rawData).toString('hex');
                }
            }
        } else if (typeof rawData === 'object') {
            // Already decoded
            return rawData;
        }
        
        if (!hexData || hexData.length < 2) {
            return null;
        }
        
        // Try AMF3 packet decode first
        let decoded = this.decoder.decodePacket(hexData);
        
        if (decoded.error) {
            // Try raw AMF3 decode
            decoded = this.decoder.decode(hexData);
        }
        
        if (decoded.error) {
            return null;
        }
        
        return decoded;
    }
    
    /**
     * Extract action name from entry
     */
    extractAction(entry, decoded) {
        // Check entry for action
        if (entry.action) return entry.action;
        if (entry.method) return entry.method;
        if (entry.cmd) return entry.cmd;
        
        // Check URL for action
        if (entry.url) {
            const match = entry.url.match(/\/([a-z]+)\.([a-z]+)/i);
            if (match) {
                return `${match[1]}.${match[2]}`;
            }
        }
        
        // Check decoded data for action
        if (decoded?.messages?.[0]?.targetURI) {
            return decoded.messages[0].targetURI;
        }
        
        if (decoded?.action) return decoded.action;
        if (decoded?.cmd) return decoded.cmd;
        
        return null;
    }
    
    /**
     * Check patterns against action and data
     */
    checkPatterns(action, data) {
        for (const pattern of this.patterns) {
            try {
                if (pattern.match(action, data)) {
                    this.emit('pattern-detected', {
                        patternId: pattern.id,
                        priority: pattern.priority,
                        action,
                        data,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                // Pattern match error, skip
            }
        }
    }
    
    // ========================================================================
    // Action Handlers
    // ========================================================================
    
    handlePlayerInfo(data, entry) {
        if (!this.gameStateTracker) return;
        
        const playerData = data?.messages?.[0]?.value || data;
        this.gameStateTracker.updatePlayer(playerData);
        
        this.emit('player-updated', playerData);
    }
    
    handlePlayerLogin(data, entry) {
        if (!this.gameStateTracker) return;
        
        const playerData = data?.messages?.[0]?.value || data;
        this.gameStateTracker.updatePlayer(playerData);
        
        this.emit('player-logged-in', playerData);
    }
    
    handlePlayerLogout(data, entry) {
        this.emit('player-logged-out', {});
    }
    
    handleCityInfo(data, entry) {
        if (!this.gameStateTracker) return;
        
        const cityData = data?.messages?.[0]?.value || data;
        if (cityData?.cityId) {
            this.gameStateTracker.updateCity(cityData.cityId, cityData);
        }
        
        this.emit('city-updated', cityData);
    }
    
    handleCityBuildings(data, entry) {
        if (!this.gameStateTracker) return;
        
        const buildingData = data?.messages?.[0]?.value || data;
        if (buildingData?.cityId && buildingData?.buildings) {
            this.gameStateTracker.updateCityBuildings(
                buildingData.cityId, 
                buildingData.buildings
            );
        }
    }
    
    handleCityTroops(data, entry) {
        if (!this.gameStateTracker) return;
        
        const troopData = data?.messages?.[0]?.value || data;
        if (troopData?.cityId && troopData?.troops) {
            this.gameStateTracker.updateCityTroops(
                troopData.cityId, 
                troopData.troops
            );
        }
    }
    
    handleCityResources(data, entry) {
        if (!this.gameStateTracker) return;
        
        const resourceData = data?.messages?.[0]?.value || data;
        if (resourceData?.resources) {
            this.gameStateTracker.updateResources(resourceData.resources);
        }
        
        this.emit('resources-updated', resourceData);
    }
    
    handleHeroInfo(data, entry) {
        if (!this.gameStateTracker) return;
        
        const heroData = data?.messages?.[0]?.value || data;
        if (heroData?.heroId) {
            this.gameStateTracker.updateHero(heroData.heroId, heroData);
        }
    }
    
    handleHeroList(data, entry) {
        if (!this.gameStateTracker) return;
        
        const heroList = data?.messages?.[0]?.value?.heroes || data?.heroes || [];
        for (const hero of heroList) {
            if (hero?.heroId) {
                this.gameStateTracker.updateHero(hero.heroId, hero);
            }
        }
        
        this.emit('heroes-updated', heroList);
    }
    
    handleHeroLevelUp(data, entry) {
        if (!this.gameStateTracker) return;
        
        const heroData = data?.messages?.[0]?.value || data;
        if (heroData?.heroId) {
            this.gameStateTracker.updateHero(heroData.heroId, heroData);
        }
        
        this.emit('hero-leveled-up', heroData);
    }
    
    handleArmyInfo(data, entry) {
        if (!this.gameStateTracker) return;
        
        const armyData = data?.messages?.[0]?.value || data;
        if (armyData?.armyId) {
            this.gameStateTracker.updateArmy(armyData.armyId, armyData);
        }
    }
    
    handleArmyMarch(data, entry) {
        if (!this.gameStateTracker) return;
        
        const marchData = data?.messages?.[0]?.value || data;
        if (marchData?.armyId) {
            this.gameStateTracker.updateArmy(marchData.armyId, {
                ...marchData,
                status: 'marching'
            });
        }
        
        this.emit('army-marching', marchData);
    }
    
    handleArmyRecall(data, entry) {
        if (!this.gameStateTracker) return;
        
        const recallData = data?.messages?.[0]?.value || data;
        if (recallData?.armyId) {
            this.gameStateTracker.updateArmy(recallData.armyId, {
                ...recallData,
                status: 'returning'
            });
        }
        
        this.emit('army-recalled', recallData);
    }
    
    handleArmyArrived(data, entry) {
        if (!this.gameStateTracker) return;
        
        const arrivalData = data?.messages?.[0]?.value || data;
        if (arrivalData?.armyId) {
            this.gameStateTracker.updateArmy(arrivalData.armyId, {
                ...arrivalData,
                status: 'idle'
            });
        }
        
        this.emit('army-arrived', arrivalData);
    }
    
    handleBattleReport(data, entry) {
        const reportData = data?.messages?.[0]?.value || data;
        this.emit('battle-report', reportData);
    }
    
    handleBattleResult(data, entry) {
        const resultData = data?.messages?.[0]?.value || data;
        this.emit('battle-result', resultData);
    }
    
    handleResourceGather(data, entry) {
        if (!this.gameStateTracker) return;
        
        const gatherData = data?.messages?.[0]?.value || data;
        if (gatherData?.resources) {
            this.gameStateTracker.updateResources(gatherData.resources);
        }
    }
    
    handleResourceUpdate(data, entry) {
        if (!this.gameStateTracker) return;
        
        const resourceData = data?.messages?.[0]?.value || data;
        if (resourceData?.resources) {
            this.gameStateTracker.updateResources(resourceData.resources);
        }
    }
    
    handleAllianceInfo(data, entry) {
        if (!this.gameStateTracker) return;
        
        const allianceData = data?.messages?.[0]?.value || data;
        this.gameStateTracker.updateAlliance(allianceData);
        
        this.emit('alliance-updated', allianceData);
    }
    
    handleAllianceMembers(data, entry) {
        const memberData = data?.messages?.[0]?.value || data;
        this.emit('alliance-members', memberData);
    }
    
    handleMapTile(data, entry) {
        const tileData = data?.messages?.[0]?.value || data;
        this.emit('map-tile', tileData);
    }
    
    handleMapScan(data, entry) {
        const scanData = data?.messages?.[0]?.value || data;
        this.emit('map-scan', scanData);
    }
    
    handleMailList(data, entry) {
        const mailData = data?.messages?.[0]?.value || data;
        this.emit('mail-list', mailData);
    }
    
    handleMailRead(data, entry) {
        const mailData = data?.messages?.[0]?.value || data;
        this.emit('mail-read', mailData);
    }
    
    handleQuestList(data, entry) {
        const questData = data?.messages?.[0]?.value || data;
        this.emit('quest-list', questData);
    }
    
    handleQuestComplete(data, entry) {
        const questData = data?.messages?.[0]?.value || data;
        this.emit('quest-complete', questData);
    }
    
    // ========================================================================
    // Utility Methods
    // ========================================================================
    
    /**
     * Get current status
     */
    getStatus() {
        return {
            isProcessing: this.isProcessing,
            queueSize: this.processingQueue.length,
            bufferSize: this.packetBuffer.size,
            hasGameStateTracker: !!this.gameStateTracker,
            hasProtocolHandler: !!this.protocolHandler,
            stats: this.getStats()
        };
    }
    
    /**
     * Get processing statistics
     */
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        return {
            ...this.stats,
            uptime,
            processRate: this.stats.totalProcessed / (uptime / 1000),
            successRate: this.stats.totalProcessed > 0 
                ? (this.stats.successfulDecodes / this.stats.totalProcessed * 100).toFixed(2) + '%'
                : '0%',
            queueSize: this.processingQueue.length
        };
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalProcessed: 0,
            successfulDecodes: 0,
            failedDecodes: 0,
            stateUpdates: 0,
            startTime: Date.now()
        };
    }
    
    /**
     * Add custom action handler
     */
    addActionHandler(action, handler) {
        this.actionHandlers[action] = handler;
    }
    
    /**
     * Add custom pattern
     */
    addPattern(pattern) {
        this.patterns.push(pattern);
    }
    
    /**
     * Set game state tracker
     */
    setGameStateTracker(tracker) {
        this.gameStateTracker = tracker;
    }
    
    /**
     * Set protocol handler
     */
    setProtocolHandler(handler) {
        this.protocolHandler = handler;
    }
}

module.exports = { TrafficProcessor };
