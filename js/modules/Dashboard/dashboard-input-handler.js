// js/modules/Dashboard/dashboard-input-handler.js
// Dashboard input handler - Routes actions to navigation manager
// v1.0 - 10/16/25 - Initial implementation for Phase 2

import { createLogger } from '../../utils/logger.js';
import NavigationManager from './dashboard-navigation-manager.js';
import DashboardTimers from './dashboard-timers.js';
import DashboardStateManager from './dashboard-state-manager.js';
import widgetMessenger from '../../core/widget-messenger.js';

const logger = createLogger('DashboardInput');

/**
 * Dashboard Input Handler
 *
 * Implements the Module Input Handler Interface.
 * Routes user input actions to NavigationManager.
 *
 * Required methods:
 * - handleUp(event)
 * - handleDown(event)
 * - handleLeft(event)
 * - handleRight(event)
 * - handleEnter(event)
 * - handleEscape(event)
 *
 * All handlers return boolean:
 * - true: action was handled
 * - false: action was not handled (pass to next handler)
 */
class DashboardInputHandler {
  static enabled = false;

  /**
   * Enable input handling
   */
  static enable() {
    this.enabled = true;
    logger.verbose('Dashboard input handler enabled');
  }

  /**
   * Disable input handling
   */
  static disable() {
    this.enabled = false;
    logger.info('Dashboard input handler disabled');
  }

  /**
   * Handle UP action
   * @param {Event|null} originalEvent - Original DOM event
   * @returns {boolean} True if handled
   */
  static handleUp(originalEvent) {
    if (!this.enabled) return false;

    logger.debug('Handling UP action');
    DashboardTimers.reset(); // Reset timer on any input

    // If widget is focused, send command to widget
    const state = DashboardStateManager.getState();
    if (state.focusedWidget) {
      logger.debug('Forwarding UP to focused widget', { widgetId: state.focusedWidget });
      widgetMessenger.sendCommandToWidget(state.focusedWidget, 'up');
      return true;
    }

    return NavigationManager.moveUp();
  }

  /**
   * Handle DOWN action
   * @param {Event|null} originalEvent - Original DOM event
   * @returns {boolean} True if handled
   */
  static handleDown(originalEvent) {
    if (!this.enabled) return false;

    logger.debug('Handling DOWN action');
    DashboardTimers.reset(); // Reset timer on any input

    // If widget is focused, send command to widget
    const state = DashboardStateManager.getState();
    if (state.focusedWidget) {
      logger.debug('Forwarding DOWN to focused widget', { widgetId: state.focusedWidget });
      widgetMessenger.sendCommandToWidget(state.focusedWidget, 'down');
      return true;
    }

    return NavigationManager.moveDown();
  }

  /**
   * Handle LEFT action
   * @param {Event|null} originalEvent - Original DOM event
   * @returns {boolean} True if handled
   */
  static handleLeft(originalEvent) {
    if (!this.enabled) return false;

    logger.debug('Handling LEFT action');
    DashboardTimers.reset(); // Reset timer on any input

    // If widget is focused, send command to widget
    const state = DashboardStateManager.getState();
    if (state.focusedWidget) {
      logger.debug('Forwarding LEFT to focused widget', { widgetId: state.focusedWidget });
      widgetMessenger.sendCommandToWidget(state.focusedWidget, 'left');
      return true;
    }

    return NavigationManager.moveLeft();
  }

  /**
   * Handle RIGHT action
   * @param {Event|null} originalEvent - Original DOM event
   * @returns {boolean} True if handled
   */
  static handleRight(originalEvent) {
    if (!this.enabled) return false;

    logger.debug('Handling RIGHT action');
    DashboardTimers.reset(); // Reset timer on any input

    // If widget is focused, send command to widget
    const state = DashboardStateManager.getState();
    if (state.focusedWidget) {
      logger.debug('Forwarding RIGHT to focused widget', { widgetId: state.focusedWidget });
      widgetMessenger.sendCommandToWidget(state.focusedWidget, 'right');
      return true;
    }

    return NavigationManager.moveRight();
  }

  /**
   * Handle ENTER action
   * @param {Event|null} originalEvent - Original DOM event
   * @returns {boolean} True if handled
   */
  static handleEnter(originalEvent) {
    if (!this.enabled) return false;

    logger.debug('Handling ENTER action');
    DashboardTimers.reset(); // Reset timer on any input
    return NavigationManager.handleEnter();
  }

  /**
   * Handle ESCAPE action
   * @param {Event|null} originalEvent - Original DOM event
   * @returns {boolean} True if handled
   */
  static handleEscape(originalEvent) {
    if (!this.enabled) return false;

    logger.debug('Handling ESCAPE action');
    DashboardTimers.reset(); // Reset timer on any input
    return NavigationManager.handleEscape();
  }

  /**
   * Check if handler is enabled
   * @returns {boolean} True if enabled
   */
  static isEnabled() {
    return this.enabled;
  }
}

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.DashboardInputHandler = DashboardInputHandler;
}

// =============================================================================
// EXPORT
// =============================================================================

export default DashboardInputHandler;
