// js/ui/focus-menu.js - Focus Menu UI Component
// v1.6 - 10/11/25 - Updated to read new state variables
// CHANGE SUMMARY: Now reads state.focusedWidget instead of state.selectedCell

import { createLogger } from '../utils/logger.js';

const logger = createLogger('FocusMenuUI');

/**
 * Create and show the focus menu next to a widget with sections
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
  
  logger.info('Creating sectioned focus menu', { 
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
    const actionSection = createMenuSection(actionItems, currentIndex, menuConfig.defaultIndex, null, currentView);
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
    const viewSection = createMenuSection(viewItems, currentIndex, menuConfig.defaultIndex, 'Views', currentView);
    menu.appendChild(viewSection.element);
    currentIndex += viewItems.length;
  }
  
  // Section 3: Controls Guide (at bottom)
  const controlsGuide = createControlsGuide(true); // Start in menu mode
  menu.appendChild(controlsGuide);
  
  // Add to DOM first (needed for positioning calculations)
  document.body.appendChild(menu);
  
  // Position menu to the left of centered widget
  positionMenu(menu, widgetElement);
  
  logger.info('✓ Sectioned focus menu shown', { 
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
function createMenuSection(items, startIndex, defaultIndex, headerText = null, currentView = null) {
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
    const menuItem = createMenuItem(item, isSelected, absoluteIndex, isActive);
    section.appendChild(menuItem);
  });
  
  return {
    element: section,
    itemCount: items.length
  };
}

/**
 * Create a single menu item element
 * @param {Object} item - Menu item data { id, label, icon, type }
 * @param {boolean} isSelected - Whether this item is currently highlighted/selected
 * @param {number} index - Absolute index of this item in full menu
 * @param {boolean} isActive - Whether this is the current active view
 * @returns {HTMLElement} Menu item element
 */
function createMenuItem(item, isSelected, index, isActive = false) {
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
  iconSpan.innerHTML = getMenuIcon(item.id);
  
  // Label span
  const labelSpan = document.createElement('span');
  labelSpan.className = 'menu-label';
  labelSpan.textContent = item.label;
  
  div.appendChild(iconSpan);
  div.appendChild(labelSpan);
  
  // NEW: Add click event listener
  div.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event from bubbling to grid
    handleMenuItemClick(item.id);
  });
  
  return div;
}

/**
 * Get SVG icon for menu item
 * Returns inline SVG matching the style from welcome screen
 */
function getMenuIcon(itemId) {
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
 * Create controls guide section
 * @param {boolean} inMenuMode - True if user is in menu, false if in widget
 * @returns {HTMLElement} Controls guide element
 */
function createControlsGuide(inMenuMode = true) {
  const guide = document.createElement('div');
  guide.className = 'controls-guide';
  guide.id = 'controls-guide';
  
  // Define controls based on mode
  const controls = inMenuMode ? [
    { icon: '↕', label: 'Navigate Menu' },
    { icon: '→', label: 'Control Widget' },
    { icon: '←', label: '' }, // Empty for menu mode
    { icon: '⏎', label: 'Select' },
    { icon: '⎋', label: 'Exit' }
  ] : [
    { icon: '↕', label: 'Scroll Time' },
    { icon: '→', label: 'Next Period' },
    { icon: '←', label: 'Prev Period' },
    { icon: '⏎', label: '' }, // Empty for widget mode
    { icon: '⎋', label: 'Return to Menu' }
  ];
  
  // Create control rows
  controls.forEach(control => {
    const row = document.createElement('div');
    row.className = 'control-row';
    
    row.innerHTML = `
      <span class="control-icon">${control.icon}</span>
      <span class="control-label${!control.label ? ' empty' : ''}">${control.label || '—'}</span>
    `;
    
    guide.appendChild(row);
  });
  
  return guide;
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
  
  // Select both action buttons and regular menu items
  const items = menu.querySelectorAll('.focus-menu-item, .menu-action-button');
  
  items.forEach((item, index) => {
    if (parseInt(item.dataset.itemIndex) === selectedIndex) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
  
  logger.debug('Menu selection updated', { selectedIndex });
}

/**
 * Update controls guide based on navigation state
 * @param {boolean} inMenuMode - True if user is in menu, false if in widget
 * @param {Object} widgetContext - Widget-specific labels for controls
 */
export function updateControlsGuide(inMenuMode, widgetContext = {}) {
  const guide = document.getElementById('controls-guide');
  if (!guide) {
    logger.warn('Cannot update controls guide - not found');
    return;
  }
  
  // Remove all existing rows
  guide.innerHTML = '';
  
  // Define controls based on mode
  const controls = inMenuMode ? [
    { icon: '↕', label: 'Navigate Menu' },
    { icon: '→', label: 'Control Widget' },
    { icon: '←', label: '' },
    { icon: '⏎', label: 'Select' },
    { icon: '⎋', label: 'Exit' }
  ] : [
    { icon: '↕', label: widgetContext.upDownLabel || 'Scroll Time' },
    { icon: '→', label: widgetContext.rightLabel || 'Next Period' },
    { icon: '←', label: widgetContext.leftLabel || 'Prev Period' },
    { icon: '⏎', label: widgetContext.selectLabel || '' },
    { icon: '⎋', label: 'Return to Menu' }
  ];
  
  // Create control rows
  controls.forEach(control => {
    const row = document.createElement('div');
    row.className = 'control-row';
    
    row.innerHTML = `
      <span class="control-icon">${control.icon}</span>
      <span class="control-label${!control.label ? ' empty' : ''}">${control.label || '—'}</span>
    `;
    
    guide.appendChild(row);
  });
  
  logger.debug('Controls guide updated', { inMenuMode, widgetContext });
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

/**
 * Handle menu item click
 * @param {string} itemId - ID of the clicked menu item
 */
async function handleMenuItemClick(itemId) {
  logger.info('Menu item clicked', { itemId });
  
  // Get the currently selected cell (widget)
  const { state } = await import('../core/state.js');
  
  if (!state.focusedWidget) {
    logger.warn('No focused widget - cannot send menu selection');
    return;
  }
  
  // Send menu-item-selected message to widget
  const iframe = state.focusedWidget.querySelector('iframe');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.postMessage({
        action: 'menu-item-selected',
        itemId: itemId
      }, '*');
      logger.info('✓ Sent menu-item-selected via click', { itemId });
    } catch (error) {
      logger.error('Failed to send menu selection', { error });
    }
  }
}
