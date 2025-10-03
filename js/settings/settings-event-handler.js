// js/settings/settings-event-handler.js
// CHANGE SUMMARY: Fixed event handling logic - only preventDefault when navigation HANDLES the key (returns true), not when it allows it through (returns false)
// Event handling and global keyboard capture for settings

export function setupEventHandlers(overlay, settingsManager) {
  console.log('⚙️ Setting up event handlers');
  
  // CRITICAL: Add global keyboard event capture with high priority
  settingsManager.keydownHandler = (event) => {
    // Only handle if settings modal is visible and active
    if (!settingsManager.isVisible || !overlay.classList.contains('active')) {
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