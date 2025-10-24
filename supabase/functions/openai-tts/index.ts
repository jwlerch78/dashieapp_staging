// ============================================================================
// OpenAI TTS Edge Function
// ============================================================================
// Converts text to speech using OpenAI's TTS API
//
// Called by client with:
// - text: The text to convert to speech
// - voice: Voice to use (alloy, echo, fable, onyx, nova, shimmer)
// - speed: Speech speed (0.25 - 4.0)
//
// Returns:
// - MP3 audio file (binary)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

// Simple in-memory cache for TTS responses
// In production, consider using Deno KV or Redis
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
    const { text, voice = 'nova', speed = 1.0 } = await req.json();

    if (!text || typeof text !== 'string') {
      return jsonResponse({ error: 'text is required and must be a string' }, 400);
    }

    if (text.length > 4096) {
      return jsonResponse({ error: 'text must be 4096 characters or less' }, 400);
    }

    // Validate voice
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (!validVoices.includes(voice)) {
      return jsonResponse({
        error: `Invalid voice. Must be one of: ${validVoices.join(', ')}`
      }, 400);
    }

    // Validate speed
    if (speed < 0.25 || speed > 4.0) {
      return jsonResponse({
        error: 'speed must be between 0.25 and 4.0'
      }, 400);
    }

    console.log(`🔊 TTS request: "${text.substring(0, 50)}..." (voice: ${voice}, speed: ${speed})`);

    // Check cache
    const cacheKey = `${voice}_${speed}_${text}`;
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

    console.log('❌ Cache MISS - calling OpenAI API');

    // Call OpenAI TTS API
    const apiStart = performance.now();
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',  // Use 'tts-1-hd' for higher quality
        voice: voice,
        input: text,
        speed: speed
      })
    });

    const apiEnd = performance.now();
    console.log(`⏱️  OpenAI API took ${Math.round(apiEnd - apiStart)}ms`);

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('🚨 OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${error}`);
    }

    // Get audio data
    const audioArrayBuffer = await openaiResponse.arrayBuffer();
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
        'X-Cache': 'MISS'
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
