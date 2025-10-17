// js/data/auth/calendar-auth/base-calendar-auth.js
// Base class for Layer 2 authentication: How we access calendar providers
// Part of Phase 3: Multi-provider auth architecture

import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('BaseCalendarAuth');

/**
 * BaseCalendarAuth - Layer 2: Calendar Provider Authentication
 *
 * This layer handles how we connect to and access calendar providers.
 * Examples: Google Calendar API, Apple iCloud (CalDAV), Microsoft Outlook (Graph API)
 *
 * This is SEPARATE from account authentication (Layer 1).
 * A user can log in with Amazon but connect Google Calendar, iCloud, and Outlook.
 *
 * Key Features:
 * - Multi-account support (primary, account2, account3, etc.)
 * - OAuth token management per account
 * - Calendar list fetching
 * - Calendar event fetching
 * - Token refresh
 *
 * Provider implementations should extend this class and implement all methods.
 */
export class BaseCalendarAuth {
    constructor(tokenStore) {
        this.providerName = 'unknown';
        this.isReady = false;
        this.tokenStore = tokenStore; // Reference to TokenStore for token management
    }

    /**
     * Get provider name (e.g., 'google-calendar', 'icloud-calendar', 'outlook-calendar')
     * @returns {string} Provider identifier
     */
    getProviderName() {
        return this.providerName;
    }

    /**
     * Initialize the calendar provider
     * Called once during app startup
     * @returns {Promise<void>}
     */
    async initialize() {
        logger.warn(`initialize() not implemented for ${this.providerName}`);
        throw new Error('initialize() must be implemented by provider');
    }

    /**
     * Connect a calendar account
     * Initiates OAuth flow and stores tokens
     * @param {string} accountType - Account identifier (e.g., 'primary', 'account2')
     * @param {object} options - Provider-specific options
     * @returns {Promise<object>} Token data { access_token, expires_at, scopes, ... }
     */
    async connectAccount(accountType, options = {}) {
        logger.warn(`connectAccount() not implemented for ${this.providerName}`);
        throw new Error('connectAccount() must be implemented by provider');
    }

    /**
     * Disconnect a calendar account
     * Revokes access and removes tokens
     * @param {string} accountType - Account identifier
     * @returns {Promise<void>}
     */
    async disconnectAccount(accountType) {
        logger.warn(`disconnectAccount() not implemented for ${this.providerName}`);
        throw new Error('disconnectAccount() must be implemented by provider');
    }

    /**
     * Get list of calendars for an account
     * @param {string} accountType - Account identifier
     * @returns {Promise<Array>} Array of calendar objects
     */
    async getCalendarList(accountType) {
        logger.warn(`getCalendarList() not implemented for ${this.providerName}`);
        throw new Error('getCalendarList() must be implemented by provider');
    }

    /**
     * Get events for a calendar
     * @param {string} calendarId - Raw calendar ID (without account prefix)
     * @param {object} timeRange - { start: Date, end: Date }
     * @param {string} accountType - Account identifier
     * @returns {Promise<Array>} Array of event objects
     */
    async getCalendarEvents(calendarId, timeRange, accountType) {
        logger.warn(`getCalendarEvents() not implemented for ${this.providerName}`);
        throw new Error('getCalendarEvents() must be implemented by provider');
    }

    /**
     * Refresh access token for an account
     * @param {string} accountType - Account identifier
     * @returns {Promise<object>} New token data
     */
    async refreshToken(accountType) {
        logger.warn(`refreshToken() not implemented for ${this.providerName}`);
        throw new Error('refreshToken() must be implemented by provider');
    }

    /**
     * Check if account is connected
     * @param {string} accountType - Account identifier
     * @returns {Promise<boolean>} True if account has valid tokens
     */
    async isAccountConnected(accountType) {
        if (!this.tokenStore) {
            return false;
        }

        const tokens = await this.tokenStore.getAccountTokens(this.providerName, accountType);
        return !!tokens && !tokens.isExpired;
    }

    /**
     * Get all connected accounts for this provider
     * @returns {Promise<Array>} Array of account types
     */
    async getConnectedAccounts() {
        if (!this.tokenStore) {
            return [];
        }

        const providerAccounts = await this.tokenStore.getProviderAccounts(this.providerName);
        return Object.keys(providerAccounts);
    }

    /**
     * Validate account tokens
     * Checks if tokens are valid and not expired
     * @param {string} accountType - Account identifier
     * @returns {Promise<boolean>} True if tokens are valid
     */
    async validateTokens(accountType) {
        if (!this.tokenStore) {
            return false;
        }

        const tokens = await this.tokenStore.getAccountTokens(this.providerName, accountType);
        if (!tokens) {
            return false;
        }

        // If expired, try to refresh
        if (tokens.isExpired) {
            try {
                await this.refreshToken(accountType);
                return true;
            } catch (error) {
                logger.error(`Failed to refresh tokens for ${accountType}`, error);
                return false;
            }
        }

        return true;
    }

    /**
     * Get provider capabilities
     * @returns {object} Capabilities object
     */
    getCapabilities() {
        return {
            supportsMultipleAccounts: true,
            supportsSharedCalendars: true,
            supportsEventCreation: false,
            supportsEventModification: false,
            supportsEventDeletion: false,
            maxAccountsSupported: 5,
            requiredScopes: []
        };
    }

    /**
     * Check if provider is ready to use
     * @returns {boolean} True if initialized and ready
     */
    isProviderReady() {
        return this.isReady;
    }

    /**
     * Normalize calendar object
     * Converts provider-specific format to standard format
     * @param {object} rawCalendar - Provider-specific calendar object
     * @param {string} accountType - Account identifier
     * @returns {object} Normalized calendar object
     */
    normalizeCalendar(rawCalendar, accountType) {
        return {
            id: rawCalendar.id,
            summary: rawCalendar.summary || rawCalendar.name || 'Untitled Calendar',
            description: rawCalendar.description || '',
            backgroundColor: rawCalendar.backgroundColor || '#3F51B5',
            foregroundColor: rawCalendar.foregroundColor || '#FFFFFF',
            accessRole: rawCalendar.accessRole || 'reader',
            selected: rawCalendar.selected || false,
            primary: rawCalendar.primary || false,
            accountType: accountType,
            provider: this.providerName,
            raw: rawCalendar // Keep original for provider-specific features
        };
    }

    /**
     * Normalize event object
     * Converts provider-specific format to standard format
     * @param {object} rawEvent - Provider-specific event object
     * @returns {object} Normalized event object
     */
    normalizeEvent(rawEvent) {
        return {
            id: rawEvent.id,
            summary: rawEvent.summary || '(No title)',
            description: rawEvent.description || '',
            location: rawEvent.location || '',
            start: this.normalizeDateTime(rawEvent.start),
            end: this.normalizeDateTime(rawEvent.end),
            isAllDay: this.isAllDayEvent(rawEvent),
            status: rawEvent.status || 'confirmed',
            colorId: rawEvent.colorId || null,
            backgroundColor: rawEvent.backgroundColor || null,
            attendees: rawEvent.attendees || [],
            organizer: rawEvent.organizer || null,
            provider: this.providerName,
            raw: rawEvent // Keep original for provider-specific features
        };
    }

    /**
     * Normalize date/time object
     * @param {object} dateTime - Provider-specific date/time object
     * @returns {Date} JavaScript Date object
     */
    normalizeDateTime(dateTime) {
        if (!dateTime) return null;

        if (dateTime.dateTime) {
            return new Date(dateTime.dateTime);
        } else if (dateTime.date) {
            return new Date(dateTime.date);
        }

        return new Date(dateTime);
    }

    /**
     * Check if event is all-day
     * @param {object} event - Event object
     * @returns {boolean} True if all-day event
     */
    isAllDayEvent(event) {
        if (!event.start || !event.end) return false;

        // Check if using 'date' field instead of 'dateTime'
        if (event.start.date && !event.start.dateTime) {
            return true;
        }

        return false;
    }

    /**
     * Handle auth errors
     * @param {Error} error - Error object
     * @param {string} accountType - Account identifier
     * @returns {object} Normalized error object
     */
    handleError(error, accountType) {
        logger.error(`${this.providerName} calendar auth error for ${accountType}`, error);

        return {
            provider: this.providerName,
            accountType: accountType,
            code: error.code || 'UNKNOWN_ERROR',
            message: error.message || 'Calendar authentication failed',
            isRecoverable: error.status !== 401, // 401 = needs re-auth
            requiresReauth: error.status === 401,
            originalError: error
        };
    }

    /**
     * Clean up resources
     * Called when provider is being destroyed
     */
    destroy() {
        this.isReady = false;
        logger.debug(`${this.providerName} calendar provider destroyed`);
    }
}
