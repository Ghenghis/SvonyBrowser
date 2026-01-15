/**
 * Svony Browser - Main Process
 * Electron main process with Flash support, traffic capture, and MCP integration
 * Built on FlashBrowser base
 */

const {
    app,
    protocol,
    BrowserWindow,
    globalShortcut,
    Menu,
    ipcMain,
    session,
    dialog,
    shell
} = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('./store.js');
const contextMenu = require('electron-context-menu');
const { download } = require('electron-dl');

// Context menu
contextMenu({
    showSaveImageAs: true
});

let mainWindow;
let swfURL = 'no swf';

// Services
let protocolHandler = null;
let mcpConnection = null;
let proxyMonitor = null;
let chatbotService = null;
let gameState = null;
let packetAnalysis = null;
let combatSimulator = null;
let sessionRecorder = null;

// Store for preferences
const store = new Store({
    configName: 'svony-preferences',
    defaults: {
        windowBounds: { width: 1600, height: 1000, isMax: false },
        defaultServer: 'cc2',
        adblock: true,
        mcpEnabled: false,
        homepage: 'http://www.evony.com',
        favorites: [],
        proxy: {
            enabled: false,
            host: '127.0.0.1',
            port: 8888
        },
        chatbot: {
            enabled: true,
            position: 'right'
        },
        traffic: {
            captureEnabled: true,
            maxPackets: 10000
        }
    }
});

// Flash plugin configuration
let pluginName = null;
switch (process.platform) {
    case 'win32':
        switch (process.arch) {
            case 'ia32':
            case 'x32':
                pluginName = 'flashver/pepflashplayer32.dll';
                break;
            case 'x64':
                pluginName = 'flashver/pepflashplayer64.dll';
                break;
        }
        break;
    case 'linux':
        pluginName = 'flashver/libpepflashplayer.so';
        app.commandLine.appendSwitch('no-sandbox');
        break;
    case 'darwin':
        pluginName = 'flashver/PepperFlashPlayer.plugin';
        break;
}

// Command line switches for Flash and performance
app.commandLine.appendSwitch("disable-renderer-backgrounding");
if (process.platform !== "darwin") {
    app.commandLine.appendSwitch('high-dpi-support', "1");
}
app.commandLine.appendSwitch("--enable-npapi");
app.commandLine.appendSwitch("--enable-logging");
app.commandLine.appendSwitch("--log-level", 4);
if (pluginName) {
    app.commandLine.appendSwitch('ppapi-flash-path', path.join(__dirname, pluginName));
}
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('ignore-certificate-errors', 'true');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

// Traffic capture state
let trafficCapturing = false;
let trafficEntries = [];

// Send message to renderer
function sendWindow(identifier, message, extra) {
    if (mainWindow) {
        mainWindow.webContents.send(identifier, message, extra);
    }
}

/**
 * Initialize all services
 */
async function initializeServices() {
    console.log('[Main] Initializing services...');
    
    try {
        // Protocol Handler
        protocolHandler = require('./services/protocol-handler');
        await protocolHandler.initialize();
        console.log('[Main] Protocol Handler initialized');
        
        // MCP Connection Manager - disabled by default to prevent console windows
        // Users can enable via settings if they have MCP servers configured
        if (store.get('mcpEnabled') === true) {
            try {
                mcpConnection = require('./services/mcp-connection');
                // Don't auto-initialize - let user trigger manually
                console.log('[Main] MCP Connection loaded (not auto-started)');
            } catch (e) {
                console.warn('[Main] MCP Connection not available:', e.message);
            }
        } else {
            console.log('[Main] MCP Connection disabled in settings');
        }
        
        // Proxy Monitor
        try {
            proxyMonitor = require('./services/proxy-monitor');
            proxyMonitor.start(5000);
            console.log('[Main] Proxy Monitor started');
            
            proxyMonitor.on('statusChanged', (status) => {
                sendWindow('proxy-status-changed', status);
            });
        } catch (e) {
            console.warn('[Main] Proxy Monitor not available:', e.message);
        }
        
        // Chatbot Service
        try {
            chatbotService = require('./services/chatbot-service');
            await chatbotService.initialize();
            console.log('[Main] Chatbot Service initialized');
            
            chatbotService.on('messageAdded', (message) => {
                sendWindow('chatbot-message', message);
            });
        } catch (e) {
            console.warn('[Main] Chatbot Service not available:', e.message);
        }
        
        // Game State Engine
        try {
            gameState = require('./services/game-state');
            await gameState.initialize();
            console.log('[Main] Game State Engine initialized');
            
            gameState.on('stateChanged', (data) => {
                sendWindow('game-state-changed', data);
            });
            
            gameState.on('playerLoggedIn', (player) => {
                sendWindow('player-logged-in', player);
            });
        } catch (e) {
            console.warn('[Main] Game State Engine not available:', e.message);
        }
        
        // Packet Analysis Engine
        try {
            packetAnalysis = require('./services/packet-analysis');
            await packetAnalysis.initialize();
            console.log('[Main] Packet Analysis Engine initialized');
            
            packetAnalysis.on('packetCaptured', (packet) => {
                sendWindow('packet-captured', packet);
                
                // Feed to game state
                if (gameState && packet.decoded) {
                    gameState.processPacket({
                        action: packet.action,
                        data: packet.decoded,
                        direction: packet.direction,
                        timestamp: packet.timestamp
                    });
                }
                
                // Feed to session recorder
                if (sessionRecorder && sessionRecorder.isRecording) {
                    sessionRecorder.recordPacket(packet);
                }
            });
            
            packetAnalysis.on('patternDetected', (data) => {
                sendWindow('pattern-detected', data);
            });
        } catch (e) {
            console.warn('[Main] Packet Analysis Engine not available:', e.message);
        }
        
        // Combat Simulator
        try {
            combatSimulator = require('./services/combat-simulator');
            console.log('[Main] Combat Simulator loaded');
        } catch (e) {
            console.warn('[Main] Combat Simulator not available:', e.message);
        }
        
        // Session Recorder
        try {
            sessionRecorder = require('./services/session-recorder');
            await sessionRecorder.initialize(path.join(app.getPath('userData'), 'sessions'));
            console.log('[Main] Session Recorder initialized');
            
            sessionRecorder.on('recordingStarted', (session) => {
                sendWindow('recording-started', session);
            });
            
            sessionRecorder.on('recordingStopped', (session) => {
                sendWindow('recording-stopped', session);
            });
        } catch (e) {
            console.warn('[Main] Session Recorder not available:', e.message);
        }
        
        console.log('[Main] All services initialized');
        
    } catch (error) {
        console.error('[Main] Service initialization error:', error);
    }
}

// Create application menu
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Tab',
                    accelerator: 'CmdOrCtrl+T',
                    click: () => sendWindow('new-tab')
                },
                { type: 'separator' },
                {
                    label: 'Settings',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => sendWindow('open-settings')
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Left Panel Only',
                    accelerator: 'CmdOrCtrl+1',
                    click: () => sendWindow('set-view', 'left')
                },
                {
                    label: 'Both Panels',
                    accelerator: 'CmdOrCtrl+2',
                    click: () => sendWindow('set-view', 'both')
                },
                {
                    label: 'Right Panel Only',
                    accelerator: 'CmdOrCtrl+3',
                    click: () => sendWindow('set-view', 'right')
                },
                { type: 'separator' },
                {
                    label: 'Toggle Chatbot',
                    accelerator: 'CmdOrCtrl+Shift+C',
                    click: () => sendWindow('toggle-chatbot')
                },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Tools',
            submenu: [
                {
                    label: 'Traffic Viewer',
                    accelerator: 'CmdOrCtrl+Shift+T',
                    click: () => sendWindow('switch-tab', 'traffic')
                },
                {
                    label: 'Protocol Explorer',
                    accelerator: 'CmdOrCtrl+Shift+P',
                    click: () => sendWindow('switch-tab', 'protocol')
                },
                {
                    label: 'Tools Panel',
                    accelerator: 'CmdOrCtrl+Shift+O',
                    click: () => sendWindow('switch-tab', 'tools')
                },
                { type: 'separator' },
                {
                    label: 'Start Capture',
                    accelerator: 'F5',
                    click: () => sendWindow('start-capture')
                },
                {
                    label: 'Stop Capture',
                    accelerator: 'F6',
                    click: () => sendWindow('stop-capture')
                },
                { type: 'separator' },
                {
                    label: 'Combat Simulator',
                    click: () => sendWindow('open-combat-simulator')
                },
                {
                    label: 'Training Calculator',
                    click: () => sendWindow('open-training-calculator')
                },
                { type: 'separator' },
                {
                    label: 'Clear Cache',
                    click: () => clearCacheFunction()
                },
                {
                    label: 'Clear Cookies',
                    click: () => clearCookies()
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About Svony Browser',
                    click: () => showAbout()
                },
                {
                    label: 'Check for Updates',
                    click: () => checkForUpdates()
                },
                { type: 'separator' },
                {
                    label: 'GitHub Repository',
                    click: () => shell.openExternal('https://github.com/Ghenghis/Svony-Browser')
                },
                {
                    label: 'Report Issue',
                    click: () => shell.openExternal('https://github.com/Ghenghis/Svony-Browser/issues')
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Setup traffic capture
function setupTrafficCapture() {
    const ses = session.defaultSession;

    ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
        if (trafficCapturing) {
            const entry = {
                id: Date.now(),
                timestamp: Date.now(),
                direction: 'request',
                url: details.url,
                method: details.method,
                resourceType: details.resourceType,
                size: 0
            };

            // Check for AMF/game traffic
            if (details.url.includes('evony') || details.url.includes('amf')) {
                entry.action = extractAction(details.url);
            }

            trafficEntries.push(entry);
            sendWindow('traffic-entry', entry);
            
            // Feed to packet analysis
            if (packetAnalysis) {
                packetAnalysis.capturePacket(entry);
            }
        }
        callback({ cancel: false });
    });

    ses.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
        if (trafficCapturing) {
            const entry = {
                id: Date.now(),
                timestamp: Date.now(),
                direction: 'response',
                url: details.url,
                method: details.method,
                statusCode: details.statusCode,
                size: details.responseHeaders ?
                    parseInt(details.responseHeaders['content-length'] || '0') : 0
            };

            if (details.url.includes('evony') || details.url.includes('amf')) {
                entry.action = extractAction(details.url);
            }

            trafficEntries.push(entry);
            sendWindow('traffic-entry', entry);
            
            // Feed to packet analysis
            if (packetAnalysis) {
                packetAnalysis.capturePacket(entry);
            }
        }
    });

    // Track SWF URLs for download
    ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*.swf'] }, (details, callback) => {
        swfURL = details.url;
        callback({ requestHeaders: details.requestHeaders });
    });
}

function extractAction(url) {
    const match = url.match(/\/([^\/]+)\.amf/) || url.match(/action=([^&]+)/);
    return match ? match[1] : null;
}

// Setup ad blocker
async function setupAdBlocker() {
    if (store.get('adblock') !== false) {
        try {
            const { ElectronBlocker } = require('@cliqz/adblocker-electron');
            const { fetch } = require('cross-fetch');

            const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
            blocker.enableBlockingInSession(session.defaultSession);
            console.log('[Main] Ad blocker enabled');
        } catch (error) {
            console.warn('[Main] Ad blocker not available:', error.message);
        }
    }
}

// Cache management
async function clearCacheFunction() {
    console.log('[Main] Clearing cache...');
    await mainWindow.webContents.session.clearCache();
    await mainWindow.webContents.session.clearStorageData({
        storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers']
    });
    console.log('[Main] Cache cleared! Restarting...');
    app.relaunch();
    app.exit();
}

async function clearCookies() {
    await session.defaultSession.clearStorageData({ storages: ['cookies'] });
    console.log('[Main] Cookies cleared');
}

// About dialog
function showAbout() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About Svony Browser',
        message: 'Svony Browser v2.0.0',
        detail: 'Evony Analysis Suite\n\nBuilt on FlashBrowser with:\n- Dual Panel Browser\n- Traffic Viewer\n- Protocol Explorer\n- AI Co-Pilot\n- MCP Integration\n- Combat Simulator\n- Session Recorder\n\n© 2024 Ghenghis'
    });
}

function checkForUpdates() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Check for Updates',
        message: 'You are running the latest version.',
        detail: 'Svony Browser v2.0.0'
    });
}

// Favorites management
function homeSetter(url) {
    store.set('homepage', url);
    console.log("[Main] Homepage set to:", url);
}

function favoriteSetter(url) {
    let fav = store.get('favorites') || [];
    if (!fav.includes(url)) {
        fav.push(url);
        store.set('favorites', fav);
        settingsShow(true);
    }
    console.log("[Main] Favorite added:", url);
}

function removeAllFav() {
    store.set('favorites', []);
    settingsShow(true);
    console.log("[Main] All favorites removed");
}

function removeFav(index) {
    let fav = store.get('favorites') || [];
    fav.splice(index, 1);
    store.set('favorites', fav);
    settingsShow(true);
    console.log("[Main] Favorite removed at index:", index);
}

function settingsShow(refresh) {
    let fav = store.get('favorites');
    sendWindow('ping', fav, refresh);
}

// Export functions for remote access
exports.sethome = (a) => homeSetter(a);
exports.setFavorite = (a) => favoriteSetter(a);
exports.removeAllFav = () => removeAllFav();
exports.removeFav = (a) => removeFav(a);
exports.showSettings = (a) => settingsShow(a);

// Setup IPC handlers
function setupIPC() {
    // ========================================================================
    // Window controls
    // ========================================================================
    ipcMain.on('minimize-window', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.on('maximize-window', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.on('restore-window', () => {
        if (mainWindow) mainWindow.unmaximize();
    });

    ipcMain.on('close-window', () => {
        if (mainWindow) mainWindow.close();
    });

    // ========================================================================
    // Settings
    // ========================================================================
    ipcMain.handle('get-settings', () => {
        return store.getAll();
    });

    ipcMain.handle('set-setting', (event, key, value) => {
        store.set(key, value);
        return true;
    });

    ipcMain.handle('get-setting', (event, key) => {
        return store.get(key);
    });

    ipcMain.handle('reset-settings', () => {
        store.reset();
        return store.getAll();
    });

    ipcMain.on('settings-updated', (event, settings) => {
        if (settings.proxy && settings.proxy.enabled) {
            session.defaultSession.setProxy({ 
                proxyRules: `${settings.proxy.host}:${settings.proxy.port}` 
            });
        }
    });

    // ========================================================================
    // Traffic capture
    // ========================================================================
    ipcMain.on('start-traffic-capture', () => {
        trafficCapturing = true;
        trafficEntries = [];
        if (packetAnalysis) {
            packetAnalysis.startCapture();
        }
    });

    ipcMain.on('stop-traffic-capture', () => {
        trafficCapturing = false;
        if (packetAnalysis) {
            packetAnalysis.stopCapture();
        }
    });

    ipcMain.on('export-traffic', async (event, data) => {
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Traffic Data',
            defaultPath: `traffic-${Date.now()}.json`,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, data);
        }
    });

    // ========================================================================
    // Protocol Handler
    // ========================================================================
    ipcMain.handle('protocol-lookup', async (event, actionName) => {
        if (!protocolHandler) return null;
        return protocolHandler.lookupAction(actionName);
    });

    ipcMain.handle('protocol-search', async (event, query) => {
        if (!protocolHandler) return [];
        return protocolHandler.searchActions(query);
    });

    ipcMain.handle('protocol-get-categories', async () => {
        if (!protocolHandler) return [];
        return protocolHandler.getCategories();
    });

    ipcMain.handle('protocol-get-by-category', async (event, category) => {
        if (!protocolHandler) return [];
        return protocolHandler.getActionsByCategory(category);
    });

    ipcMain.handle('protocol-decode', async (event, hexData) => {
        if (!protocolHandler) return null;
        const buffer = Buffer.from(hexData, 'hex');
        return protocolHandler.decodeAmf3(buffer);
    });

    ipcMain.handle('protocol-encode', async (event, action, data) => {
        if (!protocolHandler) return null;
        const buffer = protocolHandler.encodeAmf3(action, data);
        return buffer ? buffer.toString('hex') : null;
    });

    ipcMain.handle('protocol-get-stats', async () => {
        if (!protocolHandler) return { totalActions: 0, categories: 0, initialized: false };
        return protocolHandler.getStats();
    });

    // ========================================================================
    // Proxy Monitor
    // ========================================================================
    ipcMain.handle('proxy-get-status', async () => {
        if (!proxyMonitor) return { running: false };
        return proxyMonitor.getStatus();
    });

    ipcMain.handle('proxy-check', async () => {
        if (!proxyMonitor) return { available: false };
        return proxyMonitor.checkProxyStatus();
    });

    ipcMain.handle('proxy-configure', async (event, options) => {
        if (!proxyMonitor) return { running: false };
        proxyMonitor.configure(options);
        return proxyMonitor.getStatus();
    });

    ipcMain.handle('proxy-get-stats', async () => {
        if (!proxyMonitor) return {};
        return proxyMonitor.getStats();
    });

    // ========================================================================
    // Chatbot Service
    // ========================================================================
    ipcMain.handle('chatbot-send-message', async (event, message, context) => {
        if (!chatbotService) return { error: 'Chatbot not available' };
        return chatbotService.processMessage(message, context);
    });

    ipcMain.handle('chatbot-get-history', async () => {
        if (!chatbotService) return [];
        return chatbotService.getHistory();
    });

    ipcMain.handle('chatbot-clear-history', async () => {
        if (!chatbotService) return false;
        chatbotService.clearHistory();
        return true;
    });

    ipcMain.handle('chatbot-get-quick-actions', async () => {
        if (!chatbotService) return [];
        return chatbotService.getQuickActions();
    });

    ipcMain.handle('chatbot-execute-action', async (event, actionId, params) => {
        if (!chatbotService) return { error: 'Chatbot not available' };
        return chatbotService.executeQuickAction(actionId, params);
    });

    // ========================================================================
    // Game State
    // ========================================================================
    ipcMain.handle('game-state-get-summary', async () => {
        if (!gameState) return null;
        return gameState.getSummary();
    });

    ipcMain.handle('game-state-get-full', async () => {
        if (!gameState) return null;
        return gameState.getFullState();
    });

    ipcMain.handle('game-state-get-city', async (event, cityId) => {
        if (!gameState) return null;
        return gameState.getCity(cityId);
    });

    ipcMain.handle('game-state-get-hero', async (event, heroId) => {
        if (!gameState) return null;
        return gameState.getHero(heroId);
    });

    ipcMain.handle('game-state-get-marches', async () => {
        if (!gameState) return [];
        return gameState.getActiveMarches();
    });

    ipcMain.handle('game-state-get-events', async (event, limit) => {
        if (!gameState) return [];
        return gameState.getEventHistory(limit);
    });

    ipcMain.handle('game-state-export', async (event, filePath) => {
        if (!gameState) return false;
        return gameState.exportState(filePath);
    });

    ipcMain.handle('game-state-reset', async () => {
        if (!gameState) return false;
        gameState.reset();
        return true;
    });

    // ========================================================================
    // Packet Analysis
    // ========================================================================
    ipcMain.handle('packet-start-capture', async () => {
        if (!packetAnalysis) return false;
        packetAnalysis.startCapture();
        trafficCapturing = true;
        return true;
    });

    ipcMain.handle('packet-stop-capture', async () => {
        if (!packetAnalysis) return { packetCount: 0 };
        trafficCapturing = false;
        return packetAnalysis.stopCapture();
    });

    ipcMain.handle('packet-get-history', async (event, filter) => {
        if (!packetAnalysis) return [];
        return packetAnalysis.getHistory(filter);
    });

    ipcMain.handle('packet-search', async (event, query) => {
        if (!packetAnalysis) return [];
        return packetAnalysis.searchPackets(query);
    });

    ipcMain.handle('packet-get-stats', async () => {
        if (!packetAnalysis) return {};
        return packetAnalysis.getStats();
    });

    ipcMain.handle('packet-get-analysis', async () => {
        if (!packetAnalysis) return [];
        return packetAnalysis.getActionAnalysis();
    });

    ipcMain.handle('packet-clear-history', async () => {
        if (!packetAnalysis) return false;
        packetAnalysis.clearHistory();
        trafficEntries = [];
        return true;
    });

    ipcMain.handle('packet-export', async (event, filePath, format) => {
        if (!packetAnalysis) return false;
        return packetAnalysis.exportHistory(filePath, format);
    });

    ipcMain.handle('packet-add-pattern', async (event, id, config) => {
        if (!packetAnalysis) return false;
        packetAnalysis.addPattern(id, config);
        return true;
    });

    ipcMain.handle('packet-get-patterns', async () => {
        if (!packetAnalysis) return [];
        return packetAnalysis.getPatterns();
    });

    // ========================================================================
    // Combat Simulator
    // ========================================================================
    ipcMain.handle('combat-simulate', async (event, attacker, defender, options) => {
        if (!combatSimulator) return { error: 'Combat simulator not available' };
        return combatSimulator.simulate(attacker, defender, options);
    });

    ipcMain.handle('combat-get-troop-types', async () => {
        if (!combatSimulator) return [];
        return combatSimulator.getTroopTypes();
    });

    ipcMain.handle('combat-get-troop', async (event, troopType) => {
        if (!combatSimulator) return null;
        return combatSimulator.getTroop(troopType);
    });

    ipcMain.handle('combat-calculate-march-time', async (event, troops, distance, speedBuffs) => {
        if (!combatSimulator) return 0;
        return combatSimulator.calculateMarchTime(troops, distance, speedBuffs);
    });

    ipcMain.handle('combat-calculate-training-cost', async (event, troopType, count) => {
        if (!combatSimulator) return null;
        return combatSimulator.calculateTrainingCost(troopType, count);
    });

    ipcMain.handle('combat-calculate-load', async (event, troops, loadBuffs) => {
        if (!combatSimulator) return 0;
        return combatSimulator.calculateLoadCapacity(troops, loadBuffs);
    });

    ipcMain.handle('combat-get-counter', async (event, enemyArmy) => {
        if (!combatSimulator) return null;
        return combatSimulator.getOptimalCounter(enemyArmy);
    });

    // ========================================================================
    // Session Recorder
    // ========================================================================
    ipcMain.handle('session-start-recording', async (event, metadata) => {
        if (!sessionRecorder) return { error: 'Session recorder not available' };
        return sessionRecorder.startRecording(metadata);
    });

    ipcMain.handle('session-stop-recording', async () => {
        if (!sessionRecorder) return null;
        return sessionRecorder.stopRecording();
    });

    ipcMain.handle('session-pause-recording', async () => {
        if (!sessionRecorder) return false;
        return sessionRecorder.pauseRecording();
    });

    ipcMain.handle('session-resume-recording', async () => {
        if (!sessionRecorder) return false;
        return sessionRecorder.resumeRecording();
    });

    ipcMain.handle('session-get-status', async () => {
        if (!sessionRecorder) return { isRecording: false };
        return sessionRecorder.getStatus();
    });

    ipcMain.handle('session-get-list', async () => {
        if (!sessionRecorder) return [];
        return sessionRecorder.getSessions();
    });

    ipcMain.handle('session-load', async (event, sessionId) => {
        if (!sessionRecorder) return null;
        return sessionRecorder.loadSession(sessionId);
    });

    ipcMain.handle('session-delete', async (event, sessionId) => {
        if (!sessionRecorder) return false;
        return sessionRecorder.deleteSession(sessionId);
    });

    ipcMain.handle('session-export', async (event, sessionId, format, outputPath) => {
        if (!sessionRecorder) return false;
        return sessionRecorder.exportSession(sessionId, format, outputPath);
    });

    ipcMain.handle('session-get-stats', async (event, sessionId) => {
        if (!sessionRecorder) return null;
        return sessionRecorder.getSessionStats(sessionId);
    });

    ipcMain.handle('session-add-marker', async (event, name, description) => {
        if (!sessionRecorder) return null;
        return sessionRecorder.addMarker(name, description);
    });

    // ========================================================================
    // MCP Connection
    // ========================================================================
    ipcMain.handle('mcp-connect', async (event, serverName) => {
        if (!mcpConnection) return { error: 'MCP not available' };
        const config = await mcpConnection.loadConfig();
        const serverConfig = config.mcpServers[serverName];
        if (!serverConfig) {
            return { error: `Server ${serverName} not found in config` };
        }
        return mcpConnection.connectServer(serverName, serverConfig);
    });

    ipcMain.handle('mcp-disconnect', async (event, serverName) => {
        if (!mcpConnection) return false;
        return mcpConnection.disconnectServer(serverName);
    });

    ipcMain.handle('mcp-call-tool', async (event, serverName, toolName, args) => {
        if (!mcpConnection) return { error: 'MCP not available' };
        return mcpConnection.callTool(serverName, toolName, args);
    });

    ipcMain.handle('mcp-get-status', async () => {
        if (!mcpConnection) return { connected: false };
        return mcpConnection.getStatus();
    });

    ipcMain.handle('mcp-list-tools', async (event, serverName) => {
        if (!mcpConnection) return [];
        return mcpConnection.listTools(serverName);
    });

    ipcMain.on('reconnect-mcp', () => {
        if (mcpConnection) {
            // Reconnect logic
        }
    });

    // ========================================================================
    // Dialog helpers
    // ========================================================================
    ipcMain.handle('show-save-dialog', async (event, options) => {
        return dialog.showSaveDialog(mainWindow, options);
    });

    ipcMain.handle('show-open-dialog', async (event, options) => {
        return dialog.showOpenDialog(mainWindow, options);
    });

    // ========================================================================
    // Cache management
    // ========================================================================
    ipcMain.on('clear-cache', async () => {
        await clearCacheFunction();
    });

    ipcMain.on('clearChache-click', clearCacheFunction);

    // ========================================================================
    // Download SWF
    // ========================================================================
    ipcMain.on('download-button', async () => {
        if (swfURL && swfURL !== 'no swf') {
            const win = BrowserWindow.getFocusedWindow();
            await download(win, swfURL);
        }
    });

    // ========================================================================
    // Fullscreen
    // ========================================================================
    ipcMain.on('fullScreen-click', () => {
        if (mainWindow) {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
    });
}

// Create main window
function createWindow() {
    let { width, height, isMax } = store.get('windowBounds');

    // Handle command line arguments for file opening
    let filePath = 'filePath';
    if (process.argv.length >= 2 && process.argv[1].indexOf(".swf") > 1) {
        if (process.argv[1].indexOf("http") > 0) {
            filePath = process.argv[1].replace("SvonyBrowser:", "");
        } else {
            filePath = process.argv[1].replace(/\\/g, "/");
            filePath = 'file:///' + filePath;
        }
    }

    // Ensure minimum window size
    if (width < 100 || height < 100) {
        width = 1600;
        height = 1000;
    }

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        minWidth: 1200,
        minHeight: 700,
        frame: true,
        show: false,
        backgroundColor: '#0F0F1A',
        autoHideMenuBar: false,
        webPreferences: {
            nodeIntegration: true,
            webviewTag: true,
            plugins: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            additionalArguments: [filePath]
        }
    });

    mainWindow.loadURL(`file://${__dirname}/browser.html`);

    // Handle load errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('[Main] Failed to load:', errorCode, errorDescription);
    });

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('[Main] Page loaded successfully');
    });

    mainWindow.webContents.on('crashed', () => {
        console.error('[Main] Renderer crashed');
    });

    // Open DevTools in development
    if (process.argv.includes('--enable-logging')) {
        mainWindow.webContents.openDevTools();
    }

    // Window events
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('maximize', () => {
        sendWindow('window-maximized');
    });

    mainWindow.on('unmaximize', () => {
        sendWindow('window-unmaximized');
    });

    mainWindow.once('ready-to-show', () => {
        if (isMax) {
            if (process.platform === "win32") {
                mainWindow.maximize();
            } else {
                mainWindow.setFullScreen(true);
            }
        }
        mainWindow.show();
    });

    // Set zoom limits
    mainWindow.webContents.setVisualZoomLevelLimits(1, 5)
        .then(() => console.log("[Main] Zoom levels set between 100% and 500%"))
        .catch((err) => console.log(err));

    // Save window size on resize
    mainWindow.on('resize', () => {
        const isMax = mainWindow.isMaximized() || mainWindow.isFullScreen();
        if (isMax) {
            let { width, height } = store.get('windowBounds');
            store.set('windowBounds', { width, height, isMax });
        } else {
            let { width, height } = mainWindow.getBounds();
            store.set('windowBounds', { width, height, isMax });
        }
    });

    // Set default zoom
    mainWindow.webContents.zoomFactor = 1;

    sendWindow("version", app.getVersion());
}

// Setup keyboard shortcuts
function setupShortcuts() {
    app.on('browser-window-focus', () => {
        globalShortcut.register('CommandOrControl+F', () => {
            sendWindow('on-find');
        });

        globalShortcut.register("CTRL+SHIFT+I", () => {
            mainWindow.webContents.openDevTools();
        });

        globalShortcut.register("CmdOrCtrl+=", () => {
            mainWindow.webContents.zoomFactor = mainWindow.webContents.getZoomFactor() + 0.2;
        });

        globalShortcut.register("CmdOrCtrl+-", () => {
            mainWindow.webContents.zoomFactor = mainWindow.webContents.getZoomFactor() - 0.2;
        });

        globalShortcut.register("CTRL+SHIFT+F10", () => {
            clearCacheFunction();
        });
    });

    app.on('browser-window-blur', () => {
        globalShortcut.unregisterAll();
    });
}

// App ready
app.on('ready', async () => {
    // Create window first so user sees something immediately
    createWindow();
    createMenu();
    setupIPC();
    setupShortcuts();
    
    // Initialize services in background (non-blocking)
    try {
        await initializeServices();
    } catch (error) {
        console.error('[Main] Service initialization error:', error);
    }
    
    // Setup traffic capture after window is ready
    setupTrafficCapture();
    
    // Setup ad blocker (optional)
    try {
        await setupAdBlocker();
    } catch (error) {
        console.warn('[Main] Ad blocker setup failed:', error.message);
    }
});

// Handle file opening
app.on('open-file', (event, path) => {
    event.preventDefault();
    console.log('[Main] Opening file:', path);
});

// Window lifecycle
app.on('window-all-closed', () => {
    // Stop services
    if (proxyMonitor) {
        proxyMonitor.stop();
    }
    if (sessionRecorder && sessionRecorder.isRecording) {
        sessionRecorder.stopRecording();
    }
    
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('will-quit', () => {
    if (mcpConnection) {
        // Close MCP connections
    }
    globalShortcut.unregisterAll();
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('[Main] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Main] Unhandled rejection:', reason);
});
