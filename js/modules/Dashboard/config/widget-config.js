// js/modules/Dashboard/config/widget-config.js
// Widget configuration for Dashboard grid
// v2.0 - 10/23/25 - Made dynamic to support multi-page dashboard

/**
 * Widget Configuration - Dynamic
 *
 * Now reads from current page config instead of hardcoded array.
 * Supports multi-page dashboard with different layouts per page.
 *
 * Widget Properties:
 * - id: Unique widget identifier
 * - row: Grid row (1-3)
 * - col: Grid column (1-2)
 * - rowSpan: Number of rows to span (default 1)
 * - colSpan: Number of columns to span (default 1)
 * - label: Display name
 * - path: Widget HTML file path (for iframes)
 * - noCenter: If true, widget cannot be centered/focused
 * - focusScale: Scale multiplier when focused (default 1.2)
 * - selectable: If false, widget cannot be highlighted (navigation skips it)
 */

import { getPageConfig } from './page-config.js';

/**
 * Current widget configuration (cached)
 * Will be updated when page changes
 */
let currentWidgets = null;
let currentPageId = 'page1'; // Default to page1

/**
 * Set the current page (updates widget config cache)
 * @param {string} pageId - Page identifier
 */
export function setCurrentPage(pageId) {
  currentPageId = pageId;
  const pageConfig = getPageConfig(pageId);
  currentWidgets = pageConfig ? pageConfig.widgets : [];
}

/**
 * Get current widget configuration
 * @returns {Array} Widget config array
 */
export function getWidgetConfig() {
  // Lazy initialize
  if (!currentWidgets) {
    setCurrentPage(currentPageId);
  }
  return currentWidgets || [];
}

/**
 * Legacy export for backward compatibility
 * Returns dynamic config (getter function)
 */
Object.defineProperty(exports, 'widgetConfig', {
  get: function() {
    return getWidgetConfig();
  }
});

// Also export as const for static imports (will be evaluated at access time)
export const widgetConfig = getWidgetConfig();

/**
 * Get widget configuration by ID
 * @param {string} widgetId - Widget ID
 * @returns {Object|null} Widget config or null if not found
 */
export function getWidgetById(widgetId) {
  const config = getWidgetConfig();
  return config.find(w => w.id === widgetId) || null;
}

/**
 * Get widget at grid position
 * @param {number} row - Row (1-3)
 * @param {number} col - Column (1-2)
 * @returns {Object|null} Widget config or null if not found
 */
export function getWidgetAtPosition(row, col) {
  const config = getWidgetConfig();
  return config.find(w => {
    // Check if position is within widget's span
    const rowInRange = row >= w.row && row < (w.row + (w.rowSpan || 1));
    const colInRange = col >= w.col && col < (w.col + (w.colSpan || 1));
    return rowInRange && colInRange;
  }) || null;
}

/**
 * Check if widget is selectable
 * @param {string} widgetId - Widget ID
 * @returns {boolean} True if selectable
 */
export function isWidgetSelectable(widgetId) {
  const widget = getWidgetById(widgetId);
  return widget ? widget.selectable !== false : false;
}

/**
 * Check if widget can be centered
 * @param {string} widgetId - Widget ID
 * @returns {boolean} True if can be centered
 */
export function canWidgetCenter(widgetId) {
  const widget = getWidgetById(widgetId);
  return widget ? widget.noCenter !== true : true;
}

/**
 * Get widget focus scale
 * @param {string} widgetId - Widget ID
 * @returns {number} Focus scale multiplier
 */
export function getWidgetFocusScale(widgetId) {
  const widget = getWidgetById(widgetId);
  return widget ? (widget.focusScale || 1.2) : 1.2;
}

// =============================================================================
// EXPOSE GLOBALLY FOR DEBUGGING
// =============================================================================

if (typeof window !== 'undefined') {
  window.DashboardWidgetConfig = {
    get widgetConfig() { return getWidgetConfig(); },
    getWidgetConfig,
    setCurrentPage,
    getWidgetById,
    getWidgetAtPosition,
    isWidgetSelectable,
    canWidgetCenter,
    getWidgetFocusScale
  };
}
