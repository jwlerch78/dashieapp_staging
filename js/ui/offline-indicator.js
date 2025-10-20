// js/ui/offline-indicator.js
// Visual indicator for offline/degraded mode
// Shows banner when backend is unavailable but app is running on cached data

import { createLogger } from '../utils/logger.js';
import { connectionStatus } from '../utils/connection-status.js';

const logger = createLogger('OfflineIndicator');

/**
 * OfflineIndicator - Visual banner for system status
 *
 * Shows when:
 * - Network is offline
 * - Backend/Supabase is unavailable
 * - Running in degraded mode with cached data
 */
export class OfflineIndicator {
    constructor() {
        this.element = null;
        this.isVisible = false;
        this.unsubscribe = null;

        logger.verbose('OfflineIndicator constructed');
    }

    /**
     * Initialize and inject indicator into DOM
     */
    initialize() {
        // Create indicator element
        this.element = document.createElement('div');
        this.element.id = 'offline-indicator';
        this.element.className = 'offline-indicator hidden';
        this.element.innerHTML = `
            <div class="offline-indicator-content">
                <div class="offline-indicator-icon">⚠️</div>
                <div class="offline-indicator-text">
                    <strong id="offline-indicator-title">Offline Mode</strong>
                    <span id="offline-indicator-message">Running on cached data</span>
                </div>
                <button class="offline-indicator-retry" id="offline-indicator-retry">
                    Retry Connection
                </button>
            </div>
        `;

        // Inject into dashboard
        const dashboard = document.getElementById('dashboard-container');
        if (dashboard) {
            dashboard.insertBefore(this.element, dashboard.firstChild);
        } else {
            document.body.insertBefore(this.element, document.body.firstChild);
        }

        // Setup retry button
        const retryButton = this.element.querySelector('#offline-indicator-retry');
        if (retryButton) {
            retryButton.addEventListener('click', () => this.handleRetry());
        }

        // Subscribe to connection status changes
        this.unsubscribe = connectionStatus.addListener((status) => {
            this.handleStatusChange(status);
        });

        logger.verbose('OfflineIndicator initialized');
    }

    /**
     * Handle connection status changes
     * @param {object} status - Connection status
     * @private
     */
    handleStatusChange(status) {
        if (status.isDegraded || !status.isBackendAvailable || !status.isOnline) {
            // Show offline indicator
            this.show(status);
        } else {
            // Hide offline indicator
            this.hide();
        }
    }

    /**
     * Show offline indicator with status details
     * @param {object} status - Connection status
     */
    show(status) {
        if (!this.element) return;

        // Update message based on status
        const titleEl = this.element.querySelector('#offline-indicator-title');
        const messageEl = this.element.querySelector('#offline-indicator-message');

        if (!status.isOnline) {
            titleEl.textContent = 'No Internet Connection';
            messageEl.textContent = 'Check your network and try again';
        } else if (!status.isBackendAvailable) {
            titleEl.textContent = 'System Unavailable';
            messageEl.textContent = status.degradedReason || 'Backend services are temporarily unavailable';
        } else if (status.isDegraded) {
            titleEl.textContent = 'Limited Connectivity';
            messageEl.textContent = status.degradedReason || 'Running on cached data';
        }

        // Show indicator with animation
        this.element.classList.remove('hidden');
        this.element.classList.add('visible');
        this.isVisible = true;

        logger.info('Offline indicator shown', {
            title: titleEl.textContent,
            message: messageEl.textContent
        });
    }

    /**
     * Hide offline indicator
     */
    hide() {
        if (!this.element || !this.isVisible) return;

        this.element.classList.remove('visible');
        this.element.classList.add('hidden');
        this.isVisible = false;

        logger.info('Offline indicator hidden');
    }

    /**
     * Handle retry button click
     * @private
     */
    async handleRetry() {
        logger.info('User requested connection retry');

        const retryButton = this.element.querySelector('#offline-indicator-retry');
        if (retryButton) {
            retryButton.disabled = true;
            retryButton.textContent = 'Retrying...';
        }

        // Attempt to check backend health
        const isHealthy = await connectionStatus.checkBackendHealth();

        // Re-enable button
        setTimeout(() => {
            if (retryButton) {
                retryButton.disabled = false;
                retryButton.textContent = 'Retry Connection';
            }
        }, 1000);

        if (!isHealthy) {
            logger.warn('Retry failed - backend still unavailable');
        }
    }

    /**
     * Cleanup and destroy indicator
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        this.element = null;
        this.isVisible = false;

        logger.verbose('OfflineIndicator destroyed');
    }
}

// Export singleton instance
export const offlineIndicator = new OfflineIndicator();
