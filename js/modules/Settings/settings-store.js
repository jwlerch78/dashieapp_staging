// js/modules/Settings/settings-store.js
// Settings persistence layer - now uses centralized SettingsService

import { createLogger } from '../../utils/logger.js';
import { getDefaultSettings } from '../../../config.js';
import settingsService from '../../data/services/settings-service.js';
import { showToast } from '../../ui/toast.js';

const logger = createLogger('SettingsStore');

/**
 * Settings Store
 * Wrapper around SettingsService for backward compatibility
 * Delegates all persistence operations to SettingsService
 */
export class SettingsStore {
    constructor() {
        this.settings = null;
        this.initialized = false;
        this.service = settingsService;
    }

    /**
     * Initialize and load settings
     */
    async initialize() {
        if (this.initialized) return;

        logger.info('Initializing SettingsStore');

        try {
            // Load settings using SettingsService
            this.settings = await this.service.load();
            this.initialized = true;

            logger.success('Settings loaded successfully', {
                version: this.settings?.version,
                theme: this.settings?.interface?.theme
            });

            // Apply the loaded theme to both dashie-theme and dashie-settings
            // This ensures dashboard and widgets use the same theme on startup
            const theme = this.get('interface.theme');
            if (theme && window.themeApplier) {
                logger.info('Applying theme from Settings Store', { theme });
                window.themeApplier.applyTheme(theme, true);
            }
        } catch (error) {
            logger.error('Failed to initialize SettingsStore', error);
            // Fall back to defaults
            this.settings = getDefaultSettings();
            this.initialized = true;
        }
    }

    /**
     * Save settings to storage
     * Uses SettingsService dual-write pattern
     * @param {boolean} showNotification - Whether to show toast notification (default: true)
     */
    async save(showNotification = true) {
        logger.debug('Saving settings via SettingsService');

        try {
            const result = await this.service.save(this.settings);

            if (result.localStorage && result.database) {
                logger.success('Settings saved to both localStorage and database');
                if (showNotification) {
                    showToast('Settings saved', 'success');
                }
            } else if (result.localStorage) {
                logger.info('Settings saved to localStorage only');
                if (showNotification) {
                    showToast('Settings saved (offline)', 'success');
                }
            } else {
                throw new Error('Failed to save settings');
            }

            return result;
        } catch (error) {
            logger.error('Failed to save settings', error);
            if (showNotification) {
                showToast('Failed to save settings', 'error');
            }
            throw error;
        }
    }

    /**
     * Get a setting value by path
     * @param {string} path - Dot-notation path (e.g., 'interface.theme')
     * @returns {*} - Setting value
     */
    get(path) {
        return this.service.get(this.settings, path);
    }

    /**
     * Set a setting value by path
     * @param {string} path - Dot-notation path (e.g., 'interface.theme')
     * @param {*} value - New value
     */
    set(path, value) {
        if (!this.settings) {
            this.settings = getDefaultSettings();
        }

        this.service.set(this.settings, path, value);
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
    async resetToDefaults() {
        logger.info('Resetting settings to defaults');
        this.settings = getDefaultSettings();
        await this.save();
    }

    /**
     * Reload settings from storage
     * Useful for refreshing after external changes
     */
    async reload() {
        logger.info('Reloading settings');
        this.settings = await this.service.load();
    }
}
