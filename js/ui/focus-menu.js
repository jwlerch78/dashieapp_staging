// js/ui/focus-menu.js - Focus Menu UI Component
// v1.0 - 10/10/25 - Initial implementation for widget focus menu rendering and management

import { createLogger } from '../utils/logger.js';

const logger = createLogger('FocusMenuUI');

/**
 * Create and show the focus menu next to a widget
 * @param {HTMLElement} widgetElement - The focused widget element
 * @param {Object} menuConfig - Menu configuration from widget
 */
export function showFocusMenu(widgetElement, menuConfig) {
  // Remove any existing menu first
  hideFocusMenu();
  
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
  
  // Render menu items
  menuConfig.items.forEach((item, index) => {
    const isSelected = index === (menuConfig.defaultIndex || 0);
    const menuItem = createMenuItem(item, isSelected);
    menu.appendChild(menuItem);
  });
  
  // Add to DOM first (needed for positioning calculations)
  document.body.appendChild(menu);
  
  // Position menu to the left of centered widget
  positionMenu(menu, widgetElement);
  
  logger.info('✓ Focus menu shown', { itemCount: menuConfig.items.length });
}

/**
 * Create a single menu item element
 * @param {Object} item - Menu item data { id, label, icon }
 * @param {boolean} isSelected - Whether this item is initially selected
 * @returns {HTMLElement} Menu item element
 */
function createMenuItem(item, isSelected) {
  const div = document.createElement('div');
  div.className = 'focus-menu-item' + (isSelected ? ' selected' : '');
  div.dataset.itemId = item.id;
  
  // Icon span
  const iconSpan = document.createElement('span');
  iconSpan.className = 'menu-icon';
  iconSpan.textContent = item.icon || '•';
  
  // Label span
  const labelSpan = document.createElement('span');
  labelSpan.className = 'menu-label';
  labelSpan.textContent = item.label;
  
  div.appendChild(iconSpan);
  div.appendChild(labelSpan);
  
  return div;
}

/**
 * Position menu to the left of the centered widget
 * @param {HTMLElement} menu - Menu element to position
 * @param {HTMLElement} widgetElement - Widget element to position relative to
 */
function positionMenu(menu, widgetElement) {
  // Get widget's current position (after centering)
  const widgetRect = widgetElement.getBoundingClientRect();
  
  // Menu dimensions
  const menuWidth = 200; // Fixed width from CSS
  const gap = 20; // Space between menu and widget
  
  // Calculate position - to the left of the widget
  const left = widgetRect.left - menuWidth - gap;
  const top = widgetRect.top;
  
  // Apply position
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.height = `${widgetRect.height}px`; // Match widget height
  
  logger.debug('Menu positioned', {
    left,
    top,
    height: widgetRect.height,
    widgetRect: {
      left: widgetRect.left,
      top: widgetRect.top,
      width: widgetRect.width,
      height: widgetRect.height
    }
  });
  
  // Handle edge case: menu goes off left edge of screen
  if (left < 0) {
    logger.warn('Menu would go off screen, positioning at right side instead');
    // Position to the right of widget instead
    const rightPos = widgetRect.right + gap;
    menu.style.left = `${rightPos}px`;
  }
}

/**
 * Update which menu item is highlighted
 * @param {number} selectedIndex - Index of item to highlight
 */
export function updateMenuSelection(selectedIndex) {
  const menu = document.getElementById('widget-focus-menu');
  if (!menu) {
    logger.warn('Cannot update selection - menu not found');
    return;
  }
  
  const items = menu.querySelectorAll('.focus-menu-item');
  
  items.forEach((item, index) => {
    if (index === selectedIndex) {
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
export function dimFocusMenu() {
  const menu = document.getElementById('widget-focus-menu');
  if (menu) {
    menu.classList.add('dimmed');
    logger.debug('Menu dimmed');
  }
}

/**
 * Un-dim menu when user returns to menu
 */
export function undimFocusMenu() {
  const menu = document.getElementById('widget-focus-menu');
  if (menu) {
    menu.classList.remove('dimmed');
    logger.debug('Menu un-dimmed');
  }
}

/**
 * Remove the focus menu from DOM
 */
export function hideFocusMenu() {
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
export function isFocusMenuVisible() {
  return !!document.getElementById('widget-focus-menu');
}
