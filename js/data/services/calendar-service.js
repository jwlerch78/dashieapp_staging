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

        logger.info('CalendarService initialized');
    }

    /**
     * Get all calendars for an account
     * @param {string} accountType - Account type ('primary', 'primary-tv', 'account2', etc.)
     * @returns {Promise<Array>} Array of calendar objects
     */
    async getCalendars(accountType = 'primary') {
        logger.info('Fetching calendars', { accountType });

        try {
            const calendars = await this.googleClient.getCalendarList(accountType);

            logger.success('Calendars fetched successfully', {
                accountType,
                count: calendars.length
            });

            return calendars;

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
}

// Export singleton instance (will be initialized by app with edgeClient)
let calendarServiceInstance = null;

export function initializeCalendarService(edgeClient) {
    if (!calendarServiceInstance) {
        calendarServiceInstance = new CalendarService(edgeClient);
        logger.info('CalendarService singleton initialized');
    }
    return calendarServiceInstance;
}

export function getCalendarService() {
    if (!calendarServiceInstance) {
        throw new Error('CalendarService not initialized. Call initializeCalendarService() first.');
    }
    return calendarServiceInstance;
}
