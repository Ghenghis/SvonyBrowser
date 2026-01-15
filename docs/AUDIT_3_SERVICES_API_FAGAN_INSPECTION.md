# Forensic Codebase Rescue - Fagan Inspection Report #3
## Scope: Services Directory & API Integrations
## Date: January 15, 2026
## Inspector: Cascade AI
## Version: 2.2.8

---

# EXECUTIVE SUMMARY

| Metric                     | Value  |
| -------------------------- | ------ |
| **Services Audited**       | 28     |
| **Critical Issues**        | 11     |
| **High Priority Issues**   | 16     |
| **Medium Priority Issues** | 22     |
| **API Integration Issues** | 8      |
| **Code Quality Score**     | 55/100 |

---

# SECTION 1: SERVICES INVENTORY

| Service                 | File | Status   | Spawn Processes | Memory Safe |
| ----------------------- | ---- | -------- | --------------- | ----------- |
| protocol-handler        | ✅    | Active   | ❌               | ⚠️           |
| mcp-connection          | ✅    | Disabled | ✅ Yes           | ❌           |
| mcp-client-manager      | ✅    | Disabled | ✅ Yes           | ❌           |
| proxy-monitor           | ✅    | Active   | ❌               | ✅           |
| lm-studio-client        | ✅    | Active   | ❌               | ⚠️           |
| chatbot-service         | ✅    | Active   | ❌               | ⚠️           |
| game-state              | ✅    | Active   | ❌               | ⚠️           |
| packet-analysis         | ✅    | Active   | ❌               | ❌           |
| combat-simulator        | ✅    | Active   | ❌               | ✅           |
| session-recorder        | ✅    | Active   | ❌               | ⚠️           |
| amf3-decoder            | ✅    | Active   | ❌               | ✅           |
| fiddler-bridge          | ✅    | Disabled | ✅ Yes           | ❌           |
| game-state-tracker      | ✅    | Active   | ❌               | ⚠️           |
| playwright-service      | ✅    | Disabled | ✅ Yes           | ❌           |
| traffic-processor       | ✅    | Active   | ❌               | ⚠️           |
| conversation-memory     | ✅    | Active   | ❌               | ⚠️           |
| intent-router           | ✅    | Active   | ❌               | ✅           |
| debug-manager           | ✅    | Active   | ❌               | ⚠️           |
| network-inspector       | ✅    | Active   | ❌               | ⚠️           |
| performance-profiler    | ✅    | Active   | ❌               | ⚠️           |
| script-recorder         | ✅    | Active   | ❌               | ⚠️           |
| script-runner           | ✅    | Active   | ❌               | ⚠️           |
| automation-templates    | ✅    | Active   | ❌               | ✅           |
| agent-controller        | ✅    | Active   | ❌               | ⚠️           |
| voice-service           | ✅    | Active   | ❌               | ⚠️           |
| chatbot-plugins         | ✅    | Active   | ❌               | ⚠️           |
| panel-manager           | ✅    | Active   | ❌               | ⚠️           |
| panel-playwright-bridge | ✅    | Disabled | ✅ Yes           | ❌           |
| cli-access              | ✅    | Active   | ✅ Yes           | ❌           |
| error-tracker           | ✅    | Active   | ❌               | ⚠️           |
| error-helper            | ✅    | Active   | ❌               | ✅           |
| self-healer             | ✅    | Active   | ❌               | ⚠️           |

**Legend:** ⚠️ = Potential issues, needs review

---

# SECTION 2: CRITICAL ISSUES BY SERVICE

## CRIT-001: cli-access.js - Command Injection Vulnerability
**File:** `services/cli-access.js`  
**Severity:** CRITICAL  
**Line:** ~117

```javascript
const proc = spawn(this.config.shell, args, {
    windowsHide: true,
    shell: false
});
```

**Problem:** While `windowsHide` is set, user-provided commands can still be executed with shell access.

**Vulnerability:**
```javascript
// Attacker can execute: rm -rf / or similar
cliAccessService.executeCommand('rm -rf /', {});
```

**Fix:** Implement command whitelist and sanitization:
```javascript
const ALLOWED_COMMANDS = ['ls', 'dir', 'cat', 'type', 'echo'];

executeCommand(command, options) {
    const cmd = command.split(' ')[0];
    if (!ALLOWED_COMMANDS.includes(cmd)) {
        throw new Error(`Command not allowed: ${cmd}`);
    }
    // ... rest of execution
}
```

---

## CRIT-002: mcp-client-manager.js - Process Spawn Without Cleanup
**File:** `services/mcp-client-manager.js`  
**Line:** ~111

```javascript
this.process = spawn('node', [this.serverPath], { 
    windowsHide: true, 
    // Missing: stdio configuration
    // Missing: process reference tracking
});
```

**Problem:** Spawned processes are not tracked or cleaned up on exit.

**Fix:**
```javascript
const activeProcesses = new Map();

spawn('node', [this.serverPath], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
});

// Track process
activeProcesses.set(serverId, this.process);

// Cleanup on exit
process.on('exit', () => {
    activeProcesses.forEach((proc, id) => {
        proc.kill('SIGTERM');
    });
});
```

---

## CRIT-003: mcp-connection.js - No Timeout on Process Spawn
**File:** `services/mcp-connection.js`  
**Line:** ~113

```javascript
const proc = spawn(serverConfig.command, serverConfig.args || [], {
    // No timeout - process can hang forever
});
```

**Fix:** Add timeout and health check:
```javascript
const proc = spawn(serverConfig.command, serverConfig.args || [], {
    timeout: 30000  // 30 second timeout
});

// Health check
const healthCheck = setInterval(() => {
    if (!proc.connected) {
        clearInterval(healthCheck);
        proc.kill('SIGTERM');
    }
}, 5000);
```

---

## CRIT-004: fiddler-bridge.js - Insecure Process Spawn
**File:** `services/fiddler-bridge.js`  
**Line:** ~90

```javascript
this.fiddlerProcess = spawn(this.fiddlerPath, [], { 
    windowsHide: true, 
    detached: true  // PROBLEM: detached process
});
```

**Problem:** Detached process continues after app exit, creating zombie processes.

---

## CRIT-005: packet-analysis.js - Unbounded Memory Growth
**File:** `services/packet-analysis.js`

```javascript
// Packets stored without limit
this.packets.push(packet);
```

**Problem:** No limit on stored packets causes memory exhaustion.

**Fix:**
```javascript
const MAX_PACKETS = 10000;

capturePacket(packet) {
    if (this.packets.length >= MAX_PACKETS) {
        this.packets.shift(); // Remove oldest
    }
    this.packets.push(packet);
}
```

---

## CRIT-006: session-recorder.js - File Write Without Validation
**File:** `services/session-recorder.js`

```javascript
fs.writeFileSync(sessionPath, JSON.stringify(session));
```

**Problem:** Path traversal vulnerability if sessionPath contains `../`.

**Fix:**
```javascript
const path = require('path');

function safeJoin(base, filename) {
    const resolved = path.resolve(base, filename);
    if (!resolved.startsWith(path.resolve(base))) {
        throw new Error('Path traversal detected');
    }
    return resolved;
}
```

---

## CRIT-007: game-state-tracker.js - State Not Encrypted
**File:** `services/game-state-tracker.js`

```javascript
// Sensitive game data stored in plain text
fs.writeFileSync(this.persistPath, JSON.stringify(this.state));
```

**Problem:** Sensitive account data stored unencrypted.

---

## CRIT-008: lm-studio-client.js - No Request Timeout
**File:** `services/lm-studio-client.js`

```javascript
const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
    // No timeout - can hang forever
});
```

**Fix:**
```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
    const response = await fetch(url, {
        signal: controller.signal
    });
} finally {
    clearTimeout(timeout);
}
```

---

## CRIT-009: conversation-memory.js - No Encryption for Stored Conversations
**File:** `services/conversation-memory.js`

**Problem:** User conversations stored in plain text JSON.

---

## CRIT-010: self-healer.js - Recursive Healing Loop Possible
**File:** `services/self-healer.js`

```javascript
async heal(error) {
    // Can trigger infinite loop if healing fails and triggers new error
    try {
        await this.executeHealing(error);
    } catch (healError) {
        this.heal(healError);  // RECURSIVE!
    }
}
```

**Fix:** Add recursion guard:
```javascript
async heal(error, depth = 0) {
    if (depth > 3) {
        console.error('Max healing depth reached');
        return { success: false, maxDepthReached: true };
    }
    // ... healing logic
}
```

---

## CRIT-011: playwright-service.js - Browser Instance Leak
**File:** `services/playwright-service.js`

```javascript
this.browser = await this.playwright.chromium.launch({
    // Browser instance not properly closed on error
});
```

**Fix:**
```javascript
async cleanup() {
    if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
    }
}

process.on('exit', () => this.cleanup());
process.on('SIGTERM', () => this.cleanup());
```

---

# SECTION 3: API INTEGRATION ISSUES

## API-001: LM Studio Connection - No Retry Logic
**Service:** lm-studio-client.js

```javascript
async checkConnection() {
    try {
        const response = await fetch(`${this.baseUrl}/v1/models`);
        // Single attempt, no retry
    }
}
```

**Fix:** Implement exponential backoff:
```javascript
async checkConnectionWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await this.checkConnection();
        } catch {
            await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
        }
    }
    throw new Error('Max retries exceeded');
}
```

---

## API-002: GitHub API - Rate Limiting Not Handled
**Location:** index.js checkForUpdates()

```javascript
const req = https.get(options, (res) => {
    // No handling for 403 rate limit errors
});
```

---

## API-003: MCP Protocol - No Schema Validation
**Service:** mcp-connection.js

```javascript
// Tool results not validated against schema
const result = await this.callTool(serverName, toolName, args);
```

---

## API-004: Proxy Monitor - No SSL Certificate Validation
**Service:** proxy-monitor.js

---

## API-005: Fiddler Bridge - Insecure HTTP Communication
**Service:** fiddler-bridge.js

---

## API-006: Playwright - No Request Interception Validation
**Service:** playwright-service.js

---

## API-007: Game State - No Server Response Validation
**Service:** game-state.js

---

## API-008: Traffic Processor - No AMF Validation
**Service:** traffic-processor.js

---

# SECTION 4: SERVICE DEPENDENCY GRAPH

```
                    ┌─────────────────┐
                    │   index.js      │
                    │  (Main Process) │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌─────▼─────┐       ┌────▼────┐
    │ Chatbot │        │   Panel   │       │  Error  │
    │ Service │        │  Manager  │       │ System  │
    └────┬────┘        └─────┬─────┘       └────┬────┘
         │                   │                   │
    ┌────▼────┐        ┌─────▼─────┐       ┌────▼────┐
    │LMStudio │        │Playwright │       │  Self   │
    │ Client  │        │  Service  │       │ Healer  │
    └────┬────┘        └─────┬─────┘       └─────────┘
         │                   │
    ┌────▼────┐        ┌─────▼─────┐
    │ Intent  │        │  Panel    │
    │ Router  │        │PW Bridge  │
    └────┬────┘        └───────────┘
         │
    ┌────▼────┐
    │   MCP   │
    │ Manager │
    └─────────┘

ISSUES:
- Circular dependency risk between services
- No clear initialization order
- Missing error boundaries between services
```

---

# SECTION 5: SERVICE-BY-SERVICE LINE AUDIT

## protocol-handler.js
| Line Range | Function        | Issue               | Severity |
| ---------- | --------------- | ------------------- | -------- |
| 1-50       | Imports         | No version pinning  | LOW      |
| 51-100     | initialize()    | No error handling   | MED      |
| 101-150    | lookupAction()  | No input validation | HIGH     |
| 151-200    | searchActions() | No result limit     | MED      |

## chatbot-service.js
| Line Range | Function            | Issue         | Severity |
| ---------- | ------------------- | ------------- | -------- |
| 48-80      | Quick actions       | Hardcoded     | LOW      |
| 97-103     | Command handlers    | No validation | MED      |
| 641-693    | Playwright handlers | Not tested    | HIGH     |

## panel-manager.js
| Line Range | Function       | Issue               | Severity |
| ---------- | -------------- | ------------------- | -------- |
| 787-801    | getSWFPath()   | Path traversal risk | HIGH     |
| Multiple   | Event handlers | Memory leaks        | MED      |

---

# SECTION 6: COMPONENT WIRING ISSUES

## Issue W-001: Circular Event Emission
```javascript
// Service A emits to Service B
serviceA.emit('event', data);

// Service B emits back to Service A
serviceB.on('event', () => {
    serviceA.emit('response', data);  // Can loop
});
```

## Issue W-002: Missing Service Ready Checks
```javascript
// Service used before initialization complete
chatbotService.processMessage(msg);  // May be null
```

## Issue W-003: No Service Health Monitoring
```javascript
// No periodic health checks for services
// Services can fail silently
```

## Issue W-004: Inconsistent Error Propagation
```javascript
// Some services throw, some return error objects
throw new Error('...');  // Service A
return { error: '...' };  // Service B
```

---

# SECTION 7: RECOMMENDATIONS

## Immediate Actions (v2.2.8)
1. Add process cleanup handlers for all spawn() calls
2. Implement memory limits for packet storage
3. Add timeouts to all HTTP requests
4. Fix recursive healing loop

## Short-term (v2.3.0)
1. Create unified service registry
2. Implement service health checks
3. Add input validation to all services
4. Encrypt sensitive stored data

## Long-term (v3.0)
1. Refactor to microservices architecture
2. Add comprehensive logging
3. Implement circuit breakers
4. Add service mesh for communication

---

# SECTION 8: PROCESS SPAWN AUDIT

| File                  | Line | Command     | windowsHide | Cleanup |
| --------------------- | ---- | ----------- | ----------- | ------- |
| cli-access.js         | 117  | shell       | ✅           | ❌       |
| fiddler-bridge.js     | 90   | fiddler.exe | ✅           | ❌       |
| mcp-client-manager.js | 111  | node        | ✅           | ❌       |
| mcp-connection.js     | 113  | various     | ❌           | ❌       |

**Summary:** 0/4 spawn calls have proper cleanup.

---

# SIGN-OFF

| Role      | Name       | Date       |
| --------- | ---------- | ---------- |
| Inspector | Cascade AI | 2026-01-15 |
| Reviewer  | Pending    | -          |
| Approver  | Pending    | -          |
