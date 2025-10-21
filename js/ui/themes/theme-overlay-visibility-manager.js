// js/ui/themes/theme-overlay-visibility-manager.js
// Visibility pattern management for theme overlays
// Handles periodic cycles and rotation sequences

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ThemeOverlayVisibility');

/**
 * ThemeOverlayVisibilityManager
 * Manages visibility patterns (always, periodic, rotation sequences)
 */
export class ThemeOverlayVisibilityManager {
    constructor(elementCreator) {
        this.elementCreator = elementCreator;
        this.activeElements = new Map(); // id -> {element, config, intervals, timeouts}
        this.rotationSequences = new Map(); // sequenceName -> {steps, currentStepIndex, timeout}
    }

    /**
     * Register an element for rotation sequences (before it loads)
     * @param {object} elementData - Element data {element, config, intervals, timeouts}
     */
    registerElement(elementData) {
        const { config } = elementData;
        // Store element for rotation sequences to find
        this.activeElements.set(config.id, elementData);
        console.log(`📝 REGISTER: ${config.id} (loaded: ${elementData.loaded})`);
        logger.debug(`Registered element for rotations: ${config.id}`);
    }

    /**
     * Apply visibility pattern to an element (after it loads)
     * @param {object} elementData - Element data {element, config, intervals, timeouts}
     */
    applyVisibility(elementData) {
        const { element, config } = elementData;
        const { visibility } = config;

        console.log(`✅ LOADED: ${config.id} (has visibility: ${!!visibility})`);

        // Element already registered in registerElement() - no need to set again

        // Elements without visibility are controlled by rotation sequences
        // DON'T set display:none here - let rotation sequence control visibility entirely
        if (!visibility) {
            console.log(`🎭 ROTATION-CONTROLLED: ${config.id} - visibility managed by rotation sequence`);
            logger.debug(`Element ${config.id} has no visibility config - controlled by rotation sequence`);
            // Don't touch element visibility - rotation sequence handles it
            return;
        }

        switch (visibility.type) {
            case 'always':
                // For movement + always visible, apply movement once
                if (config.movement?.type !== 'none') {
                    this.elementCreator.applyMovement(element, config);
                }
                element.style.opacity = '1';
                break;

            case 'periodic':
                this.setupPeriodicVisibility(elementData);
                break;
        }
    }

    /**
     * Setup periodic show/hide cycle
     * @param {object} elementData - Element data
     */
    setupPeriodicVisibility(elementData) {
        const { element, config } = elementData;
        const { visibility } = config;

        const cycle = () => {
            logger.debug(`Starting cycle for ${config.id}`);

            // Show (but keep invisible for a moment while we reposition)
            element.style.display = 'block';

            // Re-randomize position if variable
            if (config.position.type.startsWith('variable')) {
                this.elementCreator.applyPosition(element, config.position);
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

            // Apply or restart movement animation
            if (config.movement?.type !== 'none') {
                // First time: setup the keyframes and store animation data
                if (!element.dataset.animationName) {
                    logger.debug(`Applying FIRST movement for ${config.id}`);
                    this.elementCreator.applyMovement(element, config);
                } else {
                    // Subsequent times: restart the animation
                    logger.debug(`Restarting EXISTING animation for ${config.id}`);
                    this.elementCreator.restartMovement(element);
                }
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
            }, visibility.onDuration * 1000);

            elementData.timeouts.push(hideTimeout);
        };

        // Start first cycle
        logger.debug(`Setting up periodic visibility for ${config.id}`);
        cycle();
    }

    /**
     * Start a rotation sequence
     * @param {string} sequenceName - Name of the rotation sequence
     * @param {Array} steps - Array of steps {element: 'id', duration: N} or {blank: N}
     */
    startRotationSequence(sequenceName, steps) {
        console.log(`🎬 START ROTATION: ${sequenceName} (${steps.length} steps)`);
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

        console.log(`🎯 STEP ${currentStepIndex + 1}/${steps.length} in ${sequenceName}:`, step);
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
            const blankEndTime = Date.now() + (duration * 1000);
            console.log(`⬜ BLANK: ${sequenceName} for ${duration}s, next starts at ${new Date(blankEndTime).toLocaleTimeString()}`);
            logger.debug(`Blank period in ${sequenceName}: ${duration}s`);

            const timeout = setTimeout(() => {
                const now = new Date().toLocaleTimeString();
                console.log(`⬜ BLANK END: ${sequenceName}, next element starting at ${now}`);
                this.moveToNextRotationStep(sequenceName);
            }, duration * 1000);

            sequenceData.timeout = timeout;
        }
    }

    /**
     * Show an element as part of a rotation
     * @param {string} elementId - Element ID to show
     * @param {number} duration - Display duration in seconds
     * @param {Function} onComplete - Callback when element finishes
     */
    showRotationElement(elementId, duration, onComplete) {
        const elementData = this.activeElements.get(elementId);
        if (!elementData) {
            console.log(`❌ NOT FOUND: ${elementId} - skipping (100ms)`);
            logger.warn(`Element not found for rotation: ${elementId} - skipping to next step`);
            // Use setTimeout to prevent stack overflow from immediate callback
            if (onComplete) {
                setTimeout(() => onComplete(), 100);
            }
            return;
        }

        // Check if image has loaded yet
        if (!elementData.loaded) {
            console.log(`⏭️ SKIP: ${elementId} not loaded yet (100ms)`);
            logger.debug(`Element ${elementId} not loaded yet - skipping to next step`);
            // Skip this element and move to next
            if (onComplete) {
                setTimeout(() => onComplete(), 100);
            }
            return;
        }

        const { element, config } = elementData;

        const showTime = new Date().toLocaleTimeString();
        console.log(`🎃 SHOW: ${elementId} for ${duration}s at ${showTime} (loaded: ${elementData.loaded})`);
        logger.debug(`Showing rotation element: ${elementId} for ${duration}s`);

        // Make element visible
        element.style.display = 'block';

        // Re-randomize position if variable
        if (config.position.type.startsWith('variable')) {
            this.elementCreator.applyPosition(element, config.position);
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
                this.elementCreator.applyMovement(element, config);
            } else {
                // Restart animation
                this.elementCreator.restartMovement(element);
            }
        }

        // TIMING FIX: Calculate total duration including movement
        // If element has movement, we need to wait for both display duration AND movement to complete
        let totalDuration = duration;
        const fadeOutDuration = 0.5; // 500ms fade out

        if (config.movement?.type !== 'none' && config.movement?.duration) {
            // Use the longer of the two durations to ensure animation completes
            totalDuration = Math.max(duration, config.movement.duration);
            console.log(`⏱️ TIMING: ${elementId} - rotation: ${duration}s, movement: ${config.movement.duration}s, using: ${totalDuration}s`);
            logger.debug(`Adjusted duration for ${elementId}: ${duration}s → ${totalDuration}s (movement: ${config.movement.duration}s)`);
        }

        // Total time until next element starts = totalDuration + fade out
        const totalTimeUntilNext = totalDuration + fadeOutDuration;
        console.log(`⏰ SCHEDULE: ${elementId} will show for ${totalDuration}s, then hide (fade ${fadeOutDuration}s), next starts in ${totalTimeUntilNext}s`);

        // Schedule hide after total duration
        const hideTime = Date.now() + (totalDuration * 1000);
        const nextStartTime = Date.now() + (totalTimeUntilNext * 1000);
        console.log(`🕐 TIMELINE: ${elementId} | Hide at: ${new Date(hideTime).toLocaleTimeString()}, Next starts: ${new Date(nextStartTime).toLocaleTimeString()}`);

        const timeout = setTimeout(() => {
            console.log(`🌙 HIDE: ${elementId} after ${totalDuration}s`);
            logger.debug(`Hiding rotation element: ${elementId}`);

            // Fade out
            element.style.opacity = '0';

            setTimeout(() => {
                element.style.display = 'none';

                // Call completion callback
                const now = new Date().toLocaleTimeString();
                console.log(`✔️ COMPLETE: ${elementId} hidden, next element starting at ${now}`);
                if (onComplete) onComplete();
            }, 500); // Wait for fade transition
        }, totalDuration * 1000);

        elementData.timeouts.push(timeout);
    }

    /**
     * Move to the next step in a rotation sequence
     * @param {string} sequenceName - Name of the rotation sequence
     */
    moveToNextRotationStep(sequenceName) {
        const sequenceData = this.rotationSequences.get(sequenceName);
        if (!sequenceData) return;

        const { steps } = sequenceData;

        // Move to next step (or loop back to start)
        sequenceData.currentStepIndex = (sequenceData.currentStepIndex + 1) % steps.length;

        console.log(`➡️ NEXT STEP: ${sequenceName} -> step ${sequenceData.currentStepIndex}/${steps.length}`);
        logger.debug(`Moving to step ${sequenceData.currentStepIndex} in ${sequenceName}`);

        // Execute next step
        this.executeRotationStep(sequenceName);
    }

    /**
     * Get an element by ID
     * @param {string} elementId - Element ID
     * @returns {object|null} Element data or null
     */
    getElement(elementId) {
        return this.activeElements.get(elementId);
    }

    /**
     * Clear all visibility timers and intervals
     */
    clearAll() {
        // Clear all element timers
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

        this.activeElements.clear();
        this.rotationSequences.clear();
    }
}
