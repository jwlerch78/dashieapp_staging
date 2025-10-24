// js/core/initialization/widget-initializer.js
// Widget initialization module
// Extracted from index.html inline JavaScript

import { createLogger } from '../../utils/logger.js';
import { initializeWidgetDataManager } from '../../core/widget-data-manager.js';
import { getWidgetConfig } from '../../modules/Dashboard/config/widget-config.js';

const logger = createLogger('WidgetInitializer');

/**
 * Wait for widget iframes to be added to DOM
 * @param {Array<string>} widgetIds - Widget IDs to wait for
 * @returns {Promise<void>}
 */
async function waitForWidgetIframes(widgetIds = []) {
  const maxWait = 5000; // 5 seconds max
  const checkInterval = 100; // Check every 100ms
  const startTime = Date.now();

  // If no widget IDs specified, wait for legacy widgets
  if (widgetIds.length === 0) {
    widgetIds = ['photos', 'main', 'agenda'];
  }

  while (Date.now() - startTime < maxWait) {
    const foundAll = widgetIds.every(id => {
      const iframe = document.getElementById(`widget-${id}`);
      return !!iframe;
    });

    if (foundAll) {
      logger.verbose('🔍 DEBUG: Widget iframes found in DOM', {
        elapsed: Date.now() - startTime,
        widgetIds
      });
      return;
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  logger.warn('🔍 DEBUG: Timeout waiting for widget iframes', { widgetIds });
}

/**
 * Initialize widgets AFTER theme is applied
 * @returns {Promise<void>}
 */
export async function initializeWidgets() {
  try {
    // Initialize WidgetDataManager
    const widgetDataManager = initializeWidgetDataManager();
    window.widgetDataManager = widgetDataManager; // Expose for debugging

    // Get current widget configuration
    const widgetConfig = getWidgetConfig();
    const widgetIds = widgetConfig.map(w => w.id);

    logger.verbose('🔍 DEBUG: Widget config loaded', {
      widgetIds,
      count: widgetIds.length
    });

    // Wait for widget iframes to be added to DOM
    logger.verbose('🔍 DEBUG: Waiting for widget iframes to load...');
    await waitForWidgetIframes(widgetIds);

    // Automatically register all widget iframes from config
    const registeredWidgets = [];
    const missingWidgets = [];

    for (const widgetId of widgetIds) {
      const iframe = document.getElementById(`widget-${widgetId}`);

      if (iframe) {
        widgetDataManager.registerWidget(widgetId, iframe);
        registeredWidgets.push(widgetId);
      } else {
        missingWidgets.push(widgetId);
      }
    }

    logger.verbose('🔍 DEBUG: Widget registration complete', {
      registered: registeredWidgets,
      missing: missingWidgets,
      registeredCount: registeredWidgets.length,
      missingCount: missingWidgets.length
    });

    if (missingWidgets.length > 0) {
      logger.warn('Some widgets from config were not found in DOM', { missingWidgets });
    }

    logger.verbose('Widgets initialized');

  } catch (error) {
    logger.error('Failed to initialize widgets', error);
    throw error;
  }
}
