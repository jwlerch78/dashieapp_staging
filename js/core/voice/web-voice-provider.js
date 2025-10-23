/**
 * WebVoiceProvider - Web Speech API implementation for PC testing
 *
 * Uses browser-native APIs:
 * - SpeechRecognition for voice input
 * - SpeechSynthesis for Text-to-Speech
 *
 * Events are emitted via AppComms for consumption by widgets and services.
 */

import { createLogger } from '../../utils/logger.js';
import { AppComms } from '../app-comms.js';

const logger = createLogger('WebVoiceProvider');

export class WebVoiceProvider {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isCurrentlyListening = false;
    this.isCurrentlySpeaking = false;
  }

  /**
   * Initialize Web Speech API
   */
  async initialize() {
    try {
      // Check for Speech Recognition support
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        throw new Error('Web Speech API not supported in this browser');
      }

      // Initialize speech recognition
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false; // Stop after single utterance
      this.recognition.interimResults = true; // Get partial results as user speaks
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      // Setup event handlers
      this._setupRecognitionHandlers();

      // Check for Speech Synthesis support
      if (!this.synthesis) {
        logger.warn('Speech Synthesis not supported - TTS will not work');
      }

      logger.success('WebVoiceProvider initialized');
    } catch (error) {
      logger.error('Failed to initialize WebVoiceProvider:', error);
      throw error;
    }
  }

  /**
   * Setup speech recognition event handlers
   */
  _setupRecognitionHandlers() {
    this.recognition.onstart = () => {
      logger.info('Speech recognition started');
      this.isCurrentlyListening = true;
      AppComms.emit('VOICE_LISTENING_STARTED');
    };

    this.recognition.onend = () => {
      logger.info('Speech recognition ended');
      this.isCurrentlyListening = false;
      AppComms.emit('VOICE_LISTENING_STOPPED');
    };

    this.recognition.onresult = (event) => {
      const results = event.results;
      const lastResult = results[results.length - 1];

      if (lastResult.isFinal) {
        // Final transcript
        const transcript = lastResult[0].transcript;
        logger.info('Final transcript:', transcript);
        AppComms.emit('VOICE_TRANSCRIPT_RECEIVED', transcript);
      } else {
        // Partial/interim transcript
        const transcript = lastResult[0].transcript;
        logger.verbose('Partial transcript:', transcript);
        AppComms.emit('VOICE_PARTIAL_RESULT', transcript);
      }
    };

    this.recognition.onerror = (event) => {
      logger.error('Speech recognition error:', event.error);

      let errorMessage = 'Speech recognition error';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not accessible';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied';
          break;
        case 'network':
          errorMessage = 'Network error';
          break;
        default:
          errorMessage = `Speech error: ${event.error}`;
      }

      AppComms.emit('VOICE_ERROR', { message: errorMessage, error: event.error });
      this.isCurrentlyListening = false;
    };

    this.recognition.onnomatch = () => {
      logger.warn('No speech match found');
      AppComms.emit('VOICE_ERROR', { message: 'Could not understand speech' });
    };
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
      logger.info('Starting speech recognition');
      this.recognition.start();
    } catch (error) {
      logger.error('Error starting recognition:', error);
      AppComms.emit('VOICE_ERROR', { message: 'Failed to start listening', error: error.message });
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
      logger.info('Stopping speech recognition');
      this.recognition.stop();
    } catch (error) {
      logger.error('Error stopping recognition:', error);
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
      logger.info('Aborting speech recognition');
      this.recognition.abort();
      this.isCurrentlyListening = false;
    } catch (error) {
      logger.error('Error aborting recognition:', error);
    }
  }

  /**
   * Check if currently listening
   */
  isListening() {
    return this.isCurrentlyListening;
  }

  /**
   * Speak text using Text-to-Speech
   * @param {string} text - Text to speak
   */
  speak(text) {
    if (!this.synthesis) {
      logger.error('Speech Synthesis not available');
      return;
    }

    try {
      // Cancel any ongoing speech
      this.synthesis.cancel();

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        logger.info('TTS started:', text);
        this.isCurrentlySpeaking = true;
      };

      utterance.onend = () => {
        logger.info('TTS ended');
        this.isCurrentlySpeaking = false;
      };

      utterance.onerror = (event) => {
        logger.error('TTS error:', event.error);
        this.isCurrentlySpeaking = false;
      };

      this.synthesis.speak(utterance);
    } catch (error) {
      logger.error('Error speaking text:', error);
    }
  }

  /**
   * Stop speaking
   */
  stopSpeaking() {
    if (!this.synthesis) {
      return;
    }

    try {
      this.synthesis.cancel();
      this.isCurrentlySpeaking = false;
      logger.info('TTS cancelled');
    } catch (error) {
      logger.error('Error stopping speech:', error);
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking() {
    return this.isCurrentlySpeaking;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.recognition) {
      this.recognition.abort();
    }

    if (this.synthesis) {
      this.synthesis.cancel();
    }

    this.isCurrentlyListening = false;
    this.isCurrentlySpeaking = false;

    logger.info('WebVoiceProvider destroyed');
  }
}
