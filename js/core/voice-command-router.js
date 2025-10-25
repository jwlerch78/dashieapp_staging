/**
 * VoiceCommandRouter - Command processing and routing for voice input
 *
 * Responsibilities:
 * - Receive voice transcripts from VoiceService
 * - Determine if command is "simple" (local) or "complex" (AI)
 * - Execute simple commands locally (theme changes, navigation, etc.)
 * - Route complex commands to AI for processing (future)
 * - Provide spoken feedback for command execution
 */

import { createLogger } from '../utils/logger.js';
import AppComms from './app-comms.js';
import { AIService } from '../data/services/ai-service.js';

const logger = createLogger('VoiceCommandRouter');

class VoiceCommandRouter {
  constructor() {
    if (VoiceCommandRouter.instance) {
      return VoiceCommandRouter.instance;
    }

    this.initialized = false;
    this.voiceService = null;
    this.settingsService = null;

    // Command patterns for simple local commands
    this.commandPatterns = this._buildCommandPatterns();

    VoiceCommandRouter.instance = this;
  }

  /**
   * Initialize the voice command router
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('VoiceCommandRouter already initialized');
      return;
    }

    try {
      // Get VoiceService reference
      this.voiceService = window.voiceService;

      if (!this.voiceService) {
        throw new Error('VoiceService not available');
      }

      // Get SettingsService reference (for theme changes)
      if (window.Settings) {
        const { getSettingsService } = await import('../data/services/settings-service.js');
        this.settingsService = getSettingsService();
      } else {
        logger.warn('Settings not available - theme commands will not work');
      }

      // Subscribe to voice transcript events
      this._subscribeToVoiceEvents();

      this.initialized = true;
      logger.success('VoiceCommandRouter initialized');
    } catch (error) {
      logger.error('Failed to initialize VoiceCommandRouter:', error);
      throw error;
    }
  }

  /**
   * Subscribe to voice events from VoiceService
   * @private
   */
  _subscribeToVoiceEvents() {
    // Process final transcripts
    AppComms.on('VOICE_TRANSCRIPT_RECEIVED', (transcript) => {
      this.processCommand(transcript);
    });

    logger.debug('Subscribed to voice events');
  }

  /**
   * Build command pattern definitions
   * @private
   */
  _buildCommandPatterns() {
    return {
      theme: {
        keywords: ['theme', 'dark mode', 'light mode', 'dark', 'light', 'night mode', 'day mode'],
        patterns: {
          dark: ['dark', 'night', 'black'],
          light: ['light', 'day', 'bright', 'white']
        }
      }
      // Future: Add more command patterns here
      // navigation: { ... }
      // widgets: { ... }
      // system: { ... }
    };
  }

  /**
   * Process a voice command transcript
   * @param {string} transcript - Voice command text
   */
  processCommand(transcript) {
    if (!transcript || typeof transcript !== 'string') {
      logger.warn('Invalid transcript received', { transcript });
      return;
    }

    logger.info('Processing voice command:', transcript);

    // Determine if this is a simple command we can handle locally
    const isSimple = this._isSimpleCommand(transcript);
    logger.debug('Command classification:', { transcript, isSimple });

    if (isSimple) {
      this._handleLocalCommand(transcript);
    } else {
      // Complex command - send to AI (future implementation)
      this._sendToAI(transcript);
    }
  }

  /**
   * Check if transcript matches a simple local command pattern
   * @private
   * @param {string} transcript - Voice command text
   * @returns {boolean}
   */
  _isSimpleCommand(transcript) {
    const lower = transcript.toLowerCase();

    // Check theme commands
    if (this._matchesThemeCommand(lower)) {
      return true;
    }

    // Future: Check other simple command patterns
    // if (this._matchesNavigationCommand(lower)) return true;
    // if (this._matchesWidgetCommand(lower)) return true;

    return false;
  }

  /**
   * Check if transcript matches theme change command
   * @private
   * @param {string} lower - Lowercase transcript
   * @returns {boolean}
   */
  _matchesThemeCommand(lower) {
    const { theme } = this.commandPatterns;

    // Check if any theme keywords are present
    return theme.keywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Handle local command execution
   * @private
   * @param {string} transcript - Voice command text
   */
  _handleLocalCommand(transcript) {
    const lower = transcript.toLowerCase();

    // Theme change commands
    if (this._matchesThemeCommand(lower)) {
      this._handleThemeChange(lower);
      return;
    }

    // Future: Add more local command handlers here
    // if (this._matchesNavigationCommand(lower)) { this._handleNavigation(lower); }
    // if (this._matchesWidgetCommand(lower)) { this._handleWidgetControl(lower); }

    logger.warn('Matched as simple command but no handler found', { transcript });
  }

  /**
   * Handle theme change command
   * @private
   * @param {string} lower - Lowercase transcript
   */
  _handleThemeChange(lower) {
    const { patterns } = this.commandPatterns.theme;

    let newTheme = null;

    // Check for dark theme keywords
    if (patterns.dark.some(keyword => lower.includes(keyword))) {
      newTheme = 'dark';
    }
    // Check for light theme keywords
    else if (patterns.light.some(keyword => lower.includes(keyword))) {
      newTheme = 'light';
    }

    if (!newTheme) {
      logger.warn('Theme command detected but no specific theme identified', { lower });
      const errorMessage = 'I heard theme, but I\'m not sure which theme you want';

      this._sendAIResponse(errorMessage, {
        command: 'theme_change',
        success: false,
        error: 'Theme not specified'
      });

      this._speakError(errorMessage);
      return;
    }

    // Check if theme is already set to this value
    const currentTheme = window.themeApplier?.getCurrentTheme();
    if (currentTheme === newTheme) {
      logger.info('Theme already set to:', newTheme);
      const message = `Theme is already set to ${newTheme} mode`;
      this._speakConfirmation(message);
      this._emitCommandExecuted('theme_change', message, { theme: newTheme });
      return;
    }

    // Execute theme change
    logger.info('Changing theme to:', newTheme);

    try {
      if (this.settingsService) {
        // Update settings in database
        this.settingsService.updateSettings({ theme: newTheme });
      } else if (window.themeApplier) {
        // Fallback: Just apply theme locally (bypass mode)
        window.themeApplier.applyTheme(newTheme);
      } else {
        throw new Error('No theme service available');
      }

      // Create consistent response message
      const message = `Theme changed to ${newTheme} mode`;

      // Emit success event
      this._emitCommandExecuted('theme_change', message, { theme: newTheme });

      // Speak confirmation (same message)
      this._speakConfirmation(message);

      logger.success('Theme changed successfully', { theme: newTheme });
    } catch (error) {
      logger.error('Failed to change theme:', error);
      const errorMessage = 'Sorry, I couldn\'t change the theme';
      this._speakError(errorMessage);

      // Send error to AI widget too
      this._sendAIResponse(errorMessage, {
        command: 'theme_change',
        success: false,
        error: error.message
      });

      AppComms.emit('VOICE_ERROR', { message: 'Failed to change theme' });
    }
  }

  /**
   * Send complex command to AI for processing
   * @private
   * @param {string} transcript - Voice command text
   */
  async _sendToAI(transcript) {
    logger.info('Sending to AI:', transcript);

    // Emit event for logging/debugging
    AppComms.emit('VOICE_COMMAND_SENT_TO_AI', { transcript });

    try {
      // Send to Claude API via AIService
      const response = await AIService.chat(transcript);

      // Send AI response to widget
      this._sendAIResponse(response, {
        command: 'ai-chat',
        success: true,
        transcript
      });

      // Speak AI response
      this._speakConfirmation(response);

    } catch (error) {
      logger.error('AI processing failed:', error);

      // Fallback error message
      const errorMessage = 'Sorry, I\'m having trouble connecting to my brain right now. Can you try again?';

      this._sendAIResponse(errorMessage, {
        command: 'ai-error',
        success: false,
        transcript,
        error: error.message
      });

      // Speak error message
      this._speakError(errorMessage);
    }
  }

  /**
   * Emit command executed event
   * @private
   * @param {string} command - Command name
   * @param {string} result - Result message
   * @param {object} extraData - Additional data
   */
  _emitCommandExecuted(command, result, extraData = {}) {
    AppComms.emit('VOICE_COMMAND_EXECUTED', {
      command,
      result,
      ...extraData
    });

    // Send AI response to AI Response widget
    this._sendAIResponse(result, {
      command,
      success: true,
      ...extraData
    });
  }

  /**
   * Send AI response to AI Response widget
   * @private
   * @param {string} content - Response content
   * @param {object} metadata - Response metadata
   */
  _sendAIResponse(content, metadata = {}) {
    // Emit event for widget-data-manager to forward to AI widget
    AppComms.emit('AI_RESPONSE_GENERATED', {
      sender: 'ai',
      content,
      timestamp: Date.now(),
      messageId: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata
    });
  }

  /**
   * Speak confirmation message
   * @private
   * @param {string} message - Message to speak
   */
  _speakConfirmation(message) {
    if (this.voiceService) {
      this.voiceService.speak(message);
    }
  }

  /**
   * Speak error message
   * @private
   * @param {string} message - Error message to speak
   */
  _speakError(message) {
    if (this.voiceService) {
      this.voiceService.speak(message);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!VoiceCommandRouter.instance) {
      VoiceCommandRouter.instance = new VoiceCommandRouter();
    }
    return VoiceCommandRouter.instance;
  }
}

// Export singleton instance
export default VoiceCommandRouter.getInstance();
