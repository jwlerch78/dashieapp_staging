// js/modules/Settings/pages/settings-photos-page.js
// Photos settings page - Launches the photos modal for managing photos
// v2.0 - Integrated with SettingsPageBase architecture

import { createLogger } from '../../../utils/logger.js';
import { SettingsPageBase } from '../core/settings-page-base.js';

const logger = createLogger('SettingsPhotosPage');

/**
 * Photos Settings Page
 *
 * This page immediately opens the photos modal (iframe-based) when activated,
 * bypassing any intermediate menu. The photos modal handles all photo management:
 * file upload, deletion, transitions, and storage stats.
 *
 * The modal is necessary because:
 * - File picker requires real user click (browser security)
 * - Complex upload/delete flows with progress tracking
 * - TV/Mobile handling (QR code vs file picker)
 */
export class SettingsPhotosPage extends SettingsPageBase {
    constructor() {
        super('photos');
        this.photosModal = null;
    }

    /**
     * Initialize the page
     */
    async initialize() {
        await super.initialize();

        logger.verbose('Initializing Photos settings page');

        // Get PhotosSettingsManager instance
        // Settings modal runs in main window, so check window (not window.parent)
        if (window.photosSettingsManager) {
            this.photosModal = window.photosSettingsManager;
            logger.debug('Connected to PhotosSettingsManager');
        } else {
            logger.warn('PhotosSettingsManager not found - Photos modal will not be available');
            logger.debug('Available on window:', Object.keys(window).filter(k => k.includes('photo')));
        }
    }

    /**
     * Render the page content
     * Note: This is bypassed - we go directly to the photos modal in activate()
     * Keeping minimal placeholder for fallback only
     * @returns {string} - HTML string
     */
    render() {
        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    <div style="padding: 20px; text-align: center; color: var(--text-muted);">
                        Opening Photos...
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get selection behavior for an item
     * Not used - page immediately opens photos modal
     * @param {HTMLElement} item - The clicked item
     * @returns {Object} Behavior configuration
     */
    getSelectionBehavior(item) {
        return { type: 'none' };
    }

    /**
     * Close the Settings modal
     */
    closeSettingsModal() {
        try {
            // Get Settings instance
            const settingsInstance = window.settingsInstance || window.Settings;

            if (settingsInstance && typeof settingsInstance.hide === 'function') {
                settingsInstance.hide();
                logger.debug('Settings modal closed');
            } else {
                logger.warn('Could not close Settings modal - instance not found');
            }
        } catch (error) {
            logger.error('Error closing Settings modal', error);
        }
    }

    /**
     * Handle activation (page shown)
     * Open photos modal directly instead of showing intermediate menu
     */
    async activate() {
        await super.activate();

        logger.debug('Photos page activated - opening photos modal directly');

        // Immediately open the photos modal
        if (this.photosModal) {
            // Close the Settings modal first
            this.closeSettingsModal();

            // Small delay to let settings modal close cleanly
            await new Promise(resolve => setTimeout(resolve, 100));

            // Open photos modal
            await this.photosModal.open();
        } else {
            logger.error('Photos modal manager not available');
        }
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        super.deactivate();
        logger.debug('Photos page deactivated');
    }
}
