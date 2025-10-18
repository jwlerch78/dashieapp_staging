// js/modules/Settings/pages/settings-photos-page.js
// Photos settings page - Launches the photos modal for managing photos
// v2.0 - Integrated with SettingsPageBase architecture

import { createLogger } from '../../../utils/logger.js';
import { SettingsPageBase } from '../core/settings-page-base.js';

const logger = createLogger('SettingsPhotosPage');

/**
 * Photos Settings Page
 *
 * Hybrid approach: This page provides menu items that launch the existing
 * photos modal (iframe-based) which handles file upload, deletion, and transitions.
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
        this.photoStats = null;
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

        // Load current photo stats for display
        await this.loadPhotoStats();
    }

    /**
     * Load photo statistics (count, storage)
     */
    async loadPhotoStats() {
        try {
            // Get photo data service
            const photoService = window.dataManager?.photoService;

            if (!photoService) {
                logger.debug('Photo service not available yet');
                return;
            }

            // Get photo count (simplified)
            this.photoStats = {
                count: 0,
                storage: 'Unknown'
            };

            logger.debug('Photo stats loaded', this.photoStats);
        } catch (error) {
            logger.debug('Could not load photo stats', error);
        }
    }

    /**
     * Render the page content
     * @returns {string} - HTML string
     */
    render() {
        const transitionTime = this.getTransitionTime();

        return `
            <div class="settings-modal__list">
                <!-- Photo Library Section -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">Photo Library</div>

                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-photos-action="add-photos"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Add Photos</span>
                        <span class="settings-modal__cell-description">Upload photos from your device</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>

                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-photos-action="delete-photos"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Delete Photos</span>
                        <span class="settings-modal__cell-description">Remove photos from your library</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>
                </div>

                <!-- Display Options Section -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">Display Options</div>

                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-photos-action="transition"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Photo Transition Time</span>
                        <span class="settings-modal__cell-value" id="photo-transition-value">${transitionTime} seconds</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>
                </div>

                <!-- Info Section -->
                <div class="settings-modal__section">
                    <div style="padding: 12px 16px; color: var(--text-muted); font-size: 13px; line-height: 1.4;">
                        Photos are stored in your personal library and displayed in a rotating slideshow on your dashboard.
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get selection behavior for an item
     * All items open the photos modal
     * @param {HTMLElement} item - The clicked item
     * @returns {Object} Behavior configuration
     */
    getSelectionBehavior(item) {
        // All items with data-photos-action open the photos modal
        if (item.dataset.photosAction) {
            return { type: 'none' }; // Custom handling in handleItemClick
        }

        return { type: 'none' };
    }

    /**
     * Handle item click - Open photos modal
     *
     * NOTE: This is called automatically by Settings modal renderer (settings-modal-renderer.js)
     * when user clicks or presses Enter on any menu item. We don't need to attach event listeners.
     *
     * We use data-photos-action instead of data-action because data-action is reserved
     * for Settings modal actions (close, back).
     *
     * @param {HTMLElement} item - The clicked item
     * @returns {Promise<Object>} Action result
     */
    async handleItemClick(item) {
        const action = item.dataset.photosAction;

        if (action && this.photosModal) {
            logger.info('Opening photos modal', { action });

            // Close the Settings modal first
            this.closeSettingsModal();

            // Small delay to let settings modal close cleanly
            await new Promise(resolve => setTimeout(resolve, 100));

            // Open photos modal with optional navigation
            await this.photosModal.open();

            // If specific action requested, navigate to that screen
            if (action !== 'main') {
                this.navigateModalTo(action);
            }

            return { shouldNavigate: false };
        }

        if (!this.photosModal) {
            logger.error('Photos modal manager not available');
            // TODO: Show error message to user
        }

        return { shouldNavigate: false };
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
     * Navigate photos modal to specific screen
     * @param {string} action - Screen to navigate to
     */
    navigateModalTo(action) {
        if (!this.photosModal || !this.photosModal.modalIframe) {
            return;
        }

        // Map actions to screen IDs in the photos modal
        const screenMap = {
            'add-photos': 'trigger-file-picker',
            'delete-photos': 'delete-photos-screen',
            'transition': 'transition-screen'
        };

        const targetScreen = screenMap[action];

        if (targetScreen) {
            // Special case: add-photos triggers file picker directly
            if (action === 'add-photos') {
                this.photosModal.modalIframe.contentWindow.postMessage({
                    type: 'trigger-file-picker'
                }, '*');
            } else {
                // For other actions, navigate to screen
                this.photosModal.modalIframe.contentWindow.postMessage({
                    type: 'navigate-to',
                    screen: targetScreen
                }, '*');
            }

            logger.debug('Sent navigation to photos modal', { action, targetScreen });
        }
    }

    /**
     * Get current transition time setting
     * @returns {number} Transition time in seconds
     */
    getTransitionTime() {
        if (window.settingsStore) {
            return window.settingsStore.get('photos.transitionTime') || 5;
        }
        return 5;
    }

    /**
     * Handle activation (page shown)
     */
    async activate() {
        await super.activate();

        logger.debug('Photos page activated');

        // Reload photo stats when page is shown
        await this.loadPhotoStats();

        // Update transition time display in case it changed
        this.updateTransitionDisplay();
    }

    /**
     * Update transition time display
     */
    updateTransitionDisplay() {
        const transitionValue = this.getTransitionTime();
        const displayElement = document.getElementById('photo-transition-value');

        if (displayElement) {
            displayElement.textContent = `${transitionValue} seconds`;
            logger.debug('Updated transition display', { transitionValue });
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
