// js/modules/Dashboard/components/focus-menu-renderer.js
// Focus Menu UI Renderer - Creates and manages focus menu overlay
// v1.0 - 10/23/25 - Ported from legacy for Phase 2 focus menu implementation

import { createLogger } from '../../../utils/logger.js';
import WidgetMessenger from '../../../core/widget-messenger.js';

const logger = createLogger('FocusMenuRenderer');

/**
 * Focus Menu Renderer
 *
 * Handles all visual rendering and DOM manipulation for focus menus.
 * Creates sectioned menus with actions and views, manages highlighting,
 * and handles mouse/touch interactions.
 */
class FocusMenuRenderer {
  /**
   * Create and show the focus menu next to a widget
   * @param {HTMLElement} widgetElement - The focused widget element
   * @param {Object} menuConfig - Menu configuration from widget
   */
  static showFocusMenu(widgetElement, menuConfig) {
    // Remove any existing menu first
    this.hideFocusMenu();

    if (!widgetElement || !menuConfig || !menuConfig.items) {
      logger.warn('Cannot show menu - invalid parameters', {
        hasWidget: !!widgetElement,
        hasConfig: !!menuConfig
      });
      return;
    }

    logger.info('Creating focus menu', {
      itemCount: menuConfig.items.length,
      defaultIndex: menuConfig.defaultIndex || 0
    });

    // Create menu container
    const menu = document.createElement('div');
    menu.id = 'widget-focus-menu';
    menu.className = 'focus-menu';

    // Build menu sections
    let currentIndex = 0;

    // Get current view from config (for active highlighting)
    const currentView = menuConfig.currentView || null;

    // Section 1: Action Buttons (type: 'action')
    const actionItems = menuConfig.items.filter(item => item.type === 'action');
    if (actionItems.length > 0) {
      const actionSection = this.createMenuSection(
        actionItems,
        currentIndex,
        menuConfig.defaultIndex,
        null,
        currentView
      );
      menu.appendChild(actionSection.element);
      currentIndex += actionItems.length;

      // Divider after actions
      const divider = document.createElement('div');
      divider.className = 'menu-divider';
      menu.appendChild(divider);
    }

    // Section 2: Views (type: 'view')
    const viewItems = menuConfig.items.filter(item => item.type === 'view');
    if (viewItems.length > 0) {
      const viewSection = this.createMenuSection(
        viewItems,
        currentIndex,
        menuConfig.defaultIndex,
        'Views',
        currentView
      );
      menu.appendChild(viewSection.element);
      currentIndex += viewItems.length;
    }

    // Add to DOM first (needed for positioning calculations)
    document.body.appendChild(menu);

    // Position menu to the left of centered widget
    this.positionMenu(menu, widgetElement);

    logger.info('✓ Focus menu shown', {
      actions: actionItems.length,
      views: viewItems.length,
      totalItems: menuConfig.items.length
    });
  }

  /**
   * Create a menu section with optional header and items
   * @param {Array} items - Array of menu items
   * @param {number} startIndex - Starting index for this section's items
   * @param {number} defaultIndex - The default selected index
   * @param {string} headerText - Optional section header text
   * @param {string} currentView - Current active view ID (for highlighting)
   * @returns {Object} Section element and item count
   */
  static createMenuSection(items, startIndex, defaultIndex, headerText = null, currentView = null) {
    const section = document.createElement('div');
    section.className = 'menu-section';

    // Add header if provided
    if (headerText) {
      const header = document.createElement('div');
      header.className = 'menu-section-header';
      header.textContent = headerText;
      section.appendChild(header);
    }

    // Add items
    items.forEach((item, relativeIndex) => {
      const absoluteIndex = startIndex + relativeIndex;
      const isSelected = absoluteIndex === defaultIndex;
      const isActive = item.id === currentView; // Check if this is the current view
      const menuItem = this.createMenuItem(item, isSelected, absoluteIndex, isActive);
      section.appendChild(menuItem);
    });

    return {
      element: section,
      itemCount: items.length
    };
  }

  /**
   * Create a single menu item element
   * @param {Object} item - Menu item data { id, label, type }
   * @param {boolean} isSelected - Whether this item is currently highlighted/selected
   * @param {number} index - Absolute index of this item in full menu
   * @param {boolean} isActive - Whether this is the current active view
   * @returns {HTMLElement} Menu item element
   */
  static createMenuItem(item, isSelected, index, isActive = false) {
    const div = document.createElement('div');

    // Use different class for action buttons vs regular items
    const classes = [];
    if (item.type === 'action') {
      classes.push('menu-action-button');
    } else {
      classes.push('focus-menu-item');
    }

    if (isSelected) classes.push('selected');
    if (isActive) classes.push('active');

    div.className = classes.join(' ');
    div.dataset.itemId = item.id;
    div.dataset.itemIndex = index;

    // Icon span - use SVG icons
    const iconSpan = document.createElement('span');
    iconSpan.className = 'menu-icon';
    iconSpan.innerHTML = this.getMenuIcon(item.id);

    // Label span
    const labelSpan = document.createElement('span');
    labelSpan.className = 'menu-label';
    labelSpan.textContent = item.label;

    div.appendChild(iconSpan);
    div.appendChild(labelSpan);

    // Add click event listener
    div.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event from bubbling
      this.handleMenuItemClick(item.id);
    });

    return div;
  }

  /**
   * Get SVG icon for menu item
   * @param {string} itemId - Menu item ID
   * @returns {string} SVG markup or fallback
   */
  static getMenuIcon(itemId) {
    const iconMap = {
      'go-to-today': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
      'monthly': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
      'week': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="14" x2="8" y2="18"></line><line x1="12" y1="14" x2="12" y2="18"></line><line x1="16" y1="14" x2="16" y2="18"></line></svg>`,
      'weekly': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="14" x2="8" y2="18"></line><line x1="12" y1="14" x2="12" y2="18"></line><line x1="16" y1="14" x2="16" y2="18"></line></svg>`,
      '1': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="2" x2="12" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
      'daily': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="2" x2="12" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
      '3': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="10" y1="14" x2="10" y2="18"></line><line x1="14" y1="14" x2="14" y2="18"></line></svg>`,
      '3day': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="10" y1="14" x2="10" y2="18"></line><line x1="14" y1="14" x2="14" y2="18"></line></svg>`
    };

    return iconMap[itemId] || '●'; // Fallback to bullet point
  }

  /**
   * Position menu to the left of the centered widget
   * @param {HTMLElement} menu - Menu element to position
   * @param {HTMLElement} widgetElement - Widget element to position relative to
   */
  static positionMenu(menu, widgetElement) {
    // Get widget's current position (after centering transform has been applied)
    const widgetRect = widgetElement.getBoundingClientRect();

    logger.debug('Positioning menu - widget rect:', {
      left: widgetRect.left,
      top: widgetRect.top,
      width: widgetRect.width,
      height: widgetRect.height
    });

    // Menu dimensions
    const menuWidth = 200; // Fixed width from CSS
    const gap = 20; // Space between menu and widget

    // ALWAYS position on the left
    const left = widgetRect.left - menuWidth - gap;
    const top = widgetRect.top;

    // Apply position
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.height = `${widgetRect.height}px`; // Match widget height

    // Check for off-screen positioning
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isOffScreenLeft = left < 0;
    const isOffScreenRight = (left + menuWidth) > viewportWidth;
    const isOffScreenTop = top < 0;
    const isOffScreenBottom = (top + widgetRect.height) > viewportHeight;

    if (isOffScreenLeft || isOffScreenRight || isOffScreenTop || isOffScreenBottom) {
      logger.warn('⚠️ Menu is partially or fully off-screen!', {
        offScreenDirections: [
          isOffScreenLeft && 'LEFT',
          isOffScreenRight && 'RIGHT',
          isOffScreenTop && 'TOP',
          isOffScreenBottom && 'BOTTOM'
        ].filter(Boolean)
      });
    }

    logger.debug('✓ Menu positioned', {
      finalPosition: { left, top, height: widgetRect.height }
    });
  }

  /**
   * Update which menu item is highlighted
   * @param {number} selectedIndex - Index of item to highlight
   */
  static updateMenuSelection(selectedIndex) {
    const menu = document.getElementById('widget-focus-menu');
    if (!menu) {
      logger.warn('Cannot update selection - menu not found');
      return;
    }

    // Select both action buttons and regular menu items
    const items = menu.querySelectorAll('.focus-menu-item, .menu-action-button');

    items.forEach((item) => {
      if (parseInt(item.dataset.itemIndex) === selectedIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    logger.debug('Menu selection updated', { selectedIndex });
  }

  /**
   * Dim menu when user moves to widget content
   */
  static dimFocusMenu() {
    const menu = document.getElementById('widget-focus-menu');
    if (menu) {
      menu.classList.add('dimmed');
      logger.debug('Menu dimmed');
    }
  }

  /**
   * Un-dim menu when user returns to menu
   */
  static undimFocusMenu() {
    const menu = document.getElementById('widget-focus-menu');
    if (menu) {
      menu.classList.remove('dimmed');
      logger.debug('Menu un-dimmed');
    }
  }

  /**
   * Remove the focus menu from DOM
   */
  static hideFocusMenu() {
    const menu = document.getElementById('widget-focus-menu');
    if (menu) {
      menu.remove();
      logger.info('✓ Focus menu hidden');
    }
  }

  /**
   * Check if focus menu is currently visible
   * @returns {boolean} True if menu exists in DOM
   */
  static isFocusMenuVisible() {
    return !!document.getElementById('widget-focus-menu');
  }

  /**
   * Handle menu item click
   * @param {string} itemId - ID of the clicked menu item
   */
  static handleMenuItemClick(itemId) {
    logger.info('Menu item clicked', { itemId });

    // Get dashboard state to find focused widget
    import('../dashboard-state-manager.js').then(({ default: DashboardStateManager }) => {
      const state = DashboardStateManager.getState();

      if (!state.focusedWidget) {
        logger.warn('No focused widget - cannot send menu selection');
        return;
      }

      // Send menu-item-selected message to widget via WidgetMessenger
      WidgetMessenger.sendCommandToWidget(state.focusedWidget, {
        type: 'command',
        action: 'menu-item-selected',
        itemId: itemId
      });

      logger.info('✓ Sent menu-item-selected via click', { itemId });
    });
  }
}

export default FocusMenuRenderer;
