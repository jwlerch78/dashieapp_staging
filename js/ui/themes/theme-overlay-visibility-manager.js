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
        logger.debug(`Registered element for rotations: ${config.id} (loaded: ${elementData.loaded})`);
    }

    /**
     * Apply visibility pattern to an element (after it loads)
     * @param {object} elementData - Element data {element, config, intervals, timeouts}
     */
    applyVisibility(elementData) {
        const { element, config } = elementData;
        const { visibility } = config;

        logger.debug(`Element ${config.id} loaded (has visibility: ${!!visibility})`);

        // Element already registered in registerElement() - no need to set again

        // Elements without visibility are controlled by rotation sequences
        // DON'T set display:none here - let rotation sequence control visibility entirely
        if (!visibility) {
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

        // Generate unique instance ID to prevent old cycles from interfering
        const instanceId = Date.now() + Math.random();
        elementData.periodicInstanceId = instanceId;

        const cycle = () => {
            // Validate this cycle belongs to the current instance
            if (elementData.periodicInstanceId !== instanceId) {
                logger.debug(`Ignoring stale periodic cycle for ${config.id} (old instance ${instanceId})`);
                return;
            }
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
                    // Validate instance before restarting cycle
                    if (elementData.periodicInstanceId === instanceId) {
                        logger.debug(`Restarting cycle for ${config.id} after ${visibility.offDuration}s wait`);
                        cycle();
                    } else {
                        logger.debug(`Skipping periodic cycle restart for ${config.id} (old instance ${instanceId})`);
                    }
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
        logger.info(`Starting rotation sequence: ${sequenceName}`, { stepsCount: steps.length });

        // Generate unique ID for this sequence instance to prevent old callbacks from affecting new instances
        const instanceId = Date.now() + Math.random();

        // Store sequence state
        this.rotationSequences.set(sequenceName, {
            steps,
            currentStepIndex: 0,
            timeout: null,
            instanceId: instanceId  // Track which instance this is
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

        const { steps, currentStepIndex, instanceId } = sequenceData;
        const step = steps[currentStepIndex];

        if (!step) {
            logger.error(`Invalid step at index ${currentStepIndex} in sequence ${sequenceName}`);
            return;
        }

        logger.debug(`Executing step ${currentStepIndex + 1}/${steps.length} in ${sequenceName}`, step);

        if (step.element) {
            // Show element for duration
            const elementId = step.element;
            const duration = step.duration;

            this.showRotationElement(sequenceName, instanceId, elementId, duration, () => {
                // After element finishes, move to next step
                // Validate that this callback is for the current instance
                const currentSequence = this.rotationSequences.get(sequenceName);
                if (currentSequence && currentSequence.instanceId === instanceId) {
                    this.moveToNextRotationStep(sequenceName);
                } else {
                    logger.debug(`Ignoring stale callback for ${sequenceName} (old instance ${instanceId})`);
                }
            });
        } else if (step.blank) {
            // Blank period - show nothing
            const duration = step.blank;
            logger.debug(`Blank period in ${sequenceName}: ${duration}s`);

            const timeout = setTimeout(() => {
                // Validate that this callback is for the current instance
                const currentSequence = this.rotationSequences.get(sequenceName);
                if (currentSequence && currentSequence.instanceId === instanceId) {
                    this.moveToNextRotationStep(sequenceName);
                } else {
                    logger.debug(`Ignoring stale blank timeout for ${sequenceName} (old instance ${instanceId})`);
                }
            }, duration * 1000);

            sequenceData.timeout = timeout;
        }
    }

    /**
     * Show an element as part of a rotation
     * @param {string} sequenceName - Name of the rotation sequence
     * @param {number} instanceId - Unique ID for this rotation instance
     * @param {string} elementId - Element ID to show
     * @param {number} duration - Display duration in seconds
     * @param {Function} onComplete - Callback when element finishes
     */
    showRotationElement(sequenceName, instanceId, elementId, duration, onComplete) {
        const elementData = this.activeElements.get(elementId);
        if (!elementData) {
            logger.warn(`Element not found for rotation: ${elementId} - skipping to next step`);
            // Use setTimeout to prevent stack overflow from immediate callback
            if (onComplete) {
                setTimeout(() => onComplete(), 100);
            }
            return;
        }

        // Check if image has loaded yet
        if (!elementData.loaded) {
            logger.debug(`Element ${elementId} not loaded yet - skipping to next step`);
            // Skip this element and move to next
            if (onComplete) {
                setTimeout(() => onComplete(), 100);
            }
            return;
        }

        const { element, config } = elementData;

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

        if (config.movement?.type !== 'none' && config.movement?.duration) {
            // Use the longer of the two durations to ensure animation completes
            totalDuration = Math.max(duration, config.movement.duration);
            logger.debug(`Adjusted duration for ${elementId}: ${duration}s → ${totalDuration}s (movement: ${config.movement.duration}s)`);
        }

        const hideTimeout = setTimeout(() => {
            logger.debug(`Hiding rotation element: ${elementId}`);

            // Call completion callback IMMEDIATELY (this starts the blank period)
            // The fade-out will happen concurrently with the blank period

            // Validate that this callback is for the current instance
            const currentSequence = this.rotationSequences.get(sequenceName);
            if (currentSequence && currentSequence.instanceId === instanceId) {
                if (onComplete) onComplete();
            } else {
                logger.debug(`Ignoring stale callback for ${elementId} in ${sequenceName} (old instance ${instanceId})`);
            }

            // AFTER calling onComplete (which starts blank period), start fade out
            // This way the fade happens during the blank period, not before it
            element.style.opacity = '0';

            // Hide element after fade completes (500ms)
            const fadeCompleteTimeout = setTimeout(() => {
                element.style.display = 'none';
            }, 500);

            // Track the fade complete timeout
            elementData.timeouts.push(fadeCompleteTimeout);
        }, totalDuration * 1000);

        elementData.timeouts.push(hideTimeout);
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
        logger.debug(`Clearing all: ${this.activeElements.size} elements, ${this.rotationSequences.size} rotation sequences`);

        // Clear all element timers
        this.activeElements.forEach((data, elementId) => {
            data.intervals.forEach(clearInterval);
            data.timeouts.forEach(clearTimeout);
        });

        // Clear rotation sequence timeouts
        this.rotationSequences.forEach((sequenceData, sequenceName) => {
            if (sequenceData.timeout) {
                clearTimeout(sequenceData.timeout);
            }
        });

        logger.debug(`Cleared ${this.activeElements.size} elements, ${this.rotationSequences.size} sequences`);

        this.activeElements.clear();
        this.rotationSequences.clear();
    }
}
