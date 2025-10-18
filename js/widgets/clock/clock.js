// widgets/clock/clock.js
// Clock widget with weather display
// Migrated from legacy (.legacy/widgets/clock/clock.html inline script)
// Minimal changes: extracted to external file, updated widget-ready protocol

import { createLogger } from '/js/utils/logger.js';
import { geocodeZipCodeCached } from '/js/utils/geocoding-helper.js';

const DEFAULT_THEME = 'dark'; // Local constant instead of importing from theme.js

const logger = createLogger('ClockWidget');

class ClockWidget {
  constructor() {
    this.currentTheme = null;

    // Default coordinates (Belleair, FL) - will be updated from settings zip code
    this.latitude = 27.9186;
    this.longitude = -82.8053;
    this.isLocationSet = false;

    // Weather update interval (starts when location is set)
    this.weatherInterval = null;

    // Weather icon mapping
    this.weatherIcons = {
      0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
      45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌧️',
      56: '🌧️', 57: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
      66: '❄️', 67: '❄️', 71: '❄️', 73: '❄️', 75: '❄️',
      80: '🌧️', 81: '🌧️', 82: '🌧️', 95: '⛈️', 96: '⛈️', 99: '⛈️'
    };

    this.init();
  }

  async init() {
    // Apply early theme detection
    this.detectAndApplyInitialTheme();

    // Set up event listeners
    this.setupEventListeners();

    // Note: Location will be set from settings via postMessage
    // Don't load weather until we have a location
    // (Default Belleair coords are just fallback, not for initial display)

    // Start clock updates only (no weather yet)
    this.updateTime();
    setInterval(() => this.updateTime(), 1000);

    // Weather will update when location is received via postMessage
  }

  // Detect initial theme from DOM or localStorage
  detectAndApplyInitialTheme() {
    let initialTheme = DEFAULT_THEME; // fallback

    // Try to detect theme from body class (applied by early theme loading)
    if (document.body.classList.contains('theme-light')) {
      initialTheme = 'light';
    } else if (document.body.classList.contains('theme-dark')) {
      initialTheme = 'dark';
    } else {
      // Fallback: try localStorage
      try {
        const savedTheme = localStorage.getItem('dashie-theme');
        if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light')) {
          initialTheme = savedTheme;
        }
      } catch (error) {
        logger.debug('Could not read theme from localStorage, using default');
      }
    }

    // Apply the detected theme immediately
    this.applyTheme(initialTheme);
  }

  setupEventListeners() {
    // Listen for widget-messenger communications
    window.addEventListener('message', (event) => {
      // Handle navigation commands (single action strings) - clock doesn't need navigation but keeping pattern
      if (event.data && typeof event.data.action === 'string' && !event.data.type) {
        this.handleCommand(event.data.action);
      }
      // Handle message objects with type
      if (event.data && event.data.type) {
        this.handleDataServiceMessage(event.data);
      }
      // Handle location updates from parent
      if (event.data && event.data.type === 'location-update' && event.data.payload) {
        this.handleLocationUpdate(event.data.payload);
      }
    });

    // Signal widget ready (UPDATED for Phase 3.5 WidgetDataManager protocol)
    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'event',
          widgetId: 'clock',
          payload: {
            eventType: 'widget-ready',
            data: { hasMenu: false }
          }
        }, '*');
      }
    });
  }

  // Handle navigation commands (clock widget doesn't need navigation but keeping pattern)
  handleCommand(action) {
    logger.debug('Clock widget received command', { action });

    // Clock widget doesn't have interactive navigation, but could be extended
    switch (action) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
      case 'select':
      case 'back':
        // No action needed for clock widget
        break;
      default:
        logger.debug('Unhandled command', { action });
        break;
    }
  }

  handleDataServiceMessage(data) {
    switch (data.type) {
      case 'widget-update':
        if (data.action === 'state-update') {
          // Check if this update contains anything relevant to clock widget
          const hasTheme = data.payload?.theme;

          // Only log if update is relevant
          if (hasTheme) {
            logger.debug('Processing relevant state update', { hasTheme });
          }

          // Apply theme from widget-update messages
          if (hasTheme) {
            this.applyTheme(data.payload.theme);
          }
        }
        break;

      case 'theme-change':
        this.applyTheme(data.theme);
        break;

      case 'location-update':
        this.handleLocationUpdate(data.payload);
        break;

      default:
        logger.debug('Unhandled message type', { type: data.type });
        break;
    }
  }

  /**
   * Initialize location from zip code
   * @param {string} zipCode - US zip code
   */
  async initializeLocationFromZip(zipCode) {
    if (!zipCode) {
      logger.warn('No zip code provided, using default location');
      return;
    }

    logger.debug('Initializing location from zip code', { zipCode });

    try {
      // FIRST: Check if we have cached coordinates from settings
      // This avoids the Nominatim API call entirely
      let coords = null;

      // Try to get cached coordinates from parent settings
      if (window.parent?.settingsInstance?.controller) {
        const latitude = window.parent.settingsInstance.controller.getSetting('family.latitude');
        const longitude = window.parent.settingsInstance.controller.getSetting('family.longitude');

        if (latitude && longitude) {
          coords = { latitude, longitude };
          logger.info('Using cached coordinates from settings', { zipCode, ...coords });
        }
      }

      // FALLBACK: If no cached coords, try geocoding (may fail on Fire TV)
      if (!coords) {
        logger.debug('No cached coordinates, attempting to geocode', { zipCode });

        coords = await geocodeZipCodeCached(zipCode);

        if (coords) {
          logger.info('Zip code geocoded successfully', { zipCode, ...coords });
        }
      }

      // Use coords if we have them
      if (coords) {
        this.latitude = coords.latitude;
        this.longitude = coords.longitude;
        this.isLocationSet = true;

        logger.debug('Location set from zip code', {
          zipCode,
          latitude: this.latitude,
          longitude: this.longitude
        });
      } else {
        logger.warn('Failed to get coordinates, using default location', { zipCode });
      }

    } catch (error) {
      logger.error('Error initializing location from zip code', {
        zipCode,
        error: error.message
      });
    }
  }

  /**
   * Handle location updates from parent (for future settings integration)
   * @param {Object} payload - { zipCode: string } or { latitude: number, longitude: number }
   */
  async handleLocationUpdate(payload) {
    logger.debug('Received location update', payload);

    // Support both zip code and direct coordinates
    if (payload.zipCode) {
      await this.initializeLocationFromZip(payload.zipCode);
      // Immediately update weather with new location
      this.updateWeather();
      // Start periodic weather updates (every 10 minutes)
      if (!this.weatherInterval) {
        this.weatherInterval = setInterval(() => this.updateWeather(), 600000);
      }
    } else if (payload.latitude && payload.longitude) {
      this.latitude = payload.latitude;
      this.longitude = payload.longitude;
      this.isLocationSet = true;

      logger.debug('Location updated from coordinates', {
        latitude: this.latitude,
        longitude: this.longitude
      });

      // Immediately update weather with new location
      this.updateWeather();
      // Start periodic weather updates (every 10 minutes)
      if (!this.weatherInterval) {
        this.weatherInterval = setInterval(() => this.updateWeather(), 600000);
      }
    }
  }

  // FIXED: Only apply theme if it actually changed
  applyTheme(theme) {
    // Skip if theme hasn't changed - prevents redundant applications
    if (this.currentTheme === theme) {
      return;
    }

    const previousTheme = this.currentTheme;
    this.currentTheme = theme;

    // Remove any existing theme classes
    document.body.classList.remove('theme-dark', 'theme-light');

    // Apply new theme class
    document.body.classList.add(`theme-${theme}`);
  }

  updateTime() {
    try {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;

      const timeString = `${hours}:${minutes} ${ampm}`;
      document.getElementById('time').textContent = timeString;

      // Log time update only once per minute to avoid spam
      const seconds = now.getSeconds();
      if (seconds === 0) {
        logger.debug('Time updated', { time: timeString });
      }
    } catch (error) {
      logger.error('Failed to update time', { error: error.message });
    }
  }

  async updateWeather() {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.latitude}&longitude=${this.longitude}&current_weather=true&temperature_unit=fahrenheit`;

    try {
      logger.debug('Fetching weather data');
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const weatherCode = data.current_weather?.weathercode;
      const temp = Math.round(data.current_weather?.temperature);

      if (typeof temp === 'number' && !isNaN(temp)) {
        document.getElementById('temperature').textContent = `${temp}°F`;
        document.getElementById('weather-icon').textContent = this.weatherIcons[weatherCode] || '🌡️';

        logger.debug('Weather updated successfully', {
          temperature: temp,
          weatherCode,
          icon: this.weatherIcons[weatherCode] || '🌡️'
        });
      } else {
        throw new Error('Invalid temperature data received');
      }

    } catch (error) {
      logger.error('Weather fetch error', {
        error: error.message,
        url: url.split('?')[0] // Log URL without query params for privacy
      });

      // Set fallback display
      document.getElementById('temperature').textContent = '--°F';
      document.getElementById('weather-icon').textContent = '🌡️';
    }
  }
}

// Initialize the widget
new ClockWidget();
