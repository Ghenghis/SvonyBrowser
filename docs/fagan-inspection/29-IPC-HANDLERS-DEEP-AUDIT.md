# Fagan Inspection: IPC Handlers Deep Audit

## File: index.js | Lines: 2000-2500 | Purpose: All IPC Communication

---

## CRITICAL: IPC Handler Map

### Window Controls (Lines 2000-2050)
| Handler | Channel | Status |
|---------|---------|--------|
| window-minimize | ipcMain.on | ✅ OK |
| window-maximize | ipcMain.on | ✅ OK |
| window-close | ipcMain.on | ✅ OK |

### Flash/SWF Handlers (Lines 2055-2120)
| Handler | Channel | Returns | Status |
|---------|---------|---------|--------|
| get-flash-status | ipcMain.handle | {found, path, version} | ✅ OK |
| get-swf-path | ipcMain.handle | string path | ✅ OK |
| get-resource-path | ipcMain.handle | string path | ✅ OK |

### Panel Handlers (Lines 2125-2250)
| Handler | Channel | Status |
|---------|---------|--------|
| panel-navigate | ipcMain.handle | ✅ OK |
| panel-reload | ipcMain.handle | ✅ OK |
| panel-go-back | ipcMain.handle | ✅ OK |
| panel-go-forward | ipcMain.handle | ✅ OK |
| panel-hybrid-activate | ipcMain.handle | ✅ OK |
| panel-hybrid-deactivate | ipcMain.handle | ✅ OK |
| panel-add-bookmark | ipcMain.handle | ✅ OK |
| panel-remove-bookmark | ipcMain.handle | ✅ OK |
| panel-get-bookmarks | ipcMain.handle | ✅ OK |
| panel-get-history | ipcMain.handle | ✅ OK |
| panel-screenshot | ipcMain.handle | ✅ OK |

### Traffic Handlers (Lines 2255-2320)
| Handler | Channel | Status |
|---------|---------|--------|
| traffic-start | ipcMain.handle | ✅ OK |
| traffic-stop | ipcMain.handle | ✅ OK |
| traffic-clear | ipcMain.handle | ✅ OK |
| traffic-export | ipcMain.handle | ✅ OK |
| traffic-filter | ipcMain.on | ✅ OK |

### Chatbot Handlers (Lines 2325-2400)
| Handler | Channel | Status |
|---------|---------|--------|
| chatbot-send | ipcMain.handle | ✅ OK |
| chatbot-clear | ipcMain.handle | ✅ OK |
| chatbot-set-model | ipcMain.handle | ✅ OK |
| chatbot-get-history | ipcMain.handle | ✅ OK |

### MCP Handlers (Lines 2405-2480)
| Handler | Channel | Status |
|---------|---------|--------|
| mcp-call-tool | ipcMain.handle | ✅ OK |
| mcp-get-status | ipcMain.handle | ✅ OK |
| mcp-get-tools | ipcMain.handle | ✅ OK |
| mcp-reconnect | ipcMain.handle | ✅ OK |

### Error System Handlers (Lines 2485-2550)
| Handler | Channel | Status |
|---------|---------|--------|
| error-track | ipcMain.handle | ✅ OK |
| error-get-recent | ipcMain.handle | ✅ OK |
| error-get-solutions | ipcMain.handle | ✅ OK |
| self-heal-attempt | ipcMain.handle | ✅ OK |

---

## IPC Security Analysis

### Validated Channels
```javascript
// preload.js whitelist
const validInvokeChannels = [
    'get-flash-status', 'get-swf-path', 'get-resource-path',
    'chatbot-send', 'mcp-call-tool', 'mcp-get-status',
    'traffic-start', 'traffic-stop', 'panel-navigate',
    // ... 20+ more
];
```
**Status:** ✅ OK - Proper whitelist

### Missing Validation
| Handler | Issue | Severity |
|---------|-------|----------|
| panel-navigate | URL not validated | MEDIUM |
| chatbot-send | Input not sanitized | LOW |

---

## Critical Path Analysis

### Flash Detection Flow
```
Renderer                    Main
   │                         │
   │── get-flash-status ────►│
   │                         │── findFlashPlugin()
   │                         │── check paths
   │◄── {found, path} ───────│
   │                         │
```

### Panel Navigation Flow
```
Renderer                    Main
   │                         │
   │── panel-navigate ──────►│
   │                         │── panelManager.navigate()
   │                         │── webview.loadURL()
   │◄── {success} ──────────│
   │                         │
```

---

## Issues Found

| ID | Line | Severity | Issue |
|----|------|----------|-------|
| IPC-001 | 2130 | MEDIUM | URL validation missing |
| IPC-002 | 2330 | LOW | No rate limiting |
| IPC-003 | 2410 | LOW | MCP timeout not configurable |

**File Status:** ⚠️ NEEDS REVIEW - Security improvements needed
