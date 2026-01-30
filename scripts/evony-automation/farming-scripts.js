/**
 * Evony Farming Scripts
 * Automated resource gathering, valley farming, NPC attacks
 */

const { EvonyAutomation } = require('./base-automation');

class FarmingScripts extends EvonyAutomation {
  constructor(config = {}) {
    super(config);
    this.farmLog = [];
    this.activeMarches = [];
  }

  // ============== Valley Farming ==============

  async valleyFarm(options = {}) {
    const {
      valleyLevel = 10,
      troopType = 'archer',
      troopCount = 100000,
      maxMarches = 5,
      interval = 60000, // 1 minute
      dryRun = true,
    } = options;

    console.log('[FarmingScripts] === VALLEY FARMING ===');
    console.log(`  Valley Level: ${valleyLevel}`);
    console.log(`  Troop Type: ${troopType}`);
    console.log(`  Troop Count: ${troopCount.toLocaleString()}`);
    console.log(`  Max Marches: ${maxMarches}`);

    const steps = [
      { action: 'scan_map', desc: `Scan for level ${valleyLevel} valleys` },
      {
        action: 'select_troops',
        desc: `Select ${troopCount.toLocaleString()} ${troopType}`,
      },
      { action: 'send_march', desc: 'Send march to valley' },
      { action: 'monitor', desc: 'Monitor march and collect resources' },
    ];

    this.logFarm('valley_farm', { valleyLevel, troopType, troopCount, dryRun });

    if (dryRun) {
      console.log('[FarmingScripts] DRY RUN - Steps:');
      steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.desc}`));
      return { success: true, dryRun: true, steps };
    }

    return { success: true, dryRun };
  }

  // ============== NPC Farming ==============

  async npcFarm(options = {}) {
    const {
      npcLevel = 5,
      heroRequired = true,
      troopComposition = {
        warrior: 0,
        scout: 1000,
        pike: 0,
        sword: 0,
        archer: 90000,
        cavalry: 0,
        catapult: 0,
        ballista: 0,
      },
      maxAttacks = 10,
      dryRun = true,
    } = options;

    console.log('[FarmingScripts] === NPC FARMING ===');
    console.log(`  NPC Level: ${npcLevel}`);
    console.log(`  Hero Required: ${heroRequired}`);
    console.log(`  Troop Composition:`, troopComposition);

    // Calculate total troops
    const totalTroops = Object.values(troopComposition).reduce(
      (a, b) => a + b,
      0
    );
    console.log(`  Total Troops: ${totalTroops.toLocaleString()}`);

    const npcRewards = {
      1: { gold: 500, food: 1000 },
      2: { gold: 1000, food: 2000 },
      3: { gold: 2000, food: 4000 },
      4: { gold: 4000, food: 8000 },
      5: { gold: 8000, food: 16000, medals: true },
      6: { gold: 16000, food: 32000, medals: true },
      7: { gold: 32000, food: 64000, medals: true },
      8: { gold: 64000, food: 128000, medals: true },
      9: { gold: 128000, food: 256000, medals: true },
      10: { gold: 256000, food: 512000, medals: true, items: true },
    };

    const expectedReward = npcRewards[npcLevel] || npcRewards[5];
    console.log(`  Expected Reward:`, expectedReward);

    const steps = [
      { action: 'find_npc', desc: `Find level ${npcLevel} NPC` },
      {
        action: 'assign_hero',
        desc: heroRequired ? 'Assign hero to army' : 'Skip hero',
      },
      { action: 'compose_army', desc: 'Compose army with specified troops' },
      { action: 'attack', desc: 'Launch attack on NPC' },
      { action: 'collect', desc: 'Collect rewards' },
    ];

    this.logFarm('npc_farm', {
      npcLevel,
      troopComposition,
      expectedReward,
      dryRun,
    });

    if (dryRun) {
      console.log('[FarmingScripts] DRY RUN - Steps:');
      steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.desc}`));
      return { success: true, dryRun: true, steps, expectedReward };
    }

    return { success: true, dryRun };
  }

  // ============== Resource Tile Farming ==============

  async resourceTileFarm(options = {}) {
    const {
      resourceType = 'food', // food, lumber, stone, iron
      tileLevel = 5,
      workerCount = 10000,
      duration = 3600, // seconds
      dryRun = true,
    } = options;

    console.log('[FarmingScripts] === RESOURCE TILE FARMING ===');
    console.log(`  Resource Type: ${resourceType}`);
    console.log(`  Tile Level: ${tileLevel}`);
    console.log(`  Workers: ${workerCount.toLocaleString()}`);

    const gatherRates = {
      food: { base: 1000, perLevel: 500, perWorker: 10 },
      lumber: { base: 800, perLevel: 400, perWorker: 8 },
      stone: { base: 600, perLevel: 300, perWorker: 6 },
      iron: { base: 400, perLevel: 200, perWorker: 4 },
    };

    const rate = gatherRates[resourceType] || gatherRates.food;
    const hourlyGather =
      ((rate.base + rate.perLevel * tileLevel) * workerCount * rate.perWorker) /
      1000;

    console.log(`  Estimated hourly gather: ${hourlyGather.toLocaleString()}`);

    this.logFarm('resource_tile', {
      resourceType,
      tileLevel,
      workerCount,
      hourlyGather,
      dryRun,
    });

    if (dryRun) {
      return { success: true, dryRun: true, hourlyGather };
    }

    return { success: true, dryRun };
  }

  // ============== Auto-Farm Loop ==============

  async autoFarmLoop(options = {}) {
    const {
      targets = ['npc', 'valley'],
      interval = 300000, // 5 minutes
      maxIterations = 10,
      dryRun = true,
    } = options;

    console.log('[FarmingScripts] === AUTO-FARM LOOP ===');
    console.log(`  Targets: ${targets.join(', ')}`);
    console.log(`  Interval: ${interval}ms`);
    console.log(`  Max Iterations: ${maxIterations}`);

    if (dryRun) {
      console.log('[FarmingScripts] DRY RUN - Would loop through:');
      for (let i = 0; i < Math.min(3, maxIterations); i++) {
        console.log(`  Iteration ${i + 1}:`);
        targets.forEach((t) => console.log(`    - Execute ${t} farm`));
        console.log(`    - Wait ${interval}ms`);
      }
      if (maxIterations > 3)
        console.log(`  ... and ${maxIterations - 3} more iterations`);
      return { success: true, dryRun: true };
    }

    return { success: true, dryRun };
  }

  // ============== Logging ==============

  logFarm(type, details) {
    this.farmLog.push({
      type,
      details,
      timestamp: Date.now(),
    });
    this.recordMetric('farm', 0, { type, ...details });
  }

  getFarmReport() {
    return {
      farms: this.farmLog,
      activeMarches: this.activeMarches,
      timestamp: Date.now(),
    };
  }
}

// CLI usage
if (require.main === module) {
  const farming = new FarmingScripts();

  console.log('\n=== EVONY FARMING SCRIPTS ===\n');

  console.log('--- Valley Farm Demo ---');
  farming.valleyFarm({ dryRun: true });

  console.log('\n--- NPC Farm Demo ---');
  farming.npcFarm({ npcLevel: 5, dryRun: true });

  console.log('\n--- Resource Tile Farm Demo ---');
  farming.resourceTileFarm({ resourceType: 'food', dryRun: true });

  console.log('\n--- Auto-Farm Loop Demo ---');
  farming.autoFarmLoop({ dryRun: true });
}

module.exports = { FarmingScripts };
