# Fagan Inspection Report: Renderer Process (renderer.js)

## Document Information
| Field | Value |
|-------|-------|
| **File** | `renderer.js` |
| **Total Lines** | 4,537 |
| **Inspection Date** | 2026-01-15 |
| **Inspector** | Automated Fagan Analysis |
| **Severity Levels** | CRITICAL, HIGH, MEDIUM, LOW, INFO |

---

## 1. Module Header & Imports (Lines 1-14)

### Line-by-Line Analysis

| Line | Code | Status | Finding |
|------|------|--------|---------|
| 1-4 | Comment block | ✅ OK | Proper JSDoc header |
| 6 | `const { ipcRenderer, remote } = require('electron')` | ⚠️ MEDIUM | `remote` is deprecated in Electron 9+ |
| 7 | `const path = require('path')` | ✅ OK | Node.js path module |
| 8 | `const fs = require('fs')` | ✅ OK | Node.js filesystem module |
| 9 | `const Store = require('./store')` | ✅ OK | Local store module |
| 11-14 | Store initialization | ✅ OK | Proper config |

### Issues Found
| ID | Line | Severity | Issue | Recommendation |
|----|------|----------|-------|----------------|
| R-001 | 6 | MEDIUM | `remote` module is deprecated | Use `@electron/remote` or IPC instead |

---

## 2. State Management (Lines 16-29)

### Line-by-Line Analysis

| Line | Property | Initial Value | Status | Finding |
|------|----------|---------------|--------|---------|
| 18 | leftPanelMode | 'web' | ✅ OK | Default mode |
| 19 | rightPanelMode | 'web' | ✅ OK | Default mode |
| 20 | sidePanelCollapsed | false | ✅ OK | Side panel visible |
| 21 | trafficCapturing | false | ✅ OK | Traffic off by default |
| 22 | trafficEntries | [] | ✅ OK | Empty array |
| 23 | selectedTrafficEntry | null | ✅ OK | No selection |
| 24 | mcpConnected | false | ✅ OK | MCP disconnected |
| 25 | lmStudioConnected | false | ✅ OK | LM Studio disconnected |
| 26 | protocolData | null | ✅ OK | No protocol data |
| 27 | selectedProtocolAction | null | ✅ OK | No selection |
| 28 | appVersion | '2.0.5' | ⚠️ LOW | Hardcoded, should sync with package.json |

### Issues Found
| ID | Line | Severity | Issue | Recommendation |
|----|------|----------|-------|----------------|
| R-002 | 28 | LOW | Hardcoded version '2.0.5' doesn't match current version | Load from package.json or IPC |

---

## 3. DOM Elements (Lines 31-88)

### Element Reference Analysis

| Category | Elements | Status | Missing Elements |
|----------|----------|--------|------------------|
| Panels | leftPanel, rightPanel, leftWebview, rightWebview, sidePanel, panelSplitter | ✅ OK | None |
| Toolbar | btnLeftOnly, btnBothPanels, btnRightOnly, btnSwapPanels, panelSizePreset, btnAutoFit, btnReloadLeft, btnReloadRight, btnClearCache, btnSettings, serverSelector | ✅ OK | None |
| Tabs | tabBtns, tabContents | ✅ OK | None |
| Traffic | trafficStart, trafficStop, trafficClear, trafficExport, trafficFilter, trafficDirection, trafficTbody, trafficStatus, trafficCount | ✅ OK | None |
| Chatbot | chatbotInput, chatbotSend, chatbotMessages | ✅ OK | None |
| Settings | settingsOverlay, closeSettings, settingsSave, settingsReset, settingsNavBtns, settingsSections | ✅ OK | None |
| Status | connectionIndicator, connectionStatus, statusMessage, memoryUsage, trafficCounter | ✅ OK | None |

### Issues Found
- **None** - All DOM elements properly referenced

---

## 4. Initialization (Lines 90-158)

### Line-by-Line Analysis

| Line | Function | Status | Finding |
|------|----------|--------|---------|
| 91-92 | init() start | ✅ OK | Async function with logging |
| 94-98 | Core setup | ✅ OK | Proper initialization order |
| 100-104 | LM Studio init | ✅ OK | Connection and listeners |
| 106-109 | Platform check | ✅ OK | Windows-specific controls |
| 111-112 | Memory monitoring | ✅ OK | 5-second interval |
| 114-122 | Version loading | ✅ OK | IPC with error handling |
| 124-134 | Flash status check | ✅ OK | IPC with error handling |
| 136-144 | Enhanced features | ✅ OK | Try-catch for optional features |
| 146-155 | Event listener override | ⚠️ MEDIUM | Removes then re-adds listeners |

### Issues Found
| ID | Line | Severity | Issue | Recommendation |
|----|------|----------|-------|----------------|
| R-003 | 147-148 | MEDIUM | Removes listener then adds new one - potential memory leak if called multiple times | Use named function reference |

---

## 5. Event Listeners Setup (Lines 184-380)

### Event Listener Summary

| Category | Lines | Elements | Status | Issues |
|----------|-------|----------|--------|--------|
| View controls | 191-195 | btnLeftOnly, btnBothPanels, btnRightOnly, btnSwapPanels | ✅ OK | None |
| Panel presets | 197-226 | panelSizePreset, btnAutoFit | ✅ OK | None |
| Reload buttons | 237-238 | btnReloadLeft, btnReloadRight | ✅ OK | None |
| Clear cache | 240-243 | btnClearCache | ✅ OK | None |
| Settings | 245-257 | btnSettings, closeSettings, settingsSave, settingsReset, settingsNavBtns | ✅ OK | None |
| Tabs | 259-265 | tabBtns | ✅ OK | None |
| Panel toggles | 267-275 | .toggle-btn | ✅ OK | None |
| Traffic | 277-283 | trafficStart, trafficStop, trafficClear, trafficExport, trafficFilter, trafficDirection | ✅ OK | None |
| Details tabs | 285-291 | .details-tab | ✅ OK | None |
| Chatbot | 293-300 | chatbotSend, chatbotInput | ✅ OK | None |
| Quick actions | 302-308 | .quick-action | ✅ OK | None |
| Side panel | 310-311 | toggle-side-panel | ✅ OK | None |
| Panel splitter | 313-314 | setupPanelSplitter() | ✅ OK | None |
| Window controls | 316-328 | min-button, max-button, restore-button, close-button | ✅ OK | None |
| Keyboard | 330-331 | document keydown | ✅ OK | None |
| Server selector | 333-336 | serverSelector | ✅ OK | None |
| Webview events | 338-340 | leftWebview, rightWebview | ✅ OK | None |
| Protocol | 342-347 | protocol-search, protocol-copy, protocol-test | ✅ OK | None |
| AMF decoder | 349-350 | amf-decode | ✅ OK | None |
| Training calc | 352-353 | calc-training | ✅ OK | None |
| MCP reconnect | 355-356 | mcp-reconnect | ✅ OK | None |
| Fiddler | 358-361 | btn-fiddler | ✅ OK | None |
| SOL Editor | 363-366 | btn-sol-editor | ✅ OK | None |
| Browse buttons | 368-379 | .browse-btn | ✅ OK | None |

### Issues Found
- **None** - Event listeners properly set up with safe attachment pattern

---

## 6. Panel Management (Lines 382-497)

### Function Analysis

| Function | Lines | Purpose | Status | Issues |
|----------|-------|---------|--------|--------|
| setPanelView(view) | 383-410 | Switch between left/right/both views | ✅ OK | None |
| swapPanels() | 412-424 | Swap left and right panel content | ✅ OK | None |
| togglePanelMode(panel, mode) | 426-497 | Switch between web/swf/hybrid modes | ⚠️ MEDIUM | Path issues |

### togglePanelMode Analysis (Lines 426-497)

| Line | Code Section | Status | Finding |
|------|--------------|--------|---------|
| 428-431 | Hybrid deactivation (left) | ✅ OK | Proper cleanup |
| 433-436 | Mode state update (left) | ✅ OK | Updates state and UI |
| 438-443 | Web mode (left) | ✅ OK | Loads autoevonyUrl |
| 445-449 | Hybrid mode (left) | ✅ OK | Calls activateHybridMode |
| 451-460 | SWF mode (left) | ⚠️ MEDIUM | Uses __dirname which may fail in packaged app |
| 462-465 | Hybrid deactivation (right) | ✅ OK | Proper cleanup |
| 467-470 | Mode state update (right) | ✅ OK | Updates state and UI |
| 472-478 | Web mode (right) | ✅ OK | Loads Evony server URL |
| 480-484 | Hybrid mode (right) | ✅ OK | Calls activateHybridMode |
| 486-495 | SWF mode (right) | ⚠️ MEDIUM | Uses __dirname which may fail in packaged app |

### Issues Found
| ID | Line | Severity | Issue | Recommendation |
|----|------|----------|-------|----------------|
| R-004 | 453 | MEDIUM | `path.join(__dirname, 'swf', 'AutoEvony.swf')` may fail in packaged app | Use IPC to get resource path |
| R-005 | 488 | MEDIUM | `path.join(__dirname, 'swf', 'EvonyClient.swf')` may fail in packaged app | Use IPC to get resource path |

---

## 7. SWF Path Resolution Issue

### Current Code (Lines 451-460)
```javascript
if (mode === 'swf') {
    const swfPath = store.get('autoevonySwfPath') || path.join(__dirname, 'swf', 'AutoEvony.swf');
    if (!fs.existsSync(swfPath)) {
        elements.leftWebview.src = 'data:text/html,...';
        return;
    }
    elements.leftWebview.src = `file://${swfPath}`;
}
```

### Problem
In a packaged Electron app, `__dirname` points to the `app.asar` archive, not the actual filesystem. The SWF files are in `resources/swf/` via `extraResources`.

### Recommended Fix
```javascript
if (mode === 'swf') {
    // Get correct path from main process
    const swfPath = await ipcRenderer.invoke('get-swf-path', 'AutoEvony.swf');
    if (!swfPath || !fs.existsSync(swfPath)) {
        elements.leftWebview.src = 'data:text/html,...';
        return;
    }
    elements.leftWebview.src = `file://${swfPath}`;
}
```

---

## 8. IPC Communication Analysis

### IPC Channels Used (Renderer → Main)

| Channel | Line | Direction | Purpose | Status |
|---------|------|-----------|---------|--------|
| get-version | 116 | invoke | Get app version | ✅ OK |
| get-flash-status | 126 | invoke | Check Flash plugin | ✅ OK |
| clear-cache | 242 | send | Clear browser cache | ✅ OK |
| minimize-window | 318 | send | Minimize window | ✅ OK |
| maximize-window | 321 | send | Maximize window | ✅ OK |
| restore-window | 324 | send | Restore window | ✅ OK |
| close-window | 327 | send | Close window | ✅ OK |
| open-fiddler | 360 | send | Open Fiddler | ✅ OK |
| open-sol-editor | 365 | send | Open SOL Editor | ✅ OK |
| browse-swf | 373 | invoke | Browse for SWF file | ✅ OK |

### Missing IPC Handlers
| Channel | Purpose | Needed For |
|---------|---------|------------|
| get-swf-path | Get correct SWF path | SWF mode in packaged app |
| get-resource-path | Get resource directory | All asset loading |

---

## 9. Critical Issues Summary

### CRITICAL Issues (0)
None found in renderer.js

### HIGH Issues (0)
None found in renderer.js

### MEDIUM Issues (4)
| ID | Line | Issue |
|----|------|-------|
| R-001 | 6 | Deprecated `remote` module |
| R-003 | 147-148 | Event listener removal/re-add pattern |
| R-004 | 453 | SWF path uses __dirname |
| R-005 | 488 | SWF path uses __dirname |

### LOW Issues (1)
| ID | Line | Issue |
|----|------|-------|
| R-002 | 28 | Hardcoded version |

---

## 10. Recommendations

### Immediate Fixes Required

1. **Lines 453, 488** - Replace `__dirname` with IPC call to main process for resource paths
2. **Line 6** - Replace `remote` with `@electron/remote` or IPC

### Code Quality Improvements

1. **Line 28** - Remove hardcoded version, rely on IPC `get-version`
2. **Lines 147-148** - Use named function references to prevent memory leaks
3. Add error boundaries around all IPC calls

### New IPC Handlers Needed

```javascript
// In index.js - add these handlers:
ipcMain.handle('get-swf-path', (event, filename) => {
    const possiblePaths = [
        path.join(process.resourcesPath, 'swf', filename),
        path.join(__dirname, 'swf', filename),
        path.join(app.getAppPath(), 'swf', filename)
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
});

ipcMain.handle('get-resource-path', (event, subdir) => {
    return path.join(process.resourcesPath || __dirname, subdir);
});
```

---

## Inspection Sign-Off

| Role | Status | Date |
|------|--------|------|
| Author Review | PENDING | - |
| Code Review | COMPLETE | 2026-01-15 |
| Testing | PENDING | - |

**Previous Document:** [01-MAIN-PROCESS-AUDIT.md](./01-MAIN-PROCESS-AUDIT.md)
**Next Document:** [03-SERVICES-CORE-AUDIT.md](./03-SERVICES-CORE-AUDIT.md)
