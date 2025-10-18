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
      logger.info('Initializing Modals module...');

      // Initialize submodules
      modalsStateManager.initialize();
      modalsUIRenderer.initialize();

      this.isInitialized = true;

      logger.success('Modals module initialized');
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
    return modalsInputHandler.handleAction('up');
  }

  /**
   * Handle down arrow input
   * @returns {boolean} - True if action was handled
   */
  handleDown() {
    return modalsInputHandler.handleAction('down');
  }

  /**
   * Handle left arrow input
   * @returns {boolean} - True if action was handled
   */
  handleLeft() {
    return modalsInputHandler.handleAction('left');
  }

  /**
   * Handle right arrow input
   * @returns {boolean} - True if action was handled
   */
  handleRight() {
    return modalsInputHandler.handleAction('right');
  }

  /**
   * Handle enter key input
   * @returns {boolean} - True if action was handled
   */
  handleEnter() {
    return modalsInputHandler.handleAction('enter');
  }

  /**
   * Handle escape key input
   * @returns {boolean} - True if action was handled
   */
  handleEscape() {
    return modalsInputHandler.handleAction('escape');
  }

  /**
   * Check if a modal is currently open
   */
  isModalOpen() {
    return modalsStateManager.isModalOpen();
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
