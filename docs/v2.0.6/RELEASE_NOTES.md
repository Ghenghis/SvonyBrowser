# Svony Browser v2.0.6 - Milestone Release

## Release Date: January 14, 2026

## Overview

Version 2.0.6 is a **major milestone release** that introduces Playwright hybrid integration, full MCP server connectivity, enhanced AI chatbot capabilities, and comprehensive traffic analysis features. This release represents a complete implementation of all planned features with production-ready code.

---

## New Services

### 1. AMF3 Decoder (`services/amf3-decoder.js`)
Complete Action Message Format 3 decoder supporting all data types:
- **Primitives**: Undefined, Null, Boolean, Integer, Double, String
- **Complex Types**: Array, Object, Date, ByteArray, XML, XMLDocument
- **Reference Tables**: String, Object, and Trait reference handling
- **Encoding**: Full AMF3 encoding support for packet injection

### 2. Playwright Service (`services/playwright-service.js`)
Hybrid web scraping service for external data collection:
- **Wiki Scraping**: Evony wiki data extraction
- **Forum Scraping**: Community forum search and extraction
- **Custom Scraping**: Configurable scraping with selectors
- **Screenshot Capture**: Full page and element screenshots
- **Script Execution**: Custom JavaScript execution in browser context

### 3. MCP Client Manager (`services/mcp-client-manager.js`)
Unified management of all three MCP servers:
- **evony-rag**: Knowledge base queries and document retrieval
- **evony-rte**: Real-time event processing and analysis
- **evony-tools**: Combat simulation, training calculations, resource planning
- **Auto-connect**: Automatic connection on startup
- **Tool Discovery**: Dynamic tool listing and invocation

### 4. Intent Router (`services/intent-router.js`)
Intelligent query routing for the chatbot:
- **Intent Classification**: Automatic categorization of user queries
- **MCP Routing**: Routes queries to appropriate MCP server
- **LM Studio Integration**: Falls back to LM Studio for general queries
- **Context Awareness**: Maintains conversation context
- **Multi-tool Orchestration**: Combines results from multiple sources

### 5. Fiddler Bridge (`services/fiddler-bridge.js`)
Full Fiddler integration for traffic analysis:
- **Traffic Capture**: Real-time HTTP/HTTPS traffic monitoring
- **Packet Injection**: Send custom packets to game server
- **Breakpoints**: Set breakpoints on specific actions
- **Request Modification**: Modify requests before sending
- **Export/Import**: Save and load traffic sessions

### 6. Game State Tracker (`services/game-state-tracker.js`)
Real-time game state tracking from traffic:
- **Player State**: Track player info, level, resources
- **City Management**: Monitor all cities and buildings
- **Hero Tracking**: Track hero stats, equipment, skills
- **Army Monitoring**: Track troop counts and marches
- **Event Detection**: Detect and log game events
- **State Export**: Export complete game state to JSON

---

## Enhanced Features

### Chatbot Integration
- **LM Studio + MCP**: Combines local LLM with MCP tools
- **Intent-based Routing**: Automatically routes queries to best handler
- **Context Memory**: Maintains conversation history
- **Quick Actions**: Pre-defined actions for common tasks
- **File Attachments**: Analyze uploaded files

### Traffic Analysis
- **Fiddler Integration**: Full Fiddler proxy support
- **Packet Injection**: Inject custom packets via UI
- **Breakpoints**: Set breakpoints on specific actions
- **AMF3 Decoding**: Automatic decoding of game packets
- **Session Recording**: Record and replay traffic sessions

### Game State
- **Live Updates**: Real-time state updates from traffic
- **Resource Tracking**: Monitor all resource types
- **Army Management**: Track all troops and marches
- **Export Function**: Export complete state to JSON

---

## IPC Handlers Added

### AMF3 Decoder
- `amf3-decode`: Decode hex data to JSON
- `amf3-encode`: Encode JSON to hex data

### Fiddler Bridge
- `fiddler-connect`: Connect to Fiddler
- `fiddler-disconnect`: Disconnect from Fiddler
- `fiddler-status`: Get connection status
- `fiddler-get-traffic`: Get captured traffic
- `fiddler-clear-traffic`: Clear traffic history
- `fiddler-inject-request`: Inject custom request
- `fiddler-set-breakpoint`: Set/remove breakpoint
- `fiddler-get-breakpoints`: List all breakpoints

### Game State Tracker
- `game-tracker-get-state`: Get full game state
- `game-tracker-get-player`: Get player info
- `game-tracker-get-cities`: Get all cities
- `game-tracker-get-heroes`: Get all heroes
- `game-tracker-get-armies`: Get all armies
- `game-tracker-get-resources`: Get resources
- `game-tracker-get-events`: Get event history
- `game-tracker-export`: Export state to file
- `game-tracker-reset`: Reset state

### MCP Client Manager
- `mcp-manager-connect-all`: Connect all servers
- `mcp-manager-disconnect-all`: Disconnect all servers
- `mcp-manager-get-status`: Get connection status
- `mcp-manager-call-tool`: Call specific tool
- `mcp-manager-list-tools`: List server tools
- `mcp-manager-get-all-tools`: Get all available tools
- `mcp-manager-route-query`: Route query to best handler

### Playwright Service
- `playwright-start`: Start browser instance
- `playwright-stop`: Stop browser instance
- `playwright-status`: Get service status
- `playwright-scrape`: Scrape URL with options
- `playwright-scrape-wiki`: Scrape Evony wiki
- `playwright-scrape-forum`: Search Evony forums
- `playwright-screenshot`: Take screenshot
- `playwright-execute`: Execute custom script

### Intent Router
- `route-intent`: Route message to appropriate handler

---

## UI Updates

### Toolbar
- **MCP Status Indicator**: Shows MCP server connection status
- **Fiddler Status Indicator**: Shows Fiddler connection status

### Tools Tab
- **MCP Server Status**: List of all MCP servers with connection status
- **Game State Viewer**: Live game state display
- **Export/Refresh Buttons**: Export and refresh game state

### Traffic Tab
- **Inject Button**: Inject custom packets
- **Fiddler Integration**: Automatic traffic from Fiddler

---

## Documentation

### Architecture Diagrams
- `SYSTEM_ARCHITECTURE.mmd/.png`: Overall system architecture
- `DATA_FLOW_TRAFFIC.mmd/.png`: Traffic data flow
- `AI_INTEGRATION.mmd/.png`: AI and MCP integration
- `PROTOCOL_HANDLER.mmd/.png`: Protocol handling flow
- `IPC_COMMUNICATION.mmd/.png`: IPC communication paths
- `GAME_STATE_TRACKING.mmd/.png`: Game state tracking flow
- `SESSION_RECORDING.mmd/.png`: Session recording flow

### Feature Documentation
- `FEATURE_INVENTORY.md`: Complete feature inventory
- `FEATURE_BLUEPRINTS.md`: Detailed feature blueprints

---

## How to Use New Features

### Connect to LM Studio
1. Open Settings → LLM section
2. Enter your LM Studio URL (e.g., `http://192.168.0.3:1234`)
3. Click "Test Connection"
4. Save Settings

### Connect MCP Servers
1. Go to Tools tab
2. Click "Reconnect All" in MCP Server Status
3. Wait for servers to connect (status will update)

### Use Fiddler Integration
1. Install and run Fiddler
2. Configure Fiddler to capture traffic
3. The app will automatically detect Fiddler
4. Traffic will appear in Traffic tab

### Track Game State
1. Start playing Evony in the browser
2. Go to Tools tab → Game State section
3. State updates automatically as you play
4. Click "Export" to save state to file

### Use Enhanced Chatbot
1. Open the Co-Pilot panel
2. Ask questions about Evony
3. The chatbot will use MCP tools and LM Studio
4. Use quick actions for common tasks

---

## Technical Notes

- **Playwright**: Added as optional dependency for web scraping
- **MCP Protocol**: Full MCP SDK integration
- **AMF3**: Complete implementation per Adobe specification
- **IPC**: 50+ new IPC handlers for full feature coverage

---

## Known Limitations

- Playwright requires separate installation of browser binaries
- MCP servers must be running for full functionality
- Fiddler must be installed separately for traffic capture
- LM Studio must be running for AI chatbot features

---

## Upgrade Instructions

1. Download the new release from GitHub
2. Install over existing installation (settings preserved)
3. Run setup-flash.bat if Flash is not working
4. Configure LM Studio URL in Settings
5. Start MCP servers if using MCP features

---

## Links

- **GitHub Repository**: https://github.com/Ghenghis/SvonyBrowser
- **Releases**: https://github.com/Ghenghis/SvonyBrowser/releases
- **Documentation**: https://github.com/Ghenghis/SvonyBrowser/tree/main/docs

---

*Svony Browser v2.0.6 - Built for the Evony community*
