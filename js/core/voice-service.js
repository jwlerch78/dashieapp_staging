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

      logger.success('VoiceService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize VoiceService:', error);
      throw error;
    }
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
