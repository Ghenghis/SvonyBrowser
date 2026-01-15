# Fagan Inspection: MCP Client Manager Deep Audit

## File: services/mcp-client-manager.js | Lines: 1400+ | Purpose: MCP Protocol

---

## CRITICAL: Model Context Protocol Implementation

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                   MCP CLIENT MANAGER                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Server Registry                    │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │
│  │  │evony-rag│ │evony-rte│ │evony-   │ │custom   │   │  │
│  │  │         │ │         │ │tools    │ │server   │   │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │  │
│  │       │          │          │          │           │  │
│  └───────┴──────────┴──────────┴──────────┴───────────┘  │
│                         │                                 │
│                 ┌───────┴───────┐                        │
│                 │ Connection    │                        │
│                 │ Pool          │                        │
│                 └───────┬───────┘                        │
│                         │                                 │
│                 ┌───────┴───────┐                        │
│                 │ JSON-RPC      │                        │
│                 │ Transport     │                        │
│                 └───────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Server Configuration (Lines 20-100)

```javascript
const DEFAULT_SERVERS = {
    'evony-rag': {
        command: 'node',
        args: ['mcp-servers/evony-rag-server.js'],
        env: {},
        capabilities: ['search', 'retrieve', 'embed']
    },
    'evony-rte': {
        command: 'node',
        args: ['mcp-servers/evony-rte-server.js'],
        env: {},
        capabilities: ['execute', 'evaluate', 'inject']
    },
    'evony-tools': {
        command: 'node',
        args: ['mcp-servers/evony-tools-server.js'],
        env: {},
        capabilities: ['calculate', 'simulate', 'analyze']
    }
};
```
**Status:** ✅ OK - Proper server definitions

---

## MCPClient Class (Lines 105-600)

### Constructor
```javascript
constructor(serverName, config) {
    this.serverName = serverName;
    this.config = config;
    this.process = null;
    this.transport = null;
    this.connected = false;
    this.tools = [];
    this.resources = [];
    this.prompts = [];
    this.pendingRequests = new Map();
    this.requestId = 0;
}
```

### Connection Methods

| Method | Lines | Purpose | Status |
|--------|-------|---------|--------|
| connect() | 150-220 | Start server process | ✅ OK |
| disconnect() | 225-260 | Stop server | ✅ OK |
| reconnect() | 265-300 | Reconnect on failure | ✅ OK |
| isConnected() | 305-310 | Check status | ✅ OK |

### Protocol Methods

| Method | Lines | Purpose | Status |
|--------|-------|---------|--------|
| initialize() | 315-380 | MCP handshake | ✅ OK |
| listTools() | 385-420 | Get available tools | ✅ OK |
| listResources() | 425-460 | Get resources | ✅ OK |
| listPrompts() | 465-500 | Get prompts | ✅ OK |
| callTool() | 505-580 | Execute tool | ✅ OK |
| readResource() | 585-640 | Read resource | ✅ OK |
| getPrompt() | 645-700 | Get prompt template | ✅ OK |

---

## JSON-RPC Transport (Lines 705-900)

### Message Format
```javascript
// Request
{
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
        name: 'search',
        arguments: { query: 'evony troops' }
    }
}

// Response
{
    jsonrpc: '2.0',
    id: 1,
    result: {
        content: [{ type: 'text', text: '...' }]
    }
}
```

### Transport Implementation
```javascript
async sendRequest(method, params) {
    const id = ++this.requestId;
    
    const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
    };
    
    return new Promise((resolve, reject) => {
        this.pendingRequests.set(id, { resolve, reject });
        
        // Timeout after 30 seconds
        setTimeout(() => {
            if (this.pendingRequests.has(id)) {
                this.pendingRequests.delete(id);
                reject(new Error('Request timeout'));
            }
        }, 30000);
        
        this.transport.write(JSON.stringify(request) + '\n');
    });
}
```
**Status:** ✅ OK - Proper async handling

---

## MCPClientManager Class (Lines 905-1400)

### Manager Methods

| Method | Lines | Purpose | Status |
|--------|-------|---------|--------|
| initialize() | 950-1020 | Start all servers | ✅ OK |
| shutdown() | 1025-1080 | Stop all servers | ✅ OK |
| getClient() | 1085-1100 | Get client by name | ✅ OK |
| callTool() | 1105-1180 | Route tool call | ✅ OK |
| getStatus() | 1185-1220 | Get all statuses | ✅ OK |
| getAllTools() | 1225-1280 | Aggregate tools | ✅ OK |
| findToolServer() | 1285-1340 | Find server for tool | ✅ OK |

---

## Tool Routing

```javascript
async callTool(toolName, args) {
    // Find which server has this tool
    const serverName = this.findToolServer(toolName);
    
    if (!serverName) {
        throw new Error(`Tool not found: ${toolName}`);
    }
    
    const client = this.clients.get(serverName);
    
    if (!client || !client.isConnected()) {
        // Try to reconnect
        await this.reconnectServer(serverName);
    }
    
    return client.callTool(toolName, args);
}
```
**Status:** ✅ OK - Automatic reconnection

---

## Error Handling

| Error Type | Handling | Status |
|------------|----------|--------|
| Connection failed | Retry 3 times | ✅ OK |
| Process crash | Auto-restart | ✅ OK |
| Request timeout | Reject promise | ✅ OK |
| Invalid response | Parse error | ✅ OK |

---

## Issues Found

| ID | Line | Severity | Issue |
|----|------|----------|-------|
| MCP-001 | 505 | MEDIUM | No input validation |
| MCP-002 | 1105 | LOW | No rate limiting |
| MCP-003 | 150 | LOW | Hardcoded timeout |

**File Status:** ✅ GOOD - Solid MCP implementation
