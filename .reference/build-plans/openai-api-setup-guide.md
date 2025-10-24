# OpenAI API Setup Guide

**Purpose:** Get OpenAI API credentials for Whisper (speech-to-text) and TTS (text-to-speech)
**Estimated Time:** 10 minutes
**Cost:** Free trial ($5 credit), then pay-as-you-go

---

## What You Need

For Dashie voice features, you'll need:

1. **OpenAI API Key** - To call Whisper and TTS APIs
2. **Billing setup** - Credit card (free $5 credit for new accounts)
3. **Backend deployment** - Somewhere to run your API proxy (see Backend Options below)

---

## Step 1: Create OpenAI Account

### 1.1 Sign Up

1. Go to: https://platform.openai.com/signup
2. Sign up with email or Google/Microsoft account
3. Verify your email address

### 1.2 Add Payment Method

1. Go to: https://platform.openai.com/account/billing/overview
2. Click **"Set up paid account"** or **"Add payment method"**
3. Enter credit card details
4. **Note:** New accounts get $5 free credit (expires after 3 months)

**Pricing (as of 2024):**
- **Whisper (speech-to-text)**: $0.006 per minute of audio (~$0.03 per 5 minutes)
- **TTS (text-to-speech)**: $15 per 1M characters ($0.015 per 1K characters)
- **Example cost**: 100 voice commands with responses = ~$0.60

---

## Step 2: Get API Key

### 2.1 Generate Key

1. Go to: https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Name it: `Dashie Voice API`
4. Click **"Create secret key"**
5. **IMPORTANT:** Copy the key immediately (starts with `sk-...`)
   - You can only see it once!
   - If you lose it, you'll need to create a new one

### 2.2 Secure Your Key

**⚠️ NEVER commit your API key to git!**

**Store it securely:**
```bash
# Add to .env file (create if it doesn't exist)
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# Add .env to .gitignore
echo ".env" >> .gitignore
```

**Verify it's not tracked:**
```bash
git status
# Should NOT see .env in the list
```

---

## Step 3: Test Your Key (Optional but Recommended)

### Quick Test with cURL

Test TTS API:
```bash
curl https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1",
    "voice": "nova",
    "input": "Hello from Dashie!"
  }' \
  --output test-speech.mp3

# If successful, test-speech.mp3 will be created
# Play it to verify:
# macOS: afplay test-speech.mp3
# Windows: start test-speech.mp3
```

Test Whisper API (requires an audio file):
```bash
# Download a test audio file first
curl -o test-audio.mp3 https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav

# Test Whisper
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -F file="@test-audio.mp3" \
  -F model="whisper-1"

# Should return JSON with transcript
```

---

## Step 4: Choose Your Backend Option

You need a backend to proxy OpenAI API calls (to keep your API key secret). You have **3 options**:

### Option A: Vercel Edge Functions (Recommended for Dashie)

**Pros:**
- ✅ Already using Vercel for hosting
- ✅ Free tier includes 100GB bandwidth
- ✅ Edge functions = fast response times
- ✅ Easy deployment (git push)
- ✅ Built-in environment variables

**Cons:**
- ⏱️ Edge functions have 10-second timeout (should be fine for TTS)
- ⚠️ Whisper API can take 2-5 seconds (might approach limit)

**Setup:**
1. Install Vercel CLI: `npm i -g vercel`
2. Add API key to Vercel:
   ```bash
   vercel env add OPENAI_API_KEY
   # Choose: Production, Preview, Development (select all)
   # Paste your API key when prompted
   ```
3. Create `api/` folder in your project (I'll build the endpoints)
4. Deploy: `vercel --prod`

**Cost:** Free tier covers most usage

---

### Option B: Supabase Edge Functions

**Pros:**
- ✅ Already using Supabase for database
- ✅ Integrated with your existing stack
- ✅ Free tier includes 500K function invocations/month
- ✅ Can access Supabase DB from functions

**Cons:**
- 📦 Requires Deno runtime (different from Node.js)
- 📚 Slightly different API from typical Node.js

**Setup:**
1. Install Supabase CLI: `npm i -g supabase`
2. Initialize: `supabase init`
3. Create function: `supabase functions new openai-tts`
4. Add secret: `supabase secrets set OPENAI_API_KEY=your-key`
5. Deploy: `supabase functions deploy`

**Cost:** Free tier covers most usage

---

### Option C: Traditional Node.js Backend (Separate Server)

**Pros:**
- ✅ Full control
- ✅ No timeout limits
- ✅ Can add complex caching/processing

**Cons:**
- ❌ Requires separate hosting (Heroku, Railway, etc.)
- ❌ Additional cost (~$5-10/month)
- ❌ More complex deployment

**Skip this unless** you need advanced features.

---

## Step 5: Set Usage Limits (Recommended)

Protect yourself from unexpected charges:

### 5.1 Set Monthly Budget

1. Go to: https://platform.openai.com/account/limits
2. Set **"Usage limit"**: $10/month (adjust as needed)
3. Enable **"Email notification"** at 75% and 90%

### 5.2 Monitor Usage

1. Check usage: https://platform.openai.com/usage
2. View by:
   - API calls per day
   - Cost per model (Whisper, TTS)
   - Total spend

---

## Recommended Setup for Dashie

**Based on your current stack, I recommend:**

1. ✅ **OpenAI Account** with $10/month limit
2. ✅ **Vercel Edge Functions** for API proxy (you're already on Vercel!)
3. ✅ **Environment variable** in Vercel for API key

**Folder structure:**
```
dashieapp_staging/
├── api/                    # ← Vercel Edge Functions
│   ├── openai-tts.js      # TTS endpoint
│   └── whisper-stt.js     # Whisper endpoint (future)
├── js/
├── css/
├── .env.local             # ← Local development API key
└── vercel.json            # ← Vercel config
```

---

## Quick Start Checklist

Use this checklist while I build the backend:

- [ ] Create OpenAI account
- [ ] Add payment method
- [ ] Generate API key (starts with `sk-...`)
- [ ] Copy key to safe location
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Add key to Vercel: `vercel env add OPENAI_API_KEY`
- [ ] Create `.env.local` with key for local testing
- [ ] Add `.env.local` to `.gitignore`
- [ ] Set usage limit ($10/month recommended)
- [ ] Test key with cURL (optional)

---

## Security Best Practices

### ✅ DO:
- Store API key in environment variables
- Use `.env.local` for local development
- Add `.env*` to `.gitignore`
- Proxy all API calls through your backend
- Set usage limits in OpenAI dashboard
- Rotate keys if compromised

### ❌ DON'T:
- Commit API keys to git
- Call OpenAI directly from browser/Android
- Share keys in Discord/Slack
- Use the same key for multiple projects
- Hardcode keys in source code

---

## Troubleshooting

### "Insufficient credits" error
- **Cause:** No payment method or free credits expired
- **Fix:** Add credit card at https://platform.openai.com/account/billing

### "Invalid API key" error
- **Cause:** Wrong key, expired key, or key deleted
- **Fix:** Generate new key, update environment variable, redeploy

### "Rate limit exceeded" error
- **Cause:** Too many requests per minute (default: 3 requests/min on free tier)
- **Fix:**
  - Upgrade to paid tier (60 requests/min)
  - Add retry logic with exponential backoff

### API calls not working
- **Check:** Key starts with `sk-`
- **Check:** Environment variable is named `OPENAI_API_KEY`
- **Check:** Backend is deployed and environment variable is set in production

---

## Cost Estimation for Dashie

**Typical usage:**

| Activity | API | Cost per action | Monthly (100 actions) |
|----------|-----|----------------|---------------------|
| Voice command (5 sec) | Whisper | $0.0005 | $0.05 |
| Response (20 chars) | TTS | $0.0003 | $0.03 |
| **Total per command** | - | **$0.0008** | **$0.08** |

**With caching (common responses cached):**
- First "dark mode" command: $0.0008
- Subsequent "dark mode" commands: $0.0005 (Whisper only)
- **Realistic monthly cost for personal use: $0.50 - $2.00**

**Free tier:** $5 credit = ~6,000 voice commands!

---

## Next Steps

Once you have your API key:

1. ✅ Share it with me (via secure method) OR
2. ✅ Set it as `OPENAI_API_KEY` environment variable in Vercel
3. ✅ I'll build the `/api/openai-tts` endpoint
4. ✅ We'll test TTS on your Fire TV
5. ✅ Then add Whisper for speech-to-text

---

## Resources

- **OpenAI Platform:** https://platform.openai.com
- **API Documentation:** https://platform.openai.com/docs/api-reference
- **TTS Guide:** https://platform.openai.com/docs/guides/text-to-speech
- **Whisper Guide:** https://platform.openai.com/docs/guides/speech-to-text
- **Pricing:** https://openai.com/pricing
- **Usage Dashboard:** https://platform.openai.com/usage

---

**Ready to get started?** Follow the checklist above and let me know when you have your API key secured in Vercel!
