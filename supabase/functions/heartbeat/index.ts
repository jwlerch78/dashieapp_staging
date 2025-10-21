// ============================================================================
// Heartbeat Edge Function - Phase 3 v2
// ============================================================================
// Tracks dashboard online status and checks for version updates
//
// Called by client every ~60 seconds with:
// - Current app version
// - Device info
// - Session data
//
// Returns:
// - needs_update flag (if new version available)
// - latest_version string
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verify } from 'https://deno.land/x/djwt@v2.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const JWT_SECRET = Deno.env.get('JWT_SECRET');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
  throw new Error('Missing required environment variables');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authenticated user from custom JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const jwtToken = authHeader.replace('Bearer ', '');

    // Verify custom JWT (not Supabase auth JWT)
    const userId = await verifyCustomJWT(jwtToken);
    if (!userId) {
      return jsonResponse({ error: 'Invalid auth token' }, 401);
    }

    // Create service role client for database operations
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // Get user email from JWT payload
    const userEmail = await getUserEmailFromJWT(jwtToken);

    // Parse heartbeat data
    const {
      version,
      device_type,
      device_fingerprint,
      user_agent,
      dashboard_name
    } = await req.json();

    if (!version) {
      return jsonResponse({ error: 'version is required' }, 400);
    }

    console.log(`💓 Heartbeat from ${userEmail} - v${version} - ${device_type || 'unknown'}`);

    const now = new Date().toISOString();

    // Hash device fingerprint and IP for privacy
    const deviceFingerprintHash = device_fingerprint
      ? await hashString(device_fingerprint)
      : null;
    const ipHash = await hashString(
      req.headers.get('CF-Connecting-IP') ||
      req.headers.get('X-Forwarded-For') ||
      'unknown'
    );

    // Get existing heartbeat to check if this is first heartbeat of session
    const { data: existing } = await supabaseClient
      .from('dashboard_heartbeats')
      .select('session_started_at, total_heartbeats')
      .eq('auth_user_id', userId)
      .maybeSingle();

    const isFirstHeartbeat = !existing;

    // Upsert heartbeat record
    const { error: upsertError } = await supabaseClient
      .from('dashboard_heartbeats')
      .upsert({
        auth_user_id: userId,
        dashboard_name: dashboard_name || null,
        device_type: device_type || null,
        device_fingerprint_hash: deviceFingerprintHash,
        user_agent: user_agent || null,
        ip_address_hash: ipHash,
        current_version: version,
        is_online: true,
        last_heartbeat_at: now,
        session_started_at: existing?.session_started_at || now,
        total_heartbeats: (existing?.total_heartbeats || 0) + 1,
        updated_at: now
      }, {
        onConflict: 'auth_user_id'
      });

    if (upsertError) {
      console.error('🚨 Heartbeat upsert failed:', upsertError);
      throw upsertError;
    }

    // Update user_profiles.last_seen_at
    await supabaseClient
      .from('user_profiles')
      .update({ last_seen_at: now })
      .eq('auth_user_id', userId);

    // Check if update needed
    const { data: config } = await supabaseClient
      .from('access_control_config')
      .select('value')
      .eq('key', 'current_app_version')
      .maybeSingle();

    const latestVersion = config?.value || version;
    const needsUpdate = compareVersions(version, latestVersion) < 0;

    if (needsUpdate) {
      console.log(`🔄 Update available for ${userEmail}: ${version} → ${latestVersion}`);
    }

    // Return response
    return jsonResponse({
      success: true,
      is_online: true,
      needs_update: needsUpdate,
      latest_version: latestVersion,
      heartbeat_count: (existing?.total_heartbeats || 0) + 1,
      is_first_heartbeat: isFirstHeartbeat
    }, 200);

  } catch (error) {
    console.error('🚨 Heartbeat error:', error);
    return jsonResponse({
      error: 'Internal server error',
      details: error.message
    }, 500);
  }
});

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Verify custom JWT (not Supabase auth JWT)
 */
async function verifyCustomJWT(token: string): Promise<string | null> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const payload = await verify(token, key) as any;
    return payload?.sub || null;
  } catch (error) {
    console.error('🚨 JWT verification failed:', error);
    return null;
  }
}

/**
 * Get user email from JWT payload
 */
async function getUserEmailFromJWT(token: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const payload = await verify(token, key) as any;
    return payload?.email || 'unknown';
  } catch (error) {
    console.error('🚨 Failed to extract email from JWT:', error);
    return 'unknown';
  }
}

async function hashString(input: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

function jsonResponse(data: any, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
