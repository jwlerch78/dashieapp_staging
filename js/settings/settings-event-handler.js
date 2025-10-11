// js/settings/settings-event-handler.js
// v1.3 - 10/11/25 11:55pm - Added telemetry toggle handler to sync with telemetry service
// v1.2 - 10/9/25 - Added zip code input handler with debounced location display
// v1.1 - 1/9/25 8:20pm - Converted console.log to logger.debug
// CHANGE SUMMARY: Added telemetry toggle to sync settings with telemetry service localStorage

import { createLogger } from '../utils/logger.js';

const logger = createLogger('SettingsEventHandler');

export function setupEventHandlers(overlay, settingsManager) {
  logger.debug('Setting up event handlers');
  
  // CRITICAL: Add global keyboard event capture with high priority
  settingsManager.keydownHandler = (event) => {
    // Only handle if settings modal is visible and active
    if (!settingsManager.isVisible || !overlay.classList.contains('active')) {
      return;
    }

    // CRITICAL: Check if a confirmation modal is on top of settings
    if (window.dashieModalManager && window.dashieModalManager.modalStack.length > 1) {
      logger.debug('Modal is active, not capturing key', { stackLength: window.dashieModalManager.modalStack.length });
      // Don't capture - let the modal handle it
      return;
    }

    logger.debug('Settings captured key', { key: event.key });
    
    // Let the navigation handle it
    // IMPORTANT: Only preventDefault if the navigation HANDLED the key (returned true)
    // If it returns false, that means "don't handle, let browser process normally"
    const handled = settingsManager.navigation && settingsManager.navigation.handleKeyPress(event);
    
    if (handled) {
      // Navigation handled it - prevent default browser behavior
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    // If not handled (returned false), let the event continue normally for text editing
  };

  // Add event listener with capture=true to get events before main navigation
  document.addEventListener('keydown', settingsManager.keydownHandler, true);


  // Listen for form changes and auto-save immediately
  overlay.querySelectorAll('.form-control[data-setting]').forEach(control => {
    control.addEventListener('change', (e) => {
      const path = e.target.dataset.setting;
      let value = e.target.value;
      
      // Handle type conversion
      if (e.target.type === 'number') {
        value = parseInt(value);
      } else if (e.target.type === 'checkbox') {
        value = e.target.checked;
      }
      
      // Auto-save immediately via settings manager
      settingsManager.handleSettingChange(path, value);
    });
  });

  // NEW: Sleep timer toggle handler
  const sleepTimerToggle = overlay.querySelector('#sleep-timer-enabled');
  if (sleepTimerToggle) {
    sleepTimerToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      console.log('⚙️ Sleep timer toggle changed:', enabled);
      
      // Update UI states - import the function dynamically
      const { updateSleepTimerStates } = await import('./settings-ui-builder.js');
      updateSleepTimerStates(overlay, enabled);
      
      // Save setting via settings manager
      if (settingsManager && settingsManager.handleSettingChange) {
        settingsManager.handleSettingChange('display.sleepTimerEnabled', enabled);
      }
    });
    
    console.log('⚙️ Sleep timer toggle handler attached');
  }
  
  // NEW: Dynamic greeting toggle handler
  const dynamicGreetingToggle = overlay.querySelector('#dynamic-greeting-enabled');
  if (dynamicGreetingToggle) {
    dynamicGreetingToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      console.log('⚙️ Dynamic greeting toggle changed:', enabled);
      
      // Save setting via settings manager
      if (settingsManager && settingsManager.handleSettingChange) {
        settingsManager.handleSettingChange('display.dynamicGreeting', enabled);
      }
      
      // Force immediate update of header greeting
      const headerWidgets = document.querySelectorAll('iframe[src*="header.html"]');
      headerWidgets.forEach((iframe) => {
        if (iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'force-greeting-update',
              enabled: enabled
            }, '*');
          } catch (error) {
            console.warn('Failed to send greeting update to header widget:', error);
          }
        }
      });
    });
    
    console.log('⚙️ Dynamic greeting toggle handler attached');
  }
  
  // NEW: Telemetry toggle handler
  const telemetryToggle = overlay.querySelector('#enable-crash-reporting');
  if (telemetryToggle) {
    telemetryToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      console.log('⚙️ 📊 Telemetry toggle changed:', enabled);
      
      // Save setting via settings manager (to database)
      if (settingsManager && settingsManager.handleSettingChange) {
        settingsManager.handleSettingChange('system.telemetryEnabled', enabled);
      }
      
      // CRITICAL: Also update telemetry service directly
      if (window.telemetryService) {
        if (enabled) {
          window.telemetryService.enable();
          console.log('✅ Telemetry service enabled');
        } else {
          window.telemetryService.disable();
          console.log('❌ Telemetry service disabled');
        }
      } else {
        console.warn('⚠️  Telemetry service not available yet');
      }
    });
    
    console.log('⚙️ Telemetry toggle handler attached');
  }
  
  // NEW: Zip code input handler for location display
  const zipCodeInput = overlay.querySelector('#mobile-family-zipcode');
  if (zipCodeInput) {
    // Debounce timer for location lookup
    let zipCodeDebounceTimer = null;
    
    zipCodeInput.addEventListener('input', async (e) => {
      const zipCode = e.target.value;
      
      // Clear previous debounce timer
      if (zipCodeDebounceTimer) {
        clearTimeout(zipCodeDebounceTimer);
      }
      
      // Debounce location lookup (wait 500ms after user stops typing)
      zipCodeDebounceTimer = setTimeout(async () => {
        const { updateZipCodeLocationDisplay } = await import('./settings-ui-builder.js');
        await updateZipCodeLocationDisplay(overlay, zipCode);
      }, 500);
    });
    
    // Listen for auto-detected zip code from geolocation
    window.addEventListener('family-zipcode-updated', async (e) => {
      const detectedZip = e.detail?.zipCode;
      if (detectedZip && zipCodeInput) {
        console.log('⚙️ 🔄 Updating zip code UI with auto-detected value:', detectedZip);
        zipCodeInput.value = detectedZip;
        
        // Update location display
        const { updateZipCodeLocationDisplay } = await import('./settings-ui-builder.js');
        await updateZipCodeLocationDisplay(overlay, detectedZip);
      }
    });
    
    console.log('⚙️ Zip code input handler attached');
  }

  // Prevent clicks from bubbling to main dashboard - but allow interaction within modal
  overlay.addEventListener('click', (e) => {
    e.stopPropagation();
    // Don't prevent default - allow normal click behavior within modal
  });

  console.log('⚙️ ✅ Event handlers set up successfully');
}

export function removeEventHandlers(settingsManager) {
  console.log('⚙️ Removing event handlers');
  
  // Remove the global keyboard event listener
  if (settingsManager.keydownHandler) {
    document.removeEventListener('keydown', settingsManager.keydownHandler, true);
    settingsManager.keydownHandler = null;
    console.log('⚙️ ✅ Global keyboard handler removed');
  }
}