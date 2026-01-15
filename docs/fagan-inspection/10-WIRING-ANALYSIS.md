# Fagan Inspection Report: Component Wiring Analysis

## Document Information
| Field | Value |
|-------|-------|
| **Purpose** | Complete component wiring and dependency map |
| **Inspection Date** | 2026-01-15 |
| **Severity Levels** | CRITICAL, HIGH, MEDIUM, LOW, INFO |

---

## 1. Main Process → Renderer Communication

### IPC Channels (index.js → renderer.js)

| Channel | Direction | Purpose | Status |
|---------|-----------|---------|--------|
| flash-status | Main→Renderer | Flash plugin status | ✅ OK |
| traffic-entry | Main→Renderer | Traffic data | ✅ OK |
| proxy-status-changed | Main→Renderer | Proxy status | ✅ OK |
| chatbot-response | Main→Renderer | AI response | ✅ OK |
| mcp-status | Main→Renderer | MCP status | ✅ OK |
| panel-content-loaded | Main→Renderer | Panel loaded | ✅ OK |

### IPC Handlers (renderer.js → index.js)

| Channel | Handler | Status |
|---------|---------|--------|
| get-flash-status | Returns flash status | ✅ OK |
| get-swf-path | Returns SWF path | ⚠️ NEEDS FIX |
| get-resource-path | Returns resource path | ✅ OK |
| chatbot-send | Send to chatbot | ✅ OK |
| mcp-call-tool | Call MCP tool | ✅ OK |
| traffic-start | Start capture | ✅ OK |
| traffic-stop | Stop capture | ✅ OK |

---

## 2. Service Dependencies

### Initialization Order (CRITICAL)

```
1. app.whenReady()
2. initializeServices()
   ├── protocolHandler.initialize()
   ├── mcpConnection (if enabled)
   ├── proxyMonitor.start()
   ├── lmStudioClient
   ├── chatbotService
   ├── gameState
   ├── packetAnalysis
   ├── combatSimulator
   ├── sessionRecorder
   ├── fiddlerBridge
   ├── gameStateTracker
   ├── mcpClientManager
   ├── playwrightService
   ├── amf3Decoder
   ├── debugManager
   ├── networkInspector
   ├── performanceProfiler
   ├── scriptRecorder
   ├── scriptRunner
   ├── automationTemplates
   ├── agentController
   ├── voiceService
   ├── chatbotPlugins
   ├── panelManager
   └── panelPlaywrightBridge
3. createWindow()
4. setupIpcHandlers()
```

### Service Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE DEPENDENCY GRAPH                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  chatbotService ──────► lmStudioClient                          │
│       │                                                          │
│       └──────────────► mcpClientManager                         │
│                              │                                   │
│                              ├──► evony-rag                     │
│                              ├──► evony-rte                     │
│                              └──► evony-tools                   │
│                                                                  │
│  panelManager ────────► playwrightService                       │
│       │                                                          │
│       └──────────────► panelPlaywrightBridge                    │
│                                                                  │
│  networkInspector ───► trafficProcessor                         │
│       │                                                          │
│       └──────────────► amf3Decoder                              │
│                                                                  │
│  scriptRunner ───────► automationTemplates                      │
│       │                                                          │
│       └──────────────► agentController                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Critical Wiring Issues Found

### Issue W-001: SWF Path Resolution
| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **File** | renderer.js |
| **Lines** | 485-510 |
| **Issue** | loadSwfPanel uses __dirname which fails in packaged app |
| **Fix** | Use IPC to get resource path from main process |

### Issue W-002: Panel Mode State
| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | renderer.js |
| **Lines** | 450-480 |
| **Issue** | Panel mode state not persisted across reloads |
| **Fix** | Store panel mode in electron-store |

### Issue W-003: Hybrid Mode Cleanup
| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | renderer.js |
| **Lines** | 520-550 |
| **Issue** | Hybrid mode not properly cleaned up on panel close |
| **Fix** | Add cleanup handler in deactivateHybridMode |

---

## 4. File-to-File Dependencies

| Source File | Depends On | Type |
|-------------|------------|------|
| index.js | store.js | require |
| index.js | services/*.js | require |
| index.js | preload.js | preload |
| renderer.js | window.api | preload bridge |
| browser.html | renderer.js | script |
| browser.html | themes/*.css | stylesheet |

---

## 5. Global Variables (index.js)

| Variable | Type | Purpose | Status |
|----------|------|---------|--------|
| mainWindow | BrowserWindow | Main window | ✅ OK |
| swfURL | string | Current SWF URL | ✅ OK |
| pluginName | string | Flash plugin path | ✅ OK |
| flashFound | boolean | Flash status | ✅ OK |
| trafficCapturing | boolean | Traffic state | ✅ OK |
| trafficEntries | array | Traffic data | ✅ OK |
| store | Store | Preferences | ✅ OK |

---

## 6. Preload Bridge (preload.js)

### Exposed APIs

| API | Methods | Status |
|-----|---------|--------|
| window.api.invoke | IPC invoke | ✅ OK |
| window.api.send | IPC send | ✅ OK |
| window.api.on | IPC listener | ✅ OK |
| window.api.removeListener | Remove listener | ✅ OK |

---

## 7. Recommendations

### Immediate Fixes (v2.2.9)
1. Fix SWF path resolution in renderer.js
2. Add panel mode persistence
3. Add hybrid mode cleanup

### Code Quality
1. Add TypeScript for better type safety
2. Add dependency injection for services
3. Add service health monitoring

---

**Previous Document:** [09-MCP-INTEGRATION-AUDIT.md](./09-MCP-INTEGRATION-AUDIT.md)
**Next Document:** [11-CRITICAL-FIXES.md](./11-CRITICAL-FIXES.md)
