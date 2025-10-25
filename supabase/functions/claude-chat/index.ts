// ============================================================================
// Claude AI Chat Edge Function
// ============================================================================
// Provides conversational AI using Anthropic's Claude API
//
// Called by client with:
// - messages: Array of conversation messages [{role, content}]
// - system: Optional system prompt
// - model: Optional model override (defaults to Claude Sonnet 4.5)
//
// Returns:
// - response: Claude's response text
// - usage: Token usage information
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY
});

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

    // Parse request body
    const body = await req.json();
    const {
      messages,
      system,
      model = 'claude-sonnet-4-5-20250929', // Latest Claude Sonnet 4.5
      max_tokens = 1024,
      temperature = 1.0
    } = body;

    // Validate messages array
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({
        error: 'Missing or invalid messages array. Expected format: [{role: "user"|"assistant", content: "text"}]'
      }, 400);
    }

    console.log(`🤖 Claude chat request (model: ${model}, messages: ${messages.length})`);

    // Build system prompt (default fallback if not provided by client)
    const systemPrompt = system || `Keep responses concise and conversational since they will be read aloud. Be helpful and friendly.`;

    // Call Claude API
    const apiStart = performance.now();
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: max_tokens,
      temperature: temperature,
      system: systemPrompt,
      messages: messages
    });

    const apiEnd = performance.now();
    const apiTime = Math.round(apiEnd - apiStart);
    console.log(`⏱️  Claude API took ${apiTime}ms`);

    // Extract text from response
    const responseText = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    console.log(`✅ Claude response: "${responseText.substring(0, 100)}..." (${apiTime}ms)`);

    // Return response with usage info
    return jsonResponse({
      response: responseText,
      model: model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      },
      processing_time_ms: apiTime,
      stop_reason: response.stop_reason
    }, 200);

  } catch (error) {
    console.error('🚨 Claude chat error:', error);

    // Handle API errors
    if (error instanceof Anthropic.APIError) {
      return jsonResponse({
        error: 'Claude API error',
        details: error.message,
        status: error.status
      }, error.status || 500);
    }

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
