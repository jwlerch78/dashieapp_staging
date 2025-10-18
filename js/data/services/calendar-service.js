// js/data/services/calendar-service.js
// Calendar service for fetching calendar data with automatic token refresh
// High-level wrapper around GoogleAPIClient

import { createLogger } from '../../utils/logger.js';
import { GoogleAPIClient } from './google/google-api-client.js';

const logger = createLogger('CalendarService');

/**
 * CalendarService - High-level calendar operations
 *
 * Features:
 * - Automatic token refresh via EdgeClient
 * - Multi-account support (primary, primary-tv, account2, etc.)
 * - Caching (future enhancement)
 * - Error handling and retry logic
 *
 * Usage:
 *   const service = new CalendarService(edgeClient);
 *   const calendars = await service.getCalendars();
 *   const events = await service.getEvents('primary', 'calendarId@gmail.com');
 */
export class CalendarService {
    constructor(edgeClient) {
        if (!edgeClient) {
            throw new Error('EdgeClient is required for CalendarService');
        }

        this.edgeClient = edgeClient;
        this.googleClient = new GoogleAPIClient(edgeClient);
        this.activeCalendarIds = []; // Account-prefixed IDs (e.g., 'primary-user@gmail.com')

        logger.verbose('CalendarService initialized');
    }

    /**
     * Initialize service and load active calendars from user_calendar_config table
     * @returns {Promise<void>}
     */
    async initialize() {
        logger.info('Initializing CalendarService with calendar config');

        try {
            // Load calendar config from user_calendar_config table
            this.activeCalendarIds = await this.edgeClient.loadCalendarConfig();

            logger.success('CalendarService initialized from user_calendar_config', {
                activeCalendars: this.activeCalendarIds.length
            });
        } catch (error) {
            logger.warn('Failed to load active calendars from user_calendar_config', error);
            this.activeCalendarIds = [];
        }
    }

    // =========================================================================
    // ACCOUNT-PREFIXED ID METHODS
    // =========================================================================

    /**
     * Create account-prefixed calendar ID
     * @param {string} accountType - Account type ('primary', 'account2', etc.)
     * @param {string} calendarId - Raw calendar ID from Google API
     * @returns {string} Prefixed ID like 'primary-user@gmail.com'
     */
    createPrefixedId(accountType, calendarId) {
        return `${accountType}-${calendarId}`;
    }

    /**
     * Parse account-prefixed calendar ID
     * @param {string} prefixedId - Like 'primary-user@gmail.com'
     * @returns {{ accountType: string, calendarId: string }}
     */
    parsePrefixedId(prefixedId) {
        // Handle edge case: calendar IDs can contain dashes
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
    // CALENDAR FETCHING
    // =========================================================================

    /**
     * Get all calendars for an account with prefixed IDs
     * @param {string} accountType - Account type ('primary', 'primary-tv', 'account2', etc.)
     * @returns {Promise<Array>} Array of calendar objects with prefixed IDs
     */
    async getCalendars(accountType = 'primary') {
        logger.info('Fetching calendars', { accountType });

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

            logger.success('Calendars fetched successfully', {
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
     * @param {string} accountType - Account type ('primary', 'primary-tv', 'account2', etc.)
     * @param {string} calendarId - Calendar ID (e.g., 'primary' or 'user@gmail.com')
     * @param {object} timeRange - Optional time range { start: Date, end: Date }
     * @returns {Promise<Array>} Array of event objects
     */
    async getEvents(accountType = 'primary', calendarId = 'primary', timeRange = {}) {
        logger.info('Fetching events', { accountType, calendarId });

        try {
            const events = await this.googleClient.getCalendarEvents(
                calendarId,
                timeRange,
                accountType
            );

            logger.success('Events fetched successfully', {
                accountType,
                calendarId,
                count: events.length
            });

            return events;

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
     * Get events from multiple calendars
     * @param {string} accountType - Account type
     * @param {Array<string>} calendarIds - Array of calendar IDs
     * @param {object} timeRange - Optional time range
     * @returns {Promise<Array>} Combined array of events from all calendars
     */
    async getEventsFromMultipleCalendars(accountType = 'primary', calendarIds = [], timeRange = {}) {
        logger.info('Fetching events from multiple calendars', {
            accountType,
            calendarCount: calendarIds.length
        });

        try {
            // Fetch events from all calendars in parallel
            const eventPromises = calendarIds.map(calendarId =>
                this.getEvents(accountType, calendarId, timeRange)
            );

            const eventsArrays = await Promise.all(eventPromises);

            // Combine and sort events by start time
            const allEvents = eventsArrays.flat();
            allEvents.sort((a, b) => {
                const aStart = a.start?.dateTime || a.start?.date;
                const bStart = b.start?.dateTime || b.start?.date;
                return new Date(aStart) - new Date(bStart);
            });

            logger.success('Multi-calendar events fetched successfully', {
                accountType,
                totalEvents: allEvents.length
            });

            return allEvents;

        } catch (error) {
            logger.error('Failed to fetch multi-calendar events', {
                accountType,
                error: error.message
            });
            throw error;
        }
    }

    // =========================================================================
    // ACTIVE CALENDAR MANAGEMENT
    // =========================================================================

    /**
     * Check if calendar is active
     * @param {string} accountType - Account type
     * @param {string} calendarId - Raw calendar ID
     * @returns {boolean}
     */
    isCalendarActive(accountType, calendarId) {
        const prefixedId = this.createPrefixedId(accountType, calendarId);
        return this.activeCalendarIds.includes(prefixedId);
    }

    /**
     * Enable a calendar
     * @param {string} accountType - Account type
     * @param {string} calendarId - Raw calendar ID
     * @returns {Promise<void>}
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
     * @param {string} accountType - Account type
     * @param {string} calendarId - Raw calendar ID
     * @returns {Promise<void>}
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
     * @returns {Array<string>} Array of prefixed calendar IDs
     */
    getActiveCalendarIds() {
        return [...this.activeCalendarIds];
    }

    /**
     * Save active calendars to user_calendar_config table
     * @returns {Promise<void>}
     */
    async saveActiveCalendars() {
        try {
            // Save to user_calendar_config table via EdgeClient
            await this.edgeClient.saveCalendarConfig(this.activeCalendarIds);

            logger.debug('Active calendars saved to user_calendar_config', {
                count: this.activeCalendarIds.length,
                ids: this.activeCalendarIds
            });

        } catch (error) {
            logger.error('Failed to save active calendars', error);
            throw error;
        }
    }

    /**
     * Get all events from all active calendars
     * @param {object} timeRange - Time range options
     * @returns {Promise<Array>} All events from active calendars
     */
    async getAllActiveEvents(timeRange = {}) {
        logger.info('Fetching events from all active calendars', {
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
}

// Export singleton instance (will be initialized by app with edgeClient)
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
