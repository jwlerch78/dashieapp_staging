// js/modules/Settings/pages/settings-system-page.js
// System settings page

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

        logger.verbose('Initializing System settings page');
        this.initialized = true;
    }

    /**
     * Render the page content
     * @returns {string} - HTML string
     */
    render() {
        const platform = navigator.platform || 'Unknown';
        const userAgent = navigator.userAgent || 'Unknown';
        const appVersion = '1.0.0-beta'; // TODO: Get from package.json or config

        return `
            <div class="settings-modal__page-content">
                <!-- Device Information -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">
                        <h3 class="settings-modal__section-title">Device Information</h3>
                    </div>
                    <div class="settings-modal__section-content">
                        <div class="settings-info-row">
                            <span class="settings-info-label">Platform:</span>
                            <span class="settings-info-value">${platform}</span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Browser:</span>
                            <span class="settings-info-value">${this.getBrowserName()}</span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">App Version:</span>
                            <span class="settings-info-value">${appVersion}</span>
                        </div>
                    </div>
                </div>

                <!-- Notifications -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">
                        <h3 class="settings-modal__section-title">Notifications</h3>
                    </div>
                    <div class="settings-modal__section-content">
                        <div class="settings-info-row">
                            <span class="settings-info-label">Push Notifications</span>
                            <span class="settings-info-value coming-soon">Coming Soon</span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Email Notifications</span>
                            <span class="settings-info-value coming-soon">Coming Soon</span>
                        </div>
                    </div>
                </div>

                <!-- Storage -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">
                        <h3 class="settings-modal__section-title">Storage</h3>
                    </div>
                    <div class="settings-modal__section-content">
                        <p class="settings-modal__section-description">
                            Manage local storage and cached data
                        </p>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Clear Cache</span>
                            <span class="settings-info-value coming-soon">Coming Soon</span>
                        </div>
                    </div>
                </div>

                <!-- Updates -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">
                        <h3 class="settings-modal__section-title">Updates</h3>
                    </div>
                    <div class="settings-modal__section-content">
                        <div class="settings-info-row">
                            <span class="settings-info-label">Auto-Update</span>
                            <span class="settings-info-value">Enabled</span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Check for Updates</span>
                            <span class="settings-info-value coming-soon">Coming Soon</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get browser name from user agent
     */
    getBrowserName() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Edg')) return 'Edge';
        return 'Unknown';
    }

    /**
     * Get focusable elements for this page
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        // No focusable elements yet (all coming soon)
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
