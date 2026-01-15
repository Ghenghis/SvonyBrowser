# Flash Player and SWF Files Directory

This directory contains Flash Player plugins and SWF game files.

## Flash Player Plugins

Place the appropriate Flash Player plugin for your platform:

### Windows
- `pepflashplayer32.dll` - For 32-bit Windows
- `pepflashplayer64.dll` - For 64-bit Windows

### Linux
- `libpepflashplayer.so` - Already included

### macOS
- `PepperFlashPlayer.plugin` - Already included

## SWF Game Files

Place your Evony SWF files here:

### For Left Panel (Bot/AutoEvony)
- `AutoEvony.swf` - AutoEvony bot SWF file

### For Right Panel (Game Client)
- `EvonyClient.swf` - Evony game client SWF file

## Getting Flash Player

Flash Player PPAPI plugins can be obtained from:
1. Adobe's archived Flash Player downloads
2. Existing installations of Flash-enabled browsers

## Getting SWF Files

SWF files can be captured from:
1. Network traffic when loading the game in a browser
2. Browser cache after playing the game
3. Using the Traffic Viewer in Svony Browser to capture and save SWF files

## File Locations

The application looks for files in this order:
1. Custom path set in Settings
2. Default location in this `flashver/` directory

## Notes

- Flash Player must match your system architecture (32-bit or 64-bit)
- SWF files must be compatible with your Flash Player version
- The game uses HTTP (not HTTPS) for Flash content
