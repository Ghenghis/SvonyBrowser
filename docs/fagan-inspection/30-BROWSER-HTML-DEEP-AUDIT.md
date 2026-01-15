# Fagan Inspection: browser.html Deep Audit

## File: browser.html | Lines: 600+ | Purpose: Main UI

---

## DOM Structure

```
<html>
├── <head>
│   ├── <meta charset>
│   ├── <title>
│   ├── <link> themes/svony-theme.css
│   └── <link> themes/hybrid-error-styles.css
│
└── <body>
    ├── <div id="titlebar">
    │   ├── <div class="title-text">
    │   ├── <div class="window-controls">
    │   │   ├── <button id="btn-minimize">
    │   │   ├── <button id="btn-maximize">
    │   │   └── <button id="btn-close">
    │   └── </div>
    │
    ├── <div id="toolbar">
    │   ├── <div class="nav-controls">
    │   │   ├── <button id="btn-back">
    │   │   ├── <button id="btn-forward">
    │   │   ├── <button id="btn-reload">
    │   │   └── <input id="url-input">
    │   │
    │   ├── <div class="panel-controls">
    │   │   ├── <button id="btn-left-only">
    │   │   ├── <button id="btn-split">
    │   │   ├── <button id="btn-right-only">
    │   │   ├── <button id="btn-swap-panels">
    │   │   ├── <select id="panel-size-preset">
    │   │   └── <button id="btn-auto-fit">
    │   │
    │   └── <div class="mode-controls">
    │       ├── <button id="left-web-toggle">
    │       ├── <button id="left-swf-toggle">
    │       ├── <button id="left-hybrid-toggle">
    │       ├── <button id="right-web-toggle">
    │       ├── <button id="right-swf-toggle">
    │       └── <button id="right-hybrid-toggle">
    │
    ├── <div id="main-content">
    │   ├── <div id="left-panel">
    │   │   ├── <div class="panel-header">
    │   │   │   ├── <span id="left-mode-badge">
    │   │   │   └── <span id="left-status">
    │   │   └── <webview id="left-webview">
    │   │
    │   ├── <div id="splitter">
    │   │
    │   └── <div id="right-panel">
    │       ├── <div class="panel-header">
    │       │   ├── <span id="right-mode-badge">
    │       │   └── <span id="right-status">
    │       └── <webview id="right-webview">
    │
    ├── <div id="chatbot-panel">
    │   ├── <div id="chat-messages">
    │   ├── <input id="chat-input">
    │   └── <button id="chat-send">
    │
    ├── <div id="traffic-panel">
    │   ├── <div id="traffic-controls">
    │   ├── <div id="traffic-list">
    │   └── <div id="traffic-details">
    │
    └── <script src="renderer.js">
```

---

## Element IDs Reference

### Window Controls
| ID | Element | Purpose |
|----|---------|---------|
| btn-minimize | button | Minimize window |
| btn-maximize | button | Maximize/restore |
| btn-close | button | Close window |

### Navigation
| ID | Element | Purpose |
|----|---------|---------|
| btn-back | button | Go back |
| btn-forward | button | Go forward |
| btn-reload | button | Reload page |
| url-input | input | URL entry |

### Panel Controls
| ID | Element | Purpose |
|----|---------|---------|
| btn-left-only | button | Show left only |
| btn-split | button | Show both |
| btn-right-only | button | Show right only |
| btn-swap-panels | button | Swap panels |
| panel-size-preset | select | Size presets |
| btn-auto-fit | button | Auto-fit game |

### Mode Toggles
| ID | Element | Purpose |
|----|---------|---------|
| left-web-toggle | button | Left web mode |
| left-swf-toggle | button | Left SWF mode |
| left-hybrid-toggle | button | Left hybrid mode |
| right-web-toggle | button | Right web mode |
| right-swf-toggle | button | Right SWF mode |
| right-hybrid-toggle | button | Right hybrid mode |

### Panels
| ID | Element | Purpose |
|----|---------|---------|
| left-panel | div | Left container |
| right-panel | div | Right container |
| left-webview | webview | Left browser |
| right-webview | webview | Right browser |
| splitter | div | Resize handle |

### Status
| ID | Element | Purpose |
|----|---------|---------|
| left-mode-badge | span | Left mode indicator |
| right-mode-badge | span | Right mode indicator |
| left-status | span | Left status text |
| right-status | span | Right status text |

---

## Webview Configuration

```html
<webview 
    id="left-webview"
    src="about:blank"
    plugins="true"
    webpreferences="plugins=true"
    allowpopups="true"
    partition="persist:main"
></webview>
```

**Critical Attributes:**
- `plugins="true"` - Enable Flash
- `partition="persist:main"` - Share session
- `allowpopups="true"` - Allow popups

---

## Issues Found

| ID | Line | Severity | Issue |
|----|------|----------|-------|
| HTML-001 | - | LOW | No ARIA labels |
| HTML-002 | - | LOW | No keyboard shortcuts |
| HTML-003 | - | INFO | Could use semantic HTML5 |

**File Status:** ✅ GOOD - Functional UI
