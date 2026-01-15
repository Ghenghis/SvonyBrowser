/**
 * Svony Browser - Protocol Handler Service
 * Parse and decode Evony AMF3 protocol packets
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class ProtocolHandler extends EventEmitter {
    constructor() {
        super();
        this.protocolActions = new Map();  // action name -> definition
        this.commandIdMap = new Map();      // command ID -> action name
        this.categoryMap = new Map();       // category -> actions[]
        this.initialized = false;
        this.protocolPath = path.join(__dirname, '../data/protocol-actions.json');
        
        // AMF3 type markers
        this.AMF3_UNDEFINED = 0x00;
        this.AMF3_NULL = 0x01;
        this.AMF3_FALSE = 0x02;
        this.AMF3_TRUE = 0x03;
        this.AMF3_INTEGER = 0x04;
        this.AMF3_DOUBLE = 0x05;
        this.AMF3_STRING = 0x06;
        this.AMF3_XML_DOC = 0x07;
        this.AMF3_DATE = 0x08;
        this.AMF3_ARRAY = 0x09;
        this.AMF3_OBJECT = 0x0A;
        this.AMF3_XML = 0x0B;
        this.AMF3_BYTE_ARRAY = 0x0C;
        this.AMF3_VECTOR_INT = 0x0D;
        this.AMF3_VECTOR_UINT = 0x0E;
        this.AMF3_VECTOR_DOUBLE = 0x0F;
        this.AMF3_VECTOR_OBJECT = 0x10;
        this.AMF3_DICTIONARY = 0x11;
    }

    /**
     * Initialize the protocol handler by loading definitions
     */
    async initialize() {
        try {
            const data = await fs.readFile(this.protocolPath, 'utf8');
            const actions = JSON.parse(data);

            for (const action of actions) {
                this.protocolActions.set(action.name, action);
                
                if (action.commandId) {
                    this.commandIdMap.set(action.commandId, action.name);
                }
                
                // Build category index
                const category = action.category || 'uncategorized';
                if (!this.categoryMap.has(category)) {
                    this.categoryMap.set(category, []);
                }
                this.categoryMap.get(category).push(action.name);
            }

            this.initialized = true;
            this.emit('initialized', { actionCount: this.protocolActions.size });
            console.log(`[ProtocolHandler] Loaded ${this.protocolActions.size} protocol actions`);
            return true;
        } catch (error) {
            console.error('[ProtocolHandler] Failed to initialize:', error.message);
            return false;
        }
    }

    /**
     * Lookup action by name
     */
    lookupAction(actionName) {
        return this.protocolActions.get(actionName) || null;
    }

    /**
     * Lookup action by command ID
     */
    lookupByCommandId(commandId) {
        const name = this.commandIdMap.get(commandId);
        return name ? this.protocolActions.get(name) : null;
    }

    /**
     * Get all actions in a category
     */
    getCategory(category) {
        const actionNames = this.categoryMap.get(category) || [];
        return actionNames.map(name => this.protocolActions.get(name));
    }

    /**
     * Get all categories
     */
    getCategories() {
        return Array.from(this.categoryMap.keys());
    }

    /**
     * Get actions by category
     */
    getActionsByCategory(category) {
        return this.getCategory(category);
    }

    /**
     * Get all actions
     */
    getAllActions() {
        return Array.from(this.protocolActions.values());
    }

    /**
     * Search actions by name or description
     */
    searchActions(query) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        for (const [name, action] of this.protocolActions) {
            if (name.toLowerCase().includes(lowerQuery) || 
                (action.description && action.description.toLowerCase().includes(lowerQuery)) ||
                (action.category && action.category.toLowerCase().includes(lowerQuery))) {
                results.push(action);
            }
        }
        
        return results;
    }

    /**
     * Decode AMF3 buffer to object
     */
    decodeAmf3(buffer) {
        if (!buffer || buffer.length === 0) {
            return null;
        }
        
        // Reset reference tables
        const context = {
            stringRefs: [],
            objectRefs: [],
            traitRefs: [],
            offset: 0
        };
        
        try {
            const result = this.readValue(buffer, context);
            
            // Try to extract action name
            let action = null;
            if (result && typeof result === 'object') {
                action = result.action || result.command || result.method || null;
            }
            
            return {
                action,
                data: result,
                raw: buffer.toString('hex')
            };
        } catch (error) {
            console.error('[ProtocolHandler] AMF3 decode error:', error);
            
            // Fallback: try to find JSON in buffer
            try {
                const jsonStart = buffer.indexOf('{');
                const jsonEnd = buffer.lastIndexOf('}');
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    const jsonStr = buffer.slice(jsonStart, jsonEnd + 1).toString('utf8');
                    const data = JSON.parse(jsonStr);
                    return {
                        action: data.action || null,
                        data: data,
                        raw: buffer.toString('hex')
                    };
                }
            } catch (e) {
                // Not JSON
            }
            
            return {
                action: null,
                data: null,
                error: error.message,
                raw: buffer.toString('hex')
            };
        }
    }

    /**
     * Read AMF3 value from buffer
     */
    readValue(buffer, ctx) {
        if (ctx.offset >= buffer.length) {
            return null;
        }
        
        const type = buffer.readUInt8(ctx.offset++);
        
        switch (type) {
            case this.AMF3_UNDEFINED:
                return undefined;
            case this.AMF3_NULL:
                return null;
            case this.AMF3_FALSE:
                return false;
            case this.AMF3_TRUE:
                return true;
            case this.AMF3_INTEGER:
                return this.readInteger(buffer, ctx);
            case this.AMF3_DOUBLE:
                return this.readDouble(buffer, ctx);
            case this.AMF3_STRING:
                return this.readString(buffer, ctx);
            case this.AMF3_DATE:
                return this.readDate(buffer, ctx);
            case this.AMF3_ARRAY:
                return this.readArray(buffer, ctx);
            case this.AMF3_OBJECT:
                return this.readObject(buffer, ctx);
            case this.AMF3_BYTE_ARRAY:
                return this.readByteArray(buffer, ctx);
            case this.AMF3_XML_DOC:
            case this.AMF3_XML:
                return this.readXml(buffer, ctx);
            case this.AMF3_VECTOR_INT:
            case this.AMF3_VECTOR_UINT:
            case this.AMF3_VECTOR_DOUBLE:
            case this.AMF3_VECTOR_OBJECT:
                return this.readVector(buffer, ctx, type);
            case this.AMF3_DICTIONARY:
                return this.readDictionary(buffer, ctx);
            default:
                throw new Error(`Unknown AMF3 type: 0x${type.toString(16)}`);
        }
    }

    /**
     * Read U29 variable-length integer
     */
    readU29(buffer, ctx) {
        let result = 0;
        let byte = buffer.readUInt8(ctx.offset++);
        
        if (byte < 128) {
            return byte;
        }
        
        result = (byte & 0x7F) << 7;
        byte = buffer.readUInt8(ctx.offset++);
        
        if (byte < 128) {
            return result | byte;
        }
        
        result = (result | (byte & 0x7F)) << 7;
        byte = buffer.readUInt8(ctx.offset++);
        
        if (byte < 128) {
            return result | byte;
        }
        
        result = (result | (byte & 0x7F)) << 8;
        byte = buffer.readUInt8(ctx.offset++);
        
        return result | byte;
    }

    /**
     * Read AMF3 integer
     */
    readInteger(buffer, ctx) {
        const u29 = this.readU29(buffer, ctx);
        
        // Sign extend if necessary
        if (u29 & 0x10000000) {
            return u29 | 0xE0000000;
        }
        
        return u29;
    }

    /**
     * Read AMF3 double
     */
    readDouble(buffer, ctx) {
        const value = buffer.readDoubleBE(ctx.offset);
        ctx.offset += 8;
        return value;
    }

    /**
     * Read AMF3 string
     */
    readString(buffer, ctx) {
        const ref = this.readU29(buffer, ctx);
        
        if ((ref & 1) === 0) {
            // Reference
            return ctx.stringRefs[ref >> 1] || '';
        }
        
        const length = ref >> 1;
        
        if (length === 0) {
            return '';
        }
        
        const str = buffer.toString('utf8', ctx.offset, ctx.offset + length);
        ctx.offset += length;
        ctx.stringRefs.push(str);
        
        return str;
    }

    /**
     * Read AMF3 date
     */
    readDate(buffer, ctx) {
        const ref = this.readU29(buffer, ctx);
        
        if ((ref & 1) === 0) {
            return ctx.objectRefs[ref >> 1];
        }
        
        const timestamp = buffer.readDoubleBE(ctx.offset);
        ctx.offset += 8;
        const date = new Date(timestamp);
        
        ctx.objectRefs.push(date);
        
        return date;
    }

    /**
     * Read AMF3 array
     */
    readArray(buffer, ctx) {
        const ref = this.readU29(buffer, ctx);
        
        if ((ref & 1) === 0) {
            return ctx.objectRefs[ref >> 1];
        }
        
        const denseLength = ref >> 1;
        const result = [];
        
        ctx.objectRefs.push(result);
        
        // Read associative portion
        let key = this.readString(buffer, ctx);
        while (key !== '') {
            result[key] = this.readValue(buffer, ctx);
            key = this.readString(buffer, ctx);
        }
        
        // Read dense portion
        for (let i = 0; i < denseLength; i++) {
            result.push(this.readValue(buffer, ctx));
        }
        
        return result;
    }

    /**
     * Read AMF3 object
     */
    readObject(buffer, ctx) {
        const ref = this.readU29(buffer, ctx);
        
        if ((ref & 1) === 0) {
            return ctx.objectRefs[ref >> 1];
        }
        
        const result = {};
        ctx.objectRefs.push(result);
        
        let traits;
        
        if ((ref & 3) === 1) {
            // Traits reference
            traits = ctx.traitRefs[ref >> 2];
        } else {
            // Inline traits
            const externalizable = (ref & 4) !== 0;
            const dynamic = (ref & 8) !== 0;
            const count = ref >> 4;
            
            const className = this.readString(buffer, ctx);
            
            traits = {
                className,
                externalizable,
                dynamic,
                properties: []
            };
            
            for (let i = 0; i < count; i++) {
                traits.properties.push(this.readString(buffer, ctx));
            }
            
            ctx.traitRefs.push(traits);
        }
        
        if (traits.className) {
            result.__class__ = traits.className;
        }
        
        if (traits.externalizable) {
            result.__externalizable__ = true;
            result.__data__ = this.readValue(buffer, ctx);
        } else {
            // Read sealed properties
            for (const prop of traits.properties) {
                result[prop] = this.readValue(buffer, ctx);
            }
            
            // Read dynamic properties
            if (traits.dynamic) {
                let key = this.readString(buffer, ctx);
                while (key !== '') {
                    result[key] = this.readValue(buffer, ctx);
                    key = this.readString(buffer, ctx);
                }
            }
        }
        
        return result;
    }

    /**
     * Read AMF3 byte array
     */
    readByteArray(buffer, ctx) {
        const ref = this.readU29(buffer, ctx);
        
        if ((ref & 1) === 0) {
            return ctx.objectRefs[ref >> 1];
        }
        
        const length = ref >> 1;
        const bytes = buffer.slice(ctx.offset, ctx.offset + length);
        ctx.offset += length;
        
        ctx.objectRefs.push(bytes);
        
        return bytes;
    }

    /**
     * Read AMF3 XML
     */
    readXml(buffer, ctx) {
        const ref = this.readU29(buffer, ctx);
        
        if ((ref & 1) === 0) {
            return ctx.objectRefs[ref >> 1];
        }
        
        const length = ref >> 1;
        const xml = buffer.toString('utf8', ctx.offset, ctx.offset + length);
        ctx.offset += length;
        
        ctx.objectRefs.push(xml);
        
        return { __xml__: xml };
    }

    /**
     * Read AMF3 vector
     */
    readVector(buffer, ctx, type) {
        const ref = this.readU29(buffer, ctx);
        
        if ((ref & 1) === 0) {
            return ctx.objectRefs[ref >> 1];
        }
        
        const length = ref >> 1;
        const fixed = buffer.readUInt8(ctx.offset++) !== 0;
        const result = [];
        
        ctx.objectRefs.push(result);
        
        if (type === this.AMF3_VECTOR_OBJECT) {
            const typeName = this.readString(buffer, ctx);
            result.__type__ = typeName;
            
            for (let i = 0; i < length; i++) {
                result.push(this.readValue(buffer, ctx));
            }
        } else {
            for (let i = 0; i < length; i++) {
                if (type === this.AMF3_VECTOR_INT) {
                    result.push(buffer.readInt32BE(ctx.offset));
                    ctx.offset += 4;
                } else if (type === this.AMF3_VECTOR_UINT) {
                    result.push(buffer.readUInt32BE(ctx.offset));
                    ctx.offset += 4;
                } else if (type === this.AMF3_VECTOR_DOUBLE) {
                    result.push(buffer.readDoubleBE(ctx.offset));
                    ctx.offset += 8;
                }
            }
        }
        
        result.__fixed__ = fixed;
        
        return result;
    }

    /**
     * Read AMF3 dictionary
     */
    readDictionary(buffer, ctx) {
        const ref = this.readU29(buffer, ctx);
        
        if ((ref & 1) === 0) {
            return ctx.objectRefs[ref >> 1];
        }
        
        const length = ref >> 1;
        const weakKeys = buffer.readUInt8(ctx.offset++) !== 0;
        const result = new Map();
        
        ctx.objectRefs.push(result);
        
        for (let i = 0; i < length; i++) {
            const key = this.readValue(buffer, ctx);
            const value = this.readValue(buffer, ctx);
            result.set(key, value);
        }
        
        result.__weakKeys__ = weakKeys;
        
        return result;
    }

    /**
     * Encode object to AMF3 buffer
     */
    encodeAmf3(action, data) {
        const ctx = {
            stringRefs: new Map(),
            objectRefs: new Map(),
            traitRefs: new Map(),
            chunks: []
        };
        
        const packet = { action, ...data };
        this.writeValue(ctx, packet);
        
        return Buffer.concat(ctx.chunks);
    }

    /**
     * Write AMF3 value
     */
    writeValue(ctx, value) {
        if (value === undefined) {
            this.writeUInt8(ctx, this.AMF3_UNDEFINED);
        } else if (value === null) {
            this.writeUInt8(ctx, this.AMF3_NULL);
        } else if (value === false) {
            this.writeUInt8(ctx, this.AMF3_FALSE);
        } else if (value === true) {
            this.writeUInt8(ctx, this.AMF3_TRUE);
        } else if (typeof value === 'number') {
            if (Number.isInteger(value) && value >= -268435456 && value <= 268435455) {
                this.writeUInt8(ctx, this.AMF3_INTEGER);
                this.writeU29(ctx, value >= 0 ? value : value & 0x1FFFFFFF);
            } else {
                this.writeUInt8(ctx, this.AMF3_DOUBLE);
                this.writeDoubleBE(ctx, value);
            }
        } else if (typeof value === 'string') {
            this.writeUInt8(ctx, this.AMF3_STRING);
            this.writeString(ctx, value);
        } else if (value instanceof Date) {
            this.writeUInt8(ctx, this.AMF3_DATE);
            this.writeU29(ctx, 1);
            this.writeDoubleBE(ctx, value.getTime());
        } else if (Array.isArray(value)) {
            this.writeUInt8(ctx, this.AMF3_ARRAY);
            this.writeArray(ctx, value);
        } else if (Buffer.isBuffer(value)) {
            this.writeUInt8(ctx, this.AMF3_BYTE_ARRAY);
            this.writeU29(ctx, (value.length << 1) | 1);
            ctx.chunks.push(value);
        } else if (typeof value === 'object') {
            this.writeUInt8(ctx, this.AMF3_OBJECT);
            this.writeObject(ctx, value);
        }
    }

    /**
     * Write U29 integer
     */
    writeU29(ctx, value) {
        if (value < 0x80) {
            this.writeUInt8(ctx, value);
        } else if (value < 0x4000) {
            this.writeUInt8(ctx, (value >> 7) | 0x80);
            this.writeUInt8(ctx, value & 0x7F);
        } else if (value < 0x200000) {
            this.writeUInt8(ctx, (value >> 14) | 0x80);
            this.writeUInt8(ctx, (value >> 7) | 0x80);
            this.writeUInt8(ctx, value & 0x7F);
        } else {
            this.writeUInt8(ctx, (value >> 22) | 0x80);
            this.writeUInt8(ctx, (value >> 15) | 0x80);
            this.writeUInt8(ctx, (value >> 8) | 0x80);
            this.writeUInt8(ctx, value & 0xFF);
        }
    }

    /**
     * Write string
     */
    writeString(ctx, value) {
        if (value === '') {
            this.writeU29(ctx, 1);
            return;
        }
        
        const bytes = Buffer.from(value, 'utf8');
        this.writeU29(ctx, (bytes.length << 1) | 1);
        ctx.chunks.push(bytes);
    }

    /**
     * Write array
     */
    writeArray(ctx, value) {
        this.writeU29(ctx, (value.length << 1) | 1);
        this.writeU29(ctx, 1); // Empty associative portion
        
        for (const item of value) {
            this.writeValue(ctx, item);
        }
    }

    /**
     * Write object
     */
    writeObject(ctx, value) {
        const keys = Object.keys(value).filter(k => !k.startsWith('__'));
        
        // Write inline traits (dynamic, no sealed properties)
        this.writeU29(ctx, 0x0B); // 1011 = inline, dynamic, 0 sealed props
        this.writeString(ctx, ''); // Anonymous class
        
        // Write dynamic properties
        for (const key of keys) {
            this.writeString(ctx, key);
            this.writeValue(ctx, value[key]);
        }
        
        this.writeString(ctx, ''); // End of dynamic properties
    }

    /**
     * Write UInt8
     */
    writeUInt8(ctx, value) {
        const buf = Buffer.alloc(1);
        buf.writeUInt8(value);
        ctx.chunks.push(buf);
    }

    /**
     * Write DoubleBE
     */
    writeDoubleBE(ctx, value) {
        const buf = Buffer.alloc(8);
        buf.writeDoubleBE(value);
        ctx.chunks.push(buf);
    }

    /**
     * Generate example request for an action
     */
    generateExampleRequest(actionName) {
        const action = this.lookupAction(actionName);
        if (!action || !action.request) return null;

        const example = {};
        for (const [key, type] of Object.entries(action.request)) {
            switch (type) {
                case 'int':
                case 'long':
                    example[key] = 0;
                    break;
                case 'string':
                    example[key] = '';
                    break;
                case 'boolean':
                    example[key] = false;
                    break;
                case 'object':
                    example[key] = {};
                    break;
                case 'array':
                    example[key] = [];
                    break;
                default:
                    example[key] = null;
            }
        }
        return example;
    }

    /**
     * Format action for display
     */
    formatAction(action) {
        if (!action) return 'Unknown Action';
        
        let text = `## ${action.name}\n\n`;
        text += `**Category:** ${action.category}\n`;
        text += `**Command ID:** ${action.commandId}\n`;
        text += `**Description:** ${action.description}\n\n`;
        
        if (action.request && Object.keys(action.request).length > 0) {
            text += `### Request Parameters\n`;
            for (const [key, type] of Object.entries(action.request)) {
                text += `- \`${key}\`: ${type}\n`;
            }
            text += '\n';
        }
        
        if (action.response && Object.keys(action.response).length > 0) {
            text += `### Response Fields\n`;
            for (const [key, type] of Object.entries(action.response)) {
                text += `- \`${key}\`: ${type}\n`;
            }
        }
        
        return text;
    }

    /**
     * Get protocol statistics
     */
    getStats() {
        return {
            totalActions: this.protocolActions.size,
            categories: this.categoryMap.size,
            initialized: this.initialized
        };
    }
}

module.exports = new ProtocolHandler();
