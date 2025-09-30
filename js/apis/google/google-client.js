// js/apis/google/google-client.js
// CHANGE SUMMARY: Added refresh token support via window.jwtAuth with automatic fallback to session tokens

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
   * Get current Google access token from auth manager
   * ENHANCED: Now tries refresh token system first before falling back to session token
   * @returns {Promise<string|null>} Access token
   */
  async getAccessToken() {
    // NEW: Try refresh token system first if available
    if (window.jwtAuth && window.jwtAuth.isServiceReady()) {
      try {
        logger.debug('Attempting to get token via JWT refresh token system');
        const result = await window.jwtAuth.getValidToken('google', 'personal');
        
        if (result && result.success && result.access_token) {
          if (result.refreshed) {
            logger.success('✅ Token auto-refreshed via JWT system');
          } else {
            logger.debug('Using existing valid token from JWT system');
          }
          return result.access_token;
        }
      } catch (error) {
        logger.warn('⚠️ JWT refresh token system failed, falling back to session token', error);
      }
    }

    // FALLBACK: Use existing session token method
    if (!this.authManager) {
      logger.warn('No auth manager available for token');
      return null;
    }

    const token = this.authManager.getGoogleAccessToken();
    if (!token) {
      logger.warn('No Google access token available');
      return null;
    }

    logger.debug('Using session token from auth manager');
    return token;
  }

  /**
   * Make authenticated API request with retry logic and rate limiting
   * @param {string} endpoint - API endpoint (relative to baseUrl)
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response data
   */
  async makeRequest(endpoint, options = {}) {
    const accessToken = await this.getAccessToken(); // NOW async!
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
    timer();
    logger.error('API request failed after all retries', lastError);
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
   * @param {Object} timeRange - Optional time range
   * @param {Array} calendars - Optional pre-fetched calendar list
   * @returns {Promise<Array>} Combined array of events from all calendars
   */
  async getAllCalendarEvents(timeRange = {}, calendars = null) {
    logger.info('Fetching events from all configured calendars');
    const timer = logger.startTimer('All Calendar Events');

    try {
      // Get calendar list if not provided
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
      const eventPromises = targetCalendars.map(cal => 
        this.getCalendarEvents(cal.id, timeRange)
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