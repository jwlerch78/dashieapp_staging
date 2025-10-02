// js/apis/google/google-client.js
// CHANGE SUMMARY: Replaced silent token fallback with explicit dependency check and fail-fast error handling

import { createLogger } from '../../utils/logger.js';
import { AUTH_CONFIG, API_CONFIG } from '../../auth/auth-config.js';

const logger = createLogger('GoogleAPIClient');

/**
 * Enhanced Google API client with structured logging and retry logic
 * Handles Calendar API and future Photos API integration
 * NOW with automatic refresh token support via JWT service
 */
export class GoogleAPIClient {
  constructor(authManager) {
    this.authManager = authManager;
    this.config = API_CONFIG.google;
    
    logger.info('Google API client initialized', {
      baseUrl: this.config.baseUrl,
      rateLimitInterval: this.config.rateLimitInterval
    });
  }

  /**
   * Wait for JWT service to be ready with timeout
   * @private
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<boolean>} True if JWT is ready
   * @throws {Error} If timeout reached or JWT never becomes ready
   */
  async _waitForJWTService(timeoutMs = 10000) {
    const startTime = Date.now();
    
    logger.debug('Waiting for JWT service to be ready...', { timeoutMs });
    
    while (Date.now() - startTime < timeoutMs) {
      if (window.jwtAuth && window.jwtAuth.isServiceReady()) {
        logger.success('JWT service is ready');
        return true;
      }
      
      // Check every 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`JWT service not ready after ${timeoutMs}ms timeout`);
  }

  /**
   * Get current Google access token - FAIL FAST approach
   * No silent fallbacks - either return valid token or throw clear error
   * @param {boolean} forceRefresh - Force token refresh, bypassing cache
   * @returns {Promise<string>} Access token
   * @throws {Error} If unable to obtain valid token
   */
  async getAccessToken(forceRefresh = false) {
    // CRITICAL: Wait for JWT service to be ready
    if (!window.jwtAuth || !window.jwtAuth.isServiceReady()) {
      logger.warn('JWT service not immediately available, waiting...');
      try {
        await this._waitForJWTService(10000);
      } catch (error) {
        logger.error('JWT service failed to become ready', error);
        throw new Error('JWT service not available - cannot obtain valid token. System may still be initializing.');
      }
    }

    // Force refresh if requested
    if (forceRefresh) {
      logger.info('🔄 Force refresh requested - invalidating token cache');
      if (window.jwtAuth.invalidateTokenCache) {
        await window.jwtAuth.invalidateTokenCache('google', 'personal');
      }
    }
    
    // Get token from JWT service
    logger.debug('Requesting token from JWT refresh token system');
    
    let result;
    try {
      result = await window.jwtAuth.getValidToken('google', 'personal');
    } catch (error) {
      logger.error('JWT token retrieval failed', error);
      throw new Error(`Failed to retrieve token from JWT service: ${error.message}`);
    }
    
    // Validate result
    if (!result) {
      throw new Error('JWT service returned null/undefined result');
    }
    
    if (!result.success) {
      throw new Error(`JWT service reported failure: ${result.error || 'Unknown error'}`);
    }
    
    if (!result.access_token) {
      throw new Error('JWT service returned success but no access_token provided');
    }
    
    // Success!
    if (result.refreshed || forceRefresh) {
      logger.success('✅ Token auto-refreshed via JWT system');
    } else {
      logger.debug('Using existing valid token from JWT system');
    }
    
    return result.access_token;
  }

  /**
   * Make authenticated API request with retry logic and rate limiting
   * ENHANCED: Now detects 401 errors and triggers token refresh before general retry logic
   * @param {string} endpoint - API endpoint (relative to baseUrl)
   * @param {Object} options - Request options
   * @param {boolean} isRetryAfter401 - Internal flag to prevent infinite 401 retry loops
   * @returns {Promise<Object>} API response data
   */
  async makeRequest(endpoint, options = {}, isRetryAfter401 = false) {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available for API request');
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
          url: url.length > 100 ? url.substring(0, 100) + '...' : url
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

        // NEW: Handle 401 Unauthorized specifically - token expired or revoked
        if (response.status === 401 && !isRetryAfter401) {
          logger.warn('⚠️ Received 401 Unauthorized - token expired or revoked');
          timer(); // Stop the timer
          
          try {
            logger.info('🔄 Attempting token refresh and retry');
            // Force a token refresh, bypassing cache
            const newToken = await this.getAccessToken(true);
            
            if (newToken) {
              logger.info('✅ Token refreshed, retrying request');
              // Retry the request once with the new token
              return await this.makeRequest(endpoint, options, true);
            } else {
              throw new Error('Failed to obtain refreshed token after 401 error');
            }
          } catch (refreshError) {
            logger.error('❌ Token refresh failed after 401', refreshError);
            throw new Error(`Authentication failed: ${refreshError.message}`);
          }
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
          duration
        });

        return data;

      } catch (error) {
        lastError = error;
        
        logger.warn(`API request attempt ${attempt} failed`, {
          error: error.message,
          endpoint
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
      totalDuration: duration,
      finalError: lastError.message
    });

    throw lastError;
  }

  /**
   * Get list of calendars
   * @returns {Promise<Array>} Array of calendar objects
   */
  async getCalendarList() {
    logger.debug('Fetching calendar list');
    const timer = logger.startTimer('Calendar List');

    try {
      const data = await this.makeRequest('/calendar/v3/users/me/calendarList');
      const duration = timer();

      const calendars = data.items || [];
      
      logger.success('Calendar list retrieved', {
        totalCalendars: calendars.length,
        duration
      });

      return calendars;

    } catch (error) {
      timer();
      logger.error('Failed to fetch calendar list', error);
      throw error;
    }
  }

  /**
   * Get calendar events for a specific calendar
   * @param {string} calendarId - Calendar ID
   * @param {Object} timeRange - Time range for events
   * @returns {Promise<Array>} Array of event objects
   */
  async getCalendarEvents(calendarId, timeRange = {}) {
    logger.debug('Fetching calendar events', { calendarId });
    const timer = logger.startTimer('Calendar Events');

    try {
      const now = new Date();
      const timeMin = timeRange.start || new Date(now.getFullYear(), now.getMonth() - this.config.calendar.monthsBack, 1);
      const timeMax = timeRange.end || new Date(now.getFullYear(), now.getMonth() + this.config.calendar.monthsAhead + 1, 0);

      const params = new URLSearchParams({
        calendarId: calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: this.config.calendar.maxResults,
        singleEvents: 'true',
        orderBy: 'startTime'
      });

      const data = await this.makeRequest(`/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
      const duration = timer();

      const events = data.items || [];
      
      logger.success('Calendar events retrieved', {
        calendarId,
        eventCount: events.length,
        duration
      });

      return events;

    } catch (error) {
      timer();
      logger.error('Failed to fetch calendar events', error);
      throw error;
    }
  }

  /**
   * Get all events from configured calendars
   * @param {Object} options - Options object
   * @param {Object} options.timeRange - Optional time range
   * @param {Array} options.calendars - Optional pre-fetched calendar list
   * @returns {Promise<Array>} Combined array of events from all calendars
   */
  async getAllCalendarEvents(options = {}) {
    const { timeRange = {}, calendars: providedCalendars = null } = options;
    
    logger.info('Fetching events from all configured calendars');
    const timer = logger.startTimer('All Calendar Events');

    try {
      // Get calendar list if not provided
      let calendars = providedCalendars;
      if (!calendars) {
        calendars = await this.getCalendarList();
      }

      // Filter to configured calendars
      const targetCalendars = calendars.filter(cal => 
        this.config.calendar.includeCalendars.some(target => 
          cal.summary?.includes(target) || cal.id?.includes(target)
        )
      );

      logger.debug('Fetching events from calendars', {
        totalCalendars: calendars.length,
        targetCalendars: targetCalendars.length,
        calendarNames: targetCalendars.map(c => c.summary)
      });

      // Fetch events from all target calendars in parallel
      // FIXED: Add calendarId to each event
      const eventPromises = targetCalendars.map(cal => 
        this.getCalendarEvents(cal.id, timeRange)
          .then(events => events.map(event => ({ 
            ...event, 
            calendarId: cal.id 
          })))
          .catch(error => {
            logger.warn(`Failed to fetch events for calendar ${cal.summary}`, error);
            return []; // Return empty array on error
          })
      );

      const eventArrays = await Promise.all(eventPromises);
      const allEvents = eventArrays.flat();

      const duration = timer();

      logger.success('All calendar events retrieved', {
        calendarCount: targetCalendars.length,
        totalEvents: allEvents.length,
        duration
      });

      return allEvents;

    } catch (error) {
      timer();
      logger.error('Failed to fetch all calendar events', error);
      throw error;
    }
  }

  /**
   * Test API access and connectivity
   * @returns {Promise<Object>} Test results
   */
  async testAccess() {
    logger.info('Testing Google API access');
    
    const results = {
      calendar: false,
      photos: false,
      tokenStatus: 'unknown',
      errors: [],
      details: {}
    };
    
    // Test Calendar API access
    try {
      logger.debug('Testing Calendar API access');
      const calendarStart = Date.now();
      const calendars = await this.getCalendarList();
      const calendarTime = Date.now() - calendarStart;
      
      results.calendar = true;
      results.tokenStatus = 'valid';
      results.details.calendar = {
        calendarsFound: calendars.length,
        responseTime: calendarTime,
        configuredCalendars: calendars.filter(cal => 
          this.config.calendar.includeCalendars.some(target => 
            cal.summary.includes(target) || cal.id.includes(target)
          )
        ).length
      };
      
      logger.success('Google Calendar API access confirmed', {
        calendarsFound: calendars.length,
        configuredCalendars: results.details.calendar.configuredCalendars,
        responseTime: calendarTime
      });
      
    } catch (error) {
      results.calendar = false;
      results.errors.push(`Calendar API: ${error.message}`);
      
      if (error.message.includes('401')) {
        results.tokenStatus = 'expired';
        logger.error('Google Calendar API: Token expired or invalid');
      } else {
        results.tokenStatus = 'error';
        logger.error('Google Calendar API access failed', error);
      }
    }
    
    // TODO: Test Photos API when implemented
    
    logger.info('API test complete', {
      calendar: results.calendar,
      photos: results.photos,
      tokenStatus: results.tokenStatus,
      errorCount: results.errors.length
    });
    
    return results;
  }

  /**
   * Health check for monitoring API status
   * @returns {Promise<Object>} Health check results
   */
  async healthCheck() {
    const start = Date.now();
    
    try {
      const testResults = await this.testAccess();
      const responseTime = Date.now() - start;
      
      return {
        status: testResults.calendar ? 'healthy' : 'degraded',
        responseTime,
        apis: {
          calendar: testResults.calendar,
          photos: testResults.photos
        },
        tokenStatus: testResults.tokenStatus,
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }
}