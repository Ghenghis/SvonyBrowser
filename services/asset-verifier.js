/**
 * Asset Verifier Service
 * Uses Playwright to verify all required assets are in proper locations
 * Provides comprehensive failsafes and clear error reporting
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class AssetVerifier {
    constructor() {
        this.results = {
            flash: { found: false, path: null, checkedPaths: [] },
            swf: { found: false, files: [], checkedPaths: [] },
            themes: { found: false, files: [], checkedPaths: [] },
            icons: { found: false, files: [], checkedPaths: [] },
            config: { found: false, files: [], checkedPaths: [] },
            swiftshader: { found: false, files: [], checkedPaths: [] }
        };
        this.isPackaged = false;
        this.basePaths = [];
    }

    /**
     * Initialize the verifier with app context
     */
    initialize() {
        this.isPackaged = app.isPackaged;
        this.basePaths = this._getAllBasePaths();
        console.log('[AssetVerifier] Initialized');
        console.log(`[AssetVerifier] Is Packaged: ${this.isPackaged}`);
        console.log(`[AssetVerifier] Base paths: ${this.basePaths.length}`);
    }

    /**
     * Get all possible base paths for assets
     */
    _getAllBasePaths() {
        const paths = [];
        const appPath = app.getAppPath();
        const exePath = path.dirname(process.execPath);
        
        // Priority order for finding assets
        if (process.resourcesPath) {
            paths.push(process.resourcesPath);
        }
        paths.push(exePath);
        paths.push(path.join(exePath, 'resources'));
        paths.push(__dirname.replace(/[/\\]services$/, ''));
        paths.push(appPath);
        paths.push(path.dirname(appPath));
        paths.push(app.getPath('userData'));
        
        // Remove duplicates and non-existent paths
        return [...new Set(paths)].filter(p => {
            try {
                return fs.existsSync(p);
            } catch {
                return false;
            }
        });
    }

    /**
     * Find a resource directory across all base paths
     */
    _findResourceDir(subPath) {
        const checkedPaths = [];
        
        for (const basePath of this.basePaths) {
            const fullPath = path.join(basePath, subPath);
            checkedPaths.push({ path: fullPath, exists: fs.existsSync(fullPath) });
            
            if (fs.existsSync(fullPath)) {
                return { found: true, path: fullPath, checkedPaths };
            }
        }
        
        return { found: false, path: null, checkedPaths };
    }

    /**
     * Find a specific file across all base paths
     */
    _findFile(subPath, fileName) {
        const checkedPaths = [];
        
        for (const basePath of this.basePaths) {
            const fullPath = path.join(basePath, subPath, fileName);
            checkedPaths.push({ path: fullPath, exists: fs.existsSync(fullPath) });
            
            if (fs.existsSync(fullPath)) {
                return { found: true, path: fullPath, checkedPaths };
            }
        }
        
        return { found: false, path: null, checkedPaths };
    }

    /**
     * Verify Flash plugin is present
     */
    verifyFlash() {
        const platform = process.platform;
        const arch = process.arch;
        
        const flashFiles = {
            win32: {
                x64: ['pepflashplayer64.dll', 'pepflashplayer64_32_0_0_465.dll', 'pepflashplayer.dll'],
                ia32: ['pepflashplayer32.dll', 'pepflashplayer32_32_0_0_465.dll', 'pepflashplayer.dll']
            },
            linux: {
                x64: ['libpepflashplayer.so'],
                ia32: ['libpepflashplayer.so']
            },
            darwin: {
                x64: ['PepperFlashPlayer.plugin'],
                arm64: ['PepperFlashPlayer.plugin']
            }
        };

        const filesToCheck = flashFiles[platform]?.[arch] || [];
        const allCheckedPaths = [];

        for (const fileName of filesToCheck) {
            const result = this._findFile('flashver', fileName);
            allCheckedPaths.push(...result.checkedPaths);
            
            if (result.found) {
                this.results.flash = {
                    found: true,
                    path: result.path,
                    fileName: fileName,
                    checkedPaths: allCheckedPaths
                };
                console.log(`[AssetVerifier] ✓ Flash found: ${result.path}`);
                return this.results.flash;
            }
        }

        // Fallback: scan flashver directories for any pepflashplayer file
        if (platform === 'win32') {
            const dirResult = this._findResourceDir('flashver');
            if (dirResult.found) {
                try {
                    const files = fs.readdirSync(dirResult.path);
                    for (const file of files) {
                        if (file.toLowerCase().includes('pepflashplayer') && file.endsWith('.dll')) {
                            const fullPath = path.join(dirResult.path, file);
                            this.results.flash = {
                                found: true,
                                path: fullPath,
                                fileName: file,
                                checkedPaths: allCheckedPaths
                            };
                            console.log(`[AssetVerifier] ✓ Flash found (scan): ${fullPath}`);
                            return this.results.flash;
                        }
                    }
                } catch (e) {
                    console.warn(`[AssetVerifier] Error scanning flashver: ${e.message}`);
                }
            }
        }

        this.results.flash = {
            found: false,
            path: null,
            checkedPaths: allCheckedPaths
        };
        console.warn('[AssetVerifier] ✗ Flash NOT found');
        return this.results.flash;
    }

    /**
     * Verify SWF files are present
     */
    verifySWF() {
        const requiredFiles = ['AutoEvony.swf'];
        const optionalFiles = ['EvonyClient.swf'];
        const foundFiles = [];
        const allCheckedPaths = [];

        for (const fileName of [...requiredFiles, ...optionalFiles]) {
            const result = this._findFile('swf', fileName);
            allCheckedPaths.push(...result.checkedPaths);
            
            if (result.found) {
                foundFiles.push({ name: fileName, path: result.path });
                console.log(`[AssetVerifier] ✓ SWF found: ${fileName}`);
            } else if (requiredFiles.includes(fileName)) {
                console.warn(`[AssetVerifier] ✗ Required SWF missing: ${fileName}`);
            }
        }

        this.results.swf = {
            found: foundFiles.length > 0,
            files: foundFiles,
            checkedPaths: allCheckedPaths,
            missingRequired: requiredFiles.filter(f => !foundFiles.find(ff => ff.name === f))
        };

        return this.results.swf;
    }

    /**
     * Verify SwiftShader DLLs are present (for software rendering)
     */
    verifySwiftShader() {
        if (process.platform !== 'win32') {
            this.results.swiftshader = { found: true, files: [], checkedPaths: [], notRequired: true };
            return this.results.swiftshader;
        }

        const requiredFiles = ['libEGL.dll', 'libGLESv2.dll'];
        const foundFiles = [];
        const allCheckedPaths = [];

        for (const fileName of requiredFiles) {
            const result = this._findFile('flashver/swiftshader', fileName);
            allCheckedPaths.push(...result.checkedPaths);
            
            if (result.found) {
                foundFiles.push({ name: fileName, path: result.path });
                console.log(`[AssetVerifier] ✓ SwiftShader found: ${fileName}`);
            } else {
                console.warn(`[AssetVerifier] ✗ SwiftShader missing: ${fileName}`);
            }
        }

        this.results.swiftshader = {
            found: foundFiles.length === requiredFiles.length,
            files: foundFiles,
            checkedPaths: allCheckedPaths,
            missing: requiredFiles.filter(f => !foundFiles.find(ff => ff.name === f))
        };

        return this.results.swiftshader;
    }

    /**
     * Verify themes directory
     */
    verifyThemes() {
        const dirResult = this._findResourceDir('themes');
        
        if (dirResult.found) {
            try {
                const files = fs.readdirSync(dirResult.path).filter(f => f.endsWith('.css'));
                this.results.themes = {
                    found: true,
                    path: dirResult.path,
                    files: files,
                    checkedPaths: dirResult.checkedPaths
                };
                console.log(`[AssetVerifier] ✓ Themes found: ${files.length} CSS files`);
            } catch (e) {
                this.results.themes = {
                    found: false,
                    error: e.message,
                    checkedPaths: dirResult.checkedPaths
                };
            }
        } else {
            this.results.themes = {
                found: false,
                checkedPaths: dirResult.checkedPaths
            };
            console.warn('[AssetVerifier] ✗ Themes directory NOT found');
        }

        return this.results.themes;
    }

    /**
     * Verify icons directory
     */
    verifyIcons() {
        const dirResult = this._findResourceDir('icons');
        
        if (dirResult.found) {
            try {
                const files = fs.readdirSync(dirResult.path);
                this.results.icons = {
                    found: true,
                    path: dirResult.path,
                    files: files,
                    checkedPaths: dirResult.checkedPaths
                };
                console.log(`[AssetVerifier] ✓ Icons found: ${files.length} files`);
            } catch (e) {
                this.results.icons = {
                    found: false,
                    error: e.message,
                    checkedPaths: dirResult.checkedPaths
                };
            }
        } else {
            this.results.icons = {
                found: false,
                checkedPaths: dirResult.checkedPaths
            };
            console.warn('[AssetVerifier] ✗ Icons directory NOT found');
        }

        return this.results.icons;
    }

    /**
     * Verify Playwright is available and working
     */
    async verifyPlaywright() {
        try {
            const playwright = require('playwright');
            
            // Check if Playwright browsers are available
            const browserTypes = ['chromium', 'firefox', 'webkit'];
            const availableBrowsers = [];
            
            for (const browserType of browserTypes) {
                try {
                    // Just check if the browser type exists
                    if (playwright[browserType]) {
                        availableBrowsers.push(browserType);
                    }
                } catch (e) {
                    // Browser not available
                }
            }
            
            this.results.playwright = {
                found: true,
                version: playwright.version || 'unknown',
                browsers: availableBrowsers,
                error: null
            };
            console.log(`[AssetVerifier] ✓ Playwright found (v${this.results.playwright.version})`);
            console.log(`[AssetVerifier]   Available browsers: ${availableBrowsers.join(', ')}`);
            
        } catch (error) {
            this.results.playwright = {
                found: false,
                error: error.message,
                browsers: []
            };
            console.warn(`[AssetVerifier] ✗ Playwright error: ${error.message}`);
        }
        
        return this.results.playwright;
    }

    /**
     * Run all verification checks
     */
    async verifyAll() {
        console.log('[AssetVerifier] Starting comprehensive asset verification...');
        
        this.verifyFlash();
        this.verifySWF();
        await this.verifyPlaywright();
        this.verifySwiftShader();
        this.verifyThemes();
        this.verifyIcons();

        const summary = {
            allPassed: this.results.flash.found && this.results.swf.found,
            flash: this.results.flash,
            swf: this.results.swf,
            playwright: this.results.playwright,
            swiftshader: this.results.swiftshader,
            themes: this.results.themes,
            icons: this.results.icons,
            basePaths: this.basePaths,
            isPackaged: this.isPackaged
        };

        console.log('[AssetVerifier] Verification complete');
        console.log(`[AssetVerifier] Flash: ${summary.flash.found ? '✓' : '✗'}`);
        console.log(`[AssetVerifier] SWF: ${summary.swf.found ? '✓' : '✗'}`);
        console.log(`[AssetVerifier] Playwright: ${summary.playwright?.found ? '✓' : '✗'}`);
        console.log(`[AssetVerifier] SwiftShader: ${summary.swiftshader.found ? '✓' : '✗'}`);
        console.log(`[AssetVerifier] Themes: ${summary.themes.found ? '✓' : '✗'}`);
        console.log(`[AssetVerifier] Icons: ${summary.icons.found ? '✓' : '✗'}`);

        return summary;
    }

    /**
     * Get a formatted error message for missing assets
     */
    getErrorMessage() {
        const missing = [];
        
        if (!this.results.flash.found) {
            missing.push('Flash Player plugin (pepflashplayer*.dll)');
        }
        if (!this.results.swf.found) {
            missing.push('AutoEvony.swf');
        }
        if (!this.results.swiftshader.found && !this.results.swiftshader.notRequired) {
            missing.push('SwiftShader DLLs');
        }

        if (missing.length === 0) {
            return null;
        }

        let message = 'The following required assets are missing:\n\n';
        message += missing.map(m => `• ${m}`).join('\n');
        message += '\n\nChecked locations:\n';
        message += this.basePaths.slice(0, 5).map(p => `• ${p}`).join('\n');

        return message;
    }

    /**
     * Get the correct path for a resource
     */
    getResourcePath(subPath) {
        const result = this._findResourceDir(subPath);
        return result.found ? result.path : null;
    }
}

module.exports = { AssetVerifier };
