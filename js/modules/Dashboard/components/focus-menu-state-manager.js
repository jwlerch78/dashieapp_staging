// js/modules/Dashboard/components/focus-menu-state-manager.js
// Focus Menu State Manager - Tracks widget menu configurations
// v1.0 - 10/23/25 - Initial implementation

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('FocusMenuState');

/**
 * Focus Menu State Manager
 *
 * Manages widget focus menu configurations and state.
 * Widgets register their menu configs during initialization,
 * and this manager provides access to those configs.
 *
 * Registration happens via WidgetDataManager when widgets
 * send 'widget-config' messages with focusMenu data.
 */
class FocusMenuStateManager {
  // Map: widgetId → menuConfig
  static widgetMenuConfigs = new Map();

  /**
   * Register a widget's focus menu configuration
   * @param {string} widgetId - Widget identifier (e.g., 'calendar', 'photos')
   * @param {Object} menuConfig - Menu configuration object
   * @returns {boolean} Success status
   */
  static registerWidgetMenu(widgetId, menuConfig) {
    if (!widgetId) {
      logger.error('registerWidgetMenu: widgetId is required');
      return false;
    }

    if (!this.validateMenuConfig(menuConfig)) {
      logger.error('registerWidgetMenu: Invalid menu config', { widgetId, menuConfig });
      return false;
    }

    const isUpdate = this.widgetMenuConfigs.has(widgetId);
    this.widgetMenuConfigs.set(widgetId, menuConfig);
    logger.info('Widget menu registered', {
      widgetId,
      enabled: menuConfig.enabled,
      itemCount: menuConfig.items?.length || 0,
      isUpdate
    });

    // If this is an update (not initial registration) and menu is currently showing, update the UI
    if (isUpdate) {
      import('./focus-menu-renderer.js').then(({ default: FocusMenuRenderer }) => {
        FocusMenuRenderer.updateMenuHighlight(widgetId, menuConfig.currentView);
      });
    }

    return true;
  }

  /**
   * Unregister a widget's focus menu
   * @param {string} widgetId - Widget identifier
   * @returns {boolean} Success status
   */
  static unregisterWidgetMenu(widgetId) {
    if (!widgetId) return false;

    const existed = this.widgetMenuConfigs.has(widgetId);
    this.widgetMenuConfigs.delete(widgetId);

    if (existed) {
      logger.debug('Widget menu unregistered', { widgetId });
    }

    return existed;
  }

  /**
   * Get a widget's menu configuration
   * @param {string} widgetId - Widget identifier
   * @returns {Object|null} Menu config or null if not found
   */
  static getWidgetMenuConfig(widgetId) {
    if (!widgetId) return null;
    return this.widgetMenuConfigs.get(widgetId) || null;
  }

  /**
   * Check if widget has a focus menu registered
   * @param {string} widgetId - Widget identifier
   * @returns {boolean} True if widget has menu
   */
  static hasWidgetMenu(widgetId) {
    if (!widgetId) return false;
    const config = this.widgetMenuConfigs.get(widgetId);
    return config?.enabled === true;
  }

  /**
   * Get all registered widget IDs
   * @returns {string[]} Array of widget IDs with menus
   */
  static getRegisteredWidgets() {
    return Array.from(this.widgetMenuConfigs.keys());
  }

  /**
   * Get menu item by index
   * @param {string} widgetId - Widget identifier
   * @param {number} index - Menu item index
   * @returns {Object|null} Menu item or null
   */
  static getMenuItem(widgetId, index) {
    const config = this.getWidgetMenuConfig(widgetId);
    if (!config?.items) return null;

    if (index < 0 || index >= config.items.length) {
      logger.warn('Menu item index out of bounds', { widgetId, index, max: config.items.length - 1 });
      return null;
    }

    return config.items[index];
  }

  /**
   * Validate menu configuration structure
   * @param {Object} config - Menu config to validate
   * @returns {boolean} True if valid
   */
  static validateMenuConfig(config) {
    if (!config || typeof config !== 'object') {
      logger.warn('Menu config must be an object');
      return false;
    }

    // enabled must be a boolean
    if (typeof config.enabled !== 'boolean') {
      logger.warn('Menu config.enabled must be boolean');
      return false;
    }

    // If not enabled, no further validation needed
    if (!config.enabled) {
      return true;
    }

    // items must be an array
    if (!Array.isArray(config.items)) {
      logger.warn('Menu config.items must be an array');
      return false;
    }

    // Must have at least one item
    if (config.items.length === 0) {
      logger.warn('Menu config.items must not be empty');
      return false;
    }

    // Validate each item
    for (let i = 0; i < config.items.length; i++) {
      const item = config.items[i];

      if (!item.id || typeof item.id !== 'string') {
        logger.warn('Menu item missing valid id', { index: i, item });
        return false;
      }

      if (!item.label || typeof item.label !== 'string') {
        logger.warn('Menu item missing valid label', { index: i, item });
        return false;
      }

      if (!item.type || !['action', 'view'].includes(item.type)) {
        logger.warn('Menu item type must be "action" or "view"', { index: i, item });
        return false;
      }
    }

    // defaultIndex should be valid if provided
    if (config.defaultIndex !== undefined) {
      if (typeof config.defaultIndex !== 'number' ||
          config.defaultIndex < 0 ||
          config.defaultIndex >= config.items.length) {
        logger.warn('Menu config.defaultIndex out of bounds', {
          defaultIndex: config.defaultIndex,
          itemCount: config.items.length
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Clear all registered menus
   * (Used for testing/cleanup)
   */
  static clearAll() {
    const count = this.widgetMenuConfigs.size;
    this.widgetMenuConfigs.clear();
    logger.debug('All widget menus cleared', { count });
  }

  /**
   * Get stats about registered menus
   * @returns {Object} Stats object
   */
  static getStats() {
    const total = this.widgetMenuConfigs.size;
    const enabled = Array.from(this.widgetMenuConfigs.values())
      .filter(config => config.enabled === true).length;

    return {
      totalRegistered: total,
      enabledCount: enabled,
      disabledCount: total - enabled,
      widgetIds: this.getRegisteredWidgets()
    };
  }
}

export default FocusMenuStateManager;
