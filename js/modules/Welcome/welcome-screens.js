// js/modules/Welcome/welcome-screens.js
// Welcome Screens - Aggregator for all wizard screens
// Ported from .legacy/js/welcome/welcome-screens.js

import { welcomeScreen, setupWelcomeHandlers } from './screens/screen-1-welcome.js';
import { familyNameScreen, setupFamilyNameHandlers } from './screens/screen-2-family-name.js';
import { calendarScreen, setupCalendarHandlers } from './screens/screen-3-calendar.js';
import { locationScreens, setupLocationHandlers } from './screens/screen-4-location.js';
import { finalScreen, setupFinalHandlers } from './screens/screen-5-final.js';

/**
 * Get all welcome screens in order
 */
export function getWelcomeScreens() {
    return [
        welcomeScreen,
        familyNameScreen,
        calendarScreen,
        ...locationScreens,
        finalScreen
    ];
}

/**
 * Setup all screen handlers
 */
export function setupScreenHandlers(wizard) {
    setupWelcomeHandlers(wizard);
    setupFamilyNameHandlers(wizard);
    setupCalendarHandlers(wizard);
    setupLocationHandlers(wizard);
    setupFinalHandlers(wizard);
}
