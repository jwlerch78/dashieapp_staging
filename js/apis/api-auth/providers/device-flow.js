// js/apis/api-auth/providers/device-flow.js - Clean Device Flow Implementation
// v1.7 - 10/11/25 6:00pm - Registered with modal manager, UI tweaks (larger logo, black text, normal font)
// v1.6 - 10/11/25 5:30pm - Added Fire TV back button support (keyCode 4) for cancel/escape
// v1.5 - 10/11/25 5:15pm - UI polish: larger logo, black arrow, 2-line QR instructions, uppercase code
// v1.4 - 10/11/25 4:40pm - Final polish: icon logo, orange URL/code, fixed cancel error message
// v1.3 - 10/11/25 4:30pm - Compact design, simplified code styling, fixed cancel to return to login
// v1.2 - 10/11/25 4:15pm - Fixed sizing, QR code rendering, correct orange color (#EE9828)
// v1.1 - 10/11/25 4:00pm - Redesigned UI with QR code, d-pad navigation, and new layout
// CHANGE SUMMARY: Added token queuing for Supabase storage (_queueRefreshTokensForStorage method and call in startPolling)

import { createLogger } from '../../../utils/logger.js';
import { AUTH_CONFIG } from '../../../auth/auth-config.js';
import { createModalNavigation } from '../../../utils/modal-navigation-manager.js';

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
    this.modalNavigation = null; // Store modal navigation reference for cleanup
    
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
    const userCode = deviceData.user_code;
    
    // Build verification URL with code embedded for QR code
    const qrCodeUrl = `${verificationUrl}?user_code=${userCode}`;
    
    overlay.innerHTML = `
      <div class="device-flow-modal">
        <!-- Logo Connection Row -->
        <div class="logo-connection">
          <svg class="google-logo" viewBox="0 0 48 48" width="32" height="32">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          
          <div class="connection-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L2 12L6 15M18 9L22 12L18 15M2 12H22" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          
          <img src="icons/Dashie_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo-small">
        </div>
        
        <!-- Heading -->
        <h2 class="sign-in-heading">Sign in to Dashie with Google</h2>
        
        <!-- QR Code -->
        <div class="qr-wrapper">
          <div id="qr-code-container"></div>
        </div>
        
        <!-- Alternative Method -->
        <div class="alternative-method">
          <p class="device-instruction">or go to <span class="device-url">google.com/device</span></p>
          <p class="device-instruction">and enter <span class="user-code">${userCode.toUpperCase()}</span></p>
        </div>
        
        <!-- Status -->
        <div class="device-flow-status">
          <div class="status-text">Waiting for sign-in...</div>
          <div class="countdown">Expires in <span id="countdown-timer">${Math.floor(deviceData.expires_in / 60)}</span> min</div>
        </div>
        
        <!-- Cancel Button -->
        <button id="cancel-device-flow" class="cancel-btn" tabindex="0">Cancel</button>
      </div>
    `;

    // Add styles
    this.addDeviceFlowStyles();
    
    // Generate QR code
    setTimeout(() => {
      this.generateQRCode(qrCodeUrl);
    }, 100);
    
    // Set up cancel button
    const cancelBtn = overlay.querySelector('#cancel-device-flow');
    
    // Store reject function for cancel handling
    this.cancelHandler = () => {
      logger.info('🚫 Device flow cancelled by user - reloading page');
      logger.auth('device', 'user_cancelled', 'info');
      this.cleanup(overlay);
      
      // Reload the page to restart the auth flow cleanly
      // This prevents getting stuck in waitForAuthentication() loop
      setTimeout(() => {
        window.location.reload();
      }, 100);
    };
    
    cancelBtn.addEventListener('click', this.cancelHandler);
    
    // D-pad/Keyboard handlers
    cancelBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        this.cancelHandler();
      }
    });
    
    // Register with modal navigation manager for proper event handling
    // This ensures Fire TV back button (keyCode 4) and escape work correctly
    logger.debug('Registering device flow with modal manager');
    this.modalNavigation = createModalNavigation(overlay, ['cancel-device-flow'], {
      initialFocus: 0,
      onEscape: () => {
        logger.debug('Modal manager escape triggered');
        this.cancelHandler();
      }
    });
    
    logger.debug('Device flow modal registered with navigation manager');
    
    // Auto-focus cancel button for d-pad navigation
    setTimeout(() => {
      cancelBtn.focus();
    }, 200);

    // Start countdown timer
    this.startCountdownTimer(deviceData.expires_in);
    
    logger.debug('Device flow UI created and displayed', {
      userCode: deviceData.user_code,
      verificationUrl: verificationUrl,
      qrCodeUrl: qrCodeUrl
    });

    return overlay;
  }

  /**
   * Generate QR code on canvas
   * @param {string} url - URL to encode in QR code
   */
  generateQRCode(url) {
    const container = document.getElementById('qr-code-container');
    if (!container) {
      logger.warn('QR code container not found');
      return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Check if qrcode library is loaded
    if (typeof QRCode === 'undefined') {
      // Load QRCode library from CDN
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = () => {
        this.createQRCodeInstance(container, url);
      };
      script.onerror = () => {
        logger.error('Failed to load QR code library');
        container.innerHTML = '<p style="color: #999; font-size: 14px;">QR code unavailable</p>';
      };
      document.head.appendChild(script);
    } else {
      this.createQRCodeInstance(container, url);
    }
  }

  /**
   * Create QR code instance
   * @param {HTMLElement} container - Container element
   * @param {string} url - URL to encode
   */
  createQRCodeInstance(container, url) {
    try {
      new QRCode(container, {
        text: url,
        width: 120,
        height: 120,
        colorDark: '#EE9828',  // Dashie orange
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      logger.debug('QR code generated', { url });
    } catch (error) {
      logger.error('Error generating QR code', error);
      container.innerHTML = '<p style="color: #999; font-size: 14px;">Failed to generate QR code</p>';
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
    
    // Store reject function for cancel handling
    this.currentReject = reject;

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
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .device-flow-modal {
        background: #FCFCFF;
        border-radius: 12px;
        padding: 20px 30px;
        max-width: 380px;
        max-height: 90vh;
        overflow-y: auto;
        text-align: center;
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.5);
      }
      
      /* Logo Connection Row */
      .logo-connection {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 15px;
      }
      
      .google-logo {
        width: 32px;
        height: 32px;
      }
      
      .connection-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .connection-arrow svg {
        width: 24px;
        height: 24px;
        display: block;
      }
      
      .dashie-logo-small {
        height: 46px;
      }
      
      /* Heading */
      .sign-in-heading {
        margin: 0 0 15px 0;
        color: #1a1a1a;
        font-size: 18px;
        font-weight: 600;
      }
      
      /* QR Code */
      .qr-wrapper {
        margin: 0 auto 15px;
      }
      
      #qr-code-container {
        display: inline-block;
        padding: 10px;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        margin: 0 auto;
      }
      
      #qr-code-container img {
        display: block !important;
        width: 120px !important;
        height: 120px !important;
      }
      
      /* Alternative Method */
      .alternative-method {
        margin: 15px 0;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      
      .device-instruction {
        margin: 3px 0;
        color: #555;
        font-size: 13px;
        line-height: 1.6;
      }
      
      .device-url {
        color: #1a1a1a;
        font-size: 15px;
        font-weight: 700;
      }
      
      .user-code {
        font-weight: 700;
        color: #1a1a1a;
        font-size: 15px;
        text-transform: uppercase;
      }
      
      /* Status */
      .device-flow-status {
        margin: 15px 0 12px 0;
      }
      
      .status-text {
        font-size: 13px;
        color: #666;
        margin-bottom: 5px;
      }
      
      .countdown {
        font-size: 12px;
        color: #999;
      }
      
      /* Cancel Button */
      .cancel-btn {
        padding: 10px 32px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        background: #fff;
        color: #666;
        outline: none;
        margin-top: 8px;
      }
      
      .cancel-btn:hover {
        background: #f5f5f5;
        border-color: #ccc;
      }
      
      .cancel-btn:focus {
        border-color: #EE9828;
        box-shadow: 0 0 0 3px rgba(238, 152, 40, 0.2);
        background: #fff;
        color: #333;
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
    
    // Unregister from modal navigation manager
    if (this.modalNavigation) {
      logger.debug('Unregistering device flow from modal manager');
      this.modalNavigation.destroy();
      this.modalNavigation = null;
    }
    
    // Clear reject handler
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