// js/widgets/shared/widget-id-helper.js
// Utility for widgets to determine their own ID from iframe element
// Supports multiple instances of same widget type (e.g., clock-1, clock-2, photos-1, etc.)

/**
 * Get the widget's ID from its iframe element
 *
 * Widgets are embedded in iframes with IDs like:
 * - 'widget-clock' → returns 'clock'
 * - 'widget-clock-1' → returns 'clock-1'
 * - 'widget-photos-2' → returns 'photos-2'
 *
 * @param {string} fallbackId - Fallback ID if detection fails (e.g., 'clock', 'photos')
 * @returns {string} Widget ID
 */
export function getWidgetId(fallbackId) {
  try {
    // Get the iframe element from parent document
    const iframe = window.frameElement;
    if (iframe && iframe.id) {
      // Extract widget ID from iframe ID (e.g., 'widget-clock-1' → 'clock-1')
      const match = iframe.id.match(/^widget-(.+)$/);
      if (match) {
        return match[1]; // e.g., 'clock-1', 'clock-2', or just 'clock'
      }
    }
  } catch (error) {
    console.warn('[WidgetIdHelper] Could not determine widget ID from iframe', error);
  }

  // Fallback to provided default
  return fallbackId;
}

/**
 * Get the widget's base type (without number suffix)
 *
 * Examples:
 * - 'clock' → 'clock'
 * - 'clock-1' → 'clock'
 * - 'photos-2' → 'photos'
 *
 * @param {string} widgetId - Full widget ID
 * @returns {string} Base widget type
 */
export function getWidgetType(widgetId) {
  return widgetId.split('-')[0];
}
