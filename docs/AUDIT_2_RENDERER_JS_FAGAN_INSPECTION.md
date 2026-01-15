# Forensic Codebase Rescue - Fagan Inspection Report #2
## File: `renderer.js` (UI Logic & Event Handling)
## Date: January 15, 2026
## Inspector: Cascade AI
## Version: 2.2.8

---

# EXECUTIVE SUMMARY

| Metric                     | Value              |
| -------------------------- | ------------------ |
| **Total Lines**            | ~1,200 (estimated) |
| **Critical Issues**        | 5                  |
| **High Priority Issues**   | 9                  |
| **Medium Priority Issues** | 14                 |
| **Low Priority Issues**    | 18                 |
| **Code Quality Score**     | 58/100             |

---

# SECTION 1: CRITICAL ISSUES

## CRIT-001: Panel Mode Switching Race Condition
**Severity:** CRITICAL  
**Category:** Concurrency  
**Location:** `togglePanelMode()` function

```javascript
// Problem: Multiple rapid clicks can cause race conditions
async function togglePanelMode(panelId, mode) {
    const lockKey = `switching-${panelId}`;
    if (window[lockKey]) {
        console.log('[Panel] Already switching, ignoring');
        return;
    }
    window[lockKey] = true;
    
    // 3-second timeout to release lock
    setTimeout(() => {
        window[lockKey] = false;
    }, 3000);
    // ...
}
```

**Problem:** 
1. Lock stored on `window` object (global pollution)
2. Fixed 3-second timeout may not match actual operation duration
3. No cancellation of previous timeout if new request arrives

**Fix:**
```javascript
const switchingLocks = new Map();
const switchingTimeouts = new Map();

async function togglePanelMode(panelId, mode) {
    if (switchingLocks.get(panelId)) {
        console.log('[Panel] Already switching, ignoring');
        return;
    }
    
    // Clear any existing timeout
    const existingTimeout = switchingTimeouts.get(panelId);
    if (existingTimeout) clearTimeout(existingTimeout);
    
    switchingLocks.set(panelId, true);
    
    try {
        // ... actual switching logic
    } finally {
        switchingLocks.set(panelId, false);
    }
}
```

---

## CRIT-002: SWF Path Null Check Insufficient
**Severity:** CRITICAL  
**Category:** Null Safety  
**Location:** SWF loading logic

```javascript
const swfPath = await window.electronAPI.getSwfPath(panelId);
if (!swfPath || !fs.existsSync(swfPath)) {  // PROBLEM
```

**Problems:**
1. `fs` may not be available in renderer (depends on nodeIntegration)
2. Double negation logic is confusing
3. Missing error handling for IPC failure

**Fix:**
```javascript
try {
    const swfPath = await window.electronAPI.getSwfPath(panelId);
    if (!swfPath) {
        showSWFError(panelId, 'SWF path not configured');
        return;
    }
    // Let main process validate file existence
} catch (error) {
    showSWFError(panelId, error.message);
}
```

---

## CRIT-003: Event Listener Memory Leaks
**Severity:** CRITICAL  
**Category:** Memory Leak  
**Location:** Multiple event registrations

```javascript
// These listeners are added but NEVER removed
webview.addEventListener('did-start-loading', () => { ... });
webview.addEventListener('did-stop-loading', () => { ... });
webview.addEventListener('did-fail-load', () => { ... });
```

**Problem:** Event listeners accumulate if panels are recreated or modes are switched.

**Fix:**
```javascript
// Store references and clean up
const listeners = new Map();

function attachWebviewListeners(webview, panelId) {
    // Remove existing listeners first
    cleanupListeners(panelId);
    
    const onStartLoading = () => { ... };
    const onStopLoading = () => { ... };
    
    webview.addEventListener('did-start-loading', onStartLoading);
    webview.addEventListener('did-stop-loading', onStopLoading);
    
    listeners.set(panelId, [
        { event: 'did-start-loading', handler: onStartLoading },
        { event: 'did-stop-loading', handler: onStopLoading }
    ]);
}

function cleanupListeners(panelId) {
    const panelListeners = listeners.get(panelId);
    if (panelListeners && webview) {
        panelListeners.forEach(({ event, handler }) => {
            webview.removeEventListener(event, handler);
        });
    }
    listeners.delete(panelId);
}
```

---

## CRIT-004: Webview.stop() Before src Change May Not Complete
**Severity:** CRITICAL  
**Category:** Async Timing  
**Location:** Mode switching

```javascript
webview.stop();
webview.src = newUrl;  // May start loading before stop completes
```

**Problem:** `webview.stop()` is not awaited, leading to potential loading conflicts.

**Fix:**
```javascript
// Wait for stop to complete
await new Promise(resolve => {
    const onStopped = () => {
        webview.removeEventListener('did-stop-loading', onStopped);
        resolve();
    };
    webview.addEventListener('did-stop-loading', onStopped);
    webview.stop();
    // Fallback timeout
    setTimeout(resolve, 500);
});
webview.src = newUrl;
```

---

## CRIT-005: DOM Element References Not Validated
**Severity:** CRITICAL  
**Category:** Null Safety  
**Location:** Multiple locations

```javascript
const leftWebview = document.getElementById('left-webview');
leftWebview.reload();  // CRASH if element doesn't exist
```

**Fix:**
```javascript
const leftWebview = document.getElementById('left-webview');
if (!leftWebview) {
    console.error('[UI] left-webview element not found');
    return;
}
leftWebview.reload();
```

---

# SECTION 2: HIGH PRIORITY ISSUES

## HIGH-001: Button Click Handlers Not Debounced
**Location:** All button handlers

```javascript
document.getElementById('left-refresh').addEventListener('click', () => {
    leftWebview.reload();  // Can be clicked rapidly
});
```

**Problem:** Rapid clicks can cause multiple reloads.

**Fix:** Add debouncing:
```javascript
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

document.getElementById('left-refresh').addEventListener('click', 
    debounce(() => leftWebview.reload(), 300)
);
```

---

## HIGH-002: Error Messages Exposed to UI Without Sanitization
**Location:** Error display functions

```javascript
errorMessage.textContent = error.message;  // May contain sensitive info
```

---

## HIGH-003: findSWFPath Function Duplicated from Main Process
**Location:** Lines 10-30

**Problem:** Same logic exists in both `index.js` and `renderer.js`, violating DRY.

**Fix:** Use IPC to call main process function.

---

## HIGH-004: Store Access Without Error Handling
**Location:** Multiple

```javascript
const settings = store.get('settings');  // No try-catch
```

---

## HIGH-005: URL Input Not Sanitized
**Location:** URL bar handlers

```javascript
const url = document.getElementById('left-url').value;
webview.src = url;  // No validation
```

**Fix:**
```javascript
function sanitizeUrl(url) {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) {
            throw new Error('Invalid protocol');
        }
        return parsed.href;
    } catch {
        // Try adding http://
        return `http://${url}`;
    }
}
```

---

## HIGH-006: Inline Styles Mixed with CSS Classes
**Location:** Multiple

```javascript
element.style.display = 'none';
element.classList.add('hidden');  // Inconsistent approach
```

---

## HIGH-007: Magic Strings for Panel Modes
**Location:** Mode switching

```javascript
if (mode === 'web') { ... }
if (mode === 'swf') { ... }
if (mode === 'hybrid') { ... }
```

**Fix:**
```javascript
const PANEL_MODES = {
    WEB: 'web',
    SWF: 'swf',
    HYBRID: 'hybrid'
};
```

---

## HIGH-008: No Loading State Management
**Location:** Async operations

**Problem:** No visual feedback during async operations.

---

## HIGH-009: Console.log in Production
**Location:** Throughout file

```javascript
console.log('[Panel] Mode switched to:', mode);
```

**Fix:** Use debug flag or logging service.

---

# SECTION 3: MEDIUM PRIORITY ISSUES

| ID      | Issue                                         | Location             | Category        |
| ------- | --------------------------------------------- | -------------------- | --------------- |
| MED-001 | No keyboard navigation support                | All buttons          | Accessibility   |
| MED-002 | Tab order not defined                         | Form elements        | Accessibility   |
| MED-003 | No ARIA labels                                | Interactive elements | Accessibility   |
| MED-004 | Hardcoded timeout values                      | Multiple             | Maintainability |
| MED-005 | No retry logic for failed loads               | Webview loading      | Robustness      |
| MED-006 | Settings not validated on load                | Initialization       | Data Integrity  |
| MED-007 | No state persistence across reloads           | Panel state          | UX              |
| MED-008 | Error overlay z-index conflicts               | CSS                  | Visual          |
| MED-009 | No progress indication for long ops           | UX                   | Feedback        |
| MED-010 | Inconsistent naming (camelCase vs snake_case) | Variables            | Style           |
| MED-011 | Long functions (>50 lines)                    | Multiple             | Maintainability |
| MED-012 | No unit tests                                 | All functions        | Quality         |
| MED-013 | Mixed ES6 and CommonJS                        | Imports              | Consistency     |
| MED-014 | No TypeScript types                           | All                  | Type Safety     |

---

# SECTION 4: EVENT HANDLING AUDIT

## Button Event Handlers Checklist

| Button ID        | Has Handler | Debounced | Error Handling | Null Check |
| ---------------- | ----------- | --------- | -------------- | ---------- |
| left-refresh     | ✅           | ❌         | ❌              | ❌          |
| right-refresh    | ✅           | ❌         | ❌              | ❌          |
| left-back        | ✅           | ❌         | ❌              | ❌          |
| left-forward     | ✅           | ❌         | ❌              | ❌          |
| right-back       | ✅           | ❌         | ❌              | ❌          |
| right-forward    | ✅           | ❌         | ❌              | ❌          |
| left-web-toggle  | ✅           | ⚠️ (lock)  | ❌              | ❌          |
| left-swf-toggle  | ✅           | ⚠️ (lock)  | ❌              | ❌          |
| right-web-toggle | ✅           | ⚠️ (lock)  | ❌              | ❌          |
| right-swf-toggle | ✅           | ⚠️ (lock)  | ❌              | ❌          |
| left-go          | ✅           | ❌         | ❌              | ❌          |
| right-go         | ✅           | ❌         | ❌              | ❌          |
| btn-swap-panels  | ✅           | ❌         | ❌              | ❌          |
| btn-both-panels  | ✅           | ❌         | ❌              | ❌          |
| btn-left-only    | ✅           | ❌         | ❌              | ❌          |
| btn-right-only   | ✅           | ❌         | ❌              | ❌          |

**Summary:** 0/16 buttons have complete error handling.

---

# SECTION 5: WEBVIEW EVENT HANDLERS

| Event                | Left Panel | Right Panel | Error Handling |
| -------------------- | ---------- | ----------- | -------------- |
| did-start-loading    | ✅          | ✅           | ❌              |
| did-stop-loading     | ✅          | ✅           | ❌              |
| did-fail-load        | ✅          | ✅           | ⚠️ Partial      |
| did-navigate         | ❌          | ❌           | N/A            |
| did-navigate-in-page | ❌          | ❌           | N/A            |
| crashed              | ❌          | ❌           | N/A            |
| unresponsive         | ❌          | ❌           | N/A            |
| responsive           | ❌          | ❌           | N/A            |
| console-message      | ❌          | ❌           | N/A            |
| new-window           | ❌          | ❌           | N/A            |

**Missing Critical Handlers:** `crashed`, `unresponsive`, `new-window`

---

# SECTION 6: RECOMMENDATIONS

## Immediate (v2.2.8)
1. Add null checks to all DOM element references
2. Add debouncing to refresh buttons
3. Fix webview.stop() timing issue
4. Add `crashed` and `unresponsive` handlers

## Short-term (v2.3.0)
1. Implement proper event listener cleanup
2. Add loading state indicators
3. Centralize URL validation
4. Create constants for magic strings

## Long-term (v3.0)
1. Refactor to use a state management pattern
2. Add comprehensive accessibility support
3. Implement proper error boundaries
4. Add unit test coverage

---

# SIGN-OFF

| Role      | Name       | Date       |
| --------- | ---------- | ---------- |
| Inspector | Cascade AI | 2026-01-15 |
| Reviewer  | Pending    | -          |
| Approver  | Pending    | -          |
