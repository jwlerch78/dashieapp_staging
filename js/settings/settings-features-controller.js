// js/settings/settings-features-controller.js
// CHANGE SUMMARY: Handle feature flag toggle interactions and apply changes

import { setFeature, resetFeaturesToDefaults, getFeatureDefinitions, isFeatureEnabled } from '../core/feature-flags.js';

/**
 * Sync toggle UI with actual localStorage values
 * @param {HTMLElement} overlay - Settings overlay element
 */
function syncTogglesWithStorage(overlay) {
  const features = getFeatureDefinitions();
  
  features.forEach(feature => {
    const toggle = overlay.querySelector(`#feature-${feature.name}`);
    if (toggle) {
      const actualValue = isFeatureEnabled(feature.name);
      if (toggle.checked !== actualValue) {
        console.log(`🔄 Syncing toggle ${feature.name}: ${toggle.checked} → ${actualValue}`);
        toggle.checked = actualValue;
      }
    }
  });
}

/**
 * Setup feature toggle event listeners
 * @param {HTMLElement} overlay - Settings overlay element
 */
/**
 * Setup feature toggle event listeners
 * @param {HTMLElement} overlay - Settings overlay element
 */
export function setupFeatureToggles(overlay) {
  console.log('🎛️ setupFeatureToggles called with overlay:', overlay);
  
  // Find all feature toggle checkboxes
  const featureToggles = overlay.querySelectorAll('input[data-feature]');
  console.log(`🎛️ Found ${featureToggles.length} feature toggles:`, featureToggles);
  
  // Sync toggles with current state from localStorage
  syncTogglesWithStorage(overlay);
  
  featureToggles.forEach(toggle => {
    console.log(`🎛️ Attaching listener to toggle:`, toggle.dataset.feature, 'checked:', toggle.checked);
    
    toggle.addEventListener('change', (e) => {
      const featureName = e.target.dataset.feature;
      const enabled = e.target.checked;
      
      console.log(`🎛️ ⚡ CHANGE EVENT FIRED for ${featureName}, new value:`, enabled);
      
      // Save the feature state
      setFeature(featureName, enabled, true);
      
      // Apply the change immediately
      applyFeatureChange(featureName, enabled);
      
      // Show feedback
      showFeatureChangeToast(featureName, enabled);
    });
  });
  
  // Setup reset button
  const resetBtn = overlay.querySelector('#reset-features-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      handleResetFeatures(overlay);
    });
  }
}

/**
 * Apply feature change immediately without page reload
 * @param {string} featureName - Name of the feature
 * @param {boolean} enabled - New state
 */
function applyFeatureChange(featureName, enabled) {
  switch (featureName) {
    case 'ENHANCED_FOCUS_MODE':
      applyEnhancedFocusMode(enabled);
      break;
    
    // Future features can be added here
    default:
      console.warn(`No apply handler for feature: ${featureName}`);
  }
}

/**
 * Apply enhanced focus mode changes
 * @param {boolean} enabled - Whether to enable enhanced mode
 */
function applyEnhancedFocusMode(enabled) {
  if (enabled) {
    document.body.classList.remove('legacy-focus');
    console.log('🚀 Switched to ENHANCED focus mode');
  } else {
    document.body.classList.add('legacy-focus');
    console.log('📊 Switched to LEGACY focus mode');
  }
  
  // Hide overlay if switching to legacy mode
  const overlay = document.getElementById('focus-overlay');
  if (overlay && !enabled) {
    overlay.classList.remove('visible');
  }
  
  // If there's currently a focused widget, update its appearance
  const focusedWidget = document.querySelector('.widget.focused');
  if (focusedWidget) {
    // Trigger a reflow to apply new styles
    focusedWidget.style.display = 'none';
    focusedWidget.offsetHeight; // Force reflow
    focusedWidget.style.display = '';
    
    // Show overlay if switching to enhanced mode and widget is focused
    if (overlay && enabled) {
      overlay.classList.add('visible');
    }
  }
}

/**
 * Show toast notification for feature change
 * @param {string} featureName - Name of the feature
 * @param {boolean} enabled - New state
 */
function showFeatureChangeToast(featureName, enabled) {
  // Find feature definition for friendly label
  const features = getFeatureDefinitions();
  const feature = features.find(f => f.name === featureName);
  const label = feature?.label || featureName;
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'feature-toast';
  toast.innerHTML = `
    <span class="toast-icon">${enabled ? '✅' : '❌'}</span>
    <span class="toast-text">${label} ${enabled ? 'enabled' : 'disabled'}</span>
  `;
  
  // Add to page
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

/**
 * Handle reset all features button
 * @param {HTMLElement} overlay - Settings overlay element
 */
function handleResetFeatures(overlay) {
  // Show confirmation
  const confirmed = confirm('Reset all experimental features to their default values?');
  
  if (confirmed) {
    // Reset features
    resetFeaturesToDefaults();
    
    // Update all toggles in UI
    const features = getFeatureDefinitions();
    features.forEach(feature => {
      const toggle = overlay.querySelector(`#feature-${feature.name}`);
      if (toggle) {
        toggle.checked = feature.enabled;
      }
      
      // Apply changes
      applyFeatureChange(feature.name, feature.enabled);
    });
    
    // Show feedback
    showResetToast();
  }
}

/**
 * Show toast for reset action
 */
function showResetToast() {
  const toast = document.createElement('div');
  toast.className = 'feature-toast';
  toast.innerHTML = `
    <span class="toast-icon">🔄</span>
    <span class="toast-text">Features reset to defaults</span>
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Note: getFeatureToastCss() removed - CSS should be added directly to simplified-settings.css