// js/welcome/screens/screen-6-qr-code.js
// v1.0 - 10/10/25 - QR code screen (Screen 6) - extracted from welcome-screens.js

import { createLogger } from '../../utils/logger.js';
const logger = createLogger('QRCodeScreen');

export const qrCodeScreens = [
  {
    id: 'screen-6',
    title: 'Mobile Access',
    canGoBack: false,
    canSkip: true,
    template: (state, user) => {
      const isDev = window.location.hostname.includes('dev.');
      const qrUrl = isDev ? 'https://dev.dashieapp.com' : 'https://dashieapp.com';
      
      return `
        <div class="welcome-screen-content">
          <div class="welcome-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
          </div>
          
          <h1 class="welcome-title">You're All Set!</h1>
          
          <p class="welcome-message">
            You can configure more options at any time from the settings menu. You can also 
            update settings, add new calendar accounts, add photos, and more on your phone.
          </p>
          
          <div class="welcome-qr-code" data-url="${qrUrl}">
            <!-- QR code will be generated here -->
          </div>
          
          <p class="welcome-hint-text">
            Scan this code with your phone to access Dashie on mobile
          </p>
          
          <div class="welcome-actions">
            <button id="welcome-screen-6-continue" class="welcome-btn welcome-btn-primary">
              Continue
            </button>
          </div>
          
          <p class="welcome-hint">Press ESC to skip setup</p>
        </div>
      `;
    },
    onEnter: async (wizard) => {
      wizard.generateQRCode();
      
      setTimeout(() => {
        const continueBtn = wizard.overlay.querySelector('#welcome-screen-6-continue');
        continueBtn?.focus();
      }, 100);
    }
  }
];

export function setupQRCodeHandlers(wizard) {
  wizard.overlay.addEventListener('click', (e) => {
    if (e.target.id === 'welcome-screen-6-continue') {
      logger.info('User continued from QR code screen');
      wizard.nextScreen();
    }
  });
  
  wizard.overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'welcome-screen-6-continue') {
      e.target.click();
    }
  });
}
