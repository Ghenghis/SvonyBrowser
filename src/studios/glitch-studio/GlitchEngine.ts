/**
 * GlitchEngine - Core glitch execution and safety system
 * Handles food glitch, troop glitch, and move glitch with failsafes
 */

export interface GlitchConfig {
  mode: 'safe' | 'override' | 'danger';
  maxTroopsPerType: number;
  maxTotalTroops: number;
  maxFoodPerCity: number;
  maxGoldPerAccount: number;
  requiredThunderRaids: number;
}

export interface TroopGlitchParams {
  cityId: string;
  valleyCoords: { x: number; y: number };
  troopType: string;
  amount: number;
  thunderRaidCount: number;
}

export interface FoodGlitchParams {
  cityId: string;
  valleyCoords: { x: number; y: number };
  transportAmount: number;
}

export interface MoveGlitchParams {
  sourceCityId: string;
  targetCityId: string;
  troops: Record<string, number>;
  useCommissionQuest: boolean;
}

export interface GlitchResult {
  success: boolean;
  message: string;
  beforeState: any;
  afterState: any;
  warnings: string[];
  errors: string[];
}

const SAFE_LIMITS: GlitchConfig = {
  mode: 'safe',
  maxTroopsPerType: 700_000_000, // 700M default
  maxTotalTroops: 700_000_000_000, // 700B safe limit
  maxFoodPerCity: 999_000_000_000, // 999B per city (flips after)
  maxGoldPerAccount: 2_100_000_000, // 2.1B (32-bit signed limit)
  requiredThunderRaids: 5, // Minimum 5-7 for troop glitch
};

const OVERRIDE_LIMITS: GlitchConfig = {
  mode: 'override',
  maxTroopsPerType: 1_000_000_000, // 1B override
  maxTotalTroops: 700_000_000_000,
  maxFoodPerCity: 999_000_000_000,
  maxGoldPerAccount: 2_100_000_000,
  requiredThunderRaids: 5,
};

const DANGER_LIMITS: GlitchConfig = {
  mode: 'danger',
  maxTroopsPerType: Number.MAX_SAFE_INTEGER,
  maxTotalTroops: Number.MAX_SAFE_INTEGER,
  maxFoodPerCity: Number.MAX_SAFE_INTEGER,
  maxGoldPerAccount: 2_100_000_000, // Still respect 32-bit limit
  requiredThunderRaids: 3,
};

export class GlitchEngine {
  private config: GlitchConfig;
  private logs: string[] = [];

  constructor(mode: 'safe' | 'override' | 'danger' = 'safe') {
    this.config = this.getConfig(mode);
    this.log(`GlitchEngine initialized in ${mode} mode`);
  }

  private getConfig(mode: string): GlitchConfig {
    switch (mode) {
      case 'override':
        return { ...OVERRIDE_LIMITS };
      case 'danger':
        return { ...DANGER_LIMITS };
      default:
        return { ...SAFE_LIMITS };
    }
  }

  setMode(mode: 'safe' | 'override' | 'danger'): void {
    this.config = this.getConfig(mode);
    this.log(`Mode changed to: ${mode}`);
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.logs.push(`[${timestamp}] ${message}`);
    // Logging removed per contract requirements - no console.log in production
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  validateTroopGlitch(params: TroopGlitchParams): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (params.amount > this.config.maxTroopsPerType) {
      errors.push(
        `Amount ${params.amount.toLocaleString()} exceeds limit of ${this.config.maxTroopsPerType.toLocaleString()}`
      );
    }

    if (params.thunderRaidCount < this.config.requiredThunderRaids) {
      errors.push(
        `Need ${this.config.requiredThunderRaids} thunder raids, have ${params.thunderRaidCount}`
      );
    }

    if (params.amount > 500_000_000) {
      warnings.push('Large glitch amount - ensure troops are relocated first');
    }

    if (this.config.mode === 'danger') {
      warnings.push('DANGER MODE: No safety limits active');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateFoodGlitch(params: FoodGlitchParams): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (params.transportAmount > 500_000_000_000) {
      warnings.push('Transport amount over 500B - verify valley capacity');
    }

    if (params.transportAmount > this.config.maxFoodPerCity) {
      errors.push(
        `Amount would exceed city food limit of ${this.config.maxFoodPerCity.toLocaleString()}`
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateMoveGlitch(params: MoveGlitchParams): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const totalTroops = Object.values(params.troops).reduce((a, b) => a + b, 0);

    if (totalTroops > 2_100_000_000) {
      errors.push(
        `Total troops ${totalTroops.toLocaleString()} exceeds commission quest limit of 2.1B`
      );
    }

    if (!params.useCommissionQuest && totalTroops > 100_000_000) {
      warnings.push(
        'Large move without commission quest - may take multiple trips'
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  generateTroopGlitchScript(params: TroopGlitchParams): string {
    const validation = this.validateTroopGlitch(params);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    this.log(
      `Generating troop glitch script for ${params.amount.toLocaleString()} ${params.troopType}`
    );

    return `// Troop Glitch Script - Generated by GlitchEngine
// Mode: ${this.config.mode}
// Target: ${params.amount.toLocaleString()} ${params.troopType}
// Valley: (${params.valleyCoords.x}, ${params.valleyCoords.y})
// Thunder Raids: ${params.thunderRaidCount}

// STEP 1: Verify thunder raid count
if (thunderRaidCount < ${this.config.requiredThunderRaids}) {
  log("ERROR: Need ${this.config.requiredThunderRaids} thunder raids");
  stop();
}

// STEP 2: Verify valley is 1 tile from city
valleyDist = getDistance(city.coords, valley.coords);
if (valleyDist != 1) {
  log("ERROR: Valley must be 1 tile from city");
  stop();
}

// STEP 3: Add troops to city
addTroops("${params.troopType}", ${params.amount});
wait(500);

// STEP 4: Execute glitch sequence with thunder raids
for (i = 0; i < ${params.thunderRaidCount}; i++) {
  sendThunderRaid(valley.coords);
  wait(100);
}

// STEP 5: Verify doubling
newCount = getTroopCount("${params.troopType}");
log("Glitch complete. New count: " + newCount);

// STEP 6: Move troops if needed (prevent overflow)
if (newCount > ${this.config.maxTroopsPerType}) {
  log("WARNING: Moving excess troops to prevent overflow");
  moveTroopsToNearestCity("${params.troopType}", newCount - ${this.config.maxTroopsPerType});
}
`;
  }

  generateFoodGlitchScript(params: FoodGlitchParams): string {
    const validation = this.validateFoodGlitch(params);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    this.log(
      `Generating food glitch script for ${params.transportAmount.toLocaleString()} food`
    );

    return `// Food Glitch Script - Generated by GlitchEngine
// Mode: ${this.config.mode}
// Transport Amount: ${params.transportAmount.toLocaleString()}
// Valley: (${params.valleyCoords.x}, ${params.valleyCoords.y})

// STEP 1: Verify valley is 1 tile from city
valleyDist = getDistance(city.coords, valley.coords);
if (valleyDist != 1) {
  log("ERROR: Valley must be 1 tile from city");
  stop();
}

// STEP 2: Check current city food level
currentFood = getCityFood();
if (currentFood + ${params.transportAmount} > ${this.config.maxFoodPerCity}) {
  log("WARNING: Would exceed city food limit - may flip to 0");
  if ("${this.config.mode}" == "safe") {
    stop();
  }
}

// STEP 3: Load transports with food
loadTransports(${params.transportAmount});
wait(500);

// STEP 4: Send to valley
sendTransportsToValley(valley.coords);
wait(1000);

// STEP 5: Execute food glitch
executeGlitchScript();
wait(500);

// STEP 6: Recall transports with doubled food
recallTransports();
log("Food glitch complete. Check city food level.");
`;
  }

  generateMoveGlitchScript(params: MoveGlitchParams): string {
    const validation = this.validateMoveGlitch(params);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const troopList = Object.entries(params.troops)
      .map(([type, count]) => `  "${type}": ${count}`)
      .join(',\n');

    this.log(
      `Generating move glitch script for ${Object.values(params.troops)
        .reduce((a, b) => a + b, 0)
        .toLocaleString()} troops`
    );

    return `// Move Glitch Script - Generated by GlitchEngine
// Mode: ${this.config.mode}
// Source City: ${params.sourceCityId}
// Target City: ${params.targetCityId}
// Use Commission Quest: ${params.useCommissionQuest}

troops = {
${troopList}
};

totalTroops = ${Object.values(params.troops).reduce((a, b) => a + b, 0)};

// STEP 1: Verify troop counts
for (type in troops) {
  current = getTroopCount(type);
  if (current < troops[type]) {
    log("ERROR: Not enough " + type + ". Have: " + current + ", Need: " + troops[type]);
    stop();
  }
}

// STEP 2: Use commission quest for instant move
if (${params.useCommissionQuest}) {
  if (totalTroops > 2100000000) {
    log("ERROR: Cannot move more than 2.1B with commission quest");
    stop();
  }
  
  // Start commission quest
  startCommissionQuest("${params.sourceCityId}", "${params.targetCityId}");
  wait(500);
  
  // Add troops to quest
  for (type in troops) {
    addTroopsToQuest(type, troops[type]);
  }
  
  // Complete quest for instant transfer
  completeCommissionQuest();
  log("Move glitch complete. Troops transferred instantly.");
} else {
  // Standard march (slower)
  for (type in troops) {
    sendMarch("${params.targetCityId}", type, troops[type]);
    wait(100);
  }
  log("March started. Troops will arrive at destination.");
}
`;
  }

  getStatus(): { mode: string; limits: GlitchConfig; logCount: number } {
    return {
      mode: this.config.mode,
      limits: { ...this.config },
      logCount: this.logs.length,
    };
  }
}

export const glitchEngine = new GlitchEngine('safe');
export default GlitchEngine;
