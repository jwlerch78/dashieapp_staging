// js/modules/Settings/screens/display-screens.js
// Display settings screen definitions using the new framework
// This is an EXAMPLE showing how the new system would work

import { screenRegistry } from '../core/settings-screen-registry.js';
import {
    createSelectionScreen,
    createNavigationScreen,
    createTimeSelectionScreens
} from '../core/settings-screen-factory.js';
import { TimeSelectionHandler } from '../utils/time-selection-handler.js';

/**
 * Register all Display-related screens
 * This replaces the manual screen rendering in settings-display-page.js
 */
export function registerDisplayScreens(settingsStore) {
    const timeHandler = new TimeSelectionHandler();

    // 1. Theme Selection Screen
    const themeScreen = createSelectionScreen({
        id: 'display-theme',
        title: 'Theme',
        parentId: 'display',
        settingPath: 'interface.theme',
        options: [
            { label: 'Dark', value: 'dark' },
            { label: 'Light', value: 'light' }
        ],
        stayOnScreen: true // Don't auto-navigate back
    });
    screenRegistry.register(themeScreen);

    // 2. Sleep Timer Screens (hour, minute, period)
    const sleepScreens = createTimeSelectionScreens({
        prefix: 'display-sleep-time',
        title: 'Sleep Timer',
        parentId: 'display',
        settingPath: 'interface.sleepTime',
        timeHandler: timeHandler
    });
    sleepScreens.forEach(screen => screenRegistry.register(screen));

    // 3. Wake Timer Screens (hour, minute, period)
    const wakeScreens = createTimeSelectionScreens({
        prefix: 'display-wake-time',
        title: 'Wake Timer',
        parentId: 'display',
        settingPath: 'interface.wakeTime',
        timeHandler: timeHandler
    });
    wakeScreens.forEach(screen => screenRegistry.register(screen));

    // 4. Main Display Navigation Screen
    // This would replace the render() method in settings-display-page.js
    const displayScreen = createNavigationScreen({
        id: 'display',
        title: 'Display',
        parentId: 'main',
        getItems: (currentValue) => {
            // Get current values from settings
            const theme = settingsStore.get('interface.theme', 'dark');
            const sleepTime = settingsStore.get('interface.sleepTime', '22:00');
            const wakeTime = settingsStore.get('interface.wakeTime', '07:00');

            // Format display values
            const themeDisplay = theme.charAt(0).toUpperCase() + theme.slice(1);
            const sleepDisplay = timeHandler.formatTime(sleepTime);
            const wakeDisplay = timeHandler.formatTime(wakeTime);

            return [
                {
                    label: 'Theme',
                    value: themeDisplay,
                    navigate: 'display-theme'
                },
                {
                    label: 'Sleep Timer',
                    value: sleepDisplay,
                    navigate: 'display-sleep-time-hour'
                },
                {
                    label: 'Wake Timer',
                    value: wakeDisplay,
                    navigate: 'display-wake-time-hour'
                },
                // Dynamic Greeting would need special handling (toggle)
                // We'd need a different screen type for this
            ];
        }
    });
    screenRegistry.register(displayScreen);
}

// USAGE EXAMPLE:
//
// In settings initialization:
// ```
// import { registerDisplayScreens } from './screens/display-screens.js';
// import { screenRegistry } from './core/settings-screen-registry.js';
//
// // Initialize registry
// screenRegistry.initialize(settingsStore);
//
// // Register all display screens
// registerDisplayScreens(settingsStore);
// ```
//
// In modal renderer:
// ```
// buildDisplaySubScreens() {
//     const screenIds = screenRegistry.getChildScreens('display').map(s => s.id);
//     return screenIds.map(id => `
//         <div class="settings-modal__screen"
//              data-screen="${id}"
//              data-title="${screenRegistry.getTitle(id)}"
//              data-parent="${screenRegistry.getParentId(id)}">
//             ${screenRegistry.render(id)}
//         </div>
//     `).join('');
// }
//
// // Set initial selection
// const initialIndex = screenRegistry.getInitialSelectionIndex(screenId);
// this.stateManager.setSelectedIndex(initialIndex);
//
// // Handle selection
// const action = await screenRegistry.handleSelection(screenId, selectedElement);
// if (action.type === 'navigate') {
//     // Navigate to action.screenId
// } else if (action.type === 'complete') {
//     // Save complete, navigate back
// }
// ```
