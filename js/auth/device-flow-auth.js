// js/auth/device-flow-auth.js - OAuth Device Flow for Fire TV (Original + Debug Logging)

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
  }

  // Start the device flow authentication
  async startDeviceFlow() {
    try {
      console.log('🔥 Starting OAuth Device Flow...');
      
      // Step 1: Get device code and user code
      const deviceData = await this.getDeviceCode();
      
      // Step 2: Show user code to user
      const result = await this.showDeviceCodeUI(deviceData);
      
      if (result.success) {
        // Step 3: Poll for authorization
        const tokenData = await this.pollForToken(deviceData.device_code, deviceData.interval);
        
        if (tokenData) {
          // Step 4: Get user info
          const userInfo = await this.getUserInfo(tokenData.access_token);
          return {
            success: true,
            user: userInfo,
            tokens: tokenData
          };
        }
      }
      
      throw new Error('Authentication was cancelled or failed');
      
    } catch (error) {
      console.error('🔥 Device flow failed:', error);
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

  // Step 2: Show user code and instructions
  async showDeviceCodeUI(deviceData) {
    return new Promise((resolve) => {
      const overlay = this.createDeviceCodeOverlay(deviceData);
      document.body.appendChild(overlay);

      // Auto-focus and setup navigation
      this.setupDeviceCodeNavigation(overlay, resolve);
    });
  }

  createDeviceCodeOverlay(deviceData) {
    const overlay = document.createElement('div');
    overlay.id = 'device-flow-overlay';
    
    // Extract the correct URL field from Google's response - THIS IS THE FIX
    const verificationUrl = deviceData.verification_uri || deviceData.verification_url || 'https://www.google.com/device';
    
    // Debug log the device data to see what Google returns
    console.log('🔥 Device Flow Data received:', {
      verification_uri: deviceData.verification_uri,
      verification_url: deviceData.verification_url,
      user_code: deviceData.user_code,
      device_code: deviceData.device_code,
      expires_in: deviceData.expires_in,
      interval: deviceData.interval,
      finalUrl: verificationUrl
    });
    
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
              <p>Follow the instructions to sign in</p>
            </div>
          </div>
          
          <div class="device-flow-status">
            <div class="loading-spinner"></div>
            <p>Waiting for sign-in...</p>
          </div>
          
          <div class="device-flow-buttons">
            <button id="cancel-device-flow" class="device-flow-button secondary" tabindex="1">
              Cancel
            </button>
          </div>
        </div>
        
        <div class="device-flow-footer">
          <p>Code expires in <span id="countdown">${Math.floor(deviceData.expires_in / 60)}</span> minutes</p>
        </div>
      </div>
    `;

    // Apply styles
    this.applyDeviceFlowStyles(overlay);
    
    // Start countdown
    this.startCountdown(overlay, deviceData.expires_in);
    
    return overlay;
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
        align-items: center;
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
        margin: 0;
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

  setupDeviceCodeNavigation(overlay, resolve) {
    const cancelBtn = overlay.querySelector('#cancel-device-flow');
    
    // Auto-focus cancel button
    setTimeout(() => cancelBtn.focus(), 200);
    
    // Cancel button handler
    cancelBtn.addEventListener('click', () => {
      this.cleanup(overlay);
      resolve({ success: false, cancelled: true });
    });
    
    // Keyboard navigation
    overlay.addEventListener('keydown', (e) => {
      if (e.keyCode === 4 || e.key === 'Escape') { // Back button
        e.preventDefault();
        cancelBtn.click();
      } else if (e.keyCode === 13 || e.keyCode === 23) { // Enter
        if (document.activeElement === cancelBtn) {
          cancelBtn.click();
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
        this.cleanup(overlay);
        return;
      }
      
      remaining--;
    };
    
    // Update immediately and then every second
    updateCountdown();
    this.countdownInterval = setInterval(updateCountdown, 1000);
  }

  // Step 3: Poll for authorization (ORIGINAL CODE with extra debug logging)
  async pollForToken(deviceCode, interval = 5) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max
      
      console.log('🔥 🚀 STARTING TOKEN POLLING');
      console.log('🔥 Device code:', deviceCode);
      console.log('🔥 Interval:', interval);
      console.log('🔥 Max attempts:', maxAttempts);
      
      const poll = async () => {
        try {
          attempts++;
          console.log(`🔥 📡 POLLING ATTEMPT ${attempts}/${maxAttempts}`);
          
          if (attempts > maxAttempts) {
            console.log('🔥 ❌ Polling timeout reached');
            reject(new Error('Polling timeout - please try again'));
            return;
          }
          
          console.log('🔥 📤 Making token request...');
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
          
          console.log('🔥 📥 Token response status:', response.status);
          console.log('🔥 📥 Token response ok:', response.ok);
          
          const data = await response.json();
          console.log('🔥 📥 Token response data:', {
            hasAccessToken: !!data.access_token,
            error: data.error,
            errorDescription: data.error_description,
            fullResponse: data
          });
          
          if (response.ok && data.access_token) {
            // Success!
            console.log('🔥 ✅ ACCESS TOKEN RECEIVED! Authentication successful!');
            resolve(data);
          } else if (data.error === 'authorization_pending') {
            // Still waiting for user to authorize
            console.log('🔥 ⏳ Still waiting for authorization... scheduling next poll');
            this.pollInterval = setTimeout(poll, interval * 1000);
          } else if (data.error === 'slow_down') {
            // Increase polling interval
            console.log('🔥 🐌 Slowing down polling...');
            this.pollInterval = setTimeout(poll, (interval + 5) * 1000);
          } else {
            // Other error
            console.log('🔥 ❌ Authentication error:', data.error, data.error_description);
            reject(new Error(data.error_description || data.error || 'Authentication failed'));
          }
          
        } catch (error) {
          console.error('🔥 ❌ Polling fetch error:', error);
          console.log('🔥 🔄 Retrying polling in', interval, 'seconds...');
          this.pollInterval = setTimeout(poll, interval * 1000);
        }
      };
      
      // Start polling immediately
      console.log('🔥 🎬 Starting first poll...');
      poll();
    });
  }

  // Step 4: Get user information
  async getUserInfo(accessToken) {
    console.log('🔥 👤 Fetching user info...');
    
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get user information');
    }
    
    const userInfo = await response.json();
    console.log('🔥 👤 User info received:', userInfo);
    
    return {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      picture: userInfo.picture,
      authMethod: 'device_flow'
    };
  }

  cleanup(overlay) {
    console.log('🔥 🧹 Cleaning up device flow...');
    
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
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
}
