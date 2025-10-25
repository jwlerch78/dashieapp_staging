// js/core/voice/voice-phrase-preloader.js
// Pre-generates and caches common TTS phrases for instant playback

import { createLogger } from '../../utils/logger.js';
import { voiceAudioCache } from './voice-audio-cache.js';
import { AVAILABLE_VOICES } from '../../../config.js';

const logger = createLogger('VoicePhrasePreloader');

/**
 * Common phrases that should be permanently cached
 * Organized by category for easy management
 */
export const COMMON_PHRASES = {
  // Voice samples - played when user selects a voice
  voiceSamples: {
    'bella': 'Hi, I\'m Bella',
    'rachel': 'Hi, I\'m Rachel',
    'domi': 'Hi, I\'m Domi',
    'adam': 'Hi, I\'m Adam',
    'antoni': 'Hi, I\'m Antoni'
  },

  // Theme change confirmations
  theme: [
    'Theme changed to dark mode',
    'Theme changed to light mode',
    'Theme changed to Halloween'
  ],

  // System responses
  system: [
    'OK',
    'Done',
    'Got it',
    'Settings saved',
    'No problem',
    'Sure thing'
  ],

  // Common confirmations
  confirmations: [
    'Calendar refreshed',
    'Photos updated',
    'Voice settings updated'
  ],

  // Error messages
  errors: [
    'Sorry, I didn\'t catch that',
    'Something went wrong',
    'Please try again'
  ]
};

/**
 * Voice Phrase Preloader
 * Manages pre-generation and caching of common phrases
 */
export class VoicePhrasePreloader {
  constructor(voiceProvider) {
    this.voiceProvider = voiceProvider;
    this.isPreloading = false;
  }

  /**
   * Preload all common phrases for a specific voice
   * @param {string} voiceId - Voice ID to preload
   * @param {boolean} forceRegenerate - Force regeneration even if cached
   */
  async preloadVoice(voiceId, forceRegenerate = false) {
    if (this.isPreloading) {
      logger.warn('Preloading already in progress');
      return;
    }

    this.isPreloading = true;

    try {
      logger.info(`🎙️  Preloading phrases for voice: ${voiceId}`);

      // Get voice sample for this voice
      const voiceSample = COMMON_PHRASES.voiceSamples[voiceId];
      if (voiceSample) {
        await this._generateAndCache(voiceSample, voiceId, forceRegenerate);
      }

      // Preload theme phrases
      for (const phrase of COMMON_PHRASES.theme) {
        await this._generateAndCache(phrase, voiceId, forceRegenerate);
      }

      // Preload system responses
      for (const phrase of COMMON_PHRASES.system) {
        await this._generateAndCache(phrase, voiceId, forceRegenerate);
      }

      // Preload confirmations
      for (const phrase of COMMON_PHRASES.confirmations) {
        await this._generateAndCache(phrase, voiceId, forceRegenerate);
      }

      // Preload error messages
      for (const phrase of COMMON_PHRASES.errors) {
        await this._generateAndCache(phrase, voiceId, forceRegenerate);
      }

      logger.success(`✅ Finished preloading phrases for: ${voiceId}`);
    } catch (error) {
      logger.error('Error preloading phrases:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Preload phrases for all available voices
   * @param {boolean} forceRegenerate - Force regeneration even if cached
   */
  async preloadAllVoices(forceRegenerate = false) {
    logger.info('🎙️  Preloading phrases for all voices');

    const voiceIds = Object.keys(AVAILABLE_VOICES).map(key => AVAILABLE_VOICES[key].id);

    for (const voiceId of voiceIds) {
      await this.preloadVoice(voiceId, forceRegenerate);
    }

    logger.success('✅ Finished preloading all voices');
  }

  /**
   * Preload only the current voice's phrases
   */
  async preloadCurrentVoice() {
    const voiceSettings = this.voiceProvider.getVoiceSettings();
    const currentVoiceId = voiceSettings.voice?.id;

    if (currentVoiceId) {
      await this.preloadVoice(currentVoiceId);
    } else {
      logger.warn('No current voice ID found');
    }
  }

  /**
   * Generate and cache a single phrase
   * @private
   * @param {string} text - Text to generate
   * @param {string} voiceId - Voice ID
   * @param {boolean} forceRegenerate - Force regeneration even if cached
   */
  async _generateAndCache(text, voiceId, forceRegenerate = false) {
    try {
      // Check if already cached (unless forcing regeneration)
      if (!forceRegenerate) {
        const isCached = await voiceAudioCache.has(text, voiceId);
        if (isCached) {
          logger.debug(`⏭️  Already cached: "${text}" (${voiceId})`);
          return;
        }
      }

      // Generate audio using the voice provider
      logger.info(`🔊 Generating: "${text}" (${voiceId})`);

      // Temporarily set the voice if needed
      const originalVoice = this.voiceProvider.voiceConfig.defaultVoice;
      const targetVoice = Object.values(AVAILABLE_VOICES).find(v => v.id === voiceId);

      if (targetVoice) {
        this.voiceProvider.voiceConfig.defaultVoice = targetVoice;
      }

      // Generate the audio (but don't play it)
      const audioBlob = await this._generateAudioBlob(text);

      // Restore original voice
      this.voiceProvider.voiceConfig.defaultVoice = originalVoice;

      // Cache the blob
      if (audioBlob) {
        await voiceAudioCache.set(text, voiceId, audioBlob, {
          category: this._getCategoryForPhrase(text),
          generated: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error(`Failed to generate phrase: "${text}" (${voiceId})`, error);
    }
  }

  /**
   * Generate audio blob without playing it
   * @private
   */
  async _generateAudioBlob(text) {
    // This will vary based on provider (ElevenLabs vs OpenAI)
    // For now, we'll call the provider's TTS method and capture the blob
    // You'll need to modify the provider to expose a method that returns the blob without playing

    // Check if provider has a method to generate without playing
    if (typeof this.voiceProvider.generateAudioBlob === 'function') {
      return await this.voiceProvider.generateAudioBlob(text);
    }

    // Fallback: Use existing speak method (may play audio)
    logger.warn('Provider does not have generateAudioBlob method, using speak method');
    // Note: This is a placeholder - you'll need to implement generateAudioBlob in providers
    return null;
  }

  /**
   * Get category for a phrase (for organization/filtering)
   * @private
   */
  _getCategoryForPhrase(text) {
    if (text.includes('Hi, I\'m')) return 'voiceSample';
    if (text.includes('Theme changed')) return 'theme';
    if (text.includes('Sorry') || text.includes('went wrong')) return 'error';
    if (text.includes('refreshed') || text.includes('updated')) return 'confirmation';
    return 'system';
  }

  /**
   * Play a cached phrase (convenience method)
   * @param {string} text - Text phrase to play
   * @param {string} voiceId - Voice ID
   * @returns {Promise<boolean>} True if played from cache, false if not cached
   */
  async playCachedPhrase(text, voiceId) {
    const audioBlob = await voiceAudioCache.get(text, voiceId);

    if (audioBlob) {
      // Play the cached audio
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.play();
      return true;
    }

    return false;
  }
}
