/**
 * Agent Browser Panel Component
 * Toggleable side panel for agent-browser integration
 * Uses Evony-themed toggle assets for UI controls
 */

class AgentBrowserPanel {
  constructor(container, bridge) {
    this.container = container;
    this.bridge = bridge;
    this.element = null;
    this.snapshotView = null;
    this.commandInput = null;

    // Asset paths for toggle controls
    this.assets = {
      toggleOn:
        'assets/icons/controls/112_autoevony.gui.controls.themes.ThemeAssets__embed_RE_toggleBoxOn_png.png',
      toggleOff:
        'assets/icons/controls/45_autoevony.gui.controls.themes.ThemeAssets__embed_RE_toggleBoxOff_png.png',
      toggleOnOver:
        'assets/icons/controls/44_autoevony.gui.controls.themes.ThemeAssets__embed_RE_toggleBoxOnOver_png.png',
      toggleOffOver:
        'assets/icons/controls/108_autoevony.gui.controls.themes.ThemeAssets__embed_RE_toggleBoxOffOver_png.png',
      toggleOnDisabled:
        'assets/icons/controls/120_autoevony.gui.controls.themes.ThemeAssets__embed_RE_toggleBoxOnDisabled_png.png',
      toggleOffDisabled:
        'assets/icons/controls/52_autoevony.gui.controls.themes.ThemeAssets__embed_RE_toggleBoxOffDisabled_png.png',
      checkBox:
        'assets/icons/controls/78_autoevony.gui.controls.themes.ThemeAssets__embed_checkBox_png.png',
      checkBoxSelected:
        'assets/icons/controls/64_autoevony.gui.controls.themes.ThemeAssets__embed_checkBoxSelected_png.png',
      helpIcon:
        'assets/icons/controls/53_autoevony.gui.MainScreen__embed_mxml_autoevony_gui_images_helpIcon_png_987429035.png',
      alertIcon:
        'assets/icons/controls/123_autoevony.gui.AlertWin_alertIco.png',
      confirmIcon:
        'assets/icons/controls/42_autoevony.gui.AlertWin_confirmIco.png',
    };

    this.init();
  }

  init() {
    this.createStyles();
    this.createElement();
    this.bindEvents();

    // Listen to bridge events
    if (this.bridge) {
      this.bridge.on('connected', () => this.updateStatus('connected'));
      this.bridge.on('disconnected', () => this.updateStatus('disconnected'));
      this.bridge.on('snapshot', (data) => this.renderSnapshot(data));
      this.bridge.on('toggle', (state) => this.updateToggle(state));
    }
  }

  createStyles() {
    if (document.getElementById('agent-browser-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'agent-browser-panel-styles';
    style.textContent = `
            .agent-browser-panel {
                position: fixed;
                right: 0;
                top: 40px;
                bottom: 0;
                width: 350px;
                background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
                border-left: 2px solid #0f3460;
                display: flex;
                flex-direction: column;
                z-index: 1000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                font-family: 'Segoe UI', sans-serif;
            }
            
            .agent-browser-panel.visible {
                transform: translateX(0);
            }
            
            .agent-browser-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                background: #0f3460;
                border-bottom: 1px solid #e94560;
            }
            
            .agent-browser-panel-title {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #e94560;
                font-weight: 600;
                font-size: 14px;
            }
            
            .agent-browser-panel-title::before {
                content: '🤖';
            }
            
            .agent-toggle-btn {
                width: 48px;
                height: 20px;
                border: none;
                cursor: pointer;
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                background-color: transparent;
                transition: opacity 0.2s;
            }
            
            .agent-toggle-btn:hover {
                opacity: 0.9;
            }
            
            .agent-toggle-btn.off {
                background-image: url('${this.assets.toggleOff}');
            }
            
            .agent-toggle-btn.off:hover {
                background-image: url('${this.assets.toggleOffOver}');
            }
            
            .agent-toggle-btn.on {
                background-image: url('${this.assets.toggleOn}');
            }
            
            .agent-toggle-btn.on:hover {
                background-image: url('${this.assets.toggleOnOver}');
            }
            
            .agent-toggle-btn.disabled {
                cursor: not-allowed;
                opacity: 0.6;
            }
            
            .agent-toggle-btn.disabled.on {
                background-image: url('${this.assets.toggleOnDisabled}');
            }
            
            .agent-toggle-btn.disabled.off {
                background-image: url('${this.assets.toggleOffDisabled}');
            }
            
            .agent-browser-status {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                background: rgba(0, 0, 0, 0.3);
                border-bottom: 1px solid #0f3460;
            }
            
            .status-indicator {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #666;
            }
            
            .status-indicator.connected {
                background: #4ade80;
                box-shadow: 0 0 6px #4ade80;
            }
            
            .status-indicator.disconnected {
                background: #f87171;
            }
            
            .status-indicator.connecting {
                background: #fbbf24;
                animation: pulse 1s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .status-text {
                color: #9ca3af;
                font-size: 12px;
            }
            
            .agent-browser-controls {
                display: flex;
                gap: 8px;
                padding: 12px 16px;
                border-bottom: 1px solid #0f3460;
                flex-wrap: wrap;
            }
            
            .agent-browser-controls .control-btn {
                padding: 6px 12px;
                background: #0f3460;
                border: 1px solid #e94560;
                color: #e5e5e5;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s;
            }
            
            .agent-browser-controls .control-btn:hover {
                background: #e94560;
                color: white;
            }
            
            .agent-browser-controls .control-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .agent-browser-snapshot {
                flex: 1;
                overflow: auto;
                padding: 12px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 11px;
                color: #d1d5db;
                background: rgba(0, 0, 0, 0.2);
            }
            
            .snapshot-node {
                padding: 2px 0;
                cursor: pointer;
            }
            
            .snapshot-node:hover {
                background: rgba(233, 69, 96, 0.2);
            }
            
            .snapshot-ref {
                color: #e94560;
                font-weight: bold;
            }
            
            .snapshot-role {
                color: #60a5fa;
            }
            
            .snapshot-name {
                color: #4ade80;
            }
            
            .snapshot-text {
                color: #9ca3af;
                font-style: italic;
            }
            
            .agent-browser-command {
                display: flex;
                gap: 8px;
                padding: 12px 16px;
                background: #0f3460;
                border-top: 1px solid #e94560;
            }
            
            .agent-browser-command input {
                flex: 1;
                padding: 8px 12px;
                background: #1a1a2e;
                border: 1px solid #0f3460;
                color: #e5e5e5;
                border-radius: 4px;
                font-family: 'Consolas', monospace;
                font-size: 12px;
            }
            
            .agent-browser-command input:focus {
                outline: none;
                border-color: #e94560;
            }
            
            .agent-browser-command button {
                padding: 8px 16px;
                background: #e94560;
                border: none;
                color: white;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
            }
            
            .agent-browser-command button:hover {
                background: #d63850;
            }
            
            /* Floating toggle button */
            .agent-panel-toggle-float {
                position: fixed;
                right: 16px;
                bottom: 80px;
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, #e94560, #0f3460);
                border: 2px solid #e94560;
                border-radius: 50%;
                cursor: pointer;
                z-index: 999;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                box-shadow: 0 4px 12px rgba(233, 69, 96, 0.4);
                transition: all 0.3s;
            }
            
            .agent-panel-toggle-float:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 16px rgba(233, 69, 96, 0.6);
            }
            
            .agent-panel-toggle-float.active {
                background: linear-gradient(135deg, #4ade80, #0f3460);
                border-color: #4ade80;
            }
            
            /* Mode options */
            .agent-browser-modes {
                display: flex;
                gap: 16px;
                padding: 12px 16px;
                border-bottom: 1px solid #0f3460;
            }
            
            .mode-option {
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                color: #9ca3af;
                font-size: 12px;
            }
            
            .mode-option input {
                display: none;
            }
            
            .mode-checkbox {
                width: 16px;
                height: 16px;
                background-size: contain;
                background-repeat: no-repeat;
            }
            
            .mode-option input:not(:checked) + .mode-checkbox {
                background-image: url('${this.assets.checkBox}');
            }
            
            .mode-option input:checked + .mode-checkbox {
                background-image: url('${this.assets.checkBoxSelected}');
            }
            
            .mode-option:hover {
                color: #e5e5e5;
            }
        `;
    document.head.appendChild(style);
  }

  createElement() {
    // Create floating toggle button
    this.floatBtn = document.createElement('button');
    this.floatBtn.className = 'agent-panel-toggle-float';
    this.floatBtn.innerHTML = '🤖';
    this.floatBtn.title = 'Toggle Agent Browser Panel';
    document.body.appendChild(this.floatBtn);

    // Create main panel
    this.element = document.createElement('div');
    this.element.className = 'agent-browser-panel';
    this.element.innerHTML = `
            <div class="agent-browser-panel-header">
                <span class="agent-browser-panel-title">Agent Browser</span>
                <button class="agent-toggle-btn off" id="agent-enable-toggle" title="Enable Agent Mode"></button>
            </div>
            
            <div class="agent-browser-status">
                <div class="status-indicator disconnected" id="agent-status-indicator"></div>
                <span class="status-text" id="agent-status-text">Disconnected</span>
            </div>
            
            <div class="agent-browser-modes">
                <label class="mode-option">
                    <input type="checkbox" id="mode-snapshot" checked>
                    <span class="mode-checkbox"></span>
                    Snapshot
                </label>
                <label class="mode-option">
                    <input type="checkbox" id="mode-stream">
                    <span class="mode-checkbox"></span>
                    Stream
                </label>
                <label class="mode-option">
                    <input type="checkbox" id="mode-headless">
                    <span class="mode-checkbox"></span>
                    Headless
                </label>
            </div>
            
            <div class="agent-browser-controls">
                <button class="control-btn" id="btn-snapshot" disabled>📸 Snapshot</button>
                <button class="control-btn" id="btn-screenshot" disabled>🖼️ Screenshot</button>
                <button class="control-btn" id="btn-navigate" disabled>🌐 Navigate</button>
                <button class="control-btn" id="btn-refresh" disabled>🔄 Refresh</button>
                <button class="control-btn" id="btn-back" disabled>◀ Back</button>
                <button class="control-btn" id="btn-clear" disabled>🗑️ Clear</button>
            </div>
            
            <div class="agent-browser-snapshot" id="snapshot-view">
                <div style="text-align: center; color: #666; padding: 40px;">
                    <p>🤖 Agent Browser Panel</p>
                    <p style="font-size: 10px;">Enable agent mode and take a snapshot to see the accessibility tree</p>
                </div>
            </div>
            
            <div class="agent-browser-command">
                <input type="text" id="agent-command" placeholder="Enter command: click @e1, type @e2 'text', navigate url">
                <button id="btn-execute">▶</button>
            </div>
        `;

    this.container.appendChild(this.element);

    // Cache DOM references
    this.toggleBtn = this.element.querySelector('#agent-enable-toggle');
    this.statusIndicator = this.element.querySelector(
      '#agent-status-indicator'
    );
    this.statusText = this.element.querySelector('#agent-status-text');
    this.snapshotView = this.element.querySelector('#snapshot-view');
    this.commandInput = this.element.querySelector('#agent-command');
  }

  bindEvents() {
    // Float button click
    this.floatBtn.addEventListener('click', () => {
      this.togglePanel();
    });

    // Enable toggle
    this.toggleBtn.addEventListener('click', () => {
      if (this.bridge) {
        const newState = !this.bridge.enabled;
        this.bridge.setEnabled(newState);
      }
    });

    // Control buttons
    this.element
      .querySelector('#btn-snapshot')
      .addEventListener('click', () => this.takeSnapshot());
    this.element
      .querySelector('#btn-screenshot')
      .addEventListener('click', () => this.takeScreenshot());
    this.element
      .querySelector('#btn-navigate')
      .addEventListener('click', () => this.promptNavigate());
    this.element
      .querySelector('#btn-refresh')
      .addEventListener('click', () => this.refresh());
    this.element
      .querySelector('#btn-back')
      .addEventListener('click', () => this.goBack());
    this.element
      .querySelector('#btn-clear')
      .addEventListener('click', () => this.clearSnapshot());

    // Execute command
    this.element
      .querySelector('#btn-execute')
      .addEventListener('click', () => this.executeCommand());
    this.commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.executeCommand();
    });
  }

  togglePanel() {
    const isVisible = this.element.classList.toggle('visible');
    this.floatBtn.classList.toggle('active', isVisible);

    if (this.bridge) {
      this.bridge.togglePanel(isVisible);
    }
  }

  show() {
    this.element.classList.add('visible');
    this.floatBtn.classList.add('active');
  }

  hide() {
    this.element.classList.remove('visible');
    this.floatBtn.classList.remove('active');
  }

  updateToggle(state) {
    if (state.enabled) {
      this.toggleBtn.classList.remove('off');
      this.toggleBtn.classList.add('on');
      this.enableControls(true);
    } else {
      this.toggleBtn.classList.remove('on');
      this.toggleBtn.classList.add('off');
      this.enableControls(false);
    }
  }

  updateStatus(status) {
    this.statusIndicator.className = `status-indicator ${status}`;

    const statusMessages = {
      connected: 'Connected to daemon',
      disconnected: 'Disconnected',
      connecting: 'Connecting...',
      error: 'Connection error',
    };

    this.statusText.textContent = statusMessages[status] || status;
  }

  enableControls(enabled) {
    const buttons = this.element.querySelectorAll('.control-btn');
    buttons.forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  async takeSnapshot() {
    if (!this.bridge || !this.bridge.isConnected) return;

    try {
      this.updateStatus('connecting');
      const result = await this.bridge.snapshot();
      this.renderSnapshot(result);
      this.updateStatus('connected');
    } catch (err) {
      console.error('[AgentBrowserPanel] Snapshot error:', err);
      this.updateStatus('error');
    }
  }

  async takeScreenshot() {
    if (!this.bridge || !this.bridge.isConnected) return;

    try {
      const result = await this.bridge.screenshot({ format: 'png' });
      if (result && result.data) {
        // Display screenshot in snapshot view
        this.snapshotView.innerHTML = `<img src="data:image/png;base64,${result.data}" style="max-width: 100%; height: auto;">`;
      }
    } catch (err) {
      console.error('[AgentBrowserPanel] Screenshot error:', err);
    }
  }

  promptNavigate() {
    const url = prompt('Enter URL to navigate:');
    if (url && this.bridge) {
      this.bridge
        .navigate(url)
        .then(() => {
          this.takeSnapshot();
        })
        .catch((err) => {
          console.error('[AgentBrowserPanel] Navigate error:', err);
        });
    }
  }

  async refresh() {
    if (this.bridge && this.bridge.isConnected) {
      await this.bridge.press('F5');
      setTimeout(() => this.takeSnapshot(), 1000);
    }
  }

  async goBack() {
    if (this.bridge && this.bridge.isConnected) {
      await this.bridge.sendCommand('back');
      setTimeout(() => this.takeSnapshot(), 500);
    }
  }

  clearSnapshot() {
    this.snapshotView.innerHTML = `
            <div style="text-align: center; color: #666; padding: 40px;">
                <p>Snapshot cleared</p>
            </div>
        `;
  }

  renderSnapshot(data) {
    if (!data || !data.snapshot) {
      this.snapshotView.innerHTML =
        '<div style="color: #666; padding: 20px;">No snapshot data</div>';
      return;
    }

    // Parse and render the accessibility tree
    const lines = data.snapshot.split('\n');
    let html = '';

    for (const line of lines) {
      if (!line.trim()) continue;

      // Extract ref, role, name from the line
      const refMatch = line.match(/@(\w+)/);
      const roleMatch = line.match(/\[([^\]]+)\]/);

      let formattedLine = line
        .replace(/@(\w+)/g, '<span class="snapshot-ref">@$1</span>')
        .replace(/\[([^\]]+)\]/g, '<span class="snapshot-role">[$1]</span>')
        .replace(/"([^"]+)"/g, '<span class="snapshot-text">"$1"</span>');

      html += `<div class="snapshot-node" data-ref="${refMatch ? refMatch[1] : ''}">${formattedLine}</div>`;
    }

    this.snapshotView.innerHTML =
      html || '<div style="color: #666; padding: 20px;">Empty snapshot</div>';

    // Click handler for nodes
    this.snapshotView.querySelectorAll('.snapshot-node').forEach((node) => {
      node.addEventListener('click', () => {
        const ref = node.dataset.ref;
        if (ref) {
          this.commandInput.value = `click @${ref}`;
          this.commandInput.focus();
        }
      });
    });
  }

  async executeCommand() {
    const cmd = this.commandInput.value.trim();
    if (!cmd || !this.bridge || !this.bridge.isConnected) return;

    try {
      const parts = cmd.split(/\s+/);
      const action = parts[0].toLowerCase();

      switch (action) {
        case 'click':
          await this.bridge.click(parts[1]);
          break;
        case 'type':
          await this.bridge.type(
            parts[1],
            parts
              .slice(2)
              .join(' ')
              .replace(/^['"]|['"]$/g, '')
          );
          break;
        case 'fill':
          await this.bridge.fill(
            parts[1],
            parts
              .slice(2)
              .join(' ')
              .replace(/^['"]|['"]$/g, '')
          );
          break;
        case 'navigate':
        case 'goto':
          await this.bridge.navigate(parts[1]);
          break;
        case 'press':
          await this.bridge.press(parts[1]);
          break;
        case 'snapshot':
          await this.takeSnapshot();
          return;
        case 'screenshot':
          await this.takeScreenshot();
          return;
        default:
          console.warn('[AgentBrowserPanel] Unknown command:', action);
          return;
      }

      // Auto-refresh snapshot after action
      setTimeout(() => this.takeSnapshot(), 300);
      this.commandInput.value = '';
    } catch (err) {
      console.error('[AgentBrowserPanel] Command error:', err);
    }
  }

  destroy() {
    if (this.floatBtn) {
      this.floatBtn.remove();
    }
    if (this.element) {
      this.element.remove();
    }
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AgentBrowserPanel };
}
