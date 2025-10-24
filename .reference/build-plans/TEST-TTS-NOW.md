# TEST TTS NOW - Quick Guide

**Status:** ✅ Edge function deployed, ✅ Code integrated
**Time to test:** 2 minutes

---

## What's Ready

1. ✅ Supabase function deployed: `openai-tts`
2. ✅ OpenAI API key added to Supabase secrets
3. ✅ WebVoiceProvider updated to use your existing Supabase config
4. ✅ Uses your existing `SUPABASE_CONFIG` from `auth-config.js`

---

## Quick Test (Command Line)

Test the edge function directly:

```bash
# Replace with your actual Supabase URL from auth-config.js
# Development: https://cwglbtosingboqepsmjk.supabase.co
# Production: https://cseaywxcvnxcsypaqaid.supabase.co

# Test development
curl -X POST "https://cwglbtosingboqepsmjk.supabase.co/functions/v1/openai-tts" \
  -H "Content-Type: application/json" \
  -d '{"text":"Theme changed to dark mode","voice":"nova"}' \
  --output test-tts.mp3

# Play it
afplay test-tts.mp3  # macOS
# or: start test-tts.mp3  # Windows
```

**Expected:** MP3 file downloads and plays OpenAI voice saying "Theme changed to dark mode"

---

## Test in Dashie (Easiest Way)

### Option 1: Console Test

1. Open Dashie in browser (localhost or deployed)
2. Open browser console (F12)
3. Run this:

```javascript
// Import and test voice service
const VoiceService = (await import('./js/core/voice-service.js')).default;
await VoiceService.speak('Hello from Dashie');
```

**Expected:** You hear "Hello from Dashie" in OpenAI voice

### Option 2: Use Voice Widget (if you have it on page 2)

1. Navigate to page 2
2. Type "dark mode" in the text input (if you added it)
3. OR click mic button and say "dark mode"
4. **Expected:**
   - Theme changes
   - You HEAR "Theme changed to dark mode" in high-quality voice
   - (Much better than Web Speech API!)

---

## Troubleshooting

### "SUPABASE_CONFIG.url not configured"

**This shouldn't happen** - your auth-config.js is already set up correctly.

**Check:** Open console and run:
```javascript
const { SUPABASE_CONFIG } = await import('./js/data/auth/auth-config.js');
console.log('Supabase URL:', SUPABASE_CONFIG.url);
```

Should show: `https://cwglbtosingboqepsmjk.supabase.co` (dev) or `https://cseaywxcvnxcsypaqaid.supabase.co` (prod)

### "TTS API error: 404"

**Cause:** Function not deployed or wrong URL

**Fix:**
```bash
# Verify function exists
supabase functions list
# Should show: openai-tts

# Redeploy if needed
supabase functions deploy openai-tts
```

### "TTS API error: 401" or "OPENAI_API_KEY"

**Cause:** API key not set in Supabase

**Fix:**
```bash
# Check if secret exists
supabase secrets list
# Should show: OPENAI_API_KEY

# If missing, add it:
supabase secrets set OPENAI_API_KEY=sk-your-key

# Redeploy function to pick up secret
supabase functions deploy openai-tts
```

### Audio plays but is silent

**Cause:** Browser volume muted or audio context issue

**Fix:**
- Check browser volume
- Check system volume
- Click anywhere on page first (browser autoplay policy)

### Falls back to Web Speech API

**Check console logs:**
- Should see: `[WebVoiceProvider] Calling OpenAI TTS for: ...`
- Should see: `[WebVoiceProvider] Using Supabase URL: ...`
- Should see: `[WebVoiceProvider] TTS started: ...`

**If you see "Falling back to Web Speech API":**
- Check network tab in browser
- Look for failed request to `/functions/v1/openai-tts`
- Check the error response

---

## What to Look For

### Success Indicators:

**Console:**
```
[WebVoiceProvider] Calling OpenAI TTS for: Theme changed to dark mode
[WebVoiceProvider] Using Supabase URL: https://cwglbtosingboqepsmjk.supabase.co
[WebVoiceProvider] TTS started: Theme changed to dark mode
[WebVoiceProvider] TTS ended
```

**Network tab:**
- POST to `/functions/v1/openai-tts`
- Status: 200
- Response: audio/mpeg (binary data)
- Size: ~20-30 KB

**Audio:**
- High-quality female voice (nova)
- Clear pronunciation
- Much better than Web Speech API!

---

## Next Steps After Testing

### If TTS Works:

1. ✅ Celebrate! You have cloud TTS working
2. 🔄 Test on different browsers (Chrome, Edge, Firefox)
3. 📱 Test on mobile (should use same endpoint)
4. 🔊 Try different voices (edit web-voice-provider.js line 208)
5. 🎨 Wire into your chat widgets
6. 📱 Update Android for Fire TV

### If TTS Fails:

1. Check edge function logs:
   ```bash
   supabase functions logs openai-tts --follow
   ```
2. Test endpoint with cURL (see above)
3. Share error messages and I'll help debug!

---

## Voice Options

Current default: `nova` (female, friendly)

To change, edit `js/core/voice/web-voice-provider.js` line 208:

```javascript
voice: 'nova',  // Change to: alloy, echo, fable, onyx, shimmer
```

**Voice personalities:**
- **alloy** - Neutral, balanced, versatile
- **echo** - Male, clear, professional
- **fable** - British accent, expressive, storytelling
- **onyx** - Deep, authoritative, male
- **nova** - Female, warm, friendly ✅ (current)
- **shimmer** - Female, soft, gentle

---

## Cost Check

After testing, check usage:

1. Go to: https://platform.openai.com/usage
2. Check "Audio" section
3. Should see minimal cost (~$0.001 per test)

---

**Ready to test! Just run the cURL command or console test above.**
