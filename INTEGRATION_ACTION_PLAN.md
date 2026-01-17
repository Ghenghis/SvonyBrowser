# SvonyBrowser v2.2.12 - Tool Integration Action Plan

## Overview
Comprehensive integration of Evony tools from multiple source projects into SvonyBrowser tabs and panels.

## Source Projects Analyzed

### 1. D:\EvonyToolKit\sol_manager
**Priority: HIGH** - Account & SOL Management
- `account_data_tab.py` - Account display with cities, troops, heroes
- `account_manager.py` - Core account operations
- `bot_launcher.py` - Launch bots with TOR nodes
- `node_manager.py` - TOR node management
- `sol_handler.py` - SOL file operations
- `backup_manager.py` - Account backup system

### 2. C:\Users\Admin\Downloads\Evony_Decrypted\evony_hub
**Priority: HIGH** - Unified Evony Framework
- `gui.py` - Full graphical interface
- `server.py` - Script server for AutoEvony
- `automation.py` - Full automation system
- `borg_toolkit.py` - Advanced tools
- `glitch_calculator.py` - Glitch number calculator
- `exploit_discovery.py` - Exploit analysis
- `protocol_exploiter.py` - Protocol manipulation

### 3. C:\Users\Admin\Downloads\Evony_Decrypted\evony_rag
**Priority: HIGH** - RAG Knowledge Base
- `mcp_server_v2.py` - MCP server for RAG
- `rag_ultimate_v2.py` - Advanced RAG engine
- `knowledge_graph.py` - Knowledge graph integration
- `hybrid_search.py` - Hybrid search capabilities
- `cli_v2.py` - CLI interface

### 4. C:\Users\Admin\Downloads\Evony_Decrypted\evony_rte
**Priority: MEDIUM** - Real-Time Engine
- Real-time game data processing
- Event handling

### 5. D:\svony_studio
**Priority: MEDIUM** - UI Patterns
- `src/ui/` - UI components
- `src/tools/` - Tool implementations
- `src/evony_hub/` - Hub integration

---

## Integration TODO List

### Phase 1: Accounts Tab (HIGH PRIORITY)
- [ ] Create Accounts tab in browser.html
- [ ] Integrate SOL file loading/parsing
- [ ] Add account list with cities/troops/heroes display
- [ ] Implement SOL editor/decrypter/resigner
- [ ] Add account backup/restore functions
- [ ] Connect to left/right panels for account switching

### Phase 2: TOR/Proxy Integration
- [ ] Add TOR node configuration panel
- [ ] Integrate node_manager.py logic
- [ ] Add proxy rotation for panels
- [ ] Node health monitoring

### Phase 3: Evony Hub Connection
- [ ] Connect to evony_hub server
- [ ] Add automation controls
- [ ] Integrate script server
- [ ] Add scheduler interface

### Phase 4: RAG/Knowledge Base
- [ ] Connect to evony_rag MCP server
- [ ] Add protocol lookup in chatbot
- [ ] Integrate knowledge graph queries
- [ ] Add search interface for game knowledge

### Phase 5: Real-Time Features
- [ ] Connect to evony_rte
- [ ] Add real-time game state tracking
- [ ] Live resource monitoring
- [ ] Event notifications

---

## Tab Structure Plan

### Current Tabs:
1. Browser - Main panels ✅
2. Traffic - Network capture ✅
3. Protocol - Protocol analysis ✅
4. Tools - Utilities ✅
5. Debug - Debugging ✅
6. Automation - Bot control ✅

### New Tabs to Add:
7. **Accounts** - SOL manager, account switching, backup
8. **Nodes** - TOR/Proxy management
9. **Knowledge** - RAG search, protocol lookup

---

## Connection Points

### Left Panel (AutoEvony Bot):
- Load account SOL files
- Connect with TOR node
- Display bot status

### Right Panel (Evony Client):
- Load game client with account
- Mirror or independent mode
- Resource tracking

### Chatbot (Co-Pilot):
- Query RAG for game knowledge
- Protocol lookups
- Strategy advice

---

## File Locations to Include

### Accounts Data:
- `C:\Users\Admin\Downloads\Evony_Decrypted\Accounts\`
- `D:\EvonyToolKit\SOL_Accounts\`
- `D:\EvonyToolKit\accounts\`

### TOR Configuration:
- `D:\EvonyToolKit\Tor\`
- `D:\EvonyToolKit\TorData\`
- `D:\EvonyToolKit\nodes.ini`

### RAG Server:
- `C:\Users\Admin\Downloads\Evony_Decrypted\evony_rag\mcp_server_v2.py`

### Evony Hub:
- `C:\Users\Admin\Downloads\Evony_Decrypted\RUN_EVONY_HUB.bat`

---

## Implementation Priority

1. **IMMEDIATE**: Fix sync controls visibility ✅
2. **IMMEDIATE**: Panel resolution/zoom settings ✅
   - Settings > Browser > Panel Resolution/Zoom
   - Left/Right panel zoom: 50%-150% + custom
   - SWF mode override option
   - Presets: Mobile (50%), Compact (67%), Small (75%), Medium (90%), Default (100%), Large (110%), XL (125%), Huge (150%)
   - Settings persist across sessions
3. **IMMEDIATE**: Test current features work
4. **HIGH**: Add Accounts tab with SOL manager
4. **HIGH**: Connect RAG to chatbot
5. **MEDIUM**: Add TOR node management
6. **MEDIUM**: Integrate Evony Hub automation
7. **LOW**: Add Knowledge tab with full RAG UI

---

## Testing Requirements

- [ ] All toolbar buttons respond
- [ ] All tabs switch correctly
- [ ] Left panel loads Evony web
- [ ] Right panel loads AutoEvony SWF
- [ ] Chatbot toggles and responds
- [ ] SOL files load and parse
- [ ] TOR nodes connect
- [ ] RAG queries return results
