# Svony Browser v2.0.8 Release Notes

## Release Date: January 2025

## Overview

Version 2.0.8 is a major UX/UI enhancement release focused on the dual-panel browser system with extensive Playwright hybrid integration and robust failsafe mechanisms for both SWF and Web content.

---

## New Features

### Enhanced Panel System

#### Panel Manager Service (~900 lines)
- **Complete panel state management** with navigation history, bookmarks, and health monitoring
- **Content type detection** - Automatically detects SWF, Web, and Hybrid content
- **Panel sync modes** - Mirror, Compare, and Transfer modes for dual-panel coordination
- **State persistence** - Saves and restores panel state across sessions

#### Panel Navigation Toolbar
- **Back/Forward buttons** with full history tracking
- **URL bar** with auto-complete and search integration
- **Refresh/Stop buttons** with loading state indicators
- **Bookmark button** for quick page saving
- **Screenshot button** for capturing panel content
- **Console button** for JavaScript debugging
- **Panel menu** for advanced options

#### Panel Status Indicators
- **Mode badge** - Shows current mode (Web/SWF/Hybrid)
- **Health bar** - Visual indicator of panel performance
- **Status indicator** - Shows loading/ready/error states
- **Loading progress bar** - Animated loading indicator

### Failsafe Recovery System

#### 5-Level Recovery Chain
| Level | Action | Description |
|-------|--------|-------------|
| 1 | Simple Retry | Basic page reload |
| 2 | Clear Cache & Retry | Clears browser cache before reload |
| 3 | Alternate URL | Tries backup URL if available |
| 4 | Mode Fallback | Switches from SWF to Web mode |
| 5 | Recovery UI | Shows manual recovery options |

#### Error Overlay
- **Clear error messages** with technical details
- **One-click recovery buttons** for each failsafe level
- **Technical details accordion** for debugging

### Playwright Hybrid Integration

#### Panel Playwright Bridge (~650 lines)
- **Hybrid session management** - Run Playwright alongside Electron webviews
- **Auto-login capability** - Automated login with saved credentials
- **Form auto-fill** - Automatically fill forms with saved data
- **Session persistence** - Maintains login state across sessions
- **Network monitoring** - Captures all network requests
- **Request interception** - Modify requests before they're sent
- **Screenshot capture** - High-quality screenshots via Playwright

### Panel Sync Features

#### Sync Modes
- **Off** - Panels operate independently
- **Mirror** - Navigation synced between panels
- **Compare** - Side-by-side comparison mode
- **Transfer** - Copy content between panels

#### Sync Controls
- Floating sync control bar at bottom of browser
- Visual indicators for active sync mode
- One-click mode switching

### Panel UI Controller (~800 lines)
- **Renderer-side panel management** for responsive UI
- **Keyboard shortcuts** for power users
- **Context menu** with panel-specific actions
- **Bookmarks dropdown** with management features
- **Console panel** for JavaScript execution

---

## UI/UX Improvements

### Enhanced Panel Headers
- Gradient backgrounds with color coding (green/blue)
- Mode badges with color indicators
- Health bars with warning/critical states
- Status indicators with pulse animations

### Panel Toolbar
- Compact navigation controls
- Full-width URL bar with focus selection
- Action buttons with tooltips
- Responsive layout for different window sizes

### Context Menu
- Copy URL
- Open in Other Panel
- Add Bookmark
- Take Screenshot
- View Source
- Inspect Element
- Clear Cache
- Reset Panel

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Alt+Left | Go Back |
| Alt+Right | Go Forward |
| F5 | Refresh Left Panel |
| F6 | Refresh Right Panel |
| Ctrl+L | Focus URL Bar |
| Ctrl+D | Add Bookmark |
| Escape | Close Menu/Console |

---

## New IPC Handlers

### Panel Manager Handlers
- `panel-get-state` - Get panel state
- `panel-navigate` - Navigate to URL
- `panel-go-back` - Go back in history
- `panel-go-forward` - Go forward in history
- `panel-refresh` - Refresh panel
- `panel-set-mode` - Set panel mode
- `get-swf-path` - Get SWF file path
- `panel-add-bookmark` - Add bookmark
- `panel-remove-bookmark` - Remove bookmark
- `panel-get-bookmarks` - Get bookmarks list
- `panel-get-history` - Get navigation history
- `panel-screenshot` - Take screenshot
- `panel-set-sync-mode` - Set sync mode
- `panel-get-sync-mode` - Get sync mode
- `panel-failsafe-recover` - Execute failsafe
- `panel-get-health` - Get panel health

### Playwright Bridge Handlers
- `panel-hybrid-start` - Start hybrid session
- `panel-hybrid-stop` - Stop hybrid session
- `panel-hybrid-login` - Auto-login
- `panel-hybrid-fill-form` - Auto-fill form
- `panel-hybrid-execute` - Execute script
- `panel-hybrid-status` - Get session status
- `panel-hybrid-intercept` - Intercept requests
- `panel-hybrid-network-log` - Get network log

---

## CSS Enhancements

### New Styles Added
- Panel header with gradient backgrounds
- Mode badges with color coding
- Health bars with animation
- Status indicators with pulse effect
- Panel toolbar with responsive layout
- Loading bar with animation
- Error overlay with recovery buttons
- Console panel with syntax highlighting
- Context menu with hover effects
- Bookmarks dropdown with management
- Sync controls with floating design
- Splitter handle with hover effect

---

## Files Added/Modified

### New Files
- `services/panel-manager.js` - Panel state management
- `services/panel-playwright-bridge.js` - Playwright integration
- `services/panel-ui-controller.js` - Renderer-side UI controller
- `docs/v2.0.8/PANEL_ENHANCEMENT_PLAN.md` - Design document
- `docs/v2.0.8/RELEASE_NOTES.md` - This file

### Modified Files
- `index.js` - Added 30+ new IPC handlers
- `browser.html` - Enhanced panel UI with toolbars
- `themes/svony-theme.css` - Added 400+ lines of new styles

---

## Workflow Optimization

Fixed duplicate workflow runs by consolidating:
- `ci.yml` - Only runs on branch pushes (not tags)
- `build.yml` - Only runs on tag pushes

---

## How to Use

### Panel Navigation
1. Use the toolbar buttons to navigate back/forward
2. Enter URLs in the URL bar and press Enter
3. Click the refresh button to reload
4. Use keyboard shortcuts for faster navigation

### Panel Modes
1. Click **Web** for standard web browsing
2. Click **SWF** to load Flash content
3. Click **Hybrid** for Playwright-enhanced browsing

### Sync Modes
1. Click the sync button in the floating bar
2. Choose Mirror to sync navigation
3. Choose Compare for side-by-side viewing
4. Choose Transfer to copy between panels

### Bookmarks
1. Click the star button to bookmark current page
2. Click the star again to view bookmarks
3. Click a bookmark to navigate
4. Click X to delete a bookmark

### Error Recovery
1. When an error occurs, the overlay appears
2. Click "Retry" for simple reload
3. Click "Clear Cache & Retry" to clear cache first
4. Click "Try Web Mode" to fallback from SWF

---

## Download

- **Windows x64 Installer**: `SvonyBrowser-Setup-2.0.8-x64.exe`
- **Windows x64 Portable**: `SvonyBrowser-Portable-2.0.8-x64.exe`
- **Windows x86 Installer**: `SvonyBrowser-Setup-2.0.8-ia32.exe`
- **Windows x86 Portable**: `SvonyBrowser-Portable-2.0.8-ia32.exe`

---

## Coming in v2.0.9

- Enhanced MCP server integration with panel context
- Panel-specific traffic capture
- Advanced Playwright automation scripts
- Panel templates for common workflows
- Multi-account session management
