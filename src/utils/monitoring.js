/**
 * Comprehensive Monitoring System
 * Implements performance monitoring, health checks, and system metrics
 * SvonyBrowser v2.2.13
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { getErrorHandler } = require('./error-handler');

class MonitoringSystem {
    constructor() {
        this.errorHandler = getErrorHandler();
        this.metrics = new Map();
        this.healthChecks = new Map();
        this.performanceCounters = new Map();
        this.alertThresholds = {
            memoryUsage: 0.8,        // 80% of available memory
            cpuUsage: 0.9,           // 90% CPU usage
            diskSpace: 0.9,          // 90% disk usage
            responseTime: 5000,      // 5 seconds response time
            errorRate: 0.1           // 10% error rate
        };
        this.monitoringInterval = null;
        this.metricsHistory = [];
        this.maxHistoryLength = 1000;
        
        this.initializeMonitoring();
    }

    async initializeMonitoring() {
        // Start periodic monitoring
        this.startPeriodicMonitoring();
        
        // Register default health checks
        this.registerDefaultHealthChecks();
        
        // Setup metric collection
        this.setupMetricCollection();
        
        console.log('Monitoring system initialized');
    }

    startPeriodicMonitoring() {
        // Run monitoring every 30 seconds
        this.monitoringInterval = setInterval(async () => {
            await this.collectSystemMetrics();
            await this.runHealthChecks();
            await this.checkAlerts();
            await this.rotateMetricsHistory();
        }, 30000);
    }

    async collectSystemMetrics() {
        const timestamp = Date.now();
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const systemMetrics = {
            timestamp,
            memory: {
                rss: memoryUsage.rss,
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                external: memoryUsage.external,
                arrayBuffers: memoryUsage.arrayBuffers
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            uptime: process.uptime(),
            platform: process.platform,
            arch: process.arch,
            version: {
                node: process.version,
                electron: process.versions.electron,
                app: app.getVersion()
            }
        };

        // Add application-specific metrics
        systemMetrics.application = await this.collectApplicationMetrics();
        
        this.metrics.set('system', systemMetrics);
        this.metricsHistory.push({
            type: 'system',
            timestamp,
            data: systemMetrics
        });

        return systemMetrics;
    }

    async collectApplicationMetrics() {
        const errorStats = this.errorHandler.getErrorStatistics();
        
        return {
            errors: errorStats,
            webContents: this.getWebContentsMetrics(),
            fileSystem: await this.getFileSystemMetrics(),
            network: this.getNetworkMetrics()
        };
    }

    getWebContentsMetrics() {
        const { webContents } = require('electron');
        const allWebContents = webContents.getAllWebContents();
        
        return {
            count: allWebContents.length,
            crashed: allWebContents.filter(wc => wc.isCrashed()).length,
            loading: allWebContents.filter(wc => wc.isLoading()).length,
            audioMuted: allWebContents.filter(wc => wc.isAudioMuted()).length
        };
    }

    async getFileSystemMetrics() {
        try {
            const userDataPath = app.getPath('userData');
            const stats = await fs.stat(userDataPath);
            
            return {
                userDataPath,
                accessible: true,
                lastAccessed: stats.atime,
                lastModified: stats.mtime
            };
        } catch (error) {
            this.errorHandler.logError('Failed to collect file system metrics', { error: error.message });
            return {
                accessible: false,
                error: error.message
            };
        }
    }

    getNetworkMetrics() {
        // This would integrate with network monitoring if available
        return {
            connections: this.performanceCounters.get('network_connections') || 0,
            bytesTransferred: this.performanceCounters.get('bytes_transferred') || 0,
            requestCount: this.performanceCounters.get('request_count') || 0,
            errorCount: this.performanceCounters.get('network_errors') || 0
        };
    }

    registerDefaultHealthChecks() {
        // Memory health check
        this.registerHealthCheck('memory', async () => {
            const usage = process.memoryUsage();
            const heapUsedPercent = usage.heapUsed / usage.heapTotal;
            
            return {
                healthy: heapUsedPercent < this.alertThresholds.memoryUsage,
                details: {
                    heapUsedPercent: Math.round(heapUsedPercent * 100) + '%',
                    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
                    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB'
                }
            };
        });

        // Application responsiveness check
        this.registerHealthCheck('responsiveness', async () => {
            const start = Date.now();
            await new Promise(resolve => setImmediate(resolve));
            const responseTime = Date.now() - start;
            
            return {
                healthy: responseTime < 100,
                details: {
                    responseTime: responseTime + 'ms',
                    threshold: '100ms'
                }
            };
        });

        // File system access check
        this.registerHealthCheck('filesystem', async () => {
            try {
                const testFile = path.join(app.getPath('temp'), 'svony-health-check');
                await fs.writeFile(testFile, 'health-check');
                await fs.unlink(testFile);
                
                return {
                    healthy: true,
                    details: { message: 'File system read/write operations successful' }
                };
            } catch (error) {
                return {
                    healthy: false,
                    details: { error: error.message }
                };
            }
        });
    }

    registerHealthCheck(name, checkFunction) {
        this.healthChecks.set(name, {
            name,
            check: checkFunction,
            lastRun: null,
            lastResult: null,
            consecutive_failures: 0
        });
    }

    async runHealthChecks() {
        const results = new Map();
        
        for (const [name, healthCheck] of this.healthChecks) {
            try {
                const result = await healthCheck.check();
                const timestamp = Date.now();
                
                healthCheck.lastRun = timestamp;
                healthCheck.lastResult = result;
                
                if (!result.healthy) {
                    healthCheck.consecutive_failures++;
                    this.errorHandler.logWarning(`Health check '${name}' failed`, {
                        result,
                        consecutiveFailures: healthCheck.consecutive_failures
                    });
                } else {
                    healthCheck.consecutive_failures = 0;
                }
                
                results.set(name, {
                    ...result,
                    timestamp,
                    consecutiveFailures: healthCheck.consecutive_failures
                });
                
            } catch (error) {
                this.errorHandler.logError(`Health check '${name}' threw exception`, {
                    error: error.message,
                    stack: error.stack
                });
                
                results.set(name, {
                    healthy: false,
                    details: { error: error.message },
                    timestamp: Date.now()
                });
            }
        }
        
        this.metrics.set('healthChecks', Object.fromEntries(results));
        return results;
    }

    async checkAlerts() {
        const systemMetrics = this.metrics.get('system');
        if (!systemMetrics) return;

        // Memory usage alert
        const memoryPercent = systemMetrics.memory.heapUsed / systemMetrics.memory.heapTotal;
        if (memoryPercent > this.alertThresholds.memoryUsage) {
            this.errorHandler.logWarning('High memory usage detected', {
                usage: Math.round(memoryPercent * 100) + '%',
                threshold: Math.round(this.alertThresholds.memoryUsage * 100) + '%',
                heapUsed: Math.round(systemMetrics.memory.heapUsed / 1024 / 1024) + ' MB'
            });
        }

        // Error rate alert
        if (systemMetrics.application.errors.totalErrors > 0) {
            const recentErrors = this.getRecentErrorCount(300000); // Last 5 minutes
            const errorRate = recentErrors / 100; // Assuming ~100 operations per 5 minutes
            
            if (errorRate > this.alertThresholds.errorRate) {
                this.errorHandler.logWarning('High error rate detected', {
                    errorRate: Math.round(errorRate * 100) + '%',
                    recentErrors,
                    threshold: Math.round(this.alertThresholds.errorRate * 100) + '%'
                });
            }
        }
    }

    getRecentErrorCount(timeWindowMs) {
        const cutoff = Date.now() - timeWindowMs;
        return this.metricsHistory.filter(entry => 
            entry.timestamp > cutoff && 
            entry.type === 'error'
        ).length;
    }

    async rotateMetricsHistory() {
        if (this.metricsHistory.length > this.maxHistoryLength) {
            this.metricsHistory = this.metricsHistory.slice(-this.maxHistoryLength);
        }

        // Archive old metrics to file periodically
        if (this.metricsHistory.length % 100 === 0) {
            await this.archiveMetrics();
        }
    }

    async archiveMetrics() {
        try {
            const metricsDir = path.join(app.getPath('userData'), 'metrics');
            await fs.mkdir(metricsDir, { recursive: true });
            
            const timestamp = new Date().toISOString().split('T')[0];
            const archiveFile = path.join(metricsDir, `metrics-${timestamp}.json`);
            
            const archiveData = {
                timestamp: Date.now(),
                metrics: this.metricsHistory.slice(0, -50), // Keep last 50 in memory
                summary: this.generateMetricsSummary()
            };
            
            await fs.writeFile(archiveFile, JSON.stringify(archiveData, null, 2));
            
            // Keep only archived metrics
            this.metricsHistory = this.metricsHistory.slice(-50);
            
        } catch (error) {
            this.errorHandler.logError('Failed to archive metrics', { error: error.message });
        }
    }

    generateMetricsSummary() {
        const now = Date.now();
        const hourAgo = now - 3600000;
        
        const recentMetrics = this.metricsHistory.filter(m => m.timestamp > hourAgo);
        
        return {
            period: '1 hour',
            totalEntries: recentMetrics.length,
            errorCount: recentMetrics.filter(m => m.type === 'error').length,
            avgMemoryUsage: this.calculateAverageMemoryUsage(recentMetrics),
            healthCheckResults: this.summarizeHealthChecks()
        };
    }

    calculateAverageMemoryUsage(metrics) {
        const systemMetrics = metrics.filter(m => m.type === 'system' && m.data.memory);
        if (systemMetrics.length === 0) return 0;
        
        const totalUsage = systemMetrics.reduce((sum, m) => 
            sum + (m.data.memory.heapUsed / m.data.memory.heapTotal), 0);
        
        return Math.round((totalUsage / systemMetrics.length) * 100) + '%';
    }

    summarizeHealthChecks() {
        const healthResults = this.metrics.get('healthChecks');
        if (!healthResults) return {};
        
        const summary = {};
        for (const [name, result] of Object.entries(healthResults)) {
            summary[name] = {
                healthy: result.healthy,
                consecutiveFailures: result.consecutiveFailures
            };
        }
        return summary;
    }

    // Public API methods
    incrementCounter(name, value = 1) {
        const current = this.performanceCounters.get(name) || 0;
        this.performanceCounters.set(name, current + value);
    }

    recordMetric(name, value, tags = {}) {
        this.metricsHistory.push({
            type: 'custom',
            name,
            value,
            tags,
            timestamp: Date.now()
        });
    }

    getSystemHealth() {
        return {
            overall: this.calculateOverallHealth(),
            checks: this.metrics.get('healthChecks') || {},
            metrics: this.metrics.get('system') || {},
            uptime: process.uptime()
        };
    }

    calculateOverallHealth() {
        const healthChecks = this.metrics.get('healthChecks');
        if (!healthChecks) return 'unknown';
        
        const checks = Object.values(healthChecks);
        const healthyCount = checks.filter(c => c.healthy).length;
        const totalCount = checks.length;
        
        if (totalCount === 0) return 'unknown';
        if (healthyCount === totalCount) return 'healthy';
        if (healthyCount / totalCount >= 0.8) return 'degraded';
        return 'unhealthy';
    }

    shutdown() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        // Archive final metrics
        this.archiveMetrics().catch(error => 
            console.error('Failed to archive final metrics:', error)
        );
        
        console.log('Monitoring system shut down');
    }
}

// Singleton instance
let monitoringSystem = null;

function getMonitoringSystem() {
    if (!monitoringSystem) {
        monitoringSystem = new MonitoringSystem();
    }
    return monitoringSystem;
}

module.exports = {
    MonitoringSystem,
    getMonitoringSystem
};
