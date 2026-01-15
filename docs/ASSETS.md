# SvonyBrowser Assets & Icon Collection

## Overview

This document catalogs all visual assets, icons, splash screens, and installer customization options available for SvonyBrowser.

---

## Icon Themes

### 1. AutoEvony Theme (Gold/Cyan - Ornate)
**Location:** `icons/autoevony/`

| File                         | Size    | Description                           |
| ---------------------------- | ------- | ------------------------------------- |
| `svony-browser-icon-256.png` | 256x256 | Gold frame with cyan "S" letter       |
| `evony-browser-icon-256.png` | 256x256 | Gold frame with green/gold "E" letter |

**Style:** Ornate medieval gold frame with gemstones, cyan/gold letters, premium look

### 2. Borg Theme (Green Circuits - Tech)
**Location:** `icons/borg/`

| File                      | Size    | Description                    |
| ------------------------- | ------- | ------------------------------ |
| `svony-borg-icon-256.png` | 256x256 | Green circuit "S" on dark grid |
| `evony-borg-icon-256.png` | 256x256 | Green circuit "E" on dark grid |

**Style:** Futuristic cyberpunk with green circuit patterns, hexagonal grid background

### 3. Default Theme
**Location:** `icons/`

| File           | Size    | Description                |
| -------------- | ------- | -------------------------- |
| `icon.ico`     | Multi   | Windows ICO with all sizes |
| `icon-16.png`  | 16x16   | Favicon size               |
| `icon-32.png`  | 32x32   | Small icon                 |
| `icon-48.png`  | 48x48   | Medium icon                |
| `icon-64.png`  | 64x64   | Large icon                 |
| `icon-128.png` | 128x128 | Extra large                |
| `icon-256.png` | 256x256 | High resolution            |
| `icon-512.png` | 512x512 | Maximum resolution         |

---

## Splash Screens

**Location:** `icons/splash/`

| File                       | Dimensions | Description                                     |
| -------------------------- | ---------- | ----------------------------------------------- |
| `svony-header-150x57.png`  | 150x57     | Header banner "Svony Browser - Powered by Borg" |
| `svony-splash-164x314.png` | 164x314    | Installer splash with progress bar              |

---

## Installer Assets

**Location:** `icons/installer/`

| File                         | Description                                   |
| ---------------------------- | --------------------------------------------- |
| `svony-installer-banner.png` | Blue banner "Svony Browser - Powered by Borg" |
| `evony-installer-banner.png` | Dark banner "Evony Browser - Powered by Borg" |
| `uninstall-icon.png`         | Red X in gold circle for uninstaller          |
| `icon-collection.png`        | Master reference showing all icon variants    |

---

## Reference Images

**Location:** `icons/`

| File                      | Description                    |
| ------------------------- | ------------------------------ |
| `reference-autoevony.png` | AutoEvony icon style reference |
| `reference-game.png`      | Game-themed icon reference     |

---

## Window Control Icons

**Location:** `icons/`

All sizes: 10px, 12px, 15px, 20px, 24px, 30px

| Icon Set | Files                  |
| -------- | ---------------------- |
| Close    | `close-w-{size}.png`   |
| Maximize | `max-w-{size}.png`     |
| Minimize | `min-w-{size}.png`     |
| Restore  | `restore-w-{size}.png` |

---

## Installer Customization

### NSIS Configuration
**File:** `installer.nsh`

The installer script supports:
- Custom welcome page text
- Icon theme selection during install
- All theme files copied to install directory
- Custom uninstall cleanup

### Adding Icon Selection to Installer

To enable user icon selection, modify `installer.nsh`:

```nsis
; Add icon theme selection page
!insertmacro MUI_PAGE_COMPONENTS

Section "AutoEvony Theme (Gold)" SEC_AUTOEVONY
  SetOutPath "$INSTDIR\icons\autoevony"
  File /r "icons\autoevony\*.*"
SectionEnd

Section "Borg Theme (Green)" SEC_BORG
  SetOutPath "$INSTDIR\icons\borg"
  File /r "icons\borg\*.*"
SectionEnd
```

---

## Splash Screen Configuration

### Enable/Disable Splash
In `package.json` build config:

```json
{
  "build": {
    "nsis": {
      "installerSidebar": "icons/splash/svony-splash-164x314.png",
      "installerHeader": "icons/splash/svony-header-150x57.png"
    }
  }
}
```

### Toggle Splash On/Off
Add to settings panel:
```javascript
store.set('showSplash', true/false);
```

---

## Icon Sizes Reference

| Use Case        | Recommended Size |
| --------------- | ---------------- |
| Taskbar         | 16x16, 32x32     |
| Desktop         | 48x48, 64x64     |
| Start Menu      | 128x128          |
| Installer       | 256x256          |
| Store/Marketing | 512x512          |

---

## Theme Selection Feature (Planned)

### Settings UI
```
┌─────────────────────────────────────┐
│ Icon Theme                          │
│ ┌─────┐  ┌─────┐  ┌─────┐         │
│ │  S  │  │  E  │  │  S  │         │
│ │Gold │  │Gold │  │Borg │  ← →    │
│ └─────┘  └─────┘  └─────┘         │
│ [ ] Show Splash Screen              │
│ Splash: [Svony ▼]                   │
└─────────────────────────────────────┘
```

### Implementation
1. Arrow buttons cycle through icon themes
2. Checkbox toggles splash screen
3. Dropdown selects splash variant
4. Changes apply on next restart

---

## File Size Summary

| Category         | Total Size |
| ---------------- | ---------- |
| AutoEvony Icons  | ~13 MB     |
| Borg Icons       | ~13 MB     |
| Installer Assets | ~17 MB     |
| Splash Screens   | ~9 MB      |
| Default Icons    | ~33 KB     |
| Window Controls  | ~3 KB      |
| **Total**        | **~52 MB** |

---

## Version History

| Version | Changes                                                           |
| ------- | ----------------------------------------------------------------- |
| 2.2.10  | Added complete icon collection, installer banners, splash screens |
| 2.2.11  | Merged assets into backup branch                                  |
| 3.0.0   | Enterprise release with all themes                                |
