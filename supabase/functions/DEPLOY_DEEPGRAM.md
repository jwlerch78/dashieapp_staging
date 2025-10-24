# Deepgram STT Edge Function Deployment Guide

## Overview
This edge function provides ultra-low latency Speech-to-Text using Deepgram's Nova-3 API.

**Performance:**
- Latency: ~200ms end-to-end (vs 6-7s for Whisper)
- Accuracy: 96.7% WER, 54.3% better than competitors
- Model: Nova-3 (fastest, most accurate as of 2025)

## Prerequisites

1. **Deepgram Account**
   - Sign up at: https://deepgram.com
   - Get API key from: https://console.deepgram.com/project/keys

2. **Supabase CLI**
   - Install: `brew install supabase/tap/supabase`
   - Login: `supabase login`

## Deployment Steps

### 1. Set Deepgram API Key as Secret

```bash
# Set the secret in Supabase
supabase secrets set DEEPGRAM_API_KEY=your_deepgram_api_key_here

# Verify secret was set
supabase secrets list
```

### 2. Deploy the Function

```bash
# Deploy from project root
supabase functions deploy deepgram-stt

# Or deploy all functions
supabase functions deploy
```

### 3. Verify Deployment

```bash
# Test the function
curl -i -X POST \
  https://your-project.supabase.co/functions/v1/deepgram-stt \
  -H "Content-Type: multipart/form-data" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -F "audio=@test_audio.wav" \
  -F "language=en"
```

## Function Details

### Request Format
- **Method:** POST
- **Content-Type:** multipart/form-data
- **Headers:**
  - `apikey`: Your Supabase anon key
  - `Authorization`: Bearer YOUR_SUPABASE_ANON_KEY

### Request Body
- `audio` (required): Audio file (WAV, WebM, MP3, etc.)
- `language` (optional): Language code (default: 'en')

### Response Format
```json
{
  "transcript": "The transcribed text",
  "confidence": 0.95,
  "language": "en",
  "duration": 3.5,
  "processing_time_ms": 187,
  "metadata": {
    "audio_size": 541484,
    "audio_type": "audio/wav",
    "model": "nova-3"
  }
}
```

## Configuration

### Deepgram API Parameters (in index.ts)
- `model`: nova-3 (fastest, most accurate)
- `language`: Language code (e.g., 'en', 'es', 'fr')
- `smart_format`: true (auto punctuation/formatting)
- `punctuate`: true (add punctuation)
- `diarize`: false (no speaker detection)
- `utterances`: false (no utterance splitting)

### Supported Audio Formats
- WAV (recommended for best quality)
- WebM
- MP3
- MP4
- OGG
- FLAC

## Pricing

**Deepgram Nova-3:**
- Pay-as-you-go: $0.0043/minute
- Per-second billing (no 15-second blocks like AWS)
- ~36% cheaper than AWS for short utterances (<8 seconds)

**Example costs:**
- 5 second utterance: $0.00036
- 1 minute conversation: $0.0043
- 100 requests/day (5s each): ~$0.18/month

## Troubleshooting

### Error: "Missing apikey header"
- Make sure you're sending both `apikey` and `Authorization` headers
- Use your Supabase anon key (not Deepgram key)

### Error: "DEEPGRAM_API_KEY environment variable is required"
- Deploy the secret: `supabase secrets set DEEPGRAM_API_KEY=...`
- Redeploy function after setting secret

### Slow response times
- Check Deepgram API status: https://status.deepgram.com
- Verify audio file size (smaller = faster)
- Consider using streaming API for real-time

### Low accuracy
- Ensure correct language code
- Use WAV format for best quality
- Check audio quality (16kHz+ sample rate recommended)

## Next Steps

After deployment:
1. Update `config.js` to set `sttProvider: 'deepgram'`
2. Test with PC microphone
3. Add to AndroidVoiceProvider for Fire TV
4. Monitor usage in Deepgram console

## References

- Deepgram API Docs: https://developers.deepgram.com
- Nova-3 Model: https://deepgram.com/product/nova-3
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
