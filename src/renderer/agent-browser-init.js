/**
 * Agent Browser Renderer Initialization
 * Initializes the Agent Browser panel in the renderer process
 */

// Import panel component if using bundler, otherwise loaded via script tag
let AgentBrowserPanel;
if (typeof require !== 'undefined') {
  try {
    AgentBrowserPanel =
      require('../components/agent-browser-panel').AgentBrowserPanel;
  } catch (e) {
    // Will be loaded via script tag
  }
}

/**
 * Initialize Agent Browser Panel
 */
function initAgentBrowserPanel() {
  // Get API from preload
  const api = window.agentBrowser || window.agentBrowserAPI;

  if (!api) {
    console.warn('[AgentBrowserInit] API not available, panel disabled');
    return null;
  }

  // Create container if not exists
  let container = document.getElementById('agent-browser-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'agent-browser-container';
    document.body.appendChild(container);
  }

  // Create bridge wrapper that uses IPC
  const bridgeWrapper = {
    enabled: false,
    panelVisible: false,
    isConnected: false,
    lastSnapshot: null,

    // Event emitter simulation
    _listeners: {},
    on(event, callback) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(callback);
    },
    emit(event, data) {
      if (this._listeners[event]) {
        this._listeners[event].forEach((cb) => cb(data));
      }
    },

    // API methods
    async ensureConnected() {
      const result = await api.enable(true);
      this.isConnected = !result.error;
      return this.isConnected;
    },

    setEnabled(enabled) {
      this.enabled = enabled;
      api.enable(enabled).then((result) => {
        if (!result.error) {
          this.emit('toggle', { enabled, panelVisible: this.panelVisible });
        }
      });
      return this.enabled;
    },

    togglePanel(visible) {
      this.panelVisible = visible !== undefined ? visible : !this.panelVisible;
      this.emit('panel', { visible: this.panelVisible });
      return this.panelVisible;
    },

    async navigate(url) {
      return api.navigate(url);
    },

    async snapshot() {
      const result = await api.snapshot();
      if (!result.error) {
        this.lastSnapshot = result;
        this.emit('snapshot', result);
      }
      return result;
    },

    async click(target) {
      return api.click(target);
    },

    async type(target, text) {
      return api.type(target, text);
    },

    async fill(target, text) {
      return api.fill(target, text);
    },

    async screenshot(options) {
      return api.screenshot(options);
    },

    async press(key) {
      return api.press(key);
    },

    async waitFor(target, options) {
      return api.waitFor(target, options);
    },

    async evaluate(script) {
      return api.evaluate(script);
    },

    async getElement(target, property) {
      return api.getElement(target, property);
    },

    async getTitle() {
      return api.getTitle();
    },

    async getUrl() {
      return api.getUrl();
    },

    async sendCommand(action, params) {
      return api.command(action, params);
    },

    getState() {
      return {
        enabled: this.enabled,
        panelVisible: this.panelVisible,
        connected: this.isConnected,
        lastSnapshot: this.lastSnapshot,
      };
    },

    async close() {
      return api.close();
    },
  };

  // Setup event listeners from main process
  api.onConnected(() => {
    bridgeWrapper.isConnected = true;
    bridgeWrapper.emit('connected');
  });

  api.onDisconnected(() => {
    bridgeWrapper.isConnected = false;
    bridgeWrapper.emit('disconnected');
  });

  api.onError((data) => {
    bridgeWrapper.emit('error', data);
  });

  api.onSnapshot((data) => {
    bridgeWrapper.lastSnapshot = data;
    bridgeWrapper.emit('snapshot', data);
  });

  api.onToggle((state) => {
    bridgeWrapper.enabled = state.enabled;
    bridgeWrapper.panelVisible = state.panelVisible;
    bridgeWrapper.emit('toggle', state);
  });

  // Get AgentBrowserPanel class
  const PanelClass = AgentBrowserPanel || window.AgentBrowserPanel;

  if (!PanelClass) {
    console.error('[AgentBrowserInit] AgentBrowserPanel class not found');
    return null;
  }

  // Create panel instance
  const panel = new PanelClass(container, bridgeWrapper);

  // Store reference globally
  window.agentBrowserPanel = panel;
  window.agentBrowserBridge = bridgeWrapper;

  // Panel initialized - logging removed per contract requirements

  return panel;
}

// Auto-init when DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAgentBrowserPanel);
  } else {
    // DOM already loaded
    setTimeout(initAgentBrowserPanel, 100);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initAgentBrowserPanel };
}
