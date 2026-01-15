/**
 * Game State Tracker
 * Tracks real-time game state from traffic analysis
 * Maintains player, city, army, and world state
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

class GameStateTracker extends EventEmitter {
    constructor() {
        super();
        
        // Core game state
        this.state = {
            player: {
                id: null,
                name: null,
                level: null,
                prestige: null,
                alliance: null,
                allianceId: null,
                gold: 0,
                gems: 0,
                vip: 0
            },
            cities: new Map(),
            currentCity: null,
            armies: new Map(),
            heroes: new Map(),
            marches: new Map(),
            world: {
                server: null,
                tiles: new Map(),
                npcs: new Map(),
                bosses: new Map()
            },
            alliance: {
                id: null,
                name: null,
                members: new Map(),
                territory: []
            },
            buffs: [],
            items: new Map(),
            mail: [],
            events: []
        };
        
        // State change history
        this.history = [];
        this.maxHistoryLength = 1000;
        
        // Action handlers map protocol actions to state updates
        this.actionHandlers = {
            // City actions
            'city.getInfo': this.handleCityInfo.bind(this),
            'city.getBuildings': this.handleCityBuildings.bind(this),
            'city.getResources': this.handleCityResources.bind(this),
            'city.upgrade': this.handleCityUpgrade.bind(this),
            
            // Army actions
            'army.getInfo': this.handleArmyInfo.bind(this),
            'army.train': this.handleArmyTrain.bind(this),
            'army.dismiss': this.handleArmyDismiss.bind(this),
            
            // Hero actions
            'hero.getInfo': this.handleHeroInfo.bind(this),
            'hero.levelUp': this.handleHeroLevelUp.bind(this),
            'hero.equip': this.handleHeroEquip.bind(this),
            
            // March actions
            'march.start': this.handleMarchStart.bind(this),
            'march.cancel': this.handleMarchCancel.bind(this),
            'march.return': this.handleMarchReturn.bind(this),
            'march.arrive': this.handleMarchArrive.bind(this),
            
            // Map actions
            'map.getTile': this.handleMapTile.bind(this),
            'map.scout': this.handleMapScout.bind(this),
            
            // Alliance actions
            'alliance.getInfo': this.handleAllianceInfo.bind(this),
            'alliance.getMembers': this.handleAllianceMembers.bind(this),
            
            // Player actions
            'player.getInfo': this.handlePlayerInfo.bind(this),
            'player.getBuffs': this.handlePlayerBuffs.bind(this),
            
            // Trade actions
            'trade.getMarket': this.handleMarketInfo.bind(this),
            
            // Quest actions
            'quest.getList': this.handleQuestList.bind(this),
            'quest.complete': this.handleQuestComplete.bind(this)
        };
        
        this.isTracking = false;
        
        // Persistence configuration
        this.persistencePath = null;
        this.autoSaveInterval = null;
        this.autoSaveDelay = 30000; // 30 seconds
        this.isDirty = false;
    }
    
    /**
     * Start tracking game state
     */
    startTracking() {
        this.isTracking = true;
        this.emit('tracking-started');
    }
    
    /**
     * Stop tracking game state
     */
    stopTracking() {
        this.isTracking = false;
        this.emit('tracking-stopped');
    }
    
    /**
     * Process a decoded packet and update state
     */
    processPacket(packet) {
        if (!this.isTracking) return;
        if (!packet.action) return;
        
        const handler = this.actionHandlers[packet.action];
        
        if (handler) {
            try {
                const changes = handler(packet);
                
                if (changes && Object.keys(changes).length > 0) {
                    this.recordChange(packet.action, changes);
                    this.emit('state-changed', {
                        action: packet.action,
                        changes,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.error(`[GameStateTracker] Error processing ${packet.action}:`, error);
            }
        }
        
        // Emit raw action for custom handlers
        this.emit('action', packet);
    }
    
    /**
     * Record state change in history
     */
    recordChange(action, changes) {
        this.history.push({
            timestamp: Date.now(),
            action,
            changes
        });
        
        // Trim history
        if (this.history.length > this.maxHistoryLength) {
            this.history = this.history.slice(-this.maxHistoryLength);
        }
        
        // Mark as dirty for auto-save
        this.isDirty = true;
    }
    
    // ==================== Action Handlers ====================
    
    handlePlayerInfo(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        const changes = {};
        
        if (data.playerId) {
            this.state.player.id = data.playerId;
            changes.playerId = data.playerId;
        }
        if (data.playerName) {
            this.state.player.name = data.playerName;
            changes.playerName = data.playerName;
        }
        if (data.level !== undefined) {
            this.state.player.level = data.level;
            changes.level = data.level;
        }
        if (data.prestige !== undefined) {
            this.state.player.prestige = data.prestige;
            changes.prestige = data.prestige;
        }
        if (data.gold !== undefined) {
            this.state.player.gold = data.gold;
            changes.gold = data.gold;
        }
        if (data.gems !== undefined) {
            this.state.player.gems = data.gems;
            changes.gems = data.gems;
        }
        if (data.vip !== undefined) {
            this.state.player.vip = data.vip;
            changes.vip = data.vip;
        }
        
        this.emit('player-updated', this.state.player);
        return changes;
    }
    
    handleCityInfo(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        const cityId = data.cityId || data.id;
        if (!cityId) return {};
        
        const city = this.state.cities.get(cityId) || {
            id: cityId,
            name: null,
            x: null,
            y: null,
            level: null,
            buildings: new Map(),
            resources: {},
            troops: {},
            queue: []
        };
        
        const changes = { cityId };
        
        if (data.cityName) {
            city.name = data.cityName;
            changes.cityName = data.cityName;
        }
        if (data.x !== undefined) city.x = data.x;
        if (data.y !== undefined) city.y = data.y;
        if (data.level !== undefined) {
            city.level = data.level;
            changes.cityLevel = data.level;
        }
        if (data.resources) {
            city.resources = { ...city.resources, ...data.resources };
            changes.resources = data.resources;
        }
        
        this.state.cities.set(cityId, city);
        
        // Set as current city if first or explicitly set
        if (!this.state.currentCity || data.isCurrent) {
            this.state.currentCity = cityId;
        }
        
        this.emit('city-updated', city);
        return changes;
    }
    
    handleCityBuildings(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data || !data.buildings) return {};
        
        const cityId = data.cityId || this.state.currentCity;
        if (!cityId) return {};
        
        const city = this.state.cities.get(cityId);
        if (!city) return {};
        
        const changes = { cityId, buildings: [] };
        
        for (const building of data.buildings) {
            city.buildings.set(building.position || building.id, {
                type: building.type,
                level: building.level,
                position: building.position,
                upgrading: building.upgrading || false,
                completeTime: building.completeTime
            });
            changes.buildings.push(building);
        }
        
        this.emit('buildings-updated', { cityId, buildings: Array.from(city.buildings.values()) });
        return changes;
    }
    
    handleCityResources(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        const cityId = data.cityId || this.state.currentCity;
        if (!cityId) return {};
        
        const city = this.state.cities.get(cityId);
        if (!city) return {};
        
        const changes = { cityId };
        
        const resourceTypes = ['food', 'lumber', 'stone', 'iron', 'gold'];
        for (const type of resourceTypes) {
            if (data[type] !== undefined) {
                city.resources[type] = data[type];
                changes[type] = data[type];
            }
        }
        
        this.emit('resources-updated', { cityId, resources: city.resources });
        return changes;
    }
    
    handleCityUpgrade(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        return {
            upgrade: {
                building: data.buildingType,
                level: data.newLevel,
                completeTime: data.completeTime
            }
        };
    }
    
    handleArmyInfo(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        const cityId = data.cityId || this.state.currentCity;
        if (!cityId) return {};
        
        const city = this.state.cities.get(cityId);
        if (!city) return {};
        
        const changes = { cityId, troops: {} };
        
        if (data.troops) {
            for (const [type, count] of Object.entries(data.troops)) {
                city.troops[type] = count;
                changes.troops[type] = count;
            }
        }
        
        this.emit('army-updated', { cityId, troops: city.troops });
        return changes;
    }
    
    handleArmyTrain(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        return {
            training: {
                troopType: data.troopType,
                quantity: data.quantity,
                completeTime: data.completeTime
            }
        };
    }
    
    handleArmyDismiss(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        return {
            dismissed: {
                troopType: data.troopType,
                quantity: data.quantity
            }
        };
    }
    
    handleHeroInfo(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        const heroId = data.heroId || data.id;
        if (!heroId) return {};
        
        const hero = {
            id: heroId,
            name: data.name,
            level: data.level,
            star: data.star,
            quality: data.quality,
            attack: data.attack,
            defense: data.defense,
            politics: data.politics,
            leadership: data.leadership,
            skills: data.skills || [],
            equipment: data.equipment || {},
            experience: data.experience,
            status: data.status
        };
        
        this.state.heroes.set(heroId, hero);
        this.emit('hero-updated', hero);
        
        return { heroId, hero };
    }
    
    handleHeroLevelUp(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        const hero = this.state.heroes.get(data.heroId);
        if (hero) {
            hero.level = data.newLevel;
            hero.experience = data.experience;
            this.emit('hero-updated', hero);
        }
        
        return { heroId: data.heroId, newLevel: data.newLevel };
    }
    
    handleHeroEquip(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        const hero = this.state.heroes.get(data.heroId);
        if (hero && data.slot && data.item) {
            hero.equipment[data.slot] = data.item;
            this.emit('hero-updated', hero);
        }
        
        return { heroId: data.heroId, slot: data.slot, item: data.item };
    }
    
    handleMarchStart(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        const marchId = data.marchId || Date.now().toString();
        
        const march = {
            id: marchId,
            type: data.type,
            fromX: data.fromX,
            fromY: data.fromY,
            toX: data.toX,
            toY: data.toY,
            troops: data.troops,
            hero: data.heroId,
            startTime: data.startTime || Date.now(),
            arriveTime: data.arriveTime,
            status: 'marching'
        };
        
        this.state.marches.set(marchId, march);
        this.emit('march-started', march);
        
        return { marchId, march };
    }
    
    handleMarchCancel(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data || !data.marchId) return {};
        
        const march = this.state.marches.get(data.marchId);
        if (march) {
            march.status = 'cancelled';
            this.emit('march-cancelled', march);
        }
        
        this.state.marches.delete(data.marchId);
        
        return { marchId: data.marchId, cancelled: true };
    }
    
    handleMarchReturn(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data || !data.marchId) return {};
        
        const march = this.state.marches.get(data.marchId);
        if (march) {
            march.status = 'returning';
            march.returnTime = data.returnTime;
            this.emit('march-returning', march);
        }
        
        return { marchId: data.marchId, returning: true };
    }
    
    handleMarchArrive(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data || !data.marchId) return {};
        
        const march = this.state.marches.get(data.marchId);
        if (march) {
            march.status = 'arrived';
            march.result = data.result;
            this.emit('march-arrived', march);
        }
        
        this.state.marches.delete(data.marchId);
        
        return { marchId: data.marchId, arrived: true, result: data.result };
    }
    
    handleMapTile(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        const key = `${data.x},${data.y}`;
        
        const tile = {
            x: data.x,
            y: data.y,
            type: data.type,
            level: data.level,
            owner: data.owner,
            alliance: data.alliance,
            troops: data.troops,
            resources: data.resources
        };
        
        this.state.world.tiles.set(key, tile);
        this.emit('tile-updated', tile);
        
        return { tile };
    }
    
    handleMapScout(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        return {
            scout: {
                x: data.x,
                y: data.y,
                result: data.result
            }
        };
    }
    
    handleAllianceInfo(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        const changes = {};
        
        if (data.allianceId) {
            this.state.alliance.id = data.allianceId;
            this.state.player.allianceId = data.allianceId;
            changes.allianceId = data.allianceId;
        }
        if (data.allianceName) {
            this.state.alliance.name = data.allianceName;
            this.state.player.alliance = data.allianceName;
            changes.allianceName = data.allianceName;
        }
        
        this.emit('alliance-updated', this.state.alliance);
        return changes;
    }
    
    handleAllianceMembers(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data || !data.members) return {};
        
        for (const member of data.members) {
            this.state.alliance.members.set(member.id, {
                id: member.id,
                name: member.name,
                level: member.level,
                prestige: member.prestige,
                rank: member.rank
            });
        }
        
        this.emit('alliance-members-updated', Array.from(this.state.alliance.members.values()));
        return { memberCount: data.members.length };
    }
    
    handlePlayerBuffs(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data || !data.buffs) return {};
        
        this.state.buffs = data.buffs.map(b => ({
            id: b.id,
            type: b.type,
            value: b.value,
            expireTime: b.expireTime
        }));
        
        this.emit('buffs-updated', this.state.buffs);
        return { buffCount: this.state.buffs.length };
    }
    
    handleMarketInfo(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        return { market: data };
    }
    
    handleQuestList(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data || !data.quests) return {};
        
        return { questCount: data.quests.length };
    }
    
    handleQuestComplete(packet) {
        const data = packet.decoded?.messages?.[0]?.value;
        if (!data) return {};
        
        return {
            quest: {
                id: data.questId,
                rewards: data.rewards
            }
        };
    }
    
    // ==================== State Access Methods ====================
    
    /**
     * Get current game state
     */
    getState() {
        return {
            player: { ...this.state.player },
            currentCity: this.state.currentCity,
            cities: Array.from(this.state.cities.values()),
            heroes: Array.from(this.state.heroes.values()),
            marches: Array.from(this.state.marches.values()),
            buffs: [...this.state.buffs],
            alliance: {
                ...this.state.alliance,
                members: Array.from(this.state.alliance.members.values())
            }
        };
    }
    
    /**
     * Get player info
     */
    getPlayer() {
        return { ...this.state.player };
    }
    
    /**
     * Get city by ID
     */
    getCity(cityId) {
        const city = this.state.cities.get(cityId || this.state.currentCity);
        if (!city) return null;
        
        return {
            ...city,
            buildings: Array.from(city.buildings.values())
        };
    }
    
    /**
     * Get all cities
     */
    getCities() {
        return Array.from(this.state.cities.values()).map(city => ({
            ...city,
            buildings: Array.from(city.buildings.values())
        }));
    }
    
    /**
     * Get hero by ID
     */
    getHero(heroId) {
        return this.state.heroes.get(heroId);
    }
    
    /**
     * Get all heroes
     */
    getHeroes() {
        return Array.from(this.state.heroes.values());
    }
    
    /**
     * Get active marches
     */
    getMarches() {
        return Array.from(this.state.marches.values());
    }
    
    /**
     * Get state history
     */
    getHistory(limit = 100) {
        return this.history.slice(-limit);
    }
    
    /**
     * Get status
     */
    getStatus() {
        return {
            tracking: this.isTracking,
            playerName: this.state.player.name,
            cityCount: this.state.cities.size,
            heroCount: this.state.heroes.size,
            marchCount: this.state.marches.size,
            historyLength: this.history.length
        };
    }
    
    // ==================== Persistence Methods ====================
    
    /**
     * Configure persistence
     */
    configurePersistence(options = {}) {
        if (options.path) {
            this.persistencePath = options.path;
        }
        if (options.autoSaveDelay) {
            this.autoSaveDelay = options.autoSaveDelay;
        }
        
        // Start auto-save if enabled
        if (options.autoSave && this.persistencePath) {
            this.startAutoSave();
        }
    }
    
    /**
     * Start auto-save timer
     */
    startAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        this.autoSaveInterval = setInterval(() => {
            if (this.isDirty) {
                this.saveState();
            }
        }, this.autoSaveDelay);
    }
    
    /**
     * Stop auto-save timer
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
    
    /**
     * Save state to file
     */
    saveState(filePath = null) {
        const savePath = filePath || this.persistencePath;
        if (!savePath) {
            console.warn('[GameStateTracker] No persistence path configured');
            return false;
        }
        
        try {
            // Ensure directory exists
            const dir = path.dirname(savePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Serialize state
            const stateData = this.serializeState();
            
            // Write to file
            fs.writeFileSync(savePath, JSON.stringify(stateData, null, 2));
            
            this.isDirty = false;
            this.emit('state-saved', savePath);
            console.log(`[GameStateTracker] State saved to ${savePath}`);
            return true;
        } catch (error) {
            console.error('[GameStateTracker] Failed to save state:', error.message);
            this.emit('save-error', error);
            return false;
        }
    }
    
    /**
     * Load state from file
     */
    loadState(filePath = null) {
        const loadPath = filePath || this.persistencePath;
        if (!loadPath) {
            console.warn('[GameStateTracker] No persistence path configured');
            return false;
        }
        
        if (!fs.existsSync(loadPath)) {
            console.log('[GameStateTracker] No saved state found');
            return false;
        }
        
        try {
            const data = JSON.parse(fs.readFileSync(loadPath, 'utf8'));
            this.deserializeState(data);
            
            this.isDirty = false;
            this.emit('state-loaded', loadPath);
            console.log(`[GameStateTracker] State loaded from ${loadPath}`);
            return true;
        } catch (error) {
            console.error('[GameStateTracker] Failed to load state:', error.message);
            this.emit('load-error', error);
            return false;
        }
    }
    
    /**
     * Serialize state for persistence
     */
    serializeState() {
        return {
            version: '2.0.7',
            timestamp: Date.now(),
            player: this.state.player,
            currentCity: this.state.currentCity,
            cities: Array.from(this.state.cities.entries()).map(([id, city]) => ({
                ...city,
                buildings: Array.from(city.buildings.entries())
            })),
            heroes: Array.from(this.state.heroes.entries()),
            marches: Array.from(this.state.marches.entries()),
            world: {
                server: this.state.world.server,
                tiles: Array.from(this.state.world.tiles.entries()).slice(-500), // Limit tiles
                npcs: Array.from(this.state.world.npcs.entries()),
                bosses: Array.from(this.state.world.bosses.entries())
            },
            alliance: {
                ...this.state.alliance,
                members: Array.from(this.state.alliance.members.entries())
            },
            buffs: this.state.buffs,
            items: Array.from(this.state.items.entries()),
            history: this.history.slice(-100) // Keep last 100 history entries
        };
    }
    
    /**
     * Deserialize state from persistence
     */
    deserializeState(data) {
        if (!data || data.version !== '2.0.7') {
            console.warn('[GameStateTracker] State version mismatch, using defaults');
            return;
        }
        
        // Restore player
        this.state.player = data.player || this.state.player;
        this.state.currentCity = data.currentCity;
        
        // Restore cities
        this.state.cities.clear();
        if (data.cities) {
            for (const city of data.cities) {
                const buildings = new Map(city.buildings || []);
                this.state.cities.set(city.id, { ...city, buildings });
            }
        }
        
        // Restore heroes
        this.state.heroes.clear();
        if (data.heroes) {
            for (const [id, hero] of data.heroes) {
                this.state.heroes.set(id, hero);
            }
        }
        
        // Restore marches (clear old ones as they're likely expired)
        this.state.marches.clear();
        
        // Restore world
        if (data.world) {
            this.state.world.server = data.world.server;
            this.state.world.tiles.clear();
            if (data.world.tiles) {
                for (const [key, tile] of data.world.tiles) {
                    this.state.world.tiles.set(key, tile);
                }
            }
            this.state.world.npcs.clear();
            if (data.world.npcs) {
                for (const [id, npc] of data.world.npcs) {
                    this.state.world.npcs.set(id, npc);
                }
            }
            this.state.world.bosses.clear();
            if (data.world.bosses) {
                for (const [id, boss] of data.world.bosses) {
                    this.state.world.bosses.set(id, boss);
                }
            }
        }
        
        // Restore alliance
        if (data.alliance) {
            this.state.alliance.id = data.alliance.id;
            this.state.alliance.name = data.alliance.name;
            this.state.alliance.territory = data.alliance.territory || [];
            this.state.alliance.members.clear();
            if (data.alliance.members) {
                for (const [id, member] of data.alliance.members) {
                    this.state.alliance.members.set(id, member);
                }
            }
        }
        
        // Restore buffs (filter expired)
        const now = Date.now();
        this.state.buffs = (data.buffs || []).filter(b => !b.expireTime || b.expireTime > now);
        
        // Restore items
        this.state.items.clear();
        if (data.items) {
            for (const [id, item] of data.items) {
                this.state.items.set(id, item);
            }
        }
        
        // Restore history
        this.history = data.history || [];
        
        this.emit('state-restored');
    }
    
    /**
     * Export state to JSON string
     */
    exportState() {
        return JSON.stringify(this.serializeState(), null, 2);
    }
    
    /**
     * Import state from JSON string
     */
    importState(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.deserializeState(data);
            this.isDirty = true;
            return true;
        } catch (error) {
            console.error('[GameStateTracker] Failed to import state:', error.message);
            return false;
        }
    }
    
    /**
     * Reset state
     */
    reset() {
        this.state = {
            player: { id: null, name: null, level: null, prestige: null, alliance: null, allianceId: null, gold: 0, gems: 0, vip: 0 },
            cities: new Map(),
            currentCity: null,
            armies: new Map(),
            heroes: new Map(),
            marches: new Map(),
            world: { server: null, tiles: new Map(), npcs: new Map(), bosses: new Map() },
            alliance: { id: null, name: null, members: new Map(), territory: [] },
            buffs: [],
            items: new Map(),
            mail: [],
            events: []
        };
        this.history = [];
        this.emit('state-reset');
        this.isDirty = true;
    }
}

// Singleton instance
let instance = null;

function getGameStateTracker() {
    if (!instance) {
        instance = new GameStateTracker();
    }
    return instance;
}

module.exports = {
    GameStateTracker,
    getGameStateTracker
};
