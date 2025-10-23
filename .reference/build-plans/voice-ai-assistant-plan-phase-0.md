# Phase 0: Technical Feasibility Tests - Quick Reference

**Timeline:** Week 1-2 (before main implementation)  
**Goal:** Validate critical technical assumptions before building full system

---

## The Three Critical Questions

### 1. Wake Word Detection Feasibility
**Question:** Can we reliably detect wake words via USB microphone on Fire TV?

**Test App:** Minimal Android app with wake word detection + transcription  
**Duration:** 2-3 days  
**Success Criteria:**
- Wake word detection: >90% from 6-10 feet
- False positives: <3 per hour
- Transcription accuracy: >80%

**Test Procedure:**
```
1. Say wake word from various distances (3ft, 6ft, 10ft)
2. Record success rates
3. Test with background noise (TV, conversation)
4. Measure false positives over 2-hour period
5. Test common phrases:
   - "Where is Mary?"
   - "What's the weather today?"
   - "Show me the calendar"
```

---

### 2. Text-to-Speech Quality
**Question:** Is Android TTS voice quality acceptable for family use?

**Test App:** Android app with text input + TTS controls  
**Duration:** 1-2 days  
**Success Criteria:**
- Voice clarity: >4/5 rating from family
- Natural cadence (no robotic pauses)
- Audible from 10-15 feet away

**Test Messages:**
```
Short:
- "Mary is at the grocery store."
- "The weather today is 75 degrees and sunny."
- "You have 3 calendar events today."

Long:
- "Mary is currently at Publix on Main Street, about 2 miles from home. 
   She was last there 5 minutes ago."

Errors:
- "Sorry, I didn't catch that. Could you try again?"
- "I need an internet connection for that command."
```

**Test Procedure:**
```
1. Play preset messages at various rates/pitches
2. Have 3-5 family members rate each (1-5 scale):
   - Clarity
   - Natural sound
   - Pleasantness
   - Understandability
3. Test in living room at viewing distance
4. Compare to Alexa/Google Assistant
5. Identify optimal rate/pitch settings
```

---

### 3. Claude API Framework
**Question:** Can we build a prompt that Claude understands reliably?

**Test App:** Node.js terminal REPL  
**Duration:** 2-3 days  
**Success Criteria:**
- Command matching: >90% accuracy
- JSON parsing: >95% success rate
- Response latency: <3 seconds

**Test Commands:**
```
Dashboard commands (should match menu):
✓ "where is Mary"
✓ "show Mary's calendar"
✓ "what's the weather"
✓ "show photos from last week"
✓ "navigate to calendar view"
✓ "remind me to pick up groceries at 5pm"

Off-menu queries (should return independent_response):
✓ "what time do the Buccaneers play"
✓ "who won the election"
✓ "what's 15% of 250"

Ambiguous commands (test edge cases):
✓ "Mary" (incomplete)
✓ "where" (missing subject)
✓ "show me" (missing object)
```

**Test Procedure:**
```
1. Run: node test-claude-api.js
2. Test each command type
3. Verify correct action type and parameters
4. Measure latency over 20 requests
5. Optimize system prompt
6. Test error scenarios
```

---

## Decision Gate (End of Week 2)

### Scoring System

| Component | Green (Go) | Yellow (Adjust) | Red (Stop) |
|-----------|-----------|----------------|------------|
| **Wake Word** | >90% detection<br><3 false pos/hr | 80-90% detection<br>3-5 false pos/hr | <80% detection<br>>5 false pos/hr |
| **TTS Quality** | >4/5 family rating | 3-4/5 rating | <3/5 rating |
| **Claude Framework** | >90% accuracy | 80-90% accuracy | <80% accuracy |

### Possible Outcomes

✅ **All Green → Proceed to Phase 1 (Week 3)**
- All critical components validated
- Build complete system as planned
- 10-week timeline to production

🟡 **Some Yellow → Adjust & Proceed (Week 4)**
- Tune wake word sensitivity
- Adjust TTS settings
- Refine Claude prompts
- Add 1-2 weeks to timeline

🔴 **Any Red → Re-evaluate**
- Consider alternative wake word engines
- Explore cloud TTS services
- Simplify Claude prompts
- Architecture changes needed
- Timeline extends significantly

---

## What You Need

### Hardware
- [ ] Fire TV device (Stick 4K or Cube)
- [ ] USB microphone ($30-50)
- [ ] USB OTG adapter
- [ ] Android development machine

### Software
- [ ] Android Studio (latest version)
- [ ] Node.js 16+
- [ ] Git

### API Keys
- [ ] Picovoice Porcupine access key
- [ ] Google Cloud Speech API key
- [ ] Anthropic Claude API key

---

## Deliverables

After Phase 0, you will have:

1. **Three working test applications:**
   - `dashie-wake-word-test.apk`
   - `dashie-tts-quality-test.apk`
   - `test-claude-api.js` (Node.js script)

2. **Technical feasibility report:**
   - Quantitative metrics for all three tests
   - Family feedback on TTS quality
   - Claude accuracy test results
   - Recommendations for adjustments

3. **Go/No-Go decision:**
   - Clear assessment of technical viability
   - Risk mitigation strategies
   - Updated timeline and architecture (if needed)

4. **Optimized configurations:**
   - Best wake word sensitivity setting
   - Optimal TTS rate/pitch/voice
   - Refined Claude system prompt

---

## Timeline

```
Week 1:
├─ Mon-Tue: Setup + Get API keys
├─ Wed-Fri: Build & Test Wake Word Detection
└─ Deliverable: Wake word test results

Week 2:
├─ Mon-Tue: Build & Test TTS Quality
├─ Wed-Thu: Build & Test Claude Framework
├─ Fri: Analyze results, make Go/No-Go decision
└─ Deliverable: Phase 0 feasibility report + decision

Week 3 (if Green):
└─ Begin Phase 1 implementation
```

---

## Quick Start Commands

### Test 1: Wake Word
```bash
# Install on Fire TV
adb install dashie-wake-word-test.apk

# Watch logs
adb logcat | grep -E "WakeWord|Transcription"

# Test procedure:
# 1. Say wake word from 3ft, 6ft, 10ft
# 2. Record success rate for each
# 3. Let it run 2 hours, count false positives
```

### Test 2: TTS Quality
```bash
# Install on Fire TV
adb install dashie-tts-quality-test.apk

# Test procedure:
# 1. Open app on TV
# 2. Type or select preset messages
# 3. Adjust rate/pitch
# 4. Have family rate quality (1-5)
# 5. Note optimal settings
```

### Test 3: Claude Framework
```bash
# Run test script
node test-claude-api.js

# Interactive mode:
> where is Mary
> show calendar
> what time do the Buccaneers play

# Batch test:
node test-claude-api.js --batch test-commands.txt

# Check results:
cat test-results.json
```

---

**Remember:** The goal of Phase 0 is to **fail fast and cheaply**. Better to discover problems in 2 weeks of isolated testing than 8 weeks into building the full system.

**If any component fails to meet criteria, you can:**
- Adjust parameters (sensitivity, prompt, etc.)
- Try alternative approaches (different wake word engine, cloud TTS)
- Simplify requirements (reduce accuracy threshold)
- Re-evaluate architecture

**Success in Phase 0 means confidence to invest 10+ weeks building the full system.**

---

**Next Step:** Set up development environment and begin Test #1 (Wake Word Detection)