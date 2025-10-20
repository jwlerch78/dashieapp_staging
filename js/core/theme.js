// js/core/theme.js - Simplified Theme System
// v1.2 - Modularized to use theme registry
// CHANGE SUMMARY: Now uses centralized theme registry for theme definitions

import { createLogger } from '../utils/logger.js';
import AppComms from './app-comms.js';
import {
  THEME_REGISTRY,
  DEFAULT_THEME_ID,
  getTheme,
  getThemeIds,
  getAllThemes,
  isValidTheme
} from '../themes/theme-registry.js';

const logger = createLogger('Theme');

// ---------------------
// THEME CONSTANTS (from registry)
// ---------------------

// Export theme IDs for backwards compatibility
export const THEMES = {
  DARK: 'dark',
  LIGHT: 'light'
};

// SINGLE SOURCE OF TRUTH for default theme (from registry)
export const DEFAULT_THEME = DEFAULT_THEME_ID;



// ---------------------
// THEME STATE
// ---------------------

let currentTheme = DEFAULT_THEME; // Use centralized default
let settingsSystem = null;

// ---------------------
// SETTINGS INTEGRATION
// ---------------------

async function connectToSettings() {
  try {
    const { getSettingValue, setSettingValue, isSettingsReady } = await import('../settings/settings-main.js');
    
    // Wait up to 2 seconds for settings
    let attempts = 0;
    while (!isSettingsReady() && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (isSettingsReady()) {
      settingsSystem = { getSettingValue, setSettingValue };
      logger.info('Connected to settings system');
      return true;
    }
  } catch (error) {
    logger.debug('Settings system not available:', error.message);
  }
  
  return false;
}

async function loadTheme() {
  // Try localStorage first (fast, cached user preference)
  try {
    const saved = localStorage.getItem('dashie-theme');
    if (isValidTheme(saved)) {
      logger.debug('Theme loaded from localStorage:', saved);
      return saved;
    }
  } catch (error) {
    logger.debug('Failed to load from localStorage:', error.message);
  }

  // Only use default if no localStorage (no double-loading)
  logger.debug('Using default theme:', DEFAULT_THEME);
  return DEFAULT_THEME;

}

async function saveTheme(theme) {
  // Save to settings system
  if (settingsSystem) {
    try {
      settingsSystem.setSettingValue('interface.theme', theme);
      logger.debug('Theme saved to settings system');
    } catch (error) {
      logger.debug('Failed to save to settings:', error.message);
    }
  }

  // Always save to localStorage as backup
  try {
    localStorage.setItem('dashie-theme', theme);
    logger.debug('Theme saved to localStorage');
  } catch (error) {
    logger.debug('Failed to save to localStorage:', error.message);
  }
}

// ---------------------
// THEME APPLICATION (Body & Logo Only)
// ---------------------

function applyThemeToBody(theme) {
  const themeObj = getTheme(theme);
  if (!themeObj) {
    logger.warn('Invalid theme object for:', theme);
    return;
  }

  // Remove all existing theme classes
  getThemeIds().forEach(id => {
    document.body.classList.remove(`theme-${id}`);
  });

  // Add new theme class
  document.body.classList.add(themeObj.cssClass);

  logger.debug('Body theme applied:', theme);
}

function updateLogo(theme) {
  const themeObj = getTheme(theme);
  if (!themeObj) {
    logger.warn('Invalid theme object for logo update:', theme);
    return;
  }

  const logo = document.querySelector('.dashie-logo');
  if (logo) {
    logo.src = themeObj.logoSrc;
    logger.debug('Logo updated:', theme);
  } else {
    // Retry once after delay
    setTimeout(() => {
      const retryLogo = document.querySelector('.dashie-logo');
      if (retryLogo) {
        retryLogo.src = themeObj.logoSrc;
        logger.debug('Logo updated on retry:', theme);
      }
    }, 500);
  }
}

// ---------------------
// PUBLIC API
// ---------------------

export function getCurrentTheme() {
  return currentTheme;
}

export function getAvailableThemes() {
  return getAllThemes().map(theme => ({
    id: theme.id,
    name: theme.name
  }));
}

export async function switchTheme(newTheme) {
  if (!isValidTheme(newTheme)) {
    logger.warn('Invalid theme:', newTheme);
    return false;
  }

  // Skip if already the current theme
  if (newTheme === currentTheme) {
    logger.debug('Theme already set, skipping switch:', newTheme);
    return true;
  }

  const themeObj = getTheme(newTheme);
  logger.info('Switching theme', { from: currentTheme, to: newTheme });

  currentTheme = newTheme;

  // Apply theme to body and logo only
  applyThemeToBody(newTheme);
  updateLogo(newTheme);
  await saveTheme(newTheme);

  // Emit ONE event - WidgetMessenger will handle all widget communication
  AppComms.publish(AppComms.events.THEME_CHANGED, { theme: newTheme });

  logger.info('Theme switched to:', themeObj.name);
  return true;
}

export async function initializeThemeSystem() {
  logger.info('Initializing theme system');

  try {
    // Load theme once from localStorage/default
    const savedTheme = await loadTheme();
    
    // Only apply if different from current theme (avoids duplicate application from early theme)
    if (savedTheme !== currentTheme) {
      currentTheme = savedTheme;
      applyThemeToBody(currentTheme);
      updateLogo(currentTheme);
    } else {
      // Theme already applied by early theme, just update logo
      updateLogo(currentTheme);
      logger.debug('Theme already applied by early loading, skipping body theme');
    }

    // Connect to settings system after initial theme is set
    const settingsConnected = await connectToSettings();
    
    // Only override if settings system has different theme
    if (settingsConnected && settingsSystem) {
      try {
        const settingsTheme = settingsSystem.getSettingValue('interface.theme', currentTheme);
        if (settingsTheme !== currentTheme && isValidTheme(settingsTheme)) {
          logger.info('Settings system has different theme, switching:', { from: currentTheme, to: settingsTheme });
          await switchTheme(settingsTheme);
        } else {
          logger.debug('Settings theme matches current theme, no change needed');
        }
      } catch (error) {
        logger.debug('Failed to check settings theme:', error.message);
      }
    }
    
    // Listen for settings changes
    AppComms.subscribe(AppComms.events.SETTINGS_CHANGED, (data) => {
      if (data.path === 'interface.theme' && data.value !== currentTheme) {
        logger.info('Theme change from settings detected');
        switchTheme(data.value);
      }
    });

    const themeObj = getTheme(currentTheme);
    logger.info('Theme system initialized:', themeObj?.name || currentTheme);

  } catch (error) {
    logger.error('Theme system initialization failed:', error);
    // Apply safe fallback
    currentTheme = DEFAULT_THEME;
    applyThemeToBody(currentTheme);
  }
}

// ---------------------
// EARLY THEME LOADING
// ---------------------

export async function applyEarlyTheme() {
  try {
    // Quick theme load for immediate application
    const theme = await loadTheme();
    currentTheme = theme;
    applyThemeToBody(theme);
    
    logger.debug('Early theme applied:', theme);
  } catch (error) {
    logger.debug('Early theme failed, using default');
    currentTheme = DEFAULT_THEME;
    applyThemeToBody(DEFAULT_THEME);
  }
}

// Apply theme immediately when script loads
if (typeof window !== 'undefined') {
  applyEarlyTheme();
}