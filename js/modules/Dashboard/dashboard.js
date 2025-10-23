// js/modules/Dashboard/dashboard.js
// Dashboard module - Main view with 2x3 widget grid and sidebar navigation
// v1.0 - 10/16/25 - Initial implementation for Phase 2

import { createLogger } from '../../utils/logger.js';
import AppComms from '../../core/app-comms.js';
import AppStateManager from '../../core/app-state-manager.js';
import DashboardStateManager from './state/state-manager.js';
import DashboardInputHandler from './navigation/input-handler.js';
import UIRenderer from './ui/ui-renderer.js';
import DashboardTimers from './state/timer-manager.js';
import NavigationManager from './navigation/navigation-manager.js';
import FocusMenuRenderer from './components/focus-menu/renderer.js';
import widgetMessenger from '../../core/widget-messenger.js';
import { getWidgetById } from './config/widget-config.js';

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

    logger.verbose('Dashboard module created');
  }

  /**
   * Initialize Dashboard module
   * Sets up state management and UI
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      logger.verbose('Initializing Dashboard module...');

      // Initialize state manager
      await DashboardStateManager.initialize();
      logger.debug('State manager initialized');

      // Initialize UI renderer
      await UIRenderer.initialize();
      logger.debug('UI renderer initialized');

      // Initialize timer system
      DashboardTimers.initialize();
      logger.debug('Timer system initialized');

      // Subscribe to widget events
      this.setupWidgetEventListeners();
      logger.debug('Widget event listeners configured');

      this.isInitialized = true;

      logger.verbose('Dashboard module initialized');
      AppComms.publish('module:initialized', { module: 'dashboard' });

      return true;
    } catch (error) {
      logger.error('Failed to initialize Dashboard', error);
      return false;
    }
  }

  /**
   * Set up widget event listeners
   * Handles events from widgets (e.g., focus requests from touch buttons)
   * @private
   */
  setupWidgetEventListeners() {
    // Listen for widget messages (e.g., enter-focus-request, return-to-menu)
    AppComms.subscribe(AppComms.events.WIDGET_MESSAGE, (data) => {
      if (data.type === 'enter-focus-request') {
        this.handleWidgetFocusRequest(data.widgetId);
      } else if (data.type === 'return-to-menu') {
        this.handleWidgetReturnToMenu();
      }
    });
  }

  /**
   * Handle widget focus request (e.g., from touch button)
   * @private
   * @param {string} widgetId - ID of widget requesting focus
   */
  handleWidgetFocusRequest(widgetId) {
    logger.info(`Widget ${widgetId} requested focus via touch`, { widgetId });

    // Get widget configuration
    const widget = getWidgetById(widgetId);
    if (!widget) {
      logger.warn('Cannot focus widget - not found', { widgetId });
      return;
    }

    // Set grid position to widget's position
    DashboardStateManager.setGridPosition(widget.row, widget.col);

    // Focus the widget (focusWidget already sends enter-focus and enter-active for widgets without focus menu)
    NavigationManager.focusWidget();

    // Ensure keyboard focus stays on the main window (not the iframe)
    // This is critical so ESCAPE and other keys work properly
    logger.debug('Restoring keyboard focus to main window', {
      activeElementBefore: document.activeElement?.tagName,
      activeElementId: document.activeElement?.id
    });

    // Blur iframe if it has focus
    if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
      document.activeElement.blur();
      logger.debug('Blurred iframe element');
    }

    // Focus main window
    window.focus();

    // Double-check focus was restored
    setTimeout(() => {
      const activeElement = document.activeElement;
      logger.debug('Focus state after restoration', {
        activeElement: activeElement?.tagName,
        activeElementId: activeElement?.id,
        isIframe: activeElement?.tagName === 'IFRAME'
      });

      // If still on iframe, try harder to remove focus
      if (activeElement?.tagName === 'IFRAME') {
        logger.warn('Iframe still has focus - trying harder to blur');
        activeElement.blur();
        document.body.focus();
        document.body.blur();
      }
    }, 100);

    logger.debug('Widget focused via touch request, keyboard focus restored to main window', {
      widgetId,
      position: [widget.row, widget.col]
    });
  }

  /**
   * Handle widget return-to-menu request
   * Widget has decided to return control to the menu (at home position)
   * @private
   */
  handleWidgetReturnToMenu() {
    const state = DashboardStateManager.getState();

    // Only process if focus menu is active and widget is in control
    if (!state.focusMenuState.active || state.focusMenuState.inMenu) {
      logger.debug('Ignoring return-to-menu - not in correct state', {
        menuActive: state.focusMenuState.active,
        inMenu: state.focusMenuState.inMenu
      });
      return;
    }

    logger.info('Widget requested return to menu (at home position)');

    // Return to menu state
    DashboardStateManager.setFocusMenuInWidget(true);
    FocusMenuRenderer.undimFocusMenu();
    UIRenderer.setWidgetActive(state.focusedWidget, false);

    // Send exit-active to widget
    widgetMessenger.sendCommandToWidget(state.focusedWidget, 'exit-active');

    logger.info('Returned to menu from widget');
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

    logger.verbose('Dashboard activated');
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
