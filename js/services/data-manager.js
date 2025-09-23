// js/services/data-manager.js - Refactored Data Manager (Orchestrator)
// CHANGE SUMMARY: Refactored into modular design with CalendarService, DataCache, and auto-loading on auth ready

import { createLogger } from '../utils/logger.js';
import { events as eventSystem, EVENTS } from '../utils/event-emitter.js';
import { CalendarService } from './calendar-service.js';
import { DataCache } from './data-cache.js';

const logger = createLogger('DataManager');

/**
 * Refactored data manager - orchestrates services and handles auto-loading
 * Much smaller now, focused on coordination rather than implementation
 */
export class DataManager {
  constructor(googleAPIClient) {
    this.googleAPI = googleAPIClient;
    
    // Initialize services
    this.calendarService = new CalendarService(googleAPIClient);
    this.cache = new DataCache();
    
    // Initialize cache entries
    this.cache.initialize('calendar', 5 * 60 * 1000); // 5 minutes
    this.cache.initialize('photos', 30 * 60 * 1000);  // 30 minutes
    
    logger.info('Data manager initialized with modular services', {
      calendarRefreshInterval: '5 min',
      photosRefreshInterval: '30 min'
    });
  }

  /**
   * Initialize with auth-ready auto-loading
   * @returns {Promise<void>}
   */
  async init() {
    logger.info('Data manager setting up auto-loading on auth ready');
    
    // FIXED: Auto-load calendar data when auth becomes ready
    eventSystem.auth.onSuccess(async (user) => {
      logger.info('Auth successful, auto-loading calendar data');
      
      setTimeout(async () => {
        try {
          await this.refreshCalendarData(true);
          logger.success('Auto-loaded calendar data on auth ready');
        } catch (error) {
          logger.error('Failed to auto-load calendar data', error);
        }
      }, 500); // Small delay to ensure services are ready
    });
    
    // Also try immediate load if already authenticated
    try {
      if (this.googleAPI) {
        const testResult = await this.googleAPI.testAccess();
        if (testResult.calendar) {
          logger.info('Already authenticated, loading calendar data immediately');
          setTimeout(() => this.refreshCalendarData(true), 100);
        }
      }
    } catch (error) {
      logger.debug('Not yet authenticated, waiting for auth ready event');
    }
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
      
      // FIXED: Emit proper events for widget broadcasting
      eventSystem.data.emitLoaded('calendar', freshData);
      
      // Schedule next refresh
      this.cache.scheduleRefresh('calendar', () => this.refreshCalendarData(true));
      
      // Send to any pending widget requests
      this.sendDataToPendingRequests('calendar');
      
    } catch (error) {
      this.cache.setLoading('calendar', false);
      eventSystem.data.emitError('calendar', error);
      this.sendErrorToPendingRequests('calendar', error.message);
      throw error;
    }
  }

  /**
   * Get calendar data (cached or fresh)
   * @param {boolean} allowStale - Allow returning stale data
   * @returns {Promise<Object>} Calendar data
   */
  async getCalendarData(allowStale = true) {
    const cachedData = this.cache.get('calendar', allowStale);
    
    if (cachedData) {
      logger.debug('Returning cached calendar data', {
        eventsCount: cachedData.events?.length || 0,
        calendarsCount: cachedData.calendars?.length || 0,
        isStale: cachedData.isStale
      });
      return cachedData;
    }
    
    // Trigger refresh if no cached data and not already loading
    if (!this.cache.isLoading('calendar')) {
      this.refreshCalendarData(true);
    }
    
    // Return loading state
    return {
      events: [],
      calendars: [],
      lastUpdated: null,
      isLoading: true
    };
  }

  // ==================== PHOTOS DATA MANAGEMENT ====================
  
  /**
   * Refresh photos data (placeholder for now)
   * @param {boolean} force - Force refresh
   * @returns {Promise<void>}
   */
  async refreshPhotosData(force = false) {
    if (!force && this.cache.isFresh('photos')) {
      logger.debug('Photos data is fresh, skipping refresh');
      return;
    }
    
    if (this.cache.isLoading('photos')) {
      logger.debug('Photos refresh already in progress');
      return;
    }

    this.cache.setLoading('photos', true);
    
    try {
      eventSystem.data.emitLoading('photos');
      
      // TODO: Implement photos service when ready
      const photosData = {
        albums: [],
        recentPhotos: [],
        lastUpdated: Date.now()
      };
      
      this.cache.set('photos', photosData);
      eventSystem.data.emitLoaded('photos', photosData);
      
      this.cache.scheduleRefresh('photos', () => this.refreshPhotosData(true));
      this.sendDataToPendingRequests('photos');
      
    } catch (error) {
      this.cache.setLoading('photos', false);
      eventSystem.data.emitError('photos', error);
      throw error;
    }
  }

  /**
   * Get photos data
   * @param {boolean} allowStale - Allow stale data
   * @returns {Promise<Object>} Photos data
   */
  async getPhotosData(allowStale = true) {
    const cachedData = this.cache.get('photos', allowStale);
    
    if (cachedData) {
      return cachedData;
    }
    
    if (!this.cache.isLoading('photos')) {
      this.refreshPhotosData(true);
    }
    
    return {
      albums: [],
      recentPhotos: [],
      lastUpdated: null,
      isLoading: true
    };
  }

  // ==================== WIDGET REQUEST HANDLING ====================

  /**
   * Handle calendar-specific requests
   * @param {string} requestType - Type of request
   * @param {Object} params - Request parameters  
   * @returns {Promise<Object>} Response data
   */
  async handleCalendarRequest(requestType, params) {
    return await this.calendarService.handleCalendarRequest(requestType, params);
  }

  /**
   * Handle photos requests (placeholder)
   * @param {string} requestType - Type of request
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  async handlePhotosRequest(requestType, params) {
    // TODO: Implement when photos service is ready
    return {
      albums: [],
      recentPhotos: [],
      lastUpdated: Date.now()
    };
  }

  /**
   * Send cached data to pending widget requests
   * @param {string} dataType - Type of data
   */
  sendDataToPendingRequests(dataType) {
    const pendingRequests = this.cache.getPendingRequests(dataType);
    
    if (pendingRequests.length > 0) {
      const data = this.cache.get(dataType, true);
      logger.debug(`Sending ${dataType} data to ${pendingRequests.length} pending requests`);
      
      // TODO: Send to widget messenger for broadcasting
      // This will be handled by the widget messenger listening to the emitLoaded events
    }
  }

  /**
   * Send error to pending widget requests
   * @param {string} dataType - Type of data
   * @param {string} errorMessage - Error message
   */
  sendErrorToPendingRequests(dataType, errorMessage) {
    const pendingRequests = this.cache.getPendingRequests(dataType);
    
    if (pendingRequests.length > 0) {
      logger.debug(`Sending ${dataType} error to ${pendingRequests.length} pending requests`);
      // TODO: Send error to widget messenger
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Force refresh all data
   * @returns {Promise<void>}
   */
  async refreshAllData() {
    logger.info('Refreshing all data');
    
    await Promise.allSettled([
      this.refreshCalendarData(true),
      this.refreshPhotosData(true)
    ]);
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    logger.info('Clearing all cached data');
    this.cache.clearAll();
  }

  /**
   * Get data manager status for debugging
   * @returns {Object} Status information
   */
  getStatus() {
    const cacheStatus = this.cache.getStatus();
    
    return {
      ...cacheStatus,
      services: {
        calendar: !!this.calendarService,
        photos: false // TODO: Update when photos service implemented
      }
    };
  }
}