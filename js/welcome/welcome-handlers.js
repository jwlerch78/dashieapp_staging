// js/welcome/welcome-handlers.js
// v1.4 - 10/9/25 10:30pm - Added Screens 5, 5B, 6, 7 handlers
// v1.3 - 10/9/25 10:20pm - Added Screens 4C & 4D (Manual Zip, Location Skipped) handlers
// v1.2 - 10/9/25 9:50pm - Added Screens 4 & 4B (Location Request) handlers
// v1.1 - 10/9/25 9:35pm - Added Screen 3 (Calendar Detection) handlers
// v1.0 - 10/9/25 - Welcome wizard event handlers (Phase 2: Screens 1-2)

import { createLogger } from '../utils/logger.js';

const logger = createLogger('WelcomeHandlers');

/**
 * Setup event handlers for all screens
 */
export function setupScreenHandlers(wizard) {
  logger.debug('Setting up screen handlers');
  
  // Skip confirmation modal handlers
  setupSkipConfirmationHandlers(wizard);
  
  // Screen 1 handlers
  setupScreen1Handlers(wizard);
  
  // Screen 2 handlers
  setupScreen2Handlers(wizard);
  
  // Screen 3 handlers
  setupScreen3Handlers(wizard);
  
  // Screen 4 handlers
  setupScreen4Handlers(wizard);
  
  // Screen 4B handlers
  setupScreen4BHandlers(wizard);
  
  // Screen 4C handlers
  setupScreen4CHandlers(wizard);
  
  // Screen 4D handlers
  setupScreen4DHandlers(wizard);
  
  // Screen 5 handlers
  setupScreen5Handlers(wizard);
  
  // Screen 5B handlers
  setupScreen5BHandlers(wizard);
  
  // Screen 6 handlers
  setupScreen6Handlers(wizard);
  
  // Screen 7 handlers
  setupScreen7Handlers(wizard);
}

/**
 * Setup skip confirmation modal handlers
 */
function setupSkipConfirmationHandlers(wizard) {
  // Use event delegation since modal exists at wizard creation
  wizard.overlay.addEventListener('click', (e) => {
    if (e.target.id === 'welcome-skip-continue') {
      wizard.continueSetup();
    } else if (e.target.id === 'welcome-skip-confirm') {
      wizard.skipWizard();
    }
  });
}

/**
 * Setup Screen 5 (Photos Setup) handlers
 */
function setupScreen5Handlers(wizard) {
  wizard.overlay.addEventListener('click', async (e) => {
    // Add photos
    if (e.target.id === 'welcome-screen-5-add') {
      logger.info('User chose to add photos');
      await wizard.openAddPhotosModal();
    }
    
    // Skip photos
    else if (e.target.id === 'welcome-screen-5-skip') {
      logger.info('User skipped photo setup');
      wizard.nextScreen();
    }
  });
  
  // Handle Enter key
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'welcome-screen-5-add' || e.target.id === 'welcome-screen-5-skip') {
        e.target.click();
      }
    }
  });
}

/**
 * Setup Screen 5B (Photos Added) handlers
 */
function setupScreen5BHandlers(wizard) {
  wizard.overlay.addEventListener('click', (e) => {
    if (e.target.id === 'welcome-screen-5b-continue') {
      logger.info('User continued after adding photos');
      wizard.nextScreen();
    }
  });
  
  // Handle Enter key
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-screen-5b-continue') {
      e.target.click();
    }
  });
}

/**
 * Setup Screen 6 (QR Code) handlers
 */
function setupScreen6Handlers(wizard) {
  wizard.overlay.addEventListener('click', (e) => {
    if (e.target.id === 'welcome-screen-6-continue') {
      logger.info('User continued from QR code screen');
      wizard.nextScreen();
    }
  });
  
  // Handle Enter key
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-screen-6-continue') {
      e.target.click();
    }
  });
}

/**
 * Setup Screen 7 (Remote Tutorial - Final) handlers
 */
function setupScreen7Handlers(wizard) {
  wizard.overlay.addEventListener('click', async (e) => {
    if (e.target.id === 'welcome-screen-7-complete') {
      logger.info('User completed welcome wizard');
      await wizard.completeWizard();
    }
  });
  
  // Handle Enter key
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-screen-7-complete') {
      e.target.click();
    }
  });
}

/**
 * Setup Screen 4C (Manual Zip Entry) handlers
 */
function setupScreen4CHandlers(wizard) {
  wizard.overlay.addEventListener('click', async (e) => {
    // Continue with zip code
    if (e.target.id === 'welcome-screen-4c-continue') {
      const zipCode = wizard.state.manualZipCode;
      
      // Validate zip code (5 digits)
      if (!zipCode || zipCode.length !== 5) {
        logger.warn('Invalid zip code', { zipCode });
        const input = wizard.overlay.querySelector('#welcome-zip-code-input');
        input?.classList.add('error');
        input?.focus();
        setTimeout(() => input?.classList.remove('error'), 2000);
        return;
      }
      
      logger.info('User entered manual zip code', { zipCode });
      
      // Save zip code
      await wizard.saveZipCode(zipCode);
      
      // Skip to next major screen (after all location screens)
      wizard.skipToNextMajorScreen();
    }
    
    // Go back to Screen 4
    else if (e.target.id === 'welcome-screen-4c-back') {
      logger.info('User went back from manual zip entry');
      const screen4Index = wizard.screens.findIndex(s => s.id === 'screen-4');
      if (screen4Index >= 0) {
        wizard.showScreen(screen4Index);
      }
    }
  });
  
  // Handle Enter key on input or buttons
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'welcome-zip-code-input' || e.target.id === 'welcome-screen-4c-continue') {
        const continueBtn = wizard.overlay.querySelector('#welcome-screen-4c-continue');
        continueBtn?.click();
      } else if (e.target.id === 'welcome-screen-4c-back') {
        e.target.click();
      }
    }
  });
}

/**
 * Setup Screen 4D (Location Skipped) handlers
 */
function setupScreen4DHandlers(wizard) {
  wizard.overlay.addEventListener('click', async (e) => {
    if (e.target.id === 'welcome-screen-4d-continue') {
      logger.info('User continued after skipping location');
      
      // Clear any location data that might have been set
      await wizard.clearLocationData();
      
      // Skip to next major screen
      wizard.skipToNextMajorScreen();
    }
  });
  
  // Handle Enter key
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-screen-4d-continue') {
      e.target.click();
    }
  });
}

/**
 * Setup Screen 1 (Welcome) handlers
 */
function setupScreen1Handlers(wizard) {
  wizard.overlay.addEventListener('click', (e) => {
    if (e.target.id === 'welcome-screen-1-next') {
      logger.info('User clicked Get Started');
      wizard.nextScreen();
    }
  });
  
  // Also handle Enter key on the button
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-screen-1-next') {
      wizard.nextScreen();
    }
  });
}

/**
 * Setup Screen 2 (Family Name) handlers
 */
function setupScreen2Handlers(wizard) {
  wizard.overlay.addEventListener('click', (e) => {
    // Confirm family name
    if (e.target.id === 'welcome-screen-2-confirm') {
      logger.info('User confirmed family name', { familyName: wizard.state.familyName });
      wizard.state.editingFamilyName = false;
      wizard.saveState();
      wizard.nextScreen();
    }
    
    // Edit family name
    else if (e.target.id === 'welcome-screen-2-edit') {
      logger.debug('User clicked edit family name');
      wizard.state.editingFamilyName = true;
      wizard.saveState();
      wizard.showScreen(wizard.currentScreenIndex); // Re-render current screen
    }
  });
  
  // Handle Enter key - on buttons or when editing input
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // If editing and Enter pressed on input, go back to confirm screen
      if (e.target.id === 'welcome-family-name-input') {
        logger.info('User finished editing family name', { familyName: wizard.state.familyName });
        wizard.state.editingFamilyName = false;
        wizard.saveState();
        wizard.showScreen(wizard.currentScreenIndex); // Re-render to show confirm screen
      }
      // Handle Enter on buttons
      else if (e.target.id === 'welcome-screen-2-confirm' || e.target.id === 'welcome-screen-2-edit') {
        e.target.click();
      }
    }
  });
}

/**
 * Setup Screen 3 (Calendar Detection) handlers
 */
function setupScreen3Handlers(wizard) {
  wizard.overlay.addEventListener('click', (e) => {
    if (e.target.id === 'welcome-screen-3-continue') {
      logger.info('User continued from calendar detection');
      wizard.nextScreen();
    }
  });
  
  // Also handle Enter key on the button
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-screen-3-continue') {
      wizard.nextScreen();
    }
  });
}

/**
 * Setup Screen 4 (Location Request) handlers
 */
function setupScreen4Handlers(wizard) {
  wizard.overlay.addEventListener('click', async (e) => {
    // Share Location button
    if (e.target.id === 'welcome-screen-4-share') {
      logger.info('User clicked Share My Location');
      await wizard.requestGeolocation();
    }
    
    // Manual Zip Code button
    else if (e.target.id === 'welcome-screen-4-manual') {
      logger.info('User chose to enter zip code manually');
      const screen4CIndex = wizard.screens.findIndex(s => s.id === 'screen-4c');
      if (screen4CIndex >= 0) {
        wizard.showScreen(screen4CIndex);
      }
    }
    
    // Skip button
    else if (e.target.id === 'welcome-screen-4-skip') {
      logger.info('User skipped location setup');
      const screen4DIndex = wizard.screens.findIndex(s => s.id === 'screen-4d');
      if (screen4DIndex >= 0) {
        wizard.showScreen(screen4DIndex);
      }
    }
  });
  
  // Handle Enter key on buttons
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'welcome-screen-4-share') {
        e.target.click();
      } else if (e.target.id === 'welcome-screen-4-manual') {
        e.target.click();
      } else if (e.target.id === 'welcome-screen-4-skip') {
        e.target.click();
      }
    }
  });
}

/**
 * Setup Screen 4B (Confirm Location) handlers
 */
function setupScreen4BHandlers(wizard) {
  wizard.overlay.addEventListener('click', async (e) => {
    // Confirm location
    if (e.target.id === 'welcome-screen-4b-confirm') {
      logger.info('User confirmed detected location', { zipCode: wizard.state.detectedZipCode });
      
      // Save zip code to settings
      await wizard.saveZipCode(wizard.state.detectedZipCode);
      
      // Move to next screen
      wizard.nextScreen();
    }
    
    // Manual entry
    else if (e.target.id === 'welcome-screen-4b-manual') {
      logger.info('User rejected detected location, wants to enter manually');
      const screen4CIndex = wizard.screens.findIndex(s => s.id === 'screen-4c');
      if (screen4CIndex >= 0) {
        wizard.showScreen(screen4CIndex);
      }
    }
  });
  
  // Handle Enter key on buttons
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'welcome-screen-4b-confirm') {
        e.target.click();
      } else if (e.target.id === 'welcome-screen-4b-manual') {
        e.target.click();
      }
    }
  });
}
