// js/themes/theme-registry.js
// Centralized theme registry - single source of truth for all themes
// v1.0 - Initial creation for modular theme system

/**
 * Theme Registry
 * Define all available themes here - this is the ONLY place themes are defined
 *
 * Theme Definition Schema:
 * {
 *   id: string - unique theme identifier (used in code, settings, CSS class)
 *   name: string - display name (shown to users)
 *   logoSrc: string - path to Dashie logo for this theme
 *   cssClass: string - CSS class applied to body (e.g., 'theme-dark')
 *   seasonal?: { month: number } - optional auto-activation (1=Jan, 10=Oct, etc.)
 * }
 */
export const THEME_REGISTRY = {
  light: {
    id: 'light',
    name: 'Light',
    logoSrc: '/artwork/Dashie_Full_Logo_Black_Transparent.png',
    cssClass: 'theme-light'
  },

  dark: {
    id: 'dark',
    name: 'Dark',
    logoSrc: '/artwork/Dashie_Full_Logo_White_Transparent.png',
    cssClass: 'theme-dark'
  }
};

// Default theme constant
export const DEFAULT_THEME_ID = 'light';

/**
 * Get all available theme IDs
 * @returns {string[]} Array of theme IDs
 */
export function getThemeIds() {
  return Object.keys(THEME_REGISTRY);
}

/**
 * Get all themes as array
 * @returns {Array} Array of theme objects
 */
export function getAllThemes() {
  return Object.values(THEME_REGISTRY);
}

/**
 * Get theme by ID
 * @param {string} themeId - Theme identifier
 * @returns {Object|null} Theme object or null if not found
 */
export function getTheme(themeId) {
  return THEME_REGISTRY[themeId] || null;
}

/**
 * Check if theme ID is valid
 * @param {string} themeId - Theme identifier
 * @returns {boolean}
 */
export function isValidTheme(themeId) {
  return themeId in THEME_REGISTRY;
}

/**
 * Get default theme
 * @returns {Object} Default theme object
 */
export function getDefaultTheme() {
  return THEME_REGISTRY[DEFAULT_THEME_ID];
}

/**
 * Get seasonal theme for current month (if available)
 * @param {number} [month] - Optional month (1-12), defaults to current month
 * @returns {Object|null} Seasonal theme or null if none available
 */
export function getSeasonalTheme(month = null) {
  const currentMonth = month ?? (new Date().getMonth() + 1);

  const seasonalTheme = getAllThemes().find(theme =>
    theme.seasonal && theme.seasonal.month === currentMonth
  );

  return seasonalTheme || null;
}
