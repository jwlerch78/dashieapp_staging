// js/welcome/screens/screen-2-family-name.js
// v1.0 - 10/10/25 - Family name screen (Screen 2) - extracted from welcome-screens.js

import { createLogger } from '../../utils/logger.js';
const logger = createLogger('FamilyNameScreen');

export const familyNameScreens = [
  {
    id: 'screen-2',
    title: 'Family Name',
    canGoBack: true,
    canSkip: true,
    template: (state, user) => {
      const familyName = state.familyName || 'Dashie';
      const isEditing = state.editingFamilyName || false;
      
      return `
        <div class="welcome-screen-content">
          <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          
          <h1 class="welcome-title">Family Name</h1>
          
          ${!isEditing ? `
            <p class="welcome-message">
              We detected "<strong>${familyName}</strong>" as your last name.
            </p>
            
            <div class="welcome-actions">
              <button id="welcome-screen-2-confirm" class="welcome-btn welcome-btn-primary">
                Looks Good!
              </button>
              <button id="welcome-screen-2-edit" class="welcome-btn welcome-btn-secondary">
                Edit
              </button>
            </div>
          ` : `
            <p class="welcome-message">
              Enter your family name:
            </p>
            
            <input 
              type="text" 
              id="welcome-family-name-input" 
              class="welcome-input"
              value="${familyName}"
              placeholder="Family Name"
              maxlength="30"
            />
            
            <p class="welcome-hint-text">
              Press Enter when done
            </p>
          `}
          
          <p class="welcome-hint">Press ESC to skip setup</p>
        </div>
      `;
    },
    onEnter: async (wizard) => {
      if (wizard.state.editingFamilyName) {
        setTimeout(() => {
          const input = wizard.overlay.querySelector('#welcome-family-name-input');
          input?.focus();
          input?.select();
          
          input?.addEventListener('input', (e) => {
            wizard.state.familyName = e.target.value;
          });
        }, 100);
      } else {
        setTimeout(() => {
          const confirmBtn = wizard.overlay.querySelector('#welcome-screen-2-confirm');
          confirmBtn?.focus();
        }, 100);
      }
    }
  }
];

export function setupFamilyNameHandlers(wizard) {
  wizard.overlay.addEventListener('click', (e) => {
    if (e.target.id === 'welcome-screen-2-confirm') {
      logger.info('User confirmed family name', { familyName: wizard.state.familyName });
      wizard.state.editingFamilyName = false;
      wizard.saveState();
      wizard.nextScreen();
    }
    else if (e.target.id === 'welcome-screen-2-edit') {
      logger.debug('User clicked edit family name');
      wizard.state.editingFamilyName = true;
      wizard.saveState();
      wizard.showScreen(wizard.currentScreenIndex);
    }
  });
  
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'welcome-family-name-input') {
        logger.info('User finished editing family name', { familyName: wizard.state.familyName });
        wizard.state.editingFamilyName = false;
        wizard.saveState();
        wizard.showScreen(wizard.currentScreenIndex);
      }
      else if (e.target.id === 'welcome-screen-2-confirm' || e.target.id === 'welcome-screen-2-edit') {
        e.target.click();
      }
    }
  });
}
