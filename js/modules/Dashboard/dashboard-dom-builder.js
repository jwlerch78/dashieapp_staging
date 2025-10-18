// js/modules/Dashboard/dashboard-dom-builder.js
// Dashboard DOM creation functions
// v1.0 - 10/16/25 - Extracted from dashboard-ui-renderer.js

import { createLogger } from '../../utils/logger.js';
import { widgetConfig } from './dashboard-widget-config.js';

const logger = createLogger('DashboardDOMBuilder');

/**
 * Dashboard DOM Builder
 *
 * Pure DOM creation functions with no side effects.
 * Returns DOM elements for Dashboard components.
 *
 * Responsibilities:
 * - Create sidebar structure
 * - Create grid structure
 * - Create menu items
 *
 * Does NOT:
 * - Attach event listeners (handled by event-handlers.js)
 * - Manipulate CSS classes (handled by visual-effects.js)
 * - Manage state (handled by state-manager.js)
 */
class DOMBuilder {
  /**
   * Get current theme from body class
   * @returns {string} 'light' or 'dark'
   */
  static getCurrentTheme() {
    // Check body class for theme
    if (document.body.classList.contains('theme-light')) {
      return 'light';
    } else if (document.body.classList.contains('theme-dark')) {
      return 'dark';
    }

    // Check localStorage as fallback
    try {
      const saved = localStorage.getItem('dashie-theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (e) {
      // Ignore localStorage errors
    }

    // Default to light theme (matches DEFAULT_THEME in theme.js)
    return 'light';
  }

  /**
   * Create sidebar with menu structure
   * @returns {HTMLElement} Sidebar element
   */
  static createSidebar() {
    const sidebar = document.createElement('aside');
    sidebar.className = 'dashboard-sidebar';

    // Add Dashie logo at top
    const logo = document.createElement('img');
    logo.className = 'dashie-logo';
    // Set logo based on current theme
    const currentTheme = this.getCurrentTheme();
    logo.src = currentTheme === 'light'
      ? '/artwork/Dashie_Full_Logo_Black_Transparent.png'
      : '/artwork/Dashie_Full_Logo_White_Transparent.png';
    logo.alt = 'Dashie';
    sidebar.appendChild(logo);
    logger.debug('Logo created with theme', { theme: currentTheme, src: logo.src });

    const menu = document.createElement('div');
    menu.className = 'dashboard-menu';

    // Menu items configuration (reduced to 4 system functions only)
    const menuItems = [
      { id: 'reload', label: 'Reload', iconPath: '/artwork/icon-reload.svg' },
      { id: 'sleep', label: 'Sleep', iconPath: '/artwork/icon-sleep.svg' },
      { id: 'settings', label: 'Settings', iconPath: '/artwork/icon-settings.svg' },
      { id: 'exit', label: 'Exit', iconPath: '/artwork/icon-exit.svg' }
    ];

    // Create menu item buttons
    menuItems.forEach((item, index) => {
      const button = this.createMenuItem(item, index);
      menu.appendChild(button);
    });

    sidebar.appendChild(menu);

    logger.debug('Sidebar created', { menuItemCount: menuItems.length });
    return sidebar;
  }

  /**
   * Create a single menu item button
   * @param {Object} item - Menu item config (id, label, iconPath)
   * @param {number} index - Menu item index
   * @returns {HTMLElement} Button element
   */
  static createMenuItem(item, index) {
    const button = document.createElement('button');
    button.className = 'dashboard-menu__item';
    button.dataset.menuIndex = index;
    button.dataset.menuId = item.id;

    // Create icon image element
    const icon = document.createElement('img');
    icon.className = 'dashboard-menu__icon';
    icon.src = item.iconPath;
    icon.alt = item.label;

    // Create label span
    const label = document.createElement('span');
    label.className = 'dashboard-menu__label';
    label.textContent = item.label;

    button.appendChild(icon);
    button.appendChild(label);

    return button;
  }

  /**
   * Create widget grid
   * @returns {HTMLElement} Grid element
   */
  static createGrid() {
    const grid = document.createElement('main');
    grid.className = 'dashboard-grid';

    // Create widgets from configuration (3 rows × 2 columns with varying spans)
    widgetConfig.forEach(widget => {
      const cell = this.createGridCell(widget);
      grid.appendChild(cell);
    });

    logger.debug('Grid created', { widgetCount: widgetConfig.length });
    return grid;
  }

  /**
   * Create a single grid cell for a widget
   * @param {Object} widget - Widget configuration
   * @returns {HTMLElement} Cell element
   */
  static createGridCell(widget) {
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

    // Create widget iframe
    if (widget.path) {
      const iframe = document.createElement('iframe');
      iframe.id = `widget-${widget.id}`;
      iframe.className = 'widget-iframe';
      iframe.src = widget.path;
      iframe.sandbox = 'allow-scripts allow-same-origin';
      iframe.title = widget.label || widget.id;

      cell.appendChild(iframe);
    } else {
      // Fallback placeholder if no widget path provided
      const placeholder = document.createElement('div');
      placeholder.className = 'dashboard-grid__placeholder';
      placeholder.textContent = widget.label || widget.id;
      cell.appendChild(placeholder);
    }

    return cell;
  }

  /**
   * Create sidebar wrapper
   * @returns {HTMLElement} Wrapper element
   */
  static createSidebarWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'dashboard-sidebar-wrapper';
    return wrapper;
  }

  /**
   * Create main dashboard container
   * @returns {HTMLElement} Container element
   */
  static createContainer() {
    const container = document.createElement('div');
    container.className = 'dashboard';
    return container;
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export default DOMBuilder;
