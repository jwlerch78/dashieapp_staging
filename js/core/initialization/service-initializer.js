// js/core/initialization/service-initializer.js
// Data services initialization module
// Extracted from index.html inline JavaScript

import { createLogger } from '../../utils/logger.js';
import { sessionManager } from '../../data/auth/orchestration/session-manager.js';
import { initializeCalendarService } from '../../data/services/calendar-service.js';
import settingsService from '../../data/services/settings-service.js';

const logger = createLogger('ServiceInitializer');

/**
 * Initialize data services (EdgeClient, SettingsService, CalendarService)
 * @returns {Promise<void>}
 */
export async function initializeServices() {
  try {
    // Get EdgeClient from SessionManager
    const edgeClient = sessionManager.getEdgeClient();
    window.edgeClient = edgeClient;

    // Initialize SettingsService with EdgeClient for database operations
    settingsService.setEdgeClient(edgeClient);

    // Initialize CalendarService
    const calendarService = initializeCalendarService(edgeClient);

    logger.verbose('Data services initialized');

  } catch (error) {
    logger.error('Failed to initialize data services', error);
    throw error;
  }
}
