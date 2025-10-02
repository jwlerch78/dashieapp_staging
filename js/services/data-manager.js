// js/services/data-manager.js
// CHANGE SUMMARY: Added periodic calendar refresh timer with configurable interval from settings (default 5 minutes)

import { createLogger } from '../utils/logger.js';
import { events as eventSystem, EVENTS } from '../utils/event-emitter.js';
import { CalendarService } from './calendar-service.js';
import { PhotoDataService } from './photo-data-service.js';
import { DataCache } from './data-cache.js';

const logger = createLogger('DataManager');

/**
 * Refactored data manager - orchestrates calendar and photo services
 * Both services follow same parent-managed pattern with JWT/RLS
 */
export class DataManager {
  constructor(googleAPIClient) {
    this.googleAPI = googleAPIClient;
    
    // Initialize services
    this.calendarService = new CalendarService(googleAPIClient);
    this.photoService = new PhotoDataService();
    this.cache = new DataCache();
    
    // Initialize cache entries
    this.cache.initialize('calendar', 5 * 60 * 1000); // 5 minutes
    this.cache.initialize('photos', 30 * 60 * 1000);  // 30 minutes
    
    // Track manual trigger state
    this.manualTriggerMode = false;
    this.authReadyEventReceived = false;
    
    // Periodic refresh timer
    this.periodicRefreshTimer = null;
    
    logger.info('Data manager initialized with modular services', {
      calendarRefreshInterval: '5 min',
      photosRefreshInterval: '30 min'
    });
  }

  /**
   * Initialize with option for manual trigger mode
   * @param {boolean} manualTrigger - If true, don't auto-load, wait for manual trigger
   * @returns {Promise<void>}
   */
  async init(manualTrigger = false) {
    this.manualTriggerMode = manualTrigger;
    
    // Initialize photo service if auth is ready
    await this.initializePhotoService();
    
    if (manualTrigger) {
      logger.info('Data manager initialized in MANUAL TRIGGER mode - will not auto-load');
      
      // Check if auth is already ready when initializing
      try {
        if (this.googleAPI) {
          const testResult = await this.googleAPI.testAccess();
          if (testResult.calendar) {
            logger.info('Auth already ready when DataManager initialized');
            this.authReadyEventReceived = true;
          }
        }
      } catch (error) {
        logger.debug('Auth not ready yet, will wait for auth event');
      }
      
      // Set up auth ready listener but don't auto-load
      eventSystem.auth.onSuccess(async (user) => {
        logger.info('Auth successful, but manual trigger mode - waiting for explicit trigger');
        this.authReadyEventReceived = true;
        
        // Initialize photo service now that auth is ready
        await this.initializePhotoService();
      });
      
    } else {
      logger.info('Data manager setting up auto-loading on auth ready');
      
      // Auto-load data when auth becomes ready
      eventSystem.auth.onSuccess(async (user) => {
        logger.info('Auth successful, auto-loading data');
        
        // Initialize photo service now that auth is ready
        await this.initializePhotoService();
        
        // Load calendar data
        await this.refreshCalendarData(true);
        
        // Load photo data
        await this.refreshPhotosData(true);
      });
    }
  }

  /**
   * Initialize photo service with JWT
   * @returns {Promise<boolean>}
   */
  async initializePhotoService() {
    try {
      // Check if JWT service is available
      const jwtService = window.jwtAuth;
      
      if (!jwtService) {
        logger.debug('Cannot initialize photo service: JWT service not available');
        return false;
      }
      
      // Get user ID from JWT service
      const userId = jwtService.currentUser?.id;
      
      if (!userId) {
        logger.debug('Cannot initialize photo service: No user ID', {
          hasJwtService: !!jwtService,
          jwtReady: jwtService?.isReady,
          hasJwtUser: !!jwtService?.currentUser
        });
        return false;
      }
      
      if (!jwtService || !jwtService.isReady) {
        logger.debug('Cannot initialize photo service: JWT not ready');
        return false;
      }
      
      const success = await this.photoService.initialize(userId, jwtService);
      
      if (success) {
        logger.info('Photo service initialized successfully');
      } else {
        logger.warn('Photo service initialization returned false');
      }
      
      return success;
      
    } catch (error) {
      logger.error('Failed to initialize photo service', error);
      return false;
    }
  }

  /**
   * Manually trigger data loading (for use after widget registration)
   * @returns {Promise<void>}
   */
  async triggerDataLoading() {
    if (!this.manualTriggerMode) {
      logger.warn('triggerDataLoading called but not in manual trigger mode');
      return;
    }

    if (!this.authReadyEventReceived) {
      logger.warn('triggerDataLoading called but auth not ready yet');
      return;
    }

    logger.info('Manual trigger: Starting data loading');
    
    try {
      // Load calendar data
      await this.refreshCalendarData(true);
      logger.success('Manual trigger: Calendar data loaded successfully');
      
      // Start periodic refresh after initial load
      this.startPeriodicRefresh();
      
    } catch (error) {
      logger.error('Manual trigger: Failed to load calendar data', error);
    }

    try {
      // Load photo data
      await this.refreshPhotosData(true);
      logger.success('Manual trigger: Photo data loaded successfully');
    } catch (error) {
      logger.error('Manual trigger: Failed to load photo data', error);
    }
  }

  /**
   * Start periodic calendar refresh timer
   * Reads interval from settings (default 5 minutes)
   */
  startPeriodicRefresh() {
    // Don't start if already running
    if (this.periodicRefreshTimer) {
      logger.debug('Periodic refresh already running');
      return;
    }

    // Get refresh interval from settings (default to 5 minutes)
    let intervalMinutes = 5;
    try {
      if (window.settingsController) {
        const settingValue = window.settingsController.getSetting('system.calendarRefreshInterval');
        if (settingValue && typeof settingValue === 'number' && settingValue > 0) {
          intervalMinutes = settingValue;
        }
      }
    } catch (error) {
      logger.debug('Could not read refresh interval from settings, using default', error);
    }

    const intervalMs = intervalMinutes * 60 * 1000;

    logger.info('Starting periodic calendar refresh', {
      intervalMinutes,
      intervalMs
    });

    this.periodicRefreshTimer = setInterval(async () => {
      logger.info('🔄 Periodic calendar refresh triggered');
      try {
        await this.refreshCalendarData(true);
        logger.success('✅ Periodic calendar refresh completed');
      } catch (error) {
        logger.error('❌ Periodic calendar refresh failed', error);
      }
    }, intervalMs);
  }

  /**
   * Stop periodic refresh timer (cleanup)
   */
  stopPeriodicRefresh() {
    if (this.periodicRefreshTimer) {
      clearInterval(this.periodicRefreshTimer);
      this.periodicRefreshTimer = null;
      logger.info('Periodic calendar refresh stopped');
    }
  }

  /**
   * Check if manual trigger is ready (auth completed)
   * @returns {boolean}
   */
  isReadyForManualTrigger() {
    return this.manualTriggerMode && this.authReadyEventReceived;
  }

  // ==================== CALENDAR DATA MANAGEMENT ====================

  /**
   * Refresh calendar data using CalendarService
   * @param {boolean} force - Force refresh even if data is fresh
   * @returns {Promise<void>}
   */
  async refreshCalendarData(force = false) {
    // Check if refresh is needed
    if (!force && this.cache.isFresh('calendar')) {
      logger.debug('Calendar data is fresh, skipping refresh');
      return;
    }
    
    if (this.cache.isLoading('calendar')) {
      logger.debug('Calendar refresh already in progress');
      return;
    }

    this.cache.setLoading('calendar', true);
    
    try {
      eventSystem.data.emitLoading('calendar');
      
      // Use calendar service for data refresh
      const options = {};
      const cachedData = this.cache.get('calendar', true);
      
      // Reuse calendar metadata if recent (optimization)
      if (cachedData?.calendars?.length > 0 && !this.cache.isStale('calendar')) {
        options.calendars = cachedData.calendars;
      }
      
      const freshData = await this.calendarService.refreshCalendarData(options);
      
      // Update cache
      this.cache.set('calendar', freshData);
      
      // Emit events for widget broadcasting
      eventSystem.data.emitLoaded('calendar', freshData);
      
      logger.debug('Calendar data refresh completed', {
        eventsCount: freshData.events?.length || 0,
        calendarsCount: freshData.calendars?.length || 0
      });
      
    } catch (error) {
      logger.error('Calendar data refresh failed', error);
      eventSystem.data.emitError('calendar', error);
      throw error;
    } finally {
      this.cache.setLoading('calendar', false);
    }
  }

  /**
   * Get calendar data from cache
   * @param {boolean} allowStale - Allow stale data
   * @returns {Object|null} Calendar data
   */
  getCalendarData(allowStale = true) {
    return this.cache.get('calendar', allowStale);
  }

  // ==================== PHOTOS DATA MANAGEMENT ====================

  /**
   * Refresh photos data using PhotoDataService
   * @param {boolean} force - Force refresh even if data is fresh
   * @returns {Promise<void>}
   */
  async refreshPhotosData(force = false) {
    // Check if photo service is initialized
    if (!this.photoService.isReady()) {
      logger.debug('Photo service not initialized, attempting to initialize');
      const initialized = await this.initializePhotoService();
      
      if (!initialized) {
        logger.warn('Cannot refresh photos: service not initialized');
        return;
      }
    }

    // Check if refresh is needed
    if (!force && this.cache.isFresh('photos')) {
      logger.debug('Photo data is fresh, skipping refresh');
      return;
    }
    
    if (this.cache.isLoading('photos')) {
      logger.debug('Photo refresh already in progress');
      return;
    }

    this.cache.setLoading('photos', true);
    
    try {
      eventSystem.data.emitLoading('photos');
      
      // Load photos from Supabase
      const freshData = await this.photoService.loadPhotos();
      
      // Update cache
      this.cache.set('photos', freshData);
      
      // Emit events for widget broadcasting
      eventSystem.data.emitLoaded('photos', freshData);
      
      logger.debug('Photo data refresh completed', {
        photosCount: freshData?.photos?.length || 0,
        foldersCount: freshData?.folders?.length || 0
      });
      
    } catch (error) {
      logger.error('Photo data refresh failed', error);
      eventSystem.data.emitError('photos', error);
      throw error;
    } finally {
      this.cache.setLoading('photos', false);
    }
  }

  /**
   * Get photo data from cache
   * @param {boolean} allowStale - Allow stale data
   * @returns {Object|null} Photo data
   */
  getPhotosData(allowStale = true) {
    return this.cache.get('photos', allowStale);
  }
}