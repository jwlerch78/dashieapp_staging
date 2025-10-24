// ============================================================================
// Whisper Speech-to-Text Edge Function
// ============================================================================
// Converts audio to text using OpenAI's Whisper API
//
// Called by client with:
// - audio: Audio file (multipart/form-data)
// - language: Optional language code (e.g., 'en')
//
// Returns:
// - transcript: The transcribed text
// - confidence: Optional confidence score
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { multiParser } from 'https://deno.land/x/multiparser@0.114.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse multipart form data
    const form = await multiParser(req);

    if (!form || !form.files || !form.files.audio) {
      return jsonResponse({
        error: 'Missing audio file. Send as multipart/form-data with field name "audio"'
      }, 400);
    }

    const audioFile = form.files.audio;
    const language = form.fields?.language || 'en';

    console.log(`🎤 Whisper STT request (size: ${audioFile.size} bytes, lang: ${language})`);

    // Validate file size (max 25MB for Whisper API)
    if (audioFile.size > 25 * 1024 * 1024) {
      return jsonResponse({
        error: 'Audio file too large. Maximum size is 25MB'
      }, 400);
    }

    // Read audio file data
    const audioData = await Deno.readFile(audioFile.filename);

    // Create FormData for OpenAI API
    const formData = new FormData();

    // Create a Blob from the audio data
    const audioBlob = new Blob([audioData], {
      type: audioFile.contentType || 'audio/wav'
    });

    formData.append('file', audioBlob, audioFile.name || 'audio.wav');
    formData.append('model', 'whisper-1');

    if (language) {
      formData.append('language', language);
    }

    console.log('📡 Calling OpenAI Whisper API...');

    // Call OpenAI Whisper API
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('🚨 OpenAI Whisper API error:', error);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${error}`);
    }

    const result = await openaiResponse.json();

    console.log(`✅ Whisper success: "${result.text?.substring(0, 50)}..."`);

    // Return transcript
    return jsonResponse({
      transcript: result.text,
      language: language,
      duration: audioFile.size / 16000, // Approximate duration (assumes 16kHz mono)
      metadata: {
        audio_size: audioFile.size,
        audio_type: audioFile.contentType
      }
    }, 200);

  } catch (error) {
    console.error('🚨 Whisper STT error:', error);
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
