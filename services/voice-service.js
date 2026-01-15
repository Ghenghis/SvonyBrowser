/**
 * Voice Service
 * Speech recognition and synthesis for chatbot
 * v2.0.9
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

/**
 * Voice Command
 */
class VoiceCommand {
    constructor(data) {
        this.id = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.transcript = data.transcript;
        this.confidence = data.confidence || 0;
        this.language = data.language || 'en-US';
        this.timestamp = new Date().toISOString();
        this.processed = false;
        this.response = null;
    }

    toJSON() {
        return {
            id: this.id,
            transcript: this.transcript,
            confidence: this.confidence,
            language: this.language,
            timestamp: this.timestamp,
            processed: this.processed,
            response: this.response
        };
    }
}

/**
 * Voice Profile
 */
class VoiceProfile {
    constructor(data = {}) {
        this.id = data.id || 'default';
        this.name = data.name || 'Default Voice';
        this.language = data.language || 'en-US';
        this.pitch = data.pitch || 1.0;
        this.rate = data.rate || 1.0;
        this.volume = data.volume || 1.0;
        this.voice = data.voice || null; // System voice name
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            language: this.language,
            pitch: this.pitch,
            rate: this.rate,
            volume: this.volume,
            voice: this.voice
        };
    }
}

/**
 * Wake Word Detector
 */
class WakeWordDetector {
    constructor(options = {}) {
        this.wakeWords = options.wakeWords || ['hey evony', 'okay evony', 'evony'];
        this.sensitivity = options.sensitivity || 0.5;
        this.enabled = false;
    }

    detect(transcript) {
        const lower = transcript.toLowerCase().trim();
        
        for (const wakeWord of this.wakeWords) {
            if (lower.startsWith(wakeWord)) {
                return {
                    detected: true,
                    wakeWord,
                    command: transcript.substring(wakeWord.length).trim()
                };
            }
        }
        
        return { detected: false };
    }

    addWakeWord(word) {
        if (!this.wakeWords.includes(word.toLowerCase())) {
            this.wakeWords.push(word.toLowerCase());
        }
    }

    removeWakeWord(word) {
        this.wakeWords = this.wakeWords.filter(w => w !== word.toLowerCase());
    }
}

/**
 * Command Parser
 */
class VoiceCommandParser {
    constructor() {
        this.patterns = [
            // Navigation
            { pattern: /^(go to|navigate to|open) (.+)$/i, intent: 'navigate', extract: (m) => ({ target: m[2] }) },
            { pattern: /^(show|display) (.+)$/i, intent: 'show', extract: (m) => ({ target: m[2] }) },
            
            // Game actions
            { pattern: /^(attack|hunt) (.+)$/i, intent: 'attack', extract: (m) => ({ target: m[2] }) },
            { pattern: /^(collect|gather) (resources|all)$/i, intent: 'collect', extract: (m) => ({ type: m[2] }) },
            { pattern: /^(train) (\d+) (.+)$/i, intent: 'train', extract: (m) => ({ quantity: m[2], unit: m[3] }) },
            { pattern: /^(upgrade|build) (.+)$/i, intent: 'upgrade', extract: (m) => ({ building: m[2] }) },
            { pattern: /^(research) (.+)$/i, intent: 'research', extract: (m) => ({ tech: m[2] }) },
            
            // Information
            { pattern: /^(what is|tell me about|explain) (.+)$/i, intent: 'query', extract: (m) => ({ topic: m[2] }) },
            { pattern: /^(how (do|can) i|how to) (.+)$/i, intent: 'howto', extract: (m) => ({ task: m[3] }) },
            { pattern: /^(status|report)$/i, intent: 'status', extract: () => ({}) },
            
            // Control
            { pattern: /^(start|begin|run) (.+)$/i, intent: 'start', extract: (m) => ({ task: m[2] }) },
            { pattern: /^(stop|cancel|abort)( (.+))?$/i, intent: 'stop', extract: (m) => ({ task: m[3] }) },
            { pattern: /^(pause|wait)$/i, intent: 'pause', extract: () => ({}) },
            { pattern: /^(resume|continue)$/i, intent: 'resume', extract: () => ({}) },
            
            // Settings
            { pattern: /^(set|change) (.+) to (.+)$/i, intent: 'setting', extract: (m) => ({ setting: m[2], value: m[3] }) },
            { pattern: /^(enable|disable) (.+)$/i, intent: 'toggle', extract: (m) => ({ feature: m[2], enabled: m[1].toLowerCase() === 'enable' }) },
            
            // Help
            { pattern: /^(help|commands|what can you do)$/i, intent: 'help', extract: () => ({}) }
        ];
    }

    parse(transcript) {
        const cleaned = transcript.trim();
        
        for (const { pattern, intent, extract } of this.patterns) {
            const match = cleaned.match(pattern);
            if (match) {
                return {
                    intent,
                    params: extract(match),
                    raw: cleaned,
                    confidence: 1.0
                };
            }
        }
        
        // No pattern matched - return as general query
        return {
            intent: 'general',
            params: { query: cleaned },
            raw: cleaned,
            confidence: 0.5
        };
    }
}

/**
 * Voice Service - Main class
 */
class VoiceService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            language: options.language || 'en-US',
            continuous: options.continuous !== false,
            interimResults: options.interimResults !== false,
            maxAlternatives: options.maxAlternatives || 3,
            autoRestart: options.autoRestart !== false,
            wakeWordEnabled: options.wakeWordEnabled || false,
            ...options
        };

        // State
        this.isListening = false;
        this.isSpeaking = false;
        this.isInitialized = false;

        // Components
        this.wakeWordDetector = new WakeWordDetector(options.wakeWord);
        this.commandParser = new VoiceCommandParser();
        
        // Voice profiles
        this.profiles = new Map();
        this.activeProfile = new VoiceProfile();
        this.profiles.set('default', this.activeProfile);
        
        // Available voices (populated from system)
        this.availableVoices = [];
        
        // Command history
        this.commandHistory = [];
        this.maxHistory = options.maxHistory || 100;

        // Speech queue
        this.speechQueue = [];
        this.isSpeechQueueProcessing = false;

        // Statistics
        this.stats = {
            commandsReceived: 0,
            commandsProcessed: 0,
            speechesSpoken: 0,
            totalListeningTime: 0,
            errors: 0
        };

        // Recognition reference (set by renderer)
        this.recognition = null;
        this.synthesis = null;
    }

    /**
     * Initialize voice service (called from renderer with Web Speech API)
     */
    initialize(recognition, synthesis) {
        this.recognition = recognition;
        this.synthesis = synthesis;
        
        if (this.recognition) {
            this._setupRecognition();
        }
        
        if (this.synthesis) {
            this._loadVoices();
        }
        
        this.isInitialized = true;
        this.emit('initialized');
    }

    /**
     * Setup speech recognition
     */
    _setupRecognition() {
        this.recognition.continuous = this.options.continuous;
        this.recognition.interimResults = this.options.interimResults;
        this.recognition.maxAlternatives = this.options.maxAlternatives;
        this.recognition.lang = this.options.language;

        this.recognition.onresult = (event) => {
            this._handleRecognitionResult(event);
        };

        this.recognition.onerror = (event) => {
            this._handleRecognitionError(event);
        };

        this.recognition.onend = () => {
            this._handleRecognitionEnd();
        };

        this.recognition.onstart = () => {
            this.emit('listening-started');
        };
    }

    /**
     * Load available voices
     */
    _loadVoices() {
        const loadVoiceList = () => {
            this.availableVoices = this.synthesis.getVoices();
            this.emit('voices-loaded', this.availableVoices.map(v => ({
                name: v.name,
                lang: v.lang,
                default: v.default
            })));
        };

        // Voices may load asynchronously
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = loadVoiceList;
        }
        loadVoiceList();
    }

    /**
     * Handle recognition result
     */
    _handleRecognitionResult(event) {
        const results = event.results;
        const lastResult = results[results.length - 1];
        
        if (lastResult.isFinal) {
            const transcript = lastResult[0].transcript;
            const confidence = lastResult[0].confidence;
            
            this.stats.commandsReceived++;
            
            // Create command
            const command = new VoiceCommand({
                transcript,
                confidence,
                language: this.options.language
            });
            
            // Check wake word if enabled
            if (this.options.wakeWordEnabled && this.wakeWordDetector.enabled) {
                const detection = this.wakeWordDetector.detect(transcript);
                if (detection.detected) {
                    command.transcript = detection.command;
                    this._processCommand(command);
                } else {
                    this.emit('speech-ignored', command.toJSON());
                }
            } else {
                this._processCommand(command);
            }
            
            // Add to history
            this.commandHistory.push(command);
            if (this.commandHistory.length > this.maxHistory) {
                this.commandHistory.shift();
            }
        } else {
            // Interim result
            const transcript = lastResult[0].transcript;
            this.emit('interim-result', transcript);
        }
    }

    /**
     * Process a voice command
     */
    _processCommand(command) {
        const parsed = this.commandParser.parse(command.transcript);
        command.processed = true;
        command.response = parsed;
        
        this.stats.commandsProcessed++;
        
        this.emit('command', {
            ...command.toJSON(),
            parsed
        });
    }

    /**
     * Handle recognition error
     */
    _handleRecognitionError(event) {
        this.stats.errors++;
        this.emit('error', {
            type: 'recognition',
            error: event.error,
            message: event.message
        });
    }

    /**
     * Handle recognition end
     */
    _handleRecognitionEnd() {
        this.isListening = false;
        this.emit('listening-stopped');
        
        // Auto-restart if enabled
        if (this.options.autoRestart && this.isInitialized) {
            setTimeout(() => {
                if (!this.isListening && this.options.autoRestart) {
                    this.startListening();
                }
            }, 1000);
        }
    }

    /**
     * Start listening
     */
    startListening() {
        if (!this.recognition) {
            this.emit('error', { type: 'not-initialized', message: 'Speech recognition not initialized' });
            return false;
        }
        
        if (this.isListening) return true;
        
        try {
            this.recognition.start();
            this.isListening = true;
            return true;
        } catch (e) {
            this.emit('error', { type: 'start-failed', message: e.message });
            return false;
        }
    }

    /**
     * Stop listening
     */
    stopListening() {
        if (!this.recognition || !this.isListening) return false;
        
        try {
            this.recognition.stop();
            this.isListening = false;
            return true;
        } catch (e) {
            this.emit('error', { type: 'stop-failed', message: e.message });
            return false;
        }
    }

    /**
     * Toggle listening
     */
    toggleListening() {
        if (this.isListening) {
            return this.stopListening();
        } else {
            return this.startListening();
        }
    }

    /**
     * Speak text
     */
    speak(text, options = {}) {
        if (!this.synthesis) {
            this.emit('error', { type: 'not-initialized', message: 'Speech synthesis not initialized' });
            return false;
        }
        
        const utterance = {
            text,
            options: {
                ...this.activeProfile.toJSON(),
                ...options
            }
        };
        
        this.speechQueue.push(utterance);
        this._processSpeechQueue();
        
        return true;
    }

    /**
     * Process speech queue
     */
    _processSpeechQueue() {
        if (this.isSpeechQueueProcessing || this.speechQueue.length === 0) return;
        
        this.isSpeechQueueProcessing = true;
        const { text, options } = this.speechQueue.shift();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options.language;
        utterance.pitch = options.pitch;
        utterance.rate = options.rate;
        utterance.volume = options.volume;
        
        // Set voice if specified
        if (options.voice) {
            const voice = this.availableVoices.find(v => v.name === options.voice);
            if (voice) {
                utterance.voice = voice;
            }
        }
        
        utterance.onstart = () => {
            this.isSpeaking = true;
            this.emit('speaking-started', text);
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.stats.speechesSpoken++;
            this.emit('speaking-ended', text);
            this.isSpeechQueueProcessing = false;
            this._processSpeechQueue();
        };
        
        utterance.onerror = (event) => {
            this.isSpeaking = false;
            this.stats.errors++;
            this.emit('error', { type: 'speech', error: event.error });
            this.isSpeechQueueProcessing = false;
            this._processSpeechQueue();
        };
        
        this.synthesis.speak(utterance);
    }

    /**
     * Stop speaking
     */
    stopSpeaking() {
        if (!this.synthesis) return false;
        
        this.synthesis.cancel();
        this.speechQueue = [];
        this.isSpeaking = false;
        this.isSpeechQueueProcessing = false;
        
        return true;
    }

    /**
     * Pause speaking
     */
    pauseSpeaking() {
        if (!this.synthesis) return false;
        this.synthesis.pause();
        return true;
    }

    /**
     * Resume speaking
     */
    resumeSpeaking() {
        if (!this.synthesis) return false;
        this.synthesis.resume();
        return true;
    }

    /**
     * Set language
     */
    setLanguage(language) {
        this.options.language = language;
        if (this.recognition) {
            this.recognition.lang = language;
        }
        this.activeProfile.language = language;
    }

    /**
     * Create voice profile
     */
    createProfile(data) {
        const profile = new VoiceProfile(data);
        this.profiles.set(profile.id, profile);
        return profile;
    }

    /**
     * Set active profile
     */
    setActiveProfile(profileId) {
        const profile = this.profiles.get(profileId);
        if (profile) {
            this.activeProfile = profile;
            return true;
        }
        return false;
    }

    /**
     * Get profiles
     */
    getProfiles() {
        return Array.from(this.profiles.values()).map(p => p.toJSON());
    }

    /**
     * Get available voices
     */
    getAvailableVoices() {
        return this.availableVoices.map(v => ({
            name: v.name,
            lang: v.lang,
            default: v.default
        }));
    }

    /**
     * Enable wake word
     */
    enableWakeWord(enabled = true) {
        this.options.wakeWordEnabled = enabled;
        this.wakeWordDetector.enabled = enabled;
    }

    /**
     * Set wake words
     */
    setWakeWords(words) {
        this.wakeWordDetector.wakeWords = words.map(w => w.toLowerCase());
    }

    /**
     * Get command history
     */
    getCommandHistory(limit = 50) {
        return this.commandHistory.slice(-limit).map(c => c.toJSON());
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            isListening: this.isListening,
            isSpeaking: this.isSpeaking,
            language: this.options.language,
            wakeWordEnabled: this.options.wakeWordEnabled,
            activeProfile: this.activeProfile.toJSON(),
            voiceCount: this.availableVoices.length,
            queueLength: this.speechQueue.length,
            stats: this.stats
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopListening();
        this.stopSpeaking();
        this.recognition = null;
        this.synthesis = null;
        this.isInitialized = false;
        this.emit('destroyed');
    }
}

// Export singleton and class
let instance = null;

module.exports = {
    VoiceService,
    VoiceCommand,
    VoiceProfile,
    WakeWordDetector,
    VoiceCommandParser,
    
    getInstance(options) {
        if (!instance) {
            instance = new VoiceService(options);
        }
        return instance;
    }
};
