/**
 * Complete AMF3 Decoder
 * Implements full AMF3 specification with all data types and reference handling
 */

// AMF3 Type Markers
const AMF3_TYPE = {
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

// Reverse lookup for type names
const TYPE_NAMES = Object.fromEntries(
    Object.entries(AMF3_TYPE).map(([k, v]) => [v, k])
);

/**
 * AMF3 Decoding Context - manages reference tables
 */
class AMF3Context {
    constructor() {
        this.stringTable = [];
        this.objectTable = [];
        this.traitsTable = [];
    }
    
    getString(index) {
        return this.stringTable[index];
    }
    
    addString(str) {
        this.stringTable.push(str);
        return this.stringTable.length - 1;
    }
    
    getObject(index) {
        return this.objectTable[index];
    }
    
    addObject(obj) {
        this.objectTable.push(obj);
        return this.objectTable.length - 1;
    }
    
    getTraits(index) {
        return this.traitsTable[index];
    }
    
    addTraits(traits) {
        this.traitsTable.push(traits);
        return this.traitsTable.length - 1;
    }
    
    reset() {
        this.stringTable = [];
        this.objectTable = [];
        this.traitsTable = [];
    }
}

/**
 * AMF3 Decoder Class
 */
class AMF3Decoder {
    constructor() {
        this.context = new AMF3Context();
        this.buffer = null;
        this.offset = 0;
    }
    
    /**
     * Decode AMF3 data from hex string or buffer
     */
    decode(input) {
        this.context.reset();
        
        if (typeof input === 'string') {
            // Remove whitespace and convert hex to buffer
            const cleanHex = input.replace(/\s/g, '');
            this.buffer = Buffer.from(cleanHex, 'hex');
        } else if (Buffer.isBuffer(input)) {
            this.buffer = input;
        } else {
            throw new Error('Input must be hex string or Buffer');
        }
        
        this.offset = 0;
        
        try {
            return this.decodeValue();
        } catch (error) {
            return {
                error: error.message,
                offset: this.offset,
                partialData: this.buffer.slice(0, Math.min(100, this.buffer.length)).toString('hex')
            };
        }
    }
    
    /**
     * Decode AMF packet with header
     */
    decodePacket(input) {
        this.context.reset();
        
        if (typeof input === 'string') {
            const cleanHex = input.replace(/\s/g, '');
            this.buffer = Buffer.from(cleanHex, 'hex');
        } else {
            this.buffer = input;
        }
        
        this.offset = 0;
        
        try {
            // Read AMF packet header
            const version = this.readUInt16();
            const headerCount = this.readUInt16();
            
            const headers = [];
            for (let i = 0; i < headerCount; i++) {
                headers.push(this.decodeHeader());
            }
            
            const messageCount = this.readUInt16();
            const messages = [];
            
            for (let i = 0; i < messageCount; i++) {
                messages.push(this.decodeMessage());
            }
            
            return {
                version,
                headers,
                messages,
                rawLength: this.buffer.length
            };
        } catch (error) {
            return {
                error: error.message,
                offset: this.offset,
                rawLength: this.buffer.length
            };
        }
    }
    
    /**
     * Decode AMF header
     */
    decodeHeader() {
        const name = this.decodeAMF0String();
        const mustUnderstand = this.readUInt8() !== 0;
        const length = this.readUInt32();
        
        // Switch to AMF3 if needed
        const marker = this.readUInt8();
        let value;
        
        if (marker === 0x11) {
            // AMF3 marker
            value = this.decodeValue();
        } else {
            this.offset--;
            value = this.decodeAMF0Value();
        }
        
        return { name, mustUnderstand, value };
    }
    
    /**
     * Decode AMF message
     */
    decodeMessage() {
        const targetURI = this.decodeAMF0String();
        const responseURI = this.decodeAMF0String();
        const length = this.readUInt32();
        
        const startOffset = this.offset;
        
        // Check for AMF3 marker
        const marker = this.readUInt8();
        let value;
        
        if (marker === 0x11) {
            // AMF3 marker
            value = this.decodeValue();
        } else {
            this.offset--;
            value = this.decodeAMF0Value();
        }
        
        return { targetURI, responseURI, value };
    }
    
    /**
     * Decode AMF0 string (used in headers)
     */
    decodeAMF0String() {
        const length = this.readUInt16();
        const str = this.buffer.toString('utf8', this.offset, this.offset + length);
        this.offset += length;
        return str;
    }
    
    /**
     * Decode AMF0 value (fallback for AMF0 content)
     */
    decodeAMF0Value() {
        const type = this.readUInt8();
        
        switch (type) {
            case 0x00: // Number
                return this.readDouble();
            case 0x01: // Boolean
                return this.readUInt8() !== 0;
            case 0x02: // String
                return this.decodeAMF0String();
            case 0x03: // Object
                return this.decodeAMF0Object();
            case 0x05: // Null
                return null;
            case 0x06: // Undefined
                return undefined;
            case 0x08: // ECMA Array
                return this.decodeAMF0ECMAArray();
            case 0x0A: // Strict Array
                return this.decodeAMF0StrictArray();
            case 0x0B: // Date
                return new Date(this.readDouble());
            case 0x11: // AMF3 marker - switch to AMF3
                return this.decodeValue();
            default:
                throw new Error(`Unknown AMF0 type: 0x${type.toString(16)}`);
        }
    }
    
    /**
     * Decode AMF0 object
     */
    decodeAMF0Object() {
        const obj = {};
        
        while (true) {
            const key = this.decodeAMF0String();
            const type = this.readUInt8();
            
            if (type === 0x09) break; // Object end marker
            
            this.offset--;
            obj[key] = this.decodeAMF0Value();
        }
        
        return obj;
    }
    
    /**
     * Decode AMF0 ECMA Array
     */
    decodeAMF0ECMAArray() {
        const count = this.readUInt32();
        return this.decodeAMF0Object();
    }
    
    /**
     * Decode AMF0 Strict Array
     */
    decodeAMF0StrictArray() {
        const count = this.readUInt32();
        const arr = [];
        
        for (let i = 0; i < count; i++) {
            arr.push(this.decodeAMF0Value());
        }
        
        return arr;
    }
    
    /**
     * Decode AMF3 value based on type marker
     */
    decodeValue() {
        if (this.offset >= this.buffer.length) {
            throw new Error('Unexpected end of buffer');
        }
        
        const type = this.readUInt8();
        
        switch (type) {
            case AMF3_TYPE.UNDEFINED:
                return undefined;
            case AMF3_TYPE.NULL:
                return null;
            case AMF3_TYPE.FALSE:
                return false;
            case AMF3_TYPE.TRUE:
                return true;
            case AMF3_TYPE.INTEGER:
                return this.decodeInteger();
            case AMF3_TYPE.DOUBLE:
                return this.readDouble();
            case AMF3_TYPE.STRING:
                return this.decodeString();
            case AMF3_TYPE.XML_DOC:
                return this.decodeXMLDoc();
            case AMF3_TYPE.DATE:
                return this.decodeDate();
            case AMF3_TYPE.ARRAY:
                return this.decodeArray();
            case AMF3_TYPE.OBJECT:
                return this.decodeObject();
            case AMF3_TYPE.XML:
                return this.decodeXML();
            case AMF3_TYPE.BYTE_ARRAY:
                return this.decodeByteArray();
            case AMF3_TYPE.VECTOR_INT:
                return this.decodeVectorInt();
            case AMF3_TYPE.VECTOR_UINT:
                return this.decodeVectorUint();
            case AMF3_TYPE.VECTOR_DOUBLE:
                return this.decodeVectorDouble();
            case AMF3_TYPE.VECTOR_OBJECT:
                return this.decodeVectorObject();
            case AMF3_TYPE.DICTIONARY:
                return this.decodeDictionary();
            default:
                throw new Error(`Unknown AMF3 type: 0x${type.toString(16)} at offset ${this.offset - 1}`);
        }
    }
    
    /**
     * Decode U29 integer (variable-length encoding)
     */
    decodeU29() {
        let result = 0;
        
        for (let i = 0; i < 4; i++) {
            const byte = this.readUInt8();
            
            if (i < 3) {
                result = (result << 7) | (byte & 0x7F);
                if ((byte & 0x80) === 0) {
                    return result;
                }
            } else {
                // Last byte uses all 8 bits
                result = (result << 8) | byte;
            }
        }
        
        return result;
    }
    
    /**
     * Decode AMF3 integer
     */
    decodeInteger() {
        let value = this.decodeU29();
        
        // Sign extend if needed (29-bit signed integer)
        if (value & 0x10000000) {
            value -= 0x20000000;
        }
        
        return value;
    }
    
    /**
     * Decode AMF3 string
     */
    decodeString() {
        const ref = this.decodeU29();
        
        // Check if reference
        if ((ref & 1) === 0) {
            return this.context.getString(ref >> 1);
        }
        
        const length = ref >> 1;
        
        if (length === 0) {
            return '';
        }
        
        const str = this.buffer.toString('utf8', this.offset, this.offset + length);
        this.offset += length;
        
        this.context.addString(str);
        return str;
    }
    
    /**
     * Decode AMF3 XML Document
     */
    decodeXMLDoc() {
        const ref = this.decodeU29();
        
        if ((ref & 1) === 0) {
            return this.context.getObject(ref >> 1);
        }
        
        const length = ref >> 1;
        const xml = this.buffer.toString('utf8', this.offset, this.offset + length);
        this.offset += length;
        
        const result = { __type: 'XMLDocument', value: xml };
        this.context.addObject(result);
        return result;
    }
    
    /**
     * Decode AMF3 Date
     */
    decodeDate() {
        const ref = this.decodeU29();
        
        if ((ref & 1) === 0) {
            return this.context.getObject(ref >> 1);
        }
        
        const timestamp = this.readDouble();
        const date = new Date(timestamp);
        
        this.context.addObject(date);
        return date;
    }
    
    /**
     * Decode AMF3 Array
     */
    decodeArray() {
        const ref = this.decodeU29();
        
        if ((ref & 1) === 0) {
            return this.context.getObject(ref >> 1);
        }
        
        const denseCount = ref >> 1;
        const arr = [];
        
        // Add to object table first (for circular references)
        this.context.addObject(arr);
        
        // Decode associative portion (key-value pairs)
        let key = this.decodeString();
        while (key !== '') {
            arr[key] = this.decodeValue();
            key = this.decodeString();
        }
        
        // Decode dense portion
        for (let i = 0; i < denseCount; i++) {
            arr.push(this.decodeValue());
        }
        
        return arr;
    }
    
    /**
     * Decode AMF3 Object
     */
    decodeObject() {
        const ref = this.decodeU29();
        
        if ((ref & 1) === 0) {
            return this.context.getObject(ref >> 1);
        }
        
        let traits;
        
        if ((ref & 2) === 0) {
            // Traits reference
            traits = this.context.getTraits(ref >> 2);
        } else {
            // Inline traits
            const externalizable = (ref & 4) !== 0;
            const dynamic = (ref & 8) !== 0;
            const sealedCount = ref >> 4;
            
            const className = this.decodeString();
            const sealedMembers = [];
            
            for (let i = 0; i < sealedCount; i++) {
                sealedMembers.push(this.decodeString());
            }
            
            traits = {
                className,
                externalizable,
                dynamic,
                sealedMembers
            };
            
            this.context.addTraits(traits);
        }
        
        const obj = {};
        
        // Add class name if present
        if (traits.className) {
            obj.__class = traits.className;
        }
        
        // Add to object table first (for circular references)
        this.context.addObject(obj);
        
        if (traits.externalizable) {
            // Externalizable objects handle their own serialization
            obj.__externalizable = true;
            obj.__data = this.decodeValue();
        } else {
            // Decode sealed members
            for (const member of traits.sealedMembers) {
                obj[member] = this.decodeValue();
            }
            
            // Decode dynamic members
            if (traits.dynamic) {
                let key = this.decodeString();
                while (key !== '') {
                    obj[key] = this.decodeValue();
                    key = this.decodeString();
                }
            }
        }
        
        return obj;
    }
    
    /**
     * Decode AMF3 XML
     */
    decodeXML() {
        const ref = this.decodeU29();
        
        if ((ref & 1) === 0) {
            return this.context.getObject(ref >> 1);
        }
        
        const length = ref >> 1;
        const xml = this.buffer.toString('utf8', this.offset, this.offset + length);
        this.offset += length;
        
        const result = { __type: 'XML', value: xml };
        this.context.addObject(result);
        return result;
    }
    
    /**
     * Decode AMF3 ByteArray
     */
    decodeByteArray() {
        const ref = this.decodeU29();
        
        if ((ref & 1) === 0) {
            return this.context.getObject(ref >> 1);
        }
        
        const length = ref >> 1;
        const bytes = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        
        const result = {
            __type: 'ByteArray',
            length: length,
            hex: bytes.toString('hex'),
            data: Array.from(bytes)
        };
        
        this.context.addObject(result);
        return result;
    }
    
    /**
     * Decode AMF3 Vector<int>
     */
    decodeVectorInt() {
        const ref = this.decodeU29();
        
        if ((ref & 1) === 0) {
            return this.context.getObject(ref >> 1);
        }
        
        const count = ref >> 1;
        const fixed = this.readUInt8() !== 0;
        const vector = [];
        
        this.context.addObject(vector);
        
        for (let i = 0; i < count; i++) {
            vector.push(this.readInt32());
        }
        
        vector.__type = 'Vector<int>';
        vector.__fixed = fixed;
        return vector;
    }
    
    /**
     * Decode AMF3 Vector<uint>
     */
    decodeVectorUint() {
        const ref = this.decodeU29();
        
        if ((ref & 1) === 0) {
            return this.context.getObject(ref >> 1);
        }
        
        const count = ref >> 1;
        const fixed = this.readUInt8() !== 0;
        const vector = [];
        
        this.context.addObject(vector);
        
        for (let i = 0; i < count; i++) {
            vector.push(this.readUInt32());
        }
        
        vector.__type = 'Vector<uint>';
        vector.__fixed = fixed;
        return vector;
    }
    
    /**
     * Decode AMF3 Vector<double>
     */
    decodeVectorDouble() {
        const ref = this.decodeU29();
        
        if ((ref & 1) === 0) {
            return this.context.getObject(ref >> 1);
        }
        
        const count = ref >> 1;
        const fixed = this.readUInt8() !== 0;
        const vector = [];
        
        this.context.addObject(vector);
        
        for (let i = 0; i < count; i++) {
            vector.push(this.readDouble());
        }
        
        vector.__type = 'Vector<double>';
        vector.__fixed = fixed;
        return vector;
    }
    
    /**
     * Decode AMF3 Vector<Object>
     */
    decodeVectorObject() {
        const ref = this.decodeU29();
        
        if ((ref & 1) === 0) {
            return this.context.getObject(ref >> 1);
        }
        
        const count = ref >> 1;
        const fixed = this.readUInt8() !== 0;
        const typeName = this.decodeString();
        const vector = [];
        
        this.context.addObject(vector);
        
        for (let i = 0; i < count; i++) {
            vector.push(this.decodeValue());
        }
        
        vector.__type = `Vector<${typeName || 'Object'}>`;
        vector.__fixed = fixed;
        return vector;
    }
    
    /**
     * Decode AMF3 Dictionary
     */
    decodeDictionary() {
        const ref = this.decodeU29();
        
        if ((ref & 1) === 0) {
            return this.context.getObject(ref >> 1);
        }
        
        const count = ref >> 1;
        const weakKeys = this.readUInt8() !== 0;
        const dict = new Map();
        
        this.context.addObject(dict);
        
        for (let i = 0; i < count; i++) {
            const key = this.decodeValue();
            const value = this.decodeValue();
            dict.set(key, value);
        }
        
        // Convert to object for JSON serialization
        const result = {
            __type: 'Dictionary',
            __weakKeys: weakKeys,
            entries: Array.from(dict.entries()).map(([k, v]) => ({ key: k, value: v }))
        };
        
        return result;
    }
    
    // Buffer reading helpers
    readUInt8() {
        const value = this.buffer.readUInt8(this.offset);
        this.offset += 1;
        return value;
    }
    
    readInt8() {
        const value = this.buffer.readInt8(this.offset);
        this.offset += 1;
        return value;
    }
    
    readUInt16() {
        const value = this.buffer.readUInt16BE(this.offset);
        this.offset += 2;
        return value;
    }
    
    readInt16() {
        const value = this.buffer.readInt16BE(this.offset);
        this.offset += 2;
        return value;
    }
    
    readUInt32() {
        const value = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return value;
    }
    
    readInt32() {
        const value = this.buffer.readInt32BE(this.offset);
        this.offset += 4;
        return value;
    }
    
    readDouble() {
        const value = this.buffer.readDoubleBE(this.offset);
        this.offset += 8;
        return value;
    }
}

/**
 * AMF3 Encoder Class
 */
class AMF3Encoder {
    constructor() {
        this.context = new AMF3Context();
        this.chunks = [];
    }
    
    /**
     * Encode value to AMF3 buffer
     */
    encode(value) {
        this.context.reset();
        this.chunks = [];
        
        this.encodeValue(value);
        
        return Buffer.concat(this.chunks);
    }
    
    /**
     * Encode AMF packet with header
     */
    encodePacket(messages, headers = []) {
        this.context.reset();
        this.chunks = [];
        
        // AMF version
        this.writeUInt16(3);
        
        // Headers
        this.writeUInt16(headers.length);
        for (const header of headers) {
            this.encodeHeader(header);
        }
        
        // Messages
        this.writeUInt16(messages.length);
        for (const message of messages) {
            this.encodeMessage(message);
        }
        
        return Buffer.concat(this.chunks);
    }
    
    encodeHeader(header) {
        this.encodeAMF0String(header.name);
        this.writeUInt8(header.mustUnderstand ? 1 : 0);
        
        // Placeholder for length
        const lengthPos = this.chunks.length;
        this.writeUInt32(0);
        
        const startLen = this.getTotalLength();
        this.writeUInt8(0x11); // AMF3 marker
        this.encodeValue(header.value);
        
        // Update length
        const length = this.getTotalLength() - startLen;
        this.chunks[lengthPos] = Buffer.alloc(4);
        this.chunks[lengthPos].writeUInt32BE(length, 0);
    }
    
    encodeMessage(message) {
        this.encodeAMF0String(message.targetURI || '');
        this.encodeAMF0String(message.responseURI || '');
        
        // Placeholder for length
        const lengthPos = this.chunks.length;
        this.writeUInt32(0);
        
        const startLen = this.getTotalLength();
        this.writeUInt8(0x11); // AMF3 marker
        this.encodeValue(message.value);
        
        // Update length
        const length = this.getTotalLength() - startLen;
        this.chunks[lengthPos] = Buffer.alloc(4);
        this.chunks[lengthPos].writeUInt32BE(length, 0);
    }
    
    encodeAMF0String(str) {
        const buf = Buffer.from(str, 'utf8');
        this.writeUInt16(buf.length);
        this.chunks.push(buf);
    }
    
    getTotalLength() {
        return this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    }
    
    encodeValue(value) {
        if (value === undefined) {
            this.writeUInt8(AMF3_TYPE.UNDEFINED);
        } else if (value === null) {
            this.writeUInt8(AMF3_TYPE.NULL);
        } else if (typeof value === 'boolean') {
            this.writeUInt8(value ? AMF3_TYPE.TRUE : AMF3_TYPE.FALSE);
        } else if (typeof value === 'number') {
            if (Number.isInteger(value) && value >= -268435456 && value <= 268435455) {
                this.writeUInt8(AMF3_TYPE.INTEGER);
                this.encodeU29(value < 0 ? value + 0x20000000 : value);
            } else {
                this.writeUInt8(AMF3_TYPE.DOUBLE);
                this.writeDouble(value);
            }
        } else if (typeof value === 'string') {
            this.writeUInt8(AMF3_TYPE.STRING);
            this.encodeString(value);
        } else if (value instanceof Date) {
            this.writeUInt8(AMF3_TYPE.DATE);
            this.encodeU29(1); // Inline
            this.writeDouble(value.getTime());
        } else if (Array.isArray(value)) {
            this.writeUInt8(AMF3_TYPE.ARRAY);
            this.encodeArray(value);
        } else if (typeof value === 'object') {
            this.writeUInt8(AMF3_TYPE.OBJECT);
            this.encodeObject(value);
        }
    }
    
    encodeU29(value) {
        if (value < 0x80) {
            this.writeUInt8(value);
        } else if (value < 0x4000) {
            this.writeUInt8((value >> 7) | 0x80);
            this.writeUInt8(value & 0x7F);
        } else if (value < 0x200000) {
            this.writeUInt8((value >> 14) | 0x80);
            this.writeUInt8((value >> 7) | 0x80);
            this.writeUInt8(value & 0x7F);
        } else {
            this.writeUInt8((value >> 22) | 0x80);
            this.writeUInt8((value >> 15) | 0x80);
            this.writeUInt8((value >> 8) | 0x80);
            this.writeUInt8(value & 0xFF);
        }
    }
    
    encodeString(str) {
        if (str === '') {
            this.encodeU29(1); // Empty string, inline
            return;
        }
        
        const buf = Buffer.from(str, 'utf8');
        this.encodeU29((buf.length << 1) | 1);
        this.chunks.push(buf);
    }
    
    encodeArray(arr) {
        this.encodeU29((arr.length << 1) | 1);
        this.encodeString(''); // Empty associative portion
        
        for (const item of arr) {
            this.encodeValue(item);
        }
    }
    
    encodeObject(obj) {
        const keys = Object.keys(obj).filter(k => !k.startsWith('__'));
        
        // Inline traits, dynamic, no sealed members
        this.encodeU29((0 << 4) | 8 | 2 | 1);
        this.encodeString(obj.__class || '');
        
        // Dynamic members
        for (const key of keys) {
            this.encodeString(key);
            this.encodeValue(obj[key]);
        }
        
        this.encodeString(''); // End of dynamic members
    }
    
    // Buffer writing helpers
    writeUInt8(value) {
        const buf = Buffer.alloc(1);
        buf.writeUInt8(value, 0);
        this.chunks.push(buf);
    }
    
    writeUInt16(value) {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(value, 0);
        this.chunks.push(buf);
    }
    
    writeUInt32(value) {
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(value, 0);
        this.chunks.push(buf);
    }
    
    writeDouble(value) {
        const buf = Buffer.alloc(8);
        buf.writeDoubleBE(value, 0);
        this.chunks.push(buf);
    }
}

/**
 * Utility function to get type name
 */
function getTypeName(typeCode) {
    return TYPE_NAMES[typeCode] || `UNKNOWN(0x${typeCode.toString(16)})`;
}

/**
 * Format decoded data for display
 */
function formatDecoded(data, indent = 0) {
    const spaces = '  '.repeat(indent);
    
    if (data === null) return 'null';
    if (data === undefined) return 'undefined';
    if (typeof data === 'boolean') return data.toString();
    if (typeof data === 'number') return data.toString();
    if (typeof data === 'string') return `"${data}"`;
    if (data instanceof Date) return data.toISOString();
    
    if (Array.isArray(data)) {
        if (data.length === 0) return '[]';
        const items = data.map(item => `${spaces}  ${formatDecoded(item, indent + 1)}`);
        return `[\n${items.join(',\n')}\n${spaces}]`;
    }
    
    if (typeof data === 'object') {
        const entries = Object.entries(data)
            .filter(([k]) => !k.startsWith('__'))
            .map(([k, v]) => `${spaces}  "${k}": ${formatDecoded(v, indent + 1)}`);
        
        if (entries.length === 0) return '{}';
        
        let result = '{\n';
        if (data.__class) {
            result = `/* ${data.__class} */ {\n`;
        }
        result += entries.join(',\n');
        result += `\n${spaces}}`;
        return result;
    }
    
    return String(data);
}

module.exports = {
    AMF3Decoder,
    AMF3Encoder,
    AMF3Context,
    AMF3_TYPE,
    TYPE_NAMES,
    getTypeName,
    formatDecoded
};
