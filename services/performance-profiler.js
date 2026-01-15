/**
 * Performance Profiler Service
 * CPU, Memory, and Network performance profiling
 * v2.0.9
 */

const EventEmitter = require('events');
const v8 = require('v8');
const os = require('os');

/**
 * Performance Sample
 */
class PerformanceSample {
    constructor(type, data) {
        this.id = `sample-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.timestamp = Date.now();
        this.type = type;
        this.data = data;
    }
}

/**
 * CPU Profile Entry
 */
class CPUProfileEntry {
    constructor(data) {
        this.functionName = data.functionName || '(anonymous)';
        this.url = data.url || '';
        this.lineNumber = data.lineNumber || 0;
        this.columnNumber = data.columnNumber || 0;
        this.hitCount = data.hitCount || 0;
        this.selfTime = data.selfTime || 0;
        this.totalTime = data.totalTime || 0;
        this.children = data.children || [];
    }

    getPercentage(totalTime) {
        return totalTime > 0 ? (this.totalTime / totalTime) * 100 : 0;
    }
}

/**
 * Memory Snapshot
 */
class MemorySnapshot {
    constructor() {
        this.id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.timestamp = new Date().toISOString();
        this.heapStatistics = v8.getHeapStatistics();
        this.heapSpaceStatistics = v8.getHeapSpaceStatistics();
        this.processMemory = process.memoryUsage();
        this.systemMemory = {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
        };
    }

    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            heap: {
                totalHeapSize: this.heapStatistics.total_heap_size,
                usedHeapSize: this.heapStatistics.used_heap_size,
                heapSizeLimit: this.heapStatistics.heap_size_limit,
                totalAvailable: this.heapStatistics.total_available_size,
                mallocedMemory: this.heapStatistics.malloced_memory,
                peakMallocedMemory: this.heapStatistics.peak_malloced_memory
            },
            heapSpaces: this.heapSpaceStatistics.map(space => ({
                name: space.space_name,
                size: space.space_size,
                used: space.space_used_size,
                available: space.space_available_size
            })),
            process: {
                rss: this.processMemory.rss,
                heapTotal: this.processMemory.heapTotal,
                heapUsed: this.processMemory.heapUsed,
                external: this.processMemory.external,
                arrayBuffers: this.processMemory.arrayBuffers
            },
            system: this.systemMemory
        };
    }
}

/**
 * Performance Mark
 */
class PerformanceMark {
    constructor(name, data = {}) {
        this.id = `mark-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.name = name;
        this.timestamp = Date.now();
        this.data = data;
    }
}

/**
 * Performance Measure
 */
class PerformanceMeasure {
    constructor(name, startMark, endMark) {
        this.id = `measure-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.name = name;
        this.startMark = startMark;
        this.endMark = endMark;
        this.startTime = startMark.timestamp;
        this.endTime = endMark.timestamp;
        this.duration = this.endTime - this.startTime;
    }
}

/**
 * Performance Profiler - Main class
 */
class PerformanceProfiler extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            sampleInterval: options.sampleInterval || 1000, // 1 second
            maxSamples: options.maxSamples || 3600, // 1 hour of samples
            maxSnapshots: options.maxSnapshots || 100,
            maxMarks: options.maxMarks || 1000,
            autoSample: options.autoSample !== false,
            ...options
        };

        // Storage
        this.samples = [];
        this.memorySnapshots = [];
        this.marks = new Map();
        this.measures = [];
        
        // CPU profiling state
        this.cpuProfiles = [];
        this.isCPUProfiling = false;
        this.cpuProfileStartTime = null;
        
        // Timers
        this.timers = new Map();
        
        // Statistics
        this.stats = {
            startTime: Date.now(),
            sampleCount: 0,
            snapshotCount: 0,
            markCount: 0,
            measureCount: 0,
            peakMemory: 0,
            averageCPU: 0
        };

        // Auto sampling
        this.sampleInterval = null;
        if (this.options.autoSample) {
            this.startAutoSampling();
        }
    }

    /**
     * Start automatic sampling
     */
    startAutoSampling() {
        if (this.sampleInterval) return;
        
        this.sampleInterval = setInterval(() => {
            this.takeSample();
        }, this.options.sampleInterval);
        
        this.emit('auto-sampling-started');
    }

    /**
     * Stop automatic sampling
     */
    stopAutoSampling() {
        if (this.sampleInterval) {
            clearInterval(this.sampleInterval);
            this.sampleInterval = null;
        }
        this.emit('auto-sampling-stopped');
    }

    /**
     * Take a performance sample
     */
    takeSample() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const sample = new PerformanceSample('system', {
            memory: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                rss: memUsage.rss,
                external: memUsage.external
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            uptime: process.uptime(),
            loadAverage: os.loadavg()
        });
        
        this.samples.push(sample);
        this.stats.sampleCount++;
        
        // Update peak memory
        if (memUsage.heapUsed > this.stats.peakMemory) {
            this.stats.peakMemory = memUsage.heapUsed;
        }
        
        // Trim samples
        if (this.samples.length > this.options.maxSamples) {
            this.samples.shift();
        }
        
        this.emit('sample', sample);
        return sample;
    }

    /**
     * Take a memory snapshot
     */
    takeMemorySnapshot() {
        const snapshot = new MemorySnapshot();
        this.memorySnapshots.push(snapshot);
        this.stats.snapshotCount++;
        
        // Trim snapshots
        if (this.memorySnapshots.length > this.options.maxSnapshots) {
            this.memorySnapshots.shift();
        }
        
        this.emit('memory-snapshot', snapshot);
        return snapshot;
    }

    /**
     * Compare two memory snapshots
     */
    compareSnapshots(snapshotId1, snapshotId2) {
        const snap1 = this.memorySnapshots.find(s => s.id === snapshotId1);
        const snap2 = this.memorySnapshots.find(s => s.id === snapshotId2);
        
        if (!snap1 || !snap2) return null;
        
        const data1 = snap1.toJSON();
        const data2 = snap2.toJSON();
        
        return {
            timeDiff: new Date(data2.timestamp) - new Date(data1.timestamp),
            heapDiff: {
                totalHeapSize: data2.heap.totalHeapSize - data1.heap.totalHeapSize,
                usedHeapSize: data2.heap.usedHeapSize - data1.heap.usedHeapSize
            },
            processDiff: {
                rss: data2.process.rss - data1.process.rss,
                heapUsed: data2.process.heapUsed - data1.process.heapUsed
            }
        };
    }

    /**
     * Start CPU profiling
     */
    startCPUProfiling() {
        if (this.isCPUProfiling) return false;
        
        this.isCPUProfiling = true;
        this.cpuProfileStartTime = Date.now();
        this.cpuProfileData = [];
        
        // Sample CPU at higher frequency during profiling
        this.cpuProfileInterval = setInterval(() => {
            const usage = process.cpuUsage();
            this.cpuProfileData.push({
                timestamp: Date.now(),
                user: usage.user,
                system: usage.system
            });
        }, 100); // 100ms intervals
        
        this.emit('cpu-profiling-started');
        return true;
    }

    /**
     * Stop CPU profiling
     */
    stopCPUProfiling() {
        if (!this.isCPUProfiling) return null;
        
        clearInterval(this.cpuProfileInterval);
        this.isCPUProfiling = false;
        
        const profile = {
            id: `cpu-${Date.now()}`,
            startTime: this.cpuProfileStartTime,
            endTime: Date.now(),
            duration: Date.now() - this.cpuProfileStartTime,
            samples: this.cpuProfileData,
            summary: this._summarizeCPUProfile(this.cpuProfileData)
        };
        
        this.cpuProfiles.push(profile);
        this.emit('cpu-profiling-stopped', profile);
        return profile;
    }

    /**
     * Summarize CPU profile
     */
    _summarizeCPUProfile(samples) {
        if (samples.length === 0) return null;
        
        let totalUser = 0;
        let totalSystem = 0;
        let maxUser = 0;
        let maxSystem = 0;
        
        for (let i = 1; i < samples.length; i++) {
            const userDiff = samples[i].user - samples[i-1].user;
            const systemDiff = samples[i].system - samples[i-1].system;
            
            totalUser += userDiff;
            totalSystem += systemDiff;
            
            if (userDiff > maxUser) maxUser = userDiff;
            if (systemDiff > maxSystem) maxSystem = systemDiff;
        }
        
        const count = samples.length - 1;
        return {
            averageUser: count > 0 ? totalUser / count : 0,
            averageSystem: count > 0 ? totalSystem / count : 0,
            maxUser,
            maxSystem,
            totalUser,
            totalSystem,
            sampleCount: samples.length
        };
    }

    /**
     * Create a performance mark
     */
    mark(name, data = {}) {
        const mark = new PerformanceMark(name, data);
        
        if (!this.marks.has(name)) {
            this.marks.set(name, []);
        }
        this.marks.get(name).push(mark);
        this.stats.markCount++;
        
        // Trim marks
        const marks = this.marks.get(name);
        if (marks.length > this.options.maxMarks) {
            marks.shift();
        }
        
        this.emit('mark', mark);
        return mark;
    }

    /**
     * Measure between two marks
     */
    measure(name, startMarkName, endMarkName = null) {
        const startMarks = this.marks.get(startMarkName);
        if (!startMarks || startMarks.length === 0) return null;
        
        const startMark = startMarks[startMarks.length - 1];
        
        let endMark;
        if (endMarkName) {
            const endMarks = this.marks.get(endMarkName);
            if (!endMarks || endMarks.length === 0) return null;
            endMark = endMarks[endMarks.length - 1];
        } else {
            // Create end mark now
            endMark = new PerformanceMark(`${name}-end`);
        }
        
        const measure = new PerformanceMeasure(name, startMark, endMark);
        this.measures.push(measure);
        this.stats.measureCount++;
        
        this.emit('measure', measure);
        return measure;
    }

    /**
     * Start a timer
     */
    startTimer(name) {
        this.timers.set(name, {
            startTime: Date.now(),
            startMark: this.mark(`${name}-start`)
        });
        return true;
    }

    /**
     * Stop a timer and return duration
     */
    stopTimer(name) {
        const timer = this.timers.get(name);
        if (!timer) return null;
        
        const endTime = Date.now();
        const duration = endTime - timer.startTime;
        
        const endMark = this.mark(`${name}-end`);
        const measure = new PerformanceMeasure(name, timer.startMark, endMark);
        this.measures.push(measure);
        
        this.timers.delete(name);
        
        this.emit('timer-stopped', { name, duration, measure });
        return duration;
    }

    /**
     * Get all timers
     */
    getActiveTimers() {
        const timers = [];
        for (const [name, data] of this.timers) {
            timers.push({
                name,
                startTime: data.startTime,
                elapsed: Date.now() - data.startTime
            });
        }
        return timers;
    }

    /**
     * Get samples
     */
    getSamples(options = {}) {
        let samples = [...this.samples];
        
        // Filter by time range
        if (options.startTime) {
            samples = samples.filter(s => s.timestamp >= options.startTime);
        }
        if (options.endTime) {
            samples = samples.filter(s => s.timestamp <= options.endTime);
        }
        
        // Limit
        if (options.limit) {
            samples = samples.slice(-options.limit);
        }
        
        return samples;
    }

    /**
     * Get memory snapshots
     */
    getMemorySnapshots() {
        return this.memorySnapshots.map(s => s.toJSON());
    }

    /**
     * Get marks
     */
    getMarks(name = null) {
        if (name) {
            return this.marks.get(name) || [];
        }
        
        const allMarks = [];
        for (const [markName, marks] of this.marks) {
            allMarks.push(...marks.map(m => ({ ...m, markName })));
        }
        return allMarks.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Get measures
     */
    getMeasures(name = null) {
        if (name) {
            return this.measures.filter(m => m.name === name);
        }
        return [...this.measures];
    }

    /**
     * Get CPU profiles
     */
    getCPUProfiles() {
        return [...this.cpuProfiles];
    }

    /**
     * Get performance timeline
     */
    getTimeline(options = {}) {
        const timeline = [];
        
        // Add samples
        for (const sample of this.samples) {
            timeline.push({
                type: 'sample',
                timestamp: sample.timestamp,
                data: sample.data
            });
        }
        
        // Add marks
        for (const [name, marks] of this.marks) {
            for (const mark of marks) {
                timeline.push({
                    type: 'mark',
                    timestamp: mark.timestamp,
                    name: mark.name,
                    data: mark.data
                });
            }
        }
        
        // Add measures
        for (const measure of this.measures) {
            timeline.push({
                type: 'measure',
                timestamp: measure.startTime,
                endTimestamp: measure.endTime,
                name: measure.name,
                duration: measure.duration
            });
        }
        
        // Sort by timestamp
        timeline.sort((a, b) => a.timestamp - b.timestamp);
        
        // Filter by time range
        let result = timeline;
        if (options.startTime) {
            result = result.filter(e => e.timestamp >= options.startTime);
        }
        if (options.endTime) {
            result = result.filter(e => e.timestamp <= options.endTime);
        }
        
        return result;
    }

    /**
     * Get statistics
     */
    getMetrics() {
        // Alias for getStats for API consistency
        return this.getStats();
    }

    getStats() {
        const currentMemory = process.memoryUsage();
        
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            currentMemory: {
                heapUsed: currentMemory.heapUsed,
                heapTotal: currentMemory.heapTotal,
                rss: currentMemory.rss
            },
            peakMemory: this.stats.peakMemory,
            isCPUProfiling: this.isCPUProfiling,
            isAutoSampling: !!this.sampleInterval,
            activeTimers: this.timers.size
        };
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: true,
            isAutoSampling: !!this.sampleInterval,
            isCPUProfiling: this.isCPUProfiling,
            sampleCount: this.samples.length,
            snapshotCount: this.memorySnapshots.length,
            markCount: this.stats.markCount,
            measureCount: this.measures.length,
            stats: this.getStats()
        };
    }

    /**
     * Clear all data
     */
    clear() {
        this.samples = [];
        this.memorySnapshots = [];
        this.marks.clear();
        this.measures = [];
        this.cpuProfiles = [];
        this.timers.clear();
        
        this.stats = {
            startTime: Date.now(),
            sampleCount: 0,
            snapshotCount: 0,
            markCount: 0,
            measureCount: 0,
            peakMemory: 0,
            averageCPU: 0
        };
        
        this.emit('cleared');
    }

    /**
     * Export profiling data
     */
    exportData(format = 'json') {
        const data = {
            exportTime: new Date().toISOString(),
            stats: this.getStats(),
            samples: this.samples,
            memorySnapshots: this.getMemorySnapshots(),
            marks: this.getMarks(),
            measures: this.getMeasures(),
            cpuProfiles: this.getCPUProfiles()
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }
        
        return data;
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopAutoSampling();
        if (this.isCPUProfiling) {
            this.stopCPUProfiling();
        }
        this.clear();
        this.emit('destroyed');
    }
}

// Export singleton and class
let instance = null;

module.exports = {
    PerformanceProfiler,
    MemorySnapshot,
    PerformanceMark,
    PerformanceMeasure,
    
    getInstance(options) {
        if (!instance) {
            instance = new PerformanceProfiler(options);
        }
        return instance;
    }
};
