// js/auth/cognito-auth.js
// CHANGE SUMMARY: Added detailed token debugging to diagnose Identity Pool authentication provider mismatch

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
    console.log('🔐 🆔 Identity Pool ID:', COGNITO_CONFIG.identityPoolId);
    console.log('🔐 🆔 User Pool ID:', COGNITO_CONFIG.userPoolId);
    
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
      console.log('🔐 🆔 Configuring Amplify with Identity Pool...');
      
      // Log the exact configuration being used
      console.log('🔐 🆔 📋 Amplify configuration:', {
        region: AMPLIFY_CONFIG.Auth.region,
        userPoolId: AMPLIFY_CONFIG.Auth.userPoolId,
        userPoolWebClientId: AMPLIFY_CONFIG.Auth.userPoolWebClientId,
        identityPoolId: AMPLIFY_CONFIG.Auth.identityPoolId
      });
      
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

  // ENHANCED: Debug what tokens we're sending to Identity Pool
  async getIdentityPoolCredentials() {
    console.log('🔐 🆔 Getting Identity Pool credentials with detailed debugging...');
    
    try {
      // First, verify our current authentication state
      const user = await this.amplify.Auth.currentAuthenticatedUser();
      if (!user) {
        throw new Error('No authenticated user available');
      }
      
      console.log('🔐 🆔 📋 Current user details:', {
        username: user.username,
        pool: user.pool?.userPoolId,
        clientId: user.pool?.clientId
      });
      
      // Get the current session and examine the tokens
      const session = await this.amplify.Auth.currentSession();
      if (!session || !session.isValid()) {
        throw new Error('Invalid or expired session');
      }
      
      const idToken = session.getIdToken();
      const idPayload = idToken.payload;
      
      console.log('🔐 🆔 📋 ID Token details:', {
        issuer: idPayload.iss,
        audience: idPayload.aud,
        tokenUse: idPayload.token_use,
        identities: idPayload.identities?.length || 0,
        hasGoogleIdentity: idPayload.identities?.some(i => i.providerName === 'Google') || false
      });
      
      // Check if the issuer matches what Identity Pool expects
      const expectedIssuer = `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/${COGNITO_CONFIG.userPoolId}`;
      console.log('🔐 🆔 📋 Expected issuer:', expectedIssuer);
      console.log('🔐 🆔 📋 Actual issuer:', idPayload.iss);
      console.log('🔐 🆔 📋 Issuer match:', idPayload.iss === expectedIssuer);
      
      // Log the exact configuration that will be used for the Identity Pool call
      console.log('🔐 🆔 📋 About to call currentCredentials() with:');
      console.log('🔐 🆔 📋 - Identity Pool ID:', COGNITO_CONFIG.identityPoolId);
      console.log('🔐 🆔 📋 - User Pool ID:', COGNITO_CONFIG.userPoolId);
      console.log('🔐 🆔 📋 - Client ID:', COGNITO_CONFIG.userPoolWebClientId);
      
      // Now try to get the credentials - this is where the error occurs
      console.log('🔐 🆔 🔄 Calling Auth.currentCredentials()...');
      const credentials = await this.amplify.Auth.currentCredentials();
      
      console.log('🔐 🆔 ✅ Credentials retrieved successfully!');
      console.log('🔐 🆔 📋 Credentials details:', {
        authenticated: credentials.authenticated,
        identityId: credentials.identityId,
        hasParams: !!credentials.params,
        hasLogins: !!(credentials.params && credentials.params.Logins)
      });
      
      // Check for Google token
      if (credentials.params && credentials.params.Logins) {
        const loginProviders = Object.keys(credentials.params.Logins);
        console.log('🔐 🆔 📋 Login providers found:', loginProviders);
        
        const googleToken = credentials.params.Logins['accounts.google.com'];
        if (googleToken) {
          console.log('🔐 🆔 ✅ Google token found!');
          console.log('🔐 🆔 📋 Token length:', googleToken.length);
          console.log('🔐 🆔 📋 Token preview:', googleToken.substring(0, 30) + '...');
          return { success: true, googleToken, credentials };
        } else {
          console.log('🔐 🆔 ❌ No Google token in login providers');
        }
      }
      
      return { success: false, error: 'No Google token found', credentials };
      
    } catch (error) {
      console.error('🔐 🆔 ❌ Identity Pool credentials failed:', error);
      
      // Enhanced error analysis
      if (error.message.includes('Invalid login token')) {
        console.error('🔐 🆔 💡 DIAGNOSIS: Token validation failed');
        console.error('🔐 🆔 💡 Possible causes:');
        console.error('🔐 🆔 💡 1. Identity Pool authentication provider misconfigured');
        console.error('🔐 🆔 💡 2. User Pool ID mismatch in Identity Pool settings');
        console.error('🔐 🆔 💡 3. App Client ID mismatch in Identity Pool settings');
        console.error('🔐 🆔 💡 4. Token issuer not matching expected format');
        console.error('🔐 🆔 💡 5. AWS configuration propagation delay');
        
        console.error('🔐 🆔 💡 RECOMMENDED ACTIONS:');
        console.error('🔐 🆔 💡 1. Verify User Pool ID in Identity Pool: us-east-2_nbo8y8lm');
        console.error('🔐 🆔 💡 2. Verify App Client ID in Identity Pool: 6is70fls6vp2i511k93ltgs66h');
        console.error('🔐 🆔 💡 3. Wait 5-10 minutes for AWS propagation');
        console.error('🔐 🆔 💡 4. Try clearing browser cache and re-authenticating');
      }
      
      return { success: false, error: error.message };
    }
  }

  // Format user data with comprehensive debugging
  async formatUserDataWithIdentityPool(cognitoUser, session) {
    console.log('🔐 📝 Formatting user data with Identity Pool integration...');
    
    const idPayload = session.getIdToken().payload || {};
    let googleToken = null;
    let tokenSource = 'none';

    // Try Identity Pool method with detailed error handling
    console.log('🔐 📝 🔄 Attempting Identity Pool token extraction...');
    const identityPoolResult = await this.getIdentityPoolCredentials();
    
    if (identityPoolResult.success) {
      googleToken = identityPoolResult.googleToken;
      tokenSource = 'identity_pool';
      this.identityPoolCredentials = identityPoolResult.credentials;
      console.log('🔐 📝 ✅ Successfully extracted Google token from Identity Pool');
    } else {
      console.log('🔐 📝 ⚠️ Identity Pool failed:', identityPoolResult.error);
      
      // Fallback to ID token method
      console.log('🔐 📝 🔄 Trying ID token fallback...');
      try {
        if (idPayload.identities && Array.isArray(idPayload.identities)) {
          const googleIdentity = idPayload.identities.find(i => i.providerName === 'Google');
          if (googleIdentity && googleIdentity.access_token) {
            googleToken = googleIdentity.access_token;
            tokenSource = 'id_token_fallback';
            console.log('🔐 📝 ✅ Using Google token from ID token (fallback method)');
          }
        }
      } catch (fallbackError) {
        console.log('🔐 📝 ❌ ID token fallback also failed:', fallbackError.message);
      }
    }

    // Store the token
    this.googleAccessToken = googleToken;

    // Final status
    if (googleToken) {
      console.log('🔐 📝 ✅ Google access token available for API calls');
      console.log('🔐 📝 📋 Token source:', tokenSource);
      console.log('🔐 📝 📋 Token length:', googleToken.length);
    } else {
      console.log('🔐 📝 ❌ No Google access token - API calls will fail');
      console.log('🔐 📝 💡 Identity Pool configuration needs to be fixed');
    }

    // Build user data
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
      tokenSource: tokenSource,
      cognitoTokens: {
        idToken: session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
        refreshToken: session.getRefreshToken().getToken()
      },
      identityPoolId: this.identityPoolCredentials?.identityId || null,
      savedAt: Date.now(),
      lastSignIn: Date.now()
    };

    return userData;
  }

  async refreshSession() {
    console.log('🔐 🔄 Refreshing Cognito session...');
    
    try {
      const user = await this.amplify.Auth.currentAuthenticatedUser();
      const session = await this.amplify.Auth.currentSession();
      
      if (!user || !session) {
        throw new Error('No valid session to refresh');
      }

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
