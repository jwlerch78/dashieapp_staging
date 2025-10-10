// js/ui/focus-menu.js - Focus Menu UI Component
// v1.3 - 10/10/25 3:15pm - Enhanced positioning debug logging
// CHANGE SUMMARY: Added comprehensive logging to positionMenu() showing widget rect, calculations, and off-screen detection for all edges

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
    const isActive = item.id === menuConfig.currentView; // Mark current view as active
    const menuItem = createMenuItem(item, isSelected, isActive);
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
 * @param {boolean} isSelected - Whether this item is currently highlighted/selected
 * @param {boolean} isActive - Whether this is the current active view
 * @returns {HTMLElement} Menu item element
 */
function createMenuItem(item, isSelected, isActive) {
  const div = document.createElement('div');
  const classes = ['focus-menu-item'];
  if (isSelected) classes.push('selected');
  if (isActive) classes.push('active');
  div.className = classes.join(' ');
  div.dataset.itemId = item.id;
  
  // Icon span - use SVG icons instead of emoji
  const iconSpan = document.createElement('span');
  iconSpan.className = 'menu-icon';
  iconSpan.innerHTML = getMenuIcon(item.id);
  
  // Label span
  const labelSpan = document.createElement('span');
  labelSpan.className = 'menu-label';
  labelSpan.textContent = item.label;
  
  div.appendChild(iconSpan);
  div.appendChild(labelSpan);
  
  return div;
}

/**
 * Get SVG icon for menu item
 * Returns inline SVG matching the style from welcome screen
 */
function getMenuIcon(itemId) {
  const iconMap = {
    'monthly': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    'weekly': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="14" x2="8" y2="18"></line><line x1="12" y1="14" x2="12" y2="18"></line><line x1="16" y1="14" x2="16" y2="18"></line></svg>`,
    'daily': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="2" x2="12" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    '3day': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="10" y1="14" x2="10" y2="18"></line><line x1="14" y1="14" x2="14" y2="18"></line></svg>`
  };
  
  return iconMap[itemId] || '\u2022'; // Fallback to bullet point
}

/**
 * Position menu to the left of the centered widget
 * @param {HTMLElement} menu - Menu element to position
 * @param {HTMLElement} widgetElement - Widget element to position relative to
 */
function positionMenu(menu, widgetElement) {
  // Get widget's current position (after centering transform has been applied)
  const widgetRect = widgetElement.getBoundingClientRect();
  
  logger.info('📍 Positioning menu - widget rect:', {
    left: widgetRect.left,
    top: widgetRect.top,
    right: widgetRect.right,
    bottom: widgetRect.bottom,
    width: widgetRect.width,
    height: widgetRect.height
  });
  
  // Menu dimensions
  const menuWidth = 200; // Fixed width from CSS
  const gap = 20; // Space between menu and widget
  
  // ALWAYS position on the left
  const left = widgetRect.left - menuWidth - gap;
  const top = widgetRect.top;
  
  logger.info('📍 Menu position calculated:', {
    left,
    top,
    menuWidth,
    gap,
    calculation: `${widgetRect.left} - ${menuWidth} - ${gap} = ${left}`
  });
  
  // Apply position
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.height = `${widgetRect.height}px`; // Match widget height
  
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isOffScreenLeft = left < 0;
  const isOffScreenRight = (left + menuWidth) > viewportWidth;
  const isOffScreenTop = top < 0;
  const isOffScreenBottom = (top + widgetRect.height) > viewportHeight;
  
  logger.info('✓ Menu positioned', {
    finalPosition: { left, top, height: widgetRect.height },
    viewport: { width: viewportWidth, height: viewportHeight },
    offScreen: {
      left: isOffScreenLeft,
      right: isOffScreenRight,
      top: isOffScreenTop,
      bottom: isOffScreenBottom
    }
  });
  
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
