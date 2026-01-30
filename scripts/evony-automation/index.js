/**
 * Evony Automation Suite - Main Entry Point
 * Unified interface for all automation scripts
 */

const { EvonyAutomation, EVONY_URLS } = require('./base-automation');
const { LoginManager } = require('./login-manager');
const { ExploitScripts, SAFETY_LIMITS } = require('./exploit-scripts');
const { FarmingScripts } = require('./farming-scripts');

class EvonyAutomationSuite {
  constructor(config = {}) {
    this.config = config;
    this.loginManager = new LoginManager(config.accountsPath);
    this.activeSessions = new Map();
  }

  // ============== Session Management ==============

  async startSession(accountName, type = 'exploit') {
    console.log(`[Suite] Starting ${type} session for ${accountName}`);

    const result = await this.loginManager.loginAccount(
      accountName,
      this.config
    );
    if (!result.success) {
      throw new Error(`Failed to login: ${accountName}`);
    }

    let session;
    switch (type) {
      case 'exploit':
        session = new ExploitScripts(this.config);
        break;
      case 'farming':
        session = new FarmingScripts(this.config);
        break;
      default:
        session = new EvonyAutomation(this.config);
    }

    await session.init();
    this.activeSessions.set(accountName, {
      session,
      type,
      loginResult: result,
    });

    return session;
  }

  getSession(accountName) {
    return this.activeSessions.get(accountName)?.session;
  }

  async closeSession(accountName) {
    const sessionData = this.activeSessions.get(accountName);
    if (sessionData) {
      await sessionData.session.close();
      await this.loginManager.closeSession(accountName);
      this.activeSessions.delete(accountName);
    }
  }

  async closeAll() {
    for (const [name] of this.activeSessions) {
      await this.closeSession(name);
    }
  }

  // ============== Quick Actions ==============

  async quickTroopGlitch(accountName, options = {}) {
    const session = await this.startSession(accountName, 'exploit');
    const result = await session.troopGlitch(options);
    return result;
  }

  async quickFoodGlitch(accountName, options = {}) {
    const session = await this.startSession(accountName, 'exploit');
    const result = await session.foodGlitch(options);
    return result;
  }

  async quickFarm(accountName, options = {}) {
    const session = await this.startSession(accountName, 'farming');
    const result = await session.npcFarm(options);
    return result;
  }

  // ============== Multi-Account Operations ==============

  async multiAccountFarm(accountNames, options = {}) {
    const results = [];

    for (const name of accountNames) {
      console.log(`[Suite] Starting farm for ${name}`);
      try {
        const result = await this.quickFarm(name, { ...options, dryRun: true });
        results.push({ account: name, success: true, result });
      } catch (err) {
        results.push({ account: name, success: false, error: err.message });
      }
    }

    return results;
  }

  // ============== Reports ==============

  getStatus() {
    return {
      accounts: this.loginManager.listAccounts(),
      activeSessions: Array.from(this.activeSessions.keys()),
      safetyLimits: SAFETY_LIMITS,
    };
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const account = args[1];

  const suite = new EvonyAutomationSuite({ headless: false });

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         EVONY AUTOMATION SUITE v1.0                      ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Commands:                                               ║');
  console.log('║    status              - Show available accounts         ║');
  console.log('║    login <account>     - Login to account                ║');
  console.log('║    troop <account>     - Run troop glitch (dry run)      ║');
  console.log('║    food <account>      - Run food glitch (dry run)       ║');
  console.log('║    farm <account>      - Run NPC farm (dry run)          ║');
  console.log('║    test                - Run all tests                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  try {
    switch (command) {
      case 'status':
        const status = suite.getStatus();
        console.log('\nAvailable Accounts:');
        status.accounts.forEach((a) =>
          console.log(`  - ${a.name} (${a.email})`)
        );
        console.log('\nSafety Limits:');
        Object.entries(status.safetyLimits).forEach(([k, v]) => {
          console.log(`  ${k}: ${v.toLocaleString()}`);
        });
        break;

      case 'login':
        if (!account) {
          console.log('Usage: node index.js login <account-name>');
          break;
        }
        await suite.loginManager.loginAccount(account);
        console.log('Press Ctrl+C to close...');
        await new Promise(() => {}); // Keep alive
        break;

      case 'troop':
        if (!account) {
          console.log('Usage: node index.js troop <account-name>');
          break;
        }
        const troopResult = await suite.quickTroopGlitch(account, {
          dryRun: true,
        });
        console.log('Result:', troopResult);
        await suite.closeAll();
        break;

      case 'food':
        if (!account) {
          console.log('Usage: node index.js food <account-name>');
          break;
        }
        const foodResult = await suite.quickFoodGlitch(account, {
          dryRun: true,
        });
        console.log('Result:', foodResult);
        await suite.closeAll();
        break;

      case 'farm':
        if (!account) {
          console.log('Usage: node index.js farm <account-name>');
          break;
        }
        const farmResult = await suite.quickFarm(account, { dryRun: true });
        console.log('Result:', farmResult);
        await suite.closeAll();
        break;

      case 'test':
        console.log('\n=== Running All Tests ===\n');

        // Test 1: Module loading
        console.log('✓ All modules loaded successfully');

        // Test 2: Account loading
        const accounts = suite.loginManager.listAccounts();
        console.log(`✓ Loaded ${accounts.length} accounts`);

        // Test 3: Exploit dry runs
        const exploits = new ExploitScripts();
        await exploits.troopGlitch({ dryRun: true });
        console.log('✓ Troop glitch dry run passed');

        await exploits.foodGlitch({ dryRun: true });
        console.log('✓ Food glitch dry run passed');

        await exploits.commissionGlitch({ dryRun: true });
        console.log('✓ Commission glitch dry run passed');

        // Test 4: Farming dry runs
        const farming = new FarmingScripts();
        await farming.npcFarm({ dryRun: true });
        console.log('✓ NPC farm dry run passed');

        await farming.valleyFarm({ dryRun: true });
        console.log('✓ Valley farm dry run passed');

        console.log('\n=== All Tests Passed ===');
        break;

      default:
        console.log('\nRun with: node index.js <command> [account]');
        console.log('Example: node index.js status');
    }
  } catch (err) {
    console.error('Error:', err.message);
    await suite.closeAll();
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  EvonyAutomationSuite,
  EvonyAutomation,
  LoginManager,
  ExploitScripts,
  FarmingScripts,
  SAFETY_LIMITS,
  EVONY_URLS,
};
