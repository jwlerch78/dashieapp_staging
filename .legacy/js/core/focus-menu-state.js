// js/core/focus-menu-state.js - Focus Menu State Management
// v1.0 - 10/10/25 - Initial implementation for widget focus menu system

import { state } from './state.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('FocusMenuState');

// Storage for widget menu configurations
const widgetMenuConfigs = new Map();

/**
 * Register a widget's menu configuration
 * Called when widget sends 'widget-config' message
 * @param {string} widgetId - Widget identifier ('calendar', 'photos', etc)
 * @param {Object} menuConfig - Menu configuration object
 */
export function registerWidgetMenu(widgetId, menuConfig) {
  if (!menuConfig || !menuConfig.enabled) {
    logger.debug('Menu config not enabled for widget', { widgetId });
    return;
  }
  
  // Validate menu config
  if (!menuConfig.items || !Array.isArray(menuConfig.items) || menuConfig.items.length === 0) {
    logger.warn('Invalid menu config - no items', { widgetId });
    return;
  }
  
  widgetMenuConfigs.set(widgetId, menuConfig);
  logger.info('✓ Registered focus menu', { 
    widgetId, 
    itemCount: menuConfig.items.length,
    defaultIndex: menuConfig.defaultIndex || 0
  });
}

/**
 * Get menu config for a widget
 * @param {string} widgetId - Widget identifier
 * @returns {Object|undefined} Menu configuration or undefined if not registered
 */
export function getWidgetMenuConfig(widgetId) {
  return widgetMenuConfigs.get(widgetId);
}

/**
 * Check if widget has focus menu enabled
 * @param {string} widgetId - Widget identifier
 * @returns {boolean} True if widget has menu registered
 */
export function hasWidgetMenu(widgetId) {
  const config = widgetMenuConfigs.get(widgetId);
  return config && config.enabled;
}

/**
 * Move menu selection up or down
 * @param {string} direction - 'up' or 'down'
 * @returns {Object|null} New selected item or null if no change
 */
export function moveMenuSelection(direction) {
  const { menuConfig, selectedIndex } = state.focusMenuState;
  
  if (!menuConfig || !menuConfig.items) {
    logger.warn('Cannot move selection - no menu config');
    return null;
  }
  
  let newIndex = selectedIndex;
  
  if (direction === 'up') {
    newIndex = Math.max(0, selectedIndex - 1);
  } else if (direction === 'down') {
    newIndex = Math.min(menuConfig.items.length - 1, selectedIndex + 1);
  }
  
  // No change if already at boundary
  if (newIndex === selectedIndex) {
    logger.debug('Already at menu boundary', { direction, index: selectedIndex });
    return null;
  }
  
  // Update state
  state.focusMenuState.selectedIndex = newIndex;
  state.focusMenuState.currentSelection = menuConfig.items[newIndex].id;
  
  logger.debug('Menu selection moved', { 
    direction, 
    oldIndex: selectedIndex, 
    newIndex, 
    itemId: menuConfig.items[newIndex].id 
  });
  
  return menuConfig.items[newIndex];
}

/**
 * Get currently selected menu item
 * @returns {Object|null} Currently selected item or null
 */
export function getCurrentMenuItem() {
  const { menuConfig, selectedIndex } = state.focusMenuState;
  
  if (!menuConfig || !menuConfig.items) {
    return null;
  }
  
  return menuConfig.items[selectedIndex] || null;
}

/**
 * Get all registered widget IDs that have focus menus
 * @returns {Array<string>} Array of widget IDs
 */
export function getRegisteredWidgets() {
  return Array.from(widgetMenuConfigs.keys());
}

/**
 * Clear all registered menu configs (useful for testing/reset)
 */
export function clearAllMenuConfigs() {
  widgetMenuConfigs.clear();
  logger.info('Cleared all menu configs');
}
