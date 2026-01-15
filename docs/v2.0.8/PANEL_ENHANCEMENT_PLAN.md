# v2.0.8 Panel Enhancement Plan

## Current State Analysis

### Existing Panel Features
- Dual panel layout (left/right)
- Web/SWF toggle per panel
- Panel view modes (left only, both, right only)
- Panel swap functionality
- Resizable splitter
- Server selector
- Basic reload buttons

### Identified Gaps

1. **No failsafe mechanisms** - If SWF fails to load, no recovery options
2. **No panel state persistence** - Panel positions/modes not saved
3. **No URL history** - No back/forward navigation
4. **No bookmarks** - Can't save favorite URLs
5. **No panel sync** - Can't sync actions between panels
6. **Limited error handling** - No retry mechanisms
7. **No Playwright integration** - Web panels don't leverage Playwright
8. **No content detection** - Can't auto-detect SWF vs Web content
9. **No panel isolation** - Errors in one panel affect the other
10. **No loading indicators** - No visual feedback during loads

## v2.0.8 Enhancement Plan

### Phase 1: Panel Manager Service

Create a centralized panel management service with:
- Panel state tracking
- Mode detection (SWF/Web/Hybrid)
- Health monitoring
- Failsafe triggers
- Recovery mechanisms

### Phase 2: Enhanced Panel Controls

Per-panel toolbar with:
- Back/Forward navigation
- URL bar with autocomplete
- Bookmark button
- Refresh with cache clear option
- Screenshot capture
- Console toggle
- Zoom controls
- Fullscreen toggle

### Phase 3: Failsafe System

Multi-level failsafe chain:
1. **Level 1**: Retry with same URL
2. **Level 2**: Clear cache and retry
3. **Level 3**: Try alternate URL (backup server)
4. **Level 4**: Fall back to Web mode if SWF fails
5. **Level 5**: Show recovery UI with options

### Phase 4: Playwright Hybrid Integration

For Web mode panels:
- Auto-login capability
- Form auto-fill
- Screenshot on demand
- DOM inspection
- Network monitoring
- Cookie management
- Session persistence

### Phase 5: Panel Sync Features

- Mirror mode (actions in one panel replicate to other)
- Compare mode (side-by-side state comparison)
- Transfer mode (copy data between panels)
- Sync scroll (scroll both panels together)

### Phase 6: Enhanced UI/UX

- Panel status indicators (loading, ready, error)
- Connection quality indicator
- Flash plugin status per panel
- Memory usage per panel
- Traffic indicators per panel
- Animated transitions
- Drag-and-drop URL between panels

## Implementation Details

### Panel Manager Service Structure

```javascript
class PanelManager {
    constructor() {
        this.panels = {
            left: new PanelState('left'),
            right: new PanelState('right')
        };
        this.failsafeChain = new FailsafeChain();
        this.playwrightBridge = new PlaywrightBridge();
    }
}

class PanelState {
    constructor(id) {
        this.id = id;
        this.mode = 'web'; // 'web', 'swf', 'hybrid'
        this.url = '';
        this.history = [];
        this.historyIndex = -1;
        this.bookmarks = [];
        this.status = 'idle'; // 'loading', 'ready', 'error'
        this.health = 100;
        this.lastError = null;
        this.retryCount = 0;
    }
}

class FailsafeChain {
    constructor() {
        this.levels = [
            { name: 'retry', action: this.retry },
            { name: 'clearCache', action: this.clearCacheAndRetry },
            { name: 'alternateUrl', action: this.tryAlternateUrl },
            { name: 'fallbackMode', action: this.fallbackToWebMode },
            { name: 'recoveryUI', action: this.showRecoveryUI }
        ];
    }
}
```

### New IPC Handlers Required

- `panel-navigate` - Navigate panel to URL
- `panel-back` - Go back in history
- `panel-forward` - Go forward in history
- `panel-refresh` - Refresh with options
- `panel-set-mode` - Set SWF/Web mode
- `panel-screenshot` - Capture screenshot
- `panel-get-state` - Get panel state
- `panel-sync-action` - Sync action to other panel
- `panel-failsafe-trigger` - Trigger failsafe chain
- `panel-bookmark-add` - Add bookmark
- `panel-bookmark-remove` - Remove bookmark
- `panel-playwright-action` - Execute Playwright action

### UI Components to Add

1. **Panel Toolbar** (per panel)
   - Navigation buttons (back, forward, refresh)
   - URL bar with dropdown history
   - Mode indicator (SWF/Web badge)
   - Status indicator (colored dot)
   - Action menu (screenshot, console, etc.)

2. **Panel Status Bar** (per panel)
   - Loading progress bar
   - Connection status
   - Memory usage
   - Traffic indicator

3. **Panel Context Menu**
   - Copy URL
   - Open in other panel
   - Add to bookmarks
   - Take screenshot
   - View source
   - Inspect element
   - Clear panel cache

4. **Recovery Dialog**
   - Error description
   - Retry options
   - Alternative URLs
   - Mode switch option
   - Report issue button

## File Changes Required

### New Files
- `services/panel-manager.js` - Panel state management
- `services/failsafe-chain.js` - Failsafe mechanisms
- `services/panel-playwright-bridge.js` - Playwright integration for panels

### Modified Files
- `browser.html` - Enhanced panel UI
- `renderer.js` - Panel event handlers
- `index.js` - New IPC handlers
- `themes/svony-theme.css` - Panel styling
- `services/playwright-service.js` - Panel integration methods

## Testing Plan

1. **SWF Load Failure** - Test all failsafe levels
2. **Web Load Failure** - Test retry and fallback
3. **Network Disconnect** - Test recovery
4. **Flash Plugin Missing** - Test graceful degradation
5. **Panel Sync** - Test mirror mode accuracy
6. **History Navigation** - Test back/forward
7. **Bookmark Management** - Test add/remove/restore
8. **Playwright Actions** - Test auto-login, screenshot
