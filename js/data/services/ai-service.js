/**
 * AIService - Manages conversational AI interactions with Claude
 *
 * Features:
 * - Conversation history management
 * - Token usage tracking
 * - Automatic history pruning
 * - Error handling and retries
 *
 * Usage:
 *   await AIService.initialize();
 *   const response = await AIService.chat("What's the weather?");
 *   AIService.clearConversation();
 */

import { createLogger } from '../../utils/logger.js';
import { SUPABASE_CONFIG } from '../auth/auth-config.js';
import { AI_CONFIG } from '../../../config.js';
import AppComms from '../../core/app-comms.js';

const logger = createLogger('AIService');

class AIServiceClass {
  constructor() {
    this.conversationHistory = [];
    this.totalTokensUsed = 0;
    this.claudeUrl = `${SUPABASE_CONFIG.url}/functions/v1/claude-chat`;
    this.isInitialized = false;
  }

  /**
   * Initialize AI service
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('AI service already initialized');
      return;
    }

    logger.info('Initializing AI service');
    this.conversationHistory = [];
    this.totalTokensUsed = 0;
    this.isInitialized = true;
    logger.success('AI service initialized');
  }

  /**
   * Send a message to Claude and get a response
   * @param {string} userMessage - The user's message
   * @returns {Promise<string>} Claude's response text
   */
  async chat(userMessage) {
    if (!this.isInitialized) {
      throw new Error('AI service not initialized');
    }

    const perfStart = performance.now();

    try {
      logger.info(`User message: "${userMessage}"`);

      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Prune history if needed
      this._pruneHistoryIfNeeded();

      // Call Claude API via edge function
      const fetchStart = performance.now();
      const response = await fetch(this.claudeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        },
        body: JSON.stringify({
          messages: this.conversationHistory,
          system: AI_CONFIG.claude.systemPrompt,
          model: AI_CONFIG.claude.model,
          max_tokens: AI_CONFIG.claude.maxTokens,
          temperature: AI_CONFIG.claude.temperature
        })
      });

      const fetchEnd = performance.now();
      logger.info(`⏱️  Claude API took ${Math.round(fetchEnd - fetchStart)}ms`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Claude API error: ${response.status} - ${error.error || error.details || 'Unknown'}`);
      }

      const result = await response.json();
      const totalTime = performance.now() - perfStart;

      // Track token usage
      this.totalTokensUsed += result.usage.total_tokens;

      logger.info(`⏱️  Total chat time: ${Math.round(totalTime)}ms`);
      logger.info(`📊 Token usage: ${result.usage.input_tokens} in + ${result.usage.output_tokens} out = ${result.usage.total_tokens} total (${this.totalTokensUsed} session total)`);
      logger.success(`Claude: "${result.response.substring(0, 100)}${result.response.length > 100 ? '...' : ''}"`);

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: result.response
      });

      // Emit event for tracking
      AppComms.emit('AI_RESPONSE_RECEIVED', {
        userMessage,
        aiResponse: result.response,
        tokensUsed: result.usage.total_tokens,
        processingTimeMs: totalTime
      });

      return result.response;

    } catch (error) {
      logger.error('Chat failed:', error);

      // Remove failed user message from history
      if (this.conversationHistory[this.conversationHistory.length - 1]?.role === 'user') {
        this.conversationHistory.pop();
      }

      // Emit error event
      AppComms.emit('AI_ERROR', {
        message: 'Failed to get AI response',
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Prune conversation history if it exceeds threshold
   * @private
   */
  _pruneHistoryIfNeeded() {
    const { pruneThreshold, keepRecentCount } = AI_CONFIG.conversation;

    if (this.conversationHistory.length > pruneThreshold) {
      logger.info(`Pruning conversation history (${this.conversationHistory.length} → ${keepRecentCount} messages)`);

      // Keep only the most recent messages
      this.conversationHistory = this.conversationHistory.slice(-keepRecentCount);

      AppComms.emit('AI_HISTORY_PRUNED', {
        newLength: this.conversationHistory.length
      });
    }
  }

  /**
   * Clear conversation history
   */
  clearConversation() {
    logger.info('Clearing conversation history');
    this.conversationHistory = [];
    this.totalTokensUsed = 0;

    AppComms.emit('AI_CONVERSATION_CLEARED');
  }

  /**
   * Get conversation history
   * @returns {Array} Array of message objects
   */
  getConversationHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Get conversation statistics
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      messageCount: this.conversationHistory.length,
      totalTokensUsed: this.totalTokensUsed,
      estimatedCost: this._estimateCost(this.totalTokensUsed)
    };
  }

  /**
   * Estimate cost based on token usage
   * @private
   */
  _estimateCost(totalTokens) {
    // Claude Sonnet 4.5 pricing (approximate)
    // Input: $3/million, Output: $15/million
    // Assume ~30% input, 70% output for rough estimate
    const inputTokens = totalTokens * 0.3;
    const outputTokens = totalTokens * 0.7;

    const inputCost = (inputTokens / 1000000) * 3.00;
    const outputCost = (outputTokens / 1000000) * 15.00;

    return (inputCost + outputCost).toFixed(4);
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Cleanup
   */
  destroy() {
    logger.info('Destroying AI service');
    this.conversationHistory = [];
    this.totalTokensUsed = 0;
    this.isInitialized = false;
  }
}

// Export singleton instance
export const AIService = new AIServiceClass();
