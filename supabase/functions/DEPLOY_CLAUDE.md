# Claude AI Chat Edge Function Deployment Guide

## Overview
This edge function provides conversational AI using Anthropic's Claude Sonnet 4.5 API for voice assistant interactions.

**Features:**
- Natural conversation with Claude AI
- Context-aware responses
- Voice-optimized (concise, conversational)
- Token usage tracking

## Prerequisites

1. **Anthropic API Account**
   - Sign up at: https://console.anthropic.com
   - Get API key from: https://console.anthropic.com/settings/keys

2. **Supabase CLI**
   - Install: `brew install supabase/tap/supabase`
   - Login: `supabase login`

## Deployment Steps

### 1. Set Anthropic API Key as Secret

```bash
# Set the secret in Supabase
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-your_key_here

# Verify secret was set
supabase secrets list
```

### 2. Deploy the Function

```bash
# Deploy from project root
supabase functions deploy claude-chat

# Or deploy all functions
supabase functions deploy
```

### 3. Verify Deployment

```bash
# Test the function
curl -i -X POST \
  https://your-project.supabase.co/functions/v1/claude-chat \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello! What can you help me with?"}
    ]
  }'
```

## Function Details

### Request Format
- **Method:** POST
- **Content-Type:** application/json
- **Headers:**
  - `apikey`: Your Supabase anon key
  - `Authorization`: Bearer YOUR_SUPABASE_ANON_KEY

### Request Body
```json
{
  "messages": [
    {"role": "user", "content": "Hello!"},
    {"role": "assistant", "content": "Hi! How can I help?"},
    {"role": "user", "content": "What's the weather?"}
  ],
  "system": "Optional system prompt override",
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 1024,
  "temperature": 1.0
}
```

**Parameters:**
- `messages` (required): Array of conversation messages
  - Each message has `role` ("user" or "assistant") and `content` (text)
- `system` (optional): System prompt (defaults to Dashie voice assistant prompt)
- `model` (optional): Claude model to use (default: claude-sonnet-4-5-20250929)
- `max_tokens` (optional): Max response length (default: 1024)
- `temperature` (optional): Response creativity 0-1 (default: 1.0)

### Response Format
```json
{
  "response": "Claude's response text",
  "model": "claude-sonnet-4-5-20250929",
  "usage": {
    "input_tokens": 45,
    "output_tokens": 128,
    "total_tokens": 173
  },
  "processing_time_ms": 1234,
  "stop_reason": "end_turn"
}
```

## Default System Prompt

The function uses this default system prompt optimized for voice assistants:

> "You are Dashie, a friendly and helpful voice assistant for families. You help manage schedules, answer questions, and control smart home features. Keep responses concise and conversational since they will be read aloud."

You can override this by providing a custom `system` parameter in your request.

## Available Models

**Recommended:**
- `claude-sonnet-4-5-20250929` (default) - Best balance of speed, intelligence, and cost
- `claude-opus-4-5-20250514` - Most capable, slower, more expensive
- `claude-haiku-4-5-20250514` - Fastest, cheapest, good for simple tasks

## Pricing

**Claude Sonnet 4.5** (recommended):
- Input: $3.00 per million tokens
- Output: $15.00 per million tokens

**Example costs for voice assistant:**
- Typical voice exchange (50 input + 150 output tokens): ~$0.0024
- 100 conversations/day: ~$0.24/day = ~$7/month
- 500 conversations/day: ~$1.20/day = ~$36/month

**Token estimation:**
- ~4 characters = 1 token
- "Can you hear me now?" ≈ 6 tokens
- "Yes, I can hear you! How can I help?" ≈ 10 tokens

## Response Time

Typical latency:
- Simple responses: 500-1500ms
- Complex responses: 1500-3000ms
- With streaming (future): First token in ~200ms

## Troubleshooting

### Error: "Missing apikey header"
- Make sure you're sending both `apikey` and `Authorization` headers
- Use your Supabase anon key (not Anthropic key)

### Error: "ANTHROPIC_API_KEY environment variable is required"
- Deploy the secret: `supabase secrets set ANTHROPIC_API_KEY=...`
- Redeploy function after setting secret

### Slow response times
- Check Anthropic API status: https://status.anthropic.com
- Consider using Claude Haiku for faster responses
- Reduce max_tokens for shorter responses

### High costs
- Monitor token usage in response metadata
- Use conversation history pruning (keep last N messages)
- Consider caching common responses client-side
- Use Claude Haiku for simple queries

## Conversation Management

For multi-turn conversations:

1. **Keep conversation history** - Include previous messages in `messages` array
2. **Prune old messages** - Keep last 10-20 messages to control costs
3. **Add context** - Include relevant info (time, user name, etc.) in system prompt
4. **Handle errors gracefully** - Provide fallback responses

## Next Steps

After deployment:
1. Add Claude config to `config.js`
2. Create AI service to manage conversations
3. Wire to VoiceCommandRouter
4. Test full voice → AI → speech flow
5. Add conversation history management
6. Monitor token usage and costs

## References

- Anthropic API Docs: https://docs.anthropic.com
- Claude Models: https://docs.anthropic.com/claude/docs/models-overview
- Pricing: https://www.anthropic.com/pricing
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
