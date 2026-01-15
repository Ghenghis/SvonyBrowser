/**
 * Network Inspector Service
 * HTTP/WebSocket request inspection and debugging
 * v2.0.9
 */

const EventEmitter = require('events');
const { URL } = require('url');

/**
 * Network Request Entry
 */
class NetworkRequest {
    constructor(data) {
        this.id = data.id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.timestamp = data.timestamp || new Date().toISOString();
        this.method = data.method || 'GET';
        this.url = data.url;
        this.headers = data.headers || {};
        this.body = data.body || null;
        this.type = data.type || 'xhr'; // xhr, fetch, websocket, image, script, etc.
        this.initiator = data.initiator || 'unknown';
        
        // Response data
        this.status = null;
        this.statusText = null;
        this.responseHeaders = {};
        this.responseBody = null;
        this.responseSize = 0;
        this.responseType = null;
        
        // Timing
        this.startTime = Date.now();
        this.endTime = null;
        this.duration = null;
        this.timing = {
            dns: 0,
            connect: 0,
            ssl: 0,
            send: 0,
            wait: 0,
            receive: 0
        };
        
        // State
        this.state = 'pending'; // pending, complete, error, cancelled
        this.error = null;
        
        // AMF decoding
        this.isAMF = false;
        this.decodedRequest = null;
        this.decodedResponse = null;
        
        // Tags
        this.tags = [];
        this.notes = '';
    }

    complete(response) {
        this.status = response.status;
        this.statusText = response.statusText;
        this.responseHeaders = response.headers || {};
        this.responseBody = response.body;
        this.responseSize = response.size || 0;
        this.responseType = response.type || 'unknown';
        this.endTime = Date.now();
        this.duration = this.endTime - this.startTime;
        this.state = 'complete';
        
        if (response.timing) {
            this.timing = { ...this.timing, ...response.timing };
        }
    }

    fail(error) {
        this.error = error;
        this.state = 'error';
        this.endTime = Date.now();
        this.duration = this.endTime - this.startTime;
    }

    cancel() {
        this.state = 'cancelled';
        this.endTime = Date.now();
        this.duration = this.endTime - this.startTime;
    }

    setDecodedData(request, response) {
        this.isAMF = true;
        this.decodedRequest = request;
        this.decodedResponse = response;
    }

    addTag(tag) {
        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
        }
    }

    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            method: this.method,
            url: this.url,
            headers: this.headers,
            body: this.body,
            type: this.type,
            initiator: this.initiator,
            status: this.status,
            statusText: this.statusText,
            responseHeaders: this.responseHeaders,
            responseBody: this.responseBody,
            responseSize: this.responseSize,
            responseType: this.responseType,
            duration: this.duration,
            timing: this.timing,
            state: this.state,
            error: this.error,
            isAMF: this.isAMF,
            decodedRequest: this.decodedRequest,
            decodedResponse: this.decodedResponse,
            tags: this.tags,
            notes: this.notes
        };
    }
}

/**
 * WebSocket Message Entry
 */
class WebSocketMessage {
    constructor(data) {
        this.id = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.timestamp = new Date().toISOString();
        this.connectionId = data.connectionId;
        this.direction = data.direction; // 'sent' or 'received'
        this.type = data.type; // 'text', 'binary'
        this.data = data.data;
        this.size = data.size || 0;
        
        // AMF decoding
        this.isAMF = false;
        this.decodedData = null;
    }

    setDecodedData(decoded) {
        this.isAMF = true;
        this.decodedData = decoded;
    }

    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            connectionId: this.connectionId,
            direction: this.direction,
            type: this.type,
            data: this.data,
            size: this.size,
            isAMF: this.isAMF,
            decodedData: this.decodedData
        };
    }
}

/**
 * WebSocket Connection Entry
 */
class WebSocketConnection {
    constructor(data) {
        this.id = `wsc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.url = data.url;
        this.protocols = data.protocols || [];
        this.state = 'connecting'; // connecting, open, closing, closed
        this.openedAt = null;
        this.closedAt = null;
        this.closeCode = null;
        this.closeReason = null;
        this.messages = [];
        this.messageCount = { sent: 0, received: 0 };
        this.bytesTransferred = { sent: 0, received: 0 };
    }

    open() {
        this.state = 'open';
        this.openedAt = new Date().toISOString();
    }

    close(code, reason) {
        this.state = 'closed';
        this.closedAt = new Date().toISOString();
        this.closeCode = code;
        this.closeReason = reason;
    }

    addMessage(message) {
        this.messages.push(message);
        this.messageCount[message.direction]++;
        this.bytesTransferred[message.direction] += message.size;
    }

    toJSON() {
        return {
            id: this.id,
            url: this.url,
            protocols: this.protocols,
            state: this.state,
            openedAt: this.openedAt,
            closedAt: this.closedAt,
            closeCode: this.closeCode,
            closeReason: this.closeReason,
            messageCount: this.messageCount,
            bytesTransferred: this.bytesTransferred
        };
    }
}

/**
 * Network Inspector - Main class
 */
class NetworkInspector extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxRequests: options.maxRequests || 5000,
            maxWebSocketMessages: options.maxWebSocketMessages || 10000,
            captureBody: options.captureBody !== false,
            autoDecodeAMF: options.autoDecodeAMF !== false,
            filterPatterns: options.filterPatterns || [],
            ...options
        };

        // Storage
        this.requests = new Map();
        this.requestList = [];
        this.webSocketConnections = new Map();
        this.webSocketMessages = [];
        
        // AMF Decoder reference
        this.amfDecoder = null;
        
        // Interception rules
        this.interceptRules = [];
        this.isIntercepting = false;
        this.interceptedRequests = new Map();
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            completedRequests: 0,
            failedRequests: 0,
            totalBytes: 0,
            totalDuration: 0,
            byType: {},
            byStatus: {},
            byDomain: {}
        };

        // Recording state
        this.isRecording = true;
    }

    /**
     * Set AMF decoder reference
     */
    setAMFDecoder(decoder) {
        this.amfDecoder = decoder;
    }

    /**
     * Start recording
     */
    startRecording() {
        this.isRecording = true;
        this.emit('recording-started');
    }

    /**
     * Stop recording
     */
    stopRecording() {
        this.isRecording = false;
        this.emit('recording-stopped');
    }

    /**
     * Clear all recorded data
     */
    clear() {
        this.requests.clear();
        this.requestList = [];
        this.webSocketConnections.clear();
        this.webSocketMessages = [];
        this.stats = {
            totalRequests: 0,
            completedRequests: 0,
            failedRequests: 0,
            totalBytes: 0,
            totalDuration: 0,
            byType: {},
            byStatus: {},
            byDomain: {}
        };
        this.emit('cleared');
    }

    /**
     * Capture a new request
     */
    captureRequest(data) {
        if (!this.isRecording) return null;
        
        // Check filter patterns
        if (this._shouldFilter(data.url)) return null;
        
        const request = new NetworkRequest(data);
        
        // Auto-tag based on URL
        this._autoTag(request);
        
        // Store
        this.requests.set(request.id, request);
        this.requestList.push(request);
        
        // Update stats
        this.stats.totalRequests++;
        this._updateTypeStats(request.type);
        this._updateDomainStats(request.url);
        
        // Trim if exceeding max
        if (this.requestList.length > this.options.maxRequests) {
            const removed = this.requestList.shift();
            this.requests.delete(removed.id);
        }
        
        // Check interception
        if (this.isIntercepting) {
            const rule = this._matchInterceptRule(request);
            if (rule) {
                this.interceptedRequests.set(request.id, { request, rule });
                this.emit('request-intercepted', { request, rule });
            }
        }
        
        this.emit('request-started', request);
        return request;
    }

    /**
     * Complete a request with response
     */
    completeRequest(requestId, response) {
        const request = this.requests.get(requestId);
        if (!request) return null;
        
        request.complete(response);
        
        // Update stats
        this.stats.completedRequests++;
        this.stats.totalBytes += request.responseSize;
        this.stats.totalDuration += request.duration;
        this._updateStatusStats(request.status);
        
        // Auto-decode AMF if enabled
        if (this.options.autoDecodeAMF && this.amfDecoder) {
            this._tryDecodeAMF(request);
        }
        
        this.emit('request-completed', request);
        return request;
    }

    /**
     * Fail a request
     */
    failRequest(requestId, error) {
        const request = this.requests.get(requestId);
        if (!request) return null;
        
        request.fail(error);
        this.stats.failedRequests++;
        
        this.emit('request-failed', request);
        return request;
    }

    /**
     * Try to decode AMF data
     */
    _tryDecodeAMF(request) {
        try {
            // Check content type
            const contentType = request.responseHeaders['content-type'] || '';
            if (!contentType.includes('amf') && !contentType.includes('x-amf')) {
                // Check if URL suggests AMF
                if (!request.url.includes('amf') && !request.url.includes('gateway')) {
                    return;
                }
            }
            
            // Try to decode response
            if (request.responseBody && this.amfDecoder) {
                const decoded = this.amfDecoder.decode(request.responseBody);
                request.setDecodedData(null, decoded);
                request.addTag('amf');
            }
        } catch (e) {
            // Not AMF or decode failed
        }
    }

    /**
     * Auto-tag request based on URL
     */
    _autoTag(request) {
        const url = request.url.toLowerCase();
        
        if (url.includes('evony')) request.addTag('evony');
        if (url.includes('api')) request.addTag('api');
        if (url.includes('gateway')) request.addTag('gateway');
        if (url.includes('amf')) request.addTag('amf');
        if (url.includes('login')) request.addTag('auth');
        if (url.includes('chat')) request.addTag('chat');
        if (url.includes('battle') || url.includes('combat')) request.addTag('combat');
        if (url.includes('resource')) request.addTag('resource');
    }

    /**
     * Check if URL should be filtered
     */
    _shouldFilter(url) {
        for (const pattern of this.options.filterPatterns) {
            if (typeof pattern === 'string' && url.includes(pattern)) {
                return true;
            } else if (pattern instanceof RegExp && pattern.test(url)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Update type statistics
     */
    _updateTypeStats(type) {
        this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
    }

    /**
     * Update status statistics
     */
    _updateStatusStats(status) {
        const statusGroup = Math.floor(status / 100) * 100;
        this.stats.byStatus[statusGroup] = (this.stats.byStatus[statusGroup] || 0) + 1;
    }

    /**
     * Update domain statistics
     */
    _updateDomainStats(urlStr) {
        try {
            const url = new URL(urlStr);
            const domain = url.hostname;
            this.stats.byDomain[domain] = (this.stats.byDomain[domain] || 0) + 1;
        } catch (e) {
            // Invalid URL
        }
    }

    /**
     * Capture WebSocket connection
     */
    captureWebSocketConnection(data) {
        if (!this.isRecording) return null;
        
        const connection = new WebSocketConnection(data);
        this.webSocketConnections.set(connection.id, connection);
        
        this.emit('websocket-connection', connection);
        return connection;
    }

    /**
     * Update WebSocket connection state
     */
    updateWebSocketState(connectionId, state, data = {}) {
        const connection = this.webSocketConnections.get(connectionId);
        if (!connection) return null;
        
        if (state === 'open') {
            connection.open();
        } else if (state === 'closed') {
            connection.close(data.code, data.reason);
        }
        
        this.emit('websocket-state-changed', connection);
        return connection;
    }

    /**
     * Capture WebSocket message
     */
    captureWebSocketMessage(connectionId, data) {
        if (!this.isRecording) return null;
        
        const connection = this.webSocketConnections.get(connectionId);
        if (!connection) return null;
        
        const message = new WebSocketMessage({
            connectionId,
            ...data
        });
        
        // Try AMF decode
        if (this.options.autoDecodeAMF && this.amfDecoder && data.type === 'binary') {
            try {
                const decoded = this.amfDecoder.decode(data.data);
                message.setDecodedData(decoded);
            } catch (e) {
                // Not AMF
            }
        }
        
        connection.addMessage(message);
        this.webSocketMessages.push(message);
        
        // Trim if exceeding max
        if (this.webSocketMessages.length > this.options.maxWebSocketMessages) {
            this.webSocketMessages.shift();
        }
        
        this.emit('websocket-message', message);
        return message;
    }

    /**
     * Add interception rule
     */
    addInterceptRule(rule) {
        const id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const interceptRule = {
            id,
            pattern: rule.pattern, // string or RegExp
            methods: rule.methods || ['*'],
            action: rule.action || 'pause', // pause, modify, block
            modifier: rule.modifier || null, // Function to modify request
            enabled: true,
            hitCount: 0
        };
        
        this.interceptRules.push(interceptRule);
        this.emit('intercept-rule-added', interceptRule);
        return interceptRule;
    }

    /**
     * Remove interception rule
     */
    removeInterceptRule(ruleId) {
        const index = this.interceptRules.findIndex(r => r.id === ruleId);
        if (index !== -1) {
            const rule = this.interceptRules.splice(index, 1)[0];
            this.emit('intercept-rule-removed', rule);
            return true;
        }
        return false;
    }

    /**
     * Start interception
     */
    startInterception() {
        this.isIntercepting = true;
        this.emit('interception-started');
    }

    /**
     * Stop interception
     */
    stopInterception() {
        this.isIntercepting = false;
        // Release all intercepted requests
        for (const [id, data] of this.interceptedRequests) {
            this.emit('request-released', data.request);
        }
        this.interceptedRequests.clear();
        this.emit('interception-stopped');
    }

    /**
     * Match interception rule
     */
    _matchInterceptRule(request) {
        for (const rule of this.interceptRules) {
            if (!rule.enabled) continue;
            
            // Check method
            if (!rule.methods.includes('*') && !rule.methods.includes(request.method)) {
                continue;
            }
            
            // Check pattern
            let matches = false;
            if (typeof rule.pattern === 'string') {
                matches = request.url.includes(rule.pattern);
            } else if (rule.pattern instanceof RegExp) {
                matches = rule.pattern.test(request.url);
            }
            
            if (matches) {
                rule.hitCount++;
                return rule;
            }
        }
        return null;
    }

    /**
     * Continue intercepted request
     */
    continueRequest(requestId, modifications = null) {
        const data = this.interceptedRequests.get(requestId);
        if (!data) return false;
        
        this.interceptedRequests.delete(requestId);
        
        if (modifications) {
            // Apply modifications
            Object.assign(data.request, modifications);
        }
        
        this.emit('request-continued', { request: data.request, modifications });
        return true;
    }

    /**
     * Block intercepted request
     */
    blockRequest(requestId) {
        const data = this.interceptedRequests.get(requestId);
        if (!data) return false;
        
        this.interceptedRequests.delete(requestId);
        data.request.cancel();
        
        this.emit('request-blocked', data.request);
        return true;
    }

    /**
     * Replay a request
     */
    async replayRequest(requestId, modifications = {}) {
        const request = this.requests.get(requestId);
        if (!request) return null;
        
        // Create replay data
        const replayData = {
            method: modifications.method || request.method,
            url: modifications.url || request.url,
            headers: { ...request.headers, ...modifications.headers },
            body: modifications.body !== undefined ? modifications.body : request.body
        };
        
        this.emit('request-replay', { original: request, replay: replayData });
        return replayData;
    }

    /**
     * Get requests with filtering
     */
    getRequests(options = {}) {
        let requests = [...this.requestList];
        
        // Filter by type
        if (options.type) {
            requests = requests.filter(r => r.type === options.type);
        }
        
        // Filter by method
        if (options.method) {
            requests = requests.filter(r => r.method === options.method);
        }
        
        // Filter by status
        if (options.status) {
            requests = requests.filter(r => r.status === options.status);
        }
        
        // Filter by status range
        if (options.statusRange) {
            const [min, max] = options.statusRange;
            requests = requests.filter(r => r.status >= min && r.status <= max);
        }
        
        // Filter by URL pattern
        if (options.urlPattern) {
            const pattern = options.urlPattern instanceof RegExp 
                ? options.urlPattern 
                : new RegExp(options.urlPattern, 'i');
            requests = requests.filter(r => pattern.test(r.url));
        }
        
        // Filter by tag
        if (options.tag) {
            requests = requests.filter(r => r.tags.includes(options.tag));
        }
        
        // Filter by state
        if (options.state) {
            requests = requests.filter(r => r.state === options.state);
        }
        
        // Filter by AMF
        if (options.amfOnly) {
            requests = requests.filter(r => r.isAMF);
        }
        
        // Filter by time range
        if (options.startTime) {
            requests = requests.filter(r => new Date(r.timestamp) >= new Date(options.startTime));
        }
        if (options.endTime) {
            requests = requests.filter(r => new Date(r.timestamp) <= new Date(options.endTime));
        }
        
        // Sort
        if (options.sortBy) {
            const sortKey = options.sortBy;
            const sortDir = options.sortDir === 'asc' ? 1 : -1;
            requests.sort((a, b) => {
                if (a[sortKey] < b[sortKey]) return -sortDir;
                if (a[sortKey] > b[sortKey]) return sortDir;
                return 0;
            });
        }
        
        // Limit
        if (options.limit) {
            requests = requests.slice(0, options.limit);
        }
        
        return requests;
    }

    /**
     * Get request by ID
     */
    getRequest(requestId) {
        return this.requests.get(requestId);
    }

    /**
     * Get WebSocket connections
     */
    getWebSocketConnections() {
        return Array.from(this.webSocketConnections.values());
    }

    /**
     * Get WebSocket messages
     */
    getWebSocketMessages(connectionId = null, options = {}) {
        let messages = connectionId 
            ? this.webSocketMessages.filter(m => m.connectionId === connectionId)
            : [...this.webSocketMessages];
        
        // Filter by direction
        if (options.direction) {
            messages = messages.filter(m => m.direction === options.direction);
        }
        
        // Filter by AMF
        if (options.amfOnly) {
            messages = messages.filter(m => m.isAMF);
        }
        
        // Limit
        if (options.limit) {
            messages = messages.slice(-options.limit);
        }
        
        return messages;
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            averageDuration: this.stats.completedRequests > 0 
                ? this.stats.totalDuration / this.stats.completedRequests 
                : 0,
            successRate: this.stats.totalRequests > 0
                ? (this.stats.completedRequests / this.stats.totalRequests) * 100
                : 0,
            webSocketConnections: this.webSocketConnections.size,
            webSocketMessages: this.webSocketMessages.length,
            isRecording: this.isRecording,
            isIntercepting: this.isIntercepting,
            interceptedCount: this.interceptedRequests.size
        };
    }

    /**
     * Export requests to HAR format
     */
    exportHAR() {
        const entries = this.requestList.map(req => ({
            startedDateTime: req.timestamp,
            time: req.duration || 0,
            request: {
                method: req.method,
                url: req.url,
                httpVersion: 'HTTP/1.1',
                headers: Object.entries(req.headers).map(([name, value]) => ({ name, value })),
                queryString: [],
                cookies: [],
                headersSize: -1,
                bodySize: req.body ? req.body.length : 0,
                postData: req.body ? { mimeType: 'application/octet-stream', text: req.body } : undefined
            },
            response: {
                status: req.status || 0,
                statusText: req.statusText || '',
                httpVersion: 'HTTP/1.1',
                headers: Object.entries(req.responseHeaders).map(([name, value]) => ({ name, value })),
                cookies: [],
                content: {
                    size: req.responseSize,
                    mimeType: req.responseType || 'application/octet-stream',
                    text: req.responseBody
                },
                redirectURL: '',
                headersSize: -1,
                bodySize: req.responseSize
            },
            cache: {},
            timings: req.timing
        }));

        return {
            log: {
                version: '1.2',
                creator: {
                    name: 'Svony Browser Network Inspector',
                    version: '2.0.9'
                },
                entries
            }
        };
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: true,
            isRecording: this.isRecording,
            isIntercepting: this.isIntercepting,
            requestCount: this.requestList.length,
            webSocketCount: this.webSocketConnections.size,
            interceptRuleCount: this.interceptRules.length,
            stats: this.getStats()
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        this.clear();
        this.interceptRules = [];
        this.emit('destroyed');
    }
}

// Export singleton and class
let instance = null;

module.exports = {
    NetworkInspector,
    NetworkRequest,
    WebSocketMessage,
    WebSocketConnection,
    
    getInstance(options) {
        if (!instance) {
            instance = new NetworkInspector(options);
        }
        return instance;
    }
};
