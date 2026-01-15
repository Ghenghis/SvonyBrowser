# Fagan Inspection: Protocol Handler Deep Audit

**Document ID:** FI-037  
**File:** `services/protocol-handler.js`  
**Inspector:** Automated Fagan Analysis  
**Date:** 2025-01-15  
**Severity:** HIGH - Core Protocol Handling

---

## 1. Executive Summary

The Protocol Handler service manages custom URL protocols (evony://, svony://) and handles deep linking into the application. This audit examines all protocol registration, parsing, and routing logic.

---

## 2. Line-by-Line Analysis

### Lines 1-20: Module Setup
```javascript
// Line 1: Strict mode declaration
'use strict';

// Lines 3-6: Core dependencies
const { app, protocol } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
```

**Finding FI-037-001:** Dependencies correctly imported.

### Lines 22-45: Protocol Registration
```javascript
// Line 22: Register custom protocols
function registerProtocols() {
  // Line 24: Register evony:// protocol
  protocol.registerHttpProtocol('evony', (request, callback) => {
    // Line 26: Parse the URL
    const parsedUrl = url.parse(request.url);
    
    // Line 28: Route to appropriate handler
    handleEvonyProtocol(parsedUrl, callback);
  });
  
  // Line 32: Register svony:// protocol  
  protocol.registerHttpProtocol('svony', (request, callback) => {
    const parsedUrl = url.parse(request.url);
    handleSvonyProtocol(parsedUrl, callback);
  });
}
```

**Finding FI-037-002:** Protocol registration uses deprecated `registerHttpProtocol`.
- **Severity:** MEDIUM
- **Recommendation:** Use `protocol.handle()` for Electron 25+

### Lines 47-80: Evony Protocol Handler
```javascript
// Line 47: Handle evony:// URLs
function handleEvonyProtocol(parsedUrl, callback) {
  // Line 49: Extract server from hostname
  const server = parsedUrl.hostname; // cc1, cc2, etc.
  
  // Line 51: Extract action from pathname
  const action = parsedUrl.pathname.slice(1); // Remove leading /
  
  // Line 54: Parse query parameters
  const params = new URLSearchParams(parsedUrl.query);
  
  // Line 57: Route based on action
  switch (action) {
    case 'login':
      // Line 59: Handle login deep link
      handleLoginAction(server, params, callback);
      break;
    case 'city':
      // Line 62: Handle city navigation
      handleCityAction(server, params, callback);
      break;
    case 'alliance':
      // Line 65: Handle alliance view
      handleAllianceAction(server, params, callback);
      break;
    default:
      // Line 68: Unknown action - redirect to server
      callback({ url: `https://${server}.evony.com/` });
  }
}
```

**Finding FI-037-003:** No input validation on server parameter.
- **Severity:** HIGH
- **Impact:** Potential URL injection
- **Line:** 49
- **Fix Required:**
```javascript
const validServers = ['cc1', 'cc2', 'cc3', 'cc4', 'cc5'];
if (!validServers.includes(server)) {
  callback({ error: -6 }); // NET_ERR_FILE_NOT_FOUND
  return;
}
```

### Lines 82-110: Login Action Handler
```javascript
// Line 82: Handle login deep link
function handleLoginAction(server, params, callback) {
  // Line 84: Extract credentials from params
  const username = params.get('user');
  const password = params.get('pass');
  
  // Line 88: SECURITY ISSUE - passwords in URL
  if (username && password) {
    // Line 90: Store credentials temporarily
    global.pendingLogin = { server, username, password };
  }
  
  // Line 94: Redirect to login page
  callback({ url: `https://${server}.evony.com/login.php` });
}
```

**Finding FI-037-004:** CRITICAL SECURITY - Passwords passed in URL.
- **Severity:** CRITICAL
- **Impact:** Credentials exposed in logs, history, referrer headers
- **Line:** 84-90
- **Recommendation:** Remove password support from URL protocol

### Lines 112-140: City Action Handler
```javascript
// Line 112: Handle city navigation
function handleCityAction(server, params, callback) {
  // Line 114: Get city ID
  const cityId = params.get('id');
  
  // Line 117: Validate city ID
  if (!cityId || isNaN(parseInt(cityId))) {
    callback({ error: -6 });
    return;
  }
  
  // Line 123: Build city URL
  const cityUrl = `https://${server}.evony.com/city.php?id=${cityId}`;
  callback({ url: cityUrl });
}
```

**Finding FI-037-005:** Good input validation on city ID.
- **Severity:** INFO
- **Status:** COMPLIANT

### Lines 142-180: File Protocol Handler
```javascript
// Line 142: Register file protocol for local resources
function registerFileProtocol() {
  protocol.registerFileProtocol('svony-local', (request, callback) => {
    // Line 145: Parse file path from URL
    const filePath = request.url.replace('svony-local://', '');
    
    // Line 148: SECURITY - Path traversal check
    const normalizedPath = path.normalize(filePath);
    const appPath = app.getAppPath();
    
    // Line 152: Ensure path is within app directory
    if (!normalizedPath.startsWith(appPath)) {
      callback({ error: -6 });
      return;
    }
    
    // Line 158: Return file
    callback({ path: normalizedPath });
  });
}
```

**Finding FI-037-006:** Good path traversal protection.
- **Severity:** INFO
- **Status:** COMPLIANT

---

## 3. Security Analysis

| Issue | Severity | Line | Status |
|-------|----------|------|--------|
| Password in URL | CRITICAL | 84-90 | OPEN |
| No server validation | HIGH | 49 | OPEN |
| Path traversal protected | INFO | 148-156 | COMPLIANT |

---

## 4. Recommendations

1. **Remove password support from URL protocol** (CRITICAL)
2. **Add server whitelist validation** (HIGH)
3. **Migrate to protocol.handle()** (MEDIUM)
4. **Add rate limiting for protocol handlers** (LOW)

---

## 5. Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Inspector | Automated | 2025-01-15 | COMPLETE |
| Reviewer | Pending | - | PENDING |
