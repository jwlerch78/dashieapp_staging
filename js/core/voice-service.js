/**
 * VoiceService - Platform abstraction layer for voice input/output
 *
 * Provides unified API for voice functionality across platforms:
 * - Web: Uses Web Speech API (SpeechRecognition, SpeechSynthesis)
 * - Android: Uses DashieNative bridge
 *
 * All voice events are emitted via AppComms for decoupled communication.
 */

import { createLogger } from '../utils/logger.js';
import { AppComms } from './app-comms.js';

const logger = createLogger('VoiceService');

class VoiceService {
  constructor() {
    if (VoiceService.instance) {
      return VoiceService.instance;
    }

    this.provider = null;
    this.initialized = false;

    VoiceService.instance = this;
  }

  /**
   * Initialize voice service with appropriate provider
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('VoiceService already initialized');
      return;
    }

    try {
      // Detect platform and load appropriate provider
      const isAndroid = this._detectAndroidPlatform();

      if (isAndroid) {
        logger.info('Detected Android platform, loading AndroidVoiceProvider');
        const { AndroidVoiceProvider } = await import('./voice/android-voice-provider.js');
        this.provider = new AndroidVoiceProvider();
      } else {
        logger.info('Detected Web platform, loading WebVoiceProvider');
        const { WebVoiceProvider } = await import('./voice/web-voice-provider.js');
        this.provider = new WebVoiceProvider();
      }

      await this.provider.initialize();
      this.initialized = true;

      // Load voice settings from settingsStore and apply to provider
      this._loadAndApplyVoiceSettings();

      // Subscribe to settings changes to update voice when settings change
      this._subscribeToSettingsChanges();

      logger.success('VoiceService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize VoiceService:', error);
      throw error;
    }
  }

  /**
   * Load voice settings from settingsStore and apply to provider
   * @private
   */
  _loadAndApplyVoiceSettings() {
    try {
      if (!window.settingsStore) {
        logger.warn('settingsStore not available, using default voice settings');
        return;
      }

      // Get voice settings from store
      const voiceEnabled = window.settingsStore.get('interface.voiceEnabled');
      const voiceId = window.settingsStore.get('interface.voiceId');

      logger.info('Loading voice settings', {
        voiceEnabled: voiceEnabled !== false, // Default to true if not set
        voiceId: voiceId || 'default'
      });

      // Apply settings to provider if they exist
      if (voiceId) {
        this._applyVoiceSettings({ voiceId, voiceEnabled });
      }
    } catch (error) {
      logger.error('Failed to load voice settings:', error);
    }
  }

  /**
   * Apply voice settings to the provider
   * @private
   * @param {Object} settings - Voice settings
   * @param {string} settings.voiceId - Voice ID from AVAILABLE_VOICES
   * @param {boolean} settings.voiceEnabled - Whether voice is enabled
   */
  _applyVoiceSettings(settings) {
    try {
      if (!this.provider || typeof this.provider.setVoiceSettings !== 'function') {
        logger.warn('Provider does not support setVoiceSettings');
        return;
      }

      // Import AVAILABLE_VOICES from config to find the voice object
      import('../../config.js').then(({ AVAILABLE_VOICES }) => {
        const voice = Object.values(AVAILABLE_VOICES).find(v => v.id === settings.voiceId);

        if (voice) {
          this.provider.setVoiceSettings({
            voice: voice,
            enabled: settings.voiceEnabled !== false
          });

          logger.success('Voice settings applied', {
            voiceName: voice.name,
            voiceId: voice.id,
            enabled: settings.voiceEnabled !== false
          });
        } else {
          logger.warn('Voice not found in AVAILABLE_VOICES', { voiceId: settings.voiceId });
        }
      });
    } catch (error) {
      logger.error('Failed to apply voice settings:', error);
    }
  }

  /**
   * Subscribe to settings changes to update voice provider when settings change
   * @private
   */
  _subscribeToSettingsChanges() {
    AppComms.subscribe(AppComms.events.SETTINGS_CHANGED, (data) => {
      // Check if voice settings changed
      if (data?.interface?.voiceId || data?.interface?.voiceEnabled !== undefined) {
        logger.info('Voice settings changed, updating provider', {
          voiceId: data.interface?.voiceId,
          voiceEnabled: data.interface?.voiceEnabled
        });

        this._applyVoiceSettings({
          voiceId: data.interface?.voiceId || window.settingsStore?.get('interface.voiceId'),
          voiceEnabled: data.interface?.voiceEnabled
        });
      }
    });

    logger.debug('Subscribed to settings changes for voice updates');
  }

  /**
   * Detect if running on Android with DashieNative bridge
   */
  _detectAndroidPlatform() {
    return typeof window.DashieNative !== 'undefined';
  }

  /**
   * Check if running on Android platform
   */
  isAndroid() {
    return this._detectAndroidPlatform();
  }

  /**
   * Check if running on Web platform
   */
  isWebPlatform() {
    return !this._detectAndroidPlatform();
  }

  /**
   * Start listening for voice input
   * Emits VOICE_LISTENING_STARTED event
   */
  startListening() {
    if (!this.initialized) {
      logger.error('VoiceService not initialized');
      return;
    }

    try {
      logger.info('Starting voice listening');
      this.provider.startListening();
    } catch (error) {
      logger.error('Error starting voice listening:', error);
      AppComms.emit('VOICE_ERROR', { message: error.message });
    }
  }

  /**
   * Stop listening for voice input
   * Emits VOICE_LISTENING_STOPPED event
   */
  stopListening() {
    if (!this.initialized) {
      logger.error('VoiceService not initialized');
      return;
    }

    try {
      logger.info('Stopping voice listening');
      this.provider.stopListening();
    } catch (error) {
      logger.error('Error stopping voice listening:', error);
      AppComms.emit('VOICE_ERROR', { message: error.message });
    }
  }

  /**
   * Cancel listening without returning result
   */
  cancelListening() {
    if (!this.initialized) {
      logger.error('VoiceService not initialized');
      return;
    }

    try {
      logger.info('Cancelling voice listening');
      this.provider.cancelListening();
    } catch (error) {
      logger.error('Error cancelling voice listening:', error);
    }
  }

  /**
   * Check if currently listening
   */
  isListening() {
    if (!this.initialized) {
      return false;
    }
    return this.provider.isListening();
  }

  /**
   * Speak text using Text-to-Speech
   * @param {string} text - Text to speak
   */
  speak(text) {
    if (!this.initialized) {
      logger.error('VoiceService not initialized');
      return;
    }

    try {
      logger.info('Speaking:', text);
      this.provider.speak(text);
    } catch (error) {
      logger.error('Error speaking text:', error);
    }
  }

  /**
   * Stop speaking
   */
  stopSpeaking() {
    if (!this.initialized) {
      logger.error('VoiceService not initialized');
      return;
    }

    try {
      logger.info('Stopping speech');
      this.provider.stopSpeaking();
    } catch (error) {
      logger.error('Error stopping speech:', error);
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking() {
    if (!this.initialized) {
      return false;
    }
    return this.provider.isSpeaking();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (!this.initialized) {
      return;
    }

    logger.info('Destroying VoiceService');

    if (this.provider) {
      this.provider.destroy();
    }

    this.initialized = false;
    this.provider = null;
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }
}

// Export singleton instance
export default VoiceService.getInstance();
