// config.js - Application Configuration & Default Values
// Single source of truth for all configuration and defaults
// v1.0 - 10/15/25 - Initial implementation for refactored architecture

/**
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for all default values
 * Any default setting values should be defined here and referenced throughout the app
 * DO NOT hardcode default values elsewhere - import from this file instead
 */

// =============================================================================
// APPLICATION METADATA
// =============================================================================

export const APP_VERSION = '2.0.0';
export const APP_NAME = 'Dashie';
export const APP_DESCRIPTION = 'Smart Home Dashboard';

// =============================================================================
// PLATFORM DETECTION
// =============================================================================

export const PLATFORMS = {
  TV: 'tv',
  DESKTOP: 'desktop',
  MOBILE: 'mobile'
};

// =============================================================================
// MODULE NAMES
// =============================================================================

export const MODULES = {
  DASHBOARD: 'dashboard',
  SETTINGS: 'settings',
  LOGIN: 'login',
  MODALS: 'modals',
  WELCOME: 'welcome'
};

// =============================================================================
// FOCUS CONTEXTS
// =============================================================================

export const FOCUS_CONTEXTS = {
  GRID: 'grid',
  MENU: 'menu',
  WIDGET: 'widget',
  MODAL: 'modal'
};

// =============================================================================
// THEMES
// =============================================================================

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

export const DEFAULT_THEME = THEMES.LIGHT;

// =============================================================================
// DEFAULT SETTINGS - SINGLE SOURCE OF TRUTH
// =============================================================================

/**
 * Get default settings object
 * This is the DEFINITIVE source for all default values
 * @param {string} userEmail - User's email address (optional, defaults to placeholder)
 * @returns {Object} Complete default settings object
 */
export function getDefaultSettings(userEmail = 'unknown@example.com') {
  return {
    // Photo Widget Settings
    photos: {
      transitionTime: DEFAULT_PHOTO_TRANSITION_TIME
    },

    // Interface Settings
    interface: {
      sidebarMode: DEFAULT_SIDEBAR_MODE,
      sleepTime: DEFAULT_SLEEP_TIME,
      wakeTime: DEFAULT_WAKE_TIME,
      reSleepDelay: DEFAULT_RESLEEP_DELAY,
      sleepTimerEnabled: DEFAULT_SLEEP_TIMER_ENABLED,
      theme: DEFAULT_THEME,
      dynamicGreeting: DEFAULT_DYNAMIC_GREETING
    },

    // Account Settings
    accounts: {
      dashieAccount: userEmail,
      connectedServices: [],
      pinEnabled: false
    },

    // Family Settings
    family: {
      familyName: DEFAULT_FAMILY_NAME,
      members: [],
      zipCode: '',
      latitude: null,
      longitude: null
    },

    // System Settings
    system: {
      refreshInterval: DEFAULT_REFRESH_INTERVAL,
      calendarRefreshInterval: DEFAULT_CALENDAR_REFRESH_INTERVAL
    },

    // Metadata
    version: APP_VERSION,
    lastModified: Date.now()
  };
}

// =============================================================================
// INTERFACE DEFAULTS
// =============================================================================

export const DEFAULT_SIDEBAR_MODE = 'plus'; // 'core' or 'plus'
export const DEFAULT_SLEEP_TIME = '22:00';
export const DEFAULT_WAKE_TIME = '07:00';
export const DEFAULT_RESLEEP_DELAY = 10; // minutes
export const DEFAULT_SLEEP_TIMER_ENABLED = false;
export const DEFAULT_DYNAMIC_GREETING = false;

// =============================================================================
// FAMILY DEFAULTS
// =============================================================================

export const DEFAULT_FAMILY_NAME = 'Dashie';

// =============================================================================
// WIDGET DEFAULTS
// =============================================================================

export const DEFAULT_PHOTO_TRANSITION_TIME = 5; // seconds

// Grid configuration
export const GRID_ROWS = 2;
export const GRID_COLS = 3;
export const GRID_TOTAL_SLOTS = GRID_ROWS * GRID_COLS;

// =============================================================================
// TIMING DEFAULTS
// =============================================================================

// Data refresh intervals (in minutes)
export const DEFAULT_REFRESH_INTERVAL = 30;
export const DEFAULT_CALENDAR_REFRESH_INTERVAL = 5;

// Selection timeouts (in seconds)
export const SELECTION_TIMEOUT = 20;
export const FOCUS_TIMEOUT = 60;

// Auto-save delay (in milliseconds)
export const AUTO_SAVE_DELAY = 2000;

// =============================================================================
// JWT & AUTH DEFAULTS
// =============================================================================

// JWT refresh thresholds
export const JWT_EXPIRY_HOURS = 72; // Server-side JWT expiry
export const JWT_REFRESH_THRESHOLD_HOURS = 24; // Refresh when 24 hours remaining
export const JWT_ON_DEMAND_THRESHOLD_MINUTES = 60; // Refresh if <60 min remaining

// OAuth token cache
export const OAUTH_TOKEN_CACHE_BUFFER_MINUTES = 10;

// Session timeout
export const SESSION_TIMEOUT_HOURS = 24;

// =============================================================================
// HEARTBEAT CONFIGURATION
// =============================================================================

// Heartbeat frequency (how often to ping server with status)
// Options: 60000 (1 min), 300000 (5 min), 900000 (15 min)
export const HEARTBEAT_FREQUENCY_MS = 60000; // 60 seconds (1 minute)

// Offline detection threshold (dashboard marked offline if no heartbeat)
// Should be 2-3x heartbeat frequency for safety
export const HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 5; // Mark offline after 5 min

// Version check behavior
export const HEARTBEAT_VERSION_CHECK_ENABLED = true;
export const HEARTBEAT_AUTO_UPDATE_PROMPT = true; // Show update prompt automatically

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const STORAGE_KEYS = {
  // Settings
  SETTINGS: 'dashie-settings',
  CALENDAR_SETTINGS: 'dashie-calendar-settings',

  // Auth
  JWT: 'dashie-supabase-jwt',
  AUTH_TOKENS: 'dashie-auth-tokens',

  // Logger
  LOG_CONFIG: 'dashie-log-config',
  LOG_BUFFER: 'dashie-log-buffer',

  // Debug
  DEBUG_MODE: 'dashie-debug',
  LOG_LEVEL: 'dashie-log-level',

  // State
  APP_STATE: 'dashie-app-state',
  LAST_MODULE: 'dashie-last-module',
  DASHBOARD_STATE: 'dashie-dashboard-state'
};

// =============================================================================
// CACHE LIMITS
// =============================================================================

// Log buffer limits
export const MAX_LOG_BUFFER_SIZE = 200;
export const LOG_BUFFER_SAVE_DELAY = 2000; // milliseconds

// Settings staleness threshold
export const SETTINGS_STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// =============================================================================
// API CONFIGURATION
// =============================================================================

// Retry configuration
export const API_MAX_RETRIES = 3;
export const API_RETRY_DELAY_MS = 1000;
export const API_RETRY_BACKOFF_MULTIPLIER = 2;

// Rate limiting
export const API_RATE_LIMIT_REQUESTS_PER_MINUTE = 60;

// =============================================================================
// WIDGET CONFIGURATION
// =============================================================================

// Widget message types
export const WIDGET_MESSAGE_TYPES = {
  COMMAND: 'command',
  DATA: 'data',
  CONFIG: 'config',
  EVENT: 'event'
};

// Widget commands
export const WIDGET_COMMANDS = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  ENTER: 'enter',
  ESCAPE: 'escape',
  ENTER_FOCUS: 'enter-focus',
  EXIT_FOCUS: 'exit-focus',
  ENTER_ACTIVE: 'enter-active',
  EXIT_ACTIVE: 'exit-active'
};

// Widget event types
export const WIDGET_EVENT_TYPES = {
  WIDGET_READY: 'widget-ready',
  RETURN_TO_MENU: 'return-to-menu',
  SETTINGS_REQUESTED: 'settings-requested',
  DATA_REQUESTED: 'data-requested'
};

// =============================================================================
// LOGGING CONFIGURATION
// =============================================================================

export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

export const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;

export const DEFAULT_LOG_CONFIG = {
  level: DEFAULT_LOG_LEVEL,
  enableTimestamps: true,
  enableModuleNames: true,
  enableColors: true,
  enableApiLogging: false,
  enableAuthLogging: true,
  enableDataLogging: true,
  enableWidgetLogging: true,
  enableBuffering: false  // DISABLED by default
};

// =============================================================================
// DASHBOARD CONFIGURATION
// =============================================================================

// Menu items
export const DASHBOARD_MENU_ITEMS = [
  { id: 'refresh', label: 'Refresh', icon: '🔄' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'sleep', label: 'Sleep', icon: '😴' },
  { id: 'wake', label: 'Wake', icon: '👋' },
  { id: 'help', label: 'Help', icon: '❓' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
  { id: 'logout', label: 'Logout', icon: '🚪' }
];

// =============================================================================
// SETTINGS CONFIGURATION
// =============================================================================

// Settings categories
export const SETTINGS_CATEGORIES = [
  { id: 'accounts', label: '🔐 Accounts', icon: '🔐', enabled: true },
  { id: 'family', label: '👨‍👩‍👧‍👦 Family', icon: '👨‍👩‍👧‍👦', enabled: false },
  { id: 'widgets', label: '🖼️ Widgets', icon: '🖼️', enabled: true },
  { id: 'display', label: '🎨 Display', icon: '🎨', enabled: true },
  { id: 'system', label: '🔧 System', icon: '🔧', enabled: true },
  { id: 'about', label: 'ℹ️ About', icon: 'ℹ️', enabled: false }
];

// Local-only settings (device-specific, not synced to cloud)
export const LOCAL_ONLY_SETTINGS = [
  'system.autoRedirect',
  'system.debugMode'
];

// =============================================================================
// SUPABASE CONFIGURATION
// =============================================================================

// These should be loaded from environment variables in production
export const SUPABASE_CONFIG = {
  // URL and keys should come from environment
  // This is just the structure - actual values loaded at runtime
  url: null,
  anonKey: null,

  // Edge function names
  edgeFunctions: {
    getJWT: 'get-jwt',
    refreshJWT: 'refresh-jwt',
    storeTokens: 'store-tokens',
    loadSettings: 'load-settings',
    saveSettings: 'save-settings'
  }
};

// =============================================================================
// GOOGLE API CONFIGURATION
// =============================================================================

export const GOOGLE_API_CONFIG = {
  // Client ID should come from environment
  clientId: null,

  // Scopes
  scopes: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/photoslibrary.readonly'
  ],

  // Discovery docs
  discoveryDocs: [
    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
    'https://photoslibrary.googleapis.com/$discovery/rest?version=v1'
  ]
};

// =============================================================================
// ERROR MESSAGES
// =============================================================================

export const ERROR_MESSAGES = {
  AUTH: {
    NOT_AUTHENTICATED: 'User is not authenticated',
    SESSION_EXPIRED: 'Session has expired',
    INVALID_CREDENTIALS: 'Invalid credentials',
    JWT_REFRESH_FAILED: 'Failed to refresh JWT token'
  },

  SETTINGS: {
    NOT_INITIALIZED: 'Settings not initialized',
    SAVE_FAILED: 'Failed to save settings',
    LOAD_FAILED: 'Failed to load settings',
    INVALID_PATH: 'Invalid setting path'
  },

  WIDGET: {
    NOT_FOUND: 'Widget not found',
    LOAD_FAILED: 'Failed to load widget',
    COMMUNICATION_FAILED: 'Widget communication failed'
  },

  MODULE: {
    NOT_FOUND: 'Module not found',
    INIT_FAILED: 'Module initialization failed',
    ACTIVATION_FAILED: 'Module activation failed'
  }
};

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const FEATURE_FLAGS = {
  ENABLE_TELEMETRY: true,
  ENABLE_CRASH_REPORTING: true,
  ENABLE_ANALYTICS: false,
  ENABLE_BETA_FEATURES: false,
  ENABLE_DEBUG_OVERLAY: false
};

// =============================================================================
// VALIDATION RULES
// =============================================================================

export const VALIDATION = {
  familyName: {
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9\s'-]+$/
  },

  zipCode: {
    pattern: /^\d{5}(-\d{4})?$/
  },

  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },

  timeFormat: {
    pattern: /^([01]\d|2[0-3]):([0-5]\d)$/
  }
};

// =============================================================================
// EXPORT ALL AS DEFAULT FOR CONVENIENCE
// =============================================================================

export default {
  // Metadata
  APP_VERSION,
  APP_NAME,
  APP_DESCRIPTION,

  // Enums
  PLATFORMS,
  MODULES,
  FOCUS_CONTEXTS,
  THEMES,

  // Defaults
  DEFAULT_THEME,
  getDefaultSettings,

  // Interface
  DEFAULT_SIDEBAR_MODE,
  DEFAULT_SLEEP_TIME,
  DEFAULT_WAKE_TIME,
  DEFAULT_RESLEEP_DELAY,
  DEFAULT_SLEEP_TIMER_ENABLED,
  DEFAULT_DYNAMIC_GREETING,

  // Family
  DEFAULT_FAMILY_NAME,

  // Widgets
  DEFAULT_PHOTO_TRANSITION_TIME,
  GRID_ROWS,
  GRID_COLS,
  GRID_TOTAL_SLOTS,

  // Timing
  DEFAULT_REFRESH_INTERVAL,
  DEFAULT_CALENDAR_REFRESH_INTERVAL,
  SELECTION_TIMEOUT,
  FOCUS_TIMEOUT,
  AUTO_SAVE_DELAY,

  // JWT & Auth
  JWT_EXPIRY_HOURS,
  JWT_REFRESH_THRESHOLD_HOURS,
  JWT_ON_DEMAND_THRESHOLD_MINUTES,
  OAUTH_TOKEN_CACHE_BUFFER_MINUTES,
  SESSION_TIMEOUT_HOURS,

  // Heartbeat
  HEARTBEAT_FREQUENCY_MS,
  HEARTBEAT_OFFLINE_THRESHOLD_MINUTES,
  HEARTBEAT_VERSION_CHECK_ENABLED,
  HEARTBEAT_AUTO_UPDATE_PROMPT,

  // Storage
  STORAGE_KEYS,

  // Cache
  MAX_LOG_BUFFER_SIZE,
  LOG_BUFFER_SAVE_DELAY,
  SETTINGS_STALE_THRESHOLD_MS,

  // API
  API_MAX_RETRIES,
  API_RETRY_DELAY_MS,
  API_RETRY_BACKOFF_MULTIPLIER,
  API_RATE_LIMIT_REQUESTS_PER_MINUTE,

  // Widget
  WIDGET_MESSAGE_TYPES,
  WIDGET_COMMANDS,
  WIDGET_EVENT_TYPES,

  // Logging
  LOG_LEVELS,
  DEFAULT_LOG_LEVEL,
  DEFAULT_LOG_CONFIG,

  // Dashboard
  DASHBOARD_MENU_ITEMS,

  // Settings
  SETTINGS_CATEGORIES,
  LOCAL_ONLY_SETTINGS,

  // Supabase
  SUPABASE_CONFIG,

  // Google API
  GOOGLE_API_CONFIG,

  // Errors
  ERROR_MESSAGES,

  // Features
  FEATURE_FLAGS,

  // Validation
  VALIDATION
};
