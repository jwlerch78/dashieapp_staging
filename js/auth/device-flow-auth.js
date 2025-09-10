// js/auth/device-flow-auth.js - OAuth Device Flow for Fire TV (Fixed Polling)

export class DeviceFlowAuth {
  constructor() {
    this.config = {
      // Use Fire TV client ID for Device Flow
      client_id: '221142210647-m9vf7t0qgm6nlc6gggfsqefmjrak1mo9.apps.googleusercontent.com',
      device_code_endpoint: 'https://oauth2.googleapis.com/device/code',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile'
    };
    this.pollInterval = null;
    this.countdownInterval = null;
    this.isPolling = false;
    this.currentOverlay = null;
  }

  // Start the device flow authentication
  async startDeviceFlow() {
    try {
      console.log('🔥 Starting OAuth Device Flow...');
      
      // Step 1: Get device code and user code
      const deviceData = await this.getDeviceCode();
      console.log('🔥 Device data received:', deviceData);
      
      // Step 2: Show user code to user and start polling immediately
      const result = await this.showDeviceCodeUIAndPoll(deviceData);
      
      if (result.success && result.user) {
        console.log('🔥 ✅ Device Flow completed successfully');
        return result;
      }
      
      throw new Error('Authentication was cancelled or failed');
      
    } catch (error) {
      console.error('🔥 Device flow failed:', error);
      this.cleanup();
      throw error;
    }
  }

  // Step 1: Get device code from Google
  async getDeviceCode() {
    console.log('🔥 Requesting device code from Google...');
    
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

    console.log('🔥 Device code response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔥 Device code request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to get device code: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('🔥 Device code received successfully:', {
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      verification_url: data.verification_url,
      expires_in: data.expires_in,
      interval: data.interval
    });

    return data;
  }

  // Step 2: Show user code and start polling immediately
  async showDeviceCodeUIAndPoll(deviceData) {
    return new Promise((resolve, reject) => {
      // Create and show the UI
      const overlay = this.createDeviceCodeOverlay(deviceData);
      document.body.appendChild(overlay);
      this.currentOverlay = overlay;

      // Set up navigation and cancel handling
      this.setupDeviceCodeNavigation(overlay, () => {
        this.cleanup();
        resolve({ success: false, cancelled: true });
      });

      // Start polling immediately - don't wait for any user interaction
      this.startPolling(deviceData.device_code, deviceData.interval || 5, resolve, reject);
      
      // Start countdown timer
      this.startCountdown(overlay, deviceData.expires_in);
    });
  }

  // Step 3: Start polling for authorization (improved)
  startPolling(deviceCode, interval, resolve, reject) {
    if (this.isPolling) {
      console.log('🔥 Already polling, skipping...');
      return;
    }

    this.isPolling = true;
    let attempts = 0;
    const maxAttempts = Math.floor(600 / interval); // 10 minutes worth of attempts
    
    console.log('🔥 Starting polling for device code authorization...');
    console.log('🔥 Polling interval:', interval, 'seconds');
    console.log('🔥 Max attempts:', maxAttempts);

    const poll = async () => {
      // Stop if cleanup was called
      if (!this.isPolling) {
        console.log('🔥 Polling stopped by cleanup');
        return;
      }

      try {
        attempts++;
        console.log(`🔥 Polling attempt ${attempts}/${maxAttempts}`);
        
        if (attempts > maxAttempts) {
          this.cleanup();
          reject(new Error('Polling timeout - the code has expired. Please try again.'));
          return;
        }
        
        const response = await fetch(this.config.token_endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: this.config.client_id,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        });
        
        const data = await response.json();
        console.log('🔥 Polling response:', {
          status: response.status,
          ok: response.ok,
          hasAccessToken: !!data.access_token,
          error: data.error,
          errorDescription: data.error_description
        });
        
        if (response.ok && data.access_token) {
          // Success! Stop polling and get user info
          console.log('🔥 ✅ Access token received!');
          this.isPolling = false;
          
          try {
            const userInfo = await this.getUserInfo(data.access_token);
            this.cleanup();
            resolve({
              success: true,
              user: userInfo,
              tokens: data
            });
            return;
          } catch (userInfoError) {
            console.error('🔥 Failed to get user info:', userInfoError);
            this.cleanup();
            reject(new Error('Failed to get user information: ' + userInfoError.message));
            return;
          }
          
        } else if (data.error === 'authorization_pending') {
          // Still waiting for user to authorize - continue polling
          console.log('🔥 Still waiting for user authorization...');
          
        } else if (data.error === 'slow_down') {
          // Google wants us to slow down - increase interval
          console.log('🔥 Slowing down polling as requested...');
          interval = interval + 5;
          
        } else if (data.error === 'expired_token') {
          // Code has expired
          console.log('🔥 Device code has expired');
          this.cleanup();
          reject(new Error('The device code has expired. Please try signing in again.'));
          return;
          
        } else if (data.error === 'access_denied') {
          // User denied access
          console.log('🔥 User denied access');
          this.cleanup();
          reject(new Error('Access was denied. Please try signing in again.'));
          return;
          
        } else {
          // Other error
          console.error('🔥 Unexpected polling error:', data);
          this.cleanup();
          reject(new Error(data.error_description || data.error || 'Authentication failed'));
          return;
        }
        
      } catch (fetchError) {
        console.error('🔥 Polling fetch error:', fetchError);
        // Don't reject on network errors, just continue polling
        console.log('🔥 Network error during polling, will retry...');
      }
      
      // Schedule next poll if we're still polling
      if (this.isPolling) {
        this.pollInterval = setTimeout(poll, interval * 1000);
      }
    };
    
    // Start the first poll immediately
    poll();
  }

  // Step 4: Get user information
  async getUserInfo(accessToken) {
    console.log('🔥 Fetching user info with access token...');
    
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔥 Failed to get user info:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to get user information: ${response.status}`);
    }
    
    const userInfo = await response.json();
    console.log('🔥 User info received:', {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email
    });
    
    return {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      picture: userInfo.picture,
      authMethod: 'device_flow'
    };
  }

  createDeviceCodeOverlay(deviceData) {
    const overlay = document.createElement('div');
    overlay.id = 'device-flow-overlay';
    
    // Extract the correct URL field from Google's response
    const verificationUrl = deviceData.verification_uri || deviceData.verification_url || 'https://www.google.com/device';
    
    console.log('🔥 Creating device code overlay with URL:', verificationUrl);
    
    overlay.innerHTML = `
      <div class="device-flow-modal">
        <img src="icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" class="dashie-logo">
        
        <div class="device-flow-header">
          <h2>Sign in with Google</h2>
          <p>Use your phone or computer to complete sign-in</p>
        </div>
        
        <div class="device-flow-content">
          <div class="step-instructions">
            <div class="step">
              <span class="step-number">1</span>
              <p>On your phone or computer, go to:</p>
              <div class="verification-url">${verificationUrl}</div>
            </div>
            
            <div class="step">
              <span class="step-number">2</span>
              <p>Enter this code:</p>
              <div class="user-code">${deviceData.user_code}</div>
            </div>
            
            <div class="step">
              <span class="step-number">3</span>
              <p>Complete the sign-in process</p>
            </div>
          </div>
          
          <div class="device-flow-status">
            <div class="loading-spinner"></div>
            <p id="polling-status">Waiting for sign-in...</p>
          </div>
          
          <div class="device-flow-buttons">
            <button id="cancel-device-flow" class="device-flow-button secondary" tabindex="1">
              Cancel
            </button>
          </div>
        </div>
        
        <div class="device-flow-footer">
          <p>Code expires in <span id="countdown">${Math.floor(deviceData.expires_in / 60)}</span> minutes</p>
          <p id="debug-info" style="font-size: 12px; color: #666; margin-top: 10px;">
            Polling every ${deviceData.interval || 5} seconds...
          </p>
        </div>
      </div>
    `;

    // Apply styles
    this.applyDeviceFlowStyles(overlay);
    
    return overlay;
  }

  setupDeviceCodeNavigation(overlay, onCancel) {
    const cancelBtn = overlay.querySelector('#cancel-device-flow');
    
    // Auto-focus cancel button
    setTimeout(() => cancelBtn.focus(), 200);
    
    // Cancel button handler
    const handleCancel = () => {
      console.log('🔥 User cancelled device flow');
      onCancel();
    };
    
    cancelBtn.addEventListener('click', handleCancel);
    
    // Keyboard navigation
    overlay.addEventListener('keydown', (e) => {
      if (e.keyCode === 4 || e.key === 'Escape') { // Back button
        e.preventDefault();
        handleCancel();
      } else if (e.keyCode === 13 || e.keyCode === 23) { // Enter
        if (document.activeElement === cancelBtn) {
          handleCancel();
        }
      }
    });
  }

  startCountdown(overlay, expiresIn) {
    const countdownEl = overlay.querySelector('#countdown');
    let remaining = expiresIn;
    
    const updateCountdown = () => {
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      if (remaining <= 0) {
        console.log('🔥 Device code expired');
        this.cleanup();
        return;
      }
      
      remaining--;
    };
    
    // Update immediately and then every second
    updateCountdown();
    this.countdownInterval = setInterval(updateCountdown, 1000);
  }

  cleanup() {
    console.log('🔥 Cleaning up device flow...');
    
    // Stop polling
    this.isPolling = false;
    
    // Clear intervals
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    // Remove overlay
    if (this.currentOverlay && this.currentOverlay.parentNode) {
      this.currentOverlay.parentNode.removeChild(this.currentOverlay);
      this.currentOverlay = null;
    }
  }

  applyDeviceFlowStyles(overlay) {
    overlay.style.cssText = `
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
    `;

    const style = document.createElement('style');
    style.textContent = `
      .device-flow-modal {
        background: #FCFCFF;
        border-radius: 16px;
        padding: 40px;
        max-width: 600px;
        width: 90%;
        text-align: center;
        color: #424242;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
      
      .dashie-logo {
        width: 120px;
        height: auto;
        margin-bottom: 24px;
      }
      
      .device-flow-header h2 {
        margin: 0 0 8px 0;
        font-size: 28px;
        font-weight: bold;
        color: #424242;
      }
      
      .device-flow-header p {
        margin: 0 0 32px 0;
        font-size: 16px;
        color: #616161;
      }
      
      .step-instructions {
        margin-bottom: 32px;
      }
      
      .step {
        display: flex;
        align-items: flex-start;
        margin-bottom: 24px;
        text-align: left;
      }
      
      .step-number {
        background: #1a73e8;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        margin-right: 16px;
        flex-shrink: 0;
        margin-top: 4px;
      }
      
      .step p {
        margin: 0 0 8px 0;
        font-size: 16px;
        color: #424242;
      }
      
      .verification-url {
        background: #f8f9fa;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 18px;
        font-weight: bold;
        color: #1a73e8;
        border: 2px solid #e8f0fe;
        margin-top: 8px;
      }
      
      .user-code {
        background: #fff3e0;
        padding: 16px 24px;
        border-radius: 8px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 32px;
        font-weight: bold;
        color: #ff8f00;
        border: 2px solid #ffcc02;
        letter-spacing: 4px;
        margin-top: 8px;
      }
      
      .device-flow-status {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 24px 0;
        padding: 16px;
        background: #f0f8ff;
        border-radius: 8px;
      }
      
      .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e3f2fd;
        border-top: 2px solid #1a73e8;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .device-flow-button {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        outline: none;
      }
      
      .device-flow-button.secondary {
        background: #f8f9fa;
        color: #5f6368;
        border: 1px solid #dadce0;
      }
      
      .device-flow-button.secondary:hover,
      .device-flow-button.secondary:focus {
        background: #f1f3f4;
        outline: 3px solid #ffaa00;
        transform: scale(1.02);
      }
      
      .device-flow-footer {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid #e8eaed;
      }
      
      .device-flow-footer p {
        margin: 5px 0;
        font-size: 14px;
        color: #9aa0a6;
      }
      
      #countdown {
        font-weight: bold;
        color: #ea4335;
      }
    `;
    
    document.head.appendChild(style);
  }
}
