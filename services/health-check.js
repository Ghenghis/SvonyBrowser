/**
 * Service Health Check System
 * Monitors all services and provides status reporting
 * v2.1.0
 */

const EventEmitter = require('events');

/**
 * Service Status
 */
const ServiceStatus = {
    UNKNOWN: 'unknown',
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    UNHEALTHY: 'unhealthy',
    OFFLINE: 'offline'
};

/**
 * Health Check Result
 */
class HealthCheckResult {
    constructor(serviceName, status, details = {}) {
        this.serviceName = serviceName;
        this.status = status;
        this.timestamp = new Date().toISOString();
        this.responseTime = details.responseTime || 0;
        this.message = details.message || '';
        this.metadata = details.metadata || {};
    }

    toJSON() {
        return {
            serviceName: this.serviceName,
            status: this.status,
            timestamp: this.timestamp,
            responseTime: this.responseTime,
            message: this.message,
            metadata: this.metadata
        };
    }
}

/**
 * Health Check Manager
 */
class HealthCheckManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            checkInterval: options.checkInterval || 30000, // 30 seconds
            timeout: options.timeout || 5000, // 5 seconds
            retryCount: options.retryCount || 2,
            ...options
        };
        
        this.services = new Map();
        this.results = new Map();
        this.checkInterval = null;
        this.isRunning = false;
        
        console.log('[HealthCheck] Manager created');
    }

    /**
     * Register a service for health checking
     */
    registerService(name, config) {
        this.services.set(name, {
            name,
            checkFn: config.checkFn || null,
            instance: config.instance || null,
            critical: config.critical !== false,
            timeout: config.timeout || this.options.timeout,
            lastCheck: null,
            consecutiveFailures: 0,
            ...config
        });
        
        console.log(`[HealthCheck] Registered service: ${name}`);
        return this;
    }

    /**
     * Unregister a service
     */
    unregisterService(name) {
        this.services.delete(name);
        this.results.delete(name);
        return this;
    }

    /**
     * Check a single service
     */
    async checkService(name) {
        const service = this.services.get(name);
        if (!service) {
            return new HealthCheckResult(name, ServiceStatus.UNKNOWN, {
                message: 'Service not registered'
            });
        }

        const startTime = Date.now();
        
        try {
            let status = ServiceStatus.HEALTHY;
            let message = 'OK';
            let metadata = {};

            // Use custom check function if provided
            if (service.checkFn) {
                const result = await Promise.race([
                    service.checkFn(service.instance),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), service.timeout)
                    )
                ]);
                
                if (typeof result === 'object') {
                    status = result.status || ServiceStatus.HEALTHY;
                    message = result.message || 'OK';
                    metadata = result.metadata || {};
                }
            } 
            // Default checks based on instance properties
            else if (service.instance) {
                // Check common status methods
                if (typeof service.instance.isConnected === 'function') {
                    status = service.instance.isConnected() ? ServiceStatus.HEALTHY : ServiceStatus.OFFLINE;
                } else if (typeof service.instance.getStatus === 'function') {
                    const instanceStatus = service.instance.getStatus();
                    if (instanceStatus.connected === false || instanceStatus.initialized === false) {
                        status = ServiceStatus.OFFLINE;
                    }
                    metadata = instanceStatus;
                } else if (service.instance.isInitialized !== undefined) {
                    status = service.instance.isInitialized ? ServiceStatus.HEALTHY : ServiceStatus.OFFLINE;
                }
            }

            const responseTime = Date.now() - startTime;
            
            // Check for degraded performance
            if (status === ServiceStatus.HEALTHY && responseTime > 1000) {
                status = ServiceStatus.DEGRADED;
                message = 'Slow response';
            }

            service.consecutiveFailures = 0;
            
            const result = new HealthCheckResult(name, status, {
                responseTime,
                message,
                metadata
            });
            
            this.results.set(name, result);
            this.emit('check-complete', result);
            
            return result;

        } catch (error) {
            service.consecutiveFailures++;
            
            const status = service.consecutiveFailures >= 3 
                ? ServiceStatus.UNHEALTHY 
                : ServiceStatus.DEGRADED;
            
            const result = new HealthCheckResult(name, status, {
                responseTime: Date.now() - startTime,
                message: error.message,
                metadata: { error: error.name, consecutiveFailures: service.consecutiveFailures }
            });
            
            this.results.set(name, result);
            this.emit('check-failed', result);
            
            return result;
        }
    }

    /**
     * Check all registered services
     */
    async checkAll() {
        const results = {};
        const promises = [];
        
        for (const [name] of this.services) {
            promises.push(
                this.checkService(name).then(result => {
                    results[name] = result;
                })
            );
        }
        
        await Promise.all(promises);
        
        this.emit('check-all-complete', results);
        return results;
    }

    /**
     * Get overall system health
     */
    getOverallHealth() {
        let overallStatus = ServiceStatus.HEALTHY;
        let healthyCount = 0;
        let degradedCount = 0;
        let unhealthyCount = 0;
        let offlineCount = 0;
        let criticalIssues = [];
        
        for (const [name, result] of this.results) {
            const service = this.services.get(name);
            
            switch (result.status) {
                case ServiceStatus.HEALTHY:
                    healthyCount++;
                    break;
                case ServiceStatus.DEGRADED:
                    degradedCount++;
                    if (overallStatus === ServiceStatus.HEALTHY) {
                        overallStatus = ServiceStatus.DEGRADED;
                    }
                    break;
                case ServiceStatus.UNHEALTHY:
                    unhealthyCount++;
                    overallStatus = ServiceStatus.UNHEALTHY;
                    if (service?.critical) {
                        criticalIssues.push(name);
                    }
                    break;
                case ServiceStatus.OFFLINE:
                    offlineCount++;
                    if (service?.critical) {
                        overallStatus = ServiceStatus.UNHEALTHY;
                        criticalIssues.push(name);
                    } else if (overallStatus === ServiceStatus.HEALTHY) {
                        overallStatus = ServiceStatus.DEGRADED;
                    }
                    break;
            }
        }
        
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            summary: {
                total: this.services.size,
                healthy: healthyCount,
                degraded: degradedCount,
                unhealthy: unhealthyCount,
                offline: offlineCount
            },
            criticalIssues,
            services: Object.fromEntries(
                Array.from(this.results.entries()).map(([name, result]) => [name, result.toJSON()])
            )
        };
    }

    /**
     * Start periodic health checks
     */
    start() {
        if (this.isRunning) return this;
        
        this.isRunning = true;
        
        // Initial check
        this.checkAll();
        
        // Periodic checks
        this.checkInterval = setInterval(() => {
            this.checkAll();
        }, this.options.checkInterval);
        
        this.emit('started');
        console.log('[HealthCheck] Started periodic checks');
        
        return this;
    }

    /**
     * Stop periodic health checks
     */
    stop() {
        if (!this.isRunning) return this;
        
        this.isRunning = false;
        
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        this.emit('stopped');
        console.log('[HealthCheck] Stopped periodic checks');
        
        return this;
    }

    /**
     * Get status of a specific service
     */
    getServiceStatus(name) {
        return this.results.get(name)?.toJSON() || null;
    }

    /**
     * Get all service statuses
     */
    getAllStatuses() {
        const statuses = {};
        for (const [name, result] of this.results) {
            statuses[name] = result.toJSON();
        }
        return statuses;
    }

    /**
     * Register common Svony Browser services
     */
    registerSvonyServices(services) {
        const serviceConfigs = [
            { name: 'lmStudio', instance: services.lmStudioClient, critical: false },
            { name: 'chatbot', instance: services.chatbotService, critical: true },
            { name: 'mcpManager', instance: services.mcpClientManager, critical: false },
            { name: 'gameState', instance: services.gameStateTracker, critical: false },
            { name: 'playwright', instance: services.playwrightService, critical: false },
            { name: 'fiddlerBridge', instance: services.fiddlerBridge, critical: false },
            { name: 'debugManager', instance: services.debugManager, critical: false },
            { name: 'scriptRunner', instance: services.scriptRunner, critical: false },
            { name: 'agentController', instance: services.agentController, critical: false },
            { name: 'panelManager', instance: services.panelManager, critical: true },
            { name: 'voiceService', instance: services.voiceService, critical: false }
        ];
        
        for (const config of serviceConfigs) {
            if (config.instance) {
                this.registerService(config.name, config);
            }
        }
        
        return this;
    }
}

// Singleton instance
let instance = null;

function getHealthCheckManager() {
    if (!instance) {
        instance = new HealthCheckManager();
    }
    return instance;
}

module.exports = {
    HealthCheckManager,
    HealthCheckResult,
    ServiceStatus,
    getHealthCheckManager
};
