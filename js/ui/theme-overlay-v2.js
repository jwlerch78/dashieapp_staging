// js/ui/theme-overlay-v2.js
// Enhanced theme overlay system with advanced positioning and visibility
// v2.0 - Variable positioning, movement patterns, visibility control

import { createLogger } from '../utils/logger.js';

const logger = createLogger('ThemeOverlay');

/**
 * ThemeOverlay v2 - Advanced animated theme decorations
 *
 * Container options:
 * - dashboard: Append to dashboard container (default)
 * - widget-{name}: Append to specific widget (e.g., 'widget-clock')
 *
 * Position types:
 * - static-xy: Fixed position (x, y)
 * - variable-x: Random X, fixed Y (xRange, y)
 * - variable-y: Fixed X, random Y (x, yRange)
 * - variable-xy: Random X and Y (xRange, yRange)
 *
 * Movement types:
 * - none: Static element
 * - right/left: Move horizontally offscreen
 * - up/down: Move vertically offscreen
 *
 * Visibility types:
 * - always: Always visible
 * - periodic: Show/hide cycle (onDuration, offDuration)
 * - rotating: Group rotation (group name, members take turns)
 */
class ThemeOverlay {
    constructor() {
        this.overlayElement = null;
        this.activeElements = new Map(); // id -> {element, config, intervals, timeouts}
        this.rotatingGroups = new Map(); // groupName -> {members: [], currentIndex, timer}
        this.currentTheme = null;
        this.enabled = true;

        logger.verbose('ThemeOverlay v2 constructed');
    }

    /**
     * Initialize overlay system
     */
    initialize() {
        logger.info('Initializing ThemeOverlay v2');

        // Check reduced motion preference
        this.checkReducedMotionPreference();

        logger.success('ThemeOverlay v2 initialized');
    }

    /**
     * Create the overlay container element (lazy)
     * @private
     */
    createOverlayContainer() {
        if (this.overlayElement) return;

        logger.debug('Creating overlay container');

        this.overlayElement = document.createElement('div');
        this.overlayElement.id = 'theme-overlay';
        this.overlayElement.className = 'theme-overlay';

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
     * @param {object} overlayConfig - Overlay configuration
     */
    applyOverlay(themeId, overlayConfig = null) {
        if (!this.enabled) {
            logger.debug('Overlay disabled (reduced motion)');
            return;
        }

        // Ensure overlay container exists
        if (!this.overlayElement) {
            this.createOverlayContainer();
        }

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
    }

    /**
     * Apply Halloween-specific overlay
     * @param {object} config - Configuration override
     * @private
     */
    applyHalloweenOverlay(config) {
        logger.info('Loading Halloween overlay elements');

        // Halloween element configurations
        const elements = [
            {
                id: 'bat-drop-1',
                src: '/assets/themes/halloween/animated/bat-flying.gif',
                container: 'dashboard', // Dashboard-level overlay
                size: { width: '120px' },
                position: {
                    type: 'variable-x',
                    y: '-50px',
                    xRange: [10, 90]  // Random X between 10-90%
                },
                movement: {
                    type: 'down',
                    distance: '300px',
                    duration: 3,
                    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                },
                visibility: {
                    type: 'periodic',
                    onDuration: 6,
                    offDuration: 50
                }
            },
            {
                id: 'spider-walk-1',
                src: '/assets/themes/halloween/animated/spider-walking.gif',
                container: 'dashboard', // Dashboard-level overlay
                size: { width: '100px' },
                position: {
                    type: 'variable-y',
                    x: '-100px',
                    yRange: [60, 90]  // Random Y between 60-90%
                },
                movement: {
                    type: 'none'
                },
                visibility: {
                    type: 'periodic',
                    onDuration: 10,
                    offDuration: 8
                }
            },
            {
                id: 'bat-fly-1',
                src: '/assets/themes/halloween/animated/bat-flying.gif',
                container: 'widget-calendar', // Dashboard-level overlay
                size: { width: '100px' },
                position: {
                    type: 'variable-y',
                    x: '-100px',
                    yRange: [10, 40]  // Random Y between 10-40%
                },
                movement: {
                    type: 'right',
                    distance: 'calc(100vw + 200px)',
                    duration: 12,
                    easing: 'linear'
                },
                visibility: {
                    type: 'periodic',
                    onDuration: 12,
                    offDuration: 6
                }
            },
            {
                id: 'pumpkin-glow-1',
                src: '/assets/themes/halloween/animated/pumpkin-glow.gif',
                container: 'dashboard', // Dashboard-level overlay
                size: { width: '75px' },
                position: {
                    type: 'static-xy',
                    x: '53%',
                    y: '0%'
                },
                movement: {
                    type: 'none'
                },
                visibility: {
                    type: 'always'
                }
            },
            {
                id: 'spider-drop',
                src: '/assets/themes/halloween/animated/spider-drop.gif',
                container: 'dashboard', // Widget-specific overlay
                size: { width: '60px' },
                position: {
                    type: 'static-xy',
                    x: '15%', // top of header
                    y: '1.2%'    
                },
                movement: {
                    type: 'none'
                },
                visibility: {
                    type: 'always'
                }
            }
        ];

        // Create each element
        elements.forEach(elementConfig => {
            this.createElement(elementConfig);
        });

        logger.success('Halloween overlay applied', { elementsCount: elements.length });
    }

    /**
     * Create and manage an overlay element
     * @param {object} config - Element configuration
     * @private
     */
    createElement(config) {
        const wrapper = document.createElement('div');
        wrapper.className = 'overlay-element-wrapper';
        wrapper.dataset.id = config.id;

        const element = document.createElement('img');
        element.src = config.src;
        element.alt = config.id;
        element.style.width = config.size.width;
        element.style.height = config.size.height || 'auto';

        wrapper.style.position = 'absolute';
        wrapper.style.pointerEvents = 'none';
        wrapper.style.zIndex = 100;

        // Handle image load
        element.onerror = () => {
            logger.warn(`Failed to load: ${config.src}`);
            wrapper.style.display = 'none';
        };

        element.onload = () => {
            logger.debug(`Loaded: ${config.src}`);

            // Apply initial position
            this.applyPosition(wrapper, config.position);

            // Apply movement
            this.applyMovement(wrapper, config);

            // Apply visibility pattern
            this.applyVisibility(wrapper, config);
        };

        wrapper.appendChild(element);

        // Determine target container
        const targetContainer = this.getTargetContainer(config.container);
        if (targetContainer) {
            targetContainer.appendChild(wrapper);
            logger.debug(`Element appended to container: ${config.container || 'dashboard'}`);
        } else {
            logger.error(`Target container not found: ${config.container}`);
            return; // Don't store if we couldn't append
        }

        // Store reference
        this.activeElements.set(config.id, {
            element: wrapper,
            config,
            intervals: [],
            timeouts: []
        });
    }

    /**
     * Get target container for overlay element
     * @param {string} containerSpec - Container specification ('dashboard' or 'widget-{name}')
     * @returns {HTMLElement|null}
     * @private
     */
    getTargetContainer(containerSpec) {
        // Default to dashboard overlay
        if (!containerSpec || containerSpec === 'dashboard') {
            return this.overlayElement;
        }

        // Widget container (e.g., 'widget-clock')
        if (containerSpec.startsWith('widget-')) {
            const widgetId = containerSpec; // e.g., 'widget-clock'
            const widgetIframe = document.getElementById(widgetId);

            if (!widgetIframe) {
                logger.warn(`Widget iframe not found: ${widgetId}`);
                return null;
            }

            // Try to access the iframe's content document
            let iframeDoc;
            try {
                iframeDoc = widgetIframe.contentDocument || widgetIframe.contentWindow?.document;
            } catch (error) {
                logger.error(`Cannot access iframe document for ${widgetId} (cross-origin?)`, error);
                return null;
            }

            if (!iframeDoc || !iframeDoc.body) {
                logger.warn(`Widget iframe document not ready: ${widgetId}`);
                return null;
            }

            // Create or get overlay container inside iframe's body
            let widgetOverlay = iframeDoc.body.querySelector('.widget-theme-overlay');
            if (!widgetOverlay) {
                widgetOverlay = iframeDoc.createElement('div');
                widgetOverlay.className = 'widget-theme-overlay';
                widgetOverlay.style.position = 'fixed';
                widgetOverlay.style.top = '0';
                widgetOverlay.style.left = '0';
                widgetOverlay.style.width = '100%';
                widgetOverlay.style.height = '100%';
                widgetOverlay.style.pointerEvents = 'none';
                widgetOverlay.style.overflow = 'hidden';
                widgetOverlay.style.zIndex = '9999'; // Top layer in iframe
                iframeDoc.body.appendChild(widgetOverlay);
                logger.debug(`Created overlay container inside iframe: ${widgetId}`);
            }

            return widgetOverlay;
        }

        logger.warn(`Unknown container specification: ${containerSpec}`);
        return null;
    }

    /**
     * Apply positioning to element
     * @param {HTMLElement} element - DOM element
     * @param {object} positionConfig - Position configuration
     * @private
     */
    applyPosition(element, positionConfig) {
        const { type } = positionConfig;

        switch (type) {
            case 'static-xy':
                element.style.left = positionConfig.x;
                element.style.top = positionConfig.y;
                break;

            case 'variable-x':
                const randomX = this.randomInRange(positionConfig.xRange);
                element.style.left = `${randomX}%`;
                element.style.top = positionConfig.y;
                break;

            case 'variable-y':
                element.style.left = positionConfig.x;
                const randomY = this.randomInRange(positionConfig.yRange);
                element.style.top = `${randomY}%`;
                break;

            case 'variable-xy':
                const randomX2 = this.randomInRange(positionConfig.xRange);
                const randomY2 = this.randomInRange(positionConfig.yRange);
                element.style.left = `${randomX2}%`;
                element.style.top = `${randomY2}%`;
                break;
        }
    }

    /**
     * Apply movement animation to element
     * @param {HTMLElement} element - DOM element
     * @param {object} config - Full element configuration
     * @private
     */
    applyMovement(element, config) {
        const { movement, position } = config;

        if (movement.type === 'none') return;

        // Create animation name
        const animName = `${config.id}-move`;

        // Generate keyframes for movement
        let keyframes = '';
        switch (movement.type) {
            case 'right':
                keyframes = `
                    @keyframes ${animName} {
                        from { transform: translateX(0); }
                        to { transform: translateX(${movement.distance}); }
                    }
                `;
                break;

            case 'left':
                keyframes = `
                    @keyframes ${animName} {
                        from { transform: translateX(0); }
                        to { transform: translateX(-${movement.distance}); }
                    }
                `;
                break;

            case 'down':
                keyframes = `
                    @keyframes ${animName} {
                        from { transform: translateY(0); }
                        to { transform: translateY(${movement.distance}); }
                    }
                `;
                break;

            case 'up':
                keyframes = `
                    @keyframes ${animName} {
                        from { transform: translateY(0); }
                        to { transform: translateY(-${movement.distance}); }
                    }
                `;
                break;
        }

        // Inject keyframes
        const styleEl = document.createElement('style');
        styleEl.textContent = keyframes;
        document.head.appendChild(styleEl);

        // Apply animation
        element.style.animation = `${animName} ${movement.duration}s ${movement.easing} infinite`;
    }

    /**
     * Apply visibility pattern
     * @param {HTMLElement} element - DOM element
     * @param {object} config - Full element configuration
     * @private
     */
    applyVisibility(element, config) {
        const { visibility } = config;
        const elementData = this.activeElements.get(config.id);

        switch (visibility.type) {
            case 'always':
                element.style.opacity = '1';
                break;

            case 'periodic':
                this.setupPeriodicVisibility(element, elementData, visibility);
                break;

            case 'rotating':
                this.setupRotatingVisibility(element, elementData, visibility);
                break;
        }
    }

    /**
     * Setup periodic show/hide cycle
     * @private
     */
    setupPeriodicVisibility(element, elementData, visibility) {
        const cycle = () => {
            // Show
            element.style.opacity = '1';
            element.style.display = 'block';

            // Re-randomize position if variable
            const config = elementData.config;
            if (config.position.type.startsWith('variable')) {
                this.applyPosition(element, config.position);
            }

            const hideTimeout = setTimeout(() => {
                // Hide
                element.style.opacity = '0';

                const nextCycleTimeout = setTimeout(cycle, visibility.offDuration * 1000);
                elementData.timeouts.push(nextCycleTimeout);
            }, visibility.onDuration * 1000);

            elementData.timeouts.push(hideTimeout);
        };

        // Start first cycle
        cycle();
    }

    /**
     * Setup rotating group visibility
     * @private
     */
    setupRotatingVisibility(element, elementData, visibility) {
        // TODO: Implement rotating groups
        // For now, treat as always visible
        element.style.opacity = '1';
    }

    /**
     * Generate random number in range
     * @param {Array} range - [min, max]
     * @returns {number}
     * @private
     */
    randomInRange(range) {
        const [min, max] = range;
        return Math.random() * (max - min) + min;
    }

    /**
     * Clear all overlay elements
     */
    clearOverlay() {
        logger.debug('Clearing overlay elements');

        // Clear all intervals and timeouts
        this.activeElements.forEach((data) => {
            data.intervals.forEach(clearInterval);
            data.timeouts.forEach(clearTimeout);
        });

        // Remove dashboard overlay elements
        if (this.overlayElement) {
            while (this.overlayElement.firstChild) {
                this.overlayElement.removeChild(this.overlayElement.firstChild);
            }
        }

        // Remove all widget overlay containers
        const widgetOverlays = document.querySelectorAll('.widget-theme-overlay');
        widgetOverlays.forEach(overlay => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });

        this.activeElements.clear();
        this.rotatingGroups.clear();
        this.currentTheme = null;
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
     * Destroy overlay
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
