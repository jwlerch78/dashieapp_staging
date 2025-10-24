# Deploy ElevenLabs TTS Edge Function

## Prerequisites

Before deploying, make sure you have:
1. ✅ ElevenLabs API key (starts with `xi_...`)
2. ✅ Chosen a voice ID (default: Rachel - `21m00Tcm4TlvDq8ikWAM`)

If you don't have these yet, see [elevenlabs-setup-guide.md](../../.reference/build-plans/elevenlabs-setup-guide.md)

## Deployment Steps

### 1. Set API Key in Supabase

```bash
# Navigate to project root
cd /Users/johnlerch/projects/dashieapp_staging

# Set ElevenLabs API key as Supabase secret
supabase secrets set ELEVENLABS_API_KEY=xi_your_actual_key_here

# Verify secrets are set
supabase secrets list
```

You should see:
- `OPENAI_API_KEY` (existing)
- `ELEVENLABS_API_KEY` (new)

### 2. Deploy the Edge Function

```bash
# Deploy elevenlabs-tts function
supabase functions deploy elevenlabs-tts
```

Expected output:
```
Deploying function elevenlabs-tts...
✓ Function elevenlabs-tts deployed successfully
```

### 3. Test the Edge Function

```bash
# Test with a simple phrase
curl -X POST https://cwglbtosingboqepsmjk.supabase.co/functions/v1/elevenlabs-tts \
  -H "Content-Type: application/json" \
  -H "apikey: your_supabase_anon_key" \
  -d '{"text":"Hello from ElevenLabs"}' \
  -o test-elevenlabs.mp3

# Play the audio file to verify quality
# macOS: open test-elevenlabs.mp3
# Linux: xdg-open test-elevenlabs.mp3
```

### 4. Test in Browser

After deploying, refresh your browser and test:

```javascript
const VoiceService = (await import('./js/core/voice-service.js')).default;
await VoiceService.speak('Hello from ElevenLabs, the highest quality text to speech');
```

You should hear:
- **Rachel's voice** (calm, clear, professional female voice)
- **High quality audio** - more natural than OpenAI
- **Fast playback** - sub-150ms latency (vs 2400ms with OpenAI)

## Voice Configuration

The default voice is **Rachel** (`21m00Tcm4TlvDq8ikWAM`). To change voices:

### Option 1: Edit Edge Function (All Users)

Edit `supabase/functions/elevenlabs-tts/index.ts`:

```typescript
// Change this line:
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// To one of these:
const DEFAULT_VOICE_ID = 'AZnzlk1XvdvUeBnXmlld'; // Domi (warm, friendly)
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella (young, energetic)
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam (male, deep)
```

Then redeploy:
```bash
supabase functions deploy elevenlabs-tts
```

### Option 2: Edit Client Code (Per-Call)

Edit `js/core/voice/web-voice-provider.js`:

```javascript
requestBody = {
  text: text,
  voice_id: '21m00Tcm4TlvDq8ikWAM', // Change this voice ID
  model_id: 'eleven_flash_v2_5'
};
```

## Troubleshooting

### Error: "Missing apikey header"

**Problem:** Edge function requires Supabase anon key

**Solution:** Make sure your browser has the latest code (hard refresh: Cmd+Shift+R)

### Error: "ELEVENLABS_API_KEY environment variable is required"

**Problem:** API key not set in Supabase secrets

**Solution:**
```bash
supabase secrets set ELEVENLABS_API_KEY=xi_your_key_here
supabase functions deploy elevenlabs-tts
```

### Error: 401 from ElevenLabs API

**Problem:** Invalid or expired API key

**Solution:**
1. Go to https://elevenlabs.io/app/settings/api-keys
2. Generate new API key
3. Update Supabase secret
4. Redeploy function

### Slow Performance (Still 2+ seconds)

**Problem:** Browser might be using old OpenAI code

**Solution:**
1. Hard refresh browser (Cmd+Shift+R)
2. Check console logs - should say "Calling elevenlabs TTS"
3. If still says "openai", clear cache and reload

## Performance Comparison

After deployment, you should see significant improvement:

| Metric | OpenAI (Before) | ElevenLabs (After) | Improvement |
|--------|-----------------|-------------------|-------------|
| **Latency** | 2400ms | 150-200ms | **12-16x faster** |
| **Quality** | Good | Excellent | **Most natural** |
| **Cache Hit** | <10ms | <10ms | Same |

## Cost Monitoring

ElevenLabs pricing:
- **Flash v2.5 model:** $0.075 per 1K characters
- **Average response:** ~30 characters = $0.00225 per response
- **100 responses/day:** ~$0.23/day = ~$6.75/month

**Free tier:** 10,000 characters/month (~333 responses)

Monitor usage at: https://elevenlabs.io/app/usage

## Next Steps

Once ElevenLabs is working:
1. ✅ Test quality vs OpenAI - should sound much more natural
2. ✅ Test latency - should be 12-16x faster
3. ✅ Update AndroidVoiceProvider for Fire TV
4. ✅ Deploy to production

## Reverting to OpenAI (If Needed)

If you need to switch back to OpenAI:

Edit `js/core/voice/web-voice-provider.js`:

```javascript
// Change this:
this.ttsUrl = this.elevenlabsTtsUrl;
this.ttsProvider = 'elevenlabs';

// To this:
this.ttsUrl = this.openaiTtsUrl;
this.ttsProvider = 'openai';
```

Refresh browser - no redeployment needed!
