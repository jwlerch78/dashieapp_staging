// js/themes/theme-overlay-applier.js
// Theme overlay system - advanced animated decorations engine
//
// This is the core overlay engine that manages positioning, animation, and visibility
// of theme-specific overlay elements (e.g., Halloween decorations, seasonal effects).
//
// Theme-specific configurations are imported from separate files (e.g., theme-overlay-halloween.js)

import { createLogger } from '../utils/logger.js';
import { HALLOWEEN_OVERLAY_CONFIG } from './theme-overlay-halloween.js';

const logger = createLogger('ThemeOverlay');

/**
 * ThemeOverlay - Advanced animated theme decorations engine
 *
 * Container options:
 * - dashboard: Append to dashboard container (default)
 * - widget-{name}: Append to specific widget iframe (e.g., 'widget-clock')
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
        this.rotationSequences = new Map(); // sequenceName -> {steps: [], currentStepIndex, timeout}
        this.currentTheme = null;
        this.enabled = true;

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
     * @param {object} overlayConfig - Overlay configuration override (optional)
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
     * @param {object} configOverride - Configuration override (optional)
     * @private
     */
    applyHalloweenOverlay(configOverride) {
        logger.info('Loading Halloween overlay elements');

        // Use provided config or default Halloween config
        const config = configOverride || HALLOWEEN_OVERLAY_CONFIG;
        const elements = config.elements;
        const rotations = config.rotations;

        // Create each element
        elements.forEach(elementConfig => {
            this.createElement(elementConfig);
        });

        // Initialize rotation sequences
        if (rotations) {
            Object.keys(rotations).forEach(sequenceName => {
                const sequence = rotations[sequenceName];
                this.startRotationSequence(sequenceName, sequence);
            });
            logger.success('Halloween overlay applied', {
                elementsCount: elements.length,
                rotationsCount: Object.keys(rotations).length
            });
        } else {
            logger.success('Halloween overlay applied', { elementsCount: elements.length });
        }
    }

    /**
     * Create and manage an overlay element
     * @param {object} config - Element configuration
     * @private
     */
    createElement(config) {
        // Check animation level setting
        const animationLevel = this.getAnimationLevel();

        // Skip elements with movement if animation level is 'low'
        if (animationLevel === 'low' && config.movement?.type !== 'none') {
            logger.debug(`Skipping ${config.id} - animation level is low and element has movement`);
            return;
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
        wrapper.style.transition = 'opacity 0.5s ease-out';

        // Handle image load error
        element.onerror = () => {
            logger.warn(`Failed to load: ${config.src}`);
            wrapper.style.display = 'none';
        };

        // Determine target container
        const targetContainer = this.getTargetContainer(config.container);
        if (!targetContainer) {
            logger.debug(`Target container not found: ${config.container} (element will be created on retry)`);
            return; // Don't store if we couldn't append
        }

        // Store reference BEFORE image loads (so it's available in visibility setup)
        const elementData = {
            element: wrapper,
            config,
            intervals: [],
            timeouts: []
        };
        this.activeElements.set(config.id, elementData);

        // Handle image load success
        element.onload = () => {
            // Check if this element is still in activeElements (not cleared)
            if (!this.activeElements.has(config.id)) {
                logger.debug(`Skipping ${config.id} - element was cleared before image loaded`);
                return;
            }

            logger.debug(`Loaded: ${config.src}`, { position: config.position });

            // Apply initial position
            this.applyPosition(wrapper, config.position);

            // Log actual position for debugging
            logger.debug(`Positioned ${config.id}`, {
                left: wrapper.style.left,
                top: wrapper.style.top,
                display: wrapper.style.display,
                opacity: wrapper.style.opacity
            });

            // For periodic visibility with movement, don't apply movement yet
            // It will be applied in the visibility cycle
            if (config.visibility?.type !== 'periodic' || config.movement?.type === 'none') {
                this.applyMovement(wrapper, config);
            }

            // Apply visibility pattern (elementData is already in the map)
            this.applyVisibility(wrapper, config);
        };

        wrapper.appendChild(element);
        targetContainer.appendChild(wrapper);
        logger.debug(`Element appended to container: ${config.container || 'dashboard'}`);
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
                // This is expected during initial theme application before widgets are created
                logger.debug(`Widget iframe not found: ${widgetId} (will retry after widgets initialize)`);
                const allWidgetIframes = Array.from(document.querySelectorAll('.widget-iframe')).map(el => el.id);
                logger.debug(`Available widget iframes:`, allWidgetIframes);
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
                logger.warn(`Widget iframe document not ready: ${widgetId}`, {
                    hasDoc: !!iframeDoc,
                    hasBody: !!iframeDoc?.body,
                    readyState: iframeDoc?.readyState
                });
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
            } else {
                logger.debug(`Reusing overlay container in iframe: ${widgetId}`);
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
        const { movement, position, visibility } = config;

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
        const config = elementData.config;

        const cycle = () => {
            logger.debug(`Starting cycle for ${config.id}`);

            // Show (but keep invisible for a moment while we reposition)
            element.style.display = 'block';

            // Re-randomize position if variable
            if (config.position.type.startsWith('variable')) {
                this.applyPosition(element, config.position);
                logger.debug(`Re-positioned ${config.id}`, {
                    left: element.style.left,
                    top: element.style.top
                });
            }

            // Reset transform to starting position (while still invisible)
            element.style.transform = 'translate(0, 0)';

            // Make visible (using setTimeout to ensure transform/position are applied first)
            setTimeout(() => {
                element.style.opacity = '1';
                logger.debug(`Made ${config.id} visible`, { opacity: element.style.opacity });
            }, 10);

            // Log element state
            logger.debug(`Element state for ${config.id}`, {
                opacity: element.style.opacity,
                display: element.style.display,
                transform: element.style.transform,
                left: element.style.left,
                top: element.style.top,
                zIndex: element.style.zIndex
            });

            // Apply or restart movement animation
            logger.debug(`Movement check for ${config.id}`, {
                hasMovement: !!config.movement,
                movementType: config.movement?.type,
                isNone: config.movement?.type === 'none'
            });

            if (config.movement?.type !== 'none') {
                // First time: setup the keyframes and store animation data
                if (!element.dataset.animationName) {
                    logger.debug(`Applying FIRST movement for ${config.id}`);
                    this.applyMovement(element, config);
                    logger.debug(`Applied initial movement for ${config.id}`, {
                        type: config.movement.type,
                        duration: config.movement.duration,
                        animation: element.style.animation
                    });
                } else {
                    // Subsequent times: restart the animation
                    const animName = element.dataset.animationName;
                    const duration = element.dataset.animationDuration;
                    const easing = element.dataset.animationEasing;
                    const iterations = element.dataset.animationIterations;
                    const fillMode = element.dataset.animationFillMode;

                    logger.debug(`Restarting EXISTING animation for ${config.id}`, {
                        animName,
                        duration,
                        easing,
                        iterations,
                        fillMode
                    });

                    // Force animation restart
                    element.style.animation = 'none';
                    // Trigger reflow to ensure animation restart
                    void element.offsetHeight;
                    element.style.animation = `${animName} ${duration}s ${easing} 0s ${iterations} normal ${fillMode} running`;

                    logger.debug(`Restarted animation for ${config.id}`, {
                        animation: element.style.animation
                    });
                }
            } else {
                logger.debug(`Skipping movement for ${config.id} (type is 'none' or undefined)`);
            }

            const hideTimeout = setTimeout(() => {
                logger.debug(`Hiding ${config.id}`, {
                    willRestartIn: visibility.offDuration,
                    timeoutId: hideTimeout
                });

                // Fade out at current position (don't reset transform yet)
                element.style.opacity = '0';

                // After fade completes, hide display
                const displayHideTimeout = setTimeout(() => {
                    element.style.display = 'none';
                }, 500); // Wait for opacity transition
                elementData.timeouts.push(displayHideTimeout);

                const restartDelay = visibility.offDuration * 1000;
                logger.debug(`Scheduling restart for ${config.id} in ${visibility.offDuration}s`);

                const nextCycleTimeout = setTimeout(() => {
                    logger.debug(`Restarting cycle for ${config.id} after ${visibility.offDuration}s wait`);
                    cycle();
                }, restartDelay);
                elementData.timeouts.push(nextCycleTimeout);

                logger.debug(`Restart timeout created for ${config.id}`, {
                    timeoutId: nextCycleTimeout,
                    delayMs: restartDelay
                });
            }, visibility.onDuration * 1000);

            elementData.timeouts.push(hideTimeout);

            logger.debug(`Hide timeout created for ${config.id}`, {
                timeoutId: hideTimeout,
                delayMs: visibility.onDuration * 1000
            });
        };

        // Start first cycle
        logger.debug(`Setting up periodic visibility for ${config.id}`);
        cycle();
    }

    /**
     * Setup rotating group visibility
     * Members of a group take turns being visible
     * @private
     */
    setupRotatingVisibility(element, elementData, visibility) {
        const { group } = visibility;
        const config = elementData.config;

        if (!group) {
            logger.error(`Rotating visibility requires 'group' property for ${config.id}`);
            return;
        }

        // Get or create group
        if (!this.rotatingGroups.has(group)) {
            this.rotatingGroups.set(group, {
                members: [],
                currentIndex: -1,
                timer: null
            });
            logger.debug(`Created rotating group: ${group}`);
        }

        const groupData = this.rotatingGroups.get(group);

        // Add this element to the group
        groupData.members.push({
            element,
            elementData,
            config,
            visibility
        });

        logger.debug(`Added ${config.id} to rotating group ${group}`, {
            memberCount: groupData.members.length
        });

        // Start the rotation if this is the first member
        if (groupData.members.length === 1) {
            logger.debug(`Starting rotation for group ${group}`);
            this.rotateGroupMember(group);
        }
    }

    /**
     * Show the next member in a rotating group
     * @param {string} groupName - Group name
     * @private
     */
    rotateGroupMember(groupName) {
        const groupData = this.rotatingGroups.get(groupName);
        if (!groupData) return;

        // Hide current member if any
        if (groupData.currentIndex >= 0) {
            const currentMember = groupData.members[groupData.currentIndex];

            // Move to next member
            groupData.currentIndex = (groupData.currentIndex + 1) % groupData.members.length;
            const nextMember = groupData.members[groupData.currentIndex];

            logger.debug(`Transitioning from ${currentMember.config.id} to ${nextMember.config.id} in group ${groupName}`, {
                index: groupData.currentIndex,
                totalMembers: groupData.members.length
            });

            // Start showing next member IMMEDIATELY (overlapping fade)
            this.showRotatingMember(nextMember, groupName);

            // Simultaneously start fading out the current member
            if (currentMember) {
                logger.debug(`Hiding ${currentMember.config.id} from group ${groupName}`);
                currentMember.element.style.opacity = '0';

                setTimeout(() => {
                    currentMember.element.style.display = 'none';
                }, 500); // Wait for fade transition to complete before hiding
            }
        } else {
            // First time - no current member to hide
            groupData.currentIndex = 0;
            const nextMember = groupData.members[groupData.currentIndex];

            logger.debug(`Showing first member ${nextMember.config.id} from group ${groupName}`);
            this.showRotatingMember(nextMember, groupName);
        }
    }

    /**
     * Show a rotating group member
     * @private
     */
    showRotatingMember(member, groupName) {
        const { element, elementData, config, visibility } = member;
        const groupData = this.rotatingGroups.get(groupName);

        // Show element
        element.style.display = 'block';

        // Re-randomize position if variable
        if (config.position.type.startsWith('variable')) {
            this.applyPosition(element, config.position);
            logger.debug(`Re-positioned ${config.id}`, {
                left: element.style.left,
                top: element.style.top
            });
        }

        // Reset transform
        element.style.transform = 'translate(0, 0)';

        // Make visible
        setTimeout(() => {
            element.style.opacity = '1';
            logger.debug(`Made ${config.id} visible`);
        }, 10);

        // Apply or restart movement animation
        if (config.movement?.type !== 'none') {
            if (!element.dataset.animationName) {
                logger.debug(`Applying movement for ${config.id}`);
                this.applyMovement(element, config);
            } else {
                // Restart animation
                const animName = element.dataset.animationName;
                const duration = element.dataset.animationDuration;
                const easing = element.dataset.animationEasing;
                const fillMode = element.dataset.animationFillMode || 'none';

                element.style.animation = 'none';
                void element.offsetHeight;
                element.style.animation = `${animName} ${duration}s ${easing} 0s 1 normal ${fillMode} running`;

                logger.debug(`Restarted animation for ${config.id}`);
            }
        }

        // Calculate how long to show this member
        const displayDuration = visibility.onDuration || 10;

        // For seamless rotation, start the next member slightly before current ends (500ms overlap)
        const rotationDelay = Math.max((displayDuration - 0.5) * 1000, 0);

        // Schedule next rotation
        const timeout = setTimeout(() => {
            // Check if this is the last member in the group
            const isLastMember = groupData.currentIndex === groupData.members.length - 1;

            if (isLastMember && visibility.offDuration) {
                // Wait offDuration before restarting cycle
                logger.debug(`Last member of ${groupName}, waiting ${visibility.offDuration}s before restarting`);

                // Hide current member
                element.style.opacity = '0';
                setTimeout(() => {
                    element.style.display = 'none';
                }, 500);

                const restartTimeout = setTimeout(() => {
                    this.rotateGroupMember(groupName);
                }, visibility.offDuration * 1000);

                elementData.timeouts.push(restartTimeout);
            } else {
                // Show next member with overlap for seamless transition
                this.rotateGroupMember(groupName);
            }
        }, rotationDelay);

        elementData.timeouts.push(timeout);
        groupData.timer = timeout;

        logger.debug(`Scheduled rotation for ${config.id}`, {
            duration: displayDuration,
            isLastMember: groupData.currentIndex === groupData.members.length - 1
        });
    }

    /**
     * Start a rotation sequence
     * @param {string} sequenceName - Name of the rotation sequence
     * @param {Array} steps - Array of steps {element: 'id', duration: N} or {blank: N}
     * @private
     */
    startRotationSequence(sequenceName, steps) {
        logger.info(`Starting rotation sequence: ${sequenceName}`, { stepsCount: steps.length });

        // Store sequence state
        this.rotationSequences.set(sequenceName, {
            steps,
            currentStepIndex: 0,
            timeout: null
        });

        // Start first step
        this.executeRotationStep(sequenceName);
    }

    /**
     * Execute the current step in a rotation sequence
     * @param {string} sequenceName - Name of the rotation sequence
     * @private
     */
    executeRotationStep(sequenceName) {
        const sequenceData = this.rotationSequences.get(sequenceName);
        if (!sequenceData) {
            logger.warn(`Rotation sequence not found: ${sequenceName}`);
            return;
        }

        const { steps, currentStepIndex } = sequenceData;
        const step = steps[currentStepIndex];

        if (!step) {
            logger.error(`Invalid step at index ${currentStepIndex} in sequence ${sequenceName}`);
            return;
        }

        logger.debug(`Executing step ${currentStepIndex} of ${sequenceName}`, step);

        if (step.element) {
            // Show element for duration
            const elementId = step.element;
            const duration = step.duration;

            this.showRotationElement(elementId, duration, () => {
                // After element finishes, move to next step
                this.moveToNextRotationStep(sequenceName);
            });
        } else if (step.blank) {
            // Blank period - show nothing
            const duration = step.blank;
            logger.debug(`Blank period in ${sequenceName}: ${duration}s`);

            const timeout = setTimeout(() => {
                this.moveToNextRotationStep(sequenceName);
            }, duration * 1000);

            sequenceData.timeout = timeout;
        }
    }

    /**
     * Show an element as part of a rotation
     * @param {string} elementId - Element ID to show
     * @param {number} duration - Duration in seconds
     * @param {Function} onComplete - Callback when element finishes
     * @private
     */
    showRotationElement(elementId, duration, onComplete) {
        const elementData = this.activeElements.get(elementId);
        if (!elementData) {
            logger.warn(`Element not found for rotation: ${elementId}`);
            if (onComplete) onComplete();
            return;
        }

        const { element, config } = elementData;

        logger.debug(`Showing rotation element: ${elementId} for ${duration}s`);

        // Make element visible
        element.style.display = 'block';

        // Re-randomize position if variable
        if (config.position.type.startsWith('variable')) {
            this.applyPosition(element, config.position);
        }

        // Reset transform
        element.style.transform = 'translate(0, 0)';

        // Fade in
        setTimeout(() => {
            element.style.opacity = '1';
            logger.debug(`Made ${elementId} visible`);
        }, 10);

        // Apply or restart movement animation
        if (config.movement?.type !== 'none') {
            if (!element.dataset.animationName) {
                this.applyMovement(element, config);
            } else {
                // Restart animation
                const animName = element.dataset.animationName;
                const animDuration = element.dataset.animationDuration;
                const easing = element.dataset.animationEasing;
                const fillMode = element.dataset.animationFillMode;

                element.style.animation = 'none';
                void element.offsetHeight;
                element.style.animation = `${animName} ${animDuration}s ${easing} 0s 1 normal ${fillMode} running`;
            }
        }

        // Schedule hide after duration
        const timeout = setTimeout(() => {
            logger.debug(`Hiding rotation element: ${elementId}`);

            // Fade out
            element.style.opacity = '0';

            setTimeout(() => {
                element.style.display = 'none';

                // Call completion callback
                if (onComplete) onComplete();
            }, 500); // Wait for fade transition
        }, duration * 1000);

        elementData.timeouts.push(timeout);
    }

    /**
     * Move to the next step in a rotation sequence
     * @param {string} sequenceName - Name of the rotation sequence
     * @private
     */
    moveToNextRotationStep(sequenceName) {
        const sequenceData = this.rotationSequences.get(sequenceName);
        if (!sequenceData) return;

        const { steps } = sequenceData;

        // Move to next step (or loop back to start)
        sequenceData.currentStepIndex = (sequenceData.currentStepIndex + 1) % steps.length;

        logger.debug(`Moving to step ${sequenceData.currentStepIndex} in ${sequenceName}`);

        // Execute next step
        this.executeRotationStep(sequenceName);
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
     * Get animation level from settings
     * @returns {string} - 'low' or 'high'
     * @private
     */
    getAnimationLevel() {
        if (window.settingsStore) {
            return window.settingsStore.get('interface.animationLevel') || 'high';
        }
        return 'high'; // Default to high
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

        // Clear rotation sequence timeouts
        this.rotationSequences.forEach((sequenceData) => {
            if (sequenceData.timeout) {
                clearTimeout(sequenceData.timeout);
            }
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
        this.rotationSequences.clear();
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

// Expose globally for settings and debugging
if (typeof window !== 'undefined') {
    window.themeOverlay = themeOverlay;
}
