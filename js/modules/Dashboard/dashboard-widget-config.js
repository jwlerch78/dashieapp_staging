// js/modules/Dashboard/dashboard-widget-config.js
// Widget configuration for Dashboard grid
// v1.0 - 10/16/25 - Initial implementation for Phase 2

/**
 * Widget Configuration
 *
 * Defines the layout and behavior of widgets in the Dashboard grid.
 *
 * Grid Layout: 3 rows × 2 columns
 *   Row 1: 10% height - [Header][Clock]
 *   Row 2: 45% height - [Calendar (spans rows 2-3)][Agenda]
 *   Row 3: 45% height - [Calendar continues][Photos]
 *
 * Columns: 70% / 30% width split
 *
 * Widget Properties:
 * - id: Unique widget identifier
 * - row: Grid row (1-3)
 * - col: Grid column (1-2)
 * - rowSpan: Number of rows to span (default 1)
 * - colSpan: Number of columns to span (default 1)
 * - label: Display name
 * - url: Widget URL (for iframes)
 * - noCenter: If true, widget cannot be centered/focused
 * - focusScale: Scale multiplier when focused (default 1.2)
 * - selectable: If false, widget cannot be highlighted (navigation skips it)
 */

export const widgetConfig = [
  {
    id: 'header',
    row: 1,
    col: 1,
    rowSpan: 1,
    colSpan: 1,
    label: 'Header',
    url: null, // No iframe for header (native widget)
    noCenter: true,
    focusScale: 1.0,
    selectable: true
  },
  {
    id: 'clock',
    row: 1,
    col: 2,
    rowSpan: 1,
    colSpan: 1,
    label: 'Clock',
    url: null,
    noCenter: false,
    focusScale: 1.5,
    selectable: true
  },
  {
    id: 'main',
    row: 2,
    col: 1,
    rowSpan: 2, // SPANS 2 ROWS!
    colSpan: 1,
    label: 'Calendar',
    url: null,
    noCenter: false,
    focusScale: 1.2,
    selectable: true
  },
  {
    id: 'agenda',
    row: 2,
    col: 2,
    rowSpan: 1,
    colSpan: 1,
    label: 'Agenda',
    url: null,
    noCenter: false,
    focusScale: 1.4,
    selectable: true
  },
  {
    id: 'photos',
    row: 3,
    col: 2,
    rowSpan: 1,
    colSpan: 1,
    label: 'Photos',
    url: null,
    noCenter: false,
    focusScale: 1.4,
    selectable: true
  }
];

/**
 * Get widget configuration by ID
 * @param {string} widgetId - Widget ID
 * @returns {Object|null} Widget config or null if not found
 */
export function getWidgetById(widgetId) {
  return widgetConfig.find(w => w.id === widgetId) || null;
}

/**
 * Get widget at grid position
 * @param {number} row - Row (1-3)
 * @param {number} col - Column (1-2)
 * @returns {Object|null} Widget config or null if not found
 */
export function getWidgetAtPosition(row, col) {
  return widgetConfig.find(w => {
    // Check if position is within widget's span
    const rowInRange = row >= w.row && row < (w.row + w.rowSpan);
    const colInRange = col >= w.col && col < (w.col + w.colSpan);
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
    widgetConfig,
    getWidgetById,
    getWidgetAtPosition,
    isWidgetSelectable,
    canWidgetCenter,
    getWidgetFocusScale
  };
}
