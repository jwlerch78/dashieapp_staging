// js/modules/Welcome/screens/screen-5-final.js
// Screen 5: Final "On Your Way!" completion screen
// Ported from .legacy/js/welcome/screens/screen-5-final.js

import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('FinalScreen');

export const finalScreen = {
    id: 'screen-5',
    title: 'On Your Way!',
    canGoBack: false,
    canSkip: false,
    template: (state, user) => {
        return `
            <div class="welcome-screen-content">
                <div class="welcome-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9 12l2 2 4-4"></path>
                    </svg>
                </div>

                <h1 class="welcome-title">On Your Way!</h1>

                <p class="welcome-message">
                    <strong>What's next?</strong><br>
                    Add photos & more calendars, update your settings, and try out Dashie's widget navigation. Easier family coordination awaits!
                </p>

                <div class="welcome-actions">
                    <button id="welcome-screen-5-complete" class="welcome-btn welcome-btn-primary" tabindex="1">
                        Let's Go!
                    </button>
                </div>
            </div>
        `;
    },
    onEnter: async (wizard) => {
        setTimeout(() => {
            const completeBtn = wizard.overlay.querySelector('#welcome-screen-5-complete');
            completeBtn?.focus();
        }, 100);
    }
};

export function setupFinalHandlers(wizard) {
    wizard.overlay.addEventListener('click', (e) => {
        if (e.target.id === 'welcome-screen-5-complete') {
            logger.info('User completed welcome wizard');
            wizard.completeWizard();
        }
    });

    wizard.overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.id === 'welcome-screen-5-complete') {
            e.preventDefault();
            e.stopPropagation();
            e.target.click();
        }
    });
}
