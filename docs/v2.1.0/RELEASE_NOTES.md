# Svony Browser v2.1.0 - Milestone Release

**Release Date:** January 15, 2026

## Overview

Version 2.1.0 is a major milestone release featuring comprehensive polish, 100% test pass rate, complete Playwright integration, and all services fully wired and connected. This release includes all Flash assets bundled for immediate use.

## Test Results

| Metric | Result |
|--------|--------|
| Total Tests | 299 |
| Passed | 299 |
| Failed | 0 |
| Pass Rate | **100.0%** |

## Key Improvements

### Complete Service Wiring
All 28 services are now properly initialized and connected:
- All 12 previously unloaded services now fully wired
- Agent Controller connected to Playwright services
- Chatbot connected to LM Studio and MCP servers
- Traffic Processor connected to Game State Tracker
- Health Check system monitors all services

### Playwright Integration
- **PlaywrightService** - Core scraping and automation
- **PanelPlaywrightBridge** - Panel-specific automation
- **ScriptRecorder** - Records actions to Playwright scripts
- **ScriptRunner** - Executes scripts with scheduling
- **AgentController** - Uses Playwright for autonomous actions

### Panel Enhancements
- Responsive CSS for all window sizes
- Auto-resize on window resize
- Proper scaling for SWF and Web content
- Panel sync modes (Mirror, Compare, Transfer)
- 5-level failsafe recovery system

### Chatbot Improvements
- Real LM Studio integration (no mocks)
- Intent routing with confidence scoring
- Conversation memory with persistence
- Plugin system with 8 built-in plugins
- Voice service for speech recognition/synthesis

### Debug System
- Centralized logging with file rotation
- Network inspector for HTTP/WS monitoring
- Performance profiler for CPU/memory tracking
- Debug console in UI

### Automation Features
- 10 pre-built automation templates
- Script recorder with export to Playwright
- Scheduled task execution
- Agent mode for autonomous gameplay

## Bundled Assets

All releases include:
- **Flash Player** - pepflashplayer64.dll, pepflashplayer32.dll, libpepflashplayer.so, PepperFlashPlayer.plugin
- **SwiftShader** - libEGL.dll, libGLESv2.dll
- **SWF Files** - AutoEvony.swf
- **MCP Servers** - evony-rag, evony-rte, evony-tools
- **Knowledge Base** - Protocol documentation, game data
- **Themes** - svony-theme.css, panel-responsive.css

## Build Targets

| Platform | Architectures | Formats |
|----------|---------------|---------|
| Windows | x64, ia32 | NSIS Installer, Portable, ZIP |
| macOS | x64 | DMG, ZIP |
| Linux | x64 | AppImage, DEB, tar.gz |

## Service Inventory

### Core Services (28 total)
1. amf3-decoder.js - AMF3 protocol encoding/decoding
2. agent-controller.js - Autonomous agent mode
3. automation-templates.js - Pre-built scripts
4. chatbot-plugins.js - Extensible plugins
5. chatbot-service.js - AI chatbot with LM Studio
6. combat-simulator.js - Battle simulation
7. conversation-memory.js - Chat history persistence
8. debug-manager.js - Centralized logging
9. fiddler-bridge.js - Fiddler integration
10. game-state-tracker.js - Real-time state tracking
11. health-check.js - Service health monitoring
12. intent-router.js - Query classification
13. lm-studio-client.js - LM Studio API client
14. mcp-client-manager.js - MCP server management
15. network-inspector.js - HTTP/WS monitoring
16. panel-manager.js - Panel state management
17. panel-playwright-bridge.js - Panel automation
18. panel-ui-controller.js - UI management
19. performance-profiler.js - CPU/memory profiling
20. playwright-service.js - Web scraping
21. protocol-handler.js - Game protocol parsing
22. script-recorder.js - Action recording
23. script-runner.js - Script execution
24. session-recorder.js - Traffic recording
25. traffic-processor.js - Traffic analysis
26. voice-service.js - Speech recognition/synthesis
27. store.js - Settings persistence
28. proxy-monitor.js - Network proxy

## IPC Handlers

Total: 150+ IPC handlers covering all features

## Upgrade Notes

### From v2.0.x
- All settings preserved
- No migration required
- Simply install new version

### First Time Setup
1. Install Svony Browser
2. Flash Player files are bundled - no additional download needed
3. Configure LM Studio URL in Settings → LLM
4. Optional: Run `npm run setup:mcp` for MCP servers

## Known Issues

None - all issues from previous versions resolved.

## Contributors

- Ghenghis (Lead Developer)
- Manus AI (Development Assistant)

## Links

- **GitHub**: https://github.com/Ghenghis/Svony-Browser
- **Releases**: https://github.com/Ghenghis/Svony-Browser/releases
- **Issues**: https://github.com/Ghenghis/Svony-Browser/issues
">
