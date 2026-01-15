# LM Studio Setup for Svony Browser

This guide explains how to configure LM Studio to work with Svony Browser's AI Co-Pilot and MCP servers.

## Prerequisites

1. **LM Studio** installed from [lmstudio.ai](https://lmstudio.ai/)
2. **Node.js 18+** for running MCP servers
3. **Svony Browser** installed

## LM Studio Configuration

### Step 1: Download a Model

1. Open LM Studio
2. Go to the **Discover** tab
3. Search for and download a suitable model:
   - **Recommended for Evony**: `mistral-7b-instruct`, `llama-2-13b-chat`, or `codellama-13b`
   - For better tool calling: `mistral-7b-instruct-v0.2` or newer

### Step 2: Start the Local Server

1. Go to the **Local Server** tab in LM Studio
2. Load your preferred model
3. Configure server settings:
   ```
   Port: 1234 (default)
   Host: 127.0.0.1
   ```
4. Click **Start Server**

The server will be available at `http://localhost:1234`

### Step 3: Verify Connection

Test the connection:
```bash
curl http://localhost:1234/v1/models
```

You should see a JSON response with your loaded model.

## Svony Browser Configuration

### Environment Variables

Set these environment variables before running Svony Browser:

```bash
# Windows (PowerShell)
$env:LM_STUDIO_URL = "http://localhost:1234"
$env:LM_STUDIO_MODEL = "local-model"

# Windows (CMD)
set LM_STUDIO_URL=http://localhost:1234
set LM_STUDIO_MODEL=local-model

# Linux/macOS
export LM_STUDIO_URL="http://localhost:1234"
export LM_STUDIO_MODEL="local-model"
```

### Settings File

Alternatively, configure in `config/settings-default.json`:

```json
{
  "lmStudio": {
    "baseUrl": "http://localhost:1234",
    "model": "local-model",
    "temperature": 0.7,
    "maxTokens": 2048
  }
}
```

## MCP Servers with LM Studio

The MCP servers can use LM Studio for enhanced AI capabilities:

### evony-rag (Knowledge Base Search)
Uses LM Studio for semantic search and context understanding.

### evony-rte (Real-Time Engine)
Uses LM Studio for protocol analysis and traffic interpretation.

### evony-tools (Game Calculators)
Uses LM Studio for natural language understanding of calculation requests.

## Starting MCP Servers

```bash
# Navigate to project directory
cd Svony-Browser

# Install MCP server dependencies
cd mcp-servers/evony-rag && npm install && cd ../..
cd mcp-servers/evony-rte && npm install && cd ../..
cd mcp-servers/evony-tools && npm install && cd ../..

# Start servers (they will auto-connect to LM Studio)
npm run start:mcp
```

## Troubleshooting

### Connection Failed
1. Ensure LM Studio server is running
2. Check the port (default: 1234)
3. Verify no firewall blocking

### Slow Responses
1. Use a smaller model (7B parameters)
2. Reduce `max_tokens` in settings
3. Enable GPU acceleration in LM Studio

### Model Not Found
1. Ensure a model is loaded in LM Studio
2. Use `"local-model"` as the model name (LM Studio default)

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `/v1/models` | List available models |
| `/v1/chat/completions` | Chat with AI |
| `/v1/completions` | Text completion |
| `/v1/embeddings` | Generate embeddings |

## Example Chat Request

```javascript
const response = await fetch('http://localhost:1234/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'local-model',
    messages: [
      { role: 'system', content: 'You are an Evony game expert.' },
      { role: 'user', content: 'How do I train cavalry?' }
    ],
    temperature: 0.7,
    max_tokens: 1024
  })
});
```

## Performance Tips

1. **GPU Acceleration**: Enable CUDA/Metal in LM Studio for faster inference
2. **Context Length**: Keep conversation history under 4096 tokens
3. **Batch Requests**: Group multiple queries when possible
4. **Model Selection**: Use instruction-tuned models for better tool calling
