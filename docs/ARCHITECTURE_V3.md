# SvonyBrowser v3.0 Architecture Plan

## Current Issues (v2.2.7)
- CLI window spam from MCP/Playwright spawns
- Services auto-init causing memory leaks
- MCP servers scattered (evony-rag, evony-rte, evony-tools)
- No unified agent system

## v2.2.8 Immediate Fixes
- [x] Disable auto-spawn services (MCPClientManager, PlaywrightService, FiddlerBridge)
- [ ] Lazy-load all services on-demand
- [ ] Fix SWF loading on both panels
- [ ] Test stability

---

## v3.0 Unified Architecture

### 1. Consolidated MCP Server: `evony-unified-mcp`

Merge all 3 MCP servers into one:

```
evony-unified-mcp/
├── index.js              # Main MCP server
├── tools/
│   ├── calculations.js   # From evony-tools (training, march, combat)
│   ├── rag.js            # From evony-rag (knowledge retrieval)
│   └── rte.js            # From evony-rte (real-time events)
├── agents/
│   ├── swarm-controller.js    # Manages agent swarms
│   ├── playwright-agent.js    # Browser automation agent
│   ├── game-agent.js          # Game action agent
│   └── memory-agent.js        # mem0-style memory agent
├── memory/
│   ├── mem0-adapter.js        # mem0-compatible memory
│   ├── conversation.js        # Conversation history
│   └── game-state.js          # Game state persistence
└── package.json
```

### 2. Agent Swarm System

```javascript
// Agent Swarm Architecture
class AgentSwarm {
    constructor() {
        this.agents = new Map();
        this.coordinator = new SwarmCoordinator();
        this.memory = new UnifiedMemory();
    }

    // Agent types
    agents: {
        'playwright': PlaywrightAgent,    // Browser automation
        'analyzer': AnalyzerAgent,        // Data analysis
        'executor': ExecutorAgent,        // Game actions
        'monitor': MonitorAgent,          // Real-time monitoring
        'learner': LearnerAgent           // ML/pattern learning
    }

    // Swarm actions
    async executeSwarmAction(goal, context) {
        const plan = await this.coordinator.plan(goal);
        const assignments = this.coordinator.assignAgents(plan);
        return await this.executeParallel(assignments);
    }
}
```

### 3. Playwright Integration

```javascript
// Playwright Agent - No CLI windows
class PlaywrightAgent {
    constructor() {
        this.browser = null;  // Lazy init
        this.contexts = new Map();
    }

    async init() {
        // Only init when needed, headless by default
        const { chromium } = require('playwright');
        this.browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox']
        });
    }

    // Actions
    async navigate(url) { }
    async click(selector) { }
    async fill(selector, value) { }
    async screenshot() { }
    async extractData(selectors) { }
}
```

### 4. Memory System (mem0-style)

```javascript
// Unified Memory with RAG
class UnifiedMemory {
    constructor() {
        this.shortTerm = new Map();      // Current session
        this.longTerm = null;            // ChromaDB/Vector store
        this.gameState = new GameState(); // Game-specific memory
    }

    async remember(key, value, metadata) {
        // Store with embeddings for semantic search
    }

    async recall(query, options) {
        // Semantic search across all memory
    }

    async forget(key) { }
    async consolidate() { }  // Move short-term to long-term
}
```

### 5. Auto-Setup System

```javascript
// One-click setup for all dependencies
class AutoSetup {
    static async setup() {
        await this.checkNode();
        await this.checkPlaywright();
        await this.checkChromaDB();
        await this.setupMCPServer();
        await this.createDefaultConfig();
    }

    static async checkPlaywright() {
        // Install if missing, no CLI windows
        const { execSync } = require('child_process');
        execSync('npx playwright install chromium', {
            windowsHide: true,
            stdio: 'pipe'
        });
    }
}
```

---

## Service Loading Strategy

### Before (v2.2.7) - Eager Loading
```javascript
// BAD: All services init on startup
playwrightService = new PlaywrightService();  // Spawns processes
mcpClientManager = new MCPClientManager();     // Spawns processes
fiddlerBridge = new FiddlerBridge();           // Spawns processes
```

### After (v3.0) - Lazy Loading
```javascript
// GOOD: Services init only when needed
let _playwrightService = null;
function getPlaywrightService() {
    if (!_playwrightService) {
        _playwrightService = new PlaywrightService();
    }
    return _playwrightService;
}

// IPC handler - lazy loads
ipcMain.handle('playwright-action', async (event, action) => {
    const service = getPlaywrightService();
    return service.execute(action);
});
```

---

## Mirror Mode Implementation

```javascript
// Shared session between panels
class MirrorMode {
    constructor() {
        this.session = null;  // Shared Electron session
        this.syncEnabled = false;
    }

    enable() {
        // Both webviews use same session partition
        const partition = 'persist:evony-mirror';
        leftWebview.partition = partition;
        rightWebview.partition = partition;
        this.syncEnabled = true;
    }

    // Sync actions between panels
    onAction(panel, action) {
        if (this.syncEnabled) {
            const otherPanel = panel === 'left' ? 'right' : 'left';
            this.replayAction(otherPanel, action);
        }
    }
}
```

---

## Roadmap

| Version | Features                            | Status      |
| ------- | ----------------------------------- | ----------- |
| v2.2.8  | Fix CLI windows, lazy-load services | In Progress |
| v2.3.0  | Unified MCP server, basic agent     | Planned     |
| v2.4.0  | Agent swarm, mem0 memory            | Planned     |
| v3.0.0  | Full swarm system, Mirror Mode      | Future      |

---

## File Structure After Refactor

```
SvonyBrowser/
├── index.js                    # Main process (minimal)
├── renderer.js                 # UI (minimal)
├── services/
│   ├── service-loader.js       # Lazy loader for all services
│   ├── playwright-agent.js     # Consolidated Playwright
│   ├── unified-memory.js       # mem0-style memory
│   └── agent-swarm.js          # Agent swarm controller
├── mcp-servers/
│   └── evony-unified/          # Single consolidated MCP
│       ├── index.js
│       ├── tools.js
│       ├── agents.js
│       └── memory.js
└── docs/
    └── ARCHITECTURE_V3.md      # This file
```
