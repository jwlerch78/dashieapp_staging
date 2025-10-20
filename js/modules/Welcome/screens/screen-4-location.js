// js/modules/Welcome/screens/screen-4-location.js
// Screen 4: Location/Weather Setup (with sub-screens)
// Ported from .legacy/js/welcome/screens/screen-4-location.js

import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('LocationScreens');

export const locationScreens = [
  // Screen 4: Location Request
  {
    id: 'screen-4',
    title: 'Weather Setup',
    canGoBack: true,
    canSkip: true,
    template: (state, user) => {
      return `
        <div class="welcome-screen-content">
          <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v2"></path>
              <path d="M12 20v2"></path>
              <path d="m4.93 4.93 1.41 1.41"></path>
              <path d="m17.66 17.66 1.41 1.41"></path>
              <path d="M2 12h2"></path>
              <path d="M20 12h2"></path>
              <path d="m6.34 17.66-1.41 1.41"></path>
              <path d="m19.07 4.93-1.41 1.41"></path>
              <circle cx="12" cy="12" r="4"></circle>
            </svg>
          </div>

          <h1 class="welcome-title">Weather Setup</h1>

          <!-- Initial prompt (shown by default) -->
          <div id="location-prompt" class="location-prompt">
            <p class="welcome-message">
              We'd like to get your location set up for weather. Will you share your location with us?
            </p>

            <div class="welcome-actions welcome-actions-column">
              <button id="welcome-screen-4-share" class="welcome-btn welcome-btn-primary" tabindex="1">
                Share My Location
              </button>
              <button id="welcome-screen-4-manual" class="welcome-btn welcome-btn-secondary" tabindex="2">
                Enter Zip Code
              </button>
              <button id="welcome-screen-4-skip" class="welcome-btn welcome-btn-tertiary" tabindex="3">
                Skip Weather Setup
              </button>
            </div>
          </div>

          <!-- Loading state (hidden by default) -->
          <div id="location-loading" class="location-loading" style="display: none;">
            <div class="welcome-inline-spinner"></div>
            <p class="welcome-message" id="location-loading-message">Detecting your location...</p>
          </div>

          <p class="welcome-hint">Press ESC to skip setup</p>
        </div>
      `;
    },
    onEnter: async (wizard) => {
      setTimeout(() => {
        const shareBtn = wizard.overlay.querySelector('#welcome-screen-4-share');
        shareBtn?.focus();
      }, 100);
    }
  },

  // Screen 4B: Confirm Detected Location
  {
    id: 'screen-4b',
    title: 'Confirm Location',
    canGoBack: true,
    canSkip: true,
    template: (state, user) => {
      const city = state.detectedCity || '';
      const stateAbbr = state.detectedState || '';
      const zipCode = state.detectedZipCode || '';

      // Build location string
      let location = 'Unknown';
      if (city && stateAbbr) {
        location = `${city}, ${stateAbbr}`;
      } else if (city) {
        location = city;
      } else if (stateAbbr) {
        location = stateAbbr;
      }

      return `
        <div class="welcome-screen-content">
          <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>

          <h1 class="welcome-title">Confirm Location</h1>

          <p class="welcome-message">
            We detected your location as <strong>${location}</strong> (Zip: ${zipCode}).
            Is that correct?
          </p>

          <div class="welcome-actions">
            <button id="welcome-screen-4b-confirm" class="welcome-btn welcome-btn-primary" tabindex="1">
              Yes
            </button>
            <button id="welcome-screen-4b-manual" class="welcome-btn welcome-btn-secondary" tabindex="2">
              No, Enter Zip Code
            </button>
          </div>

          <p class="welcome-hint">Press ESC to skip setup</p>
        </div>
      `;
    },
    onEnter: async (wizard) => {
      // Set a flag to ignore Enter key for a moment to prevent auto-confirmation
      wizard.ignoreEnterKey = true;

      setTimeout(() => {
        const confirmBtn = wizard.overlay.querySelector('#welcome-screen-4b-confirm');
        confirmBtn?.focus();

        // Re-enable Enter key after focus is set
        setTimeout(() => {
          wizard.ignoreEnterKey = false;
        }, 300);
      }, 100);
    }
  },

  // Screen 4C: Manual Zip Code Entry
  {
    id: 'screen-4c',
    title: 'Enter Zip Code',
    canGoBack: true,
    canSkip: true,
    template: (state, user) => {
      const zipCode = state.manualZipCode || '';

      return `
        <div class="welcome-screen-content">
          <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>

          <h1 class="welcome-title">Enter Zip Code</h1>

          <p class="welcome-message">
            Please enter your 5-digit zip code for weather information.
          </p>

          <input
            type="text"
            id="welcome-zip-code-input"
            class="welcome-input"
            value="${zipCode}"
            placeholder="Zip Code"
            maxlength="5"
            pattern="[0-9]*"
            inputmode="numeric"
            tabindex="1"
          />

          <div class="welcome-actions">
            <button id="welcome-screen-4c-continue" class="welcome-btn welcome-btn-primary" tabindex="2">
              Continue
            </button>
            <button id="welcome-screen-4c-back" class="welcome-btn welcome-btn-secondary" tabindex="3">
              Go Back
            </button>
          </div>

          <p class="welcome-hint">Press ESC to skip setup</p>
        </div>
      `;
    },
    onEnter: async (wizard) => {
      setTimeout(() => {
        const input = wizard.overlay.querySelector('#welcome-zip-code-input');
        input?.focus();
        input?.select();

        input?.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/[^0-9]/g, '');
          wizard.state.manualZipCode = e.target.value;
        });
      }, 100);
    }
  },

  // Screen 4C-Confirm: Confirm Manual Zip Code
  {
    id: 'screen-4c-confirm',
    title: 'Confirm Zip Code',
    canGoBack: true,
    canSkip: true,
    template: (state, user) => {
      const zipCode = state.manualZipCode || '';
      const city = state.manualCity || '';
      const stateAbbr = state.manualState || '';

      // Build location display
      let locationDisplay = zipCode;
      if (city && stateAbbr) {
        locationDisplay = `${city}, ${stateAbbr} ${zipCode}`;
      } else if (city) {
        locationDisplay = `${city}, ${zipCode}`;
      } else if (stateAbbr) {
        locationDisplay = `${stateAbbr} ${zipCode}`;
      }

      return `
        <div class="welcome-screen-content">
          <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>

          <h1 class="welcome-title">Confirm Location</h1>

          <p class="welcome-message">
            <strong>${locationDisplay}</strong>, correct?
          </p>

          <div class="welcome-actions">
            <button id="welcome-screen-4c-confirm-yes" class="welcome-btn welcome-btn-primary" tabindex="1">
              Yes
            </button>
            <button id="welcome-screen-4c-confirm-no" class="welcome-btn welcome-btn-secondary" tabindex="2">
              No, Re-enter Zip Code
            </button>
          </div>

          <p class="welcome-hint">Press ESC to skip setup</p>
        </div>
      `;
    },
    onEnter: async (wizard) => {
      setTimeout(() => {
        const yesBtn = wizard.overlay.querySelector('#welcome-screen-4c-confirm-yes');
        yesBtn?.focus();
      }, 100);
    }
  },

  // Screen 4D: Location Skipped
  {
    id: 'screen-4d',
    title: 'Location Skipped',
    canGoBack: false,
    canSkip: false,
    template: (state, user) => {
      return `
        <div class="welcome-screen-content">
          <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>

          <h1 class="welcome-title">No Problem!</h1>

          <p class="welcome-message">
            You can always set your location later in Settings under the Family section.
          </p>

          <div class="welcome-actions">
            <button id="welcome-screen-4d-continue" class="welcome-btn welcome-btn-primary" tabindex="1">
              Continue
            </button>
          </div>
        </div>
      `;
    },
    onEnter: async (wizard) => {
      setTimeout(() => {
        const continueBtn = wizard.overlay.querySelector('#welcome-screen-4d-continue');
        continueBtn?.focus();
      }, 100);
    }
  }
];

export function setupLocationHandlers(wizard) {
  // Screen 4 handlers
  wizard.overlay.addEventListener('click', async (e) => {
    if (e.target.id === 'welcome-screen-4-share') {
      logger.info('User clicked Share My Location');
      await wizard.requestGeolocation();
    }
    else if (e.target.id === 'welcome-screen-4-manual') {
      logger.info('User chose to enter zip code manually');
      const screen4CIndex = wizard.screens.findIndex(s => s.id === 'screen-4c');
      if (screen4CIndex >= 0) {
        wizard.showScreen(screen4CIndex);
      }
    }
    else if (e.target.id === 'welcome-screen-4-skip') {
      logger.info('User skipped location setup');
      const screen4DIndex = wizard.screens.findIndex(s => s.id === 'screen-4d');
      if (screen4DIndex >= 0) {
        wizard.showScreen(screen4DIndex);
      }
    }
  });

  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'welcome-screen-4-share' ||
          e.target.id === 'welcome-screen-4-manual' ||
          e.target.id === 'welcome-screen-4-skip') {
        e.preventDefault();
        e.stopPropagation();
        e.target.click();
      }
    }
  });

  // Screen 4B handlers
  wizard.overlay.addEventListener('click', async (e) => {
    if (e.target.id === 'welcome-screen-4b-confirm') {
      logger.info('User confirmed detected location', { zipCode: wizard.state.detectedZipCode });
      await wizard.saveZipCode(wizard.state.detectedZipCode);
      wizard.skipToNextMajorScreen();
    }
    else if (e.target.id === 'welcome-screen-4b-manual') {
      logger.info('User rejected detected location, wants to enter manually');
      const screen4CIndex = wizard.screens.findIndex(s => s.id === 'screen-4c');
      if (screen4CIndex >= 0) {
        wizard.showScreen(screen4CIndex);
      }
    }
  });

  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // Check if we should ignore Enter key (prevents auto-confirmation on Screen 4B)
      if (wizard.ignoreEnterKey) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.target.id === 'welcome-screen-4b-confirm' || e.target.id === 'welcome-screen-4b-manual') {
        e.preventDefault();
        e.stopPropagation();
        e.target.click();
      }
    }
  });

  // Screen 4C handlers
  wizard.overlay.addEventListener('click', async (e) => {
    if (e.target.id === 'welcome-screen-4c-continue') {
      const zipCode = wizard.state.manualZipCode;

      if (!zipCode || zipCode.length !== 5) {
        logger.warn('Invalid zip code', { zipCode });
        const input = wizard.overlay.querySelector('#welcome-zip-code-input');
        input?.classList.add('error');
        input?.focus();
        setTimeout(() => input?.classList.remove('error'), 2000);
        return;
      }

      logger.info('User entered manual zip code', { zipCode });

      // Show loading spinner while looking up location
      wizard.showLoadingSpinner('Looking up your location...');

      // Lookup city/state for the zip code
      try {
        const locationInfo = await wizard.lookupZipCodeLocation(zipCode);
        if (locationInfo) {
          wizard.state.manualCity = locationInfo.city;
          wizard.state.manualState = locationInfo.state;
          wizard.saveState();
        }
      } catch (error) {
        logger.warn('Failed to lookup location for zip code', { error: error.message });
      }

      // Hide loading spinner
      wizard.hideLoadingSpinner();

      // Navigate to confirmation screen
      const screen4CConfirmIndex = wizard.screens.findIndex(s => s.id === 'screen-4c-confirm');
      if (screen4CConfirmIndex >= 0) {
        wizard.showScreen(screen4CConfirmIndex);
      }
    }
    else if (e.target.id === 'welcome-screen-4c-back') {
      logger.info('User went back from manual zip entry');
      const screen4Index = wizard.screens.findIndex(s => s.id === 'screen-4');
      if (screen4Index >= 0) {
        wizard.showScreen(screen4Index);
      }
    }
  });

  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'welcome-zip-code-input' || e.target.id === 'welcome-screen-4c-continue') {
        e.preventDefault();
        e.stopPropagation();
        const continueBtn = wizard.overlay.querySelector('#welcome-screen-4c-continue');
        continueBtn?.click();
      } else if (e.target.id === 'welcome-screen-4c-back') {
        e.preventDefault();
        e.stopPropagation();
        e.target.click();
      }
    }
  });

  // Screen 4C-Confirm handlers
  wizard.overlay.addEventListener('click', async (e) => {
    if (e.target.id === 'welcome-screen-4c-confirm-yes') {
      logger.info('User confirmed manual zip code', { zipCode: wizard.state.manualZipCode });
      await wizard.saveZipCode(wizard.state.manualZipCode);
      wizard.skipToNextMajorScreen();
    }
    else if (e.target.id === 'welcome-screen-4c-confirm-no') {
      logger.info('User wants to re-enter zip code');

      // Clear the manual location data so user can re-enter
      wizard.state.manualCity = null;
      wizard.state.manualState = null;
      wizard.saveState();

      const screen4CIndex = wizard.screens.findIndex(s => s.id === 'screen-4c');
      if (screen4CIndex >= 0) {
        wizard.showScreen(screen4CIndex);
      }
    }
  });

  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'welcome-screen-4c-confirm-yes' || e.target.id === 'welcome-screen-4c-confirm-no') {
        e.preventDefault();
        e.stopPropagation();
        e.target.click();
      }
    }
  });

  // Screen 4D handlers
  wizard.overlay.addEventListener('click', async (e) => {
    if (e.target.id === 'welcome-screen-4d-continue') {
      logger.info('User continued after skipping location');
      await wizard.clearLocationData();
      wizard.skipToNextMajorScreen();
    }
  });

  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-screen-4d-continue') {
      e.preventDefault();
      e.stopPropagation();
      e.target.click();
    }
  });
}
