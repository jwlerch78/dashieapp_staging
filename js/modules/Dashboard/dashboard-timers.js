// js/modules/Dashboard/dashboard-timers.js
// Timeout management for Dashboard selection and focus states
// v1.0 - 10/16/25 - Initial implementation for Phase 2

import { createLogger } from '../../utils/logger.js';
import { SELECTION_TIMEOUT, FOCUS_TIMEOUT } from '../../../config.js';
import DashboardStateManager from './dashboard-state-manager.js';
import NavigationManager from './dashboard-navigation-manager.js';
import UIRenderer from './dashboard-ui-renderer.js';

const logger = createLogger('DashboardTimers');

/**
 * Dashboard Timer Manager
 *
 * Manages automatic timeout behavior for Dashboard:
 * - Selection timeout: 20 seconds when navigating grid (no widget focused)
 * - Focus timeout: 60 seconds when widget is focused
 *
 * When timeout fires:
 * - If widget is focused: Send escape, defocus widget, hide overlay
 * - If menu is open: Close sidebar
 * - Always: Clear all highlights and hide navigation indicators
 *
 * Uses singleton pattern (static methods only).
 */
class DashboardTimers {
  static timer = null;
  static isVisible = true; // Track highlight visibility

  /**
   * Start selection/focus timeout
   * Uses different durations based on whether widget is focused
   */
  static start() {
    this.stop(); // Clear any existing timer

    const state = DashboardStateManager.getState();

    // Choose timeout based on focus state
    // 60 seconds if widget focused, 20 seconds if just navigating
    const timeoutMs = state.focusedWidget
      ? FOCUS_TIMEOUT * 1000
      : SELECTION_TIMEOUT * 1000;

    logger.debug('Starting timer', {
      duration: timeoutMs / 1000,
      type: state.focusedWidget ? 'focus' : 'selection'
    });

    this.timer = setTimeout(() => {
      this.onTimeout();
    }, timeoutMs);
  }

  /**
   * Stop/clear current timer
   */
  static stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      logger.debug('Timer stopped');
    }
  }

  /**
   * Reset timer (restart with fresh duration)
   * Call this on any user input to extend the timeout
   */
  static reset() {
    if (!this.isVisible) {
      // If highlights were hidden, show them again
      this.show();
    } else {
      // If highlights visible, restart timer
      this.start();
    }
  }

  /**
   * Handle timeout expiration
   * @private
   */
  static onTimeout() {
    logger.info('Timer expired, hiding highlights');

    this.isVisible = false;
    const state = DashboardStateManager.getState();

    // If widget is focused, defocus it first
    if (state.focusedWidget) {
      logger.debug('Defocusing widget due to timeout');

      // Send escape to widget so it can clean up
      UIRenderer.sendEscapeToFocusedWidget();

      // Small delay to let widget process escape
      setTimeout(() => {
        // Use NavigationManager to properly defocus widget (handles both state + UI)
        NavigationManager.defocusWidget();

        // Hide all highlights
        this.hideHighlights();
      }, 10);
    } else {
      // No widget focused, just hide highlights
      this.hideHighlights();
    }
  }

  /**
   * Hide navigation highlights and close sidebar
   * @private
   */
  static hideHighlights() {
    const state = DashboardStateManager.getState();

    // Set to idle state (removes visual selection but maintains position)
    DashboardStateManager.setState({ isIdle: true });

    // Update UI to reflect idle state (no CSS classes applied)
    UIRenderer.updateFocus();

    // If menu is open, close it
    if (state.menuOpen) {
      NavigationManager.closeMenu();
      logger.debug('Closed sidebar due to timeout');
    }

    logger.success('Returned to idle state');
  }

  /**
   * Show navigation highlights (wake from idle)
   */
  static show() {
    logger.debug('Waking from idle and starting timer');

    this.isVisible = true;

    // Wake from idle state
    DashboardStateManager.setState({ isIdle: false });

    // Start new timer
    this.start();
  }

  /**
   * Initialize timer system
   * Starts in idle state (clean dashboard on load)
   */
  static initialize() {
    logger.info('Initializing timer system...');

    // Start in idle state (no visual selection)
    this.isVisible = false;
    DashboardStateManager.setState({ isIdle: true });

    // Don't start timer - wait for first user input

    logger.success('Timer system initialized (idle state)');
  }

  /**
   * Get timer statistics
   * @returns {Object} Timer stats
   */
  static getStats() {
    return {
      isActive: this.timer !== null,
      isVisible: this.isVisible,
      selectionTimeout: SELECTION_TIMEOUT,
      focusTimeout: FOCUS_TIMEOUT
    };
  }
}

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.DashboardTimers = DashboardTimers;
}

// =============================================================================
// EXPORT
// =============================================================================

export default DashboardTimers;
