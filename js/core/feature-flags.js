// js/core/feature-flags.js - Experimental Feature Configuration
// CHANGE SUMMARY: Feature flag system with localStorage persistence and UI generation

/**
 * Feature Flags Configuration
 * 
 * Control experimental features here. Set to true to enable, false to use legacy behavior.
 * 
 * TO TOGGLE A FEATURE:
 * 1. Change the flag value below
 * 2. Reload the dashboard (or toggle in Settings > System > Features)
 * 3. No other code changes needed!
 * 
 * Each feature should have:
 * - name: Machine-readable key (UPPER_SNAKE_CASE)
 * - label: Human-readable title for settings UI
 * - description: Brief explanation of what the feature does
 * - default: Initial state (true/false)
 */

export const FEATURE_DEFINITIONS = [
  {
    name: 'ENHANCED_FOCUS_MODE',
    label: 'Enhanced Focus Mode',
    description: 'Larger selection (105%), thicker silver border (6px), and semi-transparent overlay when focusing widgets. Original: 102% scale, 2px orange border, no overlay.',
    default: true,
    category: 'ui'
  },
  // Future features:
  // {
  //   name: 'INTERACTIVE_WIDGETS',
  //   label: 'Interactive Widget Mode',
  //   description: 'Hold to activate interactive mode with side menu controls',
  //   default: false,
  //   category: 'ui'
  // },
];

/**
 * Get feature flag values from localStorage or defaults
 */
function loadFeatureFlags() {
  const stored = localStorage.getItem('dashie-feature-flags');
  const flags = {};
  
  // Initialize with defaults
  FEATURE_DEFINITIONS.forEach(feature => {
    flags[feature.name] = feature.default;
  });
  
  // Override with stored values if they exist
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      Object.assign(flags, parsed);
    } catch (e) {
      console.warn('Failed to parse stored feature flags:', e);
    }
  }
  
  return flags;
}

/**
 * Save feature flag values to localStorage
 */
function saveFeatureFlags(flags) {
  try {
    localStorage.setItem('dashie-feature-flags', JSON.stringify(flags));
    console.log('💾 Feature flags saved:', flags);
  } catch (e) {
    console.error('Failed to save feature flags:', e);
  }
}

// Load flags on module initialization
export const FEATURES = loadFeatureFlags();

/**
 * Get the current value of a feature flag
 * @param {string} featureName - Name of the feature
 * @returns {boolean} Whether the feature is enabled
 */
export function isFeatureEnabled(featureName) {
  return FEATURES[featureName] ?? false;
}

/**
 * Set a feature flag value and optionally save
 * @param {string} featureName - Name of the feature
 * @param {boolean} enabled - New state
 * @param {boolean} persist - Whether to save to localStorage (default: true)
 */
export function setFeature(featureName, enabled, persist = true) {
  FEATURES[featureName] = enabled;
  
  if (persist) {
    saveFeatureFlags(FEATURES);
  }
  
  console.log(`🎛️ Feature ${featureName} set to:`, enabled);
}

/**
 * Get all feature definitions (for building UI)
 * @returns {Array} Array of feature definition objects
 */
export function getFeatureDefinitions() {
  return FEATURE_DEFINITIONS.map(def => ({
    ...def,
    enabled: FEATURES[def.name]
  }));
}

/**
 * Get all feature flag states (useful for debugging)
 * @returns {Object} All feature flags and their states
 */
export function getAllFeatures() {
  return { ...FEATURES };
}

/**
 * Reset all features to their defaults
 */
export function resetFeaturesToDefaults() {
  FEATURE_DEFINITIONS.forEach(feature => {
    FEATURES[feature.name] = feature.default;
  });
  saveFeatureFlags(FEATURES);
  console.log('🔄 All features reset to defaults');
}

/**
 * Log feature flag status to console (useful for debugging)
 */
export function logFeatureStatus() {
  console.group('🚀 Feature Flags Status');
  Object.entries(FEATURES).forEach(([name, enabled]) => {
    console.log(`${enabled ? '✅' : '❌'} ${name}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  });
  console.groupEnd();
}

// Auto-log on import during development (comment out for production)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  logFeatureStatus();
}