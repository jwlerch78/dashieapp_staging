// js/modules/Dashboard/dashboard-event-handlers.js
// Dashboard event handling and user interaction
// v1.0 - 10/16/25 - Extracted from dashboard-ui-renderer.js

import { createLogger } from '../../utils/logger.js';
import DashboardStateManager from './dashboard-state-manager.js';

const logger = createLogger('DashboardEvents');

/**
 * Grid Event Handler
 *
 * Handles all mouse/touch interactions with grid cells:
 * - Hover: Shows selected state (silver border, 1.05 scale)
 * - Leave: Returns to idle state (no visual selection)
 * - Click: Enters focus/active mode (blue border, centered)
 */
class GridEventHandler {
  static uiRenderer = null;

  /**
   * Initialize with UI renderer reference
   * @param {Object} uiRenderer - UI renderer instance
   */
  static initialize(uiRenderer) {
    this.uiRenderer = uiRenderer;
  }

  /**
   * Attach event listeners to all grid cells
   * @param {HTMLElement} grid - Grid element
   */
  static attach(grid) {
    const cells = grid.querySelectorAll('.dashboard-grid__cell');

    cells.forEach(cell => {
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const widgetId = cell.dataset.widgetId;

      // Hover handlers disabled for touch interface
      // Users should interact with widgets via D-pad or touch buttons
      // cell.addEventListener('mouseenter', () => {
      //   this.handleHover(row, col, widgetId);
      // });

      // cell.addEventListener('mouseleave', () => {
      //   this.handleLeave(row, col, widgetId);
      // });

      // Click handler - enter focus/active state
      cell.addEventListener('click', (e) => {
        this.handleClick(e, row, col, widgetId);
      });
    });

    logger.debug('Grid event listeners attached', { cellCount: cells.length });
  }

  /**
   * Handle grid cell hover (mouseenter)
   * @param {number} row - Grid row
   * @param {number} col - Grid column
   * @param {string} widgetId - Widget ID
   */
  static handleHover(row, col, widgetId) {
    const state = DashboardStateManager.getState();

    // Don't change selection if widget is focused
    if (state.focusedWidget) return;

    logger.debug('Grid cell hover', { row, col, widgetId });

    // Update grid position and exit idle state
    DashboardStateManager.setGridPosition(row, col);
    DashboardStateManager.setState({ isIdle: false });

    // Close menu if open
    if (state.menuOpen) {
      import('./dashboard-navigation-manager.js').then((module) => {
        const NavigationManager = module.default;
        NavigationManager.closeMenu();
      });
    }

    // Update visual focus (show selected state - silver border)
    if (this.uiRenderer) {
      this.uiRenderer.clearMenuFocus();
      this.uiRenderer.updateFocus();
    }

    // Start/reset timer for auto-hide
    import('./dashboard-timers.js').then((module) => {
      const DashboardTimers = module.default;
      DashboardTimers.reset();
    });
  }

  /**
   * Handle grid cell mouseleave
   * @param {number} row - Grid row
   * @param {number} col - Grid column
   * @param {string} widgetId - Widget ID
   */
  static handleLeave(row, col, widgetId) {
    const state = DashboardStateManager.getState();

    // Don't clear if widget is focused or menu is open
    if (state.focusedWidget || state.menuOpen) return;

    logger.debug('Grid cell mouseleave', { row, col, widgetId });

    // Return to idle state (clear visual selection)
    DashboardStateManager.setState({ isIdle: true });

    if (this.uiRenderer) {
      this.uiRenderer.updateFocus();
    }
  }

  /**
   * Handle grid cell click
   * @param {Event} e - Click event
   * @param {number} row - Grid row
   * @param {number} col - Grid column
   * @param {string} widgetId - Widget ID
   */
  static handleClick(e, row, col, widgetId) {
    e.preventDefault();
    e.stopPropagation();

    const state = DashboardStateManager.getState();

    // Don't allow clicks when widget is already focused
    if (state.focusedWidget) return;

    logger.info('Grid cell clicked', { row, col, widgetId });

    // Import navigation manager dynamically
    import('./dashboard-navigation-manager.js').then((module) => {
      const NavigationManager = module.default;

      // Make sure position is set and not idle
      DashboardStateManager.setGridPosition(row, col);
      DashboardStateManager.setState({ isIdle: false });

      // Focus the widget (enter focus+active mode)
      NavigationManager.focusWidget();
    });
  }
}

/**
 * Menu Event Handler
 *
 * Handles all mouse/touch interactions with menu items:
 * - Hover: Updates menu selection (like d-pad navigation)
 * - Leave: Returns to idle state
 * - Click: Executes menu action
 * - Touch: Mobile/tablet support
 */
class MenuEventHandler {
  static uiRenderer = null;

  /**
   * Initialize with UI renderer reference
   * @param {Object} uiRenderer - UI renderer instance
   */
  static initialize(uiRenderer) {
    this.uiRenderer = uiRenderer;
  }

  /**
   * Attach event listeners to a menu item
   * @param {HTMLElement} button - Menu button element
   * @param {Object} item - Menu item config (id, label, icon)
   * @param {number} index - Menu item index
   * @param {HTMLElement} container - Dashboard container (for sidebar query)
   */
  static attach(button, item, index, container) {
    // Hover handlers disabled for touch interface
    // Menu items respond only to D-pad navigation
    // button.addEventListener('mouseenter', () => {
    //   this.handleHover(item, index);
    // });

    // button.addEventListener('mouseleave', () => {
    //   this.handleLeave(item, index);
    // });

    // Click handler
    button.addEventListener('click', (e) => {
      this.handleClick(e, item, index, container);
    });

    // Touch handlers
    this.attachTouchHandlers(button, item, index, container);

    logger.debug('Menu item event listeners attached', { item: item.id, index });
  }

  /**
   * Handle menu item hover (mouseenter)
   * @param {Object} item - Menu item config
   * @param {number} index - Menu item index
   */
  static handleHover(item, index) {
    const state = DashboardStateManager.getState();

    // Don't change selection if widget is focused
    if (state.focusedWidget) return;

    logger.debug('Menu item hover', { item: item.id, index });

    // Update selection state (same as d-pad navigation)
    DashboardStateManager.setMenuState(true, index);

    if (this.uiRenderer) {
      this.uiRenderer.updateMenuSelection();
      // Clear grid focus when hovering on menu
      this.uiRenderer.clearGridFocus();
    }

    // Start/reset timer for auto-hide
    import('./dashboard-timers.js').then((module) => {
      const DashboardTimers = module.default;
      DashboardTimers.reset();
    });
  }

  /**
   * Handle menu item mouseleave
   * @param {Object} item - Menu item config
   * @param {number} index - Menu item index
   */
  static handleLeave(item, index) {
    const state = DashboardStateManager.getState();

    // Don't clear if widget is focused or menu is actively open (d-pad navigation)
    if (state.focusedWidget || state.menuOpen) return;

    logger.debug('Menu item mouseleave', { item: item.id, index });

    // Return to idle state
    DashboardStateManager.setState({ isIdle: true });

    if (this.uiRenderer) {
      this.uiRenderer.updateFocus();
    }
  }

  /**
   * Handle menu item click
   * @param {Event} e - Click event
   * @param {Object} item - Menu item config
   * @param {number} index - Menu item index
   * @param {HTMLElement} container - Dashboard container
   */
  static handleClick(e, item, index, container) {
    e.preventDefault();
    e.stopPropagation();

    logger.info('Menu item clicked', { item: item.id, index });

    // Import navigation manager dynamically to avoid circular deps
    import('./dashboard-navigation-manager.js').then((module) => {
      const NavigationManager = module.default;

      // Set focus to this menu item
      DashboardStateManager.setMenuState(true, index);

      if (this.uiRenderer) {
        this.uiRenderer.updateMenuSelection();

        // Expand sidebar if not already expanded
        const sidebar = container.querySelector('.dashboard-sidebar');
        if (sidebar && !sidebar.classList.contains('dashboard-sidebar--expanded')) {
          this.uiRenderer.showMenu();
        }
      }

      // Execute menu action after a small delay (for visual feedback)
      setTimeout(() => {
        NavigationManager.selectMenuItem(index);
      }, 150);
    });
  }

  /**
   * Attach touch event handlers to menu item
   * @param {HTMLElement} button - Menu button element
   * @param {Object} item - Menu item config
   * @param {number} index - Menu item index
   * @param {HTMLElement} container - Dashboard container
   */
  static attachTouchHandlers(button, item, index, container) {
    let touchStartTime = 0;

    button.addEventListener('touchstart', (e) => {
      touchStartTime = Date.now();
      e.preventDefault();

      logger.debug('Menu item touched', { item: item.id, index });

      // Set focus to this menu item
      DashboardStateManager.setMenuState(true, index);

      if (this.uiRenderer) {
        this.uiRenderer.updateMenuSelection();

        // Expand sidebar
        const sidebar = container.querySelector('.dashboard-sidebar');
        if (sidebar && !sidebar.classList.contains('dashboard-sidebar--expanded')) {
          this.uiRenderer.showMenu();
        }
      }
    });

    button.addEventListener('touchend', (e) => {
      const touchDuration = Date.now() - touchStartTime;

      // Only treat as tap if touch was brief (less than 300ms)
      if (touchDuration < 300) {
        e.preventDefault();

        logger.info('Menu item tapped', { item: item.id, index });

        // Import navigation manager dynamically to avoid circular deps
        import('./dashboard-navigation-manager.js').then((module) => {
          const NavigationManager = module.default;

          // Execute menu action after a small delay
          setTimeout(() => {
            NavigationManager.selectMenuItem(index);
          }, 150);
        });
      }
    });
  }
}

/**
 * Sidebar Event Handler
 *
 * Handles sidebar expansion/collapse:
 * - Hover: Expands sidebar
 * - Leave: Collapses sidebar (if menu not actively open)
 * - Click: Toggles sidebar state
 */
class SidebarEventHandler {
  /**
   * Attach event listeners to sidebar
   * @param {HTMLElement} sidebar - Sidebar element
   */
  static attach(sidebar) {
    // Hover handlers disabled for touch interface
    // Sidebar expands/collapses only via D-pad navigation
    // sidebar.addEventListener('mouseenter', () => {
    //   this.handleHover(sidebar);
    // });

    // sidebar.addEventListener('mouseleave', () => {
    //   this.handleLeave(sidebar);
    // });

    // Click on empty sidebar area to toggle (mobile/touch)
    sidebar.addEventListener('click', (e) => {
      this.handleClick(e, sidebar);
    });

    logger.debug('Sidebar event listeners attached');
  }

  /**
   * Handle sidebar hover (mouseenter)
   * @param {HTMLElement} sidebar - Sidebar element
   */
  static handleHover(sidebar) {
    const state = DashboardStateManager.getState();

    // Don't auto-expand if widget is focused
    if (state.focusedWidget) return;

    logger.debug('Sidebar hover - expanding');
    sidebar.classList.add('dashboard-sidebar--expanded');
  }

  /**
   * Handle sidebar mouseleave
   * @param {HTMLElement} sidebar - Sidebar element
   */
  static handleLeave(sidebar) {
    const state = DashboardStateManager.getState();

    // Don't collapse if menu is actively open (user navigated with d-pad)
    if (state.menuOpen) return;

    logger.debug('Sidebar hover end - collapsing');
    sidebar.classList.remove('dashboard-sidebar--expanded');
  }

  /**
   * Handle sidebar click
   * @param {Event} e - Click event
   * @param {HTMLElement} sidebar - Sidebar element
   */
  static handleClick(e, sidebar) {
    // Only handle clicks on the sidebar itself, not menu items
    if (e.target.closest('.dashboard-menu__item')) return;

    const state = DashboardStateManager.getState();
    const isExpanded = sidebar.classList.contains('dashboard-sidebar--expanded');

    logger.debug('Sidebar clicked', { isExpanded, menuOpen: state.menuOpen });

    if (isExpanded && state.menuOpen) {
      // Close menu if it's actively open
      import('./dashboard-navigation-manager.js').then((module) => {
        const NavigationManager = module.default;
        NavigationManager.closeMenu();
      });
    } else if (!isExpanded) {
      // Expand if collapsed
      sidebar.classList.add('dashboard-sidebar--expanded');
    }
  }
}

/**
 * Overlay Event Handler
 *
 * Handles clicks on the focus overlay:
 * - Click on overlay (not focused widget): Defocus widget (same as ESCAPE)
 */
class OverlayEventHandler {
  /**
   * Attach event listeners to dashboard container
   * @param {HTMLElement} container - Dashboard container element
   */
  static attach(container) {
    // Click on dashboard container captures clicks on the ::before pseudo-element overlay
    // The overlay has pointer-events: auto and z-index: 50
    // Unfocused widgets/sidebar have pointer-events: none when overlay is visible
    // So any click that reaches the container when widget is focused = click on overlay
    container.addEventListener('click', (e) => {
      this.handleClick(e);
    });

    logger.debug('Overlay event listeners attached');
  }

  /**
   * Handle click on overlay or outside focused widget
   * @param {Event} e - Click event
   */
  static handleClick(e) {
    const state = DashboardStateManager.getState();

    // Only handle when a widget is focused
    if (!state.focusedWidget) return;

    // Check if click was on the focused widget itself
    const clickedFocusedWidget = e.target.closest(
      '.dashboard-grid__cell--widget-focused, .dashboard-grid__cell--widget-active'
    );

    // If click was NOT on the focused widget, it must be on the overlay
    // (because unfocused widgets/sidebar have pointer-events: none)
    if (!clickedFocusedWidget) {
      logger.info('Click on overlay - defocusing widget');

      // Import navigation manager dynamically
      import('./dashboard-navigation-manager.js').then((module) => {
        const NavigationManager = module.default;
        NavigationManager.handleEscape();
      });
    }
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export {
  GridEventHandler,
  MenuEventHandler,
  SidebarEventHandler,
  OverlayEventHandler
};
