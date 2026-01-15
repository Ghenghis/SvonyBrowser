# Svony Browser v2.0.6 Feature Enhancement Blueprints

## Blueprint 1: Complete MCP Integration

### Objective
Wire all three MCP servers (evony-rag, evony-rte, evony-tools) to the UI for seamless AI-powered assistance.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Co-Pilot Panel                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Chat Input  │  │ Quick Tools │  │ Context     │             │
│  │             │  │ ○ Training  │  │ ○ Game State│             │
│  │             │  │ ○ Combat    │  │ ○ Selection │             │
│  │             │  │ ○ March     │  │ ○ Traffic   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                     Response Area                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ AI Response with:                                           ││
│  │ • Rich text formatting                                      ││
│  │ • Code blocks with syntax highlighting                      ││
│  │ • Data tables                                               ││
│  │ • Action buttons (Copy, Execute, Save)                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

1. **MCP Client Manager** (services/mcp-client-manager.js)
   - Spawn and manage MCP server processes
   - Handle JSON-RPC communication
   - Implement tool routing

2. **Intent Router** (services/intent-router.js)
   - Classify user intent from chat messages
   - Route to appropriate MCP tool
   - Build context from game state

3. **Response Formatter** (services/response-formatter.js)
   - Format MCP responses for display
   - Handle different response types
   - Add action buttons

### IPC Handlers Required
```javascript
// Main process handlers
ipcMain.handle('mcp-call-tool', async (event, { server, tool, args }) => {...});
ipcMain.handle('mcp-list-tools', async (event, server) => {...});
ipcMain.handle('mcp-get-status', async (event) => {...});
```

### Files to Modify
- `index.js` - Add MCP IPC handlers
- `renderer.js` - Add MCP UI integration
- `services/chatbot-service.js` - Route to MCP tools
- `browser.html` - Add tool buttons

---

## Blueprint 2: Full AMF3 Protocol Decoder

### Objective
Implement complete AMF3 decoding with all data types and reference handling.

### AMF3 Type Support Matrix

| Type | Code | Status | Implementation |
|------|------|--------|----------------|
| Undefined | 0x00 | ✅ | Direct |
| Null | 0x01 | ✅ | Direct |
| False | 0x02 | ✅ | Direct |
| True | 0x03 | ✅ | Direct |
| Integer | 0x04 | ⚠️ | Need U29 decoder |
| Double | 0x05 | ⚠️ | Need IEEE754 |
| String | 0x06 | ⚠️ | Need reference table |
| XML Doc | 0x07 | ❌ | Complex |
| Date | 0x08 | ⚠️ | Need U29 + double |
| Array | 0x09 | ⚠️ | Need reference table |
| Object | 0x0A | ⚠️ | Need traits table |
| XML | 0x0B | ❌ | Complex |
| ByteArray | 0x0C | ⚠️ | Need U29 length |
| Vector<int> | 0x0D | ❌ | Need implementation |
| Vector<uint> | 0x0E | ❌ | Need implementation |
| Vector<double> | 0x0F | ❌ | Need implementation |
| Vector<Object> | 0x10 | ❌ | Need implementation |
| Dictionary | 0x11 | ❌ | Need implementation |

### U29 Integer Decoder
```javascript
function decodeU29(buffer, offset) {
    let result = 0;
    let bytesRead = 0;
    
    for (let i = 0; i < 4; i++) {
        const byte = buffer.readUInt8(offset + i);
        bytesRead++;
        
        if (i < 3) {
            result = (result << 7) | (byte & 0x7F);
            if ((byte & 0x80) === 0) break;
        } else {
            result = (result << 8) | byte;
        }
    }
    
    return { value: result, bytesRead };
}
```

### Reference Tables
```javascript
class AMF3Context {
    constructor() {
        this.stringTable = [];
        this.objectTable = [];
        this.traitsTable = [];
    }
    
    getString(index) {
        return this.stringTable[index];
    }
    
    addString(str) {
        this.stringTable.push(str);
        return this.stringTable.length - 1;
    }
    
    // Similar for objects and traits...
}
```

### Files to Create/Modify
- `services/amf3-decoder.js` - New complete decoder
- `services/protocol-handler.js` - Use new decoder
- `mcp-servers/evony-rte/index.js` - Enhanced decode_packet

---

## Blueprint 3: Real-Time Game State Tracking

### Objective
Parse traffic to maintain live game state for AI context and display.

### State Schema
```javascript
const GameState = {
    player: {
        id: null,
        name: '',
        level: 0,
        prestige: 0,
        gold: 0,
        gems: 0,
        alliance: { id: null, name: '' }
    },
    cities: new Map(), // cityId -> CityState
    heroes: new Map(), // heroId -> HeroState
    marches: new Map(), // marchId -> MarchState
    resources: {
        food: 0,
        lumber: 0,
        stone: 0,
        iron: 0
    },
    lastUpdate: null
};

const CityState = {
    id: null,
    name: '',
    level: 0,
    x: 0,
    y: 0,
    buildings: [],
    troops: {},
    population: 0,
    loyalty: 0
};

const HeroState = {
    id: null,
    name: '',
    level: 0,
    attack: 0,
    defense: 0,
    politics: 0,
    intelligence: 0,
    status: 'idle',
    cityId: null
};

const MarchState = {
    id: null,
    heroId: null,
    fromCity: null,
    targetX: 0,
    targetY: 0,
    troops: {},
    type: '',
    startTime: null,
    arrivalTime: null,
    returnTime: null
};
```

### Traffic Parsers
```javascript
const trafficParsers = {
    'server.LoginResponse': (data, state) => {
        state.player.id = data.playerId;
        state.player.name = data.playerName;
        // ...
    },
    'city.getInfo': (data, state) => {
        state.cities.set(data.cityId, {
            id: data.cityId,
            name: data.cityName,
            // ...
        });
    },
    // ... parsers for each action type
};
```

### UI Components
```
┌─────────────────────────────────────────────────────────────────┐
│                     Game State Panel                             │
├─────────────────────────────────────────────────────────────────┤
│  Player: [Name] Lv.[Level]  Prestige: [Value]  Alliance: [Name] │
├─────────────────────────────────────────────────────────────────┤
│  Cities                    │  Heroes                            │
│  ┌─────────────────────┐   │  ┌─────────────────────┐           │
│  │ ○ City1 (Lv.10)     │   │  │ ○ Hero1 (Atk: 150)  │           │
│  │ ○ City2 (Lv.8)      │   │  │ ○ Hero2 (Def: 200)  │           │
│  │ ○ City3 (Lv.6)      │   │  │ ○ Hero3 (Pol: 180)  │           │
│  └─────────────────────┘   │  └─────────────────────┘           │
├─────────────────────────────────────────────────────────────────┤
│  Active Marches                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ March #1: Attack (100,200) - Arrives in 5:32               ││
│  │ March #2: Scout (150,180) - Arrives in 2:15                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Blueprint 4: Packet Injection System

### Objective
Allow sending custom packets to the game server for testing and automation.

### Security Considerations
- **Warning dialogs** before injection
- **Rate limiting** to prevent abuse
- **Logging** of all injected packets
- **Sandbox mode** for testing without server

### Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    Packet Builder UI                             │
├─────────────────────────────────────────────────────────────────┤
│  Action: [Dropdown: city.getInfo ▼]                             │
│                                                                  │
│  Parameters:                                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ cityId: [Input: 12345        ]                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Preview (AMF3 Hex):                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 00 03 00 00 00 01 00 0C 63 69 74 79 2E 67 65 74...         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [Build Packet] [Send to Server] [Save Template]                │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation
```javascript
class PacketBuilder {
    constructor(protocolDB) {
        this.protocolDB = protocolDB;
        this.encoder = new AMF3Encoder();
    }
    
    buildPacket(actionName, params) {
        const action = this.protocolDB.get(actionName);
        if (!action) throw new Error(`Unknown action: ${actionName}`);
        
        // Validate params against schema
        this.validateParams(params, action.request);
        
        // Build AMF3 packet
        return this.encoder.encode({
            command: action.commandId,
            params: params
        });
    }
    
    async sendPacket(packet, webview) {
        // Inject via webview
        return await webview.executeJavaScript(`
            window.__svonyInject(${JSON.stringify(packet.toString('hex'))});
        `);
    }
}
```

---

## Blueprint 5: Session Recording & Replay

### Objective
Record complete game sessions with full traffic and replay them for analysis.

### Session Format
```javascript
const SessionFormat = {
    version: '1.0',
    metadata: {
        id: 'uuid',
        name: 'Session Name',
        startTime: 'ISO8601',
        endTime: 'ISO8601',
        duration: 0, // seconds
        packetCount: 0,
        server: 'cc2.evony.com'
    },
    packets: [
        {
            timestamp: 0, // ms from start
            direction: 'outbound', // or 'inbound'
            action: 'city.getInfo',
            rawHex: '00 03 00...',
            decoded: { /* JSON */ }
        }
    ],
    gameState: {
        initial: { /* GameState at start */ },
        final: { /* GameState at end */ }
    }
};
```

### Replay System
```javascript
class SessionReplayer {
    constructor(session) {
        this.session = session;
        this.currentIndex = 0;
        this.speed = 1.0;
        this.paused = false;
    }
    
    async play() {
        while (this.currentIndex < this.session.packets.length) {
            if (this.paused) {
                await this.waitForResume();
                continue;
            }
            
            const packet = this.session.packets[this.currentIndex];
            const nextPacket = this.session.packets[this.currentIndex + 1];
            
            // Emit packet event
            this.emit('packet', packet);
            
            // Wait for next packet timing
            if (nextPacket) {
                const delay = (nextPacket.timestamp - packet.timestamp) / this.speed;
                await this.sleep(delay);
            }
            
            this.currentIndex++;
        }
        
        this.emit('complete');
    }
    
    pause() { this.paused = true; }
    resume() { this.paused = false; }
    setSpeed(speed) { this.speed = speed; }
    seekTo(index) { this.currentIndex = index; }
}
```

### UI Components
```
┌─────────────────────────────────────────────────────────────────┐
│                    Session Replay Controls                       │
├─────────────────────────────────────────────────────────────────┤
│  [◀◀] [◀] [▶/❚❚] [▶] [▶▶]  Speed: [1x ▼]  Time: 00:05:32      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ═══════════════●════════════════════════════════════════   ││
│  │ 0:00                                              10:45     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Packet #127 of 1,543                                           │
│  Action: army.march | Direction: Outbound | Size: 256 bytes    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Blueprint 6: Enhanced Combat Simulator

### Objective
Implement accurate combat simulation with all game mechanics.

### Combat Formula
```javascript
// Damage calculation
function calculateDamage(attacker, defender, terrain) {
    const baseDamage = attacker.attack * attacker.count;
    
    // Apply hero bonus
    const heroBonus = 1 + (attacker.heroAttack / 100);
    
    // Apply tech bonus
    const techBonus = 1 + (attacker.techBonus / 100);
    
    // Apply terrain modifier
    const terrainMod = TERRAIN_MODIFIERS[terrain] || 1.0;
    
    // Calculate defense reduction
    const defenseReduction = defender.defense / (defender.defense + 1000);
    
    // Final damage
    return baseDamage * heroBonus * techBonus * terrainMod * (1 - defenseReduction);
}

// Combat round
function simulateRound(attacker, defender, terrain) {
    const attackerDamage = calculateDamage(attacker, defender, terrain);
    const defenderDamage = calculateDamage(defender, attacker, terrain);
    
    // Apply damage to troops
    applyDamage(defender.troops, attackerDamage);
    applyDamage(attacker.troops, defenderDamage);
    
    return {
        attackerDamageDealt: attackerDamage,
        defenderDamageDealt: defenderDamage
    };
}
```

### Wall & Trap Mechanics
```javascript
const WALL_DEFENSE_BONUS = {
    1: 0.05, 2: 0.10, 3: 0.15, 4: 0.20, 5: 0.25,
    6: 0.30, 7: 0.35, 8: 0.40, 9: 0.45, 10: 0.50
};

const TRAP_DAMAGE = {
    trap: { damage: 50, targets: ['cavalry', 'cataphract'] },
    abatis: { damage: 100, targets: ['cavalry', 'cataphract'] },
    archer_tower: { damage: 75, targets: 'all' },
    rolling_logs: { damage: 60, targets: ['warrior', 'pikeman', 'swordsman'] },
    defensive_trebuchet: { damage: 150, targets: ['ballista', 'ram', 'catapult'] }
};
```

### Visualization
```
┌─────────────────────────────────────────────────────────────────┐
│                    Combat Simulation Results                     │
├─────────────────────────────────────────────────────────────────┤
│  ATTACKER                      DEFENDER                          │
│  ┌─────────────────┐           ┌─────────────────┐              │
│  │ Power: 1,250,000│           │ Power: 980,000  │              │
│  │ Hero: +45% Atk  │           │ Hero: +30% Def  │              │
│  └─────────────────┘           │ Wall: Lv.8      │              │
│                                └─────────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                    BATTLE OUTCOME: ATTACKER WINS                 │
├─────────────────────────────────────────────────────────────────┤
│  Rounds: 12                                                      │
│                                                                  │
│  Attacker Losses:              Defender Losses:                  │
│  ├─ Cavalry: 5,000 (25%)       ├─ Archer: 8,000 (80%)           │
│  ├─ Cataphract: 2,000 (20%)    ├─ Pikeman: 6,000 (60%)          │
│  └─ Archer: 3,000 (15%)        └─ Cavalry: 4,000 (100%)         │
│                                                                  │
│  Total Loss: 10,000 (18%)      Total Loss: 18,000 (75%)         │
├─────────────────────────────────────────────────────────────────┤
│  [Export Report] [Save Scenario] [Run Again]                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

| Blueprint | Priority | Complexity | Dependencies |
|-----------|----------|------------|--------------|
| 1. MCP Integration | 🔴 Critical | Medium | None |
| 2. AMF3 Decoder | 🔴 Critical | High | None |
| 3. Game State Tracking | 🟡 High | Medium | Blueprint 2 |
| 4. Packet Injection | 🟡 High | Medium | Blueprint 2 |
| 5. Session Recording | 🟢 Medium | Medium | Blueprint 2, 3 |
| 6. Combat Simulator | 🟢 Medium | Low | None |

## Estimated Development Time

| Blueprint | Hours | Notes |
|-----------|-------|-------|
| 1. MCP Integration | 8-12 | Mostly wiring existing code |
| 2. AMF3 Decoder | 12-16 | Complex binary parsing |
| 3. Game State Tracking | 6-8 | Uses existing traffic |
| 4. Packet Injection | 8-10 | Security considerations |
| 5. Session Recording | 6-8 | File I/O and playback |
| 6. Combat Simulator | 4-6 | Algorithm refinement |

**Total Estimated: 44-60 hours**
