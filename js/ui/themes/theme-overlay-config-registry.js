// js/ui/themes/theme-overlay-config-registry.js
// Dynamic theme overlay configuration loader
// Maps theme families to overlay configuration files
// v2.0 - Updated for theme family architecture

import { createLogger } from '../../utils/logger.js';
import { parseThemeId } from './theme-registry.js';

const logger = createLogger('ThemeOverlayRegistry');

/**
 * Theme Overlay Configuration Registry
 * Dynamically loads theme-specific overlay configurations
 *
 * Note: Overlays are mapped by THEME FAMILY, not individual theme IDs.
 * Both light and dark variants of a family share the same overlay config.
 */
class ThemeOverlayConfigRegistry {
    constructor() {
        // Map theme FAMILIES to their config file paths
        // Both light and dark variants use the same overlay
        this.themeFamilyConfigMap = {
            'halloween': './theme-overlay-halloween.js',
            // Future themes:
            // 'christmas': './theme-overlay-christmas.js',
            // 'easter': './theme-overlay-easter.js',
            // 'thanksgiving': './theme-overlay-thanksgiving.js',
        };

        // Cache loaded configs (keyed by family ID)
        this.configCache = new Map();
    }

    /**
     * Check if a theme has overlay support
     * @param {string} themeId - Theme identifier (e.g., "halloween-dark")
     * @returns {boolean}
     */
    hasOverlay(themeId) {
        const parsed = parseThemeId(themeId);
        if (!parsed) return false;

        return this.themeFamilyConfigMap.hasOwnProperty(parsed.family);
    }

    /**
     * Get overlay configuration for a theme
     * @param {string} themeId - Theme identifier (e.g., "halloween-dark")
     * @returns {Promise<object|null>} Overlay config or null if no overlay for theme
     */
    async getConfig(themeId) {
        // Parse theme ID to get family
        const parsed = parseThemeId(themeId);
        if (!parsed) {
            logger.debug(`Invalid theme ID: ${themeId}`);
            return null;
        }

        const familyId = parsed.family;

        // Check if theme family has overlay support
        if (!this.themeFamilyConfigMap.hasOwnProperty(familyId)) {
            logger.debug(`No overlay config for theme family: ${familyId}`);
            return null;
        }

        // Check cache first (cache by family, not full theme ID)
        if (this.configCache.has(familyId)) {
            logger.debug(`Using cached overlay config for family: ${familyId}`);
            return this.configCache.get(familyId);
        }

        // Dynamically import config
        try {
            const configPath = this.themeFamilyConfigMap[familyId];
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

            // Cache for future use (by family ID)
            this.configCache.set(familyId, config);

            logger.success(`Loaded overlay config for theme family ${familyId}`, {
                elementsCount: config.elements.length,
                rotationsCount: config.rotations ? Object.keys(config.rotations).length : 0
            });

            return config;

        } catch (error) {
            logger.error(`Failed to load overlay config for theme family ${familyId}`, error);
            return null;
        }
    }

    /**
     * Register a new theme family overlay config
     * @param {string} familyId - Theme family identifier (e.g., "halloween")
     * @param {string} configPath - Path to config file (relative to this file)
     */
    register(familyId, configPath) {
        logger.info(`Registering overlay config: ${familyId} → ${configPath}`);
        this.themeFamilyConfigMap[familyId] = configPath;

        // Clear cache if it exists
        if (this.configCache.has(familyId)) {
            this.configCache.delete(familyId);
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
