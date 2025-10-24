// ============================================================================
// Deepgram Speech-to-Text Edge Function
// ============================================================================
// Converts audio to text using Deepgram's Nova-3 API
// Ultra-low latency: ~200ms end-to-end (vs 6-7s for Whisper)
//
// Called by client with:
// - audio: Audio file (multipart/form-data)
// - language: Optional language code (e.g., 'en')
//
// Returns:
// - transcript: The transcribed text
// - confidence: Confidence score from Deepgram
// - words: Optional word-level timestamps
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { multiParser } from 'https://deno.land/x/multiparser@0.114.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');

if (!DEEPGRAM_API_KEY) {
  throw new Error('DEEPGRAM_API_KEY environment variable is required');
}

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

    // Parse multipart form data
    const form = await multiParser(req);

    if (!form || !form.files || !form.files.audio) {
      return jsonResponse({
        error: 'Missing audio file. Send as multipart/form-data with field name "audio"'
      }, 400);
    }

    const audioFile = form.files.audio;
    const language = form.fields?.language || 'en';

    console.log(`🎤 Deepgram STT request (size: ${audioFile.size} bytes, lang: ${language})`);

    // Validate file size (max 25MB)
    if (audioFile.size > 25 * 1024 * 1024) {
      return jsonResponse({
        error: 'Audio file too large. Maximum size is 25MB'
      }, 400);
    }

    // Read audio file content directly (multiParser provides content in memory)
    let audioData;
    if (audioFile.content) {
      audioData = audioFile.content;
    } else if (audioFile.filename) {
      audioData = await Deno.readFile(audioFile.filename);
    } else {
      return jsonResponse({
        error: 'Could not read audio file content'
      }, 400);
    }

    console.log(`📦 Audio data size: ${audioData.length} bytes`);

    // Build Deepgram API URL with query parameters
    // Using Nova-3 model for best accuracy and speed
    const deepgramUrl = new URL('https://api.deepgram.com/v1/listen');
    deepgramUrl.searchParams.set('model', 'nova-3');
    deepgramUrl.searchParams.set('language', language);
    deepgramUrl.searchParams.set('smart_format', 'true'); // Auto punctuation/formatting
    deepgramUrl.searchParams.set('punctuate', 'true');
    deepgramUrl.searchParams.set('diarize', 'false'); // No speaker detection needed
    deepgramUrl.searchParams.set('utterances', 'false');

    console.log('📡 Calling Deepgram API...');

    // Call Deepgram API with audio data
    const apiStart = performance.now();
    const deepgramResponse = await fetch(deepgramUrl.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': audioFile.contentType || 'audio/wav'
      },
      body: audioData
    });

    const apiEnd = performance.now();
    const apiTime = Math.round(apiEnd - apiStart);
    console.log(`⏱️  Deepgram API took ${apiTime}ms`);

    if (!deepgramResponse.ok) {
      const error = await deepgramResponse.text();
      console.error('🚨 Deepgram API error:', error);
      throw new Error(`Deepgram API error: ${deepgramResponse.status} - ${error}`);
    }

    const result = await deepgramResponse.json();

    // Extract transcript and confidence from Deepgram response
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    console.log(`✅ Deepgram success: "${transcript.substring(0, 50)}..." (confidence: ${confidence.toFixed(2)}, ${apiTime}ms)`);

    // Return transcript with timing info
    return jsonResponse({
      transcript: transcript,
      confidence: confidence,
      language: language,
      duration: result.metadata?.duration || 0,
      processing_time_ms: apiTime,
      metadata: {
        audio_size: audioFile.size,
        audio_type: audioFile.contentType,
        model: 'nova-3'
      }
    }, 200);

  } catch (error) {
    console.error('🚨 Deepgram STT error:', error);
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
