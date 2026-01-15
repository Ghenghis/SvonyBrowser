/**
 * Service Unit Tests
 * Tests all services for proper loading and method availability
 * Handles singleton, factory, and class export patterns
 */

const { describe, assert } = require('../test-runner');
const path = require('path');

// Service paths
const servicesDir = path.join(__dirname, '../../services');

/**
 * Helper to check if method exists in module (any export pattern)
 */
function moduleHasMethod(mod, methodName) {
    // Direct export
    if (typeof mod[methodName] === 'function') {
        return true;
    }
    
    // Class prototype
    if (typeof mod === 'function' && mod.prototype && 
        typeof mod.prototype[methodName] === 'function') {
        return true;
    }
    
    // Named exports with class
    for (const key of Object.keys(mod)) {
        // Check if it's a class with the method
        if (typeof mod[key] === 'function' && mod[key].prototype &&
            typeof mod[key].prototype[methodName] === 'function') {
            return true;
        }
        // Check if it's an object with the method
        if (typeof mod[key] === 'object' && mod[key] !== null &&
            typeof mod[key][methodName] === 'function') {
            return true;
        }
    }
    
    // Singleton getInstance pattern
    if (mod.getInstance && typeof mod.getInstance === 'function') {
        try {
            const instance = mod.getInstance();
            if (instance && typeof instance[methodName] === 'function') {
                return true;
            }
        } catch (e) {
            // getInstance may require arguments
        }
    }
    
    return false;
}

/**
 * Test service loading and basic structure
 */
function createServiceTests() {
    const suites = [];
    
    // List of all services to test with their actual methods
    const services = [
        { name: 'AMF3 Decoder', file: 'amf3-decoder.js', methods: ['decode', 'encode'] },
        { name: 'Agent Controller', file: 'agent-controller.js', methods: ['start', 'stop', 'getStatus'] },
        { name: 'Automation Templates', file: 'automation-templates.js', methods: ['getTemplate', 'getCategories'] },
        { name: 'Chatbot Plugins', file: 'chatbot-plugins.js', methods: [] }, // Manager pattern
        { name: 'Chatbot Service', file: 'chatbot-service.js', methods: ['initialize', 'processMessage', 'getHistory'] },
        { name: 'Combat Simulator', file: 'combat-simulator.js', methods: ['simulate'] },
        { name: 'Conversation Memory', file: 'conversation-memory.js', methods: ['addMessage', 'clear'] },
        { name: 'Debug Manager', file: 'debug-manager.js', methods: ['log', 'getLogs'] },
        { name: 'Fiddler Bridge', file: 'fiddler-bridge.js', methods: ['connect', 'disconnect', 'getStatus'] },
        { name: 'Game State Tracker', file: 'game-state-tracker.js', methods: ['getState', 'reset'] },
        { name: 'Health Check', file: 'health-check.js', methods: ['registerService', 'checkAll', 'getOverallHealth'] },
        { name: 'Intent Router', file: 'intent-router.js', methods: ['route'] },
        { name: 'LM Studio Client', file: 'lm-studio-client.js', methods: ['connect', 'getStatus'] },
        { name: 'MCP Client Manager', file: 'mcp-client-manager.js', methods: ['callTool', 'getStatus'] },
        { name: 'Network Inspector', file: 'network-inspector.js', methods: ['getRequests', 'clear'] },
        { name: 'Panel Manager', file: 'panel-manager.js', methods: ['navigate', 'goBack', 'goForward'] },
        { name: 'Panel Playwright Bridge', file: 'panel-playwright-bridge.js', methods: ['initialize'] },
        { name: 'Performance Profiler', file: 'performance-profiler.js', methods: ['getMetrics'] },
        { name: 'Playwright Service', file: 'playwright-service.js', methods: ['initialize'] },
        { name: 'Protocol Handler', file: 'protocol-handler.js', methods: ['lookupAction', 'searchActions', 'getCategories'] },
        { name: 'Script Recorder', file: 'script-recorder.js', methods: [] }, // Complex pattern
        { name: 'Script Runner', file: 'script-runner.js', methods: ['getStatus'] },
        { name: 'Session Recorder', file: 'session-recorder.js', methods: ['startRecording', 'stopRecording'] },
        { name: 'Traffic Processor', file: 'traffic-processor.js', methods: ['getStats', 'getStatus'] },
        { name: 'Voice Service', file: 'voice-service.js', methods: ['speak'] }
    ];
    
    // Create test suite for each service
    for (const service of services) {
        const suite = describe(`Service: ${service.name}`, (s) => {
            let module = null;
            
            s.test('loads without error', (assert) => {
                const servicePath = path.join(servicesDir, service.file);
                module = require(servicePath);
                assert.ok(module, 'Module should be defined');
            });
            
            s.test('exports expected structure', (assert) => {
                assert.ok(module, 'Module should be loaded');
                
                // Check if it's a class, function, or object
                const isClass = typeof module === 'function';
                const isObject = typeof module === 'object';
                
                assert.ok(isClass || isObject, 
                    'Module should export a class, function, or object');
            });
            
            // Test each expected method
            for (const method of service.methods) {
                s.test(`has method: ${method}`, (assert) => {
                    assert.ok(module, 'Module should be loaded');
                    assert.ok(moduleHasMethod(module, method), 
                        `Should have method ${method}`);
                });
            }
        });
        
        suites.push(suite);
    }
    
    return suites;
}

module.exports = { createServiceTests };
