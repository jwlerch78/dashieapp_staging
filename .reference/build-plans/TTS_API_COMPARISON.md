# TTS API Comparison & Recommendations (2025)

## Current Performance Baseline

**OpenAI TTS (current implementation):**
- Latency: ~2.4 seconds total (2088ms API + 262ms blob creation)
- Quality: Good, but not as natural as Google Android TTS
- Cost: $15 per 1M characters (tts-1), $30 per 1M characters (tts-1-hd)
- Voices: 6 voices (alloy, echo, fable, onyx, nova, shimmer)
- Cache: Works well (instant on repeat)

## Top Alternatives for Speed & Quality

### 1. **Cartesia Sonic 2.0** ⚡ FASTEST
**Latency:**
- Time to First Audio (TTFA): **90ms** (half a human blink!)
- Streaming latency: **40ms** (Turbo mode)
- **26x faster than current OpenAI implementation**

**Quality:**
- Natural-sounding, built on state-space models
- Emotion control, speed control via API
- Voice cloning support

**Cost:**
- $46.70 per 1M characters (~3x more than OpenAI tts-1)
- Worth it for 26x speed improvement

**Languages:**
- 15+ languages including English, French

**Best For:** Real-time voice interactions, conversational AI

**Implementation:**
```javascript
// Streaming API - get audio as it's generated
const response = await fetch('https://api.cartesia.ai/tts/bytes', {
  method: 'POST',
  headers: {
    'Cartesia-Version': '2024-06-10',
    'X-API-Key': CARTESIA_API_KEY
  },
  body: JSON.stringify({
    model_id: 'sonic-english',
    transcript: text,
    voice: { mode: 'id', id: 'voice_id_here' },
    output_format: { container: 'mp3', sample_rate: 44100 }
  })
});
```

---

### 2. **ElevenLabs Flash v2.5** 🏆 BEST QUALITY
**Latency:**
- TTFA: **150ms**
- Sub-100ms TTFB in turbo mode
- **16x faster than current OpenAI**

**Quality:**
- **Highest quality** - 4.14 Mean Opinion Score
- Most natural-sounding (often mistaken for human)
- Excels in emotional expression and intonation
- Superior to Google Android TTS in naturalness

**Cost:**
- $0.050 per 1K characters = $50 per 1M characters
- Flash model (fast): $0.075 per 1K characters
- Standard model (highest quality): $0.30 per 1K characters

**Languages:**
- 30+ languages

**Best For:** Customer-facing applications, maximum naturalness

**Trade-offs:**
- More expensive than alternatives
- Worth it for best-in-class quality

---

### 3. **Deepgram Aura-2** 💰 BEST VALUE
**Latency:**
- TTFB: **<200ms**
- Sub-200ms latency ideal for real-time
- **12x faster than current OpenAI**

**Quality:**
- Enterprise-grade quality
- 60% preference in customer service testing
- Very natural, though not quite ElevenLabs level

**Cost:**
- **$0.030 per 1K characters = $30 per 1M characters**
- Same price as OpenAI tts-1-hd, but 12x faster
- Best price/performance ratio

**Languages:**
- Multiple languages supported

**Best For:** Enterprise apps, cost-sensitive projects, good balance

---

### 4. **PlayHT Turbo**
**Latency:**
- <300ms generation time
- **8x faster than current OpenAI**

**Quality:**
- Very good quality
- Natural-sounding voices

**Cost:**
- Mid-range pricing

**Best For:** Alternative to above options

---

### 5. **Google Cloud TTS (Neural2/WaveNet)**
**Latency:**
- Higher latency than streaming models
- Similar to OpenAI

**Quality:**
- Neural2 voices approach ElevenLabs quality
- Very natural (Android uses this)
- Excellent for non-conversational use

**Cost:**
- WaveNet: $16 per 1M characters
- Neural2: $16 per 1M characters
- Standard: $4 per 1M characters

**Best For:** Batch processing, non-real-time applications

---

## Recommendation

### For Dashie Dashboard:

**Primary Choice: Cartesia Sonic 2.0**
- **90ms latency** (vs current 2400ms) = **26x faster**
- Good quality, extremely fast
- Perfect for voice command responses
- Cost increase acceptable for speed gain

**Alternative: Deepgram Aura-2**
- **<200ms latency** (vs current 2400ms) = **12x faster**
- Great quality + best value
- Same price as OpenAI HD, much faster
- Excellent enterprise support

**Premium Option: ElevenLabs Flash v2.5**
- **150ms latency** + **best quality**
- Most natural-sounding (beats Android)
- Worth premium for customer-facing features
- Use for important responses

### Hybrid Strategy (Best of Both Worlds):

```javascript
// Use ElevenLabs Flash for important/long responses (max quality)
if (text.length > 50 || isImportantResponse) {
  await callElevenLabsFlash(text);
}
// Use Cartesia Sonic for quick responses (max speed)
else {
  await cartesiaSonic(text);
}
```

---

## Implementation Priority

### Phase 1: Quick Win (Cartesia Sonic)
- Implement Cartesia Sonic edge function
- Replace OpenAI with Cartesia for all TTS
- **Expected result:** 2400ms → 90ms (26x faster)
- Cost increase: ~$15 → ~$47 per 1M chars

### Phase 2: Quality Upgrade (ElevenLabs)
- Add ElevenLabs Flash as secondary option
- Use for important/customer-facing responses
- Keep Cartesia for quick responses
- **Expected result:** Best quality + best speed

### Phase 3: Optimization
- Pre-cache common phrases with both providers
- Smart routing based on response type
- Monitor usage and costs

---

## Cost Analysis (per 1M characters)

| Provider | Model | Cost | Latency | Quality | Value |
|----------|-------|------|---------|---------|-------|
| OpenAI | tts-1 (current) | $15 | 2400ms | Good | ⭐⭐⭐ |
| OpenAI | tts-1-hd | $30 | 2400ms | Better | ⭐⭐ |
| **Cartesia** | **Sonic 2.0** | **$47** | **90ms** | **Very Good** | **⭐⭐⭐⭐⭐** |
| **Deepgram** | **Aura-2** | **$30** | **200ms** | **Great** | **⭐⭐⭐⭐⭐** |
| **ElevenLabs** | **Flash** | **$50** | **150ms** | **Excellent** | **⭐⭐⭐⭐** |
| ElevenLabs | Standard | $300 | 500ms | Best | ⭐⭐ |

---

## Expected User Experience Improvement

**Current (OpenAI):**
```
User: "What's the weather?"
[2.4 second pause]
Dashie: "The weather is sunny and 72 degrees"
```

**With Cartesia Sonic:**
```
User: "What's the weather?"
[0.09 second pause - barely noticeable]
Dashie: "The weather is sunny and 72 degrees"
```

**With ElevenLabs Flash:**
```
User: "What's the weather?"
[0.15 second pause - feels instant]
Dashie: [Most natural voice] "The weather is sunny and 72 degrees"
```

---

## Next Steps

1. **Get Cartesia API key** - cartesia.ai/signup
2. **Create Cartesia edge function** - Similar to openai-tts
3. **Test latency improvement** - Should see 26x speedup
4. **Evaluate quality** - Compare naturalness to OpenAI/Android
5. **Consider ElevenLabs** - If quality is priority over cost

---

## Android Voice Quality Note

You mentioned Android's Google TTS is more natural than OpenAI. Here's why:

- **Android uses Google Neural2 or WaveNet** - High-quality voices
- **OpenAI TTS is decent but not top-tier** for naturalness
- **ElevenLabs Flash > Google Neural2 > OpenAI** in quality rankings
- **Cartesia Sonic ≈ OpenAI** in quality, but 26x faster

**Recommendation:** Use ElevenLabs Flash to match/exceed Android quality while maintaining cloud consistency.
