/**
 * Svony Browser - Game State Engine
 * Real-time tracking of game state from intercepted traffic
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class GameStateEngine extends EventEmitter {
    constructor() {
        super();
        
        // Player state
        this.player = {
            id: null,
            name: null,
            level: 0,
            prestige: 0,
            gold: 0,
            gems: 0,
            honor: 0,
            allianceId: null,
            allianceName: null,
            server: null,
            lastLogin: null
        };
        
        // Alliance state
        this.alliance = {
            id: null,
            name: null,
            level: 0,
            memberCount: 0,
            honor: 0,
            territory: [],
            members: []
        };
        
        // Game entities
        this.cities = new Map();      // cityId -> CityState
        this.heroes = new Map();      // heroId -> HeroState
        this.armies = new Map();      // armyId -> ArmyState
        this.marches = new Map();     // marchId -> MarchState
        this.items = new Map();       // itemId -> ItemState
        this.quests = new Map();      // questId -> QuestState
        
        // Event tracking
        this.eventHistory = [];
        this.maxEventHistory = 1000;
        
        // State metadata
        this.lastUpdate = null;
        this.sessionStart = null;
        this.packetCount = 0;
        
        // Action handlers map
        this.actionHandlers = this.buildActionHandlers();
    }

    /**
     * Build map of action handlers
     */
    buildActionHandlers() {
        return {
            // Login/Session
            'server.LoginResponse': (data) => this.handleLogin(data),
            'server.Logout': () => this.handleLogout(),
            'system.heartbeat': (data) => this.handleHeartbeat(data),
            
            // City actions
            'city.getInfo': (data) => this.updateCityState(data),
            'city.getBuildings': (data) => this.updateCityBuildings(data),
            'city.upgradeBuilding': (data) => this.handleBuildingUpgrade(data),
            'city.getResources': (data) => this.updateCityResources(data),
            'city.collectResource': (data) => this.handleResourceCollection(data),
            
            // Hero actions
            'hero.getList': (data) => this.updateHeroList(data),
            'hero.getInfo': (data) => this.updateHeroState(data),
            'hero.levelUp': (data) => this.handleHeroLevelUp(data),
            'hero.recruit': (data) => this.handleHeroRecruit(data),
            'hero.dismiss': (data) => this.handleHeroDismiss(data),
            
            // Army actions
            'army.getTroops': (data) => this.updateArmyTroops(data),
            'army.train': (data) => this.handleTroopTraining(data),
            'army.march': (data) => this.handleMarchStart(data),
            'army.recall': (data) => this.handleMarchRecall(data),
            'army.marchComplete': (data) => this.handleMarchComplete(data),
            
            // Alliance actions
            'alliance.getInfo': (data) => this.updateAllianceState(data),
            'alliance.getMembers': (data) => this.updateAllianceMembers(data),
            'alliance.donate': (data) => this.handleAllianceDonation(data),
            
            // Map actions
            'map.getRegion': (data) => this.handleMapData(data),
            'map.scout': (data) => this.handleScoutResult(data),
            
            // Trade actions
            'trade.getMarket': (data) => this.handleMarketData(data),
            
            // Quest actions
            'quest.getList': (data) => this.updateQuestList(data),
            'quest.complete': (data) => this.handleQuestComplete(data),
            
            // Item actions
            'item.getInventory': (data) => this.updateInventory(data),
            'item.use': (data) => this.handleItemUse(data)
        };
    }

    /**
     * Initialize the game state engine
     */
    async initialize() {
        this.sessionStart = Date.now();
        console.log('[GameStateEngine] Initialized');
        this.emit('initialized');
        return true;
    }

    /**
     * Process incoming packet and update state
     */
    processPacket(packet) {
        const { action, data, direction, timestamp } = packet;
        
        this.packetCount++;
        this.lastUpdate = timestamp || Date.now();
        
        // Record event
        this.recordEvent({
            action,
            direction,
            timestamp: this.lastUpdate,
            dataSize: JSON.stringify(data || {}).length
        });
        
        // Find and execute handler
        const handler = this.actionHandlers[action];
        if (handler && data) {
            try {
                handler(data);
                this.emit('stateChanged', { action, data });
            } catch (error) {
                console.error(`[GameStateEngine] Error handling ${action}:`, error);
                this.emit('error', { action, error: error.message });
            }
        }
        
        return this.getSummary();
    }

    /**
     * Handle login response
     */
    handleLogin(data) {
        this.player = {
            id: data.playerId || data.uid,
            name: data.playerName || data.name,
            level: data.level || 1,
            prestige: data.prestige || 0,
            gold: data.gold || 0,
            gems: data.gems || data.gameMoney || 0,
            honor: data.honor || 0,
            allianceId: data.allianceId,
            allianceName: data.allianceName,
            server: data.server || data.serverName,
            lastLogin: Date.now()
        };
        
        console.log(`[GameStateEngine] Player logged in: ${this.player.name}`);
        this.emit('playerLoggedIn', this.player);
    }

    /**
     * Handle logout
     */
    handleLogout() {
        console.log(`[GameStateEngine] Player logged out: ${this.player.name}`);
        this.emit('playerLoggedOut', this.player);
    }

    /**
     * Handle heartbeat
     */
    handleHeartbeat(data) {
        if (data.serverTime) {
            this.emit('serverTime', data.serverTime);
        }
    }

    /**
     * Update city state
     */
    updateCityState(data) {
        const cityId = data.cityId || data.id;
        
        const existingCity = this.cities.get(cityId) || {};
        
        const cityState = {
            ...existingCity,
            id: cityId,
            name: data.cityName || data.name || existingCity.name,
            level: data.level || existingCity.level,
            x: data.x || existingCity.x,
            y: data.y || existingCity.y,
            resources: data.resources || existingCity.resources || {},
            buildings: data.buildings || existingCity.buildings || [],
            troops: data.troops || existingCity.troops || {},
            population: data.population || existingCity.population,
            loyalty: data.loyalty || existingCity.loyalty,
            lastUpdate: Date.now()
        };
        
        this.cities.set(cityId, cityState);
        this.emit('cityUpdated', cityState);
    }

    /**
     * Update city buildings
     */
    updateCityBuildings(data) {
        const cityId = data.cityId;
        const city = this.cities.get(cityId);
        
        if (city) {
            city.buildings = data.buildings || [];
            city.lastUpdate = Date.now();
            this.emit('cityUpdated', city);
        }
    }

    /**
     * Handle building upgrade
     */
    handleBuildingUpgrade(data) {
        if (data.success) {
            this.recordEvent({
                type: 'building_upgrade',
                cityId: data.cityId,
                positionId: data.positionId,
                finishTime: data.finishTime
            });
        }
    }

    /**
     * Update city resources
     */
    updateCityResources(data) {
        const cityId = data.cityId;
        const city = this.cities.get(cityId);
        
        if (city) {
            city.resources = {
                gold: data.gold || 0,
                food: data.food || 0,
                lumber: data.lumber || data.wood || 0,
                stone: data.stone || 0,
                iron: data.iron || 0
            };
            city.lastUpdate = Date.now();
            this.emit('resourcesUpdated', { cityId, resources: city.resources });
        }
    }

    /**
     * Handle resource collection
     */
    handleResourceCollection(data) {
        this.recordEvent({
            type: 'resource_collected',
            resourceType: data.resourceType,
            amount: data.amount
        });
    }

    /**
     * Update hero list
     */
    updateHeroList(data) {
        const heroes = data.heroes || data.heroList || [];
        
        for (const heroData of heroes) {
            this.updateHeroState(heroData);
        }
    }

    /**
     * Update hero state
     */
    updateHeroState(data) {
        const heroId = data.heroId || data.id;
        
        const existingHero = this.heroes.get(heroId) || {};
        
        const heroState = {
            ...existingHero,
            id: heroId,
            name: data.name || existingHero.name,
            level: data.level || existingHero.level,
            experience: data.experience || data.exp || existingHero.experience,
            politics: data.politics || existingHero.politics,
            attack: data.attack || existingHero.attack,
            defense: data.defense || existingHero.defense,
            intelligence: data.intelligence || existingHero.intelligence,
            power: data.power || existingHero.power,
            status: data.status || existingHero.status, // idle, marching, defending, etc.
            cityId: data.cityId || existingHero.cityId,
            equipment: data.equipment || existingHero.equipment || [],
            skills: data.skills || existingHero.skills || [],
            lastUpdate: Date.now()
        };
        
        this.heroes.set(heroId, heroState);
        this.emit('heroUpdated', heroState);
    }

    /**
     * Handle hero level up
     */
    handleHeroLevelUp(data) {
        if (data.success) {
            const hero = this.heroes.get(data.heroId);
            if (hero) {
                hero[data.attribute] = data.newValue;
                hero.lastUpdate = Date.now();
                this.emit('heroUpdated', hero);
            }
        }
    }

    /**
     * Handle hero recruit
     */
    handleHeroRecruit(data) {
        this.updateHeroState(data);
        this.recordEvent({
            type: 'hero_recruited',
            heroId: data.heroId,
            heroName: data.name
        });
    }

    /**
     * Handle hero dismiss
     */
    handleHeroDismiss(data) {
        if (data.heroId) {
            this.heroes.delete(data.heroId);
            this.emit('heroRemoved', data.heroId);
        }
    }

    /**
     * Update army troops
     */
    updateArmyTroops(data) {
        const cityId = data.cityId;
        const city = this.cities.get(cityId);
        
        if (city) {
            city.troops = data.troops || {};
            city.lastUpdate = Date.now();
            this.emit('troopsUpdated', { cityId, troops: city.troops });
        }
    }

    /**
     * Handle troop training
     */
    handleTroopTraining(data) {
        if (data.success) {
            this.recordEvent({
                type: 'troop_training',
                cityId: data.cityId,
                troopType: data.troopType,
                count: data.count,
                finishTime: data.finishTime
            });
        }
    }

    /**
     * Handle march start
     */
    handleMarchStart(data) {
        const marchId = data.marchId || data.id;
        
        const marchState = {
            id: marchId,
            type: data.type || 'attack', // attack, reinforce, scout, transport
            sourceCityId: data.cityId || data.sourceCityId,
            targetX: data.targetX || data.x,
            targetY: data.targetY || data.y,
            heroId: data.heroId,
            troops: data.troops || {},
            startTime: Date.now(),
            arrivalTime: data.arrivalTime,
            returnTime: data.returnTime,
            status: 'marching'
        };
        
        this.marches.set(marchId, marchState);
        this.emit('marchStarted', marchState);
    }

    /**
     * Handle march recall
     */
    handleMarchRecall(data) {
        const march = this.marches.get(data.marchId);
        if (march) {
            march.status = 'returning';
            march.returnTime = data.returnTime;
            this.emit('marchRecalled', march);
        }
    }

    /**
     * Handle march complete
     */
    handleMarchComplete(data) {
        const march = this.marches.get(data.marchId);
        if (march) {
            march.status = 'completed';
            march.result = data.result;
            this.emit('marchCompleted', march);
            
            // Remove from active marches after delay
            setTimeout(() => {
                this.marches.delete(data.marchId);
            }, 5000);
        }
    }

    /**
     * Update alliance state
     */
    updateAllianceState(data) {
        this.alliance = {
            id: data.allianceId || data.id,
            name: data.name || data.allianceName,
            level: data.level || 1,
            memberCount: data.memberCount || 0,
            honor: data.honor || 0,
            territory: data.territory || [],
            prestige: data.prestige || 0,
            lastUpdate: Date.now()
        };
        
        this.emit('allianceUpdated', this.alliance);
    }

    /**
     * Update alliance members
     */
    updateAllianceMembers(data) {
        this.alliance.members = data.members || [];
        this.emit('allianceMembersUpdated', this.alliance.members);
    }

    /**
     * Handle alliance donation
     */
    handleAllianceDonation(data) {
        if (data.success) {
            this.player.honor = (this.player.honor || 0) + (data.honor || 0);
            this.recordEvent({
                type: 'alliance_donation',
                honor: data.honor
            });
        }
    }

    /**
     * Handle map data
     */
    handleMapData(data) {
        this.emit('mapDataReceived', data.tiles || []);
    }

    /**
     * Handle scout result
     */
    handleScoutResult(data) {
        this.emit('scoutResult', data);
        this.recordEvent({
            type: 'scout_complete',
            x: data.x,
            y: data.y,
            result: data.result
        });
    }

    /**
     * Handle market data
     */
    handleMarketData(data) {
        this.emit('marketDataReceived', data.listings || []);
    }

    /**
     * Update quest list
     */
    updateQuestList(data) {
        const quests = data.quests || [];
        
        for (const questData of quests) {
            this.quests.set(questData.questId || questData.id, {
                id: questData.questId || questData.id,
                name: questData.name,
                description: questData.description,
                progress: questData.progress || 0,
                target: questData.target || 1,
                rewards: questData.rewards || {},
                status: questData.status || 'active'
            });
        }
        
        this.emit('questsUpdated', Array.from(this.quests.values()));
    }

    /**
     * Handle quest complete
     */
    handleQuestComplete(data) {
        if (data.success) {
            const quest = this.quests.get(data.questId);
            if (quest) {
                quest.status = 'completed';
                this.emit('questCompleted', { quest, rewards: data.rewards });
            }
        }
    }

    /**
     * Update inventory
     */
    updateInventory(data) {
        const items = data.items || [];
        
        for (const itemData of items) {
            this.items.set(itemData.itemId || itemData.id, {
                id: itemData.itemId || itemData.id,
                name: itemData.name,
                type: itemData.type,
                count: itemData.count || 1,
                description: itemData.description
            });
        }
        
        this.emit('inventoryUpdated', Array.from(this.items.values()));
    }

    /**
     * Handle item use
     */
    handleItemUse(data) {
        if (data.success) {
            const item = this.items.get(data.itemId);
            if (item) {
                item.count = (item.count || 1) - 1;
                if (item.count <= 0) {
                    this.items.delete(data.itemId);
                }
                this.emit('itemUsed', { itemId: data.itemId, result: data.result });
            }
        }
    }

    /**
     * Record event to history
     */
    recordEvent(event) {
        this.eventHistory.push({
            ...event,
            timestamp: Date.now()
        });
        
        // Trim history
        if (this.eventHistory.length > this.maxEventHistory) {
            this.eventHistory = this.eventHistory.slice(-this.maxEventHistory);
        }
    }

    /**
     * Get state summary for UI
     */
    getSummary() {
        return {
            player: { ...this.player },
            alliance: { ...this.alliance },
            cityCount: this.cities.size,
            heroCount: this.heroes.size,
            activeMarches: this.marches.size,
            itemCount: this.items.size,
            questCount: this.quests.size,
            packetCount: this.packetCount,
            lastUpdate: this.lastUpdate,
            sessionDuration: this.sessionStart ? Date.now() - this.sessionStart : 0
        };
    }

    /**
     * Get detailed state
     */
    getFullState() {
        return {
            player: { ...this.player },
            alliance: { ...this.alliance },
            cities: Array.from(this.cities.values()),
            heroes: Array.from(this.heroes.values()),
            marches: Array.from(this.marches.values()),
            items: Array.from(this.items.values()),
            quests: Array.from(this.quests.values()),
            eventHistory: this.eventHistory.slice(-100),
            summary: this.getSummary()
        };
    }

    /**
     * Get city by ID
     */
    getCity(cityId) {
        return this.cities.get(cityId);
    }

    /**
     * Get hero by ID
     */
    getHero(heroId) {
        return this.heroes.get(heroId);
    }

    /**
     * Get active marches
     */
    getActiveMarches() {
        return Array.from(this.marches.values()).filter(m => m.status === 'marching');
    }

    /**
     * Get event history
     */
    getEventHistory(limit = 100) {
        return this.eventHistory.slice(-limit);
    }

    /**
     * Export state to file
     */
    async exportState(filePath) {
        const state = this.getFullState();
        await fs.writeFile(filePath, JSON.stringify(state, null, 2));
        return filePath;
    }

    /**
     * Import state from file
     */
    async importState(filePath) {
        const data = await fs.readFile(filePath, 'utf8');
        const state = JSON.parse(data);
        
        if (state.player) this.player = state.player;
        if (state.alliance) this.alliance = state.alliance;
        
        if (state.cities) {
            for (const city of state.cities) {
                this.cities.set(city.id, city);
            }
        }
        
        if (state.heroes) {
            for (const hero of state.heroes) {
                this.heroes.set(hero.id, hero);
            }
        }
        
        this.emit('stateImported', this.getSummary());
    }

    /**
     * Reset state
     */
    reset() {
        this.player = { id: null, name: null, level: 0 };
        this.alliance = { id: null, name: null };
        this.cities.clear();
        this.heroes.clear();
        this.armies.clear();
        this.marches.clear();
        this.items.clear();
        this.quests.clear();
        this.eventHistory = [];
        this.packetCount = 0;
        this.lastUpdate = null;
        
        this.emit('stateReset');
    }
}

module.exports = new GameStateEngine();
