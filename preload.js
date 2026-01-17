/**
 * Svony Browser - Preload Script
 * Runs in webview context before page loads
 * v2.1.0 - Added session sync support for Web+AutoEvony dual panel
 */

// Expose limited API to webview content
window.svonyBridge = {
    // Send message to main renderer
    sendMessage: (type, data) => {
        window.postMessage({ type: 'svony-message', payload: { type, data } }, '*');
    },
    
    // Get current page info
    getPageInfo: () => ({
        url: window.location.href,
        title: document.title
    }),
    
    // Session sync helpers
    session: {
        // Notify when login detected
        notifyLogin: (data) => {
            window.postMessage({ type: 'svony-message', payload: { type: 'login-detected', data } }, '*');
        },
        // Get current session info
        getSessionInfo: () => ({
            cookies: document.cookie,
            url: window.location.href,
            domain: window.location.hostname
        })
    }
};

// Intercept Flash ExternalInterface calls
if (window.ExternalInterface) {
    const originalCall = window.ExternalInterface.call;
    window.ExternalInterface.call = function(functionName, ...args) {
        window.svonyBridge.sendMessage('flash-call', { functionName, args });
        return originalCall.apply(this, arguments);
    };
}

// Monitor for AMF traffic and login responses (session sync)
const originalXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function() {
    const xhr = new originalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    
    xhr.open = function(method, url, ...args) {
        xhr._svonyUrl = url;
        xhr._svonyMethod = method;
        return originalOpen.apply(this, [method, url, ...args]);
    };
    
    xhr.send = function(data) {
        if (xhr._svonyUrl && (xhr._svonyUrl.includes('amf') || xhr._svonyUrl.includes('evony'))) {
            window.svonyBridge.sendMessage('xhr-request', {
                url: xhr._svonyUrl,
                method: xhr._svonyMethod,
                data: data
            });
            
            // Monitor response for login data (session sync)
            xhr.addEventListener('load', function() {
                try {
                    // Check if this is a login response
                    if (xhr._svonyUrl.includes('login') || xhr._svonyUrl.includes('Login')) {
                        const response = xhr.responseText || xhr.response;
                        if (response) {
                            window.svonyBridge.sendMessage('login-response', {
                                url: xhr._svonyUrl,
                                response: typeof response === 'string' ? response.substring(0, 500) : 'binary',
                                status: xhr.status
                            });
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            });
        }
        return originalSend.apply(this, arguments);
    };
    
    return xhr;
};

// Console log forwarding for debugging
const originalConsoleLog = console.log;
console.log = function(...args) {
    window.svonyBridge.sendMessage('console-log', args);
    return originalConsoleLog.apply(this, args);
};

console.log('[Svony Browser] Preload script initialized');
