// js/modules/Dashboard/dashboard-ui-renderer.js
// Dashboard UI rendering and visual updates
// v2.0 - 10/16/25 - Refactored into modular architecture

import { createLogger } from '../../utils/logger.js';
import DOMBuilder from './dashboard-dom-builder.js';
import VisualEffects from './dashboard-visual-effects.js';
import {
  GridEventHandler,
  MenuEventHandler,
  SidebarEventHandler,
  OverlayEventHandler
} from './dashboard-event-handlers.js';

const logger = createLogger('DashboardUI');

/**
 * UI Renderer (Orchestration Layer)
 *
 * Thin coordination layer that delegates to specialized modules:
 * - DOMBuilder: Creates DOM structure
 * - VisualEffects: Manipulates CSS classes and animations
 * - EventHandlers: Attaches and handles user interactions
 *
 * Responsibilities:
 * - Initialize modules
 * - Coordinate render lifecycle (render, hide, destroy)
 * - Maintain container reference
 * - Expose public API for navigation manager
 *
 * Does NOT:
 * - Create DOM directly (uses DOMBuilder)
 * - Manipulate CSS classes directly (uses VisualEffects)
 * - Handle events directly (uses EventHandlers)
 */
class UIRenderer {
  static container = null;
  static isInitialized = false;

  /**
   * Initialize UI renderer and all modules
   * @returns {Promise<boolean>} Success status
   */
  static async initialize() {
    try {
      logger.info('Initializing Dashboard UI renderer...');

      this.isInitialized = true;

      logger.success('Dashboard UI renderer initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize UI renderer', error);
      return false;
    }
  }

  /**
   * Render Dashboard UI
   * Creates DOM structure and attaches event listeners
   */
  static render() {
    if (this.container) {
      logger.debug('Dashboard already rendered, showing existing UI');
      this.container.classList.remove('dashboard--hidden');
      return;
    }

    logger.info('Rendering Dashboard UI...');

    // Create main container
    this.container = DOMBuilder.createContainer();

    // Create sidebar wrapper (maintains 60px space in flex layout)
    const sidebarWrapper = DOMBuilder.createSidebarWrapper();

    // Create sidebar (position absolute, overlays grid when expanded)
    const sidebar = DOMBuilder.createSidebar();
    sidebarWrapper.appendChild(sidebar);
    this.container.appendChild(sidebarWrapper);

    // Create grid
    const grid = DOMBuilder.createGrid();
    this.container.appendChild(grid);

    // Attach to document
    document.body.appendChild(this.container);

    // Initialize visual effects module with container reference
    VisualEffects.initialize(this.container);

    // Initialize event handlers with UI renderer reference
    GridEventHandler.initialize(this);
    MenuEventHandler.initialize(this);

    // Attach event listeners
    this.attachEventListeners(sidebar, grid);

    // Update focus to initial position
    VisualEffects.updateFocus();

    logger.success('Dashboard UI rendered');
  }

  /**
   * Attach all event listeners
   * @private
   * @param {HTMLElement} sidebar - Sidebar element
   * @param {HTMLElement} grid - Grid element
   */
  static attachEventListeners(sidebar, grid) {
    // Attach sidebar event listeners
    SidebarEventHandler.attach(sidebar);

    // Attach grid event listeners
    GridEventHandler.attach(grid);

    // Attach menu item event listeners
    const menuItems = sidebar.querySelectorAll('.dashboard-menu__item');
    menuItems.forEach((button) => {
      const index = parseInt(button.dataset.menuIndex);
      const itemId = button.dataset.menuId;

      // Reconstruct item object (needed by event handler)
      const item = {
        id: itemId,
        label: button.querySelector('.dashboard-menu__label')?.textContent || itemId,
        icon: button.querySelector('.dashboard-menu__icon')?.textContent || ''
      };

      MenuEventHandler.attach(button, item, index, this.container);
    });

    // Attach overlay event listeners
    OverlayEventHandler.attach(this.container);

    logger.debug('All event listeners attached');
  }

  /**
   * Hide Dashboard UI
   */
  static hide() {
    if (!this.container) return;

    this.container.classList.add('dashboard--hidden');
    logger.info('Dashboard UI hidden');
  }

  /**
   * Destroy Dashboard UI
   * Removes DOM elements
   */
  static destroy() {
    if (!this.container) return;

    this.container.remove();
    this.container = null;

    logger.info('Dashboard UI destroyed');
  }

  // =============================================================================
  // PUBLIC API - Delegated to VisualEffects module
  // =============================================================================

  /**
   * Update focus indicator
   * @see VisualEffects.updateFocus()
   */
  static updateFocus() {
    VisualEffects.updateFocus();
  }

  /**
   * Clear grid focus
   * @see VisualEffects.clearGridFocus()
   */
  static clearGridFocus() {
    VisualEffects.clearGridFocus();
  }

  /**
   * Clear menu focus
   * @see VisualEffects.clearMenuFocus()
   */
  static clearMenuFocus() {
    VisualEffects.clearMenuFocus();
  }

  /**
   * Show sidebar menu (expand)
   * @see VisualEffects.showMenu()
   */
  static showMenu() {
    VisualEffects.showMenu();
  }

  /**
   * Hide sidebar menu (collapse)
   * @see VisualEffects.hideMenu()
   */
  static hideMenu() {
    VisualEffects.hideMenu();
  }

  /**
   * Update menu selection highlight
   * @see VisualEffects.updateMenuSelection()
   */
  static updateMenuSelection() {
    VisualEffects.updateMenuSelection();
  }

  /**
   * Focus a widget (center and overlay)
   * @param {string} widgetId - Widget ID to focus
   * @param {boolean} hasFocusMenu - True if widget has focus menu
   * @param {boolean} shouldCenter - True if widget should be centered
   * @see VisualEffects.focusWidget()
   */
  static focusWidget(widgetId, hasFocusMenu = false, shouldCenter = true) {
    VisualEffects.focusWidget(widgetId, hasFocusMenu, shouldCenter);
  }

  /**
   * Defocus widget (return to grid view)
   * @see VisualEffects.defocusWidget()
   */
  static defocusWidget() {
    VisualEffects.defocusWidget();
  }

  /**
   * Set widget to active state
   * @see VisualEffects.setWidgetActive()
   */
  static setWidgetActive() {
    VisualEffects.setWidgetActive();
  }

  /**
   * Set widget back to focused state
   * @see VisualEffects.setWidgetFocused()
   */
  static setWidgetFocused() {
    VisualEffects.setWidgetFocused();
  }

  /**
   * Send escape message to focused widget
   * @see VisualEffects.sendEscapeToFocusedWidget()
   */
  static sendEscapeToFocusedWidget() {
    VisualEffects.sendEscapeToFocusedWidget();
  }

  /**
   * Close sidebar menu
   * @see VisualEffects.closeMenu()
   */
  static closeMenu() {
    VisualEffects.closeMenu();
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  static getStats() {
    return {
      isInitialized: this.isInitialized,
      isRendered: this.container !== null,
      containerExists: !!this.container
    };
  }
}

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.DashboardUIRenderer = UIRenderer;
  window.DashboardVisualEffects = VisualEffects;
  window.DashboardDOMBuilder = DOMBuilder;
}

// =============================================================================
// EXPORT
// =============================================================================

export default UIRenderer;
