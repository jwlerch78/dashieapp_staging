// widgets/header/header.js
// Header widget - displays family name/greeting
// v2.1 - 10/20/25 - Improved theme detection robustness

import { createLogger } from '/js/utils/logger.js';
import { getGreeting, getAllGreetings, getStaticGreeting } from '/js/services/greeting-service.js';
import { detectCurrentTheme, applyThemeToWidget } from '/js/widgets/shared/widget-theme-detector.js';

const DEFAULT_THEME = 'dark'; // Local constant
const GREETING_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const logger = createLogger('HeaderWidget');

class HeaderWidget {
  constructor() {
    this.currentTheme = null;
    this.currentFamilyName = 'The Dashie Family';
    this.baseFamilyName = 'Dashie'; // Family name without "The" and "Family"
    this.dynamicGreetingEnabled = false;
    this.greetingRefreshInterval = null;
    this.greetingVariations = []; // Store multiple greeting options
    this.currentVariationIndex = 0; // Track which variation is showing

    this.init();
  }

  init() {
    // Apply early theme detection
    this.detectAndApplyInitialTheme();

    // Set up event listeners
    this.setupEventListeners();

    // Load initial family name and settings
    this.loadInitialSettings();

    // Start greeting refresh interval
    this.startGreetingRefresh();

    logger.info('Header widget initialized with dynamic greeting support');
  }

  // Detect initial theme from parent window or localStorage
  detectAndApplyInitialTheme() {
    const initialTheme = detectCurrentTheme(DEFAULT_THEME);
    logger.debug('Initial theme detected', { theme: initialTheme });
    this.applyTheme(initialTheme);
  }

  setupEventListeners() {
    // Listen for widget-messenger communications
    window.addEventListener('message', (event) => {
      if (event.data && typeof event.data.action === 'string' && !event.data.type) {
        this.handleCommand(event.data.action);
      }
      if (event.data && event.data.type) {
        this.handleDataServiceMessage(event.data);
      }
    });

    // Signal widget ready (UPDATED for Phase 3.5 protocol)
    window.addEventListener('load', () => {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'event',
          widgetId: 'header',
          payload: {
            eventType: 'widget-ready',
            data: { hasMenu: false }
          }
        }, '*');
      }
    });

    // Listen for click on family name (cycles through greetings if dynamic mode enabled)
    const familyNameElement = document.getElementById('family-name');
    if (familyNameElement) {
      familyNameElement.addEventListener('click', () => {
        if (this.dynamicGreetingEnabled && this.greetingVariations.length > 0) {
          this.cycleGreeting();
        }
      });
    }
  }

  handleCommand(action) {
    logger.debug('Header widget received command', { action });
    // Header doesn't need navigation for now
  }

  handleDataServiceMessage(data) {
    switch (data.type) {
      case 'widget-update':
      case 'data':
        if (data.action === 'state-update') {
          const hasFamilyName = data.payload?.settings?.['family.familyName'];
          const hasTheme = data.payload?.theme;
          const hasDynamicGreeting = data.payload?.settings?.['interface.dynamicGreeting'] !== undefined;

          if (hasFamilyName) {
            this.updateFamilyName(data.payload.settings['family.familyName']);
          }

          if (hasTheme) {
            this.applyTheme(data.payload.theme);
          }

          if (hasDynamicGreeting) {
            this.dynamicGreetingEnabled = data.payload.settings['interface.dynamicGreeting'] === true;
            logger.debug('Dynamic greeting setting changed', { enabled: this.dynamicGreetingEnabled });
            // Re-render family name with new setting
            this.renderFamilyName();
          }
        }
        break;

      case 'theme-change':
        this.applyTheme(data.theme);
        break;

      case 'family-name-update':
        this.updateFamilyName(data.familyName);
        break;

      default:
        logger.debug('Unhandled message type', { type: data.type });
        break;
    }
  }

  applyTheme(theme) {
    if (this.currentTheme === theme) {
      return;
    }

    const previousTheme = this.currentTheme;
    this.currentTheme = theme;

    // Use utility to apply theme classes (removes all existing theme classes automatically)
    applyThemeToWidget(theme);

    logger.debug('Theme applied', { theme, previousTheme });

    // If dynamic greeting is enabled, refresh greeting with new theme
    if (this.dynamicGreetingEnabled) {
      this.refreshGreeting();
    }
  }

  async loadInitialSettings() {
    try {
      // Load family name from localStorage
      const cachedName = localStorage.getItem('dashie-family-name');
      if (cachedName) {
        logger.debug('Family name loaded from cache', { familyName: cachedName });
        this.updateFamilyName(cachedName);
      } else {
        this.updateFamilyName('The Dashie Family');
      }

      // Load dynamic greeting setting from localStorage
      try {
        const settingsJson = localStorage.getItem('dashie-settings');
        if (settingsJson) {
          const settings = JSON.parse(settingsJson);
          this.dynamicGreetingEnabled = settings.interface?.dynamicGreeting === true;
          logger.debug('Dynamic greeting setting loaded', { enabled: this.dynamicGreetingEnabled });
        }
      } catch (e) {
        logger.debug('Could not load dynamic greeting setting', { error: e.message });
      }

      // Render family name with greeting if enabled
      if (this.dynamicGreetingEnabled) {
        this.refreshGreeting();
      }
    } catch (error) {
      logger.error('Failed to load initial settings', { error: error.message });
      this.updateFamilyName('The Dashie Family');
    }
  }

  updateFamilyName(familyName) {
    if (!familyName || familyName.trim() === '') {
      familyName = 'Dashie';
    }

    // Extract base family name (without "The" and "Family")
    let baseName = familyName.trim();
    if (baseName.startsWith('The ')) {
      baseName = baseName.substring(4);
    }
    if (baseName.endsWith(' Family')) {
      baseName = baseName.substring(0, baseName.length - 7);
    }

    this.baseFamilyName = baseName;

    // Format the family name to "The [Name] Family"
    const formattedName = this.formatFamilyName(familyName.trim());
    this.currentFamilyName = formattedName;

    // Cache the family name
    try {
      localStorage.setItem('dashie-family-name', this.currentFamilyName);
    } catch (error) {
      logger.debug('Could not cache family name', { error: error.message });
    }

    logger.info('Family name updated', { familyName: this.currentFamilyName, baseName: this.baseFamilyName });

    // Render the family name (or greeting if enabled)
    this.renderFamilyName();
  }

  renderFamilyName() {
    const element = document.getElementById('family-name');
    if (!element) return;

    if (this.dynamicGreetingEnabled) {
      // Generate greeting variations
      this.greetingVariations = getAllGreetings(this.baseFamilyName, this.currentTheme);
      this.currentVariationIndex = 0;

      // Display random greeting
      const greeting = getGreeting(this.baseFamilyName, this.currentTheme);
      element.textContent = greeting;
      element.style.cursor = 'pointer';
      element.title = 'Click to cycle greetings';

      logger.debug('Dynamic greeting rendered', {
        greeting,
        variations: this.greetingVariations.length,
        theme: this.currentTheme
      });
    } else {
      // Display static family name
      element.textContent = this.currentFamilyName;
      element.style.cursor = 'default';
      element.title = '';

      logger.debug('Static family name rendered', { familyName: this.currentFamilyName });
    }
  }

  formatFamilyName(name) {
    // If already formatted correctly, return as-is
    if (name.startsWith('The ') && name.endsWith(' Family')) {
      return name;
    }

    // Remove "The " prefix if present
    let baseName = name;
    if (baseName.startsWith('The ')) {
      baseName = baseName.substring(4);
    }

    // Remove " Family" suffix if present
    if (baseName.endsWith(' Family')) {
      baseName = baseName.substring(0, baseName.length - 7);
    }

    // Format as "The [Name] Family"
    return `The ${baseName} Family`;
  }

  // ============================================================================
  // DYNAMIC GREETING METHODS
  // ============================================================================

  startGreetingRefresh() {
    // Clear any existing interval
    if (this.greetingRefreshInterval) {
      clearInterval(this.greetingRefreshInterval);
    }

    // Refresh greeting every 30 minutes (to update time-based greetings)
    this.greetingRefreshInterval = setInterval(() => {
      if (this.dynamicGreetingEnabled) {
        this.refreshGreeting();
        logger.debug('Greeting auto-refreshed (30 min interval)');
      }
    }, GREETING_REFRESH_INTERVAL);

    logger.debug('Greeting refresh interval started', { intervalMs: GREETING_REFRESH_INTERVAL });
  }

  refreshGreeting() {
    if (!this.dynamicGreetingEnabled) return;

    // Regenerate greeting variations (time period may have changed)
    this.greetingVariations = getAllGreetings(this.baseFamilyName, this.currentTheme);
    this.currentVariationIndex = 0;

    // Get new random greeting
    const greeting = getGreeting(this.baseFamilyName, this.currentTheme);

    const element = document.getElementById('family-name');
    if (element) {
      element.textContent = greeting;
      logger.debug('Greeting refreshed', { greeting, theme: this.currentTheme });
    }
  }

  cycleGreeting() {
    if (!this.dynamicGreetingEnabled || this.greetingVariations.length === 0) return;

    // Move to next variation
    this.currentVariationIndex = (this.currentVariationIndex + 1) % this.greetingVariations.length;
    const greeting = this.greetingVariations[this.currentVariationIndex];

    const element = document.getElementById('family-name');
    if (element) {
      element.textContent = greeting;
      logger.debug('Greeting cycled', {
        greeting,
        index: this.currentVariationIndex,
        total: this.greetingVariations.length
      });
    }
  }
}

// Initialize the widget
new HeaderWidget();
