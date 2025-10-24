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
import AppComms from '../app-comms.js';
import { SUPABASE_CONFIG } from '../../data/auth/auth-config.js';
import { VOICE_CONFIG } from '../../../config.js';

const logger = createLogger('WebVoiceProvider');

export class WebVoiceProvider {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isCurrentlyListening = false;
    this.isCurrentlySpeaking = false;
    this.currentAudio = null;  // Track current TTS audio playback

    // Audio recording for Whisper STT
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioStream = null;

    // Pre-build TTS endpoint URLs (cache for performance)
    this.openaiTtsUrl = `${SUPABASE_CONFIG.url}/functions/v1/openai-tts`;
    this.elevenlabsTtsUrl = `${SUPABASE_CONFIG.url}/functions/v1/elevenlabs-tts`;

    // Load voice settings from config
    this.ttsProvider = VOICE_CONFIG.ttsProvider; // 'elevenlabs' or 'openai'
    this.sttProvider = VOICE_CONFIG.sttProvider; // 'deepgram', 'whisper', or 'native'
    this.ttsUrl = this.ttsProvider === 'elevenlabs' ? this.elevenlabsTtsUrl : this.openaiTtsUrl;
    this.whisperUrl = `${SUPABASE_CONFIG.url}/functions/v1/whisper-stt`;
    this.deepgramUrl = `${SUPABASE_CONFIG.url}/functions/v1/deepgram-stt`;

    // Voice settings (from config.js - can be overridden by user settings later)
    this.voiceConfig = VOICE_CONFIG;

    // Client-side audio cache for instant playback of repeated phrases
    this.audioCache = new Map();
    this.maxCacheSize = 50; // Cache up to 50 audio blobs
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
  async startListening() {
    if (this.isCurrentlyListening) {
      logger.warn('Already listening');
      return;
    }

    try {
      // Use cloud STT (Deepgram/Whisper) or native Web Speech API based on config
      if (this.sttProvider === 'deepgram' || this.sttProvider === 'whisper') {
        logger.info(`Starting audio recording for ${this.sttProvider.toUpperCase()} STT`);
        await this._startCloudRecording();
      } else {
        logger.info('Starting Web Speech API recognition');
        this.recognition.start();
      }
    } catch (error) {
      logger.error('Error starting recognition:', error);
      AppComms.emit('VOICE_ERROR', { message: 'Failed to start listening', error: error.message });
    }
  }

  /**
   * Stop listening and return current transcript
   */
  async stopListening() {
    if (!this.isCurrentlyListening) {
      logger.warn('Not currently listening');
      return;
    }

    try {
      if (this.sttProvider === 'deepgram' || this.sttProvider === 'whisper') {
        logger.info(`Stopping audio recording and transcribing with ${this.sttProvider.toUpperCase()}`);
        await this._stopCloudRecording();
      } else {
        logger.info('Stopping Web Speech API recognition');
        this.recognition.stop();
      }
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
   * Set voice settings (for user preferences from settings UI)
   * @param {Object} voiceSettings - Voice configuration object
   * @param {Object} voiceSettings.voice - Voice object with id and name
   * @param {string} voiceSettings.provider - 'elevenlabs' or 'openai'
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

    // Clear cache when voice changes (different voice = different audio)
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
   * Speak text using ElevenLabs TTS via Supabase Edge Function
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

      // Build request body based on provider (using settings from config.js)
      let requestBody;
      if (this.ttsProvider === 'elevenlabs') {
        requestBody = {
          text: text,
          voice_id: this.voiceConfig.defaultVoice.id,  // From config.js VOICE_CONFIG
          model_id: this.voiceConfig.elevenlabs.model
        };
      } else {
        // OpenAI format
        requestBody = {
          text: text,
          voice: this.voiceConfig.openai.voice,
          speed: this.voiceConfig.openai.speed
        };
      }

      // Call Supabase Edge Function with anon key for authentication
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
        // Evict oldest entry if cache is full
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

      // Fallback to Web Speech API if cloud TTS fails
      logger.warn('Falling back to Web Speech API');
      this._speakWithWebAPI(text);
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
   * Fallback TTS using Web Speech API
   * @private
   */
  _speakWithWebAPI(text) {
    if (!this.synthesis) {
      logger.error('Speech Synthesis not available');
      return;
    }

    try {
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        this.isCurrentlySpeaking = true;
      };

      utterance.onend = () => {
        this.isCurrentlySpeaking = false;
      };

      utterance.onerror = (event) => {
        logger.error('Web TTS error:', event.error);
        this.isCurrentlySpeaking = false;
      };

      this.synthesis.speak(utterance);
    } catch (error) {
      logger.error('Error with Web Speech API fallback:', error);
    }
  }

  /**
   * Start recording audio for cloud STT (Deepgram or Whisper)
   * @private
   */
  async _startCloudRecording() {
    try {
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,  // Mono
          sampleRate: 16000 // 16kHz for good quality + smaller size
        }
      });

      // Clear previous chunks
      this.audioChunks = [];

      // Try different MIME types that OpenAI supports
      let mimeType = 'audio/webm;codecs=opus'; // Default
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ];

      // Find first supported MIME type
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          logger.info(`Using MIME type: ${type}`);
          break;
        }
      }

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, { mimeType });

      // Store MIME type for later use
      this.recordingMimeType = mimeType;

      // Collect audio data
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start();
      this.isCurrentlyListening = true;

      logger.info('Audio recording started');
      AppComms.emit('VOICE_LISTENING_STARTED');

    } catch (error) {
      logger.error('Failed to start audio recording:', error);
      this.isCurrentlyListening = false;
      AppComms.emit('VOICE_ERROR', { message: 'Microphone access denied or not available' });
      throw error;
    }
  }

  /**
   * Stop recording and transcribe with cloud STT (Deepgram or Whisper)
   * @private
   */
  async _stopCloudRecording() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      logger.warn('No active recording to stop');
      return;
    }

    return new Promise((resolve, reject) => {
      // Handle recording stopped
      this.mediaRecorder.onstop = async () => {
        try {
          this.isCurrentlyListening = false;
          AppComms.emit('VOICE_LISTENING_STOPPED');

          // Create audio blob from chunks using the recorded MIME type
          const audioBlob = new Blob(this.audioChunks, { type: this.recordingMimeType || 'audio/webm' });
          logger.info(`Audio recorded: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

          // Stop and release microphone
          if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
          }

          // Transcribe with cloud STT provider
          const transcript = await this._transcribeWithCloudSTT(audioBlob);

          if (transcript) {
            logger.success(`Transcribed: "${transcript}"`);
            AppComms.emit('VOICE_TRANSCRIPT_RECEIVED', transcript);
          }

          resolve();
        } catch (error) {
          logger.error('Error processing recording:', error);
          AppComms.emit('VOICE_ERROR', { message: 'Transcription failed' });
          reject(error);
        }
      };

      // Stop recording
      this.mediaRecorder.stop();
    });
  }

  /**
   * Convert audio blob to WAV format using Web Audio API
   * WAV is universally supported by OpenAI Whisper
   * @private
   */
  async _convertToWav(audioBlob) {
    try {
      logger.info('Converting audio to WAV format...');

      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Read blob as array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Get audio data from first channel (mono)
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;

      logger.info(`Audio decoded: ${channelData.length} samples at ${sampleRate}Hz`);

      // Create WAV file
      const wavBuffer = this._encodeWAV(channelData, sampleRate);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

      logger.info(`WAV created: ${wavBlob.size} bytes`);

      // Close audio context
      await audioContext.close();

      return wavBlob;

    } catch (error) {
      logger.error('Failed to convert to WAV:', error);
      // Return original blob as fallback
      return audioBlob;
    }
  }

  /**
   * Encode audio data as WAV format
   * @private
   */
  _encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // Write WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write audio samples as 16-bit PCM
    const offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }

    return buffer;
  }

  /**
   * Send audio to cloud STT API for transcription (Deepgram or Whisper)
   * @private
   */
  async _transcribeWithCloudSTT(audioBlob) {
    const perfStart = performance.now();

    try {
      const providerName = this.sttProvider.toUpperCase();
      logger.info(`Sending audio to ${providerName} API...`);

      // Deepgram can handle WebM/WAV directly, Whisper needs WAV
      let audioToSend = audioBlob;
      if (this.sttProvider === 'whisper') {
        // Convert to WAV for guaranteed OpenAI compatibility
        const convertStart = performance.now();
        audioToSend = await this._convertToWav(audioBlob);
        const convertEnd = performance.now();
        logger.info(`⏱️  Audio conversion took ${Math.round(convertEnd - convertStart)}ms`);
      }

      const formData = new FormData();
      formData.append('audio', audioToSend, this.sttProvider === 'whisper' ? 'recording.wav' : 'recording.webm');
      formData.append('language', this.voiceConfig.deepgram?.language || this.voiceConfig.openai?.language || 'en');

      // Select API endpoint based on provider
      const apiUrl = this.sttProvider === 'deepgram' ? this.deepgramUrl : this.whisperUrl;

      // Call STT edge function
      const fetchStart = performance.now();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        },
        body: formData
      });

      const fetchEnd = performance.now();
      const apiTime = Math.round(fetchEnd - fetchStart);
      logger.info(`⏱️  ${providerName} API took ${apiTime}ms`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`${providerName} API error: ${response.status} - ${error.error || 'Unknown'}`);
      }

      const result = await response.json();
      const totalTime = performance.now() - perfStart;

      // Log confidence if available (Deepgram provides this)
      if (result.confidence) {
        logger.info(`⏱️  Total transcription: ${Math.round(totalTime)}ms (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
      } else {
        logger.info(`⏱️  Total transcription time: ${Math.round(totalTime)}ms`);
      }

      return result.transcript;

    } catch (error) {
      logger.error(`${this.sttProvider.toUpperCase()} transcription failed:`, error);
      throw error;
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
