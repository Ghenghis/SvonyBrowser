# Svony Browser v2.2.7 Quick Reference

## Panel Modes

| Mode | Button | Description |
|------|--------|-------------|
| Web | `Web` | Standard web browsing with URL navigation |
| SWF | `SWF` | Load local SWF file (AutoEvony.swf / EvonyClient.swf) |
| Hybrid | `Hybrid` | Playwright automation mode for enhanced features |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Left panel only |
| `Ctrl+2` | Both panels |
| `Ctrl+3` | Right panel only |
| `Ctrl+S` | Swap panels |
| `F5` | Reload left panel |
| `F6` | Reload right panel |
| `Ctrl+L` | Focus URL bar |
| `Ctrl+D` | Add bookmark |
| `Alt+Left` | Go back |
| `Alt+Right` | Go forward |
| `Escape` | Close dropdown/menu |

## Webbar Navigation

| Element | Function |
|---------|----------|
| `<` | Go back in history |
| `>` | Go forward in history |
| `↻` | Refresh page |
| `URL bar` | Enter URL or search query |
| `→` | Navigate to entered URL |

## Hybrid Mode Features

| Feature | Description |
|---------|-------------|
| Auto-login | Automatically fill and submit login forms |
| Form fill | Fill form fields by CSS selector |
| Request intercept | Monitor network requests matching pattern |
| Screenshot | Capture page screenshot |
| Session save | Persist cookies and storage |

## Error Recovery

| Button | Action |
|--------|--------|
| Retry | Reload the page |
| Clear & Retry | Clear cache and reload |
| Use Web Mode | Switch to web mode (if in SWF) |

## File Locations

| Item | Development | Packaged |
|------|-------------|----------|
| SWF Files | `./swf/` | `resources/swf/` |
| Flash Plugin | `./flashver/` | `resources/flashver/` |
| Settings | `%APPDATA%/svony-preferences.json` | Same |
| Sessions | `./sessions/` | `resources/sessions/` |

## IPC Commands (for developers)

```javascript
// Get SWF path for panel
ipcRenderer.invoke('get-swf-path', 'left');

// Start hybrid mode
ipcRenderer.invoke('panel-hybrid-start', 'left', 'https://evony.com');

// Stop hybrid mode
ipcRenderer.invoke('panel-hybrid-stop', 'left');

// Auto-login
ipcRenderer.invoke('panel-auto-login', 'left', { email, password });

// Fill form
ipcRenderer.invoke('panel-fill-form', 'left', { '#email': 'user@example.com' });

// Take screenshot
ipcRenderer.invoke('panel-screenshot', 'left', { fullPage: true });
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SWF not loading | Check `swf/` directory contains AutoEvony.swf |
| Flash not working | Verify Flash plugin in `flashver/` directory |
| Hybrid mode error | Playwright will download browsers on first use |
| URL bar not updating | Ensure PanelUIController is initialized |
| Mode switching freezes | Update to v2.2.7 (fixes race condition) |

## Build Commands

```bash
npm run build:win64      # Windows 64-bit
npm run build:win32      # Windows 32-bit
npm run build:all        # All Windows targets
npm run build:portable   # Portable exe only
```
