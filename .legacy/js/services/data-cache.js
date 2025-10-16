// js/services/data-cache.js - Generic Data Caching System
// CHANGE SUMMARY: Extracted caching logic from data-manager.js into reusable cache system

import { createLogger } from '../utils/logger.js';

const logger = createLogger('DataCache');

/**
 * Generic data cache with TTL, refresh scheduling, and state management
 * Extracted from DataManager to be reusable across all data services
 */
export class DataCache {
  constructor() {
    this.cache = new Map();
    this.refreshTimers = new Map();
    this.pendingRequests = new Map();
    
    logger.info('Data cache initialized');
  }

  /**
   * Create cache entry structure
   * @param {number} refreshInterval - Refresh interval in milliseconds
   * @returns {Object} Cache entry structure
   */
  createCacheEntry(refreshInterval) {
    return {
      data: null,
      lastUpdated: null,
      refreshInterval: refreshInterval,
      isLoading: false,
      isStale: false
    };
  }

  /**
   * Initialize cache for a data type
   * @param {string} key - Cache key (e.g., 'calendar', 'photos')
   * @param {number} refreshInterval - Refresh interval in milliseconds
   * @param {*} initialData - Initial data (optional)
   */
  initialize(key, refreshInterval, initialData = null) {
    const entry = this.createCacheEntry(refreshInterval);
    entry.data = initialData;
    entry.lastUpdated = initialData ? Date.now() : null;
    
    this.cache.set(key, entry);
    this.pendingRequests.set(key, []);
    
    logger.debug(`Cache initialized for ${key}`, {
      refreshInterval: refreshInterval / 1000 / 60 + ' minutes',
      hasInitialData: !!initialData
    });
  }

  /**
   * Set data in cache
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   */
  set(key, data) {
    const entry = this.cache.get(key);
    if (!entry) {
      logger.warn(`Cache entry not found for ${key}, initializing with default TTL`);
      this.initialize(key, 5 * 60 * 1000); // 5 minute default
    }

    const cacheEntry = this.cache.get(key);
    cacheEntry.data = data;
    cacheEntry.lastUpdated = Date.now();
    cacheEntry.isLoading = false;
    cacheEntry.isStale = false;

    logger.debug(`Data cached for ${key}`, {
      dataSize: typeof data === 'object' ? JSON.stringify(data).length : String(data).length,
      lastUpdated: cacheEntry.lastUpdated
    });
  }

  /**
   * Get data from cache
   * @param {string} key - Cache key
   * @param {boolean} allowStale - Allow returning stale data
   * @returns {*} Cached data or null
   */
  get(key, allowStale = true) {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const isStale = this.isStale(key);
    
    if (entry.data && (allowStale || !isStale)) {
      logger.debug(`Cache hit for ${key}`, {
        isStale: isStale,
        lastUpdated: entry.lastUpdated
      });
      return {
        ...entry.data,
        isStale: isStale,
        isLoading: entry.isLoading
      };
    }

    logger.debug(`Cache miss for ${key}`, {
      hasData: !!entry.data,
      isStale: isStale,
      allowStale: allowStale
    });
    
    return null;
  }

  /**
   * Check if cached data is stale
   * @param {string} key - Cache key
   * @returns {boolean} True if data is stale
   */
  isStale(key) {
    const entry = this.cache.get(key);
    if (!entry || !entry.lastUpdated) {
      return true;
    }

    const age = Date.now() - entry.lastUpdated;
    return age > entry.refreshInterval;
  }

  /**
   * Check if data is fresh (not stale)
   * @param {string} key - Cache key
   * @returns {boolean} True if data is fresh
   */
  isFresh(key) {
    return !this.isStale(key);
  }

  /**
   * Set loading state
   * @param {string} key - Cache key
   * @param {boolean} isLoading - Loading state
   */
  setLoading(key, isLoading) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.isLoading = isLoading;
    }
  }

  /**
   * Check if data is currently loading
   * @param {string} key - Cache key
   * @returns {boolean} True if loading
   */
  isLoading(key) {
    const entry = this.cache.get(key);
    return entry ? entry.isLoading : false;
  }

  /**
   * Schedule automatic refresh
   * @param {string} key - Cache key
   * @param {Function} refreshCallback - Function to call for refresh
   */
  scheduleRefresh(key, refreshCallback) {
    // Clear existing timer
    if (this.refreshTimers.has(key)) {
      clearTimeout(this.refreshTimers.get(key));
    }
    
    const entry = this.cache.get(key);
    if (!entry) {
      logger.warn(`Cannot schedule refresh for unknown cache key: ${key}`);
      return;
    }

    const timer = setTimeout(async () => {
      logger.debug(`Scheduled refresh triggered for ${key}`, {
        interval: entry.refreshInterval / 1000 / 60 + ' minutes'
      });
      
      try {
        await refreshCallback();
      } catch (error) {
        logger.error(`Scheduled refresh failed for ${key}`, error);
      }
    }, entry.refreshInterval);

    this.refreshTimers.set(key, timer);
    
    logger.debug(`Scheduled refresh for ${key}`, {
      interval: entry.refreshInterval / 1000 / 60 + ' minutes'
    });
  }

  /**
   * Add pending request
   * @param {string} key - Cache key
   * @param {Object} request - Pending request data
   */
  addPendingRequest(key, request) {
    const requests = this.pendingRequests.get(key) || [];
    requests.push(request);
    this.pendingRequests.set(key, requests);
  }

  /**
   * Get and clear pending requests
   * @param {string} key - Cache key
   * @returns {Array} Pending requests
   */
  getPendingRequests(key) {
    const requests = this.pendingRequests.get(key) || [];
    this.pendingRequests.set(key, []); // Clear after getting
    return requests;
  }

  /**
   * Clear cache entry
   * @param {string} key - Cache key
   */
  clear(key) {
    // Clear timer
    if (this.refreshTimers.has(key)) {
      clearTimeout(this.refreshTimers.get(key));
      this.refreshTimers.delete(key);
    }
    
    // Clear cache
    this.cache.delete(key);
    this.pendingRequests.delete(key);
    
    logger.debug(`Cache cleared for ${key}`);
  }

  /**
   * Clear all cached data
   */
  clearAll() {
    logger.info('Clearing all cached data');
    
    // Clear all timers
    this.refreshTimers.forEach(timer => clearTimeout(timer));
    this.refreshTimers.clear();
    
    // Clear all cache
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache status for debugging
   * @returns {Object} Status information
   */
  getStatus() {
    const status = {
      totalEntries: this.cache.size,
      activeTimers: this.refreshTimers.size,
      entries: {}
    };

    this.cache.forEach((entry, key) => {
      status.entries[key] = {
        hasData: !!entry.data,
        lastUpdated: entry.lastUpdated,
        isLoading: entry.isLoading,
        isStale: this.isStale(key),
        refreshInterval: entry.refreshInterval / 1000 / 60 + ' min',
        pendingRequests: this.pendingRequests.get(key)?.length || 0
      };
    });

    return status;
  }
}

// Make sure to export the class
export default DataCache;