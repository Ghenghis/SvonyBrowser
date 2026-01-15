# Windsurf IDE MCP Configuration

This guide explains how to configure Windsurf IDE to use Svony Browser's MCP servers with LM Studio as the AI backend.

## Overview

Windsurf IDE is an AI-powered development environment that supports MCP (Model Context Protocol) for extending AI capabilities. By connecting to LM Studio and the Svony MCP servers, you get:

- Local LLM inference via LM Studio
- Evony game knowledge base search
- Protocol analysis and decoding
- Game calculators and simulators

## Prerequisites

1. **Windsurf IDE** installed
2. **LM Studio** running with a loaded model
3. **Node.js 18+** for MCP servers
4. **Svony Browser** project cloned

## Configuration

### Step 1: Configure LM Studio Connection

In Windsurf IDE settings, configure the LLM provider:

1. Open Settings (Ctrl+,)
2. Search for "AI Provider" or "LLM"
3. Set the following:

```json
{
  "ai.provider": "openai-compatible",
  "ai.baseUrl": "http://localhost:1234/v1",
  "ai.model": "local-model",
  "ai.apiKey": "not-needed"
}
```

### Step 2: Configure MCP Servers

Create or edit `.windsurf/mcp.json` in your project:

```json
{
  "mcpServers": {
    "evony-rag": {
      "command": "node",
      "args": ["./mcp-servers/evony-rag/index.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "EVONY_KB_PATH": "${workspaceFolder}/knowledge-base",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-rte": {
      "command": "node",
      "args": ["./mcp-servers/evony-rte/index.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "PROTOCOL_DB_PATH": "${workspaceFolder}/data/protocol-actions.json",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-tools": {
      "command": "node",
      "args": ["./mcp-servers/evony-tools/index.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    }
  }
}
```

### Step 3: Global Configuration (Optional)

For system-wide MCP server access, add to Windsurf global config:

**Windows**: `%APPDATA%\Windsurf\mcp-config.json`
**macOS**: `~/Library/Application Support/Windsurf/mcp-config.json`
**Linux**: `~/.config/windsurf/mcp-config.json`

```json
{
  "mcpServers": {
    "evony-rag": {
      "command": "node",
      "args": ["C:/path/to/Svony-Browser/mcp-servers/evony-rag/index.js"],
      "env": {
        "EVONY_KB_PATH": "C:/path/to/Svony-Browser/knowledge-base",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-rte": {
      "command": "node",
      "args": ["C:/path/to/Svony-Browser/mcp-servers/evony-rte/index.js"],
      "env": {
        "PROTOCOL_DB_PATH": "C:/path/to/Svony-Browser/data/protocol-actions.json",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-tools": {
      "command": "node",
      "args": ["C:/path/to/Svony-Browser/mcp-servers/evony-tools/index.js"],
      "env": {
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    }
  }
}
```

## Setup Steps

### 1. Install Dependencies

```bash
# Navigate to Svony Browser project
cd Svony-Browser

# Install MCP server dependencies
cd mcp-servers/evony-rag && npm install
cd ../evony-rte && npm install
cd ../evony-tools && npm install
cd ../..
```

### 2. Start LM Studio

1. Open LM Studio
2. Go to **Local Server** tab
3. Load your preferred model (e.g., `mistral-7b-instruct`)
4. Click **Start Server**
5. Verify: `curl http://localhost:1234/v1/models`

### 3. Open Project in Windsurf

1. Open Windsurf IDE
2. Open the Svony Browser folder
3. Windsurf will detect `.windsurf/mcp.json` and start MCP servers

### 4. Verify Connection

In Windsurf's AI chat:
```
List available MCP tools
```

You should see all Evony tools listed.

## Using MCP Tools in Windsurf

### Cascade (AI Assistant) Commands

```
@cascade Search the Evony knowledge base for cavalry strategies

@cascade Look up the hero.levelUp protocol action

@cascade Calculate training cost for 100,000 archers

@cascade Decode this AMF packet: 00 03 00 00 00 01

@cascade Simulate combat: 50000 cavalry vs 30000 pikemen
```

### Inline Tool Invocation

When writing code, Cascade can automatically use tools:

```javascript
// Ask Cascade: "Help me implement the city.upgrade handler"
// Cascade will use protocol_lookup to find the action schema
// and generate appropriate code
```

## Tool Reference

### evony-rag (Knowledge Base)

| Tool | Usage |
|------|-------|
| `evony_search` | `evony_search(query: "cavalry training", limit: 5)` |
| `evony_lookup` | `evony_lookup(topic: "hero skills")` |
| `evony_context` | `evony_context(situation: "attacking a city")` |

### evony-rte (Protocol Engine)

| Tool | Usage |
|------|-------|
| `protocol_lookup` | `protocol_lookup(identifier: "city.getInfo")` |
| `protocol_search` | `protocol_search(query: "army", category: "army")` |
| `decode_packet` | `decode_packet(hexData: "00 03 00...")` |
| `analyze_traffic` | `analyze_traffic(packets: [...])` |

### evony-tools (Calculators)

| Tool | Usage |
|------|-------|
| `calc_training` | `calc_training(troopType: "cavalry", quantity: 10000)` |
| `calc_march` | `calc_march(fromX: 100, fromY: 200, toX: 150, toY: 250, troops: {...})` |
| `calc_combat` | `calc_combat(attacker: {...}, defender: {...})` |
| `calc_resources` | `calc_resources(buildings: {...})` |
| `calc_building` | `calc_building(buildingType: "barracks", level: 25)` |

## LM Studio Integration Details

### How It Works

1. **Windsurf** sends prompts to LM Studio for AI responses
2. **MCP Servers** provide specialized tools for Evony-specific tasks
3. **LM Studio** can also be used by MCP servers for enhanced analysis

### Model Recommendations

| Use Case | Recommended Model |
|----------|-------------------|
| General coding | `codellama-13b-instruct` |
| Game analysis | `mistral-7b-instruct` |
| Fast responses | `phi-2` or `tinyllama` |
| Complex reasoning | `mixtral-8x7b` |

### Performance Optimization

1. **GPU Acceleration**: Enable in LM Studio for faster inference
2. **Context Length**: Keep prompts under 4096 tokens
3. **Streaming**: Enable streaming for real-time responses
4. **Model Loading**: Keep model loaded in LM Studio

## Troubleshooting

### MCP Servers Not Starting

1. Check Node.js installation: `node --version`
2. Verify npm dependencies are installed
3. Check Windsurf output panel for errors
4. Ensure paths in config are correct

### LM Studio Connection Failed

1. Verify LM Studio server is running
2. Check port 1234 is not blocked
3. Test with: `curl http://localhost:1234/v1/models`
4. Check Windsurf AI settings

### Tools Not Available

1. Restart Windsurf after config changes
2. Check `.windsurf/mcp.json` syntax
3. Look for errors in MCP server output
4. Verify environment variables

### Slow Responses

1. Use a smaller/faster model in LM Studio
2. Reduce `max_tokens` in settings
3. Enable GPU acceleration
4. Check system resources

## Example Workflow

### Developing a New Feature

1. **Research**: "Search for information about alliance wars"
2. **Protocol**: "Look up alliance.declareWar action"
3. **Calculate**: "What resources are needed for 100k troops?"
4. **Implement**: Use the gathered information to write code
5. **Test**: "Simulate a battle with these parameters"

### Debugging Protocol Issues

1. Capture traffic in Svony Browser
2. Copy hex data to Windsurf
3. Ask: "Decode this packet and explain what it does"
4. Use the decoded information to fix issues

## Advanced Configuration

### Custom System Prompts

Add to your Windsurf settings:

```json
{
  "ai.systemPrompt": "You are an expert in Evony game development and protocol analysis. You have access to MCP tools for searching the knowledge base, looking up protocols, and performing game calculations. Always use these tools when relevant to provide accurate information."
}
```

### Tool Chaining

Windsurf supports chaining multiple tool calls:

```
First search for cavalry information, then calculate training 
cost for 50000 cavalry, and finally simulate combat against 
30000 pikemen.
```

Cascade will execute all three tools in sequence.
