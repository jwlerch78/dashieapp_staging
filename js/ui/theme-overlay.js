// js/ui/theme-overlay.js
// Dynamic theme overlay system for animated decorations
// Displays themed elements (GIFs, SVGs, Lottie) above dashboard

import { createLogger } from '../utils/logger.js';

const logger = createLogger('ThemeOverlay');

/**
 * ThemeOverlay - Animated theme decorations
 *
 * Features:
 * - Click-through overlay layer
 * - Positioned animated elements
 * - Respects reduced motion preferences
 * - GPU-accelerated animations
 */
class ThemeOverlay {
    constructor() {
        this.overlayElement = null;
        this.activeElements = [];
        this.currentTheme = null;
        this.enabled = true;

        logger.verbose('ThemeOverlay constructed');
    }

    /**
     * Initialize overlay system
     */
    initialize() {
        logger.info('Initializing ThemeOverlay');

        // Don't create container yet - will be created on first use
        // (Dashboard might not exist yet during early initialization)

        // Check reduced motion preference
        this.checkReducedMotionPreference();

        logger.success('ThemeOverlay initialized');
    }

    /**
     * Create the overlay container element
     * @private
     */
    createOverlayContainer() {
        // Don't create if already exists
        if (this.overlayElement) {
            return;
        }

        logger.debug('Creating overlay container');

        this.overlayElement = document.createElement('div');
        this.overlayElement.id = 'theme-overlay';
        this.overlayElement.className = 'theme-overlay';

        // Insert into dashboard (above widgets, below modals)
        const dashboard = document.getElementById('dashboard-container');
        if (dashboard) {
            dashboard.appendChild(this.overlayElement);
            logger.debug('Overlay container added to dashboard');
        } else {
            logger.warn('Dashboard container not found, appending to body');
            document.body.appendChild(this.overlayElement);
        }
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
            this.overlayElement?.classList.add('reduced-motion');
        }

        // Listen for changes
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            this.enabled = !e.matches;
            logger.info(`Motion preference changed: ${this.enabled ? 'enabled' : 'disabled'}`);

            if (this.enabled) {
                this.overlayElement?.classList.remove('reduced-motion');
            } else {
                this.overlayElement?.classList.add('reduced-motion');
            }
        });
    }

    /**
     * Apply overlay for a theme
     * @param {string} themeId - Theme identifier
     * @param {object} overlayConfig - Overlay configuration (optional for now)
     */
    applyOverlay(themeId, overlayConfig = null) {
        if (!this.enabled) {
            logger.debug('Overlay disabled (reduced motion)');
            return;
        }

        // Ensure overlay container exists (lazy initialization)
        if (!this.overlayElement) {
            this.createOverlayContainer();
        }

        // Double-check it was created successfully
        if (!this.overlayElement) {
            logger.error('Failed to create overlay container');
            return;
        }

        logger.info('Applying theme overlay', { themeId });

        // Clear existing overlays
        this.clearOverlay();

        this.currentTheme = themeId;

        // Apply theme-specific overlays
        if (themeId === 'halloween-dark' || themeId === 'halloween-light') {
            this.applyHalloweenOverlay(overlayConfig);
        }
        // Add more themes here in the future
    }

    /**
     * Apply Halloween-specific overlay
     * @param {object} config - Halloween overlay configuration
     * @private
     */
    applyHalloweenOverlay(config) {
        logger.info('Loading Halloween overlay elements');

        // Halloween overlay elements
        // Files: spider-drop.gif, spider-walking.gif, bat-flying.gif, pumpkin-glow.gif
        const elements = [
            // Spider dropping from top-left
            {
                type: 'gif',
                src: '/assets/themes/halloween/animated/spider-drop.gif',
                position: { top: '-50px', left: '15%' },
                size: { width: '120px' },
                animation: 'spider-drop',
                delay: 0
            },
            // Spider walking across bottom
            {
                type: 'gif',
                src: '/assets/themes/halloween/animated/spider-walking.gif',
                position: { bottom: '5%', left: '0' },
                size: { width: '100px' },
                animation: 'spider-walk',
                delay: 1500
            },
            // Bat flying across screen
            {
                type: 'gif',
                src: '/assets/themes/halloween/animated/bat-flying.gif',
                position: { top: '15%', left: '-100px' },
                size: { width: '100px' },
                animation: 'bat-fly',
                delay: 3000
            },
            // Glowing pumpkin in corner
            {
                type: 'gif',
                src: '/assets/themes/halloween/animated/pumpkin-glow.gif',
                position: { bottom: '10%', right: '5%' },
                size: { width: '140px' },
                animation: 'pumpkin-glow',
                delay: 500
            }
        ];

        // Create DOM elements
        elements.forEach((elementConfig, index) => {
            this.createOverlayElement(elementConfig, index);
        });

        logger.success('Halloween overlay applied', { elementsCount: elements.length });
    }

    /**
     * Create a single overlay element
     * @param {object} config - Element configuration
     * @param {number} index - Element index
     * @private
     */
    createOverlayElement(config, index) {
        const element = document.createElement('div');
        element.className = `overlay-element overlay-${config.type}`;
        element.dataset.index = index;

        // Create the image element
        const img = document.createElement('img');
        img.src = config.src;
        img.alt = `Halloween decoration ${index + 1}`;

        // Apply positioning
        Object.assign(element.style, {
            position: 'absolute',
            ...config.position,
            width: config.size.width,
            height: config.size.height || 'auto',
            pointerEvents: 'none', // Click-through
            zIndex: 100 + index
        });

        // Apply animation class
        if (config.animation) {
            element.classList.add(`animate-${config.animation}`);
        }

        // Apply animation delay
        if (config.delay) {
            element.style.animationDelay = `${config.delay}ms`;
        }

        // Handle image load errors gracefully
        img.onerror = () => {
            logger.warn(`Failed to load overlay image: ${config.src}`);
            element.style.display = 'none';
        };

        img.onload = () => {
            logger.debug(`Loaded overlay image: ${config.src}`);
        };

        element.appendChild(img);
        this.overlayElement.appendChild(element);
        this.activeElements.push(element);
    }

    /**
     * Clear all overlay elements
     */
    clearOverlay() {
        if (!this.overlayElement) return;

        logger.debug('Clearing overlay elements');

        // Remove all child elements
        while (this.overlayElement.firstChild) {
            this.overlayElement.removeChild(this.overlayElement.firstChild);
        }

        this.activeElements = [];
        this.currentTheme = null;
    }

    /**
     * Enable/disable overlay
     * @param {boolean} enabled - Whether overlay should be enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        logger.info(`Overlay ${enabled ? 'enabled' : 'disabled'}`);

        if (!enabled) {
            this.clearOverlay();
        } else if (this.currentTheme) {
            // Re-apply current theme
            this.applyOverlay(this.currentTheme);
        }
    }

    /**
     * Destroy overlay and clean up
     */
    destroy() {
        this.clearOverlay();

        if (this.overlayElement && this.overlayElement.parentNode) {
            this.overlayElement.parentNode.removeChild(this.overlayElement);
        }

        this.overlayElement = null;
        logger.info('ThemeOverlay destroyed');
    }
}

// Export singleton instance
export const themeOverlay = new ThemeOverlay();
export default themeOverlay;
