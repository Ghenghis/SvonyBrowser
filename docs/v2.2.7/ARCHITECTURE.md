# Svony Browser v2.2.7 Architecture

## Overview

Svony Browser is an Electron-based application with a dual-panel browser interface. This document describes the architecture of the mode switching system and panel management.

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Svony Browser                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        Main Process (index.js)                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐    │  │
│  │  │   Store     │  │   Flash     │  │   PanelPlaywrightBridge│    │  │
│  │  │  (Settings) │  │   Plugin    │  │   (Hybrid Mode)        │    │  │
│  │  └─────────────┘  └─────────────┘  └────────────────────────┘    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐    │  │
│  │  │ IPC Handlers│  │  Services   │  │   AgentController      │    │  │
│  │  │  (50+ cmds) │  │  (35 files) │  │   (AI Automation)      │    │  │
│  │  └─────────────┘  └─────────────┘  └────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                  ↕ IPC                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Renderer Process (renderer.js)                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐    │  │
│  │  │   State     │  │    UI       │  │   PanelUIController    │    │  │
│  │  │  Management │  │  Elements   │  │   (Navigation/Bookmarks)│    │  │
│  │  └─────────────┘  └─────────────┘  └────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        Browser Window                            │    │
│  │  ┌──────────────────────┐    ┌──────────────────────┐          │    │
│  │  │     Left Panel       │    │     Right Panel      │          │    │
│  │  │  ┌────────────────┐  │    │  ┌────────────────┐  │          │    │
│  │  │  │  Mode Toggles  │  │    │  │  Mode Toggles  │  │          │    │
│  │  │  │  [Web][SWF][H] │  │    │  │  [Web][SWF][H] │  │          │    │
│  │  │  └────────────────┘  │    │  └────────────────┘  │          │    │
│  │  │  ┌────────────────┐  │    │  ┌────────────────┐  │          │    │
│  │  │  │    Webbar      │  │    │  │    Webbar      │  │          │    │
│  │  │  │ [<][>][R] [URL]│  │    │  │ [<][>][R] [URL]│  │          │    │
│  │  │  └────────────────┘  │    │  └────────────────┘  │          │    │
│  │  │  ┌────────────────┐  │    │  ┌────────────────┐  │          │    │
│  │  │  │    Webview     │  │    │  │    Webview     │  │          │    │
│  │  │  │  (Flash/Web/   │  │    │  │  (Flash/Web/   │  │          │    │
│  │  │  │   Hybrid)      │  │    │  │   Hybrid)      │  │          │    │
│  │  │  └────────────────┘  │    │  └────────────────┘  │          │    │
│  │  └──────────────────────┘    └──────────────────────┘          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Mode System Architecture

### Panel Modes

| Mode | Description | Technology |
|------|-------------|------------|
| **Web** | Standard web browsing | Electron Webview |
| **SWF** | Flash SWF file display | Pepper Flash Plugin |
| **Hybrid** | Playwright automation | Playwright Chromium |

### Mode Switching Sequence Diagram

```
User                Renderer              Main Process          PanelPlaywrightBridge
  │                    │                       │                        │
  │ Click mode btn     │                       │                        │
  │───────────────────>│                       │                        │
  │                    │                       │                        │
  │                    │ togglePanelMode()     │                        │
  │                    │ Check mutex lock      │                        │
  │                    │                       │                        │
  │                    │ [If switching to SWF] │                        │
  │                    │──────────────────────>│                        │
  │                    │ get-swf-path IPC      │                        │
  │                    │<──────────────────────│                        │
  │                    │ Return path           │                        │
  │                    │                       │                        │
  │                    │ [If switching to Hybrid]                       │
  │                    │──────────────────────>│                        │
  │                    │ playwright-status     │                        │
  │                    │<──────────────────────│                        │
  │                    │                       │                        │
  │                    │──────────────────────>│───────────────────────>│
  │                    │ panel-hybrid-start    │ startHybridSession()   │
  │                    │<──────────────────────│<───────────────────────│
  │                    │                       │                        │
  │                    │ Update UI             │                        │
  │ Mode switched      │                       │                        │
  │<───────────────────│                       │                        │
```

---

## SWF Path Resolution

### Search Order

```
findSwfFile(swfName)
    │
    ├── 1. path.join(__dirname, 'swf', swfName)
    │       └── Development: /path/to/project/swf/AutoEvony.swf
    │
    ├── 2. path.join(process.resourcesPath, 'swf', swfName)
    │       └── Packaged: /path/to/app/resources/swf/AutoEvony.swf
    │
    ├── 3. path.join(app.getAppPath(), 'swf', swfName)
    │       └── ASAR: app.asar/swf/AutoEvony.swf
    │
    └── 4. path.join(path.dirname(process.execPath), 'resources', 'swf', swfName)
            └── Fallback: /path/to/app/resources/swf/AutoEvony.swf
```

---

## IPC Communication

### Mode-Related IPC Handlers

| Handler | Direction | Purpose |
|---------|-----------|---------|
| `get-swf-path` | Main ← Renderer | Get SWF file path for panel |
| `panel-set-mode` | Main ← Renderer | Set panel mode |
| `playwright-status` | Main ← Renderer | Check Playwright status |
| `playwright-start` | Main ← Renderer | Initialize Playwright |
| `panel-hybrid-start` | Main ← Renderer | Start hybrid session |
| `panel-hybrid-stop` | Main ← Renderer | Stop hybrid session |
| `panel-navigate` | Main ← Renderer | Navigate in hybrid mode |
| `panel-auto-login` | Main ← Renderer | Auto-login in hybrid |
| `panel-fill-form` | Main ← Renderer | Fill form fields |
| `panel-screenshot` | Main ← Renderer | Take screenshot |

---

## Service Layer

### Key Services

```
services/
├── panel-manager.js           # Panel state, failsafe chain
├── panel-ui-controller.js     # UI events, navigation, bookmarks
├── panel-playwright-bridge.js # Playwright integration
├── playwright-service.js      # Playwright browser instance
├── agent-controller.js        # AI agent automation
├── error-tracker.js           # Error tracking & statistics
├── error-helper.js            # Error solution suggestions
├── self-healer.js             # Automatic recovery
├── chatbot-service.js         # AI co-pilot chat
├── protocol-handler.js        # AMF3 encoding/decoding
└── game-state.js              # Game state tracking
```

### Service Dependencies

```
Main Process
    │
    ├── PanelPlaywrightBridge
    │       ├── uses: playwright (npm)
    │       └── manages: Browser contexts, Pages
    │
    ├── AgentController
    │       ├── uses: PanelPlaywrightBridge
    │       └── uses: ChatbotService
    │
    └── ChatbotService
            ├── uses: PlaywrightService (web scraping)
            └── uses: MCP Servers (AI features)
```

---

## State Management

### Renderer State

```javascript
const state = {
    leftPanelMode: 'web',        // 'web' | 'swf' | 'hybrid'
    rightPanelMode: 'web',
    leftModeSwitching: false,    // Mutex lock
    rightModeSwitching: false,   // Mutex lock
    leftPlaywrightPageId: null,  // Playwright page reference
    rightPlaywrightPageId: null,
    // ... other state
};
```

### Store Persistence

```javascript
// Store defaults (index.js)
{
    leftPanelMode: 'web',
    rightPanelMode: 'web',
    autoevonySwfPath: null,      // Custom SWF path
    evonySwfPath: null,          // Custom SWF path
    autoevonyUrl: 'https://autoevony.com',
    // ... other settings
}
```

---

## Error Handling

### Failsafe Chain

```
1. Simple Retry
   └── Exponential backoff (1s, 2s, 4s)
       │
2. Cache Clear & Retry
   └── Clear webview cache, retry load
       │
3. Alternate URL Failover
   └── Try different server URL
       │
4. Fallback to Web Mode
   └── If SWF fails, switch to web
       │
5. Show Recovery UI
   └── Display error overlay with options
```

### Error Overlay Buttons

| Button | Action |
|--------|--------|
| Retry | `webview.reload()` |
| Clear & Retry | `clearCache()` + `webview.reload()` |
| Use Web Mode | `togglePanelMode(panel, 'web')` |

---

## Build Configuration

### Electron Builder

```json
{
  "build": {
    "extraResources": [
      { "from": "swf", "to": "swf" },
      { "from": "flashver", "to": "flashver" }
    ],
    "win": {
      "target": ["nsis", "portable", "zip"]
    }
  }
}
```

### Resource Paths in Packaged App

```
SvonyBrowser-win32-x64/
├── SvonyBrowser.exe
└── resources/
    ├── app.asar          # Bundled application code
    ├── swf/              # SWF files (extraResources)
    │   └── AutoEvony.swf
    └── flashver/         # Flash plugins (extraResources)
        └── pepflashplayer64.dll
```
