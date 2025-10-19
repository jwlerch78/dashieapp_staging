// js/core/widget-data-manager.js
// Manages data flow between main app and widget iframes
// Handles widget registration, postMessage communication, and data updates

import { createLogger } from '../utils/logger.js';
import { getCalendarService } from '../data/services/calendar-service.js';

const logger = createLogger('WidgetDataManager');

export class WidgetDataManager {
    constructor() {
        this.widgets = new Map(); // widgetId → iframe element
        this.refreshIntervals = new Map(); // widgetId → interval ID
        this.widgetStates = new Map(); // widgetId → state object

        logger.info('WidgetDataManager constructed');
    }

    /**
     * Initialize the widget data manager
     */
    initialize() {
        logger.info('WidgetDataManager initializing');

        // Set up global message listener for all widgets
        window.addEventListener('message', (event) => {
            this.handleWidgetMessage(event.data);
        });

        logger.verbose('WidgetDataManager initialized');
    }

    /**
     * Register a widget iframe
     * @param {string} widgetId - Widget identifier
     * @param {HTMLIFrameElement} iframe - Widget iframe element
     */
    registerWidget(widgetId, iframe) {
        if (!widgetId || !iframe) {
            logger.error('Invalid widget registration', { widgetId, iframe });
            return;
        }

        this.widgets.set(widgetId, iframe);
        this.widgetStates.set(widgetId, {
            ready: false,
            hasMenu: false,
            menuItems: []
        });

        logger.info('Widget registered', { widgetId });
    }

    /**
     * Unregister a widget
     * @param {string} widgetId - Widget identifier
     */
    unregisterWidget(widgetId) {
        // Stop auto-refresh
        this.stopAutoRefresh(widgetId);

        // Remove from maps
        this.widgets.delete(widgetId);
        this.widgetStates.delete(widgetId);

        logger.info('Widget unregistered', { widgetId });
    }

    /**
     * Handle messages from widgets
     * @param {object} message - Message from widget
     */
    async handleWidgetMessage(message) {
        if (!message || !message.type) return;

        // Handle widget events
        if (message.type === 'event' && message.widgetId) {
            const { widgetId, payload } = message;
            const { eventType, data } = payload || {};

            logger.debug('Widget event received', { widgetId, eventType });

            switch (eventType) {
                case 'widget-ready':
                    await this.handleWidgetReady(widgetId, data);
                    break;

                case 'return-to-menu':
                    this.handleReturnToMenu(widgetId);
                    break;

                case 'settings-requested':
                    this.handleSettingsRequested(widgetId);
                    break;

                default:
                    logger.debug('Unhandled widget event', { widgetId, eventType });
                    break;
            }
        }
    }

    /**
     * Handle widget ready event
     * @param {string} widgetId - Widget identifier
     * @param {object} data - Widget metadata
     */
    async handleWidgetReady(widgetId, data = {}) {
        logger.info('Widget ready', { widgetId, data });

        // Update widget state
        const state = this.widgetStates.get(widgetId);
        if (state) {
            state.ready = true;
            state.hasMenu = data.hasMenu || false;
            state.menuItems = data.menuItems || [];
        }

        // Load initial data for the widget
        await this.loadWidgetData(widgetId);
    }

    /**
     * Load data for a specific widget
     * @param {string} widgetId - Widget identifier
     */
    async loadWidgetData(widgetId) {
        logger.debug('Loading widget data', { widgetId });

        try {
            switch (widgetId) {
                case 'clock':
                    // Clock widget doesn't need data (uses browser time)
                    logger.debug('Clock widget ready (no data needed)');
                    break;

                case 'main': // Calendar widget (id='main' in config)
                    await this.loadCalendarData();
                    break;

                case 'photos':
                    await this.loadPhotosData();
                    break;

                case 'header':
                    await this.loadHeaderData();
                    break;

                default:
                    logger.debug('No data loader for widget', { widgetId });
                    break;
            }

        } catch (error) {
            logger.error('Failed to load widget data', {
                widgetId,
                error: error.message
            });
        }
    }

    /**
     * Load calendar data and send to calendar widget
     */
    async loadCalendarData() {
        try {
            logger.info('Loading calendar data');

            // Get calendar service
            const calendarService = getCalendarService();

            // Get events for next 7 days
            const now = new Date();
            const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            // TODO: Get active calendar IDs from settings
            // For now, just fetch primary calendar
            const events = await calendarService.getEvents(
                'primary-primary', // Will need to use prefixed IDs in Phase 4
                {
                    timeMin: now.toISOString(),
                    timeMax: endDate.toISOString(),
                    maxResults: 10,
                    singleEvents: true,
                    orderBy: 'startTime'
                }
            );

            logger.success('Calendar data loaded', { count: events.length });

            // Send events to widget
            this.sendToWidget('calendar', 'data', {
                dataType: 'events',
                data: events
            });

        } catch (error) {
            logger.error('Failed to load calendar data', {
                error: error.message
            });

            // Send empty array on error
            this.sendToWidget('calendar', 'data', {
                dataType: 'events',
                data: []
            });
        }
    }

    /**
     * Load photos data and send to photos widget
     */
    async loadPhotosData() {
        try {
            logger.info('Loading photos data');

            // Get edge client
            const edgeClient = window.edgeClient;
            if (!edgeClient) {
                logger.warn('EdgeClient not available');
                this.sendToWidget('photos', 'data', {
                    dataType: 'photos',
                    payload: { urls: [], folder: null }
                });
                return;
            }

            // Call edge function to get photo URLs
            const result = await edgeClient.callEdgeFunction('list_photos', {
                folder: null, // Get all photos
                limit: 100
            });

            logger.success('Photos data loaded', { count: result?.urls?.length || 0 });

            // Send photos to widget
            this.sendToWidget('photos', 'data', {
                dataType: 'photos',
                payload: {
                    urls: result?.urls || [],
                    folder: result?.folder || null
                }
            });

        } catch (error) {
            logger.error('Failed to load photos data', {
                error: error.message
            });

            // Send empty array on error
            this.sendToWidget('photos', 'data', {
                dataType: 'photos',
                payload: { urls: [], folder: null }
            });
        }
    }

    /**
     * Load header data (placeholder)
     */
    async loadHeaderData() {
        logger.info('Header data loading not implemented yet');
        // TODO: Implement when header widget is built
    }

    /**
     * Send message to a specific widget
     * @param {string} widgetId - Widget identifier
     * @param {string} messageType - Message type (data, command, config)
     * @param {object} payload - Message payload
     */
    sendToWidget(widgetId, messageType, payload) {
        const iframe = this.widgets.get(widgetId);

        if (!iframe || !iframe.contentWindow) {
            logger.warn('Cannot send to widget (not found or not ready)', { widgetId });
            return;
        }

        const message = {
            type: messageType,
            widgetId,
            payload
        };

        iframe.contentWindow.postMessage(message, '*');

        logger.debug('Message sent to widget', {
            widgetId,
            messageType,
            payloadKeys: Object.keys(payload || {})
        });
    }

    /**
     * Broadcast message to all widgets
     * @param {string} messageType - Message type
     * @param {object} payload - Message payload
     */
    broadcastToWidgets(messageType, payload) {
        logger.debug('Broadcasting to all widgets', {
            messageType,
            widgetCount: this.widgets.size
        });

        this.widgets.forEach((iframe, widgetId) => {
            this.sendToWidget(widgetId, messageType, payload);
        });
    }

    /**
     * Start auto-refresh for a widget
     * @param {string} widgetId - Widget identifier
     * @param {number} intervalMs - Refresh interval in milliseconds
     */
    startAutoRefresh(widgetId, intervalMs = 300000) { // 5 minutes default
        // Stop existing interval if any
        this.stopAutoRefresh(widgetId);

        logger.info('Starting auto-refresh', { widgetId, intervalMs });

        const interval = setInterval(() => {
            logger.debug('Auto-refresh triggered', { widgetId });
            this.loadWidgetData(widgetId);
        }, intervalMs);

        this.refreshIntervals.set(widgetId, interval);
    }

    /**
     * Stop auto-refresh for a widget
     * @param {string} widgetId - Widget identifier
     */
    stopAutoRefresh(widgetId) {
        const interval = this.refreshIntervals.get(widgetId);

        if (interval) {
            clearInterval(interval);
            this.refreshIntervals.delete(widgetId);
            logger.info('Auto-refresh stopped', { widgetId });
        }
    }

    /**
     * Handle return-to-menu event from widget
     * @param {string} widgetId - Widget identifier
     */
    handleReturnToMenu(widgetId) {
        logger.info('Widget requesting return to menu', { widgetId });

        // TODO: Emit event for Dashboard to handle
        // For now, just log
    }

    /**
     * Handle settings-requested event from widget
     * @param {string} widgetId - Widget identifier
     */
    handleSettingsRequested(widgetId) {
        logger.info('Widget requesting settings', { widgetId });

        // TODO: Open Settings module
        // For now, just log
    }

    /**
     * Get widget state
     * @param {string} widgetId - Widget identifier
     * @returns {object} Widget state
     */
    getWidgetState(widgetId) {
        return this.widgetStates.get(widgetId) || null;
    }

    /**
     * Check if widget is ready
     * @param {string} widgetId - Widget identifier
     * @returns {boolean}
     */
    isWidgetReady(widgetId) {
        const state = this.widgetStates.get(widgetId);
        return state ? state.ready : false;
    }

    /**
     * Destroy the widget data manager
     */
    destroy() {
        logger.info('WidgetDataManager destroying');

        // Stop all auto-refresh intervals
        this.refreshIntervals.forEach(interval => clearInterval(interval));
        this.refreshIntervals.clear();

        // Clear widget references
        this.widgets.clear();
        this.widgetStates.clear();

        logger.info('WidgetDataManager destroyed');
    }
}

// Export singleton
let widgetDataManagerInstance = null;

export function initializeWidgetDataManager() {
    if (!widgetDataManagerInstance) {
        widgetDataManagerInstance = new WidgetDataManager();
        widgetDataManagerInstance.initialize();
        logger.verbose('WidgetDataManager singleton initialized');
    }
    return widgetDataManagerInstance;
}

export function getWidgetDataManager() {
    if (!widgetDataManagerInstance) {
        throw new Error('WidgetDataManager not initialized. Call initializeWidgetDataManager() first.');
    }
    return widgetDataManagerInstance;
}
