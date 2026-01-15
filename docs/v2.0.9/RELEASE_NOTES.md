# Svony Browser v2.0.9 Release Notes

**Release Date:** January 2025  
**Codename:** Debug & Automation Edition

## Overview

v2.0.9 is a major milestone release focused on built-in debugging capabilities, enhanced Playwright automation, and an extreme chatbot agent mode. This release adds 9 new services totaling over 3,000 lines of code.

## New Features

### 🔧 Built-in Debug System

A comprehensive debugging toolkit integrated directly into the browser:

| Component | Description |
|-----------|-------------|
| **Debug Manager** | Centralized log aggregation with file rotation and export |
| **Network Inspector** | HTTP/WebSocket request monitoring with filtering |
| **Performance Profiler** | CPU, memory, FPS, and latency tracking |
| **Debug Console** | Execute JavaScript commands directly |

**Key Capabilities:**
- Multi-level logging (error, warn, info, debug)
- Log filtering by level and source
- Export logs to JSON/CSV
- Real-time network request monitoring
- Performance metrics with visual bars
- Memory and CPU profiling

### 🤖 Playwright Automation System

Extended Playwright hybrid integration for powerful automation:

| Component | Description |
|-----------|-------------|
| **Script Recorder** | Record browser interactions as Playwright scripts |
| **Script Runner** | Execute scripts with queue management |
| **Automation Templates** | Pre-built Evony automation scripts |

**Pre-built Templates:**
- Daily Login Rewards
- Resource Collection
- Building Queue Manager
- Research Automation
- Troop Training
- Alliance Help
- Monster Hunting
- World Map Scout
- March Management
- Event Participation

### 🧠 Agent Mode (Chatbot AI)

Autonomous AI agent that can play Evony with goals:

| Feature | Description |
|---------|-------------|
| **Goal-Based Planning** | Set objectives, agent plans and executes |
| **Action Queue** | Prioritized action execution |
| **Decision History** | Track all agent decisions |
| **Pause/Resume** | Control agent execution |

**Agent Capabilities:**
- Analyze game state
- Make strategic decisions
- Execute actions via Playwright
- Learn from outcomes
- Report progress

### 🎤 Voice Service

Voice interaction for hands-free control:

- Speech recognition (Web Speech API)
- Text-to-speech responses
- Voice commands for common actions
- Configurable voice settings

### 🔌 Chatbot Plugins

Extensible plugin system for the chatbot:

| Plugin | Description |
|--------|-------------|
| **Game State** | Query current game state |
| **Combat Calc** | Calculate battle outcomes |
| **Resource Tracker** | Monitor resource production |
| **Build Advisor** | Building recommendations |
| **Research Guide** | Research path suggestions |
| **Event Timer** | Track event schedules |
| **Alliance Tools** | Alliance management helpers |
| **Debug Helper** | Debug commands via chat |

## New Services Summary

| Service | Lines | Methods |
|---------|-------|---------|
| DebugManager | ~600 | 29 |
| NetworkInspector | ~550 | 32 |
| PerformanceProfiler | ~450 | 24 |
| ScriptRecorder | ~700 | 35 |
| ScriptRunner | ~500 | 24 |
| AutomationTemplates | ~400 | 12 |
| AgentController | ~650 | 24 |
| VoiceService | ~500 | 26 |
| ChatbotPluginManager | ~300 | 10 |
| **Total** | **~4,650** | **216** |

## UI Enhancements

### Debug Tab
- Log viewer with filtering
- Network request list with stats
- Performance metrics cards
- Interactive debug console

### Automation Tab
- Script recorder with action list
- Template gallery with run buttons
- Runner queue status
- Scheduled tasks manager
- Agent mode panel with goals

## IPC Handlers Added

Over 60 new IPC handlers for complete feature coverage:

- Debug: 4 handlers
- Network: 5 handlers
- Performance: 4 handlers
- Script Recorder: 7 handlers
- Script Runner: 6 handlers
- Templates: 3 handlers
- Agent: 9 handlers
- Voice: 5 handlers
- Plugins: 4 handlers
- Console: 1 handler

## Bug Fixes

- Fixed workflow duplication (consolidated to 2 workflows)
- Improved error handling in all services
- Better null checks in renderer event handlers
- Fixed memory leaks in log aggregation

## Breaking Changes

None - fully backward compatible with v2.0.8.

## Dependencies

No new dependencies required - uses existing Playwright and Electron APIs.

## Installation

Download from GitHub Releases:
- `SvonyBrowser-Setup-2.0.9-x64.exe` - 64-bit installer
- `SvonyBrowser-Setup-2.0.9-ia32.exe` - 32-bit installer
- `SvonyBrowser-Portable-2.0.9-x64.exe` - Portable version

## Upgrade Notes

1. Download and install v2.0.9
2. Your settings will be preserved
3. New Debug and Automation tabs available immediately
4. Configure Agent goals in Automation tab

## Known Issues

- Voice recognition requires microphone permission
- Agent mode requires LM Studio connection for AI decisions
- Some automation templates may need adjustment for game updates

## What's Next (v2.1.0)

- Visual script editor
- More automation templates
- Enhanced agent learning
- Multi-account support
- Cloud sync for scripts

---

**Full Changelog:** https://github.com/Ghenghis/SvonyBrowser/compare/v2.0.8...v2.0.9
