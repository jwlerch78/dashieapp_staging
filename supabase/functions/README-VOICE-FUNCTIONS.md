# Voice Edge Functions Deployment Guide

## New Functions

Two new Supabase Edge Functions for OpenAI voice capabilities:

1. **`openai-tts`** - Text-to-speech (converts text → MP3 audio)
2. **whisper-stt`** - Speech-to-text (converts audio → text transcript)

---

## Prerequisites

### 1. OpenAI API Key

Follow the guide at `.reference/build-plans/openai-api-setup-guide.md` to:
- Create OpenAI account
- Get API key (starts with `sk-...`)
- Set up billing

### 2. Add API Key to Supabase Secrets

```bash
# Add OpenAI API key as secret
supabase secrets set OPENAI_API_KEY=sk-your-key-here

# Verify it was added
supabase secrets list
```

---

## Deployment

### Deploy Both Functions

```bash
# Deploy TTS function
supabase functions deploy openai-tts

# Deploy Whisper function
supabase functions deploy whisper-stt
```

### Deploy Individual Function

```bash
# Just TTS (for testing)
supabase functions deploy openai-tts

# Just Whisper (for later)
supabase functions deploy whisper-stt
```

---

## Testing

### Test TTS Function (Local)

```bash
# Serve function locally
supabase functions serve openai-tts

# In another terminal, test it:
curl -X POST http://localhost:54321/functions/v1/openai-tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello from Dashie!",
    "voice": "nova",
    "speed": 1.0
  }' \
  --output test-speech.mp3

# Play the audio
afplay test-speech.mp3  # macOS
# or: start test-speech.mp3  # Windows
```

### Test TTS Function (Deployed)

```bash
# Get your Supabase URL
SUPABASE_URL="https://your-project.supabase.co"

curl -X POST "$SUPABASE_URL/functions/v1/openai-tts" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Theme changed to dark mode",
    "voice": "nova",
    "speed": 1.0
  }' \
  --output deployed-test.mp3

afplay deployed-test.mp3
```

### Test Whisper Function (Local)

```bash
# Serve function locally
supabase functions serve whisper-stt

# Record a test audio or use existing file
# Then test:
curl -X POST http://localhost:54321/functions/v1/whisper-stt \
  -F "audio=@/path/to/audio.wav" \
  -F "language=en"

# Should return JSON:
# { "transcript": "your spoken text here", ... }
```

### Test Whisper Function (Deployed)

```bash
SUPABASE_URL="https://your-project.supabase.co"

curl -X POST "$SUPABASE_URL/functions/v1/whisper-stt" \
  -F "audio=@/path/to/audio.wav" \
  -F "language=en"
```

---

## Function Endpoints

Once deployed, your functions will be available at:

```
https://YOUR_PROJECT.supabase.co/functions/v1/openai-tts
https://YOUR_PROJECT.supabase.co/functions/v1/whisper-stt
```

Replace `YOUR_PROJECT` with your actual Supabase project ID.

---

## API Reference

### openai-tts

**Endpoint:** `POST /functions/v1/openai-tts`

**Request Body:**
```json
{
  "text": "Text to convert to speech",
  "voice": "nova",        // Optional: alloy, echo, fable, onyx, nova, shimmer
  "speed": 1.0            // Optional: 0.25 - 4.0
}
```

**Response:**
- Content-Type: `audio/mpeg`
- Body: MP3 audio binary data

**Caching:**
- Responses with text < 100 characters are cached in memory
- Cache header: `X-Cache: HIT` or `X-Cache: MISS`

**Example (JavaScript):**
```javascript
const response = await fetch('https://your-project.supabase.co/functions/v1/openai-tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello world',
    voice: 'nova',
    speed: 1.0
  })
});

const audioBlob = await response.blob();
const audio = new Audio(URL.createObjectURL(audioBlob));
audio.play();
```

---

### whisper-stt

**Endpoint:** `POST /functions/v1/whisper-stt`

**Request:** multipart/form-data with:
- `audio`: Audio file (WAV, MP3, M4A, etc.) - max 25MB
- `language`: Optional language code (e.g., 'en')

**Response:**
```json
{
  "transcript": "The transcribed text",
  "language": "en",
  "duration": 2.5,
  "metadata": {
    "audio_size": 40960,
    "audio_type": "audio/wav"
  }
}
```

**Example (JavaScript - Browser):**
```javascript
// From MediaRecorder
const audioBlob = new Blob(chunks, { type: 'audio/webm' });

const formData = new FormData();
formData.append('audio', audioBlob, 'recording.webm');
formData.append('language', 'en');

const response = await fetch('https://your-project.supabase.co/functions/v1/whisper-stt', {
  method: 'POST',
  body: formData
});

const { transcript } = await response.json();
console.log('You said:', transcript);
```

**Example (Android - Kotlin):**
```kotlin
val audioFile = File("path/to/audio.wav")

val requestBody = MultipartBody.Builder()
    .setType(MultipartBody.FORM)
    .addFormDataPart(
        "audio",
        "audio.wav",
        audioFile.asRequestBody("audio/wav".toMediaType())
    )
    .addFormDataPart("language", "en")
    .build()

val request = Request.Builder()
    .url("https://your-project.supabase.co/functions/v1/whisper-stt")
    .post(requestBody)
    .build()

val response = client.newCall(request).execute()
val json = JSONObject(response.body?.string() ?: "{}")
val transcript = json.getString("transcript")
```

---

## Monitoring

### View Logs

```bash
# View TTS logs
supabase functions logs openai-tts

# View Whisper logs
supabase functions logs whisper-stt

# Follow logs in real-time
supabase functions logs openai-tts --follow
```

### Check Function Status

```bash
# List all functions
supabase functions list

# Should show:
# - openai-tts (deployed)
# - whisper-stt (deployed)
```

---

## Troubleshooting

### "OPENAI_API_KEY not found"

**Cause:** Secret not set in Supabase

**Fix:**
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key-here
supabase functions deploy openai-tts  # Redeploy to pick up secret
```

### "OpenAI API error: 401"

**Cause:** Invalid API key

**Fix:**
- Check your key at https://platform.openai.com/api-keys
- Regenerate if needed
- Update secret: `supabase secrets set OPENAI_API_KEY=sk-new-key`
- Redeploy function

### "OpenAI API error: 429"

**Cause:** Rate limit exceeded

**Fix:**
- Wait 60 seconds (free tier: 3 requests/minute)
- Upgrade to paid tier (60 requests/minute)
- Add retry logic with exponential backoff

### TTS works locally but not when deployed

**Cause:** Secret not available in production

**Fix:**
```bash
# Verify secret exists
supabase secrets list

# If missing, set it
supabase secrets set OPENAI_API_KEY=sk-your-key

# Redeploy
supabase functions deploy openai-tts
```

### Audio file too large (Whisper)

**Cause:** File > 25MB

**Fix:**
- Compress audio before sending
- Use lower sample rate (16kHz is sufficient for speech)
- Use mono instead of stereo
- Trim silence from beginning/end

---

## Cost Monitoring

### OpenAI Usage

Check your OpenAI usage:
1. Go to https://platform.openai.com/usage
2. View costs by API (TTS, Whisper)
3. Set up billing alerts

### Supabase Usage

```bash
# Check function invocation count
supabase functions stats openai-tts

# Check bandwidth
supabase functions stats whisper-stt
```

---

## Next Steps

1. ✅ Deploy both functions
2. ✅ Test with cURL commands above
3. ✅ Integrate into JavaScript (WebVoiceProvider)
4. ✅ Integrate into Android (VoiceAssistantManager)
5. ✅ Test on Fire TV
6. 🎉 Enjoy consistent high-quality voice!

---

## Related Documentation

- **OpenAI Setup:** `.reference/build-plans/openai-api-setup-guide.md`
- **Cloud Voice Architecture:** `.reference/build-plans/cloud-voice-architecture.md`
- **Widget Integration:** `js/widgets/voice/VOICE_WIDGET_README.md`
- **Supabase Functions Docs:** https://supabase.com/docs/guides/functions
