# ElevenLabs API Setup Guide

## Step 1: Create Account & Get API Key

1. **Sign up at ElevenLabs:**
   - Go to https://elevenlabs.io/
   - Click "Sign Up" (free tier available)
   - Verify your email

2. **Get your API key:**
   - Go to https://elevenlabs.io/app/settings/api-keys
   - Click "Generate API Key"
   - Copy the key (starts with `xi_...`)
   - **Save it securely** - you won't see it again

3. **Check your free tier limits:**
   - Free tier: 10,000 characters/month
   - Paid tiers start at $5/month (30,000 chars)
   - Creator: $22/month (100,000 chars)

## Step 2: Choose a Voice

ElevenLabs has dozens of high-quality voices. Here are some recommended options:

### Pre-made Voices (Instant Use):

1. **Browse voices:**
   - Go to https://elevenlabs.io/app/voice-library
   - Listen to samples
   - Find a voice that fits Dashie's personality

2. **Get the Voice ID:**
   - Click on a voice you like
   - Copy the **Voice ID** (looks like: `21m00Tcm4TlvDq8ikWAM`)

### Recommended Voices for Dashie:

**Female Voices:**
- **Rachel** (21m00Tcm4TlvDq8ikWAM) - Calm, clear, professional
- **Domi** (AZnzlk1XvdvUeBnXmlld) - Warm, friendly, conversational
- **Bella** (EXAVITQu4vr4xnSDxMaL) - Young, energetic, friendly

**Male Voices:**
- **Adam** (pNInz6obpgDQGcFmaJgB) - Deep, confident, clear
- **Antoni** (ErXwobaYiN019PkySvjV) - Well-rounded, versatile

**Neutral/Robotic:**
- **Freya** (jsCqWAovK2LkecY7zXl4) - Clear, precise, assistant-like

### Testing Voices:

You can test voices before choosing:
```bash
curl -X POST https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM \
  -H "xi-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello! I am Dashie, your smart home assistant.",
    "model_id": "eleven_flash_v2_5"
  }' \
  --output test-voice.mp3
```

Then play `test-voice.mp3` to hear the voice.

## Step 3: Add API Key to Supabase

Once you have your API key:

1. **Add to Supabase secrets:**
```bash
supabase secrets set ELEVENLABS_API_KEY=xi_your_key_here
```

2. **Verify it's set:**
```bash
supabase secrets list
```

You should see:
- `OPENAI_API_KEY` (existing)
- `ELEVENLABS_API_KEY` (new)

## Step 4: Choose Voice ID

Once you've tested voices and picked one, you'll need the Voice ID. Common format:
- Voice ID: `21m00Tcm4TlvDq8ikWAM` (Rachel - recommended starting point)

We'll configure this in the edge function.

---

## Pricing Overview

### Free Tier:
- 10,000 characters/month
- Good for testing

### Starter ($5/month):
- 30,000 characters/month
- ~$0.167 per 1K chars
- Good for personal projects

### Creator ($22/month):
- 100,000 characters/month
- ~$0.220 per 1K chars
- Voice cloning included

### Pro ($99/month):
- 500,000 characters/month
- ~$0.198 per 1K chars
- Commercial use

### API Pricing (pay-as-you-go):
- Flash v2.5 model: **$0.075 per 1K characters**
- Standard model: $0.30 per 1K characters

**For Dashie:** If you have low usage (< 100 voice interactions/day), the free tier or Starter plan is sufficient.

---

## Expected Character Usage

Estimate for Dashie:
- Average response: ~30 characters ("The weather is sunny and 72 degrees")
- 100 interactions/day = 3,000 chars/day = 90,000 chars/month
- **Recommended tier: Creator ($22/month)**

---

## What's Next

Once you have:
1. ✅ API key (starts with `xi_...`)
2. ✅ Voice ID (e.g., `21m00Tcm4TlvDq8ikWAM`)

Let me know and I'll:
1. Create the ElevenLabs edge function
2. Update the client code
3. Test the integration

---

## Quick Start Commands

```bash
# 1. Set API key in Supabase
supabase secrets set ELEVENLABS_API_KEY=xi_your_actual_key_here

# 2. Verify it's set
supabase secrets list

# 3. Ready to deploy edge function!
```

---

## Recommended Starting Voice

**Rachel** (Voice ID: `21m00Tcm4TlvDq8ikWAM`)
- Clear, professional female voice
- Great for assistant/dashboard use
- Calm and friendly tone
- Most popular ElevenLabs voice

You can always change the voice later by updating the edge function config!
