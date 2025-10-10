// js/welcome/welcome-handlers.js
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
    
    // Save edited family name
    else if (e.target.id === 'welcome-screen-2-save') {
      const input = wizard.overlay.querySelector('#welcome-family-name-input');
      const newFamilyName = input?.value?.trim();
      
      if (!newFamilyName) {
        // Show error - family name cannot be empty
        input?.classList.add('error');
        logger.warn('Family name cannot be empty');
        return;
      }
      
      logger.info('User saved family name', { familyName: newFamilyName });
      wizard.state.familyName = newFamilyName;
      wizard.state.editingFamilyName = false;
      wizard.saveState();
      wizard.showScreen(wizard.currentScreenIndex); // Re-render with new name
    }
    
    // Cancel editing
    else if (e.target.id === 'welcome-screen-2-cancel') {
      logger.debug('User cancelled editing family name');
      wizard.state.editingFamilyName = false;
      wizard.saveState();
      wizard.showScreen(wizard.currentScreenIndex); // Re-render
    }
  });
  
  // Handle Enter key in family name input
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-family-name-input') {
      const saveBtn = wizard.overlay.querySelector('#welcome-screen-2-save');
      saveBtn?.click();
    }
  });
}
