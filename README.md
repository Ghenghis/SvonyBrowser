# Svony Browser

<p align="center">
  <img src="icon.png" alt="Svony Browser Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Evony Analysis Suite - Flash Browser with Dual Panels, Traffic Viewer, Protocol Explorer, Combat Simulator, and AI Co-Pilot</strong>
</p>

<p align="center">
  <a href="https://github.com/Ghenghis/Svony-Browser/releases/latest">
    <img src="https://img.shields.io/github/v/release/Ghenghis/Svony-Browser?style=flat-square" alt="Latest Release">
  </a>
  <a href="https://github.com/Ghenghis/Svony-Browser/releases">
    <img src="https://img.shields.io/github/downloads/Ghenghis/Svony-Browser/total?style=flat-square" alt="Downloads">
  </a>
  <a href="https://github.com/Ghenghis/Svony-Browser/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Ghenghis/Svony-Browser?style=flat-square" alt="License">
  </a>
</p>

---

## Overview

Svony Browser is a comprehensive Evony game analysis suite built on Electron with Pepper Flash support. It provides a dual-panel browser interface for running AutoEvony and the Evony client simultaneously, along with powerful tools for traffic analysis, protocol exploration, combat simulation, and AI-assisted gameplay.

## Features

### Dual-Panel Browser
- **Side-by-side panels** for AutoEvony bot and Evony client
- **Web/SWF/Hybrid mode toggle** for each panel
- **Webbar navigation** with back, forward, refresh, URL entry
- **Server selector** (cc1-cc5)
- **Panel swap and resize** functionality
- **Session synchronization** between panels
- **Loading progress bar** with smooth animations
- **Error overlay** with retry and fallback options

### Hybrid Mode (Playwright)
- **Playwright-powered automation** for enhanced web interaction
- **Auto-login** with intelligent form detection
- **Form auto-fill** by CSS selector
- **Request interception** for network monitoring
- **Session persistence** across restarts
- **Screenshot capture** for debugging
- **Network request logging**

### Traffic Viewer
- **Real-time packet capture** from game traffic
- **Action filtering** by category (server, city, hero, army, etc.)
- **Decoded JSON view** with syntax highlighting
- **Raw hex view** with offset display
- **Headers inspection**
- **Breakpoints** for debugging specific actions
- **Packet comparison** (diff view)
- **Packet injection** for testing
- **Session recording and replay**
- **Export to JSON/CSV**

### Protocol Explorer
- **Complete protocol database** with 100+ Evony actions
- **Category-based navigation** (server, city, hero, army, alliance, map, chat, quest, item, shop)
- **Request/response documentation**
- **Request builder** with parameter editor
- **Send packet** functionality
- **Template save/load**
- **Copy to clipboard**

### Combat Simulator
- **Full troop type support** (Archer, Cavalry, Cataphract, Warrior, Pikeman, Swordsman, Scout, Ballista, Ram, Catapult)
- **Hero attack/defense** modifiers
- **Wall defense** calculations
- **Trap and Abatis** effects
- **Battle outcome prediction**
- **Loss estimation**

### Session Recorder
- **Record game sessions** with all traffic
- **Pause/resume** recording
- **Replay sessions** at variable speed
- **Export sessions** for analysis
- **Session browser** with metadata

### Game State Viewer
- **Real-time player info** (name, level, prestige)
- **City count** and details
- **Hero roster**
- **Active marches** tracking
- **Resource levels**
- **Export game state** to JSON

### AI Co-Pilot
- **Natural language interface** for game assistance
- **Protocol lookup** via chat
- **Training calculations**
- **Strategy recommendations**
- **File upload** for log analysis
- **Syntax highlighting** for code blocks
- **Chat history export**
- **MCP integration** for enhanced capabilities

### Tools
- **AMF3 Decoder** - Decode raw AMF data
- **Training Calculator** - Calculate troop training costs/time
- **March Time Calculator** - Estimate march durations
- **MCP Server Status** - Monitor AI service connections

## Installation

### Windows Installer
1. Download the latest release from [GitHub Releases](https://github.com/Ghenghis/Svony-Browser/releases)
2. Run `SvonyBrowser-Setup-x.x.x-x64.exe` (or ia32 for 32-bit)
3. Follow the installation wizard

### Portable Version
1. Download `SvonyBrowser-Portable-x.x.x-x64.exe`
2. Run directly - no installation required

### From Source
```bash
# Clone the repository
git clone https://github.com/Ghenghis/Svony-Browser.git
cd Svony-Browser

# Install dependencies
npm install

# Install MCP servers (optional, for AI features)
npm run setup:mcp

# Setup ChromaDB (optional, for RAG features)
npm run setup:chromadb

# Run the application
npm start
```

## Building

```bash
# Build for Windows (64-bit)
npm run build:win64

# Build for Windows (32-bit)
npm run build:win32

# Build all Windows targets
npm run build:all

# Build portable version
npm run build:portable
```

## Configuration

### Flash Player
The application uses Pepper Flash for Flash content. Flash plugins are included in the `flashver` directory.

### MCP Servers
For AI-enhanced features, configure MCP servers in `config/mcp-config.json`:

```json
{
  "servers": {
    "evony-rag": {
      "command": "node",
      "args": ["mcp-servers/evony-rag/index.js"],
      "enabled": true
    },
    "evony-rte": {
      "command": "node",
      "args": ["mcp-servers/evony-rte/index.js"],
      "enabled": true
    },
    "evony-tools": {
      "command": "node",
      "args": ["mcp-servers/evony-tools/index.js"],
      "enabled": true
    }
  }
}
```

### Fiddler Integration
For traffic capture via Fiddler:
1. Copy `scripts/fiddler/SvonyBridge.js` to Fiddler's CustomRules
2. Restart Fiddler
3. Enable proxy in Svony Browser settings

## Project Structure

```
Svony-Browser/
├── browser.html          # Main browser UI
├── index.js              # Electron main process
├── renderer.js           # Renderer process logic
├── preload.js            # Webview preload script
├── store.js              # Settings persistence
├── settings.html         # Settings window
├── package.json          # Project configuration
├── config/
│   ├── mcp-config.json   # MCP server configuration
│   └── settings-default.json
├── data/
│   └── protocol-actions.json  # Protocol definitions
├── knowledge-base/       # RAG knowledge documents
│   ├── heroes/
│   ├── troops/
│   ├── buildings/
│   ├── combat/
│   └── protocols/
├── mcp-servers/          # MCP server implementations
│   ├── evony-rag/        # RAG search server
│   ├── evony-rte/        # Real-time engine server
│   └── evony-tools/      # Game tools server
├── scripts/
│   ├── fiddler/          # Fiddler integration
│   └── setup-chromadb.js # ChromaDB setup
├── services/             # Backend services
│   ├── protocol-handler.js
│   ├── mcp-connection.js
│   ├── proxy-monitor.js
│   ├── chatbot-service.js
│   ├── game-state.js
│   ├── packet-analysis.js
│   ├── combat-simulator.js
│   ├── session-recorder.js
│   ├── panel-manager.js       # Panel state management
│   ├── panel-ui-controller.js # UI interactions
│   ├── panel-playwright-bridge.js  # Playwright integration
│   ├── playwright-service.js  # Playwright browser instance
│   ├── agent-controller.js    # AI agent automation
│   ├── error-tracker.js       # Error tracking
│   ├── error-helper.js        # Error solutions
│   └── self-healer.js         # Auto-recovery
└── themes/
    └── svony-theme.css   # Application styling
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Show left panel only |
| `Ctrl+2` | Show both panels |
| `Ctrl+3` | Show right panel only |
| `Ctrl+S` | Swap panels |
| `F5` | Reload left panel |
| `F6` | Reload right panel |
| `Ctrl+L` | Focus URL bar |
| `Ctrl+D` | Add bookmark |
| `Alt+Left` | Go back |
| `Alt+Right` | Go forward |
| `Ctrl+Shift+I` | Open DevTools |
| `F11` | Toggle fullscreen |
| `Escape` | Close context menu/dropdown |

## API Reference

### IPC Channels

#### Traffic
- `traffic-start` - Start traffic capture
- `traffic-stop` - Stop traffic capture
- `traffic-entry` - Receive traffic entry

#### Protocol
- `protocol-decode` - Decode AMF data
- `protocol-send` - Send protocol packet
- `protocol-lookup` - Look up protocol action

#### Session
- `session-start` - Start recording
- `session-stop` - Stop recording
- `session-replay` - Replay session
- `session-list` - List recorded sessions

#### Combat
- `combat-simulate` - Run combat simulation

#### Game State
- `gamestate-get` - Get current game state
- `gamestate-export` - Export game state

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [FlashBrowser](https://github.com/nicholasVilela/FlashBrowser) - Original Flash browser base
- [Electron](https://www.electronjs.org/) - Desktop application framework
- [Pepper Flash](https://www.nicholasVilela.com/) - Flash player plugin

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/Ghenghis/Svony-Browser/issues) page.

---

<p align="center">Made with love by Ghenghis</p>
