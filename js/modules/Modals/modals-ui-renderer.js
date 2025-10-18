// js/modules/Modals/modals-ui-renderer.js
// Modal UI rendering - handles sleep overlay, exit confirmation, and logout modal
// Based on legacy js/ui/modals.js with exact styling

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ModalsUIRenderer');

class ModalsUIRenderer {
  constructor() {
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) {
      logger.warn('ModalsUIRenderer already initialized');
      return;
    }

    this.initialized = true;
    logger.info('ModalsUIRenderer initialized');
  }

  /**
   * Show sleep overlay (blank black screen)
   */
  showSleepOverlay() {
    // Remove existing if present
    this.hideSleepOverlay();

    // Create sleep overlay
    const sleepOverlay = document.createElement('div');
    sleepOverlay.id = 'sleep-overlay';
    sleepOverlay.className = 'sleep-overlay';
    sleepOverlay.setAttribute('tabindex', '-1');

    document.body.appendChild(sleepOverlay);

    // Fade in
    setTimeout(() => {
      sleepOverlay.classList.add('visible');
    }, 10);

    logger.info('Sleep overlay shown');
    return sleepOverlay;
  }

  /**
   * Hide sleep overlay with fade out
   */
  hideSleepOverlay() {
    const sleepOverlay = document.getElementById('sleep-overlay');

    if (sleepOverlay) {
      sleepOverlay.classList.remove('visible');
      setTimeout(() => {
        sleepOverlay.remove();
      }, 500);

      logger.info('Sleep overlay hidden');
    }
  }

  /**
   * Show exit confirmation modal
   * Different UI based on authentication status
   */
  showExitModal(isAuthenticated = false, user = null) {
    // Remove existing if present
    this.hideExitModal();

    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'exit-backdrop';

    // Create confirmation dialog
    const dialog = document.createElement('div');
    dialog.id = 'exit-dialog';

    if (isAuthenticated && user) {
      // Authenticated user - show logout and exit options
      backdrop.className = 'exit-modal-backdrop';
      dialog.className = 'exit-modal';

      // Build logout option with photo or fallback icon
      const userPhotoHTML = user.picture
        ? `<img src="${user.picture}" alt="${user.name || 'User'}" class="user-photo-modal">`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
           </svg>`;

      dialog.innerHTML = `
        <div class="modal-option logout-option" id="exit-logout" data-action="logout">
          ${userPhotoHTML}
          <span>Logout ${(user.name || user.email || 'User').split(' ')[0]}</span>
        </div>

        <div class="modal-option exit-option" id="exit-app" data-action="exit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
          </svg>
          <span>Exit Dashie</span>
        </div>

        <div class="modal-option cancel-option" id="exit-cancel" data-action="cancel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
          <span>Cancel</span>
        </div>
      `;
    } else {
      // Not authenticated - show simple exit confirmation
      backdrop.className = 'modal-backdrop';
      dialog.className = 'exit-dialog';
      dialog.innerHTML = `
        <h2>Are you sure you want to exit?</h2>
        <div class="exit-buttons">
          <button class="exit-button" id="exit-yes" data-action="yes">Yes</button>
          <button class="exit-button" id="exit-no" data-action="no">No</button>
        </div>
      `;
    }

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    logger.info('Exit modal shown', { isAuthenticated });
    return { backdrop, dialog, isAuthenticated };
  }

  /**
   * Hide exit modal
   */
  hideExitModal() {
    const backdrop = document.getElementById('exit-backdrop');
    if (backdrop) {
      backdrop.remove();
      logger.info('Exit modal hidden');
    }
  }

  /**
   * Update button/option highlighting
   * @param {string} selectedOption - ID of selected option (e.g. 'logout', 'exit', 'cancel', 'yes', 'no')
   */
  updateExitHighlight(selectedOption) {
    const dialog = document.getElementById('exit-dialog');
    if (!dialog) return;

    // Remove all highlights
    const allOptions = dialog.querySelectorAll('.modal-option, .exit-button');
    allOptions.forEach(opt => {
      opt.classList.remove('selected', 'focused');
    });

    // Add highlight to selected option
    const selectedElement = dialog.querySelector(`[data-action="${selectedOption}"]`);
    if (selectedElement) {
      selectedElement.classList.add('selected');
    }

    logger.debug('Updated exit modal highlight', { selectedOption });
  }

  /**
   * Clean up all modals
   */
  cleanup() {
    this.hideSleepOverlay();
    this.hideExitModal();
    logger.info('All modals cleaned up');
  }
}

// Export singleton
const modalsUIRenderer = new ModalsUIRenderer();
export default modalsUIRenderer;
