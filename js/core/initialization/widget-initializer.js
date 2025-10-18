// js/core/initialization/widget-initializer.js
// Widget initialization module
// Extracted from index.html inline JavaScript

import { createLogger } from '../../utils/logger.js';
import { initializeWidgetDataManager } from '../../core/widget-data-manager.js';

const logger = createLogger('WidgetInitializer');

/**
 * Initialize widgets AFTER theme is applied
 * @returns {Promise<void>}
 */
export async function initializeWidgets() {
  try {
    // Initialize WidgetDataManager
    const widgetDataManager = initializeWidgetDataManager();

    // Register widget iframes
    // IMPORTANT: Widgets load AFTER Settings applies theme, so they get correct theme from localStorage
    const clockIframe = document.getElementById('widget-clock');
    const headerIframe = document.getElementById('widget-header');

    if (clockIframe) {
      widgetDataManager.registerWidget('clock', clockIframe);
    }

    if (headerIframe) {
      widgetDataManager.registerWidget('header', headerIframe);
    }

    logger.verbose('Widgets initialized');

  } catch (error) {
    logger.error('Failed to initialize widgets', error);
    throw error;
  }
}
