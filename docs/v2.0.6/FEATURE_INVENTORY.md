# Svony Browser v2.0.5 Feature Inventory

## Current Feature Status Matrix

| Feature | Status | Completeness | Notes |
|---------|--------|--------------|-------|
| **Browser Core** |
| Dual Panel Browser | ✅ Working | 95% | Minor resize issues |
| Web/SWF Toggle | ✅ Working | 100% | |
| Server Selector | ✅ Working | 100% | cc1-cc5 |
| Panel Swap | ✅ Working | 100% | |
| Session Sync | ⚠️ Partial | 40% | Not fully implemented |
| **Traffic Viewer** |
| Packet Capture | ⚠️ Partial | 50% | Headers only, no body |
| Action Filtering | ✅ Working | 90% | |
| JSON View | ✅ Working | 85% | |
| Hex View | ✅ Working | 90% | |
| Breakpoints | ❌ Not Implemented | 0% | UI exists, no logic |
| Packet Comparison | ❌ Not Implemented | 0% | |
| Packet Injection | ❌ Not Implemented | 0% | |
| Session Recording | ⚠️ Partial | 60% | Basic recording works |
| Export JSON/CSV | ✅ Working | 100% | |
| **Protocol Explorer** |
| Protocol Database | ✅ Working | 100% | 100+ actions |
| Category Navigation | ✅ Working | 100% | |
| Request/Response Docs | ✅ Working | 90% | |
| Request Builder | ❌ Not Implemented | 10% | UI only |
| Send Packet | ❌ Not Implemented | 0% | |
| Template Save/Load | ❌ Not Implemented | 0% | |
| **Combat Simulator** |
| Troop Types | ✅ Working | 100% | All 12 types |
| Hero Modifiers | ⚠️ Partial | 50% | Basic only |
| Wall Defense | ⚠️ Partial | 40% | Simplified |
| Traps/Abatis | ❌ Not Implemented | 0% | |
| Battle Prediction | ⚠️ Partial | 60% | Basic algorithm |
| **Session Recorder** |
| Record Sessions | ⚠️ Partial | 60% | |
| Pause/Resume | ❌ Not Implemented | 0% | |
| Replay Sessions | ❌ Not Implemented | 0% | |
| Session Browser | ⚠️ Partial | 40% | |
| **Game State Viewer** |
| Player Info | ⚠️ Partial | 30% | Needs traffic parsing |
| City Details | ⚠️ Partial | 30% | |
| Hero Roster | ⚠️ Partial | 30% | |
| Active Marches | ❌ Not Implemented | 0% | |
| Export State | ⚠️ Partial | 50% | |
| **AI Co-Pilot** |
| Chat Interface | ✅ Working | 100% | |
| LM Studio Integration | ✅ Working | 90% | Auto-reconnect added |
| Protocol Lookup | ⚠️ Partial | 50% | Basic search |
| Training Calc | ✅ Working | 100% | |
| Strategy Recs | ⚠️ Partial | 40% | Hardcoded responses |
| File Upload | ❌ Not Implemented | 0% | |
| MCP Integration | ⚠️ Partial | 40% | Servers exist, not wired |
| **Tools** |
| AMF3 Decoder | ⚠️ Partial | 30% | Basic hex only |
| Training Calculator | ✅ Working | 100% | |
| March Calculator | ❌ Not Implemented | 0% | |
| MCP Status | ⚠️ Partial | 50% | |
| Fiddler Integration | ⚠️ Partial | 60% | Bridge exists |
| SOL Editor | ⚠️ Partial | 30% | File browser only |

## MCP Server Status

| Server | Status | Tools | Integration |
|--------|--------|-------|-------------|
| evony-rag | ✅ Ready | evony_search, evony_lookup, evony_context | ❌ Not wired |
| evony-rte | ✅ Ready | protocol_lookup, protocol_search, decode_packet, analyze_traffic | ❌ Not wired |
| evony-tools | ✅ Ready | calc_training, calc_march, calc_combat, calc_resources, calc_building | ❌ Not wired |

## Service Layer Status

| Service | File | Status | Notes |
|---------|------|--------|-------|
| LM Studio Client | lm-studio-client.js | ✅ Working | Auto-reconnect, events |
| Chatbot Service | chatbot-service.js | ⚠️ Partial | Needs MCP integration |
| Combat Simulator | combat-simulator.js | ⚠️ Partial | Basic algorithm |
| Protocol Handler | protocol-handler.js | ⚠️ Partial | AMF3 incomplete |
| Game State | game-state.js | ⚠️ Partial | Needs traffic parsing |
| Session Recorder | session-recorder.js | ⚠️ Partial | Basic recording |
| MCP Connection | mcp-connection.js | ⚠️ Partial | Not fully wired |
| Proxy Monitor | proxy-monitor.js | ⚠️ Partial | Headers only |
| Packet Analysis | packet-analysis.js | ⚠️ Partial | Basic analysis |

## Knowledge Base Status

| Category | Files | Content Quality |
|----------|-------|-----------------|
| buildings | 1 | ⚠️ Basic |
| combat | 1 | ⚠️ Basic |
| heroes | 1 | ⚠️ Basic |
| protocols | 1 | ✅ Good |
| troops | 1 | ⚠️ Basic |

## Original FlashBrowser Features (Missing)

| Feature | Priority | Complexity |
|---------|----------|------------|
| Tab-based browsing | High | Medium |
| Favorites system | Medium | Low |
| Homepage setting | Medium | Low |
| SWF download | Medium | Low |
| Find in page | High | Low |
| Zoom controls | Low | Low |

## Summary Statistics

- **Total Features**: 45
- **Fully Working**: 15 (33%)
- **Partially Working**: 20 (44%)
- **Not Implemented**: 10 (22%)

## Critical Gaps for v2.0.6

1. **MCP Integration** - Servers exist but not connected to UI
2. **Traffic Body Capture** - Only headers captured
3. **AMF3 Decoder** - Incomplete implementation
4. **Game State Tracking** - Needs real traffic parsing
5. **Packet Injection** - Not implemented
6. **Session Replay** - Not implemented
