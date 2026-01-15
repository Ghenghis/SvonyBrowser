/**
 * Panel UI Controller
 * Renderer-side controller for enhanced panel UI features including
 * navigation, bookmarks, history, console, and sync functionality
 */

class PanelUIController {
    constructor() {
        this.panels = {
            left: {
                id: 'left',
                webview: null,
                mode: 'web',
                url: '',
                history: [],
                historyIndex: -1,
                bookmarks: [],
                consoleVisible: false,
                consoleLogs: [],
                status: 'idle',
                health: 100,
                loadStartTime: null
            },
            right: {
                id: 'right',
                webview: null,
                mode: 'web',
                url: '',
                history: [],
                historyIndex: -1,
                bookmarks: [],
                consoleVisible: false,
                consoleLogs: [],
                status: 'idle',
                health: 100,
                loadStartTime: null
            }
        };
        
        this.syncMode = null; // 'mirror', 'compare', 'transfer', null
        this.syncPending = false;
        this.contextMenuTarget = null;
        this.activePanel = 'left';
        
        // Bind methods
        this.handleKeyboard = this.handleKeyboard.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
    }
    
    /**
     * Initialize panel UI controller
     */
    initialize() {
        // Get webview references
        this.panels.left.webview = document.getElementById('left-webview');
        this.panels.right.webview = document.getElementById('right-webview');
        
        // Setup event listeners for both panels
        ['left', 'right'].forEach(panelId => {
            this.setupPanelListeners(panelId);
            this.setupToolbarListeners(panelId);
        });
        
        // Setup global listeners
        this.setupGlobalListeners();
        
        // Setup sync controls
        this.setupSyncControls();
        
        // Setup context menu
        this.setupContextMenu();
        
        // Setup splitter
        this.setupSplitter();
        
        // Load saved state
        this.loadState();
        
        console.log('[PanelUIController] Initialized');
    }
    
    /**
     * Setup webview event listeners for a panel
     */
    setupPanelListeners(panelId) {
        const panel = this.panels[panelId];
        const webview = panel.webview;
        
        if (!webview) return;
        
        // Load start
        webview.addEventListener('did-start-loading', () => {
            panel.status = 'loading';
            panel.loadStartTime = Date.now();
            this.updatePanelStatus(panelId);
            this.showLoadingBar(panelId, true);
        });
        
        // Load complete
        webview.addEventListener('did-finish-load', () => {
            panel.status = 'ready';
            const loadTime = Date.now() - (panel.loadStartTime || Date.now());
            this.updatePanelStatus(panelId);
            this.showLoadingBar(panelId, false);
            this.updateLoadTime(panelId, loadTime);
            this.hideErrorOverlay(panelId);
        });
        
        // Load failed
        webview.addEventListener('did-fail-load', (e) => {
            if (e.errorCode !== -3) { // Ignore aborted loads
                panel.status = 'error';
                this.updatePanelStatus(panelId);
                this.showLoadingBar(panelId, false);
                this.showErrorOverlay(panelId, e.errorDescription, e.errorCode);
            }
        });
        
        // Navigation
        webview.addEventListener('did-navigate', (e) => {
            panel.url = e.url;
            this.updateUrlBar(panelId, e.url);
            this.addToHistory(panelId, e.url);
            this.updateNavButtons(panelId);
            
            // Sync if enabled
            if (this.syncMode === 'mirror' && !this.syncPending) {
                this.syncNavigate(panelId, e.url);
            }
        });
        
        // In-page navigation
        webview.addEventListener('did-navigate-in-page', (e) => {
            panel.url = e.url;
            this.updateUrlBar(panelId, e.url);
        });
        
        // Title update
        webview.addEventListener('page-title-updated', (e) => {
            panel.title = e.title;
        });
        
        // Console messages
        webview.addEventListener('console-message', (e) => {
            this.addConsoleLog(panelId, e.level, e.message);
        });
        
        // New window requests
        webview.addEventListener('new-window', (e) => {
            // Open in same panel or other panel based on settings
            e.preventDefault();
            this.navigate(panelId, e.url);
        });
    }
    
    /**
     * Setup toolbar event listeners for a panel
     */
    setupToolbarListeners(panelId) {
        // Navigation buttons
        const backBtn = document.getElementById(`${panelId}-back`);
        const forwardBtn = document.getElementById(`${panelId}-forward`);
        const refreshBtn = document.getElementById(`${panelId}-refresh`);
        const stopBtn = document.getElementById(`${panelId}-stop`);
        
        if (backBtn) backBtn.addEventListener('click', () => this.goBack(panelId));
        if (forwardBtn) forwardBtn.addEventListener('click', () => this.goForward(panelId));
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refresh(panelId));
        if (stopBtn) stopBtn.addEventListener('click', () => this.stop(panelId));
        
        // URL bar
        const urlInput = document.getElementById(`${panelId}-url`);
        const goBtn = document.getElementById(`${panelId}-go`);
        
        if (urlInput) {
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.navigate(panelId, urlInput.value);
                }
            });
            
            urlInput.addEventListener('focus', () => {
                urlInput.select();
            });
        }
        
        if (goBtn) goBtn.addEventListener('click', () => {
            const url = document.getElementById(`${panelId}-url`)?.value;
            if (url) this.navigate(panelId, url);
        });
        
        // Action buttons
        const bookmarkBtn = document.getElementById(`${panelId}-bookmark`);
        const screenshotBtn = document.getElementById(`${panelId}-screenshot`);
        const consoleBtn = document.getElementById(`${panelId}-console`);
        const menuBtn = document.getElementById(`${panelId}-menu`);
        
        if (bookmarkBtn) bookmarkBtn.addEventListener('click', () => this.addBookmark(panelId));
        if (screenshotBtn) screenshotBtn.addEventListener('click', () => this.takeScreenshot(panelId));
        if (consoleBtn) consoleBtn.addEventListener('click', () => this.toggleConsole(panelId));
        if (menuBtn) menuBtn.addEventListener('click', (e) => this.showPanelMenu(panelId, e));
        
        // Mode toggle buttons
        ['web', 'swf', 'hybrid'].forEach(mode => {
            const btn = document.getElementById(`${panelId}-${mode}-toggle`);
            if (btn) {
                btn.addEventListener('click', () => this.setMode(panelId, mode));
            }
        });
        
        // Error overlay buttons
        const retryBtn = document.getElementById(`${panelId}-retry`);
        const clearRetryBtn = document.getElementById(`${panelId}-clear-retry`);
        const fallbackBtn = document.getElementById(`${panelId}-fallback`);
        
        if (retryBtn) retryBtn.addEventListener('click', () => this.refresh(panelId));
        if (clearRetryBtn) clearRetryBtn.addEventListener('click', () => this.clearCacheAndRefresh(panelId));
        if (fallbackBtn) fallbackBtn.addEventListener('click', () => this.setMode(panelId, 'web'));
        
        // Console controls
        const consoleClose = document.getElementById(`${panelId}-console-close`);
        const consoleInput = document.getElementById(`${panelId}-console-input`);
        const consoleRun = document.getElementById(`${panelId}-console-run`);
        
        if (consoleClose) consoleClose.addEventListener('click', () => this.toggleConsole(panelId));
        if (consoleInput) {
            consoleInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.executeConsoleCommand(panelId);
                }
            });
        }
        if (consoleRun) consoleRun.addEventListener('click', () => this.executeConsoleCommand(panelId));
    }
    
    /**
     * Setup global keyboard shortcuts
     */
    setupGlobalListeners() {
        document.addEventListener('keydown', this.handleKeyboard);
        
        // Track active panel
        ['left', 'right'].forEach(panelId => {
            const container = document.getElementById(`${panelId}-browser-container`);
            if (container) {
                container.addEventListener('click', () => {
                    this.activePanel = panelId;
                });
            }
        });
    }
    
    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(e) {
        const panelId = this.activePanel;
        
        // Alt+Left: Go back
        if (e.altKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            this.goBack(panelId);
        }
        
        // Alt+Right: Go forward
        if (e.altKey && e.key === 'ArrowRight') {
            e.preventDefault();
            this.goForward(panelId);
        }
        
        // F5: Refresh left panel
        if (e.key === 'F5') {
            e.preventDefault();
            this.refresh('left');
        }
        
        // F6: Refresh right panel
        if (e.key === 'F6') {
            e.preventDefault();
            this.refresh('right');
        }
        
        // Ctrl+L: Focus URL bar
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            const urlInput = document.getElementById(`${panelId}-url`);
            if (urlInput) urlInput.focus();
        }
        
        // Ctrl+D: Add bookmark
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            this.addBookmark(panelId);
        }
        
        // Escape: Close console/menu
        if (e.key === 'Escape') {
            this.hideContextMenu();
            this.hideBookmarksDropdown();
        }
    }
    
    /**
     * Setup sync controls
     */
    setupSyncControls() {
        const syncOff = document.getElementById('sync-off');
        const syncMirror = document.getElementById('sync-mirror');
        const syncCompare = document.getElementById('sync-compare');
        const syncTransfer = document.getElementById('sync-transfer');
        
        if (syncOff) syncOff.addEventListener('click', () => this.setSyncMode(null));
        if (syncMirror) syncMirror.addEventListener('click', () => this.setSyncMode('mirror'));
        if (syncCompare) syncCompare.addEventListener('click', () => this.setSyncMode('compare'));
        if (syncTransfer) syncTransfer.addEventListener('click', () => this.setSyncMode('transfer'));
    }
    
    /**
     * Setup context menu
     */
    setupContextMenu() {
        document.addEventListener('contextmenu', this.handleContextMenu);
        
        // Context menu item clicks
        const contextMenu = document.getElementById('panel-context-menu');
        if (contextMenu) {
            contextMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.context-menu-item');
                if (item) {
                    const action = item.dataset.action;
                    this.handleContextMenuAction(action);
                    this.hideContextMenu();
                }
            });
        }
        
        // Hide on click outside
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });
    }
    
    /**
     * Handle context menu
     */
    handleContextMenu(e) {
        const panel = e.target.closest('.browser-panel');
        if (!panel) return;
        
        e.preventDefault();
        
        const panelId = panel.id.replace('-panel', '');
        this.contextMenuTarget = panelId;
        
        const contextMenu = document.getElementById('panel-context-menu');
        if (contextMenu) {
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.top = `${e.clientY}px`;
        }
    }
    
    /**
     * Handle context menu action
     */
    handleContextMenuAction(action) {
        const panelId = this.contextMenuTarget;
        if (!panelId) return;
        
        switch (action) {
            case 'copy-url':
                this.copyUrl(panelId);
                break;
            case 'open-other':
                this.openInOtherPanel(panelId);
                break;
            case 'add-bookmark':
                this.addBookmark(panelId);
                break;
            case 'screenshot':
                this.takeScreenshot(panelId);
                break;
            case 'view-source':
                this.viewSource(panelId);
                break;
            case 'inspect':
                this.openDevTools(panelId);
                break;
            case 'clear-cache':
                this.clearPanelCache(panelId);
                break;
            case 'reset-panel':
                this.resetPanel(panelId);
                break;
        }
    }
    
    /**
     * Hide context menu
     */
    hideContextMenu() {
        const contextMenu = document.getElementById('panel-context-menu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    }
    
    /**
     * Setup panel splitter
     */
    setupSplitter() {
        const splitter = document.getElementById('panel-splitter');
        const leftPanel = document.getElementById('left-panel');
        const rightPanel = document.getElementById('right-panel');
        
        if (!splitter || !leftPanel || !rightPanel) return;
        
        let isDragging = false;
        let startX = 0;
        let startLeftWidth = 0;
        
        splitter.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startLeftWidth = leftPanel.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const diff = e.clientX - startX;
            const newLeftWidth = startLeftWidth + diff;
            const containerWidth = leftPanel.parentElement.offsetWidth;
            
            // Limit minimum width
            if (newLeftWidth > 200 && newLeftWidth < containerWidth - 200) {
                const leftPercent = (newLeftWidth / containerWidth) * 100;
                leftPanel.style.flex = `0 0 ${leftPercent}%`;
                rightPanel.style.flex = `0 0 ${100 - leftPercent - 1}%`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
    
    // ==================== Navigation Methods ====================
    
    /**
     * Navigate to URL
     */
    navigate(panelId, url) {
        const panel = this.panels[panelId];
        if (!panel.webview) return;
        
        // Add protocol if missing
        if (url && !url.startsWith('http') && !url.startsWith('file') && !url.startsWith('about')) {
            url = 'http://' + url;
        }
        
        panel.webview.src = url;
    }
    
    /**
     * Go back in history
     */
    goBack(panelId) {
        const panel = this.panels[panelId];
        if (panel.webview && panel.webview.canGoBack()) {
            panel.webview.goBack();
        }
    }
    
    /**
     * Go forward in history
     */
    goForward(panelId) {
        const panel = this.panels[panelId];
        if (panel.webview && panel.webview.canGoForward()) {
            panel.webview.goForward();
        }
    }
    
    /**
     * Refresh panel
     */
    refresh(panelId) {
        const panel = this.panels[panelId];
        if (panel.webview) {
            panel.webview.reload();
        }
    }
    
    /**
     * Stop loading
     */
    stop(panelId) {
        const panel = this.panels[panelId];
        if (panel.webview) {
            panel.webview.stop();
        }
    }
    
    /**
     * Clear cache and refresh
     */
    async clearCacheAndRefresh(panelId) {
        const panel = this.panels[panelId];
        if (!panel.webview) return;
        
        try {
            await panel.webview.executeJavaScript(`
                if (window.caches) {
                    caches.keys().then(names => {
                        names.forEach(name => caches.delete(name));
                    });
                }
            `);
        } catch (e) {
            console.warn('Cache clear failed:', e);
        }
        
        panel.webview.reload();
    }
    
    // ==================== History Methods ====================
    
    /**
     * Add URL to history
     */
    addToHistory(panelId, url) {
        const panel = this.panels[panelId];
        
        // Don't add duplicates
        if (panel.history.length > 0 && panel.history[panel.historyIndex]?.url === url) {
            return;
        }
        
        // Truncate forward history
        if (panel.historyIndex < panel.history.length - 1) {
            panel.history = panel.history.slice(0, panel.historyIndex + 1);
        }
        
        panel.history.push({
            url,
            title: panel.title || url,
            timestamp: Date.now()
        });
        
        // Limit history size
        if (panel.history.length > 100) {
            panel.history.shift();
        }
        
        panel.historyIndex = panel.history.length - 1;
    }
    
    /**
     * Update navigation buttons state
     */
    updateNavButtons(panelId) {
        const panel = this.panels[panelId];
        const backBtn = document.getElementById(`${panelId}-back`);
        const forwardBtn = document.getElementById(`${panelId}-forward`);
        
        if (backBtn) {
            backBtn.disabled = !panel.webview?.canGoBack();
        }
        if (forwardBtn) {
            forwardBtn.disabled = !panel.webview?.canGoForward();
        }
    }
    
    // ==================== Bookmark Methods ====================
    
    /**
     * Add bookmark
     */
    addBookmark(panelId) {
        const panel = this.panels[panelId];
        if (!panel.url) return;
        
        // Check for duplicate
        if (panel.bookmarks.find(b => b.url === panel.url)) {
            this.showNotification('Bookmark already exists');
            return;
        }
        
        const bookmark = {
            id: `bm_${Date.now()}`,
            url: panel.url,
            title: panel.title || panel.url,
            timestamp: Date.now()
        };
        
        panel.bookmarks.push(bookmark);
        this.saveState();
        this.showNotification('Bookmark added');
        
        // Update button state
        const bookmarkBtn = document.getElementById(`${panelId}-bookmark`);
        if (bookmarkBtn) {
            bookmarkBtn.classList.add('active');
        }
    }
    
    /**
     * Remove bookmark
     */
    removeBookmark(panelId, bookmarkId) {
        const panel = this.panels[panelId];
        const index = panel.bookmarks.findIndex(b => b.id === bookmarkId);
        
        if (index !== -1) {
            panel.bookmarks.splice(index, 1);
            this.saveState();
            this.updateBookmarksDropdown(panelId);
        }
    }
    
    /**
     * Show bookmarks dropdown
     */
    showBookmarksDropdown(panelId, anchorElement) {
        const panel = this.panels[panelId];
        const dropdown = document.getElementById('bookmarks-dropdown');
        
        if (!dropdown) return;
        
        // Update bookmarks list
        this.updateBookmarksDropdown(panelId);
        
        // Position dropdown
        const rect = anchorElement.getBoundingClientRect();
        dropdown.style.display = 'block';
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.top = `${rect.bottom + 5}px`;
        
        dropdown.dataset.panel = panelId;
    }
    
    /**
     * Update bookmarks dropdown content
     */
    updateBookmarksDropdown(panelId) {
        const panel = this.panels[panelId];
        const list = document.getElementById('bookmarks-list');
        
        if (!list) return;
        
        list.innerHTML = panel.bookmarks.map(bookmark => `
            <div class="bookmark-item" data-url="${bookmark.url}" data-id="${bookmark.id}">
                <img class="bookmark-favicon" src="https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}" alt="">
                <span class="bookmark-title">${bookmark.title}</span>
                <button class="bookmark-delete" data-id="${bookmark.id}">✕</button>
            </div>
        `).join('');
        
        // Add click handlers
        list.querySelectorAll('.bookmark-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('bookmark-delete')) {
                    this.removeBookmark(panelId, e.target.dataset.id);
                } else {
                    this.navigate(panelId, item.dataset.url);
                    this.hideBookmarksDropdown();
                }
            });
        });
    }
    
    /**
     * Hide bookmarks dropdown
     */
    hideBookmarksDropdown() {
        const dropdown = document.getElementById('bookmarks-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
    
    // ==================== Mode Methods ====================
    
    /**
     * Set panel mode
     */
    setMode(panelId, mode) {
        const panel = this.panels[panelId];
        panel.mode = mode;
        
        // Update toggle buttons
        ['web', 'swf', 'hybrid'].forEach(m => {
            const btn = document.getElementById(`${panelId}-${m}-toggle`);
            if (btn) {
                btn.classList.toggle('active', m === mode);
            }
        });
        
        // Update mode badge
        const badge = document.getElementById(`${panelId}-mode-badge`);
        if (badge) {
            badge.textContent = mode.toUpperCase();
            badge.className = `panel-mode-badge ${mode}`;
        }
        
        // Load appropriate content
        if (mode === 'swf') {
            // Request SWF path from main process
            if (window.ipcRenderer) {
                window.ipcRenderer.invoke('get-swf-path', panelId).then(swfPath => {
                    if (swfPath) {
                        this.navigate(panelId, `file://${swfPath}`);
                    }
                });
            }
        } else if (mode === 'web') {
            // Navigate to default web URL
            const defaultUrls = {
                left: 'http://www.evony.com',
                right: 'http://cc2.evony.com'
            };
            this.navigate(panelId, defaultUrls[panelId]);
        }
        
        // Update flash status
        this.updateFlashStatus(panelId, mode === 'swf');
    }
    
    // ==================== Sync Methods ====================
    
    /**
     * Set sync mode
     */
    setSyncMode(mode) {
        this.syncMode = mode;
        
        // Update sync buttons
        ['off', 'mirror', 'compare', 'transfer'].forEach(m => {
            const btn = document.getElementById(`sync-${m === null ? 'off' : m}`);
            if (btn) {
                btn.classList.toggle('active', (m === 'off' && mode === null) || m === mode);
            }
        });
        
        // Update sync status in panels
        ['left', 'right'].forEach(panelId => {
            const statusEl = document.getElementById(`${panelId}-sync-status`);
            if (statusEl) {
                statusEl.textContent = `Sync: ${mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'Off'}`;
            }
        });
    }
    
    /**
     * Sync navigation to other panel
     */
    syncNavigate(sourcePanelId, url) {
        if (this.syncPending) return;
        
        const targetPanelId = sourcePanelId === 'left' ? 'right' : 'left';
        
        this.syncPending = true;
        setTimeout(() => {
            this.navigate(targetPanelId, url);
            this.syncPending = false;
        }, 100);
    }
    
    // ==================== Console Methods ====================
    
    /**
     * Toggle console visibility
     */
    toggleConsole(panelId) {
        const panel = this.panels[panelId];
        panel.consoleVisible = !panel.consoleVisible;
        
        const consolePanel = document.getElementById(`${panelId}-console-panel`);
        if (consolePanel) {
            consolePanel.style.display = panel.consoleVisible ? 'flex' : 'none';
        }
        
        const consoleBtn = document.getElementById(`${panelId}-console`);
        if (consoleBtn) {
            consoleBtn.classList.toggle('active', panel.consoleVisible);
        }
    }
    
    /**
     * Add console log entry
     */
    addConsoleLog(panelId, level, message) {
        const panel = this.panels[panelId];
        const levelClass = ['log', 'log', 'warn', 'error'][level] || 'log';
        
        panel.consoleLogs.push({ level: levelClass, message, timestamp: Date.now() });
        
        // Limit logs
        if (panel.consoleLogs.length > 500) {
            panel.consoleLogs.shift();
        }
        
        // Update console output
        const output = document.getElementById(`${panelId}-console-output`);
        if (output) {
            const entry = document.createElement('div');
            entry.className = levelClass;
            entry.textContent = message;
            output.appendChild(entry);
            output.scrollTop = output.scrollHeight;
        }
    }
    
    /**
     * Execute console command
     */
    async executeConsoleCommand(panelId) {
        const panel = this.panels[panelId];
        const input = document.getElementById(`${panelId}-console-input`);
        
        if (!input || !input.value.trim()) return;
        
        const command = input.value;
        input.value = '';
        
        // Log command
        this.addConsoleLog(panelId, 0, `> ${command}`);
        
        try {
            const result = await panel.webview.executeJavaScript(command);
            this.addConsoleLog(panelId, 0, String(result));
        } catch (error) {
            this.addConsoleLog(panelId, 3, error.message);
        }
    }
    
    // ==================== UI Update Methods ====================
    
    /**
     * Update panel status indicator
     */
    updatePanelStatus(panelId) {
        const panel = this.panels[panelId];
        const indicator = document.getElementById(`${panelId}-status-indicator`);
        const statusText = document.getElementById(`${panelId}-status`);
        
        if (indicator) {
            indicator.className = `panel-status-indicator ${panel.status}`;
            indicator.title = `Status: ${panel.status.charAt(0).toUpperCase() + panel.status.slice(1)}`;
        }
        
        if (statusText) {
            statusText.textContent = panel.status.charAt(0).toUpperCase() + panel.status.slice(1);
        }
    }
    
    /**
     * Update URL bar
     */
    updateUrlBar(panelId, url) {
        const urlInput = document.getElementById(`${panelId}-url`);
        if (urlInput && document.activeElement !== urlInput) {
            urlInput.value = url;
        }
    }
    
    /**
     * Show/hide loading bar
     */
    showLoadingBar(panelId, show) {
        const progress = document.getElementById(`${panelId}-loading-progress`);
        if (progress) {
            progress.classList.toggle('active', show);
            progress.style.width = show ? '30%' : '100%';
            
            if (!show) {
                setTimeout(() => {
                    progress.style.width = '0%';
                }, 300);
            }
        }
    }
    
    /**
     * Update load time display
     */
    updateLoadTime(panelId, loadTime) {
        const el = document.getElementById(`${panelId}-load-time`);
        if (el) {
            el.textContent = `Load: ${loadTime}ms`;
        }
    }
    
    /**
     * Update flash status
     */
    updateFlashStatus(panelId, hasFlash) {
        const el = document.getElementById(`${panelId}-flash-status`);
        if (el) {
            el.textContent = `Flash: ${hasFlash ? 'Active' : 'N/A'}`;
        }
    }
    
    /**
     * Update health bar
     */
    updateHealthBar(panelId, health) {
        const panel = this.panels[panelId];
        panel.health = health;
        
        const bar = document.getElementById(`${panelId}-health-bar`);
        if (bar) {
            bar.style.width = `${health}%`;
            bar.className = 'health-bar';
            if (health < 30) bar.classList.add('critical');
            else if (health < 60) bar.classList.add('warning');
        }
    }
    
    /**
     * Show error overlay
     */
    showErrorOverlay(panelId, message, code) {
        const overlay = document.getElementById(`${panelId}-error-overlay`);
        const messageEl = document.getElementById(`${panelId}-error-message`);
        const detailsEl = document.getElementById(`${panelId}-error-details`);
        
        if (overlay) {
            overlay.style.display = 'flex';
        }
        
        if (messageEl) {
            messageEl.textContent = message || 'Unable to load the page.';
        }
        
        if (detailsEl) {
            detailsEl.textContent = `Error Code: ${code}\nURL: ${this.panels[panelId].url}`;
        }
    }
    
    /**
     * Hide error overlay
     */
    hideErrorOverlay(panelId) {
        const overlay = document.getElementById(`${panelId}-error-overlay`);
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    /**
     * Show notification
     */
    showNotification(message) {
        // Simple notification - could be enhanced with a toast system
        console.log('[Notification]', message);
    }
    
    // ==================== Utility Methods ====================
    
    /**
     * Copy URL to clipboard
     */
    copyUrl(panelId) {
        const panel = this.panels[panelId];
        if (panel.url) {
            navigator.clipboard.writeText(panel.url);
            this.showNotification('URL copied to clipboard');
        }
    }
    
    /**
     * Open URL in other panel
     */
    openInOtherPanel(panelId) {
        const panel = this.panels[panelId];
        const otherPanelId = panelId === 'left' ? 'right' : 'left';
        this.navigate(otherPanelId, panel.url);
    }
    
    /**
     * Take screenshot
     */
    async takeScreenshot(panelId) {
        if (window.ipcRenderer) {
            const result = await window.ipcRenderer.invoke('panel-screenshot', panelId);
            if (result.success) {
                this.showNotification(`Screenshot saved: ${result.filepath}`);
            }
        }
    }
    
    /**
     * View page source
     */
    viewSource(panelId) {
        const panel = this.panels[panelId];
        if (panel.url) {
            this.navigate(panelId, `view-source:${panel.url}`);
        }
    }
    
    /**
     * Open DevTools
     */
    openDevTools(panelId) {
        const panel = this.panels[panelId];
        if (panel.webview) {
            panel.webview.openDevTools();
        }
    }
    
    /**
     * Clear panel cache
     */
    async clearPanelCache(panelId) {
        await this.clearCacheAndRefresh(panelId);
        this.showNotification('Cache cleared');
    }
    
    /**
     * Reset panel to defaults
     */
    resetPanel(panelId) {
        const panel = this.panels[panelId];
        panel.history = [];
        panel.historyIndex = -1;
        panel.mode = 'web';
        
        this.setMode(panelId, 'web');
        this.updateNavButtons(panelId);
    }
    
    /**
     * Show panel menu
     */
    showPanelMenu(panelId, event) {
        this.contextMenuTarget = panelId;
        const contextMenu = document.getElementById('panel-context-menu');
        if (contextMenu) {
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${event.clientX}px`;
            contextMenu.style.top = `${event.clientY}px`;
        }
    }
    
    // ==================== State Persistence ====================
    
    /**
     * Save state to localStorage
     */
    saveState() {
        const state = {
            left: {
                bookmarks: this.panels.left.bookmarks,
                mode: this.panels.left.mode
            },
            right: {
                bookmarks: this.panels.right.bookmarks,
                mode: this.panels.right.mode
            },
            syncMode: this.syncMode
        };
        
        localStorage.setItem('panelUIState', JSON.stringify(state));
    }
    
    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const saved = localStorage.getItem('panelUIState');
            if (saved) {
                const state = JSON.parse(saved);
                
                if (state.left) {
                    this.panels.left.bookmarks = state.left.bookmarks || [];
                    if (state.left.mode) this.setMode('left', state.left.mode);
                }
                
                if (state.right) {
                    this.panels.right.bookmarks = state.right.bookmarks || [];
                    if (state.right.mode) this.setMode('right', state.right.mode);
                }
                
                if (state.syncMode) {
                    this.setSyncMode(state.syncMode);
                }
            }
        } catch (e) {
            console.warn('Failed to load panel state:', e);
        }
    }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PanelUIController };
}

// Global instance
window.panelUIController = new PanelUIController();
