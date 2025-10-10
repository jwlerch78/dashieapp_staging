// js/welcome/welcome-screens.js
// v2.0 - 10/10/25 - Refactored to modular structure with individual screen files

import { welcomeScreens, setupWelcomeHandlers } from './screens/screen-1-welcome.js';
import { familyNameScreens, setupFamilyNameHandlers } from './screens/screen-2-family-name.js';
import { calendarScreens, setupCalendarHandlers } from './screens/screen-3-calendar.js';
import { locationScreens, setupLocationScreenHandlers } from './screens/screen-4-location.js';
import { photoScreens, setupPhotoHandlers } from './screens/screen-5-photos.js';
import { qrCodeScreens, setupQRCodeHandlers } from './screens/screen-6-qr-code.js';
import { tutorialScreens, setupTutorialHandlers } from './screens/screen-7-tutorial.js';

/**
 * Get all welcome screens
 */
export function getWelcomeScreens() {
  return [
    ...welcomeScreens,
    ...familyNameScreens,
    ...calendarScreens,
    ...locationScreens,
    ...photoScreens,
    ...qrCodeScreens,
    ...tutorialScreens
  ];
}

/**
 * Setup all screen handlers
 */
export function setupScreenHandlers(wizard) {
  setupWelcomeHandlers(wizard);
  setupFamilyNameHandlers(wizard);
  setupCalendarHandlers(wizard);
  setupLocationScreenHandlers(wizard);
  setupPhotoHandlers(wizard);
  setupQRCodeHandlers(wizard);
  setupTutorialHandlers(wizard);
}
