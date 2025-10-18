// js/ui/theme-applier.js
// Theme management and application
// Replaces legacy theme.js with modern AppComms-based system

import { createLogger } from '../utils/logger.js';
import AppComms from '../core/app-comms.js';

const logger = createLogger('ThemeApplier');

export const DEFAULT_THEME = 'dark';
export const VALID_THEMES = ['light', 'dark'];

class ThemeApplier {
  constructor() {
    this.currentTheme = DEFAULT_THEME;
    this.initialized = false;

    logger.info('ThemeApplier constructed');
  }

  /**
   * Initialize theme system
   * Loads saved theme and applies it
   */
  initialize() {
    if (this.initialized) {
      logger.warn('ThemeApplier already initialized');
      return;
    }

    logger.info('Initializing ThemeApplier...');

    // Load saved theme from localStorage
    const savedTheme = this.loadThemeFromStorage();

    // Apply theme
    this.applyTheme(savedTheme, false); // Don't save on init

    this.initialized = true;
    logger.success('ThemeApplier initialized', { theme: this.currentTheme });
  }

  /**
   * Load theme from localStorage
   * @returns {string} Theme name ('light' or 'dark')
   */
  loadThemeFromStorage() {
    try {
      const savedTheme = localStorage.getItem('dashie-theme');

      if (savedTheme && VALID_THEMES.includes(savedTheme)) {
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
   * @param {string} theme - Theme name ('light' or 'dark')
   * @param {boolean} save - Whether to save to localStorage (default: true)
   */
  applyTheme(theme, save = true) {
    // Validate theme
    if (!VALID_THEMES.includes(theme)) {
      logger.error('Invalid theme', { theme, validThemes: VALID_THEMES });
      return;
    }

    // Skip if already applied
    if (this.currentTheme === theme) {
      logger.debug('Theme already applied', { theme });
      return;
    }

    const previousTheme = this.currentTheme;
    this.currentTheme = theme;

    // Apply to document body
    this.applyThemeToDOM(theme, previousTheme);

    // Save to localStorage
    if (save) {
      this.saveThemeToStorage(theme);
    }

    // Broadcast theme change to widgets via AppComms
    this.broadcastThemeChange(theme);

    logger.info('Theme applied', {
      theme,
      previousTheme,
      saved: save
    });
  }

  /**
   * Apply theme classes to DOM
   * @param {string} theme - New theme
   * @param {string} previousTheme - Previous theme
   */
  applyThemeToDOM(theme, previousTheme) {
    const body = document.body;

    // Remove old theme class
    if (previousTheme) {
      body.classList.remove(`theme-${previousTheme}`);
    }

    // Add new theme class
    body.classList.add(`theme-${theme}`);

    // Update data attribute for CSS selectors
    body.setAttribute('data-theme', theme);

    // Update sidebar logo src based on theme
    this.updateSidebarLogo(theme);

    logger.debug('Theme classes applied to DOM', { theme });
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

    // Set logo source based on theme
    if (theme === 'light') {
      logo.src = '/artwork/Dashie_Full_Logo_Black_Transparent.png';
    } else {
      logo.src = '/artwork/Dashie_Full_Logo_White_Transparent.png';
    }

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
