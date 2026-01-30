/**
 * Agent Browser Preload Script
 * Exposes agent-browser IPC methods to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Agent Browser API exposed to renderer
const agentBrowserAPI = {
  // Enable/disable
  enable: (enabled) => ipcRenderer.invoke('agent-browser:enable', enabled),
  togglePanel: (visible) =>
    ipcRenderer.invoke('agent-browser:toggle-panel', visible),
  getState: () => ipcRenderer.invoke('agent-browser:state'),

  // Navigation
  navigate: (url) => ipcRenderer.invoke('agent-browser:navigate', url),

  // Inspection
  snapshot: () => ipcRenderer.invoke('agent-browser:snapshot'),
  screenshot: (options) =>
    ipcRenderer.invoke('agent-browser:screenshot', options),

  // Interaction
  click: (target) => ipcRenderer.invoke('agent-browser:click', target),
  type: (target, text) =>
    ipcRenderer.invoke('agent-browser:type', { target, text }),
  fill: (target, text) =>
    ipcRenderer.invoke('agent-browser:fill', { target, text }),
  press: (key) => ipcRenderer.invoke('agent-browser:press', key),

  // Wait
  waitFor: (target, options) =>
    ipcRenderer.invoke('agent-browser:wait-for', { target, options }),

  // JavaScript
  evaluate: (script) => ipcRenderer.invoke('agent-browser:evaluate', script),

  // Element info
  getElement: (target, property) =>
    ipcRenderer.invoke('agent-browser:get-element', { target, property }),
  getTitle: () => ipcRenderer.invoke('agent-browser:get-title'),
  getUrl: () => ipcRenderer.invoke('agent-browser:get-url'),

  // Raw command
  command: (action, params) =>
    ipcRenderer.invoke('agent-browser:command', { action, params }),

  // Daemon control
  startDaemon: () => ipcRenderer.invoke('agent-browser:start-daemon'),
  killDaemon: () => ipcRenderer.invoke('agent-browser:kill-daemon'),
  close: () => ipcRenderer.invoke('agent-browser:close'),

  // Integrated actions
  loginEvony: (email, password) =>
    ipcRenderer.invoke('agent-browser:login-evony', { email, password }),

  // ============== MCP Knowledge Queries (0ms cached) ==============
  mcpSearch: (query, maxResults) =>
    ipcRenderer.invoke('agent-browser:mcp-search', { query, maxResults }),
  mcpExploits: (type) => ipcRenderer.invoke('agent-browser:mcp-exploits', type),
  mcpScripts: (type) => ipcRenderer.invoke('agent-browser:mcp-scripts', type),
  mcpProtocol: (action) =>
    ipcRenderer.invoke('agent-browser:mcp-protocol', action),
  mcpMechanics: (mechanic) =>
    ipcRenderer.invoke('agent-browser:mcp-mechanics', mechanic),
  mcpSafety: () => ipcRenderer.invoke('agent-browser:mcp-safety'),
  mcpStats: () => ipcRenderer.invoke('agent-browser:mcp-stats'),
  mcpSetMode: (mode) => ipcRenderer.invoke('agent-browser:mcp-mode', mode),

  // ============== Documentation Generation ==============
  saveDocs: () => ipcRenderer.invoke('agent-browser:save-docs'),
  getSessionMarkdown: () => ipcRenderer.invoke('agent-browser:get-session-md'),
  getTrainingData: () => ipcRenderer.invoke('agent-browser:get-training-data'),

  // Event listeners
  onConnected: (callback) => {
    ipcRenderer.on('agent-browser:connected', callback);
    return () =>
      ipcRenderer.removeListener('agent-browser:connected', callback);
  },
  onDisconnected: (callback) => {
    ipcRenderer.on('agent-browser:disconnected', callback);
    return () =>
      ipcRenderer.removeListener('agent-browser:disconnected', callback);
  },
  onError: (callback) => {
    ipcRenderer.on('agent-browser:error', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('agent-browser:error', callback);
  },
  onSnapshot: (callback) => {
    ipcRenderer.on('agent-browser:snapshot', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('agent-browser:snapshot', callback);
  },
  onToggle: (callback) => {
    ipcRenderer.on('agent-browser:toggle', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('agent-browser:toggle', callback);
  },
  onPanel: (callback) => {
    ipcRenderer.on('agent-browser:panel', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('agent-browser:panel', callback);
  },
};

// Expose to renderer if contextBridge available
if (contextBridge) {
  try {
    contextBridge.exposeInMainWorld('agentBrowser', agentBrowserAPI);
  } catch (err) {
    // May already be exposed, ignore
    console.warn('[AgentBrowserPreload] Could not expose API:', err.message);
  }
}

// Also expose via window for non-isolated contexts
if (typeof window !== 'undefined') {
  window.agentBrowserAPI = agentBrowserAPI;
}

module.exports = { agentBrowserAPI };
