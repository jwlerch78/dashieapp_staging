// supabase/functions/telemetry/index.ts
// Edge function to receive and store crash logs and telemetry data
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'No authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Create Supabase client with user's JWT
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({
        error: 'Invalid token or unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`📊 Telemetry upload from user: ${user.email}`);
    // Parse request body
    const { logs } = await req.json();
    if (!logs || !Array.isArray(logs)) {
      return new Response(JSON.stringify({
        error: 'Invalid request: logs array required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (logs.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        inserted: 0,
        message: 'No logs to insert'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Limit batch size to prevent abuse
    const logsToInsert = logs.slice(0, 100);
    console.log(`📊 Processing ${logsToInsert.length} log entries`);
    // Transform logs into telemetry records
    const telemetryRecords = logsToInsert.map((log)=>({
        auth_user_id: user.id,
        session_id: log.sessionId || 'unknown',
        log_type: log.type || 'unknown',
        severity: log.severity || 'info',
        platform: detectPlatform(log.platform, req.headers.get('user-agent')),
        device_type: log.deviceType || detectDeviceType(req.headers.get('user-agent')),
        payload: log // Store entire log as JSON
      }));
    // Insert into database (RLS will enforce user can only insert their own data)
    const { data, error } = await supabase.from('user_telemetry').insert(telemetryRecords);
    if (error) {
      console.error('Database insert error:', error);
      throw error;
    }
    console.log(`✅ Successfully inserted ${telemetryRecords.length} telemetry records`);
    return new Response(JSON.stringify({
      success: true,
      inserted: telemetryRecords.length,
      userId: user.id
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Telemetry upload error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
// Helper: Detect platform from log data or user agent
function detectPlatform(logPlatform, userAgent) {
  if (logPlatform) return logPlatform;
  if (!userAgent) return 'unknown';
  if (userAgent.includes('AFTS') || userAgent.includes('AFT')) return 'FireTV';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  return 'Web';
}
// Helper: Detect device type from user agent
function detectDeviceType(userAgent) {
  if (!userAgent) return 'unknown';
  if (userAgent.includes('TV') || userAgent.includes('AFT')) return 'tv';
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) return 'mobile';
  return 'desktop';
}
