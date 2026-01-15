# Fagan Inspection: Chatbot Service Deep Audit

## File: services/chatbot-service.js | Lines: 1800+ | Purpose: AI Chat

---

## CRITICAL: LLM Integration

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                   CHATBOT SERVICE                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Input ──► Intent Router ──► Handler Selection         │
│                      │                                       │
│                      ▼                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Context Builder                          │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │
│  │  │ System  │ │ Memory  │ │ Game    │ │ MCP     │   │  │
│  │  │ Prompt  │ │ Context │ │ State   │ │ Tools   │   │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │  │
│  │       └──────────┬┴──────────┴──────────┘          │  │
│  └──────────────────┼────────────────────────────────────┘  │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              LLM Provider                             │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐               │  │
│  │  │LM Studio│ │ OpenAI  │ │ Ollama  │               │  │
│  │  └─────────┘ └─────────┘ └─────────┘               │  │
│  └──────────────────────────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  Response ──► Post-Processing ──► UI Display                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration (Lines 20-80)

```javascript
const DEFAULT_CONFIG = {
    provider: 'lm-studio',
    model: 'default',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: `You are Svony Assistant, an AI helper for Evony: The King's Return.
You help players with:
- Game strategies and tips
- Resource management
- Troop compositions
- Alliance coordination
- Automation scripts

You have access to game data and can execute actions through MCP tools.`,
    contextWindow: 4096,
    streamResponses: true
};
```
**Status:** ✅ OK - Good defaults

---

## ChatbotService Class (Lines 85-1800)

### Constructor
```javascript
constructor(options = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.provider = null;
    this.memory = new ConversationMemory();
    this.intentRouter = new IntentRouter();
    this.plugins = new PluginManager();
    this.isProcessing = false;
    this.messageQueue = [];
}
```

### Core Methods

| Method | Lines | Purpose | Status |
|--------|-------|---------|--------|
| initialize() | 120-180 | Setup provider | ✅ OK |
| sendMessage() | 185-350 | Process message | ✅ OK |
| buildContext() | 355-500 | Build LLM context | ✅ OK |
| callLLM() | 505-650 | Call LLM API | ✅ OK |
| processResponse() | 655-800 | Handle response | ✅ OK |
| handleToolCall() | 805-950 | Execute tools | ✅ OK |
| streamResponse() | 955-1100 | Stream tokens | ✅ OK |

---

## Message Flow (Lines 185-350)

```javascript
async sendMessage(content, options = {}) {
    // 1. Add to queue if processing
    if (this.isProcessing) {
        return this.queueMessage(content, options);
    }
    
    this.isProcessing = true;
    this.emit('processingStart');
    
    try {
        // 2. Detect intent
        const intent = await this.intentRouter.detect(content);
        
        // 3. Route to handler
        if (intent.type !== 'CHAT') {
            return this.handleSpecialIntent(intent, content);
        }
        
        // 4. Build context
        const context = await this.buildContext(content);
        
        // 5. Call LLM
        const response = await this.callLLM(context);
        
        // 6. Process response
        const processed = await this.processResponse(response);
        
        // 7. Store in memory
        this.memory.addMessage('user', content);
        this.memory.addMessage('assistant', processed.content);
        
        // 8. Emit response
        this.emit('response', processed);
        
        return processed;
        
    } finally {
        this.isProcessing = false;
        this.emit('processingEnd');
        this.processQueue();
    }
}
```
**Status:** ✅ OK - Proper async flow

---

## Context Building (Lines 355-500)

```javascript
async buildContext(userMessage) {
    const context = [];
    
    // 1. System prompt
    context.push({
        role: 'system',
        content: this.config.systemPrompt
    });
    
    // 2. Game state context
    if (this.gameState) {
        context.push({
            role: 'system',
            content: `Current game state:\n${this.formatGameState()}`
        });
    }
    
    // 3. Available tools
    const tools = await this.getAvailableTools();
    if (tools.length > 0) {
        context.push({
            role: 'system',
            content: `Available tools:\n${this.formatTools(tools)}`
        });
    }
    
    // 4. Conversation history
    const history = this.memory.getContext(this.config.contextWindow);
    context.push(...history);
    
    // 5. Current message
    context.push({
        role: 'user',
        content: userMessage
    });
    
    return context;
}
```
**Status:** ✅ OK - Comprehensive context

---

## Tool Calling (Lines 805-950)

```javascript
async handleToolCall(toolCall) {
    const { name, arguments: args } = toolCall;
    
    this.emit('toolCallStart', { name, args });
    
    try {
        // Route to MCP
        const result = await this.mcpManager.callTool(name, args);
        
        this.emit('toolCallSuccess', { name, result });
        
        return {
            tool: name,
            result: result.content
        };
        
    } catch (error) {
        this.emit('toolCallError', { name, error });
        
        return {
            tool: name,
            error: error.message
        };
    }
}
```
**Status:** ✅ OK - Proper error handling

---

## Streaming (Lines 955-1100)

```javascript
async *streamResponse(context) {
    const stream = await this.provider.createStream(context);
    
    let fullContent = '';
    
    for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        fullContent += delta;
        
        yield {
            type: 'delta',
            content: delta,
            fullContent
        };
    }
    
    yield {
        type: 'complete',
        content: fullContent
    };
}
```
**Status:** ✅ OK - Async generator streaming

---

## Provider Support

| Provider | Status | Features |
|----------|--------|----------|
| LM Studio | ✅ OK | Local, streaming |
| OpenAI | ✅ OK | Cloud, tools |
| Ollama | ✅ OK | Local, streaming |
| Custom | ✅ OK | Configurable |

---

## Issues Found

| ID | Line | Severity | Issue |
|----|------|----------|-------|
| CB-001 | 185 | LOW | No message size limit |
| CB-002 | 505 | MEDIUM | No retry on API failure |
| CB-003 | 355 | LOW | Context could exceed limit |

**File Status:** ✅ EXCELLENT - Well-designed AI integration
