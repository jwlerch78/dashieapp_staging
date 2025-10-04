// js/settings/settings-simple-manager.js - Auto-save implementation
// CHANGE SUMMARY: Consolidated selection logic into SettingsSelectionHandler - removed duplicate methods, uses shared handlers
// LATEST: Removed updateMobileNavBar() and getCurrentScreenId() - now using shared methods, fixed theme/toast issues

import { SimplifiedNavigation } from './settings-d-pad-nav.js';
import { setupEventHandlers } from './settings-event-handler.js';
import { createModalNavigation } from '../utils/modal-navigation-manager.js';
import { getPlatformDetector } from '../utils/platform-detector.js';
import { TimeSelectionHandler } from './time-selection-handler.js';
import { SettingsSelectionHandler } from './settings-selection-handler.js';
import { buildSettingsUI, populateFormFields, populateSystemStatus } from './settings-ui-builder.js';
import { initializeUploadHandlers } from '../../widgets/photos/settings-photos.js';



export class SimplifiedSettings {
  constructor() {
    this.isVisible = false;
    this.overlay = null;
    this.navigation = null;
    this.controller = null;
    this.keydownHandler = null;
    this.modalNavigation = null;
    // Create shared handlers for consistent behavior
    this.timeHandler = new TimeSelectionHandler();
    this.selectionHandler = new SettingsSelectionHandler(this.timeHandler);
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
        this.controllerReady = true;
        this.processPendingWidgetRequests();
      } else {
        console.warn('⚙️ ⚠️ Settings controller initialization returned false');
        
        if (this.initializationAttempts < this.maxInitAttempts) {
          const delay = Math.min(1000 * this.initializationAttempts, 5000);
          console.log(`⚙️ Retrying in ${delay}ms...`);
          setTimeout(() => this.initializeController(), delay);
        } else {
          console.error('⚙️ ❌ Settings controller failed to initialize after max attempts');
        }
      }
      
    } catch (error) {
      console.error('⚙️ ❌ Settings controller initialization error:', error);
      
      if (this.initializationAttempts < this.maxInitAttempts) {
        const delay = Math.min(1000 * this.initializationAttempts, 5000);
        console.log(`⚙️ Retrying in ${delay}ms...`);
        setTimeout(() => this.initializeController(), delay);
      } else {
        console.error('⚙️ ❌ Settings controller failed after max retry attempts');
      }
    }
  }

  processPendingWidgetRequests() {
    if (this.pendingWidgetRequests.length === 0) return;
    
    console.log(`👨‍👩‍👧‍👦 Processing ${this.pendingWidgetRequests.length} pending widget requests`);
    
    this.pendingWidgetRequests.forEach(request => {
      if (request.type === 'family-name-request') {
        this.sendFamilyNameToWidget(request.source);
      }
    });
    
    this.pendingWidgetRequests = [];
  }

  sendFamilyNameToWidget(targetWindow) {
    const familyName = this.controller.getSetting('family.name');
    console.log(`👨‍👩‍👧‍👦 Sending family name to widget: "${familyName}"`);
    
    targetWindow.postMessage({
      type: 'family-name-response',
      familyName: familyName || ''
    }, '*');
  }

  checkAuthStatus() {
    if (!window.jwtAuth) {
      return { ready: false, reason: 'JWT auth service not available' };
    }
    
    const hasSettings = window.jwtAuth.hasSettings && window.jwtAuth.hasSettings();
    
    return {
      ready: hasSettings,
      reason: hasSettings ? 'Settings available' : 'No settings loaded yet'
    };
  }

  async show() {
    if (this.isVisible) {
      console.log('⚙️ Settings already visible');
      return;
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
    
    console.log(`⚙️ Initializing ${isMobile ? 'touch' : 'D-pad'} navigation with shared handlers`);
    this.navigation = new SimplifiedNavigation(this.overlay, {
      onThemeChange: (theme) => this.handleThemeChange(theme),
      onSettingChange: (path, value) => this.handleSettingChange(path, value),
      onCancel: () => this.handleCancel()
    }, this.timeHandler, this.selectionHandler);
    
    this.navigationStack = ['root'];
    
    if (isMobile) {
      console.log('⚙️ 📱 Adding touch handlers for mobile');
      this.setupTouchHandlers();
    } else {
      console.log('⚙️ 🖥️ Desktop mode - adding touch handlers AND registering with modal navigation');
      // Desktop/TV gets BOTH touch handlers (for touchscreen) AND D-pad navigation
      this.setupTouchHandlers();
      
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
    // Navigation cells (cells with chevrons)
    this.overlay.addEventListener('click', (e) => {
      const cell = e.target.closest('.settings-cell[data-navigate]');
      if (cell) {
        const targetScreen = cell.dataset.navigate;
        console.log(`📱 Navigating to: ${targetScreen}`);
        this.navigateToScreen(targetScreen);

            // Populate system status if navigating to that screen
        if (targetScreen === 'system-status') {
          setTimeout(() => {
            populateSystemStatus(this.overlay);
          }, 350);
        }

        if (targetScreen === 'add-photos') {
          setTimeout(() => {
            initializeUploadHandlers(this.overlay);
          }, 350);
        }

        // ALSO initialize handlers when navigating to select-upload-album
        if (targetScreen === 'select-upload-album') {
          setTimeout(() => {
            initializeUploadHandlers(this.overlay);
          }, 350);
        }
        
        setTimeout(() => {
          this.selectionHandler.highlightCurrentSelections(this.overlay, this.getCurrentScreenId());
        }, 350);
      }
    });
    
    // Back button
    const backBtn = this.overlay.querySelector('.nav-back-button');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        const isRootScreen = this.navigationStack[this.navigationStack.length - 1] === 'root';
        
        if (isRootScreen) {
          console.log('📱 Back button on root - closing settings');
          this.handleCancel();
        } else {
          console.log('📱 Back button clicked - navigating back');
          this.navigateBack();
        }
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
              this.selectionHandler.highlightCurrentSelections(this.overlay, this.getCurrentScreenId());
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
            this.selectionHandler.updateParentDisplayValue(action.setting, action.value, this.overlay);
            
            // Navigate directly back to Display screen
            setTimeout(() => {
              this.navigateDirectToScreen('display');
            }, 300);
            break;
            
          case 'not-time-selection':
            this.selectionHandler.handleRegularSelection(selectableCell, this.overlay, (setting, value) => {
              this.handleSettingChange(setting, value);
            });
            break;
            
          case 'error':
            console.error('📱 Time selection error:', action.message);
            break;
        }
      } else {
        this.selectionHandler.handleRegularSelection(selectableCell, this.overlay, (setting, value) => {
          this.handleSettingChange(setting, value);
        });
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
    this.selectionHandler.updateNavBar(this.overlay, this.getCurrentScreenId(), this.navigationStack);
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
    
    this.selectionHandler.updateNavBar(this.overlay, this.getCurrentScreenId(), this.navigationStack);
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
      
      this.selectionHandler.highlightCurrentSelections(this.overlay, this.getCurrentScreenId());
    }, 300);
    
    this.selectionHandler.updateNavBar(this.overlay, this.getCurrentScreenId(), this.navigationStack);
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
      
      this.selectionHandler.highlightCurrentSelections(this.overlay, this.getCurrentScreenId());
    }, 300);
    
    this.selectionHandler.updateNavBar(this.overlay, this.getCurrentScreenId(), this.navigationStack);
  }

  getCurrentScreenId() {
    return this.selectionHandler.getCurrentScreenId(this.navigationStack);
  }

  async loadCurrentSettings() {
    if (!this.controller) {
      console.warn('⚙️ Controller not ready, using defaults');
      return;
    }

    try {
      const settings = this.controller.getSettings();
      console.log('⚙️ Loading current settings into UI:', settings);
      
      populateFormFields(this.overlay, settings);
      
      const theme = settings.display?.theme || 'dark';
      // Apply theme to document body, not overlay
      if (theme === 'dark') {
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
      } else {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
      }
      
    } catch (error) {
      console.error('⚙️ Error loading settings:', error);
    }
  }

  handleThemeChange(theme) {
    console.log(`⚙️ Theme changed to: ${theme}`);
    this.handleSettingChange('display.theme', theme);
    
    // Apply theme to document body
    if (theme === 'dark') {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    }
  }

  handleSettingChange(path, value) {
    console.log(`⚙️ Setting changed: ${path} = ${value}`);
    
    if (!this.controller) {
      console.warn('⚙️ Controller not ready, cannot save setting');
      return;
    }

    this.controller.setSetting(path, value);
    this.controller.saveSettings();
    
    // Show save confirmation toast
    this.showSaveToast();
  }

  showSaveToast() {
    // Create or reuse toast element
    let toast = document.getElementById('settings-save-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'settings-save-toast';
      toast.className = 'settings-save-notification';
      toast.textContent = 'Settings saved';
      document.body.appendChild(toast);
    }
    
    // Show toast
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // Hide toast after 2 seconds
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  handleCancel() {
    console.log('⚙️ Settings cancelled');
    this.hide();
  }

  showOverlay() {
    requestAnimationFrame(() => {
      this.overlay.classList.add('active');
      this.isVisible = true;
    });
  }

  hide() {
    if (!this.isVisible) return;

    this.overlay.classList.remove('active');
    
    setTimeout(() => {
      if (this.modalNavigation) {
        this.modalNavigation.destroy();
        this.modalNavigation = null;
      }
      
      if (this.navigation) {
        this.navigation.destroy();
        this.navigation = null;
      }
      
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      
      this.overlay = null;
      this.isVisible = false;
      this.navigationStack = [];
      
      console.log('⚙️ Settings hidden and cleaned up');
    }, 300);
  }
}

// Export as default for backward compatibility
export default SimplifiedSettings;