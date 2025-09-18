// js/auth/cognito-auth.js
// CHANGE SUMMARY: Simplified for direct Google federation via Identity Pool (no User Pool needed)

import { COGNITO_CONFIG, AMPLIFY_CONFIG } from './cognito-config.js';

export class CognitoAuth {
  constructor() {
    this.amplify = null;
    this.currentUser = null;
    this.isInitialized = false;
    this.googleAccessToken = null;
    this.identityPoolCredentials = null;
  }

  async init() {
    console.log('🔐 Initializing Direct Google Federation via Identity Pool...');
    console.log('🔐 🆔 Identity Pool ID:', COGNITO_CONFIG.identityPoolId);
    
    try {
      await this.waitForAmplify();
      this.configureAmplify();

      // Check for existing session
      const existingUser = await this.getCurrentSession();
      if (existingUser) {
        console.log('🔐 ✅ Found existing Google session:', existingUser.email);
        this.isInitialized = true;
        return { success: true, user: existingUser };
      }

      this.isInitialized = true;
      return { success: false, reason: 'no_existing_auth' };
    } catch (error) {
      console.error('🔐 ❌ Cognito initialization failed:', error);
      this.isInitialized = true;
      return { success: false, error: error.message };
    }
  }

  async waitForAmplify(maxAttempts = 50) {
    for (let i = 0; i < maxAttempts; i++) {
      if (window.aws && window.aws.amplifyAuth) {
        const auth = window.aws.amplifyAuth;
        if (auth.Amplify && auth.Auth) {
          this.amplify = auth;
          console.log('🔐 ✅ Amplify loaded');
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Amplify failed to load');
  }

  configureAmplify() {
    if (this.amplify.Amplify && typeof this.amplify.Amplify.configure === 'function') {
      console.log('🔐 🆔 Configuring Amplify for direct Google federation...');
      
      // Simplified config for direct Google federation - remove User Pool settings
      const directGoogleConfig = {
        Auth: {
          region: COGNITO_CONFIG.region,
          identityPoolId: COGNITO_CONFIG.identityPoolId,
          // No User Pool settings needed for direct federation
          mandatorySignIn: false
        }
      };
      
      console.log('🔐 🆔 📋 Using simplified config:', {
        region: directGoogleConfig.Auth.region,
        identityPoolId: directGoogleConfig.Auth.identityPoolId,
        mandatorySignIn: directGoogleConfig.Auth.mandatorySignIn
      });
      
      this.amplify.Amplify.configure(directGoogleConfig);
      console.log('🔐 ✅ Amplify configured for direct Google federation');
    } else {
      throw new Error('Amplify.configure not found');
    }
  }

  async getCurrentSession() {
    try {
      console.log('🔐 🔄 Checking for existing Google session...');
      
      // Try to get credentials - this will fail if not authenticated
      const credentials = await this.amplify.Auth.currentCredentials();
      
      console.log('🔐 📋 Credentials check:', {
        authenticated: credentials.authenticated,
        identityId: credentials.identityId,
        hasParams: !!credentials.params,
        hasLogins: !!(credentials.params && credentials.params.Logins),
        paramsKeys: credentials.params ? Object.keys(credentials.params) : [],
        loginKeys: credentials.params?.Logins ? Object.keys(credentials.params.Logins) : []
      });
      
      if (credentials.authenticated && credentials.params && credentials.params.Logins) {
        const loginProviders = Object.keys(credentials.params.Logins);
        console.log('🔐 📋 Available login providers:', loginProviders);
        
        const googleToken = credentials.params.Logins['accounts.google.com'];
        
        if (googleToken) {
          console.log('🔐 ✅ Found existing Google token!');
          console.log('🔐 📋 Token length:', googleToken.length);
          
          // Create user data from Google token
          const userData = await this.buildUserDataFromGoogleToken(googleToken, credentials);
          this.currentUser = userData;
          this.saveUserToStorage(userData);
          
          return userData;
        } else {
          console.log('🔐 ❌ No Google token found in login providers');
        }
      } else {
        console.log('🔐 ❌ Missing authentication data:', {
          authenticated: credentials.authenticated,
          hasParams: !!credentials.params,
          hasLogins: !!(credentials.params && credentials.params.Logins)
        });
      }
      
      console.log('🔐 ⚠️ No existing Google session found');
      return null;
      
    } catch (error) {
      // This error is expected if user is not authenticated
      if (error.message.includes('Unauthenticated access is not supported')) {
        console.log('🔐 ℹ️ No existing session - user needs to authenticate');
        return null;
      } else {
        console.log('🔐 ⚠️ Session check error:', error.message);
        return null;
      }
    }
  }

  async buildUserDataFromGoogleToken(googleToken, credentials) {
    console.log('🔐 📝 Building user data from Google token...');
    
    try {
      // Get user info from Google using the access token
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${googleToken}`
        }
      });
      
      if (!userInfoResponse.ok) {
        throw new Error(`Google userinfo failed: ${userInfoResponse.status}`);
      }
      
      const userInfo = await userInfoResponse.json();
      console.log('🔐 📋 Google user info:', {
        email: userInfo.email,
        name: userInfo.name,
        picture: !!userInfo.picture
      });
      
      // Store the Google token
      this.googleAccessToken = googleToken;
      this.identityPoolCredentials = credentials;
      
      const userData = {
        id: credentials.identityId,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        username: userInfo.email,
        sub: userInfo.id,
        authMethod: 'cognito_identity_pool',
        provider: 'google',
        googleAccessToken: googleToken,
        awsCredentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
          identityId: credentials.identityId
        },
        savedAt: Date.now(),
        lastSignIn: Date.now()
      };
      
      console.log('🔐 📝 ✅ User data built successfully:', {
        email: userData.email,
        name: userData.name,
        hasGoogleToken: !!userData.googleAccessToken,
        hasAwsCredentials: !!userData.awsCredentials,
        identityId: userData.awsCredentials.identityId
      });
      
      return userData;
      
    } catch (error) {
      console.error('🔐 📝 ❌ Failed to build user data:', error);
      throw error;
    }
  }

  async refreshSession() {
    console.log('🔐 🔄 Refreshing Google session via Identity Pool...');
    
    try {
      // Clear any cached credentials to force refresh
      await this.amplify.Auth.clearCachedId();
      
      // Get fresh credentials - Cognito will automatically refresh Google token if needed
      const credentials = await this.amplify.Auth.currentCredentials();
      
      if (credentials.authenticated && credentials.params && credentials.params.Logins) {
        const googleToken = credentials.params.Logins['accounts.google.com'];
        
        if (googleToken) {
          console.log('🔐 🔄 ✅ Google token refreshed successfully');
          
          const userData = await this.buildUserDataFromGoogleToken(googleToken, credentials);
          this.currentUser = userData;
          this.saveUserToStorage(userData);
          
          return true;
        }
      }
      
      throw new Error('No Google token after refresh');
      
    } catch (error) {
      console.error('🔐 🔄 ❌ Session refresh failed:', error);
      return false;
    }
  }

  saveUserToStorage(userData) {
    localStorage.setItem(COGNITO_CONFIG.storage.userDataKey, JSON.stringify(userData));
    console.log('🔐 ✅ User data saved to localStorage');
  }

  async signIn() {
    console.log('🔐 🔄 Starting Google sign-in via Identity Pool...');
    
    try {
      // Sign in directly with Google via Identity Pool
      await this.amplify.Auth.federatedSignIn({ 
        provider: 'Google'
      });
      
      console.log('🔐 ✅ Google sign-in initiated - user will be redirected');
      
    } catch (error) {
      console.error('🔐 ❌ Google sign-in failed:', error);
      throw error;
    }
  }

  async signOut() {
    console.log('🔐 🔄 Signing out from Google...');
    
    try {
      await this.amplify.Auth.signOut();
      
      // Clear local state
      this.currentUser = null;
      this.googleAccessToken = null;
      this.identityPoolCredentials = null;
      
      // Clear localStorage
      localStorage.removeItem(COGNITO_CONFIG.storage.userDataKey);
      
      console.log('🔐 ✅ Signed out successfully');
      
    } catch (error) {
      console.error('🔐 ❌ Sign out failed:', error);
      // Still clear local state even if remote sign-out fails
      this.currentUser = null;
      this.googleAccessToken = null;
      this.identityPoolCredentials = null;
      localStorage.removeItem(COGNITO_CONFIG.storage.userDataKey);
    }
  }

  getUser() { return this.currentUser; }
  isAuthenticated() { return !!this.currentUser; }
  getGoogleAccessToken() { return this.googleAccessToken; }
  getAwsCredentials() { return this.currentUser?.awsCredentials || null; }
}
