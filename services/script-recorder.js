/**
 * Script Recorder Service
 * Record user actions for Playwright automation
 * v2.0.9
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

/**
 * Recorded Action
 */
class RecordedAction {
    constructor(type, data) {
        this.id = `action-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.timestamp = Date.now();
        this.type = type;
        this.data = data;
        this.screenshot = null;
        this.notes = '';
    }

    toPlaywright() {
        switch (this.type) {
            case 'click':
                if (this.data.selector) {
                    return `await page.click('${this.data.selector}');`;
                }
                return `await page.click({ x: ${this.data.x}, y: ${this.data.y} });`;
            
            case 'dblclick':
                if (this.data.selector) {
                    return `await page.dblclick('${this.data.selector}');`;
                }
                return `await page.dblclick({ x: ${this.data.x}, y: ${this.data.y} });`;
            
            case 'input':
                return `await page.fill('${this.data.selector}', '${this._escapeString(this.data.value)}');`;
            
            case 'type':
                return `await page.type('${this.data.selector}', '${this._escapeString(this.data.value)}');`;
            
            case 'press':
                return `await page.press('${this.data.selector || 'body'}', '${this.data.key}');`;
            
            case 'navigate':
                return `await page.goto('${this.data.url}');`;
            
            case 'wait':
                if (this.data.selector) {
                    return `await page.waitForSelector('${this.data.selector}', { timeout: ${this.data.timeout || 30000} });`;
                }
                return `await page.waitForTimeout(${this.data.duration || 1000});`;
            
            case 'scroll':
                return `await page.evaluate(() => window.scrollTo(${this.data.x || 0}, ${this.data.y || 0}));`;
            
            case 'select':
                return `await page.selectOption('${this.data.selector}', '${this.data.value}');`;
            
            case 'check':
                return `await page.check('${this.data.selector}');`;
            
            case 'uncheck':
                return `await page.uncheck('${this.data.selector}');`;
            
            case 'hover':
                return `await page.hover('${this.data.selector}');`;
            
            case 'screenshot':
                return `await page.screenshot({ path: '${this.data.path || 'screenshot.png'}' });`;
            
            case 'assert':
                return this._generateAssertion();
            
            case 'comment':
                return `// ${this.data.text}`;
            
            default:
                return `// Unknown action: ${this.type}`;
        }
    }

    _escapeString(str) {
        return str.replace(/'/g, "\\'").replace(/\n/g, '\\n');
    }

    _generateAssertion() {
        const { assertType, selector, expected } = this.data;
        
        switch (assertType) {
            case 'visible':
                return `await expect(page.locator('${selector}')).toBeVisible();`;
            case 'hidden':
                return `await expect(page.locator('${selector}')).toBeHidden();`;
            case 'text':
                return `await expect(page.locator('${selector}')).toHaveText('${this._escapeString(expected)}');`;
            case 'value':
                return `await expect(page.locator('${selector}')).toHaveValue('${this._escapeString(expected)}');`;
            case 'count':
                return `await expect(page.locator('${selector}')).toHaveCount(${expected});`;
            case 'url':
                return `await expect(page).toHaveURL('${expected}');`;
            case 'title':
                return `await expect(page).toHaveTitle('${this._escapeString(expected)}');`;
            default:
                return `// Unknown assertion: ${assertType}`;
        }
    }

    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            type: this.type,
            data: this.data,
            screenshot: this.screenshot,
            notes: this.notes,
            playwright: this.toPlaywright()
        };
    }
}

/**
 * Recorded Script
 */
class RecordedScript {
    constructor(name, options = {}) {
        this.id = `script-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.name = name;
        this.description = options.description || '';
        this.createdAt = new Date().toISOString();
        this.updatedAt = this.createdAt;
        this.actions = [];
        this.startUrl = options.startUrl || '';
        this.tags = options.tags || [];
        this.metadata = {
            browser: 'chromium',
            viewport: options.viewport || { width: 1280, height: 720 },
            userAgent: options.userAgent || null
        };
    }

    addAction(action) {
        this.actions.push(action);
        this.updatedAt = new Date().toISOString();
    }

    removeAction(actionId) {
        const index = this.actions.findIndex(a => a.id === actionId);
        if (index !== -1) {
            this.actions.splice(index, 1);
            this.updatedAt = new Date().toISOString();
            return true;
        }
        return false;
    }

    moveAction(actionId, newIndex) {
        const currentIndex = this.actions.findIndex(a => a.id === actionId);
        if (currentIndex === -1 || newIndex < 0 || newIndex >= this.actions.length) {
            return false;
        }
        
        const [action] = this.actions.splice(currentIndex, 1);
        this.actions.splice(newIndex, 0, action);
        this.updatedAt = new Date().toISOString();
        return true;
    }

    updateAction(actionId, updates) {
        const action = this.actions.find(a => a.id === actionId);
        if (action) {
            Object.assign(action.data, updates);
            this.updatedAt = new Date().toISOString();
            return true;
        }
        return false;
    }

    toPlaywrightScript() {
        const lines = [
            '// Generated by Svony Browser Script Recorder',
            `// Script: ${this.name}`,
            `// Created: ${this.createdAt}`,
            '',
            "const { chromium } = require('playwright');",
            '',
            '(async () => {',
            '    const browser = await chromium.launch({ headless: false });',
            `    const context = await browser.newContext({`,
            `        viewport: { width: ${this.metadata.viewport.width}, height: ${this.metadata.viewport.height} }`,
            '    });',
            '    const page = await context.newPage();',
            ''
        ];

        // Add start URL if specified
        if (this.startUrl) {
            lines.push(`    // Navigate to start URL`);
            lines.push(`    await page.goto('${this.startUrl}');`);
            lines.push('');
        }

        // Add actions
        lines.push('    // Recorded actions');
        for (const action of this.actions) {
            if (action.notes) {
                lines.push(`    // ${action.notes}`);
            }
            lines.push(`    ${action.toPlaywright()}`);
        }

        lines.push('');
        lines.push('    // Cleanup');
        lines.push('    await browser.close();');
        lines.push('})();');

        return lines.join('\n');
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            startUrl: this.startUrl,
            tags: this.tags,
            metadata: this.metadata,
            actions: this.actions.map(a => a.toJSON()),
            actionCount: this.actions.length
        };
    }
}

/**
 * Script Recorder - Main class
 */
class ScriptRecorder extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            scriptsDir: options.scriptsDir || path.join(process.cwd(), 'scripts'),
            autoScreenshot: options.autoScreenshot || false,
            recordWaits: options.recordWaits !== false,
            minWaitDuration: options.minWaitDuration || 500,
            selectorStrategy: options.selectorStrategy || 'auto', // auto, css, xpath, text
            ...options
        };

        // State
        this.isRecording = false;
        this.currentScript = null;
        this.lastActionTime = null;
        
        // Storage
        this.scripts = new Map();
        
        // Selector generators
        this.selectorGenerators = {
            id: (el) => el.id ? `#${el.id}` : null,
            dataTestId: (el) => el.dataset?.testid ? `[data-testid="${el.dataset.testid}"]` : null,
            name: (el) => el.name ? `[name="${el.name}"]` : null,
            placeholder: (el) => el.placeholder ? `[placeholder="${el.placeholder}"]` : null,
            text: (el) => el.textContent?.trim() ? `text="${el.textContent.trim().substring(0, 50)}"` : null,
            role: (el) => el.role ? `[role="${el.role}"]` : null,
            css: (el) => this._generateCSSSelector(el)
        };

        // Ensure scripts directory exists
        this._ensureScriptsDir();
        
        // Load existing scripts
        this._loadScripts();
    }

    /**
     * Ensure scripts directory exists
     */
    _ensureScriptsDir() {
        if (!fs.existsSync(this.options.scriptsDir)) {
            fs.mkdirSync(this.options.scriptsDir, { recursive: true });
        }
    }

    /**
     * Load existing scripts from disk
     */
    _loadScripts() {
        try {
            const files = fs.readdirSync(this.options.scriptsDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filepath = path.join(this.options.scriptsDir, file);
                    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                    const script = this._deserializeScript(data);
                    this.scripts.set(script.id, script);
                }
            }
        } catch (e) {
            // Directory might not exist yet
        }
    }

    /**
     * Deserialize script from JSON
     */
    _deserializeScript(data) {
        const script = new RecordedScript(data.name, {
            description: data.description,
            startUrl: data.startUrl,
            tags: data.tags,
            viewport: data.metadata?.viewport
        });
        script.id = data.id;
        script.createdAt = data.createdAt;
        script.updatedAt = data.updatedAt;
        script.metadata = data.metadata;
        
        for (const actionData of data.actions || []) {
            const action = new RecordedAction(actionData.type, actionData.data);
            action.id = actionData.id;
            action.timestamp = actionData.timestamp;
            action.screenshot = actionData.screenshot;
            action.notes = actionData.notes;
            script.actions.push(action);
        }
        
        return script;
    }

    /**
     * Save script to disk
     */
    _saveScript(script) {
        const filepath = path.join(this.options.scriptsDir, `${script.id}.json`);
        fs.writeFileSync(filepath, JSON.stringify(script.toJSON(), null, 2));
    }

    /**
     * Generate CSS selector for element
     */
    _generateCSSSelector(element) {
        // This would be called from renderer with element info
        if (!element) return null;
        
        const parts = [];
        let current = element;
        
        while (current && current.tagName) {
            let selector = current.tagName.toLowerCase();
            
            if (current.id) {
                selector = `#${current.id}`;
                parts.unshift(selector);
                break;
            }
            
            if (current.className) {
                const classes = current.className.split(' ').filter(c => c && !c.includes(':'));
                if (classes.length > 0) {
                    selector += '.' + classes.slice(0, 2).join('.');
                }
            }
            
            // Add nth-child if needed
            if (current.parentElement) {
                const siblings = Array.from(current.parentElement.children);
                const index = siblings.indexOf(current) + 1;
                if (siblings.filter(s => s.tagName === current.tagName).length > 1) {
                    selector += `:nth-child(${index})`;
                }
            }
            
            parts.unshift(selector);
            current = current.parentElement;
            
            // Limit depth
            if (parts.length > 5) break;
        }
        
        return parts.join(' > ');
    }

    /**
     * Generate best selector for element
     */
    generateSelector(elementInfo) {
        // Try different strategies in order of preference
        const strategies = ['id', 'dataTestId', 'name', 'placeholder', 'role', 'text', 'css'];
        
        for (const strategy of strategies) {
            if (this.selectorGenerators[strategy]) {
                const selector = this.selectorGenerators[strategy](elementInfo);
                if (selector) return selector;
            }
        }
        
        // Fallback to coordinates
        return null;
    }

    /**
     * Start recording a new script
     */
    startRecording(name, options = {}) {
        if (this.isRecording) {
            this.stopRecording();
        }
        
        this.currentScript = new RecordedScript(name, options);
        this.isRecording = true;
        this.lastActionTime = Date.now();
        
        this.emit('recording-started', this.currentScript);
        return this.currentScript;
    }

    /**
     * Stop recording
     */
    stopRecording() {
        if (!this.isRecording) return null;
        
        this.isRecording = false;
        const script = this.currentScript;
        
        // Save script
        this.scripts.set(script.id, script);
        this._saveScript(script);
        
        this.currentScript = null;
        this.lastActionTime = null;
        
        this.emit('recording-stopped', script);
        return script;
    }

    /**
     * Pause recording
     */
    pauseRecording() {
        if (!this.isRecording) return false;
        this.isRecording = false;
        this.emit('recording-paused');
        return true;
    }

    /**
     * Resume recording
     */
    resumeRecording() {
        if (!this.currentScript) return false;
        this.isRecording = true;
        this.lastActionTime = Date.now();
        this.emit('recording-resumed');
        return true;
    }

    /**
     * Record an action
     */
    recordAction(type, data) {
        if (!this.isRecording || !this.currentScript) return null;
        
        // Add wait if significant time passed
        if (this.options.recordWaits && this.lastActionTime) {
            const elapsed = Date.now() - this.lastActionTime;
            if (elapsed > this.options.minWaitDuration) {
                const waitAction = new RecordedAction('wait', { duration: elapsed });
                this.currentScript.addAction(waitAction);
            }
        }
        
        // Create action
        const action = new RecordedAction(type, data);
        this.currentScript.addAction(action);
        this.lastActionTime = Date.now();
        
        this.emit('action-recorded', action);
        return action;
    }

    /**
     * Record click action
     */
    recordClick(data) {
        return this.recordAction('click', {
            selector: data.selector || this.generateSelector(data.element),
            x: data.x,
            y: data.y,
            button: data.button || 'left'
        });
    }

    /**
     * Record double click action
     */
    recordDoubleClick(data) {
        return this.recordAction('dblclick', {
            selector: data.selector || this.generateSelector(data.element),
            x: data.x,
            y: data.y
        });
    }

    /**
     * Record input action
     */
    recordInput(data) {
        return this.recordAction('input', {
            selector: data.selector || this.generateSelector(data.element),
            value: data.value
        });
    }

    /**
     * Record type action (character by character)
     */
    recordType(data) {
        return this.recordAction('type', {
            selector: data.selector || this.generateSelector(data.element),
            value: data.value
        });
    }

    /**
     * Record key press
     */
    recordKeyPress(data) {
        return this.recordAction('press', {
            selector: data.selector,
            key: data.key
        });
    }

    /**
     * Record navigation
     */
    recordNavigation(url) {
        return this.recordAction('navigate', { url });
    }

    /**
     * Record scroll
     */
    recordScroll(data) {
        return this.recordAction('scroll', {
            x: data.x || 0,
            y: data.y || 0
        });
    }

    /**
     * Record select option
     */
    recordSelect(data) {
        return this.recordAction('select', {
            selector: data.selector || this.generateSelector(data.element),
            value: data.value
        });
    }

    /**
     * Record checkbox check
     */
    recordCheck(data) {
        return this.recordAction('check', {
            selector: data.selector || this.generateSelector(data.element)
        });
    }

    /**
     * Record checkbox uncheck
     */
    recordUncheck(data) {
        return this.recordAction('uncheck', {
            selector: data.selector || this.generateSelector(data.element)
        });
    }

    /**
     * Record hover
     */
    recordHover(data) {
        return this.recordAction('hover', {
            selector: data.selector || this.generateSelector(data.element)
        });
    }

    /**
     * Record wait
     */
    recordWait(data) {
        return this.recordAction('wait', {
            selector: data.selector,
            duration: data.duration,
            timeout: data.timeout
        });
    }

    /**
     * Record screenshot
     */
    recordScreenshot(data = {}) {
        return this.recordAction('screenshot', {
            path: data.path || `screenshot-${Date.now()}.png`
        });
    }

    /**
     * Record assertion
     */
    recordAssertion(data) {
        return this.recordAction('assert', {
            assertType: data.assertType,
            selector: data.selector,
            expected: data.expected
        });
    }

    /**
     * Add comment to recording
     */
    addComment(text) {
        return this.recordAction('comment', { text });
    }

    /**
     * Get current script
     */
    getCurrentScript() {
        return this.currentScript;
    }

    /**
     * Get all scripts
     */
    getScripts() {
        return Array.from(this.scripts.values()).map(s => s.toJSON());
    }

    /**
     * Get script by ID
     */
    getScript(scriptId) {
        return this.scripts.get(scriptId);
    }

    /**
     * Delete script
     */
    deleteScript(scriptId) {
        const script = this.scripts.get(scriptId);
        if (!script) return false;
        
        this.scripts.delete(scriptId);
        
        // Delete file
        const filepath = path.join(this.options.scriptsDir, `${scriptId}.json`);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        
        this.emit('script-deleted', scriptId);
        return true;
    }

    /**
     * Duplicate script
     */
    duplicateScript(scriptId, newName) {
        const original = this.scripts.get(scriptId);
        if (!original) return null;
        
        const duplicate = new RecordedScript(newName || `${original.name} (copy)`, {
            description: original.description,
            startUrl: original.startUrl,
            tags: [...original.tags],
            viewport: { ...original.metadata.viewport }
        });
        
        // Copy actions
        for (const action of original.actions) {
            const newAction = new RecordedAction(action.type, { ...action.data });
            newAction.notes = action.notes;
            duplicate.actions.push(newAction);
        }
        
        this.scripts.set(duplicate.id, duplicate);
        this._saveScript(duplicate);
        
        this.emit('script-duplicated', { original: scriptId, duplicate: duplicate.id });
        return duplicate;
    }

    /**
     * Export script to Playwright file
     */
    exportToPlaywright(scriptId, outputPath = null) {
        const script = this.scripts.get(scriptId);
        if (!script) return null;
        
        const code = script.toPlaywrightScript();
        
        if (outputPath) {
            fs.writeFileSync(outputPath, code);
        }
        
        return code;
    }

    /**
     * Import script from JSON
     */
    importScript(jsonData) {
        const script = this._deserializeScript(jsonData);
        this.scripts.set(script.id, script);
        this._saveScript(script);
        
        this.emit('script-imported', script);
        return script;
    }

    /**
     * Get recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            currentScript: this.currentScript ? this.currentScript.toJSON() : null,
            actionCount: this.currentScript ? this.currentScript.actions.length : 0,
            scriptCount: this.scripts.size
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.isRecording) {
            this.stopRecording();
        }
        this.scripts.clear();
        this.emit('destroyed');
    }
}

// Export singleton and class
let instance = null;

module.exports = {
    ScriptRecorder,
    RecordedScript,
    RecordedAction,
    
    getInstance(options) {
        if (!instance) {
            instance = new ScriptRecorder(options);
        }
        return instance;
    }
};
