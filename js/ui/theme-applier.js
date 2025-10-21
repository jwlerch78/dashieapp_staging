// js/ui/theme-applier.js
// Theme management and application
// v1.1 - Modularized to use theme registry

import { createLogger } from '../utils/logger.js';
import AppComms from '../core/app-comms.js';
import {
  DEFAULT_THEME_ID,
  getTheme,
  getThemeIds,
  isValidTheme
} from './themes/theme-registry.js';
import { themeOverlay } from './themes/theme-overlay-applier.js';

const logger = createLogger('ThemeApplier');

export const DEFAULT_THEME = DEFAULT_THEME_ID;
export const VALID_THEMES = getThemeIds();

class ThemeApplier {
  constructor() {
    this.currentTheme = DEFAULT_THEME;
    this.initialized = false;

    logger.verbose('ThemeApplier constructed');
  }

  /**
   * Initialize theme system
   * NOTE: Does NOT automatically apply a theme
   * Theme will be applied when Settings loads from database
   */
  initialize() {
    if (this.initialized) {
      logger.warn('ThemeApplier already initialized');
      return;
    }

    logger.info('Initializing ThemeApplier (ready to apply themes)...');

    // Initialize theme overlay
    if (themeOverlay) {
      themeOverlay.initialize();
    }

    this.initialized = true;
    logger.success('ThemeApplier initialized and ready', { currentTheme: this.currentTheme });
  }

  /**
   * Load theme from localStorage
   * @returns {string} Theme name ('light' or 'dark')
   */
  loadThemeFromStorage() {
    try {
      const savedTheme = localStorage.getItem('dashie-theme');

      if (savedTheme && isValidTheme(savedTheme)) {
        logger.info('Theme loaded from localStorage', { theme: savedTheme });
        return savedTheme;
      }
    } catch (error) {
      logger.error('Failed to load theme from localStorage', error);
    }

    logger.info('Using default theme', { theme: DEFAULT_THEME });
    return DEFAULT_THEME;
  }

  /**
   * Save theme to localStorage
   * @param {string} theme - Theme name
   */
  saveThemeToStorage(theme) {
    try {
      localStorage.setItem('dashie-theme', theme);
      logger.debug('Theme saved to localStorage', { theme });
    } catch (error) {
      logger.error('Failed to save theme to localStorage', error);
    }
  }

  /**
   * Apply theme to the application
   * @param {string} theme - Theme name (from registry)
   * @param {boolean} save - Whether to save to localStorage (default: true)
   */
  applyTheme(theme, save = true) {
    // Validate theme
    if (!isValidTheme(theme)) {
      logger.error('Invalid theme', { theme, validThemes: getThemeIds() });
      return;
    }

    const previousTheme = this.currentTheme;
    const themeChanged = this.currentTheme !== theme;

    // Update current theme
    this.currentTheme = theme;

    // Apply to document body (only if changed)
    if (themeChanged) {
      this.applyThemeToDOM(theme, previousTheme);
    }

    // Save to localStorage
    if (save) {
      this.saveThemeToStorage(theme);
    }

    // ALWAYS broadcast theme change to widgets (even if theme didn't change)
    // This ensures widgets get the theme on initialization
    this.broadcastThemeChange(theme);

    logger.verbose('Theme applied', {
      theme,
      previousTheme,
      changed: themeChanged,
      saved: save,
      broadcast: true
    });
  }

  /**
   * Apply theme classes to DOM
   * @param {string} theme - New theme
   * @param {string} previousTheme - Previous theme
   */
  applyThemeToDOM(theme, previousTheme) {
    const body = document.body;
    const themeObj = getTheme(theme);

    if (!themeObj) {
      logger.error('Theme object not found', { theme });
      return;
    }

    // Remove all existing theme classes
    getThemeIds().forEach(id => {
      const themeToRemove = getTheme(id);
      if (themeToRemove) {
        body.classList.remove(themeToRemove.cssClass);
      }
    });

    // Add new theme class
    body.classList.add(themeObj.cssClass);

    // Update data attribute for CSS selectors
    body.setAttribute('data-theme', theme);

    // Update sidebar logo src based on theme
    this.updateSidebarLogo(theme);

    // Apply theme overlay (Halloween decorations, etc.)
    if (themeOverlay) {
      themeOverlay.applyOverlay(theme);
    }

    logger.debug('Theme classes applied to DOM', { theme, cssClass: themeObj.cssClass });
  }

  /**
   * Update sidebar logo to match theme
   * @param {string} theme - Theme name
   */
  updateSidebarLogo(theme) {
    const logo = document.querySelector('.dashie-logo');
    if (!logo) {
      return;
    }

    const themeObj = getTheme(theme);
    if (!themeObj) {
      logger.error('Theme object not found for logo update', { theme });
      return;
    }

    // Set logo source from theme registry
    logo.src = themeObj.logoSrc;

    logger.debug('Logo updated for theme', { theme, src: logo.src });
  }

  /**
   * Broadcast theme change to widgets and modules
   * @param {string} theme - Theme name
   */
  broadcastThemeChange(theme) {
    // Publish via AppComms for modules
    AppComms.publish(AppComms.events.THEME_CHANGED, { theme });

    // Send to all widget iframes via postMessage
    const widgetIframes = document.querySelectorAll('.widget-iframe');
    widgetIframes.forEach(iframe => {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'theme-change',
          theme: theme
        }, '*');
      }
    });

    logger.debug('Theme change broadcasted', {
      theme,
      widgetCount: widgetIframes.length
    });
  }

  /**
   * Toggle between light and dark theme
   * @returns {string} New theme
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
    return newTheme;
  }

  /**
   * Get current theme
   * @returns {string} Current theme name
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Check if theme is dark
   * @returns {boolean}
   */
  isDarkTheme() {
    return this.currentTheme === 'dark';
  }

  /**
   * Check if theme is light
   * @returns {boolean}
   */
  isLightTheme() {
    return this.currentTheme === 'light';
  }
}

// Export singleton
const themeApplier = new ThemeApplier();
export default themeApplier;

// Expose globally for debugging
if (typeof window !== 'undefined') {
  window.themeApplier = themeApplier;
}
