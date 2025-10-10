// js/welcome/welcome-wizard.js
// v1.0 - 10/9/25 - Initial welcome wizard framework with skip confirmation

import { createLogger } from '../utils/logger.js';
import { getWelcomeScreens } from './welcome-screens.js';
import { setupScreenHandlers } from './welcome-handlers.js';

const logger = createLogger('WelcomeWizard');

export class WelcomeWizard {
  constructor(user, settings) {
    this.user = user;
    this.settings = settings;
    this.currentScreenIndex = 0;
    this.screens = getWelcomeScreens();
    this.state = this.loadState();
    this.overlay = null;
    this.skipConfirmationActive = false;
    
    logger.info('Welcome wizard initialized', { 
      userName: user?.name,
      totalScreens: this.screens.length 
    });
  }

  /**
   * Load wizard state from localStorage
   */
  loadState() {
    try {
      const saved = localStorage.getItem('dashie-welcome-state');
      if (saved) {
        const state = JSON.parse(saved);
        logger.debug('Loaded wizard state from localStorage', state);
        return state;
      }
    } catch (error) {
      logger.warn('Failed to load wizard state', { error: error.message });
    }
    
    // Default state
    return {
      currentScreen: 'screen-1',
      familyName: this.extractFamilyName(),
      completedScreens: []
    };
  }

  /**
   * Save wizard state to localStorage
   */
  saveState() {
    try {
      localStorage.setItem('dashie-welcome-state', JSON.stringify(this.state));
      logger.debug('Saved wizard state to localStorage');
    } catch (error) {
      logger.warn('Failed to save wizard state', { error: error.message });
    }
  }

  /**
   * Extract family name from user data
   */
  extractFamilyName() {
    if (!this.user) return 'Dashie';
    
    // Try to get last name from email
    if (this.user.email) {
      const emailParts = this.user.email.split('@')[0].split('.');
      if (emailParts.length > 1) {
        // Capitalize first letter
        const lastName = emailParts[emailParts.length - 1];
        return lastName.charAt(0).toUpperCase() + lastName.slice(1);
      }
    }
    
    // Try to get from full name
    if (this.user.name) {
      const nameParts = this.user.name.split(' ');
      if (nameParts.length > 1) {
        return nameParts[nameParts.length - 1];
      }
    }
    
    return 'Dashie';
  }

  /**
   * Show the welcome wizard
   */
  async show() {
    logger.info('Showing welcome wizard');
    
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'welcome-wizard-overlay';
    this.overlay.innerHTML = this.buildWizardHTML();
    
    document.body.appendChild(this.overlay);
    
    // Setup event handlers
    setupScreenHandlers(this);
    
    // Setup ESC key handler for skip confirmation
    this.setupKeyHandler();
    
    // Show first screen
    await this.showScreen(this.currentScreenIndex);
    
    // Trigger animation
    requestAnimationFrame(() => {
      this.overlay.classList.add('active');
    });
  }

  /**
   * Build the wizard HTML structure
   */
  buildWizardHTML() {
    return `
      <div class="welcome-wizard-modal">
        <div class="welcome-wizard-content">
          <div class="welcome-screens">
            ${this.screens.map((screen, index) => `
              <div class="welcome-screen ${index === 0 ? 'active' : ''}" 
                   data-screen="${screen.id}" 
                   data-index="${index}">
                <!-- Screen content will be injected here -->
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      
      <!-- Skip Confirmation Modal -->
      <div id="welcome-skip-confirmation" class="welcome-skip-modal" style="display: none;">
        <div class="welcome-skip-content">
          <h2>Skip Setup?</h2>
          <p>Are you sure you want to skip the Dashie setup wizard? You can always access settings later.</p>
          <div class="welcome-skip-actions">
            <button id="welcome-skip-continue" class="welcome-btn welcome-btn-primary">Continue Setup</button>
            <button id="welcome-skip-confirm" class="welcome-btn welcome-btn-secondary">Skip Setup</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup keyboard handler for ESC key
   */
  setupKeyHandler() {
    this.keyHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        // Don't show skip confirmation on last screen
        const currentScreen = this.screens[this.currentScreenIndex];
        if (currentScreen.id === 'screen-7') {
          this.completeWizard();
          return;
        }
        
        // Show skip confirmation if not already showing
        if (!this.skipConfirmationActive) {
          e.preventDefault();
          this.showSkipConfirmation();
        }
      }
    };
    
    document.addEventListener('keydown', this.keyHandler);
  }

  /**
   * Show skip confirmation modal
   */
  showSkipConfirmation() {
    logger.debug('Showing skip confirmation');
    this.skipConfirmationActive = true;
    
    const modal = this.overlay.querySelector('#welcome-skip-confirmation');
    modal.style.display = 'flex';
    
    // Focus the "Continue Setup" button by default
    const continueBtn = this.overlay.querySelector('#welcome-skip-continue');
    setTimeout(() => continueBtn?.focus(), 100);
  }

  /**
   * Hide skip confirmation modal
   */
  hideSkipConfirmation() {
    logger.debug('Hiding skip confirmation');
    this.skipConfirmationActive = false;
    
    const modal = this.overlay.querySelector('#welcome-skip-confirmation');
    modal.style.display = 'none';
  }

  /**
   * Handle skip confirmation - continue setup
   */
  continueSetup() {
    this.hideSkipConfirmation();
  }

  /**
   * Handle skip confirmation - skip wizard
   */
  skipWizard() {
    logger.info('User skipped welcome wizard');
    
    // Set skip flag
    localStorage.setItem('dashie-skip-wizard', 'true');
    
    // Update settings if possible
    if (window.settingsService) {
      window.settingsService.updateSettings({
        'onboarding.skipped': true,
        'onboarding.skippedAt': new Date().toISOString()
      }).catch(err => logger.warn('Failed to save skip status', err));
    }
    
    // Close wizard
    this.close();
  }

  /**
   * Show a specific screen
   */
  async showScreen(index) {
    const screen = this.screens[index];
    if (!screen) {
      logger.error('Screen not found', { index });
      return;
    }
    
    logger.debug('Showing screen', { screenId: screen.id, index });
    
    // Update current screen index
    this.currentScreenIndex = index;
    
    // Update state
    this.state.currentScreen = screen.id;
    this.saveState();
    
    // Get screen element
    const screenElement = this.overlay.querySelector(`[data-screen="${screen.id}"]`);
    if (!screenElement) return;
    
    // Inject screen content
    screenElement.innerHTML = screen.template(this.state, this.user);
    
    // Show screen with animation
    const allScreens = this.overlay.querySelectorAll('.welcome-screen');
    allScreens.forEach(s => s.classList.remove('active', 'sliding-out', 'sliding-in'));
    
    screenElement.classList.add('sliding-in', 'active');
    
    setTimeout(() => {
      screenElement.classList.remove('sliding-in');
    }, 300);
    
    // Call screen's onEnter handler if it exists
    if (screen.onEnter) {
      await screen.onEnter(this);
    }
  }

  /**
   * Navigate to next screen
   */
  async nextScreen() {
    if (this.currentScreenIndex < this.screens.length - 1) {
      // Mark current screen as completed
      const currentScreen = this.screens[this.currentScreenIndex];
      if (!this.state.completedScreens.includes(currentScreen.id)) {
        this.state.completedScreens.push(currentScreen.id);
        this.saveState();
      }
      
      await this.showScreen(this.currentScreenIndex + 1);
    } else {
      // Last screen - complete wizard
      await this.completeWizard();
    }
  }

  /**
   * Navigate to previous screen
   */
  async previousScreen() {
    if (this.currentScreenIndex > 0) {
      await this.showScreen(this.currentScreenIndex - 1);
    }
  }

  /**
   * Complete the wizard
   */
  async completeWizard() {
    logger.info('Welcome wizard completed', { state: this.state });
    
    // Save completion to settings
    if (window.settingsController) {
      try {
        // Use settingsController to save settings properly
        await window.settingsController.handleSettingChange('onboarding.completed', true);
        await window.settingsController.handleSettingChange('onboarding.completedAt', new Date().toISOString());
        await window.settingsController.handleSettingChange('family.familyName', this.state.familyName);
        
        logger.success('Onboarding completion saved via settingsController');
      } catch (error) {
        logger.error('Failed to save onboarding completion via settingsController', { error: error.message });
      }
    } else {
      logger.warn('settingsController not available, settings not saved');
    }
    
    // Clear localStorage state
    localStorage.removeItem('dashie-welcome-state');
    
    // Close wizard
    this.close();
  }

  /**
   * Close the wizard
   */
  close() {
    logger.info('Closing welcome wizard');
    
    // Remove event listener
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
    }
    
    // Animate out
    this.overlay?.classList.remove('active');
    
    setTimeout(() => {
      this.overlay?.remove();
      this.overlay = null;
    }, 300);
  }
}

/**
 * Show welcome wizard (exported function for main.js)
 */
export async function showWelcomeWizard(user, settings) {
  const wizard = new WelcomeWizard(user, settings);
  await wizard.show();
  
  // Return promise that resolves when wizard is closed
  return new Promise((resolve) => {
    const checkClosed = setInterval(() => {
      if (!wizard.overlay) {
        clearInterval(checkClosed);
        resolve();
      }
    }, 100);
  });
}
