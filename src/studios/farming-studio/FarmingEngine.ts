/**
 * FarmingEngine - Amulet farming, thunder raid accumulation, and item management
 * Implements the red alliance valley farming strategy
 */

export interface FarmingConfig {
  targetAmulets: number;
  targetThunderRaids: number;
  catapultCount: number;
  archerCount: number;
  autoSpin: boolean;
  spinPriority: 'thunderRaid' | 'coins' | 'items';
}

export interface ValleySetup {
  valleyId: string;
  coords: { x: number; y: number };
  ownerPlayerId: string;
  ownerAlliance: string;
  archerCount: number;
  distanceFromCity: number;
  isRed: boolean;
}

export interface FarmingSession {
  id: string;
  startTime: string;
  endTime?: string;
  attackCity: string;
  targetValley: ValleySetup;
  attackCount: number;
  drops: FarmingDrop[];
  status: 'active' | 'paused' | 'completed';
}

export interface FarmingDrop {
  timestamp: string;
  itemType: string;
  itemName: string;
  quantity: number;
}

export interface ItemInventory {
  amulets: number;
  thunderRaids: number;
  coins: number;
  speedups: Record<string, number>;
  resources: Record<string, number>;
  other: Record<string, number>;
}

const DEFAULT_CONFIG: FarmingConfig = {
  targetAmulets: 100000, // 100K amulets
  targetThunderRaids: 500, // 250-500 thunder raids
  catapultCount: 33000, // 33K cata per attack
  archerCount: 20000000, // 20M archers in valley
  autoSpin: true,
  spinPriority: 'thunderRaid',
};

export class FarmingEngine {
  private config: FarmingConfig;
  private inventory: ItemInventory;
  private sessions: Map<string, FarmingSession> = new Map();
  private activeSessionId: string | null = null;

  constructor(config: Partial<FarmingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.inventory = this.initInventory();
  }

  private initInventory(): ItemInventory {
    return {
      amulets: 0,
      thunderRaids: 0,
      coins: 0,
      speedups: {},
      resources: {},
      other: {},
    };
  }

  setConfig(config: Partial<FarmingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): FarmingConfig {
    return { ...this.config };
  }

  validateValleySetup(valley: ValleySetup): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!valley.isRed) {
      errors.push('Valley must belong to a red (enemy) player');
    }

    if (valley.distanceFromCity !== 1) {
      errors.push('Valley must be exactly 1 tile from attacking city');
    }

    if (valley.archerCount < 10000000) {
      warnings.push(
        'Recommended: At least 10M archers in valley for consistent drops'
      );
    }

    if (valley.archerCount < 20000000) {
      warnings.push('Optimal setup: 20M archers in valley');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  generateSetupGuide(): string {
    return `# Amulet Farming Setup Guide

## Prerequisites
1. Create or join a "red" alliance (enemy alliance for war)
2. Coordinate with ally who will set up valleys
3. Prepare attacking cities with 33K+ catapults each

## Valley Setup (Red Player)
1. Capture valleys 1 tile away from each attacker's city
2. Add exactly 20,000,000 (20M) archers to each valley
3. DO NOT add any other troop types - archers only
4. Ensure valley is visible to attacker (war declaration)

## Attack Configuration
- Troop: Catapults ONLY
- Count: 33,000 (33K) per attack
- Target: Red ally's valley (1 tile away)
- Rally: Not required, direct attack

## Expected Drops
- Amulets (primary target)
- Coins
- Speed-ups
- Random items

## Accumulation Targets
- Stage 1: 5,000 amulets
- Stage 2: 10,000 amulets
- Stage 3: 100,000 amulets
- Goal: 250-500 thunder raids from spinning

## Spinning Strategy
1. Save amulets until 5K-10K minimum
2. Spin for thunder raids priority
3. Use coins to buy more thunder raids
4. Target: 250-500 thunder raids for troop glitching
`;
  }

  startSession(attackCity: string, targetValley: ValleySetup): FarmingSession {
    const session: FarmingSession = {
      id: `farm_${Date.now()}`,
      startTime: new Date().toISOString(),
      attackCity,
      targetValley,
      attackCount: 0,
      drops: [],
      status: 'active',
    };

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;

    return session;
  }

  recordAttack(drops: FarmingDrop[]): void {
    if (!this.activeSessionId) return;

    const session = this.sessions.get(this.activeSessionId);
    if (!session || session.status !== 'active') return;

    session.attackCount++;
    session.drops.push(...drops);

    drops.forEach((drop) => {
      switch (drop.itemType) {
        case 'amulet':
          this.inventory.amulets += drop.quantity;
          break;
        case 'thunderRaid':
          this.inventory.thunderRaids += drop.quantity;
          break;
        case 'coins':
          this.inventory.coins += drop.quantity;
          break;
        default:
          this.inventory.other[drop.itemName] =
            (this.inventory.other[drop.itemName] || 0) + drop.quantity;
      }
    });
  }

  pauseSession(): void {
    if (!this.activeSessionId) return;
    const session = this.sessions.get(this.activeSessionId);
    if (session) session.status = 'paused';
  }

  resumeSession(): void {
    if (!this.activeSessionId) return;
    const session = this.sessions.get(this.activeSessionId);
    if (session) session.status = 'active';
  }

  endSession(): FarmingSession | null {
    if (!this.activeSessionId) return null;

    const session = this.sessions.get(this.activeSessionId);
    if (session) {
      session.status = 'completed';
      session.endTime = new Date().toISOString();
    }

    this.activeSessionId = null;
    return session || null;
  }

  getActiveSession(): FarmingSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  getAllSessions(): FarmingSession[] {
    return Array.from(this.sessions.values());
  }

  getInventory(): ItemInventory {
    return { ...this.inventory };
  }

  updateInventory(updates: Partial<ItemInventory>): void {
    this.inventory = { ...this.inventory, ...updates };
  }

  generateAttackScript(): string {
    return `// Amulet Farming Attack Script
// Generated by FarmingEngine
// Config: ${this.config.catapultCount} catapults per attack

function farmAmulets(valleyCoords, attackCount) {
  log("Starting amulet farming session");
  log("Target valley: (" + valleyCoords.x + ", " + valleyCoords.y + ")");
  
  // Verify catapult count
  catCount = getTroopCount("catapult");
  if (catCount < ${this.config.catapultCount}) {
    log("ERROR: Need ${this.config.catapultCount} catapults, have " + catCount);
    stop();
  }
  
  // Verify valley distance
  valleyDist = getDistance(city.coords, valleyCoords);
  if (valleyDist != 1) {
    log("ERROR: Valley must be 1 tile from city");
    stop();
  }
  
  // Attack loop
  for (i = 0; i < attackCount; i++) {
    log("Attack " + (i+1) + "/" + attackCount);
    
    // Send catapults
    sendAttack(valleyCoords, "catapult", ${this.config.catapultCount});
    
    // Wait for return (adjust based on distance)
    wait(5000);
    
    // Check drops
    drops = getLastBattleDrops();
    logDrops(drops);
    
    // Small delay between attacks
    wait(1000);
  }
  
  log("Farming session complete. Check inventory for drops.");
}

// Execute
farmAmulets({x: VALLEY_X, y: VALLEY_Y}, 100);
`;
  }

  generateSpinScript(): string {
    return `// Amulet Spinning Script
// Generated by FarmingEngine
// Priority: ${this.config.spinPriority}

function spinAmulets(count) {
  log("Starting to spin " + count + " amulets");
  
  amuletCount = getItemCount("amulet");
  if (amuletCount < count) {
    log("ERROR: Not enough amulets. Have: " + amuletCount);
    stop();
  }
  
  thunderRaids = 0;
  coins = 0;
  items = [];
  
  for (i = 0; i < count; i++) {
    result = spinAmulet();
    
    if (result.type == "thunderRaid") {
      thunderRaids++;
    } else if (result.type == "coins") {
      coins += result.amount;
    } else {
      items.push(result);
    }
    
    wait(100);
  }
  
  log("Spinning complete!");
  log("Thunder Raids: " + thunderRaids);
  log("Coins: " + coins);
  log("Other items: " + items.length);
}

// Spin all amulets
spinAmulets(getItemCount("amulet"));
`;
  }

  getProgress(): {
    amulets: number;
    thunderRaids: number;
    targetMet: boolean;
    percentage: number;
  } {
    const amuletProgress =
      (this.inventory.amulets / this.config.targetAmulets) * 100;
    const raidProgress =
      (this.inventory.thunderRaids / this.config.targetThunderRaids) * 100;

    return {
      amulets: this.inventory.amulets,
      thunderRaids: this.inventory.thunderRaids,
      targetMet: this.inventory.thunderRaids >= this.config.targetThunderRaids,
      percentage: Math.min(100, (amuletProgress + raidProgress) / 2),
    };
  }

  getStats(): {
    totalAttacks: number;
    totalDrops: number;
    avgDropsPerAttack: number;
    sessionCount: number;
  } {
    let totalAttacks = 0;
    let totalDrops = 0;

    this.sessions.forEach((session) => {
      totalAttacks += session.attackCount;
      totalDrops += session.drops.length;
    });

    return {
      totalAttacks,
      totalDrops,
      avgDropsPerAttack: totalAttacks > 0 ? totalDrops / totalAttacks : 0,
      sessionCount: this.sessions.size,
    };
  }
}

export const farmingEngine = new FarmingEngine();
export default FarmingEngine;
