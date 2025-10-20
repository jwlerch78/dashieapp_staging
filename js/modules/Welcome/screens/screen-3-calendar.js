// js/modules/Welcome/screens/screen-3-calendar.js
// Screen 3: Calendar Setup
// Ported from .legacy/js/welcome/screens/screen-3-calendar.js

import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('CalendarScreen');

export const calendarScreen = {
    id: 'screen-3',
    title: 'Calendar Setup',
    canGoBack: true,
    canSkip: true,
    template: (state, user) => {
        const calendarCount = state.calendarCount || 'several';

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

                <p class="welcome-message">
                    Your Google Account has <strong style="color: #EE9828;">${calendarCount}</strong> calendars. We've added them all to the calendar display. You can edit the displayed calendars in the <strong style="color: #EE9828;">settings</strong> menu.
                </p>

                <div class="welcome-actions">
                    <button id="welcome-screen-3-continue" class="welcome-btn welcome-btn-primary" tabindex="1">
                        Continue
                    </button>
                </div>

                <p class="welcome-hint">Press ESC to skip setup</p>
            </div>
        `;
    },
    onEnter: async (wizard) => {
        // Show loading spinner while detecting calendars
        wizard.showLoadingSpinner('Detecting your calendars...');

        // Detect calendars from Google Calendar API
        await wizard.detectCalendars();

        // Hide loading spinner
        wizard.hideLoadingSpinner();

        // Re-render screen with updated calendar count
        wizard.renderCurrentScreen();

        setTimeout(() => {
            const continueBtn = wizard.overlay.querySelector('#welcome-screen-3-continue');
            continueBtn?.focus();
        }, 100);
    }
};

export function setupCalendarHandlers(wizard) {
    wizard.overlay.addEventListener('click', (e) => {
        if (e.target.id === 'welcome-screen-3-continue') {
            logger.info('User continued from calendar setup');
            wizard.nextScreen();
        }
    });

    wizard.overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.id === 'welcome-screen-3-continue') {
            e.preventDefault();
            e.stopPropagation();
            wizard.nextScreen();
        }
    });
}
