// js/data/auth/providers/device-flow.js
// Phase 3 - Device Flow OAuth provider for Fire TV and limited input devices
// Simplified from legacy, adapted for TokenStore integration

import { createLogger } from '../../../utils/logger.js';
import { AUTH_CONFIG } from '../../../auth/auth-config.js';

const logger = createLogger('DeviceFlow');

/**
 * Device Flow OAuth provider for TV and limited input devices
 * Implements Google OAuth Device Flow for Fire TV, Android TV, etc.
 */
export class DeviceFlowProvider {
  static isQRCodeScriptLoading = false;

  constructor() {
    this.config = {
      client_id: '221142210647-m9vf7t0qgm6nlc6gggfsqefmjrak1mo9.apps.googleusercontent.com',
      client_secret: AUTH_CONFIG.client_secret_device_flow,
      device_code_endpoint: 'https://oauth2.googleapis.com/device/code',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly'
    };

    this.isInitialized = false;
    this.pollInterval = null;
    this.countdownInterval = null;
    this.currentTokens = null;
    this.currentReject = null;
    this.cancelHandler = null;

    logger.debug('Device Flow provider initialized', {
      clientId: this.config.client_id,
      scopes: this.config.scope
    });
  }

  /**
   * Initialize the provider
   * @returns {Promise<Object|null>} Always returns null (no callback handling)
   */
  async init() {
    logger.info('Initializing Device Flow provider');
    this.isInitialized = true;
    logger.success('Device Flow provider initialized successfully');
    return null;
  }

  /**
   * Start the device flow authentication process
   * @returns {Promise<Object>} Auth result object
   */
  async signIn() {
    if (!this.isInitialized) {
      await this.init();
    }

    logger.info('Starting Device Flow sign-in');

    try {
      // Step 1: Get device code and user code
      const deviceData = await this.getDeviceCode();

      // Step 2: Show UI and start polling
      const result = await this.showUIAndPoll(deviceData);

      logger.success('Device Flow sign-in complete', {
        userEmail: result.user?.email
      });

      return result;

    } catch (error) {
      logger.error('Device Flow sign-in failed', error);
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Device code request failed: ${response.status} ${errorText}`);
      }

      const deviceData = await response.json();

      logger.success('Device code received', {
        userCode: deviceData.user_code,
        verificationUri: deviceData.verification_uri,
        expiresIn: deviceData.expires_in
      });

      return deviceData;

    } catch (error) {
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
    // Remove any previous overlay
    const existingOverlay = document.getElementById('device-flow-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'device-flow-overlay';

    const verificationUrl = deviceData.verification_uri || 'https://www.google.com/device';
    const userCode = deviceData.user_code;

    overlay.innerHTML = `
      <div class="device-flow-modal">
        <div class="logo-section">
          <div class="dashie-logo">🎯</div>
          <h2>Sign in to Dashie with Google</h2>
        </div>

        <div class="qr-wrapper">
          <div id="qr-code-container">
            <div class="qr-inner-wrapper"></div>
          </div>
          <p class="qr-instruction">Scan QR code or go to <strong>google.com/device</strong></p>
        </div>

        <div class="code-entry">
          <p class="code-label">Enter this code:</p>
          <p class="user-code">${userCode.toUpperCase()}</p>
        </div>

        <div class="device-flow-status">
          <div class="status-text">Waiting for sign-in (Expires in <span id="countdown-timer">${Math.floor(deviceData.expires_in / 60)}</span> min)</div>
        </div>

        <button id="cancel-device-flow" class="cancel-btn">Cancel</button>
      </div>
    `;

    this.addDeviceFlowStyles();

    // Generate QR code
    const qrContainer = overlay.querySelector('.qr-inner-wrapper');
    this.generateQRCode(qrContainer, verificationUrl);

    // Cancel button handling
    const cancelBtn = overlay.querySelector('#cancel-device-flow');
    this.cancelHandler = () => {
      logger.info('Device flow cancelled by user');
      this.cleanup(overlay);
      if (this.currentReject) {
        this.currentReject(new Error('Authentication cancelled by user'));
      }
    };
    cancelBtn.addEventListener('click', this.cancelHandler);

    // Focus cancel button
    setTimeout(() => cancelBtn.focus(), 200);

    // Start countdown timer
    this.startCountdownTimer(deviceData.expires_in);

    return overlay;
  }

  /**
   * Generate QR code
   * @param {HTMLElement} container - QR container
   * @param {string} url - URL to encode
   */
  generateQRCode(container, url) {
    if (!container) {
      logger.warn('QR code container not found');
      return;
    }

    const createInstance = () => {
      try {
        new QRCode(container, {
          text: url,
          width: 120,
          height: 120,
          colorDark: '#1a73e8',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });

        // Remove any img fallback
        container.querySelectorAll('img').forEach(el => el.remove());

        logger.debug('QR code generated');
      } catch (error) {
        logger.error('Error generating QR code', error);
        container.innerHTML = '<p style="color: #999; font-size: 14px;">QR code unavailable</p>';
      }
    };

    // Load QRCode library if needed
    if (typeof QRCode === 'undefined') {
      if (DeviceFlowProvider.isQRCodeScriptLoading) {
        logger.debug('QRCode library already loading, waiting...');
        const checkInterval = setInterval(() => {
          if (typeof QRCode !== 'undefined') {
            clearInterval(checkInterval);
            createInstance();
          }
        }, 50);
        return;
      }

      DeviceFlowProvider.isQRCodeScriptLoading = true;

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = () => {
        DeviceFlowProvider.isQRCodeScriptLoading = false;
        createInstance();
      };
      script.onerror = () => {
        DeviceFlowProvider.isQRCodeScriptLoading = false;
        logger.error('Failed to load QR code library');
        container.innerHTML = '<p style="color: #999; font-size: 14px;">QR code unavailable</p>';
      };
      document.head.appendChild(script);
    } else {
      createInstance();
    }
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

    this.currentReject = reject;

    const poll = async () => {
      attempts++;

      if (attempts > maxAttempts) {
        logger.error('Device flow polling timeout');
        this.cleanup(overlay);
        reject(new Error('Device flow timeout - please try again'));
        return;
      }

      try {
        logger.debug(`Polling attempt ${attempts}/${maxAttempts}`);

        // Request tokens (try with client_secret first)
        let tokenResponse = await this.requestTokens(deviceCode, true);

        // If error with client_secret, retry without it
        if (tokenResponse.error === 'invalid_request' && tokenResponse.error_description?.includes('client_secret')) {
          logger.debug('Retrying without client_secret');
          tokenResponse = await this.requestTokens(deviceCode, false);
        }

        if (tokenResponse.success) {
          // Got tokens!
          const tokens = tokenResponse.tokens;
          this.currentTokens = tokens;

          // Get user info
          const userInfo = await this.fetchUserInfo(tokens.access_token);

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
            tokens: tokens,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expires_in
          };

          this.cleanup(overlay);
          resolve(result);
          return;
        }

        // Handle pending or slow_down
        if (tokenResponse.pending) {
          logger.debug('Authorization still pending');
        } else if (tokenResponse.slowDown) {
          interval += 5;
          logger.debug(`Server requested slow down, interval now ${interval}s`);
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
   * Request tokens from Google using device code
   * @param {string} deviceCode - Device code
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

      // Handle errors
      if (data.error === 'authorization_pending') return { success: false, pending: true };
      if (data.error === 'slow_down') return { success: false, slowDown: true };

      return { success: false, error: data.error, error_description: data.error_description };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch user info from Google
   * @param {string} accessToken - Access token
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
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      const userInfo = await response.json();

      logger.success('User info retrieved', {
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
        logger.info('Device code expired');
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
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .device-flow-modal {
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 32px;
        max-width: 420px;
        text-align: center;
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.8);
      }

      .logo-section {
        margin-bottom: 24px;
      }

      .dashie-logo {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .device-flow-modal h2 {
        color: #ffffff;
        font-size: 24px;
        font-weight: 600;
        margin: 0;
      }

      .qr-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 24px 0;
      }

      #qr-code-container {
        padding: 16px;
        background: #ffffff;
        border-radius: 12px;
        margin-bottom: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .qr-inner-wrapper {
        width: 120px;
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #qr-code-container img,
      #qr-code-container canvas {
        display: block !important;
        width: 120px !important;
        height: 120px !important;
      }

      .qr-instruction {
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
        margin: 0;
      }

      .qr-instruction strong {
        color: #ffffff;
        font-weight: 600;
      }

      .code-entry {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
      }

      .code-label {
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
        margin: 0 0 8px 0;
      }

      .user-code {
        color: #1a73e8;
        font-size: 32px;
        font-weight: 700;
        letter-spacing: 4px;
        margin: 0;
        font-family: 'Courier New', monospace;
      }

      .device-flow-status {
        margin: 16px 0;
      }

      .status-text {
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
      }

      .cancel-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.9);
        padding: 12px 32px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 8px;
      }

      .cancel-btn:hover,
      .cancel-btn:focus {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.3);
        outline: none;
      }

      .cancel-btn:active {
        transform: scale(0.98);
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

    this.currentReject = null;
    this.cancelHandler = null;

    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    logger.debug('Device flow cleanup completed');
  }

  /**
   * Sign out and clear tokens
   */
  signOut() {
    logger.info('Signing out');
    try {
      this.currentTokens = null;
      this.cleanup();
      logger.success('Sign out complete');
    } catch (error) {
      logger.error('Error during sign out', error);
    }
  }

  /**
   * Get current access token
   * @returns {string|null}
   */
  getAccessToken() {
    return this.currentTokens?.access_token || null;
  }

  /**
   * Get current refresh token
   * @returns {string|null}
   */
  getRefreshToken() {
    return this.currentTokens?.refresh_token || null;
  }

  /**
   * Check if provider has valid tokens
   * @returns {boolean}
   */
  hasValidTokens() {
    return !!this.currentTokens?.access_token;
  }

  /**
   * Get provider information
   * @returns {Object}
   */
  getProviderInfo() {
    return {
      name: 'device_flow',
      type: 'oauth2_device',
      supportsRefreshTokens: true,
      isInitialized: this.isInitialized,
      hasTokens: !!this.currentTokens
    };
  }
}
