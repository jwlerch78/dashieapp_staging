// js/settings/simplified-settings.js
// Complete simplified settings system with enhanced event handling

export class SimplifiedSettings {
  constructor() {
    this.isVisible = false;
    this.overlay = null;
    this.navigation = null;
    this.controller = null;
    this.pendingChanges = {};
    this.keydownHandler = null;
    
    // Initialize storage controller
    this.initializeController();
  }

  async initializeController() {
    try {
      // Use existing settings controller for data persistence
      const { SettingsController } = await import('./settings-controller.js');
      this.controller = new SettingsController();
      await this.controller.init();
      console.log('📊 Settings controller initialized');
    } catch (error) {
      console.error('Failed to initialize settings controller:', error);
    }
  }

  // Main entry point - called from existing code
  async show() {
    if (this.isVisible) return;
    
    this.createSettingsUI();
    await this.loadCurrentSettings();
    this.setupEventHandlers();
    this.showOverlay();
    
    console.log('⚙️ Simplified settings shown');
  }

  hide() {
    if (!this.isVisible) return;
    
    this.hideOverlay();
    this.cleanup();
    
    console.log('⚙️ Simplified settings hidden');
  }

  createSettingsUI() {
    // Create the overlay with the simplified HTML structure
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.innerHTML = this.getSettingsHTML();
    
    document.body.appendChild(this.overlay);
  }

  getSettingsHTML() {
    return `
      <div class="settings-modal">
        <!-- Header with Tabs -->
        <div class="settings-header">
          <h1 class="settings-title">Settings</h1>
          <div class="settings-tabs">
            <button class="tab-button active" data-tab="display">Display</button>
            <button class="tab-button disabled" data-tab="family">Family</button>
            <button class="tab-button" data-tab="widgets">Widgets</button>
            <button class="tab-button disabled" data-tab="system">System</button>
            <button class="tab-button disabled" data-tab="about">About</button>
          </div>
        </div>

        <!-- Content Area -->
        <div class="settings-content">
          <!-- Display Tab -->
          <div class="tab-panel active" id="display-panel">
            <div class="settings-group">
              <h3 class="group-title" data-group="theme">
                <span>Theme</span>
                <span class="expand-arrow">▶</span>
              </h3>
              <div class="group-content collapsed" id="theme-content">
                <div class="setting-row">
                  <div class="setting-label">Display Theme</div>
                  <div class="setting-control">
                    <select class="form-control" id="theme-select" data-setting="display.theme">
                      <option value="dark">Dark Theme</option>
                      <option value="light">Light Theme</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div class="settings-group">
              <h3 class="group-title" data-group="sleep">
                <span>Sleep Mode</span>
                <span class="expand-arrow">▶</span>
              </h3>
              <div class="group-content collapsed" id="sleep-content">
                <div class="setting-row">
                  <div class="setting-label">
                    Sleep Time
                    <div class="setting-description">When display goes to sleep</div>
                  </div>
                  <div class="setting-control">
                    <input type="time" class="form-control" id="sleep-time" data-setting="display.sleepTime">
                  </div>
                </div>
                
                <div class="setting-row">
                  <div class="setting-label">
                    Wake Time
                    <div class="setting-description">When display wakes up</div>
                  </div>
                  <div class="setting-control">
                    <input type="time" class="form-control" id="wake-time" data-setting="display.wakeTime">
                  </div>
                </div>
                
                <div class="setting-row">
                  <div class="setting-label">
                    Re-sleep Delay
                    <div class="setting-description">Minutes before auto-sleep after wake</div>
                  </div>
                  <div class="setting-control">
                    <input type="number" class="form-control" id="resleep-delay" data-setting="display.reSleepDelay" min="1" max="120">
                  </div>
                </div>
              </div>
            </div>

            <div class="settings-group">
              <h3 class="group-title" data-group="photos">
                <span>Photos Widget</span>
                <span class="expand-arrow">▶</span>
              </h3>
              <div class="group-content collapsed" id="photos-content">
                <div class="setting-row">
                  <div class="setting-label">
                    Transition Time
                    <div class="setting-description">Seconds between photo changes</div>
                  </div>
                  <div class="setting-control">
                    <input type="number" class="form-control" id="photo-transition" data-setting="photos.transitionTime" min="1" max="60">
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Widgets Tab -->
          <div class="tab-panel" id="widgets-panel">
            <div class="settings-group">
              <h3 class="group-title" data-group="widget-config">
                <span>Widget Configuration</span>
                <span class="expand-arrow">▶</span>
              </h3>
              <div class="group-content collapsed" id="widget-config-content">
                <div class="setting-row">
                  <div class="setting-label">
                    Photo Source
                    <div class="setting-description">Choose photo album or folder</div>
                  </div>
                  <div class="setting-control">
                    <select class="form-control" data-setting="photos.source">
                      <option value="recent">Recent Photos</option>
                      <option value="family">Family Album</option>
                      <option value="vacation">Vacation 2024</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Other tabs with coming soon messages -->
          <div class="tab-panel" id="family-panel">
            <div class="coming-soon">
              <h3>Family Settings</h3>
              <p>Coming soon! This will include family member profiles and settings.</p>
            </div>
          </div>

          <div class="tab-panel" id="system-panel">
            <div class="coming-soon">
              <h3>System Settings</h3>
              <p>Developer and system configuration options coming soon.</p>
            </div>
          </div>

          <div class="tab-panel" id="about-panel">
            <div class="coming-soon">
              <h3>About Dashie</h3>
              <p>Version information and support options coming soon.</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="settings-footer">
          <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="save-btn">Save</button>
        </div>
      </div>
    `;
  }

  async loadCurrentSettings() {
    if (!this.controller) return;
    
    try {
      // Load all current settings
      const currentSettings = this.controller.getSettings();
      console.log('📖 Loading current settings:', currentSettings);
      
      // Populate form fields with current values
      this.populateFormFields(currentSettings);
      
      // Apply current theme
      this.applyTheme(currentSettings.display?.theme || 'dark');
      
    } catch (error) {
      console.error('Failed to load current settings:', error);
    }
  }

  populateFormFields(settings) {
    // Theme
    const themeSelect = this.overlay.querySelector('#theme-select');
    if (themeSelect && settings.display?.theme) {
      themeSelect.value = settings.display.theme;
    }

    // Sleep settings  
    const sleepTime = this.overlay.querySelector('#sleep-time');
    if (sleepTime && settings.display?.sleepTime) {
      sleepTime.value = settings.display.sleepTime;
    }

    const wakeTime = this.overlay.querySelector('#wake-time');
    if (wakeTime && settings.display?.wakeTime) {
      wakeTime.value = settings.display.wakeTime;
    }

    const resleepDelay = this.overlay.querySelector('#resleep-delay');
    if (resleepDelay && settings.display?.reSleepDelay) {
      resleepDelay.value = settings.display.reSleepDelay;
    }

    // Photos
    const photoTransition = this.overlay.querySelector('#photo-transition');
    if (photoTransition && settings.photos?.transitionTime) {
      photoTransition.value = settings.photos.transitionTime;
    }

    console.log('📝 Form fields populated with current settings');
  }

  setupEventHandlers() {
    // Initialize navigation
    this.navigation = new SimplifiedNavigation(this.overlay, {
      onThemeChange: (theme) => this.handleThemeChange(theme),
      onSettingChange: (path, value) => this.handleSettingChange(path, value),
      onSave: () => this.handleSave(),
      onCancel: () => this.handleCancel()
    });

    // CRITICAL: Add global keyboard event capture with high priority
    this.keydownHandler = (event) => {
      // Only handle if settings modal is visible and active
      if (!this.isVisible || !this.overlay.classList.contains('active')) {
        return;
      }

      console.log('🎮 Settings captured key:', event.key);
      
      // Let the navigation handle it
      if (this.navigation.handleKeyPress(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    // Add event listener with capture=true to get events before main navigation
    document.addEventListener('keydown', this.keydownHandler, true);

    // Also add to the overlay itself as backup
    this.overlay.addEventListener('keydown', this.keydownHandler, true);

    // Listen for form changes to track pending changes
    this.overlay.querySelectorAll('.form-control[data-setting]').forEach(control => {
      control.addEventListener('change', (e) => {
        const path = e.target.dataset.setting;
        const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
        this.pendingChanges[path] = value;
        console.log(`Setting queued: ${path} = ${value}`);
      });
    });

    // Prevent clicks from bubbling to main dashboard
    this.overlay.addEventListener('click', (e) => {
      e.stopPropagation();
    }, true);
  }

  handleThemeChange(theme) {
    // Apply theme immediately for preview
    this.applyTheme(theme);
    
    // Track the change
    this.pendingChanges['display.theme'] = theme;
    
    console.log(`Theme previewed: ${theme}`);
  }

  handleSettingChange(path, value) {
    this.pendingChanges[path] = value;
    console.log(`Setting changed: ${path} = ${value}`);
  }

  async handleSave() {
    if (!this.controller) {
      console.error('No settings controller available');
      return;
    }

    try {
      console.log('💾 Saving settings:', this.pendingChanges);
      
      // Apply all pending changes
      for (const [path, value] of Object.entries(this.pendingChanges)) {
        this.controller.setSetting(path, value);
      }
      
      // Save to database/local storage
      await this.controller.saveSettings();
      
      // Apply theme to main dashboard if changed
      if (this.pendingChanges['display.theme']) {
        await this.applyThemeToMainDashboard(this.pendingChanges['display.theme']);
      }
      
      // Notify other parts of the app
      this.notifySettingsChanged();
      
      console.log('✅ Settings saved successfully');
      this.hide();
      
    } catch (error) {
      console.error('❌ Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  }

  handleCancel() {
    // Revert theme preview if it was changed
    if (this.pendingChanges['display.theme']) {
      const originalTheme = this.controller.getSetting('display.theme', 'dark');
      this.applyTheme(originalTheme);
    }
    
    console.log('🚫 Settings cancelled');
    this.hide();
  }

  applyTheme(theme) {
    // Apply theme to settings modal
    document.body.className = `theme-${theme}`;
    
    // Also apply to the overlay specifically
    this.overlay.classList.remove('theme-dark', 'theme-light');
    this.overlay.classList.add(`theme-${theme}`);
  }

  async applyThemeToMainDashboard(theme) {
    try {
      // Use existing theme system
      const { switchTheme } = await import('../core/theme.js');
      switchTheme(theme);
      console.log(`🎨 Applied theme to main dashboard: ${theme}`);
    } catch (error) {
      console.warn('Could not apply theme to main dashboard:', error);
    }
  }

  notifySettingsChanged() {
    // Dispatch event for other parts of the app to listen to
    window.dispatchEvent(new CustomEvent('dashie-settings-changed', {
      detail: this.pendingChanges
    }));
    
    // Also update any photo widgets
    this.updatePhotoWidgets();
  }

  updatePhotoWidgets() {
    if (this.pendingChanges['photos.transitionTime']) {
      const photoWidgets = document.querySelectorAll('iframe[src*="photos.html"]');
      photoWidgets.forEach(iframe => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'update-settings',
              photoTransitionTime: this.pendingChanges['photos.transitionTime']
            }, '*');
          } catch (error) {
            console.warn('Failed to update photo widget:', error);
          }
        }
      });
    }
  }

  showOverlay() {
    this.overlay.classList.add('active');
    this.isVisible = true;
  }

  hideOverlay() {
    this.overlay.classList.remove('active');
    this.isVisible = false;
  }

  cleanup() {
    if (this.navigation) {
      this.navigation.destroy();
      this.navigation = null;
    }
    
    // Remove the global keyboard event listener
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    this.pendingChanges = {};
  }
}

// Simplified Navigation Class
class SimplifiedNavigation {
  constructor(overlay, callbacks) {
    this.overlay = overlay;
    this.callbacks = callbacks;
    this.focusIndex = 0;
    this.focusableElements = [];
    this.collapsedGroups = new Set(['theme', 'sleep', 'photos', 'widget-config']);
    this.currentTab = 'display';
    
    this.init();
  }

  init() {
    this.updateFocusableElements();
    this.setupEventListeners();
    this.updateFocus();
  }

  updateFocusableElements() {
    const tabs = Array.from(this.overlay.querySelectorAll('.tab-button:not(.disabled)'));
    const activePanel = this.overlay.querySelector('.tab-panel.active');
    const groupTitles = Array.from(activePanel.querySelectorAll('.group-title'));
    
    const expandedControls = [];
    groupTitles.forEach(title => {
      const groupId = title.dataset.group;
      if (!this.collapsedGroups.has(groupId)) {
        const content = this.overlay.querySelector(`#${groupId}-content`);
        if (content) {
          expandedControls.push(...content.querySelectorAll('.form-control'));
        }
      }
    });
    
    const buttons = Array.from(this.overlay.querySelectorAll('.settings-footer .btn'));
    this.focusableElements = [...tabs, ...groupTitles, ...expandedControls, ...buttons];
  }

  setupEventListeners() {
    // Tab clicks
    this.overlay.querySelectorAll('.tab-button:not(.disabled)').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Group title clicks
    this.overlay.querySelectorAll('.group-title').forEach(title => {
      title.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleGroup(title.dataset.group);
      });
    });

    // Form changes
    this.overlay.querySelectorAll('.form-control').forEach(control => {
      control.addEventListener('change', (e) => {
        if (control.id === 'theme-select') {
          this.callbacks.onThemeChange(e.target.value);
        } else if (control.dataset.setting) {
          const value = control.type === 'number' ? parseInt(control.value) : control.value;
          this.callbacks.onSettingChange(control.dataset.setting, value);
        }
      });
    });

    // Button clicks
    this.overlay.querySelector('#save-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onSave();
    });

    this.overlay.querySelector('#cancel-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onCancel();
    });

    // NOTE: Keyboard navigation is now handled by the parent SimplifiedSettings class
  }

  handleKeyPress(event) {
    const { key } = event;
    let handled = false;

    console.log(`⚙️ 🎹 Settings navigation handling key: ${key}`);

    switch (key) {
      case 'ArrowUp':
        this.moveFocus(-1);
        handled = true;
        break;
      case 'ArrowDown':
        this.moveFocus(1);
        handled = true;
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (this.isOnTabs()) {
          this.moveTabFocus(key === 'ArrowLeft' ? -1 : 1);
          handled = true;
        }
        break;
      case 'Enter':
        this.activateCurrentElement();
        handled = true;
        break;
      case 'Escape':
        this.callbacks.onCancel();
        handled = true;
        break;
    }

    if (handled) {
      console.log(`⚙️ ✅ Settings handled key: ${key}`);
    } else {
      console.log(`⚙️ ❌ Settings did not handle key: ${key}`);
    }

    return handled;
  }

  toggleGroup(groupId) {
    const title = this.overlay.querySelector(`[data-group="${groupId}"]`);
    const content = this.overlay.querySelector(`#${groupId}-content`);
    
    if (this.collapsedGroups.has(groupId)) {
      this.collapsedGroups.delete(groupId);
      title.classList.add('expanded');
      content.classList.remove('collapsed');
      content.classList.add('expanded');
    } else {
      this.collapsedGroups.add(groupId);
      title.classList.remove('expanded');
      content.classList.remove('expanded');
      content.classList.add('collapsed');
    }
    
    this.updateFocusableElements();
    this.updateFocus();
  }

  moveFocus(direction) {
    this.focusIndex = Math.max(0, Math.min(this.focusableElements.length - 1, this.focusIndex + direction));
    this.updateFocus();
  }

  moveTabFocus(direction) {
    const tabs = this.focusableElements.filter(el => el.classList.contains('tab-button'));
    const currentTabIndex = tabs.findIndex(tab => tab.classList.contains('focused'));
    const newIndex = Math.max(0, Math.min(tabs.length - 1, currentTabIndex + direction));
    this.focusIndex = this.focusableElements.indexOf(tabs[newIndex]);
    this.updateFocus();
  }

  isOnTabs() {
    const current = this.focusableElements[this.focusIndex];
    return current && current.classList.contains('tab-button');
  }

  switchTab(tabId) {
    this.overlay.querySelectorAll('.tab-button').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    this.overlay.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabId}-panel`);
    });

    this.currentTab = tabId;
    this.updateFocusableElements();
    this.focusIndex = 0;
    this.updateFocus();
  }

  updateFocus() {
    this.focusableElements.forEach(el => {
      el.classList.remove('focused', 'selected');
    });

    const current = this.focusableElements[this.focusIndex];
    if (current) {
      current.classList.add('focused');
      if (!current.classList.contains('tab-button') && !current.classList.contains('group-title')) {
        current.classList.add('selected');
      }
    }
  }

  activateCurrentElement() {
    const current = this.focusableElements[this.focusIndex];
    if (current) {
      if (current.classList.contains('tab-button')) {
        this.switchTab(current.dataset.tab);
      } else if (current.classList.contains('group-title')) {
        this.toggleGroup(current.dataset.group);
      } else {
        current.click();
        current.focus();
      }
    }
  }

  destroy() {
    // Remove event listeners if needed
  }
}

// Export for integration
export { SimplifiedSettings as default };
