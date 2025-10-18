// js/data/services/settings-service.js
// Centralized settings persistence service
// Handles dual read/write pattern: localStorage (fast) + Supabase (cloud sync)

import { createLogger } from '../../utils/logger.js';
import { getDefaultSettings, STORAGE_KEYS } from '../../../config.js';

const logger = createLogger('SettingsService');

/**
 * Settings Service
 * Single source of truth for all settings persistence operations
 *
 * Strategy:
 * - READ: Try Supabase first (if authenticated), fall back to localStorage, then defaults
 * - WRITE: Always write to localStorage first (fast), then Supabase (if authenticated)
 * - This ensures offline capability and data redundancy
 */
export class SettingsService {
    constructor(edgeClient = null) {
        this.edgeClient = edgeClient;
    }

    /**
     * Set the EdgeClient for database operations
     * @param {EdgeClient} edgeClient - EdgeClient instance
     */
    setEdgeClient(edgeClient) {
        this.edgeClient = edgeClient;
        logger.info('EdgeClient set for settings service');
    }

    /**
     * Load settings using dual-read pattern
     * Priority: Database (if authenticated) > localStorage > defaults
     *
     * @returns {Promise<object>} Settings object
     */
    async load() {
        logger.info('Loading settings...');

        try {
            // 1. Try to load from database if authenticated
            if (this.edgeClient && this.edgeClient.jwtToken) {
                try {
                    logger.debug('Attempting to load from database (authenticated)');
                    const dbSettings = await this.edgeClient.loadSettings();

                    if (dbSettings && Object.keys(dbSettings).length > 0) {
                        logger.success('Settings loaded from database', {
                            version: dbSettings.version,
                            lastModified: dbSettings.lastModified
                        });

                        // Also update localStorage cache
                        this._saveToLocalStorage(dbSettings);

                        return dbSettings;
                    } else {
                        logger.debug('No settings found in database, trying localStorage');
                    }
                } catch (dbError) {
                    logger.warn('Database load failed, falling back to localStorage', dbError);
                }
            } else {
                logger.debug('Not authenticated, skipping database load');
            }

            // 2. Try to load from localStorage
            const localSettings = this._loadFromLocalStorage();
            if (localSettings) {
                logger.info('Settings loaded from localStorage', {
                    version: localSettings.version
                });
                return localSettings;
            }

            // 3. Fall back to defaults
            logger.info('No settings found, using defaults');
            const defaults = getDefaultSettings();

            // Save defaults to localStorage for future use
            this._saveToLocalStorage(defaults);

            return defaults;

        } catch (error) {
            logger.error('Settings load failed completely, using defaults', error);
            return getDefaultSettings();
        }
    }

    /**
     * Save settings using dual-write pattern
     * Always writes to localStorage first, then tries database if authenticated
     *
     * @param {object} settings - Settings object to save
     * @returns {Promise<object>} Result object with { localStorage: bool, database: bool }
     */
    async save(settings) {
        logger.info('Saving settings...');

        const result = {
            localStorage: false,
            database: false,
            errors: []
        };

        try {
            // Update timestamp
            settings.lastModified = Date.now();

            // 1. ALWAYS save to localStorage first (fast, synchronous)
            try {
                this._saveToLocalStorage(settings);
                result.localStorage = true;
                logger.debug('Settings saved to localStorage');
            } catch (localError) {
                logger.error('localStorage save failed', localError);
                result.errors.push({ location: 'localStorage', error: localError.message });
                // Don't throw - try database anyway
            }

            // 2. Try to save to database if authenticated
            if (this.edgeClient && this.edgeClient.jwtToken) {
                try {
                    logger.debug('Saving to database (authenticated)');
                    await this.edgeClient.saveSettings(settings);
                    result.database = true;
                    logger.success('Settings saved to database');
                } catch (dbError) {
                    logger.warn('Database save failed (localStorage backup available)', dbError);
                    result.errors.push({ location: 'database', error: dbError.message });
                    // Don't throw - localStorage save succeeded
                }
            } else {
                logger.debug('Not authenticated, skipping database save');
            }

            // Log final result
            if (result.localStorage && result.database) {
                logger.success('Settings saved to both localStorage and database');
            } else if (result.localStorage) {
                logger.info('Settings saved to localStorage only (offline mode)');
            } else {
                logger.error('Settings save failed completely');
                throw new Error('Failed to save settings to any location');
            }

            return result;

        } catch (error) {
            logger.error('Settings save failed', error);
            result.errors.push({ location: 'general', error: error.message });
            throw error;
        }
    }

    /**
     * Get a specific setting value by path
     * @param {object} settings - Settings object
     * @param {string} path - Dot-notation path (e.g., 'interface.theme')
     * @returns {*} Setting value or undefined
     */
    get(settings, path) {
        if (!settings) return undefined;

        const parts = path.split('.');
        let value = settings;

        for (const part of parts) {
            if (value && typeof value === 'object') {
                value = value[part];
            } else {
                return undefined;
            }
        }

        return value;
    }

    /**
     * Set a specific setting value by path
     * @param {object} settings - Settings object (will be modified)
     * @param {string} path - Dot-notation path (e.g., 'interface.theme')
     * @param {*} value - New value
     */
    set(settings, path, value) {
        if (!settings) {
            throw new Error('Settings object is null');
        }

        const parts = path.split('.');
        const lastPart = parts.pop();
        let target = settings;

        // Navigate to parent object
        for (const part of parts) {
            if (!target[part] || typeof target[part] !== 'object') {
                target[part] = {};
            }
            target = target[part];
        }

        // Set value
        target[lastPart] = value;

        logger.debug('Setting updated', { path, value });
    }

    /**
     * Load settings from localStorage
     * @private
     * @returns {object|null} Settings object or null
     */
    _loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (!stored) {
                return null;
            }

            return JSON.parse(stored);
        } catch (error) {
            logger.error('Failed to load from localStorage', error);
            return null;
        }
    }

    /**
     * Save settings to localStorage
     * @private
     * @param {object} settings - Settings object
     */
    _saveToLocalStorage(settings) {
        try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        } catch (error) {
            logger.error('Failed to save to localStorage', error);
            throw error;
        }
    }

    /**
     * Clear all settings from localStorage and optionally from database
     * @param {boolean} clearDatabase - Whether to also clear database
     * @returns {Promise<void>}
     */
    async clear(clearDatabase = false) {
        logger.warn('Clearing settings');

        try {
            // Clear localStorage
            localStorage.removeItem(STORAGE_KEYS.SETTINGS);
            logger.info('Settings cleared from localStorage');

            // Optionally clear database
            if (clearDatabase && this.edgeClient && this.edgeClient.jwtToken) {
                try {
                    const defaults = getDefaultSettings();
                    await this.edgeClient.saveSettings(defaults);
                    logger.info('Settings reset to defaults in database');
                } catch (dbError) {
                    logger.error('Failed to clear database settings', dbError);
                }
            }
        } catch (error) {
            logger.error('Failed to clear settings', error);
            throw error;
        }
    }
}

// Export singleton instance
const settingsService = new SettingsService();
export default settingsService;
