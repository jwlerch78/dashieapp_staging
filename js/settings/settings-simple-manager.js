// js/settings/settings-simple-manager.js - Auto-save implementation
// CHANGE SUMMARY: Updated to use TimeSelectionHandler for consolidated time selection logic (touch events)

import { buildSettingsUI, populateFormFields, applyTheme } from './settings-ui-builder.js';
import { SimplifiedNavigation } from './settings-d-pad-nav.js';
import { setupEventHandlers } from './settings-event-handler.js';
import { createModalNavigation } from '../utils/modal-navigation-manager.js';
import { getPlatformDetector } from '../utils/platform-detector.js';
import { TimeSelectionHandler } from './time-selection-handler.js';

export class SimplifiedSettings {
  constructor() {
    this.isVisible = false;
    this.overlay = null;
    this.navigation = null;
    this.controller = null;
    this.keydownHandler = null;
    this.modalNavigation = null;
    this.timeHandler = new TimeSelectionHandler(); // NEW: Consolidated time selection
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
          this.sendFamilyNameToWidget(event.source);
        } else {
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

  processPendingWidgetRequests() {
    if (this.pendingWidgetRequests.length === 0) {
      console.log('👨‍👩‍👧‍👦 ✅ No pending widget requests to process');
      return;
    }
    
    console.log(`👨‍👩‍👧‍👦 🔄 Processing ${this.pendingWidgetRequests.length} pending widget requests`);
    
    this.pendingWidgetRequests.forEach((request, index) => {
      console.log(`👨‍👩‍👧‍👦 Processing request ${index + 1}: ${request.widget}`);
      
      if (request.type === 'family-name-request') {
        setTimeout(() => {
          this.sendFamilyNameToWidget(request.source);
        }, index * 100);
      }
    });
    
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

  getDefaultSettings(userEmail = 'unknown@example.com') {
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
      system: {
        activeSite: defaultSite,
        autoRedirect: true,
        debugMode: false
      },
      version: '2.0.0',
      lastModified: Date.now()
    };
  }

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
    
    const platformDetector = getPlatformDetector();
    const isMobile = platformDetector.isMobile();
    
    console.log(`⚙️ Opening settings for platform: ${isMobile ? 'mobile' : 'desktop/TV'}`);
    
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.innerHTML = buildSettingsUI(isMobile);
    document.body.appendChild(this.overlay);
    
    await this.loadCurrentSettings();
    
    setupEventHandlers(this.overlay, this);
    
    console.log(`⚙️ Initializing ${isMobile ? 'touch' : 'D-pad'} navigation`);
    this.navigation = new SimplifiedNavigation(this.overlay, {
      onThemeChange: (theme) => this.handleThemeChange(theme),
      onSettingChange: (path, value) => this.handleSettingChange(path, value),
      onCancel: () => this.handleCancel()
    }, this.timeHandler);
    
    this.navigationStack = ['root'];
    
    if (isMobile) {
      console.log('⚙️ 📱 Adding touch handlers for mobile');
      this.setupTouchHandlers();
    } else {
      console.log('⚙️ 🖥️ Registering with modal navigation manager');
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
    const doneBtn = this.overlay.querySelector('#settings-done');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        console.log('📱 Done button clicked');
        this.handleCancel();
      });
    }
    
    // Navigation cells (cells with chevrons)
    this.overlay.addEventListener('click', (e) => {
      const cell = e.target.closest('.settings-cell[data-navigate]');
      if (cell) {
        const targetScreen = cell.dataset.navigate;
        console.log(`📱 Navigating to: ${targetScreen}`);
        this.navigateToScreen(targetScreen);
        
        setTimeout(() => {
          this.highlightCurrentSelections();
        }, 350);
      }
    });
    
    // Back button
    const backBtn = this.overlay.querySelector('.nav-back-button');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        console.log('📱 Back button clicked');
        this.navigateBack();
      });
    }
    
    // Selectable cells (actual setting values)
    this.overlay.addEventListener('click', (e) => {
      const selectableCell = e.target.closest('.settings-cell.selectable');
      if (!selectableCell) return;

      if (this.timeHandler.isTimeSelectionCell(selectableCell)) {
        const action = this.timeHandler.handleSelection(selectableCell);
        
        console.log('📱 Time selection action:', action);
        
        switch (action.type) {
          case 'navigate':
            this.navigateToScreen(action.screenId);
            setTimeout(() => {
              this.highlightCurrentSelections();
            }, 350);
            break;
            
          case 'complete':
            console.log(`📱 ${action.message}`);
            
            const section = selectableCell.closest('.settings-section');
            if (section) {
              section.querySelectorAll('.selectable').forEach(cell => {
                cell.classList.remove('selected');
              });
              selectableCell.classList.add('selected');
            }
            
            this.handleSettingChange(action.setting, action.value);
            this.updateParentDisplayValue(action.setting, action.value);
            
            // Navigate directly back to Display screen
            setTimeout(() => {
              this.navigateDirectToScreen('display');
            }, 300);
            break;
            
          case 'not-time-selection':
            this.handleRegularSelection(selectableCell);
            break;
            
          case 'error':
            console.error('📱 Time selection error:', action.message);
            break;
        }
      } else {
        this.handleRegularSelection(selectableCell);
      }
    });
    
    // Form controls
    this.overlay.addEventListener('change', (e) => {
      if (e.target.matches('.form-control')) {
        const setting = e.target.dataset.setting;
        const value = e.target.value;
        console.log(`📱 Setting changed: ${setting} = ${value}`);
        this.handleSettingChange(setting, value);
      }
    });
    
    this.navigationStack = ['root'];
    this.updateMobileNavBar();
  }

   handleRegularSelection(selectableCell) {
    const setting = selectableCell.dataset.setting;
    const value = selectableCell.dataset.value;
    
    if (!setting || !value) return;
    
    const section = selectableCell.closest('.settings-section');
    if (section) {
      section.querySelectorAll('.selectable').forEach(cell => {
        cell.classList.remove('selected');
      });
      selectableCell.classList.add('selected');
    }
    
    console.log(`📱 Selection changed: ${setting} = ${value}`);
    this.handleSettingChange(setting, value);
    this.updateParentDisplayValue(setting, value);
    
  }

 updateParentDisplayValue(setting, value) {
    const displayMap = {
      'display.theme': { id: 'mobile-theme-value', format: (v) => v === 'dark' ? 'Dark' : 'Light' },
      'display.sleepTime': { id: 'mobile-sleep-time-value', format: (v) => this.timeHandler.formatTime(v) },
      'display.wakeTime': { id: 'mobile-wake-time-value', format: (v) => this.timeHandler.formatTime(v) },
      'photos.source': { 
        id: 'mobile-photo-album-value', 
        format: (v) => ({ recent: 'Recent Photos', family: 'Family Album', vacation: 'Vacation 2024' }[v] || v)
      },
      'photos.transitionTime': {
        id: 'mobile-photo-transition-value',
        format: (v) => this.formatTransitionTime(parseInt(v))
      }
    };

    const display = displayMap[setting];
    if (display) {
      const element = this.overlay.querySelector(`#${display.id}`);
      if (element) {
        const formattedValue = display.format(value);
        element.textContent = formattedValue;
        console.log(`📱 Updated display: ${display.id} = "${formattedValue}"`);
      } else {
        console.warn(`📱 Display element not found: #${display.id}`);
      }
    } else {
      console.log(`📱 No display update needed for setting: ${setting}`);
    }
  }

  formatTransitionTime(seconds) {
    if (seconds < 60) return `${seconds} sec`;
    if (seconds < 3600) return `${seconds / 60} min`;
    return `${seconds / 3600} hour`;
  }

  highlightCurrentSelections() {
    const currentScreenId = this.navigationStack[this.navigationStack.length - 1];
    
    if (currentScreenId.includes('sleep-time') || currentScreenId.includes('wake-time')) {
      this.timeHandler.highlightCurrentTimeSelection(this.overlay, currentScreenId);
      return;
    }
    
    const activeScreen = this.overlay.querySelector('.settings-screen.active');
    if (!activeScreen) return;
    
    const selectableCells = activeScreen.querySelectorAll('.settings-cell.selectable[data-setting]');
    
    selectableCells.forEach(cell => {
      const setting = cell.dataset.setting;
      const value = cell.dataset.value;
      
      let isCurrentValue = false;
      
      if (setting === 'display.theme') {
        const themeValue = this.overlay.querySelector('#mobile-theme-value')?.textContent.toLowerCase();
        isCurrentValue = (value === 'dark' && themeValue === 'dark') || 
                        (value === 'light' && themeValue === 'light');
      } else if (setting === 'photos.transitionTime') {
        const transitionValue = this.overlay.querySelector('#mobile-photo-transition-value')?.textContent;
        const currentSeconds = this.parseTransitionTime(transitionValue);
        isCurrentValue = parseInt(value) === currentSeconds;
      } else if (setting === 'photos.source') {
        const albumValue = this.overlay.querySelector('#mobile-photo-album-value')?.textContent;
        const albumMap = {
          'Recent Photos': 'recent',
          'Family Album': 'family',
          'Vacation 2024': 'vacation'
        };
        isCurrentValue = value === albumMap[albumValue];
      }
      
      if (isCurrentValue) {
        cell.classList.add('selected');
      } else {
        cell.classList.remove('selected');
      }
    });
  }

  parseTransitionTime(timeStr) {
    if (!timeStr) return 5;
    if (timeStr.includes('sec')) return parseInt(timeStr);
    if (timeStr.includes('min')) return parseInt(timeStr) * 60;
    if (timeStr.includes('hour')) return parseInt(timeStr) * 3600;
    return 5;
  }

  navigateToScreen(screenId) {
    const currentScreen = this.overlay.querySelector('.settings-screen.active');
    const nextScreen = this.overlay.querySelector(`[data-screen="${screenId}"]`);
    
    if (!nextScreen) {
      console.error(`📱 Screen not found: ${screenId}`);
      return;
    }
    
    this.navigationStack.push(screenId);
    
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
    
    currentScreen.classList.remove('active');
    currentScreen.classList.add('sliding-out-right');
    
    previousScreen.classList.add('sliding-in-left', 'active');
    
    setTimeout(() => {
      currentScreen.classList.remove('sliding-out-right');
      previousScreen.classList.remove('sliding-in-left');
      
      this.highlightCurrentSelections();
    }, 300);
    
    this.updateMobileNavBar();
  }

  navigateDirectToScreen(targetScreenId) {
    const currentScreen = this.overlay.querySelector('.settings-screen.active');
    const targetScreen = this.overlay.querySelector(`[data-screen="${targetScreenId}"]`);
    
    if (!targetScreen) {
      console.error(`📱 Target screen not found: ${targetScreenId}`);
      return;
    }
    
    console.log(`📱 Navigating directly to: ${targetScreenId}`);
    
    // Reset stack to include only root and target
    this.navigationStack = ['root', targetScreenId];
    
    // Animate transition
    currentScreen.classList.remove('active');
    currentScreen.classList.add('sliding-out-right');
    
    targetScreen.classList.add('sliding-in-left', 'active');
    
    setTimeout(() => {
      currentScreen.classList.remove('sliding-out-right');
      targetScreen.classList.remove('sliding-in-left');
      
      this.highlightCurrentSelections();
    }, 300);
    
    this.updateMobileNavBar();
  }

  updateMobileNavBar() {
    const currentScreenId = this.navigationStack[this.navigationStack.length - 1];
    const currentScreen = this.overlay.querySelector(`[data-screen="${currentScreenId}"]`);
    
    if (!currentScreen) return;
    
    const title = currentScreen.dataset.title || 'Settings';
    const navTitle = this.overlay.querySelector('.nav-title');
    if (navTitle) {
      navTitle.textContent = title;
    }
    
    const backBtn = this.overlay.querySelector('.nav-back-button');
    if (backBtn) {
      if (this.navigationStack.length > 1) {
        backBtn.style.visibility = 'visible';
        
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
    applyTheme(this.overlay, theme);
    
    if (this.controller) {
      this.controller.setSetting('display.theme', theme);
      this.applyThemeToMainDashboard(theme);
    }
    
    console.log(`⚙️ Theme changed and saved: ${theme}`);
  }

  handleSettingChange(path, value) {
    if (path === 'system.autoRedirect' || path === 'system.debugMode') {
      value = value === 'true';
    }
    
    if (this.controller) {
      const success = this.controller.setSetting(path, value);
      if (success) {
        console.log(`⚙️ ✅ Setting auto-saved: ${path} = ${value}`);
        this.showSaveNotification();
        this.notifySettingChanged(path, value);
      } else {
        console.warn(`⚙️ ⚠️ Failed to auto-save ${path} = ${value}`);
      }
    }
  }

  showSaveNotification() {
    let notification = document.querySelector('.settings-save-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.className = 'settings-save-notification';
      notification.textContent = 'Saved';
      document.body.appendChild(notification);
    }
    
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 2000);
  }

  handleCancel() {
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
    window.dispatchEvent(new CustomEvent('dashie-settings-changed', {
      detail: { [path]: value }
    }));
    
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
      
      const mobileHeaderName = document.querySelector('.mobile-header .family-name');
      if (mobileHeaderName) {
        mobileHeaderName.textContent = value || 'Dashie';
        console.log('📱 Updated mobile header family name:', value);
      }
      
      window.dispatchEvent(new CustomEvent('dashie-mobile-family-name-changed', {
        detail: { familyName: value }
      }));
    }
  }

  sendFamilyNameToWidget(widgetWindow) {
    if (!this.controller) {
      console.warn('👨‍👩‍👧‍👦 ⚠️ No controller available to get family name');
      this.sendFallbackFamilyName(widgetWindow);
      return;
    }

    try {
      let familyName = this.controller.getSetting('family.familyName');
      
      if (!familyName) {
        console.log('👨‍👩‍👧‍👦 ⚠️ No family name in controller, trying to refresh...');
        
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

  sendFallbackFamilyName(widgetWindow) {
    let fallbackName = 'Dashie';
    
    try {
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