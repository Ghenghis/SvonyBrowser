# SvonyBrowser Share Mode Guide

## Overview

Share Mode is a revolutionary feature that allows **both panels to use the exact same webview instance**, creating a **single connection** to Evony servers. This completely eliminates the "another computer has logged in" error by ensuring only **ONE TCP connection** exists between your browser and Evony.

## 🎯 Problem Solved

### The Issue
- **Traditional dual-panel**: Each panel creates its own webview → 2 connections
- **Evony restriction**: Only 1 connection per account allowed
- **Result**: "Another computer has logged in" kickout

### The Solution
- **Share Mode**: Both panels share **ONE webview instance** → 1 connection
- **Result**: No kickout, seamless dual-panel experience

## 🔧 How Share Mode Works

### Technical Implementation

1. **Source Webview Detection**
   - System identifies which panel has the active connection
   - Checks if webview is ready (not `about:blank` or loading)

2. **Webview Migration**
   - Source webview is moved to a **shared container** covering entire screen
   - Target panel's webview is hidden
   - Both panels now reference the **same webview instance**

3. **Event Forwarding**
   - Clicks on cloned panel are forwarded to the shared webview
   - Mouse coordinates calculated and mapped correctly
   - All interactions affect the same game session

4. **Connection Management**
   - **Only ONE TCP connection** to Evony servers
   - Shared session partition (`persist:evony-shared`)
   - Single authentication token

### Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐
│   Left Panel    │    │   Right Panel   │
│                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Clone Overlay│ │    │ │ Source      │ │
│ │ (Click Forward)│◄┼────┼─►│ Webview     │ │
│ └─────────────┘ │    │ │ (Active)    │ │
└─────────────────┘    │ └─────────────┘ │
                       │                 │
                ┌────┴─────┐           │
                │ Shared  │◄──────────┘
                │ Container│
                │ (Full    │
                │  Screen) │
                └──────────┘
```

## 🚀 How to Use Share Mode

### Step-by-Step Instructions

#### For SWF Mode (AutoEvony)
1. **Load SWF** on one panel (right panel recommended)
2. **Click "🔗 Share"** on the other panel (left)
3. **Instant sharing** - SWF loads immediately, no retry needed
4. **Both panels** now show the same AutoEvony instance

#### For Web Mode (Evony.com)
1. **Login normally** on one panel (right panel recommended)
2. **Wait for complete login** - page must fully load
3. **Click "🔗 Share"** on the other panel (left)
4. **Two scenarios:**
   - ✅ **Ready**: Automatic sharing activates
   - ⏳ **Loading**: Shows "🔄 Retry Share" button
5. **If retry appears**: Click when login is complete
6. **Success**: Both panels share the same web connection

### Button Locations

| Panel           | Button    | Action                        |
| --------------- | --------- | ----------------------------- |
| **Left Panel**  | `🔗 Share` | Shares Right Panel Connection |
| **Right Panel** | `🔗 Share` | Shares Left Panel Connection  |

### Visual Indicators

#### Share Button States
- **Inactive**: Gray button with "🔗 Share"
- **Active**: Green pulsing button with "🔗 Share"
- **Hover**: Green lift effect

#### Status Indicators
- **Header Badge**: "🔗 SHARED (RIGHT/LEFT)"
- **Status Bar**: "Sync: SHARED" (green)
- **Overlay**: "🔗 SHARED CONNECTION" message

#### Retry Button (Web Mode Only)
- **Orange "🔄 Retry Share"** appears when webview is loading
- **Click to retry** when login completes
- **Automatic hide** when sharing succeeds

## 🎮 User Experience

### What You See

#### Normal Mode
```
┌─────────────┐ ┌─────────────┐
│   Left Panel │ │   Right Panel│
│   Web/SWF    │ │   Web/SWF    │
│   Independent│ │   Independent│
└─────────────┘ └─────────────┘
2 Connections → Kickout Risk
```

#### Share Mode
```
┌─────────────┐ ┌─────────────┐
│   Left Panel │ │   Right Panel│
│   🔗 SHARED  │ │   Source     │
│   (Overlay)  │ │   Webview    │
└─────────────┘ └─────────────┘
1 Connection → No Kickout!
```

### Interaction Flow

1. **Login on Source Panel** → Normal Evony experience
2. **Activate Share Mode** → Target panel shows overlay
3. **Click Anywhere** → Events forwarded to source webview
4. **Same Game Session** → Both panels affect same account

## 🔧 Technical Details

### Webview Management

#### Source Webview (Active Connection)
```javascript
// Moved to shared container
sourceWebview.style.position = 'absolute';
sourceWebview.style.top = '0';
sourceWebview.style.left = '0';
sourceWebview.style.width = '100%';
sourceWebview.style.height = '100%';
sourceWebview.style.pointerEvents = 'auto';
```

#### Target Webview (Hidden)
```javascript
// Hidden during share mode
targetWebview.style.display = 'none';
```

#### Event Forwarding
```javascript
// Forward clicks to shared webview
sourceWebview.sendInputEvent({
    type: 'mouseDown',
    x: relativeX,
    y: relativeY,
    button: 'left',
    clickCount: 1
});
```

### Session Management

#### Shared Partition
- **Partition**: `persist:evony-shared`
- **Cookies**: Shared between panels
- **Session Tokens**: Single authentication
- **Login State**: Maintained across panels

#### Connection Count
- **Traditional**: 2 webviews = 2 TCP connections
- **Share Mode**: 1 webview = 1 TCP connection
- **Result**: No "another computer logged in"

### Retry Logic (Web Mode)

#### Readiness Check
```javascript
const sourceUrl = sourceWebview.src || sourceWebview.getURL();
if (sourceUrl && sourceUrl !== 'about:blank' && !sourceUrl.includes('loading')) {
    // Ready for sharing
} else {
    // Show retry button
}
```

#### Event Listeners
```javascript
sourceWebview.addEventListener('did-navigate', () => {
    // Check if ready for sharing
});

sourceWebview.addEventListener('did-finish-load', () => {
    // Webview fully loaded
});
```

## 🎯 Benefits

### For Users
- **No kickout**: Single connection prevents logout
- **Dual interaction**: Both panels usable
- **Seamless experience**: No login interruptions
- **Visual feedback**: Clear status indicators

### For Developers
- **Clean architecture**: Single webview instance
- **Event forwarding**: Proper interaction handling
- **State management**: Reliable session sharing
- **Error handling**: Graceful retry mechanisms

## 🔍 Troubleshooting

### Common Issues

#### "Webview not ready" Message
**Cause**: Web page still loading when Share clicked
**Solution**: Wait for full login, then click "🔄 Retry Share"

#### Clicks not working
**Cause**: Webview not properly positioned in shared container
**Solution**: Deactivate and reactivate Share mode

#### Share button not responding
**Cause**: Source panel not loaded with valid content
**Solution**: Ensure source panel has loaded Evony/SWF first

### Debug Information

#### Console Logs
```javascript
[Clone] Source webview URL: http://www.evony.com
[Clone] Webview moved to shared container
[Clone] Left panel now sharing webview with right panel
```

#### Status Checks
- **Share Button**: Should be green and pulsing when active
- **Status Bar**: Should show "Sync: SHARED"
- **Header Badge**: Should show "🔗 SHARED (SOURCE)"

## 🚀 Advanced Usage

### Best Practices

1. **Use Right Panel as Source**: Recommended for consistency
2. **Wait for Full Login**: Especially important for Web mode
3. **Check Status Indicators**: Verify Share mode is active
4. **Use Retry Button**: Don't force sharing during loading

### Performance Considerations

- **Single Webview**: Reduced memory usage
- **Event Forwarding**: Minimal overhead
- **Shared Session**: Faster authentication
- **No Duplicate Loading**: Better resource utilization

## 📚 Related Features

### Session Sync Service
- **File**: `services/session-sync.js`
- **Purpose**: Manages shared session data
- **Integration**: Works with Share mode

### Panel Modes
- **Web Mode**: Standard browser
- **SWF Mode**: AutoEvony client
- **Hybrid Mode**: Playwright automation
- **Share Mode**: Single connection (this feature)

### UI Components
- **Share Button**: Green toggle with chain icon
- **Status Indicators**: Visual feedback
- **Overlay Messages**: User guidance
- **Retry Button**: Manual retry option

## 🎉 Conclusion

Share Mode represents a **breakthrough in dual-panel Evony browsing** by solving the fundamental connection limitation. By sharing a single webview instance between both panels, users can:

- ✅ **Avoid kickouts** completely
- ✅ **Use both panels** simultaneously  
- ✅ **Maintain single login** state
- ✅ **Enjoy seamless interaction** with the game

The intelligent retry system and visual feedback make Share Mode **user-friendly and reliable**, while the underlying technical implementation ensures **robust single-connection behavior**.

**Share Mode transforms the dual-panel experience from a limitation into a powerful feature!** 🚀✨
