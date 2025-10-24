/**
 * AndroidVoiceProvider - DashieNative bridge implementation
 *
 * Wraps Android native voice functionality:
 * - Text-to-Speech (TTS)
 * - Speech Recognition
 * - Wake Word Detection (Porcupine)
 *
 * Events from Android are received via window.onDashieVoiceEvent()
 * and translated to AppComms events.
 */

import { createLogger } from '../../utils/logger.js';
import AppComms from '../app-comms.js';

const logger = createLogger('AndroidVoiceProvider');

export class AndroidVoiceProvider {
  constructor() {
    this.isCurrentlyListening = false;
    this.isCurrentlySpeaking = false;
    this.wakeWordActive = false;
    this.originalVoiceEventHandler = null;
  }

  /**
   * Initialize Android voice provider
   */
  async initialize() {
    try {
      // Verify DashieNative bridge exists
      if (typeof window.DashieNative === 'undefined') {
        throw new Error('DashieNative bridge not found - not running in Android app');
      }

      // Setup event handler for Android voice events
      this._setupEventHandler();

      // Start wake word detection after a delay to allow native layer to initialize
      // The Porcupine wake word detector needs time to load on Android
      setTimeout(() => {
        this.startWakeWordDetection();
      }, 1000);

      logger.success('AndroidVoiceProvider initialized - wake word detection will start shortly');
    } catch (error) {
      logger.error('Failed to initialize AndroidVoiceProvider:', error);
      throw error;
    }
  }

  /**
   * Setup window.onDashieVoiceEvent handler
   */
  _setupEventHandler() {
    // Save original handler if it exists
    this.originalVoiceEventHandler = window.onDashieVoiceEvent;

    // Set our event handler
    window.onDashieVoiceEvent = (event, data) => {
      this._handleAndroidEvent(event, data);

      // Call original handler if it existed
      if (this.originalVoiceEventHandler) {
        this.originalVoiceEventHandler(event, data);
      }
    };

    logger.info('Android voice event handler registered');
  }

  /**
   * Handle events from Android native layer
   */
  _handleAndroidEvent(event, data) {
    logger.verbose('Android voice event:', event, data);

    switch (event) {
      case 'listeningStarted':
        this.isCurrentlyListening = true;
        AppComms.emit('VOICE_LISTENING_STARTED');
        break;

      case 'listeningEnded':
        this.isCurrentlyListening = false;
        AppComms.emit('VOICE_LISTENING_STOPPED');
        break;

      case 'partialResult':
        AppComms.emit('VOICE_PARTIAL_RESULT', data);
        break;

      case 'speechResult':
        AppComms.emit('VOICE_TRANSCRIPT_RECEIVED', data);
        break;

      case 'speechError':
        this.isCurrentlyListening = false;
        AppComms.emit('VOICE_ERROR', { message: data });
        break;

      case 'wakeWordDetected':
        logger.info('Wake word detected');
        AppComms.emit('VOICE_WAKE_WORD_DETECTED');
        break;

      case 'wakeWordError':
        logger.error('Wake word error:', data);
        AppComms.emit('VOICE_ERROR', { message: `Wake word error: ${data}` });
        break;

      case 'voicePermissionDenied':
        logger.error('Voice permission denied');
        AppComms.emit('VOICE_ERROR', { message: 'Microphone permission denied' });
        break;

      default:
        logger.warn('Unknown Android voice event:', event);
    }
  }

  /**
   * Start listening for voice input
   */
  startListening() {
    if (this.isCurrentlyListening) {
      logger.warn('Already listening');
      return;
    }

    try {
      logger.info('Starting Android speech recognition');
      window.DashieNative.startListening(); // With partial results
    } catch (error) {
      logger.error('Error starting Android listening:', error);
      AppComms.emit('VOICE_ERROR', { message: 'Failed to start listening' });
    }
  }

  /**
   * Stop listening and return current transcript
   */
  stopListening() {
    if (!this.isCurrentlyListening) {
      logger.warn('Not currently listening');
      return;
    }

    try {
      logger.info('Stopping Android speech recognition');
      window.DashieNative.stopListening();
    } catch (error) {
      logger.error('Error stopping Android listening:', error);
    }
  }

  /**
   * Cancel listening without returning result
   */
  cancelListening() {
    if (!this.isCurrentlyListening) {
      logger.warn('Not currently listening');
      return;
    }

    try {
      logger.info('Cancelling Android speech recognition');
      window.DashieNative.cancelListening();
      this.isCurrentlyListening = false;
    } catch (error) {
      logger.error('Error cancelling Android listening:', error);
    }
  }

  /**
   * Check if currently listening
   */
  isListening() {
    return this.isCurrentlyListening;
  }

  /**
   * Speak text using Android TTS
   * @param {string} text - Text to speak
   */
  speak(text) {
    try {
      logger.info('Speaking via Android TTS:', text);
      window.DashieNative.speak(text);
      this.isCurrentlySpeaking = true;

      // Note: Android doesn't send TTS completion events currently
      // We'll assume speaking is done after a timeout
      setTimeout(() => {
        this.isCurrentlySpeaking = false;
      }, text.length * 100); // Rough estimate
    } catch (error) {
      logger.error('Error speaking via Android:', error);
    }
  }

  /**
   * Stop speaking
   */
  stopSpeaking() {
    try {
      logger.info('Stopping Android TTS');
      window.DashieNative.stopSpeaking();
      this.isCurrentlySpeaking = false;
    } catch (error) {
      logger.error('Error stopping Android speech:', error);
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking() {
    // Could check DashieNative.isSpeaking() if available
    try {
      if (window.DashieNative.isSpeaking) {
        return window.DashieNative.isSpeaking();
      }
    } catch (error) {
      logger.error('Error checking speaking status:', error);
    }
    return this.isCurrentlySpeaking;
  }

  /**
   * Start wake word detection
   * Note: This is for future use - wake word automatically starts in Android
   */
  startWakeWordDetection() {
    try {
      logger.info('Starting wake word detection');
      window.DashieNative.startWakeWordDetection();
      this.wakeWordActive = true;
    } catch (error) {
      logger.error('Error starting wake word detection:', error);
    }
  }

  /**
   * Stop wake word detection
   */
  stopWakeWordDetection() {
    try {
      logger.info('Stopping wake word detection');
      window.DashieNative.stopWakeWordDetection();
      this.wakeWordActive = false;
    } catch (error) {
      logger.error('Error stopping wake word detection:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Stop listening and speaking
    if (this.isCurrentlyListening) {
      this.cancelListening();
    }

    if (this.isCurrentlySpeaking) {
      this.stopSpeaking();
    }

    if (this.wakeWordActive) {
      this.stopWakeWordDetection();
    }

    // Restore original event handler
    if (this.originalVoiceEventHandler) {
      window.onDashieVoiceEvent = this.originalVoiceEventHandler;
    } else {
      window.onDashieVoiceEvent = null;
    }

    logger.info('AndroidVoiceProvider destroyed');
  }
}
