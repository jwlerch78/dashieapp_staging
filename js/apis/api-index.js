// js/apis/api-index.js - Centralized API Layer Entry Point
// CHANGE SUMMARY: New centralized API exports for the reorganized API structure

import { createLogger } from '../utils/logger.js';
import { GoogleAPIClient } from './google/google-client.js';

const logger = createLogger('APIIndex');

/**
 * Centralized API layer entry point
 * Provides access to all API clients and services
 */

/**
 * Initialize and configure all API clients
 * @param {Object} authManager - Auth manager instance for token management
 * @returns {Object} Initialized API clients
 */
export function initializeAPIs(authManager) {
  logger.info('Initializing API layer');
  
  const apis = {
    // Google APIs
    google: new GoogleAPIClient(authManager),
    
    // Future API clients will be added here
    // weather: new WeatherAPIClient(),
    // maps: new MapsAPIClient(),
    // spotify: new SpotifyAPIClient()
  };
  
  logger.success('API layer initialized', {
    availableAPIs: Object.keys(apis)
  });
  
  return apis;
}

/**
 * Test all available APIs
 * @param {Object} apis - Initialized API clients
 * @returns {Promise<Object>} Test results for all APIs
 */
export async function testAllAPIs(apis) {
  logger.info('Testing all API clients');
  
  const results = {};
  
  // Test Google APIs
  if (apis.google) {
    try {
      results.google = await apis.google.testAccess();
      logger.success('Google API test completed', results.google);
    } catch (error) {
      logger.error('Google API test failed', error);
      results.google = { error: error.message };
    }
  }
  
  // Future API tests will be added here
  
  logger.info('API testing complete', {
    testedAPIs: Object.keys(results),
    successfulAPIs: Object.keys(results).filter(api => !results[api].error)
  });
  
  return results;
}

/**
 * Get health status of all APIs
 * @param {Object} apis - Initialized API clients  
 * @returns {Promise<Object>} Health check results
 */
export async function getAPIHealth(apis) {
  logger.debug('Checking API health');
  
  const health = {
    timestamp: new Date().toISOString(),
    apis: {}
  };
  
  // Check Google API health
  if (apis.google) {
    try {
      health.apis.google = await apis.google.healthCheck();
    } catch (error) {
      health.apis.google = {
        status: 'error',
        error: error.message
      };
    }
  }
  
  // Calculate overall health
  const apiStatuses = Object.values(health.apis).map(api => api.status);
  const healthyCount = apiStatuses.filter(status => status === 'healthy').length;
  const totalCount = apiStatuses.length;
  
  if (healthyCount === totalCount) {
    health.overall = 'healthy';
  } else if (healthyCount > 0) {
    health.overall = 'degraded';
  } else {
    health.overall = 'unhealthy';
  }
  
  logger.debug('API health check complete', {
    overall: health.overall,
    healthy: healthyCount,
    total: totalCount
  });
  
  return health;
}

// Export individual API clients for direct import
export { GoogleAPIClient };

// Future API client exports will be added here:
// export { WeatherAPIClient } from './weather/weather-client.js';
// export { MapsAPIClient } from './maps/maps-client.js';
// export { SpotifyAPIClient } from './spotify/spotify-client.js';

// Export API types/constants for reference
export const API_TYPES = {
  GOOGLE: 'google',
  WEATHER: 'weather',
  MAPS: 'maps', 
  SPOTIFY: 'spotify'
};

export const API_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  ERROR: 'error'
};

// Default export for convenience
export default {
  initializeAPIs,
  testAllAPIs,
  getAPIHealth,
  GoogleAPIClient,
  API_TYPES,
  API_STATUS
};
