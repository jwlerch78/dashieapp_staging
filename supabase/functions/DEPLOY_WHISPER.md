# Deploy Whisper STT Edge Function

## Prerequisites

✅ You already have:
- OpenAI API key (same one used for TTS)
- Supabase Edge Functions set up

## Deployment Steps

### 1. Verify API Key is Set

The Whisper function uses the same `OPENAI_API_KEY` as the TTS function:

```bash
# Check if it's already set
supabase secrets list
```

You should see `OPENAI_API_KEY` in the list. If not:

```bash
supabase secrets set OPENAI_API_KEY=sk_your_key_here
```

### 2. Deploy the Edge Function

```bash
cd /Users/johnlerch/projects/dashieapp_staging

# Deploy whisper-stt function
supabase functions deploy whisper-stt
```

Expected output:
```
Deploying function whisper-stt...
✓ Function whisper-stt deployed successfully
```

### 3. Test the Edge Function

Test with a simple audio file:

```bash
# Create a test audio file (or use your own)
# For testing, you can download a sample:
# curl -o test-audio.wav https://www2.cs.uic.edu/~i101/SoundFiles/preamble.wav

# Test the function
curl -X POST https://cwglbtosingboqepsmjk.supabase.co/functions/v1/whisper-stt \
  -H "apikey: your_supabase_anon_key" \
  -F "audio=@test-audio.wav" \
  -F "language=en"
```

Expected response:
```json
{
  "transcript": "We the people of the United States...",
  "language": "en",
  "duration": 3.5,
  "processing_time_ms": 450,
  "metadata": {
    "audio_size": 56000,
    "audio_type": "audio/wav"
  }
}
```

## Integration with Fire TV

The Whisper STT function is designed for Fire TV voice input where:
1. **User speaks** (recorded via Android AudioRecord)
2. **Audio sent to Whisper** (via this edge function)
3. **Transcript returned** (processed as voice command)

### Fire TV Flow:

```
Fire TV mic → AudioRecord → Audio blob
                ↓
        Whisper Edge Function
                ↓
        Transcript text
                ↓
        Voice command processing
```

## Audio Format Support

Whisper supports multiple audio formats:
- **WAV** (recommended for Fire TV)
- **MP3**
- **MP4**
- **FLAC**
- **WebM**
- **OGG**

**Fire TV will use:** WAV format from Android AudioRecord

## Performance

Expected latency:
- **Audio upload:** ~50-100ms (depends on audio size)
- **Whisper processing:** ~100-500ms (depends on audio length)
- **Total:** ~150-600ms

**Optimization tips:**
- Keep audio clips short (< 5 seconds for commands)
- Use 16kHz sample rate (good quality, smaller size)
- Use mono audio (stereo not needed for voice commands)

## Cost

OpenAI Whisper pricing:
- **$0.006 per minute** of audio

Example costs:
- 1-second voice command: $0.0001
- 3-second voice command: $0.0003
- 100 commands/day (3 sec each): ~$0.90/month

Very affordable for voice commands!

## Troubleshooting

### Error: "Missing audio file"

**Problem:** Audio not uploaded correctly

**Solution:** Ensure multipart/form-data with field name "audio"
```javascript
const formData = new FormData();
formData.append('audio', audioBlob, 'recording.wav');
```

### Error: "Audio file too large"

**Problem:** File exceeds 25MB limit

**Solution:**
- Keep recordings short (< 10 seconds)
- Use lower sample rate (16kHz is sufficient)
- Use mono instead of stereo

### Slow transcription (> 2 seconds)

**Possible causes:**
- Large audio file (reduce size)
- Long audio clip (keep commands < 5 seconds)
- Network latency (check Fire TV connection)

### Error: 401 Unauthorized

**Problem:** Missing authentication headers

**Solution:** Include apikey header:
```javascript
headers: {
  'apikey': SUPABASE_CONFIG.anonKey
}
```

## Next Steps

Once deployed and tested:

1. ✅ Edge function deployed
2. ✅ Authentication working
3. ⏭️ Update AndroidVoiceProvider to use Whisper
4. ⏭️ Test on Fire TV device
5. ⏭️ Compare accuracy with native Android STT

## Android Integration Example

Example code for Fire TV to send audio to Whisper:

```javascript
// In AndroidVoiceProvider
async _transcribeWithWhisper(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  formData.append('language', 'en');

  const response = await fetch(
    `${SUPABASE_CONFIG.url}/functions/v1/whisper-stt`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey
      },
      body: formData
    }
  );

  const result = await response.json();
  return result.transcript;
}
```

## Monitoring

Check Supabase logs for Whisper function:

```bash
supabase functions logs whisper-stt
```

Look for:
- `🎤 Whisper STT request` - Incoming requests
- `⏱️ Whisper API took Xms` - Processing time
- `✅ Whisper success` - Successful transcriptions
- `🚨 Whisper STT error` - Errors

## Comparison: Whisper vs Android Native STT

| Feature | Whisper (Cloud) | Android Native |
|---------|----------------|----------------|
| **Availability** | All platforms | Android only |
| **Accuracy** | High | Varies by device |
| **Latency** | ~150-600ms | ~100-300ms |
| **Cost** | $0.006/min | Free |
| **Consistency** | Same everywhere | Device-dependent |
| **Offline** | ❌ Needs internet | ✅ Can work offline |

**Recommendation:** Start with Android native STT (already working), add Whisper as an option for better accuracy if needed.

## Status

- ✅ Edge function created
- ✅ Authentication added
- ✅ Performance logging added
- ⏭️ Ready to deploy
- ⏭️ Ready for Android integration
