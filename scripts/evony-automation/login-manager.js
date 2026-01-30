/**
 * Evony Multi-Account Login Manager
 * Handles multiple account logins with session management
 */

const { EvonyAutomation } = require('./base-automation');
const fs = require('fs');
const path = require('path');

class LoginManager {
  constructor(accountsPath) {
    this.accountsPath =
      accountsPath || path.join(__dirname, '..', '..', 'docs', 'acc.txt');
    this.accounts = [];
    this.sessions = new Map();
    this.loadAccounts();
  }

  loadAccounts() {
    if (!fs.existsSync(this.accountsPath)) {
      console.error(
        `[LoginManager] Accounts file not found: ${this.accountsPath}`
      );
      return;
    }

    const content = fs.readFileSync(this.accountsPath, 'utf8');
    const lines = content
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('in-game'));

    this.accounts = lines
      .map((line) => {
        const parts = line.split(/\s+/).filter((p) => p.trim());
        if (parts.length >= 3) {
          return {
            name: parts[0],
            email: parts[1],
            password: parts[2],
            secCode: parts[3] || null,
          };
        }
        return null;
      })
      .filter(Boolean);

    console.log(`[LoginManager] Loaded ${this.accounts.length} accounts`);
  }

  getAccount(nameOrEmail) {
    return this.accounts.find(
      (a) =>
        a.name.toLowerCase() === nameOrEmail.toLowerCase() ||
        a.email.toLowerCase() === nameOrEmail.toLowerCase()
    );
  }

  listAccounts() {
    return this.accounts.map((a) => ({ name: a.name, email: a.email }));
  }

  async loginAccount(nameOrEmail, options = {}) {
    const account = this.getAccount(nameOrEmail);
    if (!account) {
      throw new Error(`Account not found: ${nameOrEmail}`);
    }

    console.log(`[LoginManager] Starting login for ${account.name}...`);

    const automation = new EvonyAutomation({
      headless: options.headless || false,
      ...options,
    });

    await automation.init();
    const success = await automation.login(account.email, account.password);

    if (success) {
      this.sessions.set(account.name, {
        automation,
        account,
        loginTime: Date.now(),
      });
      console.log(`[LoginManager] ${account.name} logged in successfully`);
    } else {
      await automation.close();
      console.error(`[LoginManager] ${account.name} login failed`);
    }

    return { success, account, automation };
  }

  async loginMultiple(names, options = {}) {
    const results = [];
    const delay = options.delayBetween || 5000;

    for (const name of names) {
      const result = await this.loginAccount(name, options);
      results.push(result);

      if (names.indexOf(name) < names.length - 1) {
        console.log(`[LoginManager] Waiting ${delay}ms before next login...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    return results;
  }

  getSession(name) {
    return this.sessions.get(name);
  }

  async closeSession(name) {
    const session = this.sessions.get(name);
    if (session) {
      await session.automation.close();
      this.sessions.delete(name);
      console.log(`[LoginManager] Session closed: ${name}`);
    }
  }

  async closeAll() {
    for (const [name, session] of this.sessions) {
      await session.automation.close();
      console.log(`[LoginManager] Closed: ${name}`);
    }
    this.sessions.clear();
  }
}

// CLI usage
if (require.main === module) {
  const manager = new LoginManager();

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node login-manager.js <account-name>');
    console.log(
      'Available accounts:',
      manager
        .listAccounts()
        .map((a) => a.name)
        .join(', ')
    );
    process.exit(0);
  }

  manager
    .loginAccount(args[0])
    .then((result) => {
      console.log('Login result:', result.success ? 'SUCCESS' : 'FAILED');
      // Keep browser open for 30 seconds
      setTimeout(() => manager.closeAll(), 30000);
    })
    .catch((err) => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = { LoginManager };
