#!/usr/bin/env node
/**
 * Evony RAG MCP Server
 * Provides Retrieval Augmented Generation for Evony knowledge base queries
 * 
 * Tools:
 * - evony_search: Search the knowledge base for relevant information
 * - evony_lookup: Look up specific topics in the knowledge base
 * - evony_context: Get contextual information for a game situation
 */

import { createReadStream } from 'fs';
import { readFile, readdir, stat } from 'fs/promises';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Knowledge base path
const KNOWLEDGE_BASE_PATH = process.env.EVONY_KB_PATH || join(__dirname, '../../knowledge-base');

// In-memory document store (production would use ChromaDB)
const documentStore = new Map();
const documentIndex = [];

/**
 * Load knowledge base documents
 */
async function loadKnowledgeBase() {
    try {
        const categories = await readdir(KNOWLEDGE_BASE_PATH);
        
        for (const category of categories) {
            const categoryPath = join(KNOWLEDGE_BASE_PATH, category);
            const categoryStats = await stat(categoryPath);
            
            if (categoryStats.isDirectory()) {
                const files = await readdir(categoryPath);
                
                for (const file of files) {
                    if (file.endsWith('.md') || file.endsWith('.json')) {
                        const filePath = join(categoryPath, file);
                        const content = await readFile(filePath, 'utf8');
                        
                        const docId = `${category}/${file}`;
                        documentStore.set(docId, {
                            id: docId,
                            category,
                            filename: file,
                            content,
                            keywords: extractKeywords(content)
                        });
                        
                        documentIndex.push({
                            id: docId,
                            category,
                            filename: file,
                            keywords: extractKeywords(content)
                        });
                    }
                }
            }
        }
        
        console.error(`[evony-rag] Loaded ${documentStore.size} documents from knowledge base`);
    } catch (error) {
        console.error(`[evony-rag] Failed to load knowledge base: ${error.message}`);
    }
}

/**
 * Extract keywords from content for simple search
 */
function extractKeywords(content) {
    const words = content.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3);
    
    return [...new Set(words)];
}

/**
 * Search documents by query
 */
function searchDocuments(query, limit = 5) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const scores = [];
    
    for (const doc of documentIndex) {
        let score = 0;
        
        for (const word of queryWords) {
            if (doc.keywords.includes(word)) {
                score += 1;
            }
            // Partial match
            for (const keyword of doc.keywords) {
                if (keyword.includes(word) || word.includes(keyword)) {
                    score += 0.5;
                }
            }
        }
        
        if (score > 0) {
            scores.push({ id: doc.id, score, category: doc.category });
        }
    }
    
    scores.sort((a, b) => b.score - a.score);
    
    return scores.slice(0, limit).map(s => {
        const doc = documentStore.get(s.id);
        return {
            id: s.id,
            category: s.category,
            score: s.score,
            content: doc.content.substring(0, 500) + (doc.content.length > 500 ? '...' : '')
        };
    });
}

/**
 * Look up specific topic
 */
function lookupTopic(topic) {
    const topicLower = topic.toLowerCase();
    
    for (const [id, doc] of documentStore) {
        if (doc.filename.toLowerCase().includes(topicLower) ||
            doc.category.toLowerCase().includes(topicLower)) {
            return {
                id,
                category: doc.category,
                content: doc.content
            };
        }
    }
    
    // Fallback to search
    const results = searchDocuments(topic, 1);
    return results.length > 0 ? results[0] : null;
}

/**
 * Get contextual information for game situation
 */
function getContext(situation) {
    const contexts = [];
    
    // Analyze situation and find relevant documents
    const keywords = situation.toLowerCase().split(/\s+/);
    
    const relevantCategories = [];
    if (keywords.some(k => ['attack', 'battle', 'combat', 'fight', 'war'].includes(k))) {
        relevantCategories.push('combat');
    }
    if (keywords.some(k => ['hero', 'general', 'skill'].includes(k))) {
        relevantCategories.push('heroes');
    }
    if (keywords.some(k => ['troop', 'army', 'soldier', 'cavalry', 'archer'].includes(k))) {
        relevantCategories.push('troops');
    }
    if (keywords.some(k => ['build', 'building', 'upgrade', 'construction'].includes(k))) {
        relevantCategories.push('buildings');
    }
    if (keywords.some(k => ['protocol', 'packet', 'amf', 'command'].includes(k))) {
        relevantCategories.push('protocols');
    }
    
    for (const category of relevantCategories) {
        for (const [id, doc] of documentStore) {
            if (doc.category === category) {
                contexts.push({
                    id,
                    category,
                    excerpt: doc.content.substring(0, 300)
                });
            }
        }
    }
    
    // Also do a general search
    const searchResults = searchDocuments(situation, 3);
    for (const result of searchResults) {
        if (!contexts.find(c => c.id === result.id)) {
            contexts.push(result);
        }
    }
    
    return contexts.slice(0, 5);
}

// MCP Server Implementation
const tools = [
    {
        name: 'evony_search',
        description: 'Search the Evony knowledge base for relevant information about game mechanics, strategies, troops, heroes, buildings, and protocols.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query to find relevant knowledge'
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of results to return (default: 5)'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'evony_lookup',
        description: 'Look up a specific topic in the Evony knowledge base by name or category.',
        inputSchema: {
            type: 'object',
            properties: {
                topic: {
                    type: 'string',
                    description: 'The topic to look up (e.g., "cavalry", "hero skills", "battle mechanics")'
                }
            },
            required: ['topic']
        }
    },
    {
        name: 'evony_context',
        description: 'Get contextual information relevant to a specific game situation or question.',
        inputSchema: {
            type: 'object',
            properties: {
                situation: {
                    type: 'string',
                    description: 'Description of the game situation or question'
                }
            },
            required: ['situation']
        }
    }
];

/**
 * Handle tool calls
 */
function handleToolCall(name, args) {
    switch (name) {
        case 'evony_search':
            return {
                results: searchDocuments(args.query, args.limit || 5)
            };
            
        case 'evony_lookup':
            const topic = lookupTopic(args.topic);
            return topic ? { found: true, ...topic } : { found: false, message: 'Topic not found' };
            
        case 'evony_context':
            return {
                contexts: getContext(args.situation)
            };
            
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

/**
 * Process JSON-RPC message
 */
function processMessage(message) {
    const { id, method, params } = message;
    
    try {
        switch (method) {
            case 'initialize':
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {}
                        },
                        serverInfo: {
                            name: 'evony-rag',
                            version: '1.0.0'
                        }
                    }
                };
                
            case 'initialized':
                return null; // Notification, no response
                
            case 'tools/list':
                return {
                    jsonrpc: '2.0',
                    id,
                    result: { tools }
                };
                
            case 'tools/call':
                const { name, arguments: args } = params;
                const result = handleToolCall(name, args);
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2)
                            }
                        ]
                    }
                };
                
            default:
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: ${method}`
                    }
                };
        }
    } catch (error) {
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code: -32603,
                message: error.message
            }
        };
    }
}

/**
 * Main entry point
 */
async function main() {
    // Load knowledge base
    await loadKnowledgeBase();
    
    // Read from stdin, write to stdout
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
    
    rl.on('line', (line) => {
        try {
            const message = JSON.parse(line);
            const response = processMessage(message);
            
            if (response) {
                console.log(JSON.stringify(response));
            }
        } catch (error) {
            console.error(`[evony-rag] Error processing message: ${error.message}`);
        }
    });
    
    rl.on('close', () => {
        process.exit(0);
    });
    
    console.error('[evony-rag] Server started');
}

main().catch(error => {
    console.error(`[evony-rag] Fatal error: ${error.message}`);
    process.exit(1);
});
