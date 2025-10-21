// js/ui/themes/theme-overlay-applier.js
// Theme overlay orchestrator - coordinates overlay system components
// Manages the application and lifecycle of theme-specific overlay decorations

import { createLogger } from '../../utils/logger.js';
import { ThemeOverlayContainerManager } from './theme-overlay-container-manager.js';
import { ThemeOverlayElementCreator } from './theme-overlay-element-creator.js';
import { ThemeOverlayVisibilityManager } from './theme-overlay-visibility-manager.js';
import { themeOverlayConfigRegistry } from './theme-overlay-config-registry.js';

const logger = createLogger('ThemeOverlay');

/**
 * ThemeOverlay - Orchestrates theme overlay system
 * Coordinates container, element, and visibility managers
 */
class ThemeOverlay {
    constructor() {
        this.containerManager = new ThemeOverlayContainerManager();
        this.elementCreator = new ThemeOverlayElementCreator(this.containerManager, window.settingsStore);
        this.visibilityManager = new ThemeOverlayVisibilityManager(this.elementCreator);

        this.currentTheme = null;
        this.enabled = true;
        this.isApplying = false; // Prevent concurrent applications

        logger.verbose('ThemeOverlay constructed');
    }

    /**
     * Initialize overlay system
     */
    initialize() {
        logger.info('Initializing ThemeOverlay');

        // Check reduced motion preference
        this.checkReducedMotionPreference();

        // Check user's theme animations setting
        if (window.settingsStore) {
            const animationsEnabled = window.settingsStore.get('interface.themeAnimationsEnabled');
            if (animationsEnabled === false) {
                this.enabled = false;
                logger.info('Theme animations disabled by user setting');
            }
        }

        logger.success('ThemeOverlay initialized');
    }

    /**
     * Check if user prefers reduced motion
     * @private
     */
    checkReducedMotionPreference() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            logger.info('User prefers reduced motion - disabling animations');
            this.enabled = false;
            this.containerManager.overlayElement?.classList.add('reduced-motion');
        }

        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            this.enabled = !e.matches;
            logger.info(`Motion preference changed: ${this.enabled ? 'enabled' : 'disabled'}`);

            if (this.enabled) {
                this.containerManager.overlayElement?.classList.remove('reduced-motion');
            } else {
                this.containerManager.overlayElement?.classList.add('reduced-motion');
            }
        });
    }

    /**
     * Apply overlay for a theme
     * @param {string} themeId - Theme identifier
     * @param {object} overlayConfig - Overlay configuration override (optional)
     */
    async applyOverlay(themeId, overlayConfig = null) {
        console.log(`🎬 applyOverlay called for ${themeId} (currentTheme: ${this.currentTheme}, activeElements: ${this.visibilityManager.activeElements.size}, isApplying: ${this.isApplying})`);

        if (!this.enabled) {
            logger.debug('Overlay disabled (reduced motion or user setting)');
            return;
        }

        // ATOMIC: Check and set flag immediately (prevent race condition)
        if (this.isApplying) {
            console.log(`⛔ SKIPPING - already applying overlay`);
            return;
        }
        this.isApplying = true; // Set IMMEDIATELY after check
        console.log(`🔒 LOCKED - isApplying set to true`);

        try {
            // Check if already applied (after locking)
            if (this.currentTheme === themeId && this.visibilityManager.activeElements.size > 0) {
                console.log(`⛔ SKIPPING - overlay for ${themeId} already applied`);
                logger.debug(`Overlay for ${themeId} already applied - skipping duplicate application`);
                return; // Finally block will release lock
            }

            // Ensure overlay container exists
            if (!this.containerManager.overlayElement) {
                this.containerManager.createOverlayContainer();
            }

            if (!this.containerManager.overlayElement) {
                logger.error('Failed to create overlay container');
                return;
            }

            logger.info('Applying theme overlay', { themeId });

            // Clear existing overlays
            this.clearOverlay();

            this.currentTheme = themeId;

            // Get config from registry or use provided override
            const config = overlayConfig || await themeOverlayConfigRegistry.getConfig(themeId);

            if (!config) {
                logger.debug(`No overlay configuration for theme: ${themeId}`);
                return;
            }

            // Apply the overlay
            this.applyOverlayConfig(config);

        } finally {
            // Always clear applying flag (even if error occurs)
            this.isApplying = false;
            console.log(`🔓 UNLOCKED - isApplying set to false`);
        }
    }

    /**
     * Apply overlay configuration
     * @param {object} config - Overlay configuration {elements: [], rotations: {}}
     * @private
     */
    applyOverlayConfig(config) {
        const elements = config.elements;
        const rotations = config.rotations;

        logger.debug('Applying overlay config', {
            elementsCount: elements.length,
            rotationsCount: rotations ? Object.keys(rotations).length : 0
        });

        // Create each element and register immediately
        elements.forEach(elementConfig => {
            const elementData = this.elementCreator.createElement(
                elementConfig,
                (loadedElementData) => {
                    // Element loaded - apply visibility pattern
                    this.visibilityManager.applyVisibility(loadedElementData);
                },
                // Also register element immediately (before image loads)
                (preloadElementData) => {
                    this.visibilityManager.registerElement(preloadElementData);
                }
            );
        });

        // Initialize rotation sequences
        if (rotations) {
            Object.keys(rotations).forEach(sequenceName => {
                const sequence = rotations[sequenceName];
                this.visibilityManager.startRotationSequence(sequenceName, sequence);
            });
        }

        logger.success('Overlay applied', {
            elementsCount: elements.length,
            rotationsCount: rotations ? Object.keys(rotations).length : 0
        });
    }

    /**
     * Clear all overlay elements
     */
    clearOverlay() {
        logger.debug('Clearing overlay elements');

        // Clear all visibility timers
        this.visibilityManager.clearAll();

        // Clear all containers
        this.containerManager.clearAllContainers();

        this.currentTheme = null;
        // NOTE: Do NOT reset isApplying flag here - it's managed by applyOverlay's finally block
    }

    /**
     * Enable/disable overlay
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        logger.info(`Overlay ${enabled ? 'enabled' : 'disabled'}`);

        if (!enabled) {
            this.clearOverlay();
        } else if (this.currentTheme) {
            this.applyOverlay(this.currentTheme);
        }
    }

    /**
     * Destroy overlay system
     */
    destroy() {
        this.clearOverlay();
        this.containerManager.destroy();
        logger.info('ThemeOverlay destroyed');
    }

    /**
     * Debug helper - inspect current overlay state
     * @returns {object} Current overlay state
     */
    inspectOverlay() {
        const elements = Array.from(this.visibilityManager.activeElements.entries()).map(([id, data]) => ({
            id,
            visible: data.element.style.opacity === '1',
            display: data.element.style.display,
            position: {
                left: data.element.style.left,
                top: data.element.style.top
            }
        }));

        const rotations = Array.from(this.visibilityManager.rotationSequences.entries()).map(([name, data]) => ({
            name,
            currentStep: data.currentStepIndex,
            totalSteps: data.steps.length
        }));

        return {
            enabled: this.enabled,
            currentTheme: this.currentTheme,
            elementsCount: elements.length,
            elements,
            rotationsCount: rotations.length,
            rotations
        };
    }
}

// Export singleton instance
export const themeOverlay = new ThemeOverlay();
export default themeOverlay;

// Expose globally for settings and debugging
if (typeof window !== 'undefined') {
    window.themeOverlay = themeOverlay;
}
