# Fagan Inspection: intent-router.js Deep Audit

## File: services/intent-router.js | Lines: 814 | Purpose: Route User Intents

---

## Purpose

Routes user messages to appropriate handlers based on detected intent:
- Game commands → Game automation
- MCP tool calls → MCP servers
- General chat → LLM response
- System commands → App functions

---

## Intent Categories

| Category | Examples | Handler |
|----------|----------|---------|
| GAME_ACTION | "attack city", "train troops" | gameActionHandler |
| MCP_TOOL | "use evony-rag", "call tool" | mcpToolHandler |
| NAVIGATION | "go to", "open url" | navigationHandler |
| SETTINGS | "change theme", "set proxy" | settingsHandler |
| QUERY | "what is", "how to" | queryHandler |
| AUTOMATION | "record script", "run macro" | automationHandler |
| SYSTEM | "clear cache", "restart" | systemHandler |
| CHAT | general conversation | chatHandler |

---

## Intent Detection (Lines 50-200)

### Pattern Matching
```javascript
const intentPatterns = {
    GAME_ACTION: [
        /^(attack|scout|reinforce|transport|recall)\s/i,
        /^(train|build|upgrade|research)\s/i,
        /^(collect|harvest|gather)\s/i
    ],
    MCP_TOOL: [
        /^(use|call|invoke)\s+(tool|mcp)/i,
        /^mcp\s+/i,
        /@(evony-rag|evony-rte|evony-tools)/i
    ],
    NAVIGATION: [
        /^(go|navigate|open)\s+(to|url)/i,
        /^(visit|browse)\s/i
    ],
    // ... more patterns
};
```
**Status:** ✅ OK - Comprehensive patterns

---

## Handler Methods

| Handler | Lines | Purpose | Status |
|---------|-------|---------|--------|
| detectIntent() | 205-280 | Classify message | ✅ OK |
| routeIntent() | 285-350 | Route to handler | ✅ OK |
| gameActionHandler() | 355-450 | Game commands | ✅ OK |
| mcpToolHandler() | 455-550 | MCP calls | ✅ OK |
| navigationHandler() | 555-620 | URL navigation | ✅ OK |
| settingsHandler() | 625-700 | App settings | ✅ OK |
| queryHandler() | 705-760 | Information queries | ✅ OK |
| automationHandler() | 765-810 | Script automation | ✅ OK |

---

## Confidence Scoring

| Score | Meaning | Action |
|-------|---------|--------|
| > 0.9 | High confidence | Execute directly |
| 0.7-0.9 | Medium | Execute with confirmation |
| 0.5-0.7 | Low | Ask for clarification |
| < 0.5 | Unknown | Fall back to chat |

---

## Integration Points

| Service | Purpose | Status |
|---------|---------|--------|
| chatbot-service | Fallback chat | ✅ OK |
| mcp-client-manager | MCP tools | ✅ OK |
| agent-controller | Automation | ✅ OK |
| panel-manager | Navigation | ✅ OK |

---

## Issues Found

| ID | Line | Severity | Issue |
|----|------|----------|-------|
| IR-001 | 50 | LOW | Patterns could use NLP |
| IR-002 | 285 | LOW | No intent caching |

**File Status:** ✅ GOOD
