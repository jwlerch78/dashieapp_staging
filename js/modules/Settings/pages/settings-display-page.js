// js/modules/Settings/pages/settings-display-page.js
// Display settings page with theme, sleep/wake timer, and dynamic greeting

import { createLogger } from '../../../utils/logger.js';
import { TimeSelectionHandler } from '../utils/time-selection-handler.js';

const logger = createLogger('SettingsDisplayPage');

/**
 * Display Settings Page
 * Handles UI theme, sleep/wake times, and display preferences
 */
export class SettingsDisplayPage {
    constructor() {
        this.initialized = false;
        this.timeHandler = new TimeSelectionHandler();
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.info('Initializing Display settings page');
        this.initialized = true;
    }

    /**
     * Render the main Display page content
     * @returns {string} - HTML string
     */
    render() {
        const currentTheme = this.getCurrentTheme();
        const sleepTime = this.getSleepTime();
        const wakeTime = this.getWakeTime();
        const dynamicGreeting = this.getDynamicGreeting();

        // Format times for display
        const sleepTimeDisplay = this.timeHandler.formatTime(sleepTime);
        const wakeTimeDisplay = this.timeHandler.formatTime(wakeTime);

        // Format theme for display (capitalize first letter)
        const themeDisplay = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    <!-- Theme -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-navigate="display-theme"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Theme</span>
                        <span class="settings-modal__cell-value" id="theme-display">${themeDisplay}</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>
                </div>

                <div class="settings-modal__section">
                    <!-- Sleep Timer -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-navigate="display-sleep-time-hour"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Sleep Timer</span>
                        <span class="settings-modal__cell-value" id="sleep-time-display">${sleepTimeDisplay}</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>

                    <!-- Wake Timer -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-navigate="display-wake-time-hour"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Wake Timer</span>
                        <span class="settings-modal__cell-value" id="wake-time-display">${wakeTimeDisplay}</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>
                </div>

                <div class="settings-modal__section">
                    <!-- Dynamic Greeting Toggle -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--toggle"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Dynamic Greeting</span>
                        <label class="settings-modal__toggle-switch">
                            <input type="checkbox" ${dynamicGreeting ? 'checked' : ''} id="dynamic-greeting-toggle" data-setting="interface.dynamicGreeting">
                            <span class="settings-modal__toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Theme Selection Screen
     * @returns {string} - HTML string
     */
    renderThemeScreen() {
        const currentTheme = this.getCurrentTheme();
        const themes = ['Dark', 'Light']; // Can easily add more themes here

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    ${themes.map(theme => {
                        const themeValue = theme.toLowerCase();
                        return `
                            <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${themeValue === currentTheme ? 'settings-modal__menu-item--checked' : ''}"
                                 data-setting="interface.theme"
                                 data-value="${themeValue}"
                                 role="button"
                                 tabindex="0">
                                <span class="settings-modal__menu-label">${theme}</span>
                                <span class="settings-modal__cell-checkmark">${themeValue === currentTheme ? '✓' : ''}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render Sleep Time - Hour Selection Screen
     * @returns {string} - HTML string
     */
    renderSleepTimeHourScreen() {
        const sleepTime = this.getSleepTime();
        const parsed = this.timeHandler.parseTime24(sleepTime);
        const currentHour = parsed.hour12;

        const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    ${hours.map(hour => `
                        <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${hour === currentHour ? 'settings-modal__menu-item--checked' : ''}"
                             data-hour="${hour}"
                             data-navigate="display-sleep-time-min"
                             data-setting="interface.sleepTime"
                             role="button"
                             tabindex="0">
                            <span class="settings-modal__menu-label">${hour}</span>
                            <span class="settings-modal__cell-checkmark">${hour === currentHour ? '✓' : ''}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render Sleep Time - Minute Selection Screen
     * @returns {string} - HTML string
     */
    renderSleepTimeMinScreen() {
        const sleepTime = this.getSleepTime();
        const parsed = this.timeHandler.parseTime24(sleepTime);
        const currentMinute = parsed.minute;

        const minutes = [0, 15, 30, 45];

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    ${minutes.map(minute => `
                        <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${minute === currentMinute ? 'settings-modal__menu-item--checked' : ''}"
                             data-minute="${minute}"
                             data-navigate="display-sleep-time-period"
                             data-setting="interface.sleepTime"
                             role="button"
                             tabindex="0">
                            <span class="settings-modal__menu-label">${minute.toString().padStart(2, '0')}</span>
                            <span class="settings-modal__cell-checkmark">${minute === currentMinute ? '✓' : ''}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render Sleep Time - AM/PM Selection Screen
     * @returns {string} - HTML string
     */
    renderSleepTimePeriodScreen() {
        const sleepTime = this.getSleepTime();
        const parsed = this.timeHandler.parseTime24(sleepTime);
        const currentPeriod = parsed.period;

        const periods = ['AM', 'PM'];

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    ${periods.map(period => `
                        <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${period === currentPeriod ? 'settings-modal__menu-item--checked' : ''}"
                             data-period="${period}"
                             data-navigate="display"
                             data-setting="interface.sleepTime"
                             role="button"
                             tabindex="0">
                            <span class="settings-modal__menu-label">${period}</span>
                            <span class="settings-modal__cell-checkmark">${period === currentPeriod ? '✓' : ''}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render Wake Time - Hour Selection Screen
     * @returns {string} - HTML string
     */
    renderWakeTimeHourScreen() {
        const wakeTime = this.getWakeTime();
        const parsed = this.timeHandler.parseTime24(wakeTime);
        const currentHour = parsed.hour12;

        const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    ${hours.map(hour => `
                        <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${hour === currentHour ? 'settings-modal__menu-item--checked' : ''}"
                             data-hour="${hour}"
                             data-navigate="display-wake-time-min"
                             data-setting="interface.wakeTime"
                             role="button"
                             tabindex="0">
                            <span class="settings-modal__menu-label">${hour}</span>
                            <span class="settings-modal__cell-checkmark">${hour === currentHour ? '✓' : ''}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render Wake Time - Minute Selection Screen
     * @returns {string} - HTML string
     */
    renderWakeTimeMinScreen() {
        const wakeTime = this.getWakeTime();
        const parsed = this.timeHandler.parseTime24(wakeTime);
        const currentMinute = parsed.minute;

        const minutes = [0, 15, 30, 45];

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    ${minutes.map(minute => `
                        <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${minute === currentMinute ? 'settings-modal__menu-item--checked' : ''}"
                             data-minute="${minute}"
                             data-navigate="display-wake-time-period"
                             data-setting="interface.wakeTime"
                             role="button"
                             tabindex="0">
                            <span class="settings-modal__menu-label">${minute.toString().padStart(2, '0')}</span>
                            <span class="settings-modal__cell-checkmark">${minute === currentMinute ? '✓' : ''}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render Wake Time - AM/PM Selection Screen
     * @returns {string} - HTML string
     */
    renderWakeTimePeriodScreen() {
        const wakeTime = this.getWakeTime();
        const parsed = this.timeHandler.parseTime24(wakeTime);
        const currentPeriod = parsed.period;

        const periods = ['AM', 'PM'];

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    ${periods.map(period => `
                        <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${period === currentPeriod ? 'settings-modal__menu-item--checked' : ''}"
                             data-period="${period}"
                             data-navigate="display"
                             data-setting="interface.wakeTime"
                             role="button"
                             tabindex="0">
                            <span class="settings-modal__menu-label">${period}</span>
                            <span class="settings-modal__cell-checkmark">${period === currentPeriod ? '✓' : ''}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Get current theme setting
     * @returns {string} - 'dark' or 'light'
     */
    getCurrentTheme() {
        if (window.settingsStore) {
            return window.settingsStore.get('interface.theme') || 'light';
        }
        return 'light';
    }

    /**
     * Get sleep time setting
     * @returns {string} - Time in 24-hour format "HH:MM"
     */
    getSleepTime() {
        if (window.settingsStore) {
            return window.settingsStore.get('interface.sleepTime') || '22:00';
        }
        return '22:00';
    }

    /**
     * Get wake time setting
     * @returns {string} - Time in 24-hour format "HH:MM"
     */
    getWakeTime() {
        if (window.settingsStore) {
            return window.settingsStore.get('interface.wakeTime') || '07:00';
        }
        return '07:00';
    }

    /**
     * Get dynamic greeting setting
     * @returns {boolean}
     */
    getDynamicGreeting() {
        if (window.settingsStore) {
            return window.settingsStore.get('interface.dynamicGreeting') || false;
        }
        return false;
    }

    /**
     * Set theme and persist
     * @param {string} theme - 'dark' or 'light'
     */
    async setTheme(theme) {
        logger.info('Setting theme', { theme });

        // Update settings store (interface.theme)
        if (window.settingsStore) {
            window.settingsStore.set('interface.theme', theme);
            await window.settingsStore.save();
        }

        // Apply theme via ThemeApplier (handles DOM, widgets, and dashie-theme localStorage)
        if (window.themeApplier) {
            window.themeApplier.applyTheme(theme, true);
        }

        // Update the theme display on the main Display screen
        this.updateThemeDisplay();
    }

    /**
     * Set dynamic greeting and persist
     * @param {boolean} enabled
     */
    async setDynamicGreeting(enabled) {
        logger.info('Setting dynamic greeting', { enabled });

        if (window.settingsStore) {
            window.settingsStore.set('interface.dynamicGreeting', enabled);
            await window.settingsStore.save();
        }
    }

    /**
     * Update time display values after selection
     * @param {string} settingKey - 'interface.sleepTime' or 'interface.wakeTime'
     */
    updateTimeDisplay(settingKey) {
        const timeValue = window.settingsStore?.get(settingKey);
        if (!timeValue) return;

        const formattedTime = this.timeHandler.formatTime(timeValue);
        const displayId = settingKey.includes('sleepTime') ? 'sleep-time-display' : 'wake-time-display';
        const displayElement = document.getElementById(displayId);

        if (displayElement) {
            displayElement.textContent = formattedTime;
            logger.debug('Updated time display', { settingKey, formattedTime });
        }
    }

    /**
     * Update theme display value after selection
     */
    updateThemeDisplay() {
        const theme = this.getCurrentTheme();
        const themeDisplay = theme.charAt(0).toUpperCase() + theme.slice(1);
        const displayElement = document.getElementById('theme-display');

        if (displayElement) {
            displayElement.textContent = themeDisplay;
            logger.debug('Updated theme display', { theme, themeDisplay });
        }
    }

    /**
     * Refresh the page display
     */
    async refresh() {
        // Find the page element and update its innerHTML
        const pageElement = document.querySelector('[data-screen="display"]');
        if (pageElement) {
            pageElement.innerHTML = this.render();
            this.attachEventListeners();
        }
    }

    /**
     * Attach event listeners to dynamic greeting toggle
     * (Theme cells are handled by input handler via ENTER key)
     */
    attachEventListeners() {
        // Dynamic Greeting toggle
        const toggleInput = document.getElementById('dynamic-greeting-toggle');
        if (toggleInput) {
            toggleInput.addEventListener('change', async (e) => {
                await this.setDynamicGreeting(e.target.checked);
            });
        }
    }

    /**
     * Get focusable elements for this page
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        // Return all interactive elements within the active Display screen
        const screen = document.querySelector('[data-screen="display"].settings-modal__screen--active');
        if (!screen) return [];

        return Array.from(screen.querySelectorAll('.settings-modal__menu-item'));
    }

    /**
     * Handle activation (page shown)
     */
    activate() {
        logger.debug('Display page activated');

        // Attach event listeners when page becomes active
        this.attachEventListeners();
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        logger.debug('Display page deactivated');
    }

    /**
     * Get the time selection handler
     * @returns {TimeSelectionHandler}
     */
    getTimeHandler() {
        return this.timeHandler;
    }
}
