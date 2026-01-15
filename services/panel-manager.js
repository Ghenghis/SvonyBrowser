/**
 * Panel Manager Service
 * Centralized management for dual browser panels with SWF/Web detection,
 * failsafe mechanisms, history, bookmarks, and sync capabilities
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

// Panel modes
const PanelMode = {
    WEB: 'web',
    SWF: 'swf',
    HYBRID: 'hybrid',
    ERROR: 'error'
};

// Panel status
const PanelStatus = {
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    ERROR: 'error',
    RECOVERING: 'recovering'
};

// Failsafe levels
const FailsafeLevel = {
    RETRY: 1,
    CLEAR_CACHE: 2,
    ALTERNATE_URL: 3,
    FALLBACK_MODE: 4,
    RECOVERY_UI: 5
};

/**
 * Panel State Class
 * Tracks individual panel state including history, bookmarks, and health
 */
class PanelState {
    constructor(id, config = {}) {
        this.id = id;
        this.mode = config.mode || PanelMode.WEB;
        this.url = config.url || '';
        this.title = '';
        this.favicon = '';
        
        // Navigation history
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = config.maxHistory || 100;
        
        // Bookmarks
        this.bookmarks = config.bookmarks || [];
        
        // Status tracking
        this.status = PanelStatus.IDLE;
        this.health = 100;
        this.lastError = null;
        this.errorCount = 0;
        this.retryCount = 0;
        this.maxRetries = config.maxRetries || 3;
        
        // Performance metrics
        this.loadStartTime = null;
        this.loadTime = 0;
        this.memoryUsage = 0;
        
        // Content detection
        this.contentType = null;
        this.hasFlash = false;
        this.flashVersion = null;
        
        // Sync state
        this.syncEnabled = false;
        this.syncTarget = null;
        
        // Timestamps
        this.createdAt = Date.now();
        this.lastUpdated = Date.now();
        this.lastNavigated = null;
    }
    
    /**
     * Navigate to URL and update history
     */
    navigate(url, addToHistory = true) {
        if (addToHistory && this.url && this.url !== url) {
            // Truncate forward history if navigating from middle
            if (this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
            }
            
            // Add to history
            this.history.push({
                url: this.url,
                title: this.title,
                timestamp: Date.now()
            });
            
            // Limit history size
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }
            
            this.historyIndex = this.history.length - 1;
        }
        
        this.url = url;
        this.status = PanelStatus.LOADING;
        this.loadStartTime = Date.now();
        this.lastNavigated = Date.now();
        this.lastUpdated = Date.now();
        this.retryCount = 0;
    }
    
    /**
     * Go back in history
     */
    goBack() {
        if (this.canGoBack()) {
            this.historyIndex--;
            const entry = this.history[this.historyIndex];
            this.url = entry.url;
            this.title = entry.title;
            return entry;
        }
        return null;
    }
    
    /**
     * Go forward in history
     */
    goForward() {
        if (this.canGoForward()) {
            this.historyIndex++;
            const entry = this.history[this.historyIndex];
            this.url = entry.url;
            this.title = entry.title;
            return entry;
        }
        return null;
    }
    
    canGoBack() {
        return this.historyIndex > 0;
    }
    
    canGoForward() {
        return this.historyIndex < this.history.length - 1;
    }
    
    /**
     * Mark load complete
     */
    loadComplete(success = true, error = null) {
        this.loadTime = Date.now() - (this.loadStartTime || Date.now());
        this.loadStartTime = null;
        
        if (success) {
            this.status = PanelStatus.READY;
            this.health = Math.min(100, this.health + 10);
            this.errorCount = 0;
            this.retryCount = 0;
        } else {
            this.status = PanelStatus.ERROR;
            this.lastError = error;
            this.errorCount++;
            this.health = Math.max(0, this.health - 20);
        }
        
        this.lastUpdated = Date.now();
    }
    
    /**
     * Add bookmark
     */
    addBookmark(url, title, favicon = '') {
        const bookmark = {
            id: `bm_${Date.now()}`,
            url: url || this.url,
            title: title || this.title || url,
            favicon: favicon || this.favicon,
            createdAt: Date.now()
        };
        
        // Check for duplicate
        if (!this.bookmarks.find(b => b.url === bookmark.url)) {
            this.bookmarks.push(bookmark);
            return bookmark;
        }
        return null;
    }
    
    /**
     * Remove bookmark
     */
    removeBookmark(id) {
        const index = this.bookmarks.findIndex(b => b.id === id);
        if (index !== -1) {
            return this.bookmarks.splice(index, 1)[0];
        }
        return null;
    }
    
    /**
     * Get serializable state
     */
    toJSON() {
        return {
            id: this.id,
            mode: this.mode,
            url: this.url,
            title: this.title,
            history: this.history.slice(-20), // Last 20 entries
            historyIndex: Math.max(0, this.historyIndex - (this.history.length - 20)),
            bookmarks: this.bookmarks,
            status: this.status,
            health: this.health,
            syncEnabled: this.syncEnabled
        };
    }
    
    /**
     * Restore from saved state
     */
    fromJSON(data) {
        if (data.mode) this.mode = data.mode;
        if (data.url) this.url = data.url;
        if (data.title) this.title = data.title;
        if (data.history) this.history = data.history;
        if (typeof data.historyIndex === 'number') this.historyIndex = data.historyIndex;
        if (data.bookmarks) this.bookmarks = data.bookmarks;
        if (typeof data.syncEnabled === 'boolean') this.syncEnabled = data.syncEnabled;
    }
}

/**
 * Failsafe Chain Class
 * Multi-level recovery system for panel failures
 */
class FailsafeChain extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            retryDelay: config.retryDelay || 1000,
            maxRetries: config.maxRetries || 3,
            cacheCleanupDelay: config.cacheCleanupDelay || 500,
            ...config
        };
        
        // Alternate URLs for failover
        this.alternateUrls = {
            'evony.com': [
                'http://www.evony.com',
                'http://cc1.evony.com',
                'http://cc2.evony.com',
                'http://cc3.evony.com'
            ],
            'default': [
                'about:blank'
            ]
        };
        
        // Recovery statistics
        this.stats = {
            totalFailures: 0,
            successfulRecoveries: 0,
            failedRecoveries: 0,
            levelUsage: {
                [FailsafeLevel.RETRY]: 0,
                [FailsafeLevel.CLEAR_CACHE]: 0,
                [FailsafeLevel.ALTERNATE_URL]: 0,
                [FailsafeLevel.FALLBACK_MODE]: 0,
                [FailsafeLevel.RECOVERY_UI]: 0
            }
        };
    }
    
    /**
     * Execute failsafe chain for a panel
     */
    async execute(panel, error, webview, clearCacheFn) {
        this.stats.totalFailures++;
        panel.retryCount++;
        
        console.log(`[FailsafeChain] Executing for panel ${panel.id}, retry ${panel.retryCount}, error: ${error?.message || error}`);
        
        // Level 1: Simple retry
        if (panel.retryCount <= this.config.maxRetries) {
            this.stats.levelUsage[FailsafeLevel.RETRY]++;
            this.emit('failsafe-action', {
                panel: panel.id,
                level: FailsafeLevel.RETRY,
                action: 'retry',
                attempt: panel.retryCount
            });
            
            await this.delay(this.config.retryDelay * panel.retryCount);
            
            if (webview) {
                webview.reload();
                return { success: true, level: FailsafeLevel.RETRY };
            }
        }
        
        // Level 2: Clear cache and retry
        if (panel.retryCount === this.config.maxRetries + 1) {
            this.stats.levelUsage[FailsafeLevel.CLEAR_CACHE]++;
            this.emit('failsafe-action', {
                panel: panel.id,
                level: FailsafeLevel.CLEAR_CACHE,
                action: 'clear-cache'
            });
            
            if (clearCacheFn) {
                await clearCacheFn();
                await this.delay(this.config.cacheCleanupDelay);
            }
            
            if (webview) {
                webview.reload();
                return { success: true, level: FailsafeLevel.CLEAR_CACHE };
            }
        }
        
        // Level 3: Try alternate URL
        if (panel.retryCount === this.config.maxRetries + 2) {
            this.stats.levelUsage[FailsafeLevel.ALTERNATE_URL]++;
            const alternateUrl = this.getAlternateUrl(panel.url);
            
            if (alternateUrl && alternateUrl !== panel.url) {
                this.emit('failsafe-action', {
                    panel: panel.id,
                    level: FailsafeLevel.ALTERNATE_URL,
                    action: 'alternate-url',
                    url: alternateUrl
                });
                
                if (webview) {
                    webview.src = alternateUrl;
                    return { success: true, level: FailsafeLevel.ALTERNATE_URL, url: alternateUrl };
                }
            }
        }
        
        // Level 4: Fallback to Web mode (if in SWF mode)
        if (panel.retryCount === this.config.maxRetries + 3 && panel.mode === PanelMode.SWF) {
            this.stats.levelUsage[FailsafeLevel.FALLBACK_MODE]++;
            this.emit('failsafe-action', {
                panel: panel.id,
                level: FailsafeLevel.FALLBACK_MODE,
                action: 'fallback-web',
                previousMode: panel.mode
            });
            
            panel.mode = PanelMode.WEB;
            const webUrl = this.getWebFallbackUrl(panel.url);
            
            if (webview) {
                webview.src = webUrl;
                return { success: true, level: FailsafeLevel.FALLBACK_MODE, mode: PanelMode.WEB };
            }
        }
        
        // Level 5: Show recovery UI
        this.stats.levelUsage[FailsafeLevel.RECOVERY_UI]++;
        this.stats.failedRecoveries++;
        
        this.emit('failsafe-action', {
            panel: panel.id,
            level: FailsafeLevel.RECOVERY_UI,
            action: 'show-recovery',
            error: error?.message || String(error)
        });
        
        return { 
            success: false, 
            level: FailsafeLevel.RECOVERY_UI,
            requiresUserAction: true,
            error: error?.message || String(error)
        };
    }
    
    /**
     * Get alternate URL for failover
     */
    getAlternateUrl(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            
            // Find matching alternates
            for (const [key, urls] of Object.entries(this.alternateUrls)) {
                if (domain.includes(key)) {
                    const currentIndex = urls.indexOf(url);
                    const nextIndex = (currentIndex + 1) % urls.length;
                    return urls[nextIndex];
                }
            }
        } catch (e) {
            // Invalid URL
        }
        
        return this.alternateUrls.default[0];
    }
    
    /**
     * Get web fallback URL for SWF failures
     */
    getWebFallbackUrl(swfUrl) {
        // Convert SWF path to web URL
        if (swfUrl.includes('evony') || swfUrl.includes('Evony')) {
            return 'http://www.evony.com';
        }
        return 'about:blank';
    }
    
    /**
     * Mark recovery successful
     */
    recoverySucceeded() {
        this.stats.successfulRecoveries++;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getStats() {
        return { ...this.stats };
    }
}

/**
 * Panel Manager Class
 * Main service for managing dual browser panels
 */
class PanelManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            autoSave: config.autoSave !== false,
            saveInterval: config.saveInterval || 30000,
            healthCheckInterval: config.healthCheckInterval || 10000,
            syncDebounce: config.syncDebounce || 100,
            ...config
        };
        
        // Panel states
        this.panels = {
            left: new PanelState('left', config.leftPanel),
            right: new PanelState('right', config.rightPanel)
        };
        
        // Failsafe chain
        this.failsafeChain = new FailsafeChain(config.failsafe);
        
        // Webview references (set by renderer)
        this.webviews = {
            left: null,
            right: null
        };
        
        // Sync state
        this.syncMode = null; // 'mirror', 'compare', 'transfer', null
        this.syncPending = false;
        
        // Store reference for persistence
        this.store = config.store || null;
        
        // Timers
        this.saveTimer = null;
        this.healthCheckTimer = null;
        
        // Initialize
        this.setupFailsafeListeners();
        
        console.log('[PanelManager] Initialized');
    }
    
    /**
     * Initialize with webview references
     */
    initialize(leftWebview, rightWebview) {
        this.webviews.left = leftWebview;
        this.webviews.right = rightWebview;
        
        // Setup webview event listeners
        this.setupWebviewListeners('left', leftWebview);
        this.setupWebviewListeners('right', rightWebview);
        
        // Load saved state
        this.loadState();
        
        // Start auto-save
        if (this.config.autoSave) {
            this.startAutoSave();
        }
        
        // Start health checks
        this.startHealthChecks();
        
        this.emit('initialized');
        console.log('[PanelManager] Webviews initialized');
    }
    
    /**
     * Setup webview event listeners
     */
    setupWebviewListeners(panelId, webview) {
        if (!webview) return;
        
        const panel = this.panels[panelId];
        
        // Load start
        webview.addEventListener('did-start-loading', () => {
            panel.status = PanelStatus.LOADING;
            panel.loadStartTime = Date.now();
            this.emit('panel-loading', { panel: panelId });
        });
        
        // Load complete
        webview.addEventListener('did-finish-load', () => {
            panel.loadComplete(true);
            this.emit('panel-ready', { panel: panelId, loadTime: panel.loadTime });
            
            // Detect content type
            this.detectContentType(panelId, webview);
        });
        
        // Load failed
        webview.addEventListener('did-fail-load', (e) => {
            if (e.errorCode !== -3) { // Ignore aborted loads
                panel.loadComplete(false, e.errorDescription);
                this.handleLoadError(panelId, e);
            }
        });
        
        // Navigation
        webview.addEventListener('did-navigate', (e) => {
            panel.navigate(e.url, true);
            this.emit('panel-navigated', { panel: panelId, url: e.url });
        });
        
        // Title update
        webview.addEventListener('page-title-updated', (e) => {
            panel.title = e.title;
            this.emit('panel-title-updated', { panel: panelId, title: e.title });
        });
        
        // Favicon update
        webview.addEventListener('page-favicon-updated', (e) => {
            if (e.favicons && e.favicons.length > 0) {
                panel.favicon = e.favicons[0];
                this.emit('panel-favicon-updated', { panel: panelId, favicon: e.favicons[0] });
            }
        });
        
        // Crash handling
        webview.addEventListener('crashed', () => {
            panel.status = PanelStatus.ERROR;
            panel.lastError = 'Webview crashed';
            panel.health = 0;
            this.emit('panel-crashed', { panel: panelId });
            this.handleLoadError(panelId, { errorDescription: 'Webview crashed' });
        });
        
        // Console messages (for debugging)
        webview.addEventListener('console-message', (e) => {
            if (e.level >= 2) { // Warnings and errors
                this.emit('panel-console', { 
                    panel: panelId, 
                    level: e.level, 
                    message: e.message 
                });
            }
        });
    }
    
    /**
     * Setup failsafe chain listeners
     */
    setupFailsafeListeners() {
        this.failsafeChain.on('failsafe-action', (data) => {
            this.emit('failsafe-action', data);
        });
    }
    
    /**
     * Handle load error with failsafe chain
     */
    async handleLoadError(panelId, error) {
        const panel = this.panels[panelId];
        const webview = this.webviews[panelId];
        
        console.log(`[PanelManager] Load error on ${panelId}: ${error.errorDescription || error}`);
        
        panel.status = PanelStatus.RECOVERING;
        this.emit('panel-recovering', { panel: panelId });
        
        const result = await this.failsafeChain.execute(
            panel,
            error,
            webview,
            () => this.clearPanelCache(panelId)
        );
        
        if (result.success) {
            this.failsafeChain.recoverySucceeded();
        } else {
            this.emit('panel-recovery-failed', {
                panel: panelId,
                error: result.error,
                requiresUserAction: result.requiresUserAction
            });
        }
    }
    
    /**
     * Detect content type (SWF vs Web)
     */
    async detectContentType(panelId, webview) {
        const panel = this.panels[panelId];
        
        try {
            // Check URL for SWF
            const url = webview.getURL();
            if (url.endsWith('.swf') || url.includes('.swf?')) {
                panel.contentType = 'swf';
                panel.hasFlash = true;
                return;
            }
            
            // Check page content for Flash embeds
            const hasFlash = await webview.executeJavaScript(`
                (function() {
                    const embeds = document.querySelectorAll('embed[type*="flash"], object[type*="flash"], embed[src*=".swf"], object[data*=".swf"]');
                    return embeds.length > 0;
                })();
            `);
            
            panel.hasFlash = hasFlash;
            panel.contentType = hasFlash ? 'hybrid' : 'web';
            
            this.emit('panel-content-detected', {
                panel: panelId,
                contentType: panel.contentType,
                hasFlash: panel.hasFlash
            });
        } catch (e) {
            console.warn(`[PanelManager] Content detection failed for ${panelId}:`, e);
        }
    }
    
    /**
     * Navigate panel to URL
     */
    navigate(panelId, url, options = {}) {
        const panel = this.panels[panelId];
        const webview = this.webviews[panelId];
        
        if (!webview) {
            console.error(`[PanelManager] No webview for panel ${panelId}`);
            return false;
        }
        
        // Validate URL
        if (!url) {
            console.error('[PanelManager] No URL provided');
            return false;
        }
        
        // Add protocol if missing
        if (!url.startsWith('http') && !url.startsWith('file') && !url.startsWith('about')) {
            url = 'http://' + url;
        }
        
        panel.navigate(url, options.addToHistory !== false);
        webview.src = url;
        
        this.emit('panel-navigate', { panel: panelId, url });
        
        // Sync if enabled
        if (panel.syncEnabled && this.syncMode === 'mirror') {
            this.syncNavigate(panelId, url);
        }
        
        return true;
    }
    
    /**
     * Go back in panel history
     */
    goBack(panelId) {
        const panel = this.panels[panelId];
        const webview = this.webviews[panelId];
        
        if (panel.canGoBack() && webview) {
            const entry = panel.goBack();
            webview.src = entry.url;
            this.emit('panel-navigate', { panel: panelId, url: entry.url, direction: 'back' });
            return true;
        }
        return false;
    }
    
    /**
     * Go forward in panel history
     */
    goForward(panelId) {
        const panel = this.panels[panelId];
        const webview = this.webviews[panelId];
        
        if (panel.canGoForward() && webview) {
            const entry = panel.goForward();
            webview.src = entry.url;
            this.emit('panel-navigate', { panel: panelId, url: entry.url, direction: 'forward' });
            return true;
        }
        return false;
    }
    
    /**
     * Refresh panel
     */
    refresh(panelId, clearCache = false) {
        const webview = this.webviews[panelId];
        const panel = this.panels[panelId];
        
        if (!webview) return false;
        
        panel.retryCount = 0; // Reset retry count
        
        if (clearCache) {
            this.clearPanelCache(panelId).then(() => {
                webview.reload();
            });
        } else {
            webview.reload();
        }
        
        this.emit('panel-refresh', { panel: panelId, clearCache });
        return true;
    }
    
    /**
     * Set panel mode (SWF/Web)
     */
    setMode(panelId, mode) {
        const panel = this.panels[panelId];
        const webview = this.webviews[panelId];
        
        if (!Object.values(PanelMode).includes(mode)) {
            console.error(`[PanelManager] Invalid mode: ${mode}`);
            return false;
        }
        
        const previousMode = panel.mode;
        panel.mode = mode;
        
        this.emit('panel-mode-changed', { panel: panelId, mode, previousMode });
        
        // Load appropriate content
        if (mode === PanelMode.SWF) {
            const swfPath = this.getSWFPath(panelId);
            if (swfPath && fs.existsSync(swfPath)) {
                webview.src = `file://${swfPath}`;
            } else {
                this.emit('panel-error', {
                    panel: panelId,
                    error: 'SWF file not found',
                    path: swfPath
                });
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get SWF file path for panel
     */
    getSWFPath(panelId) {
        const defaultPaths = {
            left: path.join(__dirname, '..', 'swf', 'AutoEvony.swf'),
            right: path.join(__dirname, '..', 'swf', 'AutoEvony.swf')
        };
        
        if (this.store) {
            const customPath = this.store.get(`${panelId}SwfPath`);
            if (customPath && fs.existsSync(customPath)) {
                return customPath;
            }
        }
        
        return defaultPaths[panelId];
    }
    
    /**
     * Swap panels
     */
    swapPanels() {
        const leftUrl = this.panels.left.url;
        const rightUrl = this.panels.right.url;
        const leftMode = this.panels.left.mode;
        const rightMode = this.panels.right.mode;
        
        // Swap URLs
        if (this.webviews.left) this.webviews.left.src = rightUrl;
        if (this.webviews.right) this.webviews.right.src = leftUrl;
        
        // Swap modes
        this.panels.left.mode = rightMode;
        this.panels.right.mode = leftMode;
        
        // Swap histories
        const leftHistory = this.panels.left.history;
        this.panels.left.history = this.panels.right.history;
        this.panels.right.history = leftHistory;
        
        this.emit('panels-swapped');
    }
    
    /**
     * Set sync mode
     */
    setSyncMode(mode) {
        const validModes = ['mirror', 'compare', 'transfer', null];
        if (!validModes.includes(mode)) {
            console.error(`[PanelManager] Invalid sync mode: ${mode}`);
            return false;
        }
        
        this.syncMode = mode;
        this.panels.left.syncEnabled = mode !== null;
        this.panels.right.syncEnabled = mode !== null;
        
        this.emit('sync-mode-changed', { mode });
        return true;
    }
    
    /**
     * Sync navigation to other panel
     */
    syncNavigate(sourcePanelId, url) {
        if (this.syncPending) return;
        
        const targetPanelId = sourcePanelId === 'left' ? 'right' : 'left';
        const targetWebview = this.webviews[targetPanelId];
        
        if (targetWebview && this.syncMode === 'mirror') {
            this.syncPending = true;
            
            setTimeout(() => {
                targetWebview.src = url;
                this.syncPending = false;
            }, this.config.syncDebounce);
        }
    }
    
    /**
     * Add bookmark to panel
     */
    addBookmark(panelId, url, title) {
        const panel = this.panels[panelId];
        const bookmark = panel.addBookmark(url, title);
        
        if (bookmark) {
            this.emit('bookmark-added', { panel: panelId, bookmark });
            this.saveState();
        }
        
        return bookmark;
    }
    
    /**
     * Remove bookmark from panel
     */
    removeBookmark(panelId, bookmarkId) {
        const panel = this.panels[panelId];
        const bookmark = panel.removeBookmark(bookmarkId);
        
        if (bookmark) {
            this.emit('bookmark-removed', { panel: panelId, bookmark });
            this.saveState();
        }
        
        return bookmark;
    }
    
    /**
     * Get panel state
     */
    getPanelState(panelId) {
        return this.panels[panelId]?.toJSON() || null;
    }
    
    /**
     * Get all panels state
     */
    getAllState() {
        return {
            left: this.panels.left.toJSON(),
            right: this.panels.right.toJSON(),
            syncMode: this.syncMode,
            failsafeStats: this.failsafeChain.getStats()
        };
    }
    
    /**
     * Clear panel cache
     */
    async clearPanelCache(panelId) {
        const webview = this.webviews[panelId];
        if (!webview) return;
        
        try {
            await webview.executeJavaScript(`
                if (window.caches) {
                    caches.keys().then(names => {
                        names.forEach(name => caches.delete(name));
                    });
                }
            `);
            
            this.emit('panel-cache-cleared', { panel: panelId });
        } catch (e) {
            console.warn(`[PanelManager] Cache clear failed for ${panelId}:`, e);
        }
    }
    
    /**
     * Take screenshot of panel
     */
    async takeScreenshot(panelId) {
        const webview = this.webviews[panelId];
        if (!webview) return null;
        
        try {
            const image = await webview.capturePage();
            const dataUrl = image.toDataURL();
            
            this.emit('panel-screenshot', { panel: panelId, dataUrl });
            return dataUrl;
        } catch (e) {
            console.error(`[PanelManager] Screenshot failed for ${panelId}:`, e);
            return null;
        }
    }
    
    /**
     * Execute JavaScript in panel
     */
    async executeScript(panelId, script) {
        const webview = this.webviews[panelId];
        if (!webview) return null;
        
        try {
            return await webview.executeJavaScript(script);
        } catch (e) {
            console.error(`[PanelManager] Script execution failed for ${panelId}:`, e);
            return null;
        }
    }
    
    /**
     * Start auto-save timer
     */
    startAutoSave() {
        if (this.saveTimer) clearInterval(this.saveTimer);
        
        this.saveTimer = setInterval(() => {
            this.saveState();
        }, this.config.saveInterval);
    }
    
    /**
     * Start health check timer
     */
    startHealthChecks() {
        if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
        
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }
    
    /**
     * Perform health check on panels
     */
    performHealthCheck() {
        for (const [panelId, panel] of Object.entries(this.panels)) {
            const webview = this.webviews[panelId];
            if (!webview) continue;
            
            // Check if webview is responsive
            webview.executeJavaScript('1+1')
                .then(() => {
                    if (panel.health < 100) {
                        panel.health = Math.min(100, panel.health + 5);
                    }
                })
                .catch(() => {
                    panel.health = Math.max(0, panel.health - 10);
                    if (panel.health < 30) {
                        this.emit('panel-unhealthy', { panel: panelId, health: panel.health });
                    }
                });
        }
    }
    
    /**
     * Save state to store
     */
    saveState() {
        if (!this.store) return;
        
        try {
            this.store.set('panelManager', {
                left: this.panels.left.toJSON(),
                right: this.panels.right.toJSON(),
                syncMode: this.syncMode,
                savedAt: Date.now()
            });
            
            console.log('[PanelManager] State saved');
        } catch (e) {
            console.error('[PanelManager] Failed to save state:', e);
        }
    }
    
    /**
     * Load state from store
     */
    loadState() {
        if (!this.store) return;
        
        try {
            const saved = this.store.get('panelManager');
            if (saved) {
                if (saved.left) this.panels.left.fromJSON(saved.left);
                if (saved.right) this.panels.right.fromJSON(saved.right);
                if (saved.syncMode) this.syncMode = saved.syncMode;
                
                console.log('[PanelManager] State loaded');
            }
        } catch (e) {
            console.error('[PanelManager] Failed to load state:', e);
        }
    }
    
    /**
     * Get status summary
     */
    getStatus() {
        return {
            initialized: !!(this.webviews.left && this.webviews.right),
            panels: {
                left: {
                    status: this.panels.left.status,
                    mode: this.panels.left.mode,
                    health: this.panels.left.health,
                    url: this.panels.left.url
                },
                right: {
                    status: this.panels.right.status,
                    mode: this.panels.right.mode,
                    health: this.panels.right.health,
                    url: this.panels.right.url
                }
            },
            syncMode: this.syncMode,
            failsafeStats: this.failsafeChain.getStats()
        };
    }
    
    /**
     * Shutdown and cleanup
     */
    shutdown() {
        if (this.saveTimer) clearInterval(this.saveTimer);
        if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
        
        this.saveState();
        
        this.removeAllListeners();
        this.failsafeChain.removeAllListeners();
        
        console.log('[PanelManager] Shutdown complete');
    }
}

// Export classes
module.exports = {
    PanelManager,
    PanelState,
    FailsafeChain,
    PanelMode,
    PanelStatus,
    FailsafeLevel
};


