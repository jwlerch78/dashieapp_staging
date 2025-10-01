// js/services/data-manager.js
// CHANGE SUMMARY: Added PhotoDataService integration - photos now managed at parent level with JWT/RLS (matches calendar pattern)

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
        
        // Initialize photo service
        await this.initializePhotoService();
        
        setTimeout(async () => {
          try {
            await this.refreshCalendarData(true);
            await this.refreshPhotosData(true);
            logger.success('Auto-loaded calendar and photo data on auth ready');
          } catch (error) {
            logger.error('Failed to auto-load data', error);
          }
        }, 500); // Small delay to ensure services are ready
      });
      
      // Also try immediate load if already authenticated
      try {
        if (this.googleAPI) {
          const testResult = await this.googleAPI.testAccess();
          if (testResult.calendar) {
            logger.info('Already authenticated, loading data immediately');
            setTimeout(async () => {
              await this.refreshCalendarData(true);
              await this.refreshPhotosData(true);
            }, 100);
          }
        }
      } catch (error) {
        logger.debug('Not yet authenticated, waiting for auth ready event');
      }
    }
  }

  /**
   * Initialize photo service with JWT authentication
   * @private
   */
  async initializePhotoService() {
    try {
      const jwtService = window.jwtAuth;
      
      // CRITICAL: Must use Supabase UUID from jwtAuth, not Google ID from dashieAuth
      const userId = jwtService?.currentUser?.id;
      
      if (!userId) {
        logger.debug('Cannot initialize photo service: no Supabase user ID', {
          hasJwtAuth: !!jwtService,
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
        photosCount: freshData.urls?.length || 0,
        folder: freshData.folder || 'all'
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
   * Get photos data from cache
   * @param {boolean} allowStale - Allow stale data
   * @returns {Object|null} Photos data
   */
  getPhotosData(allowStale = true) {
    return this.cache.get('photos', allowStale);
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
    logger.debug('All cached data cleared');
  }

  /**
   * Get cache status for debugging
   * @returns {Object} Cache status
   */
  getCacheStatus() {
    const calendarData = this.cache.get('calendar', true);
    const photosData = this.cache.get('photos', true);
    
    return {
      calendar: {
        hasData: !!calendarData,
        isFresh: this.cache.isFresh('calendar'),
        isStale: this.cache.isStale('calendar'),
        isLoading: this.cache.isLoading('calendar')
      },
      photos: {
        hasData: !!photosData,
        isFresh: this.cache.isFresh('photos'),
        isStale: this.cache.isStale('photos'),
        isLoading: this.cache.isLoading('photos')
      },
      photoServiceReady: this.photoService.isReady()
    };
  }
} 