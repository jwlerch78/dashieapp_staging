// js/apis/api-auth/providers/device-flow.js - Clean Device Flow Implementation
// CHANGE SUMMARY: Added token queuing for Supabase storage (_queueRefreshTokensForStorage method and call in startPolling)

import { createLogger } from '../../../utils/logger.js';
import { AUTH_CONFIG } from '../../../auth/auth-config.js';

const logger = createLogger('DeviceFlowAuth');

/**
 * Device Flow OAuth provider for TV and limited input devices
 * Implements Google OAuth Device Flow for Fire TV, Android TV, etc.
 */
export class DeviceFlowProvider {
  constructor() {
    this.config = {
      client_id: '221142210647-m9vf7t0qgm6nlc6gggfsqefmjrak1mo9.apps.googleusercontent.com',
      client_secret: AUTH_CONFIG.client_secret_device_flow,
      device_code_endpoint: 'https://oauth2.googleapis.com/device/code',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly'
    };
    
    this.pollInterval = null;
    this.countdownInterval = null;
    this.currentTokens = null;
    
    logger.debug('Device Flow provider initialized', {
      clientId: this.config.client_id,
      scopes: this.config.scope
    });
  }

  /**
   * Start the device flow authentication process
   * @returns {Promise<Object>} Auth result object
   */
  async signIn() {
    logger.auth('device', 'sign_in_start', 'pending');
    
    try {
      // Step 1: Get device code and user code
      const deviceData = await this.getDeviceCode();
      
      // Step 2: Show UI and start polling simultaneously
      const result = await this.showUIAndPoll(deviceData);
      
      logger.auth('device', 'sign_in_complete', 'success', {
        userId: result.user?.id,
        userEmail: result.user?.email
      });
      
      return result;
      
    } catch (error) {
      logger.auth('device', 'sign_in_complete', 'error', error.message);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Get device code and user code from Google
   * @returns {Promise<Object>} Device code response
   */
  async getDeviceCode() {
    logger.debug('Requesting device code from Google');
    
    const timer = logger.startTimer('Device Code Request');
    
    try {
      const response = await fetch(this.config.device_code_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.client_id,
          scope: this.config.scope
        })
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Device code request failed: ${response.status} ${errorText}`);
      }

      const deviceData = await response.json();
      
      logger.success('Device code received', {
        userCode: deviceData.user_code,
        verificationUri: deviceData.verification_uri,
        expiresIn: deviceData.expires_in,
        interval: deviceData.interval,
        duration
      });

      return deviceData;
      
    } catch (error) {
      timer();
      logger.error('Failed to get device code', error);
      throw error;
    }
  }

  /**
   * Show device flow UI and start polling for tokens
   * @param {Object} deviceData - Device code response data
   * @returns {Promise<Object>} Auth result
   */
  async showUIAndPoll(deviceData) {
    return new Promise((resolve, reject) => {
      // Create and show UI
      const overlay = this.createDeviceCodeOverlay(deviceData);
      document.body.appendChild(overlay);
      
      // Start polling for tokens
      this.startPolling(deviceData, resolve, reject, overlay);
    });
  }

  /**
   * Create the device flow UI overlay
   * @param {Object} deviceData - Device code response data
   * @returns {HTMLElement} UI overlay element
   */
  createDeviceCodeOverlay(deviceData) {
    const overlay = document.createElement('div');
    overlay.id = 'device-flow-overlay';
    
    const verificationUrl = deviceData.verification_uri || 'https://www.google.com/device';
    
    overlay.innerHTML = `
      <div class="device-flow-modal">
        <img src="icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo">
        
        <div class="device-flow-header">
          <h2>Sign in to Dashie</h2>
          <p>Use your phone or computer to complete sign-in</p>
        </div>
        
        <div class="device-flow-content">
          <div class="verification-steps">
            <div class="step">
              <div class="step-number">1</div>
              <div class="step-text">Go to <strong>${verificationUrl}</strong></div>
            </div>
            <div class="step">
              <div class="step-number">2</div>
              <div class="step-text">Enter this code:</div>
            </div>
          </div>
          
          <div class="user-code">${deviceData.user_code}</div>
          
          <div class="device-flow-status">
            <div class="status-text">Waiting for you to complete sign-in...</div>
            <div class="countdown">Code expires in <span id="countdown-timer">${Math.floor(deviceData.expires_in / 60)}</span> minutes</div>
          </div>
        </div>
        
        <div class="device-flow-buttons">
          <button id="cancel-device-flow" class="device-flow-button secondary">Cancel</button>
        </div>
      </div>
    `;

    // Add styles
    this.addDeviceFlowStyles();
    
    // Set up cancel button
    const cancelBtn = overlay.querySelector('#cancel-device-flow');
    cancelBtn.addEventListener('click', () => {
      logger.auth('device', 'user_cancelled', 'info');
      this.cleanup(overlay);
    });

    // Start countdown timer
    this.startCountdownTimer(deviceData.expires_in);
    
    logger.debug('Device flow UI created and displayed', {
      userCode: deviceData.user_code,
      verificationUrl: verificationUrl
    });

    return overlay;
  }

  /**
   * Start polling Google for tokens
   * @param {Object} deviceData - Device code response data
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   * @param {HTMLElement} overlay - UI overlay element
   */
  startPolling(deviceData, resolve, reject, overlay) {
    const deviceCode = deviceData.device_code;
    let interval = deviceData.interval || 5; // seconds
    const maxAttempts = Math.floor(deviceData.expires_in / interval);
    let attempts = 0;

    const poll = async () => {
      attempts++;

      if (attempts > maxAttempts) {
        logger.auth('device', 'polling_timeout', 'error');
        this.cleanup(overlay);
        reject(new Error('Device flow timeout - please try again'));
        return;
      }

      try {
        logger.debug(`Polling attempt ${attempts}/${maxAttempts}`);
        
        // Request tokens
        let tokenResponse = await this.requestTokens(deviceCode, true); // first try with client_secret
        
        // If Google complains about client_secret, retry without it
        if (tokenResponse.error === 'invalid_request' && tokenResponse.error_description?.includes('client_secret')) {
          logger.debug('Retrying token request without client_secret...');
          tokenResponse = await this.requestTokens(deviceCode, false); // retry without client_secret
        }

        if (tokenResponse.success) {
          // Got access token
          const tokens = tokenResponse.tokens;
          this.currentTokens = tokens;

          // Get user info
          const userInfo = await this.fetchUserInfo(tokens.access_token);

          // **NEW: Queue refresh tokens for deferred storage during startup**
          this._queueRefreshTokensForStorage(userInfo, tokens);

          const result = {
            success: true,
            user: {
              id: userInfo.id,
              name: userInfo.name,
              email: userInfo.email,
              picture: userInfo.picture,
              authMethod: 'device_flow',
              googleAccessToken: tokens.access_token
            },
            tokens
          };

          this.cleanup(overlay);
          resolve(result);
          return;
        }

        // Handle pending or slow_down
        if (tokenResponse.pending) {
          logger.debug('Authorization still pending, will retry...');
        } else if (tokenResponse.slowDown) {
          interval += 5;
          logger.debug(`Server requested slow down, next poll in ${interval}s`);
        }

        // Schedule next poll
        this.pollInterval = setTimeout(poll, interval * 1000);

      } catch (error) {
        logger.error(`Polling attempt ${attempts} failed`, error);
        this.pollInterval = setTimeout(poll, interval * 1000);
      }
    };

    poll();
  }

  /**
   * Queue refresh tokens for storage during the startup sequence
   * @private
   * @param {Object} userInfo - User information from Google
   * @param {Object} tokens - Token data from OAuth
   */
  _queueRefreshTokensForStorage(userInfo, tokens) {
    try {
      // Only proceed if we have a refresh token
      if (!tokens.refresh_token) {
        logger.warn('No refresh token received - user may need to reauthorize');
        return;
      }

      // Initialize the queue if it doesn't exist
      if (!window.pendingRefreshTokens) {
        window.pendingRefreshTokens = [];
      }

      // Prepare token data for storage
      const tokenData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_in 
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : new Date(Date.now() + 3600 * 1000).toISOString(),
        expires_in: tokens.expires_in || 3600,
        scope: this.config.scope,
        display_name: `${userInfo.name} (Personal)`,
        email: userInfo.email,
        user_id: userInfo.id,
        issued_at: Date.now(),
        provider_info: {
          type: 'device_flow',
          client_id: this.config.client_id
        }
      };

      // Determine account type (for now, assume 'personal' - can be enhanced later)
      const accountType = 'personal';

      // Queue for processing during startup sequence
      const queuedToken = {
        provider: 'google',
        accountType,
        tokenData,
        userInfo: {
          email: userInfo.email,
          name: userInfo.name,
          id: userInfo.id
        },
        timestamp: Date.now()
      };

      window.pendingRefreshTokens.push(queuedToken);

      logger.success('🔄 Refresh tokens queued for storage during startup', {
        provider: 'google',
        accountType,
        userEmail: userInfo.email,
        scopeCount: this.config.scope.split(' ').length,
        queueSize: window.pendingRefreshTokens.length
      });

    } catch (error) {
      logger.error('Failed to queue refresh tokens:', error);
      // Don't throw - auth should still succeed even if token queuing fails
    }
  }

  /**
   * Request tokens from Google using device code
   * @param {string} deviceCode - Device code from initial request
   * @param {boolean} useClientSecret - Whether to include client_secret
   * @returns {Promise<Object>} Token request result
   */
  async requestTokens(deviceCode, useClientSecret = true) {
    try {
      const bodyParams = {
        client_id: this.config.client_id,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      };
      if (useClientSecret && this.config.client_secret) {
        bodyParams.client_secret = this.config.client_secret;
      }

      const response = await fetch(this.config.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(bodyParams)
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        return { success: true, tokens: data };
      }

      // Handle pending / slow_down
      if (data.error === 'authorization_pending') return { success: false, pending: true };
      if (data.error === 'slow_down') return { success: false, slowDown: true };

      return { success: false, error: data.error, error_description: data.error_description };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch user info from Google
   * @param {string} accessToken - Google access token
   * @returns {Promise<Object>} User information
   */
  async fetchUserInfo(accessToken) {
    logger.debug('Fetching user info from Google');
    
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status} ${response.statusText}`);
      }

      const userInfo = await response.json();
      
      logger.success('User info retrieved', {
        userId: userInfo.id,
        userName: userInfo.name,
        userEmail: userInfo.email
      });

      return userInfo;
      
    } catch (error) {
      logger.error('Failed to fetch user info', error);
      throw error;
    }
  }

  /**
   * Start countdown timer for code expiration
   * @param {number} expiresIn - Seconds until expiration
   */
  startCountdownTimer(expiresIn) {
    let remaining = expiresIn;
    
    this.countdownInterval = setInterval(() => {
      remaining -= 1;
      const minutes = Math.floor(remaining / 60);
      
      const timerElement = document.getElementById('countdown-timer');
      if (timerElement) {
        timerElement.textContent = minutes;
      }
      
      if (remaining <= 0) {
        clearInterval(this.countdownInterval);
        logger.auth('device', 'code_expired', 'error');
      }
    }, 1000);
  }

  /**
   * Add device flow CSS styles
   */
  addDeviceFlowStyles() {
    if (document.getElementById('device-flow-styles')) return;

    const style = document.createElement('style');
    style.id = 'device-flow-styles';
    style.textContent = `
      #device-flow-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .device-flow-modal {
        background: #FCFCFF;
        border-radius: 12px;
        padding: 40px;
        max-width: 500px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
      
      .dashie-logo {
        height: 60px;
        margin-bottom: 30px;
      }
      
      .device-flow-header h2 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 28px;
      }
      
      .device-flow-header p {
        margin: 0 0 30px 0;
        color: #666;
        font-size: 16px;
      }
      
      .verification-steps {
        margin-bottom: 30px;
      }
      
      .step {
        display: flex;
        align-items: center;
        margin-bottom: 15px;
        text-align: left;
      }
      
      .step-number {
        width: 30px;
        height: 30px;
        background: #007AFF;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        margin-right: 15px;
      }
      
      .step-text {
        font-size: 16px;
        color: #333;
      }
      
      .user-code {
        font-size: 36px;
        font-weight: bold;
        color: #007AFF;
        background: #F0F8FF;
        padding: 20px;
        border-radius: 8px;
        margin: 30px 0;
        letter-spacing: 4px;
      }
      
      .device-flow-status {
        margin: 30px 0;
      }
      
      .status-text {
        font-size: 16px;
        color: #666;
        margin-bottom: 10px;
      }
      
      .countdown {
        font-size: 14px;
        color: #999;
      }
      
      .device-flow-button {
        padding: 12px 24px;
        border: none;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .device-flow-button.secondary {
        background: #f5f5f5;
        color: #666;
      }
      
      .device-flow-button.secondary:hover {
        background: #e5e5e5;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Clean up UI and intervals
   * @param {HTMLElement} [overlay] - UI overlay to remove
   */
  cleanup(overlay) {
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    
    logger.debug('Device flow cleanup completed');
  }

  /**
   * Sign out and clear tokens
   */
  signOut() {
    logger.auth('device', 'sign_out', 'pending');
    
    try {
      this.currentTokens = null;
      this.cleanup();
      
      logger.auth('device', 'sign_out', 'success');
      
    } catch (error) {
      logger.auth('device', 'sign_out', 'error', error.message);
    }
  }

  /**
   * Get current access token
   * @returns {string|null} Current access token
   */
  getAccessToken() {
    return this.currentTokens?.access_token || null;
  }

  /**
   * Get current refresh token
   * @returns {string|null} Current refresh token
   */
  getRefreshToken() {
    return this.currentTokens?.refresh_token || null;
  }

  /**
   * Check if provider has valid tokens
   * @returns {boolean} True if tokens are valid
   */
  hasValidTokens() {
    return !!this.currentTokens?.access_token;
  }

  /**
   * Get provider information
   * @returns {Object} Provider info
   */
  getProviderInfo() {
    return {
      name: 'device_flow',
      type: 'oauth2_device',
      supportsRefreshTokens: true,
      hasTokens: !!this.currentTokens
    };
  }
}