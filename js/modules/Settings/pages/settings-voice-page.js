// js/modules/Settings/pages/settings-voice-page.js
// Voice settings page for TTS configuration

import { createLogger } from '../../../utils/logger.js';
import { SettingsPageBase } from '../core/settings-page-base.js';
import { AVAILABLE_VOICES, DEFAULT_VOICE_ID } from '../../../../config.js';
import AppComms from '../../../core/app-comms.js';

const logger = createLogger('SettingsVoicePage');

/**
 * Voice Settings Page
 * Handles TTS voice selection and voice enable/disable
 */
export class SettingsVoicePage extends SettingsPageBase {
    constructor() {
        super('voice');
    }

    /**
     * Initialize the page
     */
    async initialize() {
        if (this.initialized) return;

        logger.verbose('Initializing Voice settings page');
        this.initialized = true;
    }

    /**
     * Render the main Voice page content
     * @returns {string} - HTML string
     */
    render() {
        const voiceEnabled = this.getVoiceEnabled();
        const currentVoiceId = this.getCurrentVoiceId();

        // Find the current voice name for display
        const currentVoice = Object.values(AVAILABLE_VOICES).find(v => v.id === currentVoiceId);
        const currentVoiceName = currentVoice?.name || 'Bella';

        return `
            <div class="settings-modal__list">
                <div class="settings-modal__section">
                    <!-- Enable/Disable Voice Toggle -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--toggle"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Enable Voice</span>
                        <label class="settings-modal__toggle-switch">
                            <input type="checkbox" ${voiceEnabled ? 'checked' : ''} id="voice-enabled-toggle" data-setting="interface.voiceEnabled">
                            <span class="settings-modal__toggle-slider"></span>
                        </label>
                    </div>

                    <!-- Select Voice -->
                    <div class="settings-modal__menu-item settings-modal__menu-item--navigable"
                         data-navigate="voice-select"
                         role="button"
                         tabindex="0">
                        <span class="settings-modal__menu-label">Voice</span>
                        <span class="settings-modal__cell-value" id="voice-display">${currentVoiceName}</span>
                        <span class="settings-modal__cell-chevron">›</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Voice Selection Screen
     * Shows available voices from config.js
     * @returns {string} - HTML string
     */
    renderVoiceSelectionScreen() {
        const currentVoiceId = this.getCurrentVoiceId();

        // Convert AVAILABLE_VOICES object to array for rendering
        const voices = Object.values(AVAILABLE_VOICES);

        // Group voices by gender
        const femaleVoices = voices.filter(v => v.gender === 'female');
        const maleVoices = voices.filter(v => v.gender === 'male');

        return `
            <div class="settings-modal__list">
                <!-- Female Voices -->
                ${femaleVoices.length > 0 ? `
                    <div class="settings-modal__section">
                        <div class="settings-modal__section-header">Female Voices</div>
                        ${femaleVoices.map(voice => `
                            <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${voice.id === currentVoiceId ? 'settings-modal__menu-item--checked' : ''}"
                                 data-setting="interface.voiceId"
                                 data-value="${voice.id}"
                                 role="button"
                                 tabindex="0">
                                <span class="settings-modal__menu-label">
                                    ${voice.name}
                                    <span class="settings-modal__menu-sublabel">(${voice.description})</span>
                                </span>
                                <span class="settings-modal__cell-checkmark">${voice.id === currentVoiceId ? '✓' : ''}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Male Voices -->
                ${maleVoices.length > 0 ? `
                    <div class="settings-modal__section">
                        <div class="settings-modal__section-header">Male Voices</div>
                        ${maleVoices.map(voice => `
                            <div class="settings-modal__menu-item settings-modal__menu-item--selectable ${voice.id === currentVoiceId ? 'settings-modal__menu-item--checked' : ''}"
                                 data-setting="interface.voiceId"
                                 data-value="${voice.id}"
                                 role="button"
                                 tabindex="0">
                                <span class="settings-modal__menu-label">
                                    ${voice.name}
                                    <span class="settings-modal__menu-sublabel">(${voice.description})</span>
                                </span>
                                <span class="settings-modal__cell-checkmark">${voice.id === currentVoiceId ? '✓' : ''}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Get voice enabled setting
     * @returns {boolean}
     */
    getVoiceEnabled() {
        if (window.settingsStore) {
            // Default to true (enabled by default)
            return window.settingsStore.get('interface.voiceEnabled') !== false;
        }
        return true;
    }

    /**
     * Get current voice ID
     * @returns {string}
     */
    getCurrentVoiceId() {
        if (window.settingsStore) {
            return window.settingsStore.get('interface.voiceId') || DEFAULT_VOICE_ID;
        }
        return DEFAULT_VOICE_ID;
    }

    /**
     * Set voice enabled and persist
     * @param {boolean} enabled
     */
    async setVoiceEnabled(enabled) {
        logger.info('Setting voice enabled', { enabled });

        if (window.settingsStore) {
            window.settingsStore.set('interface.voiceEnabled', enabled);
            await window.settingsStore.save();

            // Trigger settings changed event for voice system to pick up changes
            AppComms.publish(AppComms.events.SETTINGS_CHANGED, {
                interface: {
                    voiceEnabled: enabled
                }
            });
        }
    }

    /**
     * Set voice ID and persist
     * @param {string} voiceId - Voice ID from AVAILABLE_VOICES
     */
    async setVoiceId(voiceId) {
        logger.info('Setting voice ID', { voiceId });

        if (window.settingsStore) {
            window.settingsStore.set('interface.voiceId', voiceId);
            await window.settingsStore.save();

            // Trigger settings changed event for voice system to pick up changes
            AppComms.publish(AppComms.events.SETTINGS_CHANGED, {
                interface: {
                    voiceId: voiceId
                }
            });
        }

        // Update display value
        this.updateVoiceDisplay(voiceId);
    }

    /**
     * Update voice display value after selection
     * @param {string} voiceId - Voice ID to display
     */
    updateVoiceDisplay(voiceId) {
        const voice = Object.values(AVAILABLE_VOICES).find(v => v.id === voiceId);
        const voiceName = voice?.name || 'Unknown';
        const displayElement = document.getElementById('voice-display');

        if (displayElement) {
            displayElement.textContent = voiceName;
            logger.debug('Updated voice display', { voiceId, voiceName });
        }
    }

    /**
     * Refresh the page display
     */
    async refresh() {
        const pageElement = document.querySelector('[data-screen="voice"]');
        if (pageElement) {
            pageElement.innerHTML = this.render();
            this.attachEventListeners();
        }
    }

    /**
     * Attach event listeners to toggles
     */
    attachEventListeners() {
        // Voice Enabled toggle
        const voiceEnabledToggle = document.getElementById('voice-enabled-toggle');
        if (voiceEnabledToggle) {
            voiceEnabledToggle.addEventListener('change', async (e) => {
                await this.setVoiceEnabled(e.target.checked);
            });
        }
    }

    /**
     * Get focusable elements for this page
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        const screen = document.querySelector('[data-screen="voice"].settings-modal__screen--active');
        if (!screen) return [];

        return Array.from(screen.querySelectorAll('.settings-modal__menu-item'));
    }

    /**
     * Handle activation (page shown)
     */
    activate() {
        logger.debug('Voice page activated');
        this.attachEventListeners();
    }

    /**
     * Handle deactivation (page hidden)
     */
    deactivate() {
        logger.debug('Voice page deactivated');
    }

    /**
     * Handle item click/selection
     * Overrides base class to handle voice selection
     * @param {HTMLElement} item - The clicked/selected item
     * @returns {Promise<Object>} Action to take
     */
    async handleItemClick(item) {
        // Handle voice selection
        if (item.dataset.setting === 'interface.voiceId' && item.dataset.value) {
            const voiceId = item.dataset.value;
            logger.info('Voice selected', { voiceId });

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

            // Apply the voice
            await this.setVoiceId(voiceId);

            return { shouldNavigate: false };
        }

        // Fall back to base class behavior for other items
        return await super.handleItemClick(item);
    }
}
