// js/modules/Settings/pages/settings-display-page.js
// Display settings page with theme, sleep/wake timer, and dynamic greeting
// v2.0 - Updated to use theme family architecture

import { createLogger } from '../../../utils/logger.js';
import { SettingsPageBase } from '../core/settings-page-base.js';
import { TimeSelectionHandler } from '../utils/time-selection-handler.js';
import {
    getAllThemeFamilies,
    parseThemeId,
    buildThemeId,
    DEFAULT_THEME_FAMILY,
    DEFAULT_THEME_MODE
} from '../../../ui/themes/theme-registry.js';

const logger = createLogger('SettingsDisplayPage');

/**
 * Display Settings Page
 * Handles UI theme, sleep/wake times, and display preferences
 */
export class SettingsDisplayPage extends SettingsPageBase {
    constructor() {
        super('display');
        this.timeHandler = new TimeSelectionHandler();
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.verbose('Initializing Display settings page');
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
        const sleepTimerEnabled = this.getSleepTimerEnabled();

        // Format times for display
        const sleepTimeDisplay = this.timeHandler.formatTime(sleepTime);
        const wakeTimeDisplay = this.timeHandler.formatTime(wakeTime);

        // Add disabled class if sleep timer is off
        const timeDisabledClass = sleepTimerEnabled ? '' : 'settings-modal__menu-item--disabled';

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    <!-- Manage Themes -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-navigate="display-manage-themes"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Manage Themes</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>
                </div>

                <div class="settings-modal__section">
                    <!-- Sleep/Wake Timer Toggle -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--toggle"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Sleep/Wake Timer</span>
                        <label class="settings-modal__toggle-switch">
                            <input type="checkbox" ${sleepTimerEnabled ? 'checked' : ''} id="sleep-timer-enabled-toggle" data-setting="interface.sleepTimerEnabled">
                            <span class="settings-modal__toggle-slider"></span>
                        </label>
                    </div>

                    <!-- Sleep Time -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable sleep-time-cell ${timeDisabledClass}"
                         data-navigate="display-sleep-time-hour"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Sleep Time</span>
                        <span class="settings-modal__cell-value" id="sleep-time-display">${sleepTimeDisplay}</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>

                    <!-- Wake Time -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable wake-time-cell ${timeDisabledClass}"
                         data-navigate="display-wake-time-hour"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Wake Time</span>
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
     * Render Manage Themes Screen
     * Shows current theme and animation settings
     * @returns {string} - HTML string
     */
    renderManageThemesScreen() {
        const currentTheme = this.getCurrentTheme();
        const parsed = parseThemeId(currentTheme) || { family: DEFAULT_THEME_FAMILY, mode: DEFAULT_THEME_MODE };

        // Get theme family for display
        const themeFamilies = getAllThemeFamilies();
        const currentFamily = themeFamilies.find(f => f.id === parsed.family);
        const themeFamilyDisplay = currentFamily?.name || 'Default';

        // Check if mode is dark
        const isDarkMode = parsed.mode === 'dark';

        const animationsEnabled = this.getThemeAnimationsEnabled();
        const animationLevel = this.getAnimationLevel();

        // Gray out animation level when animations are disabled
        const animationLevelDisabled = !animationsEnabled ? 'settings-modal__menu-item--disabled' : '';

        return `
            <div class="settings-modal__list">
                <!-- Theme Family -->
                <div class="settings-modal__section">
                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-navigate="display-theme-selector"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Theme</span>
                        <span class="settings-modal__cell-value" id="theme-family-display">${themeFamilyDisplay}</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>

                    <!-- Light/Dark Mode Toggle -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--toggle"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Dark Mode</span>
                        <label class="settings-modal__toggle-switch">
                            <input type="checkbox" ${isDarkMode ? 'checked' : ''} id="theme-mode-toggle" data-setting="interface.themeMode">
                            <span class="settings-modal__toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <!-- Animation Controls -->
                <div class="settings-modal__section">
                    <!-- Enable Theme Animations -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--toggle"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Enable Theme Animations</span>
                        <label class="settings-modal__toggle-switch">
                            <input type="checkbox" ${animationsEnabled ? 'checked' : ''} id="theme-animations-toggle" data-setting="interface.themeAnimationsEnabled">
                            <span class="settings-modal__toggle-slider"></span>
                        </label>
                    </div>

                    <!-- Animation Level -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable ${animationLevelDisabled}"
                         data-navigate="display-animation-level"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Animation Level</span>
                        <span class="settings-modal__cell-value" id="animation-level-display">${animationLevel === 'high' ? 'High' : 'Low'}</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>
                </div>

                <!-- Seasonal Automation (Future Feature) -->
                <div class="settings-modal__section">
                    <!-- Seasonal Theme Automation -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--toggle settings-modal__menu-item--disabled"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Seasonal Theme Automation</span>
                        <label class="settings-modal__toggle-switch">
                            <input type="checkbox" disabled id="seasonal-automation-toggle">
                            <span class="settings-modal__toggle-slider"></span>
                        </label>
                    </div>

                    <!-- Select Seasonal Themes -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable settings-modal__menu-item--disabled"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Select Seasonal Themes</span>
                        <span class="settings-modal__cell-value">--</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Theme Selector Screen
     * Shows theme families (Default, Halloween, etc.)
     * @returns {string} - HTML string
     */
    renderThemeSelectorScreen() {
        const currentTheme = this.getCurrentTheme();
        const parsed = parseThemeId(currentTheme) || { family: DEFAULT_THEME_FAMILY, mode: DEFAULT_THEME_MODE };
        const currentFamily = parsed.family;

        const themeFamilies = getAllThemeFamilies(); // Get theme families from registry

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    ${themeFamilies.map(family => {
                        return `
                            <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${family.id === currentFamily ? 'settings-modal__menu-item--checked' : ''}"
                                 data-setting="interface.themeFamily"
                                 data-value="${family.id}"
                                 role="button"
                                 tabindex="0">
                                <span class="settings-modal__menu-label">${family.name}</span>
                                <span class="settings-modal__cell-checkmark">${family.id === currentFamily ? '✓' : ''}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render Animation Level Selection Screen
     * @returns {string} - HTML string
     */
    renderAnimationLevelScreen() {
        const currentLevel = this.getAnimationLevel();
        const levels = [
            { value: 'low', label: 'Low' },
            { value: 'high', label: 'High' }
        ];

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    ${levels.map(level => `
                        <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${level.value === currentLevel ? 'settings-modal__menu-item--checked' : ''}"
                             data-setting="interface.animationLevel"
                             data-value="${level.value}"
                             role="button"
                             tabindex="0">
                            <span class="settings-modal__menu-label">${level.label}</span>
                            <span class="settings-modal__cell-checkmark">${level.value === currentLevel ? '✓' : ''}</span>
                        </div>
                    `).join('')}
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
     * Get current theme
     * Handles migration from old theme format to new family+mode format
     * @returns {string} - Theme ID (e.g., 'halloween-dark' or 'default-light')
     */
    getCurrentTheme() {
        if (!window.settingsStore) {
            return buildThemeId(DEFAULT_THEME_FAMILY, DEFAULT_THEME_MODE);
        }

        // Try to get theme from new architecture first
        let themeFamily = window.settingsStore.get('interface.themeFamily');
        let themeMode = window.settingsStore.get('interface.themeMode');

        // If new settings don't exist, try to migrate from old 'interface.theme'
        if (!themeFamily || !themeMode) {
            const oldTheme = window.settingsStore.get('interface.theme');

            if (oldTheme) {
                // Parse old theme ID
                const parsed = parseThemeId(oldTheme);
                if (parsed) {
                    themeFamily = parsed.family;
                    themeMode = parsed.mode;

                    // Migrate to new format
                    window.settingsStore.set('interface.themeFamily', themeFamily);
                    window.settingsStore.set('interface.themeMode', themeMode);
                    logger.debug('Migrated theme settings', { from: oldTheme, family: themeFamily, mode: themeMode });
                } else {
                    // Fallback for invalid old theme
                    themeFamily = DEFAULT_THEME_FAMILY;
                    themeMode = DEFAULT_THEME_MODE;
                }
            } else {
                // No theme set at all - use defaults
                themeFamily = DEFAULT_THEME_FAMILY;
                themeMode = DEFAULT_THEME_MODE;
            }
        }

        return buildThemeId(themeFamily, themeMode);
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
     * Get sleep timer enabled setting
     * @returns {boolean}
     */
    getSleepTimerEnabled() {
        if (window.settingsStore) {
            // Default to false (disabled by default, as per legacy v1.5)
            return window.settingsStore.get('interface.sleepTimerEnabled') !== false;
        }
        return true;
    }

    /**
     * Get theme animations enabled setting
     * @returns {boolean}
     */
    getThemeAnimationsEnabled() {
        if (window.settingsStore) {
            return window.settingsStore.get('interface.themeAnimationsEnabled') !== false;
        }
        return true; // Default to enabled
    }

    /**
     * Get animation level setting
     * @returns {string} - 'low' or 'high'
     */
    getAnimationLevel() {
        if (window.settingsStore) {
            return window.settingsStore.get('interface.animationLevel') || 'high';
        }
        return 'high'; // Default to high
    }

    /**
     * Set theme family and persist
     * @param {string} familyId - Theme family ID (e.g., 'default', 'halloween')
     */
    async setThemeFamily(familyId) {
        logger.info('Setting theme family', { familyId });

        // Get current mode
        const currentTheme = this.getCurrentTheme();
        const parsed = parseThemeId(currentTheme) || { family: DEFAULT_THEME_FAMILY, mode: DEFAULT_THEME_MODE };
        const currentMode = parsed.mode;

        // Build new theme ID
        const newThemeId = buildThemeId(familyId, currentMode);

        // Save to settings store
        if (window.settingsStore) {
            window.settingsStore.set('interface.themeFamily', familyId);
            window.settingsStore.set('interface.theme', newThemeId);
        }

        // Apply theme for instant visual feedback
        if (window.themeApplier) {
            window.themeApplier.applyTheme(newThemeId, true);
        }

        // Update the theme display
        this.updateDisplayValues();

        // Save to database in the background
        if (window.settingsStore) {
            await window.settingsStore.save();
        }
    }

    /**
     * Set theme mode (light/dark) and persist
     * @param {string} mode - 'light' or 'dark'
     */
    async setThemeMode(mode) {
        logger.info('Setting theme mode', { mode });

        // Get current family
        const currentTheme = this.getCurrentTheme();
        const parsed = parseThemeId(currentTheme) || { family: DEFAULT_THEME_FAMILY, mode: DEFAULT_THEME_MODE };
        const currentFamily = parsed.family;

        // Build new theme ID
        const newThemeId = buildThemeId(currentFamily, mode);

        // Save to settings store
        if (window.settingsStore) {
            window.settingsStore.set('interface.themeMode', mode);
            window.settingsStore.set('interface.theme', newThemeId);
        }

        // Apply theme for instant visual feedback
        if (window.themeApplier) {
            window.themeApplier.applyTheme(newThemeId, true);
        }

        // Update the theme display
        this.updateDisplayValues();

        // Save to database in the background
        if (window.settingsStore) {
            await window.settingsStore.save();
        }
    }

    /**
     * Set theme and persist (legacy method - still used by input handler)
     * @param {string} theme - Theme ID (e.g., 'halloween-dark')
     */
    async setTheme(theme) {
        logger.info('Setting theme', { theme });

        // Parse theme ID to get family and mode
        const parsed = parseThemeId(theme);
        if (!parsed) {
            logger.error('Invalid theme ID', { theme });
            return;
        }

        // Save to settings store
        if (window.settingsStore) {
            window.settingsStore.set('interface.themeFamily', parsed.family);
            window.settingsStore.set('interface.themeMode', parsed.mode);
            window.settingsStore.set('interface.theme', theme);
        }

        // Apply theme for instant visual feedback
        if (window.themeApplier) {
            window.themeApplier.applyTheme(theme, true);
        }

        // Update the theme display
        this.updateDisplayValues();

        // Save to database in the background
        if (window.settingsStore) {
            await window.settingsStore.save();
        }
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
     * Set sleep timer enabled and persist
     * @param {boolean} enabled
     */
    async setSleepTimerEnabled(enabled) {
        logger.info('Setting sleep timer enabled', { enabled });

        if (window.settingsStore) {
            window.settingsStore.set('interface.sleepTimerEnabled', enabled);
            await window.settingsStore.save();
        }

        // Update UI to gray out or enable sleep/wake time cells
        this.updateSleepTimerStates(enabled);
    }

    /**
     * Set theme animations enabled and persist
     * @param {boolean} enabled
     */
    async setThemeAnimationsEnabled(enabled) {
        logger.info('Setting theme animations enabled', { enabled });

        if (window.settingsStore) {
            window.settingsStore.set('interface.themeAnimationsEnabled', enabled);
            await window.settingsStore.save();
        }

        // Update theme overlay to apply/remove animations
        if (window.themeOverlay && window.themeApplier) {
            window.themeOverlay.setEnabled(enabled);

            // If re-enabling, re-apply the current theme to show overlays
            if (enabled) {
                const currentTheme = window.themeApplier.getCurrentTheme();
                window.themeOverlay.applyOverlay(currentTheme);
            }
        }

        // Update UI to gray out or enable animation level selector
        this.updateAnimationLevelState(enabled);
    }

    /**
     * Set animation level and persist
     * @param {string} level - 'low' or 'high'
     */
    async setAnimationLevel(level) {
        logger.info('Setting animation level', { level });

        if (window.settingsStore) {
            window.settingsStore.set('interface.animationLevel', level);
            await window.settingsStore.save();
        }

        // Re-apply current theme with new animation level
        if (window.themeApplier && window.themeOverlay) {
            const currentTheme = window.themeApplier.getCurrentTheme();
            // applyOverlay now handles clearing internally and prevents duplicates
            window.themeOverlay.applyOverlay(currentTheme);
        }

        // Update display value
        this.updateAnimationLevelDisplay(level);
    }

    /**
     * Update sleep/wake time cell states (enabled/disabled)
     * @param {boolean} enabled
     */
    updateSleepTimerStates(enabled) {
        const sleepTimeCell = document.querySelector('.sleep-time-cell');
        const wakeTimeCell = document.querySelector('.wake-time-cell');

        if (enabled) {
            sleepTimeCell?.classList.remove('settings-modal__menu-item--disabled');
            wakeTimeCell?.classList.remove('settings-modal__menu-item--disabled');
        } else {
            sleepTimeCell?.classList.add('settings-modal__menu-item--disabled');
            wakeTimeCell?.classList.add('settings-modal__menu-item--disabled');
        }

        logger.debug('Sleep timer states updated', { enabled });
    }

    /**
     * Update animation level selector state (enabled/disabled)
     * @param {boolean} enabled
     */
    updateAnimationLevelState(enabled) {
        const animationLevelCell = document.querySelector('[data-navigate="display-animation-level"]');

        if (enabled) {
            animationLevelCell?.classList.remove('settings-modal__menu-item--disabled');
        } else {
            animationLevelCell?.classList.add('settings-modal__menu-item--disabled');
        }

        logger.debug('Animation level state updated', { enabled });
    }

    /**
     * Update animation level display value
     * @param {string} level - 'low' or 'high'
     */
    updateAnimationLevelDisplay(level) {
        const displayElement = document.getElementById('animation-level-display');

        if (displayElement) {
            displayElement.textContent = level === 'high' ? 'High' : 'Low';
            logger.debug('Updated animation level display', { level });
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
     * @param {string} theme - Optional theme to display (if not provided, reads from store)
     */
    updateThemeDisplay(theme = null) {
        const themeToDisplay = theme || this.getCurrentTheme();
        const themeDisplay = themeToDisplay.charAt(0).toUpperCase() + themeToDisplay.slice(1);
        const displayElement = document.getElementById('theme-display');

        if (displayElement) {
            displayElement.textContent = themeDisplay;
            logger.debug('Updated theme display', { theme: themeToDisplay, themeDisplay });
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
     * Attach event listeners to toggles
     * (Theme cells are handled by input handler via ENTER key)
     */
    attachEventListeners() {
        // Sleep Timer Enabled toggle
        const sleepTimerToggle = document.getElementById('sleep-timer-enabled-toggle');
        if (sleepTimerToggle) {
            sleepTimerToggle.addEventListener('change', async (e) => {
                await this.setSleepTimerEnabled(e.target.checked);
            });
        }

        // Dynamic Greeting toggle
        const greetingToggle = document.getElementById('dynamic-greeting-toggle');
        if (greetingToggle) {
            greetingToggle.addEventListener('change', async (e) => {
                await this.setDynamicGreeting(e.target.checked);
            });
        }

        // Theme Mode toggle (Light/Dark)
        const themeModeToggle = document.getElementById('theme-mode-toggle');
        if (themeModeToggle) {
            themeModeToggle.addEventListener('change', async (e) => {
                const newMode = e.target.checked ? 'dark' : 'light';
                await this.setThemeMode(newMode);
            });
        }

        // Theme Animations toggle
        const themeAnimationsToggle = document.getElementById('theme-animations-toggle');
        if (themeAnimationsToggle) {
            themeAnimationsToggle.addEventListener('change', async (e) => {
                await this.setThemeAnimationsEnabled(e.target.checked);
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

        // Update displayed values in case they changed in sub-screens
        this.updateDisplayValues();

        // Attach event listeners when page becomes active
        this.attachEventListeners();
    }

    /**
     * Update displayed values on the main Display page
     * Called when navigating back to this page after changing settings
     */
    updateDisplayValues() {
        // Update theme family display
        const themeFamilyDisplay = document.getElementById('theme-family-display');
        if (themeFamilyDisplay) {
            const currentTheme = this.getCurrentTheme();
            const parsed = parseThemeId(currentTheme) || { family: DEFAULT_THEME_FAMILY, mode: DEFAULT_THEME_MODE };

            const themeFamilies = getAllThemeFamilies();
            const currentFamily = themeFamilies.find(f => f.id === parsed.family);
            const themeFamilyFormatted = currentFamily?.name || 'Default';

            themeFamilyDisplay.textContent = themeFamilyFormatted;
            logger.debug('Updated theme family display to', themeFamilyFormatted);
        }

        // Update sleep time display
        const sleepTimeDisplay = document.getElementById('sleep-time-display');
        if (sleepTimeDisplay) {
            const sleepTime = this.getSleepTime();
            const sleepTimeFormatted = this.timeHandler.formatTime(sleepTime);
            sleepTimeDisplay.textContent = sleepTimeFormatted;
        }

        // Update wake time display
        const wakeTimeDisplay = document.getElementById('wake-time-display');
        if (wakeTimeDisplay) {
            const wakeTime = this.getWakeTime();
            const wakeTimeFormatted = this.timeHandler.formatTime(wakeTime);
            wakeTimeDisplay.textContent = wakeTimeFormatted;
        }
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

    /**
     * Handle item click/selection
     * Overrides base class to handle theme family, theme, and animation level selection
     * @param {HTMLElement} item - The clicked/selected item
     * @returns {Promise<Object>} Action to take
     */
    async handleItemClick(item) {
        // Handle theme family selection (new architecture)
        if (item.dataset.setting === 'interface.themeFamily' && item.dataset.value) {
            const value = item.dataset.value;
            logger.info('Theme family selected', { value });

            // Update checkmarks for visual feedback
            const parent = item.parentElement;
            parent.querySelectorAll('.settings-modal__menu-item--checked').forEach(el => {
                el.classList.remove('settings-modal__menu-item--checked');
                const checkmark = el.querySelector('.settings-modal__cell-checkmark');
                if (checkmark) checkmark.textContent = '';
            });

            item.classList.add('settings-modal__menu-item--checked');
            const checkmark = item.querySelector('.settings-modal__cell-checkmark');
            if (checkmark) checkmark.textContent = '✓';

            // Apply the theme family
            await this.setThemeFamily(value);

            return { shouldNavigate: false };
        }

        // Handle theme selection (legacy - for backwards compatibility)
        if (item.dataset.setting === 'interface.theme' && item.dataset.value) {
            const value = item.dataset.value;
            logger.info('Theme selected', { value });

            // Update checkmarks for visual feedback
            const parent = item.parentElement;
            parent.querySelectorAll('.settings-modal__menu-item--checked').forEach(el => {
                el.classList.remove('settings-modal__menu-item--checked');
                const checkmark = el.querySelector('.settings-modal__cell-checkmark');
                if (checkmark) checkmark.textContent = '';
            });

            item.classList.add('settings-modal__menu-item--checked');
            const checkmark = item.querySelector('.settings-modal__cell-checkmark');
            if (checkmark) checkmark.textContent = '✓';

            // Apply the theme
            await this.setTheme(value);

            return { shouldNavigate: false };
        }

        // Handle animation level selection
        if (item.dataset.setting === 'interface.animationLevel' && item.dataset.value) {
            const value = item.dataset.value;
            logger.info('Animation level selected', { value });

            // Update checkmarks for visual feedback
            const parent = item.parentElement;
            parent.querySelectorAll('.settings-modal__menu-item--checked').forEach(el => {
                el.classList.remove('settings-modal__menu-item--checked');
                const checkmark = el.querySelector('.settings-modal__cell-checkmark');
                if (checkmark) checkmark.textContent = '';
            });

            item.classList.add('settings-modal__menu-item--checked');
            const checkmark = item.querySelector('.settings-modal__cell-checkmark');
            if (checkmark) checkmark.textContent = '✓';

            // Apply the animation level
            await this.setAnimationLevel(value);

            return { shouldNavigate: false };
        }

        // Fall back to base class behavior for other items
        return await super.handleItemClick(item);
    }
}
