# Dashie Voice Assistant API Documentation

**Version:** 1.0  
**Last Updated:** October 23, 2025  
**Status:** Beta - Phase 0 Testing Complete

---

## Overview

The Dashie Voice Assistant provides native Android voice capabilities integrated into the web-based dashboard through a JavaScript bridge. This enables Text-to-Speech (TTS), Speech Recognition, and Wake Word Detection directly from the WebView without requiring external APIs or services.

### Key Features

- **Text-to-Speech (TTS)** - Native Android TTS with adjustable rate and pitch
- **Speech Recognition** - Local Android speech recognition with optional live transcription
- **Wake Word Detection** - Continuous listening for "Hey Dashy" using Porcupine AI
- **Zero API Costs** - All processing happens on-device
- **Fire TV Optimized** - Works without Google Play Services

---

## Architecture

### Android Components

The voice assistant is implemented in two Kotlin files:

#### **VoiceAssistantManager.kt**
- **TTS Engine:** Android's native `TextToSpeech` API
- **Speech Recognition:** Android's `SpeechRecognizer` API with partial results support
- **Wake Word Detection:** Porcupine by Picovoice (v3.0.0)
  - Model: `hey_dashy.ppn` (custom trained wake word)
  - Continuous audio processing at 16kHz
  - Low CPU/battery impact
- **Threading:** Executor service for wake word detection, Handler for UI callbacks
- **Permissions:** `RECORD_AUDIO` required, managed in MainActivity

#### **MainActivity.kt**
- **JavaScript Bridge:** `DashieNative` interface exposed to WebView
- **Permission Management:** Runtime microphone permission handling
- **WebView Integration:** Events sent via `window.onDashieVoiceEvent()`

### Communication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Dashboard (JavaScript)               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Call: DashieNative.startListening()                 │  │
│  │  Event: window.onDashieVoiceEvent('speechResult')    │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ JavaScript Bridge
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Android Native (Kotlin/Java)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  VoiceAssistantManager                               │  │
│  │  • TextToSpeech                                      │  │
│  │  • SpeechRecognizer                                  │  │
│  │  • Porcupine Wake Word                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## JavaScript API Reference

All voice functionality is accessed through the `DashieNative` global object, available in the WebView context.

### Event Listener Setup

**All voice events are delivered through a single callback function that must be defined:**

```javascript
window.onDashieVoiceEvent = function(event, data) {
    // Handle voice events here
};
```

#### Event Types

| Event | Data | Description |
|-------|------|-------------|
| `listeningStarted` | `""` | Speech recognition has started |
| `listeningEnded` | `""` | Speech recognition has stopped |
| `partialResult` | `string` | Live transcription (word-by-word) |
| `speechResult` | `string` | Final transcription result |
| `speechError` | `string` | Speech recognition error message |
| `wakeWordDetected` | `""` | "Hey Dashy" was heard |
| `wakeWordError` | `string` | Wake word detection error |
| `voicePermissionDenied` | `""` | Microphone permission was denied |

---

## Text-to-Speech (TTS)

### DashieNative.speak(text)

Speaks the provided text using default voice settings.

**Parameters:**
- `text` (string) - The text to speak

**Example:**
```javascript
DashieNative.speak("Hello! Welcome to your dashboard.");
```

---

### DashieNative.speakWithParams(text, rate, pitch)

Speaks text with custom voice parameters.

**Parameters:**
- `text` (string) - The text to speak
- `rate` (float) - Speech rate (0.5 = slow, 1.0 = normal, 2.0 = fast)
- `pitch` (float) - Voice pitch (0.5 = low, 1.0 = normal, 2.0 = high)

**Example:**
```javascript
// Slow, low-pitched voice
DashieNative.speakWithParams("Important alert", 0.7, 0.8);

// Fast, high-pitched voice
DashieNative.speakWithParams("Quick notification", 1.5, 1.3);
```

**Recommended Ranges:**
- Rate: 0.5 - 2.0
- Pitch: 0.5 - 2.0

---

### DashieNative.stopSpeaking()

Immediately stops any ongoing speech.

**Example:**
```javascript
DashieNative.speak("This is a long message that can be interrupted...");
// User presses a button
DashieNative.stopSpeaking();
```

---

### DashieNative.isSpeaking()

Returns whether TTS is currently speaking.

**Returns:** `boolean`

**Example:**
```javascript
if (DashieNative.isSpeaking()) {
    console.log("Voice assistant is speaking");
}
```

---

## Speech Recognition

### DashieNative.startListening()

Starts listening for speech input **with live partial results**.

**Behavior:**
- Sends `partialResult` events as words are spoken (word-by-word transcription)
- Sends `speechResult` event with final transcription when speech ends
- Automatically stops after ~5 seconds of silence
- **Use this for:** Live transcription display, voice dictation, interactive feedback

**Events Fired:**
1. `listeningStarted` - Immediately when recording starts
2. `partialResult` - Multiple times as user speaks (e.g., "what", "what is", "what is the", "what is the weather")
3. `speechResult` - Once with final result (e.g., "what is the weather today")
4. `listeningEnded` - When recording stops

**Example:**
```javascript
// Setup event handler
window.onDashieVoiceEvent = function(event, data) {
    if (event === "partialResult") {
        // Update UI with live transcription
        document.getElementById("transcript").textContent = data;
    } else if (event === "speechResult") {
        // Process final command
        processVoiceCommand(data);
    }
};

// Start listening with live feedback
DashieNative.startListening();
```

---

### DashieNative.startListeningFinalOnly()

Starts listening for speech input **without partial results**.

**Behavior:**
- Does NOT send `partialResult` events
- Only sends `speechResult` event with final transcription
- Automatically stops after ~5 seconds of silence
- **Use this for:** Voice commands, cleaner console output, command-only interfaces

**Events Fired:**
1. `listeningStarted` - Immediately when recording starts
2. `speechResult` - Once with final result
3. `listeningEnded` - When recording stops

**Example:**
```javascript
// Setup event handler
window.onDashieVoiceEvent = function(event, data) {
    if (event === "speechResult") {
        // Only handle final result - no intermediate noise
        executeCommand(data);
    }
};

// Start listening (final result only)
DashieNative.startListeningFinalOnly();
```

---

### DashieNative.stopListening()

Gracefully stops listening and returns the current transcription.

**Behavior:**
- Stops recording immediately
- Triggers `speechResult` with whatever was transcribed so far
- Fires `listeningEnded` event

**Example:**
```javascript
// User presses "Stop" button
DashieNative.stopListening();
```

---

### DashieNative.cancelListening()

Immediately cancels listening without returning a result.

**Behavior:**
- Stops recording immediately
- Does NOT fire `speechResult` event
- Fires `listeningEnded` event

**Example:**
```javascript
// User presses "Cancel" button
DashieNative.cancelListening();
```

---

### DashieNative.isListening()

Returns whether speech recognition is currently active.

**Returns:** `boolean`

**Example:**
```javascript
if (DashieNative.isListening()) {
    console.log("Currently listening for voice input");
}
```

---

## Wake Word Detection

### DashieNative.startWakeWordDetection()

Starts continuous listening for the wake word "Hey Dashy".

**Behavior:**
- Runs continuously in background (low CPU/battery usage)
- When "Hey Dashy" is detected:
  1. Fires `wakeWordDetected` event
  2. Automatically stops wake word detection
  3. Automatically starts speech recognition (`startListening()`)
  4. After speech recognition completes, automatically restarts wake word detection
- **Use this for:** Hands-free voice control, always-listening mode

**Events Fired:**
1. `wakeWordDetected` - When "Hey Dashy" is heard
2. `listeningStarted` - Automatically after wake word
3. `partialResult` / `speechResult` - User's command transcription
4. `listeningEnded` - After command completes
5. (Wake word detection automatically restarts)

**Example:**
```javascript
// Setup event handler
window.onDashieVoiceEvent = function(event, data) {
    if (event === "wakeWordDetected") {
        console.log("Wake word detected! Listening for command...");
        // Optional: Show listening UI
        showListeningAnimation();
    } else if (event === "speechResult") {
        console.log("Command received:", data);
        processVoiceCommand(data);
    }
};

// Start continuous wake word detection
DashieNative.startWakeWordDetection();

console.log("Say 'Hey Dashy' to activate...");
```

**Complete Flow:**
```
User says "Hey Dashy"
    ↓
wakeWordDetected event fires
    ↓
Wake word detection stops
    ↓
Speech recognition starts (listeningStarted)
    ↓
User says "What's the weather?"
    ↓
speechResult event fires with "what's the weather"
    ↓
listeningEnded event fires
    ↓
Wake word detection automatically restarts
    ↓
(Ready for next "Hey Dashy")
```

---

### DashieNative.stopWakeWordDetection()

Stops continuous wake word listening.

**Example:**
```javascript
// Disable wake word when user navigates away
DashieNative.stopWakeWordDetection();
```

---

### DashieNative.isWakeWordActive()

Returns whether wake word detection is currently active.

**Returns:** `boolean`

**Example:**
```javascript
if (DashieNative.isWakeWordActive()) {
    console.log("Wake word detection is active");
}
```

---

## Usage Patterns

### Pattern 1: Simple Voice Command Button

```javascript
// User presses microphone button
document.getElementById("voiceButton").addEventListener("click", () => {
    DashieNative.startListeningFinalOnly();
    showListeningUI();
});

window.onDashieVoiceEvent = function(event, data) {
    if (event === "speechResult") {
        hideListeningUI();
        processCommand(data);
    } else if (event === "speechError") {
        hideListeningUI();
        showError(data);
    }
};
```

---

### Pattern 2: Live Voice Transcription

```javascript
const transcriptEl = document.getElementById("transcript");

window.onDashieVoiceEvent = function(event, data) {
    if (event === "listeningStarted") {
        transcriptEl.textContent = "Listening...";
    } else if (event === "partialResult") {
        transcriptEl.textContent = data; // Updates as user speaks
    } else if (event === "speechResult") {
        transcriptEl.textContent = data; // Final result
        processCommand(data);
    } else if (event === "listeningEnded") {
        // Optional cleanup
    }
};

DashieNative.startListening(); // Include partial results
```

---

### Pattern 3: Always-On Wake Word

```javascript
// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    if (userPreferences.wakeWordEnabled) {
        DashieNative.startWakeWordDetection();
    }
});

window.onDashieVoiceEvent = function(event, data) {
    switch(event) {
        case "wakeWordDetected":
            showWakeWordAnimation();
            DashieNative.speak("Yes?");
            break;
            
        case "speechResult":
            processVoiceCommand(data);
            break;
            
        case "speechError":
            if (data === "No speech input") {
                // User said wake word but nothing else - restart automatically
                console.log("Waiting for command...");
            }
            break;
    }
};
```

---

### Pattern 4: Voice + TTS Feedback

```javascript
window.onDashieVoiceEvent = function(event, data) {
    if (event === "speechResult") {
        const command = data.toLowerCase();
        
        if (command.includes("weather")) {
            const weather = getCurrentWeather();
            DashieNative.speak(`The current temperature is ${weather.temp} degrees`);
            updateWeatherWidget(weather);
        } 
        else if (command.includes("calendar")) {
            const events = getTodayEvents();
            DashieNative.speak(`You have ${events.length} events today`);
            showCalendar();
        }
        else {
            DashieNative.speak("I didn't understand that command");
        }
    }
};
```

---

### Pattern 5: Interrupting TTS

```javascript
// Speak a long message
DashieNative.speak("Here is a very long message that might need to be interrupted...");

// User presses button or says wake word
document.getElementById("stopButton").addEventListener("click", () => {
    if (DashieNative.isSpeaking()) {
        DashieNative.stopSpeaking();
        console.log("Speech interrupted");
    }
});

// Or automatically interrupt on new wake word
window.onDashieVoiceEvent = function(event, data) {
    if (event === "wakeWordDetected") {
        // Stop any ongoing speech before listening to new command
        if (DashieNative.isSpeaking()) {
            DashieNative.stopSpeaking();
        }
    }
};
```

---

## Error Handling

### Common Errors and Solutions

#### Speech Recognition Errors

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "No speech input" | User didn't speak within timeout | Prompt user to try again |
| "Audio recording error" | Microphone in use by another app | Check for conflicting apps |
| "Network error" | Device offline (some Android versions) | Ensure internet connection |
| "Insufficient permissions" | Microphone permission denied | Request permission again |
| "No speech match" | Speech was too unclear | Ask user to speak more clearly |

**Example Error Handler:**
```javascript
window.onDashieVoiceEvent = function(event, data) {
    if (event === "speechError") {
        if (data === "No speech input") {
            DashieNative.speak("I didn't hear anything. Please try again.");
        } else if (data === "Insufficient permissions") {
            showPermissionDialog();
        } else {
            console.error("Speech error:", data);
            DashieNative.speak("Sorry, I had trouble understanding that.");
        }
    }
};
```

---

### Wake Word Errors

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Wake word file not found" | Missing `hey_dashy.ppn` file | File gracefully disabled, TTS/SR still work |
| "Microphone permission not granted" | No permission | Request permission |
| "Wake word initialization failed" | Invalid Porcupine key or file | Check key and file |

**Note:** Wake word errors do NOT crash the app. TTS and speech recognition will still work.

---

## Performance Considerations

### Battery Impact

- **TTS:** Minimal impact (only active during speech)
- **Speech Recognition:** Moderate impact (only active during listening)
- **Wake Word Detection:** Low-moderate impact when active
  - Uses optimized audio processing
  - Recommend disabling during inactive hours
  - Consider user preference toggle

### Memory Usage

- **TTS:** ~5-10 MB
- **Speech Recognition:** ~10-15 MB
- **Wake Word (Porcupine):** ~3-5 MB
- **Total:** ~20-30 MB when all active

### Recommended Best Practices

1. **Stop wake word detection when dashboard not in focus:**
   ```javascript
   window.addEventListener("blur", () => {
       if (DashieNative.isWakeWordActive()) {
           DashieNative.stopWakeWordDetection();
       }
   });
   
   window.addEventListener("focus", () => {
       if (userPreferences.wakeWordEnabled) {
           DashieNative.startWakeWordDetection();
       }
   });
   ```

2. **Implement quiet hours:**
   ```javascript
   function shouldEnableWakeWord() {
       const hour = new Date().getHours();
       const quietHoursStart = 22; // 10 PM
       const quietHoursEnd = 7;    // 7 AM
       
       if (hour >= quietHoursStart || hour < quietHoursEnd) {
           return false;
       }
       return userPreferences.wakeWordEnabled;
   }
   ```

3. **Always clean up on navigation:**
   ```javascript
   window.addEventListener("beforeunload", () => {
       DashieNative.stopWakeWordDetection();
       DashieNative.stopListening();
       DashieNative.stopSpeaking();
   });
   ```

---

## Testing Commands

### Complete Test Suite

```javascript
// Setup event listener
window.onDashieVoiceEvent = function(event, data) {
    console.log(`[${event}]`, data || "(no data)");
};

// Test TTS
console.log("Testing TTS...");
DashieNative.speak("Testing text to speech");

// Test Speech Recognition (with partial results)
console.log("Testing Speech Recognition (live)...");
DashieNative.startListening();
// Say: "Hello Dashie"

// Test Speech Recognition (final only)
console.log("Testing Speech Recognition (final only)...");
DashieNative.startListeningFinalOnly();
// Say: "What time is it"

// Test Wake Word
console.log("Testing Wake Word...");
DashieNative.startWakeWordDetection();
// Say: "Hey Dashy" then "Turn on the lights"

// Check status
console.log({
    isListening: DashieNative.isListening(),
    isSpeaking: DashieNative.isSpeaking(),
    wakeWordActive: DashieNative.isWakeWordActive()
});
```

---

## Platform Compatibility

### Supported Devices

✅ **Fire TV** (Primary target)
- Fire TV Stick 4K
- Fire TV Cube
- Fire TV Stick (3rd Gen)

✅ **Android TV**
- Google TV devices
- NVIDIA Shield
- Mi Box

✅ **Android Tablets/Phones** (for testing)
- Android 7.0+ (API 24+)

### Feature Availability

| Feature | Fire TV | Android TV | Android Mobile |
|---------|---------|------------|----------------|
| TTS | ✅ | ✅ | ✅ |
| Speech Recognition | ✅ | ✅ | ✅ |
| Wake Word | ✅ | ✅ | ✅ |
| Partial Results | ✅ | ✅ | ✅ |

---

## Future Enhancements

### Planned Features (Phase 1+)

- **Cloud transcription fallback** for improved accuracy
- **Custom wake word training** (user-specific)
- **Multi-language support**
- **Voice profiles** (recognize different family members)
- **Conversation context** (follow-up questions)
- **Integration with Claude API** for natural language processing

---

## Troubleshooting

### Voice Assistant Not Working

1. **Check if native bridge is available:**
   ```javascript
   if (typeof DashieNative !== 'undefined') {
       console.log("✅ Voice assistant available");
   } else {
       console.log("❌ Not running in Dashie Android app");
   }
   ```

2. **Check microphone permission:**
   - Should auto-request on first use
   - If denied, check Android app settings

3. **Check event listener is set:**
   ```javascript
   if (typeof window.onDashieVoiceEvent === 'function') {
       console.log("✅ Event listener configured");
   }
   ```

### Wake Word Not Detecting

1. Check if wake word is active:
   ```javascript
   console.log(DashieNative.isWakeWordActive());
   ```

2. Verify audio environment:
   - Reduce background noise
   - Speak clearly and directly toward device
   - Try saying "Hey Dashy" with different emphasis

3. Check console for wake word errors

---

## Support & Resources

- **GitHub Issues:** [Report bugs or request features]
- **Testing:** All features tested on Fire TV Stick 4K (2023)
- **Documentation Version:** 1.0 (October 2025)

---

## Quick Reference

```javascript
// Text-to-Speech
DashieNative.speak("text");
DashieNative.speakWithParams("text", rate, pitch);
DashieNative.stopSpeaking();
DashieNative.isSpeaking(); // returns boolean

// Speech Recognition
DashieNative.startListening();           // With live partial results
DashieNative.startListeningFinalOnly();  // Final result only
DashieNative.stopListening();
DashieNative.cancelListening();
DashieNative.isListening(); // returns boolean

// Wake Word Detection
DashieNative.startWakeWordDetection();
DashieNative.stopWakeWordDetection();
DashieNative.isWakeWordActive(); // returns boolean

// Event Handler (required)
window.onDashieVoiceEvent = function(event, data) {
    // handle events: listeningStarted, partialResult, speechResult, 
    // wakeWordDetected, speechError, etc.
};
```

---

**End of Documentation**