/**
 * Conversation Memory Service
 * Manages chatbot conversation history with sliding window and context extraction
 * v2.0.7 - Enhanced chatbot memory
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

/**
 * Message class for structured conversation entries
 */
class Message {
    constructor(role, content, metadata = {}) {
        this.id = metadata.id || this.generateId();
        this.role = role; // 'user', 'assistant', 'system'
        this.content = content;
        this.timestamp = metadata.timestamp || Date.now();
        this.tokens = metadata.tokens || this.estimateTokens(content);
        this.toolsUsed = metadata.toolsUsed || [];
        this.context = metadata.context || {};
    }
    
    generateId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    estimateTokens(text) {
        // Rough estimate: ~4 characters per token
        return Math.ceil((text || '').length / 4);
    }
    
    toJSON() {
        return {
            id: this.id,
            role: this.role,
            content: this.content,
            timestamp: this.timestamp,
            tokens: this.tokens,
            toolsUsed: this.toolsUsed,
            context: this.context
        };
    }
    
    toOpenAIFormat() {
        return {
            role: this.role,
            content: this.content
        };
    }
}

/**
 * Conversation class for managing a single conversation thread
 */
class Conversation {
    constructor(id, options = {}) {
        this.id = id;
        this.messages = [];
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
        this.title = options.title || 'New Conversation';
        this.systemPrompt = options.systemPrompt || null;
        this.metadata = options.metadata || {};
        
        // Limits
        this.maxMessages = options.maxMessages || 100;
        this.maxTokens = options.maxTokens || 8000;
    }
    
    addMessage(role, content, metadata = {}) {
        const message = new Message(role, content, metadata);
        this.messages.push(message);
        this.updatedAt = Date.now();
        
        // Trim if over limits
        this.trimToLimits();
        
        return message;
    }
    
    trimToLimits() {
        // Trim by message count
        while (this.messages.length > this.maxMessages) {
            // Keep system messages, remove oldest user/assistant
            const idx = this.messages.findIndex(m => m.role !== 'system');
            if (idx >= 0) {
                this.messages.splice(idx, 1);
            } else {
                break;
            }
        }
        
        // Trim by token count
        let totalTokens = this.getTotalTokens();
        while (totalTokens > this.maxTokens && this.messages.length > 1) {
            const idx = this.messages.findIndex(m => m.role !== 'system');
            if (idx >= 0) {
                totalTokens -= this.messages[idx].tokens;
                this.messages.splice(idx, 1);
            } else {
                break;
            }
        }
    }
    
    getTotalTokens() {
        return this.messages.reduce((sum, m) => sum + m.tokens, 0);
    }
    
    getLastN(n) {
        return this.messages.slice(-n);
    }
    
    getByRole(role) {
        return this.messages.filter(m => m.role === role);
    }
    
    getContext(windowSize = 10) {
        const recent = this.getLastN(windowSize);
        return recent.map(m => m.toOpenAIFormat());
    }
    
    getContextWithSystem(windowSize = 10) {
        const context = [];
        
        // Add system prompt if exists
        if (this.systemPrompt) {
            context.push({
                role: 'system',
                content: this.systemPrompt
            });
        }
        
        // Add recent messages
        const recent = this.getLastN(windowSize);
        for (const msg of recent) {
            if (msg.role !== 'system') {
                context.push(msg.toOpenAIFormat());
            }
        }
        
        return context;
    }
    
    clear() {
        this.messages = [];
        this.updatedAt = Date.now();
    }
    
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            systemPrompt: this.systemPrompt,
            metadata: this.metadata,
            messages: this.messages.map(m => m.toJSON()),
            stats: {
                messageCount: this.messages.length,
                totalTokens: this.getTotalTokens()
            }
        };
    }
    
    static fromJSON(data) {
        const conv = new Conversation(data.id, {
            title: data.title,
            systemPrompt: data.systemPrompt,
            metadata: data.metadata
        });
        conv.createdAt = data.createdAt;
        conv.updatedAt = data.updatedAt;
        conv.messages = data.messages.map(m => new Message(m.role, m.content, m));
        return conv;
    }
}

/**
 * ConversationMemory - manages multiple conversations with persistence
 */
class ConversationMemory extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.conversations = new Map();
        this.activeConversationId = null;
        
        // Configuration
        this.config = {
            maxConversations: options.maxConversations || 50,
            maxMessagesPerConversation: options.maxMessagesPerConversation || 100,
            maxTokensPerConversation: options.maxTokensPerConversation || 8000,
            contextWindowSize: options.contextWindowSize || 10,
            persistPath: options.persistPath || null,
            autoSave: options.autoSave !== false,
            autoSaveInterval: options.autoSaveInterval || 60000 // 1 minute
        };
        
        // Default system prompt for Evony assistant
        this.defaultSystemPrompt = `You are the Evony Co-Pilot, an AI assistant specialized in helping players with the game Evony: The King's Return. You have access to various tools and knowledge about:

- Game mechanics and strategies
- Troop types and combat calculations
- Hero skills and equipment
- Building upgrades and resource management
- Alliance warfare and diplomacy
- Event strategies and optimization

Be helpful, concise, and provide actionable advice. When you use tools to get information, explain what you found clearly.`;
        
        // Statistics
        this.stats = {
            totalMessages: 0,
            totalConversations: 0,
            startTime: Date.now()
        };
        
        // Auto-save timer
        if (this.config.autoSave && this.config.persistPath) {
            this.autoSaveTimer = setInterval(() => {
                this.save();
            }, this.config.autoSaveInterval);
        }
        
        // Load persisted data
        if (this.config.persistPath) {
            this.load();
        }
        
        console.log('[ConversationMemory] Initialized');
    }
    
    /**
     * Create a new conversation
     */
    createConversation(options = {}) {
        const id = options.id || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const conversation = new Conversation(id, {
            title: options.title || 'New Conversation',
            systemPrompt: options.systemPrompt || this.defaultSystemPrompt,
            maxMessages: this.config.maxMessagesPerConversation,
            maxTokens: this.config.maxTokensPerConversation,
            metadata: options.metadata || {}
        });
        
        this.conversations.set(id, conversation);
        this.stats.totalConversations++;
        
        // Trim old conversations if over limit
        this.trimConversations();
        
        // Set as active
        this.activeConversationId = id;
        
        this.emit('conversation-created', conversation);
        
        return conversation;
    }
    
    /**
     * Get or create active conversation
     */
    getActiveConversation() {
        if (this.activeConversationId && this.conversations.has(this.activeConversationId)) {
            return this.conversations.get(this.activeConversationId);
        }
        
        // Create new conversation if none active
        return this.createConversation();
    }
    
    /**
     * Set active conversation
     */
    setActiveConversation(id) {
        if (this.conversations.has(id)) {
            this.activeConversationId = id;
            this.emit('conversation-switched', this.conversations.get(id));
            return true;
        }
        return false;
    }
    
    /**
     * Get conversation by ID
     */
    getConversation(id) {
        return this.conversations.get(id);
    }
    
    /**
     * List all conversations
     */
    listConversations() {
        return Array.from(this.conversations.values())
            .map(c => ({
                id: c.id,
                title: c.title,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                messageCount: c.messages.length
            }))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }
    
    /**
     * Delete conversation
     */
    deleteConversation(id) {
        if (this.conversations.has(id)) {
            this.conversations.delete(id);
            
            if (this.activeConversationId === id) {
                this.activeConversationId = null;
            }
            
            this.emit('conversation-deleted', id);
            return true;
        }
        return false;
    }
    
    /**
     * Add message to active conversation
     */
    addMessage(role, content, metadata = {}) {
        const conversation = this.getActiveConversation();
        const message = conversation.addMessage(role, content, metadata);
        
        this.stats.totalMessages++;
        
        this.emit('message-added', {
            conversationId: conversation.id,
            message
        });
        
        return message;
    }
    
    /**
     * Get message count in active conversation
     */
    getMessageCount() {
        const conversation = this.getActiveConversation();
        return conversation.messages.length;
    }
    
    /**
     * Get context window (alias for getContext)
     */
    getContextWindow(windowSize = null) {
        return this.getContext(windowSize);
    }
    
    /**
     * Get context for LLM (with system prompt and recent messages)
     */
    getContext(windowSize = null) {
        const conversation = this.getActiveConversation();
        const size = windowSize || this.config.contextWindowSize;
        return conversation.getContextWithSystem(size);
    }
    
    /**
     * Get context without system prompt
     */
    getRecentMessages(windowSize = null) {
        const conversation = this.getActiveConversation();
        const size = windowSize || this.config.contextWindowSize;
        return conversation.getContext(size);
    }
    
    /**
     * Clear active conversation
     */
    clearActiveConversation() {
        const conversation = this.getActiveConversation();
        conversation.clear();
        this.emit('conversation-cleared', conversation.id);
    }
    
    /**
     * Trim old conversations to stay within limit
     */
    trimConversations() {
        if (this.conversations.size <= this.config.maxConversations) {
            return;
        }
        
        // Sort by updatedAt and remove oldest
        const sorted = Array.from(this.conversations.entries())
            .sort((a, b) => a[1].updatedAt - b[1].updatedAt);
        
        while (this.conversations.size > this.config.maxConversations) {
            const [id] = sorted.shift();
            this.conversations.delete(id);
        }
    }
    
    /**
     * Search messages across all conversations
     */
    search(query, options = {}) {
        const results = [];
        const queryLower = query.toLowerCase();
        
        for (const conversation of this.conversations.values()) {
            for (const message of conversation.messages) {
                if (message.content.toLowerCase().includes(queryLower)) {
                    results.push({
                        conversationId: conversation.id,
                        conversationTitle: conversation.title,
                        message: message.toJSON()
                    });
                }
            }
        }
        
        // Sort by timestamp descending
        results.sort((a, b) => b.message.timestamp - a.message.timestamp);
        
        // Limit results
        const limit = options.limit || 50;
        return results.slice(0, limit);
    }
    
    /**
     * Get statistics
     */
    getStats() {
        const conversations = Array.from(this.conversations.values());
        
        return {
            ...this.stats,
            activeConversations: this.conversations.size,
            activeConversationId: this.activeConversationId,
            totalMessagesInMemory: conversations.reduce((sum, c) => sum + c.messages.length, 0),
            totalTokensInMemory: conversations.reduce((sum, c) => sum + c.getTotalTokens(), 0),
            uptime: Date.now() - this.stats.startTime
        };
    }
    
    /**
     * Save to file
     */
    save() {
        if (!this.config.persistPath) {
            return false;
        }
        
        try {
            const data = {
                version: '1.0',
                savedAt: Date.now(),
                activeConversationId: this.activeConversationId,
                conversations: Array.from(this.conversations.values()).map(c => c.toJSON()),
                stats: this.stats
            };
            
            // Ensure directory exists
            const dir = path.dirname(this.config.persistPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.config.persistPath, JSON.stringify(data, null, 2));
            
            this.emit('saved', this.config.persistPath);
            return true;
        } catch (error) {
            console.error('[ConversationMemory] Save error:', error);
            this.emit('save-error', error);
            return false;
        }
    }
    
    /**
     * Load from file
     */
    load() {
        if (!this.config.persistPath || !fs.existsSync(this.config.persistPath)) {
            return false;
        }
        
        try {
            const data = JSON.parse(fs.readFileSync(this.config.persistPath, 'utf8'));
            
            // Restore conversations
            this.conversations.clear();
            for (const convData of data.conversations || []) {
                const conversation = Conversation.fromJSON(convData);
                this.conversations.set(conversation.id, conversation);
            }
            
            // Restore active conversation
            if (data.activeConversationId && this.conversations.has(data.activeConversationId)) {
                this.activeConversationId = data.activeConversationId;
            }
            
            // Restore stats
            if (data.stats) {
                this.stats = { ...this.stats, ...data.stats };
            }
            
            this.emit('loaded', this.config.persistPath);
            return true;
        } catch (error) {
            console.error('[ConversationMemory] Load error:', error);
            this.emit('load-error', error);
            return false;
        }
    }
    
    /**
     * Export all data
     */
    export() {
        return {
            version: '1.0',
            exportedAt: Date.now(),
            conversations: Array.from(this.conversations.values()).map(c => c.toJSON()),
            stats: this.getStats()
        };
    }
    
    /**
     * Import data
     */
    import(data) {
        if (!data || !data.conversations) {
            return false;
        }
        
        for (const convData of data.conversations) {
            const conversation = Conversation.fromJSON(convData);
            this.conversations.set(conversation.id, conversation);
        }
        
        this.emit('imported', data.conversations.length);
        return true;
    }
    
    /**
     * Cleanup and shutdown
     */
    shutdown() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        if (this.config.autoSave) {
            this.save();
        }
    }
}

module.exports = {
    ConversationMemory,
    Conversation,
    Message
};
