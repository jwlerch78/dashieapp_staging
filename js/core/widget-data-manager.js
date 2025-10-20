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

        // Cache for calendar data to avoid duplicate fetches
        this.calendarDataCache = null;
        this.calendarDataPromise = null; // Track in-flight requests

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

        logger.verbose('Widget registered', {
            widgetId,
            iframeId: iframe.id,
            totalRegistered: this.widgets.size,
            allWidgets: Array.from(this.widgets.keys())
        });
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
        logger.verbose('Widget ready', { widgetId, data });

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
                    await this.loadClockData();
                    break;

                case 'main': // Calendar widget (id='main' in config)
                case 'agenda': // Agenda widget
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
     * Loads events from all active calendars configured by the user
     */
    async loadCalendarData() {
        try {
            // If there's already a fetch in progress, wait for it instead of starting a new one
            if (this.calendarDataPromise) {
                logger.debug('Calendar data fetch already in progress, waiting...');
                return await this.calendarDataPromise;
            }

            // If we have cached data, return it
            if (this.calendarDataCache) {
                logger.debug('Returning cached calendar data');
                return this.calendarDataCache;
            }

            logger.info('Loading calendar data');

            // Create a promise for this fetch so other simultaneous calls can wait for it
            this.calendarDataPromise = this._fetchCalendarData();

            try {
                const data = await this.calendarDataPromise;
                this.calendarDataCache = data;
                return data;
            } finally {
                // Clear the in-flight promise
                this.calendarDataPromise = null;
            }
        } catch (error) {
            this.calendarDataPromise = null;
            logger.error('Failed to load calendar data', error);
            throw error;
        }
    }

    /**
     * Internal method to fetch calendar data (called by loadCalendarData)
     * @private
     */
    async _fetchCalendarData() {
        try {
            // Get calendar service
            const calendarService = getCalendarService();

            // Get active calendar IDs from CalendarService
            const activeCalendarIds = calendarService.getActiveCalendarIds();

            logger.debug('Loading events from active calendars', {
                count: activeCalendarIds.length,
                calendarIds: activeCalendarIds
            });

            // Get events for next 30 days
            const now = new Date();
            const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const timeRange = {
                timeMin: now.toISOString(),
                timeMax: endDate.toISOString(),
                maxResults: 2500,
                singleEvents: true,
                orderBy: 'startTime'
            };

            // Fetch all calendars and events (same as calendar widget does)
            const allCalendars = [];
            const allEvents = [];

            // Group active calendar IDs by account type
            const calendarsByAccount = {};
            for (const prefixedId of activeCalendarIds) {
                const { accountType, calendarId } = calendarService.parsePrefixedId(prefixedId);

                if (!calendarsByAccount[accountType]) {
                    calendarsByAccount[accountType] = [];
                }
                calendarsByAccount[accountType].push({ prefixedId, calendarId });
            }

            // Fetch calendars and events for each account
            for (const [accountType, calendars] of Object.entries(calendarsByAccount)) {
                try {
                    // Fetch calendar list for this account (to get colors/names)
                    const accountCalendars = await calendarService.getCalendars(accountType);
                    allCalendars.push(...accountCalendars);

                    // Fetch events for each active calendar in this account
                    for (const { prefixedId, calendarId } of calendars) {
                        try {
                            const events = await calendarService.getEvents(
                                accountType,
                                calendarId,
                                timeRange
                            );

                            // Find the calendar object to get color info
                            const calendarObj = accountCalendars.find(cal => cal.id === calendarId);

                            // Add calendar metadata to each event (needed for rendering and split colors)
                            const eventsWithMetadata = events.map(event => ({
                                ...event,
                                prefixedCalendarId: prefixedId,
                                calendarId: calendarId,
                                accountType: accountType,
                                backgroundColor: calendarObj?.backgroundColor || '#1976d2',
                                foregroundColor: calendarObj?.foregroundColor || '#ffffff',
                                calendarName: calendarObj?.summary || 'Calendar'
                            }));

                            allEvents.push(...eventsWithMetadata);
                        } catch (error) {
                            logger.error('Failed to fetch events for calendar', {
                                accountType,
                                calendarId,
                                error: error.message
                            });
                        }
                    }
                } catch (error) {
                    logger.error('Failed to fetch calendars for account', {
                        accountType,
                        error: error.message
                    });
                }
            }

            logger.success('Calendar data loaded', {
                calendars: allCalendars.length,
                events: allEvents.length
            });

            // Send calendar data to both calendar and agenda widgets
            const calendarData = {
                dataType: 'calendar',
                calendars: allCalendars,
                events: allEvents
            };

            this.sendToWidget('main', 'data', calendarData);
            this.sendToWidget('agenda', 'data', calendarData);

        } catch (error) {
            logger.error('Failed to load calendar data', {
                error: error.message
            });

            // Send empty data on error to both widgets
            const emptyData = {
                dataType: 'calendar',
                calendars: [],
                events: []
            };

            this.sendToWidget('main', 'data', emptyData);
            this.sendToWidget('agenda', 'data', emptyData);
        }
    }

    /**
     * Load photos data and send to photos widget
     */
    async loadPhotosData() {
        try {
            logger.info('Loading photos data');

            // Get photo data service
            const photoDataService = window.photoDataService;
            if (!photoDataService || !photoDataService.isInitialized) {
                logger.warn('PhotoDataService not available');
                this.sendToWidget('photos', 'data', {
                    dataType: 'photos',
                    payload: { urls: [], folder: null }
                });
                return;
            }

            // Load photos from service
            const result = await photoDataService.loadPhotos(null, true); // folder=null, shuffle=true

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
     * Load clock data (send location for weather)
     */
    async loadClockData() {
        try {
            logger.info('Loading clock data (location for weather)');

            // Get zip code from settings
            const settingsStore = window.settingsStore;
            if (!settingsStore) {
                logger.warn('SettingsStore not available for clock location');
                return;
            }

            const zipCode = settingsStore.get('family.zipCode');

            if (!zipCode) {
                logger.warn('No zip code in settings, clock weather will not display');
                return;
            }

            logger.debug('Sending location to clock widget', { zipCode });

            // Send location-update message to clock widget
            this.sendToWidget('clock', 'location-update', {
                zipCode: zipCode
            });

            logger.success('Clock location data sent', { zipCode });

        } catch (error) {
            logger.error('Failed to load clock data', {
                error: error.message
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
     * Clear calendar data cache (call when calendar settings change)
     */
    clearCalendarCache() {
        logger.debug('Clearing calendar data cache');
        this.calendarDataCache = null;
        this.calendarDataPromise = null;
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
            logger.warn('Cannot send to widget (not found or not ready)', {
                widgetId,
                hasIframe: !!iframe,
                hasContentWindow: !!iframe?.contentWindow,
                registeredWidgets: Array.from(this.widgets.keys())
            });
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
     * Debug: Get all registered widgets
     * @returns {Array} List of registered widget info
     */
    getRegisteredWidgets() {
        const widgets = [];
        this.widgets.forEach((iframe, widgetId) => {
            const state = this.widgetStates.get(widgetId);
            widgets.push({
                widgetId,
                iframeId: iframe.id,
                ready: state?.ready || false,
                hasContentWindow: !!iframe.contentWindow
            });
        });
        return widgets;
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
