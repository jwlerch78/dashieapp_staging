// js/modules/Settings/utils/time-selection-handler.js
// Handles 3-step time selection flow: Hour → Minute → AM/PM
// Adapted from legacy settings implementation

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('TimeSelectionHandler');

/**
 * Time Selection Handler
 * Manages multi-step time selection for Sleep/Wake timers
 *
 * Flow:
 * 1. User selects hour (1-12) → navigate to minute screen
 * 2. User selects minute (00/15/30/45) → navigate to AM/PM screen
 * 3. User selects AM/PM → save time, navigate back to Display
 */
export class TimeSelectionHandler {
    constructor() {
        this.pendingTimeSelection = null;
        logger.info('TimeSelectionHandler constructed');
    }

    /**
     * Handle a time selection cell click/activation
     * Returns an action object telling the caller what to do next
     *
     * @param {HTMLElement} cell - The clicked cell element
     * @returns {Object} Action object {type, screenId?, setting?, value?, message?}
     */
    handleSelection(cell) {
        const hour = cell.dataset.hour;
        const minute = cell.dataset.minute;
        const period = cell.dataset.period;
        const navigateTo = cell.dataset.navigate;
        const setting = cell.dataset.setting;

        logger.debug('handleSelection', { hour, minute, period, navigateTo, setting });

        // Not a time selection cell
        if (!hour && !minute && !period) {
            return { type: 'not-time-selection' };
        }

        // Initialize pending selection if needed
        if (!this.pendingTimeSelection) {
            this.pendingTimeSelection = {
                setting: setting // Store which setting this is for
            };
        }

        // Step 1: Hour selection
        if (hour) {
            this.pendingTimeSelection.hour = parseInt(hour);
            logger.info('Hour selected', { hour, setting });
            return {
                type: 'navigate',
                screenId: navigateTo,
                message: `Hour ${hour} selected`
            };
        }

        // Step 2: Minute selection
        if (minute) {
            this.pendingTimeSelection.minute = parseInt(minute);
            logger.info('Minute selected', { minute, setting });
            return {
                type: 'navigate',
                screenId: navigateTo,
                message: `Minute ${minute} selected`
            };
        }

        // Step 3: AM/PM selection (final step)
        if (period && this.pendingTimeSelection.hour !== undefined && this.pendingTimeSelection.minute !== undefined) {
            this.pendingTimeSelection.period = period;

            const finalTime = this.buildTimeValue(
                this.pendingTimeSelection.hour,
                this.pendingTimeSelection.minute,
                this.pendingTimeSelection.period
            );

            logger.success('Time selection complete', {
                setting: this.pendingTimeSelection.setting,
                time: finalTime
            });

            // Store the setting path for the caller
            const settingPath = this.pendingTimeSelection.setting;

            // Clear pending selection
            this.pendingTimeSelection = null;

            return {
                type: 'complete',
                setting: settingPath,
                value: finalTime,
                navigateTo: 'display', // Always return to Display screen
                message: `Time selected: ${finalTime}`
            };
        }

        // Incomplete selection - shouldn't happen
        logger.warn('Incomplete time selection state', this.pendingTimeSelection);
        return {
            type: 'error',
            message: 'Incomplete time selection'
        };
    }

    /**
     * Build a 24-hour time string from 12-hour components
     * @param {number} hour - Hour in 12-hour format (1-12)
     * @param {number} minute - Minute (0-59)
     * @param {string} period - 'AM' or 'PM'
     * @returns {string} - Time in 24-hour format "HH:MM"
     */
    buildTimeValue(hour, minute, period) {
        let hour24 = hour;

        if (period === 'PM' && hour !== 12) {
            hour24 = hour + 12;
        } else if (period === 'AM' && hour === 12) {
            hour24 = 0;
        }

        return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }

    /**
     * Format a 24-hour time for display (e.g., "22:00" → "10:00 PM")
     * @param {string} time24 - Time in 24-hour format "HH:MM"
     * @returns {string} - Formatted time "H:MM AM/PM"
     */
    formatTime(time24) {
        if (!time24) return '';

        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;

        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    /**
     * Parse a 24-hour time into 12-hour components
     * @param {string} time24 - Time in 24-hour format "HH:MM"
     * @returns {Object} - {hour12, minute, period}
     */
    parseTime24(time24) {
        if (!time24) {
            return { hour12: 12, minute: 0, period: 'PM' };
        }

        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;

        return {
            hour12,
            minute: minutes,
            period
        };
    }

    /**
     * Check if a cell is part of time selection
     * @param {HTMLElement} cell - Cell element to check
     * @returns {boolean}
     */
    isTimeSelectionCell(cell) {
        return !!(cell.dataset.hour || cell.dataset.minute || cell.dataset.period);
    }

    /**
     * Reset the pending selection state
     * Used when canceling or navigating away
     */
    reset() {
        logger.debug('Resetting pending time selection');
        this.pendingTimeSelection = null;
    }

    /**
     * Get the current step of time selection
     * @returns {string} - 'hour', 'minute', 'period', or 'none'
     */
    getCurrentStep() {
        if (!this.pendingTimeSelection) return 'none';
        if (this.pendingTimeSelection.hour === undefined) return 'hour';
        if (this.pendingTimeSelection.minute === undefined) return 'minute';
        return 'period';
    }
}
