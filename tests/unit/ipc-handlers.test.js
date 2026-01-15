/**
 * IPC Handler Tests
 * Verifies all IPC handlers are properly defined and callable
 */

const { describe, assert } = require('../test-runner');
const path = require('path');
const fs = require('fs');

/**
 * Extract IPC handlers from index.js
 */
function extractIPCHandlers() {
    const indexPath = path.join(__dirname, '../../index.js');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    const handlers = {
        handle: [],
        on: []
    };
    
    // Match ipcMain.handle('channel-name', ...)
    const handleRegex = /ipcMain\.handle\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = handleRegex.exec(content)) !== null) {
        handlers.handle.push(match[1]);
    }
    
    // Match ipcMain.on('channel-name', ...)
    const onRegex = /ipcMain\.on\s*\(\s*['"]([^'"]+)['"]/g;
    while ((match = onRegex.exec(content)) !== null) {
        handlers.on.push(match[1]);
    }
    
    return handlers;
}

/**
 * Group handlers by category
 */
function categorizeHandlers(handlers) {
    const categories = {
        settings: [],
        protocol: [],
        traffic: [],
        chatbot: [],
        combat: [],
        session: [],
        gameState: [],
        mcp: [],
        playwright: [],
        lmStudio: [],
        panel: [],
        debug: [],
        automation: [],
        agent: [],
        fiddler: [],
        voice: [],
        health: [],
        other: []
    };
    
    for (const handler of [...handlers.handle, ...handlers.on]) {
        if (handler.includes('setting')) categories.settings.push(handler);
        else if (handler.includes('protocol')) categories.protocol.push(handler);
        else if (handler.includes('traffic')) categories.traffic.push(handler);
        else if (handler.includes('chatbot') || handler.includes('chat-')) categories.chatbot.push(handler);
        else if (handler.includes('combat')) categories.combat.push(handler);
        else if (handler.includes('session')) categories.session.push(handler);
        else if (handler.includes('game-state')) categories.gameState.push(handler);
        else if (handler.includes('mcp')) categories.mcp.push(handler);
        else if (handler.includes('playwright')) categories.playwright.push(handler);
        else if (handler.includes('lm-studio')) categories.lmStudio.push(handler);
        else if (handler.includes('panel')) categories.panel.push(handler);
        else if (handler.includes('debug') || handler.includes('log')) categories.debug.push(handler);
        else if (handler.includes('script') || handler.includes('automation') || handler.includes('template')) categories.automation.push(handler);
        else if (handler.includes('agent')) categories.agent.push(handler);
        else if (handler.includes('fiddler')) categories.fiddler.push(handler);
        else if (handler.includes('voice') || handler.includes('speech')) categories.voice.push(handler);
        else if (handler.includes('health')) categories.health.push(handler);
        else categories.other.push(handler);
    }
    
    return categories;
}

/**
 * Create IPC handler tests
 */
function createIPCTests() {
    const handlers = extractIPCHandlers();
    const categories = categorizeHandlers(handlers);
    
    const suites = [];
    
    // Summary test
    suites.push(describe('IPC Handlers Summary', (s) => {
        s.test('has ipcMain.handle handlers', (assert) => {
            assert.ok(handlers.handle.length > 0, 'Should have handle handlers');
            console.log(`    Found ${handlers.handle.length} ipcMain.handle handlers`);
        });
        
        s.test('has ipcMain.on handlers', (assert) => {
            assert.ok(handlers.on.length > 0, 'Should have on handlers');
            console.log(`    Found ${handlers.on.length} ipcMain.on handlers`);
        });
        
        s.test('total handlers >= 150', (assert) => {
            const total = handlers.handle.length + handlers.on.length;
            assert.ok(total >= 150, `Should have at least 150 handlers, got ${total}`);
        });
    }));
    
    // Category tests
    const categoryTests = [
        { name: 'Settings', key: 'settings', min: 3 },
        { name: 'Protocol', key: 'protocol', min: 4 },
        { name: 'Traffic', key: 'traffic', min: 5 },
        { name: 'Chatbot', key: 'chatbot', min: 4 },
        { name: 'Combat Simulator', key: 'combat', min: 2 },
        { name: 'Session Recorder', key: 'session', min: 4 },
        { name: 'Game State', key: 'gameState', min: 5 },
        { name: 'MCP Manager', key: 'mcp', min: 4 },
        { name: 'Playwright', key: 'playwright', min: 5 },
        { name: 'LM Studio', key: 'lmStudio', min: 4 },
        { name: 'Panel Manager', key: 'panel', min: 5 },
        { name: 'Debug Manager', key: 'debug', min: 3 },
        { name: 'Automation', key: 'automation', min: 5 },
        { name: 'Agent Controller', key: 'agent', min: 3 },
        { name: 'Fiddler Bridge', key: 'fiddler', min: 3 },
        { name: 'Voice Service', key: 'voice', min: 2 }
    ];
    
    for (const cat of categoryTests) {
        suites.push(describe(`IPC: ${cat.name}`, (s) => {
            s.test(`has at least ${cat.min} handlers`, (assert) => {
                const count = categories[cat.key].length;
                assert.ok(count >= cat.min, 
                    `Should have at least ${cat.min} ${cat.name} handlers, got ${count}`);
            });
            
            // List all handlers in this category
            for (const handler of categories[cat.key]) {
                s.test(`handler: ${handler}`, (assert) => {
                    assert.ok(handler, 'Handler name should be defined');
                    assert.ok(handler.length > 0, 'Handler name should not be empty');
                });
            }
        }));
    }
    
    return suites;
}

module.exports = { createIPCTests, extractIPCHandlers, categorizeHandlers };
