// js/utils/calendar-cache.js
// IndexedDB-based cache for calendar data
// Provides fast loading with TTL-based invalidation

import { createLogger } from './logger.js';
import { CALENDAR_CACHE_TTL_MS } from '../../config.js';

const logger = createLogger('CalendarCache');

/**
 * CalendarCache - Persistent cache for calendar data using IndexedDB
 *
 * Features:
 * - Fast persistent storage (survives page reloads)
 * - TTL-based expiration (default 5 minutes)
 * - Automatic cleanup of old data
 * - Compression-ready for future optimization
 *
 * Storage estimate: 700 events ≈ 500KB-1MB (well within IndexedDB limits)
 */
export class CalendarCache {
    constructor(options = {}) {
        this.dbName = options.dbName || 'DashieCalendarCache';
        this.dbVersion = 1;
        this.storeName = 'calendar-data';
        this.db = null;

        // Default TTL from config (default 5 minutes)
        this.defaultTTL = options.ttl || CALENDAR_CACHE_TTL_MS;

        logger.verbose('CalendarCache constructed', {
            dbName: this.dbName,
            ttl: `${this.defaultTTL / 1000}s`
        });
    }

    /**
     * Initialize the IndexedDB database
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.db) {
            logger.debug('Database already initialized');
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                logger.error('Failed to open IndexedDB', request.error);
                reject(new Error(`IndexedDB error: ${request.error}`));
            };

            request.onsuccess = () => {
                this.db = request.result;
                logger.success('IndexedDB opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'key' });

                    // Create index on timestamp for cleanup queries
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });

                    logger.info('Created calendar-data object store');
                }
            };
        });
    }

    /**
     * Get cached calendar data
     * @param {string} key - Cache key (e.g., 'calendar-data')
     * @param {object} options - Options: { allowStale: boolean }
     * @returns {Promise<object|null>} Cached data or null if missing
     */
    async get(key = 'calendar-data', options = {}) {
        const { allowStale = true } = options; // Default: serve stale data

        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(key);

            request.onsuccess = () => {
                const cached = request.result;

                if (!cached) {
                    logger.debug('No cached data found', { key });
                    resolve(null);
                    return;
                }

                // Check if cache has expired
                const now = Date.now();
                const age = now - cached.timestamp;
                const isExpired = age > cached.ttl;

                // If expired and stale data is NOT allowed, return null
                if (isExpired && !allowStale) {
                    logger.info('Cache expired (stale not allowed)', {
                        key,
                        age: `${Math.round(age / 1000)}s`,
                        ttl: `${cached.ttl / 1000}s`
                    });
                    resolve(null);
                    return;
                }

                // Return data (even if stale)
                if (isExpired) {
                    logger.info('Cache expired but serving stale data', {
                        key,
                        age: `${Math.round(age / 1000)}s`,
                        ttl: `${cached.ttl / 1000}s`,
                        eventsCount: cached.data?.events?.length,
                        calendarsCount: cached.data?.calendars?.length
                    });
                } else {
                    logger.success('Cache hit', {
                        key,
                        age: `${Math.round(age / 1000)}s`,
                        eventsCount: cached.data?.events?.length,
                        calendarsCount: cached.data?.calendars?.length
                    });
                }

                resolve(cached.data);
            };

            request.onerror = () => {
                logger.error('Failed to get cached data', request.error);
                reject(new Error(`Cache get error: ${request.error}`));
            };
        });
    }

    /**
     * Store calendar data in cache
     * @param {string} key - Cache key
     * @param {object} data - Data to cache (calendars and events)
     * @param {number} ttl - Time-to-live in milliseconds (optional)
     * @returns {Promise<void>}
     */
    async set(key = 'calendar-data', data, ttl) {
        if (!this.db) {
            await this.initialize();
        }

        const cacheEntry = {
            key,
            data,
            timestamp: Date.now(),
            ttl: ttl || this.defaultTTL
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.put(cacheEntry);

            request.onsuccess = () => {
                // Calculate size estimate safely
                let sizeEstimate = '0';
                try {
                    if (data) {
                        const jsonString = JSON.stringify(data);
                        sizeEstimate = `~${Math.round(jsonString.length / 1024)}KB`;
                    }
                } catch (err) {
                    sizeEstimate = 'unknown';
                }

                logger.success('Data cached successfully', {
                    key,
                    eventsCount: data?.events?.length || 0,
                    calendarsCount: data?.calendars?.length || 0,
                    ttl: `${cacheEntry.ttl / 1000}s`,
                    sizeEstimate
                });
                resolve();
            };

            request.onerror = () => {
                logger.error('Failed to cache data', request.error);
                reject(new Error(`Cache set error: ${request.error}`));
            };
        });
    }

    /**
     * Clear a specific cache entry
     * @param {string} key - Cache key to clear
     * @returns {Promise<void>}
     */
    async clear(key = 'calendar-data') {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(key);

            request.onsuccess = () => {
                logger.info('Cache cleared', { key });
                resolve();
            };

            request.onerror = () => {
                logger.error('Failed to clear cache', request.error);
                reject(new Error(`Cache clear error: ${request.error}`));
            };
        });
    }

    /**
     * Clear all cached data (useful for logout or troubleshooting)
     * @returns {Promise<void>}
     */
    async clearAll() {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.clear();

            request.onsuccess = () => {
                logger.info('All cache cleared');
                resolve();
            };

            request.onerror = () => {
                logger.error('Failed to clear all cache', request.error);
                reject(new Error(`Cache clear all error: ${request.error}`));
            };
        });
    }

    /**
     * Get cache metadata (age, size estimate)
     * @param {string} key - Cache key
     * @returns {Promise<object|null>}
     */
    async getMetadata(key = 'calendar-data') {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(key);

            request.onsuccess = () => {
                const cached = request.result;

                if (!cached) {
                    resolve(null);
                    return;
                }

                const now = Date.now();
                const age = now - cached.timestamp;
                const isExpired = age > cached.ttl;

                // Calculate size estimate safely
                let sizeEstimate = 0;
                try {
                    if (cached.data) {
                        sizeEstimate = JSON.stringify(cached.data).length;
                    }
                } catch (err) {
                    sizeEstimate = 0;
                }

                resolve({
                    key: cached.key,
                    timestamp: cached.timestamp,
                    age,
                    ttl: cached.ttl,
                    isExpired,
                    sizeEstimate,
                    eventsCount: cached.data?.events?.length || 0,
                    calendarsCount: cached.data?.calendars?.length || 0
                });
            };

            request.onerror = () => {
                logger.error('Failed to get cache metadata', request.error);
                reject(new Error(`Cache metadata error: ${request.error}`));
            };
        });
    }

    /**
     * Check if cache exists and is valid
     * @param {string} key - Cache key
     * @returns {Promise<boolean>}
     */
    async isValid(key = 'calendar-data') {
        try {
            const data = await this.get(key);
            return data !== null;
        } catch (error) {
            logger.warn('Failed to check cache validity', error);
            return false;
        }
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            logger.info('Database connection closed');
        }
    }
}

// Export singleton instance
export const calendarCache = new CalendarCache();
