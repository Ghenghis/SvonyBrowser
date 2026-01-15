/**
 * Svony Browser - Session Recorder
 * Record and playback game sessions for analysis
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class SessionRecorder extends EventEmitter {
    constructor() {
        super();
        
        // Recording state
        this.isRecording = false;
        this.isPaused = false;
        this.currentSession = null;
        
        // Session data
        this.sessions = new Map();
        this.sessionsDir = null;
        
        // Recording settings
        this.settings = {
            maxPacketsPerSession: 50000,
            autoSaveInterval: 60000, // 1 minute
            compressOnSave: false,
            captureScreenshots: false,
            captureGameState: true
        };
        
        // Auto-save timer
        this.autoSaveTimer = null;
    }

    /**
     * Initialize the session recorder
     */
    async initialize(sessionsDir) {
        this.sessionsDir = sessionsDir || path.join(process.cwd(), 'sessions');
        
        // Ensure sessions directory exists
        try {
            await fs.mkdir(this.sessionsDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.error('[SessionRecorder] Failed to create sessions directory:', error);
            }
        }
        
        // Load existing sessions index
        await this.loadSessionsIndex();
        
        console.log('[SessionRecorder] Initialized');
        this.emit('initialized', { sessionsDir: this.sessionsDir });
        
        return true;
    }

    /**
     * Start recording a new session
     */
    startRecording(metadata = {}) {
        if (this.isRecording) {
            return { error: 'Already recording' };
        }
        
        const sessionId = this.generateSessionId();
        
        this.currentSession = {
            id: sessionId,
            name: metadata.name || `Session ${new Date().toLocaleString()}`,
            description: metadata.description || '',
            startTime: Date.now(),
            endTime: null,
            duration: 0,
            packets: [],
            events: [],
            gameStates: [],
            metadata: {
                ...metadata,
                playerName: metadata.playerName || 'Unknown',
                server: metadata.server || 'Unknown',
                version: '1.0.0'
            },
            stats: {
                totalPackets: 0,
                totalEvents: 0,
                totalGameStates: 0,
                bytesRecorded: 0
            }
        };
        
        this.isRecording = true;
        this.isPaused = false;
        
        // Start auto-save timer
        this.startAutoSave();
        
        console.log(`[SessionRecorder] Recording started: ${sessionId}`);
        this.emit('recordingStarted', this.currentSession);
        
        return { sessionId, success: true };
    }

    /**
     * Stop recording
     */
    async stopRecording() {
        if (!this.isRecording) {
            return { error: 'Not recording' };
        }
        
        this.isRecording = false;
        this.isPaused = false;
        
        // Stop auto-save
        this.stopAutoSave();
        
        // Finalize session
        this.currentSession.endTime = Date.now();
        this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
        
        // Save session
        const filePath = await this.saveSession(this.currentSession);
        
        // Add to sessions index
        this.sessions.set(this.currentSession.id, {
            id: this.currentSession.id,
            name: this.currentSession.name,
            startTime: this.currentSession.startTime,
            endTime: this.currentSession.endTime,
            duration: this.currentSession.duration,
            packetCount: this.currentSession.stats.totalPackets,
            filePath
        });
        
        await this.saveSessionsIndex();
        
        const session = this.currentSession;
        this.currentSession = null;
        
        console.log(`[SessionRecorder] Recording stopped: ${session.id}`);
        this.emit('recordingStopped', session);
        
        return { session, filePath, success: true };
    }

    /**
     * Pause recording
     */
    pauseRecording() {
        if (!this.isRecording) {
            return { error: 'Not recording' };
        }
        
        this.isPaused = true;
        this.emit('recordingPaused');
        
        return { success: true };
    }

    /**
     * Resume recording
     */
    resumeRecording() {
        if (!this.isRecording) {
            return { error: 'Not recording' };
        }
        
        this.isPaused = false;
        this.emit('recordingResumed');
        
        return { success: true };
    }

    /**
     * Record a packet
     */
    recordPacket(packet) {
        if (!this.isRecording || this.isPaused) {
            return false;
        }
        
        if (this.currentSession.stats.totalPackets >= this.settings.maxPacketsPerSession) {
            this.emit('maxPacketsReached');
            return false;
        }
        
        const recordedPacket = {
            timestamp: Date.now(),
            relativeTime: Date.now() - this.currentSession.startTime,
            action: packet.action,
            direction: packet.direction,
            size: packet.size || 0,
            data: packet.decoded || packet.data,
            rawHex: packet.rawHex
        };
        
        this.currentSession.packets.push(recordedPacket);
        this.currentSession.stats.totalPackets++;
        this.currentSession.stats.bytesRecorded += recordedPacket.size;
        
        this.emit('packetRecorded', recordedPacket);
        
        return true;
    }

    /**
     * Record an event
     */
    recordEvent(event) {
        if (!this.isRecording || this.isPaused) {
            return false;
        }
        
        const recordedEvent = {
            timestamp: Date.now(),
            relativeTime: Date.now() - this.currentSession.startTime,
            type: event.type,
            data: event.data,
            description: event.description
        };
        
        this.currentSession.events.push(recordedEvent);
        this.currentSession.stats.totalEvents++;
        
        this.emit('eventRecorded', recordedEvent);
        
        return true;
    }

    /**
     * Record game state snapshot
     */
    recordGameState(gameState) {
        if (!this.isRecording || this.isPaused || !this.settings.captureGameState) {
            return false;
        }
        
        const snapshot = {
            timestamp: Date.now(),
            relativeTime: Date.now() - this.currentSession.startTime,
            state: JSON.parse(JSON.stringify(gameState))
        };
        
        this.currentSession.gameStates.push(snapshot);
        this.currentSession.stats.totalGameStates++;
        
        this.emit('gameStateRecorded', snapshot);
        
        return true;
    }

    /**
     * Add marker/bookmark to session
     */
    addMarker(name, description = '') {
        if (!this.isRecording) {
            return { error: 'Not recording' };
        }
        
        const marker = {
            timestamp: Date.now(),
            relativeTime: Date.now() - this.currentSession.startTime,
            name,
            description
        };
        
        if (!this.currentSession.markers) {
            this.currentSession.markers = [];
        }
        
        this.currentSession.markers.push(marker);
        this.emit('markerAdded', marker);
        
        return { marker, success: true };
    }

    /**
     * Save session to file
     */
    async saveSession(session) {
        const fileName = `session_${session.id}.json`;
        const filePath = path.join(this.sessionsDir, fileName);
        
        const data = JSON.stringify(session, null, 2);
        await fs.writeFile(filePath, data);
        
        console.log(`[SessionRecorder] Session saved: ${filePath}`);
        
        return filePath;
    }

    /**
     * Load session from file
     */
    async loadSession(sessionId) {
        const sessionInfo = this.sessions.get(sessionId);
        if (!sessionInfo) {
            return { error: 'Session not found' };
        }
        
        try {
            const data = await fs.readFile(sessionInfo.filePath, 'utf8');
            const session = JSON.parse(data);
            
            return { session, success: true };
        } catch (error) {
            console.error(`[SessionRecorder] Failed to load session ${sessionId}:`, error);
            return { error: error.message };
        }
    }

    /**
     * Delete session
     */
    async deleteSession(sessionId) {
        const sessionInfo = this.sessions.get(sessionId);
        if (!sessionInfo) {
            return { error: 'Session not found' };
        }
        
        try {
            await fs.unlink(sessionInfo.filePath);
            this.sessions.delete(sessionId);
            await this.saveSessionsIndex();
            
            console.log(`[SessionRecorder] Session deleted: ${sessionId}`);
            this.emit('sessionDeleted', sessionId);
            
            return { success: true };
        } catch (error) {
            console.error(`[SessionRecorder] Failed to delete session ${sessionId}:`, error);
            return { error: error.message };
        }
    }

    /**
     * Get list of all sessions
     */
    getSessions() {
        return Array.from(this.sessions.values()).sort((a, b) => b.startTime - a.startTime);
    }

    /**
     * Get current recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            currentSession: this.currentSession ? {
                id: this.currentSession.id,
                name: this.currentSession.name,
                startTime: this.currentSession.startTime,
                duration: Date.now() - this.currentSession.startTime,
                stats: this.currentSession.stats
            } : null,
            totalSessions: this.sessions.size
        };
    }

    /**
     * Export session to different formats
     */
    async exportSession(sessionId, format = 'json', outputPath = null) {
        const result = await this.loadSession(sessionId);
        if (result.error) {
            return result;
        }
        
        const session = result.session;
        const fileName = `session_${sessionId}_export.${format}`;
        const filePath = outputPath || path.join(this.sessionsDir, fileName);
        
        switch (format) {
            case 'json':
                await fs.writeFile(filePath, JSON.stringify(session, null, 2));
                break;
                
            case 'csv':
                const csv = this.sessionToCsv(session);
                await fs.writeFile(filePath, csv);
                break;
                
            case 'har':
                const har = this.sessionToHar(session);
                await fs.writeFile(filePath, JSON.stringify(har, null, 2));
                break;
                
            default:
                return { error: `Unsupported format: ${format}` };
        }
        
        return { filePath, success: true };
    }

    /**
     * Convert session to CSV format
     */
    sessionToCsv(session) {
        const headers = ['timestamp', 'relative_time', 'direction', 'action', 'size'];
        const rows = session.packets.map(p => [
            new Date(p.timestamp).toISOString(),
            p.relativeTime,
            p.direction,
            p.action || '',
            p.size
        ]);
        
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    /**
     * Convert session to HAR format (HTTP Archive)
     */
    sessionToHar(session) {
        return {
            log: {
                version: '1.2',
                creator: {
                    name: 'Svony Browser Session Recorder',
                    version: '1.0.0'
                },
                entries: session.packets.map(p => ({
                    startedDateTime: new Date(p.timestamp).toISOString(),
                    time: 0,
                    request: {
                        method: 'POST',
                        url: `evony://${p.action || 'unknown'}`,
                        httpVersion: 'AMF/3',
                        headers: [],
                        queryString: [],
                        postData: {
                            mimeType: 'application/x-amf',
                            text: JSON.stringify(p.data)
                        },
                        headersSize: -1,
                        bodySize: p.size
                    },
                    response: {
                        status: 200,
                        statusText: 'OK',
                        httpVersion: 'AMF/3',
                        headers: [],
                        content: {
                            size: 0,
                            mimeType: 'application/x-amf'
                        },
                        redirectURL: '',
                        headersSize: -1,
                        bodySize: 0
                    },
                    cache: {},
                    timings: {
                        send: 0,
                        wait: 0,
                        receive: 0
                    }
                }))
            }
        };
    }

    /**
     * Playback session
     */
    async playbackSession(sessionId, options = {}) {
        const result = await this.loadSession(sessionId);
        if (result.error) {
            return result;
        }
        
        const session = result.session;
        const playbackState = {
            sessionId,
            isPlaying: true,
            isPaused: false,
            currentIndex: 0,
            speed: options.speed || 1,
            startTime: Date.now()
        };
        
        this.emit('playbackStarted', { session, playbackState });
        
        // Playback packets with timing
        for (let i = 0; i < session.packets.length; i++) {
            if (!playbackState.isPlaying) break;
            
            while (playbackState.isPaused) {
                await this.sleep(100);
            }
            
            const packet = session.packets[i];
            const nextPacket = session.packets[i + 1];
            
            playbackState.currentIndex = i;
            this.emit('playbackPacket', { packet, index: i, total: session.packets.length });
            
            // Calculate delay to next packet
            if (nextPacket) {
                const delay = (nextPacket.relativeTime - packet.relativeTime) / playbackState.speed;
                await this.sleep(Math.max(0, delay));
            }
        }
        
        playbackState.isPlaying = false;
        this.emit('playbackCompleted', { sessionId });
        
        return { success: true };
    }

    /**
     * Stop playback
     */
    stopPlayback() {
        // This would need to track the current playback state
        this.emit('playbackStopped');
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${timestamp}-${random}`;
    }

    /**
     * Start auto-save timer
     */
    startAutoSave() {
        this.stopAutoSave();
        
        this.autoSaveTimer = setInterval(async () => {
            if (this.isRecording && this.currentSession) {
                await this.saveSession(this.currentSession);
                console.log('[SessionRecorder] Auto-saved session');
            }
        }, this.settings.autoSaveInterval);
    }

    /**
     * Stop auto-save timer
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Load sessions index
     */
    async loadSessionsIndex() {
        const indexPath = path.join(this.sessionsDir, 'sessions_index.json');
        
        try {
            const data = await fs.readFile(indexPath, 'utf8');
            const index = JSON.parse(data);
            
            for (const session of index.sessions) {
                this.sessions.set(session.id, session);
            }
            
            console.log(`[SessionRecorder] Loaded ${this.sessions.size} sessions from index`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('[SessionRecorder] Failed to load sessions index:', error);
            }
        }
    }

    /**
     * Save sessions index
     */
    async saveSessionsIndex() {
        const indexPath = path.join(this.sessionsDir, 'sessions_index.json');
        
        const index = {
            lastUpdated: Date.now(),
            sessions: Array.from(this.sessions.values())
        };
        
        await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.emit('settingsUpdated', this.settings);
    }

    /**
     * Get settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Get session statistics
     */
    async getSessionStats(sessionId) {
        const result = await this.loadSession(sessionId);
        if (result.error) {
            return result;
        }
        
        const session = result.session;
        
        // Calculate action frequency
        const actionCounts = {};
        for (const packet of session.packets) {
            if (packet.action) {
                actionCounts[packet.action] = (actionCounts[packet.action] || 0) + 1;
            }
        }
        
        // Calculate timing stats
        const timings = session.packets.map(p => p.relativeTime);
        const intervals = [];
        for (let i = 1; i < timings.length; i++) {
            intervals.push(timings[i] - timings[i - 1]);
        }
        
        const avgInterval = intervals.length > 0 
            ? intervals.reduce((a, b) => a + b, 0) / intervals.length 
            : 0;
        
        return {
            duration: session.duration,
            packetCount: session.stats.totalPackets,
            eventCount: session.stats.totalEvents,
            bytesRecorded: session.stats.bytesRecorded,
            packetsPerSecond: session.stats.totalPackets / (session.duration / 1000),
            avgPacketInterval: avgInterval,
            topActions: Object.entries(actionCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([action, count]) => ({ action, count })),
            markerCount: session.markers ? session.markers.length : 0
        };
    }
}

module.exports = new SessionRecorder();
