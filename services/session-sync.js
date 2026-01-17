/**
 * Session Sync Service - v1.0.0
 * Enables Web + AutoEvony dual panel to share the same account session
 * 
 * KEY INSIGHT: Evony uses sessionToken for authentication after initial login.
 * By sharing session cookies/tokens between panels, both can operate on the
 * same account WITHOUT kicking each other out.
 * 
 * Protocol Knowledge (from RAG):
 * - Login returns sessionToken that can be used for reconnection
 * - Session timeout is ~5 minutes of inactivity
 * - Keepalive ping every 30 seconds maintains session
 * - passiveLogin allows reconnection with existing token
 */

const { session, ipcMain } = require('electron');
const EventEmitter = require('events');

// Encryption keys from protocol analysis
const EVONY_KEYS = {
    ACTION_KEY: "TAO_{313-894*&*($*#-FDIU(430}-{facebook_dioe(&*%$l}",
    API_KEY: "9f758e2deccbe6244f734371b9642eda",
    USER_INFO_KEY: "IUGI_md5_key_{djfiji3*4930}-{fjdi3284$9dlld}",
    XOR_KEY: 0xAA,
};

class SessionSyncService extends EventEmitter {
    constructor() {
        super();
        this.sharedSession = null;
        this.sessionToken = null;
        this.playerId = null;
        this.serverInfo = null;
        this.cookies = new Map();
        this.isInitialized = false;
        this.keepaliveInterval = null;
        this.lastActivity = Date.now();
        
        // Session state tracking
        this.state = {
            webLoggedIn: false,
            swfLoggedIn: false,
            syncEnabled: false,
            lastSync: null
        };
    }

    /**
     * Initialize session sync with shared partition
     * Both webviews will use the same session partition
     */
    initialize() {
        if (this.isInitialized) return;
        
        // Create shared session partition for both panels
        // persist: prefix makes it persist across app restarts
        this.sharedSession = session.fromPartition('persist:evony-shared');
        
        // Configure session settings
        this.sharedSession.setPermissionRequestHandler((webContents, permission, callback) => {
            // Allow necessary permissions
            const allowedPermissions = ['media', 'notifications', 'fullscreen'];
            callback(allowedPermissions.includes(permission));
        });

        // Intercept responses to capture session tokens
        this.sharedSession.webRequest.onCompleted({ urls: ['*://*.evony.com/*'] }, (details) => {
            this.handleResponse(details);
        });

        // Set up IPC handlers
        this.setupIPC();
        
        this.isInitialized = true;
        console.log('[SessionSync] Initialized with shared partition');
        
        return this.sharedSession;
    }

    /**
     * Set up IPC handlers for session sync
     */
    setupIPC() {
        // Get session info from renderer
        ipcMain.handle('session-sync:get-state', () => this.getState());
        
        // Manual session token injection
        ipcMain.handle('session-sync:set-token', (event, token) => {
            this.sessionToken = token;
            this.emit('token-updated', token);
            return true;
        });
        
        // Get cookies for a domain
        ipcMain.handle('session-sync:get-cookies', async (event, domain) => {
            return this.getCookies(domain);
        });
        
        // Sync cookies between panels
        ipcMain.handle('session-sync:sync-cookies', async () => {
            return this.syncCookies();
        });
        
        // Enable/disable sync
        ipcMain.handle('session-sync:toggle', (event, enabled) => {
            this.state.syncEnabled = enabled;
            this.emit('sync-toggled', enabled);
            return this.state;
        });

        // Get flashvars for SWF with session info
        ipcMain.handle('session-sync:get-flashvars', () => {
            return this.generateFlashVars();
        });
    }

    /**
     * Handle HTTP responses to capture session data
     */
    handleResponse(details) {
        const { url, responseHeaders } = details;
        
        // Look for Set-Cookie headers
        if (responseHeaders && responseHeaders['set-cookie']) {
            for (const cookie of responseHeaders['set-cookie']) {
                this.parseCookie(cookie, url);
            }
        }

        // Track activity
        this.lastActivity = Date.now();
    }

    /**
     * Parse and store cookie
     */
    parseCookie(cookieString, url) {
        try {
            const parts = cookieString.split(';');
            const [nameValue] = parts;
            const [name, value] = nameValue.split('=');
            
            if (name && value) {
                this.cookies.set(name.trim(), {
                    value: value.trim(),
                    url,
                    timestamp: Date.now()
                });
                
                // Check for session-related cookies
                if (name.toLowerCase().includes('session') || 
                    name.toLowerCase().includes('token') ||
                    name.toLowerCase().includes('auth')) {
                    console.log(`[SessionSync] Captured session cookie: ${name}`);
                    this.emit('cookie-captured', { name, value: value.substring(0, 20) + '...' });
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }

    /**
     * Get all cookies for a domain
     */
    async getCookies(domain = '.evony.com') {
        if (!this.sharedSession) return [];
        
        try {
            const cookies = await this.sharedSession.cookies.get({ domain });
            return cookies;
        } catch (e) {
            console.error('[SessionSync] Failed to get cookies:', e.message);
            return [];
        }
    }

    /**
     * Sync cookies - ensures both panels have identical session state
     */
    async syncCookies() {
        if (!this.sharedSession) return false;
        
        try {
            // Get all Evony cookies
            const cookies = await this.getCookies('.evony.com');
            
            // Re-set cookies to ensure they're fresh
            for (const cookie of cookies) {
                await this.sharedSession.cookies.set({
                    url: `https://${cookie.domain.replace(/^\./, '')}`,
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path || '/',
                    secure: cookie.secure,
                    httpOnly: cookie.httpOnly,
                    expirationDate: cookie.expirationDate
                });
            }
            
            this.state.lastSync = Date.now();
            this.emit('sync-complete', { cookieCount: cookies.length });
            console.log(`[SessionSync] Synced ${cookies.length} cookies`);
            
            return true;
        } catch (e) {
            console.error('[SessionSync] Sync failed:', e.message);
            return false;
        }
    }

    /**
     * Generate FlashVars for AutoEvony SWF with session info
     * This allows the SWF to use passiveLogin with existing session
     */
    generateFlashVars() {
        const vars = {
            // Pass session token if available
            sessionToken: this.sessionToken || '',
            playerId: this.playerId || '',
            server: this.serverInfo?.server || '',
            // Enable passive login mode
            passiveLogin: this.sessionToken ? 'true' : 'false',
            // Sync marker
            syncEnabled: this.state.syncEnabled ? 'true' : 'false',
            timestamp: Date.now()
        };
        
        // Convert to FlashVars string format
        return Object.entries(vars)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');
    }

    /**
     * Capture login response from Web panel
     */
    captureLoginResponse(response) {
        try {
            if (response.ok && response.data) {
                this.sessionToken = response.data.sessionToken;
                this.playerId = response.data.playerId;
                this.serverInfo = response.data.serverInfo || response.data;
                this.state.webLoggedIn = true;
                
                console.log('[SessionSync] Captured login - Player:', this.playerId);
                this.emit('login-captured', { playerId: this.playerId });
                
                // Start keepalive
                this.startKeepalive();
                
                return true;
            }
        } catch (e) {
            console.error('[SessionSync] Failed to capture login:', e.message);
        }
        return false;
    }

    /**
     * Start keepalive to maintain session
     */
    startKeepalive() {
        if (this.keepaliveInterval) {
            clearInterval(this.keepaliveInterval);
        }
        
        // Ping every 25 seconds (server timeout is ~30s)
        this.keepaliveInterval = setInterval(() => {
            this.emit('keepalive-tick');
            this.lastActivity = Date.now();
        }, 25000);
        
        console.log('[SessionSync] Keepalive started');
    }

    /**
     * Stop keepalive
     */
    stopKeepalive() {
        if (this.keepaliveInterval) {
            clearInterval(this.keepaliveInterval);
            this.keepaliveInterval = null;
        }
    }

    /**
     * Get current session state
     */
    getState() {
        return {
            ...this.state,
            hasToken: !!this.sessionToken,
            playerId: this.playerId,
            cookieCount: this.cookies.size,
            lastActivity: this.lastActivity,
            sessionAge: this.sessionToken ? Date.now() - this.lastActivity : 0
        };
    }

    /**
     * Apply session to a webview
     */
    applyToWebview(webview) {
        if (!this.sharedSession || !webview) return false;
        
        // Webviews use partition attribute, which should be set in HTML
        // But we can inject cookies if needed
        webview.addEventListener('did-start-loading', async () => {
            await this.syncCookies();
        });
        
        return true;
    }

    /**
     * Generate API signature (for manual API calls)
     */
    generateApiSignature(data) {
        const crypto = require('crypto');
        const combined = data + EVONY_KEYS.API_KEY;
        return crypto.createHash('md5').update(combined).digest('hex');
    }

    /**
     * Generate action signature
     */
    generateActionSignature(action, params) {
        const crypto = require('crypto');
        const combined = action + params + EVONY_KEYS.ACTION_KEY;
        return crypto.createHash('md5').update(combined).digest('hex');
    }

    /**
     * Clear session data
     */
    async clearSession() {
        this.sessionToken = null;
        this.playerId = null;
        this.serverInfo = null;
        this.cookies.clear();
        this.state = {
            webLoggedIn: false,
            swfLoggedIn: false,
            syncEnabled: false,
            lastSync: null
        };
        
        this.stopKeepalive();
        
        if (this.sharedSession) {
            await this.sharedSession.clearStorageData();
            await this.sharedSession.cookies.flushStore();
        }
        
        this.emit('session-cleared');
        console.log('[SessionSync] Session cleared');
    }

    /**
     * Cleanup on shutdown
     */
    destroy() {
        this.stopKeepalive();
        this.removeAllListeners();
        this.isInitialized = false;
    }
}

// Singleton instance
const sessionSync = new SessionSyncService();

module.exports = {
    SessionSyncService,
    sessionSync,
    EVONY_KEYS
};
