// js/core/initialization/service-initializer.js
// Data services initialization module
// Extracted from index.html inline JavaScript

import { createLogger } from '../../utils/logger.js';
import { sessionManager } from '../../data/auth/orchestration/session-manager.js';
import { initializeCalendarService } from '../../data/services/calendar-service.js';
import { initializePhotoService } from '../../data/services/photo-service.js';
import { initializeWeatherService } from '../../data/services/weather-service.js';
import settingsService from '../../data/services/settings-service.js';
import heartbeatService from '../../data/services/heartbeat-service.js';
import { PhotosSettingsManager } from '../../modules/Settings/photos/photos-settings-manager.js';
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

    // Initialize WeatherService for clock widget
    const weatherService = initializeWeatherService();
    window.weatherService = weatherService; // Expose for console debugging
    logger.verbose('WeatherService initialized');

    // Initialize PhotoService (refactored)
    const user = sessionManager.getUser();
    if (user && user.id) {
      const photoService = initializePhotoService(user.id, edgeClient);
      logger.verbose('PhotoService initialized', { userId: user.id });

      // Expose globally as window.photoDataService for backward compatibility
      window.photoDataService = photoService;
      window.photoService = photoService; // Also expose with new name
    } else {
      logger.warn('PhotoService not initialized - no authenticated user');
      // Create empty placeholder for backward compatibility
      window.photoDataService = { isReady: () => false, isInitialized: false };
    }

    // Initialize PhotosSettingsManager with photo service
    if (window.photoDataService && window.photoDataService.isReady()) {
      const photosSettingsManager = new PhotosSettingsManager(window.photoDataService);
      window.photosSettingsManager = photosSettingsManager;
      logger.verbose('PhotosSettingsManager initialized');
    } else {
      logger.warn('PhotosSettingsManager not initialized - photo service not ready');
    }

    logger.verbose('Data services initialized');

  } catch (error) {
    logger.error('Failed to initialize data services', error);
    throw error;
  }
}
