// js/welcome/screens/screen-3-calendar.js
// v1.0 - 10/10/25 - Calendar detection screen (Screen 3) - extracted from welcome-screens.js

import { createLogger } from '../../utils/logger.js';
const logger = createLogger('CalendarScreen');

export const calendarScreens = [
  {
    id: 'screen-3',
    title: 'Calendar Setup',
    canGoBack: true,
    canSkip: true,
    template: (state, user) => {
      const calendarCount = state.calendarCount || 0;
      const primaryCalendarName = state.primaryCalendarName || 'Calendar';
      const hasCalendars = calendarCount > 0;
      
      return `
        <div class="welcome-screen-content">
          <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          
          <h1 class="welcome-title">Calendar Setup</h1>
          
          ${hasCalendars ? `
            <p class="welcome-message">
              I see you have <strong>${calendarCount}</strong> calendar${calendarCount !== 1 ? 's' : ''} 
              associated with this account. I added your primary calendar, 
              <strong>${primaryCalendarName}</strong>, to the display to start.
            </p>
          ` : `
            <p class="welcome-message">
              It looks like there aren't any calendars we can access that are associated with your account.
            </p>
          `}
          
          <div class="welcome-actions">
            <button id="welcome-screen-3-continue" class="welcome-btn welcome-btn-primary">
              Continue
            </button>
          </div>
          
          ${hasCalendars ? `
            <p class="welcome-hint-text">
              You can add more calendars or calendars from other accounts in the settings menu.
            </p>
          ` : `
            <p class="welcome-hint-text">
              You can add calendars from other accounts in the settings menu in the Calendar section.
            </p>
          `}
          
          <p class="welcome-hint">Press ESC to skip setup</p>
        </div>
      `;
    },
    onEnter: async (wizard) => {
      await wizard.detectCalendars();
      
      const screenElement = wizard.overlay.querySelector(`[data-screen="screen-3"]`);
      if (screenElement) {
        const screen = wizard.screens.find(s => s.id === 'screen-3');
        screenElement.innerHTML = screen.template(wizard.state, wizard.user);
      }
      
      setTimeout(() => {
        const continueBtn = wizard.overlay.querySelector('#welcome-screen-3-continue');
        continueBtn?.focus();
      }, 100);
    }
  }
];

export function setupCalendarHandlers(wizard) {
  wizard.overlay.addEventListener('click', (e) => {
    if (e.target.id === 'welcome-screen-3-continue') {
      logger.info('User continued from calendar detection');
      wizard.nextScreen();
    }
  });
  
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-screen-3-continue') {
      wizard.nextScreen();
    }
  });
}
