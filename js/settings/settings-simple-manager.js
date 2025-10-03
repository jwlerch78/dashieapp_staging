// js/settings/settings-simple-manager.js - Auto-save implementation
// CHANGE SUMMARY: Integrated with modal navigation manager for unified remote input handling

import { buildSettingsUI, populateFormFields, applyTheme } from './settings-ui-builder.js';
import { SimplifiedNavigation } from './settings-d-pad-nav.js';
import { setupEventHandlers } from './settings-event-handler.js';
import { createModalNavigation } from '../utils/modal-navigation-manager.js';
import { getPlatformDetector } from '../utils/platform-detector.js';

export class SimplifiedSettings {
  constructor() {
    this.isVisible = false;
    this.overlay = null;
    this.navigation = null;
    this.controller = null;
    this.keydownHandler = null;
    this.modalNavigation = null; // NEW: For modal manager integration
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
  
  // Detect platform
  const platformDetector = getPlatformDetector();
  const isMobile = platformDetector.isMobile();
  
  console.log(`⚙️ Opening settings for platform: ${isMobile ? 'mobile' : 'desktop/TV'}`);
  
  // Create UI using platform-appropriate builder
  this.overlay = document.createElement('div');
  this.overlay.className = 'settings-overlay';
  this.overlay.innerHTML = buildSettingsUI(isMobile);
  document.body.appendChild(this.overlay);
  
  // Load and populate current settings
  await this.loadCurrentSettings();
  
  // Set up event handlers
  setupEventHandlers(this.overlay, this);
  
  if (isMobile) {
    // Mobile: Simple touch handlers, no complex navigation
    console.log('⚙️ 📱 Setting up touch handlers for mobile');
    this.setupTouchHandlers();
  } else {
    // Desktop/TV: Use existing D-pad navigation
    console.log('⚙️ 🖥️ Initializing D-pad navigation for desktop/TV');
    this.navigation = new SimplifiedNavigation(this.overlay, {
      onThemeChange: (theme) => this.handleThemeChange(theme),
      onSettingChange: (path, value) => this.handleSettingChange(path, value),
      onCancel: () => this.handleCancel()
    });
    
    // Register with modal navigation manager for unified input handling
    this.modalNavigation = createModalNavigation(this.overlay, [], {
      onEscape: () => this.handleCancel(),
      customHandler: (action) => {
        const actionToKeyMap = {
          'up': 'ArrowUp',
          'down': 'ArrowDown',
          'left': 'ArrowLeft',
          'right': 'ArrowRight',
          'enter': 'Enter',
          'escape': 'Escape'
        };
        
        const key = actionToKeyMap[action];
        if (!key) return false;
        
        const syntheticEvent = {
          key: key,
          preventDefault: () => {},
          stopPropagation: () => {},
          stopImmediatePropagation: () => {}
        };
        
        return this.navigation.handleKeyPress(syntheticEvent);
      }
    });
  }
  
  this.showOverlay();
  console.log('⚙️ 👁️ Settings shown successfully');
}



setupTouchHandlers() {
  // Handle "Done" button
  const doneBtn = this.overlay.querySelector('#settings-done');
  if (doneBtn) {
    doneBtn.addEventListener('click', () => {
      console.log('📱 Done button clicked');
      this.handleCancel();
    });
  }
  
  // Handle navigation cells (cells with chevrons)
  this.overlay.addEventListener('click', (e) => {
    const cell = e.target.closest('.settings-cell[data-navigate]');
    if (cell) {
      const targetScreen = cell.dataset.navigate;
      console.log(`📱 Navigating to: ${targetScreen}`);
      this.navigateToScreen(targetScreen);
    }
  });
  
  // Handle back button
  const backBtn = this.overlay.querySelector('.nav-back-button');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      console.log('📱 Back button clicked');
      this.navigateBack();
    });
  }
  
  // Handle selection cells (radio button style)
  this.overlay.addEventListener('click', (e) => {
    const selectableCell = e.target.closest('.settings-cell.selectable');
    if (selectableCell) {
      const setting = selectableCell.dataset.setting;
      const value = selectableCell.dataset.value;
      
      // Update UI selection
      const section = selectableCell.closest('.settings-section');
      if (section) {
        section.querySelectorAll('.selectable').forEach(cell => {
          cell.classList.remove('selected');
        });
        selectableCell.classList.add('selected');
      }
      
      console.log(`📱 Selection changed: ${setting} = ${value}`);
      this.handleSettingChange(setting, value);
    }
  });
  
  // Handle form controls (auto-save on change)
  this.overlay.addEventListener('change', (e) => {
    if (e.target.matches('.form-control')) {
      const setting = e.target.dataset.setting;
      const value = e.target.value;
      console.log(`📱 Setting changed: ${setting} = ${value}`);
      this.handleSettingChange(setting, value);
    }
  });
  
  // Initialize navigation stack
  this.navigationStack = ['root'];
  this.updateMobileNavBar();
}


navigateToScreen(screenId) {
  const currentScreen = this.overlay.querySelector('.settings-screen.active');
  const nextScreen = this.overlay.querySelector(`[data-screen="${screenId}"]`);
  
  if (!nextScreen) {
    console.error(`📱 Screen not found: ${screenId}`);
    return;
  }
  
  // Add to stack
  this.navigationStack.push(screenId);
  
  // Animate transition
  currentScreen.classList.remove('active');
  currentScreen.classList.add('sliding-out-left');
  
  nextScreen.classList.add('sliding-in-right', 'active');
  
  setTimeout(() => {
    currentScreen.classList.remove('sliding-out-left');
    nextScreen.classList.remove('sliding-in-right');
  }, 300);
  
  this.updateMobileNavBar();
}

navigateBack() {
  if (this.navigationStack.length <= 1) return;
  
  const currentScreen = this.overlay.querySelector('.settings-screen.active');
  this.navigationStack.pop();
  
  const previousScreenId = this.navigationStack[this.navigationStack.length - 1];
  const previousScreen = this.overlay.querySelector(`[data-screen="${previousScreenId}"]`);
  
  if (!previousScreen) return;
  
  // Animate transition
  currentScreen.classList.remove('active');
  currentScreen.classList.add('sliding-out-right');
  
  previousScreen.classList.add('sliding-in-left', 'active');
  
  setTimeout(() => {
    currentScreen.classList.remove('sliding-out-right');
    previousScreen.classList.remove('sliding-in-left');
  }, 300);
  
  this.updateMobileNavBar();
}

updateMobileNavBar() {
  const currentScreenId = this.navigationStack[this.navigationStack.length - 1];
  const currentScreen = this.overlay.querySelector(`[data-screen="${currentScreenId}"]`);
  
  if (!currentScreen) return;
  
  // Update title
  const title = currentScreen.dataset.title || 'Settings';
  const navTitle = this.overlay.querySelector('.nav-title');
  if (navTitle) {
    navTitle.textContent = title;
  }
  
  // Show/hide back button
  const backBtn = this.overlay.querySelector('.nav-back-button');
  if (backBtn) {
    if (this.navigationStack.length > 1) {
      backBtn.style.visibility = 'visible';
      
      // Set back button text
      const previousScreenId = this.navigationStack[this.navigationStack.length - 2];
      const previousScreen = this.overlay.querySelector(`[data-screen="${previousScreenId}"]`);
      if (previousScreen) {
        const previousTitle = previousScreen.dataset.title || 'Back';
        backBtn.textContent = `‹ ${previousTitle}`;
      }
    } else {
      backBtn.style.visibility = 'hidden';
    }
  }
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
        
        // Show save notification
        this.showSaveNotification();
        
        // Notify widgets of the change immediately
        this.notifySettingChanged(path, value);
      } else {
        console.warn(`⚙️ ⚠️ Failed to auto-save ${path} = ${value}`);
      }
    }
  }

  showSaveNotification() {
    // Check if notification already exists
    let notification = document.querySelector('.settings-save-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.className = 'settings-save-notification';
      notification.textContent = 'Saved';
      document.body.appendChild(notification);
    }
    
    // Show notification
    notification.classList.add('show');
    
    // Hide after 2 seconds
    setTimeout(() => {
      notification.classList.remove('show');
    }, 2000);
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
      
      // NEW: Update mobile header family name
      const mobileHeaderName = document.querySelector('.mobile-header .family-name');
      if (mobileHeaderName) {
        mobileHeaderName.textContent = value || 'Dashie';
        console.log('📱 Updated mobile header family name:', value);
      }
      
      // NEW: Also dispatch mobile-specific event for the listener
      window.dispatchEvent(new CustomEvent('dashie-mobile-family-name-changed', {
        detail: { familyName: value }
      }));
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
    
    // NEW: Unregister from modal navigation manager
    if (this.modalNavigation) {
      this.modalNavigation.destroy();
      this.modalNavigation = null;
      console.log('⚙️ Unregistered from modal navigation manager');
    }
    
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