// ============================================================================
// ElevenLabs TTS Edge Function
// ============================================================================
// Converts text to speech using ElevenLabs Flash v2.5 API
// - Ultra-low latency (sub-150ms TTFA)
// - Highest quality natural voices
// - 32 languages supported
//
// Called by client with:
// - text: The text to convert to speech
// - voice_id: Voice to use (optional, defaults to Rachel)
// - model_id: Model to use (optional, defaults to eleven_flash_v2_5)
//
// Returns:
// - MP3 audio file (binary)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

if (!ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY environment variable is required');
}

// Default voice: Rachel (calm, clear, professional female voice)
// Popular alternatives:
// - Domi: 'AZnzlk1XvdvUeBnXmlld' (warm, friendly, conversational)
// - Bella: 'EXAVITQu4vr4xnSDxMaL' (young, energetic, friendly)
// - Adam: 'pNInz6obpgDQGcFmaJgB' (male, deep, confident)
// - Antoni: 'ErXwobaYiN019PkySvjV' (male, well-rounded, versatile)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

// Simple in-memory cache for TTS responses
const cache = new Map<string, Uint8Array>();
const MAX_CACHE_SIZE = 100; // Cache up to 100 responses

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check for apikey header (Supabase anon key required)
    const apikey = req.headers.get('apikey');
    if (!apikey) {
      return jsonResponse({ error: 'Missing apikey header' }, 401);
    }

    // Parse request
    const {
      text,
      voice_id = DEFAULT_VOICE_ID,
      model_id = 'eleven_flash_v2_5' // Use Flash v2.5 for speed (can use 'eleven_turbo_v2_5' for even faster)
    } = await req.json();

    if (!text || typeof text !== 'string') {
      return jsonResponse({ error: 'text is required and must be a string' }, 400);
    }

    if (text.length > 5000) {
      return jsonResponse({ error: 'text must be 5000 characters or less' }, 400);
    }

    console.log(`🔊 ElevenLabs TTS request: "${text.substring(0, 50)}..." (voice: ${voice_id}, model: ${model_id})`);

    // Check cache
    const cacheKey = `${voice_id}_${model_id}_${text}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      console.log('✅ Cache HIT');
      return new Response(cached, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'X-Cache': 'HIT'
        }
      });
    }

    console.log('❌ Cache MISS - calling ElevenLabs API');

    // Call ElevenLabs TTS API
    const apiStart = performance.now();
    const elevenlabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          model_id: model_id,
          voice_settings: {
            stability: 0.5,        // 0-1: Lower = more variable, Higher = more stable
            similarity_boost: 0.75, // 0-1: How similar to the original voice
            style: 0.0,            // 0-1: Exaggeration of the style (only for v2 models)
            use_speaker_boost: true // Boost clarity and quality
          }
        })
      }
    );

    const apiEnd = performance.now();
    console.log(`⏱️  ElevenLabs API took ${Math.round(apiEnd - apiStart)}ms`);

    if (!elevenlabsResponse.ok) {
      const error = await elevenlabsResponse.text();
      console.error('🚨 ElevenLabs API error:', error);
      throw new Error(`ElevenLabs API error: ${elevenlabsResponse.status} - ${error}`);
    }

    // Get audio data
    const audioArrayBuffer = await elevenlabsResponse.arrayBuffer();
    const audioData = new Uint8Array(audioArrayBuffer);

    // Cache if text is short (common responses)
    if (text.length < 100) {
      // Evict oldest entry if cache is full
      if (cache.size >= MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(cacheKey, audioData);
      console.log(`💾 Cached response (${audioData.length} bytes)`);
    }

    console.log(`✅ TTS success (${audioData.length} bytes)`);

    // Return MP3 audio
    return new Response(audioData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'X-Cache': 'MISS',
        'X-Voice-ID': voice_id,
        'X-Model-ID': model_id
      }
    });

  } catch (error) {
    console.error('🚨 TTS error:', error);
    return jsonResponse({
      error: 'Internal server error',
      details: error.message
    }, 500);
  }
});

function jsonResponse(data: any, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
