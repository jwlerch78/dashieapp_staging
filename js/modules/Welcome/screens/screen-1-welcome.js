// js/modules/Welcome/screens/screen-1-welcome.js
// Screen 1: Welcome Introduction
// Ported from .legacy/js/welcome/screens/screen-1-welcome.js

import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('WelcomeScreen');

export const welcomeScreen = {
    id: 'screen-1',
    title: 'Welcome to Dashie',
    canGoBack: false,
    canSkip: true,
    template: (state, user) => {
        const firstName = user?.name?.split(' ')[0] || 'there';

        return `
            <div class="welcome-screen-content">
                <div class="welcome-logo">
                    <img src="/artwork/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie Logo" />
                </div>
                <h1 class="welcome-title">Welcome to Dashie, ${firstName}!</h1>
                <p class="welcome-subtitle">Let's get you on the road to better family organization!</p>

                <div class="welcome-actions">
                    <button id="welcome-screen-1-next" class="welcome-btn welcome-btn-primary" tabindex="1">
                        Get Started
                    </button>
                </div>

                <p class="welcome-hint">Press ESC to skip setup</p>
            </div>
        `;
    },
    onEnter: async (wizard) => {
        setTimeout(() => {
            const nextBtn = wizard.overlay.querySelector('#welcome-screen-1-next');
            nextBtn?.focus();
        }, 100);
    }
};

export function setupWelcomeHandlers(wizard) {
    wizard.overlay.addEventListener('click', (e) => {
        if (e.target.id === 'welcome-screen-1-next') {
            logger.info('User clicked Get Started');
            wizard.nextScreen();
        }
    });

    wizard.overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.id === 'welcome-screen-1-next') {
            wizard.nextScreen();
        }
    });
}
