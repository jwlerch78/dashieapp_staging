// js/services/data-manager.js - Centralized Data Caching and Refresh System
// CHANGE SUMMARY: Removed redundant API testing since simple-auth already handles it, simplified init method to be truly lazy

import { createLogger } from '../utils/logger.js';
import { events as eventSystem, EVENTS } from '../utils/event-emitter.js';

const logger = createLogger('DataManager');

/**
 * Centralized data manager for Google APIs data caching and refresh
 * Handles calendar and photos data with intelligent caching and refresh strategies
 */
export class DataManager {
  constructor(googleAPIClient) {
    this.googleAPI = googleAPIClient;
    
    // Data cache with refresh intervals
    this.dataCache = {
      calendar: {
        events: [],
        calendars: [],
        lastUpdated: null,
        refreshInterval: 5 * 60 * 1000, // 5 minutes
        isLoading: false
      },
      photos: {
        albums: [],
        recentPhotos: [],
        lastUpdated: null,
        refreshInterval: 30 * 60 * 1000, // 30 minutes
        isLoading: false
      }
    };
    
    // Refresh timers
    this.refreshTimers = {};
    
    // Pending widget requests queue
    this.pendingWidgetRequests = [];
    
    logger.info('Data manager initialized', {
      calendarRefreshInterval: this.dataCache.calendar.refreshInterval / 1000 / 60 + ' min',
      photosRefreshInterval: this.dataCache.photos.refreshInterval / 1000 / 60 + ' min'
    });
  }

  /**
   * Initialize data manager - now truly lazy, no redundant API calls
   * @returns {Promise<void>}
   */
  async init() {
    logger.info('Data manager initialized - ready for on-demand data requests');
    // No initial API testing or data fetching - completely lazy
  }

  // ==================== CALENDAR DATA MANAGEMENT ====================

  /**
   * Refresh calendar data from Google APIs
   * @param {boolean} force - Force refresh even if data is fresh
   * @returns {Promise<void>}
   */
  async refreshCalendarData(force = false) {
    const cacheData = this.dataCache.calendar;
    
    // Check if refresh is needed
    if (!force && this.isDataFresh('calendar')) {
      logger.debug('Calendar data is fresh, skipping refresh');
      return;
    }
    
    if (cacheData.isLoading) {
      logger.debug('Calendar refresh already in progress');
      return;
    }

    logger.data('refresh', 'calendar', 'pending');
    cacheData.isLoading = true;
    
    const timer = logger.startTimer('Calendar Data Refresh');
    
    try {
      eventSystem.data.emitLoading('calendar');
      
      // OPTIMIZED: Pass calendar list to getAllCalendarEvents to avoid redundant API call
      let calendarsPromise;
      let eventsPromise;
      
      // If we have recent calendar metadata, reuse it to avoid redundant calls
      if (cacheData.calendars.length > 0 && cacheData.lastUpdated && 
          (Date.now() - cacheData.lastUpdated) < 5 * 60 * 1000) {
        // Calendar metadata is less than 5 minutes old, reuse it
        calendarsPromise = Promise.resolve(cacheData.calendars);
        eventsPromise = this.googleAPI.getAllCalendarEvents({ calendars: cacheData.calendars });
        logger.debug('Reusing cached calendar metadata to avoid redundant API call');
      } else {
        // Need fresh calendar metadata
        calendarsPromise = this.googleAPI.getCalendarList();
        eventsPromise = calendarsPromise.then(calendars => 
          this.googleAPI.getAllCalendarEvents({ calendars })
        );
        logger.debug('Fetching fresh calendar metadata');
      }
      
      const [events, calendars] = await Promise.all([eventsPromise, calendarsPromise]);
      
      const duration = timer();
      
      // Update cache
      cacheData.events = events;
      cacheData.calendars = calendars;
      cacheData.lastUpdated = Date.now();
      cacheData.isLoading = false;
      
      logger.data('refresh', 'calendar', 'success', {
        eventsCount: events.length,
        calendarsCount: calendars.length,
        duration
      });
      
      eventSystem.data.emitLoaded('calendar', {
        events,
        calendars,
        lastUpdated: cacheData.lastUpdated
      });
      
      // Schedule next refresh
      this.scheduleDataRefresh('calendar');
      
      // Send to pending widget requests
      this.sendDataToPendingRequests('calendar');
      
    } catch (error) {
      timer();
      cacheData.isLoading = false;
      
      logger.data('refresh', 'calendar', 'error', error.message);
      eventSystem.data.emitError('calendar', error);
      
      // Send error to widgets
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
    const cacheData = this.dataCache.calendar;
    
    // Return cached data if available and fresh (or stale is allowed)
    if (cacheData.lastUpdated && (allowStale || this.isDataFresh('calendar'))) {
      logger.debug('Returning cached calendar data', {
        eventsCount: cacheData.events.length,
        calendarsCount: cacheData.calendars.length,
        isStale: !this.isDataFresh('calendar')
      });
      
      return {
        events: cacheData.events,
        calendars: cacheData.calendars,
        lastUpdated: cacheData.lastUpdated,
        isStale: !this.isDataFresh('calendar')
      };
    }
    
    // Refresh data if needed
    if (!cacheData.isLoading) {
      this.refreshCalendarData(true);
    }
    
    // Return current cache (might be empty on first run)
    return {
      events: cacheData.events,
      calendars: cacheData.calendars,
      lastUpdated: cacheData.lastUpdated,
      isLoading: cacheData.isLoading
    };
  }

  // ==================== PHOTOS DATA MANAGEMENT ====================

  /**
   * Refresh photos data from Google APIs
   * @param {boolean} force - Force refresh even if data is fresh
   * @returns {Promise<void>}
   */
  async refreshPhotosData(force = false) {
    const cacheData = this.dataCache.photos;
    
    // Check if refresh is needed
    if (!force && this.isDataFresh('photos')) {
      logger.debug('Photos data is fresh, skipping refresh');
      return;
    }
    
    if (cacheData.isLoading) {
      logger.debug('Photos refresh already in progress');
      return;
    }

    logger.data('refresh', 'photos', 'pending');
    cacheData.isLoading = true;
    
    const timer = logger.startTimer('Photos Data Refresh');
    
    try {
      eventSystem.data.emitLoading('photos');
      
      // TODO: Implement when Photos API is ready
      // For now, return empty data
      const albums = []; // await this.googleAPI.getPhotoAlbums();
      const recentPhotos = []; // await this.googleAPI.getRecentPhotos();
      
      const duration = timer();
      
      // Update cache
      cacheData.albums = albums;
      cacheData.recentPhotos = recentPhotos;
      cacheData.lastUpdated = Date.now();
      cacheData.isLoading = false;
      
      logger.data('refresh', 'photos', 'success', {
        albumsCount: albums.length,
        photosCount: recentPhotos.length,
        duration
      });
      
      eventSystem.data.emitLoaded('photos', {
        albums,
        recentPhotos,
        lastUpdated: cacheData.lastUpdated
      });
      
      // Schedule next refresh
      this.scheduleDataRefresh('photos');
      
      // Send to pending widget requests
      this.sendDataToPendingRequests('photos');
      
    } catch (error) {
      timer();
      cacheData.isLoading = false;
      
      logger.data('refresh', 'photos', 'error', error.message);
      eventSystem.data.emitError('photos', error);
      
      throw error;
    }
  }

  /**
   * Get photos data (cached or fresh)
   * @param {boolean} allowStale - Allow returning stale data
   * @returns {Promise<Object>} Photos data
   */
  async getPhotosData(allowStale = true) {
    const cacheData = this.dataCache.photos;
    
    // Return cached data if available and fresh (or stale is allowed)
    if (cacheData.lastUpdated && (allowStale || this.isDataFresh('photos'))) {
      logger.debug('Returning cached photos data', {
        albumsCount: cacheData.albums.length,
        photosCount: cacheData.recentPhotos.length,
        isStale: !this.isDataFresh('photos')
      });
      
      return {
        albums: cacheData.albums,
        recentPhotos: cacheData.recentPhotos,
        lastUpdated: cacheData.lastUpdated,
        isStale: !this.isDataFresh('photos')
      };
    }
    
    // Refresh data if needed
    if (!cacheData.isLoading) {
      this.refreshPhotosData(true);
    }
    
    // Return current cache (might be empty on first run)
    return {
      albums: cacheData.albums,
      recentPhotos: cacheData.recentPhotos,
      lastUpdated: cacheData.lastUpdated,
      isLoading: cacheData.isLoading
    };
  }

  // ==================== WIDGET REQUEST HANDLING ====================

  /**
   * Handle widget data request generically
   * @param {Object} requestData - Request data from widget
   * @param {Window} sourceWindow - Widget window source
   */
  async handleWidgetDataRequest(requestData, sourceWindow) {
    const { requestId, dataType, requestType, params } = requestData;
    
    try {
      let responseData = {};
      
      if (dataType === 'calendar') {
        responseData = await this.handleCalendarRequest(requestType, params);
      } else if (dataType === 'photos') {
        responseData = await this.handlePhotosRequest(requestType, params);
      } else {
        throw new Error(`Unknown data type: ${dataType}`);
      }
      
      const response = {
        type: 'widget-data-response',
        requestId,
        success: true,
        data: responseData,
        timestamp: Date.now()
      };
      
      sourceWindow.postMessage(response, '*');
      
      logger.widget('send', 'data_response', 'widget', {
        requestId,
        dataType,
        success: true
      });
      
    } catch (error) {
      logger.error('Widget data request failed', {
        requestId,
        dataType,
        error: error.message
      });
      
      const errorResponse = {
        type: 'widget-data-response',
        requestId,
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
      
      sourceWindow.postMessage(errorResponse, '*');
    }
  }

  /**
   * Handle calendar data request
   * @param {string} requestType - Type of calendar request
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Calendar data response
   */
  async handleCalendarRequest(requestType, params) {
    switch (requestType) {
      case 'events':
        const calendarData = await this.getCalendarData();
        // Return flattened structure for backward compatibility
        return calendarData; // This already has { events, calendars, lastUpdated }
        
      case 'calendars':
        const calendarsData = await this.getCalendarData();
        return calendarsData.calendars;
        
      default:
        throw new Error(`Unknown calendar request type: ${requestType}`);
    }
  }

  /**
   * Handle photos data request
   * @param {string} requestType - Type of photos request
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Photos data response
   */
  async handlePhotosRequest(requestType, params) {
    switch (requestType) {
      case 'albums':
        const photosData = await this.getPhotosData();
        return photosData.albums;
        
      case 'recent':
        const recentData = await this.getPhotosData();
        return recentData.recentPhotos.slice(0, params?.count || 10);
        
      default:
        throw new Error(`Unknown photos request type: ${requestType}`);
    }
  }

  /**
   * Add widget request to pending queue
   * @param {Object} request - Widget request
   */
  addPendingRequest(request) {
    this.pendingWidgetRequests.push(request);
    
    logger.debug('Added pending widget request', {
      dataType: request.dataType,
      requestType: request.requestType,
      totalPending: this.pendingWidgetRequests.length
    });
  }

  /**
   * Send cached data to pending widget requests
   * @param {string} dataType - Type of data (calendar, photos)
   */
  sendDataToPendingRequests(dataType) {
    const relevantRequests = this.pendingWidgetRequests.filter(req => req.dataType === dataType);
    
    if (relevantRequests.length === 0) return;
    
    logger.debug(`Sending ${dataType} data to ${relevantRequests.length} pending widgets`);
    
    relevantRequests.forEach(async (request) => {
      try {
        await this.handleWidgetDataRequest(request.requestData, request.sourceWindow);
      } catch (error) {
        logger.error(`Failed to send data to pending widget`, error);
      }
    });
    
    // Remove handled requests
    this.pendingWidgetRequests = this.pendingWidgetRequests.filter(req => req.dataType !== dataType);
  }

  /**
   * Send error to pending widget requests
   * @param {string} dataType - Type of data
   * @param {string} errorMessage - Error message
   */
  sendErrorToPendingRequests(dataType, errorMessage) {
    const relevantRequests = this.pendingWidgetRequests.filter(req => req.dataType === dataType);
    
    relevantRequests.forEach((request) => {
      try {
        const errorResponse = {
          type: 'widget-data-response',
          requestId: request.requestData.requestId,
          success: false,
          error: errorMessage,
          timestamp: Date.now()
        };
        
        request.sourceWindow.postMessage(errorResponse, '*');
      } catch (error) {
        logger.error(`Failed to send error to pending widget`, error);
      }
    });
    
    // Remove error requests
    this.pendingWidgetRequests = this.pendingWidgetRequests.filter(req => req.dataType !== dataType);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Check if cached data is still fresh
   * @param {string} dataType - Type of data to check
   * @returns {boolean} True if data is fresh
   */
  isDataFresh(dataType) {
    const cacheData = this.dataCache[dataType];
    if (!cacheData.lastUpdated) return false;
    
    const now = Date.now();
    const age = now - cacheData.lastUpdated;
    return age < cacheData.refreshInterval;
  }

  /**
   * Schedule automatic data refresh
   * @param {string} dataType - Type of data to refresh
   */
  scheduleDataRefresh(dataType) {
    // Clear existing timer
    if (this.refreshTimers[dataType]) {
      clearTimeout(this.refreshTimers[dataType]);
    }
    
    const refreshInterval = this.dataCache[dataType].refreshInterval;
    
    this.refreshTimers[dataType] = setTimeout(() => {
      logger.debug(`Scheduled ${dataType} refresh triggered`, {
        interval: refreshInterval / 1000 / 60 + ' minutes'
      });
      
      if (dataType === 'calendar') {
        this.refreshCalendarData(true);
      } else if (dataType === 'photos') {
        this.refreshPhotosData(true);
      }
    }, refreshInterval);
    
    logger.debug(`Scheduled ${dataType} refresh`, {
      interval: refreshInterval / 1000 / 60 + ' minutes'
    });
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    logger.info('Clearing all cached data');
    
    // Clear timers
    Object.values(this.refreshTimers).forEach(timer => clearTimeout(timer));
    this.refreshTimers = {};
    
    // Clear cache data
    this.dataCache.calendar = {
      events: [],
      calendars: [],
      lastUpdated: null,
      refreshInterval: 5 * 60 * 1000,
      isLoading: false
    };
    
    this.dataCache.photos = {
      albums: [],
      recentPhotos: [],
      lastUpdated: null,
      refreshInterval: 30 * 60 * 1000,
      isLoading: false
    };
    
    // Clear pending requests
    this.pendingWidgetRequests = [];
  }

  /**
   * Get data manager status for debugging
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      calendar: {
        events: this.dataCache.calendar.events.length,
        calendars: this.dataCache.calendar.calendars.length,
        lastUpdated: this.dataCache.calendar.lastUpdated,
        isLoading: this.dataCache.calendar.isLoading,
        isFresh: this.isDataFresh('calendar')
      },
      photos: {
        albums: this.dataCache.photos.albums.length,
        recentPhotos: this.dataCache.photos.recentPhotos.length,
        lastUpdated: this.dataCache.photos.lastUpdated,
        isLoading: this.dataCache.photos.isLoading,
        isFresh: this.isDataFresh('photos')
      },
      pendingRequests: this.pendingWidgetRequests.length,
      activeTimers: Object.keys(this.refreshTimers).length
    };
  }
}