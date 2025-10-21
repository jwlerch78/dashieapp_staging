// js/ui/themes/theme-overlay-element-creator.js
// Element creation and animation for theme overlays
// Handles DOM creation, positioning, and movement animations

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ThemeOverlayElement');

/**
 * ThemeOverlayElementCreator
 * Creates and configures overlay elements with positioning and movement
 */
export class ThemeOverlayElementCreator {
    constructor(containerManager, settingsStore) {
        this.containerManager = containerManager;
        this.settingsStore = settingsStore;
    }

    /**
     * Create and configure an overlay element
     * @param {object} config - Element configuration
     * @param {Function} onLoaded - Callback when image loads
     * @param {Function} onPreload - Callback before image loads (for early registration)
     * @returns {object|null} Element data {element, config} or null if skipped
     */
    createElement(config, onLoaded, onPreload) {
        // Check animation level setting
        const animationLevel = this.getAnimationLevel();

        // Skip elements with movement if animation level is 'low'
        if (animationLevel === 'low' && config.movement?.type !== 'none') {
            logger.debug(`Skipping ${config.id} - animation level is low and element has movement`);
            return null;
        }

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
        wrapper.style.opacity = '0'; // Start invisible
        wrapper.style.display = 'none'; // Start hidden (rotation/visibility will show when ready)
        wrapper.style.transition = 'opacity 0.5s ease-out';

        // Handle image load error
        element.onerror = () => {
            logger.warn(`Failed to load: ${config.src}`);
            wrapper.style.display = 'none';
        };

        // Determine target container
        const targetContainer = this.containerManager.getTargetContainer(config.container);
        if (!targetContainer) {
            logger.debug(`Target container not found: ${config.container} (element will be created on retry)`);
            return null; // Don't create if we can't append
        }

        // Create element data
        const elementData = {
            element: wrapper,
            config,
            intervals: [],
            timeouts: [],
            loaded: false  // Track if image has loaded
        };

        // Call preload callback immediately (before image loads)
        // This allows rotation sequences to find the element even before it's ready
        if (onPreload) {
            onPreload(elementData);
        }

        // Handle image load success
        element.onload = () => {
            // Check if element is still in the DOM (not cleared)
            if (!wrapper.parentNode) {
                logger.debug(`Element ${config.id} loaded but already removed - skipping`);
                return;
            }

            logger.debug(`Loaded: ${config.src}`, { position: config.position });

            // Mark as loaded
            elementData.loaded = true;

            // Apply initial position
            this.applyPosition(wrapper, config.position);

            logger.debug(`Positioned ${config.id}`, {
                left: wrapper.style.left,
                top: wrapper.style.top,
                display: wrapper.style.display,
                opacity: wrapper.style.opacity
            });

            // Call loaded callback (visibility manager will take over)
            if (onLoaded) {
                onLoaded(elementData);
            }
        };

        wrapper.appendChild(element);
        targetContainer.appendChild(wrapper);
        logger.debug(`Element appended to container: ${config.container || 'dashboard'}`);

        return elementData;
    }

    /**
     * Apply positioning to element
     * @param {HTMLElement} element - DOM element
     * @param {object} positionConfig - Position configuration
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
     */
    applyMovement(element, config) {
        const { movement, visibility } = config;

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

        // For periodic visibility, animation runs once per cycle
        // For always visible, animation loops infinitely
        const iterations = visibility?.type === 'periodic' ? '1' : 'infinite';

        // Use 'forwards' fill-mode so element stays at final position after animation completes
        // This prevents the "jump back" issue where the bat would return to starting position
        const fillMode = visibility?.type === 'periodic' ? 'forwards' : 'none';
        element.style.animation = `${animName} ${movement.duration}s ${movement.easing} 0s ${iterations} normal ${fillMode} running`;

        // Store animation name for restarting
        element.dataset.animationName = animName;
        element.dataset.animationDuration = movement.duration;
        element.dataset.animationEasing = movement.easing;
        element.dataset.animationIterations = iterations;
        element.dataset.animationFillMode = fillMode;
    }

    /**
     * Restart movement animation on an element
     * @param {HTMLElement} element - DOM element with existing animation
     */
    restartMovement(element) {
        if (!element.dataset.animationName) return;

        const animName = element.dataset.animationName;
        const duration = element.dataset.animationDuration;
        const easing = element.dataset.animationEasing;
        const iterations = element.dataset.animationIterations;
        const fillMode = element.dataset.animationFillMode;

        // Force animation restart
        element.style.animation = 'none';
        // Trigger reflow to ensure animation restart
        void element.offsetHeight;
        element.style.animation = `${animName} ${duration}s ${easing} 0s ${iterations} normal ${fillMode} running`;
    }

    /**
     * Generate random number in range
     * @param {Array} range - [min, max]
     * @returns {number}
     */
    randomInRange(range) {
        const [min, max] = range;
        return Math.random() * (max - min) + min;
    }

    /**
     * Get animation level from settings
     * @returns {string} - 'low' or 'high'
     */
    getAnimationLevel() {
        if (this.settingsStore) {
            return this.settingsStore.get('interface.animationLevel') || 'high';
        }
        return 'high'; // Default to high
    }
}
