/**
 * EVONY ACCOUNT SCANNER
 * Scans accounts to find ones with 10B-25B troops for exploit testing
 *
 * Usage: Run with Playwright to login and extract troop data
 */

const TROOP_TYPES = {
  worker: 'peasants',
  warrior: 'militia',
  scout: 'scouter',
  pikeman: 'pikemen',
  swordsman: 'swordsmen',
  archer: 'archer',
  cavalry: 'lightCavalry',
  cataphract: 'heavyCavalry',
  transporter: 'carriage',
  ballista: 'ballista',
  ram: 'batteringRam',
  catapult: 'catapult',
};

// Target troop ranges for exploit testing
const EXPLOIT_THRESHOLDS = {
  MIN_TROOPS: 10_000_000_000, // 10B minimum
  MAX_TROOPS: 25_000_000_000, // 25B maximum (safe for glitch)
  GLITCH_SAFE: 700_000_000, // 700M per type (safe for triple)
  OVERFLOW_RISK: 2_100_000_000, // 2.1B (32-bit signed max)
};

class AccountScanner {
  constructor() {
    this.accounts = [];
    this.scanResults = [];
  }

  parseAccountFile(content) {
    const lines = content.trim().split('\n');
    const accounts = [];

    for (const line of lines) {
      if (line.startsWith('in-game-name') || !line.trim()) continue;

      const parts = line.split(/\s+/).filter((p) => p);
      if (parts.length >= 3) {
        const email = parts.find((p) => p.includes('@'));
        const emailIndex = parts.indexOf(email);

        if (email && emailIndex > 0) {
          accounts.push({
            name: parts.slice(0, emailIndex).join(' '),
            email: email,
            password: parts[emailIndex + 1] || '',
            secCode: parts[emailIndex + 2] || '',
          });
        }
      }
    }

    this.accounts = accounts;
    return accounts;
  }

  async scanAccount(page, account) {
    const result = {
      name: account.name,
      email: account.email,
      server: null,
      cities: [],
      totalTroops: 0,
      troopsByType: {},
      food: 0,
      foodRate: 0,
      glitchStatus: 'unknown',
      exploitReady: false,
      error: null,
    };

    try {
      // Navigate to Evony
      await page.goto('https://www.evony.com/', { waitUntil: 'networkidle' });

      // Wait for login form
      await page.waitForSelector('input[type="email"], input[name="email"]', {
        timeout: 10000,
      });

      // Fill login
      await page.fill(
        'input[type="email"], input[name="email"]',
        account.email
      );
      await page.fill(
        'input[type="password"], input[name="password"]',
        account.password
      );

      // Click login
      await page.click('button[type="submit"], .login-button');

      // Wait for game to load
      await page.waitForTimeout(5000);

      // Extract troop data via JavaScript injection
      const gameData = await page.evaluate(() => {
        // Try to access game context
        if (window.Context && window.Context.getInstance) {
          const ctx = window.Context.getInstance();
          const cm = ctx.cm;

          return {
            troops: cm ? cm.allTroop : null,
            food: cm ? cm.resource?.food : null,
            cities: ctx.castleList || [],
          };
        }
        return null;
      });

      if (gameData) {
        result.troopsByType = gameData.troops || {};
        result.totalTroops = Object.values(result.troopsByType).reduce(
          (a, b) => a + b,
          0
        );
        result.food = gameData.food;
        result.cities = gameData.cities;

        // Check if exploit ready (10B-25B range)
        result.exploitReady =
          result.totalTroops >= EXPLOIT_THRESHOLDS.MIN_TROOPS &&
          result.totalTroops <= EXPLOIT_THRESHOLDS.MAX_TROOPS;

        // Check glitch status
        result.glitchStatus = this.checkGlitchStatus(result.troopsByType);
      }
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  checkGlitchStatus(troops) {
    // Check if any troop type exceeds safe limits
    for (const [type, count] of Object.entries(troops)) {
      if (count > EXPLOIT_THRESHOLDS.GLITCH_SAFE) {
        return 'AT_RISK';
      }
    }
    return 'SAFE';
  }

  generateReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      totalAccounts: results.length,
      exploitReady: results.filter((r) => r.exploitReady).length,
      accounts: [],
    };

    for (const r of results) {
      report.accounts.push({
        name: r.name,
        email: r.email,
        totalTroops: this.formatNumber(r.totalTroops),
        exploitReady: r.exploitReady ? '✅ READY' : '❌ NOT READY',
        glitchStatus: r.glitchStatus,
        recommendation: this.getRecommendation(r),
      });
    }

    return report;
  }

  getRecommendation(result) {
    if (result.error) return 'LOGIN_FAILED';
    if (result.totalTroops < EXPLOIT_THRESHOLDS.MIN_TROOPS)
      return 'NEED_MORE_TROOPS';
    if (result.totalTroops > EXPLOIT_THRESHOLDS.MAX_TROOPS)
      return 'TOO_MANY_TROOPS';
    if (result.glitchStatus === 'AT_RISK') return 'RELOCATE_BEFORE_GLITCH';
    return 'READY_FOR_EXPLOIT';
  }

  formatNumber(num) {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    return num.toLocaleString();
  }
}

// Export for use
module.exports = { AccountScanner, EXPLOIT_THRESHOLDS, TROOP_TYPES };
