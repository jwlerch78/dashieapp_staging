// js/modules/Settings/settings-store.js
// Settings persistence layer

import { createLogger } from '../../utils/logger.js';
import { getDefaultSettings } from '../../../config.js';

const logger = createLogger('SettingsStore');

/**
 * Settings Store
 * Manages settings persistence to/from Supabase
 */
export class SettingsStore {
    constructor() {
        this.settings = null;
        this.initialized = false;
    }

    /**
     * Initialize and load settings
     */
    async initialize() {
        if (this.initialized) return;

        logger.info('Initializing SettingsStore');

        try {
            await this.load();
            this.initialized = true;
        } catch (error) {
            logger.error('Failed to initialize SettingsStore', error);
            // Fall back to defaults
            this.settings = getDefaultSettings();
            this.initialized = true;
        }
    }

    /**
     * Load settings from storage
     */
    async load() {
        logger.debug('Loading settings');

        try {
            // Try to load from JWTService (Supabase)
            if (window.dashieJWT) {
                this.settings = await window.dashieJWT.loadSettings();
                logger.info('Settings loaded from Supabase', {
                    version: this.settings?.version
                });
            } else {
                // Fall back to defaults if JWT service not available
                logger.warn('JWT service not available, using defaults');
                this.settings = getDefaultSettings();
            }
        } catch (error) {
            logger.error('Failed to load settings', error);
            // Use defaults on error
            this.settings = getDefaultSettings();
        }

        // Ensure we have valid settings
        if (!this.settings) {
            this.settings = getDefaultSettings();
        }
    }

    /**
     * Save settings to storage
     */
    async save() {
        logger.debug('Saving settings');

        try {
            if (window.dashieJWT) {
                // Update lastModified timestamp
                this.settings.lastModified = Date.now();

                await window.dashieJWT.saveSettings(this.settings);
                logger.info('Settings saved to Supabase');
            } else {
                logger.warn('JWT service not available, settings not saved');
            }
        } catch (error) {
            logger.error('Failed to save settings', error);
            throw error;
        }
    }

    /**
     * Get a setting value by path
     * @param {string} path - Dot-notation path (e.g., 'display.theme')
     * @returns {*} - Setting value
     */
    get(path) {
        if (!this.settings) return undefined;

        const parts = path.split('.');
        let value = this.settings;

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
     * Set a setting value by path
     * @param {string} path - Dot-notation path (e.g., 'display.theme')
     * @param {*} value - New value
     */
    set(path, value) {
        if (!this.settings) {
            this.settings = getDefaultSettings();
        }

        const parts = path.split('.');
        const lastPart = parts.pop();
        let target = this.settings;

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
     * Get all settings
     * @returns {Object} - All settings
     */
    getAll() {
        return this.settings || getDefaultSettings();
    }

    /**
     * Reset settings to defaults
     */
    resetToDefaults() {
        logger.info('Resetting settings to defaults');
        this.settings = getDefaultSettings();
    }
}
