// js/welcome/welcome-screens.js
// v2.1 - 10/10/25 3:45pm - Streamlined to 5 screens, removed photos/QR/tutorial screens
// v2.0 - 10/10/25 - Refactored to modular structure with individual screen files

import { welcomeScreens, setupWelcomeHandlers } from './screens/screen-1-welcome.js';
import { familyNameScreens, setupFamilyNameHandlers } from './screens/screen-2-family-name.js';
import { calendarScreens, setupCalendarHandlers } from './screens/screen-3-calendar.js';
import { locationScreens, setupLocationScreenHandlers } from './screens/screen-4-location.js';
import { finalScreen, setupFinalScreenHandlers } from './screens/screen-5-final.js';

/**
 * Get all welcome screens
 */
export function getWelcomeScreens() {
  return [
    ...welcomeScreens,
    ...familyNameScreens,
    ...calendarScreens,
    ...locationScreens,
    ...finalScreen
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
  setupFinalScreenHandlers(wizard);
}
