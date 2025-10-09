// js/apis/google/google-client.js
// CHANGE SUMMARY: FIXED - Added support for dynamic calendar IDs from settings instead of hardcoded config

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
 * NOW SUPPORTS MULTI-ACCOUNT: Specify accountType to get tokens for different accounts
 * @param {boolean} forceRefresh - Force token refresh, bypassing cache
 * @param {string} accountType - Account type (e.g., 'primary', 'account2', 'account3')
 * @returns {Promise<string>} Access token
 * @throws {Error} If unable to obtain valid token
 */
async getAccessToken(forceRefresh = false, accountType = 'primary') {
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
    logger.info('🔄 Force refresh requested - invalidating token cache', { accountType });
    if (window.jwtAuth.invalidateTokenCache) {
      await window.jwtAuth.invalidateTokenCache('google', accountType);
    }
  }
  
  // Get token from JWT service FOR SPECIFIC ACCOUNT
  logger.debug('Requesting token from JWT refresh token system', { accountType });
  
  let result;
  try {
    result = await window.jwtAuth.getValidToken('google', accountType);
  } catch (error) {
    logger.error('JWT token retrieval failed', { accountType, error: error.message });
    throw new Error(`Failed to retrieve token from JWT service for account '${accountType}': ${error.message}`);
  }
  
  // Validate result
  if (!result) {
    throw new Error(`JWT service returned null/undefined result for account '${accountType}'`);
  }
  
  if (!result.success) {
    throw new Error(`JWT service reported failure for account '${accountType}': ${result.error || 'Unknown error'}`);
  }
  
  if (!result.access_token) {
    throw new Error(`JWT service returned success but no access_token provided for account '${accountType}'`);
  }
  
  // Success!
  if (result.refreshed || forceRefresh) {
    logger.success('✅ Token auto-refreshed via JWT system', { accountType });
  } else {
    logger.debug('Using existing valid token from JWT system', { accountType });
  }
  
  return result.access_token;
}

 /**
 * Make authenticated API request with retry logic and rate limiting
 * NOW SUPPORTS MULTI-ACCOUNT: Pass accountType to use specific account's token
 * @param {string} endpoint - API endpoint (relative to baseUrl)
 * @param {Object} options - Request options
 * @param {boolean} isRetryAfter401 - Internal flag to prevent infinite 401 retry loops
 * @param {string} accountType - Account type for token retrieval
 * @returns {Promise<Object>} API response data
 */
async makeRequest(endpoint, options = {}, isRetryAfter401 = false, accountType = 'primary') {
  const accessToken = await this.getAccessToken(false, accountType);
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
        logger.warn('⚠️ Received 401 Unauthorized - token expired or revoked', { accountType });
        timer();
        
        try {
          logger.info('🔄 Attempting token refresh and retry', { accountType });
          // Force a token refresh for this specific account
          const newToken = await this.getAccessToken(true, accountType);
          
          if (newToken) {
            logger.info('✅ Token refreshed, retrying request', { accountType });
            // Retry the request once with the new token
            return await this.makeRequest(endpoint, options, true, accountType);
          } else {
            throw new Error(`Failed to obtain refreshed token after 401 error for account '${accountType}'`);
          }
        } catch (refreshError) {
          logger.error('❌ Token refresh failed after 401', { accountType, error: refreshError.message });
          throw new Error(`Authentication failed for account '${accountType}': ${refreshError.message}`);
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
 * NOW SUPPORTS MULTI-ACCOUNT: Specify accountType to get calendars for different accounts
 * @param {string} accountType - Account type (e.g., 'primary', 'account2', 'account3')
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
 * NOW SUPPORTS MULTI-ACCOUNT: Specify accountType to use correct account's token
 * @param {string} calendarId - Calendar ID
 * @param {Object} timeRange - Time range for events
 * @param {string} accountType - Account type (e.g., 'primary', 'account2', 'account3')
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

 /**
 * Get all events from configured calendars
 * UPDATED: Now uses calendarAccountMap to fetch events from multiple accounts with correct tokens
 * @param {Object} options - Options object
 * @param {Object} options.timeRange - Optional time range
 * @param {Array} options.calendars - Optional pre-fetched calendar list (DEPRECATED - no longer used)
 * @returns {Promise<Array>} Combined array of events from all calendars
 */
async getAllCalendarEvents(options = {}) {
  const { timeRange = {} } = options;
  
  logger.info('Fetching events from all configured calendars (multi-account)');
  const timer = logger.startTimer('All Calendar Events');

  try {
    // Get calendar settings from localStorage
    const localStorage = window.parent?.localStorage || window.localStorage;
    const calendarSettings = localStorage.getItem('dashie_calendar_settings');
    
    if (!calendarSettings) {
      logger.warn('No calendar settings found');
      const duration = timer();
      return [];
    }

    let settings;
    try {
      settings = JSON.parse(calendarSettings);
    } catch (error) {
      logger.error('Failed to parse calendar settings', error);
      const duration = timer();
      return [];
    }

    const activeCalendarIds = settings.activeCalendarIds || [];
    const calendarAccountMap = settings.calendarAccountMap || {};
    
    logger.debug('Loaded calendar configuration', { 
      activeCalendarCount: activeCalendarIds.length,
      accountMappings: Object.keys(calendarAccountMap).length,
      activeCalendarIds: activeCalendarIds,
      calendarAccountMap: calendarAccountMap
    });

    // If no calendars are selected, return empty array
    if (activeCalendarIds.length === 0) {
      logger.info('No active calendars selected - returning empty event list');
      const duration = timer();
      return [];
    }

    // Group calendars by account for efficient batch fetching
    const calendarsByAccount = {};
    
    for (const calendarId of activeCalendarIds) {
      const accountType = calendarAccountMap[calendarId] || 'primary';
      
      if (!calendarsByAccount[accountType]) {
        calendarsByAccount[accountType] = [];
      }
      
      calendarsByAccount[accountType].push(calendarId);
    }

    logger.debug('Grouped calendars by account', {
      accounts: Object.keys(calendarsByAccount),
      distribution: Object.entries(calendarsByAccount).map(([account, cals]) => 
        `${account}: ${cals.length} calendars`
      )
    });

    // Fetch events from each account's calendars in parallel
    const accountPromises = Object.entries(calendarsByAccount).map(async ([accountType, calendarIds]) => {
      logger.debug(`Fetching events for ${calendarIds.length} calendars from account: ${accountType}`);
      
      // Fetch events for all calendars in this account in parallel
      const eventPromises = calendarIds.map(calendarId => 
        this.getCalendarEvents(calendarId, timeRange, accountType)
          .then(events => events.map(event => ({ 
            ...event, 
            calendarId: calendarId,
            accountType: accountType  // Tag events with their source account
          })))
          .catch(error => {
            logger.warn(`Failed to fetch events for calendar ${calendarId} from account ${accountType}`, error);
            return []; // Return empty array on error
          })
      );

      return Promise.all(eventPromises);
    });

    // Wait for all accounts to complete
    const accountResults = await Promise.all(accountPromises);
    
    // Flatten: accountResults is array of arrays of arrays
    // [[account1 events], [account2 events], ...] -> [all events]
    const allEvents = accountResults.flat(2);

    const duration = timer();

    // Log summary by account
    const eventsByAccount = {};
    for (const event of allEvents) {
      const account = event.accountType || 'unknown';
      eventsByAccount[account] = (eventsByAccount[account] || 0) + 1;
    }

    logger.success('All calendar events retrieved (multi-account)', {
      totalCalendars: activeCalendarIds.length,
      totalAccounts: Object.keys(calendarsByAccount).length,
      totalEvents: allEvents.length,
      eventsByAccount: eventsByAccount,
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