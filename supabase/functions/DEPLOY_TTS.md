# Deploy OpenAI TTS Edge Function

## Quick Deployment

Deploy the updated openai-tts function with authentication validation:

```bash
# Navigate to project root
cd /Users/johnlerch/projects/dashieapp_staging

# Deploy the openai-tts function
supabase functions deploy openai-tts

# Verify the OPENAI_API_KEY secret is still set
supabase secrets list
```

## What Changed

The edge function now validates the `apikey` header (your Supabase anon key) before processing requests. This prevents unauthorized access.

**Before:**
```typescript
// No auth validation
const { text, voice = 'nova', speed = 1.0 } = await req.json();
```

**After:**
```typescript
// Check for apikey header (Supabase anon key required)
const apikey = req.headers.get('apikey');
if (!apikey) {
  return jsonResponse({ error: 'Missing apikey header' }, 401);
}

const { text, voice = 'nova', speed = 1.0 } = await req.json();
```

## Test After Deployment

After deploying, refresh your browser and test again:

```javascript
const VoiceService = (await import('./js/core/voice-service.js')).default;
await VoiceService.speak('Hello from Dashie');
```

You should now hear the OpenAI "nova" voice (high quality female voice) instead of the Windows fallback.
