// js/ui/themes/theme-overlay-config-registry.js
// Dynamic theme overlay configuration loader
// Maps theme IDs to overlay configuration files

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ThemeOverlayRegistry');

/**
 * Theme Overlay Configuration Registry
 * Dynamically loads theme-specific overlay configurations
 */
class ThemeOverlayConfigRegistry {
    constructor() {
        // Map theme IDs to their config file paths
        this.themeConfigMap = {
            'halloween-dark': './theme-overlay-halloween.js',
            'halloween-light': './theme-overlay-halloween.js',
            // Future themes:
            // 'christmas-dark': './theme-overlay-christmas.js',
            // 'christmas-light': './theme-overlay-christmas.js',
            // 'easter-dark': './theme-overlay-easter.js',
            // 'thanksgiving-dark': './theme-overlay-thanksgiving.js',
        };

        // Cache loaded configs
        this.configCache = new Map();
    }

    /**
     * Check if a theme has overlay support
     * @param {string} themeId - Theme identifier
     * @returns {boolean}
     */
    hasOverlay(themeId) {
        return this.themeConfigMap.hasOwnProperty(themeId);
    }

    /**
     * Get overlay configuration for a theme
     * @param {string} themeId - Theme identifier
     * @returns {Promise<object|null>} Overlay config or null if no overlay for theme
     */
    async getConfig(themeId) {
        // Check if theme has overlay support
        if (!this.hasOverlay(themeId)) {
            logger.debug(`No overlay config for theme: ${themeId}`);
            return null;
        }

        // Check cache first
        if (this.configCache.has(themeId)) {
            logger.debug(`Using cached overlay config for: ${themeId}`);
            return this.configCache.get(themeId);
        }

        // Dynamically import config
        try {
            const configPath = this.themeConfigMap[themeId];
            logger.debug(`Loading overlay config from: ${configPath}`);

            const module = await import(configPath);

            // Extract config (handle both named and default exports)
            const config = module.HALLOWEEN_OVERLAY_CONFIG ||
                          module.CHRISTMAS_OVERLAY_CONFIG ||
                          module.EASTER_OVERLAY_CONFIG ||
                          module.THANKSGIVING_OVERLAY_CONFIG ||
                          module.default;

            if (!config) {
                logger.error(`No overlay config found in ${configPath}`);
                return null;
            }

            // Validate config structure
            if (!config.elements || !Array.isArray(config.elements)) {
                logger.error(`Invalid overlay config in ${configPath} - missing elements array`);
                return null;
            }

            // Cache for future use
            this.configCache.set(themeId, config);

            logger.success(`Loaded overlay config for ${themeId}`, {
                elementsCount: config.elements.length,
                rotationsCount: config.rotations ? Object.keys(config.rotations).length : 0
            });

            return config;

        } catch (error) {
            logger.error(`Failed to load overlay config for ${themeId}`, error);
            return null;
        }
    }

    /**
     * Register a new theme overlay config
     * @param {string} themeId - Theme identifier
     * @param {string} configPath - Path to config file (relative to this file)
     */
    register(themeId, configPath) {
        logger.info(`Registering overlay config: ${themeId} → ${configPath}`);
        this.themeConfigMap[themeId] = configPath;

        // Clear cache if it exists
        if (this.configCache.has(themeId)) {
            this.configCache.delete(themeId);
        }
    }

    /**
     * Clear config cache
     */
    clearCache() {
        logger.debug('Clearing overlay config cache');
        this.configCache.clear();
    }
}

// Export singleton instance
export const themeOverlayConfigRegistry = new ThemeOverlayConfigRegistry();
export default themeOverlayConfigRegistry;
