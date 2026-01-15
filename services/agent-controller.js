/**
 * Agent Controller Service
 * Autonomous agent mode for chatbot with goal-oriented behavior
 * v2.0.9
 */

const EventEmitter = require('events');

/**
 * Agent Goal
 */
class AgentGoal {
    constructor(data) {
        this.id = `goal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.type = data.type; // immediate, short-term, long-term
        this.description = data.description;
        this.priority = data.priority || 5; // 1-10
        this.status = 'pending'; // pending, active, completed, failed, cancelled
        this.progress = 0;
        this.subgoals = [];
        this.actions = [];
        this.constraints = data.constraints || [];
        this.deadline = data.deadline || null;
        this.createdAt = new Date().toISOString();
        this.startedAt = null;
        this.completedAt = null;
        this.result = null;
    }

    start() {
        this.status = 'active';
        this.startedAt = new Date().toISOString();
    }

    complete(result) {
        this.status = 'completed';
        this.progress = 100;
        this.completedAt = new Date().toISOString();
        this.result = result;
    }

    fail(error) {
        this.status = 'failed';
        this.completedAt = new Date().toISOString();
        this.result = { error };
    }

    cancel() {
        this.status = 'cancelled';
        this.completedAt = new Date().toISOString();
    }

    updateProgress(progress) {
        this.progress = Math.min(100, Math.max(0, progress));
    }

    addSubgoal(subgoal) {
        this.subgoals.push(subgoal);
    }

    addAction(action) {
        this.actions.push(action);
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            description: this.description,
            priority: this.priority,
            status: this.status,
            progress: this.progress,
            subgoals: this.subgoals.map(g => g.toJSON ? g.toJSON() : g),
            actionCount: this.actions.length,
            constraints: this.constraints,
            deadline: this.deadline,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            result: this.result
        };
    }
}

/**
 * Agent Action
 */
class AgentAction {
    constructor(data) {
        this.id = `action-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.type = data.type; // navigate, click, input, wait, analyze, decide, communicate
        this.description = data.description;
        this.parameters = data.parameters || {};
        this.status = 'pending';
        this.result = null;
        this.error = null;
        this.startedAt = null;
        this.completedAt = null;
        this.duration = null;
    }

    execute() {
        this.status = 'executing';
        this.startedAt = new Date().toISOString();
    }

    complete(result) {
        this.status = 'completed';
        this.result = result;
        this.completedAt = new Date().toISOString();
        this.duration = new Date(this.completedAt) - new Date(this.startedAt);
    }

    fail(error) {
        this.status = 'failed';
        this.error = error;
        this.completedAt = new Date().toISOString();
        this.duration = new Date(this.completedAt) - new Date(this.startedAt);
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            description: this.description,
            parameters: this.parameters,
            status: this.status,
            result: this.result,
            error: this.error,
            duration: this.duration
        };
    }
}

/**
 * Agent Memory
 */
class AgentMemory {
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.shortTerm = []; // Recent observations and actions
        this.longTerm = new Map(); // Persistent knowledge
        this.workingMemory = {}; // Current context
        this.episodic = []; // Past experiences
    }

    addObservation(observation) {
        this.shortTerm.push({
            type: 'observation',
            timestamp: new Date().toISOString(),
            data: observation
        });
        this._trimShortTerm();
    }

    addAction(action) {
        this.shortTerm.push({
            type: 'action',
            timestamp: new Date().toISOString(),
            data: action
        });
        this._trimShortTerm();
    }

    addExperience(experience) {
        this.episodic.push({
            timestamp: new Date().toISOString(),
            ...experience
        });
        if (this.episodic.length > this.maxSize) {
            this.episodic.shift();
        }
    }

    setKnowledge(key, value) {
        this.longTerm.set(key, {
            value,
            updatedAt: new Date().toISOString()
        });
    }

    getKnowledge(key) {
        const entry = this.longTerm.get(key);
        return entry ? entry.value : null;
    }

    setWorkingContext(key, value) {
        this.workingMemory[key] = value;
    }

    getWorkingContext(key) {
        return this.workingMemory[key];
    }

    clearWorkingMemory() {
        this.workingMemory = {};
    }

    getRecentObservations(count = 10) {
        return this.shortTerm
            .filter(m => m.type === 'observation')
            .slice(-count);
    }

    getRecentActions(count = 10) {
        return this.shortTerm
            .filter(m => m.type === 'action')
            .slice(-count);
    }

    searchExperiences(query) {
        const queryLower = query.toLowerCase();
        return this.episodic.filter(e => 
            JSON.stringify(e).toLowerCase().includes(queryLower)
        );
    }

    _trimShortTerm() {
        if (this.shortTerm.length > this.maxSize) {
            this.shortTerm.shift();
        }
    }

    toJSON() {
        return {
            shortTermCount: this.shortTerm.length,
            longTermCount: this.longTerm.size,
            episodicCount: this.episodic.length,
            workingMemoryKeys: Object.keys(this.workingMemory)
        };
    }
}

/**
 * Agent Planner
 */
class AgentPlanner {
    constructor(agent) {
        this.agent = agent;
    }

    /**
     * Decompose a goal into subgoals and actions
     */
    async planGoal(goal) {
        const plan = {
            goalId: goal.id,
            steps: [],
            estimatedDuration: 0
        };

        // Use LLM to generate plan if available
        if (this.agent.llmClient) {
            try {
                const planPrompt = this._generatePlanPrompt(goal);
                const response = await this.agent.llmClient.chat([
                    { role: 'system', content: 'You are an AI planner. Generate a step-by-step plan to achieve the given goal. Return JSON with steps array.' },
                    { role: 'user', content: planPrompt }
                ]);
                
                const parsedPlan = this._parseLLMPlan(response);
                if (parsedPlan) {
                    plan.steps = parsedPlan.steps;
                    plan.estimatedDuration = parsedPlan.estimatedDuration;
                }
            } catch (e) {
                // Fall back to rule-based planning
                plan.steps = this._ruleBasedPlan(goal);
            }
        } else {
            plan.steps = this._ruleBasedPlan(goal);
        }

        return plan;
    }

    _generatePlanPrompt(goal) {
        return `Goal: ${goal.description}
Type: ${goal.type}
Priority: ${goal.priority}
Constraints: ${goal.constraints.join(', ') || 'None'}
Deadline: ${goal.deadline || 'None'}

Current context:
${JSON.stringify(this.agent.memory.workingMemory, null, 2)}

Generate a plan with specific, actionable steps.`;
    }

    _parseLLMPlan(response) {
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            // Parsing failed
        }
        return null;
    }

    _ruleBasedPlan(goal) {
        const steps = [];
        const description = goal.description.toLowerCase();

        // Resource-related goals
        if (description.includes('collect') || description.includes('gather')) {
            steps.push(
                { type: 'navigate', description: 'Go to city view' },
                { type: 'analyze', description: 'Check available resources' },
                { type: 'click', description: 'Click collect button' },
                { type: 'wait', description: 'Wait for collection' }
            );
        }
        // Combat-related goals
        else if (description.includes('attack') || description.includes('hunt') || description.includes('battle')) {
            steps.push(
                { type: 'navigate', description: 'Go to world map' },
                { type: 'analyze', description: 'Find target' },
                { type: 'decide', description: 'Select troops' },
                { type: 'click', description: 'Send attack' },
                { type: 'wait', description: 'Wait for result' }
            );
        }
        // Building-related goals
        else if (description.includes('build') || description.includes('upgrade')) {
            steps.push(
                { type: 'navigate', description: 'Go to city view' },
                { type: 'analyze', description: 'Check building status' },
                { type: 'click', description: 'Select building' },
                { type: 'click', description: 'Start upgrade' }
            );
        }
        // Default plan
        else {
            steps.push(
                { type: 'analyze', description: 'Analyze current state' },
                { type: 'decide', description: 'Determine best action' },
                { type: 'execute', description: 'Execute action' }
            );
        }

        return steps;
    }
}

/**
 * Agent Controller - Main class
 */
class AgentController extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxConcurrentGoals: options.maxConcurrentGoals || 3,
            decisionInterval: options.decisionInterval || 5000,
            maxActionsPerMinute: options.maxActionsPerMinute || 30,
            safeMode: options.safeMode !== false,
            learningEnabled: options.learningEnabled !== false,
            ...options
        };

        // State
        this.isRunning = false;
        this.isPaused = false;
        this.mode = 'idle'; // idle, planning, executing, waiting, learning

        // Components
        this.memory = new AgentMemory();
        this.planner = new AgentPlanner(this);
        
        // Goals
        this.goals = new Map();
        this.activeGoals = [];
        this.goalQueue = [];
        
        // Actions
        this.actionHistory = [];
        this.pendingActions = [];
        this.actionRateLimit = {
            count: 0,
            resetTime: Date.now() + 60000
        };

        // External references
        this.llmClient = null;
        this.mcpManager = null;
        this.scriptRunner = null;
        this.gameState = null;

        // Decision loop
        this.decisionLoop = null;

        // Statistics
        this.stats = {
            startTime: null,
            goalsCompleted: 0,
            goalsFailed: 0,
            actionsExecuted: 0,
            decisions: 0
        };
    }

    /**
     * Set LLM client reference
     */
    setLLMClient(client) {
        this.llmClient = client;
    }

    /**
     * Set MCP manager reference
     */
    setMCPManager(manager) {
        this.mcpManager = manager;
    }

    /**
     * Set script runner reference
     */
    setScriptRunner(runner) {
        this.scriptRunner = runner;
    }

    /**
     * Set game state reference
     */
    setGameState(state) {
        this.gameState = state;
    }

    /**
     * Start agent
     */
    start() {
        if (this.isRunning) return false;
        
        this.isRunning = true;
        this.isPaused = false;
        this.mode = 'idle';
        this.stats.startTime = Date.now();
        
        // Start decision loop
        this.decisionLoop = setInterval(() => {
            this._decisionCycle();
        }, this.options.decisionInterval);
        
        this.emit('started');
        return true;
    }

    /**
     * Stop agent
     */
    stop() {
        if (!this.isRunning) return false;
        
        this.isRunning = false;
        this.mode = 'idle';
        
        if (this.decisionLoop) {
            clearInterval(this.decisionLoop);
            this.decisionLoop = null;
        }
        
        // Cancel active goals
        for (const goal of this.activeGoals) {
            goal.cancel();
        }
        this.activeGoals = [];
        
        this.emit('stopped');
        return true;
    }

    /**
     * Pause agent
     */
    pause() {
        if (!this.isRunning || this.isPaused) return false;
        this.isPaused = true;
        this.emit('paused');
        return true;
    }

    /**
     * Resume agent
     */
    resume() {
        if (!this.isRunning || !this.isPaused) return false;
        this.isPaused = false;
        this.emit('resumed');
        return true;
    }

    /**
     * Add a goal
     */
    addGoal(goalData) {
        const goal = new AgentGoal(goalData);
        this.goals.set(goal.id, goal);
        this.goalQueue.push(goal);
        
        // Sort queue by priority
        this.goalQueue.sort((a, b) => b.priority - a.priority);
        
        this.emit('goal-added', goal.toJSON());
        return goal;
    }

    /**
     * Remove a goal
     */
    removeGoal(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal) return false;
        
        // Remove from queue
        this.goalQueue = this.goalQueue.filter(g => g.id !== goalId);
        
        // Cancel if active
        if (this.activeGoals.includes(goal)) {
            goal.cancel();
            this.activeGoals = this.activeGoals.filter(g => g.id !== goalId);
        }
        
        this.goals.delete(goalId);
        this.emit('goal-removed', goalId);
        return true;
    }

    /**
     * Decision cycle
     */
    async _decisionCycle() {
        if (!this.isRunning || this.isPaused) return;
        
        this.stats.decisions++;
        
        try {
            // Update observations
            await this._observe();
            
            // Check goal completion
            this._checkGoalCompletion();
            
            // Activate new goals if capacity available
            this._activateGoals();
            
            // Plan and execute actions
            if (this.activeGoals.length > 0) {
                this.mode = 'executing';
                await this._executeNextAction();
            } else {
                this.mode = 'idle';
            }
            
        } catch (error) {
            this.emit('error', error);
        }
    }

    /**
     * Observe current state
     */
    async _observe() {
        const observation = {
            timestamp: new Date().toISOString(),
            gameState: this.gameState?.getSnapshot() || null,
            activeGoals: this.activeGoals.length,
            pendingActions: this.pendingActions.length
        };
        
        this.memory.addObservation(observation);
        this.emit('observation', observation);
    }

    /**
     * Check if any goals are completed
     */
    _checkGoalCompletion() {
        for (const goal of this.activeGoals) {
            // Check deadline
            if (goal.deadline && new Date() > new Date(goal.deadline)) {
                goal.fail('Deadline exceeded');
                this.stats.goalsFailed++;
                this.emit('goal-failed', goal.toJSON());
            }
            
            // Check completion conditions (would be more sophisticated in production)
            if (goal.progress >= 100) {
                goal.complete({ message: 'Goal completed' });
                this.stats.goalsCompleted++;
                this.emit('goal-completed', goal.toJSON());
            }
        }
        
        // Remove completed/failed goals from active list
        this.activeGoals = this.activeGoals.filter(g => g.status === 'active');
    }

    /**
     * Activate goals from queue
     */
    _activateGoals() {
        while (
            this.activeGoals.length < this.options.maxConcurrentGoals &&
            this.goalQueue.length > 0
        ) {
            const goal = this.goalQueue.shift();
            goal.start();
            this.activeGoals.push(goal);
            
            // Plan the goal
            this.planner.planGoal(goal).then(plan => {
                for (const step of plan.steps) {
                    const action = new AgentAction(step);
                    goal.addAction(action);
                    this.pendingActions.push({ goalId: goal.id, action });
                }
            });
            
            this.emit('goal-activated', goal.toJSON());
        }
    }

    /**
     * Execute next pending action
     */
    async _executeNextAction() {
        // Check rate limit
        if (!this._checkRateLimit()) {
            this.mode = 'waiting';
            return;
        }
        
        if (this.pendingActions.length === 0) return;
        
        const { goalId, action } = this.pendingActions.shift();
        const goal = this.goals.get(goalId);
        
        if (!goal || goal.status !== 'active') return;
        
        action.execute();
        this.emit('action-started', { goalId, action: action.toJSON() });
        
        try {
            const result = await this._performAction(action);
            action.complete(result);
            this.stats.actionsExecuted++;
            
            // Update goal progress
            const completedActions = goal.actions.filter(a => a.status === 'completed').length;
            goal.updateProgress((completedActions / goal.actions.length) * 100);
            
            // Learn from success
            if (this.options.learningEnabled) {
                this.memory.addExperience({
                    type: 'success',
                    action: action.toJSON(),
                    goalType: goal.type
                });
            }
            
            this.emit('action-completed', { goalId, action: action.toJSON() });
            
        } catch (error) {
            action.fail(error.message);
            
            // Learn from failure
            if (this.options.learningEnabled) {
                this.memory.addExperience({
                    type: 'failure',
                    action: action.toJSON(),
                    error: error.message,
                    goalType: goal.type
                });
            }
            
            this.emit('action-failed', { goalId, action: action.toJSON(), error: error.message });
            
            // Decide whether to retry or fail goal
            if (this.options.safeMode) {
                goal.fail(`Action failed: ${error.message}`);
            }
        }
        
        this.actionHistory.push(action);
        this.memory.addAction(action.toJSON());
    }

    /**
     * Perform an action
     */
    async _performAction(action) {
        switch (action.type) {
            case 'navigate':
                // Would integrate with panel manager
                return { navigated: true };
                
            case 'click':
                // Would integrate with Playwright
                return { clicked: true };
                
            case 'input':
                // Would integrate with Playwright
                return { inputted: true };
                
            case 'wait':
                await new Promise(resolve => setTimeout(resolve, action.parameters.duration || 1000));
                return { waited: true };
                
            case 'analyze':
                // Use LLM to analyze
                if (this.llmClient) {
                    const analysis = await this.llmClient.chat([
                        { role: 'system', content: 'Analyze the current game state and provide insights.' },
                        { role: 'user', content: JSON.stringify(this.memory.workingMemory) }
                    ]);
                    return { analysis };
                }
                return { analysis: 'No LLM available' };
                
            case 'decide':
                // Use LLM to make decision
                if (this.llmClient) {
                    const decision = await this.llmClient.chat([
                        { role: 'system', content: 'Make a decision based on the current context.' },
                        { role: 'user', content: action.description }
                    ]);
                    return { decision };
                }
                return { decision: 'Default decision' };
                
            case 'communicate':
                // Send message to user
                this.emit('agent-message', action.parameters.message);
                return { communicated: true };
                
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    }

    /**
     * Check rate limit
     */
    _checkRateLimit() {
        const now = Date.now();
        
        if (now > this.actionRateLimit.resetTime) {
            this.actionRateLimit.count = 0;
            this.actionRateLimit.resetTime = now + 60000;
        }
        
        if (this.actionRateLimit.count >= this.options.maxActionsPerMinute) {
            return false;
        }
        
        this.actionRateLimit.count++;
        return true;
    }

    /**
     * Send a command to the agent
     */
    async command(text) {
        // Parse command and create appropriate goal
        const goal = this.addGoal({
            type: 'immediate',
            description: text,
            priority: 8
        });
        
        return goal;
    }

    /**
     * Get goals
     */
    getGoals(options = {}) {
        let goals = Array.from(this.goals.values());
        
        if (options.status) {
            goals = goals.filter(g => g.status === options.status);
        }
        
        if (options.type) {
            goals = goals.filter(g => g.type === options.type);
        }
        
        return goals.map(g => g.toJSON());
    }

    /**
     * Get action history
     */
    getActionHistory(limit = 100) {
        return this.actionHistory.slice(-limit).map(a => a.toJSON());
    }

    /**
     * Get memory state
     */
    getMemoryState() {
        return this.memory.toJSON();
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
            activeGoals: this.activeGoals.length,
            queuedGoals: this.goalQueue.length,
            pendingActions: this.pendingActions.length,
            mode: this.mode
        };
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: true,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            mode: this.mode,
            hasLLM: !!this.llmClient,
            hasMCP: !!this.mcpManager,
            hasScriptRunner: !!this.scriptRunner,
            hasGameState: !!this.gameState,
            stats: this.getStats()
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stop();
        this.goals.clear();
        this.goalQueue = [];
        this.actionHistory = [];
        this.pendingActions = [];
        this.emit('destroyed');
    }
}

// Export singleton and class
let instance = null;

module.exports = {
    AgentController,
    AgentGoal,
    AgentAction,
    AgentMemory,
    AgentPlanner,
    
    getInstance(options) {
        if (!instance) {
            instance = new AgentController(options);
        }
        return instance;
    }
};
