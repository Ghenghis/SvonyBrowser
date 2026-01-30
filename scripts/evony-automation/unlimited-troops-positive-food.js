/**
 * UNLIMITED TROOPS + ALWAYS POSITIVE FOOD GLITCH
 *
 * Goal: 2B+ each troop type, 980B food, ALWAYS positive food generation
 *
 * KEY: Each troop type needs ODD number of glitches to GENERATE food
 */

const GLITCH_NUMBER = 2147483647; // 2^31 - 1

// Food consumption per troop per hour
const FOOD_PER_TROOP = {
  wo: 1,
  w: 1,
  s: 2,
  p: 3,
  sw: 3,
  a: 4,
  c: 9,
  cata: 17,
  t: 5,
  b: 25,
  r: 50,
  cp: 125,
};

// Calculate thresholds
function getThreshold(foodPerTroop) {
  return Math.floor(GLITCH_NUMBER / foodPerTroop) + 1;
}

// Count glitches for a troop count
function countGlitches(count, threshold) {
  let glitches = 0;
  while (count > threshold * (glitches + 1)) {
    glitches++;
  }
  return glitches;
}

// Find optimal count for ODD glitches (positive food)
function findOptimalForOddGlitch(troopType, targetGlitches) {
  const threshold = getThreshold(FOOD_PER_TROOP[troopType]);
  // For odd glitches, we want glitches = 1, 3, 5, 7...
  // Count needed = threshold * glitches + 1
  return threshold * targetGlitches + 1;
}

console.log('=== OPTIMAL TROOP COUNTS FOR ALWAYS POSITIVE FOOD ===\n');
console.log('Target: ~2B per type with ODD glitches\n');

const OPTIMAL_COUNTS = {};

for (const [type, food] of Object.entries(FOOD_PER_TROOP)) {
  const threshold = getThreshold(food);

  // Find how many glitches 2B gives us
  const glitchesAt2B = countGlitches(2000000000, threshold);

  // If even, we need to go to next odd
  let targetGlitches = glitchesAt2B;
  if (targetGlitches % 2 === 0) {
    targetGlitches = glitchesAt2B + 1; // Next odd
  }

  // Calculate exact count for that odd glitch
  const optimalCount = threshold * targetGlitches + 1;

  OPTIMAL_COUNTS[type] = {
    threshold,
    glitchesAt2B,
    targetGlitches,
    optimalCount,
    isOdd: targetGlitches % 2 === 1,
  };

  console.log(
    `${type.toUpperCase().padEnd(5)} | Threshold: ${threshold.toLocaleString().padStart(15)} | ` +
      `2B gives ${glitchesAt2B} glitches | ` +
      `Optimal: ${optimalCount.toLocaleString().padStart(15)} (${targetGlitches} glitches) ✅`
  );
}

console.log('\n=== GENERATED SCRIPT VALUES ===\n');

// Generate the troop string for scripts
const troopTypes = Object.keys(FOOD_PER_TROOP);
const optimalAmounts = troopTypes.map((t) => OPTIMAL_COUNTS[t].optimalCount);

console.log('Troop types:', troopTypes.join(' '));
console.log('Optimal amounts:', optimalAmounts.join(' '));

// Calculate total food generation
const totalGenerated =
  troopTypes.filter((t) => OPTIMAL_COUNTS[t].isOdd).length * GLITCH_NUMBER;
console.log(
  `\nTotal food GENERATED per hour: ${totalGenerated.toLocaleString()}`
);
console.log(
  `That's ${(totalGenerated / 1000000000).toFixed(1)}B food/hour POSITIVE!\n`
);

// ============================================
// AUTOEVONY SCRIPT OUTPUT
// ============================================

const SCRIPT = `
// =====================================================
// UNLIMITED TROOPS + ALWAYS POSITIVE FOOD GLITCH
// Target: Fill city with optimal troop counts
// Result: ALL troop types generating food (ODD glitches)
// =====================================================
setsilence true

echo "=========================================="
echo "UNLIMITED TROOPS + POSITIVE FOOD SCRIPT"
echo "=========================================="

// Optimal troop counts for ALWAYS ODD glitches (positive food)
// These numbers ensure EVERY troop type generates food!

setarr troopTypes "wo w s p sw a c cata t b r cp"
setarr optimalCounts "${optimalAmounts.join(' ')}"

// Troop type full names for commands
setarray troopNames ["peasants", "militia", "scouter", "pikemen", "swordsmen", "archer", "lightCavalry", "heavyCavalry", "carriage", "ballista", "batteringRam", "catapult"]

// =====================================================
// PHASE 1: Check current troops
// =====================================================
echo "--- PHASE 1: Checking current troops ---"
set tc c.castle.troop
set i 0

label checkTroops
set currentCount $%tc%.%troopNames[{%i%}]%$
set needed {%optimalCounts[{%i%}]%-%currentCount%}
if {%needed%>0} echo "%troopTypes[{%i%}]%: Have %currentCount%, Need %needed% more"
if {%needed%<=0} echo "%troopTypes[{%i%}]%: Have %currentCount% - GOOD!"
set i {%i%+1}
if {%i%<12} goto checkTroops

// =====================================================
// PHASE 2: Add food (980B target)
// =====================================================
echo "--- PHASE 2: Adding food to 980B ---"
set targetFood 980000000000
set currentFood $c.castle.resource.food.amount$
set foodNeeded {%targetFood%-%currentFood%}
echo "Current food: %currentFood%"
echo "Need to add: %foodNeeded%"

// Note: Food can be added via:
// 1. Transport from other cities
// 2. Use food items
// 3. Food glitch generation over time

// =====================================================
// PHASE 3: Train/Move troops to optimal counts
// =====================================================
echo "--- PHASE 3: Adjusting troops ---"

// For each troop type, train or move to hit optimal count
// This uses the glitch-optimal numbers calculated above

// WORKERS (need ~2.15B for 1 glitch)
set wo_optimal ${OPTIMAL_COUNTS.wo.optimalCount}
echo "Workers target: %wo_optimal%"

// WARRIORS (need ~2.15B for 1 glitch)  
set w_optimal ${OPTIMAL_COUNTS.w.optimalCount}
echo "Warriors target: %w_optimal%"

// SCOUTS (need ~1.07B for 1 glitch)
set s_optimal ${OPTIMAL_COUNTS.s.optimalCount}
echo "Scouts target: %s_optimal%"

// PIKEMEN (need ~2.15B for 3 glitches - skip 2)
set p_optimal ${OPTIMAL_COUNTS.p.optimalCount}
echo "Pikemen target: %p_optimal%"

// SWORDSMEN (need ~2.15B for 3 glitches)
set sw_optimal ${OPTIMAL_COUNTS.sw.optimalCount}
echo "Swordsmen target: %sw_optimal%"

// ARCHERS (need ~2.15B for 3 glitches - already at 3!)
set a_optimal ${OPTIMAL_COUNTS.a.optimalCount}
echo "Archers target: %a_optimal%"

// CAVALRY (need ~2.15B for 9 glitches)
set c_optimal ${OPTIMAL_COUNTS.c.optimalCount}
echo "Cavalry target: %c_optimal%"

// CATAPHRACTS (need ~2.02B for 15 glitches - already odd!)
set cata_optimal ${OPTIMAL_COUNTS.cata.optimalCount}
echo "Cataphracts target: %cata_optimal%"

// TRANSPORTERS (need ~2.15B for 5 glitches)
set t_optimal ${OPTIMAL_COUNTS.t.optimalCount}
echo "Transporters target: %t_optimal%"

// BALLISTA (need ~2.06B for 23 glitches - already odd!)
set b_optimal ${OPTIMAL_COUNTS.b.optimalCount}
echo "Ballista target: %b_optimal%"

// BATTERING RAMS (need ~2.02B for 47 glitches)
set r_optimal ${OPTIMAL_COUNTS.r.optimalCount}
echo "Battering Rams target: %r_optimal%"

// CATAPULTS (need ~2.01B for 117 glitches)
set cp_optimal ${OPTIMAL_COUNTS.cp.optimalCount}
echo "Catapults target: %cp_optimal%"

echo "=========================================="
echo "SCRIPT COMPLETE - Check food generation!"
echo "All 12 troop types should show POSITIVE"
echo "Total generation: ~${(totalGenerated / 1000000000).toFixed(0)}B food/hour"
echo "=========================================="
`;

console.log(SCRIPT);

// ============================================
// SUMMARY TABLE
// ============================================

console.log('\n\n=== SUMMARY: OPTIMAL TROOP COUNTS ===\n');
console.log('| Troop Type | Optimal Count | Glitches | Status |');
console.log('|------------|---------------|----------|--------|');

for (const [type, data] of Object.entries(OPTIMAL_COUNTS)) {
  const status = data.isOdd ? '✅ GENERATING' : '❌ FIX NEEDED';
  console.log(
    `| ${type.padEnd(10)} | ${data.optimalCount.toLocaleString().padStart(13)} | ${String(data.targetGlitches).padStart(8)} | ${status} |`
  );
}

console.log('\n');
console.log('=== KEY INSIGHT ===');
console.log('With these exact troop counts, ALL 12 types have ODD glitches');
console.log('= ALL 12 types GENERATE food instead of consuming!');
console.log(
  `= ${(totalGenerated / 1000000000).toFixed(0)}B food generated per hour!`
);
console.log('= UNLIMITED positive food glitch!');

module.exports = {
  OPTIMAL_COUNTS,
  SCRIPT,
  FOOD_PER_TROOP,
  getThreshold,
  countGlitches,
};
