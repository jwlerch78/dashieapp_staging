// js/modules/Settings/pages/settings-photos-page.js
// Photos settings page (blank template for now)

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('SettingsPhotosPage');

/**
 * Photos Settings Page
 * Handles photo slideshow and album settings
 */
export class SettingsPhotosPage {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.info('Initializing Photos settings page');
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
                    <div class="settings-modal__empty-icon">📸</div>
                    <div class="settings-modal__empty-text">Photos Settings</div>
                    <div class="settings-modal__empty-text" style="font-size: var(--font-size-base); margin-top: 10px;">
                        Coming soon: Album selection and slideshow settings
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
        logger.debug('Photos page activated');
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        logger.debug('Photos page deactivated');
    }
}
