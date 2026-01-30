/**
 * BATCH ACCOUNT SCANNER
 * Scans multiple accounts from accounts-master.json
 * Outputs detailed troop report per city per account
 *
 * TARGET: Find accounts with 8B-20B troops for glitch testing
 */

const fs = require('fs');
const path = require('path');

// Load accounts database
const accountsPath = path.join(
  __dirname,
  '../../evony-knowledge/data/accounts-master.json'
);
const accTxtPath = path.join(__dirname, '../../docs/acc.txt');

// Glitch thresholds
const GLITCH_THRESHOLDS = {
  wo: 2147483648,
  w: 2147483648,
  s: 1073741824,
  p: 715827883,
  sw: 715827883,
  a: 536870912,
  c: 238609295,
  cata: 126322568,
  t: 429496730,
  b: 85899346,
  r: 42949673,
  cp: 17179870,
};

const GLITCH_VALUE = 2147483647;
const MIN_TARGET = 8000000000; // 8B
const MAX_TARGET = 20000000000; // 20B

// Parse acc.txt format
function parseAccTxt(content) {
  const lines = content.trim().split('\n');
  const accounts = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse tab/space separated values
    const parts = line.split(/\s+/).filter((p) => p);
    if (parts.length >= 3) {
      accounts.push({
        name: parts[0],
        email: parts[1],
        password: parts[2],
        secCode: parts[3] || '',
      });
    }
  }

  return accounts;
}

// Load all accounts from both sources
function loadAllAccounts() {
  const allAccounts = [];

  // Load from acc.txt
  try {
    const accTxtContent = fs.readFileSync(accTxtPath, 'utf8');
    const accTxtAccounts = parseAccTxt(accTxtContent);
    console.log(`Loaded ${accTxtAccounts.length} accounts from acc.txt`);
    allAccounts.push(
      ...accTxtAccounts.map((a) => ({ ...a, source: 'acc.txt' }))
    );
  } catch (e) {
    console.log('Could not load acc.txt:', e.message);
  }

  // Load from accounts-master.json
  try {
    const masterContent = fs.readFileSync(accountsPath, 'utf8');
    const masterData = JSON.parse(masterContent);

    // Add conflict accounts (with multiple passwords)
    if (masterData.conflict_accounts) {
      for (const acc of masterData.conflict_accounts) {
        // Add each password variant
        for (const pwd of acc.passwords) {
          allAccounts.push({
            email: acc.email,
            password: pwd,
            source: 'accounts-master.json',
            hasConflict: true,
          });
        }
      }
    }

    console.log(
      `Loaded ${masterData.conflict_accounts?.length || 0} conflict accounts from accounts-master.json`
    );
    console.log(
      `Total accounts in master: ${masterData.metadata?.total_accounts || 'unknown'}`
    );
  } catch (e) {
    console.log('Could not load accounts-master.json:', e.message);
  }

  return allAccounts;
}

// Generate scan report template
function generateScanReport(accountData) {
  const { name, email, cities, totalTroops, totalFood, glitchTypes } =
    accountData;

  let status = '❌ TOO SMALL';
  if (totalTroops >= MIN_TARGET && totalTroops <= MAX_TARGET) {
    status = '✅ IDEAL (8B-20B)';
  } else if (totalTroops > MAX_TARGET) {
    status = '⚠️ TOO LARGE';
  }

  let report = `
┌${'─'.repeat(60)}
│ ACCOUNT: ${name || 'Unknown'}
│ EMAIL: ${email}
│ STATUS: ${status}
├${'─'.repeat(60)}`;

  for (const city of cities) {
    report += `
│ CITY ${city.index}: ${city.name} @ ${city.x},${city.y}
│   Troops: ${city.troops.toLocaleString()}
│   Food: ${city.food.toLocaleString()}
│   ├─ wo: ${city.wo?.toLocaleString() || 0}  w: ${city.w?.toLocaleString() || 0}
│   ├─ s: ${city.s?.toLocaleString() || 0}  p: ${city.p?.toLocaleString() || 0}
│   ├─ sw: ${city.sw?.toLocaleString() || 0}  a: ${city.a?.toLocaleString() || 0}
│   ├─ c: ${city.c?.toLocaleString() || 0}  cata: ${city.cata?.toLocaleString() || 0}
│   ├─ t: ${city.t?.toLocaleString() || 0}  b: ${city.b?.toLocaleString() || 0}
│   └─ r: ${city.r?.toLocaleString() || 0}  cp: ${city.cp?.toLocaleString() || 0}`;

    if (city.glitchTypes?.length > 0) {
      report += `
│   🔥 GLITCH: ${city.glitchTypes.join(', ')}`;
    }
  }

  const potentialFood = glitchTypes * GLITCH_VALUE;

  report += `
├${'─'.repeat(60)}
│ TOTALS:
│   Total Troops: ${totalTroops.toLocaleString()}
│   Total Food: ${totalFood.toLocaleString()}
│   Cities: ${cities.length}
│   Glitch Types: ${glitchTypes}/9
│   Potential Food/hr: ${potentialFood.toLocaleString()}
└${'─'.repeat(60)}
`;

  return report;
}

// Generate AutoEvony scan script for an account
function generateAutoEvonyScanScript(email, password) {
  return `
// AUTO-GENERATED SCAN SCRIPT
// Account: ${email}
// Run this in AutoEvony/RoboEvony script window

setsilence true

echo "┌${'─'.repeat(50)}"
echo "│ SCANNING: ${email}"
echo "├${'─'.repeat(50)}"

set numCities $c.allCities.length$
set totalTroops 0
set totalFood 0

set i 0
label cityLoop
if {%i%>=%numCities%} goto done

switchcity %i%
sleep 0.3

set name $c.castle.name$
set x $c.castle.x$
set y $c.castle.y$
set troops $c.cm.allTroop.total$
set food $c.castle.resource.food.amount$

echo "│ City %i%: %name% @ %x%,%y%"
echo "│   Troops: %troops%"
echo "│   Food: %food%"

// Individual counts
echo "│   wo:$c.castle.troop.peasants$ w:$c.castle.troop.militia$"
echo "│   s:$c.castle.troop.scouter$ p:$c.castle.troop.pikemen$"
echo "│   sw:$c.castle.troop.swordsmen$ a:$c.castle.troop.archer$"
echo "│   c:$c.castle.troop.lightCavalry$ cata:$c.castle.troop.heavyCavalry$"
echo "│   t:$c.castle.troop.carriage$ b:$c.castle.troop.ballista$"
echo "│   r:$c.castle.troop.batteringRam$ cp:$c.castle.troop.catapult$"

set totalTroops {%totalTroops%+%troops%}
set totalFood {%totalFood%+%food%}

set i {%i%+1}
goto cityLoop

label done
echo "├${'─'.repeat(50)}"
echo "│ TOTAL TROOPS: %totalTroops%"
echo "│ TOTAL FOOD: %totalFood%"

if {%totalTroops%<8000000000} echo "│ STATUS: ❌ TOO SMALL"
if {%totalTroops%>20000000000} echo "│ STATUS: ⚠️ TOO LARGE"
if {%totalTroops%>=8000000000} if {%totalTroops%<=20000000000} echo "│ STATUS: ✅ IDEAL FOR TESTING"

echo "└${'─'.repeat(50)}"
`;
}

// Main execution
function main() {
  console.log('='.repeat(60));
  console.log('BATCH ACCOUNT SCANNER');
  console.log('Finding 8B-20B troop accounts for glitch testing');
  console.log('='.repeat(60));
  console.log('');

  const accounts = loadAllAccounts();
  console.log(`\nTotal accounts loaded: ${accounts.length}`);
  console.log('');

  // Generate scan scripts for each account
  const outputDir = path.join(__dirname, 'scan-scripts');

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  } catch (e) {
    console.log('Could not create output directory');
  }

  // Output account list
  console.log('='.repeat(60));
  console.log('ACCOUNTS TO SCAN:');
  console.log('='.repeat(60));

  let idx = 0;
  for (const acc of accounts) {
    idx++;
    const name = acc.name || acc.email.split('@')[0];
    console.log(
      `${idx.toString().padStart(3)}. ${name.padEnd(20)} | ${acc.email}`
    );

    // Generate individual scan script
    const script = generateAutoEvonyScanScript(acc.email, acc.password);
    const scriptPath = path.join(
      outputDir,
      `scan_${idx}_${name.replace(/[^a-z0-9]/gi, '_')}.txt`
    );

    try {
      fs.writeFileSync(scriptPath, script);
    } catch (e) {
      // Silent fail for file write
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('SCAN INSTRUCTIONS:');
  console.log('='.repeat(60));
  console.log('');
  console.log('1. Login to each account in AutoEvony/RoboEvony');
  console.log('2. Run the multi-account-troop-scanner.txt script');
  console.log('3. Copy output to a file');
  console.log('4. Compare results to find 8B-20B accounts');
  console.log('');
  console.log('Individual scan scripts generated in:');
  console.log(`  ${outputDir}`);
  console.log('');
  console.log('='.repeat(60));
}

// Export for use as module
module.exports = {
  loadAllAccounts,
  generateScanReport,
  generateAutoEvonyScanScript,
  GLITCH_THRESHOLDS,
  MIN_TARGET,
  MAX_TARGET,
};

// Run if executed directly
if (require.main === module) {
  main();
}
