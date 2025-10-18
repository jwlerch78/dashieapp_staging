// js/modules/Settings/utils/ui-update-helper.js
// Helper utilities for instant UI feedback before async operations
// Provides smooth, responsive user experience by updating UI first

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('UIUpdateHelper');

/**
 * UI Update Helper
 * Ensures instant visual feedback before executing async operations
 *
 * Usage:
 *   await UIUpdateHelper.updateThenSave(
 *     () => updateUI(),
 *     async () => saveToDatabase()
 *   );
 */
export class UIUpdateHelper {
    /**
     * Update UI instantly, then execute async operation
     * If async operation fails, rollback function is called
     *
     * @param {Function} updateFn - Synchronous UI update function
     * @param {Function} asyncFn - Async operation to perform
     * @param {Function} rollbackFn - Optional rollback if async operation fails
     * @returns {Promise<any>} Result of async operation
     */
    static async updateThenSave(updateFn, asyncFn, rollbackFn = null) {
        try {
            // 1. Update UI instantly for responsive feel
            if (typeof updateFn === 'function') {
                updateFn();
            }

            // 2. Execute async operation (save to settings, API call, etc.)
            const result = await asyncFn();

            logger.debug('UI update and async operation completed successfully');
            return result;

        } catch (error) {
            logger.error('Async operation failed, rolling back UI', error);

            // 3. Rollback UI if operation failed
            if (typeof rollbackFn === 'function') {
                rollbackFn();
            }

            throw error;
        }
    }

    /**
     * Toggle a checkmark element
     * @param {HTMLElement} item - Container element
     * @param {boolean} isChecked - New checked state
     */
    static toggleCheckmark(item, isChecked) {
        const checkmark = item.querySelector('.settings-modal__cell-checkmark');
        if (checkmark) {
            checkmark.textContent = isChecked ? '✓' : '';
        }
    }

    /**
     * Toggle 'enabled' class on element
     * @param {HTMLElement} item - Element to toggle
     * @param {boolean} isEnabled - New enabled state
     */
    static toggleEnabledClass(item, isEnabled) {
        if (isEnabled) {
            item.classList.add('enabled');
        } else {
            item.classList.remove('enabled');
        }
    }

    /**
     * Update opacity for enabled/disabled state
     * @param {HTMLElement} item - Container element
     * @param {boolean} isEnabled - Enabled state
     * @param {string} dotSelector - Selector for color dot element
     */
    static updateOpacity(item, isEnabled, dotSelector = '.calendar-color-dot') {
        if (isEnabled) {
            item.style.opacity = '1';
            const dot = item.querySelector(dotSelector);
            if (dot) dot.style.opacity = '1';
        } else {
            item.style.opacity = '0.4';
            const dot = item.querySelector(dotSelector);
            if (dot) dot.style.opacity = '0.3';
        }
    }

    /**
     * Update a counter display element
     * @param {HTMLElement} counterElement - Element to update
     * @param {string} text - New text content
     */
    static updateCounter(counterElement, text) {
        if (counterElement) {
            counterElement.textContent = text;
        }
    }

    /**
     * Update a value display element
     * @param {string} elementId - Element ID
     * @param {string} value - New value to display
     */
    static updateValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Complete calendar item toggle (all visual updates)
     * @param {HTMLElement} item - Calendar item element
     * @param {boolean} isEnabled - New enabled state
     */
    static toggleCalendarItem(item, isEnabled) {
        this.toggleEnabledClass(item, isEnabled);
        this.toggleCheckmark(item, isEnabled);
        this.updateOpacity(item, isEnabled);
    }
}

/**
 * Quick helper functions for common patterns
 */

/**
 * Toggle a setting with instant UI feedback
 * @param {HTMLElement} element - Element to update
 * @param {Function} saveFn - Async save function
 * @param {Function} uiFn - UI update function (receives new value)
 * @returns {Promise<void>}
 */
export async function toggleWithFeedback(element, saveFn, uiFn) {
    const currentState = element.classList.contains('enabled');
    const newState = !currentState;

    await UIUpdateHelper.updateThenSave(
        () => uiFn(newState),
        () => saveFn(newState),
        () => uiFn(currentState) // Rollback on error
    );
}

/**
 * Update and save a value with instant UI feedback
 * @param {string} valueElementId - ID of element showing value
 * @param {string} newValue - New value to display and save
 * @param {Function} saveFn - Async save function
 * @returns {Promise<void>}
 */
export async function updateValueWithFeedback(valueElementId, newValue, saveFn) {
    const valueElement = document.getElementById(valueElementId);
    if (!valueElement) return;

    const oldValue = valueElement.textContent;

    await UIUpdateHelper.updateThenSave(
        () => UIUpdateHelper.updateValue(valueElementId, newValue),
        () => saveFn(newValue),
        () => UIUpdateHelper.updateValue(valueElementId, oldValue) // Rollback
    );
}

export default UIUpdateHelper;
