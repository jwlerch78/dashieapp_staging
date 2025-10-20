// js/widgets/shared/widget-theme-detector.js
// Utility for widgets to detect current theme reliably
// v1.0 - 10/20/25 - Initial implementation

/**
 * Detect current theme from parent window or localStorage
 * Works for widgets loaded in iframes
 *
 * @param {string} defaultTheme - Fallback theme if detection fails
 * @returns {string} Detected theme name
 */
export function detectCurrentTheme(defaultTheme = 'dark') {
  // Strategy 1: Try to read from parent window's body class (most reliable)
  try {
    if (window.parent && window.parent !== window && window.parent.document) {
      const parentBody = window.parent.document.body;

      // Check for all known theme classes
      const themeClasses = Array.from(parentBody.classList).filter(cls => cls.startsWith('theme-'));

      if (themeClasses.length > 0) {
        // Extract theme name from class (e.g., 'theme-halloween-dark' -> 'halloween-dark')
        const themeClass = themeClasses[0];
        const themeName = themeClass.replace('theme-', '');
        return themeName;
      }
    }
  } catch (e) {
    // Cross-origin error or parent not accessible - fall through to localStorage
  }

  // Strategy 2: Try localStorage (fallback)
  try {
    const savedTheme = localStorage.getItem('dashie-theme');
    if (savedTheme) {
      return savedTheme;
    }
  } catch (e) {
    // localStorage not accessible - fall through to default
  }

  // Strategy 3: Return default theme
  return defaultTheme;
}

/**
 * Apply theme classes to widget's document
 * Removes all theme-* classes and applies the specified theme
 *
 * @param {string} theme - Theme name to apply
 */
export function applyThemeToWidget(theme) {
  // Remove all existing theme classes from body and html
  const existingThemeClasses = Array.from(document.body.classList).filter(cls => cls.startsWith('theme-'));
  existingThemeClasses.forEach(cls => {
    document.body.classList.remove(cls);
    document.documentElement.classList.remove(cls);
  });

  // Add new theme class
  const themeClass = `theme-${theme}`;
  document.body.classList.add(themeClass);
  document.documentElement.classList.add(themeClass);
}

/**
 * Extract base theme name (e.g., 'halloween-dark' -> 'halloween')
 * Useful for theme-aware logic
 *
 * @param {string} theme - Full theme name
 * @returns {string} Base theme name
 */
export function getBaseTheme(theme) {
  if (theme.includes('-')) {
    return theme.split('-')[0];
  }
  return theme;
}

/**
 * Check if theme is a variant (e.g., 'halloween-dark' returns true)
 *
 * @param {string} theme - Theme name to check
 * @returns {boolean} True if theme has a variant suffix
 */
export function isThemeVariant(theme) {
  return theme.includes('-');
}

/**
 * Get theme variant (e.g., 'halloween-dark' -> 'dark')
 * Returns null if no variant
 *
 * @param {string} theme - Theme name
 * @returns {string|null} Variant name or null
 */
export function getThemeVariant(theme) {
  if (theme.includes('-')) {
    const parts = theme.split('-');
    return parts[parts.length - 1]; // Last part is variant (dark/light)
  }
  return null;
}
