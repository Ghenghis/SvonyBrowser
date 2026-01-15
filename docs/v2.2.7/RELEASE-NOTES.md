# Svony Browser v2.2.7 Release Notes

## Complete SWF/Web/Hybrid Mode Fix

**Release Date:** January 15, 2026

---

## Summary

Version 2.2.7 is a critical bugfix release that addresses all mode switching issues in Svony Browser. This release ensures reliable switching between SWF, Web, and Hybrid modes without application freezing or errors.

---

## Key Fixes

### 1. SWF Mode Path Resolution

**Problem:** SWF files were not loading in packaged (electron-builder) applications because the path resolution was hardcoded to development paths.

**Solution:** Added `findSwfFile()` and `getSwfPathForPanel()` helper functions that search multiple locations:
- `__dirname/swf`
- `process.resourcesPath/swf`
- `app.getAppPath()/swf`
- `execPath/../resources/swf`

### 2. Mode Switching Freezing

**Problem:** Rapidly clicking between Web/SWF/Hybrid modes could cause the application to freeze due to race conditions in async operations.

**Solution:** Added a mutex lock (`state[lockKey]`) to prevent multiple simultaneous mode switches. Made `togglePanelMode()` fully async with proper await handling.

### 3. Webbar Navigation

**Problem:** URL bar wasn't updating when navigating, and navigation buttons weren't responding.

**Solution:**
- Added `did-navigate` and `did-navigate-in-page` event listeners
- Added `updateNavigationButtons()` to manage back/forward button states
- Added `setupPanelNavigationHandlers()` for proper event wiring

### 4. Hybrid Mode Methods

**Problem:** Several Playwright methods called by IPC handlers were missing from `PanelPlaywrightBridge`.

**Solution:** Added 7 new methods:
- `startHybridSession(panelId, url)`
- `stopHybridSession(panelId)`
- `getSessionStatus(panelId)`
- `autoFillForm(panelId, formData)`
- `interceptRequests(panelId, pattern)`
- `navigate(panelId, url)`
- `getNetworkLog(panelId)`

---

## Architecture Changes

### Mode Switching Flow

```
User clicks mode button
    ↓
togglePanelMode(panel, mode) [async]
    ↓
Check mutex lock (prevent race condition)
    ↓
Deactivate previous mode if hybrid
    ↓
Update state
    ↓
Update UI (toggle buttons, mode badge)
    ↓
Mode-specific action:
  - Web: Load default URL
  - SWF: Get SWF path via IPC, load file://
  - Hybrid: Call activateHybridMode()
    ↓
Save mode to store
    ↓
Release mutex lock
```

### SWF Path Resolution Flow

```
get-swf-path IPC handler
    ↓
getSwfPathForPanel(panelId)
    ↓
Check store for custom path
    ↓
If custom path exists and file exists: return it
    ↓
Otherwise: findSwfFile(defaultSwfName)
    ↓
Search multiple directories:
  1. __dirname/swf
  2. resourcesPath/swf
  3. appPath/swf
  4. execPath/../resources/swf
    ↓
Return first found path or null
```

---

## Files Modified

| File | Changes |
|------|---------|
| `index.js` | Added SWF path helpers, store defaults, fixed IPC handler |
| `renderer.js` | Async mode switching, webbar handlers, loading bar fixes |
| `services/panel-playwright-bridge.js` | Added 7 new methods |
| `package.json` | Version bump to 2.2.7 |

---

## Testing Checklist

- [ ] Switch left panel: Web → SWF → Hybrid → Web
- [ ] Switch right panel: Web → SWF → Hybrid → Web
- [ ] Rapid mode switching (no freeze)
- [ ] URL bar updates on navigation
- [ ] Back/Forward buttons work
- [ ] Refresh button works
- [ ] URL entry with Enter key
- [ ] Loading bar animation
- [ ] Error overlay appears on load failure
- [ ] Retry button works
- [ ] Clear cache & retry works
- [ ] Fallback to web mode works

---

## Upgrade Notes

This is a drop-in replacement for v2.2.6. No configuration changes required.

If you have custom SWF paths configured in settings, they will continue to work. The new path resolution is only used as a fallback when custom paths are not set.

---

## Known Issues

- Playwright requires browser binaries to be downloaded on first use (~130MB)
- ARM64 builds not available (Electron 9.x compatibility)

---

## Download Links

- [Windows x64 Installer](https://github.com/Ghenghis/SvonyBrowser/releases/download/v2.2.7/SvonyBrowser-Setup-2.2.7-x64.exe)
- [Windows x64 Portable](https://github.com/Ghenghis/SvonyBrowser/releases/download/v2.2.7/SvonyBrowser-Portable-2.2.7-x64.exe)
- [Windows x86 Installer](https://github.com/Ghenghis/SvonyBrowser/releases/download/v2.2.7/SvonyBrowser-Setup-2.2.7-ia32.exe)
- [Windows x86 Portable](https://github.com/Ghenghis/SvonyBrowser/releases/download/v2.2.7/SvonyBrowser-Portable-2.2.7-ia32.exe)
