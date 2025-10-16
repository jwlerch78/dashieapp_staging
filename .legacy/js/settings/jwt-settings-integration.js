// js/settings/jwt-settings-integration.js
// CHANGE SUMMARY: Integration module to add JWT testing controls to existing settings interface

import { createLogger } from '../utils/logger.js';
import { JWTTestingInterface } from '../testing/jwt-testing-interface.js';

const logger = createLogger('JWTSettingsIntegration');

/**
 * Integration between JWT testing and settings system
 * Adds JWT controls to the existing settings interface
 */
export class JWTSettingsIntegration {
  constructor() {
    this.jwtTesting = null;
    this.isIntegrated = false;
    this.settingsObserver = null;
    
    logger.info('JWT Settings Integration initialized');
  }

  /**
   * Initialize and integrate JWT testing with settings
   */
  async initialize() {
    if (this.isIntegrated) {
      logger.debug('JWT settings already integrated');
      return;
    }

    try {
      // Create JWT testing interface
      this.jwtTesting = new JWTTestingInterface();
      
      // Add CSS styles
      this.addJWTStyles();
      
      // Try to integrate immediately if settings are already open
      this.tryIntegrateWithSettings();
      
      // Set up observer to integrate when settings open
      this.setupSettingsObserver();
      
      this.isIntegrated = true;
      logger.success('JWT settings integration complete');
      
    } catch (error) {
      logger.error('Failed to initialize JWT settings integration', error);
      throw error;
    }
  }

  /**
   * Add JWT-specific CSS styles to the document
   */
  addJWTStyles() {
    const existingStyle = document.getElementById('jwt-testing-styles');
    if (existingStyle) {
      logger.debug('JWT styles already added');
      return;
    }

    const style = document.createElement('style');
    style.id = 'jwt-testing-styles';
    style.textContent = JWTTestingInterface.getCSS();
    document.head.appendChild(style);
    
    logger.debug('JWT testing styles added to document');
  }

  /**
   * Try to integrate with currently open settings
   */
  tryIntegrateWithSettings() {
    // Look for the settings modal/container
    const settingsModal = document.querySelector('.settings-modal');
    const settingsContainer = document.querySelector('.settings-container');
    const settingsContent = document.querySelector('.settings-content');
    
    const container = settingsModal || settingsContainer || settingsContent;
    
    if (container && this.jwtTesting) {
      logger.debug('Found settings container, integrating JWT controls');
      this.integrateJWTControls(container);
    } else {
      logger.debug('Settings container not found, will integrate when settings open');
    }
  }

  /**
   * Set up observer to watch for settings being opened
   */
  setupSettingsObserver() {
    // Watch for settings modal/container being added to DOM
    this.settingsObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this is a settings element
            if (node.classList?.contains('settings-modal') ||
                node.classList?.contains('settings-container') ||
                node.querySelector?.('.settings-modal, .settings-container')) {
              
              logger.debug('Settings interface detected, integrating JWT controls');
              this.integrateJWTControls(node);
            }
          }
        });
      });
    });

    // Start observing
    this.settingsObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    logger.debug('Settings observer set up');
  }

  /**
   * Integrate JWT controls into the settings interface
   * @param {HTMLElement} settingsContainer - Settings container element
   */
  integrateJWTControls(settingsContainer) {
    try {
      // Look for existing JWT section
      const existingJWTSection = settingsContainer.querySelector('.jwt-testing-section');
      if (existingJWTSection) {
        logger.debug('JWT controls already integrated');
        return;
      }

      // Find the best place to add JWT controls
      let targetContainer = settingsContainer;
      
      // Look for settings content/body area
      const settingsBody = settingsContainer.querySelector('.settings-body, .settings-content, .modal-body');
      if (settingsBody) {
        targetContainer = settingsBody;
      }

      // Look for existing settings sections to append after
      const settingsSections = targetContainer.querySelectorAll('.settings-section');
      
      if (settingsSections.length > 0) {
        // Add after the last section
        const lastSection = settingsSections[settingsSections.length - 1];
        this.jwtTesting.addTestingControls(lastSection.parentNode);
        logger.success('JWT controls added after existing settings sections');
      } else {
        // Add to the main container
        this.jwtTesting.addTestingControls(targetContainer);
        logger.success('JWT controls added to settings container');
      }

      // Add a separator for better visual separation
      this.addSeparator(targetContainer);
      
    } catch (error) {
      logger.error('Failed to integrate JWT controls', error);
    }
  }

  /**
   * Add a visual separator before JWT section
   * @param {HTMLElement} container - Container to add separator to
   */
  addSeparator(container) {
    const jwtSection = container.querySelector('.jwt-testing-section');
    if (jwtSection && !jwtSection.previousElementSibling?.classList?.contains('jwt-separator')) {
      const separator = document.createElement('div');
      separator.className = 'jwt-separator';
      separator.style.cssText = `
        margin: 20px 0;
        height: 1px;
        background: var(--text-muted);
        opacity: 0.3;
      `;
      
      jwtSection.parentNode.insertBefore(separator, jwtSection);
      logger.debug('JWT separator added');
    }
  }

  /**
   * Check if JWT testing is available and working
   * @returns {Promise<boolean>} True if JWT testing is working
   */
  async checkJWTAvailability() {
    if (!this.jwtTesting) {
      logger.warn('JWT testing interface not initialized');
      return false;
    }

    try {
      const status = this.jwtTesting.jwtService.getStatus();
      logger.debug('JWT availability check', status);
      
      return status.hasEdgeFunction && status.hasGoogleToken;
      
    } catch (error) {
      logger.error('JWT availability check failed', error);
      return false;
    }
  }

  /**
   * Get JWT service instance for direct access
   * @returns {JWTAuthService|null} JWT service instance
   */
  getJWTService() {
    return this.jwtTesting?.jwtService || null;
  }

  /**
   * Clean up integration
   */
  cleanup() {
    if (this.settingsObserver) {
      this.settingsObserver.disconnect();
      this.settingsObserver = null;
    }

    // Remove JWT styles
    const jwtStyles = document.getElementById('jwt-testing-styles');
    if (jwtStyles) {
      jwtStyles.remove();
    }

    this.isIntegrated = false;
    logger.info('JWT settings integration cleaned up');
  }
}

// Create and initialize global instance
let jwtIntegrationInstance = null;

/**
 * Initialize JWT settings integration
 * @returns {Promise<JWTSettingsIntegration>} Integration instance
 */
export async function initializeJWTIntegration() {
  if (jwtIntegrationInstance) {
    logger.debug('JWT integration already initialized');
    return jwtIntegrationInstance;
  }

  try {
    jwtIntegrationInstance = new JWTSettingsIntegration();
    await jwtIntegrationInstance.initialize();
    
    // Expose globally for debugging
    if (window.dashieAuth) {
      window.dashieAuth.jwtIntegration = jwtIntegrationInstance;
    }
    
    logger.success('JWT integration initialized and exposed globally');
    return jwtIntegrationInstance;
    
  } catch (error) {
    logger.error('Failed to initialize JWT integration', error);
    throw error;
  }
}

/**
 * Get existing JWT integration instance
 * @returns {JWTSettingsIntegration|null} Integration instance
 */
export function getJWTIntegration() {
  return jwtIntegrationInstance;
}

// Auto-initialize when module loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => initializeJWTIntegration(), 1000);
  });
} else {
  // DOM is already ready
  setTimeout(() => initializeJWTIntegration(), 1000);
}