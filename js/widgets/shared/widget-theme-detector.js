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
  // Strategy 1: Try to read from parent window's data-theme attribute (most reliable)
  try {
    if (window.parent && window.parent !== window && window.parent.document) {
      const parentBody = window.parent.document.body;

      // First check data-theme attribute (contains full theme ID)
      const dataTheme = parentBody.getAttribute('data-theme');
      if (dataTheme) {
        return dataTheme;
      }

      // Fallback: Check for theme classes
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
 * @param {string} theme - Theme name or ID to apply (e.g., 'light', 'dark', 'default-light', 'halloween-dark')
 */
export function applyThemeToWidget(theme) {
  // Remove all existing theme classes from body and html
  // IMPORTANT: Check both body AND html for theme classes, as they can get out of sync
  const bodyThemeClasses = Array.from(document.body.classList).filter(cls => cls.startsWith('theme-'));
  const htmlThemeClasses = Array.from(document.documentElement.classList).filter(cls => cls.startsWith('theme-'));
  const allThemeClasses = [...new Set([...bodyThemeClasses, ...htmlThemeClasses])];

  allThemeClasses.forEach(cls => {
    document.body.classList.remove(cls);
    document.documentElement.classList.remove(cls);
  });

  // Determine CSS class to apply
  // Handle both legacy format ('light', 'dark') and new format ('default-light', 'halloween-dark')
  let themeClass;
  if (theme === 'light' || theme === 'dark') {
    // Legacy format - use as-is
    themeClass = `theme-${theme}`;
  } else if (theme.startsWith('default-')) {
    // Default theme family - extract mode ('default-light' -> 'theme-light')
    const mode = theme.split('-')[1];
    themeClass = `theme-${mode}`;
  } else {
    // Other theme families (halloween, etc.) - use full theme ID ('halloween-dark' -> 'theme-halloween-dark')
    themeClass = `theme-${theme}`;
  }

  // Add new theme class
  document.body.classList.add(themeClass);
  document.documentElement.classList.add(themeClass);

  // Log the theme application (after applying)
  console.log('🎨 applyThemeToWidget:', {
    themeId: theme,
    removedFromBody: bodyThemeClasses,
    removedFromHtml: htmlThemeClasses,
    appliedClass: themeClass,
    bodyClassesAfter: document.body.className,
    htmlClassesAfter: document.documentElement.className
  });
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
