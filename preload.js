/**
 * Svony Browser - Preload Script
 * Runs in webview context before page loads
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
    })
};

// Intercept Flash ExternalInterface calls
if (window.ExternalInterface) {
    const originalCall = window.ExternalInterface.call;
    window.ExternalInterface.call = function(functionName, ...args) {
        window.svonyBridge.sendMessage('flash-call', { functionName, args });
        return originalCall.apply(this, arguments);
    };
}

// Monitor for AMF traffic (if accessible)
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
