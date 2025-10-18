// js/data/services/google/google-api-client.js
// Phase 3 - Simplified Google API client that works with TokenStore
// Based on legacy client but adapted for Phase 3 architecture

import { createLogger } from '../../../utils/logger.js';
import { API_CONFIG } from '../../auth/auth-config.js';

const logger = createLogger('GoogleAPIClient');

/**
 * Google API client for Phase 3
 * Uses EdgeClient.getValidToken() for automatic token refresh
 * Handles Calendar API calls with retry logic and rate limiting
 */
export class GoogleAPIClient {
  constructor(edgeClient) {
    this.edgeClient = edgeClient;
    this.config = API_CONFIG.google;
    this.lastRequestTime = null;

    logger.info('Google API client initialized', {
      baseUrl: this.config.baseUrl,
      rateLimitInterval: this.config.rateLimitInterval
    });
  }

  /**
   * Get current Google access token with automatic refresh
   * Uses EdgeClient.getValidToken() which:
   * - Loads tokens from Supabase
   * - Auto-refreshes if expired (< 5 min buffer)
   * - Returns valid access_token
   *
   * @param {string} accountType - Account type (e.g., 'primary', 'primary-tv')
   * @returns {Promise<string>} Valid access token
   * @throws {Error} If unable to obtain valid token
   */
  async getAccessToken(accountType = 'primary') {
    if (!this.edgeClient) {
      throw new Error('EdgeClient not available');
    }

    if (!this.edgeClient.jwtToken) {
      throw new Error('EdgeClient not authenticated (no JWT)');
    }

    logger.debug('Requesting valid token from EdgeClient', { accountType });

    try {
      // EdgeClient.getValidToken() calls edge function which:
      // 1. Loads tokens from Supabase (user_auth_tokens table)
      // 2. Checks if expired (< 5 min buffer)
      // 3. Auto-refreshes with Google OAuth if needed
      // 4. Returns valid access_token
      const tokenResult = await this.edgeClient.getValidToken('google', accountType);

      if (!tokenResult || !tokenResult.access_token) {
        throw new Error(`No access token returned for google/${accountType}`);
      }

      logger.debug('Valid token retrieved', {
        accountType,
        refreshed: tokenResult.refreshed,
        expiresAt: tokenResult.expires_at
      });

      return tokenResult.access_token;

    } catch (error) {
      logger.error('Failed to get valid token', { accountType, error: error.message });
      throw error;
    }
  }

  /**
   * Make authenticated API request with retry logic and rate limiting
   * @param {string} endpoint - API endpoint (relative to baseUrl)
   * @param {Object} options - Request options
   * @param {boolean} isRetryAfter401 - Internal flag to prevent infinite 401 retry loops
   * @param {string} accountType - Account type for token retrieval
   * @returns {Promise<Object>} API response data
   */
  async makeRequest(endpoint, options = {}, isRetryAfter401 = false, accountType = 'primary') {
    const accessToken = await this.getAccessToken(accountType);
    if (!accessToken) {
      throw new Error(`No access token available for API request (account: ${accountType})`);
    }

    const {
      method = 'GET',
      headers = {},
      body = null,
      timeout = 30000
    } = options;

    const url = endpoint.startsWith('http') ? endpoint : `${this.config.baseUrl}${endpoint}`;

    let lastError;
    const timer = logger.startTimer(`API ${method} ${endpoint}`);

    // Rate limiting
    if (this.lastRequestTime) {
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.config.rateLimitInterval) {
        const delay = this.config.rateLimitInterval - timeSinceLastRequest;
        logger.debug('Rate limiting: waiting ' + delay + 'ms');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    this.lastRequestTime = Date.now();

    // Retry logic
    for (let attempt = 1; attempt <= this.config.retryConfig.maxRetries; attempt++) {
      try {
        logger.debug(`Making API request (attempt ${attempt})`, {
          method,
          url: url.length > 100 ? url.substring(0, 100) + '...' : url,
          accountType
        });

        const requestHeaders = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...headers
        };

        const fetchOptions = {
          method,
          headers: requestHeaders,
          signal: AbortSignal.timeout(timeout)
        };

        if (body) {
          fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);

        // Handle 401 Unauthorized - token expired or revoked
        if (response.status === 401 && !isRetryAfter401) {
          logger.warn('⚠️ Received 401 Unauthorized - attempting token refresh', { accountType });
          timer();

          // Get fresh token (forces new request to edge function)
          const freshToken = await this.getAccessToken(accountType);

          // Retry request with fresh token
          logger.debug('Retrying request with refreshed token');
          return await this.makeRequest(endpoint, options, true, accountType);
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const duration = timer();

        logger.success(`API request completed`, {
          method,
          endpoint,
          attempt,
          accountType,
          duration
        });

        return data;

      } catch (error) {
        lastError = error;

        logger.warn(`API request attempt ${attempt} failed`, {
          error: error.message,
          endpoint,
          accountType
        });

        // Don't retry if it's the last attempt
        if (attempt >= this.config.retryConfig.maxRetries) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          this.config.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.config.retryConfig.maxDelay
        );

        logger.debug(`Retrying after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries failed
    const duration = timer();
    logger.error(`All ${this.config.retryConfig.maxRetries} attempts failed`, {
      endpoint,
      accountType,
      totalDuration: duration,
      finalError: lastError.message
    });

    throw lastError;
  }

  /**
   * Get list of calendars
   * @param {string} accountType - Account type (e.g., 'primary', 'account2')
   * @returns {Promise<Array>} Array of calendar objects
   */
  async getCalendarList(accountType = 'primary') {
    logger.debug('Fetching calendar list', { accountType });
    const timer = logger.startTimer('Calendar List');

    try {
      const data = await this.makeRequest('/calendar/v3/users/me/calendarList', {}, false, accountType);
      const duration = timer();

      const calendars = data.items || [];

      logger.success('Calendar list retrieved', {
        accountType,
        totalCalendars: calendars.length,
        duration
      });

      return calendars;

    } catch (error) {
      timer();
      logger.error('Failed to fetch calendar list', { accountType, error: error.message });
      throw error;
    }
  }

  /**
   * Get calendar events for a specific calendar
   * @param {string} calendarId - Calendar ID
   * @param {Object} timeRange - Time range for events
   * @param {string} accountType - Account type (e.g., 'primary', 'account2')
   * @returns {Promise<Array>} Array of event objects
   */
  async getCalendarEvents(calendarId, timeRange = {}, accountType = 'primary') {
    logger.debug('Fetching calendar events', { calendarId, accountType });
    const timer = logger.startTimer('Calendar Events');

    try {
      const now = new Date();
      const timeMin = timeRange.start || new Date(now.getFullYear(), now.getMonth() - this.config.calendar.monthsBack, 1);
      const timeMax = timeRange.end || new Date(now.getFullYear(), now.getMonth() + this.config.calendar.monthsAhead + 1, 0);

      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: this.config.calendar.maxResults,
        singleEvents: 'true',
        orderBy: 'startTime'
      });

      const data = await this.makeRequest(`/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {}, false, accountType);
      const duration = timer();

      const events = data.items || [];

      logger.success('Calendar events retrieved', {
        calendarId,
        accountType,
        totalEvents: events.length,
        duration
      });

      return events;

    } catch (error) {
      timer();
      logger.error('Failed to fetch calendar events', { calendarId, accountType, error: error.message });
      throw error;
    }
  }
}
