# Voice Widget TTS Integration - Quick Start

**Status:** WebVoiceProvider updated ✅
**Next:** Deploy Supabase function and test

---

## What's Been Done

### 1. Supabase Edge Functions Created

- ✅ `supabase/functions/openai-tts/index.ts` - TTS endpoint
- ✅ `supabase/functions/whisper-stt/index.ts` - Speech-to-text endpoint
- ✅ Deployment guide at `supabase/functions/README-VOICE-FUNCTIONS.md`

### 2. JavaScript Updated

- ✅ `config.js` - Added TTS/Whisper function names
- ✅ `web-voice-provider.js` - Updated to use Supabase TTS endpoint
  - Calls `/functions/v1/openai-tts` for high-quality voice
  - Falls back to Web Speech API if cloud fails
  - Uses `nova` voice by default (configurable)

---

## What You Need To Do

### Step 1: Get OpenAI API Key

Follow: `.reference/build-plans/openai-api-setup-guide.md`

```bash
# Quick version:
# 1. Go to https://platform.openai.com/signup
# 2. Add payment method
# 3. Create API key (copy the sk-...)
```

### Step 2: Add Key to Supabase

```bash
# Add as secret
supabase secrets set OPENAI_API_KEY=sk-your-actual-key

# Verify
supabase secrets list
```

### Step 3: Deploy TTS Function

```bash
# Deploy
supabase functions deploy openai-tts

# Test it
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/openai-tts" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from Dashie","voice":"nova"}' \
  --output test.mp3

# Play it
afplay test.mp3  # macOS
```

### Step 4: Configure Supabase URL in index.html

Your `index.html` needs the Supabase URL. Add this to the `<head>` section:

```html
<script>
  // Supabase configuration
  window.SUPABASE_URL = 'https://your-project-id.supabase.co';
</script>
```

Or add it to your existing config loading.

---

## Testing the Voice Widget

### Test Flow 1: Type Command (Easiest)

1. Navigate to page 2 (voice widget)
2. Type "dark mode" in text input
3. Press Enter or click Send
4. Expected:
   - Theme changes to dark
   - You HEAR "Theme changed to dark mode" in OpenAI voice
   - AI Response widget shows the message

### Test Flow 2: Voice Command (After STT is working)

1. Click mic button
2. Say "dark mode"
3. Same result as above

---

## How It Works

```
User types "dark mode"
  ↓
Voice Widget sends user-message
  ↓
VoiceCommandRouter receives message
  ↓
Matches theme command → executes
  ↓
Calls VoiceService.speak("Theme changed to dark mode")
  ↓
WebVoiceProvider.speak() is called
  ↓
Fetches: POST /functions/v1/openai-tts
  Body: { text: "...", voice: "nova", speed: 1.0 }
  ↓
Supabase Edge Function calls OpenAI API
  ↓
Returns MP3 audio
  ↓
Browser plays MP3 with <audio> element
  ↓
User hears confirmation!
```

---

## Voice Options

You can change the voice by editing `web-voice-provider.js` line 207:

```javascript
voice: 'nova',  // Options: alloy, echo, fable, onyx, nova, shimmer
```

**Voice samples:**
- **alloy** - Neutral, balanced
- **echo** - Male, clear
- **fable** - British, expressive
- **onyx** - Deep, authoritative
- **nova** - Female, friendly (default)
- **shimmer** - Female, warm

---

## Troubleshooting

### "SUPABASE_URL not configured"

**Fix:** Add to `index.html`:
```html
<script>
  window.SUPABASE_URL = 'https://your-project.supabase.co';
</script>
```

### "TTS API error: 401"

**Cause:** OpenAI API key not set

**Fix:**
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase functions deploy openai-tts
```

### Falls back to Web Speech API

**Cause:** Supabase function not deployed or erroring

**Check:**
```bash
# View logs
supabase functions logs openai-tts --follow

# Test endpoint manually
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/openai-tts" \
  -H "Content-Type: application/json" \
  -d '{"text":"test"}'
```

### No audio plays

**Cause:** Browser autoplay policy

**Fix:** User needs to interact with page first (click/tap anything)

---

## Next Steps

### Phase 1: TTS Only (Current)
- [x] Build Supabase Edge Function
- [x] Update WebVoiceProvider
- [ ] Deploy function
- [ ] Test on PC
- [ ] Enjoy high-quality voice!

### Phase 2: Android/Fire TV
- [ ] Update AndroidVoiceProvider (similar changes)
- [ ] Test on Fire TV
- [ ] Same voice everywhere!

### Phase 3: Speech-to-Text
- [ ] Deploy whisper-stt function
- [ ] Update providers to send audio
- [ ] Test voice commands

---

## Code Reference

### Calling TTS from anywhere

```javascript
import VoiceService from './core/voice-service.js';

// Speak text (auto-selects cloud or web TTS)
await VoiceService.speak("Hello world");

// Check if speaking
const speaking = VoiceService.isSpeaking();

// Stop speaking
VoiceService.stopSpeaking();
```

### Configuration

```javascript
// config.js
export const SUPABASE_CONFIG = {
  edgeFunctions: {
    openaiTTS: 'openai-tts',    // ✅ Added
    whisperSTT: 'whisper-stt'   // ✅ Added
  }
};
```

### WebVoiceProvider

```javascript
// web-voice-provider.js
async speak(text) {
  // Calls: POST {SUPABASE_URL}/functions/v1/openai-tts
  // Body: { text, voice: 'nova', speed: 1.0 }
  // Returns: MP3 audio blob
  // Plays with Audio() element
  // Falls back to Web Speech API on error
}
```

---

## Cost Estimate

| Action | Cost | Notes |
|--------|------|-------|
| "Dark mode" | $0.0003 | 9 characters |
| "Theme changed to dark mode" | $0.0004 | 27 characters |
| Typical response | ~$0.0004 | ~20-30 chars |
| **100 responses** | **$0.04** | With caching |
| **1000 responses** | **$0.40** | Realistic monthly |

**Free tier:** $5 credit = ~12,500 responses!

---

## Related Files

- **OpenAI Setup:** `.reference/build-plans/openai-api-setup-guide.md`
- **Cloud Architecture:** `.reference/build-plans/cloud-voice-architecture.md`
- **Deployment Guide:** `supabase/functions/README-VOICE-FUNCTIONS.md`
- **Chat Interface Design:** `.reference/build-plans/voice-chat-interface-design.md`
- **Updated Provider:** `js/core/voice/web-voice-provider.js`

---

**Ready to test!** Just deploy the Supabase function and add the Supabase URL to your config.
