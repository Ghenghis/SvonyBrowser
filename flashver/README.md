# Flash Player Assets for Svony Browser

This directory must contain the Flash Player plugin files for Flash content to work.

## ⚠️ IMPORTANT: Flash Assets Required

**Flash Player files are NOT included** due to Adobe licensing restrictions. You must obtain them from one of the sources below.

## Required Files

### Windows 64-bit (Required)
```
flashver/
├── pepflashplayer64_32_0_0_465.dll    # Pepper Flash Player 64-bit
├── manifest.json                       # Plugin manifest (auto-created)
└── swiftshader/                        # Optional - for software rendering
    ├── libEGL.dll
    └── libGLESv2.dll
```

### Windows 32-bit (If using 32-bit version)
```
flashver/
├── pepflashplayer32_32_0_0_465.dll    # Pepper Flash Player 32-bit
└── manifest.json
```

## How to Obtain Flash Player Files

### Option 1: From FlashBrowser Release (Easiest)

1. Download FlashBrowser from: https://github.com/radubirsan/FlashBrowser/releases
2. Install FlashBrowser on Windows
3. Navigate to: `C:\Users\<username>\AppData\Local\Programs\FlashBrowser\`
4. Copy these files to `flashver/`:
   - `pepflashplayer64_32_0_0_465.dll` (or similar name)
   - `swiftshader/` folder (if present)

### Option 2: From Chrome (Pre-v88)

If you have an older Chrome installation (before version 88):

1. Navigate to: `C:\Users\<username>\AppData\Local\Google\Chrome\User Data\PepperFlash\32.0.0.465\`
2. Copy `pepflashplayer64_32_0_0_465.dll` to `flashver/`

### Option 3: From System Flash Installation

If you installed Adobe Flash Player PPAPI:

1. Navigate to: `C:\Windows\System32\Macromed\Flash\`
2. Copy `pepflashplayer64_32_0_0_465.dll` to `flashver/`

### Option 4: From Internet Archive

1. Visit: https://archive.org/details/flashplayerarchive
2. Download the PPAPI version for Windows
3. Extract and copy the DLL to `flashver/`

## SwiftShader (Optional but Recommended)

SwiftShader provides software rendering when hardware acceleration fails.

### Where to get SwiftShader:

**From Chrome:**
```
C:\Program Files\Google\Chrome\Application\<version>\swiftshader\
```

**From Electron (after npm install):**
```
node_modules\electron\dist\swiftshader\
```

Copy the entire `swiftshader/` folder to `flashver/swiftshader/`

## manifest.json

The application will auto-create this file, but you can manually create it:

```json
{
  "name": "Shockwave Flash",
  "description": "Shockwave Flash 32.0 r0",
  "version": "32.0.0.465",
  "x-ppapi-arch": "x64",
  "x-ppapi-file": "pepflashplayer64_32_0_0_465.dll",
  "mime_types": [
    {
      "mime_type": "application/x-shockwave-flash",
      "description": "Shockwave Flash",
      "file_extensions": [".swf"]
    }
  ]
}
```

**Note:** Update `x-ppapi-file` to match your actual DLL filename.

## Verifying Installation

After copying the files, your `flashver/` directory should look like:

```
flashver/
├── pepflashplayer64_32_0_0_465.dll  (or similar name)
├── manifest.json
├── README.md
└── swiftshader/
    ├── libEGL.dll
    └── libGLESv2.dll
```

## Troubleshooting

### Flash content shows blank or "Plugin not found"
- Verify the DLL file exists in `flashver/`
- Check the filename matches what's in `manifest.json`
- Restart the application

### Black screen or rendering issues
- Add SwiftShader files
- Try disabling hardware acceleration in Settings

### "Flash blocked" or security errors
- The application already enables Flash by default
- Check that you're using HTTP (not HTTPS) for Evony

### Wrong architecture error
- 64-bit Windows: Use `pepflashplayer64_*.dll`
- 32-bit Windows: Use `pepflashplayer32_*.dll`

## SWF Files (Optional)

You can also place Evony SWF files here for offline/direct loading:

- `AutoEvony.swf` - For the left panel (Bot)
- `EvonyClient.swf` - For the right panel (Game)

These can be captured using the Traffic Viewer or browser developer tools.

## Legal Notice

Adobe Flash Player is proprietary software. Adobe ended Flash support on December 31, 2020. These files are not redistributable. Users must obtain them from legitimate sources. Use at your own risk.

## Support

If you need help:
1. Check that all required files are present
2. Verify file permissions (right-click → Properties → Security)
3. Try running the application as Administrator
4. Check the application logs (Help → View Logs)
