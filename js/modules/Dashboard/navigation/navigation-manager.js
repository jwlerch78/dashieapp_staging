// js/modules/Dashboard/dashboard-navigation-manager.js
// Dashboard navigation logic - Grid, menu, and widget focus
// v1.0 - 10/16/25 - Initial implementation for Phase 2

import { createLogger } from '../../../utils/logger.js';
import DashboardStateManager from '../state/state-manager.js';
import UIRenderer from '../ui/ui-renderer.js';
import { getWidgetAtPosition, canWidgetCenter } from '../config/widget-config.js';
import AppStateManager from '../../../core/app-state-manager.js';
import WidgetMessenger from '../../../core/widget-messenger.js';
import FocusMenuStateManager from '../components/focus-menu/state-manager.js';
import FocusMenuRenderer from '../components/focus-menu/renderer.js';
import PageManager from './page-manager.js';

const logger = createLogger('DashboardNav');

/**
 * Navigation Manager
 *
 * Handles all Dashboard navigation:
 * - Grid navigation (3 rows × 2 columns)
 * - Sidebar menu navigation (7 items)
 * - Widget focus/defocus
 *
 * Grid Layout (1-indexed to match config):
 *   Row 1: [Header][Clock]           (10% height)
 *   Row 2: [Calendar][Agenda]        (45% height)
 *   Row 3: [Calendar][Photos]        (45% height - Calendar spans rows 2-3)
 *
 * Columns: 70% / 30% width split
 *
 * Menu Items (0-6):
 *   0: Calendar
 *   1: Map
 *   2: Camera
 *   3: Reload
 *   4: Sleep
 *   5: Settings
 *   6: Exit
 */
class NavigationManager {
  /**
   * Move up in grid or menu
   * @returns {boolean} True if handled
   */
  static moveUp() {
    const state = DashboardStateManager.getState();

    // If widget is focused, don't handle navigation
    if (state.focusedWidget) {
      logger.debug('Widget focused, ignoring navigation');
      return false;
    }

    // Wake from idle state on any navigation
    if (state.isIdle) {
      DashboardStateManager.setState({ isIdle: false });
    }

    // If menu is open, navigate menu up
    if (state.menuOpen) {
      return this.navigateMenuUp();
    }

    // Navigate grid up
    const { row, col } = state.gridPosition;

    if (row > 1) { // Row 1 is top
      const newRow = row - 1;

      // Check if we're moving to the same widget (multi-row spanning)
      const currentWidget = getWidgetAtPosition(row, col);
      const nextWidget = getWidgetAtPosition(newRow, col);

      if (currentWidget && nextWidget && currentWidget.id === nextWidget.id) {
        // Same widget spans multiple rows - skip to previous distinct widget
        logger.debug('Skipping spanned widget rows', {
          widgetId: currentWidget.id,
          from: [row, col],
          skipTo: [newRow - 1, col]
        });

        // Try moving one more row up
        if (newRow > 1) {
          DashboardStateManager.setGridPosition(newRow - 1, col);
          UIRenderer.updateFocus();
          logger.debug('Moved grid up (skipped span)', { from: [row, col], to: [newRow - 1, col] });
          return true;
        }
        // If can't move further, handle as if at top row
      } else {
        // Different widget - normal navigation
        DashboardStateManager.setGridPosition(newRow, col);
        UIRenderer.updateFocus();
        logger.debug('Moved grid up', { from: [row, col], to: [newRow, col] });
        return true;
      }
    }

    // At top row - attempt to navigate to previous page
    logger.debug('At top row, checking for previous page');
    const previousPage = PageManager.getPreviousPage();

    if (previousPage) {
      logger.info('Navigating to previous page via D-pad UP', { previousPage });
      PageManager.switchPage(previousPage).then(() => {
        // After page switch, ensure focus is visible on bottom row
        const state = DashboardStateManager.getState();
        DashboardStateManager.setGridPosition(3, state.gridPosition.col); // Move to bottom row
        DashboardStateManager.setState({ isIdle: false }); // Wake from idle
        UIRenderer.updateFocus(); // Show focus
        logger.debug('Focus updated after page switch', { row: 3, col: state.gridPosition.col });
      }).catch(error => {
        logger.error('Failed to switch to previous page', error);
      });
      return true;
    }

    // No previous page - stay at top
    UIRenderer.updateFocus();
    logger.debug('Already at top row of first page');
    return true; // Still handled (prevents default)
  }

  /**
   * Move down in grid or menu
   * @returns {boolean} True if handled
   */
  static moveDown() {
    const state = DashboardStateManager.getState();

    // If widget is focused, don't handle navigation
    if (state.focusedWidget) {
      return false;
    }

    // Wake from idle state on any navigation
    if (state.isIdle) {
      DashboardStateManager.setState({ isIdle: false });
    }

    // If menu is open, navigate menu down
    if (state.menuOpen) {
      return this.navigateMenuDown();
    }

    // Navigate grid down
    const { row, col } = state.gridPosition;

    if (row < 3) { // Row 3 is bottom
      const newRow = row + 1;

      // Check if we're moving to the same widget (multi-row spanning)
      const currentWidget = getWidgetAtPosition(row, col);
      const nextWidget = getWidgetAtPosition(newRow, col);

      if (currentWidget && nextWidget && currentWidget.id === nextWidget.id) {
        // Same widget spans multiple rows - skip to next distinct widget
        logger.debug('Skipping spanned widget rows', {
          widgetId: currentWidget.id,
          from: [row, col],
          skipTo: [newRow + 1, col]
        });

        // Try moving one more row down
        if (newRow < 3) {
          DashboardStateManager.setGridPosition(newRow + 1, col);
          UIRenderer.updateFocus();
          logger.debug('Moved grid down (skipped span)', { from: [row, col], to: [newRow + 1, col] });
          return true;
        }
        // If can't move further, handle as if at bottom row
      } else {
        // Different widget - normal navigation
        DashboardStateManager.setGridPosition(newRow, col);
        UIRenderer.updateFocus();
        logger.debug('Moved grid down', { from: [row, col], to: [newRow, col] });
        return true;
      }
    }

    // At bottom row - attempt to navigate to next page
    logger.debug('At bottom row, checking for next page');
    const nextPage = PageManager.getNextPage();

    if (nextPage) {
      logger.info('Navigating to next page via D-pad DOWN', { nextPage });
      PageManager.switchPage(nextPage).then(() => {
        // After page switch, ensure focus is visible on top row
        const state = DashboardStateManager.getState();
        DashboardStateManager.setGridPosition(1, state.gridPosition.col); // Move to top row
        DashboardStateManager.setState({ isIdle: false }); // Wake from idle
        UIRenderer.updateFocus(); // Show focus
        logger.debug('Focus updated after page switch', { row: 1, col: state.gridPosition.col });
      }).catch(error => {
        logger.error('Failed to switch to next page', error);
      });
      return true;
    }

    // No next page - stay at bottom
    UIRenderer.updateFocus();
    logger.debug('Already at bottom row of last page');
    return true; // Still handled (prevents default)
  }

  /**
   * Move left in grid or open menu
   * @returns {boolean} True if handled
   */
  static moveLeft() {
    const state = DashboardStateManager.getState();

    // If widget is focused/active, handle LEFT arrow for widget states
    if (state.focusedWidget) {
      // TODO: When focus menus are implemented, LEFT will:
      // - If active (controlling widget): return to focused (menu visible)
      // - If focused (menu visible): stay in menu
      // For now, LEFT arrow is not handled (widget handles it)
      return false;
    }

    // Wake from idle state on any navigation
    if (state.isIdle) {
      DashboardStateManager.setState({ isIdle: false });
    }

    // If menu is open, close it
    if (state.menuOpen) {
      this.closeMenu();
      return true;
    }

    // Navigate grid left
    const { row, col } = state.gridPosition;

    if (col > 1) { // Col 1 is leftmost
      const newCol = col - 1;
      DashboardStateManager.setGridPosition(row, newCol);
      UIRenderer.updateFocus();

      logger.debug('Moved grid left', { from: [row, col], to: [row, newCol] });
      return true;
    }

    // At leftmost column (col 1) - open menu
    logger.debug('At leftmost column, opening menu');
    this.openMenu();
    return true;
  }

  /**
   * Move right in grid or close menu
   * @returns {boolean} True if handled
   */
  static moveRight() {
    const state = DashboardStateManager.getState();

    // If widget is focused/active, handle RIGHT arrow for widget states
    if (state.focusedWidget) {
      // TODO: When focus menus are implemented, RIGHT will:
      // - If focused (menu visible): activate widget (menu dims, scale 1.08)
      // - If active: stay active
      // For now, RIGHT arrow is not handled (widget handles it)
      return false;
    }

    // Wake from idle state on any navigation
    if (state.isIdle) {
      DashboardStateManager.setState({ isIdle: false });
    }

    // If menu is open, close it and move to grid
    if (state.menuOpen) {
      // Close menu UI
      DashboardStateManager.setMenuState(false);
      UIRenderer.clearMenuFocus();
      UIRenderer.hideMenu();

      // Wake from idle and move focus to current grid position
      DashboardStateManager.setState({ isIdle: false });
      UIRenderer.updateFocus(); // Show focus on current grid position

      logger.info('Menu closed, moved to grid', { gridPosition: state.gridPosition });
      return true;
    }

    // Navigate grid right
    const { row, col } = state.gridPosition;

    if (col < 2) { // Col 2 is rightmost
      const newCol = col + 1;
      DashboardStateManager.setGridPosition(row, newCol);
      UIRenderer.updateFocus();

      logger.debug('Moved grid right', { from: [row, col], to: [row, newCol] });
      return true;
    }

    // At rightmost column, but still show selection (not idle anymore)
    UIRenderer.updateFocus();
    logger.debug('Already at rightmost column');
    return true; // Still handled (prevents default)
  }

  /**
   * Handle ENTER action
   * @returns {boolean} True if handled
   */
  static handleEnter() {
    const state = DashboardStateManager.getState();

    // If menu is open, select menu item
    if (state.menuOpen) {
      return this.selectMenuItem(state.selectedMenuItem);
    }

    // If widget is focused, send enter command to it
    if (state.focusedWidget) {
      const widgetMessenger = window.widgetMessenger || AppStateManager.widgetMessenger;

      if (widgetMessenger) {
        widgetMessenger.sendCommandToWidget(state.focusedWidget, 'enter');
        logger.debug('Sent enter command to focused widget', { widgetId: state.focusedWidget });
      }
      return true;
    }

    // Focus current widget
    this.focusWidget();
    return true;
  }

  /**
   * Handle ESCAPE action
   * @returns {boolean} True if handled
   */
  static handleEscape() {
    const state = DashboardStateManager.getState();

    // If widget is focused, defocus it
    if (state.focusedWidget) {
      this.defocusWidget();
      return true;
    }

    // If menu is open, close it
    if (state.menuOpen) {
      this.closeMenu();
      return true;
    }

    // NEW: If nothing focused or open, return to idle state (no visual selection)
    logger.info('Escape pressed with nothing focused - returning to idle state');
    DashboardStateManager.setState({ isIdle: true });
    UIRenderer.updateFocus(); // Update to show no selection

    return true; // Handled
  }

  /**
   * Navigate menu up
   * @private
   * @returns {boolean} True if handled
   */
  static navigateMenuUp() {
    const state = DashboardStateManager.getState();
    const currentItem = state.selectedMenuItem;

    // Wrap around: if at top (0), go to bottom (3) - only 4 items now
    const newItem = currentItem > 0 ? currentItem - 1 : 3;

    DashboardStateManager.setMenuState(true, newItem);
    UIRenderer.updateMenuSelection();

    logger.debug('Menu navigate up', { from: currentItem, to: newItem });
    return true;
  }

  /**
   * Navigate menu down
   * @private
   * @returns {boolean} True if handled
   */
  static navigateMenuDown() {
    const state = DashboardStateManager.getState();
    const currentItem = state.selectedMenuItem;

    // Wrap around: if at bottom (3), go to top (0) - only 4 items now
    const newItem = currentItem < 3 ? currentItem + 1 : 0;

    DashboardStateManager.setMenuState(true, newItem);
    UIRenderer.updateMenuSelection();

    logger.debug('Menu navigate down', { from: currentItem, to: newItem });
    return true;
  }

  /**
   * Open sidebar menu
   */
  static openMenu() {
    // Clear grid focus when moving to sidebar
    UIRenderer.clearGridFocus();

    DashboardStateManager.setMenuState(true);
    UIRenderer.showMenu();

    logger.info('Menu opened');
  }

  /**
   * Close sidebar menu
   */
  static closeMenu() {
    DashboardStateManager.setMenuState(false);

    // Clear sidebar focus when moving to grid
    UIRenderer.clearMenuFocus();
    UIRenderer.hideMenu();

    // Return to idle state (no visual selection)
    DashboardStateManager.setState({ isIdle: true });
    UIRenderer.updateFocus(); // This will skip applying CSS because isIdle=true

    logger.info('Menu closed');
  }

  /**
   * Select menu item
   * @param {number} itemIndex - Menu item index (0-3)
   * @returns {boolean} True if handled
   */
  static selectMenuItem(itemIndex) {
    const menuItems = [
      'reload',
      'sleep',
      'settings',
      'exit'
    ];

    const menuItem = menuItems[itemIndex];

    if (!menuItem) {
      logger.error('Invalid menu item index', { itemIndex });
      return false;
    }

    logger.info('Menu item selected', { item: menuItem, index: itemIndex });

    // Handle menu actions
    switch (menuItem) {
      case 'settings':
        // Open Settings module
        logger.info('Opening Settings module');
        this.closeMenu();

        // Get Settings module from window (exposed in index.html)
        if (window.Settings) {
          window.Settings.show();
        } else {
          logger.error('Settings module not available');
        }
        break;

      case 'reload':
        logger.info('Reloading page');
        this.closeMenu();
        window.location.reload();
        break;

      case 'sleep':
        // Show sleep overlay
        logger.info('Sleep action');
        this.closeMenu();
        if (window.modals) {
          window.modals.showSleep();
        } else {
          logger.error('Modals module not available');
        }
        break;

      case 'exit':
        // Show exit confirmation modal
        logger.info('Exit action');
        this.closeMenu();
        if (window.modals) {
          window.modals.showExitConfirmation();
        } else {
          logger.error('Modals module not available');
        }
        break;

      default:
        logger.warn('Unknown menu action', { menuItem });
        this.closeMenu();
    }

    return true;
  }

  /**
   * Focus current widget
   */
  static focusWidget() {
    const state = DashboardStateManager.getState();
    const { row, col } = state.gridPosition;

    // Get widget at current position
    const widget = getWidgetAtPosition(row, col);

    if (!widget) {
      logger.warn('No widget at position', { row, col });
      return;
    }

    // All widgets can be focused (show overlay, border)
    // Only widgets with canWidgetCenter=true will be moved/centered
    const shouldCenter = canWidgetCenter(widget.id);

    // Check if widget has a focus menu registered
    const menuConfig = FocusMenuStateManager.getWidgetMenuConfig(widget.id);
    const hasFocusMenu = menuConfig?.enabled === true;

    DashboardStateManager.setFocusedWidget(widget.id);
    UIRenderer.focusWidget(widget.id, hasFocusMenu, shouldCenter);

    // Get WidgetMessenger instance
    const widgetMessenger = window.widgetMessenger || AppStateManager.widgetMessenger;

    // Send enter-focus message to widget
    if (widgetMessenger) {
      widgetMessenger.sendCommandToWidget(widget.id, 'enter-focus');

      // If widget has no focus menu, immediately enter active state
      if (!hasFocusMenu) {
        widgetMessenger.sendCommandToWidget(widget.id, 'enter-active');
        logger.info('Widget focused and activated (no focus menu)', {
          widgetId: widget.id,
          position: [row, col],
          centered: shouldCenter
        });
      } else {
        // Widget has focus menu - show it and stay in menu state
        // Get the widget cell element (not the iframe itself)
        const widgetCell = document.querySelector(`.dashboard-grid__cell[data-widget-id="${widget.id}"]`);
        if (widgetCell) {
          FocusMenuRenderer.showFocusMenu(widgetCell, menuConfig);
          DashboardStateManager.setFocusMenuActive(widget.id, menuConfig);

          // Tell widget menu is active
          widgetMessenger.sendCommandToWidget(widget.id, {
            action: 'menu-active',
            selectedItem: menuConfig.defaultIndex || 0,
            itemId: menuConfig.items[menuConfig.defaultIndex || 0].id
          });

          logger.info('Widget focused with menu', {
            widgetId: widget.id,
            position: [row, col],
            centered: shouldCenter,
            menuItems: menuConfig.items.length
          });
        } else {
          logger.warn('Widget cell not found - cannot show focus menu', { widgetId: widget.id });
        }
      }
    } else {
      logger.warn('WidgetMessenger not available - widget state messages not sent');
    }
  }

  /**
   * Defocus current widget
   */
  static defocusWidget() {
    const state = DashboardStateManager.getState();
    const widgetId = state.focusedWidget;

    if (!widgetId) {
      logger.warn('No widget to defocus');
      return;
    }

    // Hide focus menu if active
    if (state.focusMenuState.active) {
      FocusMenuRenderer.hideFocusMenu();
      DashboardStateManager.clearFocusMenuState();
      logger.debug('Focus menu hidden and cleared');
    }

    // Get WidgetMessenger instance
    const widgetMessenger = window.widgetMessenger || AppStateManager.widgetMessenger;

    // Send exit messages to widget
    if (widgetMessenger) {
      widgetMessenger.sendCommandToWidget(widgetId, 'exit-active');
      widgetMessenger.sendCommandToWidget(widgetId, 'exit-focus');
      logger.info('Sent exit messages to widget', { widgetId });
    } else {
      logger.warn('WidgetMessenger not available - widget state messages not sent');
    }

    DashboardStateManager.setFocusedWidget(null);
    UIRenderer.defocusWidget();

    // Restore grid selection highlighting
    UIRenderer.updateFocus();

    logger.info('Widget defocused', { widgetId });
  }
}

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.NavigationManager = NavigationManager;
}

// =============================================================================
// EXPORT
// =============================================================================

export default NavigationManager;
