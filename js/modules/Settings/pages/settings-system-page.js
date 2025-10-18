// js/modules/Settings/pages/settings-system-page.js
// System settings page (blank template for now)

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('SettingsSystemPage');

/**
 * System Settings Page
 * Handles system preferences and device settings
 */
export class SettingsSystemPage {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.info('Initializing System settings page');
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
                    <div class="settings-modal__empty-icon">⚙️</div>
                    <div class="settings-modal__empty-text">System Settings</div>
                    <div class="settings-modal__empty-text" style="font-size: var(--font-size-base); margin-top: 10px;">
                        Coming soon: System preferences and device settings
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
        logger.debug('System page activated');
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        logger.debug('System page deactivated');
    }
}
