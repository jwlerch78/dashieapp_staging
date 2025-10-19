// js/modules/Modals/modals.js
// Modals Module - Public API for sleep overlay and exit/logout confirmations
// Based on legacy js/ui/modals.js with modular architecture

import { createLogger } from '../../utils/logger.js';
import AppComms from '../../core/app-comms.js';
import modalsStateManager from './modals-state-manager.js';
import modalsUIRenderer from './modals-ui-renderer.js';
import modalsInputHandler from './modals-input-handler.js';

const logger = createLogger('Modals');

/**
 * Modals Module - Manages sleep overlay and confirmation dialogs
 *
 * Public API:
 * - initialize() - One-time setup
 * - showSleep() - Enter sleep mode (black overlay)
 * - showExitConfirmation() - Show exit/logout modal
 * - hide() - Hide current modal
 * - handleInput(action) - Process input events
 */
class Modals {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize Modals module
   */
  async initialize() {
    try {
      logger.verbose('Initializing Modals module...');

      // Initialize submodules
      modalsStateManager.initialize();
      modalsUIRenderer.initialize();

      this.isInitialized = true;

      logger.verbose('Modals module initialized');
      AppComms.publish('module:initialized', { module: 'modals' });

      return true;
    } catch (error) {
      logger.error('Failed to initialize Modals module', error);
      return false;
    }
  }

  /**
   * Show sleep overlay (blank black screen)
   * Wake up with any key or click
   */
  showSleep() {
    if (!this.isInitialized) {
      logger.error('Cannot show sleep - Modals not initialized');
      return;
    }

    logger.info('Showing sleep overlay');

    // Update state
    modalsStateManager.openSleep();

    // Show UI
    const overlay = modalsUIRenderer.showSleepOverlay();

    // Enable input handling
    modalsInputHandler.enable(
      () => this.hideSleep(),  // Any key wakes up
      () => this.hideSleep()   // Escape also wakes up
    );

    // Add click listener to wake up
    overlay.addEventListener('click', () => this.hideSleep());

    // Add keydown listener to wake up
    overlay.addEventListener('keydown', (e) => {
      e.preventDefault();
      this.hideSleep();
    });

    // Focus the overlay so it receives keyboard events
    overlay.focus();

    AppComms.publish(AppComms.events.SLEEP_MODE_CHANGED, { isAsleep: true });
  }

  /**
   * Hide sleep overlay
   */
  hideSleep() {
    logger.info('Hiding sleep overlay');

    modalsStateManager.close();
    modalsUIRenderer.hideSleepOverlay();
    modalsInputHandler.disable();

    AppComms.publish(AppComms.events.SLEEP_MODE_CHANGED, { isAsleep: false });
  }

  /**
   * Show exit confirmation modal
   * Shows logout option if user is authenticated
   */
  showExitConfirmation() {
    if (!this.isInitialized) {
      logger.error('Cannot show exit confirmation - Modals not initialized');
      return;
    }

    logger.info('Showing exit confirmation');

    // Check authentication status
    const isAuthenticated = window.sessionManager?.isUserAuthenticated() || false;
    const user = isAuthenticated ? window.sessionManager?.getUser() : null;

    // Update state
    modalsStateManager.openExit(isAuthenticated, user);

    // Show UI
    const { backdrop } = modalsUIRenderer.showExitModal(isAuthenticated, user);

    // Update initial highlight
    modalsUIRenderer.updateExitHighlight(modalsStateManager.getSelectedOption());

    // Enable input handling
    modalsInputHandler.enable(
      (action) => this.handleExitAction(action),  // Confirm callback
      () => this.hideExitConfirmation()            // Cancel callback
    );

    // Add click listener to backdrop (cancel on backdrop click)
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.hideExitConfirmation();
      }
    });

    // Add click listeners to options
    const options = backdrop.querySelectorAll('[data-action]');
    options.forEach(option => {
      option.addEventListener('click', () => {
        const action = option.getAttribute('data-action');
        this.handleExitAction(action);
      });
    });

    AppComms.publish('modal:opened', { type: 'exit', isAuthenticated });
  }

  /**
   * Handle exit modal action selection
   * @param {string} action - Selected action (logout, exit, cancel, yes, no)
   */
  handleExitAction(action) {
    logger.info('Exit action selected', { action });

    const isAuthenticated = modalsStateManager.getState().isAuthenticated;

    if (isAuthenticated) {
      switch (action) {
        case 'logout':
          this.handleLogout();
          break;
        case 'exit':
          this.handleExit();
          break;
        case 'cancel':
          this.hideExitConfirmation();
          break;
      }
    } else {
      switch (action) {
        case 'yes':
          this.handleExit();
          break;
        case 'no':
          this.hideExitConfirmation();
          break;
      }
    }
  }

  /**
   * Handle logout action
   */
  async handleLogout() {
    logger.info('Logging out');

    this.hideExitConfirmation();

    // Call session manager to sign out
    if (window.sessionManager) {
      await window.sessionManager.signOut();

      // Reload page to return to login screen
      logger.info('Reloading page to show login screen');
      window.location.reload();
    } else {
      logger.error('SessionManager not available for logout');
    }

    AppComms.publish('user:logout', {});
  }

  /**
   * Handle exit app action
   */
  handleExit() {
    logger.info('Exiting app');

    this.hideExitConfirmation();

    // Call session manager to exit app
    if (window.sessionManager?.exitApp) {
      window.sessionManager.exitApp();
    } else {
      // Fallback for web - just show a message
      logger.warn('Exit not implemented for web platform');
      alert('Exiting Dashie...');
    }

    AppComms.publish('app:exit', {});
  }

  /**
   * Hide exit confirmation modal
   */
  hideExitConfirmation() {
    logger.info('Hiding exit confirmation');

    modalsStateManager.close();
    modalsUIRenderer.hideExitModal();
    modalsInputHandler.disable();

    AppComms.publish('modal:closed', { type: 'exit' });
  }

  /**
   * Show generic confirmation modal
   * @param {object} config - Confirmation configuration
   * @param {string} config.title - Modal title
   * @param {string} config.message - Modal message
   * @param {function} config.onConfirm - Callback when user confirms
   * @param {function} config.onCancel - Optional callback when user cancels
   * @param {string} config.confirmLabel - Confirm button label (default: "Confirm")
   * @param {string} config.cancelLabel - Cancel button label (default: "Cancel")
   * @param {string} config.confirmStyle - 'default' or 'destructive' (default: 'default')
   */
  showConfirmation(config) {
    if (!this.isInitialized) {
      logger.error('Cannot show confirmation - Modals not initialized');
      return;
    }

    if (!config || !config.onConfirm) {
      logger.error('Cannot show confirmation - onConfirm callback required');
      return;
    }

    logger.info('Showing confirmation modal', { title: config.title });

    // Update state
    modalsStateManager.openConfirmation(config);

    // Show UI
    const { backdrop } = modalsUIRenderer.showConfirmationModal(
      modalsStateManager.getState().confirmationData
    );

    // Update initial highlight
    modalsUIRenderer.updateConfirmationHighlight(modalsStateManager.getSelectedOption());

    // Enable input handling
    modalsInputHandler.enable(
      (action) => this.handleConfirmationAction(action, config),
      () => this.handleConfirmationCancel(config)
    );

    // Add click listener to backdrop (cancel on backdrop click)
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.handleConfirmationCancel(config);
      }
    });

    // Add click listeners to buttons
    const buttons = backdrop.querySelectorAll('[data-action]');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action');
        this.handleConfirmationAction(action, config);
      });
    });

    // Register with modal manager for d-pad navigation
    // This ensures the confirmation modal is on top of the stack and receives inputs first
    if (window.dashieModalManager) {
      const buttonElements = Array.from(backdrop.querySelectorAll('[data-action]'));

      console.log('🟢 CONFIRMATION MODAL: Registering with dashieModalManager', {
        backdropId: backdrop.id,
        buttonCount: buttonElements.length,
        buttonIds: buttonElements.map(btn => btn.id)
      });

      window.dashieModalManager.registerModal(backdrop, {
        buttons: buttonElements.map(btn => ({
          id: btn.id,
          element: btn
        })),
        horizontalNavigation: true,
        initialFocus: 0, // Focus cancel button by default
        customHandler: (action) => {
          console.log('🟢 CONFIRMATION MODAL customHandler called', { action });
          logger.debug('Confirmation modal handling action from modal manager', { action });
          const handled = modalsInputHandler.handleAction(action);
          console.log('🟢 CONFIRMATION MODAL customHandler result', { action, handled });
          return handled;
        },
        onEscape: () => {
          console.log('🟢 CONFIRMATION MODAL: onEscape called');
          this.handleConfirmationCancel(config);
        }
      });

      console.log('🟢 CONFIRMATION MODAL: Successfully registered with dashieModalManager');
      logger.debug('Registered confirmation modal with modal manager');
    } else {
      console.log('🔴 CONFIRMATION MODAL: dashieModalManager STILL not available!');
      logger.error('dashieModalManager not available - d-pad navigation will not work');
    }

    AppComms.publish('modal:opened', { type: 'confirmation', title: config.title });
  }

  /**
   * Handle confirmation modal action
   * @param {string} action - 'confirm' or 'cancel'
   * @param {object} config - Original configuration with callbacks
   */
  handleConfirmationAction(action, config) {
    logger.info('Confirmation action selected', { action });

    this.hideConfirmation();

    if (action === 'confirm' && config.onConfirm) {
      config.onConfirm();
    } else if (action === 'cancel' && config.onCancel) {
      config.onCancel();
    }
  }

  /**
   * Handle confirmation modal cancel
   * @param {object} config - Original configuration with callbacks
   */
  handleConfirmationCancel(config) {
    logger.info('Confirmation cancelled');

    this.hideConfirmation();

    if (config.onCancel) {
      config.onCancel();
    }
  }

  /**
   * Hide confirmation modal
   */
  hideConfirmation() {
    logger.info('Hiding confirmation modal');

    // Unregister from modal manager
    if (window.dashieModalManager) {
      window.dashieModalManager.unregisterModal();
      logger.debug('Unregistered confirmation modal from modal manager');
    }

    modalsStateManager.close();
    modalsUIRenderer.hideConfirmationModal();
    modalsInputHandler.disable();

    AppComms.publish('modal:closed', { type: 'confirmation' });
  }

  /**
   * Handle input action
   * @param {string} action - Action name (up, down, left, right, enter, escape)
   * @returns {boolean} - True if action was handled
   */
  handleInput(action) {
    return modalsInputHandler.handleAction(action);
  }

  /**
   * Handle up arrow input
   * @returns {boolean} - True if action was handled
   */
  handleUp() {
    console.log('🟢 MODALS MODULE: handleUp() called');
    return modalsInputHandler.handleAction('up');
  }

  /**
   * Handle down arrow input
   * @returns {boolean} - True if action was handled
   */
  handleDown() {
    console.log('🟢 MODALS MODULE: handleDown() called');
    return modalsInputHandler.handleAction('down');
  }

  /**
   * Handle left arrow input
   * @returns {boolean} - True if action was handled
   */
  handleLeft() {
    console.log('🟢 MODALS MODULE: handleLeft() called');
    return modalsInputHandler.handleAction('left');
  }

  /**
   * Handle right arrow input
   * @returns {boolean} - True if action was handled
   */
  handleRight() {
    console.log('🟢 MODALS MODULE: handleRight() called');
    return modalsInputHandler.handleAction('right');
  }

  /**
   * Handle enter key input
   * @returns {boolean} - True if action was handled
   */
  handleEnter() {
    console.log('🟢 MODALS MODULE: handleEnter() called');
    return modalsInputHandler.handleAction('enter');
  }

  /**
   * Handle escape key input
   * @returns {boolean} - True if action was handled
   */
  handleEscape() {
    console.log('🟢 MODALS MODULE: handleEscape() called');
    return modalsInputHandler.handleAction('escape');
  }

  /**
   * Check if a modal is currently open
   */
  isModalOpen() {
    const isOpen = modalsStateManager.isModalOpen();
    const currentModal = modalsStateManager.getCurrentModal();
    console.log('🟢 MODALS: isModalOpen() called', { isOpen, currentModal });
    return isOpen;
  }

  /**
   * Get current modal type
   */
  getCurrentModal() {
    return modalsStateManager.getCurrentModal();
  }

  /**
   * Cleanup and destroy module
   */
  destroy() {
    logger.info('Destroying Modals module');

    modalsStateManager.close();
    modalsUIRenderer.cleanup();
    modalsInputHandler.disable();

    this.isInitialized = false;
  }
}

// Export singleton
const modals = new Modals();
export default modals;

// Expose globally for debugging and console access
if (typeof window !== 'undefined') {
  window.modals = modals;
}
