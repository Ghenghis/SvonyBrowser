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
let fiddlerBridge = null;
let gameStateTracker = null;
let mcpClientManager = null;
let playwrightService = null;
let amf3Decoder = null;

// v2.0.9+ Services
let debugManager = null;
let networkInspector = null;
let performanceProfiler = null;
let scriptRecorder = null;
let scriptRunner = null;
let automationTemplates = null;
let agentController = null;
let voiceService = null;
let chatbotPlugins = null;
let panelManager = null;
let panelPlaywrightBridge = null;

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
        lmStudio: {
            enabled: true,
            url: 'http://localhost:1234',
            model: 'local-model',
            temperature: 0.7,
            maxTokens: 2048
        },
        traffic: {
            captureEnabled: true,
            maxPackets: 10000
        }
    }
});

// Flash plugin configuration
let pluginName = null;
let flashFound = false;

// Function to find Flash plugin
function findFlashPlugin() {
    const flashDir = path.join(__dirname, 'flashver');
    
    // Define possible Flash plugin names for each platform
    const flashNames = {
        win32: {
            x64: [
                'pepflashplayer64_32_0_0_465.dll',
                'pepflashplayer64.dll',
                'pepflashplayer.dll'
            ],
            ia32: [
                'pepflashplayer32_32_0_0_465.dll',
                'pepflashplayer32.dll',
                'pepflashplayer.dll'
            ],
            x32: [
                'pepflashplayer32_32_0_0_465.dll',
                'pepflashplayer32.dll',
                'pepflashplayer.dll'
            ]
        },
        linux: {
            x64: ['libpepflashplayer.so'],
            ia32: ['libpepflashplayer.so']
        },
        darwin: {
            x64: ['PepperFlashPlayer.plugin'],
            arm64: ['PepperFlashPlayer.plugin']
        }
    };
    
    const platform = process.platform;
    const arch = process.arch;
    
    if (flashNames[platform] && flashNames[platform][arch]) {
        for (const name of flashNames[platform][arch]) {
            const fullPath = path.join(flashDir, name);
            if (fs.existsSync(fullPath)) {
                console.log(`[Flash] Found Flash plugin: ${name}`);
                return `flashver/${name}`;
            }
        }
    }
    
    // Also check for any pepflashplayer*.dll file
    if (platform === 'win32' && fs.existsSync(flashDir)) {
        try {
            const files = fs.readdirSync(flashDir);
            for (const file of files) {
                if (file.startsWith('pepflashplayer') && file.endsWith('.dll')) {
                    console.log(`[Flash] Found Flash plugin: ${file}`);
                    return `flashver/${file}`;
                }
            }
        } catch (e) {
            console.warn('[Flash] Error scanning flashver directory:', e.message);
        }
    }
    
    return null;
}

// Find Flash plugin
pluginName = findFlashPlugin();
flashFound = pluginName !== null;

if (!flashFound) {
    console.warn('[Flash] Flash plugin NOT found in flashver/ directory!');
    console.warn('[Flash] Please see flashver/README.md for instructions on obtaining Flash Player files.');
}

switch (process.platform) {
    case 'linux':
        app.commandLine.appendSwitch('no-sandbox');
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
        
        // LM Studio Client
        let lmStudioClient = null;
        try {
            const { LMStudioClient } = require('./services/lm-studio-client');
            const lmSettings = store.get('lmStudio') || {};
            lmStudioClient = new LMStudioClient({
                baseUrl: lmSettings.url || 'http://localhost:1234',
                model: lmSettings.model || 'local-model',
                temperature: lmSettings.temperature || 0.7,
                maxTokens: lmSettings.maxTokens || 2048
            });
            
            // Check connection
            const connected = await lmStudioClient.checkConnection();
            console.log('[Main] LM Studio Client initialized, connected:', connected);
            
            // Start auto-reconnect monitoring
            lmStudioClient.startAutoReconnect(30000);
            
            // Listen for connection events
            lmStudioClient.on('connected', (data) => {
                console.log('[Main] LM Studio connected:', data.models);
                if (mainWindow) {
                    sendWindow('lm-studio-status', { 
                        connected: true, 
                        models: data.models,
                        url: lmStudioClient.config.baseUrl
                    });
                }
            });
            
            lmStudioClient.on('disconnected', (data) => {
                console.log('[Main] LM Studio disconnected:', data.error);
                if (mainWindow) {
                    sendWindow('lm-studio-status', { 
                        connected: false, 
                        error: data.error
                    });
                }
            });
            
            // Notify renderer of initial connection status
            if (mainWindow) {
                sendWindow('lm-studio-status', { 
                    connected, 
                    models: lmStudioClient.availableModels,
                    url: lmStudioClient.config.baseUrl
                });
            }
            
            // Store reference globally for IPC handlers
            global.lmStudioClient = lmStudioClient;
        } catch (e) {
            console.warn('[Main] LM Studio Client not available:', e.message);
        }
        
        // Chatbot Service
        try {
            chatbotService = require('./services/chatbot-service');
            await chatbotService.initialize();
            
            // Pass LM Studio client to chatbot if available
            if (global.lmStudioClient) {
                chatbotService.lmStudioClient = global.lmStudioClient;
            }
            
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
        
        // AMF3 Decoder
        try {
            const { AMF3Decoder } = require('./services/amf3-decoder');
            amf3Decoder = new AMF3Decoder();
            console.log('[Main] AMF3 Decoder initialized');
        } catch (e) {
            console.warn('[Main] AMF3 Decoder not available:', e.message);
        }
        
        // Fiddler Bridge
        try {
            const { FiddlerBridge } = require('./services/fiddler-bridge');
            fiddlerBridge = new FiddlerBridge();
            console.log('[Main] Fiddler Bridge initialized');
            
            fiddlerBridge.on('connected', () => {
                sendWindow('fiddler-connected');
            });
            
            fiddlerBridge.on('disconnected', () => {
                sendWindow('fiddler-disconnected');
            });
            
            fiddlerBridge.on('traffic', (entry) => {
                sendWindow('fiddler-traffic', entry);
                // Feed to packet analysis
                if (packetAnalysis && entry.body) {
                    packetAnalysis.processPacket(entry);
                }
            });
        } catch (e) {
            console.warn('[Main] Fiddler Bridge not available:', e.message);
        }
        
        // Game State Tracker
        try {
            const { GameStateTracker } = require('./services/game-state-tracker');
            gameStateTracker = new GameStateTracker();
            console.log('[Main] Game State Tracker initialized');
            
            gameStateTracker.on('stateUpdated', (state) => {
                sendWindow('game-state-updated', state);
            });
            
            gameStateTracker.on('eventDetected', (event) => {
                sendWindow('game-event-detected', event);
            });
        } catch (e) {
            console.warn('[Main] Game State Tracker not available:', e.message);
        }
        
        // MCP Client Manager
        try {
            const { MCPClientManager } = require('./services/mcp-client-manager');
            mcpClientManager = new MCPClientManager();
            console.log('[Main] MCP Client Manager initialized');
            
            mcpClientManager.on('serverConnected', (serverName) => {
                sendWindow('mcp-server-connected', serverName);
            });
            
            mcpClientManager.on('serverDisconnected', (serverName) => {
                sendWindow('mcp-server-disconnected', serverName);
            });
            
            mcpClientManager.on('toolResult', (result) => {
                sendWindow('mcp-tool-result', result);
            });
        } catch (e) {
            console.warn('[Main] MCP Client Manager not available:', e.message);
        }
        
        // Playwright Service (lazy load - only when needed)
        try {
            const { PlaywrightService } = require('./services/playwright-service');
            playwrightService = new PlaywrightService();
            console.log('[Main] Playwright Service loaded (not started)');
        } catch (e) {
            console.warn('[Main] Playwright Service not available:', e.message);
        }
        
        // Traffic Processor - Wire traffic to game state
        try {
            const { TrafficProcessor } = require('./services/traffic-processor');
            global.trafficProcessor = new TrafficProcessor({
                amf3Decoder,
                gameStateTracker,
                sessionRecorder
            });
            console.log('[Main] Traffic Processor initialized');
            
            // Wire traffic capture to processor
            global.trafficProcessor.on('packetDecoded', (packet) => {
                sendWindow('packet-decoded', packet);
            });
            
            global.trafficProcessor.on('gameStateUpdate', (update) => {
                sendWindow('game-state-update', update);
            });
        } catch (e) {
            console.warn('[Main] Traffic Processor not available:', e.message);
        }
        
        // Conversation Memory for Chatbot
        try {
            const { ConversationMemory } = require('./services/conversation-memory');
            global.conversationMemory = new ConversationMemory({
                maxMessages: 100,
                maxContextTokens: 4000,
                persistPath: path.join(app.getPath('userData'), 'conversation-memory.json')
            });
            console.log('[Main] Conversation Memory initialized');
            
            // Wire to chatbot if available
            if (chatbotService) {
                chatbotService.conversationMemory = global.conversationMemory;
            }
        } catch (e) {
            console.warn('[Main] Conversation Memory not available:', e.message);
        }
        
        // Intent Router for intelligent query routing
        try {
            const { IntentRouter } = require('./services/intent-router');
            global.intentRouter = new IntentRouter({
                lmStudioClient: global.lmStudioClient,
                mcpManager: mcpClientManager,
                confidenceThreshold: 0.6
            });
            console.log('[Main] Intent Router initialized');
            
            // Wire to chatbot if available
            if (chatbotService) {
                chatbotService.intentRouter = global.intentRouter;
            }
        } catch (e) {
            console.warn('[Main] Intent Router not available:', e.message);
        }
        
        // v2.0.9+ Services Initialization
        
        // Debug Manager
        try {
            const { DebugManager } = require('./services/debug-manager');
            debugManager = new DebugManager({
                logDir: path.join(app.getPath('userData'), 'logs'),
                maxLogFiles: 10,
                maxLogSize: 10 * 1024 * 1024
            });
            global.debugManager = debugManager;
            console.log('[Main] Debug Manager initialized');
            
            debugManager.on('logEntry', (entry) => {
                sendWindow('debug-log-entry', entry);
            });
        } catch (e) {
            console.warn('[Main] Debug Manager not available:', e.message);
        }
        
        // Network Inspector
        try {
            const { NetworkInspector } = require('./services/network-inspector');
            networkInspector = new NetworkInspector();
            global.networkInspector = networkInspector;
            console.log('[Main] Network Inspector initialized');
            
            networkInspector.on('request', (req) => {
                sendWindow('network-request', req);
            });
            
            networkInspector.on('response', (res) => {
                sendWindow('network-response', res);
            });
        } catch (e) {
            console.warn('[Main] Network Inspector not available:', e.message);
        }
        
        // Performance Profiler
        try {
            const { PerformanceProfiler } = require('./services/performance-profiler');
            performanceProfiler = new PerformanceProfiler();
            global.performanceProfiler = performanceProfiler;
            console.log('[Main] Performance Profiler initialized');
            
            performanceProfiler.on('metrics', (metrics) => {
                sendWindow('performance-metrics', metrics);
            });
        } catch (e) {
            console.warn('[Main] Performance Profiler not available:', e.message);
        }
        
        // Script Recorder
        try {
            const { ScriptRecorder } = require('./services/script-recorder');
            scriptRecorder = new ScriptRecorder({
                outputDir: path.join(app.getPath('userData'), 'scripts')
            });
            global.scriptRecorder = scriptRecorder;
            console.log('[Main] Script Recorder initialized');
            
            scriptRecorder.on('actionRecorded', (action) => {
                sendWindow('script-action-recorded', action);
            });
            
            scriptRecorder.on('recordingComplete', (script) => {
                sendWindow('script-recording-complete', script);
            });
        } catch (e) {
            console.warn('[Main] Script Recorder not available:', e.message);
        }
        
        // Script Runner
        try {
            const { ScriptRunner } = require('./services/script-runner');
            scriptRunner = new ScriptRunner({
                maxConcurrent: 3,
                playwrightService
            });
            global.scriptRunner = scriptRunner;
            console.log('[Main] Script Runner initialized');
            
            scriptRunner.on('scriptStarted', (info) => {
                sendWindow('script-started', info);
            });
            
            scriptRunner.on('scriptCompleted', (result) => {
                sendWindow('script-completed', result);
            });
            
            scriptRunner.on('scriptError', (error) => {
                sendWindow('script-error', error);
            });
        } catch (e) {
            console.warn('[Main] Script Runner not available:', e.message);
        }
        
        // Automation Templates
        try {
            const { AutomationTemplates } = require('./services/automation-templates');
            automationTemplates = new AutomationTemplates();
            global.automationTemplates = automationTemplates;
            console.log('[Main] Automation Templates initialized');
        } catch (e) {
            console.warn('[Main] Automation Templates not available:', e.message);
        }
        
        // Agent Controller
        try {
            const { AgentController } = require('./services/agent-controller');
            agentController = new AgentController({
                lmStudioClient: global.lmStudioClient,
                gameStateTracker,
                scriptRunner,
                automationTemplates
            });
            global.agentController = agentController;
            
            // Connect Playwright services to Agent Controller
            if (playwrightService) {
                agentController.setPlaywrightService(playwrightService);
            }
            if (panelPlaywrightBridge) {
                agentController.setPanelPlaywrightBridge(panelPlaywrightBridge);
            }
            
            console.log('[Main] Agent Controller initialized with Playwright integration');
            
            agentController.on('goalSet', (goal) => {
                sendWindow('agent-goal-set', goal);
            });
            
            agentController.on('actionExecuted', (action) => {
                sendWindow('agent-action-executed', action);
            });
            
            agentController.on('decisionMade', (decision) => {
                sendWindow('agent-decision-made', decision);
            });
        } catch (e) {
            console.warn('[Main] Agent Controller not available:', e.message);
        }
        
        // Voice Service
        try {
            const { VoiceService } = require('./services/voice-service');
            voiceService = new VoiceService();
            global.voiceService = voiceService;
            console.log('[Main] Voice Service initialized');
            
            voiceService.on('speechRecognized', (text) => {
                sendWindow('voice-recognized', text);
            });
            
            voiceService.on('speaking', (status) => {
                sendWindow('voice-speaking', status);
            });
        } catch (e) {
            console.warn('[Main] Voice Service not available:', e.message);
        }
        
        // Chatbot Plugins
        try {
            const { ChatbotPluginManager } = require('./services/chatbot-plugins');
            chatbotPlugins = new ChatbotPluginManager();
            global.chatbotPlugins = chatbotPlugins;
            console.log('[Main] Chatbot Plugins initialized');
            
            // Wire to chatbot if available
            if (chatbotService) {
                chatbotService.pluginManager = chatbotPlugins;
            }
        } catch (e) {
            console.warn('[Main] Chatbot Plugins not available:', e.message);
        }
        
        // Panel Manager
        try {
            const { PanelManager } = require('./services/panel-manager');
            panelManager = new PanelManager();
            global.panelManager = panelManager;
            console.log('[Main] Panel Manager initialized');
            
            panelManager.on('panelStateChanged', (state) => {
                sendWindow('panel-state-changed', state);
            });
            
            panelManager.on('panelError', (error) => {
                sendWindow('panel-error', error);
            });
        } catch (e) {
            console.warn('[Main] Panel Manager not available:', e.message);
        }
        
        // Panel Playwright Bridge
        try {
            const { PanelPlaywrightBridge } = require('./services/panel-playwright-bridge');
            panelPlaywrightBridge = new PanelPlaywrightBridge({
                playwrightService,
                panelManager
            });
            global.panelPlaywrightBridge = panelPlaywrightBridge;
            console.log('[Main] Panel Playwright Bridge initialized');
        } catch (e) {
            console.warn('[Main] Panel Playwright Bridge not available:', e.message);
        }
        
        // Configure Game State Tracker persistence
        if (gameStateTracker) {
            gameStateTracker.configurePersistence({
                path: path.join(app.getPath('userData'), 'game-state.json'),
                autoSave: true,
                autoSaveDelay: 30000
            });
            
            // Try to load saved state
            gameStateTracker.loadState();
        }
        
        // Error Tracking System
        let errorTracker, errorHelper, selfHealer;
        try {
            const { ErrorTracker } = require('./services/error-tracker');
            errorTracker = new ErrorTracker();
            global.errorTracker = errorTracker;
            console.log('[Main] Error Tracker initialized');
            
            // Track errors from all services
            errorTracker.on('error-tracked', (error) => {
                sendWindow('error-tracked', error);
            });
        } catch (e) {
            console.warn('[Main] Error Tracker not available:', e.message);
        }
        
        // Error Helper (solution suggestions)
        try {
            const { ErrorHelper } = require('./services/error-helper');
            errorHelper = new ErrorHelper();
            global.errorHelper = errorHelper;
            console.log('[Main] Error Helper initialized');
        } catch (e) {
            console.warn('[Main] Error Helper not available:', e.message);
        }
        
        // Self Healer (automatic error recovery)
        try {
            const { SelfHealer } = require('./services/self-healer');
            selfHealer = new SelfHealer();
            global.selfHealer = selfHealer;
            console.log('[Main] Self Healer initialized');
            
            // Wire services for healing
            selfHealer.setServices({
                lmStudioClient,
                mcpClientManager,
                playwrightService,
                panelManager
            });
            
            // Listen for healing events
            selfHealer.on('healing-start', (data) => {
                sendWindow('healing-start', data);
            });
            
            selfHealer.on('healing-complete', (data) => {
                sendWindow('healing-complete', data);
            });
            
            selfHealer.on('user-action-required', (data) => {
                sendWindow('user-action-required', data);
            });
        } catch (e) {
            console.warn('[Main] Self Healer not available:', e.message);
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
    const version = app.getVersion();
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About Svony Browser',
        message: `Svony Browser v${version}`,
        detail: 'Evony Analysis Suite\n\nBuilt on FlashBrowser with:\n- Dual Panel Browser\n- Traffic Viewer\n- Protocol Explorer\n- AI Co-Pilot with LM Studio\n- MCP Integration\n- Combat Simulator\n- Session Recorder\n\n© 2024-2025 Ghenghis'
    });
}

async function checkForUpdates() {
    const version = app.getVersion();
    try {
        // Check GitHub releases for latest version
        const https = require('https');
        const options = {
            hostname: 'api.github.com',
            path: '/repos/Ghenghis/Svony-Browser/releases/latest',
            headers: { 'User-Agent': 'SvonyBrowser' }
        };
        
        const req = https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const release = JSON.parse(data);
                    const latestVersion = release.tag_name.replace('v', '');
                    
                    if (latestVersion > version) {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Update Available',
                            message: `A new version is available: v${latestVersion}`,
                            detail: `You are running v${version}\n\nWould you like to download the update?`,
                            buttons: ['Download', 'Later'],
                            defaultId: 0
                        }).then(result => {
                            if (result.response === 0) {
                                shell.openExternal(release.html_url);
                            }
                        });
                    } else {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'No Updates',
                            message: 'You are running the latest version.',
                            detail: `Svony Browser v${version}`
                        });
                    }
                } catch (e) {
                    showUpdateError(version);
                }
            });
        });
        
        req.on('error', () => showUpdateError(version));
        req.end();
    } catch (error) {
        showUpdateError(version);
    }
}

function showUpdateError(version) {
    dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Update Check Failed',
        message: 'Could not check for updates.',
        detail: `Current version: v${version}\n\nPlease check manually at:\nhttps://github.com/Ghenghis/Svony-Browser/releases`
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
    // LM Studio
    // ========================================================================
    ipcMain.handle('lm-studio-connect', async (event, url) => {
        try {
            const { LMStudioClient } = require('./services/lm-studio-client');
            const lmSettings = store.get('lmStudio') || {};
            
            // Update URL if provided
            if (url) {
                lmSettings.url = url;
                store.set('lmStudio', lmSettings);
            }
            
            global.lmStudioClient = new LMStudioClient({
                baseUrl: url || lmSettings.url || 'http://localhost:1234',
                model: lmSettings.model || 'local-model'
            });
            
            const connected = await global.lmStudioClient.checkConnection();
            
            // Update chatbot service reference
            if (chatbotService && global.lmStudioClient) {
                chatbotService.lmStudioClient = global.lmStudioClient;
            }
            
            return {
                connected,
                models: global.lmStudioClient.availableModels,
                url: global.lmStudioClient.config.baseUrl
            };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    });

    ipcMain.handle('lm-studio-status', async () => {
        if (!global.lmStudioClient) {
            return { connected: false, models: [], url: '' };
        }
        return global.lmStudioClient.getStatus();
    });

    ipcMain.handle('lm-studio-chat', async (event, messages, options) => {
        if (!global.lmStudioClient) {
            return { error: 'LM Studio not connected' };
        }
        try {
            return await global.lmStudioClient.chatCompletion(messages, options);
        } catch (error) {
            return { error: error.message };
        }
    });

    ipcMain.handle('lm-studio-models', async () => {
        if (!global.lmStudioClient) {
            return [];
        }
        try {
            return await global.lmStudioClient.listModels();
        } catch (error) {
            return [];
        }
    });

    ipcMain.handle('lm-studio-update-settings', async (event, settings) => {
        const current = store.get('lmStudio') || {};
        const updated = { ...current, ...settings };
        store.set('lmStudio', updated);
        
        // Reconnect with new settings
        if (global.lmStudioClient) {
            global.lmStudioClient.updateConfig(settings);
        }
        
        return updated;
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

    // ========================================================================
    // Version and Status
    // ========================================================================
    ipcMain.handle('get-version', () => {
        return app.getVersion();
    });

    ipcMain.handle('get-flash-status', () => {
        return {
            found: flashFound,
            plugin: pluginName,
            path: pluginName ? path.join(__dirname, pluginName) : null
        };
    });

    // ========================================================================
    // External Tools
    // ========================================================================
    ipcMain.on('open-fiddler', () => {
        // Try to open Fiddler if installed
        const fiddlerPaths = [
            'C:\\Program Files\\Fiddler\\Fiddler.exe',
            'C:\\Program Files (x86)\\Fiddler\\Fiddler.exe',
            'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Programs\\Fiddler\\Fiddler.exe'
        ];
        
        let fiddlerFound = false;
        for (const fiddlerPath of fiddlerPaths) {
            if (fs.existsSync(fiddlerPath)) {
                require('child_process').spawn(fiddlerPath, [], { detached: true });
                fiddlerFound = true;
                break;
            }
        }
        
        if (!fiddlerFound) {
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Fiddler Not Found',
                message: 'Fiddler is not installed.',
                detail: 'Would you like to download Fiddler?',
                buttons: ['Download', 'Cancel'],
                defaultId: 0
            }).then(result => {
                if (result.response === 0) {
                    shell.openExternal('https://www.telerik.com/fiddler');
                }
            });
        }
    });

    ipcMain.on('open-sol-editor', async () => {
        // Open file dialog to select SOL file
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Open SOL File',
            filters: [
                { name: 'Flash Shared Objects', extensions: ['sol'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            const solPath = result.filePaths[0];
            // Send to renderer for display
            sendWindow('sol-file-opened', { path: solPath });
        }
    });

    // ========================================================================
    // File Browse Dialogs
    // ========================================================================
    ipcMain.handle('browse-file', async (event, options) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: options.title || 'Select File',
            filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
            properties: ['openFile']
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });

    ipcMain.handle('browse-swf', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select SWF File',
            filters: [
                { name: 'Flash Files', extensions: ['swf'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });

    // ========================================================================
    // AMF3 Decoder
    // ========================================================================
    ipcMain.handle('amf3-decode', async (event, hexData) => {
        if (!amf3Decoder) return { error: 'AMF3 Decoder not available' };
        try {
            const buffer = Buffer.from(hexData, 'hex');
            return amf3Decoder.decode(buffer);
        } catch (error) {
            return { error: error.message };
        }
    });

    ipcMain.handle('amf3-encode', async (event, data) => {
        if (!amf3Decoder) return { error: 'AMF3 Decoder not available' };
        try {
            const buffer = amf3Decoder.encode(data);
            return buffer.toString('hex');
        } catch (error) {
            return { error: error.message };
        }
    });

    // ========================================================================
    // Fiddler Bridge
    // ========================================================================
    ipcMain.handle('fiddler-connect', async () => {
        if (!fiddlerBridge) return { error: 'Fiddler Bridge not available' };
        return fiddlerBridge.connect();
    });

    ipcMain.handle('fiddler-disconnect', async () => {
        if (!fiddlerBridge) return false;
        return fiddlerBridge.disconnect();
    });

    ipcMain.handle('fiddler-status', async () => {
        if (!fiddlerBridge) return { connected: false };
        return fiddlerBridge.getStatus();
    });

    ipcMain.handle('fiddler-get-traffic', async (event, filter) => {
        if (!fiddlerBridge) return [];
        return fiddlerBridge.getTraffic(filter);
    });

    ipcMain.handle('fiddler-clear-traffic', async () => {
        if (!fiddlerBridge) return false;
        fiddlerBridge.clearTraffic();
        return true;
    });

    ipcMain.handle('fiddler-inject-request', async (event, request) => {
        if (!fiddlerBridge) return { error: 'Fiddler Bridge not available' };
        return fiddlerBridge.injectRequest(request);
    });

    ipcMain.handle('fiddler-set-breakpoint', async (event, pattern, enabled) => {
        if (!fiddlerBridge) return false;
        return fiddlerBridge.setBreakpoint(pattern, enabled);
    });

    ipcMain.handle('fiddler-get-breakpoints', async () => {
        if (!fiddlerBridge) return [];
        return fiddlerBridge.getBreakpoints();
    });

    // ========================================================================
    // Game State Tracker
    // ========================================================================
    ipcMain.handle('game-tracker-get-state', async () => {
        if (!gameStateTracker) return null;
        return gameStateTracker.getState();
    });

    ipcMain.handle('game-tracker-get-player', async () => {
        if (!gameStateTracker) return null;
        return gameStateTracker.getPlayer();
    });

    ipcMain.handle('game-tracker-get-cities', async () => {
        if (!gameStateTracker) return [];
        return gameStateTracker.getCities();
    });

    ipcMain.handle('game-tracker-get-heroes', async () => {
        if (!gameStateTracker) return [];
        return gameStateTracker.getHeroes();
    });

    ipcMain.handle('game-tracker-get-armies', async () => {
        if (!gameStateTracker) return [];
        return gameStateTracker.getArmies();
    });

    ipcMain.handle('game-tracker-get-resources', async () => {
        if (!gameStateTracker) return {};
        return gameStateTracker.getResources();
    });

    ipcMain.handle('game-tracker-get-events', async (event, limit) => {
        if (!gameStateTracker) return [];
        return gameStateTracker.getEvents(limit);
    });

    ipcMain.handle('game-tracker-export', async (event, format) => {
        if (!gameStateTracker) return null;
        return gameStateTracker.exportState(format);
    });

    ipcMain.handle('game-tracker-reset', async () => {
        if (!gameStateTracker) return false;
        gameStateTracker.reset();
        return true;
    });

    // ========================================================================
    // MCP Client Manager
    // ========================================================================
    ipcMain.handle('mcp-manager-connect-all', async () => {
        if (!mcpClientManager) return { error: 'MCP Manager not available' };
        return mcpClientManager.connectAll();
    });

    ipcMain.handle('mcp-manager-disconnect-all', async () => {
        if (!mcpClientManager) return false;
        return mcpClientManager.disconnectAll();
    });

    ipcMain.handle('mcp-manager-get-status', async () => {
        if (!mcpClientManager) return { servers: {} };
        return mcpClientManager.getStatus();
    });

    ipcMain.handle('mcp-manager-call-tool', async (event, serverName, toolName, args) => {
        if (!mcpClientManager) return { error: 'MCP Manager not available' };
        return mcpClientManager.callTool(serverName, toolName, args);
    });

    ipcMain.handle('mcp-manager-list-tools', async (event, serverName) => {
        if (!mcpClientManager) return [];
        return mcpClientManager.listTools(serverName);
    });

    ipcMain.handle('mcp-manager-get-all-tools', async () => {
        if (!mcpClientManager) return {};
        return mcpClientManager.getAllTools();
    });

    ipcMain.handle('mcp-manager-route-query', async (event, query, context) => {
        if (!mcpClientManager) return { error: 'MCP Manager not available' };
        return mcpClientManager.routeQuery(query, context);
    });

    // ========================================================================
    // Playwright Service
    // ========================================================================
    ipcMain.handle('playwright-start', async () => {
        if (!playwrightService) return { error: 'Playwright not available' };
        return playwrightService.start();
    });

    ipcMain.handle('playwright-stop', async () => {
        if (!playwrightService) return false;
        return playwrightService.stop();
    });

    ipcMain.handle('playwright-status', async () => {
        if (!playwrightService) return { running: false };
        return playwrightService.getStatus();
    });

    ipcMain.handle('playwright-scrape', async (event, url, options) => {
        if (!playwrightService) return { error: 'Playwright not available' };
        return playwrightService.scrape(url, options);
    });

    ipcMain.handle('playwright-scrape-wiki', async (event, topic) => {
        if (!playwrightService) return { error: 'Playwright not available' };
        return playwrightService.scrapeEvonyWiki(topic);
    });

    ipcMain.handle('playwright-scrape-forum', async (event, query) => {
        if (!playwrightService) return { error: 'Playwright not available' };
        return playwrightService.scrapeEvonyForum(query);
    });

    ipcMain.handle('playwright-screenshot', async (event, url, options) => {
        if (!playwrightService) return { error: 'Playwright not available' };
        return playwrightService.screenshot(url, options);
    });

    ipcMain.handle('playwright-execute', async (event, script) => {
        if (!playwrightService) return { error: 'Playwright not available' };
        return playwrightService.executeScript(script);
    });

    // ========================================================================
    // Intent Router (for chatbot)
    // ========================================================================
    ipcMain.handle('route-intent', async (event, message, context) => {
        try {
            const { IntentRouter } = require('./services/intent-router');
            const router = new IntentRouter({
                mcpManager: mcpClientManager,
                lmStudioClient: global.lmStudioClient,
                protocolHandler,
                gameStateTracker,
                combatSimulator,
                playwrightService
            });
            return router.route(message, context);
        } catch (error) {
            return { error: error.message };
        }
    });
    
    // ========================================================================
    // Panel Manager IPC Handlers (v2.0.8)
    // ========================================================================
    
    // Initialize panel manager
    let panelManager = null;
    try {
        const { PanelManager } = require('./services/panel-manager');
        panelManager = new PanelManager({
            flashPluginPath: store.get('flashPath'),
            swfPaths: {
                left: store.get('autoEvonySWF'),
                right: store.get('evonySWF')
            },
            defaultUrls: {
                left: store.get('autoEvonyURL') || 'http://www.evony.com',
                right: `http://${store.get('server') || 'cc2'}.evony.com`
            }
        });
    } catch (error) {
        console.error('Failed to initialize PanelManager:', error);
    }
    
    // Get panel state
    ipcMain.handle('panel-get-state', async (event, panelId) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.getPanelState(panelId);
    });
    
    // Navigate panel
    ipcMain.handle('panel-navigate', async (event, panelId, url) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.navigate(panelId, url);
    });
    
    // Go back
    ipcMain.handle('panel-go-back', async (event, panelId) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.goBack(panelId);
    });
    
    // Go forward
    ipcMain.handle('panel-go-forward', async (event, panelId) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.goForward(panelId);
    });
    
    // Refresh panel
    ipcMain.handle('panel-refresh', async (event, panelId) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.refresh(panelId);
    });
    
    // Set panel mode (web/swf/hybrid)
    ipcMain.handle('panel-set-mode', async (event, panelId, mode) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.setMode(panelId, mode);
    });
    
    // Get SWF path for panel
    ipcMain.handle('get-swf-path', async (event, panelId) => {
        const paths = {
            left: store.get('autoEvonySWF'),
            right: store.get('evonySWF')
        };
        return paths[panelId] || null;
    });
    
    // Add bookmark
    ipcMain.handle('panel-add-bookmark', async (event, panelId, bookmark) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.addBookmark(panelId, bookmark);
    });
    
    // Remove bookmark
    ipcMain.handle('panel-remove-bookmark', async (event, panelId, bookmarkId) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.removeBookmark(panelId, bookmarkId);
    });
    
    // Get bookmarks
    ipcMain.handle('panel-get-bookmarks', async (event, panelId) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.getBookmarks(panelId);
    });
    
    // Get history
    ipcMain.handle('panel-get-history', async (event, panelId) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.getHistory(panelId);
    });
    
    // Take screenshot
    ipcMain.handle('panel-screenshot', async (event, panelId) => {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `screenshot-${panelId}-${timestamp}.png`;
            const filepath = path.join(app.getPath('pictures'), 'SvonyBrowser', filename);
            
            // Ensure directory exists
            const dir = path.dirname(filepath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Capture from webview via main window
            if (mainWindow) {
                const image = await mainWindow.webContents.capturePage();
                fs.writeFileSync(filepath, image.toPNG());
                return { success: true, filepath };
            }
            return { success: false, error: 'Main window not available' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    
    // Set sync mode
    ipcMain.handle('panel-set-sync-mode', async (event, mode) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.setSyncMode(mode);
    });
    
    // Get sync mode
    ipcMain.handle('panel-get-sync-mode', async () => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.getSyncMode();
    });
    
    // Execute failsafe recovery
    ipcMain.handle('panel-failsafe-recover', async (event, panelId, level) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.executeFailsafe(panelId, level);
    });
    
    // Get panel health
    ipcMain.handle('panel-get-health', async (event, panelId) => {
        if (!panelManager) return { error: 'Panel manager not initialized' };
        return panelManager.getHealth(panelId);
    });
    
    // ========================================================================
    // Panel Playwright Bridge IPC Handlers (v2.0.8)
    // ========================================================================
    
    let panelPlaywrightBridge = null;
    try {
        const { PanelPlaywrightBridge } = require('./services/panel-playwright-bridge');
        panelPlaywrightBridge = new PanelPlaywrightBridge();
    } catch (error) {
        console.error('Failed to initialize PanelPlaywrightBridge:', error);
    }
    
    // Start hybrid session
    ipcMain.handle('panel-hybrid-start', async (event, panelId, url) => {
        if (!panelPlaywrightBridge) return { error: 'Playwright bridge not initialized' };
        return panelPlaywrightBridge.startHybridSession(panelId, url);
    });
    
    // Stop hybrid session
    ipcMain.handle('panel-hybrid-stop', async (event, panelId) => {
        if (!panelPlaywrightBridge) return { error: 'Playwright bridge not initialized' };
        return panelPlaywrightBridge.stopHybridSession(panelId);
    });
    
    // Auto-login
    ipcMain.handle('panel-hybrid-login', async (event, panelId, credentials) => {
        if (!panelPlaywrightBridge) return { error: 'Playwright bridge not initialized' };
        return panelPlaywrightBridge.autoLogin(panelId, credentials);
    });
    
    // Auto-fill form
    ipcMain.handle('panel-hybrid-fill-form', async (event, panelId, formData) => {
        if (!panelPlaywrightBridge) return { error: 'Playwright bridge not initialized' };
        return panelPlaywrightBridge.autoFillForm(panelId, formData);
    });
    
    // Execute script in hybrid session
    ipcMain.handle('panel-hybrid-execute', async (event, panelId, script) => {
        if (!panelPlaywrightBridge) return { error: 'Playwright bridge not initialized' };
        return panelPlaywrightBridge.executeScript(panelId, script);
    });
    
    // Get hybrid session status
    ipcMain.handle('panel-hybrid-status', async (event, panelId) => {
        if (!panelPlaywrightBridge) return { error: 'Playwright bridge not initialized' };
        return panelPlaywrightBridge.getSessionStatus(panelId);
    });
    
    // Intercept network requests
    ipcMain.handle('panel-hybrid-intercept', async (event, panelId, pattern, handler) => {
        if (!panelPlaywrightBridge) return { error: 'Playwright bridge not initialized' };
        return panelPlaywrightBridge.interceptRequests(panelId, pattern);
    });
    
    // Get network log
    ipcMain.handle('panel-hybrid-network-log', async (event, panelId) => {
        if (!panelPlaywrightBridge) return { error: 'Playwright bridge not initialized' };
        return panelPlaywrightBridge.getNetworkLog(panelId);
    });
}

// ========================================
// v2.0.9 - Debug, Automation & Agent Mode IPC Handlers
// ========================================

// Note: Service variables already declared at top of file

async function initializeV209Services() {
    console.log('[Main] Initializing v2.0.9 services...');
    
    // Debug Manager
    try {
        const { DebugManager } = require('./services/debug-manager');
        debugManager = new DebugManager({
            logDir: path.join(app.getPath('userData'), 'logs'),
            maxLogSize: 10 * 1024 * 1024,
            maxLogFiles: 10
        });
        await debugManager.initialize();
        console.log('[Main] Debug Manager initialized');
    } catch (e) {
        console.error('[Main] Debug Manager failed:', e.message);
    }
    
    // Network Inspector
    try {
        const { NetworkInspector } = require('./services/network-inspector');
        networkInspector = new NetworkInspector();
        console.log('[Main] Network Inspector initialized');
    } catch (e) {
        console.error('[Main] Network Inspector failed:', e.message);
    }
    
    // Performance Profiler
    try {
        const { PerformanceProfiler } = require('./services/performance-profiler');
        performanceProfiler = new PerformanceProfiler();
        console.log('[Main] Performance Profiler initialized');
    } catch (e) {
        console.error('[Main] Performance Profiler failed:', e.message);
    }
    
    // Script Recorder
    try {
        const { ScriptRecorder } = require('./services/script-recorder');
        scriptRecorder = new ScriptRecorder({
            outputDir: path.join(app.getPath('userData'), 'scripts')
        });
        console.log('[Main] Script Recorder initialized');
    } catch (e) {
        console.error('[Main] Script Recorder failed:', e.message);
    }
    
    // Script Runner
    try {
        const { ScriptRunner } = require('./services/script-runner');
        scriptRunner = new ScriptRunner({
            playwrightService,
            maxConcurrent: 3
        });
        console.log('[Main] Script Runner initialized');
    } catch (e) {
        console.error('[Main] Script Runner failed:', e.message);
    }
    
    // Automation Templates
    try {
        const { AutomationTemplates } = require('./services/automation-templates');
        automationTemplates = new AutomationTemplates();
        console.log('[Main] Automation Templates initialized');
    } catch (e) {
        console.error('[Main] Automation Templates failed:', e.message);
    }
    
    // Agent Controller
    try {
        const { AgentController } = require('./services/agent-controller');
        agentController = new AgentController({
            lmStudioClient: global.lmStudioClient,
            mcpManager: mcpClientManager,
            playwrightService,
            gameStateTracker
        });
        console.log('[Main] Agent Controller initialized');
    } catch (e) {
        console.error('[Main] Agent Controller failed:', e.message);
    }
    
    // Voice Service
    try {
        const { VoiceService } = require('./services/voice-service');
        voiceService = new VoiceService();
        console.log('[Main] Voice Service initialized');
    } catch (e) {
        console.error('[Main] Voice Service failed:', e.message);
    }
    
    // Chatbot Plugins
    try {
        const { ChatbotPluginManager } = require('./services/chatbot-plugins');
        chatbotPlugins = new ChatbotPluginManager();
        chatbotPlugins.setServices({
            gameState: gameStateTracker,
            lmStudio: global.lmStudioClient,
            mcpManager: mcpClientManager,
            debugManager,
            performanceProfiler,
            automationTemplates,
            pluginManager: chatbotPlugins
        });
        console.log('[Main] Chatbot Plugins initialized');
    } catch (e) {
        console.error('[Main] Chatbot Plugins failed:', e.message);
    }
    
    console.log('[Main] v2.0.9 services initialization complete');
}

function setupV209IPCHandlers() {
    // ========== DEBUG HANDLERS ==========
    
    // Get logs
    ipcMain.handle('debug-get-logs', async (event, options) => {
        if (!debugManager) return { error: 'Debug Manager not initialized' };
        return debugManager.getLogs(options);
    });
    
    // Clear logs
    ipcMain.handle('debug-clear-logs', async () => {
        if (!debugManager) return { error: 'Debug Manager not initialized' };
        return debugManager.clearLogs();
    });
    
    // Export logs
    ipcMain.handle('debug-export-logs', async (event, format) => {
        if (!debugManager) return { error: 'Debug Manager not initialized' };
        return debugManager.exportLogs(format);
    });
    
    // Add log entry
    ipcMain.handle('debug-log', async (event, level, message, data) => {
        if (!debugManager) return;
        debugManager.log(level, message, data);
    });
    
    // ========== NETWORK INSPECTOR HANDLERS ==========
    
    // Start capture
    ipcMain.handle('network-start-capture', async () => {
        if (!networkInspector) return { error: 'Network Inspector not initialized' };
        return networkInspector.startCapture();
    });
    
    // Stop capture
    ipcMain.handle('network-stop-capture', async () => {
        if (!networkInspector) return { error: 'Network Inspector not initialized' };
        return networkInspector.stopCapture();
    });
    
    // Get requests
    ipcMain.handle('network-get-requests', async (event, options) => {
        if (!networkInspector) return { error: 'Network Inspector not initialized' };
        return networkInspector.getRequests(options);
    });
    
    // Clear requests
    ipcMain.handle('network-clear-requests', async () => {
        if (!networkInspector) return { error: 'Network Inspector not initialized' };
        return networkInspector.clearRequests();
    });
    
    // Get stats
    ipcMain.handle('network-get-stats', async () => {
        if (!networkInspector) return { error: 'Network Inspector not initialized' };
        return networkInspector.getStats();
    });
    
    // ========== PERFORMANCE PROFILER HANDLERS ==========
    
    // Start profiling
    ipcMain.handle('perf-start-profiling', async () => {
        if (!performanceProfiler) return { error: 'Performance Profiler not initialized' };
        return performanceProfiler.startProfiling();
    });
    
    // Stop profiling
    ipcMain.handle('perf-stop-profiling', async () => {
        if (!performanceProfiler) return { error: 'Performance Profiler not initialized' };
        return performanceProfiler.stopProfiling();
    });
    
    // Get metrics
    ipcMain.handle('perf-get-metrics', async () => {
        if (!performanceProfiler) return { error: 'Performance Profiler not initialized' };
        return performanceProfiler.getMetrics();
    });
    
    // Take snapshot
    ipcMain.handle('perf-take-snapshot', async () => {
        if (!performanceProfiler) return { error: 'Performance Profiler not initialized' };
        return performanceProfiler.takeSnapshot();
    });
    
    // ========== SCRIPT RECORDER HANDLERS ==========
    
    // Start recording
    ipcMain.handle('script-start-recording', async (event, options) => {
        if (!scriptRecorder) return { error: 'Script Recorder not initialized' };
        return scriptRecorder.startRecording(options);
    });
    
    // Stop recording
    ipcMain.handle('script-stop-recording', async () => {
        if (!scriptRecorder) return { error: 'Script Recorder not initialized' };
        return scriptRecorder.stopRecording();
    });
    
    // Pause recording
    ipcMain.handle('script-pause-recording', async () => {
        if (!scriptRecorder) return { error: 'Script Recorder not initialized' };
        return scriptRecorder.pauseRecording();
    });
    
    // Resume recording
    ipcMain.handle('script-resume-recording', async () => {
        if (!scriptRecorder) return { error: 'Script Recorder not initialized' };
        return scriptRecorder.resumeRecording();
    });
    
    // Get recorded actions
    ipcMain.handle('script-get-actions', async () => {
        if (!scriptRecorder) return { error: 'Script Recorder not initialized' };
        return scriptRecorder.getActions();
    });
    
    // Save script
    ipcMain.handle('script-save', async (event, name) => {
        if (!scriptRecorder) return { error: 'Script Recorder not initialized' };
        return scriptRecorder.saveScript(name);
    });
    
    // Get recording status
    ipcMain.handle('script-get-status', async () => {
        if (!scriptRecorder) return { error: 'Script Recorder not initialized' };
        return scriptRecorder.getStatus();
    });
    
    // ========== SCRIPT RUNNER HANDLERS ==========
    
    // Run script
    ipcMain.handle('runner-run-script', async (event, scriptId, options) => {
        if (!scriptRunner) return { error: 'Script Runner not initialized' };
        return scriptRunner.runScript(scriptId, options);
    });
    
    // Stop script
    ipcMain.handle('runner-stop-script', async (event, executionId) => {
        if (!scriptRunner) return { error: 'Script Runner not initialized' };
        return scriptRunner.stopScript(executionId);
    });
    
    // Stop all scripts
    ipcMain.handle('runner-stop-all', async () => {
        if (!scriptRunner) return { error: 'Script Runner not initialized' };
        return scriptRunner.stopAll();
    });
    
    // Get queue
    ipcMain.handle('runner-get-queue', async () => {
        if (!scriptRunner) return { error: 'Script Runner not initialized' };
        return scriptRunner.getQueue();
    });
    
    // Get status
    ipcMain.handle('runner-get-status', async () => {
        if (!scriptRunner) return { error: 'Script Runner not initialized' };
        return scriptRunner.getStatus();
    });
    
    // Schedule script
    ipcMain.handle('runner-schedule-script', async (event, scriptId, schedule) => {
        if (!scriptRunner) return { error: 'Script Runner not initialized' };
        return scriptRunner.scheduleScript(scriptId, schedule);
    });
    
    // ========== AUTOMATION TEMPLATES HANDLERS ==========
    
    // Get templates
    ipcMain.handle('templates-get-all', async (event, category) => {
        if (!automationTemplates) return { error: 'Automation Templates not initialized' };
        return automationTemplates.getTemplates(category);
    });
    
    // Get template by ID
    ipcMain.handle('templates-get-by-id', async (event, templateId) => {
        if (!automationTemplates) return { error: 'Automation Templates not initialized' };
        return automationTemplates.getTemplate(templateId);
    });
    
    // Run template
    ipcMain.handle('templates-run', async (event, templateId, params) => {
        if (!automationTemplates) return { error: 'Automation Templates not initialized' };
        if (!scriptRunner) return { error: 'Script Runner not initialized' };
        
        const template = automationTemplates.getTemplate(templateId);
        if (!template) return { error: 'Template not found' };
        
        return scriptRunner.runScript(template.script, {
            ...template.defaultParams,
            ...params
        });
    });
    
    // ========== AGENT CONTROLLER HANDLERS ==========
    
    // Start agent
    ipcMain.handle('agent-start', async (event, options) => {
        if (!agentController) return { error: 'Agent Controller not initialized' };
        return agentController.start(options);
    });
    
    // Stop agent
    ipcMain.handle('agent-stop', async () => {
        if (!agentController) return { error: 'Agent Controller not initialized' };
        return agentController.stop();
    });
    
    // Pause agent
    ipcMain.handle('agent-pause', async () => {
        if (!agentController) return { error: 'Agent Controller not initialized' };
        return agentController.pause();
    });
    
    // Resume agent
    ipcMain.handle('agent-resume', async () => {
        if (!agentController) return { error: 'Agent Controller not initialized' };
        return agentController.resume();
    });
    
    // Add goal
    ipcMain.handle('agent-add-goal', async (event, goal) => {
        if (!agentController) return { error: 'Agent Controller not initialized' };
        return agentController.addGoal(goal);
    });
    
    // Remove goal
    ipcMain.handle('agent-remove-goal', async (event, goalId) => {
        if (!agentController) return { error: 'Agent Controller not initialized' };
        return agentController.removeGoal(goalId);
    });
    
    // Get goals
    ipcMain.handle('agent-get-goals', async () => {
        if (!agentController) return { error: 'Agent Controller not initialized' };
        return agentController.getGoals();
    });
    
    // Get status
    ipcMain.handle('agent-get-status', async () => {
        if (!agentController) return { error: 'Agent Controller not initialized' };
        return agentController.getStatus();
    });
    
    // Get history
    ipcMain.handle('agent-get-history', async (event, limit) => {
        if (!agentController) return { error: 'Agent Controller not initialized' };
        return agentController.getHistory(limit);
    });
    
    // ========== VOICE SERVICE HANDLERS ==========
    
    // Start listening
    ipcMain.handle('voice-start-listening', async () => {
        if (!voiceService) return { error: 'Voice Service not initialized' };
        return voiceService.startListening();
    });
    
    // Stop listening
    ipcMain.handle('voice-stop-listening', async () => {
        if (!voiceService) return { error: 'Voice Service not initialized' };
        return voiceService.stopListening();
    });
    
    // Speak text
    ipcMain.handle('voice-speak', async (event, text, options) => {
        if (!voiceService) return { error: 'Voice Service not initialized' };
        return voiceService.speak(text, options);
    });
    
    // Stop speaking
    ipcMain.handle('voice-stop-speaking', async () => {
        if (!voiceService) return { error: 'Voice Service not initialized' };
        return voiceService.stopSpeaking();
    });
    
    // Get status
    ipcMain.handle('voice-get-status', async () => {
        if (!voiceService) return { error: 'Voice Service not initialized' };
        return voiceService.getStatus();
    });
    
    // ========== CHATBOT PLUGINS HANDLERS ==========
    
    // Get plugins
    ipcMain.handle('plugins-get-all', async () => {
        if (!chatbotPlugins) return { error: 'Chatbot Plugins not initialized' };
        return chatbotPlugins.getPlugins();
    });
    
    // Toggle plugin
    ipcMain.handle('plugins-toggle', async (event, pluginId, enabled) => {
        if (!chatbotPlugins) return { error: 'Chatbot Plugins not initialized' };
        return chatbotPlugins.togglePlugin(pluginId, enabled);
    });
    
    // Process message through plugins
    ipcMain.handle('plugins-process-message', async (event, message, context) => {
        if (!chatbotPlugins) return { error: 'Chatbot Plugins not initialized' };
        return chatbotPlugins.processMessage(message, context);
    });
    
    // Get plugin status
    ipcMain.handle('plugins-get-status', async () => {
        if (!chatbotPlugins) return { error: 'Chatbot Plugins not initialized' };
        return chatbotPlugins.getStatus();
    });
    
    // ========== CONSOLE EXECUTION HANDLER ==========
    
    // Execute JavaScript in console
    ipcMain.handle('console-execute', async (event, code) => {
        try {
            // Execute in main process context (limited)
            const result = eval(code);
            return { success: true, result: String(result) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    
    console.log('[Main] v2.0.9 IPC handlers registered');
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
    
    // Check for Flash plugin and show warning if not found
    if (!flashFound) {
        dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Flash Player Not Found',
            message: 'Flash Player plugin was not found!',
            detail: 'Flash content (including Evony) will not work without the Flash Player plugin.\n\n' +
                    'To fix this:\n' +
                    '1. Download FlashBrowser from:\n' +
                    '   https://github.com/radubirsan/FlashBrowser/releases\n\n' +
                    '2. Install it, then copy pepflashplayer64_32_0_0_465.dll\n' +
                    '   from the FlashBrowser folder to the flashver/ folder\n' +
                    '   in your Svony Browser installation.\n\n' +
                    '3. Restart Svony Browser.\n\n' +
                    'See flashver/README.md for detailed instructions.',
            buttons: ['Open FlashBrowser Releases', 'Open flashver Folder', 'Continue Anyway'],
            defaultId: 0,
            cancelId: 2
        }).then(result => {
            if (result.response === 0) {
                shell.openExternal('https://github.com/radubirsan/FlashBrowser/releases');
            } else if (result.response === 1) {
                shell.openPath(path.join(__dirname, 'flashver'));
            }
        });
    }
    
    // Initialize services in background (non-blocking)
    try {
        await initializeServices();
    } catch (error) {
        console.error('[Main] Service initialization error:', error);
    }
    
    // Initialize v2.0.9 services
    try {
        await initializeV209Services();
        setupV209IPCHandlers();
    } catch (error) {
        console.error('[Main] v2.0.9 service initialization error:', error);
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

// Health Check IPC Handlers
ipcMain.handle('health-check-all', async () => {
    if (!healthCheckManager) return { error: 'Health check not initialized' };
    try {
        return await healthCheckManager.checkAll();
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('health-check-service', async (event, serviceName) => {
    if (!healthCheckManager) return { error: 'Health check not initialized' };
    try {
        return await healthCheckManager.checkService(serviceName);
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('health-get-status', async () => {
    if (!healthCheckManager) return { error: 'Health check not initialized' };
    try {
        return healthCheckManager.getOverallHealth();
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('health-get-history', async (event, serviceName) => {
    if (!healthCheckManager) return { error: 'Health check not initialized' };
    try {
        return healthCheckManager.getHistory(serviceName);
    } catch (error) {
        return { error: error.message };
    }
});

// ============================================================================
// Error System IPC Handlers
// ============================================================================

ipcMain.handle('error-track', async (event, errorData) => {
    if (!global.errorTracker) return { error: 'Error tracker not initialized' };
    try {
        const tracked = global.errorTracker.track(new Error(errorData.message), {
            category: errorData.category || 'general',
            severity: errorData.severity || 'error',
            context: errorData.context || {}
        });
        return { success: true, id: tracked.id };
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('error-get-all', async (event, options) => {
    if (!global.errorTracker) return { error: 'Error tracker not initialized' };
    try {
        return global.errorTracker.getErrors(options || {});
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('error-get-by-id', async (event, errorId) => {
    if (!global.errorTracker) return { error: 'Error tracker not initialized' };
    try {
        return global.errorTracker.getError(errorId);
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('error-get-suggestions', async (event, errorId) => {
    if (!global.errorTracker || !global.errorHelper) {
        return { error: 'Error system not initialized' };
    }
    try {
        const trackedError = global.errorTracker.getError(errorId);
        if (!trackedError) return { error: 'Error not found' };
        return global.errorHelper.getSuggestions(trackedError);
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('error-analyze', async (event, errorId) => {
    if (!global.errorTracker || !global.errorHelper) {
        return { error: 'Error system not initialized' };
    }
    try {
        const trackedError = global.errorTracker.getError(errorId);
        if (!trackedError) return { error: 'Error not found' };
        return global.errorHelper.analyze(trackedError);
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('error-heal', async (event, errorId) => {
    if (!global.errorTracker || !global.selfHealer) {
        return { error: 'Error system not initialized' };
    }
    try {
        const trackedError = global.errorTracker.getError(errorId);
        if (!trackedError) return { error: 'Error not found' };
        const result = await global.selfHealer.heal(trackedError);
        return result;
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('error-clear', async (event, options) => {
    if (!global.errorTracker) return { error: 'Error tracker not initialized' };
    try {
        global.errorTracker.clear(options);
        return { success: true };
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('error-get-stats', async () => {
    if (!global.errorTracker) return { error: 'Error tracker not initialized' };
    try {
        return global.errorTracker.getStats();
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('healer-get-status', async () => {
    if (!global.selfHealer) return { error: 'Self healer not initialized' };
    try {
        return global.selfHealer.getStatus();
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('healer-get-history', async (event, count) => {
    if (!global.selfHealer) return { error: 'Self healer not initialized' };
    try {
        return global.selfHealer.getHistory(count || 20);
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('healer-set-enabled', async (event, enabled) => {
    if (!global.selfHealer) return { error: 'Self healer not initialized' };
    try {
        global.selfHealer.setEnabled(enabled);
        return { success: true, enabled };
    } catch (error) {
        return { error: error.message };
    }
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

// Handle uncaught exceptions - wire to error tracker
process.on('uncaughtException', (error) => {
    console.error('[Main] Uncaught exception:', error);
    
    // Track in error system if available
    if (global.errorTracker) {
        global.errorTracker.track(error, {
            category: 'system',
            severity: 'critical',
            context: { source: 'uncaughtException' }
        });
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Main] Unhandled rejection:', reason);
    
    // Track in error system if available
    if (global.errorTracker) {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        global.errorTracker.track(error, {
            category: 'system',
            severity: 'error',
            context: { source: 'unhandledRejection' }
        });
    }
});
