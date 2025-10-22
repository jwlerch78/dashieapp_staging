// js/data/services/weather-service.js
// Weather service for fetching weather data with caching
// Extracted from clock widget for proper service architecture

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('WeatherService');

/**
 * WeatherService - Fetch and cache weather data
 *
 * Features:
 * - Zip code to coordinates conversion (Nominatim API)
 * - Weather data fetching (Open-Meteo API)
 * - Caching to reduce API calls
 * - Temperature and weather code mapping
 *
 * APIs Used:
 * - Nominatim (OpenStreetMap) for geocoding
 * - Open-Meteo for weather data
 */
export class WeatherService {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache
    this.isInitialized = false;

    // Weather icon mapping (from clock widget)
    this.weatherIcons = {
      0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
      45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌧️',
      56: '🌧️', 57: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
      66: '🌨️', 67: '🌨️', 71: '🌨️', 73: '🌨️', 75: '🌨️',
      77: '🌨️', 80: '🌦️', 81: '🌦️', 82: '🌧️', 85: '🌨️',
      86: '🌨️', 95: '⛈️', 96: '⛈️', 99: '⛈️'
    };

    logger.verbose('WeatherService constructed');
  }

  /**
   * Initialize the weather service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;
    logger.success('WeatherService initialized');
  }

  // =========================================================================
  // WEATHER FETCHING
  // =========================================================================

  /**
   * Get weather data for a zip code
   * This is the main entry point
   *
   * @param {string} zipCode - US zip code
   * @returns {Promise<Object>} Weather data {temperature, weatherCode, icon, coordinates}
   */
  async getWeatherForZipCode(zipCode) {
    if (!zipCode) {
      throw new Error('Zip code is required');
    }

    try {
      logger.debug('Getting weather for zip code', { zipCode });

      // Check cache first
      const cacheKey = `weather-${zipCode}`;
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        logger.debug('Weather data from cache', { zipCode });
        return cached;
      }

      // Step 1: Convert zip code to coordinates
      const coords = await this.zipToCoordinates(zipCode);

      // Step 2: Fetch weather for coordinates
      const weatherData = await this.getWeatherForCoordinates(coords.latitude, coords.longitude);

      // Add coordinates to weather data
      const result = {
        ...weatherData,
        coordinates: coords
      };

      // Cache the result
      this._setCache(cacheKey, result);

      logger.success('Weather data fetched', {
        zipCode,
        temperature: result.temperature,
        weatherCode: result.weatherCode
      });

      return result;

    } catch (error) {
      logger.error('Failed to get weather for zip code', { zipCode, error });
      throw error;
    }
  }

  /**
   * Get weather data for coordinates
   *
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<Object>} Weather data {temperature, weatherCode, icon}
   */
  async getWeatherForCoordinates(latitude, longitude) {
    try {
      logger.debug('Fetching weather for coordinates', { latitude, longitude });

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Weather API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const weatherCode = data.current_weather?.weathercode;
      const temp = Math.round(data.current_weather?.temperature);

      if (typeof temp !== 'number' || isNaN(temp)) {
        throw new Error('Invalid temperature data received');
      }

      const result = {
        temperature: temp,
        weatherCode: weatherCode,
        icon: this.weatherIcons[weatherCode] || '🌡️',
        timestamp: Date.now()
      };

      logger.debug('Weather data fetched successfully', result);
      return result;

    } catch (error) {
      logger.error('Failed to fetch weather data', { latitude, longitude, error });
      throw error;
    }
  }

  // =========================================================================
  // GEOCODING (Zip Code → Coordinates)
  // =========================================================================

  /**
   * Convert US zip code to coordinates using Nominatim API
   *
   * @param {string} zipCode - US zip code
   * @returns {Promise<Object>} Coordinates {latitude, longitude, displayName}
   */
  async zipToCoordinates(zipCode) {
    try {
      logger.debug('Converting zip to coordinates', { zipCode });

      // Check cache first
      const cacheKey = `coords-${zipCode}`;
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        logger.debug('Coordinates from cache', { zipCode });
        return cached;
      }

      // Fetch from Nominatim API
      const url = `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=US&format=json&limit=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DashieApp/1.0' // Required by Nominatim
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error(`No results found for zip code: ${zipCode}`);
      }

      const result = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };

      // Cache coordinates for 24 hours (they don't change)
      this._setCache(cacheKey, result, 24 * 60 * 60 * 1000);

      logger.success('Coordinates fetched', {
        zipCode,
        latitude: result.latitude,
        longitude: result.longitude
      });

      return result;

    } catch (error) {
      logger.error('Failed to convert zip to coordinates', { zipCode, error });
      throw error;
    }
  }

  // =========================================================================
  // CACHE MANAGEMENT
  // =========================================================================

  /**
   * Get data from cache if not expired
   * @private
   */
  _getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      // Expired
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set data in cache with TTL
   * @private
   */
  _setCache(key, data, ttl = this.CACHE_TTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    logger.debug('Data cached', { key, ttl: `${ttl / 1000}s` });
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
    logger.info('Weather cache cleared');
  }

  /**
   * Clear cache for specific zip code
   */
  clearCacheForZipCode(zipCode) {
    this.cache.delete(`weather-${zipCode}`);
    this.cache.delete(`coords-${zipCode}`);
    logger.debug('Cache cleared for zip code', { zipCode });
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  /**
   * Get weather icon for weather code
   */
  getWeatherIcon(weatherCode) {
    return this.weatherIcons[weatherCode] || '🌡️';
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
let weatherServiceInstance = null;

/**
 * Initialize the weather service singleton
 *
 * @returns {WeatherService}
 */
export function initializeWeatherService() {
  if (!weatherServiceInstance) {
    weatherServiceInstance = new WeatherService();
    weatherServiceInstance.initialize();
    logger.verbose('WeatherService singleton initialized');
  }
  return weatherServiceInstance;
}

/**
 * Get the weather service singleton
 *
 * @returns {WeatherService}
 * @throws {Error} If service not initialized
 */
export function getWeatherService() {
  if (!weatherServiceInstance) {
    throw new Error('WeatherService not initialized. Call initializeWeatherService() first.');
  }
  return weatherServiceInstance;
}
