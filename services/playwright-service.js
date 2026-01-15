/**
 * Playwright Service
 * Hybrid integration for web scraping, data extraction, and automation
 * Used alongside Electron webviews for enhanced capabilities
 */

const { EventEmitter } = require('events');
const path = require('path');

class PlaywrightService extends EventEmitter {
    constructor() {
        super();
        this.browser = null;
        this.context = null;
        this.pages = new Map();
        this.isInitialized = false;
        this.playwright = null;
    }
    
    /**
     * Initialize Playwright browser
     */
    async initialize(options = {}) {
        if (this.isInitialized) return true;
        
        try {
            // Dynamic import to avoid issues if playwright not installed
            this.playwright = require('playwright');
            
            // Launch browser with options
            this.browser = await this.playwright.chromium.launch({
                headless: options.headless !== false, // Default headless
                args: [
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            });
            
            // Create default context
            this.context = await this.browser.newContext({
                userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
                ignoreHTTPSErrors: true
            });
            
            this.isInitialized = true;
            this.emit('initialized');
            console.log('[PlaywrightService] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[PlaywrightService] Initialization failed:', error.message);
            this.emit('error', error);
            return false;
        }
    }
    
    /**
     * Create a new page for scraping
     */
    async createPage(id = 'default') {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        const page = await this.context.newPage();
        this.pages.set(id, page);
        
        // Set up request interception for traffic analysis
        await page.route('**/*', async (route) => {
            const request = route.request();
            this.emit('request', {
                url: request.url(),
                method: request.method(),
                headers: request.headers(),
                postData: request.postData()
            });
            await route.continue();
        });
        
        // Capture responses
        page.on('response', async (response) => {
            try {
                const body = await response.body().catch(() => null);
                this.emit('response', {
                    url: response.url(),
                    status: response.status(),
                    headers: response.headers(),
                    body: body ? body.toString('base64') : null
                });
            } catch (e) {
                // Ignore response body errors
            }
        });
        
        return page;
    }
    
    /**
     * Navigate to URL and extract data
     */
    async scrape(url, options = {}) {
        const page = await this.createPage('scrape-' + Date.now());
        
        try {
            await page.goto(url, {
                waitUntil: options.waitUntil || 'networkidle',
                timeout: options.timeout || 30000
            });
            
            // Wait for selector if specified
            if (options.waitForSelector) {
                await page.waitForSelector(options.waitForSelector, {
                    timeout: options.selectorTimeout || 10000
                });
            }
            
            // Extract data based on options
            const result = {
                url: page.url(),
                title: await page.title(),
                content: {}
            };
            
            // Extract text content
            if (options.extractText !== false) {
                result.content.text = await page.evaluate(() => document.body.innerText);
            }
            
            // Extract HTML
            if (options.extractHtml) {
                result.content.html = await page.content();
            }
            
            // Extract specific selectors
            if (options.selectors) {
                result.content.extracted = {};
                for (const [name, selector] of Object.entries(options.selectors)) {
                    try {
                        result.content.extracted[name] = await page.$$eval(selector, els => 
                            els.map(el => ({
                                text: el.innerText,
                                href: el.href,
                                src: el.src,
                                value: el.value
                            }))
                        );
                    } catch (e) {
                        result.content.extracted[name] = [];
                    }
                }
            }
            
            // Take screenshot if requested
            if (options.screenshot) {
                result.screenshot = await page.screenshot({
                    type: 'png',
                    fullPage: options.fullPageScreenshot || false
                });
            }
            
            return result;
        } finally {
            await page.close();
            this.pages.delete('scrape-' + Date.now());
        }
    }
    
    /**
     * Scrape Evony wiki/guide pages for knowledge base
     */
    async scrapeEvonyWiki(topic) {
        const searchUrls = [
            `https://evony.fandom.com/wiki/${encodeURIComponent(topic)}`,
            `https://evonyguidewiki.com/?s=${encodeURIComponent(topic)}`,
        ];
        
        const results = [];
        
        for (const url of searchUrls) {
            try {
                const data = await this.scrape(url, {
                    extractText: true,
                    extractHtml: false,
                    selectors: {
                        headings: 'h1, h2, h3',
                        paragraphs: 'p',
                        tables: 'table',
                        lists: 'ul, ol'
                    },
                    timeout: 15000
                });
                
                results.push({
                    source: url,
                    title: data.title,
                    content: data.content.text?.substring(0, 5000) || '',
                    extracted: data.content.extracted
                });
            } catch (error) {
                console.error(`[PlaywrightService] Failed to scrape ${url}:`, error.message);
            }
        }
        
        return results;
    }
    
    /**
     * Scrape Evony server status
     */
    async scrapeServerStatus() {
        try {
            const result = await this.scrape('https://www.evony.com/', {
                waitForSelector: 'body',
                extractText: true,
                timeout: 10000
            });
            
            return {
                online: true,
                content: result.content.text
            };
        } catch (error) {
            return {
                online: false,
                error: error.message
            };
        }
    }
    
    /**
     * Extract game data from external sources
     */
    async extractGameData(dataType) {
        const sources = {
            troops: [
                'https://evony.fandom.com/wiki/Troops',
                'https://evonyguidewiki.com/troops/'
            ],
            heroes: [
                'https://evony.fandom.com/wiki/Generals',
                'https://evonyguidewiki.com/generals/'
            ],
            buildings: [
                'https://evony.fandom.com/wiki/Buildings',
                'https://evonyguidewiki.com/buildings/'
            ],
            research: [
                'https://evony.fandom.com/wiki/Research',
                'https://evonyguidewiki.com/research/'
            ]
        };
        
        const urls = sources[dataType] || [];
        const allData = [];
        
        for (const url of urls) {
            try {
                const data = await this.scrape(url, {
                    extractText: true,
                    selectors: {
                        tables: 'table.wikitable, table.data-table',
                        lists: '.mw-parser-output > ul'
                    },
                    timeout: 20000
                });
                
                allData.push({
                    source: url,
                    data: data.content
                });
            } catch (error) {
                console.error(`[PlaywrightService] Failed to extract ${dataType} from ${url}:`, error.message);
            }
        }
        
        return allData;
    }
    
    /**
     * Monitor external page for changes
     */
    async monitorPage(url, selector, callback, interval = 30000) {
        const page = await this.createPage('monitor-' + Date.now());
        let lastContent = null;
        
        const check = async () => {
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded' });
                const content = await page.$eval(selector, el => el.innerText).catch(() => null);
                
                if (content && content !== lastContent) {
                    if (lastContent !== null) {
                        callback({ changed: true, oldContent: lastContent, newContent: content });
                    }
                    lastContent = content;
                }
            } catch (error) {
                console.error('[PlaywrightService] Monitor error:', error.message);
            }
        };
        
        await check();
        const intervalId = setInterval(check, interval);
        
        return {
            stop: () => {
                clearInterval(intervalId);
                page.close();
            }
        };
    }
    
    /**
     * Execute custom script on page
     */
    async executeScript(url, script) {
        const page = await this.createPage('script-' + Date.now());
        
        try {
            await page.goto(url, { waitUntil: 'networkidle' });
            const result = await page.evaluate(script);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            await page.close();
        }
    }
    
    /**
     * Get page for direct manipulation
     */
    getPage(id = 'default') {
        return this.pages.get(id);
    }
    
    /**
     * Close specific page
     */
    async closePage(id) {
        const page = this.pages.get(id);
        if (page) {
            await page.close();
            this.pages.delete(id);
        }
    }
    
    /**
     * Get service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            browserConnected: this.browser?.isConnected() || false,
            activePages: this.pages.size,
            pageIds: Array.from(this.pages.keys())
        };
    }
    
    /**
     * Cleanup and close browser
     */
    async close() {
        for (const [id, page] of this.pages) {
            await page.close().catch(() => {});
        }
        this.pages.clear();
        
        if (this.context) {
            await this.context.close().catch(() => {});
            this.context = null;
        }
        
        if (this.browser) {
            await this.browser.close().catch(() => {});
            this.browser = null;
        }
        
        this.isInitialized = false;
        this.emit('closed');
    }
}

// Singleton instance
let instance = null;

function getPlaywrightService() {
    if (!instance) {
        instance = new PlaywrightService();
    }
    return instance;
}

module.exports = {
    PlaywrightService,
    getPlaywrightService
};
