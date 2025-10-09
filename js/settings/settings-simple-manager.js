// js/settings/settings-simple-manager.js - Auto-save implementation
// Version: 1.1 | Last Updated: 2025-01-09 20:45 EST
// CHANGE SUMMARY: Added account deletion handlers and modal management

import { SimplifiedNavigation } from './settings-d-pad-nav.js';
import { setupEventHandlers } from './settings-event-handler.js';
import { createModalNavigation } from '../utils/modal-navigation-manager.js';
import { getPlatformDetector } from '../utils/platform-detector.js';
import { TimeSelectionHandler } from './time-selection-handler.js';
import { SettingsSelectionHandler } from './settings-selection-handler.js';
import { buildSettingsUI, populateFormFields, populateSystemStatus } from './settings-ui-builder.js';
import { handleScreenEnter, handleScreenExit, handleSettingsCleanup } from './settings-screen-helpers.js';
import { setupFeatureToggles } from './settings-features-controller.js';
import { AccountDeletionService } from '../services/account-deletion-service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('SimplifiedSettings');


export class SimplifiedSettings {
  constructor() {
    this.isVisible = false;
    this.overlay = null;
    this.navigation = null;
    this.controller = null;
    this.keydownHandler = null;
    this.modalNavigation = null;
    this.timeHandler = new TimeSelectionHandler();
    this.selectionHandler = new SettingsSelectionHandler(this.timeHandler);
    this.initializationAttempts = 0;
    this.maxInitAttempts = 20;
    this.navigationStack = [];
    
    this.pendingWidgetRequests = [];
    this.controllerReady = false;
    this.accountDeletionService = new AccountDeletionService();
    
    setTimeout(() => this.initializeController(), 200);
    
    // Initialize account deletion handlers
    this.initializeAccountDeletionHandlers();

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'request-family-name') {
        logger.debug('Widget requesting family name', { widget: event.data.widget });
        
        if (this.controllerReady && this.controller) {
          this.sendFamilyNameToWidget(event.source);
        } else {
          logger.debug('Controller not ready, queuing family name request');
          this.pendingWidgetRequests.push({
            type: 'family-name-request',
            source: event.source,
            widget: event.data.widget,
            timestamp: Date.now()
          });
        }
      }
      
      if (event.data?.type === 'update-setting') {
        const { setting, value } = event.data;
        logger.debug('Received setting update from photos modal', { setting, value });
        this.handleSettingChange(setting, value);
      }
    });
  }

  async initializeController() {
    try {
      this.initializationAttempts++;
      logger.debug('Settings initialization attempt', { attempt: this.initializationAttempts, max: this.maxInitAttempts });
      
      const authStatus = this.checkAuthStatus();
      logger.debug('Auth status check', authStatus);
      
      const { SettingsController } = await import('./settings-controller.js');
      this.controller = new SettingsController();
      
      const initSuccess = await this.controller.init();
      
      if (initSuccess) {
        logger.info('Settings controller ready');
        this.controllerReady = true;
        this.processPendingWidgetRequests();
      } else {
        logger.warn('Settings controller initialization returned false');
        
        if (this.initializationAttempts < this.maxInitAttempts) {
          const delay = Math.min(1000 * this.initializationAttempts, 5000);
          logger.debug('Retrying settings initialization', { delayMs: delay });
          setTimeout(() => this.initializeController(), delay);
        } else {
          logger.error('Max initialization attempts reached');
        }
      }
    } catch (error) {
      logger.error('Settings initialization error', error);
      
      if (this.initializationAttempts < this.maxInitAttempts) {
        const delay = Math.min(1000 * this.initializationAttempts, 5000);
        setTimeout(() => this.initializeController(), delay);
      }
    }
  }

  checkAuthStatus() {
    const hasAuth = !!window.dashieAuth;
    const hasJwt = !!window.jwtAuth;
    const jwtReady = window.jwtAuth?.isServiceReady();
    
    return {
      hasAuth,
      hasJwt,
      jwtReady,
      status: jwtReady ? 'ready' : hasJwt ? 'initializing' : 'unavailable'
    };
  }

  processPendingWidgetRequests() {
    if (this.pendingWidgetRequests.length === 0) return;
    
    logger.debug('Processing pending widget requests', { count: this.pendingWidgetRequests.length });
    
    this.pendingWidgetRequests.forEach(request => {
      if (request.type === 'family-name-request') {
        this.sendFamilyNameToWidget(request.source);
      }
    });
    
    this.pendingWidgetRequests = [];
  }

  sendFamilyNameToWidget(targetWindow) {
    if (!this.controller) {
      logger.warn('Cannot send family name - controller not ready');
      return;
    }
    
    const familyName = this.controller.getSetting('family.familyName') || 'Dashie';
    logger.debug('Sending family name to widget', { familyName });
    
    try {
      targetWindow.postMessage({
        type: 'family-name-response',
        familyName: familyName
      }, '*');
    } catch (error) {
      logger.error('Failed to send family name to widget', error);
    }
  }

  async show() {
    if (this.isVisible) {
      console.log('⚙️ Settings already visible');
      return;
    }

    if (!this.controller) {
      console.warn('⚙️ Settings controller not ready yet');
      return;
    }

    const platformDetector = getPlatformDetector();
    const isMobile = platformDetector.isMobile();
    
    console.log(`⚙️ Opening settings for platform: ${isMobile ? 'mobile' : 'desktop/TV'}`);
    
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.innerHTML = buildSettingsUI(isMobile);
    document.body.appendChild(this.overlay);

    // Load calendar settings CSS
    const calendarCSS = document.createElement('link');
    calendarCSS.rel = 'stylesheet';
    calendarCSS.href = 'widgets/dcal/dcal-settings/dcal-settings.css';
    document.head.appendChild(calendarCSS);
    console.log('⚙️ Calendar settings CSS loaded');

    
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
      this.setupTouchHandlers();
      
      this.modalNavigation = createModalNavigation(this.overlay, [], {
        onEscape: () => this.handleCancel(),
        customHandler: (action) => {
          // CRITICAL: Check if another modal is on top of settings
          if (window.dashieModalManager.modalStack.length > 1) {
            console.log('⚙️ 🔧 Another modal is active on top of settings, letting it handle');
            console.log('⚙️ 🔧 Modal stack depth:', window.dashieModalManager.modalStack.length);
            return false; // Explicitly return false so modal can handle it
          }
          
          console.log('⚙️ 🔧 CustomHandler called with action:', action);
          console.log('⚙️ 🔧 this.navigation exists?', !!this.navigation);
          
          const actionToKeyMap = {
            'up': 'ArrowUp',
            'down': 'ArrowDown',
            'left': 'ArrowLeft',
            'right': 'ArrowRight',
            'enter': 'Enter',
            'escape': 'Escape'
          };
          
          const key = actionToKeyMap[action];
          if (!key) {
            console.log('⚙️ 🔧 No key mapping for action:', action);
            return false;
          }
          
          if (!this.navigation) {
            console.error('⚙️ ❌ this.navigation is null! Cannot handle action:', action);
            // Fallback: if escape and navigation not ready, just close
            if (action === 'escape') {
              console.log('⚙️ 🔧 Fallback: calling handleCancel directly');
              this.handleCancel();
              return true;
            }
            return false;
          }
          
          const syntheticEvent = {
            key: key,
            preventDefault: () => {},
            stopPropagation: () => {},
            stopImmediatePropagation: () => {}
          };
          
          console.log('⚙️ 🔧 Calling this.navigation.handleKeyPress with key:', key);
          const result = this.navigation.handleKeyPress(syntheticEvent);
          console.log('⚙️ 🔧 handleKeyPress returned:', result);
          
          return result;
        }
      });
    }
    
    setupFeatureToggles(this.overlay);

    this.showOverlay();
    console.log('⚙️ Settings displayed');
  }

  setupTouchHandlers() {
    this.overlay.addEventListener('click', (e) => {
      const cell = e.target.closest('.settings-cell[data-navigate]');
      if (cell && !cell.classList.contains('action-cell')) {
        const targetScreen = cell.dataset.navigate;
        console.log(`📱 Navigating to: ${targetScreen}`);
        this.navigateToScreen(targetScreen);
        
        if (targetScreen === 'system-status') {
          setTimeout(() => {
            populateSystemStatus(this.overlay);
          }, 350);
        }
        
        setTimeout(() => {
          this.selectionHandler.highlightCurrentSelections(this.overlay, this.getCurrentScreenId());
        }, 350);
      }
    });
    
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
    
    this.overlay.addEventListener('click', (e) => {
      const selectableCell = e.target.closest('.settings-cell.selectable');
      if (!selectableCell) return;

      // Handle Delete Account screen actions
      const action = selectableCell.dataset.action;
      if (action === 'cancel') {
        console.log('🗑️ Cancel delete account - navigating back');
        this.navigateBack();
        return;
      } else if (action === 'confirm') {
        console.log('🗑️ Confirm delete account - showing modal');
        this.showDeleteAccountModal();
        return;
      }

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
    
    // Add keydown handler for Delete Account screen actions (d-pad support)
    this.overlay.addEventListener('keydown', (e) => {
      const selectableCell = e.target.closest('.settings-cell.selectable');
      if (!selectableCell) return;
      
      // Only handle Enter key
      if (e.key === 'Enter' || e.keyCode === 13) {
        const action = selectableCell.dataset.action;
        if (action === 'cancel') {
          e.preventDefault();
          console.log('🗑️ Cancel delete account (Enter key) - navigating back');
          this.navigateBack();
          return;
        } else if (action === 'confirm') {
          e.preventDefault();
          console.log('🗑️ Confirm delete account (Enter key) - showing modal');
          this.showDeleteAccountModal();
          return;
        }
      }
    });
    
    this.overlay.addEventListener('change', (e) => {
      if (e.target.matches('.form-control')) {
        const setting = e.target.dataset.setting;
        const value = e.target.value;
        console.log(`📱 Setting changed: ${setting} = ${value}`);
        this.handleSettingChange(setting, value);
      }
    });
    
    this.overlay.addEventListener('click', (e) => {
      const photosBtn = e.target.closest('#photos-menu-btn');
      if (photosBtn) {
        console.log('📸 Photos menu clicked - opening photos settings modal');
        
        if (window.photosSettingsManager) {
          window.photosSettingsManager.open();
        } else {
          console.error('📸 PhotosSettingsManager not available');
          alert('Photo settings not available yet. Please wait a moment and try again.');
        }
      }
    });

    this.navigationStack = ['root'];
    this.selectionHandler.updateNavBar(this.overlay, this.getCurrentScreenId(), this.navigationStack);
  }

  /**
   * Initialize account deletion handlers
   * Note: Selectable cells are handled by setupTouchHandlers()
   * This only handles modal button clicks
   */
  initializeAccountDeletionHandlers() {
    console.log('🗑️ 🔍 Initializing account deletion handlers on document');
    
    // Use event delegation on document for modal buttons
    document.addEventListener('click', (e) => {
      console.log('🗑️ 🔍 Document click detected:', {
        target: e.target?.id || e.target?.className,
        tagName: e.target?.tagName
      });
      
      // Cancel deletion in modal
      const cancelTarget = e.target.closest('#cancel-delete-account');
      if (cancelTarget) {
        console.log('🗑️ ✅ CANCEL BUTTON CLICKED - Handler fired!');
        console.log('🗑️ 🔍 Cancel element:', cancelTarget);
        this.hideDeleteAccountModal();
        return;
      }
      
      // Confirm deletion in modal
      const confirmTarget = e.target.closest('#confirm-delete-account');
      if (confirmTarget) {
        console.log('🗑️ ✅ CONFIRM BUTTON CLICKED - Handler fired!');
        console.log('🗑️ 🔍 Confirm element:', confirmTarget);
        this.handleDeleteAccountConfirm();
        return;
      }
    }, true); // Use capture phase to ensure we catch it first
    
    console.log('🗑️ 🔍 Account deletion click handlers registered on document');
  }

  /**
   * Show delete account confirmation modal
   */
  showDeleteAccountModal() {
    const modal = document.getElementById('delete-account-modal');
    if (modal) {
      modal.style.display = 'flex';
      console.log('🗑️ Delete account modal displayed');
      
      // DEBUG: Verify buttons exist in DOM
      const cancelBtn = document.getElementById('cancel-delete-account');
      const confirmBtn = document.getElementById('confirm-delete-account');
      console.log('🗑️ 🔍 Button verification:', {
        cancelExists: !!cancelBtn,
        confirmExists: !!confirmBtn,
        cancelId: cancelBtn?.id,
        confirmId: confirmBtn?.id,
        cancelClickable: cancelBtn?.onclick !== undefined || cancelBtn?.click !== undefined,
        confirmClickable: confirmBtn?.onclick !== undefined || confirmBtn?.click !== undefined
      });
      
      // DEBUG: Test manual click
      console.log('🗑️ 🔍 Testing manual click on confirm button...');
      if (confirmBtn) {
        console.log('🗑️ 🔍 Confirm button element:', confirmBtn);
        console.log('🗑️ 🔍 Confirm button parent:', confirmBtn.parentElement?.className);
      }
      
      // Register modal with navigation system for d-pad support
      const buttons = ['cancel-delete-account', 'confirm-delete-account'];
      console.log('🗑️ 🔍 Registering modal with buttons:', buttons);
      
      this._deleteAccountModalNav = createModalNavigation(modal, buttons, {
        initialFocus: 0, // Focus "Cancel" button first
        horizontalNavigation: true, // Buttons are side-by-side, use left/right
        onEscape: () => this.hideDeleteAccountModal()
      });
      
      console.log('🗑️ Delete account modal navigation registered');
      console.log('🗑️ 🔍 Modal manager state:', window.dashieModalManager?.getDebugInfo());
      
      // Auto-focus first button after render
      setTimeout(() => {
        const btn = document.getElementById('cancel-delete-account');
        if (btn) {
          btn.focus();
          console.log('🗑️ Auto-focused cancel button');
          console.log('🗑️ 🔍 Focused element:', document.activeElement?.id);
        } else {
          console.error('🗑️ ❌ Cancel button not found for auto-focus!');
        }
      }, 100);
    } else {
      console.error('🗑️ ❌ Modal element not found!');
    }
  }

  /**
   * Hide delete account confirmation modal
   */
  hideDeleteAccountModal() {
    const modal = document.getElementById('delete-account-modal');
    if (modal) {
      modal.style.display = 'none';
      console.log('🗑️ Delete account modal hidden');
      
      // Cleanup modal navigation
      if (this._deleteAccountModalNav) {
        this._deleteAccountModalNav.destroy();
        this._deleteAccountModalNav = null;
        console.log('🗑️ Delete account modal navigation destroyed');
      }
    }
  }

  /**
   * Handle account deletion confirmation
   */
  async handleDeleteAccountConfirm() {
    console.log('🗑️ Starting account deletion process...');
    
    const confirmBtn = document.getElementById('confirm-delete-account');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting...';
    }
    
    try {
      // Delete account via service
      const result = await this.accountDeletionService.deleteAccount();
      
      console.log('🗑️ Account deletion completed:', result);
      
      // Hide modal
      this.hideDeleteAccountModal();
      
      // Close settings
      this.hide();
      
      // Sign out user
      console.log('🗑️ Signing out user...');
      if (window.dashieAuth) {
        await window.dashieAuth.signOut();
      } else {
        // Fallback: reload page to clear session
        window.location.reload();
      }
      
      console.log('🗑️ ✅ Account deletion process complete');
      
    } catch (error) {
      console.error('🗑️ ❌ Account deletion failed:', error);
      
      // Re-enable button
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete Account';
      }
      
      // Show error to user
      alert(`Failed to delete account: ${error.message}\n\nPlease try again or contact support if the problem persists.`);
    }
  }

  navigateToScreen(screenId) {
    const currentScreen = this.overlay.querySelector('.settings-screen.active');
    const currentScreenId = currentScreen?.dataset?.screen;
    
    // Save state when navigating away from special screens
    handleScreenExit(currentScreenId);

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
      
      // Handle screen-specific initialization (SHARED HELPER)
      handleScreenEnter(screenId, this.overlay, this.navigation);
    }, 300);
    
    this.selectionHandler.updateNavBar(this.overlay, this.getCurrentScreenId(), this.navigationStack);
  }

  navigateBack() {
    if (this.navigationStack.length <= 1) return;
    
    const currentScreen = this.overlay.querySelector('.settings-screen.active');
    const currentScreenId = currentScreen?.dataset?.screen;
  
    // Save state when navigating away from special screens
    handleScreenExit(currentScreenId);

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
    
    this.navigationStack = ['root', targetScreenId];
    
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
      console.log('⚙️ Family settings:', settings.family); // DEBUG
      
      populateFormFields(this.overlay, settings);
      
      const theme = settings.display?.theme || 'dark';
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

    this.showSaveToast();

    window.dispatchEvent(new CustomEvent('settingsUpdated', {
      detail: { 
        settings: this.controller.getSettings(),
        changedPath: path,
        changedValue: value
      }
    }));
  }

  showSaveToast() {
    let toast = document.getElementById('settings-save-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'settings-save-toast';
      toast.className = 'settings-save-notification';
      toast.textContent = 'Settings saved';
      document.body.appendChild(toast);
    }
    
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
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
      // FIXED: Cleanup calendar settings manager
      if (window.calendarSettingsManager) {
        console.log('📅 Cleaning up CalendarSettingsManager');
        window.calendarSettingsManager.destroy();
        window.calendarSettingsManager = null;
      }
      
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

export default SimplifiedSettings;