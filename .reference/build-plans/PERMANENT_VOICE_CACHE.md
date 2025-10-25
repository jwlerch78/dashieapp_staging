# Permanent Voice Cache System

**Status:** In Progress
**Created:** 2025-01-24
**Context:** Implement permanent caching for frequently-used TTS phrases to eliminate API costs and provide instant feedback

---

## Overview

Currently, every TTS request hits the ElevenLabs/OpenAI API, costing money and taking time. For common phrases like "Theme changed to dark mode" or voice samples like "Hi, I'm Bella", we should:

1. **Pre-generate once** - Generate audio for all common phrases × all voices
2. **Store in Supabase Storage** - Upload to public CDN bucket
3. **Download on first use** - Fast CDN delivery
4. **Cache locally** - IndexedDB for instant subsequent playback

---

## Architecture

### Three-Tier Cache Strategy

```
1st: IndexedDB (local) → Instant playback
     ↓ (on miss)
2nd: Supabase Storage (CDN) → Fast download (~100ms)
     ↓ (on miss)
3rd: API Generation (fallback) → Slow but always works (~1-2s)
```

### File Structure in Supabase

**Bucket:** `voice-cache` (public, no auth required)

```
voice-cache/
├── manifest.json                    # Index of all cached files
├── bella/
│   ├── voice-sample.mp3            # "Hi, I'm Bella"
│   ├── theme-dark.mp3              # "Theme changed to dark mode"
│   ├── theme-light.mp3             # "Theme changed to light mode"
│   ├── ok.mp3                      # "OK"
│   ├── done.mp3                    # "Done"
│   └── ...
├── rachel/
│   ├── voice-sample.mp3
│   └── ...
├── domi/
│   └── ...
├── adam/
│   └── ...
└── antoni/
    └── ...
```

**Manifest Format (`manifest.json`):**
```json
{
  "version": 1,
  "generated": "2025-01-24T12:00:00Z",
  "voices": {
    "bella": {
      "phrases": [
        {
          "text": "Hi, I'm Bella",
          "file": "bella/voice-sample.mp3",
          "size": 45231,
          "category": "voiceSample"
        },
        {
          "text": "Theme changed to dark mode",
          "file": "bella/theme-dark.mp3",
          "size": 52100,
          "category": "theme"
        }
      ]
    },
    "rachel": { ... }
  }
}
```

---

## Implementation Steps

### Phase 1: Infrastructure Setup ✅ (Partially Complete)

**Files Created:**
- ✅ `js/core/voice/voice-audio-cache.js` - IndexedDB cache manager
- ✅ `js/core/voice/voice-phrase-preloader.js` - Phrase definitions and preloader

**What's Done:**
- IndexedDB cache implementation (local storage layer)
- Common phrase definitions organized by category
- Cache management methods (get, set, delete, clearVoice)

**What's Needed:**
- Integrate with Supabase Storage (tier 2 cache)
- Modify cache to check Supabase before generating

### Phase 2: Supabase Storage Setup ⏸️ (Not Started)

**Tasks:**

1. **Create Supabase Storage Bucket**
   ```sql
   -- Run in Supabase SQL Editor
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('voice-cache', 'voice-cache', true);
   ```

2. **Set Bucket Policies** (public read access)
   ```sql
   CREATE POLICY "Public read access"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'voice-cache');
   ```

3. **Configure CORS** (allow downloads from app domain)

### Phase 3: Audio Pre-Generation Script ⏸️ (Not Started)

**Create:** `scripts/generate-voice-cache.js`

**Purpose:** Generate all common phrases for all voices and upload to Supabase

**Script Requirements:**

1. **Load common phrases** from `voice-phrase-preloader.js`
2. **For each voice** in `AVAILABLE_VOICES`:
   - Generate audio for each phrase using ElevenLabs API
   - Save to local temp directory with naming: `{voiceId}/{slug}.mp3`
   - Upload to Supabase Storage: `voice-cache/{voiceId}/{slug}.mp3`
3. **Generate manifest.json**:
   - List all phrases with metadata (text, file path, size, category)
   - Upload manifest to `voice-cache/manifest.json`
4. **Display summary**:
   - Total phrases generated
   - Total size
   - Estimated cost (API calls made)

**Run Manually:**
```bash
node scripts/generate-voice-cache.js
# Or when adding new phrases:
node scripts/generate-voice-cache.js --voice bella --regenerate
```

**Environment Variables Needed:**
```
ELEVENLABS_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...  # For upload permissions
```

### Phase 4: Integrate Supabase Cache Layer ⏸️ (Not Started)

**Modify:** `js/core/voice/voice-audio-cache.js`

**Add Method:** `downloadFromSupabase(text, voiceId)`

```javascript
async downloadFromSupabase(text, voiceId) {
  // 1. Load manifest (cache in memory)
  // 2. Find phrase in manifest
  // 3. Download from Supabase Storage URL
  // 4. Store in IndexedDB
  // 5. Return blob
}
```

**Update:** `get()` method to check Supabase

```javascript
async get(text, voiceId) {
  // Check IndexedDB first
  let blob = await this._getFromIndexedDB(text, voiceId);
  if (blob) return blob;

  // Check Supabase Storage
  blob = await this.downloadFromSupabase(text, voiceId);
  if (blob) {
    // Cache locally for next time
    await this._setInIndexedDB(text, voiceId, blob);
    return blob;
  }

  // Not cached anywhere
  return null;
}
```

### Phase 5: Integrate with Voice Providers ⏸️ (Not Started)

**Modify:**
- `js/core/voice/android-voice-provider.js`
- `js/core/voice/web-voice-provider.js`

**Update `speak()` method:**

```javascript
async speak(text) {
  const currentVoiceId = this.voiceConfig.defaultVoice.id;

  // 1. Check permanent cache first (IndexedDB → Supabase → API)
  let audioBlob = await voiceAudioCache.get(text, currentVoiceId);

  if (audioBlob) {
    // Play from cache (instant!)
    this._playAudioBlob(audioBlob);
    return;
  }

  // 2. Generate via API (fallback)
  audioBlob = await this._generateViaAPI(text);

  // 3. Cache for future use (if common phrase)
  if (this._isCommonPhrase(text)) {
    await voiceAudioCache.set(text, currentVoiceId, audioBlob);
  }

  // 4. Play
  this._playAudioBlob(audioBlob);
}
```

**Add Helper:** `_isCommonPhrase(text)`
```javascript
_isCommonPhrase(text) {
  // Check if text matches any COMMON_PHRASES
  // Return true if should be permanently cached
}
```

### Phase 6: Voice Sample Playback ⏸️ (Not Started)

**Feature:** When user selects a voice in settings, play sample

**Modify:** `js/modules/Settings/pages/settings-voice-page.js`

**In `handleItemClick()` after voice selection:**

```javascript
async handleItemClick(item) {
  if (item.dataset.setting === 'interface.voiceId') {
    const voiceId = item.dataset.value;

    // ... existing code to update checkmarks ...

    // Play voice sample
    const sampleText = COMMON_PHRASES.voiceSamples[voiceId];
    if (sampleText && window.voiceService) {
      await window.voiceService.speak(sampleText);
    }

    await this.setVoiceId(voiceId);
  }
}
```

### Phase 7: Preload on App Startup ⏸️ (Not Started)

**Modify:** `js/core/initialization/core-initializer.js`

**After VoiceService initialization:**

```javascript
// Preload current voice's phrases in background
const { VoicePhrasePreloader } = await import('../voice/voice-phrase-preloader.js');
const preloader = new VoicePhrasePreloader(VoiceService.provider);

// Non-blocking background preload
preloader.preloadCurrentVoice().catch(err => {
  logger.warn('Failed to preload voice phrases:', err);
});
```

---

## Common Phrases to Cache

**Defined in:** `js/core/voice/voice-phrase-preloader.js`

### Categories:

1. **Voice Samples** (5 phrases × 5 voices = 25 files)
   - "Hi, I'm Bella"
   - "Hi, I'm Rachel"
   - "Hi, I'm Domi"
   - "Hi, I'm Adam"
   - "Hi, I'm Antoni"

2. **Theme Changes** (3 phrases × 5 voices = 15 files)
   - "Theme changed to dark mode"
   - "Theme changed to light mode"
   - "Theme changed to Halloween"

3. **System Responses** (6 phrases × 5 voices = 30 files)
   - "OK"
   - "Done"
   - "Got it"
   - "Settings saved"
   - "No problem"
   - "Sure thing"

4. **Confirmations** (3 phrases × 5 voices = 15 files)
   - "Calendar refreshed"
   - "Photos updated"
   - "Voice settings updated"

5. **Errors** (3 phrases × 5 voices = 15 files)
   - "Sorry, I didn't catch that"
   - "Something went wrong"
   - "Please try again"

**Total:** ~100 audio files (~5-10MB total)

---

## Cost Analysis

### Current (No Caching):
- **Per phrase:** $0.00015 - $0.0003 (ElevenLabs)
- **Common phrases:** Used 10-100x per user per month
- **Wasted cost:** $0.50 - $5.00 per user per month

### With Permanent Cache:
- **One-time generation:** ~$0.03 (100 phrases × $0.0003)
- **Storage cost:** ~$0.01/month (10MB in Supabase)
- **Bandwidth:** Free (included in Supabase plan)
- **Savings:** 99% cost reduction for common phrases

---

## Testing Plan

### Test Cases:

1. **First Load (Cold Cache)**
   - [ ] Phrase not in IndexedDB → Downloads from Supabase
   - [ ] Phrase cached locally after download
   - [ ] Playback is instant on second use

2. **Voice Sample Playback**
   - [ ] Selecting voice plays sample immediately
   - [ ] Correct voice is used
   - [ ] No API call made (cached)

3. **Theme Change Confirmation**
   - [ ] "Theme changed to X" plays instantly
   - [ ] Uses current selected voice
   - [ ] No API call made

4. **Fallback to API**
   - [ ] Unknown phrase still generates via API
   - [ ] No errors or hangs
   - [ ] Optionally cached if under length limit

5. **Cache Management**
   - [ ] Stats show correct count/size
   - [ ] Clear cache works
   - [ ] Switching voices doesn't break cache

### Manual Testing:

```javascript
// Test in browser console:

// Check cache stats
const stats = await voiceAudioCache.getStats();
console.log('Cache stats:', stats);

// Check if phrase is cached
const isCached = await voiceAudioCache.has('Hi, I\'m Bella', 'bella');
console.log('Is cached:', isCached);

// Force download from Supabase
const blob = await voiceAudioCache.downloadFromSupabase('OK', 'bella');
console.log('Downloaded:', blob);

// Play cached phrase
const preloader = new VoicePhrasePreloader(window.voiceService.provider);
await preloader.playCachedPhrase('Done', 'bella');
```

---

## Maintenance

### Adding New Phrases:

1. Add to `COMMON_PHRASES` in `voice-phrase-preloader.js`
2. Run generation script: `node scripts/generate-voice-cache.js --regenerate`
3. Deploy updated manifest.json

### Regenerating All Audio:

```bash
# If ElevenLabs improves quality or you change settings
node scripts/generate-voice-cache.js --force-all
```

### Cache Invalidation:

- Increment `version` in manifest.json
- Client checks version on startup
- Auto-clears local cache if version mismatch

---

## Files Modified/Created

### New Files:
- ✅ `js/core/voice/voice-audio-cache.js` - Cache manager
- ✅ `js/core/voice/voice-phrase-preloader.js` - Phrase definitions
- ⏸️ `scripts/generate-voice-cache.js` - Pre-generation script
- 📄 `.reference/build-plans/PERMANENT_VOICE_CACHE.md` - This document

### Modified Files:
- ⏸️ `js/core/voice/android-voice-provider.js` - Integrate cache
- ⏸️ `js/core/voice/web-voice-provider.js` - Integrate cache
- ⏸️ `js/modules/Settings/pages/settings-voice-page.js` - Play samples
- ⏸️ `js/core/initialization/core-initializer.js` - Preload on startup

### Supabase Changes:
- ⏸️ Create `voice-cache` storage bucket
- ⏸️ Set public read policy
- ⏸️ Upload pre-generated audio files
- ⏸️ Upload manifest.json

---

## Next Steps

1. **Create Supabase Storage bucket** (via Supabase dashboard or SQL)
2. **Build generation script** (`scripts/generate-voice-cache.js`)
3. **Run script to populate cache** (one-time, ~5 minutes)
4. **Integrate Supabase download** in `voice-audio-cache.js`
5. **Update providers** to check cache before API
6. **Add voice sample playback** in settings
7. **Test thoroughly** with all voices
8. **Deploy and monitor** cache hit rates

---

## Future Enhancements

- **Auto-regenerate on voice model updates** (detect ElevenLabs changes)
- **User-specific caching** (personalized phrases)
- **Analytics** (track cache hit rate, most-used phrases)
- **Compression** (use Opus/WebM for smaller files)
- **Progressive loading** (download manifest first, audio on-demand)
- **Service worker** (offline-first approach)

---

## Notes

- Current runtime cache (Map) in providers will stay as tier 0 (fastest)
- IndexedDB cache persists across sessions but can be cleared by user
- Supabase Storage is the source of truth for shared cache
- API generation is always the final fallback
- Cache key format: `{voiceId}:{text}` (case-sensitive)
