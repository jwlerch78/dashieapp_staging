// js/auth/cognito-auth.js
// updated per chatgpt input 

import { Amplify, Auth } from 'aws-amplify';
import { AMPLIFY_CONFIG, COGNITO_CONFIG } from './cognito-config.js';

// Configure Amplify once at import time
Amplify.configure(AMPLIFY_CONFIG);

export class CognitoAuth {
  constructor() {
    this.currentUser = null;
    this.googleAccessToken = null;
    this.cognitoTokens = null;
  }

  async init() {
    console.log('🔐 Initializing AWS Cognito authentication...');

    try {
      // Check for existing session
      const existingUser = await this.getCurrentSession();
      if (existingUser) {
        console.log('🔐 ✅ Found existing Cognito session:', existingUser.username);
        this.currentUser = existingUser;
        return { success: true, user: existingUser };
      }

      // Handle OAuth callback if we’re on the callback URL
      const callbackResult = await this.handleOAuthCallback();
      if (callbackResult.success) {
        console.log('🔐 ✅ OAuth callback handled successfully');
        return callbackResult;
      }

      console.log('🔐 No existing authentication found');
      return { success: false, reason: 'no_existing_auth' };
    } catch (error) {
      console.error('🔐 ❌ Cognito initialization failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getCurrentSession() {
    try {
      const user = await Auth.currentAuthenticatedUser();
      if (user) {
        const session = await Auth.currentSession();
        this.cognitoTokens = {
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken()
        };

        await this.extractGoogleAccessToken(session);

        const userData = this.formatUserData(user);
        this.currentUser = userData;
        this.saveUserToStorage(userData);

        return userData;
      }
    } catch (error) {
      if (error.message !== 'The user is not authenticated') {
        console.error('🔐 Error getting current session:', error);
      }
    }
    return null;
  }

  async handleOAuthCallback() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const authCode = urlParams.get('code');

      if (!authCode) {
        return { success: false, reason: 'no_callback' };
      }

      console.log('🔐 Processing OAuth callback...');

      // After redirect, Amplify automatically processes the code → tokens
      const user = await Auth.currentAuthenticatedUser();
      if (user) {
        const session = await Auth.currentSession();
        this.cognitoTokens = {
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken()
        };

        await this.extractGoogleAccessToken(session);

        const userData = this.formatUserData(user);
        this.currentUser = userData;
        this.saveUserToStorage(userData);

        this.cleanupCallbackUrl();

        console.log('🔐 ✅ OAuth callback processed successfully');
        return { success: true, user: userData };
      }
    } catch (error) {
      console.error('🔐 ❌ OAuth callback handling failed:', error);
      return { success: false, error: error.message };
    }

    return { success: false, reason: 'callback_processing_failed' };
  }

  async extractGoogleAccessToken(session) {
    try {
      const credentials = await Auth.currentCredentials();
      if (credentials && credentials.params && credentials.params.google_access_token) {
        this.googleAccessToken = credentials.params.google_access_token;
        console.log('🔐 ✅ Google access token extracted from Cognito');
      } else {
        console.warn('🔐 ⚠️ Google access token not available in credentials');
        const idToken = session.getIdToken();
        const payload = idToken.payload;
        if (payload && payload.identities) {
          const googleIdentity = payload.identities.find(id => id.providerName === 'Google');
          if (googleIdentity && googleIdentity.access_token) {
            this.googleAccessToken = googleIdentity.access_token;
            console.log('🔐 ✅ Google access token extracted from ID token');
          }
        }
      }
    } catch (error) {
      console.error('🔐 ❌ Failed to extract Google access token:', error);
    }
  }

  formatUserData(cognitoUser) {
    const attributes = cognitoUser.attributes || {};
    return {
      id: cognitoUser.username,
      email: attributes.email,
      name: attributes.name || attributes.email,
      picture: attributes.picture,
      given_name: attributes.given_name,
      family_name: attributes.family_name,
      username: cognitoUser.username,
      sub: attributes.sub,
      authMethod: 'cognito',
      provider: 'google',
      googleAccessToken: this.googleAccessToken,
      cognitoTokens: this.cognitoTokens,
      savedAt: Date.now(),
      lastSignIn: Date.now()
    };
  }

  saveUserToStorage(userData) {
    try {
      localStorage.setItem(COGNITO_CONFIG.storage.userDataKey, JSON.stringify(userData));
      console.log('🔐 ✅ User data saved to localStorage');
    } catch (error) {
      console.error('🔐 ❌ Failed to save user data:', error);
    }
  }

  getSavedUser() {
    try {
      const saved = localStorage.getItem(COGNITO_CONFIG.storage.userDataKey);
      if (saved) {
        const userData = JSON.parse(saved);
        if (userData.savedAt && (Date.now() - userData.savedAt < 30 * 24 * 60 * 60 * 1000)) {
          return userData;
        }
      }
    } catch (error) {
      console.error('🔐 ❌ Failed to get saved user:', error);
    }
    return null;
  }

  cleanupCallbackUrl() {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  async signIn() {
    try {
      console.log('🔐 Starting Cognito sign-in...');
      await Auth.federatedSignIn({ provider: 'Google' });
    } catch (error) {
      console.error('🔐 ❌ Sign-in failed:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      console.log('🔐 Signing out from Cognito...');
      await Auth.signOut({ global: true });

      this.currentUser = null;
      this.googleAccessToken = null;
      this.cognitoTokens = null;

      localStorage.removeItem(COGNITO_CONFIG.storage.userDataKey);
      localStorage.removeItem(COGNITO_CONFIG.storage.sessionKey);

      console.log('🔐 ✅ Sign-out completed');
    } catch (error) {
      console.error('🔐 ❌ Sign-out failed:', error);
      throw error;
    }
  }

  getUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getGoogleAccessToken() {
    return this.googleAccessToken;
  }

  getCognitoTokens() {
    return this.cognitoTokens;
  }

  async refreshSession() {
    try {
      const session = await Auth.currentSession();
      this.cognitoTokens = {
        idToken: session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
        refreshToken: session.getRefreshToken().getToken()
      };
      await this.extractGoogleAccessToken(session);

      if (this.currentUser) {
        this.currentUser.cognitoTokens = this.cognitoTokens;
        this.currentUser.googleAccessToken = this.googleAccessToken;
        this.saveUserToStorage(this.currentUser);
      }

      console.log('🔐 ✅ Session refreshed successfully');
      return true;
    } catch (error) {
      console.error('🔐 ❌ Session refresh failed:', error);
      return false;
    }
  }
}
