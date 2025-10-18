// js/modules/Settings/core/settings-screen-registry.js
// Central registry for all settings screens
// Handles screen lifecycle, rendering, and navigation

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('SettingsScreenRegistry');

/**
 * Settings Screen Registry
 * Manages all settings screens and their lifecycle
 */
export class SettingsScreenRegistry {
    constructor() {
        this.screens = new Map();
        this.settingsStore = null;
    }

    /**
     * Initialize registry with settings store
     * @param {Object} settingsStore - Settings store instance
     */
    initialize(settingsStore) {
        this.settingsStore = settingsStore;
        logger.info('Screen registry initialized');
    }

    /**
     * Register a screen
     * @param {SettingsScreenBase} screen - Screen instance
     */
    register(screen) {
        if (this.screens.has(screen.id)) {
            logger.warn('Screen already registered, replacing', { id: screen.id });
        }
        this.screens.set(screen.id, screen);
        logger.debug('Screen registered', { id: screen.id, title: screen.title });
    }

    /**
     * Unregister a screen
     * @param {string} screenId - Screen ID
     */
    unregister(screenId) {
        this.screens.delete(screenId);
        logger.debug('Screen unregistered', { id: screenId });
    }

    /**
     * Get a screen by ID
     * @param {string} screenId - Screen ID
     * @returns {SettingsScreenBase|null}
     */
    get(screenId) {
        return this.screens.get(screenId) || null;
    }

    /**
     * Check if screen exists
     * @param {string} screenId - Screen ID
     * @returns {boolean}
     */
    has(screenId) {
        return this.screens.has(screenId);
    }

    /**
     * Render a screen
     * @param {string} screenId - Screen ID
     * @returns {string} - HTML string
     */
    render(screenId) {
        const screen = this.get(screenId);
        if (!screen) {
            logger.error('Screen not found', { screenId });
            return '<div class="settings-modal__error">Screen not found</div>';
        }

        // Get current value from settings store
        let currentValue = null;
        if (screen.settingPath && this.settingsStore) {
            currentValue = this.settingsStore.get(screen.settingPath);
        }

        return screen.render(currentValue);
    }

    /**
     * Get initial selection index for a screen
     * @param {string} screenId - Screen ID
     * @returns {number}
     */
    getInitialSelectionIndex(screenId) {
        const screen = this.get(screenId);
        if (!screen) return 0;

        // Get current value from settings store
        let currentValue = null;
        if (screen.settingPath && this.settingsStore) {
            currentValue = this.settingsStore.get(screen.settingPath);
        }

        return screen.getInitialSelectionIndex(currentValue);
    }

    /**
     * Handle selection on a screen
     * @param {string} screenId - Screen ID
     * @param {HTMLElement} element - Selected element
     * @returns {Promise<Object>} - Action object
     */
    async handleSelection(screenId, element) {
        const screen = this.get(screenId);
        if (!screen) {
            logger.error('Screen not found for selection', { screenId });
            return { type: 'error', message: 'Screen not found' };
        }

        return await screen.handleSelection(element, this.settingsStore);
    }

    /**
     * Get screen title
     * @param {string} screenId - Screen ID
     * @returns {string}
     */
    getTitle(screenId) {
        const screen = this.get(screenId);
        return screen ? screen.title : 'Settings';
    }

    /**
     * Get parent screen ID
     * @param {string} screenId - Screen ID
     * @returns {string|null}
     */
    getParentId(screenId) {
        const screen = this.get(screenId);
        return screen ? screen.parentId : null;
    }

    /**
     * Get all registered screen IDs
     * @returns {string[]}
     */
    getAllScreenIds() {
        return Array.from(this.screens.keys());
    }

    /**
     * Get all screens with a specific parent
     * @param {string} parentId - Parent screen ID
     * @returns {SettingsScreenBase[]}
     */
    getChildScreens(parentId) {
        return Array.from(this.screens.values()).filter(screen => screen.parentId === parentId);
    }
}

// Export singleton instance
export const screenRegistry = new SettingsScreenRegistry();
