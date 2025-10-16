// js/modules/Dashboard/dashboard-input-handler.js
// Dashboard input handler - Routes actions to navigation manager
// v1.0 - 10/16/25 - Initial implementation for Phase 2

import { createLogger } from '../../utils/logger.js';
import NavigationManager from './dashboard-navigation-manager.js';

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
    logger.info('Dashboard input handler enabled');
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
