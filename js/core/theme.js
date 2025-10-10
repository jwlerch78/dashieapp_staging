// js/core/theme.js - Simplified Theme System
// v1.1 - 10/9/25 - Changed default theme from dark to light
// CHANGE SUMMARY: Drastically simplified - only manages body/logo, WidgetMessenger handles all widget communication

import { createLogger } from '../utils/logger.js';
import { events as eventSystem, EVENTS } from '../utils/event-emitter.js';

const logger = createLogger('Theme');

// ---------------------
// THEME CONSTANTS
// ---------------------

export const THEMES = {
  DARK: 'dark',
  LIGHT: 'light'
};

const THEME_CONFIG = {
  [THEMES.DARK]: {
    name: 'Dark Theme',
    logoSrc: '/icons/Dashie_Full_Logo_White_Transparent.png'
  },
  [THEMES.LIGHT]: {
    name: 'Light Theme', 
    logoSrc: '/icons/Dashie_Full_Logo_Black_Transparent.png'
  }
};

// ---------------------
// THEME STATE
// ---------------------

let currentTheme = THEMES.DARK; // Default fallback
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
    if (Object.values(THEMES).includes(saved)) {
      logger.debug('Theme loaded from localStorage:', saved);
      return saved;
    }
  } catch (error) {
    logger.debug('Failed to load from localStorage:', error.message);
  }

  // Only use default if no localStorage (no double-loading)
  logger.debug('Using default theme:', THEMES.DARK);
  return THEMES.DARK;
}

async function saveTheme(theme) {
  // Save to settings system
  if (settingsSystem) {
    try {
      settingsSystem.setSettingValue('display.theme', theme);
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
  // Remove existing theme classes
  document.body.classList.remove('theme-dark', 'theme-light');
  // Add new theme class
  document.body.classList.add(`theme-${theme}`);
  
  logger.debug('Body theme applied:', theme);
}

function updateLogo(theme) {
  const logo = document.querySelector('.dashie-logo');
  if (logo) {
    logo.src = THEME_CONFIG[theme].logoSrc;
    logger.debug('Logo updated:', theme);
  } else {
    // Retry once after delay
    setTimeout(() => {
      const retryLogo = document.querySelector('.dashie-logo');
      if (retryLogo) {
        retryLogo.src = THEME_CONFIG[theme].logoSrc;
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
  return Object.keys(THEME_CONFIG).map(key => ({
    id: key,
    name: THEME_CONFIG[key].name
  }));
}

export async function switchTheme(newTheme) {
  if (!Object.values(THEMES).includes(newTheme)) {
    logger.warn('Invalid theme:', newTheme);
    return false;
  }
  
  // Skip if already the current theme
  if (newTheme === currentTheme) {
    logger.debug('Theme already set, skipping switch:', newTheme);
    return true;
  }
  
  logger.info('Switching theme', { from: currentTheme, to: newTheme });
  
  currentTheme = newTheme;
  
  // Apply theme to body and logo only
  applyThemeToBody(newTheme);
  updateLogo(newTheme);
  await saveTheme(newTheme);
  
  // Emit ONE event - WidgetMessenger will handle all widget communication
  eventSystem.emit(EVENTS.THEME_CHANGED, { theme: newTheme });
  
  logger.info('Theme switched to:', THEME_CONFIG[newTheme].name);
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
        const settingsTheme = settingsSystem.getSettingValue('display.theme', currentTheme);
        if (settingsTheme !== currentTheme && Object.values(THEMES).includes(settingsTheme)) {
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
    eventSystem.on(EVENTS.SETTINGS_CHANGED, (data) => {
      if (data.path === 'display.theme' && data.value !== currentTheme) {
        logger.info('Theme change from settings detected');
        switchTheme(data.value);
      }
    });

    logger.info('Theme system initialized:', THEME_CONFIG[currentTheme].name);

  } catch (error) {
    logger.error('Theme system initialization failed:', error);
    // Apply safe fallback
    currentTheme = THEMES.DARK;
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
    currentTheme = THEMES.DARK;
    applyThemeToBody(THEMES.DARK);
  }
}

// Apply theme immediately when script loads
if (typeof window !== 'undefined') {
  applyEarlyTheme();
}