// js/themes/theme-registry.js
// Centralized theme registry - single source of truth for all themes
// v2.0 - Theme family architecture with light/dark variants

/**
 * Theme Family Registry
 *
 * Architecture:
 * - Theme families (default, halloween, etc.) each have light/dark variants
 * - Settings store: themeFamily + themeMode separately
 * - Theme ID computed as: `${family}-${mode}` (e.g., "halloween-dark")
 *
 * Theme Family Schema:
 * {
 *   id: string - unique family identifier (e.g., "halloween")
 *   name: string - display name (e.g., "Halloween")
 *   seasonal?: { month: number } - optional auto-activation (1=Jan, 10=Oct, etc.)
 *   variants: {
 *     light: { cssClass: string, logoSrc: string },
 *     dark: { cssClass: string, logoSrc: string }
 *   }
 * }
 */
export const THEME_FAMILIES = {
  default: {
    id: 'default',
    name: 'Default',
    variants: {
      light: {
        cssClass: 'theme-light',
        logoSrc: '/artwork/Dashie_Full_Logo_Black_Transparent.png'
      },
      dark: {
        cssClass: 'theme-dark',
        logoSrc: '/artwork/Dashie_Full_Logo_White_Transparent.png'
      }
    }
  },

  halloween: {
    id: 'halloween',
    name: 'Halloween',
    seasonal: { month: 10 }, // Auto-activate in October
    variants: {
      light: {
        cssClass: 'theme-halloween-light',
        logoSrc: '/artwork/Dashie_Full_Logo_Black_Transparent.png'
      },
      dark: {
        cssClass: 'theme-halloween-dark',
        logoSrc: '/artwork/Dashie_Full_Logo_White_Transparent.png'
      }
    }
  }
};

// Valid theme modes
export const THEME_MODES = ['light', 'dark'];

// Default values
export const DEFAULT_THEME_FAMILY = 'default';
export const DEFAULT_THEME_MODE = 'light';
export const DEFAULT_THEME_ID = 'default-light';

/**
 * Get all theme family IDs
 * @returns {string[]} Array of family IDs
 */
export function getThemeFamilyIds() {
  return Object.keys(THEME_FAMILIES);
}

/**
 * Get all theme families as array
 * @returns {Array} Array of theme family objects
 */
export function getAllThemeFamilies() {
  return Object.values(THEME_FAMILIES);
}

/**
 * Get theme family by ID
 * @param {string} familyId - Theme family identifier
 * @returns {Object|null} Theme family object or null if not found
 */
export function getThemeFamily(familyId) {
  return THEME_FAMILIES[familyId] || null;
}

/**
 * Check if theme family ID is valid
 * @param {string} familyId - Theme family identifier
 * @returns {boolean}
 */
export function isValidThemeFamily(familyId) {
  return familyId in THEME_FAMILIES;
}

/**
 * Check if theme mode is valid
 * @param {string} mode - Theme mode (light/dark)
 * @returns {boolean}
 */
export function isValidThemeMode(mode) {
  return THEME_MODES.includes(mode);
}

/**
 * Build theme ID from family and mode
 * @param {string} familyId - Theme family ID
 * @param {string} mode - Theme mode (light/dark)
 * @returns {string} Theme ID (e.g., "halloween-dark")
 */
export function buildThemeId(familyId, mode) {
  return `${familyId}-${mode}`;
}

/**
 * Parse theme ID into family and mode
 * @param {string} themeId - Theme ID (e.g., "halloween-dark")
 * @returns {{family: string, mode: string}|null} Parsed family and mode or null if invalid
 */
export function parseThemeId(themeId) {
  if (!themeId) return null;

  // Handle legacy theme IDs
  if (themeId === 'light') {
    return { family: 'default', mode: 'light' };
  }
  if (themeId === 'dark') {
    return { family: 'default', mode: 'dark' };
  }

  // Parse family-mode format
  const lastDashIndex = themeId.lastIndexOf('-');
  if (lastDashIndex === -1) return null;

  const family = themeId.substring(0, lastDashIndex);
  const mode = themeId.substring(lastDashIndex + 1);

  if (!isValidThemeFamily(family) || !isValidThemeMode(mode)) {
    return null;
  }

  return { family, mode };
}

/**
 * Get theme configuration from family and mode
 * @param {string} familyId - Theme family ID
 * @param {string} mode - Theme mode (light/dark)
 * @returns {Object|null} Theme config with id, name, cssClass, logoSrc, or null if invalid
 */
export function getThemeConfig(familyId, mode) {
  const family = getThemeFamily(familyId);
  if (!family || !family.variants[mode]) {
    return null;
  }

  const variant = family.variants[mode];
  return {
    id: buildThemeId(familyId, mode),
    familyId: familyId,
    mode: mode,
    name: `${family.name} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
    familyName: family.name,
    cssClass: variant.cssClass,
    logoSrc: variant.logoSrc,
    seasonal: family.seasonal
  };
}

/**
 * Get theme configuration by theme ID
 * @param {string} themeId - Theme ID (e.g., "halloween-dark")
 * @returns {Object|null} Theme config or null if invalid
 */
export function getThemeById(themeId) {
  const parsed = parseThemeId(themeId);
  if (!parsed) return null;
  return getThemeConfig(parsed.family, parsed.mode);
}

/**
 * Check if theme ID is valid
 * @param {string} themeId - Theme ID
 * @returns {boolean}
 */
export function isValidThemeId(themeId) {
  return getThemeById(themeId) !== null;
}

/**
 * Get seasonal theme family for current month (if available)
 * @param {number} [month] - Optional month (1-12), defaults to current month
 * @returns {Object|null} Seasonal theme family or null if none available
 */
export function getSeasonalThemeFamily(month = null) {
  const currentMonth = month ?? (new Date().getMonth() + 1);

  const seasonalFamily = getAllThemeFamilies().find(family =>
    family.seasonal && family.seasonal.month === currentMonth
  );

  return seasonalFamily || null;
}

// =============================================================================
// BACKWARDS COMPATIBILITY
// Legacy functions that map to new architecture
// =============================================================================

/**
 * @deprecated Use getThemeById() instead
 * Get theme by ID (legacy function)
 */
export function getTheme(themeId) {
  return getThemeById(themeId);
}

/**
 * @deprecated Use isValidThemeId() instead
 * Check if theme ID is valid (legacy function)
 */
export function isValidTheme(themeId) {
  return isValidThemeId(themeId);
}

/**
 * @deprecated Use getThemeFamilyIds() instead
 * Get all theme IDs (legacy function - returns computed IDs)
 */
export function getThemeIds() {
  const ids = [];
  getAllThemeFamilies().forEach(family => {
    THEME_MODES.forEach(mode => {
      ids.push(buildThemeId(family.id, mode));
    });
  });
  return ids;
}

/**
 * @deprecated Use getAllThemeFamilies() instead
 * Get all themes (legacy function - returns expanded themes)
 */
export function getAllThemes() {
  const themes = [];
  getAllThemeFamilies().forEach(family => {
    THEME_MODES.forEach(mode => {
      const theme = getThemeConfig(family.id, mode);
      if (theme) themes.push(theme);
    });
  });
  return themes;
}

/**
 * @deprecated Use getThemeConfig(DEFAULT_THEME_FAMILY, DEFAULT_THEME_MODE) instead
 * Get default theme (legacy function)
 */
export function getDefaultTheme() {
  return getThemeConfig(DEFAULT_THEME_FAMILY, DEFAULT_THEME_MODE);
}

/**
 * @deprecated Use getSeasonalThemeFamily() instead
 * Get seasonal theme (legacy function)
 */
export function getSeasonalTheme(month = null) {
  const seasonalFamily = getSeasonalThemeFamily(month);
  if (!seasonalFamily) return null;

  // Return dark variant by default for seasonal themes
  return getThemeConfig(seasonalFamily.id, 'dark');
}
