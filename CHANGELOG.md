# Changelog

All notable changes to Svony Browser will be documented in this file.

## [2.2.7] - 2026-01-15 - SWF Asset Fix & Playwright Commands

### Fixed
- **SWF Asset Loading**: Added indSWFFile() function to properly locate SWF files in both packaged and development modes
- **Panel Manager**: SWF paths now fallback to auto-detected paths when not configured
- **get-swf-path Handler**: Returns auto-detected SWF path when store value is empty

### New Features

#### Playwright Chatbot Commands
- /navigate <url> - Navigate to URL via Playwright
- /screenshot - Take screenshot of current page
- /login <email> <password> - Auto-login to Evony
- /click <selector> - Click element on page
- /type <selector> <text> - Type text into input field

### Technical Details
- Added indSWFFile() function similar to indFlashPlugin() for consistent asset resolution
- Chatbot now has 6 new Playwright-powered commands
- All Playwright commands lazy-load the service for performance

---
## [2.2.1] - 2026-01-15 - Full CLI Access & Evony Knowledge Base

### New Features

#### CLI Access Service
- **Full command-line access** from chatbot when LM Studio unavailable
- **Execute shell commands** with streaming output support
- **Run scripts** (.js, .py, .ps1, .bat, .sh)
- **File operations** - read, write, list directories
- **System info** - platform, memory, CPU details
- **Process management** - kill running commands
- **Security controls** - blocked command patterns

#### Evony Knowledge Base
- **Comprehensive game knowledge** in JSON format
- **Troop data** - all types, tiers, stats
- **Resource info** - buildings, production
- **Protocol actions** - categorized command reference
- **Combat formulas** - attack, defense, march speed
- **Automation templates** - gathering, training, attacking
- **Fine-tuning prompts** - system prompt and examples
- **Server list** - Americas, Europe, Asia regions

### Technical Details

#### New Files
- `services/cli-access.js` - Full CLI access service (400+ lines)
- `knowledge-base/evony-knowledge.json` - Evony fine-tuning data

#### New IPC Handlers (11 handlers)
- `cli-execute` - Execute command
- `cli-execute-streaming` - Execute with streaming output
- `cli-run-script` - Run script file
- `cli-list-dir` - List directory contents
- `cli-read-file` - Read file contents
- `cli-write-file` - Write file contents
- `cli-get-system-info` - Get system information
- `cli-get-history` - Get command history
- `cli-get-status` - Get CLI service status
- `cli-kill-process` - Kill running process
- `cli-set-working-dir` - Set working directory

---

## [2.2.0] - 2026-01-15 - Enterprise Grade Release

### Highlights
This release focuses on enterprise-grade stability, comprehensive error handling, and Playwright integration for enhanced automation capabilities.

### New Features

#### Hybrid Mode (Playwright Integration)
- **Hybrid Mode Toggle**: Each panel now has a "Hybrid" button that activates Playwright-powered automation
- **Enhanced Automation**: Use Playwright for web scraping, form filling, and automated testing
- **Seamless Integration**: Hybrid mode works alongside standard webview for maximum flexibility
- **Visual Indicator**: Animated badge shows when Hybrid mode is active

#### Error System with Self-Healing
- **ErrorTracker Service**: Comprehensive error tracking with file/line numbers and stack traces
- **ErrorHelper Service**: Intelligent solution suggestions based on error patterns
- **SelfHealer Service**: Automatic recovery from common issues
- **12 IPC Handlers**: Full renderer-to-main process error communication
- **Error Statistics**: Track error frequency, categories, and resolution rates

#### UI Enhancements
- **Hybrid Mode Indicator**: Animated gradient badge showing Playwright status
- **Error Panel Styling**: Professional error display with severity indicators
- **Self-Healing Animation**: Visual feedback during automatic recovery
- **Consistent Styling**: Unified design language across all components

### Improvements

#### Build System
- **Fixed GH_TOKEN Issue**: Resolved "GitHub Personal Access Token is not set" build error
- **Removed ARM64 Build**: Temporarily disabled due to Electron 9.x compatibility issues
- **Stable CI/CD**: All builds now pass consistently without errors
- **Proper Artifacts**: Both portable and installer versions for x64 and x86

#### Error Handling
- **Uncaught Exception Handler**: Automatically tracks and logs unhandled errors
- **Unhandled Rejection Handler**: Captures Promise rejections with context
- **Service Error Forwarding**: Errors from services forwarded to renderer for display
- **Graceful Degradation**: Services continue operating even when errors occur

#### Playwright Service
- **Panel Integration**: Each panel can independently use Playwright
- **Form Automation**: Automated login and form filling capabilities
- **Screenshot Capture**: Take screenshots via Playwright for debugging
- **Request Interception**: Monitor and modify network requests

### Technical Details

#### New Files
- `themes/hybrid-error-styles.css`: Styles for hybrid mode and error UI
- `services/error-tracker.js`: Error tracking and statistics
- `services/error-helper.js`: Solution suggestion engine
- `services/self-healer.js`: Automatic recovery system

#### Modified Files
- `index.js`: Added error system IPC handlers and service initialization
- `renderer.js`: Added Hybrid mode activation/deactivation functions
- `browser.html`: Added hybrid-error-styles.css import

### Downloads

| Platform    | Type      | File                                 |
| ----------- | --------- | ------------------------------------ |
| Windows x64 | Portable  | SvonyBrowser-Portable-2.2.0-x64.exe  |
| Windows x64 | Installer | SvonyBrowser-Setup-2.2.0-x64.exe     |
| Windows x86 | Portable  | SvonyBrowser-Portable-2.2.0-ia32.exe |
| Windows x86 | Installer | SvonyBrowser-Setup-2.2.0-ia32.exe    |

### Requirements
- Windows 7/10/11 (32-bit or 64-bit)
- Flash Player plugin (included in flashver/ directory)
- LM Studio (optional, for AI features)

### Known Issues
- ARM64 builds temporarily unavailable due to Electron 9.x compatibility
- Playwright requires additional browser binaries on first run

---

## [2.1.3] - 2026-01-15

### Added
- Error system services wired to main process
- 12 IPC handlers for error tracking, analysis, and self-healing
- Uncaught exception and unhandled rejection auto-tracking

---

## [2.1.2] - 2026-01-15

### Fixed
- Removed ARM64 build (Electron 9.x compatibility issue)
- All builds now complete successfully

---

## [2.1.1] - 2026-01-15

### Fixed
- Added GH_TOKEN to build workflow
- Removed publish config from package.json

---

## [2.1.0] - 2026-01-15

### Added
- Enhanced error system with file/line numbers
- ErrorTracker, ErrorHelper, and SelfHealer services
- Improved debugging capabilities

---

## [2.0.x] - Previous Releases

See GitHub releases for detailed history of earlier versions.

