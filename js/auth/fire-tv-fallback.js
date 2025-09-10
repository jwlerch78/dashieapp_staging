// js/auth/fire-tv-fallback.js - Fire TV WebView Authentication Fallback

export class FireTVFallback {
  constructor() {
    this.config = {
      client_id: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
      scope: 'profile email'
    };
  }

  // Check if we're on Fire TV
  isFireTV() {
    const userAgent = navigator.userAgent;
    return userAgent.includes('AFTS') || userAgent.includes('FireTV') || 
           userAgent.includes('AFT') || userAgent.includes('AFTMM') ||
           userAgent.includes('AFTRS') || userAgent.includes('AFTSS');
  }

  // Create WebView-based auth for Fire TV
  async showFireTVWebAuth() {
    console.log('🔥 Starting Fire TV WebView authentication...');
    
    return new Promise((resolve, reject) => {
      // Create auth popup overlay
      const authOverlay = this.createAuthOverlay();
      document.body.appendChild(authOverlay);
      
      // Create iframe for Google authentication
      const iframe = this.createAuthIframe();
      const container = authOverlay.querySelector('.auth-container');
      container.appendChild(iframe);
      
      // Set up message listener for auth results
      const messageHandler = (event) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'FIRE_TV_AUTH_SUCCESS') {
          console.log('🔥 Fire TV auth success:', event.data.user);
          document.body.removeChild(authOverlay);
          window.removeEventListener('message', messageHandler);
          resolve({
            success: true,
            user: event.data.user
          });
        } else if (event.data.type === 'FIRE_TV_AUTH_ERROR') {
          console.error('🔥 Fire TV auth error:', event.data.error);
          document.body.removeChild(authOverlay);
          window.removeEventListener('message', messageHandler);
          reject(new Error(event.data.error));
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Set up close button
      const closeBtn = authOverlay.querySelector('.close-auth-btn');
      closeBtn.addEventListener('click', () => {
        document.body.removeChild(authOverlay);
        window.removeEventListener('message', messageHandler);
        reject(new Error('Authentication cancelled'));
      });
      
      // Focus management for Fire TV
      this.setupFireTVAuthNavigation(authOverlay);
    });
  }

  createAuthOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'fire-tv-auth-overlay';
    overlay.innerHTML = `
      <div class="auth-container">
        <div class="auth-header">
          <h2>Sign in with Google</h2>
          <button class="close-auth-btn" tabindex="1">×</button>
        </div>
        <div class="auth-content">
          <p>Please sign in to continue...</p>
        </div>
      </div>
    `;
    
    // Add styles
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
    
    // Add container styles
    const container = overlay.querySelector('.auth-container');
    container.style.cssText = `
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 800px;
      height: 80%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // Add header styles  
    const header = overlay.querySelector('.auth-header');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
      background: #f8f9fa;
    `;
    
    // Add close button styles
    const closeBtn = overlay.querySelector('.close-auth-btn');
    closeBtn.style.cssText = `
      background: #666;
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      cursor: pointer;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
    `;
    
    // Add content styles
    const content = overlay.querySelector('.auth-content');
    content.style.cssText = `
      flex: 1;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    `;
    
    return overlay;
  }

  createAuthIframe() {
    const iframe = document.createElement('iframe');
    
    // Build Google OAuth URL for WebView
    const authUrl = this.buildGoogleAuthURL();
    
    iframe.src = authUrl;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 8px;
    `;
    
    // Set up iframe load handler
    iframe.onload = () => {
      console.log('🔥 Auth iframe loaded');
      this.setupIframeMessageBridge(iframe);
    };
    
    return iframe;
  }

  buildGoogleAuthURL() {
    const baseUrl = 'https://accounts.google.com/oauth/v2/auth';
    const redirectUri = `${window.location.origin}/auth-callback.html`;
    
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: this.config.scope,
      include_granted_scopes: 'true',
      state: 'fire_tv_auth'
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  setupIframeMessageBridge(iframe) {
    // Create auth callback page content
    const callbackHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px;
            background: #f0f0f0;
          }
          .success { color: #4caf50; }
          .error { color: #f44336; }
        </style>
      </head>
      <body>
        <div id="status">Processing authentication...</div>
        <script>
          // Parse authentication result from URL
          function parseAuthResult() {
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            
            if (params.get('access_token')) {
              // Success - get user info
              const accessToken = params.get('access_token');
              getUserInfo(accessToken);
            } else if (params.get('error')) {
              // Error occurred
              const error = params.get('error') || 'Authentication failed';
              document.getElementById('status').innerHTML = 
                '<div class="error">Authentication failed: ' + error + '</div>';
              
              window.parent.postMessage({
                type: 'FIRE_TV_AUTH_ERROR',
                error: error
              }, '*');
            }
          }
          
          // Get user information from Google API
          async function getUserInfo(accessToken) {
            try {
              const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                  'Authorization': 'Bearer ' + accessToken
                }
              });
              
              if (response.ok) {
                const userInfo = await response.json();
                
                document.getElementById('status').innerHTML = 
                  '<div class="success">Authentication successful!</div>';
                
                // Send user data to parent
                window.parent.postMessage({
                  type: 'FIRE_TV_AUTH_SUCCESS',
                  user: {
                    id: userInfo.id,
                    name: userInfo.name,
                    email: userInfo.email,
                    picture: userInfo.picture,
                    authMethod: 'fire_tv_webview'
                  }
                }, '*');
              } else {
                throw new Error('Failed to get user info');
              }
            } catch (error) {
              document.getElementById('status').innerHTML = 
                '<div class="error">Failed to get user information</div>';
              
              window.parent.postMessage({
                type: 'FIRE_TV_AUTH_ERROR',
                error: 'Failed to get user information'
              }, '*');
            }
          }
          
          // Start processing when page loads
          window.onload = parseAuthResult;
        </script>
      </body>
      </html>
    `;
    
    // Create the callback page as a blob URL
    const blob = new Blob([callbackHTML], { type: 'text/html' });
    const callbackUrl = URL.createObjectURL(blob);
    
    // This is a simplified approach - in production you'd want to host this file
    console.log('🔥 Auth callback page ready');
  }

  setupFireTVAuthNavigation(overlay) {
    const closeBtn = overlay.querySelector('.close-auth-btn');
    
    // Auto-focus close button for Fire TV
    setTimeout(() => {
      closeBtn.focus();
    }, 500);
    
    // D-pad navigation
    const handleAuthKey = (e) => {
      if (e.keyCode === 4 || e.key === 'Escape') { // Back button
        e.preventDefault();
        closeBtn.click();
      } else if (e.keyCode === 13 || e.keyCode === 23) { // Enter/Center
        if (document.activeElement === closeBtn) {
          closeBtn.click();
        }
      }
    };
    
    overlay.addEventListener('keydown', handleAuthKey);
    
    // Focus styling for Fire TV
    closeBtn.addEventListener('focus', () => {
      closeBtn.style.outline = '3px solid #ffaa00';
      closeBtn.style.transform = 'scale(1.1)';
    });
    
    closeBtn.addEventListener('blur', () => {
      closeBtn.style.outline = 'none';
      closeBtn.style.transform = 'scale(1)';
    });
  }
}

// Alternative simple approach - just redirect to web auth
export class SimpleFireTVAuth {
  constructor() {
    this.config = {
      client_id: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com'
    };
  }

  // Show a simple option to continue without Google auth on Fire TV
  showFireTVFallback() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.innerHTML = `
        <div style="
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
        ">
          <div style="
            background: #FCFCFF;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            text-align: center;
            color: #424242;
          ">
            <img src="icons/Dashie_Full_Logo_Orange_Transparent.png" alt="Dashie" style="width: 150px; margin-bottom: 20px;">
            
            <h2 style="margin: 0 0 10px 0;">Fire TV Detected</h2>
            <p style="color: #616161; margin-bottom: 30px;">
              Google Sign-In is not fully supported on Fire TV devices. 
              You can continue with a temporary account.
            </p>
            
            <button id="continue-fire-tv" style="
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              width: 100%;
              padding: 16px 24px;
              background: #1a73e8;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 18px;
              font-weight: 500;
              cursor: pointer;
              margin-bottom: 15px;
              outline: none;
            ">
              Continue to Dashie
            </button>
            
            <p style="color: #9e9e9e; font-size: 14px; margin: 0;">
              Your data will be saved locally on this device
            </p>
          </div>
        </div>
      `;
      
      document.body.appendChild(overlay);
      
      const continueBtn = overlay.querySelector('#continue-fire-tv');
      
      // Fire TV focus styling
      continueBtn.addEventListener('focus', () => {
        continueBtn.style.outline = '3px solid #ffaa00';
        continueBtn.style.transform = 'scale(1.02)';
      });
      
      continueBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve({
          success: true,
          user: {
            id: 'fire-tv-user-' + Date.now(),
            name: 'Fire TV User',
            email: 'user@firetv.dashie.app',
            picture: 'icons/icon-profile-round.svg',
            authMethod: 'fire_tv_fallback'
          }
        });
      });
      
      // Auto-focus and keyboard handling
      setTimeout(() => continueBtn.focus(), 200);
      
      overlay.addEventListener('keydown', (e) => {
        if (e.keyCode === 13 || e.keyCode === 23) { // Enter
          e.preventDefault();
          continueBtn.click();
        }
      });
    });
  }
}
