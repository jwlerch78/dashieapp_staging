// js/welcome/screens/screen-5-photos.js
// v1.0 - 10/10/25 - Photos screens (5, 5B) - extracted from welcome-screens.js

import { createLogger } from '../../utils/logger.js';
const logger = createLogger('PhotoScreens');

export const photoScreens = [
  // Screen 5: Photos Setup
  {
    id: 'screen-5',
    title: 'Photos Setup',
    canGoBack: true,
    canSkip: true,
    template: (state, user) => {
      return `
        <div class="welcome-screen-content">
          <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          
          <h1 class="welcome-title">Photos Setup</h1>
          
          <p class="welcome-message">
            Dashie makes it easy to share your favorite photos. You can easily upload them 
            from your computer or phone. Would you like to add photos now?
          </p>
          
          <div class="welcome-actions">
            <button id="welcome-screen-5-add" class="welcome-btn welcome-btn-primary">
              Yes, Add Photos
            </button>
            <button id="welcome-screen-5-skip" class="welcome-btn welcome-btn-secondary">
              Skip for Now
            </button>
          </div>
          
          <p class="welcome-hint">Press ESC to skip setup</p>
        </div>
      `;
    },
    onEnter: async (wizard) => {
      setTimeout(() => {
        const addBtn = wizard.overlay.querySelector('#welcome-screen-5-add');
        addBtn?.focus();
      }, 100);
    }
  },
  
  // Screen 5B: Photos Added Confirmation
  {
    id: 'screen-5b',
    title: 'Photos Added',
    canGoBack: false,
    canSkip: false,
    template: (state, user) => {
      const hasPhotos = state.photosAdded || false;
      const moreText = hasPhotos ? 'more ' : '';
      
      return `
        <div class="welcome-screen-content">
          <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          
          <h1 class="welcome-title">Great!</h1>
          
          <p class="welcome-message">
            It's easy to add ${moreText}photos from the settings menu at any time.
          </p>
          
          <div class="welcome-actions">
            <button id="welcome-screen-5b-continue" class="welcome-btn welcome-btn-primary">
              Continue
            </button>
          </div>
        </div>
      `;
    },
    onEnter: async (wizard) => {
      setTimeout(() => {
        const continueBtn = wizard.overlay.querySelector('#welcome-screen-5b-continue');
        continueBtn?.focus();
      }, 100);
    }
  }
];

export function setupPhotoHandlers(wizard) {
  // Screen 5 handlers
  wizard.overlay.addEventListener('click', async (e) => {
    if (e.target.id === 'welcome-screen-5-add') {
      logger.info('User chose to add photos');
      await wizard.openAddPhotosModal();
    }
    else if (e.target.id === 'welcome-screen-5-skip') {
      logger.info('User skipped photo setup');
      wizard.nextScreen();
    }
  });
  
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'welcome-screen-5-add' || e.target.id === 'welcome-screen-5-skip') {
        e.target.click();
      }
    }
  });
  
  // Screen 5B handlers
  wizard.overlay.addEventListener('click', (e) => {
    if (e.target.id === 'welcome-screen-5b-continue') {
      logger.info('User continued after adding photos');
      wizard.nextScreen();
    }
  });
  
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-screen-5b-continue') {
      e.target.click();
    }
  });
}
