// js/auth/cognito-auth.js
// CHANGE SUMMARY: Implemented Identity Pool integration with Auth.currentCredentials() to extract Google tokens for API access

import { COGNITO_CONFIG, AMPLIFY_CONFIG } from './cognito-config.js';

export class CognitoAuth {
  constructor() {
    this.amplify = null;
    this.currentUser = null;
    this.isInitialized = false;
    this.googleAccessToken = null;
    this.cognitoTokens = null;
    this.identityPoolCredentials = null;
  }

  async init() {
    console.log('🔐 Initializing Cognito authentication with Identity Pool...');
    try {
      await this.waitForAmplify();
      this.configureAmplify();

      const callbackResult = await this.handleOAuthCallback();
      if (callbackResult.success) {
        console.log('🔐 ✅ OAuth callback handled successfully');
        this.isInitialized = true;
        return callbackResult;
      }

      const existingUser = await this.getCurrentSession();
      if (existingUser) {
        console.log('🔐 ✅ Found existing Cognito session:', existingUser.email);
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
      this.amplify.Amplify.configure(AMPLIFY_CONFIG);
      console.log('🔐 ✅ Amplify configured');
    } else {
      throw new Error('Amplify.configure not found');
    }
  }

  async handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    if (!authCode) return { success: false, wasCallback: false };

    try {
      const user = await this.waitForAuthenticatedUser(10000);
      if (!user) throw new Error('No authenticated user after callback');

      const session = await this.amplify.Auth.currentSession();
      const userData = await this.formatUserDataWithIdentityPool(user, session);
      this.currentUser = userData;
      this.saveUserToStorage(userData);
      this.cleanupCallbackUrl();

      console.log('🔐 ✅ OAuth callback processed:', userData.email);
      return { success: true, user: userData, wasCallback: true };
    } catch (error) {
      console.error('🔐 ❌ OAuth callback failed:', error);
      this.cleanupCallbackUrl();
      return { success: false, error: error.message, wasCallback: true };
    }
  }

  async waitForAuthenticatedUser(timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const user = await this.amplify.Auth.currentAuthenticatedUser();
        if (user) return user;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return null;
  }

  async getCurrentSession() {
    try {
      const user = await this.amplify.Auth.currentAuthenticatedUser();
      const session = await this.amplify.Auth.currentSession();
      if (!user || !session) return null;

      const userData = await this.formatUserDataWithIdentityPool(user, session);
      this.currentUser = userData;
      this.saveUserToStorage(userData);
      return userData;
    } catch {
      return null;
    }
  }

  // NEW: Get Identity Pool credentials to extract Google token
  async getIdentityPoolCredentials() {
    console.log('🔐 🆔 Getting Identity Pool credentials...');
    
    try {
      // Get credentials from Identity Pool
      const credentials = await this.amplify.Auth.currentCredentials();
      
      console.log('🔐 🆔 ✅ Identity Pool credentials retrieved');
      console.log('🔐 🆔 📋 Credentials object keys:', Object.keys(credentials || {}));
      
      // Debug: Log the full credentials structure (safely)
      if (credentials) {
        console.log('🔐 🆔 📋 Credentials.authenticated:', credentials.authenticated);
        console.log('🔐 🆔 📋 Credentials.identityId:', credentials.identityId);
        
        // Check for Google token in params.Logins
        if (credentials.params && credentials.params.Logins) {
          console.log('🔐 🆔 📋 Available login providers:', Object.keys(credentials.params.Logins));
          
          const googleToken = credentials.params.Logins['accounts.google.com'];
          if (googleToken) {
            console.log('🔐 🆔 ✅ Google token found in Identity Pool credentials!');
            console.log('🔐 🆔 📋 Google token length:', googleToken.length);
            console.log('🔐 🆔 📋 Google token preview:', googleToken.substring(0, 20) + '...');
            return { success: true, googleToken, credentials };
          } else {
            console.log('🔐 🆔 ❌ No Google token found in accounts.google.com login');
          }
        } else {
          console.log('🔐 🆔 ❌ No params.Logins found in credentials');
        }
        
        // Debug: Check other possible locations for the token
        console.log('🔐 🆔 📋 Full credentials structure:');
        console.log('🔐 🆔 📋 - accessKeyId present:', !!credentials.accessKeyId);
        console.log('🔐 🆔 📋 - secretAccessKey present:', !!credentials.secretAccessKey);
        console.log('🔐 🆔 📋 - sessionToken present:', !!credentials.sessionToken);
      }
      
      return { success: false, error: 'Google token not found in Identity Pool credentials' };
      
    } catch (error) {
      console.error('🔐 🆔 ❌ Failed to get Identity Pool credentials:', error);
      return { success: false, error: error.message };
    }
  }

  // ENHANCED: Format user data using both User Pool and Identity Pool
  async formatUserDataWithIdentityPool(cognitoUser, session) {
    console.log('🔐 📝 Formatting user data with Identity Pool integration...');
    
    const idPayload = session.getIdToken().payload || {};
    let googleToken = null;

    // Method 1: Try to get Google token from Identity Pool (preferred)
    console.log('🔐 📝 🔄 Attempting to get Google token from Identity Pool...');
    const identityPoolResult = await this.getIdentityPoolCredentials();
    
    if (identityPoolResult.success) {
      googleToken = identityPoolResult.googleToken;
      this.identityPoolCredentials = identityPoolResult.credentials;
      console.log('🔐 📝 ✅ Using Google token from Identity Pool');
    } else {
      console.log('🔐 📝 ⚠️ Identity Pool method failed, trying fallback...');
      
      // Method 2: Fallback to ID token identities (existing method)
      try {
        if (idPayload.identities && Array.isArray(idPayload.identities)) {
          console.log('🔐 📝 🔄 Checking ID token identities for Google token...');
          const googleIdentity = idPayload.identities.find(i => i.providerName === 'Google');
          if (googleIdentity && googleIdentity.access_token) {
            googleToken = googleIdentity.access_token;
            console.log('🔐 📝 ✅ Using Google token from ID token identities (fallback)');
          }
        }
      } catch (fallbackError) {
        console.log('🔐 📝 ❌ Fallback method also failed:', fallbackError.message);
      }
    }

    // Store the token
    this.googleAccessToken = googleToken;

    // Log final token status
    if (googleToken) {
      console.log('🔐 📝 ✅ Google access token successfully retrieved!');
      console.log('🔐 📝 📋 Token length:', googleToken.length);
      console.log('🔐 📝 📋 Token preview:', googleToken.substring(0, 20) + '...');
    } else {
      console.log('🔐 📝 ❌ No Google access token available - API calls will fail');
    }

    // Build user data object
    const userData = {
      id: cognitoUser.username,
      email: idPayload.email || cognitoUser.attributes?.email,
      name: idPayload.name || cognitoUser.attributes?.name || idPayload.email,
      picture: idPayload.picture || cognitoUser.attributes?.picture,
      given_name: idPayload.given_name || cognitoUser.attributes?.given_name,
      family_name: idPayload.family_name || cognitoUser.attributes?.family_name,
      username: cognitoUser.username,
      sub: idPayload.sub,
      authMethod: 'cognito',
      provider: 'google',
      googleAccessToken: googleToken,
      cognitoTokens: {
        idToken: session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
        refreshToken: session.getRefreshToken().getToken()
      },
      identityPoolId: this.identityPoolCredentials?.identityId || null,
      savedAt: Date.now(),
      lastSignIn: Date.now()
    };

    console.log('🔐 📝 ✅ User data formatted:', {
      email: userData.email,
      name: userData.name,
      hasGoogleToken: !!userData.googleAccessToken,
      hasIdentityPoolId: !!userData.identityPoolId,
      tokenSource: googleToken ? (identityPoolResult.success ? 'Identity Pool' : 'ID Token') : 'None'
    });

    return userData;
  }

  // NEW: Refresh session and get updated Google token
  async refreshSession() {
    console.log('🔐 🔄 Refreshing Cognito session and Google token...');
    
    try {
      // Refresh the Cognito session
      const user = await this.amplify.Auth.currentAuthenticatedUser();
      const session = await this.amplify.Auth.currentSession();
      
      if (!user || !session) {
        throw new Error('No valid session to refresh');
      }

      // Get updated user data with fresh tokens
      const userData = await this.formatUserDataWithIdentityPool(user, session);
      this.currentUser = userData;
      this.saveUserToStorage(userData);

      console.log('🔐 🔄 ✅ Session refreshed successfully');
      return true;
      
    } catch (error) {
      console.error('🔐 🔄 ❌ Session refresh failed:', error);
      return false;
    }
  }

  saveUserToStorage(userData) {
    localStorage.setItem(COGNITO_CONFIG.storage.userDataKey, JSON.stringify(userData));
    console.log('🔐 ✅ User data saved');
  }

  cleanupCallbackUrl() {
    const cleanUrl = window.location.origin + window.location.pathname.replace('/oauth2/idpresponse', '');
    window.history.replaceState({}, document.title, cleanUrl || '/');
  }

  async signIn() {
    await this.amplify.Auth.federatedSignIn({ provider: 'Google' });
  }

  async signOut() {
    await this.amplify.Auth.signOut({ global: true });
    this.currentUser = null;
    this.googleAccessToken = null;
    this.cognitoTokens = null;
    this.identityPoolCredentials = null;
    localStorage.removeItem(COGNITO_CONFIG.storage.userDataKey);
    console.log('🔐 ✅ Signed out');
  }

  getUser() { return this.currentUser; }
  isAuthenticated() { return !!this.currentUser; }
  getGoogleAccessToken() { return this.googleAccessToken; }
  getCognitoTokens() { return this.currentUser?.cognitoTokens || null; }
}
