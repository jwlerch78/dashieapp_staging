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
        this.STORAGE_KEY = 'dashie-active-calendars'; // localStorage key

        logger.verbose('CalendarService initialized');
    }

    /**
     * Initialize service and load active calendars from user_calendar_config table
     * @returns {Promise<void>}
     */
    async initialize() {
        logger.info('Initializing CalendarService with calendar config');

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
                logger.info('No active calendars found, auto-enabling primary calendar');
                await this.autoEnablePrimaryCalendar();
            }

            // Check all accounts and auto-enable primary calendar for new accounts
            await this.autoEnableNewAccountCalendars();

        } catch (error) {
            logger.warn('Failed to load active calendars from database', error);

            // Fallback to localStorage
            const fromLocalStorage = this.loadFromLocalStorage();
            if (fromLocalStorage.length > 0) {
                logger.info('Loaded active calendars from localStorage fallback', {
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

    /**
     * Auto-enable the primary calendar for an account
     * Called during initialization if no calendars are active for that account
     * @param {string} accountType - Account type ('primary', 'account2', etc.)
     * @private
     */
    async autoEnableAllCalendars(accountType = 'primary') {
        try {
            logger.info('Auto-enabling all calendars for account', { accountType });

            // Check if we have this account
            const tokenStore = window.sessionManager?.getTokenStore();
            if (!tokenStore) {
                logger.warn('TokenStore not available, skipping auto-enable');
                return;
            }

            const account = await tokenStore.getAccountTokens('google', accountType);
            if (!account || !account.email) {
                logger.warn('No account found, skipping auto-enable', { accountType });
                return;
            }

            // Fetch all calendars for this account
            const calendars = await this.getCalendars(accountType);

            if (!calendars || calendars.length === 0) {
                logger.warn('No calendars found for account', { accountType });
                return;
            }

            logger.info('Found calendars to enable', {
                accountType,
                count: calendars.length,
                email: account.email
            });

            // Enable all calendars that aren't already enabled
            let newCalendarsAdded = 0;
            for (const calendar of calendars) {
                const calendarId = this.createPrefixedId(accountType, calendar.id);

                // Check if it's already enabled
                if (!this.activeCalendarIds.includes(calendarId)) {
                    this.activeCalendarIds.push(calendarId);
                    newCalendarsAdded++;
                    logger.debug('Enabled calendar', {
                        calendarId,
                        summary: calendar.summary
                    });
                }
            }

            if (newCalendarsAdded > 0) {
                // Save to database and localStorage
                await this.saveActiveCalendars();

                logger.success('All calendars auto-enabled', {
                    accountType,
                    totalCalendars: calendars.length,
                    newCalendarsAdded,
                    userEmail: account.email
                });
            } else {
                logger.debug('All calendars already enabled', { accountType });
            }

        } catch (error) {
            logger.error('Failed to auto-enable calendars', { accountType, error });
            throw error;
        }
    }

    /**
     * @deprecated Use autoEnableAllCalendars instead
     */
    async autoEnablePrimaryCalendar(accountType = 'primary') {
        return this.autoEnableAllCalendars(accountType);
    }

    /**
     * Check all Google accounts and auto-enable all calendars for accounts with no active calendars
     * This ensures newly added accounts automatically have all their calendars enabled
     * @private
     */
    async autoEnableNewAccountCalendars() {
        try {
            const tokenStore = window.sessionManager?.getTokenStore();
            if (!tokenStore) {
                logger.debug('TokenStore not available, skipping new account calendar check');
                return;
            }

            // Get all Google accounts
            const googleAccounts = await tokenStore.getProviderAccounts('google');
            const accountTypes = Object.keys(googleAccounts || {});

            if (accountTypes.length === 0) {
                logger.debug('No Google accounts found');
                return;
            }

            logger.debug('Checking accounts for auto-enable', {
                accountCount: accountTypes.length,
                accounts: accountTypes
            });

            // For each account, check if it has any active calendars
            for (const accountType of accountTypes) {
                try {
                    // Check if this account has any active calendars
                    const prefix = `${accountType}-`;
                    const hasActiveCalendars = this.activeCalendarIds.some(id => id.startsWith(prefix));

                    if (!hasActiveCalendars) {
                        logger.info('Account has no active calendars, auto-enabling all calendars', { accountType });
                        await this.autoEnableAllCalendars(accountType);
                    } else {
                        logger.debug('Account already has active calendars', { accountType });
                    }
                } catch (error) {
                    logger.warn('Failed to check/enable calendars for account', { accountType, error });
                    // Continue with other accounts
                }
            }

        } catch (error) {
            logger.warn('Failed to auto-enable new account calendars', error);
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
     * @param {string} accountType - Account type ('primary', 'primary-tv', 'account2', etc.)
     * @param {string} calendarId - Calendar ID (e.g., 'primary' or 'user@gmail.com')
     * @param {object} timeRange - Optional time range { start: Date, end: Date }
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

            // Normalize all-day events (Google uses exclusive end dates, we need inclusive)
            const normalizedEvents = events.map(event => this.normalizeAllDayEvent(event));

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
     * Get events from multiple calendars
     * @param {string} accountType - Account type
     * @param {Array<string>} calendarIds - Array of calendar IDs
     * @param {object} timeRange - Optional time range
     * @returns {Promise<Array>} Combined array of events from all calendars
     */
    async getEventsFromMultipleCalendars(accountType = 'primary', calendarIds = [], timeRange = {}) {
        logger.debug('Fetching events from multiple calendars', {
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
     * Save active calendars to user_calendar_config table and localStorage
     * @returns {Promise<void>}
     */
    async saveActiveCalendars() {
        try {
            // Save to localStorage first (instant)
            this.saveToLocalStorage();

            // Save to database (async)
            await this.edgeClient.saveCalendarConfig(this.activeCalendarIds);

            // Clear widget data manager cache so next load fetches fresh data
            if (window.widgetDataManager) {
                window.widgetDataManager.clearCalendarCache();
            }

            logger.debug('Active calendars saved to database and localStorage', {
                count: this.activeCalendarIds.length,
                ids: this.activeCalendarIds
            });

        } catch (error) {
            logger.error('Failed to save active calendars to database', error);
            // Note: localStorage save already succeeded, so calendars are persisted locally
            throw error;
        }
    }

    /**
     * Save active calendar IDs to localStorage
     * @private
     */
    saveToLocalStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.activeCalendarIds));
            logger.debug('Saved active calendars to localStorage', {
                count: this.activeCalendarIds.length
            });
        } catch (error) {
            logger.warn('Failed to save to localStorage', error);
        }
    }

    /**
     * Load active calendar IDs from localStorage
     * @private
     * @returns {Array<string>} Active calendar IDs
     */
    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) {
                return [];
            }

            const ids = JSON.parse(stored);
            if (Array.isArray(ids)) {
                return ids;
            }

            return [];
        } catch (error) {
            logger.warn('Failed to load from localStorage', error);
            return [];
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
    // ALL-DAY EVENT NORMALIZATION
    // =========================================================================

    /**
     * Normalize all-day event end dates
     * Google Calendar API returns exclusive end dates for all-day events.
     * For example, a birthday on Jan 15 has start: "2025-01-15", end: "2025-01-16"
     * This function converts the end date to inclusive by subtracting 1 day.
     *
     * @param {Object} event - Calendar event
     * @returns {Object} Event with normalized end date
     */
    normalizeAllDayEvent(event) {
        // Only process all-day events (those with event.start.date instead of event.start.dateTime)
        if (!event.start?.date) {
            return event;
        }

        // Parse the end date and subtract 1 day
        const endDateParts = event.end.date.split('-');
        const endYear = parseInt(endDateParts[0]);
        const endMonth = parseInt(endDateParts[1]) - 1; // Month is 0-indexed in Date
        const endDay = parseInt(endDateParts[2]);

        // Create date object and subtract 1 day
        const endDateObj = new Date(endYear, endMonth, endDay);
        endDateObj.setDate(endDateObj.getDate() - 1);

        // Format back to YYYY-MM-DD
        const adjustedEndDate = this.formatDateSafe(endDateObj);

        return {
            ...event,
            end: {
                date: adjustedEndDate,
                dateTime: null
            }
        };
    }

    /**
     * Format date object to YYYY-MM-DD string (timezone-safe)
     * @param {Date} date - Date object
     * @returns {string} Formatted date string
     */
    formatDateSafe(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
