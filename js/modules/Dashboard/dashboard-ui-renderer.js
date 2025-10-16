// js/modules/Dashboard/dashboard-ui-renderer.js
// Dashboard UI rendering and visual updates
// v1.0 - 10/16/25 - Initial implementation for Phase 2

import { createLogger } from '../../utils/logger.js';
import DashboardStateManager from './dashboard-state-manager.js';
import { widgetConfig, getWidgetFocusScale } from './dashboard-widget-config.js';

const logger = createLogger('DashboardUI');

/**
 * UI Renderer
 *
 * Handles all Dashboard DOM rendering and visual updates:
 * - Create initial DOM structure
 * - Update focus indicators
 * - Show/hide menu
 * - Update menu selection
 * - Focus/defocus widgets
 *
 * Uses CSS classes + CSS variables (no inline styles)
 * Follows BEM naming convention
 */
class UIRenderer {
  static container = null;
  static isInitialized = false;

  /**
   * Initialize UI renderer
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
   * Creates DOM structure and attaches to document
   */
  static render() {
    if (this.container) {
      logger.debug('Dashboard already rendered, showing existing UI');
      this.container.classList.remove('dashboard--hidden');
      return;
    }

    logger.info('Rendering Dashboard UI...');

    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'dashboard';

    // Create sidebar
    const sidebar = this.createSidebar();
    this.container.appendChild(sidebar);

    // Create grid
    const grid = this.createGrid();
    this.container.appendChild(grid);

    // Attach to document
    document.body.appendChild(this.container);

    // Update focus to initial position
    this.updateFocus();

    logger.success('Dashboard UI rendered');
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

  /**
   * Create sidebar with menu
   * @private
   * @returns {HTMLElement} Sidebar element
   */
  static createSidebar() {
    const sidebar = document.createElement('aside');
    sidebar.className = 'dashboard-sidebar';

    const menu = document.createElement('div');
    menu.className = 'dashboard-menu';

    // Menu items
    const menuItems = [
      { id: 'calendar', label: 'Calendar', icon: '📅' },
      { id: 'map', label: 'Map', icon: '🗺️' },
      { id: 'camera', label: 'Camera', icon: '📷' },
      { id: 'reload', label: 'Reload', icon: '🔄' },
      { id: 'sleep', label: 'Sleep', icon: '😴' },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
      { id: 'exit', label: 'Exit', icon: '🚪' }
    ];

    menuItems.forEach((item, index) => {
      const button = document.createElement('button');
      button.className = 'dashboard-menu__item';
      button.dataset.menuIndex = index;
      button.dataset.menuId = item.id;
      button.innerHTML = `
        <span class="dashboard-menu__icon">${item.icon}</span>
        <span class="dashboard-menu__label">${item.label}</span>
      `;
      menu.appendChild(button);
    });

    sidebar.appendChild(menu);

    return sidebar;
  }

  /**
   * Create widget grid
   * @private
   * @returns {HTMLElement} Grid element
   */
  static createGrid() {
    const grid = document.createElement('main');
    grid.className = 'dashboard-grid';

    // Create widgets from configuration (3 rows × 2 columns with varying spans)
    widgetConfig.forEach(widget => {
      const cell = document.createElement('div');
      cell.className = 'dashboard-grid__cell';

      // Add span classes if needed
      if (widget.rowSpan > 1) {
        cell.classList.add(`dashboard-grid__cell--rowspan-${widget.rowSpan}`);
      }
      if (widget.colSpan > 1) {
        cell.classList.add(`dashboard-grid__cell--colspan-${widget.colSpan}`);
      }

      // Set data attributes
      cell.dataset.row = widget.row;
      cell.dataset.col = widget.col;
      cell.dataset.widgetId = widget.id;
      cell.dataset.rowSpan = widget.rowSpan;
      cell.dataset.colSpan = widget.colSpan;
      cell.dataset.noCenter = widget.noCenter || false;
      cell.dataset.focusScale = widget.focusScale || 1.2;
      cell.dataset.selectable = widget.selectable !== false;

      // Placeholder content
      const placeholder = document.createElement('div');
      placeholder.className = 'dashboard-grid__placeholder';
      placeholder.textContent = widget.label || widget.id;

      cell.appendChild(placeholder);
      grid.appendChild(cell);
    });

    return grid;
  }

  /**
   * Update focus indicator
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

    // Add focus to current cell
    const focusedCell = this.container.querySelector(
      `.dashboard-grid__cell[data-row="${row}"][data-col="${col}"]`
    );

    if (focusedCell) {
      focusedCell.classList.add('dashboard-grid__cell--focused');
      logger.debug('Focus updated', { row, col });
    }
  }

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
   * Focus a widget (center and overlay)
   * @param {string} widgetId - Widget ID to focus
   */
  static focusWidget(widgetId) {
    if (!this.container) return;

    const cell = this.container.querySelector(
      `.dashboard-grid__cell[data-widget-id="${widgetId}"]`
    );

    if (cell) {
      // Capture the cell's current dimensions BEFORE centering
      const rect = cell.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Get focusScale from widget configuration
      const focusScale = getWidgetFocusScale(widgetId) || parseFloat(cell.dataset.focusScale) || 1.2;

      // Set dimensions and scale as CSS variables
      cell.style.setProperty('--cell-width', `${width}px`);
      cell.style.setProperty('--cell-height', `${height}px`);
      cell.style.setProperty('--widget-focus-scale', focusScale.toString());

      // Add focused class (will trigger centering animation)
      cell.classList.add('dashboard-grid__cell--widget-focused');
      this.container.classList.add('dashboard--widget-focused');

      logger.info('Widget focused in UI', { widgetId, width, height });
    }
  }

  /**
   * Defocus widget (return to grid view)
   */
  static defocusWidget() {
    if (!this.container) return;

    // Remove widget focus from all cells
    const cells = this.container.querySelectorAll('.dashboard-grid__cell');
    cells.forEach(cell => {
      cell.classList.remove('dashboard-grid__cell--widget-focused');

      // Clear CSS variables
      cell.style.removeProperty('--cell-width');
      cell.style.removeProperty('--cell-height');
      cell.style.removeProperty('--widget-focus-scale');
    });

    this.container.classList.remove('dashboard--widget-focused');

    logger.info('Widget defocused in UI');
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
}

// =============================================================================
// EXPORT
// =============================================================================

export default UIRenderer;
