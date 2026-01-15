#!/usr/bin/env node
/**
 * Evony Tools MCP Server
 * Provides game calculations and utilities for Evony
 * 
 * Tools:
 * - calc_training: Calculate training time and resources
 * - calc_march: Calculate march time between coordinates
 * - calc_combat: Simulate combat and predict outcomes
 * - calc_resources: Calculate resource production and consumption
 * - calc_building: Calculate building upgrade requirements
 */

import { createInterface } from 'readline';

// Troop definitions with real Evony stats
const TROOP_DEFINITIONS = {
    worker: { 
        attack: 5, defense: 5, life: 20, speed: 100, load: 20,
        food: 1, lumber: 0, stone: 0, iron: 0, gold: 0,
        trainTime: 15, tier: 1
    },
    warrior: { 
        attack: 50, defense: 50, life: 200, speed: 180, load: 10,
        food: 10, lumber: 0, stone: 0, iron: 0, gold: 0,
        trainTime: 30, tier: 1
    },
    scout: { 
        attack: 20, defense: 20, life: 50, speed: 3000, load: 5,
        food: 50, lumber: 20, stone: 0, iron: 0, gold: 0,
        trainTime: 20, tier: 1
    },
    pikeman: { 
        attack: 150, defense: 150, life: 300, speed: 300, load: 15,
        food: 100, lumber: 0, stone: 0, iron: 50, gold: 0,
        trainTime: 60, tier: 2
    },
    swordsman: { 
        attack: 100, defense: 250, life: 400, speed: 275, load: 20,
        food: 150, lumber: 0, stone: 0, iron: 100, gold: 0,
        trainTime: 90, tier: 2
    },
    archer: { 
        attack: 120, defense: 50, life: 250, speed: 250, load: 10,
        food: 50, lumber: 150, stone: 0, iron: 0, gold: 0,
        trainTime: 45, tier: 2
    },
    cavalry: { 
        attack: 250, defense: 180, life: 500, speed: 1000, load: 30,
        food: 250, lumber: 0, stone: 0, iron: 150, gold: 0,
        trainTime: 120, tier: 3
    },
    cataphract: { 
        attack: 350, defense: 350, life: 800, speed: 750, load: 35,
        food: 350, lumber: 0, stone: 0, iron: 350, gold: 0,
        trainTime: 180, tier: 3
    },
    ballista: { 
        attack: 450, defense: 160, life: 320, speed: 100, load: 45,
        food: 500, lumber: 500, stone: 0, iron: 0, gold: 0,
        trainTime: 240, tier: 4
    },
    ram: { 
        attack: 600, defense: 200, life: 500, speed: 120, load: 50,
        food: 600, lumber: 600, stone: 200, iron: 0, gold: 0,
        trainTime: 300, tier: 4
    },
    catapult: { 
        attack: 800, defense: 160, life: 480, speed: 80, load: 60,
        food: 800, lumber: 400, stone: 400, iron: 0, gold: 0,
        trainTime: 360, tier: 4
    },
    phalanx: { 
        attack: 200, defense: 400, life: 600, speed: 250, load: 25,
        food: 200, lumber: 0, stone: 100, iron: 100, gold: 0,
        trainTime: 150, tier: 3
    }
};

// Building definitions
const BUILDING_DEFINITIONS = {
    townhall: { baseTime: 60, baseCost: { food: 100, lumber: 100, stone: 100, iron: 100 } },
    barracks: { baseTime: 45, baseCost: { food: 50, lumber: 100, stone: 50, iron: 0 } },
    stable: { baseTime: 60, baseCost: { food: 100, lumber: 150, stone: 50, iron: 50 } },
    workshop: { baseTime: 90, baseCost: { food: 150, lumber: 200, stone: 100, iron: 100 } },
    forge: { baseTime: 75, baseCost: { food: 100, lumber: 100, stone: 100, iron: 150 } },
    academy: { baseTime: 120, baseCost: { food: 200, lumber: 200, stone: 200, iron: 200 } },
    warehouse: { baseTime: 30, baseCost: { food: 50, lumber: 100, stone: 50, iron: 0 } },
    farm: { baseTime: 20, baseCost: { food: 0, lumber: 50, stone: 20, iron: 0 } },
    sawmill: { baseTime: 20, baseCost: { food: 50, lumber: 0, stone: 20, iron: 0 } },
    quarry: { baseTime: 25, baseCost: { food: 50, lumber: 50, stone: 0, iron: 0 } },
    mine: { baseTime: 30, baseCost: { food: 50, lumber: 50, stone: 50, iron: 0 } },
    wall: { baseTime: 90, baseCost: { food: 200, lumber: 200, stone: 300, iron: 100 } },
    embassy: { baseTime: 60, baseCost: { food: 100, lumber: 150, stone: 100, iron: 50 } },
    marketplace: { baseTime: 45, baseCost: { food: 100, lumber: 100, stone: 50, iron: 50 } },
    inn: { baseTime: 40, baseCost: { food: 100, lumber: 100, stone: 50, iron: 0 } },
    feasting_hall: { baseTime: 60, baseCost: { food: 150, lumber: 150, stone: 100, iron: 50 } },
    rally_spot: { baseTime: 30, baseCost: { food: 50, lumber: 100, stone: 50, iron: 0 } },
    beacon_tower: { baseTime: 45, baseCost: { food: 100, lumber: 100, stone: 100, iron: 0 } },
    relief_station: { baseTime: 50, baseCost: { food: 100, lumber: 100, stone: 50, iron: 50 } }
};

/**
 * Calculate training time and resources
 */
function calcTraining(troopType, quantity, buffs = {}) {
    const troop = TROOP_DEFINITIONS[troopType.toLowerCase()];
    if (!troop) {
        return { error: `Unknown troop type: ${troopType}` };
    }
    
    // Apply buffs
    const trainingSpeedBuff = 1 + (buffs.trainingSpeed || 0) / 100;
    const resourceReductionBuff = 1 - (buffs.resourceReduction || 0) / 100;
    
    const baseTime = troop.trainTime * quantity;
    const effectiveTime = Math.ceil(baseTime / trainingSpeedBuff);
    
    const resources = {
        food: Math.ceil(troop.food * quantity * resourceReductionBuff),
        lumber: Math.ceil(troop.lumber * quantity * resourceReductionBuff),
        stone: Math.ceil(troop.stone * quantity * resourceReductionBuff),
        iron: Math.ceil(troop.iron * quantity * resourceReductionBuff),
        gold: Math.ceil(troop.gold * quantity * resourceReductionBuff)
    };
    
    return {
        troopType,
        quantity,
        tier: troop.tier,
        baseTimeSeconds: baseTime,
        effectiveTimeSeconds: effectiveTime,
        formattedTime: formatTime(effectiveTime),
        resources,
        totalPower: calculateTroopPower(troop, quantity),
        buffsApplied: buffs
    };
}

/**
 * Calculate march time between coordinates
 */
function calcMarch(fromX, fromY, toX, toY, troops, buffs = {}) {
    // Calculate distance
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Find slowest troop
    let minSpeed = Infinity;
    let slowestTroop = null;
    
    for (const [troopType, count] of Object.entries(troops)) {
        if (count > 0) {
            const troop = TROOP_DEFINITIONS[troopType.toLowerCase()];
            if (troop && troop.speed < minSpeed) {
                minSpeed = troop.speed;
                slowestTroop = troopType;
            }
        }
    }
    
    if (minSpeed === Infinity) {
        return { error: 'No valid troops specified' };
    }
    
    // Apply march speed buff
    const marchSpeedBuff = 1 + (buffs.marchSpeed || 0) / 100;
    const effectiveSpeed = minSpeed * marchSpeedBuff;
    
    // Calculate time (distance in tiles, speed in tiles/hour)
    const baseTimeHours = distance / minSpeed;
    const effectiveTimeHours = distance / effectiveSpeed;
    const effectiveTimeSeconds = effectiveTimeHours * 3600;
    
    // Calculate load capacity
    let totalLoad = 0;
    for (const [troopType, count] of Object.entries(troops)) {
        const troop = TROOP_DEFINITIONS[troopType.toLowerCase()];
        if (troop) {
            totalLoad += troop.load * count;
        }
    }
    
    return {
        from: { x: fromX, y: fromY },
        to: { x: toX, y: toY },
        distance: Math.round(distance * 100) / 100,
        slowestTroop,
        baseSpeed: minSpeed,
        effectiveSpeed: Math.round(effectiveSpeed * 100) / 100,
        baseTimeSeconds: Math.ceil(baseTimeHours * 3600),
        effectiveTimeSeconds: Math.ceil(effectiveTimeSeconds),
        formattedTime: formatTime(Math.ceil(effectiveTimeSeconds)),
        totalLoadCapacity: totalLoad,
        buffsApplied: buffs
    };
}

/**
 * Calculate combat outcome
 */
function calcCombat(attacker, defender, options = {}) {
    // Calculate total stats for each side
    const attackerStats = calculateArmyStats(attacker, options.attackerBuffs || {});
    const defenderStats = calculateArmyStats(defender, options.defenderBuffs || {});
    
    // Apply terrain and wall bonuses
    if (options.defenderWallLevel) {
        defenderStats.defense *= 1 + (options.defenderWallLevel * 0.05);
    }
    
    // Simulate combat rounds
    let attackerRemaining = { ...attackerStats.troops };
    let defenderRemaining = { ...defenderStats.troops };
    let rounds = 0;
    const maxRounds = 100;
    
    while (hasRemainingTroops(attackerRemaining) && 
           hasRemainingTroops(defenderRemaining) && 
           rounds < maxRounds) {
        
        // Calculate damage
        const attackerDamage = attackerStats.attack * (1 - defenderStats.defense / (defenderStats.defense + 1000));
        const defenderDamage = defenderStats.attack * (1 - attackerStats.defense / (attackerStats.defense + 1000));
        
        // Apply damage
        applyDamage(defenderRemaining, attackerDamage);
        applyDamage(attackerRemaining, defenderDamage);
        
        rounds++;
    }
    
    // Calculate losses
    const attackerLosses = calculateLosses(attacker, attackerRemaining);
    const defenderLosses = calculateLosses(defender, defenderRemaining);
    
    const winner = hasRemainingTroops(attackerRemaining) ? 'attacker' : 'defender';
    
    return {
        winner,
        rounds,
        attacker: {
            initialPower: attackerStats.totalPower,
            losses: attackerLosses,
            lossPercentage: Math.round((attackerLosses.total / attackerStats.totalTroops) * 100)
        },
        defender: {
            initialPower: defenderStats.totalPower,
            losses: defenderLosses,
            lossPercentage: Math.round((defenderLosses.total / defenderStats.totalTroops) * 100)
        }
    };
}

/**
 * Calculate resource production
 */
function calcResources(buildings, buffs = {}) {
    const production = {
        food: 0,
        lumber: 0,
        stone: 0,
        iron: 0,
        gold: 0
    };
    
    const baseRates = {
        farm: { food: 100 },
        sawmill: { lumber: 100 },
        quarry: { stone: 100 },
        mine: { iron: 100 }
    };
    
    for (const [building, level] of Object.entries(buildings)) {
        const rates = baseRates[building.toLowerCase()];
        if (rates) {
            for (const [resource, baseRate] of Object.entries(rates)) {
                const levelMultiplier = Math.pow(1.5, level - 1);
                production[resource] += baseRate * levelMultiplier;
            }
        }
    }
    
    // Apply production buffs
    const productionBuff = 1 + (buffs.production || 0) / 100;
    for (const resource of Object.keys(production)) {
        production[resource] = Math.floor(production[resource] * productionBuff);
    }
    
    return {
        hourlyProduction: production,
        dailyProduction: {
            food: production.food * 24,
            lumber: production.lumber * 24,
            stone: production.stone * 24,
            iron: production.iron * 24,
            gold: production.gold * 24
        },
        buffsApplied: buffs
    };
}

/**
 * Calculate building upgrade requirements
 */
function calcBuilding(buildingType, currentLevel, targetLevel, buffs = {}) {
    const building = BUILDING_DEFINITIONS[buildingType.toLowerCase()];
    if (!building) {
        return { error: `Unknown building type: ${buildingType}` };
    }
    
    const upgrades = [];
    let totalTime = 0;
    const totalResources = { food: 0, lumber: 0, stone: 0, iron: 0 };
    
    for (let level = currentLevel + 1; level <= targetLevel; level++) {
        const levelMultiplier = Math.pow(2, level - 1);
        const time = Math.ceil(building.baseTime * levelMultiplier);
        const resources = {};
        
        for (const [resource, baseCost] of Object.entries(building.baseCost)) {
            resources[resource] = Math.ceil(baseCost * levelMultiplier);
            totalResources[resource] += resources[resource];
        }
        
        totalTime += time;
        upgrades.push({ level, timeSeconds: time, resources });
    }
    
    // Apply construction speed buff
    const constructionSpeedBuff = 1 + (buffs.constructionSpeed || 0) / 100;
    const effectiveTime = Math.ceil(totalTime / constructionSpeedBuff);
    
    return {
        buildingType,
        currentLevel,
        targetLevel,
        upgrades,
        totalTimeSeconds: totalTime,
        effectiveTimeSeconds: effectiveTime,
        formattedTime: formatTime(effectiveTime),
        totalResources,
        buffsApplied: buffs
    };
}

// Helper functions
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

function calculateTroopPower(troop, quantity) {
    return Math.floor((troop.attack + troop.defense + troop.life / 10) * quantity);
}

function calculateArmyStats(army, buffs) {
    let totalAttack = 0;
    let totalDefense = 0;
    let totalLife = 0;
    let totalTroops = 0;
    const troops = {};
    
    for (const [troopType, count] of Object.entries(army)) {
        const troop = TROOP_DEFINITIONS[troopType.toLowerCase()];
        if (troop && count > 0) {
            totalAttack += troop.attack * count;
            totalDefense += troop.defense * count;
            totalLife += troop.life * count;
            totalTroops += count;
            troops[troopType] = { count, life: troop.life * count };
        }
    }
    
    // Apply buffs
    totalAttack *= 1 + (buffs.attack || 0) / 100;
    totalDefense *= 1 + (buffs.defense || 0) / 100;
    totalLife *= 1 + (buffs.life || 0) / 100;
    
    return {
        attack: totalAttack,
        defense: totalDefense,
        life: totalLife,
        totalTroops,
        totalPower: Math.floor(totalAttack + totalDefense + totalLife / 10),
        troops
    };
}

function hasRemainingTroops(troops) {
    for (const troop of Object.values(troops)) {
        if (troop.count > 0) return true;
    }
    return false;
}

function applyDamage(troops, damage) {
    for (const troopType of Object.keys(troops)) {
        if (troops[troopType].count > 0) {
            const troop = TROOP_DEFINITIONS[troopType.toLowerCase()];
            if (troop) {
                const killed = Math.min(troops[troopType].count, Math.floor(damage / troop.life));
                troops[troopType].count -= killed;
                damage -= killed * troop.life;
                if (damage <= 0) break;
            }
        }
    }
}

function calculateLosses(original, remaining) {
    const losses = { total: 0 };
    for (const [troopType, count] of Object.entries(original)) {
        const remainingCount = remaining[troopType]?.count || 0;
        const lost = count - remainingCount;
        if (lost > 0) {
            losses[troopType] = lost;
            losses.total += lost;
        }
    }
    return losses;
}

// MCP Server Implementation
const tools = [
    {
        name: 'calc_training',
        description: 'Calculate training time and resource costs for troops.',
        inputSchema: {
            type: 'object',
            properties: {
                troopType: {
                    type: 'string',
                    description: 'Type of troop (e.g., "cavalry", "archer", "cataphract")'
                },
                quantity: {
                    type: 'number',
                    description: 'Number of troops to train'
                },
                buffs: {
                    type: 'object',
                    description: 'Optional buffs (trainingSpeed, resourceReduction as percentages)',
                    properties: {
                        trainingSpeed: { type: 'number' },
                        resourceReduction: { type: 'number' }
                    }
                }
            },
            required: ['troopType', 'quantity']
        }
    },
    {
        name: 'calc_march',
        description: 'Calculate march time between two coordinates.',
        inputSchema: {
            type: 'object',
            properties: {
                fromX: { type: 'number', description: 'Starting X coordinate' },
                fromY: { type: 'number', description: 'Starting Y coordinate' },
                toX: { type: 'number', description: 'Destination X coordinate' },
                toY: { type: 'number', description: 'Destination Y coordinate' },
                troops: {
                    type: 'object',
                    description: 'Object mapping troop types to counts'
                },
                buffs: {
                    type: 'object',
                    description: 'Optional buffs (marchSpeed as percentage)',
                    properties: {
                        marchSpeed: { type: 'number' }
                    }
                }
            },
            required: ['fromX', 'fromY', 'toX', 'toY', 'troops']
        }
    },
    {
        name: 'calc_combat',
        description: 'Simulate combat and predict battle outcome.',
        inputSchema: {
            type: 'object',
            properties: {
                attacker: {
                    type: 'object',
                    description: 'Attacker troops (troop type -> count)'
                },
                defender: {
                    type: 'object',
                    description: 'Defender troops (troop type -> count)'
                },
                options: {
                    type: 'object',
                    description: 'Combat options',
                    properties: {
                        attackerBuffs: { type: 'object' },
                        defenderBuffs: { type: 'object' },
                        defenderWallLevel: { type: 'number' }
                    }
                }
            },
            required: ['attacker', 'defender']
        }
    },
    {
        name: 'calc_resources',
        description: 'Calculate resource production rates.',
        inputSchema: {
            type: 'object',
            properties: {
                buildings: {
                    type: 'object',
                    description: 'Object mapping building types to levels'
                },
                buffs: {
                    type: 'object',
                    description: 'Optional buffs (production as percentage)',
                    properties: {
                        production: { type: 'number' }
                    }
                }
            },
            required: ['buildings']
        }
    },
    {
        name: 'calc_building',
        description: 'Calculate building upgrade requirements.',
        inputSchema: {
            type: 'object',
            properties: {
                buildingType: {
                    type: 'string',
                    description: 'Type of building'
                },
                currentLevel: {
                    type: 'number',
                    description: 'Current building level'
                },
                targetLevel: {
                    type: 'number',
                    description: 'Target building level'
                },
                buffs: {
                    type: 'object',
                    description: 'Optional buffs (constructionSpeed as percentage)',
                    properties: {
                        constructionSpeed: { type: 'number' }
                    }
                }
            },
            required: ['buildingType', 'currentLevel', 'targetLevel']
        }
    }
];

/**
 * Handle tool calls
 */
function handleToolCall(name, args) {
    switch (name) {
        case 'calc_training':
            return calcTraining(args.troopType, args.quantity, args.buffs);
            
        case 'calc_march':
            return calcMarch(args.fromX, args.fromY, args.toX, args.toY, args.troops, args.buffs);
            
        case 'calc_combat':
            return calcCombat(args.attacker, args.defender, args.options);
            
        case 'calc_resources':
            return calcResources(args.buildings, args.buffs);
            
        case 'calc_building':
            return calcBuilding(args.buildingType, args.currentLevel, args.targetLevel, args.buffs);
            
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

/**
 * Process JSON-RPC message
 */
function processMessage(message) {
    const { id, method, params } = message;
    
    try {
        switch (method) {
            case 'initialize':
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {}
                        },
                        serverInfo: {
                            name: 'evony-tools',
                            version: '1.0.0'
                        }
                    }
                };
                
            case 'initialized':
                return null;
                
            case 'tools/list':
                return {
                    jsonrpc: '2.0',
                    id,
                    result: { tools }
                };
                
            case 'tools/call':
                const { name, arguments: args } = params;
                const result = handleToolCall(name, args);
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2)
                            }
                        ]
                    }
                };
                
            default:
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: ${method}`
                    }
                };
        }
    } catch (error) {
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code: -32603,
                message: error.message
            }
        };
    }
}

/**
 * Main entry point
 */
async function main() {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
    
    rl.on('line', (line) => {
        try {
            const message = JSON.parse(line);
            const response = processMessage(message);
            
            if (response) {
                console.log(JSON.stringify(response));
            }
        } catch (error) {
            console.error(`[evony-tools] Error processing message: ${error.message}`);
        }
    });
    
    rl.on('close', () => {
        process.exit(0);
    });
    
    console.error('[evony-tools] Server started');
}

main().catch(error => {
    console.error(`[evony-tools] Fatal error: ${error.message}`);
    process.exit(1);
});
