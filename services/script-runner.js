/**
 * Script Runner Service
 * Execute recorded Playwright scripts with scheduling
 * v2.0.9
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

/**
 * Script Execution Result
 */
class ExecutionResult {
    constructor(scriptId, runId) {
        this.runId = runId;
        this.scriptId = scriptId;
        this.startTime = new Date().toISOString();
        this.endTime = null;
        this.duration = null;
        this.status = 'running'; // running, completed, failed, cancelled
        this.actionResults = [];
        this.error = null;
        this.screenshots = [];
        this.logs = [];
    }

    addActionResult(actionId, result) {
        this.actionResults.push({
            actionId,
            timestamp: new Date().toISOString(),
            ...result
        });
    }

    complete() {
        this.status = 'completed';
        this.endTime = new Date().toISOString();
        this.duration = new Date(this.endTime) - new Date(this.startTime);
    }

    fail(error) {
        this.status = 'failed';
        this.error = error;
        this.endTime = new Date().toISOString();
        this.duration = new Date(this.endTime) - new Date(this.startTime);
    }

    cancel() {
        this.status = 'cancelled';
        this.endTime = new Date().toISOString();
        this.duration = new Date(this.endTime) - new Date(this.startTime);
    }

    addLog(level, message) {
        this.logs.push({
            timestamp: new Date().toISOString(),
            level,
            message
        });
    }

    toJSON() {
        return {
            runId: this.runId,
            scriptId: this.scriptId,
            startTime: this.startTime,
            endTime: this.endTime,
            duration: this.duration,
            status: this.status,
            actionResults: this.actionResults,
            error: this.error,
            screenshots: this.screenshots,
            logs: this.logs,
            successCount: this.actionResults.filter(r => r.success).length,
            failCount: this.actionResults.filter(r => !r.success).length
        };
    }
}

/**
 * Scheduled Task
 */
class ScheduledTask {
    constructor(scriptId, schedule, options = {}) {
        this.id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.scriptId = scriptId;
        this.schedule = schedule; // cron expression or interval
        this.type = options.type || 'interval'; // interval, cron, once
        this.enabled = true;
        this.lastRun = null;
        this.nextRun = null;
        this.runCount = 0;
        this.maxRuns = options.maxRuns || Infinity;
        this.options = options;
        this.createdAt = new Date().toISOString();
        
        this._calculateNextRun();
    }

    _calculateNextRun() {
        const now = Date.now();
        
        if (this.type === 'interval') {
            this.nextRun = new Date(now + this.schedule).toISOString();
        } else if (this.type === 'once') {
            this.nextRun = new Date(this.schedule).toISOString();
        } else if (this.type === 'cron') {
            // Simple cron parsing (would use a library in production)
            this.nextRun = this._parseCron(this.schedule);
        }
    }

    _parseCron(expression) {
        // Simplified cron - just return next minute for now
        // In production, use a proper cron parser
        const now = new Date();
        now.setMinutes(now.getMinutes() + 1);
        now.setSeconds(0);
        now.setMilliseconds(0);
        return now.toISOString();
    }

    markRun() {
        this.lastRun = new Date().toISOString();
        this.runCount++;
        
        if (this.runCount >= this.maxRuns) {
            this.enabled = false;
        } else if (this.type !== 'once') {
            this._calculateNextRun();
        } else {
            this.enabled = false;
        }
    }

    shouldRun() {
        if (!this.enabled) return false;
        if (!this.nextRun) return false;
        return new Date() >= new Date(this.nextRun);
    }

    toJSON() {
        return {
            id: this.id,
            scriptId: this.scriptId,
            schedule: this.schedule,
            type: this.type,
            enabled: this.enabled,
            lastRun: this.lastRun,
            nextRun: this.nextRun,
            runCount: this.runCount,
            maxRuns: this.maxRuns,
            options: this.options,
            createdAt: this.createdAt
        };
    }
}

/**
 * Script Runner - Main class
 */
class ScriptRunner extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            resultsDir: options.resultsDir || path.join(process.cwd(), 'results'),
            maxConcurrent: options.maxConcurrent || 3,
            defaultTimeout: options.defaultTimeout || 30000,
            retryCount: options.retryCount || 0,
            screenshotOnError: options.screenshotOnError !== false,
            schedulerInterval: options.schedulerInterval || 10000, // Check every 10 seconds
            ...options
        };

        // State
        this.isRunning = false;
        this.currentRuns = new Map();
        this.runQueue = [];
        
        // Storage
        this.results = new Map();
        this.scheduledTasks = new Map();
        
        // Playwright reference
        this.playwright = null;
        this.browser = null;
        
        // Script recorder reference
        this.scriptRecorder = null;
        
        // Scheduler
        this.schedulerInterval = null;
        
        // Ensure results directory
        this._ensureResultsDir();
    }

    /**
     * Ensure results directory exists
     */
    _ensureResultsDir() {
        if (!fs.existsSync(this.options.resultsDir)) {
            fs.mkdirSync(this.options.resultsDir, { recursive: true });
        }
    }

    /**
     * Set script recorder reference
     */
    setScriptRecorder(recorder) {
        this.scriptRecorder = recorder;
    }

    /**
     * Initialize Playwright
     */
    async initPlaywright() {
        if (this.playwright) return true;
        
        try {
            this.playwright = require('playwright');
            this.emit('playwright-initialized');
            return true;
        } catch (e) {
            this.emit('playwright-error', e);
            return false;
        }
    }

    /**
     * Get or create browser
     */
    async getBrowser() {
        if (!this.playwright) {
            await this.initPlaywright();
        }
        
        if (!this.browser || !this.browser.isConnected()) {
            this.browser = await this.playwright.chromium.launch({
                headless: false
            });
        }
        
        return this.browser;
    }

    /**
     * Run a script
     */
    async runScript(scriptId, options = {}) {
        // Get script
        const script = this.scriptRecorder?.getScript(scriptId);
        if (!script) {
            throw new Error(`Script not found: ${scriptId}`);
        }
        
        // Check concurrent limit
        if (this.currentRuns.size >= this.options.maxConcurrent) {
            // Queue the run
            return new Promise((resolve, reject) => {
                this.runQueue.push({ scriptId, options, resolve, reject });
                this.emit('run-queued', { scriptId, queuePosition: this.runQueue.length });
            });
        }
        
        // Create run
        const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const result = new ExecutionResult(scriptId, runId);
        
        this.currentRuns.set(runId, { script, result, options });
        this.results.set(runId, result);
        
        this.emit('run-started', { runId, scriptId });
        
        try {
            await this._executeScript(script, result, options);
            result.complete();
            this.emit('run-completed', result.toJSON());
        } catch (error) {
            result.fail(error.message);
            this.emit('run-failed', { runId, error: error.message });
        } finally {
            this.currentRuns.delete(runId);
            this._saveResult(result);
            this._processQueue();
        }
        
        return result;
    }

    /**
     * Execute script actions
     */
    async _executeScript(script, result, options = {}) {
        const browser = await this.getBrowser();
        const context = await browser.newContext({
            viewport: script.metadata?.viewport || { width: 1280, height: 720 }
        });
        const page = await context.newPage();
        
        try {
            // Navigate to start URL if specified
            if (script.startUrl) {
                result.addLog('info', `Navigating to ${script.startUrl}`);
                await page.goto(script.startUrl, { timeout: this.options.defaultTimeout });
            }
            
            // Execute each action
            for (const action of script.actions) {
                if (result.status === 'cancelled') break;
                
                try {
                    result.addLog('info', `Executing action: ${action.type}`);
                    await this._executeAction(page, action, options);
                    result.addActionResult(action.id, { success: true });
                } catch (error) {
                    result.addActionResult(action.id, { success: false, error: error.message });
                    result.addLog('error', `Action failed: ${error.message}`);
                    
                    // Screenshot on error
                    if (this.options.screenshotOnError) {
                        try {
                            const screenshotPath = path.join(
                                this.options.resultsDir,
                                `error-${result.runId}-${action.id}.png`
                            );
                            await page.screenshot({ path: screenshotPath });
                            result.screenshots.push(screenshotPath);
                        } catch (e) {
                            // Ignore screenshot errors
                        }
                    }
                    
                    // Stop on error unless configured otherwise
                    if (!options.continueOnError) {
                        throw error;
                    }
                }
            }
        } finally {
            await context.close();
        }
    }

    /**
     * Execute a single action
     */
    async _executeAction(page, action, options = {}) {
        const timeout = options.timeout || this.options.defaultTimeout;
        
        switch (action.type) {
            case 'click':
                if (action.data.selector) {
                    await page.click(action.data.selector, { timeout });
                } else {
                    await page.mouse.click(action.data.x, action.data.y);
                }
                break;
                
            case 'dblclick':
                if (action.data.selector) {
                    await page.dblclick(action.data.selector, { timeout });
                } else {
                    await page.mouse.dblclick(action.data.x, action.data.y);
                }
                break;
                
            case 'input':
                await page.fill(action.data.selector, action.data.value, { timeout });
                break;
                
            case 'type':
                await page.type(action.data.selector, action.data.value);
                break;
                
            case 'press':
                await page.press(action.data.selector || 'body', action.data.key);
                break;
                
            case 'navigate':
                await page.goto(action.data.url, { timeout });
                break;
                
            case 'wait':
                if (action.data.selector) {
                    await page.waitForSelector(action.data.selector, { 
                        timeout: action.data.timeout || timeout 
                    });
                } else {
                    await page.waitForTimeout(action.data.duration || 1000);
                }
                break;
                
            case 'scroll':
                await page.evaluate(({ x, y }) => window.scrollTo(x, y), {
                    x: action.data.x || 0,
                    y: action.data.y || 0
                });
                break;
                
            case 'select':
                await page.selectOption(action.data.selector, action.data.value, { timeout });
                break;
                
            case 'check':
                await page.check(action.data.selector, { timeout });
                break;
                
            case 'uncheck':
                await page.uncheck(action.data.selector, { timeout });
                break;
                
            case 'hover':
                await page.hover(action.data.selector, { timeout });
                break;
                
            case 'screenshot':
                await page.screenshot({ path: action.data.path });
                break;
                
            case 'assert':
                await this._executeAssertion(page, action.data, timeout);
                break;
                
            case 'comment':
                // Comments are no-ops during execution
                break;
                
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    }

    /**
     * Execute assertion
     */
    async _executeAssertion(page, data, timeout) {
        const { assertType, selector, expected } = data;
        
        switch (assertType) {
            case 'visible':
                await page.waitForSelector(selector, { state: 'visible', timeout });
                break;
                
            case 'hidden':
                await page.waitForSelector(selector, { state: 'hidden', timeout });
                break;
                
            case 'text':
                const textContent = await page.textContent(selector);
                if (textContent !== expected) {
                    throw new Error(`Text assertion failed: expected "${expected}", got "${textContent}"`);
                }
                break;
                
            case 'value':
                const value = await page.inputValue(selector);
                if (value !== expected) {
                    throw new Error(`Value assertion failed: expected "${expected}", got "${value}"`);
                }
                break;
                
            case 'count':
                const count = await page.locator(selector).count();
                if (count !== expected) {
                    throw new Error(`Count assertion failed: expected ${expected}, got ${count}`);
                }
                break;
                
            case 'url':
                const url = page.url();
                if (url !== expected) {
                    throw new Error(`URL assertion failed: expected "${expected}", got "${url}"`);
                }
                break;
                
            case 'title':
                const title = await page.title();
                if (title !== expected) {
                    throw new Error(`Title assertion failed: expected "${expected}", got "${title}"`);
                }
                break;
                
            default:
                throw new Error(`Unknown assertion type: ${assertType}`);
        }
    }

    /**
     * Cancel a running script
     */
    cancelRun(runId) {
        const run = this.currentRuns.get(runId);
        if (run) {
            run.result.cancel();
            this.currentRuns.delete(runId);
            this.emit('run-cancelled', runId);
            return true;
        }
        return false;
    }

    /**
     * Process queued runs
     */
    _processQueue() {
        while (this.runQueue.length > 0 && this.currentRuns.size < this.options.maxConcurrent) {
            const { scriptId, options, resolve, reject } = this.runQueue.shift();
            this.runScript(scriptId, options).then(resolve).catch(reject);
        }
    }

    /**
     * Save result to disk
     */
    _saveResult(result) {
        const filepath = path.join(this.options.resultsDir, `${result.runId}.json`);
        fs.writeFileSync(filepath, JSON.stringify(result.toJSON(), null, 2));
    }

    /**
     * Schedule a script
     */
    scheduleScript(scriptId, schedule, options = {}) {
        const task = new ScheduledTask(scriptId, schedule, options);
        this.scheduledTasks.set(task.id, task);
        
        // Start scheduler if not running
        if (!this.schedulerInterval) {
            this.startScheduler();
        }
        
        this.emit('task-scheduled', task.toJSON());
        return task;
    }

    /**
     * Unschedule a task
     */
    unscheduleTask(taskId) {
        const task = this.scheduledTasks.get(taskId);
        if (task) {
            this.scheduledTasks.delete(taskId);
            this.emit('task-unscheduled', taskId);
            return true;
        }
        return false;
    }

    /**
     * Enable/disable a scheduled task
     */
    toggleTask(taskId, enabled) {
        const task = this.scheduledTasks.get(taskId);
        if (task) {
            task.enabled = enabled;
            this.emit('task-toggled', { taskId, enabled });
            return true;
        }
        return false;
    }

    /**
     * Start scheduler
     */
    startScheduler() {
        if (this.schedulerInterval) return;
        
        this.schedulerInterval = setInterval(() => {
            this._checkScheduledTasks();
        }, this.options.schedulerInterval);
        
        this.emit('scheduler-started');
    }

    /**
     * Stop scheduler
     */
    stopScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }
        this.emit('scheduler-stopped');
    }

    /**
     * Check and run scheduled tasks
     */
    _checkScheduledTasks() {
        for (const [taskId, task] of this.scheduledTasks) {
            if (task.shouldRun()) {
                task.markRun();
                this.runScript(task.scriptId, task.options)
                    .then(result => {
                        this.emit('scheduled-run-completed', { taskId, result: result.toJSON() });
                    })
                    .catch(error => {
                        this.emit('scheduled-run-failed', { taskId, error: error.message });
                    });
            }
        }
    }

    /**
     * Get scheduled tasks
     */
    getScheduledTasks() {
        return Array.from(this.scheduledTasks.values()).map(t => t.toJSON());
    }

    /**
     * Get run results
     */
    getResults(options = {}) {
        let results = Array.from(this.results.values()).map(r => r.toJSON());
        
        // Filter by script
        if (options.scriptId) {
            results = results.filter(r => r.scriptId === options.scriptId);
        }
        
        // Filter by status
        if (options.status) {
            results = results.filter(r => r.status === options.status);
        }
        
        // Sort by start time (newest first)
        results.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        
        // Limit
        if (options.limit) {
            results = results.slice(0, options.limit);
        }
        
        return results;
    }

    /**
     * Get result by ID
     */
    getResult(runId) {
        const result = this.results.get(runId);
        return result ? result.toJSON() : null;
    }

    /**
     * Get current runs
     */
    getCurrentRuns() {
        const runs = [];
        for (const [runId, data] of this.currentRuns) {
            runs.push({
                runId,
                scriptId: data.script.id,
                scriptName: data.script.name,
                status: data.result.status,
                actionCount: data.result.actionResults.length,
                startTime: data.result.startTime
            });
        }
        return runs;
    }

    /**
     * Get queue status
     */
    getQueueStatus() {
        return {
            queueLength: this.runQueue.length,
            currentRuns: this.currentRuns.size,
            maxConcurrent: this.options.maxConcurrent
        };
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: true,
            playwrightReady: !!this.playwright,
            browserConnected: this.browser?.isConnected() || false,
            currentRuns: this.currentRuns.size,
            queueLength: this.runQueue.length,
            scheduledTasks: this.scheduledTasks.size,
            schedulerRunning: !!this.schedulerInterval,
            totalResults: this.results.size
        };
    }

    /**
     * Cleanup
     */
    async destroy() {
        this.stopScheduler();
        
        // Cancel all current runs
        for (const [runId] of this.currentRuns) {
            this.cancelRun(runId);
        }
        
        // Close browser
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        
        this.emit('destroyed');
    }
}

// Export singleton and class
let instance = null;

module.exports = {
    ScriptRunner,
    ExecutionResult,
    ScheduledTask,
    
    getInstance(options) {
        if (!instance) {
            instance = new ScriptRunner(options);
        }
        return instance;
    }
};
