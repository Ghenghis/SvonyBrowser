# SvonyBridge - Fiddler Integration

## Overview

SvonyBridge is a Fiddler CustomRules script that captures Evony game traffic and forwards it to Svony Browser for real-time analysis.

## Prerequisites

- **Fiddler Classic** or **Fiddler Everywhere** installed
- **Svony Browser** running with FiddlerBridge service active
- **.NET Framework** (usually pre-installed on Windows)

## Installation

### Step 1: Open Fiddler CustomRules

1. Launch Fiddler
2. Go to **Rules** → **Customize Rules** (or press `Ctrl+R`)
3. This opens the CustomRules.js file in the Fiddler Script Editor

### Step 2: Add SvonyBridge Code

1. Open `SvonyBridge.js` from this directory
2. Copy the entire contents
3. Paste into the CustomRules.js file, inside the `Handlers` class
4. Save the file (`Ctrl+S`)

### Step 3: Restart Fiddler

1. Close Fiddler completely
2. Reopen Fiddler
3. Check the Log tab for "[SvonyBridge] Ready" message

## Configuration

### Evony Server Patterns

The script captures traffic from these domains by default:

- `evony.com`
- `cc2.evony.com` through `cc5.evony.com`
- `evonycdn.com`
- `evonygame.com`

To add more patterns, edit the `evonyPatterns` array in the script.

### Named Pipe Settings

- **Pipe Name**: `SvonyFiddlerBridge`
- **Direction**: Write-only (Fiddler → Svony Browser)
- **Reconnect Attempts**: 5 (with 2-second delay)

## Usage

### Automatic Capture

Once installed, SvonyBridge automatically:

1. Detects Evony game traffic
2. Highlights captured sessions in gold
3. Forwards packets to Svony Browser

### Manual Controls

Access via Fiddler's **Rules** menu:

- **Svony Bridge: Reconnect** - Manually reconnect to Svony Browser
- **Svony Bridge: Show Stats** - Display capture statistics in Log

### Viewing Captured Traffic

In Fiddler:
- Evony sessions appear with gold highlighting
- Bold text indicates captured sessions
- Check the Log tab for bridge status

In Svony Browser:
- Open the Traffic Viewer tab
- Packets appear in real-time
- Use filters to find specific actions

## Troubleshooting

### "Connection timeout" Error

**Cause**: Svony Browser is not running or FiddlerBridge service is not started.

**Solution**:
1. Start Svony Browser first
2. Wait for "FiddlerBridge connected" in status bar
3. Then start Fiddler

### No Packets Captured

**Cause**: Fiddler is not set as system proxy.

**Solution**:
1. In Fiddler, go to **Tools** → **Options** → **Connections**
2. Ensure "Act as system proxy on startup" is checked
3. Restart Fiddler

### AMF Actions Show as "unknown"

**Cause**: Packet format not recognized.

**Solution**:
- This is normal for some packets
- The full packet data is still captured
- Svony Browser's decoder will attempt full parsing

### Reconnection Issues

**Cause**: Pipe connection was lost.

**Solution**:
1. Use **Rules** → **Svony Bridge: Reconnect**
2. Or restart both Fiddler and Svony Browser

## Data Format

### Request Message

```json
{
  "Type": "request",
  "SessionId": "12345",
  "SequenceNumber": 1,
  "Timestamp": "2026-01-14T12:00:00.000Z",
  "Data": {
    "url": "https://cc2.evony.com/gateway.php",
    "method": "POST",
    "host": "cc2.evony.com",
    "path": "/gateway.php",
    "action": "city.getInfo",
    "contentType": "application/x-amf",
    "contentLength": 256,
    "body": "base64_encoded_data",
    "headers": {}
  }
}
```

### Response Message

```json
{
  "Type": "response",
  "SessionId": "12345",
  "Timestamp": "2026-01-14T12:00:00.100Z",
  "Data": {
    "url": "https://cc2.evony.com/gateway.php",
    "statusCode": 200,
    "statusText": "OK",
    "action": "city.getInfoResponse",
    "contentType": "application/x-amf",
    "contentLength": 1024,
    "body": "base64_encoded_data",
    "timing": {
      "clientConnected": "...",
      "serverGotRequest": "...",
      "serverBeginResponse": "...",
      "serverDoneResponse": "..."
    }
  }
}
```

## Security Notes

- Traffic data is transmitted locally via Named Pipes
- No data is sent over the network
- Session cookies and auth headers are captured (for analysis only)
- Do not share captured traffic files publicly

## Support

For issues or feature requests, please open an issue on the Svony Browser GitHub repository.
