# Claude Desktop MCP Configuration

This guide explains how to configure Claude Desktop to use Svony Browser's MCP servers.

## Overview

Claude Desktop supports MCP (Model Context Protocol) servers that extend Claude's capabilities with custom tools. The Svony Browser MCP servers provide:

- **evony-rag**: Knowledge base search for Evony game information
- **evony-rte**: Protocol analysis and traffic decoding
- **evony-tools**: Game calculators (training, march time, combat)

## Configuration File Location

Claude Desktop configuration file location:

| OS | Path |
|----|------|
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

## Configuration

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "evony-rag": {
      "command": "node",
      "args": [
        "C:/path/to/Svony-Browser/mcp-servers/evony-rag/index.js"
      ],
      "env": {
        "EVONY_KB_PATH": "C:/path/to/Svony-Browser/knowledge-base",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-rte": {
      "command": "node",
      "args": [
        "C:/path/to/Svony-Browser/mcp-servers/evony-rte/index.js"
      ],
      "env": {
        "PROTOCOL_DB_PATH": "C:/path/to/Svony-Browser/data/protocol-actions.json",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-tools": {
      "command": "node",
      "args": [
        "C:/path/to/Svony-Browser/mcp-servers/evony-tools/index.js"
      ],
      "env": {
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    }
  }
}
```

## Full Example Configuration

### Windows

```json
{
  "mcpServers": {
    "evony-rag": {
      "command": "node",
      "args": [
        "C:\\Users\\YourName\\Svony-Browser\\mcp-servers\\evony-rag\\index.js"
      ],
      "env": {
        "EVONY_KB_PATH": "C:\\Users\\YourName\\Svony-Browser\\knowledge-base",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-rte": {
      "command": "node",
      "args": [
        "C:\\Users\\YourName\\Svony-Browser\\mcp-servers\\evony-rte\\index.js"
      ],
      "env": {
        "PROTOCOL_DB_PATH": "C:\\Users\\YourName\\Svony-Browser\\data\\protocol-actions.json",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-tools": {
      "command": "node",
      "args": [
        "C:\\Users\\YourName\\Svony-Browser\\mcp-servers\\evony-tools\\index.js"
      ],
      "env": {
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    }
  }
}
```

### macOS/Linux

```json
{
  "mcpServers": {
    "evony-rag": {
      "command": "node",
      "args": [
        "/home/user/Svony-Browser/mcp-servers/evony-rag/index.js"
      ],
      "env": {
        "EVONY_KB_PATH": "/home/user/Svony-Browser/knowledge-base",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-rte": {
      "command": "node",
      "args": [
        "/home/user/Svony-Browser/mcp-servers/evony-rte/index.js"
      ],
      "env": {
        "PROTOCOL_DB_PATH": "/home/user/Svony-Browser/data/protocol-actions.json",
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    },
    "evony-tools": {
      "command": "node",
      "args": [
        "/home/user/Svony-Browser/mcp-servers/evony-tools/index.js"
      ],
      "env": {
        "LM_STUDIO_URL": "http://localhost:1234"
      }
    }
  }
}
```

## Available Tools

After configuration, Claude will have access to these tools:

### evony-rag Tools
| Tool | Description |
|------|-------------|
| `evony_search` | Search the knowledge base for game information |
| `evony_lookup` | Look up specific topics |
| `evony_context` | Get contextual information for game situations |

### evony-rte Tools
| Tool | Description |
|------|-------------|
| `protocol_lookup` | Look up protocol action by name or ID |
| `protocol_search` | Search for protocol actions |
| `decode_packet` | Decode AMF3 packet data |
| `analyze_traffic` | Analyze traffic patterns |

### evony-tools Tools
| Tool | Description |
|------|-------------|
| `calc_training` | Calculate training time and resources |
| `calc_march` | Calculate march time between coordinates |
| `calc_combat` | Simulate combat outcomes |
| `calc_resources` | Calculate resource production |
| `calc_building` | Calculate building requirements |

## Setup Steps

1. **Install Dependencies**
   ```bash
   cd Svony-Browser/mcp-servers/evony-rag && npm install
   cd ../evony-rte && npm install
   cd ../evony-tools && npm install
   ```

2. **Start LM Studio** (optional, for enhanced AI features)
   - Open LM Studio
   - Load a model
   - Start the local server on port 1234

3. **Configure Claude Desktop**
   - Create/edit the config file at the location above
   - Add the MCP server configuration
   - Restart Claude Desktop

4. **Verify Connection**
   - Open Claude Desktop
   - Ask Claude to use one of the Evony tools
   - Example: "Use evony_search to find information about cavalry"

## Troubleshooting

### Server Not Starting
- Check Node.js is installed: `node --version`
- Verify paths in configuration are correct
- Check for errors in Claude Desktop logs

### Tools Not Available
- Restart Claude Desktop after config changes
- Verify JSON syntax is correct
- Check MCP server logs for errors

### LM Studio Connection
- Ensure LM Studio server is running
- Verify port 1234 is not blocked
- Check `LM_STUDIO_URL` environment variable

## Example Prompts

Once configured, try these prompts in Claude:

1. "Search the Evony knowledge base for cavalry training strategies"
2. "Look up the city.getInfo protocol action"
3. "Calculate the cost to train 10,000 cavalry"
4. "Decode this AMF packet: 00 03 00 00..."
5. "Simulate combat between 5000 cavalry and 3000 pikemen"
