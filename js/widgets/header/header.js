// widgets/header/header.js
// Header widget - displays family name/greeting
// Migrated from legacy with minimal changes

import { createLogger } from '/js/utils/logger.js';

const DEFAULT_THEME = 'dark'; // Local constant
const logger = createLogger('HeaderWidget');

class HeaderWidget {
  constructor() {
    this.currentTheme = null;
    this.currentFamilyName = 'The Dashie Family';

    this.init();
  }

  init() {
    // Apply early theme detection
    this.detectAndApplyInitialTheme();

    // Set up event listeners
    this.setupEventListeners();

    // Load initial family name from localStorage
    this.loadInitialSettings();

    logger.info('Header widget initialized');
  }

  // Detect initial theme from DOM or localStorage
  detectAndApplyInitialTheme() {
    let initialTheme = DEFAULT_THEME;

    if (document.body.classList.contains('theme-light')) {
      initialTheme = 'light';
    } else if (document.body.classList.contains('theme-dark')) {
      initialTheme = 'dark';
    } else {
      try {
        const savedTheme = localStorage.getItem('dashie-theme');
        if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light')) {
          initialTheme = savedTheme;
        }
      } catch (error) {
        logger.debug('Could not read theme from localStorage, using default');
      }
    }

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
  }

  handleCommand(action) {
    logger.debug('Header widget received command', { action });
    // Header doesn't need navigation for now
  }

  handleDataServiceMessage(data) {
    switch (data.type) {
      case 'widget-update':
        if (data.action === 'state-update') {
          const hasFamilyName = data.payload?.settings?.['family.familyName'];
          const hasTheme = data.payload?.theme;

          if (hasFamilyName) {
            this.updateFamilyName(data.payload.settings['family.familyName']);
          }

          if (hasTheme) {
            this.applyTheme(data.payload.theme);
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

    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);

    logger.debug('Theme applied', { theme, previousTheme });
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
    } catch (error) {
      logger.error('Failed to load initial settings', { error: error.message });
      this.updateFamilyName('The Dashie Family');
    }
  }

  updateFamilyName(familyName) {
    if (!familyName || familyName.trim() === '') {
      familyName = 'The Dashie Family';
    }

    this.currentFamilyName = familyName.trim();

    const element = document.getElementById('family-name');
    if (element) {
      element.textContent = this.currentFamilyName;
    }

    // Cache the family name
    try {
      localStorage.setItem('dashie-family-name', this.currentFamilyName);
    } catch (error) {
      logger.debug('Could not cache family name', { error: error.message });
    }

    logger.info('Family name updated', { familyName: this.currentFamilyName });
  }
}

// Initialize the widget
new HeaderWidget();
