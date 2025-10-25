/**
 * AndroidVoiceProvider - Android voice implementation with cloud TTS & STT
 *
 * Voice functionality:
 * - Cloud TTS (ElevenLabs/OpenAI via Supabase Edge Functions)
 * - Fallback to native Android TTS if cloud fails
 * - Cloud STT (Deepgram/Whisper via Supabase Edge Functions)
 * - Wake Word Detection (Porcupine)
 *
 * Events from Android are received via window.onDashieVoiceEvent()
 * and translated to AppComms events.
 *
 * TTS: Uses same cloud implementation as WebVoiceProvider for consistent
 * voice quality across all platforms.
 *
 * STT: Uses cloud STT (Deepgram or Whisper) instead of Android native STT
 * because Google's native STT library is not supported on Fire TV.
 *
 * Settings are loaded from config.js (VOICE_CONFIG).
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

      // Setup audio data callback for cloud STT
      this._setupAudioDataHandler();

      // Configure wake word for webapp-controlled mode (Option 2)
      // This means webapp will play beep and trigger recording, not automatic
      this._configureWakeWord();

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
   * Setup window.onDashieAudioData handler for cloud STT audio
   */
  _setupAudioDataHandler() {
    // Save original handler if it exists
    this.originalAudioDataHandler = window.onDashieAudioData;

    // Set our audio data handler
    window.onDashieAudioData = (base64Audio) => {
      this._handleAudioData(base64Audio);

      // Call original handler if it existed
      if (this.originalAudioDataHandler) {
        this.originalAudioDataHandler(base64Audio);
      }
    };

    logger.info('Android audio data handler registered');
  }

  /**
   * Configure wake word for webapp-controlled mode (Option 2)
   * In this mode, webapp plays beep and triggers recording
   */
  _configureWakeWord() {
    try {
      // Configure wake word: autoRecord=false, duration=5 seconds
      // This means Android will NOT auto-record, webapp controls when to record
      window.DashieNative.setWakeWordConfig(false, 5);

      const config = JSON.parse(window.DashieNative.getWakeWordConfig());
      logger.success('Wake word configured for webapp-controlled mode', config);
    } catch (error) {
      logger.error('Failed to configure wake word:', error);
    }
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
        logger.info('Wake word detected - triggering webapp-controlled recording');
        AppComms.emit('VOICE_WAKE_WORD_DETECTED');

        // Webapp-controlled mode: Play beep, then trigger recording
        this._handleWakeWordDetected();
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
   * Handle wake word detection in webapp-controlled mode
   * Plays beep, then triggers cloud STT recording
   * @private
   */
  _handleWakeWordDetected() {
    try {
      // Play beep sound to acknowledge wake word
      this._playBeep();

      // Start cloud STT capture after short delay (allow beep to play)
      setTimeout(() => {
        logger.info('Starting cloud STT capture (5 seconds)');
        window.DashieNative.startCloudSTTCapture(5);
      }, 100);
    } catch (error) {
      logger.error('Error handling wake word detection:', error);
    }
  }

  /**
   * Handle audio data received from Android cloud STT
   * Converts base64 to blob and sends to speech-to-text API
   * @private
   * @param {string} base64Audio - Base64 encoded PCM audio data
   */
  async _handleAudioData(base64Audio) {
    try {
      logger.info('Received audio data from Android', {
        size: Math.round(base64Audio.length / 1024) + 'KB'
      });

      // Convert base64 to blob
      const audioBlob = this._base64ToBlob(base64Audio);
      logger.debug('Audio blob created', { size: audioBlob.size + ' bytes' });

      // Send to speech-to-text API (Deepgram)
      await this._sendToSpeechAPI(audioBlob);

      // Restart wake word detection for next command
      setTimeout(() => {
        this.startWakeWordDetection();
      }, 500);

    } catch (error) {
      logger.error('Error handling audio data:', error);
      AppComms.emit('VOICE_ERROR', { message: 'Failed to process audio' });
    }
  }

  /**
   * Convert base64 string to audio blob
   * @private
   * @param {string} base64 - Base64 encoded audio data
   * @returns {Blob} Audio blob
   */
  _base64ToBlob(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'audio/wav' });
  }

  /**
   * Play beep sound to acknowledge wake word detection
   * @private
   */
  _playBeep() {
    try {
      // Create a simple beep using Web Audio API
      // @ts-ignore - webkitAudioContext for older browsers
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure beep: 800Hz tone for 150ms
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);

      logger.debug('Played wake word beep');
    } catch (error) {
      logger.error('Error playing beep:', error);
      // Non-critical error, continue anyway
    }
  }

  /**
   * Send audio blob to speech-to-text API (Deepgram)
   * @private
   * @param {Blob} audioBlob - Audio data to transcribe
   */
  async _sendToSpeechAPI(audioBlob) {
    try {
      logger.info('Sending audio to Deepgram STT API', {
        size: Math.round(audioBlob.size / 1024) + 'KB'
      });

      // Get STT provider from config (defaults to Deepgram)
      const sttProvider = this.voiceConfig.sttProvider || 'deepgram';
      const sttEndpoint = sttProvider === 'deepgram' ? 'deepgram-stt' : 'whisper-stt';

      // Build FormData with audio
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('language', 'en');

      // Send to Supabase Edge Function
      const response = await fetch(
        `${SUPABASE_CONFIG.url}/functions/v1/${sttEndpoint}`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`STT API error: ${response.status} - ${error.error || 'Unknown'}`);
      }

      const result = await response.json();
      logger.success('STT transcript received', {
        transcript: result.transcript,
        confidence: result.confidence,
        processingTime: result.processing_time_ms + 'ms'
      });

      // Emit transcript as if it came from speechResult event
      AppComms.emit('VOICE_TRANSCRIPT_RECEIVED', result.transcript);

    } catch (error) {
      logger.error('Error sending to speech API:', error);
      AppComms.emit('VOICE_ERROR', { message: 'Failed to transcribe audio' });
      throw error;
    }
  }

  /**
   * Start listening for voice input
   * Uses cloud STT capture (same as wake word flow)
   */
  startListening() {
    if (this.isCurrentlyListening) {
      logger.warn('Already listening');
      return;
    }

    try {
      logger.info('Starting Android cloud STT capture (button click)');

      // Use the same flow as wake word detection
      // Play beep first
      this._playBeep();

      // Emit listening started event immediately (for UI feedback)
      this.isCurrentlyListening = true;
      AppComms.emit('VOICE_LISTENING_STARTED');

      // Start cloud STT capture after brief delay (allow beep to play)
      setTimeout(() => {
        window.DashieNative.startCloudSTTCapture(5);
      }, 100);

    } catch (error) {
      logger.error('Error starting Android listening:', error);
      this.isCurrentlyListening = false;
      AppComms.emit('VOICE_ERROR', { message: 'Failed to start listening' });
    }
  }

  /**
   * Stop listening and return current transcript
   * Cloud STT has fixed duration, so this stops early if needed
   */
  stopListening() {
    if (!this.isCurrentlyListening) {
      logger.warn('Not currently listening');
      return;
    }

    try {
      logger.info('Stopping Android cloud STT capture');
      window.DashieNative.stopCloudSTTCapture();
      this.isCurrentlyListening = false;
    } catch (error) {
      logger.error('Error stopping Android listening:', error);
    }
  }

  /**
   * Cancel listening without returning result
   * Cloud STT has fixed duration, so this stops early if needed
   */
  cancelListening() {
    if (!this.isCurrentlyListening) {
      logger.warn('Not currently listening');
      return;
    }

    try {
      logger.info('Cancelling Android cloud STT capture');
      window.DashieNative.stopCloudSTTCapture();
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

    // Restore original event handlers
    if (this.originalVoiceEventHandler) {
      window.onDashieVoiceEvent = this.originalVoiceEventHandler;
    } else {
      window.onDashieVoiceEvent = null;
    }

    if (this.originalAudioDataHandler) {
      window.onDashieAudioData = this.originalAudioDataHandler;
    } else {
      window.onDashieAudioData = null;
    }

    logger.info('AndroidVoiceProvider destroyed');
  }
}
