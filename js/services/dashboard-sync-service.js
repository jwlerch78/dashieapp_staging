// js/services/dashboard-sync-service.js
// Cross-dashboard synchronization using BroadcastChannel API
// Allows multiple dashboard tabs/windows to sync settings, photos, and calendar changes

import { createLogger } from '../utils/logger.js';

const logger = createLogger('DashboardSync');

/**
 * DashboardSyncService
 * Broadcasts changes to other dashboard instances (tabs/windows)
 *
 * Supported message types:
 * - theme-changed: Theme was updated
 * - photos-updated: Photos were added/deleted
 * - calendar-updated: Calendar settings changed
 * - settings-changed: General settings changed
 */
export class DashboardSyncService {
    constructor() {
        this.channel = null;
        this.listeners = new Map();
        this.channelName = 'dashie-dashboard-sync';
    }

    /**
     * Initialize the broadcast channel
     */
    initialize() {
        if (!window.BroadcastChannel) {
            logger.warn('BroadcastChannel not supported in this browser - cross-dashboard sync disabled');
            return;
        }

        try {
            this.channel = new BroadcastChannel(this.channelName);

            // Listen for messages from other dashboards
            this.channel.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            logger.success('Dashboard sync initialized');
        } catch (error) {
            logger.error('Failed to initialize dashboard sync', error);
        }
    }

    /**
     * Handle incoming messages from other dashboards
     * @private
     */
    handleMessage(message) {
        if (!message || !message.type) {
            logger.warn('Invalid sync message received', message);
            return;
        }

        logger.debug('Received sync message', {
            type: message.type,
            timestamp: message.timestamp
        });

        // Call registered listeners for this message type
        const listeners = this.listeners.get(message.type);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(message.payload);
                } catch (error) {
                    logger.error('Error in sync listener', {
                        type: message.type,
                        error: error.message
                    });
                }
            });
        }
    }

    /**
     * Broadcast a message to all other dashboard instances
     * @param {string} type - Message type
     * @param {*} payload - Message payload
     */
    broadcast(type, payload) {
        if (!this.channel) {
            logger.debug('Broadcast channel not available, skipping broadcast', { type });
            return;
        }

        try {
            const message = {
                type,
                payload,
                timestamp: Date.now()
            };

            this.channel.postMessage(message);

            logger.debug('Broadcast sent', {
                type,
                hasPayload: !!payload
            });
        } catch (error) {
            logger.error('Failed to broadcast message', {
                type,
                error: error.message
            });
        }
    }

    /**
     * Register a listener for a specific message type
     * @param {string} type - Message type to listen for
     * @param {Function} callback - Callback function
     */
    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }

        this.listeners.get(type).push(callback);

        logger.debug('Listener registered', { type });
    }

    /**
     * Remove a listener
     * @param {string} type - Message type
     * @param {Function} callback - Callback to remove
     */
    off(type, callback) {
        const listeners = this.listeners.get(type);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
                logger.debug('Listener removed', { type });
            }
        }
    }

    /**
     * Broadcast theme change to other dashboards
     * @param {string} theme - New theme name
     */
    broadcastThemeChange(theme) {
        this.broadcast('theme-changed', { theme });
    }

    /**
     * Broadcast photos update to other dashboards
     * @param {Object} details - Details about the photo update
     */
    broadcastPhotosUpdate(details = {}) {
        this.broadcast('photos-updated', details);
    }

    /**
     * Broadcast calendar update to other dashboards
     * @param {Object} details - Details about the calendar update
     */
    broadcastCalendarUpdate(details = {}) {
        this.broadcast('calendar-updated', details);
    }

    /**
     * Broadcast settings change to other dashboards
     * @param {string} path - Settings path that changed
     * @param {*} value - New value
     */
    broadcastSettingsChange(path, value) {
        this.broadcast('settings-changed', { path, value });
    }

    /**
     * Close the broadcast channel
     */
    close() {
        if (this.channel) {
            this.channel.close();
            this.channel = null;
            logger.info('Dashboard sync closed');
        }
    }
}

// Export singleton instance
export const dashboardSync = new DashboardSyncService();
