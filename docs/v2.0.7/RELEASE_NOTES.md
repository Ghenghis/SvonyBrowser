# Svony Browser v2.0.7 Release Notes

**Release Date:** January 14, 2026  
**Type:** Milestone Enhancement Release

## Overview

v2.0.7 is a comprehensive polish and enhancement release that fills gaps identified in v2.0.6, adds robust error handling, and ensures all services are properly integrated and tested.

## New Features

### Traffic Processor Service
- **Real-time traffic processing** - Bridges traffic capture to game state tracking
- **Action handlers** for all major game operations (player, city, hero, army, combat, resources)
- **Pattern detection** for automated event recognition
- **Processing queue** with async handling for high-volume traffic

### Conversation Memory Service
- **Multi-conversation support** - Manage multiple conversation threads
- **Token-aware context windows** - Intelligent context trimming
- **Persistent storage** - Conversations saved across sessions
- **Search functionality** - Find messages across all conversations

### Enhanced LM Studio Client
- **Streaming responses** - Real-time token streaming with callbacks
- **Response caching** - Configurable cache for repeated queries
- **Retry logic** - Automatic retries with exponential backoff
- **Connection events** - EventEmitter for connection state changes
- **Auto-reconnect** - Configurable automatic reconnection

### Enhanced Intent Router
- **Confidence scoring** - All intents include confidence percentages
- **Embedding-based classification** - Optional semantic similarity matching
- **Fallback chain** - Graceful degradation through multiple handlers
- **Tool discovery** - Automatic MCP tool detection and routing

### Centralized Utilities
- **Logger** - Structured logging with levels, namespaces, and file output
- **Error Handler** - Categorized errors with recovery suggestions
- **IPC Wrapper** - Consistent error handling for all IPC handlers

## Improvements

### Service Integration
- All services now properly wired in `initializeServices()`
- Traffic processor feeds game state tracker automatically
- Conversation memory integrated with chatbot
- Intent router connected to MCP servers

### Chatbot Service
- Singleton pattern with backward-compatible exports
- Full method delegation for easy integration
- Property accessors for runtime configuration
- Event emitter delegation for message events

### AMF3 Decoder
- Added convenience `encode()` method to decoder class
- Bidirectional encoding/decoding in single class

### Game State Tracker
- State persistence with auto-save
- Configurable save intervals
- State loading on startup

### UI Polish
- Enhanced CSS with sorting indicators
- Row highlighting on hover
- Status badges with animations
- Improved dark theme consistency

### Workflow Optimization
- Consolidated duplicate workflow files
- CI only runs on branch pushes (not tags)
- Build only runs on tag pushes
- Eliminated duplicate workflow runs

## Bug Fixes

- Fixed `getMessageCount()` missing in ConversationMemory
- Fixed `getStatus()` missing in TrafficProcessor
- Fixed `encode()` method accessibility in AMF3Decoder
- Fixed chatbot service export methods
- Fixed workflow duplication causing multiple builds

## Testing

All services pass comprehensive integration tests:
- ✓ Playwright Service - All scraping methods verified
- ✓ Chatbot Service - Initialize, processMessage, getHistory working
- ✓ LM Studio Client - Streaming, auto-reconnect, all methods available
- ✓ Intent Router - Query classification with confidence scoring
- ✓ Full Pipeline - Chatbot with intent routing and conversation flow

## Files Changed

### New Files
- `services/traffic-processor.js` - Traffic to game state bridge
- `services/conversation-memory.js` - Chatbot memory management
- `utils/logger.js` - Centralized logging
- `utils/error-handler.js` - Error management
- `utils/ipc-wrapper.js` - IPC handler utilities
- `utils/index.js` - Utility exports

### Modified Files
- `services/lm-studio-client.js` - Streaming and caching
- `services/intent-router.js` - Confidence scoring
- `services/mcp-client-manager.js` - Health checks
- `services/chatbot-service.js` - Singleton exports
- `services/amf3-decoder.js` - Encode convenience method
- `services/game-state-tracker.js` - Persistence
- `themes/svony-theme.css` - UI polish
- `index.js` - Service wiring
- `.github/workflows/build.yml` - Consolidated workflow
- `.github/workflows/ci.yml` - Branch-only triggers

## Upgrade Notes

1. **LM Studio URL**: Ensure your LM Studio URL is configured in Settings → LLM
2. **Conversation Memory**: Previous conversations will be preserved
3. **Game State**: State is now persisted and restored on startup

## Known Issues

- MCP servers require manual start if not auto-configured
- Playwright requires Chromium to be installed for web scraping

## Next Steps (v2.0.8)

- Add unit test coverage
- Implement MCP server auto-discovery
- Add more protocol action handlers
- Enhance combat simulator with hero skills
