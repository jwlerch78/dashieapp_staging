// js/modules/Dashboard/dashboard-input-handler.js
// Dashboard input handler - Routes actions to navigation manager
// v1.0 - 10/16/25 - Initial implementation for Phase 2

import { createLogger } from '../../utils/logger.js';
import NavigationManager from './dashboard-navigation-manager.js';
import DashboardTimers from './dashboard-timers.js';
import DashboardStateManager from './dashboard-state-manager.js';
import widgetMessenger from '../../core/widget-messenger.js';
import FocusMenuRenderer from './components/focus-menu-renderer.js';
import UIRenderer from './dashboard-ui-renderer.js';

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

    const state = DashboardStateManager.getState();

    // If focus menu is active and in menu state
    if (state.focusMenuState.active && state.focusMenuState.inMenu) {
      const newIndex = Math.max(0, state.focusMenuState.selectedIndex - 1);
      DashboardStateManager.setFocusMenuSelection(newIndex);
      FocusMenuRenderer.updateMenuSelection(newIndex);

      // Send preview to widget
      const selectedItem = state.focusMenuState.menuConfig.items[newIndex];
      widgetMessenger.sendCommandToWidget(state.focusedWidget, {
        action: 'menu-selection-changed',
        selectedItem: newIndex,
        itemId: selectedItem.id
      });

      logger.debug('Menu selection moved up', { newIndex, itemId: selectedItem.id });
      return true;
    }

    // If widget is focused (not in menu)
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

    const state = DashboardStateManager.getState();

    // If focus menu is active and in menu state
    if (state.focusMenuState.active && state.focusMenuState.inMenu) {
      const maxIndex = state.focusMenuState.menuConfig.items.length - 1;
      const newIndex = Math.min(maxIndex, state.focusMenuState.selectedIndex + 1);
      DashboardStateManager.setFocusMenuSelection(newIndex);
      FocusMenuRenderer.updateMenuSelection(newIndex);

      // Send preview to widget
      const selectedItem = state.focusMenuState.menuConfig.items[newIndex];
      widgetMessenger.sendCommandToWidget(state.focusedWidget, {
        action: 'menu-selection-changed',
        selectedItem: newIndex,
        itemId: selectedItem.id
      });

      logger.debug('Menu selection moved down', { newIndex, itemId: selectedItem.id });
      return true;
    }

    // If widget is focused (not in menu)
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

    const state = DashboardStateManager.getState();

    // If focus menu is active and in menu state, do nothing (already at left boundary)
    if (state.focusMenuState.active && state.focusMenuState.inMenu) {
      logger.debug('LEFT pressed in menu - ignoring (at boundary)');
      return true;
    }

    // If widget is active (focus menu active but not in menu) OR widget focused without menu
    // Always forward to widget - widget will send return-to-menu if at home position
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

    const state = DashboardStateManager.getState();

    // If focus menu is active and in menu state
    if (state.focusMenuState.active && state.focusMenuState.inMenu) {
      // Activate widget (exit menu, enter widget control)
      DashboardStateManager.setFocusMenuInWidget(false);
      FocusMenuRenderer.dimFocusMenu();
      UIRenderer.setWidgetActive(state.focusedWidget, true);

      // Send enter-active to widget (use string for legacy format)
      widgetMessenger.sendCommandToWidget(state.focusedWidget, 'enter-active');

      logger.info('Widget activated from menu');
      return true;
    }

    // If widget is focused (not in menu)
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

    const state = DashboardStateManager.getState();

    // If focus menu is active and in menu state
    if (state.focusMenuState.active && state.focusMenuState.inMenu) {
      // Execute selected menu item
      const selectedItem = state.focusMenuState.menuConfig.items[
        state.focusMenuState.selectedIndex
      ];

      // Send menu item selection
      widgetMessenger.sendCommandToWidget(state.focusedWidget, {
        action: 'menu-item-selected',
        itemId: selectedItem.id
      });

      logger.info('Menu item selected', { itemId: selectedItem.id });
      return true;
    }

    // If widget is focused (not in menu)
    if (state.focusedWidget) {
      logger.debug('Forwarding ENTER to focused widget', { widgetId: state.focusedWidget });
      widgetMessenger.sendCommandToWidget(state.focusedWidget, 'enter');
      return true;
    }

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

    const state = DashboardStateManager.getState();

    // If focus menu is active
    if (state.focusMenuState.active) {
      // If in widget control, return to menu first
      if (!state.focusMenuState.inMenu) {
        DashboardStateManager.setFocusMenuInWidget(true);
        FocusMenuRenderer.undimFocusMenu();
        UIRenderer.setWidgetActive(state.focusedWidget, false);

        widgetMessenger.sendCommandToWidget(state.focusedWidget, 'exit-active');

        logger.info('Returned to menu from widget (ESC)');
        return true;
      }

      // If in menu, exit focus mode entirely
      NavigationManager.defocusWidget();
      return true;
    }

    // If widget focused (no menu)
    if (state.focusedWidget) {
      NavigationManager.defocusWidget();
      return true;
    }

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
