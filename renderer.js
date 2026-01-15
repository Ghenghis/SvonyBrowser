/**
 * Svony Browser - Renderer Process
 * Handles all UI interactions and browser panel management
 */

const { ipcRenderer, remote } = require('electron');
const path = require('path');
const fs = require('fs');
// Find SWF file in multiple locations (packaged vs development)
function findSWFPath(swfName) {
    const possibleDirs = [
        path.join(__dirname, 'swf'),
        path.join(process.resourcesPath || __dirname, 'swf'),
        path.join(path.dirname(process.execPath), 'resources', 'swf')
    ];
    
    for (const dir of possibleDirs) {
        try {
            const swfPath = path.join(dir, swfName);
            if (fs.existsSync(swfPath)) {
                console.log('[Renderer] Found SWF:', swfPath);
                return swfPath;
            }
        } catch (e) { /* ignore */ }
    }
    
    console.warn('[Renderer] SWF not found:', swfName);
    return null;
}

const Store = require('./store');

// Initialize store
const store = new Store({
    configName: 'svony-preferences'
});

// State management
const state = {
    leftPanelMode: 'web',
    rightPanelMode: 'web',
    sidePanelCollapsed: false,
    trafficCapturing: false,
    trafficEntries: [],
    selectedTrafficEntry: null,
    mcpConnected: false,
    lmStudioConnected: false,
    protocolData: null,
    selectedProtocolAction: null,
    appVersion: '2.0.5'
};

// DOM Elements
const elements = {
    // Panels
    leftPanel: document.getElementById('left-panel'),
    rightPanel: document.getElementById('right-panel'),
    leftWebview: document.getElementById('left-webview'),
    rightWebview: document.getElementById('right-webview'),
    sidePanel: document.getElementById('side-panel'),
    panelSplitter: document.getElementById('panel-splitter'),
    
    // Toolbar
    btnLeftOnly: document.getElementById('btn-left-only'),
    btnBothPanels: document.getElementById('btn-both-panels'),
    btnRightOnly: document.getElementById('btn-right-only'),
    btnSwapPanels: document.getElementById('btn-swap-panels'),
    panelSizePreset: document.getElementById('panel-size-preset'),
    btnAutoFit: document.getElementById('btn-auto-fit'),
    btnReloadLeft: document.getElementById('btn-reload-left'),
    btnReloadRight: document.getElementById('btn-reload-right'),
    btnClearCache: document.getElementById('btn-clear-cache'),
    btnSettings: document.getElementById('btn-settings'),
    serverSelector: document.getElementById('server-selector'),
    
    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Traffic
    trafficStart: document.getElementById('traffic-start'),
    trafficStop: document.getElementById('traffic-stop'),
    trafficClear: document.getElementById('traffic-clear'),
    trafficExport: document.getElementById('traffic-export'),
    trafficFilter: document.getElementById('traffic-filter'),
    trafficDirection: document.getElementById('traffic-direction'),
    trafficTbody: document.getElementById('traffic-tbody'),
    trafficStatus: document.getElementById('traffic-status'),
    trafficCount: document.getElementById('traffic-count'),
    
    // Chatbot
    chatbotInput: document.getElementById('chatbot-input'),
    chatbotSend: document.getElementById('chatbot-send'),
    chatbotMessages: document.getElementById('chatbot-messages'),
    
    // Settings
    settingsOverlay: document.getElementById('settings-overlay'),
    closeSettings: document.getElementById('close-settings'),
    settingsSave: document.getElementById('settings-save'),
    settingsReset: document.getElementById('settings-reset'),
    settingsNavBtns: document.querySelectorAll('.settings-nav'),
    settingsSections: document.querySelectorAll('.settings-section'),
    
    // Status bar
    connectionIndicator: document.getElementById('connection-indicator'),
    connectionStatus: document.getElementById('connection-status'),
    statusMessage: document.getElementById('status-message'),
    memoryUsage: document.getElementById('memory-usage'),
    trafficCounter: document.getElementById('traffic-counter')
};

// Initialize - Main entry point
async function init() {
    console.log('[Renderer] Starting initialization...');
    
    // Core setup
    setupEventListeners();
    loadSettings();
    initializePanels();
    updateStatusBar();
    
    // Initialize LM Studio connection
    initLMStudioConnection();
    
    // Setup LM Studio settings event listeners
    setupLMStudioListeners();
    
    // Check platform for window controls
    if (process.platform === 'win32') {
        document.getElementById('window-controls').style.display = 'grid';
    }
    
    // Start memory monitoring
    setInterval(updateMemoryUsage, 5000);
    
    // Load version from main process
    try {
        const version = await ipcRenderer.invoke('get-version');
        state.appVersion = version;
        const versionEl = document.getElementById('version-info');
        if (versionEl) versionEl.textContent = `v${version}`;
    } catch (e) {
        console.warn('Could not get version:', e);
    }
    
    // Check Flash status
    try {
        const flashStatus = await ipcRenderer.invoke('get-flash-status');
        if (flashStatus.found) {
            updateStatus(`Flash plugin loaded: ${flashStatus.plugin}`);
        } else {
            updateStatus('Warning: Flash plugin not found');
        }
    } catch (e) {
        console.warn('Could not get Flash status:', e);
    }
    
    // Initialize enhanced features
    try {
        await initializeProtocolExplorerEnhanced();
        await initializeCombatSimulator();
        await initializeSessionRecorder();
        await initializeGameState();
    } catch (e) {
        console.warn('Some enhanced features failed to initialize:', e);
    }
    
    // Override chatbot send with enhanced version (uses LM Studio)
    elements.chatbotSend.removeEventListener('click', sendChatMessage);
    elements.chatbotSend.addEventListener('click', sendChatMessageEnhanced);
    
    // Override AMF decode with enhanced version (uses protocol-handler)
    const amfDecodeBtn = document.getElementById('amf-decode');
    if (amfDecodeBtn) {
        amfDecodeBtn.removeEventListener('click', decodeAMF);
        amfDecodeBtn.addEventListener('click', decodeAMFEnhanced);
    }
    
    console.log('[Renderer] Initialization complete');
}

// Setup LM Studio settings event listeners
function setupLMStudioListeners() {
    // Test connection button
    const testBtn = document.getElementById('test-lm-connection-btn');
    if (testBtn) {
        testBtn.addEventListener('click', testLMStudioConnection);
    }
    
    // Refresh models button
    const refreshBtn = document.getElementById('refresh-models-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshLMStudioModels);
    }
    
    // Temperature slider
    const tempSlider = document.getElementById('setting-lm-temperature');
    if (tempSlider) {
        tempSlider.addEventListener('input', (e) => {
            const tempValue = document.getElementById('temperature-value');
            if (tempValue) tempValue.textContent = e.target.value;
        });
    }
}

// Setup event listeners
function setupEventListeners() {
    // Helper for safe event listener attachment
    const safeAddListener = (element, event, handler) => {
        if (element) element.addEventListener(event, handler);
    };
    
    // View controls
    safeAddListener(elements.btnLeftOnly, 'click', () => setPanelView('left'));
    safeAddListener(elements.btnBothPanels, 'click', () => setPanelView('both'));
    safeAddListener(elements.btnRightOnly, 'click', () => setPanelView('right'));
    safeAddListener(elements.btnSwapPanels, 'click', swapPanels);
    
    // Panel size presets
    safeAddListener(elements.panelSizePreset, 'change', (e) => {
        const preset = e.target.value;
        autoSizePanels(preset);
        store.set('panelSizePreset', preset);
    });
    
    // Auto-fit button
    safeAddListener(elements.btnAutoFit, 'click', () => {
        // Auto-fit based on window size and game aspect ratio
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const aspectRatio = windowWidth / windowHeight;
        
        // Choose optimal preset based on window aspect ratio
        let preset = 'evony-optimal';
        if (aspectRatio > 2.0) {
            preset = 'wide-game';  // Ultra-wide monitors
        } else if (aspectRatio > 1.7) {
            preset = '16:9-game';  // Standard widescreen
        } else if (aspectRatio > 1.5) {
            preset = 'evony-optimal';  // Standard monitors
        } else {
            preset = '4:3-game';  // Older/square monitors
        }
        
        autoSizePanels(preset);
        elements.panelSizePreset.value = preset;
        store.set('panelSizePreset', preset);
    });
    
    // Restore saved preset on load
    try {
        const savedPreset = store.get('panelSizePreset', 'evony-optimal');
        if (elements.panelSizePreset) {
            elements.panelSizePreset.value = savedPreset;
        }
    } catch (err) {}
    
    // Reload buttons
    safeAddListener(elements.btnReloadLeft, 'click', () => elements.leftWebview?.reload());
    safeAddListener(elements.btnReloadRight, 'click', () => elements.rightWebview?.reload());
    
    // Clear cache
    safeAddListener(elements.btnClearCache, 'click', () => {
        ipcRenderer.send('clear-cache');
    });
    
    // Settings
    safeAddListener(elements.btnSettings, 'click', showSettings);
    safeAddListener(elements.closeSettings, 'click', hideSettings);
    safeAddListener(elements.settingsSave, 'click', saveSettings);
    safeAddListener(elements.settingsReset, 'click', resetSettings);
    
    // Settings navigation
    elements.settingsNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            switchSettingsSection(section);
        });
    });
    
    // Tab switching
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Panel toggles
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const panel = e.target.closest('.browser-panel');
            const isLeft = panel.id === 'left-panel';
            const mode = e.target.dataset.mode;
            togglePanelMode(isLeft ? 'left' : 'right', mode);
        });
    });
    
    // Traffic controls
    safeAddListener(elements.trafficStart, 'click', startTrafficCapture);
    safeAddListener(elements.trafficStop, 'click', stopTrafficCapture);
    safeAddListener(elements.trafficClear, 'click', clearTraffic);
    safeAddListener(elements.trafficExport, 'click', exportTraffic);
    safeAddListener(elements.trafficFilter, 'input', filterTraffic);
    safeAddListener(elements.trafficDirection, 'change', filterTraffic);
    
    // Details tabs
    document.querySelectorAll('.details-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchDetailsTab(tabName);
        });
    });
    
    // Chatbot
    safeAddListener(elements.chatbotSend, 'click', sendChatMessage);
    safeAddListener(elements.chatbotInput, 'keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    
    // Quick actions
    document.querySelectorAll('.quick-action').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            handleQuickAction(action);
        });
    });
    
    // Side panel toggle
    document.getElementById('toggle-side-panel').addEventListener('click', toggleSidePanel);
    
    // Panel splitter drag
    setupPanelSplitter();
    
    // Window controls
    document.getElementById('min-button')?.addEventListener('click', () => {
        ipcRenderer.send('minimize-window');
    });
    document.getElementById('max-button')?.addEventListener('click', () => {
        ipcRenderer.send('maximize-window');
    });
    document.getElementById('restore-button')?.addEventListener('click', () => {
        ipcRenderer.send('restore-window');
    });
    document.getElementById('close-button')?.addEventListener('click', () => {
        ipcRenderer.send('close-window');
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Server selector
    elements.serverSelector.addEventListener('change', (e) => {
        store.set('defaultServer', e.target.value);
    });
    
    // Webview events
    setupWebviewEvents(elements.leftWebview, 'left');
    setupWebviewEvents(elements.rightWebview, 'right');
    
    // Protocol search
    document.getElementById('protocol-search')?.addEventListener('input', filterProtocol);
    
    // Protocol actions
    document.getElementById('protocol-copy')?.addEventListener('click', copyProtocolToClipboard);
    document.getElementById('protocol-test')?.addEventListener('click', testProtocolInChat);
    
    // AMF decoder
    document.getElementById('amf-decode')?.addEventListener('click', decodeAMF);
    
    // Training calculator
    document.getElementById('calc-training')?.addEventListener('click', calculateTraining);
    
    // MCP reconnect
    document.getElementById('mcp-reconnect')?.addEventListener('click', reconnectMCP);
    
    // Fiddler button
    document.getElementById('btn-fiddler')?.addEventListener('click', () => {
        ipcRenderer.send('open-fiddler');
    });
    
    // SOL Editor button
    document.getElementById('btn-sol-editor')?.addEventListener('click', () => {
        ipcRenderer.send('open-sol-editor');
    });
    
    // Browse buttons for SWF paths
    document.querySelectorAll('.browse-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const input = e.target.previousElementSibling;
            if (input && input.tagName === 'INPUT') {
                const filePath = await ipcRenderer.invoke('browse-swf');
                if (filePath) {
                    input.value = filePath;
                }
            }
        });
    });
}

// Panel management
function setPanelView(view) {
    // Update button states
    elements.btnLeftOnly.classList.remove('active');
    elements.btnBothPanels.classList.remove('active');
    elements.btnRightOnly.classList.remove('active');
    
    switch (view) {
        case 'left':
            elements.btnLeftOnly.classList.add('active');
            elements.leftPanel.classList.remove('hidden');
            elements.rightPanel.classList.add('hidden');
            elements.panelSplitter.style.display = 'none';
            break;
        case 'right':
            elements.btnRightOnly.classList.add('active');
            elements.leftPanel.classList.add('hidden');
            elements.rightPanel.classList.remove('hidden');
            elements.panelSplitter.style.display = 'none';
            break;
        case 'both':
        default:
            elements.btnBothPanels.classList.add('active');
            elements.leftPanel.classList.remove('hidden');
            elements.rightPanel.classList.remove('hidden');
            elements.panelSplitter.style.display = 'flex';
            break;
    }
}

function swapPanels() {
    const leftSrc = elements.leftWebview.src;
    const rightSrc = elements.rightWebview.src;
    elements.leftWebview.src = rightSrc;
    elements.rightWebview.src = leftSrc;
    
    // Swap modes
    const leftMode = state.leftPanelMode;
    state.leftPanelMode = state.rightPanelMode;
    state.rightPanelMode = leftMode;
    
    updatePanelToggles();
}

function togglePanelMode(panel, mode) {
    if (panel === 'left') {
        // Deactivate hybrid mode if switching away from it
        if (state.leftPanelMode === 'hybrid' && mode !== 'hybrid') {
            deactivateHybridMode('left');
        }
        
        state.leftPanelMode = mode;
        document.getElementById('left-web-toggle').classList.toggle('active', mode === 'web');
        document.getElementById('left-swf-toggle').classList.toggle('active', mode === 'swf');
        document.getElementById('left-hybrid-toggle')?.classList.toggle('active', mode === 'hybrid');
        
        if (mode === 'web') {
            // Restore web mode - load the default AutoEvony URL
            const autoevonyUrl = store.get('autoevonyUrl') || 'https://autoevony.com';
            elements.leftWebview.src = autoevonyUrl;
            return;
        }
        
        if (mode === 'hybrid') {
            // Hybrid mode uses Playwright for enhanced automation
            activateHybridMode('left');
            return;
        }
        
        if (mode === 'swf') {
            // SWF files are in the swf/ directory
            const swfPath = store.get('autoevonySwfPath') || findSWFPath('AutoEvony.swf');
            // If file doesn't exist, show message
            if (!swfPath || !fs.existsSync(swfPath)) {
                elements.leftWebview.src = 'data:text/html,<html><body style="background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div><h2>SWF File Not Found</h2><p>AutoEvony.swf not found in swf/ directory</p></div></body></html>';
                return;
            }
            elements.leftWebview.src = `file://${swfPath}`;
        }
    } else {
        // Deactivate hybrid mode if switching away from it
        if (state.rightPanelMode === 'hybrid' && mode !== 'hybrid') {
            deactivateHybridMode('right');
        }
        
        state.rightPanelMode = mode;
        document.getElementById('right-web-toggle').classList.toggle('active', mode === 'web');
        document.getElementById('right-swf-toggle').classList.toggle('active', mode === 'swf');
        document.getElementById('right-hybrid-toggle')?.classList.toggle('active', mode === 'hybrid');
        
        if (mode === 'web') {
            // Restore web mode - load the Evony game URL
            const serverUrl = store.get('defaultServer') || 'cc2';
            const evonyUrl = `https://${serverUrl}.evony.com/`;
            elements.rightWebview.src = evonyUrl;
            return;
        }
        
        if (mode === 'hybrid') {
            // Hybrid mode uses Playwright for enhanced automation
            activateHybridMode('right');
            return;
        }
        
        if (mode === 'swf') {
            // SWF files are in the swf/ directory
            const swfPath = store.get('evonySwfPath') || findSWFPath('AutoEvony.swf');
            // If file doesn't exist, show message
            if (!swfPath || !fs.existsSync(swfPath)) {
                elements.rightWebview.src = 'data:text/html,<html><body style="background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div><h2>SWF File Not Found</h2><p>EvonyClient.swf not found in swf/ directory</p></div></body></html>';
                return;
            }
            elements.rightWebview.src = `file://${swfPath}`;
        }
    }
}

/**
 * Activate Hybrid mode using Playwright for enhanced automation
 */
async function activateHybridMode(panel) {
    const webview = panel === 'left' ? elements.leftWebview : elements.rightWebview;
    const currentUrl = webview.src || '';
    
    try {
        // Show loading indicator
        showNotification(`Activating Hybrid mode for ${panel} panel...`, 'info');
        
        // Initialize Playwright if needed
        const status = await ipcRenderer.invoke('playwright-status');
        if (!status.running) {
            const startResult = await ipcRenderer.invoke('playwright-start');
            if (startResult.error) {
                showNotification(`Playwright error: ${startResult.error}`, 'error');
                return;
            }
        }
        
        // Start hybrid mode for this panel
        const panelId = panel;
        const result = await ipcRenderer.invoke('panel-hybrid-start', panelId, currentUrl || 'about:blank');
        
        if (result.error) {
            showNotification(`Hybrid mode error: ${result.error}`, 'error');
            return;
        }
        
        // Store the Playwright page ID from result
        state[`${panel}PlaywrightPageId`] = result.pageId || panel;
        
        // Show hybrid mode indicator
        const indicator = document.createElement('div');
        indicator.className = 'hybrid-mode-indicator';
        indicator.innerHTML = '<span class="hybrid-icon">⚡</span> Hybrid Mode Active';
        indicator.id = `${panel}-hybrid-indicator`;
        
        const panelElement = document.getElementById(`${panel}-panel`);
        const existingIndicator = document.getElementById(`${panel}-hybrid-indicator`);
        if (existingIndicator) existingIndicator.remove();
        panelElement.querySelector('.panel-header')?.appendChild(indicator);
        
        showNotification(`Hybrid mode activated for ${panel} panel`, 'success');
        console.log(`[Renderer] Hybrid mode activated for ${panel} panel`);
        
    } catch (error) {
        console.error('[Renderer] Hybrid mode activation failed:', error);
        showNotification(`Hybrid mode failed: ${error.message}`, 'error');
        
        // Track error
        ipcRenderer.invoke('error-track', {
            message: `Hybrid mode activation failed: ${error.message}`,
            category: 'playwright',
            severity: 'error',
            context: { panel, url: currentUrl }
        });
    }
}

/**
 * Deactivate Hybrid mode for a panel
 */
async function deactivateHybridMode(panel) {
    try {
        await ipcRenderer.invoke('panel-hybrid-stop', panel);
        state[`${panel}PlaywrightPageId`] = null;
        showNotification(`Hybrid mode deactivated for ${panel} panel`, 'info');
    } catch (error) {
        console.error('[Renderer] Hybrid mode deactivation failed:', error);
    }
    
    // Remove indicator
    const indicator = document.getElementById(`${panel}-hybrid-indicator`);
    if (indicator) indicator.remove();
}

function updatePanelToggles() {
    document.getElementById('left-web-toggle').classList.toggle('active', state.leftPanelMode === 'web');
    document.getElementById('left-swf-toggle').classList.toggle('active', state.leftPanelMode === 'swf');
    document.getElementById('left-hybrid-toggle')?.classList.toggle('active', state.leftPanelMode === 'hybrid');
    document.getElementById('right-web-toggle').classList.toggle('active', state.rightPanelMode === 'web');
    document.getElementById('right-swf-toggle').classList.toggle('active', state.rightPanelMode === 'swf');
    document.getElementById('right-hybrid-toggle')?.classList.toggle('active', state.rightPanelMode === 'hybrid');
}

function setupPanelSplitter() {
    let isDragging = false;
    let startX, startLeftWidth;
    const splitter = elements.panelSplitter;
    const browserPanels = document.getElementById('browser-panels');
    
    // Store the current panel ratio for persistence
    let currentRatio = 0.5;
    
    // Get position from mouse or touch event
    function getClientX(e) {
        if (e.touches && e.touches.length > 0) {
            return e.touches[0].clientX;
        }
        return e.clientX;
    }
    
    // Start dragging (mouse or touch)
    function startDrag(e) {
        isDragging = true;
        startX = getClientX(e);
        startLeftWidth = elements.leftPanel.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        splitter.classList.add('dragging');
        
        // Prevent default to avoid text selection and scrolling
        e.preventDefault();
    }
    
    // Handle drag movement
    function handleDrag(e) {
        if (!isDragging) return;
        
        const clientX = getClientX(e);
        const diff = clientX - startX;
        const newLeftWidth = startLeftWidth + diff;
        const containerWidth = browserPanels.offsetWidth;
        const splitterWidth = 8;
        
        const minWidth = 150;
        const maxWidth = containerWidth - minWidth - splitterWidth;
        
        if (newLeftWidth >= minWidth && newLeftWidth <= maxWidth) {
            elements.leftPanel.style.flex = 'none';
            elements.leftPanel.style.width = `${newLeftWidth}px`;
            elements.rightPanel.style.flex = '1';
            
            // Store the ratio
            currentRatio = newLeftWidth / containerWidth;
            
            // Dispatch resize event for webviews
            window.dispatchEvent(new CustomEvent('panels-resized', { detail: { ratio: currentRatio } }));
        }
        
        e.preventDefault();
    }
    
    // End dragging
    function endDrag() {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            splitter.classList.remove('dragging');
            
            // Save ratio to store
            try {
                store.set('panelRatio', currentRatio);
            } catch (err) {
                console.warn('Could not save panel ratio:', err);
            }
        }
    }
    
    // Mouse events
    splitter.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', endDrag);
    
    // Touch events for finger/touchscreen support
    splitter.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', handleDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
    document.addEventListener('touchcancel', endDrag);
    
    // Double-click to reset to 50/50
    splitter.addEventListener('dblclick', () => {
        setPanelRatio(0.5);
    });
    
    // Restore saved ratio on load
    try {
        const savedRatio = store.get('panelRatio', 0.5);
        if (savedRatio && savedRatio > 0.1 && savedRatio < 0.9) {
            currentRatio = savedRatio;
            setPanelRatio(savedRatio);
        }
    } catch (err) {
        console.warn('Could not restore panel ratio:', err);
    }
    
    console.log('[Renderer] Panel splitter initialized with touch support');
}

// Set panel ratio programmatically (0.0 to 1.0)
function setPanelRatio(ratio) {
    const browserPanels = document.getElementById('browser-panels');
    if (!browserPanels) return;
    
    const containerWidth = browserPanels.offsetWidth;
    const splitterWidth = 8;
    const minWidth = 150;
    
    let leftWidth = containerWidth * ratio;
    leftWidth = Math.max(minWidth, Math.min(leftWidth, containerWidth - minWidth - splitterWidth));
    
    elements.leftPanel.style.flex = 'none';
    elements.leftPanel.style.width = `${leftWidth}px`;
    elements.rightPanel.style.flex = '1';
    
    // Save and dispatch event
    try {
        store.set('panelRatio', ratio);
    } catch (err) {}
    
    window.dispatchEvent(new CustomEvent('panels-resized', { detail: { ratio } }));
}

// Auto-size panels for optimal game view
function autoSizePanels(preset = 'balanced') {
    const presets = {
        'balanced': 0.5,           // 50/50 split
        'game-focus': 0.35,        // 35% left (bot), 65% right (game)
        'bot-focus': 0.65,         // 65% left (bot), 35% right (game)
        'game-only': 0.15,         // Minimal left panel
        'evony-optimal': 0.4,      // 40% left, 60% right - optimal for Evony game screen
        'wide-game': 0.3,          // 30% left, 70% right - wide game view
        '16:9-game': 0.38,         // Optimized for 16:9 game aspect ratio
        '4:3-game': 0.42           // Optimized for 4:3 game aspect ratio
    };
    
    const ratio = presets[preset] || 0.5;
    setPanelRatio(ratio);
    
    console.log(`[Renderer] Auto-sized panels to ${preset} (${Math.round(ratio * 100)}% / ${Math.round((1 - ratio) * 100)}%)`);
    return ratio;
}

// Tab switching
function switchTab(tabName) {
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
}

// Traffic capture
function startTrafficCapture() {
    state.trafficCapturing = true;
    elements.trafficStart.disabled = true;
    elements.trafficStop.disabled = false;
    elements.trafficStatus.textContent = 'Capturing...';
    elements.trafficStatus.style.color = '#10B981';
    
    ipcRenderer.send('start-traffic-capture');
}

function stopTrafficCapture() {
    state.trafficCapturing = false;
    elements.trafficStart.disabled = false;
    elements.trafficStop.disabled = true;
    elements.trafficStatus.textContent = 'Stopped';
    elements.trafficStatus.style.color = '#F59E0B';
    
    ipcRenderer.send('stop-traffic-capture');
}

function clearTraffic() {
    state.trafficEntries = [];
    elements.trafficTbody.innerHTML = '';
    updateTrafficCount();
}

function exportTraffic() {
    const data = JSON.stringify(state.trafficEntries, null, 2);
    ipcRenderer.send('export-traffic', data);
}

function filterTraffic() {
    const filter = elements.trafficFilter.value.toLowerCase();
    const direction = elements.trafficDirection.value;
    
    const rows = elements.trafficTbody.querySelectorAll('tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const dir = row.dataset.direction;
        
        const matchesFilter = !filter || text.includes(filter);
        const matchesDirection = direction === 'all' || dir === direction;
        
        row.style.display = matchesFilter && matchesDirection ? '' : 'none';
    });
}

function addTrafficEntry(entry) {
    state.trafficEntries.push(entry);
    
    const row = document.createElement('tr');
    row.dataset.direction = entry.direction;
    row.dataset.index = state.trafficEntries.length - 1;
    
    row.innerHTML = `
        <td>${formatTime(entry.timestamp)}</td>
        <td style="color: ${entry.direction === 'request' ? '#3B82F6' : '#10B981'}">
            ${entry.direction === 'request' ? '→' : '←'}
        </td>
        <td>${entry.action || '-'}</td>
        <td>${entry.url || '-'}</td>
        <td>${formatSize(entry.size)}</td>
        <td>${entry.status || '-'}</td>
    `;
    
    row.addEventListener('click', () => selectTrafficEntry(row, entry));
    elements.trafficTbody.appendChild(row);
    updateTrafficCount();
}

function selectTrafficEntry(row, entry) {
    // Remove previous selection
    elements.trafficTbody.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
    
    state.selectedTrafficEntry = entry;
    
    // Update details
    document.getElementById('decoded-content').textContent = entry.decoded || '';
    document.getElementById('raw-content').textContent = entry.raw || '';
    document.getElementById('headers-content').textContent = entry.headers || '';
}

function switchDetailsTab(tabName) {
    document.querySelectorAll('.details-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.details-content').forEach(content => {
        content.classList.toggle('active', content.id === `details-${tabName}`);
    });
}

function updateTrafficCount() {
    elements.trafficCount.textContent = `${state.trafficEntries.length} entries`;
    document.getElementById('traffic-counter').textContent = `Traffic: ${state.trafficEntries.length}`;
}

// Protocol Explorer
function initializeProtocolExplorer() {
    // Load protocol data
    state.protocolData = getProtocolData();
    renderProtocolTree();
}

function getProtocolData() {
    return {
        'City Management': [
            { name: 'getCity', id: 'city.getCity', description: 'Get city information', params: ['cityId'] },
            { name: 'upgradeBuilding', id: 'city.upgradeBuilding', description: 'Upgrade a building', params: ['cityId', 'buildingId'] },
            { name: 'trainTroops', id: 'city.trainTroops', description: 'Train troops in barracks', params: ['cityId', 'troopType', 'amount'] }
        ],
        'Military': [
            { name: 'attackTarget', id: 'military.attack', description: 'Send attack to target', params: ['fromCity', 'toCoords', 'troops'] },
            { name: 'scout', id: 'military.scout', description: 'Scout a location', params: ['fromCity', 'toCoords'] },
            { name: 'reinforce', id: 'military.reinforce', description: 'Send reinforcements', params: ['fromCity', 'toCity', 'troops'] }
        ],
        'Alliance': [
            { name: 'getAlliance', id: 'alliance.get', description: 'Get alliance info', params: ['allianceId'] },
            { name: 'donate', id: 'alliance.donate', description: 'Donate resources', params: ['resourceType', 'amount'] }
        ],
        'Resources': [
            { name: 'getResources', id: 'resource.get', description: 'Get resource levels', params: ['cityId'] },
            { name: 'collectTax', id: 'resource.collectTax', description: 'Collect taxes', params: ['cityId'] }
        ]
    };
}

function renderProtocolTree() {
    const tree = document.getElementById('protocol-tree');
    if (!tree) return;
    
    tree.innerHTML = '';
    
    for (const [category, actions] of Object.entries(state.protocolData)) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'tree-category';
        
        const header = document.createElement('div');
        header.className = 'tree-category-header';
        header.textContent = `📁 ${category}`;
        header.addEventListener('click', () => {
            categoryDiv.classList.toggle('collapsed');
        });
        categoryDiv.appendChild(header);
        
        actions.forEach(action => {
            const item = document.createElement('div');
            item.className = 'tree-item';
            item.textContent = action.name;
            item.addEventListener('click', () => selectProtocolAction(action, category));
            categoryDiv.appendChild(item);
        });
        
        tree.appendChild(categoryDiv);
    }
}

function selectProtocolAction(action, category) {
    // Update selection
    document.querySelectorAll('.tree-item').forEach(item => item.classList.remove('selected'));
    event.target.classList.add('selected');
    
    // Update details
    document.getElementById('protocol-action-name').textContent = action.name;
    document.getElementById('protocol-category').textContent = category;
    document.getElementById('protocol-description').textContent = action.description;
    document.getElementById('protocol-command-id').textContent = action.id;
    
    const paramsDiv = document.getElementById('protocol-params');
    paramsDiv.innerHTML = action.params.map(p => `
        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
            <span style="color: var(--text-primary); font-family: Consolas;">${p}</span>
            <span style="color: var(--secondary); font-family: Consolas;">string</span>
        </div>
    `).join('');
    
    const example = {
        cmd: action.id,
        params: action.params.reduce((acc, p) => ({ ...acc, [p]: `<${p}>` }), {})
    };
    document.getElementById('protocol-example').textContent = JSON.stringify(example, null, 2);
}

function filterProtocol() {
    const filter = document.getElementById('protocol-search').value.toLowerCase();
    
    document.querySelectorAll('.tree-item').forEach(item => {
        const matches = item.textContent.toLowerCase().includes(filter);
        item.style.display = matches ? '' : 'none';
    });
    
    document.querySelectorAll('.tree-category').forEach(cat => {
        const hasVisibleItems = cat.querySelectorAll('.tree-item[style=""]').length > 0 ||
                               cat.querySelectorAll('.tree-item:not([style])').length > 0;
        cat.style.display = hasVisibleItems ? '' : 'none';
    });
}

function copyProtocolToClipboard() {
    const example = document.getElementById('protocol-example').textContent;
    navigator.clipboard.writeText(example);
    updateStatus('Copied to clipboard');
}

function testProtocolInChat() {
    const actionName = document.getElementById('protocol-action-name').textContent;
    elements.chatbotInput.value = `How do I use the ${actionName} command?`;
    switchTab('browser');
    elements.chatbotInput.focus();
}

// Chatbot - Uses real LM Studio connection
async function sendChatMessage() {
    const message = elements.chatbotInput.value.trim();
    if (!message) return;
    
    addChatMessage('user', message);
    elements.chatbotInput.value = '';
    
    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing';
    typingDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    elements.chatbotMessages.appendChild(typingDiv);
    elements.chatbotMessages.scrollTop = elements.chatbotMessages.scrollHeight;
    
    try {
        // Get game context for better responses
        let gameContext = null;
        try {
            gameContext = await ipcRenderer.invoke('game-state-get-summary');
        } catch (e) {
            console.warn('Could not get game context:', e.message);
        }
        
        // Send to LM Studio via chatbot service
        const response = await ipcRenderer.invoke('chatbot-send-message', message, {
            gameState: gameContext,
            selectedProtocol: state.selectedProtocolAction
        });
        
        // Remove typing indicator
        typingDiv.remove();
        
        if (response && response.content) {
            addChatMessage('assistant', response.content);
        } else if (response && response.error) {
            addChatMessage('assistant', `Error: ${response.error}`);
        } else {
            // No response from LM Studio - show connection error
            addChatMessage('assistant', '⚠️ Unable to get response. Please ensure LM Studio is running and connected.\n\nGo to Settings → LLM to configure your LM Studio URL and test the connection.');
        }
    } catch (error) {
        typingDiv.remove();
        console.error('Chatbot error:', error);
        // Show connection error
        addChatMessage('assistant', `⚠️ Connection Error: ${error.message}\n\nPlease ensure LM Studio is running at the configured URL. Go to Settings → LLM to configure and test your connection.`);
    }
}

function addChatMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = `
        <div class="message-content">${content}</div>
        <div class="message-time">${formatTime(Date.now())}</div>
    `;
    elements.chatbotMessages.appendChild(messageDiv);
    elements.chatbotMessages.scrollTop = elements.chatbotMessages.scrollHeight;
}

// generateChatResponse removed - all responses now come from LM Studio
// No mock/fallback responses - users must connect LM Studio for AI features

function handleQuickAction(action) {
    switch (action) {
        case 'protocol':
            switchTab('protocol');
            break;
        case 'decode':
            switchTab('tools');
            document.getElementById('amf-input').focus();
            break;
        case 'training':
            switchTab('tools');
            document.getElementById('troop-type').focus();
            break;
        case 'strategy':
            addChatMessage('user', 'What are some good attack strategies?');
            addChatMessage('assistant', 'Here are some key strategies:\n\n1. Scout before attacking\n2. Use cavalry for fast raids\n3. Cataphracts for heavy assaults\n4. Always check defender\'s wall defenses\n5. Coordinate with alliance members for large targets');
            break;
    }
}

// Tools
function decodeAMF() {
    const input = document.getElementById('amf-input').value;
    const output = document.getElementById('amf-output');
    
    try {
        // Simple hex to string conversion for demo
        // In production, would use proper AMF3 decoder
        const decoded = hexToString(input);
        output.textContent = decoded;
        output.style.color = '#10B981';
    } catch (e) {
        output.textContent = `Error: ${e.message}`;
        output.style.color = '#EF4444';
    }
}

function hexToString(hex) {
    hex = hex.replace(/\s/g, '');
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

function calculateTraining() {
    const troopType = document.getElementById('troop-type').value;
    const amount = parseInt(document.getElementById('troop-amount').value) || 0;
    
    const costs = {
        archer: { food: 50, wood: 100, iron: 0, gold: 10, time: 30 },
        cavalry: { food: 100, wood: 50, iron: 50, gold: 20, time: 60 },
        cataphract: { food: 200, wood: 100, iron: 200, gold: 50, time: 120 },
        warrior: { food: 75, wood: 50, iron: 25, gold: 15, time: 45 },
        scout: { food: 25, wood: 25, iron: 0, gold: 5, time: 15 },
        pikeman: { food: 100, wood: 75, iron: 50, gold: 20, time: 50 },
        swordsman: { food: 100, wood: 50, iron: 100, gold: 25, time: 60 },
        ballista: { food: 150, wood: 300, iron: 100, gold: 30, time: 90 },
        ram: { food: 200, wood: 400, iron: 150, gold: 40, time: 120 },
        catapult: { food: 300, wood: 500, iron: 200, gold: 60, time: 180 }
    };
    
    const cost = costs[troopType];
    const result = document.getElementById('calc-result');
    
    result.innerHTML = `
        <div style="margin-top: 12px; padding: 12px; background: var(--background); border-radius: 4px;">
            <h4 style="margin-bottom: 8px;">Training ${amount.toLocaleString()} ${troopType}s:</h4>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                <div>🍖 Food: ${(cost.food * amount).toLocaleString()}</div>
                <div>🪵 Wood: ${(cost.wood * amount).toLocaleString()}</div>
                <div>⚙️ Iron: ${(cost.iron * amount).toLocaleString()}</div>
                <div>💰 Gold: ${(cost.gold * amount).toLocaleString()}</div>
            </div>
            <div style="margin-top: 8px;">⏱️ Time: ${formatDuration(cost.time * amount)}</div>
        </div>
    `;
}

function reconnectMCP() {
    ipcRenderer.send('reconnect-mcp');
    updateStatus('Reconnecting to MCP servers...');
}

// Settings
function showSettings() {
    elements.settingsOverlay.style.display = 'flex';
}

function hideSettings() {
    elements.settingsOverlay.style.display = 'none';
}

function switchSettingsSection(section) {
    elements.settingsNavBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    
    elements.settingsSections.forEach(sec => {
        sec.classList.toggle('active', sec.id === `settings-${section}`);
    });
}

function loadSettings() {
    const settings = store.getAll();
    
    // Helper to safely set element value
    const setElementValue = (id, value) => {
        const el = document.getElementById(id);
        if (el && value !== undefined) el.value = value;
    };
    
    const setElementChecked = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.checked = value;
    };
    
    // Apply settings to form
    setElementValue('setting-theme', settings.theme);
    if (settings.defaultServer && elements.serverSelector) {
        elements.serverSelector.value = settings.defaultServer;
    }
    setElementValue('setting-autoevony-url', settings.autoevonyUrl);
    setElementValue('setting-autoevony-swf', settings.autoevonySwfPath);
    setElementValue('setting-evony-swf', settings.evonySwfPath);
    setElementValue('setting-mcp-url', settings.mcpUrl);
    
    // Checkboxes
    setElementChecked('setting-autostart', settings.autostart || false);
    setElementChecked('setting-updates', settings.checkUpdates !== false);
    setElementChecked('setting-adblock', settings.adblock !== false);
    setElementChecked('setting-mcp-enabled', settings.mcpEnabled !== false);
    setElementChecked('setting-autopilot', settings.autopilot || false);
    setElementChecked('setting-auto-collect', settings.autoCollect || false);
    setElementChecked('setting-auto-train', settings.autoTrain || false);
    setElementChecked('setting-debug', settings.debug || false);
    
    // LM Studio settings
    setElementChecked('setting-lm-enabled', settings.lmStudioEnabled !== false);
    setElementValue('setting-lm-url', settings.lmStudioUrl || 'http://localhost:1234');
    setElementValue('setting-lm-model', settings.lmStudioModel || 'local-model');
    setElementValue('setting-lm-temperature', settings.lmStudioTemperature || 0.7);
    setElementValue('setting-lm-max-tokens', settings.lmStudioMaxTokens || 2048);
    
    // Update temperature display
    const tempValue = document.getElementById('temperature-value');
    if (tempValue) tempValue.textContent = settings.lmStudioTemperature || 0.7;
    
    // Advanced settings
    setElementValue('setting-log-level', settings.logLevel || 'info');
    setElementValue('setting-proxy', settings.proxy || '');
}

async function saveSettings() {
    // Helper to safely get element value
    const getElementValue = (id, defaultVal = '') => {
        const el = document.getElementById(id);
        return el ? el.value : defaultVal;
    };
    
    const getElementChecked = (id, defaultVal = false) => {
        const el = document.getElementById(id);
        return el ? el.checked : defaultVal;
    };
    
    const settings = {
        theme: getElementValue('setting-theme', 'dark'),
        defaultServer: elements.serverSelector?.value || 'cc2',
        autoevonyUrl: getElementValue('setting-autoevony-url'),
        autoevonySwfPath: getElementValue('setting-autoevony-swf'),
        evonySwfPath: getElementValue('setting-evony-swf'),
        mcpUrl: getElementValue('setting-mcp-url'),
        autostart: getElementChecked('setting-autostart'),
        checkUpdates: getElementChecked('setting-updates', true),
        adblock: getElementChecked('setting-adblock', true),
        mcpEnabled: getElementChecked('setting-mcp-enabled', true),
        autopilot: getElementChecked('setting-autopilot'),
        autoCollect: getElementChecked('setting-auto-collect'),
        autoTrain: getElementChecked('setting-auto-train'),
        debug: getElementChecked('setting-debug'),
        logLevel: getElementValue('setting-log-level', 'info'),
        proxy: getElementValue('setting-proxy'),
        // LM Studio settings (also saved to store for persistence)
        lmStudioEnabled: getElementChecked('setting-lm-enabled', true),
        lmStudioUrl: getElementValue('setting-lm-url', 'http://localhost:1234'),
        lmStudioModel: getElementValue('setting-lm-model', 'local-model'),
        lmStudioTemperature: parseFloat(getElementValue('setting-lm-temperature', '0.7')),
        lmStudioMaxTokens: parseInt(getElementValue('setting-lm-max-tokens', '2048'))
    };
    
    // LM Studio settings for IPC
    const lmStudioSettings = {
        enabled: settings.lmStudioEnabled,
        url: settings.lmStudioUrl,
        model: settings.lmStudioModel,
        temperature: settings.lmStudioTemperature,
        maxTokens: settings.lmStudioMaxTokens
    };
    
    // Save all settings to store
    for (const [key, value] of Object.entries(settings)) {
        store.set(key, value);
    }
    
    // Update LM Studio settings via IPC
    try {
        await ipcRenderer.invoke('lm-studio-update-settings', lmStudioSettings);
        
        // Reconnect with new URL if changed
        if (lmStudioSettings.enabled) {
            const result = await ipcRenderer.invoke('lm-studio-connect', lmStudioSettings.url);
            updateLMStudioStatus(result);
        }
    } catch (error) {
        console.error('Failed to update LM Studio settings:', error);
    }
    
    hideSettings();
    updateStatus('Settings saved');
    
    // Notify main process
    ipcRenderer.send('settings-updated', settings);
}

function resetSettings() {
    store.reset();
    loadSettings();
    updateStatus('Settings reset to defaults');
}

// Side panel
function toggleSidePanel() {
    state.sidePanelCollapsed = !state.sidePanelCollapsed;
    elements.sidePanel.classList.toggle('collapsed', state.sidePanelCollapsed);
    document.getElementById('toggle-side-panel').textContent = state.sidePanelCollapsed ? '▶' : '◀';
}

// Webview events
function setupWebviewEvents(webview, panel) {
    webview.addEventListener('did-start-loading', () => {
        document.getElementById(`${panel}-status`).textContent = 'Loading...';
    });
    
    webview.addEventListener('did-stop-loading', () => {
        document.getElementById(`${panel}-status`).textContent = '';
    });
    
    webview.addEventListener('did-fail-load', (e) => {
        if (e.errorCode !== -3) { // Ignore aborted loads
            document.getElementById(`${panel}-status`).textContent = 'Load failed';
        }
    });
    
    webview.addEventListener('console-message', (e) => {
        if (store.get('debug')) {
            console.log(`[${panel}]`, e.message);
        }
    });
}

// Initialize panels with default URLs
// Note: Use http://www.evony.com for login - site will redirect to game server after login
function initializePanels() {
    const server = store.get('defaultServer') || 'cc2';
    
    // Left panel: Web login page (HTTP required for Flash)
    const leftUrl = store.get('leftPanelUrl') || 'http://www.evony.com';
    
    // Right panel: Game server (HTTP required for Flash)
    const rightUrl = store.get('rightPanelUrl') || `http://${server}.evony.com`;
    
    elements.leftWebview.src = leftUrl;
    elements.rightWebview.src = rightUrl;
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey) {
        switch (e.key) {
            case '1':
                e.preventDefault();
                setPanelView('left');
                break;
            case '2':
                e.preventDefault();
                setPanelView('both');
                break;
            case '3':
                e.preventDefault();
                setPanelView('right');
                break;
            case 's':
                if (!e.shiftKey) {
                    e.preventDefault();
                    swapPanels();
                }
                break;
        }
    }
    
    if (e.key === 'F5') {
        e.preventDefault();
        elements.leftWebview.reload();
    }
    
    if (e.key === 'F6') {
        e.preventDefault();
        elements.rightWebview.reload();
    }
}

// Status bar
function updateStatusBar() {
    updateMemoryUsage();
}

function updateMemoryUsage() {
    if (process.memoryUsage) {
        const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        elements.memoryUsage.textContent = `Memory: ${memory} MB`;
    }
}

function updateStatus(message) {
    elements.statusMessage.textContent = message;
    setTimeout(() => {
        elements.statusMessage.textContent = 'Ready';
    }, 3000);
}

// Utility functions
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
}

function formatSize(bytes) {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

// IPC handlers
ipcRenderer.on('traffic-entry', (event, entry) => {
    addTrafficEntry(entry);
});

ipcRenderer.on('mcp-status', (event, status) => {
    state.mcpConnected = status.connected;
    const indicator = document.getElementById('mcp-status');
    indicator.className = `status-indicator ${status.connected ? 'success' : 'warning'}`;
    indicator.title = `MCP Status: ${status.connected ? 'Connected' : 'Disconnected'}`;
});

// LM Studio status handler
ipcRenderer.on('lm-studio-status', (event, status) => {
    state.lmStudioConnected = status.connected;
    updateLMStudioStatus(status);
});

// Update LM Studio connection status in UI
function updateLMStudioStatus(status) {
    const indicator = document.getElementById('lm-studio-status');
    const statusBar = document.getElementById('connection-indicator');
    const statusText = document.getElementById('connection-status');
    const settingsStatus = document.getElementById('lm-connection-status');
    
    if (indicator) {
        indicator.className = `status-indicator ${status.connected ? 'success' : 'error'}`;
        indicator.title = `LM Studio: ${status.connected ? 'Connected' : 'Disconnected'}${status.url ? ' (' + status.url + ')' : ''}`;
    }
    
    if (statusBar && statusText) {
        statusBar.className = `indicator ${status.connected ? 'connected' : 'disconnected'}`;
        statusText.textContent = status.connected ? 'Connected' : 'Disconnected';
    }
    
    if (settingsStatus) {
        settingsStatus.className = `status-badge ${status.connected ? 'connected' : 'disconnected'}`;
        settingsStatus.textContent = status.connected ? 'Connected' : 'Disconnected';
    }
    
    // Update model dropdown if models available
    if (status.models && status.models.length > 0) {
        const modelSelect = document.getElementById('setting-lm-model');
        if (modelSelect) {
            modelSelect.innerHTML = '';
            status.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
        }
    }
}

// Initialize LM Studio connection on startup
async function initLMStudioConnection() {
    try {
        const settings = await ipcRenderer.invoke('get-settings');
        const lmSettings = settings.lmStudio || {};
        
        // Set UI values from settings
        const urlInput = document.getElementById('setting-lm-url');
        const enabledCheckbox = document.getElementById('setting-lm-enabled');
        const temperatureSlider = document.getElementById('setting-lm-temperature');
        const maxTokensInput = document.getElementById('setting-lm-max-tokens');
        
        if (urlInput) urlInput.value = lmSettings.url || 'http://localhost:1234';
        if (enabledCheckbox) enabledCheckbox.checked = lmSettings.enabled !== false;
        if (temperatureSlider) {
            temperatureSlider.value = lmSettings.temperature || 0.7;
            const tempValue = document.getElementById('temperature-value');
            if (tempValue) tempValue.textContent = temperatureSlider.value;
        }
        if (maxTokensInput) maxTokensInput.value = lmSettings.maxTokens || 2048;
        
        // Check connection status
        const status = await ipcRenderer.invoke('lm-studio-status');
        updateLMStudioStatus(status);
        
        // If not connected and enabled, try to connect
        if (!status.connected && lmSettings.enabled !== false) {
            const connectResult = await ipcRenderer.invoke('lm-studio-connect', lmSettings.url);
            updateLMStudioStatus(connectResult);
        }
    } catch (error) {
        console.error('Failed to initialize LM Studio connection:', error);
    }
}

// Test LM Studio connection button handler
async function testLMStudioConnection() {
    const urlInput = document.getElementById('setting-lm-url');
    const url = urlInput ? urlInput.value : 'http://localhost:1234';
    
    updateStatus('Testing LM Studio connection...');
    
    try {
        const result = await ipcRenderer.invoke('lm-studio-connect', url);
        updateLMStudioStatus(result);
        
        if (result.connected) {
            updateStatus(`Connected to LM Studio! Models: ${result.models.join(', ')}`);
        } else {
            updateStatus(`Failed to connect: ${result.error || 'Unknown error'}`);
        }
    } catch (error) {
        updateStatus(`Connection error: ${error.message}`);
    }
}

// Refresh models button handler
async function refreshLMStudioModels() {
    try {
        const models = await ipcRenderer.invoke('lm-studio-models');
        const modelSelect = document.getElementById('setting-lm-model');
        
        if (modelSelect && models.length > 0) {
            modelSelect.innerHTML = '';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                modelSelect.appendChild(option);
            });
            updateStatus(`Found ${models.length} models`);
        } else {
            updateStatus('No models found - is LM Studio running?');
        }
    } catch (error) {
        updateStatus(`Error fetching models: ${error.message}`);
    }
}

ipcRenderer.on('window-maximized', () => {
    document.body.classList.add('maximized');
});

ipcRenderer.on('window-unmaximized', () => {
    document.body.classList.remove('maximized');
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);


// ============================================================================
// Combat Simulator
// ============================================================================

async function initializeCombatSimulator() {
    const simulateBtn = document.getElementById('simulate-combat');
    if (simulateBtn) {
        simulateBtn.addEventListener('click', runCombatSimulation);
    }
}

function getArmyFromInputs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return {};
    
    const troops = {};
    container.querySelectorAll('input[data-troop]').forEach(input => {
        const troopType = input.dataset.troop;
        const count = parseInt(input.value) || 0;
        if (count > 0) {
            troops[troopType] = count;
        }
    });
    return troops;
}

async function runCombatSimulation() {
    const attacker = {
        troops: getArmyFromInputs('attacker-troops'),
        heroAttack: parseInt(document.getElementById('attacker-hero-attack')?.value) || 100
    };
    
    const defender = {
        troops: getArmyFromInputs('defender-troops'),
        heroDefense: parseInt(document.getElementById('defender-hero-defense')?.value) || 100
    };
    
    const options = {
        wallDefense: document.getElementById('combat-wall')?.checked || false,
        traps: document.getElementById('combat-traps')?.checked || false,
        abatis: document.getElementById('combat-abatis')?.checked || false
    };
    
    const resultsDiv = document.getElementById('combat-results');
    resultsDiv.innerHTML = '<div class="loading">Simulating combat...</div>';
    
    try {
        const result = await ipcRenderer.invoke('combat-simulate', attacker, defender, options);
        displayCombatResults(result);
    } catch (error) {
        resultsDiv.innerHTML = `<div class="error">Simulation error: ${error.message}</div>`;
    }
}

function displayCombatResults(result) {
    const resultsDiv = document.getElementById('combat-results');
    
    if (!result || result.error) {
        resultsDiv.innerHTML = `<div class="error">${result?.error || 'Simulation failed'}</div>`;
        return;
    }
    
    const winnerClass = result.winner === 'attacker' ? 'success' : 'danger';
    
    resultsDiv.innerHTML = `
        <div class="combat-result-header ${winnerClass}">
            <h4>${result.winner === 'attacker' ? '⚔️ Attacker Wins!' : '🛡️ Defender Wins!'}</h4>
        </div>
        <div class="combat-result-grid">
            <div class="result-column">
                <h5>Attacker Losses</h5>
                ${formatTroopLosses(result.attackerLosses)}
                <div class="loss-percentage">Loss Rate: ${(result.attackerLossRate * 100).toFixed(1)}%</div>
            </div>
            <div class="result-column">
                <h5>Defender Losses</h5>
                ${formatTroopLosses(result.defenderLosses)}
                <div class="loss-percentage">Loss Rate: ${(result.defenderLossRate * 100).toFixed(1)}%</div>
            </div>
        </div>
        <div class="combat-rounds">
            <h5>Combat Rounds: ${result.rounds}</h5>
        </div>
    `;
}

function formatTroopLosses(losses) {
    if (!losses || Object.keys(losses).length === 0) {
        return '<div class="no-losses">No losses</div>';
    }
    
    return Object.entries(losses)
        .filter(([_, count]) => count > 0)
        .map(([troop, count]) => `<div class="loss-item">${troop}: ${count.toLocaleString()}</div>`)
        .join('');
}

// ============================================================================
// Session Recorder
// ============================================================================

let recorderInterval = null;
let recorderStartTime = null;

async function initializeSessionRecorder() {
    const startBtn = document.getElementById('recorder-start');
    const stopBtn = document.getElementById('recorder-stop');
    const pauseBtn = document.getElementById('recorder-pause');
    
    if (startBtn) startBtn.addEventListener('click', startRecording);
    if (stopBtn) stopBtn.addEventListener('click', stopRecording);
    if (pauseBtn) pauseBtn.addEventListener('click', togglePauseRecording);
    
    // Load saved sessions
    await loadSessionList();
}

async function startRecording() {
    try {
        const result = await ipcRenderer.invoke('session-start-recording', {
            name: `Session ${new Date().toLocaleString()}`,
            server: store.get('defaultServer') || 'cc2'
        });
        
        if (result && !result.error) {
            recorderStartTime = Date.now();
            updateRecorderUI(true);
            startRecorderTimer();
            updateStatus('Recording started');
        }
    } catch (error) {
        console.error('Failed to start recording:', error);
        updateStatus('Failed to start recording');
    }
}

async function stopRecording() {
    try {
        const result = await ipcRenderer.invoke('session-stop-recording');
        
        updateRecorderUI(false);
        stopRecorderTimer();
        
        if (result) {
            updateStatus(`Recording saved: ${result.packetCount} packets`);
            await loadSessionList();
        }
    } catch (error) {
        console.error('Failed to stop recording:', error);
    }
}

async function togglePauseRecording() {
    const pauseBtn = document.getElementById('recorder-pause');
    const isPaused = pauseBtn.textContent.includes('Resume');
    
    try {
        if (isPaused) {
            await ipcRenderer.invoke('session-resume-recording');
            pauseBtn.textContent = '⏸ Pause';
            startRecorderTimer();
        } else {
            await ipcRenderer.invoke('session-pause-recording');
            pauseBtn.textContent = '▶ Resume';
            stopRecorderTimer();
        }
    } catch (error) {
        console.error('Failed to toggle pause:', error);
    }
}

function updateRecorderUI(isRecording) {
    const startBtn = document.getElementById('recorder-start');
    const stopBtn = document.getElementById('recorder-stop');
    const pauseBtn = document.getElementById('recorder-pause');
    const stateSpan = document.getElementById('recorder-state');
    
    if (startBtn) startBtn.disabled = isRecording;
    if (stopBtn) stopBtn.disabled = !isRecording;
    if (pauseBtn) pauseBtn.disabled = !isRecording;
    if (stateSpan) stateSpan.textContent = isRecording ? 'Recording' : 'Idle';
    if (stateSpan) stateSpan.className = isRecording ? 'recording' : '';
}

function startRecorderTimer() {
    stopRecorderTimer();
    recorderInterval = setInterval(updateRecorderDuration, 1000);
}

function stopRecorderTimer() {
    if (recorderInterval) {
        clearInterval(recorderInterval);
        recorderInterval = null;
    }
}

function updateRecorderDuration() {
    if (!recorderStartTime) return;
    
    const elapsed = Math.floor((Date.now() - recorderStartTime) / 1000);
    const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    
    const durationSpan = document.getElementById('recorder-duration');
    if (durationSpan) {
        durationSpan.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

async function loadSessionList() {
    try {
        const sessions = await ipcRenderer.invoke('session-get-list');
        const container = document.getElementById('sessions-container');
        
        if (!container) return;
        
        if (!sessions || sessions.length === 0) {
            container.innerHTML = '<div class="no-sessions">No saved sessions</div>';
            return;
        }
        
        container.innerHTML = sessions.map(session => `
            <div class="session-item" data-id="${session.id}">
                <div class="session-info">
                    <span class="session-name">${session.name || session.id}</span>
                    <span class="session-date">${new Date(session.startTime).toLocaleString()}</span>
                    <span class="session-packets">${session.packetCount} packets</span>
                </div>
                <div class="session-actions">
                    <button class="btn-small" onclick="loadSession('${session.id}')">Load</button>
                    <button class="btn-small" onclick="exportSession('${session.id}')">Export</button>
                    <button class="btn-small danger" onclick="deleteSession('${session.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load sessions:', error);
    }
}

async function loadSession(sessionId) {
    try {
        const session = await ipcRenderer.invoke('session-load', sessionId);
        if (session) {
            updateStatus(`Loaded session: ${session.packets?.length || 0} packets`);
            // Display session data in traffic viewer
            if (session.packets) {
                session.packets.forEach(packet => addTrafficEntry(packet));
            }
        }
    } catch (error) {
        console.error('Failed to load session:', error);
    }
}

async function exportSession(sessionId) {
    try {
        const result = await ipcRenderer.invoke('show-save-dialog', {
            title: 'Export Session',
            defaultPath: `session-${sessionId}.json`,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled && result.filePath) {
            await ipcRenderer.invoke('session-export', sessionId, 'json', result.filePath);
            updateStatus('Session exported');
        }
    } catch (error) {
        console.error('Failed to export session:', error);
    }
}

async function deleteSession(sessionId) {
    if (confirm('Are you sure you want to delete this session?')) {
        try {
            await ipcRenderer.invoke('session-delete', sessionId);
            await loadSessionList();
            updateStatus('Session deleted');
        } catch (error) {
            console.error('Failed to delete session:', error);
        }
    }
}

// ============================================================================
// Game State
// ============================================================================

async function initializeGameState() {
    const refreshBtn = document.getElementById('refresh-game-state');
    const exportBtn = document.getElementById('export-game-state');
    
    if (refreshBtn) refreshBtn.addEventListener('click', refreshGameState);
    if (exportBtn) exportBtn.addEventListener('click', exportGameState);
    
    // Initial load
    await refreshGameState();
}

async function refreshGameState() {
    try {
        const summary = await ipcRenderer.invoke('game-state-get-summary');
        
        if (summary) {
            document.getElementById('state-player').textContent = summary.playerName || 'Not logged in';
            document.getElementById('state-cities').textContent = summary.cityCount || 0;
            document.getElementById('state-heroes').textContent = summary.heroCount || 0;
            document.getElementById('state-marches').textContent = summary.activeMarches || 0;
        }
    } catch (error) {
        console.error('Failed to refresh game state:', error);
    }
}

async function exportGameState() {
    try {
        const result = await ipcRenderer.invoke('show-save-dialog', {
            title: 'Export Game State',
            defaultPath: `game-state-${Date.now()}.json`,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled && result.filePath) {
            await ipcRenderer.invoke('game-state-export', result.filePath);
            updateStatus('Game state exported');
        }
    } catch (error) {
        console.error('Failed to export game state:', error);
    }
}

// ============================================================================
// Enhanced Protocol Explorer with IPC
// ============================================================================

async function initializeProtocolExplorerEnhanced() {
    try {
        const categories = await ipcRenderer.invoke('protocol-get-categories');
        const tree = document.getElementById('protocol-tree');
        
        if (!tree || !categories) return;
        
        tree.innerHTML = '';
        
        for (const category of categories) {
            const actions = await ipcRenderer.invoke('protocol-get-by-category', category);
            
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'tree-category';
            categoryDiv.innerHTML = `<div class="category-header">${category}</div>`;
            
            const itemsDiv = document.createElement('div');
            itemsDiv.className = 'category-items';
            
            actions.forEach(action => {
                const item = document.createElement('div');
                item.className = 'tree-item';
                item.textContent = action.name;
                item.addEventListener('click', () => selectProtocolActionEnhanced(action));
                itemsDiv.appendChild(item);
            });
            
            categoryDiv.appendChild(itemsDiv);
            tree.appendChild(categoryDiv);
        }
        
        const stats = await ipcRenderer.invoke('protocol-get-stats');
        console.log(`[Protocol] Loaded ${stats.totalActions} actions in ${stats.categories} categories`);
    } catch (error) {
        console.error('Failed to initialize protocol explorer:', error);
    }
}

function selectProtocolActionEnhanced(action) {
    // Update selection
    document.querySelectorAll('.tree-item').forEach(item => item.classList.remove('selected'));
    event.target.classList.add('selected');
    
    // Update details
    document.getElementById('protocol-action-name').textContent = action.name;
    document.getElementById('protocol-category').textContent = action.category;
    document.getElementById('protocol-description').textContent = action.description;
    document.getElementById('protocol-command-id').textContent = action.commandId;
    
    const paramsDiv = document.getElementById('protocol-params');
    if (action.request && Object.keys(action.request).length > 0) {
        paramsDiv.innerHTML = Object.entries(action.request).map(([name, type]) => `
            <div class="param-row">
                <span class="param-name">${name}</span>
                <span class="param-type">${type}</span>
            </div>
        `).join('');
    } else {
        paramsDiv.innerHTML = '<div class="no-params">No parameters</div>';
    }
    
    const example = {
        action: action.name,
        ...Object.fromEntries(
            Object.entries(action.request || {}).map(([key, type]) => [key, getExampleValue(type)])
        )
    };
    document.getElementById('protocol-example').textContent = JSON.stringify(example, null, 2);
    
    // Store selected action for copy/test
    state.selectedProtocolAction = action;
}

function getExampleValue(type) {
    switch (type) {
        case 'int':
        case 'long':
            return 0;
        case 'string':
            return '';
        case 'boolean':
            return false;
        case 'object':
            return {};
        case 'array':
            return [];
        default:
            return null;
    }
}

// ============================================================================
// Enhanced Chatbot with IPC
// ============================================================================

async function sendChatMessageEnhanced() {
    const message = elements.chatbotInput.value.trim();
    if (!message) return;
    
    addChatMessage('user', message);
    elements.chatbotInput.value = '';
    
    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing';
    typingDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    elements.chatbotMessages.appendChild(typingDiv);
    elements.chatbotMessages.scrollTop = elements.chatbotMessages.scrollHeight;
    
    try {
        // Get game context
        const gameContext = await ipcRenderer.invoke('game-state-get-summary');
        
        const response = await ipcRenderer.invoke('chatbot-send-message', message, {
            gameState: gameContext,
            selectedProtocol: state.selectedProtocolAction
        });
        
        // Remove typing indicator
        typingDiv.remove();
        
        if (response && response.content) {
            addChatMessage('assistant', response.content);
        } else if (response && response.error) {
            addChatMessage('assistant', `Error: ${response.error}`);
        } else {
            // No response from LM Studio
            addChatMessage('assistant', '⚠️ Unable to get response. Please ensure LM Studio is running and connected.');
        }
    } catch (error) {
        typingDiv.remove();
        addChatMessage('assistant', `⚠️ Connection Error: ${error.message}\n\nPlease configure LM Studio in Settings → LLM.`);
    }
}

// ============================================================================
// Enhanced AMF Decoder with IPC
// ============================================================================

async function decodeAMFEnhanced() {
    const input = document.getElementById('amf-input').value.trim();
    const output = document.getElementById('amf-output');
    
    if (!input) {
        output.textContent = 'Please enter hex data to decode';
        output.style.color = '#F59E0B';
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('protocol-decode', input);
        
        if (result && !result.error) {
            output.textContent = JSON.stringify(result.data, null, 2);
            output.style.color = '#10B981';
            
            if (result.action) {
                output.textContent = `Action: ${result.action}\n\n${output.textContent}`;
            }
        } else {
            output.textContent = `Error: ${result?.error || 'Decode failed'}`;
            output.style.color = '#EF4444';
        }
    } catch (error) {
        output.textContent = `Error: ${error.message}`;
        output.style.color = '#EF4444';
    }
}

// ============================================================================
// IPC Event Handlers
// ============================================================================

ipcRenderer.on('packet-captured', (event, packet) => {
    addTrafficEntry(packet);
    
    // Update packet counter in recorder
    const packetsSpan = document.getElementById('recorder-packets');
    if (packetsSpan && state.trafficCapturing) {
        packetsSpan.textContent = `${state.trafficEntries.length} packets`;
    }
});

ipcRenderer.on('game-state-changed', (event, data) => {
    refreshGameState();
});

ipcRenderer.on('player-logged-in', (event, player) => {
    updateStatus(`Logged in as ${player.name}`);
    refreshGameState();
});

ipcRenderer.on('recording-started', (event, session) => {
    updateRecorderUI(true);
    recorderStartTime = Date.now();
    startRecorderTimer();
});

ipcRenderer.on('recording-stopped', (event, session) => {
    updateRecorderUI(false);
    stopRecorderTimer();
    loadSessionList();
});

ipcRenderer.on('pattern-detected', (event, data) => {
    console.log('[Pattern Detected]', data);
    updateStatus(`Pattern detected: ${data.patternId}`);
});

ipcRenderer.on('chatbot-message', (event, message) => {
    addChatMessage(message.role, message.content);
});

ipcRenderer.on('proxy-status-changed', (event, status) => {
    const indicator = document.getElementById('proxy-status');
    if (indicator) {
        indicator.className = `status-indicator ${status.running ? 'success' : 'inactive'}`;
        indicator.title = `Proxy: ${status.running ? 'Active' : 'Inactive'}`;
    }
});

ipcRenderer.on('toggle-chatbot', () => {
    toggleSidePanel();
});

ipcRenderer.on('toggle-traffic', () => {
    switchTab('traffic');
});

ipcRenderer.on('toggle-protocol', () => {
    switchTab('protocol');
});

ipcRenderer.on('start-capture', () => {
    startTrafficCapture();
});

ipcRenderer.on('stop-capture', () => {
    stopTrafficCapture();
});

ipcRenderer.on('clear-capture', () => {
    clearTraffic();
});

ipcRenderer.on('start-recording', () => {
    startRecording();
});

ipcRenderer.on('stop-recording', () => {
    stopRecording();
});

ipcRenderer.on('open-combat-simulator', () => {
    switchTab('tools');
    document.getElementById('simulate-combat')?.scrollIntoView({ behavior: 'smooth' });
});

ipcRenderer.on('open-training-calculator', () => {
    switchTab('tools');
    document.getElementById('calc-training')?.scrollIntoView({ behavior: 'smooth' });
});

ipcRenderer.on('set-view', (event, view) => {
    setPanelView(view);
});

ipcRenderer.on('switch-tab', (event, tab) => {
    switchTab(tab);
});

ipcRenderer.on('new-tab', () => {
    // Handle new tab creation
    console.log('New tab requested');
});

ipcRenderer.on('close-tab', () => {
    // Handle tab close
    console.log('Close tab requested');
});

ipcRenderer.on('zoom-in', () => {
    const webview = document.activeElement.closest('webview') || elements.leftWebview;
    webview.setZoomFactor(webview.getZoomFactor() + 0.1);
});

ipcRenderer.on('zoom-out', () => {
    const webview = document.activeElement.closest('webview') || elements.leftWebview;
    webview.setZoomFactor(webview.getZoomFactor() - 0.1);
});

ipcRenderer.on('zoom-reset', () => {
    elements.leftWebview.setZoomFactor(1);
    elements.rightWebview.setZoomFactor(1);
});

// Note: Enhanced initialization is now merged into main init() function


// ============================================================================
// Hex View Implementation
// ============================================================================

function formatHexView(data) {
    if (!data) return '';
    
    // Convert base64 or hex string to bytes
    let bytes;
    if (typeof data === 'string') {
        if (data.match(/^[0-9a-fA-F]+$/)) {
            // Hex string
            bytes = hexToBytes(data);
        } else {
            // Assume base64
            try {
                const binary = atob(data);
                bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
            } catch (e) {
                return 'Invalid data format';
            }
        }
    } else if (data instanceof Uint8Array) {
        bytes = data;
    } else {
        return 'Unsupported data type';
    }
    
    const lines = [];
    const bytesPerLine = 16;
    
    for (let offset = 0; offset < bytes.length; offset += bytesPerLine) {
        const lineBytes = bytes.slice(offset, offset + bytesPerLine);
        
        // Offset column
        const offsetStr = offset.toString(16).padStart(8, '0').toUpperCase();
        
        // Hex bytes column
        let hexStr = '';
        for (let i = 0; i < bytesPerLine; i++) {
            if (i < lineBytes.length) {
                hexStr += lineBytes[i].toString(16).padStart(2, '0').toUpperCase();
            } else {
                hexStr += '  ';
            }
            hexStr += ' ';
            if (i === 7) hexStr += ' '; // Extra space in middle
        }
        
        // ASCII column
        let asciiStr = '';
        for (let i = 0; i < lineBytes.length; i++) {
            const byte = lineBytes[i];
            if (byte >= 32 && byte <= 126) {
                asciiStr += String.fromCharCode(byte);
            } else {
                asciiStr += '.';
            }
        }
        
        lines.push(`<div class="hex-row">` +
            `<span class="hex-offset">${offsetStr}</span>` +
            `<span class="hex-bytes">${hexStr}</span>` +
            `<span class="hex-ascii">${asciiStr}</span>` +
            `</div>`);
    }
    
    return `<div class="hex-view-container">${lines.join('')}</div>`;
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Update raw hex display when traffic entry is selected
function displayRawHex(entry) {
    const rawContent = document.getElementById('raw-content');
    if (!rawContent) return;
    
    if (entry.body) {
        rawContent.innerHTML = formatHexView(entry.body);
    } else {
        rawContent.innerHTML = '<div class="no-data">No raw data available</div>';
    }
}

// ============================================================================
// File Upload for Chatbot
// ============================================================================

const chatbotAttachments = [];

function initializeChatbotFileUpload() {
    const attachBtn = document.getElementById('chatbot-attach');
    const fileInput = document.getElementById('chatbot-file-input');
    const attachmentsContainer = document.getElementById('chatbot-attachments');
    
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => addChatbotAttachment(file));
            fileInput.value = ''; // Reset for next selection
        });
    }
}

async function addChatbotAttachment(file) {
    const container = document.getElementById('chatbot-attachments');
    if (!container) return;
    
    // Read file content
    const content = await readFileAsText(file);
    
    const attachment = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type || getFileType(file.name),
        size: file.size,
        content: content
    };
    
    chatbotAttachments.push(attachment);
    
    // Create attachment UI element
    const item = document.createElement('div');
    item.className = 'attachment-item';
    item.dataset.id = attachment.id;
    item.innerHTML = `
        <span class="file-icon">${getFileIcon(attachment.type)}</span>
        <span class="filename">${attachment.name}</span>
        <span class="filesize">(${formatSize(attachment.size)})</span>
        <button class="remove-attachment" title="Remove">×</button>
    `;
    
    item.querySelector('.remove-attachment').addEventListener('click', () => {
        removeChatbotAttachment(attachment.id);
    });
    
    container.appendChild(item);
}

function removeChatbotAttachment(id) {
    const index = chatbotAttachments.findIndex(a => a.id === id);
    if (index > -1) {
        chatbotAttachments.splice(index, 1);
    }
    
    const item = document.querySelector(`.attachment-item[data-id="${id}"]`);
    if (item) {
        item.remove();
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
        'json': 'application/json',
        'txt': 'text/plain',
        'log': 'text/plain',
        'xml': 'application/xml',
        'amf': 'application/x-amf',
        'swf': 'application/x-shockwave-flash'
    };
    return types[ext] || 'application/octet-stream';
}

function getFileIcon(type) {
    if (type.includes('json')) return '📋';
    if (type.includes('xml')) return '📄';
    if (type.includes('amf')) return '📦';
    if (type.includes('swf')) return '⚡';
    if (type.includes('text')) return '📝';
    return '📎';
}

// Enhanced send message with attachments
async function sendChatMessageWithAttachments() {
    const message = elements.chatbotInput.value.trim();
    if (!message && chatbotAttachments.length === 0) return;
    
    // Build message with attachments
    let fullMessage = message;
    if (chatbotAttachments.length > 0) {
        fullMessage += '\n\n[Attachments]\n';
        chatbotAttachments.forEach(att => {
            fullMessage += `\n--- ${att.name} ---\n${att.content}\n`;
        });
    }
    
    addChatMessage('user', message, chatbotAttachments.map(a => a.name));
    elements.chatbotInput.value = '';
    
    // Clear attachments
    chatbotAttachments.length = 0;
    const container = document.getElementById('chatbot-attachments');
    if (container) container.innerHTML = '';
    
    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing';
    typingDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    elements.chatbotMessages.appendChild(typingDiv);
    elements.chatbotMessages.scrollTop = elements.chatbotMessages.scrollHeight;
    
    try {
        const gameContext = await ipcRenderer.invoke('game-state-get-summary');
        
        const response = await ipcRenderer.invoke('chatbot-send-message', fullMessage, {
            gameState: gameContext,
            selectedProtocol: state.selectedProtocolAction
        });
        
        typingDiv.remove();
        
        if (response && response.content) {
            addChatMessage('assistant', response.content);
        } else if (response && response.error) {
            addChatMessage('assistant', `Error: ${response.error}`);
        } else {
            addChatMessage('assistant', '⚠️ Unable to get response. Please ensure LM Studio is running and connected.');
        }
    } catch (error) {
        typingDiv.remove();
        addChatMessage('assistant', `⚠️ Connection Error: ${error.message}\n\nPlease configure LM Studio in Settings → LLM.`);
    }
}

// ============================================================================
// Packet Rate Monitor
// ============================================================================

let packetRateCounter = 0;
let lastPacketRateUpdate = Date.now();

function updatePacketRate() {
    const now = Date.now();
    const elapsed = (now - lastPacketRateUpdate) / 1000;
    
    if (elapsed >= 1) {
        const rate = Math.round(packetRateCounter / elapsed);
        const rateElement = document.getElementById('packet-rate');
        
        if (rateElement) {
            rateElement.textContent = `${rate} p/s`;
            rateElement.classList.remove('high', 'very-high');
            
            if (rate > 100) {
                rateElement.classList.add('very-high');
            } else if (rate > 50) {
                rateElement.classList.add('high');
            }
        }
        
        packetRateCounter = 0;
        lastPacketRateUpdate = now;
    }
}

function incrementPacketRate() {
    packetRateCounter++;
}

// Start packet rate monitoring
setInterval(updatePacketRate, 1000);

// ============================================================================
// Recording Indicator
// ============================================================================

function updateRecordingIndicator(isRecording) {
    const indicator = document.getElementById('recording-indicator');
    if (indicator) {
        indicator.classList.toggle('hidden', !isRecording);
    }
}

// Hook into recording state changes
ipcRenderer.on('recording-started', () => {
    updateRecordingIndicator(true);
});

ipcRenderer.on('recording-stopped', () => {
    updateRecordingIndicator(false);
});

// ============================================================================
// Enhanced Traffic Entry with Hex View
// ============================================================================

function addTrafficEntryEnhanced(entry) {
    incrementPacketRate();
    
    state.trafficEntries.push(entry);
    
    const row = document.createElement('tr');
    row.className = entry.type === 'request' ? 'request-row' : 'response-row';
    row.dataset.index = state.trafficEntries.length - 1;
    
    row.innerHTML = `
        <td>${formatTime(entry.timestamp)}</td>
        <td>${entry.type === 'request' ? '→' : '←'}</td>
        <td class="action-cell">${entry.action || 'unknown'}</td>
        <td class="url-cell" title="${entry.url || ''}">${truncateUrl(entry.url)}</td>
        <td>${formatSize(entry.size || entry.contentLength)}</td>
        <td class="status-${entry.statusCode || 200}">${entry.statusCode || '-'}</td>
    `;
    
    row.addEventListener('click', () => selectTrafficEntry(entry, row));
    
    elements.trafficTbody.appendChild(row);
    updateTrafficCount();
    
    // Auto-scroll if at bottom
    const list = document.getElementById('traffic-list');
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 50) {
        list.scrollTop = list.scrollHeight;
    }
}

function selectTrafficEntry(entry, row) {
    // Update selection
    document.querySelectorAll('#traffic-tbody tr').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
    
    state.selectedTrafficEntry = entry;
    
    // Update decoded view
    const decodedContent = document.getElementById('decoded-content');
    if (decodedContent) {
        if (entry.decoded) {
            decodedContent.textContent = JSON.stringify(entry.decoded, null, 2);
        } else {
            decodedContent.textContent = 'Decoding...';
            // Request decode from main process
            ipcRenderer.invoke('protocol-decode', entry.body).then(result => {
                if (result && !result.error) {
                    entry.decoded = result.data;
                    decodedContent.textContent = JSON.stringify(result.data, null, 2);
                } else {
                    decodedContent.textContent = 'Failed to decode';
                }
            });
        }
    }
    
    // Update raw hex view
    displayRawHex(entry);
    
    // Update headers view
    const headersContent = document.getElementById('headers-content');
    if (headersContent && entry.headers) {
        headersContent.textContent = JSON.stringify(entry.headers, null, 2);
    }
}

function truncateUrl(url) {
    if (!url) return '-';
    if (url.length > 50) {
        return url.substring(0, 47) + '...';
    }
    return url;
}

// ============================================================================
// Syntax Highlighting for Code Blocks
// ============================================================================

function highlightSyntax(code, language) {
    if (language === 'json') {
        return code
            .replace(/"([^"]+)":/g, '<span class="property">"$1"</span>:')
            .replace(/: "([^"]+)"/g, ': <span class="string">"$1"</span>')
            .replace(/: (\d+)/g, ': <span class="number">$1</span>')
            .replace(/: (true|false)/g, ': <span class="keyword">$1</span>')
            .replace(/: (null)/g, ': <span class="keyword">$1</span>');
    }
    return code;
}

function addChatMessage(role, content, attachments = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    // Format content with code blocks
    let formattedContent = content;
    
    // Handle code blocks
    formattedContent = formattedContent.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const highlighted = highlightSyntax(code.trim(), lang || 'text');
        return `<pre><code class="language-${lang || 'text'}">${highlighted}</code></pre>`;
    });
    
    // Handle inline code
    formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Handle line breaks
    formattedContent = formattedContent.replace(/\n/g, '<br>');
    
    let attachmentHtml = '';
    if (attachments.length > 0) {
        attachmentHtml = `<div class="message-attachments">${attachments.map(a => `<span class="attachment-badge">📎 ${a}</span>`).join('')}</div>`;
    }
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-content">
            ${attachmentHtml}
            <div class="message-text">${formattedContent}</div>
        </div>
    `;
    
    elements.chatbotMessages.appendChild(messageDiv);
    elements.chatbotMessages.scrollTop = elements.chatbotMessages.scrollHeight;
}

// ============================================================================
// Initialize All Enhanced Features
// ============================================================================

function initializeEnhancedFeatures() {
    initializeChatbotFileUpload();
    initializeCombatSimulator();
    initializeSessionRecorder();
    initializeGameState();
    
    // Replace default send with enhanced version
    elements.chatbotSend.removeEventListener('click', sendChatMessage);
    elements.chatbotSend.addEventListener('click', sendChatMessageWithAttachments);
    
    elements.chatbotInput.removeEventListener('keydown', handleChatKeydown);
    elements.chatbotInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessageWithAttachments();
        }
    });
    
    // Use enhanced traffic entry handler
    ipcRenderer.removeAllListeners('traffic-entry');
    ipcRenderer.on('traffic-entry', (event, entry) => {
        addTrafficEntryEnhanced(entry);
    });
    
    ipcRenderer.removeAllListeners('packet-captured');
    ipcRenderer.on('packet-captured', (event, packet) => {
        addTrafficEntryEnhanced(packet);
    });
}

// Call enhanced initialization after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeEnhancedFeatures, 100);
});


// ============================================================================
// Traffic Viewer Enhanced Features - Breakpoints, Compare, Inject
// ============================================================================

const breakpoints = [];
const selectedForCompare = [];

function initializeTrafficEnhancements() {
    // Action filter
    const actionFilter = document.getElementById('traffic-action-filter');
    if (actionFilter) {
        actionFilter.addEventListener('change', filterTrafficByAction);
    }
    
    // Auto-scroll toggle
    const autoScroll = document.getElementById('traffic-autoscroll');
    if (autoScroll) {
        autoScroll.addEventListener('change', (e) => {
            state.autoScrollTraffic = e.target.checked;
        });
        state.autoScrollTraffic = autoScroll.checked;
    }
    
    // Record button
    const recordBtn = document.getElementById('traffic-record');
    if (recordBtn) {
        recordBtn.addEventListener('click', toggleTrafficRecording);
    }
    
    // Replay button
    const replayBtn = document.getElementById('traffic-replay');
    if (replayBtn) {
        replayBtn.addEventListener('click', replayRecordedSession);
    }
    
    // Inject button
    const injectBtn = document.getElementById('traffic-inject');
    if (injectBtn) {
        injectBtn.addEventListener('click', showInjectModal);
    }
    
    // Breakpoint controls
    const addBreakpointBtn = document.getElementById('add-breakpoint');
    if (addBreakpointBtn) {
        addBreakpointBtn.addEventListener('click', showAddBreakpointDialog);
    }
    
    const clearBreakpointsBtn = document.getElementById('clear-breakpoints');
    if (clearBreakpointsBtn) {
        clearBreakpointsBtn.addEventListener('click', clearAllBreakpoints);
    }
    
    // Compare button
    const compareBtn = document.getElementById('compare-packets');
    if (compareBtn) {
        compareBtn.addEventListener('click', compareSelectedPackets);
    }
    
    // Details tabs
    const detailsTabs = document.querySelectorAll('.details-tab');
    detailsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            detailsTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.details-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(`details-${tabName}`);
            if (content) content.classList.add('active');
        });
    });
    
    // Protocol builder toggle
    const toggleBuilder = document.getElementById('toggle-builder');
    if (toggleBuilder) {
        toggleBuilder.addEventListener('click', () => {
            const content = document.getElementById('builder-content');
            if (content) {
                content.classList.toggle('expanded');
                toggleBuilder.textContent = content.classList.contains('expanded') ? 'Collapse' : 'Expand';
            }
        });
    }
    
    // Protocol send button
    const protocolSend = document.getElementById('protocol-send');
    if (protocolSend) {
        protocolSend.addEventListener('click', sendProtocolPacket);
    }
    
    // Builder send button
    const builderSend = document.getElementById('builder-send');
    if (builderSend) {
        builderSend.addEventListener('click', sendBuilderRequest);
    }
    
    // Builder save/load
    const builderSave = document.getElementById('builder-save');
    if (builderSave) {
        builderSave.addEventListener('click', saveBuilderTemplate);
    }
    
    const builderLoad = document.getElementById('builder-load');
    if (builderLoad) {
        builderLoad.addEventListener('click', loadBuilderTemplate);
    }
    
    // Create inject modal
    createInjectModal();
}

function filterTrafficByAction() {
    const actionFilter = document.getElementById('traffic-action-filter');
    const textFilter = document.getElementById('traffic-filter');
    const direction = document.getElementById('traffic-direction');
    
    const actionValue = actionFilter ? actionFilter.value : 'all';
    const textValue = textFilter ? textFilter.value.toLowerCase() : '';
    const dirValue = direction ? direction.value : 'all';
    
    const rows = document.querySelectorAll('#traffic-tbody tr');
    rows.forEach(row => {
        const action = row.dataset.action || '';
        const dir = row.dataset.direction || '';
        const text = row.textContent.toLowerCase();
        
        let show = true;
        
        // Action filter
        if (actionValue !== 'all' && !action.startsWith(actionValue + '.')) {
            show = false;
        }
        
        // Text filter
        if (textValue && !text.includes(textValue)) {
            show = false;
        }
        
        // Direction filter
        if (dirValue !== 'all') {
            if (dirValue === 'requests' && dir !== 'outbound') show = false;
            if (dirValue === 'responses' && dir !== 'inbound') show = false;
        }
        
        row.style.display = show ? '' : 'none';
    });
}

function toggleTrafficRecording() {
    const recordBtn = document.getElementById('traffic-record');
    const replayBtn = document.getElementById('traffic-replay');
    
    if (state.isRecording) {
        // Stop recording
        ipcRenderer.invoke('session-stop').then(result => {
            state.isRecording = false;
            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = '⏺ Record';
            replayBtn.disabled = false;
            updateRecordingIndicator(false);
            updateStatus(`Recording stopped: ${result.packetCount} packets captured`);
        });
    } else {
        // Start recording
        const sessionName = `session_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        ipcRenderer.invoke('session-start', sessionName).then(() => {
            state.isRecording = true;
            recordBtn.classList.add('recording');
            recordBtn.innerHTML = '⏹ Stop';
            replayBtn.disabled = true;
            updateRecordingIndicator(true);
            updateStatus('Recording started...');
        });
    }
}

function updateRecordingIndicator(isRecording) {
    const indicator = document.getElementById('recording-indicator');
    if (indicator) {
        if (isRecording) {
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    }
}

function replayRecordedSession() {
    // Show session selector
    ipcRenderer.invoke('session-list').then(sessions => {
        if (sessions.length === 0) {
            alert('No recorded sessions found');
            return;
        }
        
        const sessionName = prompt('Enter session name to replay:\n\nAvailable sessions:\n' + sessions.join('\n'));
        if (sessionName) {
            ipcRenderer.invoke('session-replay', sessionName, 1.0).then(() => {
                updateStatus(`Replaying session: ${sessionName}`);
            });
        }
    });
}

function createInjectModal() {
    if (document.getElementById('inject-modal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'inject-modal';
    modal.innerHTML = `
        <div class="inject-dialog">
            <h3>💉 Inject Packet</h3>
            <div class="form-group">
                <label>Action Name</label>
                <input type="text" id="inject-action" placeholder="e.g., city.getInfo">
            </div>
            <div class="form-group">
                <label>Payload (JSON)</label>
                <textarea id="inject-payload" placeholder='{"cityId": 12345}'></textarea>
            </div>
            <div class="inject-dialog-actions">
                <button id="inject-cancel" class="secondary-btn">Cancel</button>
                <button id="inject-send" class="primary-btn">Send</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('inject-cancel').addEventListener('click', hideInjectModal);
    document.getElementById('inject-send').addEventListener('click', sendInjectedPacket);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideInjectModal();
    });
}

function showInjectModal() {
    const modal = document.getElementById('inject-modal');
    if (modal) {
        modal.classList.add('visible');
        document.getElementById('inject-action').focus();
    }
}

function hideInjectModal() {
    const modal = document.getElementById('inject-modal');
    if (modal) {
        modal.classList.remove('visible');
    }
}

function sendInjectedPacket() {
    const action = document.getElementById('inject-action').value;
    const payloadStr = document.getElementById('inject-payload').value;
    
    if (!action) {
        alert('Please enter an action name');
        return;
    }
    
    let payload = {};
    try {
        if (payloadStr.trim()) {
            payload = JSON.parse(payloadStr);
        }
    } catch (e) {
        alert('Invalid JSON payload: ' + e.message);
        return;
    }
    
    ipcRenderer.invoke('protocol-send', action, payload).then(result => {
        if (result.success) {
            updateStatus(`Packet injected: ${action}`);
            hideInjectModal();
            
            // Show response in builder
            const responseContent = document.getElementById('builder-response-content');
            if (responseContent && result.response) {
                responseContent.textContent = JSON.stringify(result.response, null, 2);
            }
        } else {
            alert('Failed to inject packet: ' + (result.error || 'Unknown error'));
        }
    });
}

function showAddBreakpointDialog() {
    const action = prompt('Enter action name pattern to break on (e.g., city.* or army.march):');
    if (action) {
        const condition = prompt('Enter condition (optional, e.g., payload.cityId === 123):');
        addBreakpoint(action, condition);
    }
}

function addBreakpoint(action, condition = '') {
    const breakpoint = {
        id: Date.now(),
        action: action,
        condition: condition,
        enabled: true
    };
    
    breakpoints.push(breakpoint);
    renderBreakpoints();
    
    // Register with main process
    ipcRenderer.invoke('breakpoint-add', breakpoint);
}

function removeBreakpoint(id) {
    const index = breakpoints.findIndex(b => b.id === id);
    if (index !== -1) {
        breakpoints.splice(index, 1);
        renderBreakpoints();
        ipcRenderer.invoke('breakpoint-remove', id);
    }
}

function clearAllBreakpoints() {
    breakpoints.length = 0;
    renderBreakpoints();
    ipcRenderer.invoke('breakpoint-clear');
}

function renderBreakpoints() {
    const list = document.getElementById('breakpoints-list');
    if (!list) return;
    
    if (breakpoints.length === 0) {
        list.innerHTML = '<div class="empty-state">No breakpoints set</div>';
        return;
    }
    
    list.innerHTML = breakpoints.map(bp => `
        <div class="breakpoint-item ${bp.enabled ? 'active' : ''}" data-id="${bp.id}">
            <input type="checkbox" ${bp.enabled ? 'checked' : ''} onchange="toggleBreakpoint(${bp.id})">
            <span class="breakpoint-action">${bp.action}</span>
            <span class="breakpoint-condition">${bp.condition || '(no condition)'}</span>
            <button class="breakpoint-remove" onclick="removeBreakpoint(${bp.id})">×</button>
        </div>
    `).join('');
}

function toggleBreakpoint(id) {
    const bp = breakpoints.find(b => b.id === id);
    if (bp) {
        bp.enabled = !bp.enabled;
        renderBreakpoints();
        ipcRenderer.invoke('breakpoint-toggle', id, bp.enabled);
    }
}

function selectForCompare(entry) {
    if (selectedForCompare.length >= 2) {
        selectedForCompare.shift();
    }
    selectedForCompare.push(entry);
    
    const compareBtn = document.getElementById('compare-packets');
    if (compareBtn) {
        compareBtn.disabled = selectedForCompare.length < 2;
    }
    
    updateStatus(`Selected ${selectedForCompare.length}/2 packets for comparison`);
}

function compareSelectedPackets() {
    if (selectedForCompare.length < 2) {
        alert('Please select two packets to compare');
        return;
    }
    
    const left = selectedForCompare[0];
    const right = selectedForCompare[1];
    
    const leftPane = document.getElementById('compare-left');
    const rightPane = document.getElementById('compare-right');
    
    if (leftPane && rightPane) {
        const leftJson = JSON.stringify(left.decoded || left, null, 2);
        const rightJson = JSON.stringify(right.decoded || right, null, 2);
        
        leftPane.innerHTML = `<div class="compare-header">Packet 1: ${left.action || 'Unknown'}</div><pre>${highlightDiff(leftJson, rightJson, 'left')}</pre>`;
        rightPane.innerHTML = `<div class="compare-header">Packet 2: ${right.action || 'Unknown'}</div><pre>${highlightDiff(rightJson, leftJson, 'right')}</pre>`;
    }
    
    // Switch to compare tab
    document.querySelectorAll('.details-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.details-tab[data-tab="compare"]').classList.add('active');
    document.querySelectorAll('.details-content').forEach(c => c.classList.remove('active'));
    document.getElementById('details-compare').classList.add('active');
}

function highlightDiff(text1, text2, side) {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    
    return lines1.map((line, i) => {
        if (i >= lines2.length) {
            return `<span class="diff-add">${escapeHtml(line)}</span>`;
        }
        if (line !== lines2[i]) {
            return `<span class="diff-${side === 'left' ? 'remove' : 'add'}">${escapeHtml(line)}</span>`;
        }
        return escapeHtml(line);
    }).join('\n');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Protocol Builder Functions
function sendProtocolPacket() {
    const actionName = document.getElementById('protocol-action-name');
    if (!actionName || !actionName.textContent || actionName.textContent === 'Select an action') {
        alert('Please select a protocol action first');
        return;
    }
    
    // Populate builder and expand
    const builderAction = document.getElementById('builder-action');
    if (builderAction) {
        builderAction.value = actionName.textContent;
    }
    
    const builderContent = document.getElementById('builder-content');
    if (builderContent) {
        builderContent.classList.add('expanded');
    }
    
    const toggleBuilder = document.getElementById('toggle-builder');
    if (toggleBuilder) {
        toggleBuilder.textContent = 'Collapse';
    }
}

function sendBuilderRequest() {
    const action = document.getElementById('builder-action').value;
    const paramsStr = document.getElementById('builder-params').value;
    
    if (!action) {
        alert('Please enter an action name');
        return;
    }
    
    let params = {};
    try {
        if (paramsStr.trim()) {
            params = JSON.parse(paramsStr);
        }
    } catch (e) {
        alert('Invalid JSON parameters: ' + e.message);
        return;
    }
    
    const responseContent = document.getElementById('builder-response-content');
    if (responseContent) {
        responseContent.textContent = 'Sending request...';
    }
    
    ipcRenderer.invoke('protocol-send', action, params).then(result => {
        if (responseContent) {
            if (result.success) {
                responseContent.textContent = JSON.stringify(result.response || result, null, 2);
            } else {
                responseContent.textContent = 'Error: ' + (result.error || 'Unknown error');
            }
        }
    });
}

function saveBuilderTemplate() {
    const action = document.getElementById('builder-action').value;
    const params = document.getElementById('builder-params').value;
    
    if (!action) {
        alert('Please enter an action name first');
        return;
    }
    
    const templates = store.get('protocolTemplates') || {};
    templates[action] = {
        action: action,
        params: params,
        savedAt: new Date().toISOString()
    };
    store.set('protocolTemplates', templates);
    
    updateStatus(`Template saved: ${action}`);
}

function loadBuilderTemplate() {
    const templates = store.get('protocolTemplates') || {};
    const names = Object.keys(templates);
    
    if (names.length === 0) {
        alert('No saved templates found');
        return;
    }
    
    const selected = prompt('Enter template name to load:\n\nAvailable templates:\n' + names.join('\n'));
    if (selected && templates[selected]) {
        document.getElementById('builder-action').value = templates[selected].action;
        document.getElementById('builder-params').value = templates[selected].params;
        updateStatus(`Template loaded: ${selected}`);
    }
}

// Export chat history
function exportChatHistory() {
    const messages = [];
    document.querySelectorAll('#chatbot-messages .message').forEach(msg => {
        const role = msg.classList.contains('user') ? 'user' : 'assistant';
        const text = msg.querySelector('.message-text')?.textContent || '';
        messages.push({ role, content: text, timestamp: new Date().toISOString() });
    });
    
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Make functions globally accessible
window.toggleBreakpoint = toggleBreakpoint;
window.removeBreakpoint = removeBreakpoint;
window.exportChatHistory = exportChatHistory;

// ============================================================================
// v2.0.6 - New IPC Listeners
// ============================================================================

// Fiddler Bridge events
ipcRenderer.on('fiddler-connected', () => {
    updateStatus('Fiddler connected');
    const indicator = document.getElementById('proxy-status');
    if (indicator) {
        indicator.classList.remove('inactive', 'warning');
        indicator.classList.add('active');
        indicator.title = 'Fiddler: Connected';
    }
});

ipcRenderer.on('fiddler-disconnected', () => {
    updateStatus('Fiddler disconnected');
    const indicator = document.getElementById('proxy-status');
    if (indicator) {
        indicator.classList.remove('active', 'warning');
        indicator.classList.add('inactive');
        indicator.title = 'Fiddler: Disconnected';
    }
});

ipcRenderer.on('fiddler-traffic', (event, entry) => {
    // Add to traffic view
    addTrafficEntry(entry);
});

// Game State Tracker events
ipcRenderer.on('game-state-updated', (event, state) => {
    updateGameStateUI(state);
});

ipcRenderer.on('game-event-detected', (event, gameEvent) => {
    console.log('[Game Event]', gameEvent);
    updateStatus(`Event: ${gameEvent.type}`);
    
    // Add to event log if visible
    const eventLog = document.getElementById('game-event-log');
    if (eventLog) {
        const entry = document.createElement('div');
        entry.className = 'event-entry';
        entry.innerHTML = `<span class="event-time">${new Date().toLocaleTimeString()}</span>
                          <span class="event-type">${gameEvent.type}</span>
                          <span class="event-data">${JSON.stringify(gameEvent.data).substring(0, 50)}...</span>`;
        eventLog.insertBefore(entry, eventLog.firstChild);
    }
});

// MCP Client Manager events
ipcRenderer.on('mcp-server-connected', (event, serverName) => {
    console.log('[MCP] Server connected:', serverName);
    updateMCPStatus();
});

ipcRenderer.on('mcp-server-disconnected', (event, serverName) => {
    console.log('[MCP] Server disconnected:', serverName);
    updateMCPStatus();
});

ipcRenderer.on('mcp-tool-result', (event, result) => {
    console.log('[MCP] Tool result:', result);
});

// Update MCP status indicator
async function updateMCPStatus() {
    try {
        const status = await ipcRenderer.invoke('mcp-manager-get-status');
        const indicator = document.getElementById('mcp-status');
        if (indicator) {
            const connectedCount = Object.values(status.servers || {}).filter(s => s.connected).length;
            const totalCount = Object.keys(status.servers || {}).length;
            
            if (connectedCount === totalCount && totalCount > 0) {
                indicator.classList.remove('inactive', 'warning');
                indicator.classList.add('active');
                indicator.title = `MCP: ${connectedCount}/${totalCount} servers connected`;
            } else if (connectedCount > 0) {
                indicator.classList.remove('inactive', 'active');
                indicator.classList.add('warning');
                indicator.title = `MCP: ${connectedCount}/${totalCount} servers connected`;
            } else {
                indicator.classList.remove('active', 'warning');
                indicator.classList.add('inactive');
                indicator.title = 'MCP: No servers connected';
            }
        }
        
        // Update MCP status list in Tools tab
        updateMCPStatusList(status);
    } catch (e) {
        console.warn('Could not update MCP status:', e);
    }
}

// Update MCP status list in Tools tab
function updateMCPStatusList(status) {
    const container = document.getElementById('mcp-status-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    const servers = status.servers || {};
    for (const [name, info] of Object.entries(servers)) {
        const item = document.createElement('div');
        item.className = `mcp-server-item ${info.connected ? 'connected' : 'disconnected'}`;
        item.innerHTML = `
            <span class="server-name">${name}</span>
            <span class="server-status">${info.connected ? '✓ Connected' : '✗ Disconnected'}</span>
            <span class="server-tools">${info.tools?.length || 0} tools</span>
        `;
        container.appendChild(item);
    }
    
    if (Object.keys(servers).length === 0) {
        container.innerHTML = '<div class="no-servers">No MCP servers configured</div>';
    }
}

// Update game state UI
function updateGameStateUI(state) {
    if (!state) return;
    
    // Update summary
    const playerEl = document.getElementById('state-player');
    const citiesEl = document.getElementById('state-cities');
    const heroesEl = document.getElementById('state-heroes');
    const marchesEl = document.getElementById('state-marches');
    
    if (playerEl && state.player) {
        playerEl.textContent = state.player.name || 'Unknown';
    }
    if (citiesEl && state.cities) {
        citiesEl.textContent = Object.keys(state.cities).length;
    }
    if (heroesEl && state.heroes) {
        heroesEl.textContent = Object.keys(state.heroes).length;
    }
    if (marchesEl && state.armies) {
        const activeMarches = Object.values(state.armies).filter(a => a.status === 'marching').length;
        marchesEl.textContent = activeMarches;
    }
}

// Refresh game state button handler
async function refreshGameStateFromTracker() {
    try {
        const state = await ipcRenderer.invoke('game-tracker-get-state');
        updateGameStateUI(state);
        updateStatus('Game state refreshed');
    } catch (e) {
        console.warn('Could not refresh game state:', e);
    }
}

// Export game state button handler
async function exportGameStateFromTracker() {
    try {
        const data = await ipcRenderer.invoke('game-tracker-export', 'json');
        if (data) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `game-state-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            updateStatus('Game state exported');
        }
    } catch (e) {
        console.warn('Could not export game state:', e);
    }
}

// Connect to MCP servers
async function connectMCPServers() {
    try {
        updateStatus('Connecting to MCP servers...');
        const result = await ipcRenderer.invoke('mcp-manager-connect-all');
        if (result.error) {
            updateStatus('MCP connection error: ' + result.error);
        } else {
            updateStatus('MCP servers connected');
            updateMCPStatus();
        }
    } catch (e) {
        console.warn('Could not connect MCP servers:', e);
        updateStatus('MCP connection failed');
    }
}

// Enhanced AMF decode using new AMF3 decoder
async function decodeAMFEnhancedV2() {
    const input = document.getElementById('amf-input');
    const output = document.getElementById('amf-output');
    
    if (!input || !output) return;
    
    const hexData = input.value.trim().replace(/\s+/g, '');
    if (!hexData) {
        output.textContent = 'Please enter hex data to decode';
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('amf3-decode', hexData);
        if (result.error) {
            output.textContent = 'Decode error: ' + result.error;
        } else {
            output.textContent = JSON.stringify(result, null, 2);
        }
    } catch (e) {
        output.textContent = 'Error: ' + e.message;
    }
}

// Traffic injection
async function injectTrafficPacket() {
    const action = prompt('Enter action name (e.g., city.getInfo):');
    if (!action) return;
    
    const paramsStr = prompt('Enter parameters as JSON:');
    let params = {};
    if (paramsStr) {
        try {
            params = JSON.parse(paramsStr);
        } catch (e) {
            alert('Invalid JSON: ' + e.message);
            return;
        }
    }
    
    try {
        const result = await ipcRenderer.invoke('fiddler-inject-request', { action, params });
        if (result.error) {
            updateStatus('Injection error: ' + result.error);
        } else {
            updateStatus('Packet injected successfully');
        }
    } catch (e) {
        updateStatus('Injection failed: ' + e.message);
    }
}

// Wire up new button handlers
document.addEventListener('DOMContentLoaded', () => {
    // Game state buttons
    const refreshStateBtn = document.getElementById('refresh-game-state');
    if (refreshStateBtn) {
        refreshStateBtn.addEventListener('click', refreshGameStateFromTracker);
    }
    
    const exportStateBtn = document.getElementById('export-game-state');
    if (exportStateBtn) {
        exportStateBtn.addEventListener('click', exportGameStateFromTracker);
    }
    
    // MCP reconnect button
    const mcpReconnectBtn = document.getElementById('mcp-reconnect');
    if (mcpReconnectBtn) {
        mcpReconnectBtn.removeEventListener('click', reconnectMCP);
        mcpReconnectBtn.addEventListener('click', connectMCPServers);
    }
    
    // Traffic inject button
    const injectBtn = document.getElementById('traffic-inject');
    if (injectBtn) {
        injectBtn.addEventListener('click', injectTrafficPacket);
    }
    
    // Initial MCP status check
    setTimeout(updateMCPStatus, 2000);
});

// Make new functions globally accessible
window.refreshGameStateFromTracker = refreshGameStateFromTracker;
window.exportGameStateFromTracker = exportGameStateFromTracker;
window.connectMCPServers = connectMCPServers;
window.injectTrafficPacket = injectTrafficPacket;
window.updateMCPStatus = updateMCPStatus;

// Initialize traffic enhancements
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeTrafficEnhancements, 150);
});


// ============================================================================
// v2.0.9 - DEBUG, AUTOMATION & AGENT MODE
// ============================================================================

// Debug Tab State
const debugState = {
    logs: [],
    networkCapturing: false,
    profiling: false,
    networkRequests: [],
    networkStats: { requests: 0, dataIn: 0, dataOut: 0, errors: 0 }
};

// Automation Tab State
const automationState = {
    recording: false,
    recordedActions: [],
    runningScripts: [],
    scheduledTasks: [],
    agentActive: false,
    agentGoals: []
};

// ========== DEBUG TAB FUNCTIONS ==========

async function initializeDebugTab() {
    console.log('[Renderer] Initializing Debug tab...');
    
    // Log level filter
    const logLevelFilter = document.getElementById('log-level-filter');
    if (logLevelFilter) {
        logLevelFilter.addEventListener('change', () => filterLogs());
    }
    
    // Log source filter
    const logSourceFilter = document.getElementById('log-source-filter');
    if (logSourceFilter) {
        logSourceFilter.addEventListener('change', () => filterLogs());
    }
    
    // Clear logs button
    const clearLogsBtn = document.getElementById('clear-logs');
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', async () => {
            await ipcRenderer.invoke('debug-clear-logs');
            debugState.logs = [];
            renderLogs();
        });
    }
    
    // Export logs button
    const exportLogsBtn = document.getElementById('export-logs');
    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', async () => {
            const result = await ipcRenderer.invoke('debug-export-logs', 'json');
            if (result.path) {
                alert(`Logs exported to: ${result.path}`);
            }
        });
    }
    
    // Network capture buttons
    const networkStartBtn = document.getElementById('network-start');
    const networkStopBtn = document.getElementById('network-stop');
    const networkClearBtn = document.getElementById('network-clear');
    
    if (networkStartBtn) {
        networkStartBtn.addEventListener('click', async () => {
            await ipcRenderer.invoke('network-start-capture');
            debugState.networkCapturing = true;
            networkStartBtn.disabled = true;
            if (networkStopBtn) networkStopBtn.disabled = false;
        });
    }
    
    if (networkStopBtn) {
        networkStopBtn.addEventListener('click', async () => {
            await ipcRenderer.invoke('network-stop-capture');
            debugState.networkCapturing = false;
            networkStopBtn.disabled = true;
            if (networkStartBtn) networkStartBtn.disabled = false;
        });
    }
    
    if (networkClearBtn) {
        networkClearBtn.addEventListener('click', async () => {
            await ipcRenderer.invoke('network-clear-requests');
            debugState.networkRequests = [];
            debugState.networkStats = { requests: 0, dataIn: 0, dataOut: 0, errors: 0 };
            renderNetworkRequests();
            updateNetworkStats();
        });
    }
    
    // Performance profiler buttons
    const perfStartBtn = document.getElementById('perf-start');
    const perfStopBtn = document.getElementById('perf-stop');
    const perfSnapshotBtn = document.getElementById('perf-snapshot');
    
    if (perfStartBtn) {
        perfStartBtn.addEventListener('click', async () => {
            await ipcRenderer.invoke('perf-start-profiling');
            debugState.profiling = true;
            perfStartBtn.disabled = true;
            if (perfStopBtn) perfStopBtn.disabled = false;
            startPerfMetricsUpdate();
        });
    }
    
    if (perfStopBtn) {
        perfStopBtn.addEventListener('click', async () => {
            await ipcRenderer.invoke('perf-stop-profiling');
            debugState.profiling = false;
            perfStopBtn.disabled = true;
            if (perfStartBtn) perfStartBtn.disabled = false;
            stopPerfMetricsUpdate();
        });
    }
    
    if (perfSnapshotBtn) {
        perfSnapshotBtn.addEventListener('click', async () => {
            const snapshot = await ipcRenderer.invoke('perf-take-snapshot');
            console.log('[Debug] Performance snapshot:', snapshot);
            alert('Snapshot taken. Check console for details.');
        });
    }
    
    // Console execution
    const consoleInput = document.getElementById('console-input');
    const consoleExecuteBtn = document.getElementById('console-execute');
    const consoleClearBtn = document.getElementById('console-clear');
    
    if (consoleInput && consoleExecuteBtn) {
        consoleExecuteBtn.addEventListener('click', () => executeConsoleCommand());
        consoleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executeConsoleCommand();
        });
    }
    
    if (consoleClearBtn) {
        consoleClearBtn.addEventListener('click', () => {
            const debugConsole = document.getElementById('debug-console');
            if (debugConsole) debugConsole.innerHTML = '';
        });
    }
    
    // Load initial logs
    await loadLogs();
}

async function loadLogs() {
    try {
        const logs = await ipcRenderer.invoke('debug-get-logs', { limit: 100 });
        debugState.logs = logs || [];
        renderLogs();
    } catch (error) {
        console.error('[Debug] Failed to load logs:', error);
    }
}

function renderLogs() {
    const logViewer = document.getElementById('log-viewer');
    if (!logViewer) return;
    
    if (debugState.logs.length === 0) {
        logViewer.innerHTML = '<div class="log-placeholder">No logs captured yet...</div>';
        return;
    }
    
    const levelFilter = document.getElementById('log-level-filter')?.value || 'all';
    const sourceFilter = document.getElementById('log-source-filter')?.value || 'all';
    
    const filteredLogs = debugState.logs.filter(log => {
        if (levelFilter !== 'all' && log.level !== levelFilter) return false;
        if (sourceFilter !== 'all' && log.source !== sourceFilter) return false;
        return true;
    });
    
    logViewer.innerHTML = filteredLogs.map(log => `
        <div class="log-entry ${log.level}">
            <span class="log-timestamp">${formatTime(log.timestamp)}</span>
            <span class="log-level">${log.level}</span>
            <span class="log-message">${escapeHtml(log.message)}</span>
        </div>
    `).join('');
    
    logViewer.scrollTop = logViewer.scrollHeight;
}

function filterLogs() {
    renderLogs();
}

function renderNetworkRequests() {
    const networkList = document.getElementById('network-list');
    if (!networkList) return;
    
    networkList.innerHTML = debugState.networkRequests.map(req => `
        <div class="network-entry">
            <span class="network-method ${req.method}">${req.method}</span>
            <span class="network-url" title="${req.url}">${req.url}</span>
            <span class="network-status ${req.status >= 400 ? 'error' : 'success'}">${req.status || '-'}</span>
            <span class="network-time">${req.duration || '-'}ms</span>
        </div>
    `).join('');
}

function updateNetworkStats() {
    const stats = debugState.networkStats;
    const requestsEl = document.getElementById('network-requests');
    const dataInEl = document.getElementById('network-data-in');
    const dataOutEl = document.getElementById('network-data-out');
    const errorsEl = document.getElementById('network-errors');
    
    if (requestsEl) requestsEl.textContent = stats.requests;
    if (dataInEl) dataInEl.textContent = formatBytes(stats.dataIn);
    if (dataOutEl) dataOutEl.textContent = formatBytes(stats.dataOut);
    if (errorsEl) errorsEl.textContent = stats.errors;
}

let perfMetricsInterval = null;

function startPerfMetricsUpdate() {
    if (perfMetricsInterval) return;
    
    perfMetricsInterval = setInterval(async () => {
        try {
            const metrics = await ipcRenderer.invoke('perf-get-metrics');
            updatePerfMetrics(metrics);
        } catch (error) {
            console.error('[Debug] Failed to get metrics:', error);
        }
    }, 1000);
}

function stopPerfMetricsUpdate() {
    if (perfMetricsInterval) {
        clearInterval(perfMetricsInterval);
        perfMetricsInterval = null;
    }
}

function updatePerfMetrics(metrics) {
    if (!metrics) return;
    
    const cpuEl = document.getElementById('perf-cpu');
    const memoryEl = document.getElementById('perf-memory');
    const fpsEl = document.getElementById('perf-fps');
    const latencyEl = document.getElementById('perf-latency');
    
    const cpuBar = document.getElementById('perf-cpu-bar');
    const memoryBar = document.getElementById('perf-memory-bar');
    const fpsBar = document.getElementById('perf-fps-bar');
    const latencyBar = document.getElementById('perf-latency-bar');
    
    if (cpuEl) cpuEl.textContent = `${(metrics.cpu || 0).toFixed(1)}%`;
    if (memoryEl) memoryEl.textContent = `${(metrics.memory || 0).toFixed(0)} MB`;
    if (fpsEl) fpsEl.textContent = metrics.fps || 60;
    if (latencyEl) latencyEl.textContent = `${metrics.latency || 0} ms`;
    
    if (cpuBar) cpuBar.style.width = `${Math.min(metrics.cpu || 0, 100)}%`;
    if (memoryBar) memoryBar.style.width = `${Math.min((metrics.memory || 0) / 1024 * 100, 100)}%`;
    if (fpsBar) fpsBar.style.width = `${Math.min((metrics.fps || 60) / 60 * 100, 100)}%`;
    if (latencyBar) latencyBar.style.width = `${Math.min((metrics.latency || 0) / 500 * 100, 100)}%`;
}

async function executeConsoleCommand() {
    const input = document.getElementById('console-input');
    const debugConsole = document.getElementById('debug-console');
    
    if (!input || !debugConsole) return;
    
    const code = input.value.trim();
    if (!code) return;
    
    // Add command to console
    debugConsole.innerHTML += `<div class="console-command">> ${escapeHtml(code)}</div>`;
    
    try {
        const result = await ipcRenderer.invoke('console-execute', code);
        if (result.success) {
            debugConsole.innerHTML += `<div class="console-result">${escapeHtml(result.result)}</div>`;
        } else {
            debugConsole.innerHTML += `<div class="console-error">${escapeHtml(result.error)}</div>`;
        }
    } catch (error) {
        debugConsole.innerHTML += `<div class="console-error">${escapeHtml(error.message)}</div>`;
    }
    
    input.value = '';
    debugConsole.scrollTop = debugConsole.scrollHeight;
}

// ========== AUTOMATION TAB FUNCTIONS ==========

async function initializeAutomationTab() {
    console.log('[Renderer] Initializing Automation tab...');
    
    // Script recorder buttons
    const recordBtn = document.getElementById('script-record');
    const stopBtn = document.getElementById('script-stop');
    const pauseBtn = document.getElementById('script-pause');
    
    if (recordBtn) {
        recordBtn.addEventListener('click', async () => {
            await ipcRenderer.invoke('script-start-recording');
            automationState.recording = true;
            updateRecorderUI();
        });
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', async () => {
            const result = await ipcRenderer.invoke('script-stop-recording');
            automationState.recording = false;
            automationState.recordedActions = result?.actions || [];
            updateRecorderUI();
            renderRecordedActions();
        });
    }
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', async () => {
            if (automationState.recording) {
                await ipcRenderer.invoke('script-pause-recording');
            } else {
                await ipcRenderer.invoke('script-resume-recording');
            }
        });
    }
    
    // Template buttons
    document.querySelectorAll('.run-template-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const card = btn.closest('.template-card');
            const templateId = card?.dataset.template;
            if (templateId) {
                await runTemplate(templateId);
            }
        });
    });
    
    // Template category filter
    const categoryFilter = document.getElementById('template-category');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => filterTemplates());
    }
    
    // Runner buttons
    const runnerRunBtn = document.getElementById('runner-run');
    const runnerStopBtn = document.getElementById('runner-stop');
    const runnerScheduleBtn = document.getElementById('runner-schedule');
    
    if (runnerStopBtn) {
        runnerStopBtn.addEventListener('click', async () => {
            await ipcRenderer.invoke('runner-stop-all');
            updateRunnerStatus();
        });
    }
    
    // Agent mode buttons
    const agentStartBtn = document.getElementById('agent-start');
    const agentStopBtn = document.getElementById('agent-stop');
    const agentPauseBtn = document.getElementById('agent-pause');
    const agentAddGoalBtn = document.getElementById('agent-add-goal');
    
    if (agentStartBtn) {
        agentStartBtn.addEventListener('click', async () => {
            await ipcRenderer.invoke('agent-start');
            automationState.agentActive = true;
            updateAgentUI();
        });
    }
    
    if (agentStopBtn) {
        agentStopBtn.addEventListener('click', async () => {
            await ipcRenderer.invoke('agent-stop');
            automationState.agentActive = false;
            updateAgentUI();
        });
    }
    
    if (agentPauseBtn) {
        agentPauseBtn.addEventListener('click', async () => {
            if (automationState.agentActive) {
                await ipcRenderer.invoke('agent-pause');
            } else {
                await ipcRenderer.invoke('agent-resume');
            }
        });
    }
    
    if (agentAddGoalBtn) {
        agentAddGoalBtn.addEventListener('click', () => addAgentGoal());
    }
    
    const goalInput = document.getElementById('agent-goal-input');
    if (goalInput) {
        goalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addAgentGoal();
        });
    }
    
    // Load initial data
    await loadTemplates();
    await updateRunnerStatus();
    await loadAgentGoals();
}

function updateRecorderUI() {
    const recordBtn = document.getElementById('script-record');
    const stopBtn = document.getElementById('script-stop');
    const pauseBtn = document.getElementById('script-pause');
    const statusDot = document.getElementById('recorder-dot');
    const statusText = document.getElementById('recorder-status-text');
    
    if (automationState.recording) {
        if (recordBtn) recordBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = false;
        if (statusDot) statusDot.classList.add('recording');
        if (statusText) statusText.textContent = 'Recording...';
    } else {
        if (recordBtn) recordBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = true;
        if (statusDot) statusDot.classList.remove('recording');
        if (statusText) statusText.textContent = 'Ready to record';
    }
}

function renderRecordedActions() {
    const container = document.getElementById('recorded-actions');
    if (!container) return;
    
    if (automationState.recordedActions.length === 0) {
        container.innerHTML = '<div class="actions-placeholder">Recorded actions will appear here...</div>';
        return;
    }
    
    container.innerHTML = automationState.recordedActions.map(action => `
        <div class="action-entry">
            <span class="action-type">${action.type}</span>
            <span class="action-target">${action.selector || ''}</span>
            <span class="action-value">${action.value || ''}</span>
        </div>
    `).join('');
    
    const actionsCount = document.getElementById('recorder-actions');
    if (actionsCount) actionsCount.textContent = `${automationState.recordedActions.length} actions`;
}

async function loadTemplates() {
    try {
        const templates = await ipcRenderer.invoke('templates-get-all');
        // Templates are already rendered in HTML, just update if needed
    } catch (error) {
        console.error('[Automation] Failed to load templates:', error);
    }
}

function filterTemplates() {
    const category = document.getElementById('template-category')?.value || 'all';
    document.querySelectorAll('.template-card').forEach(card => {
        const cardCategory = card.dataset.category || 'all';
        card.style.display = (category === 'all' || cardCategory === category) ? 'flex' : 'none';
    });
}

async function runTemplate(templateId) {
    try {
        const result = await ipcRenderer.invoke('templates-run', templateId);
        if (result.error) {
            alert(`Failed to run template: ${result.error}`);
        } else {
            updateRunnerStatus();
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function updateRunnerStatus() {
    try {
        const status = await ipcRenderer.invoke('runner-get-status');
        
        const runningEl = document.getElementById('runner-running');
        const queuedEl = document.getElementById('runner-queued');
        const completedEl = document.getElementById('runner-completed');
        const failedEl = document.getElementById('runner-failed');
        
        if (runningEl) runningEl.textContent = status?.running || 0;
        if (queuedEl) queuedEl.textContent = status?.queued || 0;
        if (completedEl) completedEl.textContent = status?.completed || 0;
        if (failedEl) failedEl.textContent = status?.failed || 0;
    } catch (error) {
        console.error('[Automation] Failed to get runner status:', error);
    }
}

function updateAgentUI() {
    const startBtn = document.getElementById('agent-start');
    const stopBtn = document.getElementById('agent-stop');
    const pauseBtn = document.getElementById('agent-pause');
    const modeDot = document.getElementById('agent-mode-dot');
    const modeText = document.getElementById('agent-mode-text');
    
    if (automationState.agentActive) {
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = false;
        if (modeDot) modeDot.classList.add('active');
        if (modeText) modeText.textContent = 'Active';
    } else {
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = true;
        if (modeDot) modeDot.classList.remove('active');
        if (modeText) modeText.textContent = 'Idle';
    }
}

async function addAgentGoal() {
    const input = document.getElementById('agent-goal-input');
    if (!input) return;
    
    const goalText = input.value.trim();
    if (!goalText) return;
    
    try {
        await ipcRenderer.invoke('agent-add-goal', { text: goalText, priority: 50 });
        input.value = '';
        await loadAgentGoals();
    } catch (error) {
        alert(`Failed to add goal: ${error.message}`);
    }
}

async function loadAgentGoals() {
    try {
        const goals = await ipcRenderer.invoke('agent-get-goals');
        automationState.agentGoals = goals || [];
        renderAgentGoals();
    } catch (error) {
        console.error('[Automation] Failed to load goals:', error);
    }
}

function renderAgentGoals() {
    const container = document.getElementById('agent-goals-list');
    if (!container) return;
    
    if (automationState.agentGoals.length === 0) {
        container.innerHTML = '<div class="goal-placeholder">No goals set. Add a goal to get started.</div>';
        return;
    }
    
    container.innerHTML = automationState.agentGoals.map((goal, index) => `
        <div class="goal-item">
            <span class="goal-priority">${index + 1}</span>
            <span class="goal-text">${escapeHtml(goal.text)}</span>
            <span class="goal-status ${goal.status}">${goal.status}</span>
        </div>
    `).join('');
    
    const goalsCount = document.getElementById('agent-goals');
    if (goalsCount) goalsCount.textContent = automationState.agentGoals.length;
}

// ========== UTILITY FUNCTIONS ==========

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== IPC EVENT LISTENERS ==========

// Log events
ipcRenderer.on('debug-log', (event, log) => {
    debugState.logs.push(log);
    if (debugState.logs.length > 1000) {
        debugState.logs = debugState.logs.slice(-500);
    }
    renderLogs();
});

// Network events
ipcRenderer.on('network-request', (event, request) => {
    debugState.networkRequests.push(request);
    debugState.networkStats.requests++;
    debugState.networkStats.dataIn += request.responseSize || 0;
    debugState.networkStats.dataOut += request.requestSize || 0;
    if (request.status >= 400) debugState.networkStats.errors++;
    
    renderNetworkRequests();
    updateNetworkStats();
});

// Agent events
ipcRenderer.on('agent-status-update', (event, status) => {
    automationState.agentActive = status.active;
    updateAgentUI();
    
    const actionsEl = document.getElementById('agent-actions');
    const decisionsEl = document.getElementById('agent-decisions');
    
    if (actionsEl) actionsEl.textContent = status.actions || 0;
    if (decisionsEl) decisionsEl.textContent = status.decisions || 0;
});

ipcRenderer.on('agent-goal-update', (event, goals) => {
    automationState.agentGoals = goals;
    renderAgentGoals();
});

// Script recorder events
ipcRenderer.on('script-action-recorded', (event, action) => {
    automationState.recordedActions.push(action);
    renderRecordedActions();
});

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Debug and Automation tabs after a short delay
    setTimeout(async () => {
        await initializeDebugTab();
        await initializeAutomationTab();
        console.log('[Renderer] v2.0.9 features initialized');
    }, 200);
});

// Export for global access
window.debugState = debugState;
window.automationState = automationState;


// ============================================================================
// Window Resize Handler - v2.1.0
// Ensures panels resize properly with window
// ============================================================================

/**
 * Handle window resize events
 * Ensures panels maintain proper proportions and content is always visible
 */
function setupWindowResizeHandler() {
    let resizeTimeout = null;
    let lastPanelRatio = 0.5; // Default 50/50 split
    
    // Store panel ratio when manually resized
    function storePanelRatio() {
        const container = document.getElementById('browser-panels');
        const leftPanel = document.getElementById('left-panel');
        if (container && leftPanel && leftPanel.style.width) {
            const leftWidth = leftPanel.offsetWidth;
            const containerWidth = container.offsetWidth;
            if (containerWidth > 0) {
                lastPanelRatio = leftWidth / containerWidth;
            }
        }
    }
    
    // Restore panel ratio after resize
    function restorePanelRatio() {
        const container = document.getElementById('browser-panels');
        const leftPanel = document.getElementById('left-panel');
        const rightPanel = document.getElementById('right-panel');
        
        if (!container || !leftPanel || !rightPanel) return;
        
        const containerWidth = container.offsetWidth;
        const minWidth = 200;
        const splitterWidth = 6;
        
        // Check if we're in single panel mode
        if (leftPanel.classList.contains('hidden') || rightPanel.classList.contains('hidden')) {
            return; // Don't adjust in single panel mode
        }
        
        // Calculate new widths based on stored ratio
        let newLeftWidth = Math.floor(containerWidth * lastPanelRatio);
        
        // Enforce minimum widths
        newLeftWidth = Math.max(minWidth, Math.min(newLeftWidth, containerWidth - minWidth - splitterWidth));
        
        // Apply widths
        if (leftPanel.style.width) {
            leftPanel.style.width = `${newLeftWidth}px`;
        }
    }
    
    // Debounced resize handler
    function handleResize() {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        
        resizeTimeout = setTimeout(() => {
            restorePanelRatio();
            
            // Force webview resize
            const webviews = document.querySelectorAll('webview');
            webviews.forEach(wv => {
                // Trigger a reflow
                wv.style.display = 'none';
                wv.offsetHeight; // Force reflow
                wv.style.display = '';
            });
            
            // Emit resize event for any listeners
            window.dispatchEvent(new CustomEvent('panels-resized'));
        }, 100);
    }
    
    // Listen for window resize
    window.addEventListener('resize', handleResize);
    
    // Listen for panel splitter drag end to store ratio
    document.addEventListener('mouseup', () => {
        storePanelRatio();
    });
    
    // Initial setup
    setTimeout(() => {
        storePanelRatio();
    }, 500);
    
    console.log('[Renderer] Window resize handler initialized');
}

/**
 * Force all panels to recalculate their sizes
 */
function forcePanelResize() {
    const container = document.getElementById('browser-panels');
    if (!container) return;
    
    // Trigger reflow
    container.style.display = 'none';
    container.offsetHeight;
    container.style.display = '';
    
    // Force webview resize
    const webviews = document.querySelectorAll('webview');
    webviews.forEach(wv => {
        if (wv.style.display !== 'none') {
            wv.style.display = 'none';
            wv.offsetHeight;
            wv.style.display = '';
        }
    });
}

/**
 * Set panel view mode
 * @param {string} mode - 'both', 'left', 'right'
 */
function setPanelViewMode(mode) {
    const container = document.getElementById('browser-panels');
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const splitter = document.getElementById('panel-splitter');
    
    if (!container || !leftPanel || !rightPanel) return;
    
    // Remove all mode classes
    container.classList.remove('left-only', 'right-only', 'both-panels');
    leftPanel.classList.remove('hidden');
    rightPanel.classList.remove('hidden');
    
    // Reset flex styles
    leftPanel.style.flex = '';
    leftPanel.style.width = '';
    rightPanel.style.flex = '';
    rightPanel.style.width = '';
    
    switch (mode) {
        case 'left':
            container.classList.add('left-only');
            rightPanel.classList.add('hidden');
            if (splitter) splitter.style.display = 'none';
            break;
            
        case 'right':
            container.classList.add('right-only');
            leftPanel.classList.add('hidden');
            if (splitter) splitter.style.display = 'none';
            break;
            
        case 'both':
        default:
            container.classList.add('both-panels');
            if (splitter) splitter.style.display = '';
            break;
    }
    
    // Force resize after mode change
    setTimeout(forcePanelResize, 50);
    
    console.log(`[Renderer] Panel view mode set to: ${mode}`);
}

// Initialize window resize handler when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupWindowResizeHandler);
} else {
    setupWindowResizeHandler();
}


// ============================================================================
// Global Error Handler - v2.1.0
// Catches and handles all uncaught errors in renderer process
// ============================================================================

/**
 * Error notification system
 */
const ErrorNotification = {
    container: null,
    
    init() {
        // Create notification container if not exists
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'error-notifications';
            this.container.style.cssText = `
                position: fixed;
                top: 40px;
                right: 16px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-width: 400px;
                pointer-events: none;
            `;
            document.body.appendChild(this.container);
        }
    },
    
    show(message, type = 'error', duration = 5000) {
        this.init();
        
        const notification = document.createElement('div');
        notification.className = `error-notification ${type}`;
        notification.style.cssText = `
            background: ${type === 'error' ? '#EF4444' : type === 'warning' ? '#F59E0B' : '#10B981'};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            font-size: 13px;
            pointer-events: auto;
            cursor: pointer;
            animation: slideIn 0.3s ease;
            display: flex;
            align-items: flex-start;
            gap: 8px;
        `;
        
        const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
        notification.innerHTML = `
            <span style="flex-shrink: 0;">${icon}</span>
            <span style="flex: 1; word-break: break-word;">${message}</span>
            <span style="flex-shrink: 0; opacity: 0.7; cursor: pointer;" onclick="this.parentElement.remove()">✕</span>
        `;
        
        this.container.appendChild(notification);
        
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.animation = 'slideOut 0.3s ease';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
        
        // Click to dismiss
        notification.addEventListener('click', () => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        });
        
        return notification;
    },
    
    error(message, duration) {
        return this.show(message, 'error', duration);
    },
    
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    },
    
    success(message, duration) {
        return this.show(message, 'success', duration);
    }
};

/**
 * Global error handler
 */
function setupGlobalErrorHandler() {
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Handle uncaught errors
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('[GlobalError]', message, source, lineno, colno, error);
        
        // Don't show notification for known non-critical errors
        const ignoredPatterns = [
            'ResizeObserver loop',
            'Script error',
            'Loading chunk'
        ];
        
        if (ignoredPatterns.some(pattern => message.includes(pattern))) {
            return true;
        }
        
        ErrorNotification.error(`Error: ${message}`);
        
        // Report to main process
        if (typeof ipcRenderer !== 'undefined') {
            ipcRenderer.send('renderer-error', {
                message,
                source,
                lineno,
                colno,
                stack: error?.stack
            });
        }
        
        return true; // Prevent default handling
    };
    
    // Handle unhandled promise rejections
    window.onunhandledrejection = function(event) {
        console.error('[UnhandledRejection]', event.reason);
        
        const message = event.reason?.message || String(event.reason);
        
        // Don't show for common non-critical rejections
        const ignoredPatterns = [
            'AbortError',
            'NetworkError',
            'Failed to fetch'
        ];
        
        if (ignoredPatterns.some(pattern => message.includes(pattern))) {
            return;
        }
        
        ErrorNotification.error(`Unhandled: ${message}`);
        
        // Report to main process
        if (typeof ipcRenderer !== 'undefined') {
            ipcRenderer.send('renderer-error', {
                type: 'unhandledRejection',
                message,
                stack: event.reason?.stack
            });
        }
    };
    
    // Handle IPC errors
    if (typeof ipcRenderer !== 'undefined') {
        ipcRenderer.on('main-error', (event, error) => {
            console.error('[MainProcessError]', error);
            ErrorNotification.error(`System Error: ${error.message}`);
        });
        
        ipcRenderer.on('service-error', (event, { service, error }) => {
            console.error(`[ServiceError:${service}]`, error);
            ErrorNotification.warning(`${service}: ${error.message}`);
        });
    }
    
    console.log('[Renderer] Global error handler initialized');
}

/**
 * Safe IPC call wrapper
 * Wraps IPC calls with error handling
 */
async function safeIpcCall(channel, ...args) {
    try {
        const result = await ipcRenderer.invoke(channel, ...args);
        
        if (result && result.error) {
            console.warn(`[IPC:${channel}] Error response:`, result.error);
            return result;
        }
        
        return result;
    } catch (error) {
        console.error(`[IPC:${channel}] Call failed:`, error);
        ErrorNotification.error(`IPC Error: ${error.message}`);
        return { error: error.message };
    }
}

/**
 * Retry wrapper for unreliable operations
 */
async function withRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`[Retry] Attempt ${attempt}/${maxRetries} failed:`, error.message);
            
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }
    
    throw lastError;
}

// Initialize global error handler when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGlobalErrorHandler);
} else {
    setupGlobalErrorHandler();
}

// Export for use in other modules
window.ErrorNotification = ErrorNotification;
window.safeIpcCall = safeIpcCall;
window.withRetry = withRetry;



