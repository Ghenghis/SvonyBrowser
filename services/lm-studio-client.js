/**
 * LM Studio Client - OpenAI-compatible API Client
 * Connects to LM Studio for local LLM inference
 * Used by Chatbot Service and MCP servers
 */

const http = require('http');
const https = require('https');
const { EventEmitter } = require('events');

class LMStudioClient extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // LM Studio default endpoint
            baseUrl: config.baseUrl || process.env.LM_STUDIO_URL || 'http://localhost:1234',
            
            // Model to use (leave as 'local-model' for LM Studio default)
            model: config.model || process.env.LM_STUDIO_MODEL || 'local-model',
            
            // Generation parameters
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 2048,
            topP: config.topP || 0.95,
            frequencyPenalty: config.frequencyPenalty || 0,
            presencePenalty: config.presencePenalty || 0,
            
            // Request timeout
            timeout: config.timeout || 60000,
            
            // Retry settings
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000
        };
        
        this.isConnected = false;
        this.availableModels = [];
    }
    
    /**
     * Check connection to LM Studio
     */
    async checkConnection() {
        try {
            const response = await this.request('/v1/models', 'GET');
            
            if (response && response.data) {
                this.isConnected = true;
                this.availableModels = response.data.map(m => m.id);
                console.log('[LMStudioClient] Connected. Models:', this.availableModels);
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
     * Send chat completion request
     */
    async chatCompletion(messages, options = {}) {
        const payload = {
            model: options.model || this.config.model,
            messages: messages,
            temperature: options.temperature || this.config.temperature,
            max_tokens: options.maxTokens || this.config.maxTokens,
            top_p: options.topP || this.config.topP,
            frequency_penalty: options.frequencyPenalty || this.config.frequencyPenalty,
            presence_penalty: options.presencePenalty || this.config.presencePenalty,
            stream: options.stream || false
        };
        
        // Add tools if provided (for function calling)
        if (options.tools && options.tools.length > 0) {
            payload.tools = options.tools;
            payload.tool_choice = options.toolChoice || 'auto';
        }
        
        // Add stop sequences if provided
        if (options.stop) {
            payload.stop = options.stop;
        }
        
        const response = await this.request('/v1/chat/completions', 'POST', payload);
        
        if (!response || !response.choices || response.choices.length === 0) {
            throw new Error('Invalid response from LM Studio');
        }
        
        return {
            message: response.choices[0].message,
            finishReason: response.choices[0].finish_reason,
            usage: response.usage,
            model: response.model
        };
    }
    
    /**
     * Send completion request (non-chat)
     */
    async completion(prompt, options = {}) {
        const payload = {
            model: options.model || this.config.model,
            prompt: prompt,
            temperature: options.temperature || this.config.temperature,
            max_tokens: options.maxTokens || this.config.maxTokens,
            top_p: options.topP || this.config.topP,
            stream: false
        };
        
        const response = await this.request('/v1/completions', 'POST', payload);
        
        if (!response || !response.choices || response.choices.length === 0) {
            throw new Error('Invalid response from LM Studio');
        }
        
        return {
            text: response.choices[0].text,
            finishReason: response.choices[0].finish_reason,
            usage: response.usage
        };
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
        return response.data || [];
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
    }
    
    /**
     * Get current status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            baseUrl: this.config.baseUrl,
            model: this.config.model,
            availableModels: this.availableModels
        };
    }
}

// Export singleton and class
const defaultClient = new LMStudioClient();

module.exports = {
    LMStudioClient,
    client: defaultClient
};
