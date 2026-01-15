# Fagan Inspection: Store.js Deep Audit

**Document ID:** FI-038  
**File:** `store.js`  
**Inspector:** Automated Fagan Analysis  
**Date:** 2025-01-15  
**Severity:** MEDIUM - Configuration Persistence

---

## 1. Executive Summary

The Store module provides persistent configuration storage using electron-store. This audit examines data persistence, encryption, and default value handling.

---

## 2. Line-by-Line Analysis

### Lines 1-15: Module Setup
```javascript
// Line 1: Strict mode
'use strict';

// Line 3: Import electron-store
const Store = require('electron-store');

// Lines 6-14: Schema definition
const schema = {
  windowBounds: {
    type: 'object',
    properties: {
      width: { type: 'number', default: 1400 },
      height: { type: 'number', default: 900 },
      x: { type: 'number' },
      y: { type: 'number' }
    }
  }
};
```

**Finding FI-038-001:** Schema correctly defines window bounds.

### Lines 17-45: Store Configuration
```javascript
// Line 17: Create store instance
const store = new Store({
  // Line 19: Schema validation
  schema,
  
  // Line 21: Store name
  name: 'svony-browser-config',
  
  // Line 24: Default values
  defaults: {
    windowBounds: { width: 1400, height: 900 },
    leftPanelUrl: 'file://swf/AutoEvony.swf',
    rightPanelUrl: 'https://cc2.evony.com/',
    selectedServer: 'cc2',
    theme: 'dark',
    flashEnabled: true,
    hybridModeEnabled: false,
    aiProvider: 'lmstudio',
    aiEndpoint: 'http://localhost:1234',
    trafficCapture: false,
    debugMode: false
  },
  
  // Line 38: Encryption key for sensitive data
  encryptionKey: process.env.STORE_ENCRYPTION_KEY || 'svony-default-key'
});
```

**Finding FI-038-002:** Hardcoded default encryption key.
- **Severity:** HIGH
- **Impact:** Sensitive data not properly protected
- **Line:** 38
- **Recommendation:** Generate unique key per installation

**Finding FI-038-003:** Left panel URL uses file:// protocol.
- **Severity:** MEDIUM
- **Impact:** May not work in packaged app
- **Line:** 26
- **Fix:** Use app:// or svony-local:// protocol

### Lines 47-70: Getter Methods
```javascript
// Line 47: Get window bounds
function getWindowBounds() {
  return store.get('windowBounds');
}

// Line 52: Get panel URLs
function getPanelUrls() {
  return {
    left: store.get('leftPanelUrl'),
    right: store.get('rightPanelUrl')
  };
}

// Line 60: Get all settings
function getAllSettings() {
  return store.store; // Returns entire store object
}
```

**Finding FI-038-004:** getAllSettings exposes entire store.
- **Severity:** LOW
- **Impact:** May expose sensitive settings
- **Line:** 60

### Lines 72-100: Setter Methods
```javascript
// Line 72: Set window bounds
function setWindowBounds(bounds) {
  // Line 74: Validate bounds
  if (bounds && typeof bounds === 'object') {
    store.set('windowBounds', bounds);
  }
}

// Line 80: Set panel URL
function setPanelUrl(panel, url) {
  // Line 82: Validate panel
  if (panel !== 'left' && panel !== 'right') {
    throw new Error('Invalid panel: must be left or right');
  }
  
  // Line 87: Validate URL
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL');
  }
  
  // Line 92: Set URL
  const key = panel === 'left' ? 'leftPanelUrl' : 'rightPanelUrl';
  store.set(key, url);
}
```

**Finding FI-038-005:** Good input validation on setters.
- **Severity:** INFO
- **Status:** COMPLIANT

### Lines 102-130: Sensitive Data Handling
```javascript
// Line 102: Store credentials (ENCRYPTED)
function storeCredentials(server, username, password) {
  // Line 104: Get existing credentials
  const credentials = store.get('credentials', {});
  
  // Line 107: Add new credentials
  credentials[server] = {
    username,
    password, // Encrypted by electron-store
    savedAt: Date.now()
  };
  
  // Line 114: Save
  store.set('credentials', credentials);
}

// Line 118: Get credentials
function getCredentials(server) {
  const credentials = store.get('credentials', {});
  return credentials[server] || null;
}

// Line 124: Clear credentials
function clearCredentials(server) {
  const credentials = store.get('credentials', {});
  delete credentials[server];
  store.set('credentials', credentials);
}
```

**Finding FI-038-006:** Credentials stored with encryption.
- **Severity:** MEDIUM
- **Note:** Encryption only as strong as the key (see FI-038-002)

---

## 3. Data Flow Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│                     STORE DATA FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Application                                                    │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Getters   │◄──►│   Store     │◄──►│   Setters   │         │
│  │ get*()      │    │  Instance   │    │ set*()      │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                            │                                    │
│                            ▼                                    │
│                    ┌─────────────┐                              │
│                    │  JSON File  │                              │
│                    │ (encrypted) │                              │
│                    └─────────────┘                              │
│                            │                                    │
│                            ▼                                    │
│                    %APPDATA%/svony-browser-config.json          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Security Findings

| Issue | Severity | Line | Status |
|-------|----------|------|--------|
| Hardcoded encryption key | HIGH | 38 | OPEN |
| file:// URL default | MEDIUM | 26 | OPEN |
| getAllSettings exposure | LOW | 60 | OPEN |

---

## 5. Recommendations

1. **Generate unique encryption key per installation** (HIGH)
2. **Use app-relative paths for default URLs** (MEDIUM)
3. **Filter sensitive data from getAllSettings** (LOW)
4. **Add migration support for schema changes** (LOW)

---

## 6. Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Inspector | Automated | 2025-01-15 | COMPLETE |
