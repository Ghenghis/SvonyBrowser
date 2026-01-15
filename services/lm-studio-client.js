/**
 * LM Studio Client - OpenAI-compatible API Client
 * Connects to LM Studio for local LLM inference
 * v2.0.7 - Added streaming support, token counting, caching
 */

const http = require('http');
const https = require('https');
const { EventEmitter } = require('events');

/**
 * Simple token estimator
 */
class TokenEstimator {
    static estimate(text) {
        if (!text) return 0;
        // Rough estimate: ~4 characters per token for English
        return Math.ceil(text.length / 4);
    }
    
    static estimateMessages(messages) {
        let total = 0;
        for (const msg of messages) {
            total += 4; // Role overhead
            total += this.estimate(msg.content);
        }
        return total;
    }
}

/**
 * Response cache with TTL
 */
class ResponseCache {
    constructor(maxSize = 100, ttlMs = 300000) { // 5 min TTL
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }
    
    generateKey(messages, options) {
        const content = messages.map(m => `${m.role}:${m.content}`).join('|');
        const opts = `${options.temperature}:${options.maxTokens}`;
        return `${content}::${opts}`;
    }
    
    get(messages, options) {
        const key = this.generateKey(messages, options);
        const entry = this.cache.get(key);
        
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.response;
    }
    
    set(messages, options, response) {
        const key = this.generateKey(messages, options);
        
        // Trim cache if needed
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            this.cache.delete(oldest);
        }
        
        this.cache.set(key, {
            response,
            timestamp: Date.now()
        });
    }
    
    clear() {
        this.cache.clear();
    }
}

/**
 * LM Studio Client with streaming support
 */
class LMStudioClient extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            baseUrl: config.baseUrl || process.env.LM_STUDIO_URL || 'http://localhost:1234',
            model: config.model || process.env.LM_STUDIO_MODEL || 'local-model',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 2048,
            topP: config.topP || 0.95,
            frequencyPenalty: config.frequencyPenalty || 0,
            presencePenalty: config.presencePenalty || 0,
            timeout: config.timeout || 120000, // Increased for streaming
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            enableCache: config.enableCache !== false,
            cacheSize: config.cacheSize || 100,
            cacheTTL: config.cacheTTL || 300000
        };
        
        this.isConnected = false;
        this.availableModels = [];
        this.reconnectInterval = null;
        
        // Initialize cache
        this.cache = this.config.enableCache 
            ? new ResponseCache(this.config.cacheSize, this.config.cacheTTL)
            : null;
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cacheHits: 0,
            totalTokensIn: 0,
            totalTokensOut: 0,
            startTime: Date.now()
        };
        
        console.log('[LMStudioClient] Initialized');
    }
    
    /**
     * Check connection to LM Studio
     */
    async checkConnection() {
        try {
            const response = await this.request('/v1/models', 'GET');
            
            if (response && response.data) {
                this.isConnected = true;
                this.availableModels = response.data.map(m => ({
                    id: m.id,
                    object: m.object,
                    owned_by: m.owned_by
                }));
                console.log('[LMStudioClient] Connected. Models:', this.availableModels.map(m => m.id));
                this.emit('connected', { models: this.availableModels });
                return true;
            }
        } catch (error) {
            console.error('[LMStudioClient] Connection failed:', error.message);
            this.isConnected = false;
            this.emit('disconnected', { error: error.message });
        }
        return false;
    }
    
    /**
     * Validate model exists
     */
    validateModel(modelId) {
        if (this.availableModels.length === 0) return true; // Can't validate
        return this.availableModels.some(m => m.id === modelId);
    }
    
    /**
     * Send chat completion request (non-streaming)
     */
    async chatCompletion(messages, options = {}) {
        this.stats.totalRequests++;
        
        const opts = {
            model: options.model || this.config.model,
            temperature: options.temperature ?? this.config.temperature,
            maxTokens: options.maxTokens || this.config.maxTokens,
            topP: options.topP || this.config.topP,
            frequencyPenalty: options.frequencyPenalty || this.config.frequencyPenalty,
            presencePenalty: options.presencePenalty || this.config.presencePenalty
        };
        
        // Check cache
        if (this.cache && !options.noCache) {
            const cached = this.cache.get(messages, opts);
            if (cached) {
                this.stats.cacheHits++;
                return cached;
            }
        }
        
        // Estimate input tokens
        const inputTokens = TokenEstimator.estimateMessages(messages);
        this.stats.totalTokensIn += inputTokens;
        
        const payload = {
            model: opts.model,
            messages: messages,
            temperature: opts.temperature,
            max_tokens: opts.maxTokens,
            top_p: opts.topP,
            frequency_penalty: opts.frequencyPenalty,
            presence_penalty: opts.presencePenalty,
            stream: false
        };
        
        // Add tools if provided
        if (options.tools && options.tools.length > 0) {
            payload.tools = options.tools;
            payload.tool_choice = options.toolChoice || 'auto';
        }
        
        if (options.stop) {
            payload.stop = options.stop;
        }
        
        try {
            const response = await this.requestWithRetry('/v1/chat/completions', 'POST', payload);
            
            if (!response || !response.choices || response.choices.length === 0) {
                throw new Error('Invalid response from LM Studio');
            }
            
            const result = {
                message: response.choices[0].message,
                finishReason: response.choices[0].finish_reason,
                usage: response.usage || {
                    prompt_tokens: inputTokens,
                    completion_tokens: TokenEstimator.estimate(response.choices[0].message?.content),
                    total_tokens: inputTokens + TokenEstimator.estimate(response.choices[0].message?.content)
                },
                model: response.model
            };
            
            // Update stats
            this.stats.successfulRequests++;
            this.stats.totalTokensOut += result.usage.completion_tokens || 0;
            
            // Cache result
            if (this.cache && !options.noCache) {
                this.cache.set(messages, opts, result);
            }
            
            return result;
        } catch (error) {
            this.stats.failedRequests++;
            throw error;
        }
    }
    
    /**
     * Send streaming chat completion request
     */
    async chatCompletionStream(messages, options = {}, onChunk) {
        this.stats.totalRequests++;
        
        const inputTokens = TokenEstimator.estimateMessages(messages);
        this.stats.totalTokensIn += inputTokens;
        
        const payload = {
            model: options.model || this.config.model,
            messages: messages,
            temperature: options.temperature ?? this.config.temperature,
            max_tokens: options.maxTokens || this.config.maxTokens,
            top_p: options.topP || this.config.topP,
            frequency_penalty: options.frequencyPenalty || this.config.frequencyPenalty,
            presence_penalty: options.presencePenalty || this.config.presencePenalty,
            stream: true
        };
        
        if (options.tools && options.tools.length > 0) {
            payload.tools = options.tools;
            payload.tool_choice = options.toolChoice || 'auto';
        }
        
        if (options.stop) {
            payload.stop = options.stop;
        }
        
        return new Promise((resolve, reject) => {
            const url = new URL(this.config.baseUrl);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const reqOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                timeout: this.config.timeout
            };
            
            let fullContent = '';
            let finishReason = null;
            let buffer = '';
            
            const req = client.request(reqOptions, (res) => {
                if (res.statusCode >= 400) {
                    let errorData = '';
                    res.on('data', chunk => errorData += chunk);
                    res.on('end', () => {
                        this.stats.failedRequests++;
                        reject(new Error(`HTTP ${res.statusCode}: ${errorData}`));
                    });
                    return;
                }
                
                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    
                    // Process complete SSE messages
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();
                            
                            if (data === '[DONE]') {
                                continue;
                            }
                            
                            try {
                                const parsed = JSON.parse(data);
                                const delta = parsed.choices?.[0]?.delta;
                                
                                if (delta?.content) {
                                    fullContent += delta.content;
                                    
                                    if (onChunk) {
                                        onChunk({
                                            content: delta.content,
                                            fullContent,
                                            done: false
                                        });
                                    }
                                    
                                    this.emit('stream-chunk', {
                                        content: delta.content,
                                        fullContent
                                    });
                                }
                                
                                if (parsed.choices?.[0]?.finish_reason) {
                                    finishReason = parsed.choices[0].finish_reason;
                                }
                            } catch (e) {
                                // Skip invalid JSON
                            }
                        }
                    }
                });
                
                res.on('end', () => {
                    this.stats.successfulRequests++;
                    
                    const outputTokens = TokenEstimator.estimate(fullContent);
                    this.stats.totalTokensOut += outputTokens;
                    
                    const result = {
                        message: {
                            role: 'assistant',
                            content: fullContent
                        },
                        finishReason: finishReason || 'stop',
                        usage: {
                            prompt_tokens: inputTokens,
                            completion_tokens: outputTokens,
                            total_tokens: inputTokens + outputTokens
                        }
                    };
                    
                    if (onChunk) {
                        onChunk({
                            content: '',
                            fullContent,
                            done: true
                        });
                    }
                    
                    this.emit('stream-complete', result);
                    resolve(result);
                });
            });
            
            req.on('error', (error) => {
                this.stats.failedRequests++;
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                this.stats.failedRequests++;
                reject(new Error('Request timeout'));
            });
            
            req.write(JSON.stringify(payload));
            req.end();
        });
    }
    
    /**
     * Send completion request (non-chat)
     */
    async completion(prompt, options = {}) {
        this.stats.totalRequests++;
        
        const payload = {
            model: options.model || this.config.model,
            prompt: prompt,
            temperature: options.temperature ?? this.config.temperature,
            max_tokens: options.maxTokens || this.config.maxTokens,
            top_p: options.topP || this.config.topP,
            stream: false
        };
        
        try {
            const response = await this.requestWithRetry('/v1/completions', 'POST', payload);
            
            if (!response || !response.choices || response.choices.length === 0) {
                throw new Error('Invalid response from LM Studio');
            }
            
            this.stats.successfulRequests++;
            
            return {
                text: response.choices[0].text,
                finishReason: response.choices[0].finish_reason,
                usage: response.usage
            };
        } catch (error) {
            this.stats.failedRequests++;
            throw error;
        }
    }
    
    /**
     * Get embeddings
     */
    async embeddings(input, options = {}) {
        const payload = {
            model: options.model || 'text-embedding-ada-002',
            input: Array.isArray(input) ? input : [input]
        };
        
        const response = await this.request('/v1/embeddings', 'POST', payload);
        
        if (!response || !response.data) {
            throw new Error('Invalid embeddings response');
        }
        
        return response.data.map(d => d.embedding);
    }
    
    /**
     * List available models
     */
    async listModels() {
        const response = await this.request('/v1/models', 'GET');
        this.availableModels = (response.data || []).map(m => ({
            id: m.id,
            object: m.object,
            owned_by: m.owned_by
        }));
        return this.availableModels;
    }
    
    /**
     * Make HTTP request to LM Studio
     */
    request(path, method, body = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.config.baseUrl);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: this.config.timeout
            };
            
            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        if (res.statusCode >= 400) {
                            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                            return;
                        }
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) {
                        reject(new Error(`Invalid JSON: ${data.substring(0, 200)}`));
                    }
                });
            });
            
            req.on('error', reject);
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            if (body) {
                req.write(JSON.stringify(body));
            }
            
            req.end();
        });
    }
    
    /**
     * Request with retry
     */
    async requestWithRetry(path, method, body = null) {
        let lastError;
        
        for (let i = 0; i < this.config.maxRetries; i++) {
            try {
                return await this.request(path, method, body);
            } catch (error) {
                lastError = error;
                console.warn(`[LMStudioClient] Request failed (attempt ${i + 1}):`, error.message);
                
                if (i < this.config.maxRetries - 1) {
                    await new Promise(r => setTimeout(r, this.config.retryDelay * (i + 1)));
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Update cache if settings changed
        if (this.cache && (newConfig.cacheSize || newConfig.cacheTTL)) {
            this.cache = new ResponseCache(
                newConfig.cacheSize || this.config.cacheSize,
                newConfig.cacheTTL || this.config.cacheTTL
            );
        }
    }
    
    /**
     * Start auto-reconnect monitoring
     */
    startAutoReconnect(intervalMs = 30000) {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
        }
        
        this.reconnectInterval = setInterval(async () => {
            if (!this.isConnected) {
                console.log('[LMStudioClient] Attempting auto-reconnect...');
                await this.checkConnection();
            }
        }, intervalMs);
    }
    
    /**
     * Stop auto-reconnect monitoring
     */
    stopAutoReconnect() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }
    
    /**
     * Connect to LM Studio with URL
     */
    async connect(url) {
        if (url) {
            this.config.baseUrl = url;
        }
        return await this.checkConnection();
    }
    
    /**
     * Get current status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            url: this.config.baseUrl,
            baseUrl: this.config.baseUrl,
            model: this.config.model,
            availableModels: this.availableModels,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            stats: this.getStats()
        };
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            successRate: this.stats.totalRequests > 0
                ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(2) + '%'
                : '0%',
            cacheHitRate: this.stats.totalRequests > 0
                ? ((this.stats.cacheHits / this.stats.totalRequests) * 100).toFixed(2) + '%'
                : '0%'
        };
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        if (this.cache) {
            this.cache.clear();
        }
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cacheHits: 0,
            totalTokensIn: 0,
            totalTokensOut: 0,
            startTime: Date.now()
        };
    }
}

// Export singleton and class
const defaultClient = new LMStudioClient();

module.exports = {
    LMStudioClient,
    TokenEstimator,
    ResponseCache,
    client: defaultClient
};
