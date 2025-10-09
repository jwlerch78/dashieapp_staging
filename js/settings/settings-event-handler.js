// js/settings/settings-event-handler.js
// CHANGE SUMMARY: Added sleep timer toggle handler to update UI states and save setting


export function setupEventHandlers(overlay, settingsManager) {
  console.log('⚙️ Setting up event handlers');
  
  // CRITICAL: Add global keyboard event capture with high priority
  settingsManager.keydownHandler = (event) => {
    // Only handle if settings modal is visible and active
    if (!settingsManager.isVisible || !overlay.classList.contains('active')) {
      return;
    }

    // CRITICAL: Check if a confirmation modal is on top of settings
    if (window.dashieModalManager && window.dashieModalManager.modalStack.length > 1) {
      console.log('⚙️ ⚠️ Settings event handler: Modal is active (stack:', window.dashieModalManager.modalStack.length, '), not capturing key');
      // Don't capture - let the modal handle it
      return;
    }

    console.log('⚙️ Settings captured key:', event.key);
    
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