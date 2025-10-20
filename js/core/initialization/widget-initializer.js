// js/core/initialization/widget-initializer.js
// Widget initialization module
// Extracted from index.html inline JavaScript

import { createLogger } from '../../utils/logger.js';
import { initializeWidgetDataManager } from '../../core/widget-data-manager.js';

const logger = createLogger('WidgetInitializer');

/**
 * Wait for widget iframes to be added to DOM
 * @returns {Promise<void>}
 */
async function waitForWidgetIframes() {
  const maxWait = 5000; // 5 seconds max
  const checkInterval = 100; // Check every 100ms
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const photosIframe = document.getElementById('widget-photos');
    const calendarIframe = document.getElementById('widget-main');
    const agendaIframe = document.getElementById('widget-agenda');

    if (photosIframe && calendarIframe && agendaIframe) {
      logger.verbose('🔍 DEBUG: Widget iframes found in DOM', {
        elapsed: Date.now() - startTime
      });
      return;
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  logger.warn('🔍 DEBUG: Timeout waiting for widget iframes');
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

    // Wait for widget iframes to be added to DOM
    logger.verbose('🔍 DEBUG: Waiting for widget iframes to load...');
    await waitForWidgetIframes();

    // Register widget iframes
    // IMPORTANT: Widgets load AFTER Settings applies theme, so they get correct theme from localStorage
    const clockIframe = document.getElementById('widget-clock');
    const headerIframe = document.getElementById('widget-header');
    const photosIframe = document.getElementById('widget-photos');
    const calendarIframe = document.getElementById('widget-main');
    const agendaIframe = document.getElementById('widget-agenda');

    logger.verbose('🔍 DEBUG: Found widget iframes', {
      clock: !!clockIframe,
      header: !!headerIframe,
      photos: !!photosIframe,
      calendar: !!calendarIframe,
      agenda: !!agendaIframe
    });

    if (clockIframe) {
      widgetDataManager.registerWidget('clock', clockIframe);
    }

    if (headerIframe) {
      widgetDataManager.registerWidget('header', headerIframe);
    }

    if (photosIframe) {
      widgetDataManager.registerWidget('photos', photosIframe);
    }

    if (calendarIframe) {
      widgetDataManager.registerWidget('main', calendarIframe);
    }

    if (agendaIframe) {
      widgetDataManager.registerWidget('agenda', agendaIframe);
    }

    logger.verbose('Widgets initialized');

  } catch (error) {
    logger.error('Failed to initialize widgets', error);
    throw error;
  }
}
