// js/auth/auth-config.js - Simple Auth Configuration (Keep existing + add logging config)
// CHANGE SUMMARY: Keep existing client_secret, add logging configuration for new logging system

/**
 * Supabase Configuration - Environment-based
 * NOTE: Supabase anon key is SAFE to expose in client code - it's public by design
 * Only the service role key must be kept secret (server-side only)
 */

// ==========================================
// TEMPORARY: Force dev database for testing
// Set to true to use dev database on prod site
// Set to false to use normal auto-detection
// ==========================================
const FORCE_DEV_DATABASE = true;  // ← Change this to false when prod DB is ready
// ==========================================

const SUPABASE_ENVIRONMENTS = {
  production: {
    url: 'https://cseaywxcvnxcsypaqaid.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzZWF5d3hjdm54Y3N5cGFxYWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MDIxOTEsImV4cCI6MjA3MzE3ODE5MX0.Wnd7XELrtPIDKeTcHVw7dl3awn3BlI0z9ADKPgSfHhA',
    edgeFunctionUrl: 'https://cseaywxcvnxcsypaqaid.supabase.co/functions/v1/jwt-auth',
    googleWebClientId: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
    googleDeviceClientId: '221142210647-m9vf7t0qgm6nlc6gggfsqefmjrak1mo9.apps.googleusercontent.com',
    environment: 'production'
  },
  development: {
    url: 'https://cwglbtosingboqepsmjk.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3Z2xidG9zaW5nYm9xZXBzbWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NDY4NjYsImV4cCI6MjA3MzIyMjg2Nn0.VCP5DSfAwwZMjtPl33bhsixSiu_lHsM6n42FMJRP3YA',
    edgeFunctionUrl: 'https://cwglbtosingboqepsmjk.supabase.co/functions/v1/jwt-auth',
    googleWebClientId: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
    googleDeviceClientId: '221142210647-m9vf7t0qgm6nlc6gggfsqefmjrak1mo9.apps.googleusercontent.com',
    environment: 'development'
  }
};

// Auto-detect environment based on domain
function getCurrentSupabaseConfig() {
  // TEMPORARY: Check override flag first
  if (FORCE_DEV_DATABASE) {
    console.warn('⚠️ OVERRIDE: Using DEV database (FORCE_DEV_DATABASE=true)');
    return SUPABASE_ENVIRONMENTS.development;
  }

  const host = window.location.hostname;
  if (host.includes('dev.') || host === 'localhost' || host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    console.log('🔧 Environment detected: DEVELOPMENT');
    return SUPABASE_ENVIRONMENTS.development;
  }

  console.log('🚀 Environment detected: PRODUCTION');
  return SUPABASE_ENVIRONMENTS.production;
}

export const SUPABASE_CONFIG = getCurrentSupabaseConfig();

/**
 * Authentication Configuration
 * Keep this simple - just the essentials we need
 *
 * NOTE: Client secrets have been removed from client code!
 * They are now stored as environment variables in the edge function where they belong.
 * Client IDs are safe to expose (public by design), but secrets must stay server-side.
 */
export const AUTH_CONFIG = {
  // No secrets here - they belong in edge function environment variables
};

export const API_CONFIG = {
  google: {
    // Base URL for all Google APIs
    baseUrl: 'https://www.googleapis.com',

    // Rate limiting (minimum interval between requests in ms)
    rateLimitInterval: 100, // 100ms between requests

    // Retry configuration for failed requests
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,  // 1 second between retries
      maxDelay: 10000   // 10 seconds max backoff
    },

    // Calendar-specific settings
    calendar: {
      monthsAhead: 3, // originally MONTHS_AHEAD_TO_PULL
      monthsBack: 1,  // originally MONTHS_BACK_TO_PULL
      maxResults: 250, // adjust as needed for your API calls
      includeCalendars: [
      ]
    },
  }
};


/**
 * Logging Configuration for new logging system
 */
export const LOGGING_CONFIG = {
  // Environment detection
  get environment() {
    const hostname = window.location.hostname;
    if (hostname === 'dashieapp.com') return 'production';
    if (hostname === 'dev.dashieapp.com') return 'development';
    return 'development';
  },

  // Log level based on environment
  get level() {
    return this.environment === 'development' ? 'debug' : 'info';
  },
  
  // Category toggles - more verbose in development
  get enableApiLogging() {
    return this.environment === 'development';
  },
  
  enableAuthLogging: true,
  
  get enableDataLogging() {
    return this.environment === 'development';
  },
  
  get enableWidgetLogging() {
    return this.environment === 'development';
  },
  
  // Format options
  enableTimestamps: true,
  enableModuleNames: true,
  enableColors: true
};

// Default export for backward compatibility
export default AUTH_CONFIG;
