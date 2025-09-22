// js/apis/google/google-client.js - Optimized Google API Client
// CHANGE SUMMARY: Added optional calendars parameter to getAllCalendarEvents to avoid redundant getCalendarList calls

import { createLogger } from '../../utils/logger.js';
import { AUTH_CONFIG, API_CONFIG } from '../../auth/auth-config.js';

const logger = createLogger('GoogleAPIClient');

/**
 * Enhanced Google API client with structured logging and retry logic
 * Handles Calendar API and future Photos API integration
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
   * @returns {string|null} Access token
   */
  getAccessToken() {
    if (!this.authManager) {
      logger.warn('No auth manager available for token');
      return null;
    }

    const token = this.authManager.getGoogleAccessToken();
    if (!token) {
      logger.warn('No Google access token available');
      return null;
    }

    return token;
  }

  /**
   * Make authenticated API request with retry logic and rate limiting
   * @param {string} endpoint - API endpoint (relative to baseUrl)
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response data
   */
  async makeRequest(endpoint, options = {}) {
    const accessToken = this.getAccessToken();
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
          url: url.length > 100 ? url.substring(0, 100) + '...' : url,
          attempt,
          maxAttempts: this.config.retryConfig.maxRetries
        });

        const requestHeaders = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...headers
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : null,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const duration = timer();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        logger.success(`API ${method} ${endpoint} - ${response.status} (${duration}ms)`);
        
        return data;

      } catch (error) {
        lastError = error;
        
        // Determine if error is retryable
        const isRetryable = 
          error.name === 'TypeError' || // Network errors
          error.name === 'AbortError' || // Timeout
          (error.message.includes('HTTP 5')) || // Server errors
          (error.message.includes('HTTP 429')); // Rate limiting

        logger.error(`API request failed (attempt ${attempt})`, {
          method,
          endpoint,
          error: error.message,
          status: error.status,
          isRetryable,
          finalAttempt: attempt === this.config.retryConfig.maxRetries
        });

        // Don't retry on final attempt or non-retryable errors
        if (attempt === this.config.retryConfig.maxRetries || !isRetryable) {
          logger.error(`API request failed permanently`, {
            method,
            endpoint,
            finalAttempt: attempt,
            status: error.status,
            isRetryable,
            finalAttempt: attempt === this.config.retryConfig.maxRetries
          });
          break;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          this.config.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.config.retryConfig.maxDelay
        );

        logger.warn(`API request failed, retrying in ${delay}ms`, {
          method,
          endpoint,
          attempt,
          error: error.message,
          retryDelay: delay
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // If we get here, all retries failed
    timer(); // Complete timing
    throw lastError || new Error('All API request attempts failed');
  }

  // ==================== CALENDAR API METHODS ====================

  /**
   * Get list of user's calendars
   * @returns {Promise<Array>} Array of calendar objects
   */
  async getCalendarList() {
    logger.info('Fetching calendar list');
    
    try {
      const data = await this.makeRequest('/calendar/v3/users/me/calendarList');
      const calendars = data.items || [];
      
      logger.success(`Found ${calendars.length} calendars`);
      
      return calendars.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description || '',
        primary: cal.primary || false,
        accessRole: cal.accessRole,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor
      }));
      
    } catch (error) {
      logger.error('Failed to fetch calendar list', error);
      throw new Error(`Calendar list fetch failed: ${error.message}`);
    }
  }

  /**
   * Get events from a specific calendar
   * @param {string} calendarId - Calendar ID
   * @param {string} timeMin - Start time (ISO string)
   * @param {string} timeMax - End time (ISO string)
   * @returns {Promise<Array>} Array of event objects
   */
  async getCalendarEvents(calendarId, timeMin = null, timeMax = null) {
    logger.debug(`Fetching events from calendar: ${calendarId}`);
    
    const now = new Date();
    const defaultTimeMin = timeMin || new Date(
      now.getTime() - (this.config.calendar.monthsBack * 30 * 24 * 60 * 60 * 1000)
    ).toISOString();
    const defaultTimeMax = timeMax || new Date(
      now.getTime() + (this.config.calendar.monthsAhead * 30 * 24 * 60 * 60 * 1000)
    ).toISOString();

    const params = new URLSearchParams({
      timeMin: defaultTimeMin,
      timeMax: defaultTimeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: this.config.calendar.maxResults.toString()
    });
    
    try {
      const data = await this.makeRequest(
        `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`
      );
      
      const events = data.items || [];
      logger.debug(`Found ${events.length} events in calendar ${calendarId}`);
      
      return events.map(event => ({
        id: event.id,
        summary: event.summary || 'No title',
        description: event.description || '',
        start: event.start,
        end: event.end,
        location: event.location || '',
        attendees: event.attendees || [],
        calendarId: calendarId
      }));
      
    } catch (error) {
      logger.error(`Failed to fetch events from calendar ${calendarId}`, error);
      throw new Error(`Calendar events fetch failed: ${error.message}`);
    }
  }

  /**
   * Get events from all configured calendars
   * @param {Object} options - Optional configuration
   * @param {Array} options.calendars - Pre-fetched calendar list (to avoid redundant API call)
   * @param {Object} options.timeRange - Optional time range override
   * @returns {Promise<Array>} Array of all events sorted by start time
   */
  async getAllCalendarEvents(options = {}) {
    logger.info('Fetching events from all configured calendars');
    
    try {
      // Use provided calendars list or fetch it
      let calendars = options.calendars;
      if (!calendars) {
        logger.debug('No calendar list provided, fetching from API');
        calendars = await this.getCalendarList();
      } else {
        logger.debug('Using provided calendar list to avoid redundant API call');
      }
      
      // Filter to configured calendars
      const targetCalendars = calendars.filter(cal => 
        this.config.calendar.includeCalendars.some(target => 
          cal.summary.includes(target) || cal.id.includes(target)
        )
      );
      
      logger.info(`Fetching from ${targetCalendars.length} configured calendars`, {
        calendars: targetCalendars.map(cal => cal.summary)
      });
      
      // Fetch events from each calendar concurrently
      const eventPromises = targetCalendars.map(async calendar => {
        try {
          return await this.getCalendarEvents(
            calendar.id, 
            options.timeRange?.timeMin, 
            options.timeRange?.timeMax
          );
        } catch (error) {
          logger.warn(`Failed to fetch from calendar ${calendar.summary}`, error);
          return []; // Continue with other calendars
        }
      });

      const eventArrays = await Promise.all(eventPromises);
      const allEvents = eventArrays.flat();
      
      // Sort all events by start time
      allEvents.sort((a, b) => {
        const aStart = new Date(a.start.dateTime || a.start.date);
        const bStart = new Date(b.start.dateTime || b.start.date);
        return aStart - bStart;
      });
      
      logger.success(`Total events fetched: ${allEvents.length}`);
      return allEvents;
      
    } catch (error) {
      logger.error('Failed to fetch all calendar events', error);
      throw new Error(`All calendar events fetch failed: ${error.message}`);
    }
  }

  // ==================== FUTURE: PHOTOS API METHODS ====================
  // These methods will be implemented when Photos API integration is added

  /**
   * Get photo albums (placeholder for future implementation)
   * @returns {Promise<Array>} Array of album objects
   */
  async getPhotoAlbums() {
    logger.warn('Photos API not yet implemented');
    return [];
  }

  /**
   * Get recent photos (placeholder for future implementation) 
   * @param {number} count - Number of photos to fetch
   * @returns {Promise<Array>} Array of photo objects
   */
  async getRecentPhotos(count = 10) {
    logger.warn('Photos API not yet implemented');
    return [];
  }

  // ==================== TESTING & HEALTH CHECK METHODS ====================

  /**
   * Test API access and return capabilities
   * @returns {Promise<Object>} Test results object
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
      
      if (error.status === 401) {
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