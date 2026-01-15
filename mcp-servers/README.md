# Svony Browser MCP Servers

Model Context Protocol (MCP) servers for Evony game analysis, knowledge retrieval, and game calculations.

## Overview

This directory contains three MCP servers that extend AI assistants with Evony-specific capabilities:

| Server | Purpose | Tools |
|--------|---------|-------|
| **evony-rag** | Knowledge base search and retrieval | 3 tools |
| **evony-rte** | Protocol analysis and traffic decoding | 4 tools |
| **evony-tools** | Game calculators and simulators | 5 tools |

## Quick Start

### 1. Install Dependencies

```bash
# Install all MCP server dependencies
cd mcp-servers
npm run install:all

# Or install individually
cd evony-rag && npm install
cd ../evony-rte && npm install
cd ../evony-tools && npm install
```

### 2. Start LM Studio (Optional)

For AI-enhanced features, start LM Studio:

1. Open LM Studio
2. Load a model (e.g., `mistral-7b-instruct`)
3. Start the local server on port 1234

### 3. Configure Your AI Tool

See the setup guides in `docs/mcp-setup/`:

- [LM Studio Setup](../docs/mcp-setup/LM-STUDIO-SETUP.md)
- [Claude Desktop Config](../docs/mcp-setup/CLAUDE-DESKTOP-CONFIG.md)
- [Claude Code Config](../docs/mcp-setup/CLAUDE-CODE-CONFIG.md)
- [Windsurf IDE Config](../docs/mcp-setup/WINDSURF-IDE-CONFIG.md)

## Server Details

### evony-rag (Retrieval Augmented Generation)

Provides knowledge base search for Evony game information.

**Tools:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `evony_search` | Search knowledge base | `query` (string), `limit` (number, optional) |
| `evony_lookup` | Look up specific topic | `topic` (string) |
| `evony_context` | Get contextual information | `situation` (string) |

**Environment Variables:**
- `EVONY_KB_PATH`: Path to knowledge base directory
- `LM_STUDIO_URL`: LM Studio API URL (optional)

**Example:**
```json
{
  "name": "evony_search",
  "arguments": {
    "query": "cavalry training strategies",
    "limit": 5
  }
}
```

### evony-rte (Real-Time Engine)

Provides protocol analysis and traffic decoding for Evony game communication.

**Tools:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `protocol_lookup` | Look up action by name/ID | `identifier` (string) |
| `protocol_search` | Search protocol actions | `query` (string), `category` (string, optional) |
| `decode_packet` | Decode AMF3 packet | `hexData` (string) |
| `analyze_traffic` | Analyze traffic patterns | `packets` (array) |

**Environment Variables:**
- `PROTOCOL_DB_PATH`: Path to protocol-actions.json
- `LM_STUDIO_URL`: LM Studio API URL (optional)

**Example:**
```json
{
  "name": "protocol_lookup",
  "arguments": {
    "identifier": "city.getInfo"
  }
}
```

### evony-tools (Game Calculators)

Provides game calculations and combat simulation.

**Tools:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `calc_training` | Calculate training costs | `troopType`, `quantity`, `buffs` |
| `calc_march` | Calculate march time | `fromX`, `fromY`, `toX`, `toY`, `troops`, `buffs` |
| `calc_combat` | Simulate combat | `attacker`, `defender`, `options` |
| `calc_resources` | Calculate production | `buildings`, `buffs` |
| `calc_building` | Calculate building costs | `buildingType`, `level` |

**Environment Variables:**
- `LM_STUDIO_URL`: LM Studio API URL (optional)

**Example:**
```json
{
  "name": "calc_training",
  "arguments": {
    "troopType": "cavalry",
    "quantity": 10000,
    "buffs": {
      "trainingSpeed": 50,
      "resourceReduction": 20
    }
  }
}
```

## MCP Protocol

All servers implement the MCP JSON-RPC protocol:

### Initialize
```json
{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}
```

### List Tools
```json
{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
```

### Call Tool
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "evony_search",
    "arguments": {"query": "cavalry"}
  }
}
```

## Running Servers Manually

### Standalone Mode

```bash
# Run evony-rag
node mcp-servers/evony-rag/index.js

# Run evony-rte
node mcp-servers/evony-rte/index.js

# Run evony-tools
node mcp-servers/evony-tools/index.js
```

### With Environment Variables

```bash
# Windows
set EVONY_KB_PATH=C:\path\to\knowledge-base
set LM_STUDIO_URL=http://localhost:1234
node mcp-servers/evony-rag/index.js

# Linux/macOS
EVONY_KB_PATH=/path/to/knowledge-base \
LM_STUDIO_URL=http://localhost:1234 \
node mcp-servers/evony-rag/index.js
```

## Testing

### Test with MCP CLI

```bash
# Install mcp-cli if not available
npm install -g @anthropic-ai/mcp-cli

# Test evony-rag
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node mcp-servers/evony-rag/index.js

# Test a tool call
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"evony_search","arguments":{"query":"cavalry"}}}' | node mcp-servers/evony-rag/index.js
```

### Test Script

```bash
npm run test:mcp
```

## Integration with Svony Browser

The MCP servers are automatically managed by Svony Browser:

1. **Startup**: Servers start when Svony Browser launches
2. **Communication**: IPC channels connect browser to MCP servers
3. **Chatbot**: AI Co-Pilot uses MCP tools for enhanced responses

### IPC Channels

| Channel | Purpose |
|---------|---------|
| `mcp:call-tool` | Execute MCP tool |
| `mcp:list-tools` | List available tools |
| `mcp:server-status` | Get server status |

## Extending

### Adding New Tools

1. Edit the server's `index.js`
2. Add tool definition to `tools` array
3. Add handler in `handleToolCall` function

Example:
```javascript
// Add to tools array
{
  name: 'my_new_tool',
  description: 'Description of what it does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' }
    },
    required: ['param1']
  }
}

// Add to handleToolCall
case 'my_new_tool':
  return myNewToolFunction(args.param1);
```

### Creating New Servers

1. Create new directory: `mcp-servers/my-server/`
2. Create `package.json` with dependencies
3. Create `index.js` implementing MCP protocol
4. Add to configuration files

## Troubleshooting

### Server Won't Start

1. Check Node.js version: `node --version` (requires 18+)
2. Verify dependencies: `npm install`
3. Check for syntax errors: `node --check index.js`

### Tools Not Working

1. Check environment variables are set
2. Verify file paths exist
3. Check server logs for errors

### LM Studio Connection

1. Ensure LM Studio is running
2. Verify port 1234 is accessible
3. Test: `curl http://localhost:1234/v1/models`

## License

MIT License - See main project LICENSE file.
