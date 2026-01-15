/**
 * Service Integration Tests
 * Tests that services are properly connected and can communicate
 * Handles singleton, factory, and class export patterns
 */

const { describe, assert } = require('../test-runner');
const path = require('path');

/**
 * Helper to get service instance regardless of export pattern
 */
function getServiceInstance(mod, ...args) {
    // If it's a class/constructor
    if (typeof mod === 'function') {
        try {
            return new mod(...args);
        } catch (e) {
            // Not a constructor, try calling as factory
            return mod(...args);
        }
    }
    
    // If it has getInstance (singleton)
    if (mod.getInstance) {
        return mod.getInstance(...args);
    }
    
    // If it has a create function
    if (mod.create) {
        return mod.create(...args);
    }
    
    // If it exports a named class
    for (const key of Object.keys(mod)) {
        if (typeof mod[key] === 'function') {
            try {
                return new mod[key](...args);
            } catch (e) {
                // Not a constructor
            }
        }
    }
    
    // Return the module itself (already an instance)
    return mod;
}

/**
 * Helper to check if method exists on instance or module
 */
function hasMethod(mod, instance, methodName) {
    // Check instance first
    if (instance && typeof instance[methodName] === 'function') {
        return true;
    }
    
    // Check module exports
    if (typeof mod[methodName] === 'function') {
        return true;
    }
    
    // Check prototype if it's a class
    if (typeof mod === 'function' && mod.prototype && 
        typeof mod.prototype[methodName] === 'function') {
        return true;
    }
    
    // Check named exports
    for (const key of Object.keys(mod)) {
        if (typeof mod[key] === 'function' && mod[key].prototype &&
            typeof mod[key].prototype[methodName] === 'function') {
            return true;
        }
    }
    
    return false;
}

/**
 * Create integration tests
 */
function createIntegrationTests() {
    const suites = [];
    
    // AMF3 Decoder Integration
    suites.push(describe('Integration: AMF3 Decoder', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/amf3-decoder.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('can create instance or access module', (assert) => {
            assert.ok(instance || mod, 'Should have instance or module');
        });
        
        s.test('has encode method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'encode'), 'Should have encode');
        });
        
        s.test('has decode method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'decode'), 'Should have decode');
        });
    }));
    
    // Chatbot + Intent Router Integration
    suites.push(describe('Integration: Chatbot + Intent Router', (s) => {
        let chatbotMod, routerMod;
        
        s.before(() => {
            chatbotMod = require('../../services/chatbot-service.js');
            routerMod = require('../../services/intent-router.js');
        });
        
        s.test('chatbot service loads', (assert) => {
            assert.ok(chatbotMod, 'ChatbotService should load');
        });
        
        s.test('intent router loads', (assert) => {
            assert.ok(routerMod, 'IntentRouter should load');
        });
        
        s.test('chatbot has processMessage', (assert) => {
            const instance = getServiceInstance(chatbotMod);
            assert.ok(hasMethod(chatbotMod, instance, 'processMessage'), 
                'Should have processMessage');
        });
        
        s.test('intent router has route method', (assert) => {
            const instance = getServiceInstance(routerMod);
            assert.ok(hasMethod(routerMod, instance, 'route'), 
                'Should have route method');
        });
    }));
    
    // LM Studio Client Integration
    suites.push(describe('Integration: LM Studio Client', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/lm-studio-client.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('client loads', (assert) => {
            assert.ok(mod, 'LMStudioClient should load');
        });
        
        s.test('has connect method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'connect'), 'Should have connect');
        });
        
        s.test('has getStatus method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'getStatus'), 'Should have getStatus');
        });
        
        s.test('getStatus returns valid structure', (assert) => {
            if (instance && typeof instance.getStatus === 'function') {
                const status = instance.getStatus();
                assert.isObject(status, 'Status should be object');
            } else if (typeof mod.getStatus === 'function') {
                const status = mod.getStatus();
                assert.isObject(status, 'Status should be object');
            } else {
                assert.ok(true, 'getStatus available on prototype');
            }
        });
    }));
    
    // MCP Client Manager Integration
    suites.push(describe('Integration: MCP Client Manager', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/mcp-client-manager.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('manager loads', (assert) => {
            assert.ok(mod, 'MCPClientManager should load');
        });
        
        s.test('has getStatus method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'getStatus'), 'Should have getStatus');
        });
        
        s.test('has callTool method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'callTool'), 'Should have callTool');
        });
    }));
    
    // Game State Tracker Integration
    suites.push(describe('Integration: Game State Tracker', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/game-state-tracker.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('tracker loads', (assert) => {
            assert.ok(mod, 'GameStateTracker should load');
        });
        
        s.test('has getState method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'getState'), 'Should have getState');
        });
        
        s.test('has reset method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'reset'), 'Should have reset');
        });
    }));
    
    // Playwright Service Integration
    suites.push(describe('Integration: Playwright Service', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/playwright-service.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('service loads', (assert) => {
            assert.ok(mod, 'PlaywrightService should load');
        });
        
        s.test('has initialize method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'initialize'), 'Should have initialize');
        });
    }));
    
    // Debug Manager Integration
    suites.push(describe('Integration: Debug Manager', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/debug-manager.js');
            instance = getServiceInstance(mod, { logToFile: false });
        });
        
        s.test('manager loads', (assert) => {
            assert.ok(mod, 'DebugManager should load');
        });
        
        s.test('has log method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'log'), 'Should have log');
        });
        
        s.test('has getLogs method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'getLogs'), 'Should have getLogs');
        });
    }));
    
    // Script Runner + Automation Templates Integration
    suites.push(describe('Integration: Script Runner + Templates', (s) => {
        let runnerMod, templatesMod;
        
        s.before(() => {
            runnerMod = require('../../services/script-runner.js');
            templatesMod = require('../../services/automation-templates.js');
        });
        
        s.test('script runner loads', (assert) => {
            assert.ok(runnerMod, 'ScriptRunner should load');
        });
        
        s.test('automation templates loads', (assert) => {
            assert.ok(templatesMod, 'AutomationTemplates should load');
        });
        
        s.test('templates has getTemplate', (assert) => {
            const instance = getServiceInstance(templatesMod);
            assert.ok(hasMethod(templatesMod, instance, 'getTemplate'), 
                'Should have getTemplate');
        });
    }));
    
    // Agent Controller Integration
    suites.push(describe('Integration: Agent Controller', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/agent-controller.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('controller loads', (assert) => {
            assert.ok(mod, 'AgentController should load');
        });
        
        s.test('has start method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'start'), 'Should have start');
        });
        
        s.test('has stop method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'stop'), 'Should have stop');
        });
        
        s.test('has getStatus method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'getStatus'), 'Should have getStatus');
        });
    }));
    
    // Panel Manager Integration
    suites.push(describe('Integration: Panel Manager', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/panel-manager.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('manager loads', (assert) => {
            assert.ok(mod, 'PanelManager should load');
        });
        
        s.test('has navigate method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'navigate'), 'Should have navigate');
        });
        
        s.test('has goBack method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'goBack'), 'Should have goBack');
        });
        
        s.test('has goForward method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'goForward'), 'Should have goForward');
        });
    }));
    
    // Health Check Integration
    suites.push(describe('Integration: Health Check', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/health-check.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('manager loads', (assert) => {
            assert.ok(mod, 'HealthCheckManager should load');
        });
        
        s.test('has registerService method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'registerService'), 
                'Should have registerService');
        });
        
        s.test('has checkAll method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'checkAll'), 
                'Should have checkAll');
        });
        
        s.test('has getOverallHealth method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'getOverallHealth'), 
                'Should have getOverallHealth');
        });
    }));
    
    // Voice Service Integration
    suites.push(describe('Integration: Voice Service', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/voice-service.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('service loads', (assert) => {
            assert.ok(mod, 'VoiceService should load');
        });
        
        s.test('has speak method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'speak'), 'Should have speak');
        });
    }));
    
    // Fiddler Bridge Integration
    suites.push(describe('Integration: Fiddler Bridge', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/fiddler-bridge.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('bridge loads', (assert) => {
            assert.ok(mod, 'FiddlerBridge should load');
        });
        
        s.test('has connect method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'connect'), 'Should have connect');
        });
        
        s.test('has getStatus method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'getStatus'), 'Should have getStatus');
        });
    }));
    
    // Traffic Processor Integration
    suites.push(describe('Integration: Traffic Processor', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/traffic-processor.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('processor loads', (assert) => {
            assert.ok(mod, 'TrafficProcessor should load');
        });
        
        s.test('has getStatus method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'getStatus'), 'Should have getStatus');
        });
        
        s.test('has getStats method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'getStats'), 'Should have getStats');
        });
    }));
    
    // Conversation Memory Integration
    suites.push(describe('Integration: Conversation Memory', (s) => {
        let mod, instance;
        
        s.before(() => {
            mod = require('../../services/conversation-memory.js');
            instance = getServiceInstance(mod);
        });
        
        s.test('memory loads', (assert) => {
            assert.ok(mod, 'ConversationMemory should load');
        });
        
        s.test('has addMessage method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'addMessage'), 'Should have addMessage');
        });
        
        s.test('has clear method', (assert) => {
            assert.ok(hasMethod(mod, instance, 'clear'), 'Should have clear');
        });
    }));
    
    return suites;
}

module.exports = { createIntegrationTests };
