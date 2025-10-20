// js/modules/Settings/pages/settings-developer-page.js
// Developer settings page

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('SettingsDeveloperPage');

/**
 * Developer Settings Page
 * Handles developer-only settings and system diagnostics
 */
export class SettingsDeveloperPage {
    constructor() {
        this.initialized = false;
        this.systemStatus = null;
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.verbose('Initializing Developer settings page');

        // Load system status
        await this.loadSystemStatus();

        this.initialized = true;
    }

    /**
     * Load system status information
     */
    async loadSystemStatus() {
        try {
            this.systemStatus = {
                // Authentication
                isAuthenticated: window.sessionManager?.isAuthenticated || false,
                userId: window.sessionManager?.getUser()?.id || 'N/A',
                userEmail: window.sessionManager?.getUser()?.email || 'N/A',

                // Services
                calendarServiceReady: !!window.calendarService,
                photoDataServiceReady: !!window.photoDataService,
                widgetDataManagerReady: !!window.widgetDataManager,
                settingsStoreReady: !!window.settingsStore,

                // Storage
                localStorageSize: this.calculateLocalStorageSize(),

                // Performance
                pageLoadTime: performance.now().toFixed(2) + 'ms',
                memory: performance.memory ?
                    (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB' :
                    'N/A'
            };
        } catch (error) {
            logger.error('Failed to load system status', error);
            this.systemStatus = null;
        }
    }

    /**
     * Calculate localStorage size
     */
    calculateLocalStorageSize() {
        try {
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += localStorage[key].length + key.length;
                }
            }
            return (total / 1024).toFixed(2) + ' KB';
        } catch (error) {
            return 'N/A';
        }
    }

    /**
     * Render the page content
     * @returns {string} - HTML string
     */
    render() {
        const status = this.systemStatus || {};

        return `
            <div class="settings-modal__page-content">
                <!-- System Status -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">
                        <h3 class="settings-modal__section-title">System Status</h3>
                    </div>
                    <div class="settings-modal__section-content">
                        <div class="settings-info-row">
                            <span class="settings-info-label">Authentication:</span>
                            <span class="settings-info-value ${status.isAuthenticated ? 'status-ok' : 'status-error'}">
                                ${status.isAuthenticated ? '✓ Active' : '✗ Inactive'}
                            </span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">User ID:</span>
                            <span class="settings-info-value monospace">${status.userId ? status.userId.substring(0, 8) + '...' : 'N/A'}</span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Calendar Service:</span>
                            <span class="settings-info-value ${status.calendarServiceReady ? 'status-ok' : 'status-error'}">
                                ${status.calendarServiceReady ? '✓ Ready' : '✗ Not Ready'}
                            </span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Photo Service:</span>
                            <span class="settings-info-value ${status.photoDataServiceReady ? 'status-ok' : 'status-error'}">
                                ${status.photoDataServiceReady ? '✓ Ready' : '✗ Not Ready'}
                            </span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Widget Manager:</span>
                            <span class="settings-info-value ${status.widgetDataManagerReady ? 'status-ok' : 'status-error'}">
                                ${status.widgetDataManagerReady ? '✓ Ready' : '✗ Not Ready'}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Performance -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">
                        <h3 class="settings-modal__section-title">Performance</h3>
                    </div>
                    <div class="settings-modal__section-content">
                        <div class="settings-info-row">
                            <span class="settings-info-label">Page Load Time:</span>
                            <span class="settings-info-value monospace">${status.pageLoadTime || 'N/A'}</span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Memory Usage:</span>
                            <span class="settings-info-value monospace">${status.memory || 'N/A'}</span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">LocalStorage Size:</span>
                            <span class="settings-info-value monospace">${status.localStorageSize || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <!-- Beta Features -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">
                        <h3 class="settings-modal__section-title">Beta Features</h3>
                    </div>
                    <div class="settings-modal__section-content">
                        <p class="settings-modal__section-description">
                            You have access to all beta features as a beta tester
                        </p>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Calendar Widget</span>
                            <span class="settings-info-value status-ok">✓ Enabled</span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Photos Widget</span>
                            <span class="settings-info-value status-ok">✓ Enabled</span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Multi-Account</span>
                            <span class="settings-info-value status-ok">✓ Enabled</span>
                        </div>
                    </div>
                </div>

                <!-- Developer Tools -->
                <div class="settings-modal__section">
                    <div class="settings-modal__section-header">
                        <h3 class="settings-modal__section-title">Developer Tools</h3>
                    </div>
                    <div class="settings-modal__section-content">
                        <div class="settings-info-row">
                            <span class="settings-info-label">Console Logging</span>
                            <span class="settings-info-value status-ok">✓ Enabled</span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Debug Mode</span>
                            <span class="settings-info-value coming-soon">Coming Soon</span>
                        </div>
                        <div class="settings-info-row">
                            <span class="settings-info-label">Export Logs</span>
                            <span class="settings-info-value coming-soon">Coming Soon</span>
                        </div>
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
        // No focusable elements yet
        return [];
    }

    /**
     * Handle activation (page shown)
     */
    activate() {
        logger.debug('Developer page activated');
        // Reload system status when page is shown
        this.loadSystemStatus().then(() => {
            // Re-render if needed
            const content = document.querySelector('.settings-modal__page-content');
            if (content) {
                content.outerHTML = this.render();
            }
        });
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        logger.debug('Developer page deactivated');
    }
}
