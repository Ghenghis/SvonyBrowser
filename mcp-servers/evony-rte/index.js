#!/usr/bin/env node
/**
 * Evony RTE (Real-Time Engine) MCP Server
 * Provides protocol analysis and traffic decoding for Evony game traffic
 * 
 * Tools:
 * - protocol_lookup: Look up protocol action by name or command ID
 * - protocol_search: Search for protocol actions
 * - decode_packet: Decode AMF3 packet data
 * - analyze_traffic: Analyze traffic patterns
 */

import { readFile } from 'fs/promises';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Protocol database path
const PROTOCOL_DB_PATH = process.env.PROTOCOL_DB_PATH || join(__dirname, '../../data/protocol-actions.json');

// Protocol database
let protocolActions = [];
const actionsByName = new Map();
const actionsByCommandId = new Map();

/**
 * Load protocol database
 */
async function loadProtocolDatabase() {
    try {
        const data = await readFile(PROTOCOL_DB_PATH, 'utf8');
        protocolActions = JSON.parse(data);
        
        for (const action of protocolActions) {
            actionsByName.set(action.name.toLowerCase(), action);
            if (action.commandId) {
                actionsByCommandId.set(action.commandId, action);
            }
        }
        
        console.error(`[evony-rte] Loaded ${protocolActions.length} protocol actions`);
    } catch (error) {
        console.error(`[evony-rte] Failed to load protocol database: ${error.message}`);
    }
}

/**
 * Look up protocol action by name or command ID
 */
function lookupProtocol(identifier) {
    // Try by name first
    const byName = actionsByName.get(identifier.toLowerCase());
    if (byName) return byName;
    
    // Try by command ID
    const commandId = parseInt(identifier);
    if (!isNaN(commandId)) {
        const byId = actionsByCommandId.get(commandId);
        if (byId) return byId;
    }
    
    // Partial match
    for (const [name, action] of actionsByName) {
        if (name.includes(identifier.toLowerCase())) {
            return action;
        }
    }
    
    return null;
}

/**
 * Search protocol actions
 */
function searchProtocol(query, category = null) {
    const queryLower = query.toLowerCase();
    const results = [];
    
    for (const action of protocolActions) {
        let match = false;
        
        if (action.name.toLowerCase().includes(queryLower)) {
            match = true;
        } else if (action.description && action.description.toLowerCase().includes(queryLower)) {
            match = true;
        }
        
        if (match && (!category || action.category === category)) {
            results.push({
                name: action.name,
                commandId: action.commandId,
                category: action.category,
                description: action.description
            });
        }
    }
    
    return results.slice(0, 20);
}

/**
 * AMF3 Type Constants
 */
const AMF3_TYPES = {
    UNDEFINED: 0x00,
    NULL: 0x01,
    FALSE: 0x02,
    TRUE: 0x03,
    INTEGER: 0x04,
    DOUBLE: 0x05,
    STRING: 0x06,
    XML_DOC: 0x07,
    DATE: 0x08,
    ARRAY: 0x09,
    OBJECT: 0x0A,
    XML: 0x0B,
    BYTE_ARRAY: 0x0C,
    VECTOR_INT: 0x0D,
    VECTOR_UINT: 0x0E,
    VECTOR_DOUBLE: 0x0F,
    VECTOR_OBJECT: 0x10,
    DICTIONARY: 0x11
};

/**
 * Decode AMF3 packet (simplified decoder)
 */
function decodePacket(hexData) {
    try {
        // Remove whitespace and convert to buffer
        const cleanHex = hexData.replace(/\s/g, '');
        const buffer = Buffer.from(cleanHex, 'hex');
        
        if (buffer.length < 4) {
            return { error: 'Packet too short' };
        }
        
        // Read header
        const header = {
            version: buffer.readUInt8(0),
            headerCount: buffer.readUInt8(1),
            messageCount: buffer.readUInt8(2)
        };
        
        // Attempt to decode body
        let offset = 3;
        const messages = [];
        
        for (let i = 0; i < Math.min(header.messageCount, 10); i++) {
            if (offset >= buffer.length) break;
            
            const typeMarker = buffer.readUInt8(offset);
            offset++;
            
            const message = {
                type: typeMarker,
                typeName: getTypeName(typeMarker)
            };
            
            // Try to extract string data
            if (typeMarker === AMF3_TYPES.STRING && offset < buffer.length) {
                const strLen = buffer.readUInt8(offset);
                offset++;
                if (offset + strLen <= buffer.length) {
                    message.value = buffer.toString('utf8', offset, offset + strLen);
                    offset += strLen;
                }
            }
            
            messages.push(message);
        }
        
        // Try to identify action
        let action = null;
        for (const msg of messages) {
            if (msg.value && typeof msg.value === 'string') {
                const lookup = lookupProtocol(msg.value);
                if (lookup) {
                    action = lookup.name;
                    break;
                }
            }
        }
        
        return {
            header,
            messages,
            action,
            rawLength: buffer.length
        };
        
    } catch (error) {
        return { error: error.message };
    }
}

function getTypeName(typeMarker) {
    for (const [name, value] of Object.entries(AMF3_TYPES)) {
        if (value === typeMarker) return name;
    }
    return `UNKNOWN(${typeMarker})`;
}

/**
 * Analyze traffic patterns
 */
function analyzeTraffic(packets) {
    const analysis = {
        totalPackets: packets.length,
        byAction: {},
        byDirection: { inbound: 0, outbound: 0 },
        timeline: [],
        patterns: []
    };
    
    for (const packet of packets) {
        // Count by action
        if (packet.action) {
            analysis.byAction[packet.action] = (analysis.byAction[packet.action] || 0) + 1;
        }
        
        // Count by direction
        if (packet.direction) {
            analysis.byDirection[packet.direction]++;
        }
    }
    
    // Detect patterns
    const actionSequence = packets.map(p => p.action).filter(Boolean);
    const patternCounts = {};
    
    for (let i = 0; i < actionSequence.length - 1; i++) {
        const pattern = `${actionSequence[i]} -> ${actionSequence[i + 1]}`;
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    }
    
    // Find common patterns
    for (const [pattern, count] of Object.entries(patternCounts)) {
        if (count >= 3) {
            analysis.patterns.push({ pattern, count });
        }
    }
    
    analysis.patterns.sort((a, b) => b.count - a.count);
    
    return analysis;
}

// MCP Server Implementation
const tools = [
    {
        name: 'protocol_lookup',
        description: 'Look up an Evony protocol action by name or command ID. Returns full action details including request/response schema.',
        inputSchema: {
            type: 'object',
            properties: {
                identifier: {
                    type: 'string',
                    description: 'Action name (e.g., "city.getInfo") or command ID (e.g., "1001")'
                }
            },
            required: ['identifier']
        }
    },
    {
        name: 'protocol_search',
        description: 'Search for protocol actions by keyword or category.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query'
                },
                category: {
                    type: 'string',
                    description: 'Optional category filter (e.g., "city", "hero", "army")'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'decode_packet',
        description: 'Decode an AMF3 packet from hex data. Returns decoded structure and identified action.',
        inputSchema: {
            type: 'object',
            properties: {
                hexData: {
                    type: 'string',
                    description: 'Hex-encoded packet data'
                }
            },
            required: ['hexData']
        }
    },
    {
        name: 'analyze_traffic',
        description: 'Analyze traffic patterns from a list of captured packets.',
        inputSchema: {
            type: 'object',
            properties: {
                packets: {
                    type: 'array',
                    description: 'Array of packet objects with action and direction fields',
                    items: {
                        type: 'object'
                    }
                }
            },
            required: ['packets']
        }
    }
];

/**
 * Handle tool calls
 */
function handleToolCall(name, args) {
    switch (name) {
        case 'protocol_lookup':
            const action = lookupProtocol(args.identifier);
            return action ? { found: true, action } : { found: false, message: 'Action not found' };
            
        case 'protocol_search':
            return {
                results: searchProtocol(args.query, args.category)
            };
            
        case 'decode_packet':
            return decodePacket(args.hexData);
            
        case 'analyze_traffic':
            return analyzeTraffic(args.packets || []);
            
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
                            name: 'evony-rte',
                            version: '1.0.0'
                        }
                    }
                };
                
            case 'initialized':
                return null;
                
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
    await loadProtocolDatabase();
    
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
            console.error(`[evony-rte] Error processing message: ${error.message}`);
        }
    });
    
    rl.on('close', () => {
        process.exit(0);
    });
    
    console.error('[evony-rte] Server started');
}

main().catch(error => {
    console.error(`[evony-rte] Fatal error: ${error.message}`);
    process.exit(1);
});
