// js/modules/Dashboard/dashboard.js
// Dashboard module - Main view with 2x3 widget grid and sidebar navigation
// v1.0 - 10/16/25 - Initial implementation for Phase 2

import { createLogger } from '../../utils/logger.js';
import AppComms from '../../core/app-comms.js';
import DashboardStateManager from './dashboard-state-manager.js';
import DashboardInputHandler from './dashboard-input-handler.js';
import UIRenderer from './dashboard-ui-renderer.js';
import DashboardTimers from './dashboard-timers.js';

const logger = createLogger('Dashboard');

/**
 * Dashboard Module - Public API
 *
 * Implements the Standard Module Interface:
 * - initialize() - One-time setup
 * - activate() - Show module and enable input
 * - deactivate() - Hide module and disable input
 * - destroy() - Cleanup
 * - getState() - Get current state
 * - setState() - Update state
 *
 * Architecture:
 * - dashboard-state-manager.js: Dashboard state (grid position, menu state, etc.)
 * - dashboard-input-handler.js: Routes input actions to navigation-manager
 * - dashboard-navigation-manager.js: Grid + menu navigation logic
 * - dashboard-ui-renderer.js: DOM rendering and visual updates
 */
class Dashboard {
  constructor() {
    this.isInitialized = false;
    this.isActive = false;

    logger.info('Dashboard module created');
  }

  /**
   * Initialize Dashboard module
   * Sets up state management and UI
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      logger.info('Initializing Dashboard module...');

      // Initialize state manager
      await DashboardStateManager.initialize();
      logger.debug('State manager initialized');

      // Initialize UI renderer
      await UIRenderer.initialize();
      logger.debug('UI renderer initialized');

      // Initialize timer system
      DashboardTimers.initialize();
      logger.debug('Timer system initialized');

      this.isInitialized = true;

      logger.success('Dashboard module initialized');
      AppComms.publish('module:initialized', { module: 'dashboard' });

      return true;
    } catch (error) {
      logger.error('Failed to initialize Dashboard', error);
      return false;
    }
  }

  /**
   * Activate Dashboard module
   * Shows UI and enables input handling
   */
  activate() {
    if (!this.isInitialized) {
      logger.error('Cannot activate - Dashboard not initialized');
      return;
    }

    logger.info('Activating Dashboard...');

    // Show UI
    UIRenderer.render();

    // Enable input handler
    DashboardInputHandler.enable();

    // Update state
    DashboardStateManager.setState({ isActive: true });

    this.isActive = true;

    logger.success('Dashboard activated');
    AppComms.publish('module:activated', { module: 'dashboard' });
  }

  /**
   * Deactivate Dashboard module
   * Hides UI and disables input handling
   */
  deactivate() {
    if (!this.isActive) {
      return;
    }

    logger.info('Deactivating Dashboard...');

    // Stop timer
    DashboardTimers.stop();

    // Disable input handler
    DashboardInputHandler.disable();

    // Hide UI
    UIRenderer.hide();

    // Update state
    DashboardStateManager.setState({ isActive: false });

    this.isActive = false;

    logger.success('Dashboard deactivated');
    AppComms.publish('module:deactivated', { module: 'dashboard' });
  }

  /**
   * Get current Dashboard state
   * @returns {Object} Current state
   */
  getState() {
    return DashboardStateManager.getState();
  }

  /**
   * Update Dashboard state
   * @param {Object} partialState - State updates
   */
  setState(partialState) {
    DashboardStateManager.setState(partialState);
  }

  /**
   * Cleanup Dashboard module
   */
  destroy() {
    logger.info('Destroying Dashboard module...');

    this.deactivate();

    // Cleanup UI
    UIRenderer.destroy();

    this.isInitialized = false;

    logger.success('Dashboard destroyed');
    AppComms.publish('module:destroyed', { module: 'dashboard' });
  }

  /**
   * Get module statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      isActive: this.isActive,
      state: DashboardStateManager.getState()
    };
  }
}

// Create singleton instance
const dashboard = new Dashboard();

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.Dashboard = dashboard;
}

// =============================================================================
// EXPORT
// =============================================================================

export default dashboard;
