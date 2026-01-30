/**
 * Evony Base Automation - Playwright Core
 * Foundation for all Evony automation scripts
 */

const playwright = require('playwright');
const path = require('path');
const fs = require('fs');

const EVONY_URLS = {
  main: 'https://www.evony.com',
  play: 'https://www.evony.com/play',
  login: 'https://www.evony.com/login',
};

class EvonyAutomation {
  constructor(config = {}) {
    this.config = {
      headless: config.headless || false,
      slowMo: config.slowMo || 50,
      timeout: config.timeout || 30000,
      screenshotDir:
        config.screenshotDir || path.join(__dirname, '..', '..', 'screenshots'),
      logDir: config.logDir || path.join(__dirname, '..', '..', 'logs'),
      ...config,
    };

    this.browser = null;
    this.context = null;
    this.page = null;
    this.metrics = [];
    this.sessionStart = null;

    // Ensure directories exist
    [this.config.screenshotDir, this.config.logDir].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  // ============== Lifecycle ==============

  async init() {
    this.sessionStart = Date.now();
    const start = Date.now();

    this.browser = await playwright.chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout);

    this.recordMetric('init', Date.now() - start);
    console.log(`[EvonyAutomation] Initialized in ${Date.now() - start}ms`);

    return this;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.saveMetrics();
    console.log('[EvonyAutomation] Closed');
  }

  // ============== Core Actions ==============

  async navigate(url) {
    const start = Date.now();
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    this.recordMetric('navigate', Date.now() - start, { url });
    return this;
  }

  async waitFor(selector, options = {}) {
    const start = Date.now();
    await this.page.waitForSelector(selector, {
      timeout: options.timeout || 10000,
    });
    this.recordMetric('waitFor', Date.now() - start, { selector });
    return this;
  }

  async click(selector) {
    const start = Date.now();
    await this.page.click(selector);
    this.recordMetric('click', Date.now() - start, { selector });
    return this;
  }

  async fill(selector, value) {
    const start = Date.now();
    await this.page.fill(selector, value);
    this.recordMetric('fill', Date.now() - start, {
      selector,
      valueLength: value.length,
    });
    return this;
  }

  async type(selector, text, options = {}) {
    const start = Date.now();
    await this.page.type(selector, text, { delay: options.delay || 50 });
    this.recordMetric('type', Date.now() - start, { selector });
    return this;
  }

  async screenshot(name) {
    const filename = `${name}-${Date.now()}.png`;
    const filepath = path.join(this.config.screenshotDir, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    this.recordMetric('screenshot', 0, { filename });
    return filepath;
  }

  async evaluate(fn, ...args) {
    return this.page.evaluate(fn, ...args);
  }

  // ============== Evony-Specific ==============

  async login(email, password) {
    console.log(`[EvonyAutomation] Logging in as ${email}...`);
    const start = Date.now();

    try {
      await this.navigate(EVONY_URLS.play);
      await this.page.waitForLoadState('networkidle');

      // Try multiple possible selectors
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        '#email',
        'input[placeholder*="email" i]',
      ];

      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        '#password',
      ];

      // Find and fill email
      for (const sel of emailSelectors) {
        try {
          await this.page.waitForSelector(sel, { timeout: 3000 });
          await this.fill(sel, email);
          break;
        } catch {
          continue;
        }
      }

      // Find and fill password
      for (const sel of passwordSelectors) {
        try {
          await this.page.waitForSelector(sel, { timeout: 3000 });
          await this.fill(sel, password);
          break;
        } catch {
          continue;
        }
      }

      // Screenshot before submit
      await this.screenshot('pre-login');

      // Find and click submit
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign In")',
      ];

      for (const sel of submitSelectors) {
        try {
          await this.click(sel);
          break;
        } catch {
          continue;
        }
      }

      // Wait for navigation
      await this.page.waitForLoadState('networkidle');
      await this.screenshot('post-login');

      this.recordMetric('login', Date.now() - start, { email, success: true });
      console.log(
        `[EvonyAutomation] Login completed in ${Date.now() - start}ms`
      );
      return true;
    } catch (err) {
      this.recordMetric('login', Date.now() - start, {
        email,
        success: false,
        error: err.message,
      });
      console.error(`[EvonyAutomation] Login failed: ${err.message}`);
      return false;
    }
  }

  async getGameState() {
    return this.evaluate(() => {
      // Try to extract game state from window objects
      return {
        url: window.location.href,
        title: document.title,
        hasFlash: !!document.querySelector('object[type*="flash"]'),
        hasCanvas: !!document.querySelector('canvas'),
        timestamp: Date.now(),
      };
    });
  }

  // ============== Metrics ==============

  recordMetric(action, duration, details = {}) {
    this.metrics.push({
      action,
      duration,
      details,
      timestamp: Date.now(),
    });
  }

  getMetrics() {
    return {
      sessionDuration: Date.now() - this.sessionStart,
      actionCount: this.metrics.length,
      totalDuration: this.metrics.reduce((a, m) => a + m.duration, 0),
      metrics: this.metrics,
    };
  }

  saveMetrics() {
    const filename = `metrics-${this.sessionStart}.json`;
    const filepath = path.join(this.config.logDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(this.getMetrics(), null, 2));
    console.log(`[EvonyAutomation] Metrics saved to ${filepath}`);
  }
}

module.exports = { EvonyAutomation, EVONY_URLS };
