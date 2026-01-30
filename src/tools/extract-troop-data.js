/**
 * EVONY TROOP EXTRACTOR
 * Login to accounts and extract troop counts to find 10B-25B accounts
 *
 * Usage: node extract-troop-data.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Target: Find accounts with 10B-25B troops
const TARGET_MIN = 10_000_000_000; // 10B
const TARGET_MAX = 25_000_000_000; // 25B

// ALL ACCOUNTS ARE cc2 SERVER ONLY - STRICTLY cc2
const CC2_URL = 'http://cc2.evony.com/';
const CC2_IP = '216.66.17.36';

// Test accounts from Evony Accounts.XLSX - ALL cc2
const TEST_ACCOUNTS = [
  { email: 'kevincarbray@hotmail.com', password: 'flee888', name: 'Gargoyle' },
  {
    email: 'janette-scott@hotmail.com',
    password: 'system1019876',
    name: 'CrazyKiwi',
  },
  // Add more cc2 accounts here
];

async function extractTroopData(page) {
  // Wait for game to fully load
  await page.waitForTimeout(8000);

  // Try to extract troop data via console
  const data = await page.evaluate(() => {
    // Method 1: Check for Context (Flash/Ruffle game object)
    if (typeof Context !== 'undefined') {
      try {
        const ctx = Context.getInstance();
        const cm = ctx.cm;
        if (cm && cm.allTroop) {
          return {
            success: true,
            troops: cm.allTroop,
            food: cm.resource?.food || 0,
            cities: ctx.castleList?.length || 0,
          };
        }
      } catch (e) {}
    }

    // Method 2: Check window.gameData
    if (window.gameData) {
      return { success: true, troops: window.gameData.troops };
    }

    // Method 3: Look for troop display elements
    const troopElements = document.querySelectorAll(
      '[class*="troop"], [id*="troop"]'
    );
    if (troopElements.length > 0) {
      const text = Array.from(troopElements)
        .map((e) => e.textContent)
        .join(' ');
      return { success: false, rawText: text, message: 'Found troop elements' };
    }

    return { success: false, message: 'Could not find troop data' };
  });

  return data;
}

async function loginAndExtract(browser, account) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const result = {
    email: account.email,
    name: account.name || 'Unknown',
    totalTroops: 0,
    troopsByType: {},
    status: 'pending',
    exploitReady: false,
  };

  try {
    // Logging in to account - logging removed per contract requirements

    // Go to cc2.evony.com - ALL accounts are cc2 only
    await page.goto(CC2_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(5000);

    // Find and fill login form
    const emailInput = await page.$(
      'input[type="email"], input[name="email"], #email'
    );
    const passInput = await page.$(
      'input[type="password"], input[name="password"], #password'
    );

    if (emailInput && passInput) {
      await emailInput.fill(account.email);
      await passInput.fill(account.password);

      // Click login
      const loginBtn = await page.$(
        'button[type="submit"], .login-btn, #login, [class*="login"]'
      );
      if (loginBtn) {
        await loginBtn.click();
        // Login clicked - logging removed per contract requirements

        // Wait for game to load
        await page.waitForTimeout(15000);

        // Extract troop data
        const data = await extractTroopData(page);

        if (data.success && data.troops) {
          result.troopsByType = data.troops;
          result.totalTroops = Object.values(data.troops).reduce(
            (a, b) => a + (b || 0),
            0
          );
          result.status = 'extracted';

          // Check if exploit ready
          if (
            result.totalTroops >= TARGET_MIN &&
            result.totalTroops <= TARGET_MAX
          ) {
            result.exploitReady = true;
            result.status = 'EXPLOIT_READY';
          }

          // Total troops extracted - logging removed per contract requirements
        } else {
          result.status = 'no_data';
          // Could not extract troop data - logging removed per contract requirements
        }
      }
    } else {
      result.status = 'login_form_not_found';
      // Login form not found - logging removed per contract requirements
    }
  } catch (error) {
    result.status = 'error';
    result.error = error.message;
    // Error occurred - logging removed per contract requirements
  } finally {
    await context.close();
  }

  return result;
}

function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toString();
}

async function main() {
  // Evony Troop Extractor - logging removed per contract requirements

  const browser = await chromium.launch({
    headless: false, // Show browser
    slowMo: 50,
  });

  const results = [];
  const exploitReady = [];

  for (const account of TEST_ACCOUNTS) {
    const result = await loginAndExtract(browser, account);
    results.push(result);

    if (result.exploitReady) {
      exploitReady.push(result);
    }

    // Small delay between accounts
    await new Promise((r) => setTimeout(r, 2000));
  }

  await browser.close();

  // Summary
  // Results Summary - logging removed per contract requirements

  for (const r of results) {
    const status = r.exploitReady ? '✅ EXPLOIT READY' : r.status;
    // Result summary - logging removed per contract requirements
  }

  // Exploit-ready accounts summary - logging removed per contract requirements
  if (exploitReady.length === 0) {
    // No exploit-ready accounts found
  } else {
    for (const r of exploitReady) {
      // Exploit-ready account found
    }
  }

  // Save results
  const outputPath = path.join(__dirname, '../../docs/TROOP_SCAN_RESULTS.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  // Results saved - logging removed per contract requirements
}

main().catch(console.error);
