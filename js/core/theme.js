// js/core/theme.js - Complete Theme Management System integrated with new modular settings
// CHANGE SUMMARY: Integrated with new modular settings system, added structured logging, removed direct localStorage access, added proper event-driven theme loading

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

export const THEME_CONFIG = {
  [THEMES.DARK]: {
    name: 'Dark Theme',
    className: 'theme-dark',
    logoSrc: '/icons/Dashie_Full_Logo_White_Transparent.png'
  },
  [THEMES.LIGHT]: {
    name: 'Light Theme', 
    className: 'theme-light',
    logoSrc: '/icons/Dashie_Full_Logo_Black_Transparent.png'
  }
};

// ---------------------
// THEME STATE
// ---------------------

let currentTheme = null; // Default fallback theme
let isInitialized = false;
let settingsSystem = null;

// ---------------------
// SETTINGS INTEGRATION
// ---------------------

/**
 * Initialize connection to the new modular settings system
 */
async function initializeSettingsConnection() {
  if (settingsSystem) return settingsSystem;

  try {
    // Wait for settings system to be available
    const { getSettingValue, setSettingValue, isSettingsReady } = await import('../settings/settings-main.js');
    
    // Wait up to 5 seconds for settings to be ready
    let attempts = 0;
    while (!isSettingsReady() && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (isSettingsReady()) {
      settingsSystem = { getSettingValue, setSettingValue };
      logger.info('Connected to modular settings system');
      return settingsSystem;
    } else {
      logger.warn('Settings system not ready, using fallback storage');
      return null;
    }
  } catch (error) {
    logger.warn('Failed to connect to settings system:', error.message);
    return null;
  }
}

/**
 * Load theme from the new settings system with fallback to localStorage
 */
async function loadSavedTheme() {
  // Try to get from new settings system first
  if (settingsSystem) {
    try {
      const savedTheme = settingsSystem.getSettingValue('display.theme', THEMES.DARK);
      if (savedTheme && Object.values(THEMES).includes(savedTheme)) {
        logger.debug('Theme loaded from settings system:', savedTheme);
        return savedTheme;
      }
    } catch (error) {
      logger.warn('Failed to load theme from settings system:', error.message);
    }
  }

  // Fallback to localStorage for immediate theme application
  try {
    const storage = (() => {
      try { return localStorage; } 
      catch (e) { return { getItem: () => null }; }
    })();
    
    const saved = storage.getItem('dashie-theme');
    if (saved && Object.values(THEMES).includes(saved)) {
      logger.debug('Theme loaded from localStorage fallback:', saved);
      return saved;
    }
  } catch (error) {
    logger.warn('Failed to load theme from localStorage:', error.message);
  }

  logger.debug('Using default theme:', THEMES.DARK);
  return THEMES.DARK;
}

/**
 * Save theme to both settings system and localStorage
 */
async function saveTheme(theme) {
  const saves = [];

  // Save to new settings system
  if (settingsSystem) {
    try {
      const success = settingsSystem.setSettingValue('display.theme', theme);
      if (success) {
        saves.push('settings system');
        logger.debug('Theme saved to settings system:', theme);
      }
    } catch (error) {
      logger.warn('Failed to save theme to settings system:', error.message);
    }
  }

  // Always save to localStorage as backup
  try {
    const storage = (() => {
      try { return localStorage; } 
      catch (e) { return { setItem: () => {} }; }
    })();
    
    storage.setItem('dashie-theme', theme);
    saves.push('localStorage');
    logger.debug('Theme saved to localStorage:', theme);
  } catch (error) {
    logger.warn('Failed to save theme to localStorage:', error.message);
  }

  if (saves.length > 0) {
    logger.info(`Theme saved to: ${saves.join(', ')}`);
  } else {
    logger.error('Failed to save theme to any storage system');
  }
}

// ---------------------
// WIDGET THEME APPLICATION
// ---------------------

function canAccessIframe(iframe) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    return doc !== null && doc !== undefined;
  } catch (error) {
    return false;
  }
}

function applyThemeClassToWidget(iframe, theme) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc || !doc.body) {
      logger.warn('Cannot access iframe body for theme application');
      return false;
    }

    // Remove all existing theme classes
    Object.values(THEMES).forEach(t => {
      doc.body.classList.remove(`theme-${t}`);
    });
    
    // Add new theme class (CSS variables will handle the rest)
    doc.body.classList.add(`theme-${theme}`);
    
    logger.debug('Theme class applied to widget:', theme);
    return true;

  } catch (error) {
    logger.warn('Theme class application failed:', error.message);
    return false;
  }
}

function sendThemeViaPostMessage(iframe, theme) {
  if (!iframe.contentWindow) return;
  
  try {
    iframe.contentWindow.postMessage({
      type: 'theme-change',
      theme: theme,
      themeClass: `theme-${theme}`,
      themeConfig: THEME_CONFIG[theme]
    }, '*');
    logger.debug(`Sent ${theme} theme via postMessage`);
  } catch (error) {
    logger.warn('PostMessage failed:', error.message);
  }
}

function applyThemeToNewWidget(iframe) {
  if (!iframe) return;
  
  const attemptThemeApplication = () => {
    const classSuccess = applyThemeClassToWidget(iframe, currentTheme);
    sendThemeViaPostMessage(iframe, currentTheme);
    
    if (!classSuccess) {
      logger.debug('Will retry theme application in 100ms');
      setTimeout(attemptThemeApplication, 100);
    }
  };
  
  // Wait for iframe to load, then apply theme
  if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
    attemptThemeApplication();
  } else {
    iframe.addEventListener('load', attemptThemeApplication);
  }
}

function notifyWidgetsThemeChange(theme) {
  const iframes = document.querySelectorAll('iframe.widget-iframe');
  let successCount = 0;
  
  iframes.forEach(iframe => {
    const classSuccess = applyThemeClassToWidget(iframe, theme);
    sendThemeViaPostMessage(iframe, theme);
    if (classSuccess) successCount++;
  });
  
  logger.info(`Theme applied to ${successCount}/${iframes.length} widgets`);
  
  // Retry failed widgets after a delay
  setTimeout(() => {
    const retryIframes = document.querySelectorAll('iframe.widget-iframe');
    retryIframes.forEach(iframe => {
      if (canAccessIframe(iframe)) {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc && doc.body && !doc.body.classList.contains(`theme-${theme}`)) {
          applyThemeClassToWidget(iframe, theme);
          logger.debug('Retried theme application for widget');
        }
      }
    });
  }, 100);
}

// ---------------------
// THEME APPLICATION
// ---------------------

function updateLogo(theme) {
  const logo = document.querySelector('.dashie-logo');
  if (logo) {
    logo.src = THEME_CONFIG[theme].logoSrc;
    logger.debug(`Logo updated for ${theme} theme`);
  } else {
    logger.debug('Dashie logo element not found - will retry');
    // Retry after a short delay if logo element doesn't exist yet
    setTimeout(() => {
      const retryLogo = document.querySelector('.dashie-logo');
      if (retryLogo) {
        retryLogo.src = THEME_CONFIG[theme].logoSrc;
        logger.debug(`Logo updated on retry for ${theme} theme`);
      } else {
        logger.warn('Logo element still not found after retry');
      }
    }, 200);
  }
}

function applyThemeToBody(theme) {
  const body = document.body;
  
  // Remove all existing theme classes
  Object.values(THEMES).forEach(t => {
    body.classList.remove(`theme-${t}`);
  });
  
  // Add the new theme class
  body.classList.add(`theme-${theme}`);
  
  logger.debug(`Body theme class applied: theme-${theme}`);
}

function preventTransitionsOnLoad() {
  document.body.classList.add('no-transitions');
  setTimeout(() => {
    document.body.classList.remove('no-transitions');
  }, 200); // Increased timeout to ensure theme is fully applied
}

// ---------------------
// WIDGET COMMUNICATION
// ---------------------

function initializeWidgetCommunication() {
  // Listen for widget requests for current theme
  window.addEventListener('message', (event) => {
    if (event.data.type === 'request-theme') {
      const iframe = Array.from(document.querySelectorAll('iframe.widget-iframe'))
        .find(frame => frame.contentWindow === event.source);
      
      if (iframe) {
        sendThemeViaPostMessage(iframe, currentTheme);
        logger.debug('Sent theme to requesting widget');
      }
    }
  });
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
    logger.warn(`Invalid theme: ${newTheme}`);
    return false;
  }
  
  logger.info(`Switching theme from ${currentTheme} to ${newTheme}`);
  
  currentTheme = newTheme;
  
  // Apply theme changes
  applyThemeToBody(newTheme);
  updateLogo(newTheme);
  await saveTheme(newTheme);
  
  // Notify widgets about theme change
  notifyWidgetsThemeChange(newTheme);
  
  // Emit theme change event for other systems
  eventSystem.emit(EVENTS.THEME_CHANGED, { theme: newTheme });
  
  logger.info(`Theme switched to: ${THEME_CONFIG[newTheme].name}`);
  return true;
}

export async function initializeThemeSystem() {
  if (isInitialized) {
    logger.debug('Theme system already initialized');
    return;
  }

  logger.info('Initializing theme system');

  try {
    // Initialize connection to settings system
    await initializeSettingsConnection();

    // Load theme from settings system or fallback storage
    const savedTheme = await loadSavedTheme();
    currentTheme = savedTheme;

    // Apply theme before preventing transitions to avoid flash
    applyThemeToBody(currentTheme);
    preventTransitionsOnLoad();
    
    // Initialize widget communication
    initializeWidgetCommunication();
    
    // Apply theme to any existing widgets
    setTimeout(() => {
      notifyWidgetsThemeChange(currentTheme);
    }, 500);
    
    // Update logo with multiple retries to ensure sidebar is rendered
    updateLogo(currentTheme);
    setTimeout(() => updateLogo(currentTheme), 300);
    setTimeout(() => updateLogo(currentTheme), 600);

    // Listen for settings system theme changes
    eventSystem.on(EVENTS.SETTINGS_CHANGED, (data) => {
      if (data.path === 'display.theme' && data.value !== currentTheme) {
        logger.info('Theme change detected from settings system');
        switchTheme(data.value);
      }
    });

    isInitialized = true;
    logger.info('Theme system initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize theme system:', error);
    // Apply fallback theme to prevent broken UI
    applyThemeToBody(THEMES.DARK);
    currentTheme = THEMES.DARK;
    isInitialized = true;
  }
}

export function applyThemeToWidget(iframe) {
  applyThemeToNewWidget(iframe);
}

// ---------------------
// EARLY THEME APPLICATION (prevents flash)
// ---------------------

/**
 * Apply theme as early as possible - before main initialization
 * This prevents theme flash on page load
 */
export async function applyThemeBeforeLoad() {
  try {
    // Quick theme loading without full initialization
    const savedTheme = await loadSavedTheme();
    currentTheme = savedTheme;
    
    // Apply theme class immediately to prevent flash
    applyThemeToBody(currentTheme);
    
    logger.debug('Early theme applied:', savedTheme);
  } catch (error) {
    logger.warn('Early theme application failed:', error);
    // Apply fallback theme
    applyThemeToBody(THEMES.DARK);
    currentTheme = THEMES.DARK;
  }
}

// ---------------------
// THEME UTILITIES
// ---------------------

export function isDarkTheme() {
  return currentTheme === THEMES.DARK;
}

export function isLightTheme() {
  return currentTheme === THEMES.LIGHT;
}

export function getThemeDisplayName(theme = currentTheme) {
  return THEME_CONFIG[theme]?.name || 'Unknown Theme';
}

// ---------------------
// EARLY THEME APPLICATION (prevents flash)
// ---------------------

// Apply theme as early as possible - even before main initialization
if (typeof window !== 'undefined') {
  // Run immediately when script loads
  applyThemeBeforeLoad();
}