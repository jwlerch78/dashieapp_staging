// js/modules/Settings/settings-store.js
// Settings persistence layer - now uses centralized SettingsService

import { createLogger } from '../../utils/logger.js';
import { getDefaultSettings } from '../../../config.js';
import settingsService from '../../data/services/settings-service.js';
import { showToast } from '../../ui/toast.js';
import AppComms from '../../core/app-comms.js';

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
     * @param {object} options - Initialization options
     * @param {boolean} options.bypassAuth - Skip database loading
     */
    async initialize(options = {}) {
        const { bypassAuth = false } = options;

        if (this.initialized) return;

        logger.verbose('Initializing SettingsStore', { bypassAuth });

        try {
            if (bypassAuth) {
                // Bypass mode: Use defaults without database
                logger.warn('⚠️ BYPASS MODE: Using default settings (no database)');
                this.settings = getDefaultSettings();
                this.initialized = true;
                return;
            }

            // Load settings using SettingsService
            this.settings = await this.service.load();
            this.initialized = true;

            logger.success('Settings loaded successfully', {
                version: this.settings?.version,
                theme: this.settings?.interface?.theme
            });

            // Sync family name to legacy localStorage key for header widget
            this.syncFamilyNameToLocalStorage();

            // Apply the loaded theme to both dashie-theme and dashie-settings
            // This ensures dashboard and widgets use the same theme on startup
            const theme = this.get('interface.theme');
            if (theme && window.themeApplier) {
                logger.verbose('Applying theme from Settings Store', { theme });
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
        // Check if service is available (won't be in bypass mode)
        if (!this.service || !this.service.edgeClient) {
            logger.warn('⚠️ BYPASS MODE: Settings save skipped (no database connection)');
            // Still update in-memory settings so theme changes work
            return { success: true, message: 'Settings updated locally (bypass mode)' };
        }

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

            // Publish settings changed event so widgets get updated
            AppComms.publish(AppComms.events.SETTINGS_CHANGED, this.settings);
            logger.debug('Published SETTINGS_CHANGED event to AppComms');

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

        // Sync family name after reload
        this.syncFamilyNameToLocalStorage();
    }

    /**
     * Sync family name from settings to legacy localStorage key
     * This ensures header widget displays the correct family name on load
     * @private
     */
    syncFamilyNameToLocalStorage() {
        try {
            const familyName = this.get('family.familyName');

            if (familyName) {
                // Format to "The [Name] Family"
                const formattedName = this.formatFamilyName(familyName);

                // Update legacy localStorage key for header widget
                localStorage.setItem('dashie-family-name', formattedName);

                logger.debug('Synced family name to localStorage', {
                    baseName: familyName,
                    formattedName
                });
            } else {
                logger.debug('No family name in settings, skipping sync');
            }
        } catch (error) {
            logger.warn('Failed to sync family name to localStorage', error);
        }
    }

    /**
     * Format base family name to "The [Name] Family"
     * @private
     * @param {string} baseName - Base family name (e.g., "Smith")
     * @returns {string} Formatted name (e.g., "The Smith Family")
     */
    formatFamilyName(baseName) {
        if (!baseName) return 'The Dashie Family';

        // If already formatted, return as-is
        if (baseName.startsWith('The ') && baseName.endsWith(' Family')) {
            return baseName;
        }

        // Remove any existing "The " or " Family" to get clean base name
        let cleanName = baseName.trim();
        if (cleanName.startsWith('The ')) {
            cleanName = cleanName.substring(4);
        }
        if (cleanName.endsWith(' Family')) {
            cleanName = cleanName.substring(0, cleanName.length - 7);
        }

        // Format to "The [Name] Family"
        return `The ${cleanName.trim()} Family`;
    }
}
