// js/welcome/screens/screen-7-tutorial.js
// v1.0 - 10/10/25 - Tutorial/completion screen (Screen 7) - extracted from welcome-screens.js

import { createLogger } from '../../utils/logger.js';
const logger = createLogger('TutorialScreen');

export const tutorialScreens = [
  {
    id: 'screen-7',
    title: 'Remote Control',
    canGoBack: false,
    canSkip: false,
    template: (state, user) => {
      return `
        <div class="welcome-screen-content">
          <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="8" y="2" width="8" height="20" rx="2" ry="2"></rect>
              <circle cx="12" cy="6" r="1"></circle>
              <circle cx="12" cy="10" r="1"></circle>
              <circle cx="12" cy="14" r="1"></circle>
              <circle cx="12" cy="18" r="1"></circle>
            </svg>
          </div>
          
          <h1 class="welcome-title">One More Thing...</h1>
          
          <p class="welcome-message">
            You can also control the different Dashie widgets with your remote by selecting them, 
            which puts them into interactive mode. Try it out!
          </p>
          
          <div class="welcome-actions">
            <button id="welcome-screen-7-complete" class="welcome-btn welcome-btn-primary">
              Let's Go!
            </button>
          </div>
        </div>
      `;
    },
    onEnter: async (wizard) => {
      setTimeout(() => {
        const completeBtn = wizard.overlay.querySelector('#welcome-screen-7-complete');
        completeBtn?.focus();
      }, 100);
    }
  }
];

export function setupTutorialHandlers(wizard) {
  wizard.overlay.addEventListener('click', async (e) => {
    if (e.target.id === 'welcome-screen-7-complete') {
      logger.info('User completed welcome wizard');
      await wizard.completeWizard();
    }
  });
  
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-screen-7-complete') {
      e.target.click();
    }
  });
}
