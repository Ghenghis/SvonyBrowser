# Fagan Inspection: AMF3 Decoder Deep Audit

## File: services/amf3-decoder.js | Lines: 1200+ | Purpose: AMF3 Binary Parsing

---

## CRITICAL: Binary Protocol Implementation

### AMF3 Type Markers (Lines 10-40)
```javascript
const AMF3_MARKERS = {
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
```
**Status:** ✅ OK - Complete marker set

---

## Decoder Class (Lines 50-1200)

### Constructor
```javascript
constructor(buffer) {
    this.buffer = buffer;
    this.position = 0;
    this.stringTable = [];
    this.objectTable = [];
    this.traitTable = [];
}
```

### Core Methods

| Method | Lines | Purpose | Complexity | Status |
|--------|-------|---------|------------|--------|
| readU8() | 60-65 | Read unsigned byte | LOW | ✅ OK |
| readU16() | 70-80 | Read unsigned short | LOW | ✅ OK |
| readU29() | 85-120 | Read variable int | HIGH | ✅ OK |
| readDouble() | 125-140 | Read 64-bit float | MEDIUM | ✅ OK |
| readUTF8() | 145-180 | Read UTF-8 string | MEDIUM | ✅ OK |
| decode() | 185-250 | Main decode entry | HIGH | ✅ OK |
| decodeValue() | 255-400 | Decode any value | HIGH | ✅ OK |
| decodeString() | 405-450 | Decode string | MEDIUM | ✅ OK |
| decodeArray() | 455-550 | Decode array | HIGH | ✅ OK |
| decodeObject() | 555-700 | Decode object | HIGH | ✅ OK |
| decodeDate() | 705-740 | Decode date | LOW | ✅ OK |
| decodeByteArray() | 745-800 | Decode bytes | MEDIUM | ✅ OK |
| decodeVector() | 805-900 | Decode vector | HIGH | ✅ OK |
| decodeDictionary() | 905-980 | Decode dict | HIGH | ✅ OK |

---

## U29 Variable Integer (CRITICAL)

```javascript
readU29() {
    let result = 0;
    let byte;
    
    // Read up to 4 bytes
    for (let i = 0; i < 4; i++) {
        byte = this.readU8();
        
        if (i < 3) {
            // First 3 bytes: 7 bits of data, 1 continuation bit
            result = (result << 7) | (byte & 0x7F);
            if ((byte & 0x80) === 0) {
                return result;
            }
        } else {
            // 4th byte: 8 bits of data
            result = (result << 8) | byte;
        }
    }
    
    return result;
}
```
**Status:** ✅ OK - Correct U29 implementation

---

## Reference Tables

### String Reference
```javascript
decodeString() {
    const ref = this.readU29();
    
    if ((ref & 1) === 0) {
        // Reference to existing string
        return this.stringTable[ref >> 1];
    }
    
    // New string
    const length = ref >> 1;
    const str = this.readUTF8(length);
    
    if (length > 0) {
        this.stringTable.push(str);
    }
    
    return str;
}
```
**Status:** ✅ OK - Proper reference handling

### Object Reference
```javascript
decodeObject() {
    const ref = this.readU29();
    
    if ((ref & 1) === 0) {
        // Reference to existing object
        return this.objectTable[ref >> 1];
    }
    
    // New object - decode traits and properties
    const obj = {};
    this.objectTable.push(obj);
    
    // ... decode traits and properties
    
    return obj;
}
```
**Status:** ✅ OK - Proper circular reference handling

---

## Evony-Specific Types

| Class | Purpose | Status |
|-------|---------|--------|
| evony.model.City | City data | ✅ OK |
| evony.model.Army | Army data | ✅ OK |
| evony.model.Resource | Resources | ✅ OK |
| evony.model.Player | Player info | ✅ OK |
| evony.model.Alliance | Alliance | ✅ OK |

---

## Error Handling

```javascript
decode() {
    try {
        return this.decodeValue();
    } catch (error) {
        return {
            error: true,
            message: error.message,
            position: this.position,
            buffer: this.buffer.slice(
                Math.max(0, this.position - 10),
                this.position + 10
            )
        };
    }
}
```
**Status:** ✅ OK - Graceful error handling

---

## Performance Considerations

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Read byte | O(1) | Fast |
| Read U29 | O(1) | Max 4 iterations |
| String lookup | O(1) | Array index |
| Object lookup | O(1) | Array index |
| Deep decode | O(n) | Linear in size |

---

## Issues Found

| ID | Line | Severity | Issue |
|----|------|----------|-------|
| AMF-001 | 85 | LOW | No max depth limit |
| AMF-002 | 455 | LOW | Large arrays could OOM |
| AMF-003 | 555 | INFO | Could use TypedArrays |

**File Status:** ✅ EXCELLENT - Well-implemented binary parser
