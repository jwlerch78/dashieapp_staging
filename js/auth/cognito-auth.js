// js/auth/cognito-auth.js
// UPDATED for AWS Amplify v6 modular ESM (no Auth object, use named exports)

import { Amplify } from 'https://cdn.jsdelivr.net/npm/aws-amplify@6.0.21/+esm';
import {
  signIn,
  signOut,
  currentAuthenticatedUser,
  currentSession,
  federatedSignIn,
  currentCredentials
} from 'https://cdn.jsdelivr.net/npm/@aws-amplify/auth@6.0.21/+esm';

import { AMPLIFY_CONFIG, COGNITO_CONFIG } from './cognito-config.js';

// Configure Amplify once
Amplify.configure(AMPLIFY_CONFIG);

export class CognitoAuth {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.googleAccessToken = null;
    this.cognitoTokens = null;
  }

  async init() {
    console.log('🔐 Initializing AWS Cognito authentication...');
    try {
      const existingUser = await this.getCurrentSession();
      if (existingUser) {
        console.log('🔐 ✅ Found existing Cognito session:', existingUser.username);
        this.currentUser = existingUser;
        this.isInitialized = true;
        return { success: true, user: existingUser };
      }

      const callbackResult = await this.handleOAuthCallback();
      if (callbackResult.success) {
        console.log('🔐 ✅ OAuth callback handled successfully');
        this.isInitialized = true;
        return callbackResult;
      }

      console.log('🔐 No existing authentication found');
      this.isInitialized = true;
      return { success: false, reason: 'no_existing_auth' };
    } catch (error) {
      console.error('🔐 ❌ Cognito initialization failed:', error);
      this.isInitialized = true;
      return { success: false, error: error.message };
    }
  }

  async getCurrentSession() {
    try {
      const user = await currentAuthenticatedUser();
      if (user) {
        const session = await currentSession();
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

      if (!authCode) return { success: false, reason: 'no_callback' };

      console.log('🔐 Processing OAuth callback...');
      const user = await currentAuthenticatedUser();

      if (user) {
        const session = await currentSession();
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
      const credentials = await currentCredentials();

      if (credentials?.params?.google_access_token) {
        this.googleAccessToken = credentials.params.google_access_token;
        console.log('🔐 ✅ Google access token extracted from Cognito');
      } else {
        console.warn('🔐 ⚠️ Google access token not available in credentials');
        const idToken = session.getIdToken();
        const payload = idToken.payload;
        if (payload?.identities) {
          const googleIdentity = payload.identities.find(id => id.providerName === 'Google');
          if (googleIdentity?.access_token) {
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
        if (userData.savedAt && Date.now() - userData.savedAt < 30 * 24 * 60 * 60 * 1000) {
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
      await federatedSignIn({ provider: 'Google' });
    } catch (error) {
      console.error('🔐 ❌ Sign-in failed:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      console.log('🔐 Signing out from Cognito...');
      await signOut({ global: true });
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

  async refreshSession() {
    try {
      const session = await currentSession();
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
