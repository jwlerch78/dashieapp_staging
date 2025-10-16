// js/modules/Dashboard/dashboard-visual-effects.js
// Dashboard visual updates and CSS class manipulation
// v1.0 - 10/16/25 - Extracted from dashboard-ui-renderer.js

import { createLogger } from '../../utils/logger.js';
import DashboardStateManager from './dashboard-state-manager.js';

const logger = createLogger('DashboardVisualEffects');

/**
 * Dashboard Visual Effects
 *
 * Handles all visual state changes and CSS class manipulation:
 * - Grid focus indicators
 * - Menu selection highlights
 * - Widget focus/defocus animations
 * - Sidebar expand/collapse
 * - Overlay visibility
 *
 * Does NOT:
 * - Handle events (handled by event-handlers.js)
 * - Create DOM (handled by dom-builder.js)
 * - Manage state (handled by state-manager.js)
 */
class VisualEffects {
  static container = null;

  /**
   * Initialize with container reference
   * @param {HTMLElement} container - Dashboard container element
   */
  static initialize(container) {
    this.container = container;
  }

  // =============================================================================
  // GRID FOCUS EFFECTS
  // =============================================================================

  /**
   * Update focus indicator on grid
   * Highlights the currently focused grid cell
   */
  static updateFocus() {
    if (!this.container) return;

    const state = DashboardStateManager.getState();
    const { row, col } = state.gridPosition;

    // Remove focus from all cells
    const cells = this.container.querySelectorAll('.dashboard-grid__cell');
    cells.forEach(cell => {
      cell.classList.remove('dashboard-grid__cell--focused');
    });

    // If idle, don't apply any visual focus (widget-idle state)
    if (state.isIdle) {
      logger.debug('In idle state - no visual focus applied');
      return;
    }

    // Add focus to current cell (or all cells at that position for spanning widgets)
    const focusedCells = this.container.querySelectorAll(
      `.dashboard-grid__cell[data-widget-id]`
    );

    focusedCells.forEach(cell => {
      const cellRow = parseInt(cell.dataset.row);
      const cellCol = parseInt(cell.dataset.col);
      const cellRowSpan = parseInt(cell.dataset.rowSpan) || 1;
      const cellColSpan = parseInt(cell.dataset.colSpan) || 1;

      // Check if current position is within this widget's span
      const rowInRange = row >= cellRow && row < (cellRow + cellRowSpan);
      const colInRange = col >= cellCol && col < (cellCol + cellColSpan);

      if (rowInRange && colInRange) {
        cell.classList.add('dashboard-grid__cell--focused');
        logger.debug('Focus updated', { row, col, widgetId: cell.dataset.widgetId });
      }
    });
  }

  /**
   * Clear grid focus (when moving to sidebar)
   */
  static clearGridFocus() {
    if (!this.container) return;

    const cells = this.container.querySelectorAll('.dashboard-grid__cell');
    cells.forEach(cell => {
      cell.classList.remove('dashboard-grid__cell--focused');
    });

    logger.debug('Grid focus cleared');
  }

  // =============================================================================
  // MENU SELECTION EFFECTS
  // =============================================================================

  /**
   * Update menu selection highlight
   */
  static updateMenuSelection() {
    if (!this.container) return;

    const state = DashboardStateManager.getState();
    const selectedIndex = state.selectedMenuItem;

    // Remove selection from all menu items
    const menuItems = this.container.querySelectorAll('.dashboard-menu__item');
    menuItems.forEach(item => {
      item.classList.remove('dashboard-menu__item--selected');
    });

    // Add selection to current item
    const selectedItem = this.container.querySelector(
      `.dashboard-menu__item[data-menu-index="${selectedIndex}"]`
    );

    if (selectedItem) {
      selectedItem.classList.add('dashboard-menu__item--selected');
      logger.debug('Menu selection updated', { index: selectedIndex });
    }
  }

  /**
   * Clear menu focus (when moving to grid)
   */
  static clearMenuFocus() {
    if (!this.container) return;

    const menuItems = this.container.querySelectorAll('.dashboard-menu__item');
    menuItems.forEach(item => {
      item.classList.remove('dashboard-menu__item--selected');
    });

    logger.debug('Menu focus cleared');
  }

  // =============================================================================
  // SIDEBAR EFFECTS
  // =============================================================================

  /**
   * Show sidebar menu (expand)
   */
  static showMenu() {
    if (!this.container) return;

    const sidebar = this.container.querySelector('.dashboard-sidebar');
    if (sidebar) {
      sidebar.classList.add('dashboard-sidebar--expanded');
      logger.debug('Menu shown');
    }

    // Update menu selection
    this.updateMenuSelection();
  }

  /**
   * Hide sidebar menu (collapse)
   */
  static hideMenu() {
    if (!this.container) return;

    const sidebar = this.container.querySelector('.dashboard-sidebar');
    if (sidebar) {
      sidebar.classList.remove('dashboard-sidebar--expanded');
      logger.debug('Menu hidden');
    }
  }

  // =============================================================================
  // WIDGET FOCUS EFFECTS
  // =============================================================================

  /**
   * Focus a widget (center and overlay)
   * @param {string} widgetId - Widget ID to focus
   * @param {boolean} hasFocusMenu - True if widget has focus menu (default: false)
   * @param {boolean} shouldCenter - True if widget should be centered (default: true)
   */
  static focusWidget(widgetId, hasFocusMenu = false, shouldCenter = true) {
    if (!this.container) return;

    const cell = this.container.querySelector(
      `.dashboard-grid__cell[data-widget-id="${widgetId}"]`
    );

    if (cell) {
      // Get widget's current position and dimensions
      const rect = cell.getBoundingClientRect();

      // Get widget-specific focus scale from config
      const focusScale = parseFloat(cell.dataset.focusScale) || 1.2;

      let translateX = 0;
      let translateY = 0;

      // Only calculate centering if widget should be centered
      if (shouldCenter) {
        // Calculate center of viewport
        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;

        // Calculate widget's current center
        const widgetCenterX = rect.left + (rect.width / 2);
        const widgetCenterY = rect.top + (rect.height / 2);

        // Calculate how much to translate to center the widget
        translateX = viewportCenterX - widgetCenterX;
        translateY = viewportCenterY - widgetCenterY;
      }

      // Store transform for later use
      cell.dataset.translateX = translateX;
      cell.dataset.translateY = translateY;

      // Calculate scale based on state:
      // - focus+active (no focus menu): focusScale from config
      // - focus-only (has focus menu): focusScale * 0.95
      const scale = hasFocusMenu ? focusScale * 0.95 : focusScale;
      const stateClass = hasFocusMenu
        ? 'dashboard-grid__cell--widget-focused'
        : 'dashboard-grid__cell--widget-active';

      // Apply transform: translate (if centering) + scale
      const transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      cell.style.transform = transform;
      cell.dataset.focusedTransform = transform;

      // Add appropriate state class and show overlay
      cell.classList.add(stateClass);
      this.container.classList.add('dashboard--widget-focused');

      // Add overlay-visible class after a small delay for smooth fade-in
      setTimeout(() => {
        if (this.container) {
          this.container.classList.add('overlay-visible');
        }
      }, 50);

      logger.info('Widget focused in UI', {
        widgetId,
        hasFocusMenu,
        shouldCenter,
        focusScale,
        actualScale: scale,
        state: hasFocusMenu ? 'focused (silver)' : 'active (blue)',
        width: rect.width,
        height: rect.height,
        translate: { x: translateX, y: translateY }
      });
    }
  }

  /**
   * Defocus widget (return to grid view)
   */
  static defocusWidget() {
    if (!this.container) return;

    // Remove overlay first
    this.container.classList.remove('overlay-visible');

    // Remove widget focus and active from all cells
    const cells = this.container.querySelectorAll('.dashboard-grid__cell');
    cells.forEach(cell => {
      cell.classList.remove('dashboard-grid__cell--widget-focused');
      cell.classList.remove('dashboard-grid__cell--widget-active');

      // Clear inline transform and data attributes
      cell.style.transform = '';
      delete cell.dataset.focusedTransform;
      delete cell.dataset.translateX;
      delete cell.dataset.translateY;
    });

    // Remove dashboard focused class after transition
    setTimeout(() => {
      if (this.container) {
        this.container.classList.remove('dashboard--widget-focused');
      }
    }, 300);

    logger.info('Widget defocused in UI');
  }

  /**
   * Set widget to active state (focusScale, blue border)
   * Called when RIGHT arrow is pressed from focused state
   */
  static setWidgetActive() {
    if (!this.container) return;

    const focusedCell = this.container.querySelector('.dashboard-grid__cell--widget-focused');
    if (!focusedCell) {
      logger.warn('No focused widget to activate');
      return;
    }

    // Get stored translate values
    const translateX = parseFloat(focusedCell.dataset.translateX) || 0;
    const translateY = parseFloat(focusedCell.dataset.translateY) || 0;

    // Get widget-specific focus scale from config
    const focusScale = parseFloat(focusedCell.dataset.focusScale) || 1.2;

    // Active state uses full focusScale
    const activeScale = focusScale;

    // Apply new transform with increased scale
    const transform = `translate(${translateX}px, ${translateY}px) scale(${activeScale})`;
    focusedCell.style.transform = transform;

    // Add active class (changes border to blue)
    focusedCell.classList.add('dashboard-grid__cell--widget-active');

    logger.info('Widget activated', { focusScale, scale: activeScale });
  }

  /**
   * Set widget back to focused state (focusScale * 0.95, silver border)
   * Called when LEFT arrow is pressed from active state
   */
  static setWidgetFocused() {
    if (!this.container) return;

    const activeCell = this.container.querySelector('.dashboard-grid__cell--widget-active');
    if (!activeCell) {
      logger.warn('No active widget to focus');
      return;
    }

    // Get stored translate values
    const translateX = parseFloat(activeCell.dataset.translateX) || 0;
    const translateY = parseFloat(activeCell.dataset.translateY) || 0;

    // Get widget-specific focus scale from config
    const focusScale = parseFloat(activeCell.dataset.focusScale) || 1.2;

    // Focused state (with menu) uses focusScale * 0.95
    const focusedScale = focusScale * 0.95;

    // Apply transform with focused scale
    const transform = `translate(${translateX}px, ${translateY}px) scale(${focusedScale})`;
    activeCell.style.transform = transform;

    // Remove active class (returns to silver border)
    activeCell.classList.remove('dashboard-grid__cell--widget-active');

    logger.info('Widget returned to focused state', { focusScale, scale: focusedScale });
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Send escape message to focused widget
   * Used by timer system when timeout expires
   */
  static sendEscapeToFocusedWidget() {
    if (!this.container) return;

    const focusedCell = this.container.querySelector(
      '.dashboard-grid__cell--widget-focused, .dashboard-grid__cell--widget-active'
    );

    if (!focusedCell) {
      logger.warn('No focused widget to send escape to');
      return;
    }

    // TODO: Send escape message to widget iframe
    // For now, just log it
    logger.info('Escape sent to focused widget', {
      widgetId: focusedCell.dataset.widgetId
    });
  }

  /**
   * Close sidebar menu
   * Alias for hideMenu() - used by timer system
   */
  static closeMenu() {
    this.hideMenu();
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export default VisualEffects;
