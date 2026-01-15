# Evony Protocol Guide

## Overview

Evony uses AMF3 (Action Message Format 3) for client-server communication. This guide documents the protocol structure and common actions.

## Protocol Structure

### AMF3 Packet Format

```
┌─────────────────────────────────────────────────────────┐
│ Header (3 bytes)                                        │
├─────────────────────────────────────────────────────────┤
│ Version (1 byte) │ Header Count (1 byte) │ Msg Count    │
├─────────────────────────────────────────────────────────┤
│ Message Body (variable)                                 │
├─────────────────────────────────────────────────────────┤
│ Action Name (string) │ Command ID (int) │ Payload       │
└─────────────────────────────────────────────────────────┘
```

### AMF3 Data Types

| Type Marker | Type Name | Description |
|-------------|-----------|-------------|
| 0x00 | Undefined | Undefined value |
| 0x01 | Null | Null value |
| 0x02 | False | Boolean false |
| 0x03 | True | Boolean true |
| 0x04 | Integer | 29-bit signed integer |
| 0x05 | Double | 64-bit IEEE 754 double |
| 0x06 | String | UTF-8 string |
| 0x09 | Array | Ordered array |
| 0x0A | Object | Key-value object |
| 0x0C | ByteArray | Raw bytes |

## Protocol Categories

### Server Actions

Actions initiated by the server:

| Action | Command ID | Description |
|--------|------------|-------------|
| server.LoginResponse | 1001 | Login result |
| server.NoviceStateInfo | 1002 | New player state |
| server.ServerTime | 1003 | Server timestamp |
| server.SystemMessage | 1004 | System notification |
| server.Disconnect | 1005 | Connection closed |

### City Actions

City management actions:

| Action | Command ID | Description |
|--------|------------|-------------|
| city.getInfo | 2001 | Get city details |
| city.getCityInfo | 2002 | Full city state |
| city.modifyFlag | 2003 | Change city flag |
| city.setBuildingName | 2004 | Rename building |
| city.upgradeBuilding | 2005 | Start upgrade |
| city.cancelBuilding | 2006 | Cancel upgrade |
| city.demolishBuilding | 2007 | Remove building |
| city.createBuilding | 2008 | Build new structure |

### Hero Actions

Hero management actions:

| Action | Command ID | Description |
|--------|------------|-------------|
| hero.getHeroList | 3001 | List all heroes |
| hero.getHeroInfo | 3002 | Hero details |
| hero.promoteHero | 3003 | Upgrade hero |
| hero.fireHero | 3004 | Dismiss hero |
| hero.refreshHeroes | 3005 | Refresh inn |
| hero.recruitHero | 3006 | Hire hero |
| hero.setMayor | 3007 | Assign mayor |
| hero.levelUpHero | 3008 | Use XP items |
| hero.cultivateHero | 3009 | Cultivation |

### Army Actions

Military actions:

| Action | Command ID | Description |
|--------|------------|-------------|
| army.getArmyList | 4001 | List armies |
| army.newArmy | 4002 | Create march |
| army.callBackArmy | 4003 | Recall march |
| army.disbandArmy | 4004 | Disband troops |
| army.trainTroop | 4005 | Train troops |
| army.cancelTrain | 4006 | Cancel training |
| army.healWounded | 4007 | Heal troops |
| army.reinforceCity | 4008 | Send reinforcement |

### Quest Actions

Quest and mission actions:

| Action | Command ID | Description |
|--------|------------|-------------|
| quest.getQuestList | 5001 | List quests |
| quest.claimReward | 5002 | Claim quest reward |
| quest.claimChapterReward | 5003 | Chapter completion |
| quest.refreshDailyQuest | 5004 | Refresh dailies |

### Alliance Actions

Alliance-related actions:

| Action | Command ID | Description |
|--------|------------|-------------|
| alliance.getInfo | 6001 | Alliance details |
| alliance.getMemberList | 6002 | Member list |
| alliance.applyJoin | 6003 | Apply to join |
| alliance.acceptMember | 6004 | Accept application |
| alliance.kickMember | 6005 | Remove member |
| alliance.donate | 6006 | Donate resources |
| alliance.startRally | 6007 | Begin rally |
| alliance.joinRally | 6008 | Join rally |

### Shop Actions

Shop and marketplace actions:

| Action | Command ID | Description |
|--------|------------|-------------|
| shop.getShopList | 7001 | List shop items |
| shop.buyItem | 7002 | Purchase item |
| shop.buyResource | 7003 | Buy resources |
| shop.sellResource | 7004 | Sell resources |
| shop.useItem | 7005 | Use inventory item |

### Chat Actions

Communication actions:

| Action | Command ID | Description |
|--------|------------|-------------|
| chat.sendMessage | 8001 | Send chat |
| chat.receiveMessage | 8002 | Receive chat |
| chat.getHistory | 8003 | Chat history |
| chat.blockPlayer | 8004 | Block user |
| chat.reportPlayer | 8005 | Report user |

## Request/Response Examples

### Login Request

```json
{
  "action": "server.login",
  "commandId": 1000,
  "data": {
    "username": "player123",
    "password": "hashed_password",
    "server": "cc2.evony.com",
    "version": "1.0.0"
  }
}
```

### Login Response

```json
{
  "action": "server.LoginResponse",
  "commandId": 1001,
  "data": {
    "success": true,
    "playerId": 12345678,
    "playerName": "Player123",
    "serverId": 2,
    "serverTime": 1705276800000,
    "cities": [
      {
        "cityId": 1,
        "cityName": "Capital",
        "x": 123,
        "y": 456
      }
    ]
  }
}
```

### Get City Info Request

```json
{
  "action": "city.getCityInfo",
  "commandId": 2002,
  "data": {
    "cityId": 1
  }
}
```

### Get City Info Response

```json
{
  "action": "city.getCityInfoResponse",
  "commandId": 2002,
  "data": {
    "cityId": 1,
    "cityName": "Capital",
    "level": 25,
    "resources": {
      "food": 1000000,
      "lumber": 800000,
      "stone": 600000,
      "iron": 400000,
      "gold": 50000
    },
    "buildings": [
      {
        "buildingId": 1,
        "type": "townhall",
        "level": 25,
        "position": 0
      }
    ],
    "troops": {
      "cavalry": 50000,
      "archer": 30000,
      "cataphract": 20000
    }
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Invalid session |
| 2 | Invalid parameters |
| 3 | Insufficient resources |
| 4 | Building in progress |
| 5 | Army in march |
| 6 | Hero busy |
| 7 | Cooldown active |
| 8 | Level requirement not met |
| 9 | Alliance permission denied |
| 10 | Server maintenance |

## Packet Capture Tips

### Identifying Actions

1. Look for string type marker (0x06)
2. Read action name after length byte
3. Command ID follows as integer

### Decoding Payloads

1. Identify object type marker (0x0A)
2. Read property count
3. Decode each property name and value

### Common Patterns

- Login always first
- Heartbeat every 30 seconds
- City sync after actions
- Chat in separate channel

## Security Notes

### Session Management

- Session token in every request
- Token expires after inactivity
- Re-login required after disconnect

### Rate Limiting

- Actions have cooldowns
- Excessive requests cause temp ban
- Respect server limits
