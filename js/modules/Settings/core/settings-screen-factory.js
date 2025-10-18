// js/modules/Settings/core/settings-screen-factory.js
// Factory for creating common types of settings screens

import { SettingsScreenBase } from './settings-screen-base.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('SettingsScreenFactory');

/**
 * Create a simple selection screen
 * @param {Object} config
 * @param {string} config.id - Screen ID
 * @param {string} config.title - Screen title
 * @param {string} config.parentId - Parent screen ID
 * @param {string} config.settingPath - Setting path (e.g., 'interface.theme')
 * @param {Array} config.options - Array of {label, value} objects
 * @param {boolean} [config.stayOnScreen] - Don't navigate back after selection
 * @returns {SettingsScreenBase}
 */
export function createSelectionScreen(config) {
    return new SettingsScreenBase({
        id: config.id,
        title: config.title,
        parentId: config.parentId,
        settingPath: config.settingPath,
        getItems: (currentValue) => {
            return config.options.map(opt => ({
                label: opt.label,
                value: opt.value,
                setting: config.settingPath
            }));
        },
        onSelect: async (element, settingsStore) => {
            const value = element.dataset.value;
            if (value !== undefined) {
                await settingsStore.set(config.settingPath, value);
                await settingsStore.save();

                // Stay on screen or navigate back
                if (config.stayOnScreen) {
                    return {
                        type: 'refresh',
                        screenId: config.id
                    };
                } else {
                    return {
                        type: 'complete',
                        navigateBack: true
                    };
                }
            }
            return { type: 'none' };
        }
    });
}

/**
 * Create a navigation screen (like main Display page)
 * @param {Object} config
 * @param {string} config.id - Screen ID
 * @param {string} config.title - Screen title
 * @param {string} config.parentId - Parent screen ID
 * @param {Function} config.getItems - Function that returns array of items
 * @returns {SettingsScreenBase}
 */
export function createNavigationScreen(config) {
    return new SettingsScreenBase({
        id: config.id,
        title: config.title,
        parentId: config.parentId,
        getItems: config.getItems,
        onSelect: async (element, settingsStore) => {
            // Navigation screens just navigate to the target
            if (element.dataset.navigate) {
                return {
                    type: 'navigate',
                    screenId: element.dataset.navigate
                };
            }
            return { type: 'none' };
        }
    });
}

/**
 * Create a multi-step selection screen (like time selection)
 * @param {Object} config
 * @param {string} config.id - Screen ID
 * @param {string} config.title - Screen title
 * @param {string} config.parentId - Parent screen ID
 * @param {Array} config.options - Array of options
 * @param {string} config.dataKey - Data attribute key (e.g., 'hour', 'minute', 'period')
 * @param {string} [config.nextScreen] - Next screen ID (for multi-step)
 * @param {Object} [config.stateful] - Stateful handler instance (like TimeSelectionHandler)
 * @returns {SettingsScreenBase}
 */
export function createMultiStepScreen(config) {
    return new SettingsScreenBase({
        id: config.id,
        title: config.title,
        parentId: config.parentId,
        getItems: (currentValue) => {
            return config.options.map(opt => {
                const item = {
                    label: opt.label,
                    setting: config.settingPath
                };

                // Add the appropriate data attribute
                item[config.dataKey] = opt.value;

                // Add navigation if there's a next screen
                if (config.nextScreen) {
                    item.navigate = config.nextScreen;
                }

                return item;
            });
        },
        onSelect: async (element, settingsStore) => {
            // If stateful handler is provided, use it
            if (config.stateful) {
                return await config.stateful.handleSelection(element);
            }

            // Otherwise, simple multi-step navigation
            if (config.nextScreen) {
                return {
                    type: 'navigate',
                    screenId: config.nextScreen
                };
            }

            return { type: 'none' };
        }
    });
}

/**
 * Create a group of time selection screens (hour, minute, period)
 * @param {Object} config
 * @param {string} config.prefix - Screen ID prefix (e.g., 'display-sleep-time')
 * @param {string} config.title - Title (e.g., 'Sleep Timer')
 * @param {string} config.parentId - Parent screen ID
 * @param {string} config.settingPath - Setting path
 * @param {Object} config.timeHandler - TimeSelectionHandler instance
 * @returns {SettingsScreenBase[]} - Array of 3 screens
 */
export function createTimeSelectionScreens(config) {
    const screens = [];

    // Hour screen
    screens.push(new SettingsScreenBase({
        id: `${config.prefix}-hour`,
        title: config.title,
        parentId: config.parentId,
        settingPath: config.settingPath,
        getItems: () => {
            const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
            return hours.map(h => ({
                label: h.toString(),
                hour: h,
                setting: config.settingPath,
                navigate: `${config.prefix}-min`
            }));
        },
        onSelect: async (element, settingsStore) => {
            if (config.timeHandler) {
                return await config.timeHandler.handleSelection(element);
            }
            return { type: 'navigate', screenId: `${config.prefix}-min` };
        }
    }));

    // Minute screen
    screens.push(new SettingsScreenBase({
        id: `${config.prefix}-min`,
        title: config.title,
        parentId: config.parentId,
        settingPath: config.settingPath,
        getItems: () => {
            const minutes = ['00', '15', '30', '45'];
            return minutes.map(m => ({
                label: m,
                minute: parseInt(m),
                setting: config.settingPath,
                navigate: `${config.prefix}-period`
            }));
        },
        onSelect: async (element, settingsStore) => {
            if (config.timeHandler) {
                return await config.timeHandler.handleSelection(element);
            }
            return { type: 'navigate', screenId: `${config.prefix}-period` };
        }
    }));

    // Period screen
    screens.push(new SettingsScreenBase({
        id: `${config.prefix}-period`,
        title: config.title,
        parentId: config.parentId,
        settingPath: config.settingPath,
        getItems: () => {
            return [
                { label: 'AM', period: 'AM', setting: config.settingPath },
                { label: 'PM', period: 'PM', setting: config.settingPath }
            ];
        },
        onSelect: async (element, settingsStore) => {
            if (config.timeHandler) {
                const action = await config.timeHandler.handleSelection(element);

                // If time selection is complete, save and navigate back
                if (action.type === 'complete') {
                    await settingsStore.set(action.setting, action.value);
                    await settingsStore.save();

                    return {
                        type: 'complete',
                        navigateTo: config.parentId
                    };
                }

                return action;
            }
            return { type: 'none' };
        }
    }));

    return screens;
}
