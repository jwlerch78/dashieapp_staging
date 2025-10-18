// js/modules/Settings/pages/settings-calendar-page.js
// Calendar settings page (blank template for now)

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('SettingsCalendarPage');

/**
 * Calendar Settings Page
 * Handles calendar account management with prefixed IDs
 */
export class SettingsCalendarPage {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.info('Initializing Calendar settings page');
        this.initialized = true;
    }

    /**
     * Render the page content
     * @returns {string} - HTML string
     */
    render() {
        return `
            <div class="settings-modal__page-content">
                <div class="settings-modal__empty">
                    <div class="settings-modal__empty-icon">📅</div>
                    <div class="settings-modal__empty-text">Calendar Settings</div>
                    <div class="settings-modal__empty-text" style="font-size: var(--font-size-base); margin-top: 10px;">
                        Coming soon: Manage calendar accounts and active calendars
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get focusable elements for this page
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        // No focusable elements in blank template
        return [];
    }

    /**
     * Handle activation (page shown)
     */
    activate() {
        logger.debug('Calendar page activated');
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        logger.debug('Calendar page deactivated');
    }
}
