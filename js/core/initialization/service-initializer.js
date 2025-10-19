// js/core/initialization/service-initializer.js
// Data services initialization module
// Extracted from index.html inline JavaScript

import { createLogger } from '../../utils/logger.js';
import { sessionManager } from '../../data/auth/orchestration/session-manager.js';
import { initializeCalendarService } from '../../data/services/calendar-service.js';
import settingsService from '../../data/services/settings-service.js';
import heartbeatService from '../../data/services/heartbeat-service.js';
import { PhotosSettingsManager } from '../../../.legacy/widgets/photos/photos-settings-manager.js';
import { PhotoDataService } from '../../../.legacy/js/services/photo-data-service.js';
import { SUPABASE_CONFIG } from '../../data/auth/auth-config.js';

const logger = createLogger('ServiceInitializer');

/**
 * Initialize data services (EdgeClient, SettingsService, CalendarService, HeartbeatService)
 * @returns {Promise<void>}
 */
export async function initializeServices() {
  try {
    // Set window.currentDbConfig for legacy PhotoStorageService compatibility
    window.currentDbConfig = {
      supabaseUrl: SUPABASE_CONFIG.url,
      supabaseKey: SUPABASE_CONFIG.anonKey,
      supabaseAnonKey: SUPABASE_CONFIG.anonKey,
      environment: SUPABASE_CONFIG.environment
    };
    logger.debug('Legacy database config set', { environment: SUPABASE_CONFIG.environment });

    // Get EdgeClient from SessionManager
    const edgeClient = sessionManager.getEdgeClient();
    window.edgeClient = edgeClient;

    // Legacy compatibility: PhotoStorageService looks for window.jwtAuth
    window.jwtAuth = edgeClient;
    logger.debug('EdgeClient exposed as window.edgeClient and window.jwtAuth (legacy compat)');

    // Initialize SettingsService with EdgeClient for database operations
    settingsService.setEdgeClient(edgeClient);

    // Initialize CalendarService
    const calendarService = initializeCalendarService(edgeClient);
    await calendarService.initialize(); // Load calendar config and auto-enable primary calendar
    window.calendarService = calendarService; // Expose for console debugging

    // Initialize HeartbeatService to track dashboard status and version updates
    await heartbeatService.initialize(edgeClient);
    window.heartbeatService = heartbeatService; // Expose for console debugging

    // Initialize PhotoDataService
    const photoDataService = new PhotoDataService();
    const user = sessionManager.getUser();
    if (user && user.id) {
      await photoDataService.initialize(user.id, edgeClient);
      logger.verbose('PhotoDataService initialized', { userId: user.id });
    } else {
      logger.warn('PhotoDataService not initialized - no authenticated user');
    }

    // Expose PhotoDataService globally (like CalendarService)
    window.photoDataService = photoDataService;

    // Initialize PhotosSettingsManager with photo service
    const photosSettingsManager = new PhotosSettingsManager(photoDataService);
    window.photosSettingsManager = photosSettingsManager;
    logger.verbose('PhotosSettingsManager initialized');

    logger.verbose('Data services initialized');

  } catch (error) {
    logger.error('Failed to initialize data services', error);
    throw error;
  }
}
