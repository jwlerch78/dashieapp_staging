// js/data/services/calendar-service.js
// Calendar service for fetching calendar data with automatic token refresh
// REFACTORED: Now acts as orchestrator, delegating to specialized modules

import { createLogger } from '../../utils/logger.js';
import { GoogleAPIClient } from './google/google-api-client.js';
import { CalendarFetcher } from './calendar-services/calendar-fetcher.js';
import { EventProcessor } from './calendar-services/event-processor.js';
import { CalendarRefreshManager } from './calendar-services/calendar-refresh-manager.js';

const logger = createLogger('CalendarService');

/**
 * CalendarService - High-level calendar operations orchestrator
 *
 * Architecture:
 * - Delegates fetching to CalendarFetcher
 * - Delegates transformation to EventProcessor
 * - Delegates refresh to CalendarRefreshManager
 * - Provides simple public API for application use
 *
 * Features:
 * - Automatic token refresh via EdgeClient
 * - Multi-account support (primary, account2, etc.)
 * - Account-prefixed calendar IDs for unique identification
 * - Caching (managed by caller)
 * - Error handling and retry logic
 */
export class CalendarService {
    constructor(edgeClient) {
        if (!edgeClient) {
            throw new Error('EdgeClient is required for CalendarService');
        }

        this.edgeClient = edgeClient;
        this.googleClient = new GoogleAPIClient(edgeClient);

        // Initialize specialized modules
        this.fetcher = new CalendarFetcher(this);
        this.processor = new EventProcessor();
        this.refreshManager = new CalendarRefreshManager(this);

        // Active calendar management
        this.activeCalendarIds = []; // Account-prefixed IDs (e.g., 'primary-user@gmail.com')
        this.STORAGE_KEY = 'dashie-active-calendars'; // localStorage key

        logger.verbose('CalendarService initialized with specialized modules');
    }

    // =========================================================================
    // MAIN ENTRY POINT - Data Loading
    // =========================================================================

    /**
     * Load all calendar data (main entry point for application)
     * Fetches calendars and events, processes them, returns ready-to-display data
     *
     * @param {object} options - Options {forceRefresh, timeRange}
     * @returns {Promise<{calendars: Array, events: Array}>}
     */
    async loadData(options = {}) {
        const { forceRefresh = false, timeRange = {} } = options;

        try {
            logger.debug('Loading calendar data', { forceRefresh, activeCalendars: this.activeCalendarIds.length });

            // Set default time range (next 30 days)
            const finalTimeRange = {
                timeMin: timeRange.timeMin || new Date().toISOString(),
                timeMax: timeRange.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                ...timeRange
            };

            // Step 1: Fetch raw data (delegated to CalendarFetcher)
            const rawData = await this.fetcher.fetchAllCalendarData(
                this.activeCalendarIds,
                finalTimeRange
            );

            // Step 2: Transform events (delegated to EventProcessor)
            const processedEvents = this.processor.transformEvents(rawData.events);

            // Step 3: Return ready-to-display data
            const result = {
                calendars: rawData.calendars,
                events: processedEvents
            };

            logger.success('Calendar data loaded and processed', {
                calendars: result.calendars.length,
                events: result.events.length
            });

            return result;

        } catch (error) {
            logger.error('Failed to load calendar data', error);
            return {
                calendars: [],
                events: []
            };
        }
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initialize service and load active calendars from user_calendar_config table
     * @returns {Promise<void>}
     */
    async initialize() {
        logger.debug('Initializing CalendarService with calendar config');

        try {
            // Try to load from database first
            this.activeCalendarIds = await this.edgeClient.loadCalendarConfig();

            // Save to localStorage for fast future loads
            if (this.activeCalendarIds.length > 0) {
                this.saveToLocalStorage();
            }

            logger.success('CalendarService initialized from user_calendar_config', {
                activeCalendars: this.activeCalendarIds.length
            });

            // Auto-enable primary calendar on first login
            if (this.activeCalendarIds.length === 0) {
                logger.debug('No active calendars found, auto-enabling primary calendar');
                await this.autoEnablePrimaryCalendar();
            }

            // Check all accounts and auto-enable primary calendar for new accounts
            await this.autoEnableNewAccountCalendars();

        } catch (error) {
            logger.warn('Failed to load active calendars from database', error);

            // Fallback to localStorage
            const fromLocalStorage = this.loadFromLocalStorage();
            if (fromLocalStorage.length > 0) {
                logger.debug('Loaded active calendars from localStorage fallback', {
                    count: fromLocalStorage.length
                });
                this.activeCalendarIds = fromLocalStorage;
            } else {
                this.activeCalendarIds = [];

                // Try to auto-enable primary calendar
                try {
                    await this.autoEnablePrimaryCalendar();
                } catch (autoEnableError) {
                    logger.warn('Failed to auto-enable primary calendar', autoEnableError);
                }
            }

            // Check all accounts and auto-enable primary calendar for new accounts
            try {
                await this.autoEnableNewAccountCalendars();
            } catch (autoEnableError) {
                logger.warn('Failed to auto-enable calendars for new accounts', autoEnableError);
            }
        }
    }

    // =========================================================================
    // CALENDAR FETCHING (Delegates to modules)
    // =========================================================================

    /**
     * Get all calendars for an account with prefixed IDs
     * @param {string} accountType - Account type ('primary', 'account2', etc.)
     * @returns {Promise<Array>} Array of calendar objects with prefixed IDs
     */
    async getCalendars(accountType = 'primary') {
        logger.debug('Fetching calendars', { accountType });

        try {
            const rawCalendars = await this.googleClient.getCalendarList(accountType);

            // Add prefixed IDs and metadata to each calendar
            const calendarsWithPrefix = rawCalendars.map(cal => ({
                ...cal,
                prefixedId: this.createPrefixedId(accountType, cal.id),
                rawId: cal.id,
                accountType: accountType,
                isActive: this.isCalendarActive(accountType, cal.id)
            }));

            logger.verbose('Calendars fetched successfully', {
                accountType,
                count: calendarsWithPrefix.length
            });

            return calendarsWithPrefix;

        } catch (error) {
            logger.error('Failed to fetch calendars', {
                accountType,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get events for a specific calendar
     * @param {string} accountType - Account type
     * @param {string} calendarId - Calendar ID
     * @param {object} timeRange - Optional time range
     * @returns {Promise<Array>} Array of event objects
     */
    async getEvents(accountType = 'primary', calendarId = 'primary', timeRange = {}) {
        logger.debug('Fetching events', { accountType, calendarId });

        try {
            const events = await this.googleClient.getCalendarEvents(
                calendarId,
                timeRange,
                accountType
            );

            // Normalize all-day events (delegated to EventProcessor)
            const normalizedEvents = events.map(event => this.processor.cleanEventData([event])[0]);

            logger.verbose('Events fetched successfully', {
                accountType,
                calendarId,
                count: normalizedEvents.length
            });

            return normalizedEvents;

        } catch (error) {
            logger.error('Failed to fetch events', {
                accountType,
                calendarId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get all events from all active calendars
     * @param {object} timeRange - Time range options
     * @returns {Promise<Array>} All events from active calendars
     */
    async getAllActiveEvents(timeRange = {}) {
        logger.debug('Fetching events from all active calendars', {
            activeCount: this.activeCalendarIds.length
        });

        const eventPromises = this.activeCalendarIds.map(prefixedId => {
            const { accountType, calendarId } = this.parsePrefixedId(prefixedId);
            return this.getEvents(accountType, calendarId, timeRange)
                .catch(err => {
                    logger.error('Failed to fetch events', { prefixedId, error: err });
                    return [];
                });
        });

        const eventArrays = await Promise.all(eventPromises);
        const allEvents = eventArrays.flat();

        // Sort by start time
        allEvents.sort((a, b) => {
            const aTime = new Date(a.start?.dateTime || a.start?.date);
            const bTime = new Date(b.start?.dateTime || b.start?.date);
            return aTime - bTime;
        });

        logger.success('Fetched all active events', { totalEvents: allEvents.length });
        return allEvents;
    }

    // =========================================================================
    // ACTIVE CALENDAR MANAGEMENT
    // =========================================================================

    /**
     * Check if calendar is active
     */
    isCalendarActive(accountType, calendarId) {
        const prefixedId = this.createPrefixedId(accountType, calendarId);
        return this.activeCalendarIds.includes(prefixedId);
    }

    /**
     * Enable a calendar
     */
    async enableCalendar(accountType, calendarId) {
        const prefixedId = this.createPrefixedId(accountType, calendarId);

        if (!this.activeCalendarIds.includes(prefixedId)) {
            this.activeCalendarIds.push(prefixedId);
            await this.saveActiveCalendars();
            logger.info('Calendar enabled', { prefixedId });
        }
    }

    /**
     * Disable a calendar
     */
    async disableCalendar(accountType, calendarId) {
        const prefixedId = this.createPrefixedId(accountType, calendarId);
        const originalLength = this.activeCalendarIds.length;

        this.activeCalendarIds = this.activeCalendarIds.filter(id => id !== prefixedId);

        if (this.activeCalendarIds.length !== originalLength) {
            await this.saveActiveCalendars();
            logger.info('Calendar disabled', { prefixedId });
        }
    }

    /**
     * Get active calendar IDs
     */
    getActiveCalendarIds() {
        return [...this.activeCalendarIds];
    }

    /**
     * Save active calendars to database and localStorage
     */
    async saveActiveCalendars() {
        try {
            // Save to localStorage first (instant)
            this.saveToLocalStorage();

            // Save to database (async)
            await this.edgeClient.saveCalendarConfig(this.activeCalendarIds);

            // Refresh calendar data in widgets (clears cache + sends fresh data)
            if (window.widgetDataManager) {
                logger.debug('Triggering calendar data refresh after config change');
                await window.widgetDataManager.refreshCalendarData();
            }

            logger.debug('Active calendars saved and widgets updated', {
                count: this.activeCalendarIds.length
            });

        } catch (error) {
            logger.error('Failed to save active calendars to database', error);
            throw error;
        }
    }

    /**
     * Save to localStorage
     * @private
     */
    saveToLocalStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.activeCalendarIds));
        } catch (error) {
            logger.warn('Failed to save to localStorage', error);
        }
    }

    /**
     * Load from localStorage
     * @private
     */
    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const ids = JSON.parse(stored);
                return Array.isArray(ids) ? ids : [];
            }
            return [];
        } catch (error) {
            logger.warn('Failed to load from localStorage', error);
            return [];
        }
    }

    // =========================================================================
    // AUTO-ENABLE LOGIC
    // =========================================================================

    /**
     * Auto-enable all calendars for an account
     */
    async autoEnableAllCalendars(accountType = 'primary') {
        try {
            const tokenStore = window.sessionManager?.getTokenStore();
            if (!tokenStore) return;

            const account = await tokenStore.getAccountTokens('google', accountType);
            if (!account || !account.email) return;

            const calendars = await this.getCalendars(accountType);
            if (!calendars || calendars.length === 0) return;

            let newCalendarsAdded = 0;
            for (const calendar of calendars) {
                const calendarId = this.createPrefixedId(accountType, calendar.id);
                if (!this.activeCalendarIds.includes(calendarId)) {
                    this.activeCalendarIds.push(calendarId);
                    newCalendarsAdded++;
                }
            }

            if (newCalendarsAdded > 0) {
                await this.saveActiveCalendars();
                logger.success('All calendars auto-enabled', { accountType, count: newCalendarsAdded });
            }

        } catch (error) {
            logger.error('Failed to auto-enable calendars', { accountType, error });
        }
    }

    /**
     * @deprecated Use autoEnableAllCalendars instead
     */
    async autoEnablePrimaryCalendar(accountType = 'primary') {
        return this.autoEnableAllCalendars(accountType);
    }

    /**
     * Check all accounts and auto-enable calendars for new accounts
     * @private
     */
    async autoEnableNewAccountCalendars() {
        try {
            const tokenStore = window.sessionManager?.getTokenStore();
            if (!tokenStore) return;

            const googleAccounts = await tokenStore.getProviderAccounts('google');
            const accountTypes = Object.keys(googleAccounts || {});

            for (const accountType of accountTypes) {
                const prefix = `${accountType}-`;
                const hasActiveCalendars = this.activeCalendarIds.some(id => id.startsWith(prefix));

                if (!hasActiveCalendars) {
                    await this.autoEnableAllCalendars(accountType);
                }
            }

        } catch (error) {
            logger.warn('Failed to auto-enable new account calendars', error);
        }
    }

    // =========================================================================
    // ACCOUNT-PREFIXED ID HELPERS
    // =========================================================================

    /**
     * Create account-prefixed calendar ID
     */
    createPrefixedId(accountType, calendarId) {
        return `${accountType}-${calendarId}`;
    }

    /**
     * Parse account-prefixed calendar ID
     */
    parsePrefixedId(prefixedId) {
        const firstDashIndex = prefixedId.indexOf('-');
        if (firstDashIndex === -1) {
            logger.warn('Invalid prefixed ID format', { prefixedId });
            return { accountType: 'primary', calendarId: prefixedId };
        }
        const accountType = prefixedId.substring(0, firstDashIndex);
        const calendarId = prefixedId.substring(firstDashIndex + 1);
        return { accountType, calendarId };
    }

    // =========================================================================
    // BACKGROUND REFRESH (Delegates to RefreshManager)
    // =========================================================================

    /**
     * Start automatic background refresh
     */
    startAutoRefresh(intervalMs = 30 * 60 * 1000) {
        this.refreshManager.startAutoRefresh(intervalMs);
    }

    /**
     * Stop automatic background refresh
     */
    stopAutoRefresh() {
        this.refreshManager.stopAutoRefresh();
    }

    /**
     * Manually trigger a refresh
     */
    async triggerRefresh() {
        return this.refreshManager.triggerRefresh();
    }

    // =========================================================================
    // CONVENIENCE METHODS (Delegates to EventProcessor)
    // =========================================================================

    /**
     * Normalize all-day event (delegates to EventProcessor)
     * Kept for backward compatibility
     */
    normalizeAllDayEvent(event) {
        return this.processor.cleanEventData([event])[0];
    }

    /**
     * Format date safely (delegates to EventProcessor)
     * Kept for backward compatibility
     */
    formatDateSafe(date) {
        return this.processor.formatDateSafe(date);
    }
}

// Export singleton instance
let calendarServiceInstance = null;

export function initializeCalendarService(edgeClient) {
    if (!calendarServiceInstance) {
        calendarServiceInstance = new CalendarService(edgeClient);
        logger.verbose('CalendarService singleton initialized');
    }
    return calendarServiceInstance;
}

export function getCalendarService() {
    if (!calendarServiceInstance) {
        throw new Error('CalendarService not initialized. Call initializeCalendarService() first.');
    }
    return calendarServiceInstance;
}
