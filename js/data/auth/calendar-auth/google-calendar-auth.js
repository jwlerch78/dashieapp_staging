// js/data/auth/calendar-auth/google-calendar-auth.js
// Google implementation of Layer 2 authentication: How we access Google Calendar API
// Part of Phase 3: Multi-provider auth architecture

import { BaseCalendarAuth } from './base-calendar-auth.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('GoogleCalendarAuth');

/**
 * GoogleCalendarAuth - Google Calendar API Access (Layer 2)
 *
 * This handles OAuth and API access for Google Calendar, independently
 * from how the user logged into Dashie (Layer 1).
 *
 * Use Cases:
 * - User logged in with Amazon but wants to connect Google Calendar
 * - Multiple Google Calendar accounts (primary, account2, account3)
 * - Calendar list fetching
 * - Event fetching
 * - Token refresh
 *
 * Uses the existing GoogleAPIClient for API calls.
 */
export class GoogleCalendarAuth extends BaseCalendarAuth {
    constructor(tokenStore, googleAPIClient, webOAuthProvider) {
        super(tokenStore);
        this.providerName = 'google-calendar';
        this.googleAPIClient = googleAPIClient;
        this.webOAuthProvider = webOAuthProvider; // For OAuth flow
    }

    /**
     * Initialize Google Calendar authentication
     */
    async initialize() {
        try {
            // Check for any existing Google calendar tokens
            const accounts = await this.getConnectedAccounts();

            this.isReady = true;

            logger.info('GoogleCalendarAuth initialized', {
                connectedAccounts: accounts.length,
                accounts: accounts
            });

        } catch (error) {
            logger.error('Failed to initialize GoogleCalendarAuth', error);
            throw error;
        }
    }

    /**
     * Connect a Google Calendar account
     * Initiates OAuth flow and stores tokens
     * @param {string} accountType - Account identifier (e.g., 'primary', 'account2')
     * @param {object} options - OAuth options
     * @returns {Promise<object>} Token data
     */
    async connectAccount(accountType, options = {}) {
        try {
            logger.info('Connecting Google Calendar account', { accountType });

            // Initiate OAuth flow via web OAuth provider
            // This will redirect to Google and come back with tokens
            const result = await this.webOAuthProvider.signIn();

            // Handle redirect case
            if (result === undefined || result.redirected) {
                logger.debug('OAuth redirect initiated for calendar connection');
                return { redirected: true };
            }

            // Handle successful OAuth
            if (result && result.success && result.user) {
                // Extract token data
                const tokenData = {
                    access_token: result.user.googleAccessToken,
                    refresh_token: result.refreshToken || null,
                    expires_at: this.calculateExpiry(result.expiresIn),
                    scopes: result.scopes || [],
                    email: result.user.email,
                    display_name: result.user.name || result.user.email,
                    provider_info: {
                        picture: result.user.picture
                    }
                };

                // Store tokens
                await this.tokenStore.storeAccountTokens('google', accountType, tokenData);

                logger.success('Google Calendar account connected', {
                    accountType,
                    email: tokenData.email
                });

                return tokenData;
            }

            throw new Error(result.error || 'Calendar account connection failed');

        } catch (error) {
            return this.handleError(error, accountType);
        }
    }

    /**
     * Disconnect a Google Calendar account
     * @param {string} accountType - Account identifier
     */
    async disconnectAccount(accountType) {
        try {
            // Remove tokens from token store
            await this.tokenStore.removeAccountTokens('google', accountType);

            logger.info('Google Calendar account disconnected', { accountType });

        } catch (error) {
            logger.error('Error disconnecting Google Calendar account', error);
            throw error;
        }
    }

    /**
     * Get list of calendars for an account
     * @param {string} accountType - Account identifier
     * @returns {Promise<Array>} Array of calendar objects
     */
    async getCalendarList(accountType) {
        try {
            // Validate tokens first
            const isValid = await this.validateTokens(accountType);
            if (!isValid) {
                throw new Error(`Invalid or expired tokens for account: ${accountType}`);
            }

            // Fetch calendar list via Google API Client
            const rawCalendars = await this.googleAPIClient.getCalendarList(accountType);

            // Normalize calendar objects
            const calendars = rawCalendars.map(cal => this.normalizeCalendar(cal, accountType));

            logger.success('Retrieved calendar list for account', {
                accountType,
                calendarCount: calendars.length
            });

            return calendars;

        } catch (error) {
            logger.error('Failed to get calendar list', { accountType, error: error.message });
            throw this.handleError(error, accountType);
        }
    }

    /**
     * Get events for a calendar
     * @param {string} calendarId - Raw calendar ID (without account prefix)
     * @param {object} timeRange - { start: Date, end: Date }
     * @param {string} accountType - Account identifier
     * @returns {Promise<Array>} Array of event objects
     */
    async getCalendarEvents(calendarId, timeRange, accountType) {
        try {
            // Validate tokens first
            const isValid = await this.validateTokens(accountType);
            if (!isValid) {
                throw new Error(`Invalid or expired tokens for account: ${accountType}`);
            }

            // Fetch events via Google API Client
            const rawEvents = await this.googleAPIClient.getCalendarEvents(
                calendarId,
                timeRange,
                accountType
            );

            // Normalize event objects
            const events = rawEvents.map(event => this.normalizeEvent(event));

            logger.success('Retrieved calendar events', {
                accountType,
                calendarId,
                eventCount: events.length
            });

            return events;

        } catch (error) {
            logger.error('Failed to get calendar events', {
                accountType,
                calendarId,
                error: error.message
            });
            throw this.handleError(error, accountType);
        }
    }

    /**
     * Refresh access token for an account
     * This delegates to the JWT service which handles the actual refresh
     * @param {string} accountType - Account identifier
     * @returns {Promise<object>} New token data
     */
    async refreshToken(accountType) {
        try {
            logger.info('Refreshing Google Calendar token', { accountType });

            // The JWT service handles token refresh automatically
            // via the GoogleAPIClient.getAccessToken() method
            // We just need to force a refresh and update our token store

            const newAccessToken = await this.googleAPIClient.getAccessToken(true, accountType);

            if (!newAccessToken) {
                throw new Error('Failed to refresh access token');
            }

            // Get existing token data
            const existingTokens = await this.tokenStore.getAccountTokens('google', accountType);

            // Update with new access token
            const updatedTokenData = {
                ...existingTokens,
                access_token: newAccessToken,
                expires_at: this.calculateExpiry(3600), // Default 1 hour expiry
                updated_at: new Date().toISOString()
            };

            // Store updated tokens
            await this.tokenStore.storeAccountTokens('google', accountType, updatedTokenData);

            logger.success('Token refreshed successfully', { accountType });

            return updatedTokenData;

        } catch (error) {
            logger.error('Failed to refresh token', { accountType, error: error.message });
            throw this.handleError(error, accountType);
        }
    }

    /**
     * Get provider capabilities
     */
    getCapabilities() {
        return {
            supportsMultipleAccounts: true,
            supportsSharedCalendars: true,
            supportsEventCreation: false, // Not implemented yet
            supportsEventModification: false,
            supportsEventDeletion: false,
            maxAccountsSupported: 10,
            requiredScopes: [
                'https://www.googleapis.com/auth/calendar.readonly'
            ]
        };
    }

    /**
     * Calculate token expiry timestamp
     * @param {number} expiresIn - Seconds until expiry
     * @returns {string} ISO 8601 timestamp
     */
    calculateExpiry(expiresIn = 3600) {
        const expiryDate = new Date(Date.now() + (expiresIn * 1000));
        return expiryDate.toISOString();
    }

    /**
     * Normalize calendar object from Google Calendar API
     * @param {object} rawCalendar - Raw calendar from Google API
     * @param {string} accountType - Account identifier
     * @returns {object} Normalized calendar
     */
    normalizeCalendar(rawCalendar, accountType) {
        return {
            id: rawCalendar.id,
            summary: rawCalendar.summary || 'Untitled Calendar',
            description: rawCalendar.description || '',
            backgroundColor: rawCalendar.backgroundColor || '#3F51B5',
            foregroundColor: rawCalendar.foregroundColor || '#FFFFFF',
            accessRole: rawCalendar.accessRole || 'reader',
            selected: rawCalendar.selected || false,
            primary: rawCalendar.primary || false,
            timeZone: rawCalendar.timeZone,
            accountType: accountType,
            provider: this.providerName,
            raw: rawCalendar
        };
    }

    /**
     * Normalize event object from Google Calendar API
     * @param {object} rawEvent - Raw event from Google API
     * @returns {object} Normalized event
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
            htmlLink: rawEvent.htmlLink || null,
            attendees: rawEvent.attendees || [],
            organizer: rawEvent.organizer || null,
            recurringEventId: rawEvent.recurringEventId || null,
            created: rawEvent.created,
            updated: rawEvent.updated,
            provider: this.providerName,
            raw: rawEvent
        };
    }
}
