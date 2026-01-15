/**
 * Panel Playwright Bridge
 * Integrates Playwright capabilities with browser panels for enhanced automation,
 * auto-login, form filling, session management, and failover support
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

/**
 * Panel Playwright Bridge Class
 * Provides Playwright-powered features for browser panels
 */
class PanelPlaywrightBridge extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            headless: config.headless !== false,
            timeout: config.timeout || 30000,
            retryAttempts: config.retryAttempts || 3,
            screenshotDir: config.screenshotDir || path.join(__dirname, '..', 'screenshots'),
            sessionDir: config.sessionDir || path.join(__dirname, '..', 'sessions'),
            ...config
        };
        
        this.playwright = null;
        this.browser = null;
        this.contexts = new Map(); // Panel ID -> Browser Context
        this.pages = new Map(); // Panel ID -> Page
        this.sessions = new Map(); // Panel ID -> Session data
        this.isInitialized = false;
        
        // Ensure directories exist
        this.ensureDirectories();
        
        console.log('[PanelPlaywrightBridge] Created');
    }
    
    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        [this.config.screenshotDir, this.config.sessionDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    
    /**
     * Initialize Playwright
     */
    async initialize() {
        if (this.isInitialized) return true;
        
        try {
            this.playwright = require('playwright');
            
            this.browser = await this.playwright.chromium.launch({
                headless: this.config.headless,
                args: [
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            });
            
            this.isInitialized = true;
            this.emit('initialized');
            console.log('[PanelPlaywrightBridge] Initialized');
            return true;
        } catch (error) {
            console.error('[PanelPlaywrightBridge] Initialization failed:', error.message);
            this.emit('error', { type: 'init', error });
            return false;
        }
    }
    
    /**
     * Create context for a panel with session persistence
     */
    async createPanelContext(panelId, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        // Load existing session if available
        const sessionPath = path.join(this.config.sessionDir, `${panelId}-session.json`);
        let storageState = null;
        
        if (fs.existsSync(sessionPath) && options.restoreSession !== false) {
            try {
                storageState = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
                console.log(`[PanelPlaywrightBridge] Restored session for ${panelId}`);
            } catch (e) {
                console.warn(`[PanelPlaywrightBridge] Failed to restore session for ${panelId}`);
            }
        }
        
        const context = await this.browser.newContext({
            userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: options.viewport || { width: 1920, height: 1080 },
            ignoreHTTPSErrors: true,
            storageState: storageState,
            ...options.contextOptions
        });
        
        this.contexts.set(panelId, context);
        
        // Create page for this context
        const page = await context.newPage();
        this.pages.set(panelId, page);
        
        // Setup event listeners
        this.setupPageListeners(panelId, page);
        
        this.emit('context-created', { panelId });
        return { context, page };
    }
    
    /**
     * Setup page event listeners
     */
    setupPageListeners(panelId, page) {
        // Request interception
        page.on('request', request => {
            this.emit('panel-request', {
                panelId,
                url: request.url(),
                method: request.method(),
                resourceType: request.resourceType()
            });
        });
        
        // Response handling
        page.on('response', response => {
            this.emit('panel-response', {
                panelId,
                url: response.url(),
                status: response.status()
            });
        });
        
        // Console messages
        page.on('console', msg => {
            this.emit('panel-console', {
                panelId,
                type: msg.type(),
                text: msg.text()
            });
        });
        
        // Page errors
        page.on('pageerror', error => {
            this.emit('panel-error', {
                panelId,
                error: error.message
            });
        });
        
        // Dialog handling
        page.on('dialog', async dialog => {
            this.emit('panel-dialog', {
                panelId,
                type: dialog.type(),
                message: dialog.message()
            });
            // Auto-dismiss dialogs
            await dialog.dismiss().catch(() => {});
        });
    }
    
    /**
     * Navigate panel to URL with retry logic
     */
    async navigatePanel(panelId, url, options = {}) {
        const page = this.pages.get(panelId);
        if (!page) {
            throw new Error(`No page for panel ${panelId}`);
        }
        
        let lastError = null;
        
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                await page.goto(url, {
                    waitUntil: options.waitUntil || 'domcontentloaded',
                    timeout: options.timeout || this.config.timeout
                });
                
                this.emit('panel-navigated', { panelId, url, attempt });
                return { success: true, url, attempt };
            } catch (error) {
                lastError = error;
                console.warn(`[PanelPlaywrightBridge] Navigation attempt ${attempt} failed for ${panelId}: ${error.message}`);
                
                if (attempt < this.config.retryAttempts) {
                    await this.delay(1000 * attempt);
                }
            }
        }
        
        this.emit('panel-navigation-failed', { panelId, url, error: lastError.message });
        return { success: false, error: lastError.message };
    }
    
    /**
     * Auto-login to Evony
     */
    async autoLogin(panelId, credentials) {
        const page = this.pages.get(panelId);
        if (!page) {
            throw new Error(`No page for panel ${panelId}`);
        }
        
        try {
            // Navigate to login page
            await page.goto('http://www.evony.com', {
                waitUntil: 'networkidle',
                timeout: this.config.timeout
            });
            
            // Wait for login form
            await page.waitForSelector('input[name="email"], input[type="email"], #email', {
                timeout: 10000
            }).catch(() => null);
            
            // Try different selectors for email/username
            const emailSelectors = ['input[name="email"]', 'input[type="email"]', '#email', 'input[name="username"]'];
            let emailInput = null;
            
            for (const selector of emailSelectors) {
                emailInput = await page.$(selector);
                if (emailInput) break;
            }
            
            if (!emailInput) {
                // Might already be logged in
                const isLoggedIn = await this.checkLoginStatus(panelId);
                if (isLoggedIn) {
                    return { success: true, message: 'Already logged in' };
                }
                throw new Error('Login form not found');
            }
            
            // Fill credentials
            await emailInput.fill(credentials.email || credentials.username);
            
            // Find password field
            const passwordSelectors = ['input[name="password"]', 'input[type="password"]', '#password'];
            let passwordInput = null;
            
            for (const selector of passwordSelectors) {
                passwordInput = await page.$(selector);
                if (passwordInput) break;
            }
            
            if (passwordInput) {
                await passwordInput.fill(credentials.password);
            }
            
            // Find and click login button
            const loginSelectors = ['button[type="submit"]', 'input[type="submit"]', '.login-btn', '#login-btn', 'button:has-text("Login")', 'button:has-text("Sign In")'];
            
            for (const selector of loginSelectors) {
                const loginBtn = await page.$(selector);
                if (loginBtn) {
                    await loginBtn.click();
                    break;
                }
            }
            
            // Wait for navigation after login
            await page.waitForNavigation({
                waitUntil: 'networkidle',
                timeout: 30000
            }).catch(() => {});
            
            // Save session
            await this.saveSession(panelId);
            
            this.emit('panel-login-success', { panelId });
            return { success: true, message: 'Login successful' };
        } catch (error) {
            this.emit('panel-login-failed', { panelId, error: error.message });
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Check if logged in
     */
    async checkLoginStatus(panelId) {
        const page = this.pages.get(panelId);
        if (!page) return false;
        
        try {
            // Check for common logged-in indicators
            const loggedInIndicators = [
                '.user-profile',
                '.logout-btn',
                '#logout',
                '.player-name',
                '.game-container'
            ];
            
            for (const selector of loggedInIndicators) {
                const element = await page.$(selector);
                if (element) return true;
            }
            
            // Check URL for game server
            const url = page.url();
            if (url.includes('cc1.evony.com') || url.includes('cc2.evony.com') || 
                url.includes('cc3.evony.com') || url.includes('cc4.evony.com')) {
                return true;
            }
            
            return false;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Fill form fields
     */
    async fillForm(panelId, fields) {
        const page = this.pages.get(panelId);
        if (!page) {
            throw new Error(`No page for panel ${panelId}`);
        }
        
        const results = [];
        
        for (const field of fields) {
            try {
                const element = await page.$(field.selector);
                if (element) {
                    if (field.type === 'select') {
                        await element.selectOption(field.value);
                    } else if (field.type === 'checkbox') {
                        if (field.value) {
                            await element.check();
                        } else {
                            await element.uncheck();
                        }
                    } else {
                        await element.fill(field.value);
                    }
                    results.push({ selector: field.selector, success: true });
                } else {
                    results.push({ selector: field.selector, success: false, error: 'Element not found' });
                }
            } catch (error) {
                results.push({ selector: field.selector, success: false, error: error.message });
            }
        }
        
        return results;
    }
    
    /**
     * Click element
     */
    async clickElement(panelId, selector, options = {}) {
        const page = this.pages.get(panelId);
        if (!page) {
            throw new Error(`No page for panel ${panelId}`);
        }
        
        try {
            await page.click(selector, {
                timeout: options.timeout || 5000,
                force: options.force || false
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Wait for element
     */
    async waitForElement(panelId, selector, options = {}) {
        const page = this.pages.get(panelId);
        if (!page) {
            throw new Error(`No page for panel ${panelId}`);
        }
        
        try {
            await page.waitForSelector(selector, {
                timeout: options.timeout || 10000,
                state: options.state || 'visible'
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Extract data from panel
     */
    async extractData(panelId, extractors) {
        const page = this.pages.get(panelId);
        if (!page) {
            throw new Error(`No page for panel ${panelId}`);
        }
        
        const results = {};
        
        for (const [name, config] of Object.entries(extractors)) {
            try {
                if (config.type === 'text') {
                    results[name] = await page.$eval(config.selector, el => el.innerText);
                } else if (config.type === 'html') {
                    results[name] = await page.$eval(config.selector, el => el.innerHTML);
                } else if (config.type === 'attribute') {
                    results[name] = await page.$eval(config.selector, (el, attr) => el.getAttribute(attr), config.attribute);
                } else if (config.type === 'list') {
                    results[name] = await page.$$eval(config.selector, els => els.map(el => el.innerText));
                } else if (config.type === 'table') {
                    results[name] = await page.$$eval(config.selector + ' tr', rows => 
                        rows.map(row => 
                            Array.from(row.querySelectorAll('td, th')).map(cell => cell.innerText)
                        )
                    );
                }
            } catch (error) {
                results[name] = { error: error.message };
            }
        }
        
        return results;
    }
    
    /**
     * Take screenshot of panel
     */
    async takeScreenshot(panelId, options = {}) {
        const page = this.pages.get(panelId);
        if (!page) {
            throw new Error(`No page for panel ${panelId}`);
        }
        
        const filename = options.filename || `${panelId}-${Date.now()}.png`;
        const filepath = path.join(this.config.screenshotDir, filename);
        
        try {
            await page.screenshot({
                path: filepath,
                fullPage: options.fullPage || false,
                type: 'png'
            });
            
            this.emit('screenshot-taken', { panelId, filepath });
            return { success: true, filepath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Execute JavaScript in panel
     */
    async executeScript(panelId, script) {
        const page = this.pages.get(panelId);
        if (!page) {
            throw new Error(`No page for panel ${panelId}`);
        }
        
        try {
            const result = await page.evaluate(script);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get cookies for panel
     */
    async getCookies(panelId) {
        const context = this.contexts.get(panelId);
        if (!context) {
            throw new Error(`No context for panel ${panelId}`);
        }
        
        return await context.cookies();
    }
    
    /**
     * Set cookies for panel
     */
    async setCookies(panelId, cookies) {
        const context = this.contexts.get(panelId);
        if (!context) {
            throw new Error(`No context for panel ${panelId}`);
        }
        
        await context.addCookies(cookies);
    }
    
    /**
     * Save session for panel
     */
    async saveSession(panelId) {
        const context = this.contexts.get(panelId);
        if (!context) return false;
        
        try {
            const storageState = await context.storageState();
            const sessionPath = path.join(this.config.sessionDir, `${panelId}-session.json`);
            fs.writeFileSync(sessionPath, JSON.stringify(storageState, null, 2));
            
            this.sessions.set(panelId, {
                savedAt: Date.now(),
                path: sessionPath
            });
            
            this.emit('session-saved', { panelId, path: sessionPath });
            return true;
        } catch (error) {
            console.error(`[PanelPlaywrightBridge] Failed to save session for ${panelId}:`, error);
            return false;
        }
    }
    
    /**
     * Clear session for panel
     */
    async clearSession(panelId) {
        const sessionPath = path.join(this.config.sessionDir, `${panelId}-session.json`);
        
        if (fs.existsSync(sessionPath)) {
            fs.unlinkSync(sessionPath);
        }
        
        this.sessions.delete(panelId);
        
        // Clear context cookies
        const context = this.contexts.get(panelId);
        if (context) {
            await context.clearCookies();
        }
        
        this.emit('session-cleared', { panelId });
    }
    
    /**
     * Monitor network requests for panel
     */
    async startNetworkMonitor(panelId, filter = {}) {
        const page = this.pages.get(panelId);
        if (!page) {
            throw new Error(`No page for panel ${panelId}`);
        }
        
        const requests = [];
        
        const handler = request => {
            const url = request.url();
            
            // Apply filters
            if (filter.urlPattern && !url.match(filter.urlPattern)) return;
            if (filter.resourceType && request.resourceType() !== filter.resourceType) return;
            
            const entry = {
                url,
                method: request.method(),
                resourceType: request.resourceType(),
                timestamp: Date.now()
            };
            
            requests.push(entry);
            this.emit('network-request', { panelId, ...entry });
        };
        
        page.on('request', handler);
        
        return {
            getRequests: () => [...requests],
            stop: () => page.off('request', handler)
        };
    }
    
    /**
     * Intercept and modify requests
     */
    async setupRequestInterception(panelId, interceptor) {
        const page = this.pages.get(panelId);
        if (!page) {
            throw new Error(`No page for panel ${panelId}`);
        }
        
        await page.route('**/*', async route => {
            const request = route.request();
            
            // Call interceptor
            const action = await interceptor({
                url: request.url(),
                method: request.method(),
                headers: request.headers(),
                postData: request.postData()
            });
            
            if (action === 'abort') {
                await route.abort();
            } else if (action === 'continue') {
                await route.continue();
            } else if (typeof action === 'object') {
                // Modify request
                await route.continue({
                    url: action.url,
                    method: action.method,
                    headers: action.headers,
                    postData: action.postData
                });
            } else {
                await route.continue();
            }
        });
    }
    
    /**
     * Get panel page content
     */
    async getPageContent(panelId) {
        const page = this.pages.get(panelId);
        if (!page) {
            throw new Error(`No page for panel ${panelId}`);
        }
        
        return {
            url: page.url(),
            title: await page.title(),
            html: await page.content()
        };
    }
    
    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            browserConnected: this.browser?.isConnected() || false,
            contexts: Array.from(this.contexts.keys()),
            pages: Array.from(this.pages.keys()),
            sessions: Array.from(this.sessions.entries()).map(([id, data]) => ({
                panelId: id,
                savedAt: data.savedAt
            }))
        };
    }
    
    /**
     * Close panel context
     */
    async closePanelContext(panelId) {
        const page = this.pages.get(panelId);
        if (page) {
            await page.close().catch(() => {});
            this.pages.delete(panelId);
        }
        
        const context = this.contexts.get(panelId);
        if (context) {
            await context.close().catch(() => {});
            this.contexts.delete(panelId);
        }
        
        this.emit('context-closed', { panelId });
    }
    
    /**
     * Shutdown
     */
    async shutdown() {
        // Save all sessions
        for (const panelId of this.contexts.keys()) {
            await this.saveSession(panelId);
        }
        
        // Close all contexts
        for (const [panelId, context] of this.contexts) {
            await context.close().catch(() => {});
        }
        this.contexts.clear();
        this.pages.clear();
        
        // Close browser
        if (this.browser) {
            await this.browser.close().catch(() => {});
            this.browser = null;
        }
        
        this.isInitialized = false;
        this.emit('shutdown');
        console.log('[PanelPlaywrightBridge] Shutdown complete');
    }
    
    /**
     * Utility delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton
let instance = null;

function getPanelPlaywrightBridge() {
    if (!instance) {
        instance = new PanelPlaywrightBridge();
    }
    return instance;
}

module.exports = {
    PanelPlaywrightBridge,
    getPanelPlaywrightBridge
};
