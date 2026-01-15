# Claude Code (VS Code) MCP Configuration

This guide explains how to configure Claude Code (the VS Code extension) to use Svony Browser's MCP servers.

## Overview

Claude Code is the VS Code extension for Claude AI. It supports MCP servers for extended functionality when working with code and projects.

## Configuration Methods

### Method 1: Workspace Settings

Create a `.vscode/settings.json` in your Svony Browser project:

```json
{
  "claude.mcpServers": {
    "evony-rag": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-servers/evony-rag/index.js"],
      "env": {
        "EVONY_KB_PATH": "${workspaceFolder}/knowledge-base",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-rte": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-servers/evony-rte/index.js"],
      "env": {
        "PROTOCOL_DB_PATH": "${workspaceFolder}/data/protocol-actions.json",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-tools": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-servers/evony-tools/index.js"],
      "env": {
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    }
  }
}
```

### Method 2: User Settings

Add to your VS Code user settings (`settings.json`):

```json
{
  "claude.mcpServers": {
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

### Method 3: MCP Configuration File

Create `.mcp.json` in your project root:

```json
{
  "servers": {
    "evony-rag": {
      "command": "node",
      "args": ["./mcp-servers/evony-rag/index.js"],
      "env": {
        "EVONY_KB_PATH": "./knowledge-base",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-rte": {
      "command": "node",
      "args": ["./mcp-servers/evony-rte/index.js"],
      "env": {
        "PROTOCOL_DB_PATH": "./data/protocol-actions.json",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-tools": {
      "command": "node",
      "args": ["./mcp-servers/evony-tools/index.js"],
      "env": {
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    }
  }
}
```

## Setup Steps

1. **Install Claude Code Extension**
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "Claude" and install

2. **Install MCP Server Dependencies**
   ```bash
   cd Svony-Browser
   cd mcp-servers/evony-rag && npm install && cd ..
   cd evony-rte && npm install && cd ..
   cd evony-tools && npm install && cd ..
   ```

3. **Start LM Studio** (for AI-enhanced features)
   - Open LM Studio
   - Load your preferred model
   - Start the local server

4. **Configure Claude Code**
   - Use one of the methods above
   - Reload VS Code window (Ctrl+Shift+P → "Reload Window")

5. **Verify Tools**
   - Open Claude Code panel
   - Type: "List available tools"
   - You should see the Evony tools listed

## Using Tools in Claude Code

### Example Commands

```
@claude Use evony_search to find information about hero skills

@claude Look up the army.march protocol action using protocol_lookup

@claude Calculate training cost for 50000 cavalry using calc_training

@claude Decode this packet: 00 03 00 00 00 01 00 0b

@claude Simulate combat between 10000 archers and 8000 cavalry
```

### Tool Invocation Syntax

Claude Code will automatically detect when to use tools based on your request. You can also explicitly request tool use:

```
Use the evony_search tool to find: [your query]
```

## Available Tools Reference

### Knowledge Base (evony-rag)

| Tool | Parameters | Description |
|------|------------|-------------|
| `evony_search` | `query`, `limit` | Search knowledge base |
| `evony_lookup` | `topic` | Look up specific topic |
| `evony_context` | `situation` | Get contextual info |

### Protocol Analysis (evony-rte)

| Tool | Parameters | Description |
|------|------------|-------------|
| `protocol_lookup` | `identifier` | Look up action by name/ID |
| `protocol_search` | `query`, `category` | Search actions |
| `decode_packet` | `hexData` | Decode AMF3 packet |
| `analyze_traffic` | `packets` | Analyze traffic patterns |

### Game Calculators (evony-tools)

| Tool | Parameters | Description |
|------|------------|-------------|
| `calc_training` | `troopType`, `quantity`, `buffs` | Training calculator |
| `calc_march` | `fromX`, `fromY`, `toX`, `toY`, `troops` | March time |
| `calc_combat` | `attacker`, `defender`, `options` | Combat simulator |
| `calc_resources` | `buildings`, `buffs` | Resource production |
| `calc_building` | `buildingType`, `level` | Building costs |

## Troubleshooting

### Tools Not Appearing
1. Check VS Code Developer Tools (Help → Toggle Developer Tools)
2. Look for MCP-related errors in console
3. Verify Node.js is in PATH

### Connection Issues
1. Ensure LM Studio is running (if using AI features)
2. Check firewall settings
3. Verify paths in configuration

### Performance
1. MCP servers run as separate processes
2. First request may be slow (cold start)
3. Consider keeping LM Studio model loaded

## Integration with Development

When developing Svony Browser, Claude Code can help with:

1. **Protocol Analysis**: Understanding game communication
2. **Code Generation**: Creating handlers for new protocol actions
3. **Testing**: Generating test cases for combat calculations
4. **Documentation**: Explaining complex game mechanics

Example workflow:
```
@claude I'm adding a new protocol action for alliance.donate. 
Use protocol_search to find similar actions, then help me 
implement the handler based on the patterns.
```
