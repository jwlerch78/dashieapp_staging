// ============================================================================
// Database Operations Edge Function - Phase 4.3
// ============================================================================
// Handles database CRUD operations requiring JWT authentication
//
// OPERATIONS:
// - save_calendar_config: Save active calendar IDs to user_calendar_config
// - load_calendar_config: Load active calendar IDs from user_calendar_config
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verify } from 'https://deno.land/x/djwt@v2.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Environment variables
const JWT_SECRET = Deno.env.get('JWT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!JWT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables');
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { operation, active_calendar_ids } = await req.json();

    console.log(`📊 Database operation request: ${operation}`);

    // ==================== JWT AUTHENTICATION ====================

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing Supabase JWT in Authorization header' }, 401);
    }

    const supabaseJWT = authHeader.replace('Bearer ', '');
    const userId = await verifySupabaseJWT(supabaseJWT);

    if (!userId) {
      return jsonResponse({ error: 'Invalid Supabase JWT' }, 401);
    }

    console.log(`🔐 ${operation} authenticated via JWT for user: ${userId}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ==================== OPERATION ROUTING ====================

    let result;

    if (operation === 'save_calendar_config') {
      result = await handleSaveCalendarConfig(supabase, userId, active_calendar_ids);
    } else if (operation === 'load_calendar_config') {
      result = await handleLoadCalendarConfig(supabase, userId);
    } else {
      return jsonResponse({ error: 'Invalid operation' }, 400);
    }

    return jsonResponse({ success: true, ...result }, 200);

  } catch (error: any) {
    console.error('🚨 Database operation error:', error);
    return jsonResponse({
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    }, 500);
  }
});

// ============================================================================
// CALENDAR CONFIG OPERATIONS
// ============================================================================

async function handleSaveCalendarConfig(
  supabase: any,
  authUserId: string,
  activeCalendarIds: string[]
) {
  try {
    console.log(`📅 Saving calendar config for user: ${authUserId}`, {
      count: activeCalendarIds?.length || 0,
      ids: activeCalendarIds
    });

    if (!Array.isArray(activeCalendarIds)) {
      throw new Error('active_calendar_ids must be an array');
    }

    // Upsert to user_calendar_config table
    const { data, error } = await supabase
      .from('user_calendar_config')
      .upsert({
        auth_user_id: authUserId,
        active_calendar_ids: activeCalendarIds,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'auth_user_id'
      })
      .select();

    if (error) {
      console.error('🚨 Save calendar config failed:', error);
      throw new Error(`Failed to save calendar config: ${error.message}`);
    }

    console.log(`✅ Calendar config saved for user: ${authUserId}`, {
      count: activeCalendarIds.length
    });

    return {
      message: 'Calendar config saved',
      count: activeCalendarIds.length
    };

  } catch (error) {
    console.error('🚨 handleSaveCalendarConfig error:', error);
    throw error;
  }
}

async function handleLoadCalendarConfig(
  supabase: any,
  authUserId: string
) {
  try {
    console.log(`📅 Loading calendar config for user: ${authUserId}`);

    // Load from user_calendar_config table
    const { data, error } = await supabase
      .from('user_calendar_config')
      .select('active_calendar_ids')
      .eq('auth_user_id', authUserId)
      .single();

    // If no record found, return empty array (first time user)
    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`📅 No calendar config found for user ${authUserId} (first time), returning empty array`);
        return {
          active_calendar_ids: []
        };
      }

      console.error('🚨 Load calendar config failed:', error);
      throw new Error(`Failed to load calendar config: ${error.message}`);
    }

    const activeCalendarIds = data?.active_calendar_ids || [];

    console.log(`✅ Calendar config loaded for user: ${authUserId}`, {
      count: activeCalendarIds.length,
      ids: activeCalendarIds
    });

    return {
      active_calendar_ids: activeCalendarIds
    };

  } catch (error) {
    console.error('🚨 handleLoadCalendarConfig error:', error);
    throw error;
  }
}

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

async function verifySupabaseJWT(token: string): Promise<string | null> {
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

// ============================================================================
// UTILITIES
// ============================================================================

function jsonResponse(data: any, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
