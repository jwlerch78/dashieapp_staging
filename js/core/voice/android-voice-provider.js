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
      // Audio is compressed before sending, so file size is no longer an issue
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

      // Convert base64 to WAV blob
      const wavBlob = this._base64ToBlob(base64Audio);
      logger.info('WAV blob created', {
        size: Math.round(wavBlob.size / 1024) + 'KB'
      });

      // Compress WAV to Opus/WebM for smaller upload size
      const compressedBlob = await this._compressAudio(wavBlob);
      logger.info('Audio compressed', {
        originalSize: Math.round(wavBlob.size / 1024) + 'KB',
        compressedSize: Math.round(compressedBlob.size / 1024) + 'KB',
        reduction: Math.round((1 - compressedBlob.size / wavBlob.size) * 100) + '%'
      });

      // Send to speech-to-text API (Deepgram)
      await this._sendToSpeechAPI(compressedBlob);

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
   * Convert base64 string to WAV audio blob
   * Android sends raw PCM data, so we need to add WAV headers
   * @private
   * @param {string} base64 - Base64 encoded PCM audio data
   * @returns {Blob} WAV audio blob with proper headers
   */
  _base64ToBlob(base64) {
    // Decode base64 to binary PCM data
    const binaryString = atob(base64);
    const pcmBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pcmBytes[i] = binaryString.charCodeAt(i);
    }

    // Add WAV headers to raw PCM data
    const wavBlob = this._addWavHeaders(pcmBytes);

    logger.info('Converted PCM to WAV', {
      pcmSize: pcmBytes.length,
      wavSize: wavBlob.size
    });

    return wavBlob;
  }

  /**
   * Add WAV headers to raw PCM data
   * Audio specs from Android: 16kHz, 16-bit, mono, little-endian
   * @private
   * @param {Uint8Array} pcmData - Raw PCM audio data
   * @returns {Blob} WAV file blob
   */
  _addWavHeaders(pcmData) {
    const sampleRate = 16000;  // 16kHz
    const numChannels = 1;      // Mono
    const bitsPerSample = 16;   // 16-bit
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;

    // WAV file header (44 bytes)
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // "RIFF" chunk descriptor
    view.setUint32(0, 0x52494646, false);  // "RIFF"
    view.setUint32(4, 36 + dataSize, true); // File size - 8
    view.setUint32(8, 0x57415645, false);   // "WAVE"

    // "fmt " sub-chunk
    view.setUint32(12, 0x666d7420, false);  // "fmt "
    view.setUint32(16, 16, true);           // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);            // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true);  // NumChannels
    view.setUint32(24, sampleRate, true);   // SampleRate
    view.setUint32(28, byteRate, true);     // ByteRate
    view.setUint16(32, blockAlign, true);   // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample

    // "data" sub-chunk
    view.setUint32(36, 0x64617461, false);  // "data"
    view.setUint32(40, dataSize, true);     // Subchunk2Size

    // Combine header + PCM data
    return new Blob([header, pcmData], { type: 'audio/wav' });
  }

  /**
   * Compress WAV audio to Opus/WebM format for smaller upload size
   * Uses MediaRecorder API to re-encode the audio
   * @private
   * @param {Blob} wavBlob - WAV audio blob to compress
   * @returns {Promise<Blob>} Compressed audio blob
   */
  async _compressAudio(wavBlob) {
    try {
      // Create audio context and decode WAV
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await wavBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Create a MediaStreamDestination to capture re-encoded audio
      const destination = audioContext.createMediaStreamDestination();
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(destination);

      // Determine best supported format (Opus is best, but fallback to WebM)
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // If WebM not supported, return original WAV
        logger.warn('Compression not supported, using original WAV');
        audioContext.close();
        return wavBlob;
      }

      // Record the audio with MediaRecorder (this compresses it)
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 24000 // 24kbps - good for speech
      });

      const chunks = [];

      return new Promise((resolve, reject) => {
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const compressedBlob = new Blob(chunks, { type: mimeType });
          audioContext.close();
          resolve(compressedBlob);
        };

        mediaRecorder.onerror = (error) => {
          logger.error('Compression error, using original WAV:', error);
          audioContext.close();
          resolve(wavBlob); // Fallback to original
        };

        // Start recording and playback
        mediaRecorder.start();
        source.start(0);

        // Stop recording when playback ends
        source.onended = () => {
          setTimeout(() => {
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          }, 100);
        };
      });

    } catch (error) {
      logger.error('Error compressing audio, using original:', error);
      return wavBlob; // Fallback to original on error
    }
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
    const maxRetries = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Sending audio to Deepgram STT API (attempt ${attempt}/${maxRetries})`, {
          size: Math.round(audioBlob.size / 1024) + 'KB'
        });

        // Get STT provider from config (defaults to Deepgram)
        const sttProvider = this.voiceConfig.sttProvider || 'deepgram';
        const sttEndpoint = sttProvider === 'deepgram' ? 'deepgram-stt' : 'whisper-stt';

        // Build FormData with audio
        // Determine filename based on blob type
        const filename = audioBlob.type.includes('webm') ? 'recording.webm' :
                        audioBlob.type.includes('opus') ? 'recording.opus' :
                        'recording.wav';

        const formData = new FormData();
        formData.append('audio', audioBlob, filename);
        formData.append('language', 'en');

        if (attempt === 1) {
          logger.info('FormData prepared', {
            blobSize: audioBlob.size,
            blobType: audioBlob.type,
            endpoint: `${SUPABASE_CONFIG.url}/functions/v1/${sttEndpoint}`
          });
        }

        // Send to Supabase Edge Function with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        try {
          const response = await fetch(
            `${SUPABASE_CONFIG.url}/functions/v1/${sttEndpoint}`,
            {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_CONFIG.anonKey,
                'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
              },
              body: formData,
              signal: controller.signal
            }
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`STT API error: ${response.status} - ${error.error || 'Unknown'}`);
          }

          const result = await response.json();
          logger.success('STT transcript received', {
            transcript: result.transcript,
            confidence: result.confidence,
            processingTime: result.processing_time_ms + 'ms',
            attempt: attempt
          });

          // Emit transcript as if it came from speechResult event
          AppComms.emit('VOICE_TRANSCRIPT_RECEIVED', result.transcript);
          return; // Success, exit retry loop

        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }

      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (error.message?.includes('401') || error.message?.includes('403')) {
          logger.warn(`Authentication error on attempt ${attempt}, not retrying`);
          break;
        }

        if (attempt < maxRetries) {
          logger.warn(`Attempt ${attempt} failed, retrying in 1 second...`, { error: error.message });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          logger.error('All retry attempts failed', error);
        }
      }
    }

    // All retries failed
    AppComms.emit('VOICE_ERROR', { message: 'Failed to transcribe audio' });
    throw lastError;
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
