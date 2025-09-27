// js/settings/settings-simple-manager.js - STAGE 1: Remove noisy retry loop
// CHANGE SUMMARY: Removed 20-attempt retry loop, now waits for auth properly once instead of repeatedly

import { buildSettingsUI, populateFormFields, applyTheme } from './settings-ui-builder.js';
import { SimplifiedNavigation } from './settings-d-pad-nav.js';
import { setupEventHandlers } from './settings-event-handler.js';

export class SimplifiedSettings {
  constructor(jwtStatus = 'unknown') {
    this.isVisible = false;
    this.overlay = null;
    this.navigation = null;
    this.controller = null;
    this.pendingChanges = {};
    this.keydownHandler = null;
    this.jwtStatus = jwtStatus; // Store JWT status for database mode selection
    
    // Queue for widget requests that arrive before controller is ready
    this.pendingWidgetRequests = [];
    this.controllerReady = false;
    
    console.log('⚙️ Settings manager initialized with JWT status:', jwtStatus);
    
    // Start initialization process - simplified, no retry loop
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
      console.log('⚙️ Initializing Settings Controller...');
      
      // Wait for auth to be ready - but do it properly once instead of retry loop
      const authReady = await this.waitForAuthOnce();
      
      if (!authReady) {
        console.warn('⚙️ Auth not ready, proceeding with limited functionality');
      }
      
      // Initialize the controller
      const { SettingsController } = await import('./settings-controller.js');
      this.controller = new SettingsController();
      
      const initSuccess = await this.controller.init();
      
      if (initSuccess) {
        console.log('⚙️ ✅ Settings controller initialized successfully');
      } else {
        console.warn('⚙️ ⚠️ Settings controller initialized with fallback mode');
      }
      
      // Mark controller as ready and process any pending requests
      this.controllerReady = true;
      await this.processPendingWidgetRequests();
      
    } catch (error) {
      console.error('⚙️ ❌ Failed to initialize settings controller:', error);
      // Still mark as ready so app doesn't hang
      this.controllerReady = true;
    }
  }

  /**
   * Wait for auth system to be ready - single attempt with reasonable timeout
   * @returns {Promise<boolean>} True if auth is ready
   */
  async waitForAuthOnce() {
    const maxWait = 10000; // 10 seconds - reasonable for most auth flows
    const checkInterval = 500; // Check every 500ms - less noisy
    const startTime = Date.now();

    console.log('⚙️ Waiting for authentication system...');

    while (Date.now() - startTime < maxWait) {
      const authStatus = this.checkAuthStatus();
      
      if (authStatus.ready) {
        console.log('⚙️ ✅ Auth system ready:', authStatus);
        return true;
      }
      
      // Only log occasionally to avoid spam
      if ((Date.now() - startTime) % 2000 < checkInterval) {
        console.log('⚙️ Still waiting for auth...', authStatus);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    console.warn('⚙️ ⚠️ Auth system timeout after 10 seconds, proceeding anyway');
    return false;
  }

  checkAuthStatus() {
    const authSystem = window.dashieAuth || window.authManager;
    
    return {
      ready: !!(authSystem && authSystem.isUserAuthenticated && authSystem.isUserAuthenticated()),
      hasDashieAuth: !!window.dashieAuth,
      isAuthenticated: !!(authSystem && authSystem.isAuthenticated && authSystem.isAuthenticated()),
      hasUser: !!(authSystem && authSystem.getCurrentUser && authSystem.getCurrentUser()),
      hasAuthManager: !!window.authManager,
      authSystemExists: !!authSystem
    };
  }

  async processPendingWidgetRequests() {
    if (this.pendingWidgetRequests.length === 0) {
      console.log('👨‍👩‍👧‍👦 ✅ No pending widget requests to process');
      return;
    }

    console.log(`👨‍👩‍👧‍👦 📋 Processing ${this.pendingWidgetRequests.length} pending widget requests`);

    for (const request of this.pendingWidgetRequests) {
      try {
        if (request.type === 'family-name-request') {
          await this.sendFamilyNameToWidget(request.source);
          console.log(`👨‍👩‍👧‍👦 ✅ Processed family name request for ${request.widget}`);
        }
      } catch (error) {
        console.error(`👨‍👩‍👧‍👦 ❌ Failed to process request for ${request.widget}:`, error);
      }
    }

    // Clear the queue
    this.pendingWidgetRequests = [];
    console.log('👨‍👩‍👧‍👦 ✅ All pending widget requests processed');
  }

  async sendFamilyNameToWidget(widgetWindow) {
    if (!this.controller) {
      console.warn('👨‍👩‍👧‍👦 ⚠️ Cannot send family name - controller not ready');
      return;
    }

    try {
      const familyName = this.controller.getSetting('family.name') || 'Dashboard';
      
      widgetWindow.postMessage({
        type: 'family-name-response',
        familyName: familyName
      }, '*');
      
      console.log('👨‍👩‍👧‍👦 ✅ Family name sent to widget:', familyName);
    } catch (error) {
      console.error('👨‍👩‍👧‍👦 ❌ Failed to send family name:', error);
    }
  }

  async show() {
    if (!this.controller) {
      console.warn('⚙️ Settings controller not ready, initializing...');
      await this.initializeController();
    }

    if (this.isVisible) return;

    try {
      this.overlay = document.createElement('div');
      this.overlay.className = 'settings-overlay';
      this.overlay.innerHTML = buildSettingsUI();
      document.body.appendChild(this.overlay);

      await populateFormFields(this.controller);
      applyTheme();

      this.navigation = new SimplifiedNavigation(this.overlay);
      setupEventHandlers(this.overlay, this.controller, this.navigation, this);

      this.isVisible = true;
      this.overlay.style.display = 'flex';

      this.keydownHandler = (event) => {
        if (this.navigation) {
          this.navigation.handleKeydown(event);
        }
      };

      document.addEventListener('keydown', this.keydownHandler);
      console.log('⚙️ ✅ Settings interface opened');

    } catch (error) {
      console.error('⚙️ ❌ Failed to show settings:', error);
    }
  }

  async hide() {
    if (!this.isVisible) return;

    try {
      if (this.keydownHandler) {
        document.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = null;
      }

      if (this.overlay) {
        this.overlay.remove();
        this.overlay = null;
      }

      this.navigation = null;
      this.isVisible = false;

      console.log('⚙️ ✅ Settings interface closed');
    } catch (error) {
      console.error('⚙️ ❌ Failed to hide settings:', error);
    }
  }

  async saveSettings() {
    if (!this.controller) {
      console.error('⚙️ ❌ Cannot save settings - controller not ready');
      return false;
    }

    try {
      return await this.controller.saveSettings();
    } catch (error) {
      console.error('⚙️ ❌ Failed to save settings:', error);
      return false;
    }
  }
}

export default SimplifiedSettings;