// js/settings/settings-templates-features.js
// CHANGE SUMMARY: Fixed toggle initialization to read from loaded FEATURES object

import { getFeatureDefinitions, isFeatureEnabled } from '../core/feature-flags.js';

/**
 * Generate Features (Beta) menu item for System screen
 */
export function getFeaturesMenuItem() {
  return `
    <div class="settings-cell" data-navigate="features">
      <div class="cell-content">
        <span class="cell-label">Features (Beta)</span>
      </div>
      <span class="cell-chevron">›</span>
    </div>
  `;
}

/**
 * Generate Features screen with all available feature flags
 * Dynamically builds toggle switches based on FEATURE_DEFINITIONS
 */
export function getFeaturesScreen() {
  const features = getFeatureDefinitions();
  
  const featureToggles = features.map(feature => {
    // Use isFeatureEnabled to get the actual current state from loaded FEATURES
    const isEnabled = isFeatureEnabled(feature.name);
    
    return `
    <div class="settings-cell toggle-cell">
      <div class="cell-content">
        <span class="cell-label">${feature.label}</span>
        ${feature.description ? `<span class="cell-description">${feature.description}</span>` : ''}
      </div>
      <label class="toggle-switch">
        <input type="checkbox" 
               id="feature-${feature.name}" 
               data-feature="${feature.name}"
               ${isEnabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
  }).join('');
  
  return `
    <div class="settings-screen" data-level="2" data-screen="features" data-title="Features (Beta)">
      <div class="settings-list">
        <div class="settings-section">
          <div class="section-header">EXPERIMENTAL FEATURES</div>
          <div class="beta-notice">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>These features are experimental. Toggle them on/off to compare with the original behavior. Changes take effect immediately.</span>
          </div>
          ${featureToggles}
        </div>
        
        <div class="settings-section">
          <div class="settings-cell action-cell" id="reset-features-btn">
            <span class="cell-label" style="color: #FF3B30;">Reset All Features to Defaults</span>
          </div>
        </div>
      </div>
    </div>
  `;
}