/**
 * Advanced Diagnostic Tools
 * Comprehensive troubleshooting and system analysis utilities
 * SvonyBrowser v2.2.13
 */

const { app, webContents, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { getErrorHandler } = require('./error-handler');
const { getMonitoringSystem } = require('./monitoring');
const { getLogger } = require('./logger');

class DiagnosticTools {
    constructor() {
        this.errorHandler = getErrorHandler();
        this.monitoring = getMonitoringSystem();
        this.logger = getLogger();
        this.diagnosticSessions = new Map();
        this.performanceProfiles = new Map();
    }

    async runComprehensiveDiagnostic() {
        const diagnosticId = `diag-${Date.now()}`;
        const results = {
            id: diagnosticId,
            timestamp: new Date().toISOString(),
            systemInfo: await this.collectSystemInfo(),
            applicationHealth: await this.checkApplicationHealth(),
            performanceAnalysis: await this.analyzePerformance(),
            fileSystemCheck: await this.checkFileSystemHealth(),
            networkDiagnostic: await this.diagnoseNetwork(),
            flashPlayerStatus: await this.checkFlashPlayerStatus(),
            memoryAnalysis: await this.analyzeMemoryUsage(),
            errorAnalysis: await this.analyzeRecentErrors(),
            recommendations: []
        };

        // Generate recommendations based on findings
        results.recommendations = this.generateRecommendations(results);
        
        // Save diagnostic report
        await this.saveDiagnosticReport(results);
        
        this.logger.info('Comprehensive diagnostic completed', { 
            diagnosticId,
            issuesFound: results.recommendations.length 
        }, 'DIAGNOSTICS');

        return results;
    }

    async collectSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            electronVersion: process.versions.electron,
            chromeVersion: process.versions.chrome,
            appVersion: app.getVersion(),
            userAgent: navigator.userAgent,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            env: {
                isDevelopment: process.env.NODE_ENV === 'development',
                logLevel: process.env.LOG_LEVEL || 'info',
                userDataPath: app.getPath('userData'),
                tempPath: app.getPath('temp')
            }
        };
    }

    async checkApplicationHealth() {
        const healthData = this.monitoring.getSystemHealth();
        const webContentsList = webContents.getAllWebContents();
        
        return {
            overallHealth: healthData.overall,
            healthChecks: healthData.checks,
            webContents: {
                total: webContentsList.length,
                crashed: webContentsList.filter(wc => wc.isCrashed()).length,
                loading: webContentsList.filter(wc => wc.isLoading()).length,
                responsive: webContentsList.filter(wc => !wc.isDestroyed()).length
            },
            windows: {
                total: BrowserWindow.getAllWindows().length,
                visible: BrowserWindow.getAllWindows().filter(w => w.isVisible()).length,
                minimized: BrowserWindow.getAllWindows().filter(w => w.isMinimized()).length
            }
        };
    }

    async analyzePerformance() {
        const cpuUsage = process.cpuUsage();
        const memUsage = process.memoryUsage();
        
        // Perform a brief performance test
        const performanceTest = await this.runPerformanceTest();
        
        return {
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system,
                utilization: this.calculateCpuUtilization(cpuUsage)
            },
            memory: {
                rss: memUsage.rss,
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                heapUtilization: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            performanceTest,
            gc: {
                available: typeof global.gc === 'function',
                recommendation: memUsage.heapUsed / memUsage.heapTotal > 0.8 ? 'Consider garbage collection' : 'Memory usage normal'
            }
        };
    }

    async runPerformanceTest() {
        const tests = [];
        
        // Event loop responsiveness test
        const eventLoopStart = Date.now();
        await new Promise(resolve => setImmediate(resolve));
        const eventLoopTime = Date.now() - eventLoopStart;
        tests.push({ name: 'Event Loop Responsiveness', time: eventLoopTime, unit: 'ms' });

        // File system performance test
        const fsStart = Date.now();
        try {
            const testFile = path.join(app.getPath('temp'), 'perf-test-' + Date.now());
            await fs.writeFile(testFile, 'performance test');
            await fs.readFile(testFile);
            await fs.unlink(testFile);
            const fsTime = Date.now() - fsStart;
            tests.push({ name: 'File System I/O', time: fsTime, unit: 'ms' });
        } catch (error) {
            tests.push({ name: 'File System I/O', error: error.message });
        }

        // JSON processing performance test
        const jsonStart = Date.now();
        const testData = { test: 'data', array: new Array(1000).fill().map((_, i) => ({ id: i, value: Math.random() })) };
        const serialized = JSON.stringify(testData);
        const parsed = JSON.parse(serialized);
        const jsonTime = Date.now() - jsonStart;
        tests.push({ name: 'JSON Processing', time: jsonTime, unit: 'ms', dataSize: serialized.length });

        return tests;
    }

    calculateCpuUtilization(cpuUsage) {
        // This is a simplified calculation
        const total = cpuUsage.user + cpuUsage.system;
        const uptime = process.uptime() * 1000000; // Convert to microseconds
        return total / uptime * 100;
    }

    async checkFileSystemHealth() {
        const paths = [
            { name: 'User Data', path: app.getPath('userData') },
            { name: 'Temp', path: app.getPath('temp') },
            { name: 'Documents', path: app.getPath('documents') },
            { name: 'Downloads', path: app.getPath('downloads') }
        ];

        const results = [];
        
        for (const pathInfo of paths) {
            try {
                const stats = await fs.stat(pathInfo.path);
                const testFile = path.join(pathInfo.path, 'svony-fs-test-' + Date.now());
                
                // Test write permission
                await fs.writeFile(testFile, 'test');
                await fs.unlink(testFile);
                
                results.push({
                    name: pathInfo.name,
                    path: pathInfo.path,
                    accessible: true,
                    writable: true,
                    lastAccessed: stats.atime,
                    lastModified: stats.mtime
                });
            } catch (error) {
                results.push({
                    name: pathInfo.name,
                    path: pathInfo.path,
                    accessible: false,
                    writable: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    async diagnoseNetwork() {
        const networkTests = [];
        
        // Test common endpoints
        const endpoints = [
            { name: 'DNS Resolution', url: 'https://www.google.com', timeout: 5000 },
            { name: 'HTTPS Connection', url: 'https://httpbin.org/get', timeout: 10000 },
            { name: 'Evony Servers', url: 'https://www.evony.com', timeout: 10000 }
        ];

        for (const endpoint of endpoints) {
            const testStart = Date.now();
            try {
                const response = await fetch(endpoint.url, {
                    method: 'HEAD',
                    signal: AbortSignal.timeout(endpoint.timeout)
                });
                
                networkTests.push({
                    name: endpoint.name,
                    url: endpoint.url,
                    status: response.status,
                    responseTime: Date.now() - testStart,
                    success: true
                });
            } catch (error) {
                networkTests.push({
                    name: endpoint.name,
                    url: endpoint.url,
                    success: false,
                    error: error.message,
                    responseTime: Date.now() - testStart
                });
            }
        }

        return {
            tests: networkTests,
            connectivity: networkTests.filter(t => t.success).length > 0 ? 'working' : 'failed',
            averageResponseTime: networkTests
                .filter(t => t.success && t.responseTime)
                .reduce((sum, t) => sum + t.responseTime, 0) / networkTests.filter(t => t.success).length
        };
    }

    async checkFlashPlayerStatus() {
        // This would check for Flash Player availability and status
        return {
            available: false, // Flash is deprecated
            version: null,
            enabled: false,
            recommendation: 'Flash Player is deprecated. Consider migrating to modern web technologies.'
        };
    }

    async analyzeMemoryUsage() {
        const memUsage = process.memoryUsage();
        const webContentsList = webContents.getAllWebContents();
        
        // Estimate memory usage by components
        const componentMemory = {
            mainProcess: memUsage.rss,
            rendererProcesses: webContentsList.length * 50 * 1024 * 1024, // Estimate 50MB per renderer
            heapUsage: memUsage.heapUsed,
            externalObjects: memUsage.external
        };

        return {
            total: memUsage,
            breakdown: componentMemory,
            analysis: {
                heapUtilization: (memUsage.heapUsed / memUsage.heapTotal) * 100,
                memoryPressure: memUsage.rss > 500 * 1024 * 1024 ? 'high' : 'normal',
                recommendations: this.generateMemoryRecommendations(memUsage, webContentsList.length)
            }
        };
    }

    generateMemoryRecommendations(memUsage, rendererCount) {
        const recommendations = [];
        
        if (memUsage.heapUsed / memUsage.heapTotal > 0.8) {
            recommendations.push('Heap usage is high. Consider running garbage collection.');
        }
        
        if (memUsage.rss > 1000 * 1024 * 1024) { // 1GB
            recommendations.push('RSS memory usage is high. Consider closing unused tabs or windows.');
        }
        
        if (rendererCount > 10) {
            recommendations.push(`${rendererCount} renderer processes detected. Consider consolidating tabs.`);
        }
        
        return recommendations;
    }

    async analyzeRecentErrors() {
        try {
            const errorStats = this.errorHandler.getErrorStatistics();
            const recentLogs = await this.logger.queryLogs({
                level: 'ERROR',
                since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            });

            const errorPatterns = this.identifyErrorPatterns(recentLogs);
            
            return {
                statistics: errorStats,
                recentErrors: recentLogs.slice(0, 10), // Last 10 errors
                patterns: errorPatterns,
                errorRate: this.calculateErrorRate(recentLogs),
                criticalErrors: recentLogs.filter(log => log.level === 'FATAL').length
            };
        } catch (error) {
            return {
                error: 'Failed to analyze errors: ' + error.message
            };
        }
    }

    identifyErrorPatterns(logs) {
        const patterns = {};
        
        logs.forEach(log => {
            // Group by error type or module
            const key = log.module || 'unknown';
            if (!patterns[key]) {
                patterns[key] = { count: 0, messages: [] };
            }
            patterns[key].count++;
            if (patterns[key].messages.length < 3) {
                patterns[key].messages.push(log.message);
            }
        });

        // Sort by frequency
        return Object.entries(patterns)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 5) // Top 5 patterns
            .map(([module, data]) => ({ module, ...data }));
    }

    calculateErrorRate(logs) {
        if (logs.length === 0) return 0;
        
        const timeSpan = 24; // hours
        const errorsPerHour = logs.length / timeSpan;
        
        return {
            errorsPerHour: Math.round(errorsPerHour * 100) / 100,
            severity: errorsPerHour > 10 ? 'high' : errorsPerHour > 5 ? 'medium' : 'low'
        };
    }

    generateRecommendations(diagnosticResults) {
        const recommendations = [];

        // Performance recommendations
        if (diagnosticResults.performanceAnalysis.memory.heapUtilization > 80) {
            recommendations.push({
                type: 'performance',
                severity: 'high',
                title: 'High Memory Usage',
                description: 'Heap utilization is above 80%. Consider optimizing memory usage or running garbage collection.',
                action: 'Restart application or close unused features'
            });
        }

        // Health recommendations
        if (diagnosticResults.applicationHealth.overallHealth === 'unhealthy') {
            recommendations.push({
                type: 'health',
                severity: 'critical',
                title: 'Application Health Issues',
                description: 'Multiple health checks are failing.',
                action: 'Review error logs and restart application components'
            });
        }

        // Network recommendations
        if (!diagnosticResults.networkDiagnostic.connectivity || 
            diagnosticResults.networkDiagnostic.averageResponseTime > 5000) {
            recommendations.push({
                type: 'network',
                severity: 'medium',
                title: 'Network Connectivity Issues',
                description: 'Slow or failed network connections detected.',
                action: 'Check internet connection and firewall settings'
            });
        }

        // Error rate recommendations
        if (diagnosticResults.errorAnalysis.errorRate?.severity === 'high') {
            recommendations.push({
                type: 'stability',
                severity: 'high',
                title: 'High Error Rate',
                description: `High error rate detected: ${diagnosticResults.errorAnalysis.errorRate.errorsPerHour} errors/hour`,
                action: 'Review error patterns and fix underlying issues'
            });
        }

        // File system recommendations
        const fsIssues = diagnosticResults.fileSystemCheck.filter(check => !check.accessible || !check.writable);
        if (fsIssues.length > 0) {
            recommendations.push({
                type: 'filesystem',
                severity: 'medium',
                title: 'File System Access Issues',
                description: `${fsIssues.length} file system paths have access issues`,
                action: 'Check file permissions and available disk space'
            });
        }

        return recommendations;
    }

    async saveDiagnosticReport(results) {
        try {
            const reportsDir = path.join(app.getPath('userData'), 'diagnostic-reports');
            await fs.mkdir(reportsDir, { recursive: true });
            
            const reportFile = path.join(reportsDir, `diagnostic-${results.id}.json`);
            await fs.writeFile(reportFile, JSON.stringify(results, null, 2));
            
            this.logger.info('Diagnostic report saved', { 
                reportFile,
                recommendationCount: results.recommendations.length 
            }, 'DIAGNOSTICS');
            
            return reportFile;
        } catch (error) {
            this.logger.error('Failed to save diagnostic report', { error: error.message }, 'DIAGNOSTICS');
            throw error;
        }
    }

    async generateSystemReport() {
        const report = {
            timestamp: new Date().toISOString(),
            system: await this.collectSystemInfo(),
            health: this.monitoring.getSystemHealth(),
            performance: await this.analyzePerformance(),
            errors: await this.logger.getLogStatistics(24)
        };

        return report;
    }

    // Utility methods for manual diagnostics
    async testComponent(componentName, testFunction) {
        const testId = `test-${componentName}-${Date.now()}`;
        this.logger.info(`Starting component test: ${componentName}`, { testId }, 'DIAGNOSTICS');
        
        const startTime = Date.now();
        try {
            const result = await testFunction();
            const duration = Date.now() - startTime;
            
            this.logger.info(`Component test completed: ${componentName}`, { 
                testId, 
                duration, 
                success: true,
                result 
            }, 'DIAGNOSTICS');
            
            return { success: true, result, duration };
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.logger.error(`Component test failed: ${componentName}`, { 
                testId, 
                duration, 
                error: error.message 
            }, 'DIAGNOSTICS');
            
            return { success: false, error: error.message, duration };
        }
    }

    enablePerformanceProfile(name) {
        const profile = {
            name,
            startTime: Date.now(),
            startCpu: process.cpuUsage(),
            startMemory: process.memoryUsage(),
            events: []
        };
        
        this.performanceProfiles.set(name, profile);
        this.logger.info(`Performance profiling started: ${name}`, {}, 'DIAGNOSTICS');
        
        return name;
    }

    recordPerformanceEvent(profileName, eventName, data = {}) {
        const profile = this.performanceProfiles.get(profileName);
        if (profile) {
            profile.events.push({
                name: eventName,
                timestamp: Date.now(),
                relativeTime: Date.now() - profile.startTime,
                data
            });
        }
    }

    disablePerformanceProfile(name) {
        const profile = this.performanceProfiles.get(name);
        if (profile) {
            profile.endTime = Date.now();
            profile.duration = profile.endTime - profile.startTime;
            profile.endCpu = process.cpuUsage(profile.startCpu);
            profile.endMemory = process.memoryUsage();
            
            this.performanceProfiles.delete(name);
            
            this.logger.info(`Performance profiling completed: ${name}`, {
                duration: profile.duration,
                events: profile.events.length,
                cpuUsage: profile.endCpu,
                memoryDelta: profile.endMemory.heapUsed - profile.startMemory.heapUsed
            }, 'DIAGNOSTICS');
            
            return profile;
        }
        return null;
    }
}

// Singleton instance
let diagnosticTools = null;

function getDiagnosticTools() {
    if (!diagnosticTools) {
        diagnosticTools = new DiagnosticTools();
    }
    return diagnosticTools;
}

module.exports = {
    DiagnosticTools,
    getDiagnosticTools
};
