# Cloud Voice Architecture for Fire TV Compatibility

**Date:** October 24, 2025
**Purpose:** Replace platform-specific voice APIs with unified cloud-based solution
**Target:** Consistent voice experience across PC, Google TV, and Fire TV

---

## Current Architecture Summary (Voice-Centric)

### Current Flow

```
┌─────────────────────────────────────────────────────────┐
│ Voice Widget (UI)                                       │
│ - Mic button click                                      │
│ - Live transcript display                               │
│ - Status messages                                       │
└────────────┬────────────────────────────────────────────┘
             │ postMessage (action: 'start-listening')
             ↓
┌─────────────────────────────────────────────────────────┐
│ WidgetDataManager.handleVoiceAction()                   │
│ - Receives widget actions                               │
│ - Calls VoiceService methods                            │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────┐
│ VoiceService (Platform Abstraction)                     │
│ - Detects platform (Android vs Web)                     │
│ - Loads appropriate provider                            │
│ - Exposes unified API: startListening(), speak()        │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    ↓                 ↓
┌──────────────┐  ┌──────────────────────┐
│ WebVoice     │  │ AndroidVoice         │
│ Provider     │  │ Provider             │
│              │  │                      │
│ Uses:        │  │ Uses:                │
│ - Web Speech │  │ - DashieNative       │
│   Recognition│  │   .startListening()  │
│ - Web Speech │  │ - DashieNative       │
│   Synthesis  │  │   .speak()           │
└──────────────┘  └──────────────────────┘
       │                    │
       │                    ↓
       │            ┌──────────────────────┐
       │            │ VoiceAssistantManager│
       │            │ (Android Kotlin)     │
       │            │                      │
       │            │ - SpeechRecognizer   │ ❌ NOT ON FIRE TV
       │            │ - TextToSpeech       │ ❌ POOR ON FIRE TV
       │            │ - Porcupine wake     │ ❌ CUSTOM MODEL FAILS
       │            └──────────────────────┘
       │
       ↓ AppComms Events
┌─────────────────────────────────────────────────────────┐
│ VOICE_LISTENING_STARTED                                 │
│ VOICE_PARTIAL_RESULT                                    │
│ VOICE_TRANSCRIPT_RECEIVED ───────────────┐              │
└──────────────────────────────────────────┼──────────────┘
                                           │
                                           ↓
                              ┌───────────────────────────┐
                              │ VoiceCommandRouter        │
                              │ - Keyword matching        │
                              │ - Execute local commands  │
                              │ - Call speak() for TTS    │
                              └───────────────────────────┘
```

### Current Data Flow for Voice Command

1. **User clicks mic button** → Widget sends `postMessage({ action: 'start-listening' })`
2. **WidgetDataManager** → Calls `VoiceService.startListening()`
3. **VoiceService** → Delegates to platform provider
4. **Provider starts recognition** → Emits `VOICE_LISTENING_STARTED` via AppComms
5. **Widget receives event** → Shows "Listening..." + beep
6. **User speaks** → Provider emits `VOICE_PARTIAL_RESULT` events
7. **Widget displays transcript** → Live updates
8. **Recognition completes** → Provider emits `VOICE_TRANSCRIPT_RECEIVED`
9. **VoiceCommandRouter receives transcript** → Processes command
10. **Command executes** → Calls `VoiceService.speak("confirmation")`
11. **Provider speaks** → TTS output
12. **Command executed event** → Widget shows success message

---

## Problems with Current Architecture

### Fire TV Issues

| Component | Issue | Impact |
|-----------|-------|--------|
| **SpeechRecognizer** | Requires Google Play Services | ❌ Not available on Fire TV |
| **TextToSpeech (Google)** | Requires Google services | ❌ Not available / poor quality on Fire TV |
| **Porcupine wake word** | Custom `.ppn` model compatibility | ❌ Fails with error 0x00000136 on Fire TV |
| **AudioRecord** | Raw mic access | ✅ Works on Fire TV! |

### Platform Inconsistency

- **PC**: Poor quality Web Speech API (recognition + TTS)
- **Google TV**: Good quality Android services
- **Fire TV**: Nothing works except raw audio capture

---

## Proposed Cloud-Based Architecture

### New Flow

```
┌─────────────────────────────────────────────────────────┐
│ Voice Widget (UI)                                       │
│ - Mic button click                                      │
│ - Live transcript display                               │
│ - Status messages                                       │
└────────────┬────────────────────────────────────────────┘
             │ postMessage (action: 'start-listening')
             ↓
┌─────────────────────────────────────────────────────────┐
│ WidgetDataManager.handleVoiceAction()                   │
│ - Receives widget actions                               │
│ - Calls VoiceService methods                            │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────┐
│ VoiceService (Platform Abstraction)                     │
│ - Detects platform (Android vs Web)                     │
│ - Loads appropriate provider                            │
│ - NEW: Unified cloud-based voice                        │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    ↓                 ↓
┌──────────────┐  ┌──────────────────────┐
│ WebVoice     │  │ AndroidVoice         │
│ Provider     │  │ Provider             │
│ (NEW)        │  │ (NEW)                │
│              │  │                      │
│ Wake word:   │  │ Wake word:           │
│ - Button     │  │ - OpenWakeWord       │ ✅ ONNX, works on Fire TV
│              │  │                      │
│ STT:         │  │ STT:                 │
│ - Capture    │  │ - Capture raw audio  │ ✅ AudioRecord works
│   browser    │  │   (AudioRecord)      │
│   audio      │  │ - Send to backend    │
│ - Send to    │  │ - Backend → Whisper  │
│   backend    │  │                      │
│              │  │                      │
│ TTS:         │  │ TTS:                 │
│ - Call       │  │ - Call backend       │
│   backend    │  │ - OpenAI TTS API     │ ✅ Same voice everywhere
│ - Play MP3   │  │ - Download MP3       │
│              │  │ - Play with          │
│              │  │   MediaPlayer        │
└──────────────┘  └──────────────────────┘
       │                    │
       └────────┬───────────┘
                ↓
    ┌───────────────────────────┐
    │ Backend API               │
    │ (/api/whisper-stt)        │ ← Audio in → OpenAI Whisper → Transcript out
    │ (/api/openai-tts)         │ ← Text in → OpenAI TTS → MP3 out
    └───────────────────────────┘
                │
                ↓ AppComms Events (same as before)
┌─────────────────────────────────────────────────────────┐
│ VOICE_LISTENING_STARTED                                 │
│ VOICE_PARTIAL_RESULT (optional, may not have)           │
│ VOICE_TRANSCRIPT_RECEIVED ───────────────┐              │
└──────────────────────────────────────────┼──────────────┘
                                           │
                                           ↓
                              ┌───────────────────────────┐
                              │ VoiceCommandRouter        │
                              │ - Same as before          │
                              └───────────────────────────┘
```

---

## Detailed Component Changes

### 1. Android: VoiceAssistantManager Changes

**REMOVE:**
- ❌ `SpeechRecognizer` (Google Play Services dependency)
- ❌ `TextToSpeech` (Google TTS)
- ❌ Porcupine wake word (custom model fails on Fire TV)
- ❌ All `onSpeechResult`, `onPartialResult` callbacks

**KEEP:**
- ✅ `AudioRecord` for raw audio capture
- ✅ Microphone permission handling

**ADD:**
- ✅ OpenWakeWord integration (with "hey jarvis" model for testing)
- ✅ Audio capture → WAV conversion → Send to backend
- ✅ HTTP client for backend API calls
- ✅ MediaPlayer for playing TTS MP3 responses

**New Methods:**

```kotlin
// Wake word detection (OpenWakeWord)
fun initializeWakeWord() {
    // Use OpenWakeWord with ONNX model
    // Model: hey_jarvis.onnx (for testing)
}

fun startWakeWordDetection() {
    // Start OpenWakeWord engine
}

// Speech-to-text (Cloud)
fun startAudioCapture() {
    // 1. Start AudioRecord
    // 2. Capture audio for ~5 seconds or until silence
    // 3. Convert to WAV format
    // 4. Send to backend /api/whisper-stt
    // 5. Receive transcript
    // 6. Trigger onSpeechResult callback (keep for compatibility)
}

// Text-to-speech (Cloud)
fun speak(text: String) {
    // 1. Call backend /api/openai-tts with text
    // 2. Download MP3 audio
    // 3. Play with MediaPlayer
    // 4. Trigger onSpeakingStarted / onSpeakingCompleted callbacks
}
```

**Event Flow:**

```kotlin
// Wake word detected
onWakeWordDetected?.invoke()  // Existing callback
↓
startAudioCapture()  // NEW method
↓
// Audio captured, send to backend
POST /api/whisper-stt with WAV file
↓
// Backend responds with transcript
onSpeechResult?.invoke(transcript)  // Existing callback - JavaScript expects this
↓
// VoiceCommandRouter processes (no changes needed)
↓
// Confirmation needed
speak("Theme changed to dark mode")  // Existing method signature
↓
// NEW: Call backend for TTS
POST /api/openai-tts with text
↓
// Play MP3
onSpeakingStarted?.invoke()  // Existing callback
MediaPlayer plays audio
onSpeakingCompleted?.invoke()  // Existing callback
```

### 2. JavaScript: AndroidVoiceProvider Changes

**Minimal changes** - Keep same event-based API:

```javascript
// AndroidVoiceProvider.js

// KEEP: Event handler setup (no changes)
_setupEventHandler() {
  window.onDashieVoiceEvent = (event, data) => {
    // Same event handling as before
    switch (event) {
      case 'listeningStarted':
        AppComms.emit('VOICE_LISTENING_STARTED');
        break;
      case 'speechResult':  // ← Android still calls this
        AppComms.emit('VOICE_TRANSCRIPT_RECEIVED', data);
        break;
      // ... etc
    }
  };
}

// KEEP: Same API (implementation changes in Android, not here)
startListening() {
  window.DashieNative.startListening();
}

speak(text) {
  window.DashieNative.speak(text);
}

// ADD: Wake word start (Android uses OpenWakeWord now)
startWakeWordDetection() {
  window.DashieNative.startWakeWordDetection();
}
```

**No changes needed because:**
- Android VoiceAssistantManager keeps same JavaScript bridge API
- Backend calls are hidden inside Android implementation
- JavaScript still receives same events (`speechResult`, etc.)

### 3. JavaScript: WebVoiceProvider Changes

**Option A: Keep Web Speech API (simplest)**
- No changes needed
- PC continues using browser APIs for development
- Quality is poor but works for testing

**Option B: Use cloud APIs on web too (consistent)**

```javascript
// WebVoiceProvider.js - NEW cloud-based version

async startListening() {
  AppComms.emit('VOICE_LISTENING_STARTED');

  // 1. Request mic access
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // 2. Record audio using MediaRecorder
  const mediaRecorder = new MediaRecorder(stream);
  const chunks = [];

  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

  mediaRecorder.onstop = async () => {
    // 3. Convert to blob
    const audioBlob = new Blob(chunks, { type: 'audio/webm' });

    // 4. Send to backend
    const formData = new FormData();
    formData.append('audio', audioBlob);

    const response = await fetch('/api/whisper-stt', {
      method: 'POST',
      body: formData
    });

    const { transcript } = await response.json();

    // 5. Emit transcript (same event as before)
    AppComms.emit('VOICE_TRANSCRIPT_RECEIVED', transcript);
  };

  mediaRecorder.start();

  // Stop after 5 seconds or on button press
  setTimeout(() => mediaRecorder.stop(), 5000);
}

async speak(text) {
  // 1. Call backend TTS
  const response = await fetch('/api/openai-tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: 'nova' })
  });

  // 2. Play MP3
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  await audio.play();
}
```

**Recommendation:** Start with Option A (keep Web Speech API on PC), then upgrade to Option B later for consistency.

### 4. Backend API Endpoints

**New endpoints needed:**

```javascript
// /api/whisper-stt - Speech-to-text
app.post('/api/whisper-stt', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file;

    // Convert to format Whisper accepts if needed
    // (webm from browser, wav from Android)

    const formData = new FormData();
    formData.append('file', audioFile.buffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');  // Optional

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    const result = await response.json();
    res.json({ transcript: result.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// /api/openai-tts - Text-to-speech
app.post('/api/openai-tts', async (req, res) => {
  try {
    const { text, voice = 'nova', speed = 1.0 } = req.body;

    // Check cache first
    const cacheKey = `${voice}_${speed}_${text}`;
    if (ttsCache.has(cacheKey)) {
      const cachedMp3 = ttsCache.get(cacheKey);
      res.set('Content-Type', 'audio/mpeg');
      res.set('X-Cache', 'HIT');
      return res.send(cachedMp3);
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',  // or 'tts-1-hd' for higher quality
        voice: voice,
        input: text,
        speed: speed
      })
    });

    const audioBuffer = await response.buffer();

    // Cache common responses
    if (text.length < 100) {  // Only cache short phrases
      ttsCache.set(cacheKey, audioBuffer);
    }

    res.set('Content-Type', 'audio/mpeg');
    res.set('X-Cache', 'MISS');
    res.send(audioBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 5. VoiceCommandRouter (No Changes!)

**Current code works as-is** because:
- Still receives `VOICE_TRANSCRIPT_RECEIVED` events
- Still calls `VoiceService.speak()` for confirmations
- Provider implementation changes are transparent

---

## Migration Strategy

### Phase 1: TTS First (Simplest)

1. ✅ Create backend `/api/openai-tts` endpoint
2. ✅ Update AndroidVoiceProvider `speak()` to call backend
3. ✅ Test on Fire TV - should hear OpenAI voice
4. ✅ (Optional) Update WebVoiceProvider too for consistency

**Result:** All platforms get same high-quality voice

### Phase 2: Wake Word (Fire TV only)

1. ✅ Integrate OpenWakeWord into Android VoiceAssistantManager
2. ✅ Add `hey_jarvis.onnx` model to Android assets
3. ✅ Test wake word detection on Fire TV
4. ✅ (Later) Train custom "hey dashie" model

**Result:** Fire TV wake word works

### Phase 3: Speech-to-Text (Fire TV only)

1. ✅ Create backend `/api/whisper-stt` endpoint
2. ✅ Update Android `startListening()` to:
   - Capture audio with AudioRecord
   - Send to backend
   - Return transcript via existing callback
3. ✅ Test on Fire TV - should recognize speech
4. ✅ (Optional) Add silence detection to stop recording early

**Result:** Fire TV voice commands work end-to-end

### Phase 4: Web Platform (Optional)

1. Update WebVoiceProvider to use cloud APIs
2. Remove Web Speech API dependency
3. Consistent experience across all platforms

---

## Android Code Changes Summary

### VoiceAssistantManager.kt - What to Change

**DELETE these imports:**
```kotlin
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import ai.picovoice.porcupine.Porcupine
import ai.picovoice.porcupine.PorcupineException
```

**ADD these imports:**
```kotlin
import com.rementia.openwakeword.lib.WakeWordEngine
import com.rementia.openwakeword.lib.WakeWordModel
import com.rementia.openwakeword.lib.DetectionMode
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import android.media.MediaPlayer
import java.io.File
```

**DELETE these class variables:**
```kotlin
private var textToSpeech: TextToSpeech? = null
private var speechRecognizer: SpeechRecognizer? = null
private var porcupine: Porcupine? = null
private val PORCUPINE_ACCESS_KEY = "..."
```

**ADD these class variables:**
```kotlin
private var wakeWordEngine: WakeWordEngine? = null
private var wakeWordScope: CoroutineScope? = null
private var audioRecord: AudioRecord? = null
private var mediaPlayer: MediaPlayer? = null
private val httpClient = OkHttpClient()
private val BASE_URL = "https://your-backend-url.com"  // Your backend
```

**REPLACE these methods:**
- `initializeTTS()` → `initializeTTSCloud()`
- `initializeSpeechRecognition()` → DELETE (not needed)
- `initializeWakeWord()` → Use OpenWakeWord version
- `startListening()` → `startAudioCapture()`
- `speak()` → Call backend API
- `stopSpeaking()` → Stop MediaPlayer

---

## Summary

### What's Changing

**Android Native (VoiceAssistantManager):**
- ❌ Remove: SpeechRecognizer, TextToSpeech (Google), Porcupine
- ✅ Add: OpenWakeWord, HTTP client, MediaPlayer
- ✅ Keep: AudioRecord, callback interface

**JavaScript (Providers):**
- ✅ AndroidVoiceProvider: No changes (Android API stays same)
- ✅ WebVoiceProvider: Optional cloud upgrade
- ✅ VoiceService: No changes
- ✅ VoiceCommandRouter: No changes
- ✅ Widget: No changes

**Backend:**
- ✅ Add: `/api/whisper-stt` (Whisper API proxy)
- ✅ Add: `/api/openai-tts` (TTS API proxy)
- ✅ Add: Response caching for common phrases

### Benefits

1. **Consistent voice across all platforms** - Same OpenAI voice everywhere
2. **Fire TV fully supported** - No Google Play Services needed
3. **Better quality** - OpenAI Whisper > Web Speech API
4. **Flexible** - Easy to switch voice models/providers
5. **Minimal JS changes** - Event-driven architecture stays intact

### Costs

- **Whisper STT**: ~$0.006 per minute of audio
- **OpenAI TTS**: ~$0.015 per 1K characters
- **Typical command**: "Dark mode" = 9 chars = $0.0001 TTS + ~$0.001 Whisper = **~$0.001 total**
- **With caching**: Common responses cached = nearly free

---

## Next Steps

1. **Review this architecture** - Any questions or concerns?
2. **Start Phase 1** - Build `/api/openai-tts` backend endpoint
3. **Update Android** - Modify `speak()` to call backend
4. **Test TTS on Fire TV** - Verify OpenAI voice works
5. **Continue to Phase 2** - Wake word with OpenWakeWord
6. **Then Phase 3** - Whisper speech-to-text

Let me know if you want me to start implementing!
