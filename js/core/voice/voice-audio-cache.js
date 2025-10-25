// js/core/voice/voice-audio-cache.js
// Permanent audio cache for frequently used TTS phrases
// Uses IndexedDB to persist audio across sessions

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('VoiceAudioCache');

const DB_NAME = 'dashie-voice-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio-cache';

/**
 * Permanent audio cache for TTS phrases
 * Stores pre-generated audio in IndexedDB for instant playback
 */
export class VoiceAudioCache {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize IndexedDB
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      this.db = await this._openDatabase();
      this.initialized = true;
      logger.success('Voice audio cache initialized');
    } catch (error) {
      logger.error('Failed to initialize voice audio cache:', error);
      throw error;
    }
  }

  /**
   * Open IndexedDB database
   * @private
   */
  _openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });

          // Create index on voiceId for easy cleanup when voice changes
          objectStore.createIndex('voiceId', 'voiceId', { unique: false });

          logger.debug('Created voice audio cache object store');
        }
      };
    });
  }

  /**
   * Get cached audio blob for a phrase
   * @param {string} text - Text phrase
   * @param {string} voiceId - Voice ID (e.g., 'bella', 'rachel')
   * @returns {Promise<Blob|null>} Audio blob or null if not cached
   */
  async get(text, voiceId) {
    if (!this.initialized) {
      logger.warn('Cache not initialized');
      return null;
    }

    try {
      const key = this._generateKey(text, voiceId);
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.audioBlob) {
            logger.success(`🎯 Permanent cache HIT: "${text.substring(0, 30)}..." (${voiceId})`);
            resolve(result.audioBlob);
          } else {
            logger.debug(`Permanent cache MISS: "${text.substring(0, 30)}..." (${voiceId})`);
            resolve(null);
          }
        };

        request.onerror = () => {
          logger.error('Failed to get from cache:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      logger.error('Error getting from cache:', error);
      return null;
    }
  }

  /**
   * Store audio blob for a phrase
   * @param {string} text - Text phrase
   * @param {string} voiceId - Voice ID
   * @param {Blob} audioBlob - Audio data
   * @param {Object} metadata - Optional metadata (timestamp, size, etc.)
   */
  async set(text, voiceId, audioBlob, metadata = {}) {
    if (!this.initialized) {
      logger.warn('Cache not initialized');
      return;
    }

    try {
      const key = this._generateKey(text, voiceId);
      const entry = {
        key: key,
        text: text,
        voiceId: voiceId,
        audioBlob: audioBlob,
        timestamp: Date.now(),
        size: audioBlob.size,
        ...metadata
      };

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          logger.info(`💾 Permanently cached: "${text.substring(0, 30)}..." (${voiceId}, ${(audioBlob.size / 1024).toFixed(1)}KB)`);
          resolve();
        };

        request.onerror = () => {
          logger.error('Failed to cache audio:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('Error caching audio:', error);
    }
  }

  /**
   * Check if a phrase is cached
   * @param {string} text - Text phrase
   * @param {string} voiceId - Voice ID
   * @returns {Promise<boolean>}
   */
  async has(text, voiceId) {
    const blob = await this.get(text, voiceId);
    return blob !== null;
  }

  /**
   * Delete cached audio for a phrase
   * @param {string} text - Text phrase
   * @param {string} voiceId - Voice ID
   */
  async delete(text, voiceId) {
    if (!this.initialized) {
      return;
    }

    try {
      const key = this._generateKey(text, voiceId);
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await store.delete(key);

      logger.debug(`Deleted cached audio: "${text.substring(0, 30)}..." (${voiceId})`);
    } catch (error) {
      logger.error('Error deleting from cache:', error);
    }
  }

  /**
   * Clear all cached audio for a specific voice
   * Useful when a voice is removed or regenerated
   * @param {string} voiceId - Voice ID to clear
   */
  async clearVoice(voiceId) {
    if (!this.initialized) {
      return;
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('voiceId');
      const request = index.openCursor(IDBKeyRange.only(voiceId));

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          logger.info(`Cleared ${deletedCount} cached audio entries for voice: ${voiceId}`);
        }
      };
    } catch (error) {
      logger.error('Error clearing voice cache:', error);
    }
  }

  /**
   * Clear all cached audio
   */
  async clearAll() {
    if (!this.initialized) {
      return;
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await store.clear();

      logger.info('Cleared all cached audio');
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Stats object with entry count and total size
   */
  async getStats() {
    if (!this.initialized) {
      return { count: 0, totalSize: 0 };
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const entries = request.result || [];
          const totalSize = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);

          resolve({
            count: entries.length,
            totalSize: totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
          });
        };

        request.onerror = () => {
          resolve({ count: 0, totalSize: 0 });
        };
      });
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return { count: 0, totalSize: 0 };
    }
  }

  /**
   * Generate cache key from text and voice ID
   * @private
   */
  _generateKey(text, voiceId) {
    return `${voiceId}:${text}`;
  }
}

// Export singleton instance
export const voiceAudioCache = new VoiceAudioCache();
