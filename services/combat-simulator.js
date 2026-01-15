/**
 * Svony Browser - Combat Simulator
 * Battle outcome prediction and strategy optimization
 */

const EventEmitter = require('events');

class CombatSimulator extends EventEmitter {
    constructor() {
        super();
        
        // Troop definitions with real Evony stats
        this.troopDefinitions = {
            // Tier 1 troops
            worker: {
                tier: 1,
                type: 'infantry',
                attack: 5,
                defense: 5,
                life: 20,
                speed: 100,
                load: 10,
                range: 0,
                upkeep: 1,
                trainTime: 15,
                cost: { food: 50, lumber: 0, stone: 0, iron: 0 }
            },
            warrior: {
                tier: 1,
                type: 'infantry',
                attack: 50,
                defense: 50,
                life: 200,
                speed: 180,
                load: 20,
                range: 0,
                upkeep: 3,
                trainTime: 30,
                cost: { food: 100, lumber: 0, stone: 0, iron: 20 }
            },
            scout: {
                tier: 1,
                type: 'cavalry',
                attack: 20,
                defense: 20,
                life: 50,
                speed: 3000,
                load: 5,
                range: 0,
                upkeep: 2,
                trainTime: 20,
                cost: { food: 50, lumber: 0, stone: 0, iron: 0 }
            },
            
            // Tier 2 troops
            pikeman: {
                tier: 2,
                type: 'infantry',
                attack: 150,
                defense: 150,
                life: 300,
                speed: 300,
                load: 25,
                range: 0,
                upkeep: 6,
                trainTime: 60,
                cost: { food: 150, lumber: 0, stone: 0, iron: 50 }
            },
            swordsman: {
                tier: 2,
                type: 'infantry',
                attack: 100,
                defense: 250,
                life: 400,
                speed: 275,
                load: 30,
                range: 0,
                upkeep: 7,
                trainTime: 90,
                cost: { food: 200, lumber: 50, stone: 0, iron: 100 }
            },
            archer: {
                tier: 2,
                type: 'ranged',
                attack: 120,
                defense: 50,
                life: 250,
                speed: 250,
                load: 15,
                range: 1200,
                upkeep: 5,
                trainTime: 75,
                cost: { food: 150, lumber: 100, stone: 0, iron: 50 }
            },
            
            // Tier 3 troops
            cavalry: {
                tier: 3,
                type: 'cavalry',
                attack: 250,
                defense: 180,
                life: 500,
                speed: 1000,
                load: 50,
                range: 0,
                upkeep: 10,
                trainTime: 120,
                cost: { food: 300, lumber: 0, stone: 0, iron: 150 }
            },
            cataphract: {
                tier: 3,
                type: 'cavalry',
                attack: 350,
                defense: 350,
                life: 800,
                speed: 750,
                load: 70,
                range: 0,
                upkeep: 15,
                trainTime: 180,
                cost: { food: 500, lumber: 0, stone: 0, iron: 300 }
            },
            
            // Siege troops
            ballista: {
                tier: 3,
                type: 'siege',
                attack: 450,
                defense: 160,
                life: 320,
                speed: 100,
                load: 100,
                range: 1400,
                upkeep: 12,
                trainTime: 300,
                cost: { food: 500, lumber: 500, stone: 0, iron: 200 }
            },
            ram: {
                tier: 3,
                type: 'siege',
                attack: 600,
                defense: 200,
                life: 500,
                speed: 120,
                load: 150,
                range: 0,
                upkeep: 15,
                trainTime: 360,
                cost: { food: 600, lumber: 600, stone: 0, iron: 300 },
                wallDamage: 500
            },
            catapult: {
                tier: 4,
                type: 'siege',
                attack: 800,
                defense: 160,
                life: 480,
                speed: 80,
                load: 200,
                range: 1500,
                upkeep: 20,
                trainTime: 450,
                cost: { food: 800, lumber: 800, stone: 0, iron: 400 },
                wallDamage: 1000
            },
            
            // Advanced troops
            longbowman: {
                tier: 4,
                type: 'ranged',
                attack: 200,
                defense: 80,
                life: 350,
                speed: 230,
                load: 20,
                range: 1500,
                upkeep: 8,
                trainTime: 150,
                cost: { food: 250, lumber: 200, stone: 0, iron: 100 }
            },
            heavyCavalry: {
                tier: 4,
                type: 'cavalry',
                attack: 500,
                defense: 500,
                life: 1200,
                speed: 650,
                load: 100,
                range: 0,
                upkeep: 25,
                trainTime: 300,
                cost: { food: 800, lumber: 0, stone: 0, iron: 500 }
            }
        };
        
        // Combat modifiers
        this.typeAdvantage = {
            infantry: { strongAgainst: 'cavalry', weakAgainst: 'ranged', modifier: 1.3 },
            cavalry: { strongAgainst: 'ranged', weakAgainst: 'infantry', modifier: 1.3 },
            ranged: { strongAgainst: 'infantry', weakAgainst: 'cavalry', modifier: 1.3 },
            siege: { strongAgainst: 'wall', weakAgainst: 'all', modifier: 1.5 }
        };
        
        // Hero buff categories
        this.heroBuffTypes = {
            attack: 'attackBonus',
            defense: 'defenseBonus',
            hp: 'hpBonus',
            marchSpeed: 'marchSpeedBonus',
            troopLoad: 'loadBonus'
        };
    }

    /**
     * Get troop definition
     */
    getTroop(troopType) {
        return this.troopDefinitions[troopType.toLowerCase()] || null;
    }

    /**
     * Get all troop types
     */
    getTroopTypes() {
        return Object.keys(this.troopDefinitions);
    }

    /**
     * Get troops by tier
     */
    getTroopsByTier(tier) {
        return Object.entries(this.troopDefinitions)
            .filter(([_, def]) => def.tier === tier)
            .map(([name, def]) => ({ name, ...def }));
    }

    /**
     * Simulate battle between attacker and defender
     */
    simulate(attacker, defender, options = {}) {
        const result = {
            winner: null,
            attackerLosses: {},
            defenderLosses: {},
            rounds: [],
            totalDamageDealt: { attacker: 0, defender: 0 },
            battleTime: 0,
            score: 0
        };
        
        // Calculate effective stats with buffs
        const attackerStats = this.calculateEffectiveStats(
            attacker,
            options.attackerBuffs || {},
            options.attackerHero || null
        );
        
        const defenderStats = this.calculateEffectiveStats(
            defender,
            options.defenderBuffs || {},
            options.defenderHero || null
        );
        
        // Add wall defense if applicable
        if (options.wallLevel) {
            defenderStats.wallDefense = this.calculateWallDefense(options.wallLevel);
            defenderStats.wallHp = this.calculateWallHp(options.wallLevel);
        }
        
        // Clone stats for simulation
        const attackerRemaining = JSON.parse(JSON.stringify(attackerStats));
        const defenderRemaining = JSON.parse(JSON.stringify(defenderStats));
        
        // Simulate combat rounds
        let round = 0;
        const maxRounds = 100;
        
        while (this.hasRemainingTroops(attackerRemaining) && 
               this.hasRemainingTroops(defenderRemaining) && 
               round < maxRounds) {
            
            round++;
            const roundResult = this.simulateRound(attackerRemaining, defenderRemaining, round);
            result.rounds.push(roundResult);
            
            result.totalDamageDealt.attacker += roundResult.attackerDamage;
            result.totalDamageDealt.defender += roundResult.defenderDamage;
        }
        
        // Determine winner
        const attackerAlive = this.hasRemainingTroops(attackerRemaining);
        const defenderAlive = this.hasRemainingTroops(defenderRemaining);
        
        if (attackerAlive && !defenderAlive) {
            result.winner = 'attacker';
        } else if (!attackerAlive && defenderAlive) {
            result.winner = 'defender';
        } else if (attackerAlive && defenderAlive) {
            // Timeout - compare remaining power
            const attackerPower = this.calculateTotalPower(attackerRemaining);
            const defenderPower = this.calculateTotalPower(defenderRemaining);
            result.winner = attackerPower > defenderPower ? 'attacker' : 'defender';
        } else {
            result.winner = 'draw';
        }
        
        // Calculate losses
        result.attackerLosses = this.calculateLosses(attackerStats, attackerRemaining);
        result.defenderLosses = this.calculateLosses(defenderStats, defenderRemaining);
        
        // Calculate battle score
        result.score = this.calculateBattleScore(result);
        result.battleTime = round;
        
        this.emit('simulationComplete', result);
        
        return result;
    }

    /**
     * Calculate effective stats with buffs
     */
    calculateEffectiveStats(army, buffs = {}, hero = null) {
        const stats = {
            troops: {},
            totalAttack: 0,
            totalDefense: 0,
            totalHp: 0
        };
        
        for (const [troopType, count] of Object.entries(army)) {
            if (count <= 0) continue;
            
            const def = this.troopDefinitions[troopType.toLowerCase()];
            if (!def) continue;
            
            // Apply buffs
            const attackBuff = 1 + (buffs.attack || 0) / 100;
            const defenseBuff = 1 + (buffs.defense || 0) / 100;
            const hpBuff = 1 + (buffs.hp || 0) / 100;
            
            // Apply hero bonuses
            let heroAttackBonus = 1;
            let heroDefenseBonus = 1;
            if (hero) {
                heroAttackBonus = 1 + (hero.attack || 0) / 1000;
                heroDefenseBonus = 1 + (hero.defense || 0) / 1000;
            }
            
            const effectiveAttack = Math.floor(def.attack * attackBuff * heroAttackBonus);
            const effectiveDefense = Math.floor(def.defense * defenseBuff * heroDefenseBonus);
            const effectiveHp = Math.floor(def.life * hpBuff);
            
            stats.troops[troopType] = {
                count,
                remainingCount: count,
                attack: effectiveAttack,
                defense: effectiveDefense,
                hp: effectiveHp,
                currentHp: effectiveHp * count,
                type: def.type,
                range: def.range,
                tier: def.tier
            };
            
            stats.totalAttack += effectiveAttack * count;
            stats.totalDefense += effectiveDefense * count;
            stats.totalHp += effectiveHp * count;
        }
        
        return stats;
    }

    /**
     * Simulate a single combat round
     */
    simulateRound(attacker, defender, roundNum) {
        const roundResult = {
            round: roundNum,
            attackerDamage: 0,
            defenderDamage: 0,
            attackerKills: {},
            defenderKills: {}
        };
        
        // Ranged troops attack first
        this.processRangedAttacks(attacker, defender, roundResult, 'attacker');
        this.processRangedAttacks(defender, attacker, roundResult, 'defender');
        
        // Melee combat
        this.processMeleeAttacks(attacker, defender, roundResult, 'attacker');
        this.processMeleeAttacks(defender, attacker, roundResult, 'defender');
        
        return roundResult;
    }

    /**
     * Process ranged attacks
     */
    processRangedAttacks(attacker, defender, roundResult, side) {
        for (const [troopType, troopData] of Object.entries(attacker.troops)) {
            if (troopData.remainingCount <= 0) continue;
            if (troopData.range <= 0) continue; // Skip non-ranged
            
            // Calculate damage
            const damage = this.calculateDamage(troopData, defender);
            
            if (side === 'attacker') {
                roundResult.attackerDamage += damage;
            } else {
                roundResult.defenderDamage += damage;
            }
            
            // Apply damage to defender
            this.applyDamage(defender, damage, roundResult, side === 'attacker' ? 'defenderKills' : 'attackerKills');
        }
    }

    /**
     * Process melee attacks
     */
    processMeleeAttacks(attacker, defender, roundResult, side) {
        for (const [troopType, troopData] of Object.entries(attacker.troops)) {
            if (troopData.remainingCount <= 0) continue;
            if (troopData.range > 0) continue; // Skip ranged
            
            // Calculate damage with type advantage
            const damage = this.calculateDamage(troopData, defender);
            
            if (side === 'attacker') {
                roundResult.attackerDamage += damage;
            } else {
                roundResult.defenderDamage += damage;
            }
            
            // Apply damage to defender
            this.applyDamage(defender, damage, roundResult, side === 'attacker' ? 'defenderKills' : 'attackerKills');
        }
    }

    /**
     * Calculate damage from attacker to defender
     */
    calculateDamage(attackerTroop, defender) {
        const baseAttack = attackerTroop.attack * attackerTroop.remainingCount;
        
        // Calculate average defense
        let totalDefense = 0;
        let totalTroops = 0;
        for (const troopData of Object.values(defender.troops)) {
            if (troopData.remainingCount > 0) {
                totalDefense += troopData.defense * troopData.remainingCount;
                totalTroops += troopData.remainingCount;
            }
        }
        
        const avgDefense = totalTroops > 0 ? totalDefense / totalTroops : 0;
        
        // Apply type advantage
        let typeModifier = 1;
        const advantage = this.typeAdvantage[attackerTroop.type];
        if (advantage) {
            for (const troopData of Object.values(defender.troops)) {
                if (troopData.remainingCount > 0 && troopData.type === advantage.strongAgainst) {
                    typeModifier = advantage.modifier;
                    break;
                }
                if (troopData.remainingCount > 0 && troopData.type === advantage.weakAgainst) {
                    typeModifier = 1 / advantage.modifier;
                    break;
                }
            }
        }
        
        // Calculate final damage
        const damage = Math.max(1, Math.floor((baseAttack * typeModifier) - (avgDefense * 0.5)));
        
        return damage;
    }

    /**
     * Apply damage to army
     */
    applyDamage(army, damage, roundResult, killsKey) {
        let remainingDamage = damage;
        
        // Distribute damage across troops (front line first)
        const sortedTroops = Object.entries(army.troops)
            .filter(([_, data]) => data.remainingCount > 0)
            .sort((a, b) => {
                // Melee troops take damage first
                if (a[1].range === 0 && b[1].range > 0) return -1;
                if (a[1].range > 0 && b[1].range === 0) return 1;
                return 0;
            });
        
        for (const [troopType, troopData] of sortedTroops) {
            if (remainingDamage <= 0) break;
            if (troopData.remainingCount <= 0) continue;
            
            const hpPerTroop = troopData.hp;
            const damageToThisTroop = Math.min(remainingDamage, troopData.currentHp);
            
            troopData.currentHp -= damageToThisTroop;
            remainingDamage -= damageToThisTroop;
            
            // Calculate kills
            const kills = Math.floor(damageToThisTroop / hpPerTroop);
            if (kills > 0) {
                troopData.remainingCount = Math.max(0, troopData.remainingCount - kills);
                roundResult[killsKey][troopType] = (roundResult[killsKey][troopType] || 0) + kills;
            }
        }
    }

    /**
     * Check if army has remaining troops
     */
    hasRemainingTroops(army) {
        for (const troopData of Object.values(army.troops)) {
            if (troopData.remainingCount > 0) return true;
        }
        return false;
    }

    /**
     * Calculate total power of army
     */
    calculateTotalPower(army) {
        let power = 0;
        for (const troopData of Object.values(army.troops)) {
            power += troopData.remainingCount * (troopData.attack + troopData.defense + troopData.hp);
        }
        return power;
    }

    /**
     * Calculate losses
     */
    calculateLosses(original, remaining) {
        const losses = {};
        
        for (const [troopType, troopData] of Object.entries(original.troops)) {
            const remainingData = remaining.troops[troopType];
            const lost = troopData.count - (remainingData ? remainingData.remainingCount : 0);
            if (lost > 0) {
                losses[troopType] = lost;
            }
        }
        
        return losses;
    }

    /**
     * Calculate wall defense
     */
    calculateWallDefense(level) {
        return level * 500;
    }

    /**
     * Calculate wall HP
     */
    calculateWallHp(level) {
        return level * 10000;
    }

    /**
     * Calculate battle score
     */
    calculateBattleScore(result) {
        let score = 0;
        
        // Points for winning
        if (result.winner === 'attacker') {
            score += 1000;
        }
        
        // Points for damage dealt
        score += result.totalDamageDealt.attacker / 100;
        
        // Penalty for losses
        for (const count of Object.values(result.attackerLosses)) {
            score -= count;
        }
        
        return Math.floor(score);
    }

    /**
     * Calculate march time
     */
    calculateMarchTime(troops, distance, speedBuffs = {}) {
        // Find slowest troop
        let minSpeed = Infinity;
        
        for (const [troopType, count] of Object.entries(troops)) {
            if (count <= 0) continue;
            
            const def = this.troopDefinitions[troopType.toLowerCase()];
            if (def) {
                minSpeed = Math.min(minSpeed, def.speed);
            }
        }
        
        if (minSpeed === Infinity) {
            minSpeed = 100; // Default speed
        }
        
        // Apply speed buffs
        const marchSpeedBuff = 1 + (speedBuffs.march || 0) / 100;
        const effectiveSpeed = minSpeed * marchSpeedBuff;
        
        // Calculate time (distance in tiles, speed in tiles/hour)
        // Convert to seconds
        const timeInHours = distance / effectiveSpeed;
        const timeInSeconds = Math.ceil(timeInHours * 3600);
        
        return timeInSeconds;
    }

    /**
     * Calculate training cost
     */
    calculateTrainingCost(troopType, count) {
        const def = this.troopDefinitions[troopType.toLowerCase()];
        if (!def) return null;
        
        return {
            food: def.cost.food * count,
            lumber: def.cost.lumber * count,
            stone: def.cost.stone * count,
            iron: def.cost.iron * count,
            time: def.trainTime * count
        };
    }

    /**
     * Calculate army load capacity
     */
    calculateLoadCapacity(troops, loadBuffs = {}) {
        let totalLoad = 0;
        
        for (const [troopType, count] of Object.entries(troops)) {
            if (count <= 0) continue;
            
            const def = this.troopDefinitions[troopType.toLowerCase()];
            if (def) {
                totalLoad += def.load * count;
            }
        }
        
        // Apply load buffs
        const loadBuff = 1 + (loadBuffs.load || 0) / 100;
        
        return Math.floor(totalLoad * loadBuff);
    }

    /**
     * Calculate army upkeep
     */
    calculateUpkeep(troops) {
        let totalUpkeep = 0;
        
        for (const [troopType, count] of Object.entries(troops)) {
            if (count <= 0) continue;
            
            const def = this.troopDefinitions[troopType.toLowerCase()];
            if (def) {
                totalUpkeep += def.upkeep * count;
            }
        }
        
        return totalUpkeep;
    }

    /**
     * Get optimal counter for army composition
     */
    getOptimalCounter(enemyArmy) {
        const composition = { infantry: 0, cavalry: 0, ranged: 0, siege: 0 };
        
        // Analyze enemy composition
        for (const [troopType, count] of Object.entries(enemyArmy)) {
            if (count <= 0) continue;
            
            const def = this.troopDefinitions[troopType.toLowerCase()];
            if (def) {
                composition[def.type] = (composition[def.type] || 0) + count;
            }
        }
        
        // Find dominant type
        let dominantType = 'infantry';
        let maxCount = 0;
        for (const [type, count] of Object.entries(composition)) {
            if (count > maxCount) {
                maxCount = count;
                dominantType = type;
            }
        }
        
        // Recommend counter
        const counters = {
            infantry: { recommend: 'ranged', troops: ['archer', 'longbowman', 'ballista'] },
            cavalry: { recommend: 'infantry', troops: ['pikeman', 'swordsman'] },
            ranged: { recommend: 'cavalry', troops: ['cavalry', 'cataphract', 'heavyCavalry'] },
            siege: { recommend: 'cavalry', troops: ['cavalry', 'cataphract'] }
        };
        
        return counters[dominantType] || counters.infantry;
    }

    /**
     * Format time for display
     */
    formatTime(seconds) {
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
}

module.exports = new CombatSimulator();
