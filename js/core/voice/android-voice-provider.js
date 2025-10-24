/**
 * AndroidVoiceProvider - Android voice implementation with cloud TTS
 *
 * Voice functionality:
 * - Cloud TTS (ElevenLabs/OpenAI via Supabase Edge Functions)
 * - Fallback to native Android TTS if cloud fails
 * - Speech Recognition (Android native)
 * - Wake Word Detection (Porcupine)
 *
 * Events from Android are received via window.onDashieVoiceEvent()
 * and translated to AppComms events.
 *
 * TTS: Uses same cloud implementation as WebVoiceProvider for consistent
 * voice quality across all platforms. Settings are loaded from config.js.
 */

import { createLogger } from '../../utils/logger.js';
import AppComms from '../app-comms.js';
import { SUPABASE_CONFIG } from '../../data/auth/auth-config.js';
import { VOICE_CONFIG } from '../../../config.js';

const logger = createLogger('AndroidVoiceProvider');

export class AndroidVoiceProvider {
  constructor() {
    this.isCurrentlyListening = false;
    this.isCurrentlySpeaking = false;
    this.wakeWordActive = false;
    this.originalVoiceEventHandler = null;
    this.currentAudio = null; // Track current TTS audio playback

    // Pre-build TTS endpoint URLs (same as WebVoiceProvider)
    this.openaiTtsUrl = `${SUPABASE_CONFIG.url}/functions/v1/openai-tts`;
    this.elevenlabsTtsUrl = `${SUPABASE_CONFIG.url}/functions/v1/elevenlabs-tts`;

    // Load voice settings from config
    this.ttsProvider = VOICE_CONFIG.provider;
    this.ttsUrl = this.ttsProvider === 'elevenlabs' ? this.elevenlabsTtsUrl : this.openaiTtsUrl;

    // Voice settings (from config.js - can be overridden by user settings later)
    this.voiceConfig = VOICE_CONFIG;

    // Client-side audio cache for instant playback of repeated phrases
    this.audioCache = new Map();
    this.maxCacheSize = 50;
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
   * Speak text using cloud TTS (ElevenLabs or OpenAI)
   * @param {string} text - Text to speak
   */
  async speak(text) {
    const perfStart = performance.now();

    try {
      logger.info(`Calling ${this.ttsProvider} TTS for:`, text);

      // Check client-side cache first
      const cacheKey = `${this.ttsProvider}_${text}`;
      const cachedBlob = this.audioCache.get(cacheKey);

      if (cachedBlob) {
        logger.success('🎯 Client cache HIT - instant playback!');
        await this._playAudio(cachedBlob, text);
        return;
      }

      // Build request body based on provider (same as WebVoiceProvider)
      let requestBody;
      if (this.ttsProvider === 'elevenlabs') {
        requestBody = {
          text: text,
          voice_id: this.voiceConfig.defaultVoice.id,
          model_id: this.voiceConfig.elevenlabs.model
        };
      } else {
        requestBody = {
          text: text,
          voice: this.voiceConfig.openai.voice,
          speed: this.voiceConfig.openai.speed
        };
      }

      // Call Supabase Edge Function
      const fetchStart = performance.now();
      const response = await fetch(this.ttsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        },
        body: JSON.stringify(requestBody)
      });

      const fetchEnd = performance.now();
      logger.info(`⏱️  API fetch took ${Math.round(fetchEnd - fetchStart)}ms`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`TTS API error: ${response.status} - ${error.error || 'Unknown'}`);
      }

      // Get MP3 audio blob
      const blobStart = performance.now();
      const audioBlob = await response.blob();
      const blobEnd = performance.now();
      logger.info(`⏱️  Blob creation took ${Math.round(blobEnd - blobStart)}ms`);

      // Cache the blob for future use (common phrases only)
      if (text.length < 100) {
        if (this.audioCache.size >= this.maxCacheSize) {
          const firstKey = this.audioCache.keys().next().value;
          this.audioCache.delete(firstKey);
        }
        this.audioCache.set(cacheKey, audioBlob);
        logger.info(`💾 Cached audio for: "${text.substring(0, 30)}..."`);
      }

      const totalTime = performance.now() - perfStart;
      logger.info(`TTS ready to play in ${Math.round(totalTime)}ms`);

      // Play the audio
      await this._playAudio(audioBlob, text);

    } catch (error) {
      logger.error('Error speaking text:', error);
      this.isCurrentlySpeaking = false;

      // Fallback to native Android TTS if cloud fails
      logger.warn('Falling back to native Android TTS');
      this._speakWithNativeTTS(text);
    }
  }

  /**
   * Play audio from blob
   * @private
   */
  async _playAudio(audioBlob, text) {
    const audioUrl = URL.createObjectURL(audioBlob);

    // Stop any currently playing audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    // Play audio
    const audio = new Audio(audioUrl);
    this.currentAudio = audio;

    audio.onplay = () => {
      logger.info('TTS started:', text);
      this.isCurrentlySpeaking = true;
    };

    audio.onended = () => {
      logger.info('TTS ended');
      this.isCurrentlySpeaking = false;
      URL.revokeObjectURL(audioUrl);
      this.currentAudio = null;
    };

    audio.onerror = (event) => {
      logger.error('Audio playback error:', event);
      this.isCurrentlySpeaking = false;
      URL.revokeObjectURL(audioUrl);
      this.currentAudio = null;
    };

    await audio.play();
  }

  /**
   * Fallback TTS using native Android TTS
   * @private
   */
  _speakWithNativeTTS(text) {
    try {
      if (typeof window.DashieNative === 'undefined') {
        logger.error('DashieNative bridge not available for fallback TTS');
        return;
      }

      logger.info('Speaking via native Android TTS:', text);
      window.DashieNative.speak(text);
      this.isCurrentlySpeaking = true;

      // Android doesn't send TTS completion events
      setTimeout(() => {
        this.isCurrentlySpeaking = false;
      }, text.length * 100);
    } catch (error) {
      logger.error('Error with native Android TTS:', error);
    }
  }

  /**
   * Set voice settings (for user preferences from settings UI)
   * @param {Object} voiceSettings - Voice configuration object
   */
  setVoiceSettings(voiceSettings) {
    if (voiceSettings.voice) {
      this.voiceConfig.defaultVoice = voiceSettings.voice;
      logger.info(`Voice changed to: ${voiceSettings.voice.name}`);
    }

    if (voiceSettings.provider) {
      this.ttsProvider = voiceSettings.provider;
      this.ttsUrl = this.ttsProvider === 'elevenlabs' ? this.elevenlabsTtsUrl : this.openaiTtsUrl;
      logger.info(`TTS provider changed to: ${voiceSettings.provider}`);
    }

    // Clear cache when voice changes
    this.audioCache.clear();
  }

  /**
   * Get current voice settings
   * @returns {Object} Current voice configuration
   */
  getVoiceSettings() {
    return {
      provider: this.ttsProvider,
      voice: this.voiceConfig.defaultVoice,
      elevenlabsSettings: this.voiceConfig.elevenlabs,
      openaiSettings: this.voiceConfig.openai
    };
  }

  /**
   * Stop speaking
   */
  stopSpeaking() {
    try {
      // Stop cloud TTS audio if playing
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
        this.isCurrentlySpeaking = false;
        logger.info('Stopped cloud TTS playback');
        return;
      }

      // Fallback: stop native Android TTS
      if (window.DashieNative && window.DashieNative.stopSpeaking) {
        logger.info('Stopping native Android TTS');
        window.DashieNative.stopSpeaking();
      }

      this.isCurrentlySpeaking = false;
    } catch (error) {
      logger.error('Error stopping speech:', error);
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
