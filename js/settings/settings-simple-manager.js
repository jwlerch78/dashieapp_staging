// js/settings/settings-simple-manager.js - Auto-save implementation
// CHANGE SUMMARY: Removed pendingChanges tracking and Save button - all changes now auto-save immediately via controller

import { buildSettingsUI, populateFormFields, applyTheme } from './settings-ui-builder.js';
import { SimplifiedNavigation } from './settings-d-pad-nav.js';
import { setupEventHandlers } from './settings-event-handler.js';

export class SimplifiedSettings {
  constructor() {
    this.isVisible = false;
    this.overlay = null;
    this.navigation = null;
    this.controller = null;
    this.keydownHandler = null;
    this.initializationAttempts = 0;
    this.maxInitAttempts = 20;
    
    // Queue for widget requests that arrive before controller is ready
    this.pendingWidgetRequests = [];
    this.controllerReady = false;
    
    // Start initialization process with delay
    setTimeout(() => this.initializeController(), 200);

    // Listen for widget requests for family name and queue them if needed
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'request-family-name') {
        console.log('👨‍👩‍👧‍👦 Widget requesting family name:', event.data.widget);
        
        if (this.controllerReady && this.controller) {
          // Controller is ready, respond immediately
          this.sendFamilyNameToWidget(event.source);
        } else {
          // Controller not ready, queue the request
          console.log('👨‍👩‍👧‍👦 ⏳ Controller not ready, queuing family name request');
          this.pendingWidgetRequests.push({
            type: 'family-name-request',
            source: event.source,
            widget: event.data.widget,
            timestamp: Date.now()
          });
        }
      }
    });
  }

  async initializeController() {
    try {
      this.initializationAttempts++;
      console.log(`⚙️ Settings initialization attempt ${this.initializationAttempts}/${this.maxInitAttempts}`);
      
      const authStatus = this.checkAuthStatus();
      console.log('⚙️ Auth status check:', authStatus);
      
      // Initialize the controller
      const { SettingsController } = await import('./settings-controller.js');
      this.controller = new SettingsController();
      
      const initSuccess = await this.controller.init();
      
      if (initSuccess) {
        console.log('⚙️ ✅ Settings controller initialized successfully');
      } else {
        console.warn('⚙️ ⚠️ Settings controller initialized with fallback mode');
      }
      
      // Mark controller as ready and process pending requests
      this.controllerReady = true;
      this.processPendingWidgetRequests();
      
    } catch (error) {
      console.error('⚙️ ❌ Settings controller initialization failed:', error);
      this.controller = this.createFallbackController();
      this.controllerReady = true;
      this.processPendingWidgetRequests();
      console.log('⚙️ Using fallback localStorage-only controller');
    }
  }

  // Process queued widget requests once controller is ready
  processPendingWidgetRequests() {
    if (this.pendingWidgetRequests.length === 0) {
      console.log('👨‍👩‍👧‍👦 ✅ No pending widget requests to process');
      return;
    }
    
    console.log(`👨‍👩‍👧‍👦 🔄 Processing ${this.pendingWidgetRequests.length} pending widget requests`);
    
    // Process all pending requests
    this.pendingWidgetRequests.forEach((request, index) => {
      console.log(`👨‍👩‍👧‍👦 Processing request ${index + 1}: ${request.widget}`);
      
      if (request.type === 'family-name-request') {
        // Add a small delay between requests to avoid overwhelming
        setTimeout(() => {
          this.sendFamilyNameToWidget(request.source);
        }, index * 100);
      }
    });
    
    // Clear the queue
    this.pendingWidgetRequests = [];
  }

  checkAuthStatus() {
    const hasDashieAuth = window.dashieAuth && typeof window.dashieAuth.isAuthenticated === 'function';
    const isAuthenticated = hasDashieAuth ? window.dashieAuth.isAuthenticated() : false;
    const hasUser = hasDashieAuth ? !!window.dashieAuth.getUser() : false;
    const hasAuthManager = window.authManager && window.authManager.currentUser;
    
    let hasSavedUser = false;
    try {
      const savedUser = localStorage.getItem('dashie-user');
      hasSavedUser = !!savedUser;
    } catch (e) {
      // Ignore localStorage errors
    }
    
    const ready = (hasDashieAuth && isAuthenticated && hasUser) || 
                  hasAuthManager || 
                  hasSavedUser;
    
    return {
      ready,
      hasDashieAuth,
      isAuthenticated,
      hasUser,
      hasAuthManager,
      hasSavedUser,
      userEmail: hasUser ? window.dashieAuth.getUser().email : 
                hasAuthManager ? window.authManager.currentUser.email : 
                'unknown'
    };
  }

  createFallbackController() {
    const userEmail = this.checkAuthStatus().userEmail;
    
    return {
      isInitialized: true,
      currentSettings: this.getDefaultSettings(userEmail),
      
      getSetting(path) {
        const keys = path.split('.');
        let current = this.currentSettings;
        for (const key of keys) {
          if (current && typeof current === 'object' && key in current) {
            current = current[key];
          } else {
            return undefined;
          }
        }
        return current;
      },
      
      setSetting(path, value) {
        const keys = path.split('.');
        let current = this.currentSettings;
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
          }
          current = current[key];
        }
        current[keys[keys.length - 1]] = value;
        
        if (path === 'display.theme') {
          this.applyThemeImmediate(value);
        }
        
        return true;
      },
      
      async applyThemeImmediate(theme) {
        try {
          const { switchTheme } = await import('../core/theme.js');
          switchTheme(theme);
          console.log(`⚙️ 🎨 Fallback: Theme applied: ${theme}`);
        } catch (error) {
          console.warn('⚙️ ⚠️ Fallback: Failed to apply theme:', error);
        }
      },
      
      async saveSettings() {
        try {
          localStorage.setItem('dashie-settings', JSON.stringify(this.currentSettings));
          console.log('⚙️ 💾 Fallback: Saved to localStorage');
          return true;
        } catch (error) {
          console.error('⚙️ ❌ Fallback: Failed to save to localStorage:', error);
          return false;
        }
      },
      
      getSettings() {
        return { ...this.currentSettings };
      },
      
      isReady() {
        return true;
      }
    };
  }

  // Default settings with NEW system settings
  getDefaultSettings(userEmail = 'unknown@example.com') {
    // Detect current site for default
    const currentSite = this.detectCurrentSite();
    const defaultSite = currentSite !== 'other' ? currentSite : 'prod';
    
    return {
      photos: { transitionTime: 5 },
      display: {
        sleepTime: '22:00',
        wakeTime: '07:00',
        reSleepDelay: 30,
        theme: 'light'
      },
      accounts: {
        dashieAccount: userEmail,
        connectedServices: [],
        pinEnabled: false
      },
      family: {
        familyName: 'Dashie',
        members: []
      },
      // NEW: System settings
      system: {
        activeSite: defaultSite, // 'prod' or 'dev'
        autoRedirect: true, // Auto-redirect on startup
        debugMode: false // Enable debug logging
      },
      version: '2.0.0',
      lastModified: Date.now()
    };
  }

  // NEW: Detect current site
  detectCurrentSite() {
    const hostname = window.location.hostname;
    
    if (hostname === 'dashieapp.com' || hostname === 'www.dashieapp.com') {
      return 'prod';
    } else if (hostname === 'dev.dashieapp.com') {
      return 'dev';
    } else {
      return 'other';
    }
  }

  async show() {
    if (this.isVisible) return;
    
    if (!this.controller) {
      console.log('⚙️ Controller not ready, attempting initialization...');
      await this.initializeController();
      
      if (!this.controller) {
        alert('Settings system not ready. Please try again in a moment.');
        return;
      }
    }
    
    // Create UI using the UI builder
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.innerHTML = buildSettingsUI();
    document.body.appendChild(this.overlay);
    
    // Load and populate current settings
    await this.loadCurrentSettings();
    
    // Set up event handlers
    setupEventHandlers(this.overlay, this);
    
    // Initialize navigation (removed onSave callback)
    this.navigation = new SimplifiedNavigation(this.overlay, {
      onThemeChange: (theme) => this.handleThemeChange(theme),
      onSettingChange: (path, value) => this.handleSettingChange(path, value),
      onCancel: () => this.handleCancel()
    });
    
    this.showOverlay();
    console.log('⚙️ 👁️ Simplified settings shown');
  }

  async loadCurrentSettings() {
    if (!this.controller) return;
    
    try {
      const currentSettings = this.controller.getSettings();
      console.log('⚙️ Loading current settings:', currentSettings);
      
      populateFormFields(this.overlay, currentSettings);
      applyTheme(this.overlay, currentSettings.display?.theme || 'dark');
      
    } catch (error) {
      console.error('⚙️ ❌ Failed to load current settings:', error);
    }
  }

  handleThemeChange(theme) {
    // Auto-save: Apply theme immediately and save to controller
    applyTheme(this.overlay, theme);
    
    if (this.controller) {
      this.controller.setSetting('display.theme', theme);
      this.applyThemeToMainDashboard(theme);
    }
    
    console.log(`⚙️ Theme changed and saved: ${theme}`);
  }

  handleSettingChange(path, value) {
    // Handle boolean conversion for system settings
    if (path === 'system.autoRedirect' || path === 'system.debugMode') {
      value = value === 'true';
    }
    
    // Auto-save: Save immediately to controller
    if (this.controller) {
      const success = this.controller.setSetting(path, value);
      if (success) {
        console.log(`⚙️ ✅ Setting auto-saved: ${path} = ${value}`);
        
        // Notify widgets of the change immediately
        this.notifySettingChanged(path, value);
      } else {
        console.warn(`⚙️ ⚠️ Failed to auto-save ${path} = ${value}`);
      }
    }
  }

  handleCancel() {
    // Just close the settings - no need to revert anything since we auto-save
    console.log('⚙️ Settings closed');
    this.hide();
  }

  async applyThemeToMainDashboard(theme) {
    try {
      const { switchTheme } = await import('../core/theme.js');
      switchTheme(theme);
      console.log(`⚙️ 🎨 Applied theme to main dashboard: ${theme}`);
    } catch (error) {
      console.warn('⚙️ ⚠️ Could not apply theme to main dashboard:', error);
    }
  }

  notifySettingChanged(path, value) {
    // Emit event for any listeners
    window.dispatchEvent(new CustomEvent('dashie-settings-changed', {
      detail: { [path]: value }
    }));
    
    // Update photo widgets
    if (path === 'photos.transitionTime') {
      const photoWidgets = document.querySelectorAll('iframe[src*="photos.html"]');
      photoWidgets.forEach(iframe => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'update-settings',
              photoTransitionTime: value
            }, '*');
          } catch (error) {
            console.warn('⚙️ ⚠️ Failed to update photo widget:', error);
          }
        }
      });
    }
    
    // Update header widget with family name
    if (path === 'family.familyName') {
      const headerWidgets = document.querySelectorAll('iframe[src*="header.html"]');
      headerWidgets.forEach(iframe => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'family-name-update',
              familyName: value
            }, '*');
            console.log('👨‍👩‍👧‍👦 Sent family name update to header:', value);
          } catch (error) {
            console.warn('⚙️ ⚠️ Failed to update header widget:', error);
          }
        }
      });
    }
  }

  // Enhanced family name sending with better error handling and retries
  sendFamilyNameToWidget(widgetWindow) {
    if (!this.controller) {
      console.warn('👨‍👩‍👧‍👦 ⚠️ No controller available to get family name');
      
      // Try localStorage fallback immediately
      this.sendFallbackFamilyName(widgetWindow);
      return;
    }

    try {
      // Get current family name from settings with multiple attempts
      let familyName = this.controller.getSetting('family.familyName');
      
      // If no family name found, try to refresh settings and try again
      if (!familyName) {
        console.log('👨‍👩‍👧‍👦 ⚠️ No family name in controller, trying to refresh...');
        
        // Try to get fresh settings
        const allSettings = this.controller.getSettings();
        familyName = allSettings?.family?.familyName;
        
        if (!familyName) {
          console.log('👨‍👩‍👧‍👦 ⚠️ Still no family name, trying localStorage fallback...');
          this.sendFallbackFamilyName(widgetWindow);
          return;
        }
      }
      
      console.log('👨‍👩‍👧‍👦 📤 Sending family name to widget:', familyName);
      
      widgetWindow.postMessage({
        type: 'family-name-response',
        familyName: familyName
      }, '*');
      
      console.log('👨‍👩‍👧‍👦 ✅ Family name sent successfully');
      
    } catch (error) {
      console.error('👨‍👩‍👧‍👦 ❌ Failed to send family name:', error);
      this.sendFallbackFamilyName(widgetWindow);
    }
  }

  // Fallback method to send family name from localStorage or default
  sendFallbackFamilyName(widgetWindow) {
    let fallbackName = 'Dashie'; // Default fallback
    
    try {
      // Try localStorage first
      const savedSettings = localStorage.getItem('dashie-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        const storedName = settings?.family?.familyName;
        if (storedName) {
          fallbackName = storedName;
          console.log('👨‍👩‍👧‍👦 💾 Using family name from localStorage:', fallbackName);
        }
      }
    } catch (error) {
      console.warn('👨‍👩‍👧‍👦 ⚠️ localStorage fallback failed:', error);
    }
    
    try {
      console.log('👨‍👩‍👧‍👦 🏠 Sending fallback family name:', fallbackName);
      
      widgetWindow.postMessage({
        type: 'family-name-response',
        familyName: fallbackName
      }, '*');
      
      console.log('👨‍👩‍👧‍👦 ✅ Fallback family name sent');
      
    } catch (fallbackError) {
      console.error('👨‍👩‍👧‍👦 ❌ Failed to send fallback family name:', fallbackError);
    }
  }

  hide() {
    if (!this.isVisible) return;
    
    this.hideOverlay();
    this.cleanup();
    
    console.log('⚙️ 👁️ Simplified settings hidden');
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
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

export { SimplifiedSettings as default };