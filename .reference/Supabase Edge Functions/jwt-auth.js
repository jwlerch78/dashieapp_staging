// supabase/functions/jwt-auth/index.ts
// CHANGE SUMMARY: Added multi-client OAuth support - device flow and web OAuth can both refresh tokens using their respective credentials
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, verify } from 'https://deno.land/x/djwt@v2.8/mod.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// JWT configuration
const JWT_SECRET = Deno.env.get('JWT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Google OAuth credentials for refresh operations
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const GOOGLE_DEVICE_CLIENT_ID = Deno.env.get('GOOGLE_DEVICE_CLIENT_ID');
const GOOGLE_DEVICE_CLIENT_SECRET = Deno.env.get('GOOGLE_DEVICE_CLIENT_SECRET');
if (!JWT_SECRET || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables');
}
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { googleAccessToken, operation, data, settings, provider, account_type } = await req.json();
    // ==================== STANDALONE OPERATIONS ====================
    // These don't require any authentication
    if (operation === 'refresh_token') {
      return handleRefreshTokenStandalone(data);
    }
    // ==================== JWT-AUTHENTICATED OPERATIONS ====================
    // These operations use Supabase JWT from Authorization header
    // Operations: load, save, get_valid_token
    if (operation === 'load' || operation === 'save' || operation === 'get_valid_token' || operation === 'refresh_jwt' || operation === 'list_accounts' || operation === 'remove_account') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          error: 'Missing Supabase JWT in Authorization header'
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const supabaseJWT = authHeader.replace('Bearer ', '');
      // Verify and extract user ID from JWT
      const userId = await verifySupabaseJWT(supabaseJWT);
      if (!userId) {
        return new Response(JSON.stringify({
          error: 'Invalid Supabase JWT'
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      console.log(`🔐 ${operation} authenticated via Supabase JWT for user: ${userId}`);
      // Use service role client to bypass RLS for these operations
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      // Route to appropriate handler
      let result;
      if (operation === 'load') {
        result = await handleLoadOperation(supabaseAdmin, userId);
      } else if (operation === 'save') {
        const settingsToSave = settings || data;
        // Get user email from JWT for save operation
        const userEmail = await getUserEmailFromJWT(supabaseJWT);
        result = await handleSaveOperation(supabaseAdmin, userId, userEmail, settingsToSave);
      } else if (operation === 'get_valid_token') {
        result = await handleGetValidTokenOperation(supabaseAdmin, userId, provider || 'google', account_type || 'personal');
      } else if (operation === 'refresh_jwt') {
        // User already authenticated via JWT verification above
        // Get user email from JWT
        const userEmail = await getUserEmailFromJWT(supabaseJWT);
        // Generate fresh JWT with new expiry
        const newJwtToken = await generateSupabaseJWT(userId, userEmail);
        console.log(`🔄 JWT refreshed for user: ${userId}`);
        result = {
          jwtToken: newJwtToken,
          user: {
            id: userId,
            email: userEmail
          }
        };
      } else if (operation === 'list_accounts') {
        result = await handleListAccountsOperation(supabaseAdmin, userId);
      } else if (operation === 'remove_account') {
        result = await handleRemoveAccountOperation(supabaseAdmin, userId, null, provider || 'google', account_type || 'personal');
      }
      return new Response(JSON.stringify({
        success: true,
        ...result
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // ==================== GOOGLE-TOKEN-AUTHENTICATED OPERATIONS ====================
    // These operations require Google access token
    // Operations: get_jwt_from_google, store_tokens, list_accounts, remove_account
    if (!googleAccessToken) {
      return new Response(JSON.stringify({
        error: 'Google access token required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Verify Google access token and get user info
    const googleUser = await verifyGoogleToken(googleAccessToken);
    if (!googleUser || !googleUser.verified_email) {
      return new Response(JSON.stringify({
        error: 'Invalid or unverified Google token'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`🔐 Google token verified for: ${googleUser.email}`);
    // Get or create Supabase auth user
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const authUserId = await getOrCreateAuthUser(supabaseAdmin, googleUser);
    console.log(`👤 Auth user ID: ${authUserId}`);
    // Generate Supabase JWT token
    const jwtToken = await generateSupabaseJWT(authUserId, googleUser.email);
    console.log(`🎫 JWT token generated for user: ${authUserId}`);
    // Handle get_jwt_from_google - just return the JWT
    if (operation === 'get_jwt_from_google') {
      return new Response(JSON.stringify({
        success: true,
        user: {
          id: authUserId,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          provider: 'google'
        },
        jwtToken
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Create Supabase client with the new JWT for other operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${jwtToken}`
        }
      }
    });
    // Handle the requested operation
    let result;
    if (operation === 'store_tokens') {
      result = await handleStoreTokensOperation(supabase, authUserId, googleUser.email, data, provider, account_type);
    } else if (operation === 'list_accounts') {
      result = await handleListAccountsOperation(supabase, authUserId);
    } else if (operation === 'remove_account') {
      result = await handleRemoveAccountOperation(supabase, authUserId, googleUser.email, provider, account_type);
    } else {
      return new Response(JSON.stringify({
        error: 'Invalid operation'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Return success response with JWT token for operations that need it
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: authUserId,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        provider: 'google'
      },
      jwtToken,
      ...result
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('🚨 JWT Auth error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
// ==================== AUTHENTICATION HELPERS ====================
/**
 * Verify Supabase JWT and extract user ID
 */ async function verifySupabaseJWT(token) {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);
    const key = await crypto.subtle.importKey('raw', keyData, {
      name: 'HMAC',
      hash: 'SHA-256'
    }, false, [
      'verify'
    ]);
    const payload = await verify(token, key);
    if (!payload || !payload.sub) {
      console.error('🚨 Invalid JWT payload');
      return null;
    }
    console.log(`✅ JWT verified for user: ${payload.sub}`);
    return payload.sub;
  } catch (error) {
    console.error('🚨 JWT verification failed:', error);
    return null;
  }
}
/**
 * Extract email from JWT payload (for save operations)
 */ async function getUserEmailFromJWT(token) {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);
    const key = await crypto.subtle.importKey('raw', keyData, {
      name: 'HMAC',
      hash: 'SHA-256'
    }, false, [
      'verify'
    ]);
    const payload = await verify(token, key);
    return payload.email || '';
  } catch (error) {
    console.error('🚨 Failed to extract email from JWT:', error);
    return '';
  }
}
/**
 * Verify Google access token and get user information
 */ async function verifyGoogleToken(accessToken) {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
    if (!response.ok) {
      console.error('🚨 Google token verification failed:', response.status);
      return null;
    }
    const userInfo = await response.json();
    if (!userInfo.id || !userInfo.email || !userInfo.verified_email) {
      console.error('🚨 Invalid Google user info:', userInfo);
      return null;
    }
    return userInfo;
  } catch (error) {
    console.error('🚨 Error verifying Google token:', error);
    return null;
  }
}
/**
 * Get or create Supabase auth user using admin API
 */ async function getOrCreateAuthUser(supabaseAdmin, googleUser) {
  try {
    console.log(`🔍 Looking for user with email: ${googleUser.email}`);
    const { data: existingUsers, error: findError } = await supabaseAdmin.auth.admin.listUsers();
    if (findError) {
      console.error('🚨 Error listing users:', findError);
      throw new Error(`Failed to search users: ${findError.message}`);
    }
    const existingUser = existingUsers.users?.find((user)=>user.email === googleUser.email);
    if (existingUser) {
      console.log(`✅ Found existing user: ${existingUser.id}`);
      return existingUser.id;
    }
    const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: googleUser.email,
      email_confirm: true,
      user_metadata: {
        name: googleUser.name || '',
        picture: googleUser.picture || '',
        provider: 'google',
        provider_id: googleUser.id
      },
      app_metadata: {
        provider: 'google',
        providers: [
          'google'
        ]
      }
    });
    if (createError) {
      console.error('🚨 Error creating user:', createError);
      throw new Error(`Failed to create user: ${createError.message}`);
    }
    if (!newUserData?.user) {
      throw new Error('Failed to create user: No user returned');
    }
    console.log(`✅ Created new user: ${newUserData.user.id}`);
    return newUserData.user.id;
  } catch (error) {
    console.error('🚨 Auth user creation failed:', error);
    throw error;
  }
}
/**
 * Generate a proper Supabase JWT token
 */ async function generateSupabaseJWT(userId, email) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 72; // 72 hours
    const payload = {
      aud: 'authenticated',
      exp: exp,
      iat: now,
      iss: 'supabase',
      sub: userId,
      email: email,
      role: 'authenticated',
      app_metadata: {
        provider: 'google',
        providers: [
          'google'
        ]
      },
      user_metadata: {
        email: email
      }
    };
    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);
    const key = await crypto.subtle.importKey('raw', keyData, {
      name: 'HMAC',
      hash: 'SHA-256'
    }, false, [
      'sign'
    ]);
    const jwt = await create({
      alg: 'HS256',
      typ: 'JWT'
    }, payload, key);
    return jwt;
  } catch (error) {
    console.error('🚨 JWT generation failed:', error);
    throw new Error(`JWT generation failed: ${error.message}`);
  }
}
// ==================== OPERATION HANDLERS ====================
/**
 * Handle load settings operation
 */ async function handleLoadOperation(supabase, authUserId) {
  try {
    console.log(`📊 Loading settings for auth user: ${authUserId}`);
    const { data, error } = await supabase.from('user_settings').select('settings, updated_at').eq('auth_user_id', authUserId).single();
    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`📊 No settings found for user: ${authUserId}`);
        return {
          settings: null
        };
      }
      throw error;
    }
    console.log(`📊 ✅ Settings loaded for user: ${authUserId}`);
    return {
      settings: data?.settings || null
    };
  } catch (error) {
    console.error('📊 ❌ Load operation failed:', error);
    throw error;
  }
}
/**
 * Handle save settings operation
 */ async function handleSaveOperation(supabase, authUserId, email, settings) {
  try {
    console.log(`📊 Saving settings for auth user: ${authUserId}`);
    const recordToSave = {
      auth_user_id: authUserId,
      email: email,
      settings: settings,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('user_settings').upsert(recordToSave, {
      onConflict: 'auth_user_id'
    }).select();
    if (error) {
      console.error(`📊 ❌ Upsert error:`, error);
      throw error;
    }
    console.log(`📊 ✅ Settings saved for user: ${authUserId}`);
    return {
      saved: true,
      data
    };
  } catch (error) {
    console.error('📊 ❌ Save operation failed:', error);
    throw error;
  }
}
// ==================== TOKEN ACCOUNT OPERATIONS ====================
/**
 * Handle store tokens operation
 */ // CHANGE SUMMARY: Fixed email storage to use tokenData.email instead of authenticated user's email for multi-account support
/**
 * Handle store tokens operation
 */ async function handleStoreTokensOperation(supabase, authUserId, email, tokenData, provider = 'google', accountType = 'personal') {
  try {
    console.log(`🔐 Storing tokens for ${provider}:${accountType} - ${email}`);
    const { access_token, refresh_token, expires_in, scope, display_name, provider_info } = tokenData;
    if (!access_token || !refresh_token) {
      throw new Error('Missing required token data: access_token, refresh_token');
    }
    const { data: existingData } = await supabase.from('user_settings').select('settings').eq('auth_user_id', authUserId).single();
    const existingSettings = existingData?.settings || {};
    const existingTokenAccounts = existingSettings.tokenAccounts || {};
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);
    const accountData = {
      email: tokenData.email || email,
      access_token,
      refresh_token,
      expires_at: expiresAt.toISOString(),
      scopes: scope ? scope.split(' ') : [],
      display_name: display_name || `${tokenData.email || email} (${accountType})`,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    // Preserve provider_info if provided (for multi-client support)
    if (provider_info) {
      accountData.provider_info = provider_info;
    }
    const updatedSettings = {
      ...existingSettings,
      tokenAccounts: {
        ...existingTokenAccounts,
        [provider]: {
          ...existingTokenAccounts[provider] || {},
          [accountType]: accountData
        }
      }
    };
    const { error } = await supabase.from('user_settings').upsert({
      auth_user_id: authUserId,
      email: email,
      settings: updatedSettings,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'auth_user_id'
    });
    if (error) throw error;
    console.log(`✅ Tokens stored successfully for ${provider}:${accountType}`);
    return {
      stored: true,
      account: {
        provider,
        account_type: accountType,
        email: tokenData.email || email,
        display_name: accountData.display_name,
        expires_at: expiresAt.toISOString(),
        scopes: accountData.scopes
      }
    };
  } catch (error) {
    console.error('🚨 Store tokens operation failed:', error);
    throw error;
  }
}
/**
 * Handle get valid token operation
 */ async function handleGetValidTokenOperation(supabase, authUserId, provider = 'google', accountType = 'personal') {
  try {
    console.log(`🎫 Getting valid token for ${provider}:${accountType} - user: ${authUserId}`);
    const { data: settingsData } = await supabase.from('user_settings').select('settings').eq('auth_user_id', authUserId).single();
    const accounts = settingsData?.settings?.tokenAccounts;
    const account = accounts?.[provider]?.[accountType];
    if (!account) {
      console.log(`❌ No account found for ${provider}:${accountType}`);
      return {
        error: `No account found for ${provider}:${accountType}`,
        account_found: false
      };
    }
    console.log(`✅ Found account, checking expiry`);
    // Check if token is expired (with 5 minute buffer)
    const now = new Date();
    const expiresAt = new Date(account.expires_at);
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    if (now.getTime() >= expiresAt.getTime() - bufferTime) {
      console.log(`🔄 Token expired or expiring soon, refreshing for ${provider}:${accountType}`);
      // Determine which OAuth client credentials to use
      const { clientId, clientSecret } = getOAuthCredentials(account.provider_info);
      const refreshResult = await refreshGoogleToken(account.refresh_token, clientId, clientSecret);
      if (!refreshResult.success) {
        console.error(`❌ Token refresh failed:`, refreshResult.error);
        return {
          error: 'Failed to refresh token',
          refresh_failed: true,
          details: refreshResult.error
        };
      }
      // Update stored token - PRESERVE ALL SETTINGS
      const existingSettings = settingsData.settings;
      const updatedAccount = {
        ...account,
        access_token: refreshResult.access_token,
        expires_at: new Date(Date.now() + refreshResult.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString()
      };
      const updatedSettings = {
        ...existingSettings,
        tokenAccounts: {
          ...accounts,
          [provider]: {
            ...accounts[provider],
            [accountType]: updatedAccount
          }
        }
      };
      await supabase.from('user_settings').update({
        settings: updatedSettings,
        updated_at: new Date().toISOString()
      }).eq('auth_user_id', authUserId);
      console.log(`✅ Token refreshed successfully for ${provider}:${accountType}`);
      return {
        access_token: refreshResult.access_token,
        expires_at: updatedAccount.expires_at,
        scopes: updatedAccount.scopes,
        refreshed: true
      };
    } else {
      console.log(`✅ Token still valid for ${provider}:${accountType}`);
      return {
        access_token: account.access_token,
        expires_at: account.expires_at,
        scopes: account.scopes,
        refreshed: false
      };
    }
  } catch (error) {
    console.error('🚨 Get valid token operation failed:', error);
    throw error;
  }
}
/**
 * Handle list accounts operation
 */ async function handleListAccountsOperation(supabase, authUserId) {
  try {
    console.log(`📋 Listing accounts for auth user: ${authUserId}`);
    const { data: settingsData } = await supabase.from('user_settings').select('settings').eq('auth_user_id', authUserId).single();
    const accounts = settingsData?.settings?.tokenAccounts || {};
    const accountList = [];
    for (const [provider, providerAccounts] of Object.entries(accounts)){
      for (const [accountType, accountData] of Object.entries(providerAccounts)){
        accountList.push({
          provider,
          account_type: accountType,
          email: accountData.email,
          display_name: accountData.display_name,
          expires_at: accountData.expires_at,
          scopes: accountData.scopes,
          is_active: accountData.is_active,
          created_at: accountData.created_at
        });
      }
    }
    console.log(`✅ Found ${accountList.length} accounts`);
    return {
      accounts: accountList
    };
  } catch (error) {
    console.error('🚨 List accounts operation failed:', error);
    throw error;
  }
}
/**
 * Handle remove account operation
 */ async function handleRemoveAccountOperation(supabase, authUserId, email, provider = 'google', accountType = 'personal') {
  try {
    console.log(`🗑️ Removing account ${provider}:${accountType} for ${email}`);
    const { data: settingsData } = await supabase.from('user_settings').select('settings').eq('auth_user_id', authUserId).single();
    const existingSettings = settingsData?.settings || {};
    const accounts = existingSettings.tokenAccounts || {};
    if (!accounts[provider]?.[accountType]) {
      return {
        removed: false,
        error: `Account ${provider}:${accountType} not found`
      };
    }
    const updatedProviderAccounts = {
      ...accounts[provider]
    };
    delete updatedProviderAccounts[accountType];
    const updatedAccounts = {
      ...accounts
    };
    if (Object.keys(updatedProviderAccounts).length === 0) {
      delete updatedAccounts[provider];
    } else {
      updatedAccounts[provider] = updatedProviderAccounts;
    }
    const updatedSettings = {
      ...existingSettings,
      tokenAccounts: updatedAccounts
    };
    const { error } = await supabase.from('user_settings').update({
      settings: updatedSettings,
      updated_at: new Date().toISOString()
    }).eq('auth_user_id', authUserId);
    if (error) throw error;
    console.log(`✅ Account ${provider}:${accountType} removed successfully`);
    return {
      removed: true
    };
  } catch (error) {
    console.error('🚨 Remove account operation failed:', error);
    throw error;
  }
}
/**
 * Handle standalone refresh token operation
 */ async function handleRefreshTokenStandalone(data) {
  try {
    const { refresh_token, provider_info } = data;
    if (!refresh_token) {
      throw new Error('Refresh token required');
    }
    console.log(`🔄 Refreshing Google token (standalone)`);
    // Determine which OAuth client credentials to use
    const { clientId, clientSecret } = getOAuthCredentials(provider_info);
    const refreshResult = await refreshGoogleToken(refresh_token, clientId, clientSecret);
    if (!refreshResult.success) {
      throw new Error(`Token refresh failed: ${refreshResult.error}`);
    }
    console.log(`✅ Token refreshed successfully`);
    return new Response(JSON.stringify({
      success: true,
      access_token: refreshResult.access_token,
      expires_in: refreshResult.expires_in,
      expires_at: new Date(Date.now() + refreshResult.expires_in * 1000).toISOString()
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('🚨 Refresh token operation failed:', error);
    return new Response(JSON.stringify({
      error: 'Token refresh failed',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}
/**
 * Determine which OAuth client credentials to use based on provider_info
 */ function getOAuthCredentials(providerInfo) {
  // Check if this is a device flow token
  if (providerInfo?.type === 'device_flow' || providerInfo?.client_id?.includes('m9vf7t0qgm6nlc6gggfsqefmjrak1mo9')) {
    console.log('🔧 Using device flow OAuth credentials');
    return {
      clientId: GOOGLE_DEVICE_CLIENT_ID || GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_DEVICE_CLIENT_SECRET || GOOGLE_CLIENT_SECRET
    };
  }
  // Default to web OAuth credentials
  console.log('🔧 Using web OAuth credentials');
  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET
  };
}
/**
 * Refresh Google access token using refresh token
 */ async function refreshGoogleToken(refreshToken, clientId, clientSecret) {
  try {
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }
    console.log(`🔄 Refreshing token with client: ${clientId.substring(0, 20)}...`);
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    if (!response.ok) {
      const errorData = await response.text();
      console.error('🚨 Google token refresh failed:', response.status, errorData);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorData}`
      };
    }
    const tokenData = await response.json();
    return {
      success: true,
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in || 3600
    };
  } catch (error) {
    console.error('🚨 Token refresh error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
