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
      familyName = 'Dashie';
    }

    // Format the family name to "The [Name] Family"
    const formattedName = this.formatFamilyName(familyName.trim());
    this.currentFamilyName = formattedName;

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
}

// Initialize the widget
new HeaderWidget();
