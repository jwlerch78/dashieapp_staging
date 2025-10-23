# Voice Widget Implementation Plan

**Version:** 1.0
**Created:** October 23, 2025
**Status:** In Progress - Phase 1
**Related Docs:** [VOICE_ASSISTANT.md](../VOICE_ASSISTANT.md)

---

## Overview

Build a Voice Widget that enables voice command processing on both PC (Web Speech API) and Android (native DashieNative bridge). This is the first step toward full AI-assisted voice control of the dashboard.

### Key Features (Phase 1)

- ✅ Cross-platform voice input (Android + PC)
- ✅ Visual feedback (mic button, pulsing animation, live transcript)
- ✅ Simple command routing (theme switching)
- ✅ Text-to-Speech confirmation
- 🔄 Unified architecture for local and AI command processing

---

## Architecture

### Design Principles

1. **Platform Agnostic**: Voice commands processed identically regardless of input source
2. **Event-Driven**: All communication via AppComms (no direct dependencies)
3. **Simple Decision Making**: VoiceCommandRouter decides local vs AI processing
4. **Future-Ready**: Clear extension points for AI integration

### System Flow

```
┌─────────────────────────────────────────────────────┐
│ Platform Input                                      │
│ • Android: window.onDashieVoiceEvent               │
│ • Web: SpeechRecognition API + mic button click    │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│ VoiceService (js/core/voice-service.js)            │
│ • Platform detection                                │
│ • Provider initialization                           │
│ • AppComms event emission                          │
└──────────────────┬──────────────────────────────────┘
                   ↓ emits VOICE_TRANSCRIPT_RECEIVED
┌─────────────────────────────────────────────────────┐
│ VoiceCommandRouter (js/core/voice-command-router.js)│
│ • Keyword matching (simple commands)                │
│ • Local command execution                          │
│ • AI fallback (future)                             │
└──────────────────┬──────────────────────────────────┘
                   │
                   ├─→ SettingsService (theme changes)
                   ├─→ AppComms emit (VOICE_COMMAND_EXECUTED)
                   └─→ VoiceService.speak() (TTS confirmation)

┌─────────────────────────────────────────────────────┐
│ Voice Widget (js/widgets/voice/)                   │
│ • Listens to AppComms events                       │
│ • Displays UI states                               │
│ • Triggers listening (Web mic button)              │
└─────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. VoiceService (`js/core/voice-service.js`)

**Purpose:** Platform abstraction layer for voice input/output

**Responsibilities:**
- Detect platform (Android vs Web)
- Initialize appropriate provider
- Expose unified API for starting/stopping listening
- Emit AppComms events
- Handle Text-to-Speech

**API:**
```javascript
class VoiceService {
  // Initialize (called from core-initializer.js)
  async initialize() { }

  // Voice input
  startListening() { }      // Start speech recognition
  stopListening() { }       // Stop speech recognition
  isListening() { }         // Returns boolean

  // Voice output
  speak(text) { }           // Text-to-Speech
  stopSpeaking() { }        // Cancel TTS
  isSpeaking() { }          // Returns boolean

  // Platform detection
  isAndroid() { }           // Returns boolean
  isWebPlatform() { }       // Returns boolean
}
```

**AppComms Events Emitted:**
- `VOICE_LISTENING_STARTED` - Speech recognition started
- `VOICE_LISTENING_STOPPED` - Speech recognition stopped
- `VOICE_PARTIAL_RESULT` - Live transcript (data: string)
- `VOICE_TRANSCRIPT_RECEIVED` - Final transcript (data: string)
- `VOICE_ERROR` - Error occurred (data: error message)

**Implementation Notes:**
- Singleton pattern (like WidgetMessenger, WidgetDataManager)
- Platform detection via `typeof DashieNative !== 'undefined'`
- Provider initialized in constructor
- All events emit via `AppComms.emit()`

---

### 2. Voice Providers

**Interface (both providers must implement):**
```javascript
class VoiceProvider {
  startListening() { }
  stopListening() { }
  isListening() { }
  speak(text) { }
  stopSpeaking() { }
  isSpeaking() { }
  initialize() { }
  destroy() { }
}
```

#### AndroidVoiceProvider (`js/core/voice/android-voice-provider.js`)

**Purpose:** Bridge to native Android voice capabilities

**Implementation:**
- Wraps `DashieNative` JavaScript bridge
- Listens to `window.onDashieVoiceEvent()`
- Maps Android events to VoiceService events
- Handles wake word detection (future)

**Android Events Handled:**
- `listeningStarted` → emit `VOICE_LISTENING_STARTED`
- `partialResult` → emit `VOICE_PARTIAL_RESULT`
- `speechResult` → emit `VOICE_TRANSCRIPT_RECEIVED`
- `listeningEnded` → emit `VOICE_LISTENING_STOPPED`
- `speechError` → emit `VOICE_ERROR`
- `wakeWordDetected` → emit `VOICE_WAKE_WORD_DETECTED` (future)

**Methods:**
```javascript
startListening() {
  DashieNative.startListening(); // With partial results
}

speak(text) {
  DashieNative.speak(text);
}
```

**Notes:**
- Wake word is handled automatically by Android
- We just receive transcript events
- No manual beep needed (Android handles it)

---

#### WebVoiceProvider (`js/core/voice/web-voice-provider.js`)

**Purpose:** Web Speech API wrapper for PC testing

**Implementation:**
- Uses browser `SpeechRecognition` API
- Uses browser `SpeechSynthesis` API
- Provides continuous recognition with interim results
- Manual start/stop via mic button

**Browser APIs:**
```javascript
// Speech Recognition
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = false;
recognition.interimResults = true;
recognition.lang = 'en-US';

// Speech Synthesis
const synth = window.speechSynthesis;
synth.speak(new SpeechSynthesisUtterance(text));
```

**Event Mapping:**
- `recognition.onstart` → emit `VOICE_LISTENING_STARTED`
- `recognition.onresult` (interim) → emit `VOICE_PARTIAL_RESULT`
- `recognition.onresult` (final) → emit `VOICE_TRANSCRIPT_RECEIVED`
- `recognition.onend` → emit `VOICE_LISTENING_STOPPED`
- `recognition.onerror` → emit `VOICE_ERROR`

**Methods:**
```javascript
startListening() {
  recognition.start();
}

speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  synth.speak(utterance);
}
```

**Notes:**
- No wake word detection on Web (mic button only)
- Automatic stop after ~5 seconds of silence
- Browser permission prompt required

---

### 3. VoiceCommandRouter (`js/core/voice-command-router.js`)

**Purpose:** Decision maker for command processing

**Responsibilities:**
- Receive transcript from VoiceService
- Determine if command is "simple" (local) or "complex" (AI)
- Execute simple commands locally
- Route complex commands to AI (future)
- Emit command execution results

**Architecture:**
```javascript
class VoiceCommandRouter {
  constructor() {
    this.commandPatterns = this._buildCommandPatterns();
  }

  // Main entry point
  processCommand(transcript) {
    if (this._isSimpleCommand(transcript)) {
      this._handleLocalCommand(transcript);
    } else {
      this._sendToAI(transcript); // Future
    }
  }

  // Simple command detection (keyword matching)
  _isSimpleCommand(transcript) {
    const lower = transcript.toLowerCase();
    return (
      this._matchesThemeCommand(lower) ||
      this._matchesNavigationCommand(lower)
      // More patterns added here later
    );
  }

  // Local command handlers
  _handleLocalCommand(transcript) { }
  _handleThemeChange(transcript) { }
  _handleNavigation(transcript) { }

  // AI integration (future)
  async _sendToAI(transcript) {
    logger.info('Unrecognized command, would send to AI:', transcript);
    AppComms.emit('VOICE_COMMAND_SENT_TO_AI', { transcript });
  }
}
```

**Simple Commands (Phase 1):**

| Pattern | Keywords | Action |
|---------|----------|--------|
| Theme Change | "theme", "dark", "light", "dark mode", "light mode" | Update theme via SettingsService |

**Command Patterns:**
```javascript
_buildCommandPatterns() {
  return {
    theme: {
      keywords: ['theme', 'dark mode', 'light mode'],
      patterns: {
        dark: ['dark', 'night mode'],
        light: ['light', 'day mode']
      }
    }
    // Future commands here
  };
}
```

**Theme Change Implementation:**
```javascript
_handleThemeChange(transcript) {
  const lower = transcript.toLowerCase();
  let newTheme;

  if (lower.includes('dark') || lower.includes('night')) {
    newTheme = 'dark';
  } else if (lower.includes('light') || lower.includes('day')) {
    newTheme = 'light';
  }

  if (newTheme) {
    // Update settings
    SettingsService.updateSettings({ theme: newTheme });

    // Emit success event
    AppComms.emit('VOICE_COMMAND_EXECUTED', {
      command: 'theme_change',
      result: `Theme changed to ${newTheme}`,
      theme: newTheme
    });

    // Speak confirmation
    VoiceService.speak(`Theme changed to ${newTheme} mode`);
  }
}
```

**AppComms Events Emitted:**
- `VOICE_COMMAND_EXECUTED` - Command executed successfully
  - `{ command: string, result: string, ...extraData }`
- `VOICE_COMMAND_SENT_TO_AI` - Command sent to AI (future)
  - `{ transcript: string }`

**Initialization:**
- Initialized in `core-initializer.js` after VoiceService
- Subscribes to `VOICE_TRANSCRIPT_RECEIVED` event
- No DOM interaction (pure logic)

**Future Expansion Points:**
- Add more simple command patterns
- Implement AI integration (`_sendToAI`)
- Add command history
- Add voice confirmation preferences
- Add command aliases/synonyms

---

### 4. Voice Widget (`js/widgets/voice/`)

**Purpose:** Visual feedback for voice interaction

**Files:**
- `voice-widget.html` - Widget markup
- `voice-widget.css` - Widget styles
- `voice-widget.js` - Widget logic

**UI States:**

| State | Visual | Text | Trigger |
|-------|--------|------|---------|
| **Idle** | Microphone icon (circle) | "Say 'Hey Dashie'" (Android)<br>"Click to speak" (Web) | Default state |
| **Listening** | Pulsing animation (rings) | "Listening..." | `VOICE_LISTENING_STARTED` |
| **Transcribing** | Pulsing continues | Live transcript text | `VOICE_PARTIAL_RESULT` |
| **Processing** | Processing indicator | Full transcript | `VOICE_TRANSCRIPT_RECEIVED` |
| **Confirmation** | Success checkmark | "Theme changed successfully" | `VOICE_COMMAND_EXECUTED` |
| **Error** | Error icon | Error message | `VOICE_ERROR` |

**HTML Structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/css/core/variables.css">
  <link rel="stylesheet" href="/css/core/themes.css">
  <link rel="stylesheet" href="voice-widget.css">
</head>
<body>
  <div class="voice-widget">
    <!-- Idle/Listening State -->
    <div class="voice-widget__mic-container">
      <div class="voice-widget__pulse-ring"></div>
      <div class="voice-widget__pulse-ring"></div>
      <button class="voice-widget__mic-button">
        <svg class="voice-widget__mic-icon"><!-- mic SVG --></svg>
      </button>
    </div>

    <!-- Text Display -->
    <div class="voice-widget__text-container">
      <p class="voice-widget__prompt">Say "Hey Dashie"</p>
      <p class="voice-widget__transcript"></p>
    </div>

    <!-- Status Indicator -->
    <div class="voice-widget__status"></div>
  </div>

  <script type="module" src="voice-widget.js"></script>
</body>
</html>
```

**CSS Styling:**
- Theme-aware (uses CSS variables)
- Pulsing animation for listening state
- Smooth transitions between states
- Fire TV compatible (no complex filters)

**JavaScript Logic:**
```javascript
class VoiceWidget {
  constructor() {
    this.state = 'idle';
    this.isAndroid = this._detectPlatform();
  }

  initialize() {
    this._setupEventListeners();
    this._subscribeToAppComms();
    this._updateUI();
  }

  _setupEventListeners() {
    // Mic button click (Web only)
    if (!this.isAndroid) {
      this.micButton.addEventListener('click', () => {
        window.parent.postMessage({
          type: 'widget-action',
          action: 'voice-start-listening'
        }, '*');
      });
    }
  }

  _subscribeToAppComms() {
    window.addEventListener('message', (event) => {
      if (event.data.type === 'data' && event.data.action === 'voice-event') {
        this._handleVoiceEvent(event.data.payload);
      }
    });
  }

  _handleVoiceEvent(event) {
    switch(event.eventType) {
      case 'VOICE_LISTENING_STARTED':
        this._setState('listening');
        break;
      case 'VOICE_PARTIAL_RESULT':
        this._showTranscript(event.data, false);
        break;
      case 'VOICE_TRANSCRIPT_RECEIVED':
        this._showTranscript(event.data, true);
        break;
      case 'VOICE_COMMAND_EXECUTED':
        this._showConfirmation(event.data.result);
        break;
      case 'VOICE_ERROR':
        this._showError(event.data);
        break;
    }
  }

  _setState(newState) {
    this.state = newState;
    this._updateUI();
  }

  _updateUI() {
    // Update classes, animations, text based on state
  }
}
```

**Widget Communication:**

Voice Widget needs to:
1. **Receive events** from VoiceService (via WidgetMessenger broadcast)
2. **Send actions** to VoiceService (mic button click on Web)

**Integration with WidgetMessenger:**
```javascript
// In WidgetDataManager or similar
AppComms.on('VOICE_LISTENING_STARTED', () => {
  WidgetMessenger.broadcast('voice', 'data', 'voice-event', {
    eventType: 'VOICE_LISTENING_STARTED'
  });
});

AppComms.on('VOICE_PARTIAL_RESULT', (data) => {
  WidgetMessenger.broadcast('voice', 'data', 'voice-event', {
    eventType: 'VOICE_PARTIAL_RESULT',
    data: data
  });
});

// etc.
```

**Widget Registration:**
```javascript
// In widget-config.js
{
  id: 'voice',
  name: 'Voice Assistant',
  path: '/js/widgets/voice/voice-widget.html',
  container: 'voice-widget-container', // To be created in Dashboard
  refreshInterval: null, // No auto-refresh
  dataTypes: [] // Receives voice events, not standard data
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure ⏳ IN PROGRESS

**Goal:** Build VoiceService and providers

**Tasks:**
1. ✅ Create VoiceService (`js/core/voice-service.js`)
2. ✅ Create WebVoiceProvider (`js/core/voice/web-voice-provider.js`)
3. ✅ Create AndroidVoiceProvider (`js/core/voice/android-voice-provider.js`)
4. ✅ Add AppComms event types to config
5. ✅ Initialize VoiceService in core-initializer.js

**Success Criteria:**
- VoiceService detects platform correctly
- Web Speech API works on PC (mic permission, start/stop listening)
- Android bridge connects properly
- AppComms events emit correctly

---

### Phase 2: Command Router ⏳ PENDING

**Goal:** Build command processing logic

**Tasks:**
1. Create VoiceCommandRouter (`js/core/voice-command-router.js`)
2. Implement theme change command detection
3. Wire to SettingsService
4. Add TTS confirmation
5. Subscribe to VOICE_TRANSCRIPT_RECEIVED events

**Success Criteria:**
- Saying "dark mode" changes theme to dark
- Saying "light mode" changes theme to light
- TTS confirmation plays
- AppComms event `VOICE_COMMAND_EXECUTED` emits

---

### Phase 3: Voice Widget UI ⏳ PENDING

**Goal:** Build widget interface

**Tasks:**
1. Create widget structure (`voice-widget.html`, `voice-widget.css`, `voice-widget.js`)
2. Implement UI states (idle, listening, transcript, confirmation)
3. Add pulsing animation for listening state
4. Subscribe to AppComms voice events
5. Add mic button (Web) with click handler

**Success Criteria:**
- Widget displays correctly in dashboard
- Shows appropriate state for each voice event
- Pulsing animation works during listening
- Live transcript updates as words are spoken
- Confirmation message appears after command execution

---

### Phase 4: Dashboard Integration ⏳ PENDING

**Goal:** Add widget to dashboard layout

**Tasks:**
1. Create widget container in Dashboard HTML
2. Add widget to widget-config.js
3. Wire widget events to VoiceService
4. Update Dashboard CSS for new widget placement
5. Test on both PC and Android

**Success Criteria:**
- Widget loads in dashboard
- Mic button works on PC
- Wake word works on Android
- Theme changes via voice command
- TTS confirmation plays

---

### Phase 5: Testing & Polish ⏳ PENDING

**Goal:** Ensure reliability and good UX

**Tasks:**
1. Test error handling (no speech, permission denied)
2. Test cross-platform (PC + Android)
3. Add loading states
4. Polish animations
5. Add accessibility features
6. Document usage

**Success Criteria:**
- Works on Chrome (PC)
- Works on Android Fire TV
- Graceful error handling
- Smooth animations
- User-friendly feedback

---

## Future Enhancements (Not in Phase 1)

### Voice Settings Page

**Location:** `js/modules/Settings/pages/voice-settings.js`

**Settings to Include:**
- **Enable/Disable Voice Assistant** - Toggle voice features on/off
- **Voice Persona** - Select personality/tone for TTS responses
  - Options: Professional, Friendly, Casual, Formal
- **Wake Word Sensitivity** (Android only) - Adjust detection threshold
- **Preferred Voice** - Select TTS voice (male/female, accent)
- **Quiet Hours** - Disable wake word during specified times
- **Privacy Settings** - Toggle voice data logging
- **Command History** - View/clear recent voice commands

**UI Pattern:** Extends `SettingsPageBase` like other settings pages

---

### AI Integration

**Goal:** Send complex commands to Claude API for natural language processing

**Architecture:**
```javascript
// In VoiceCommandRouter
async _sendToAI(transcript) {
  try {
    const response = await ClaudeAPIService.processCommand(transcript);

    // Execute AI-generated actions
    this._executeAIAction(response);

    // Speak AI response
    VoiceService.speak(response.message);

  } catch (error) {
    logger.error('AI processing failed:', error);
    VoiceService.speak("Sorry, I couldn't process that command");
  }
}
```

**Commands to Handle:**
- Natural language calendar queries ("What's on my calendar tomorrow?")
- Photo searches ("Show me photos from last Christmas")
- Complex navigation ("Take me to calendar settings")
- Weather queries ("What's the weather like today?")
- Multi-step commands ("Turn on dark mode and show my calendar")

---

### Wake Word Detection (Web)

**Goal:** Add "Hey Dashie" wake word to PC version

**Options:**
1. **Porcupine for Web** (if available)
2. **Custom ML model** (TensorFlow.js)
3. **Continuous recognition with filtering** (battery intensive)

**Not implemented in Phase 1** - mic button is sufficient for testing

---

### Voice Command Expansion

**Additional Local Commands:**
- **Navigation**: "Go to settings", "Show calendar", "Open photos"
- **Widget Control**: "Refresh calendar", "Next photo", "Show weather"
- **System**: "Sleep", "Wake up", "Show time"
- **Volume**: "Speak louder", "Speak quieter", "Stop talking"

---

### Context Awareness

**Goal:** Remember conversation context for follow-up commands

**Example:**
```
User: "What's the weather today?"
AI: "It's 72 degrees and sunny"
User: "What about tomorrow?"  ← Knows we're still talking about weather
AI: "Tomorrow will be 68 degrees with clouds"
```

**Implementation:** Store last command + response in VoiceCommandRouter state

---

## Testing Strategy

### PC Testing (Web Speech API)

**Browser:** Chrome or Edge (best Web Speech API support)

**Test Scenarios:**
1. Click mic button → starts listening
2. Say "dark mode" → theme changes to dark, TTS confirms
3. Say "light mode" → theme changes to light, TTS confirms
4. Say gibberish → logs unrecognized command
5. No speech for 5 seconds → stops listening automatically

**Permission Handling:**
- First click prompts for microphone permission
- User must grant permission
- Test denial scenario (show error message)

---

### Android Testing (DashieNative)

**Device:** Fire TV Stick 4K or Android tablet

**Test Scenarios:**
1. Say "Hey Dashie" → wake word detected, starts listening
2. Say "dark mode" → theme changes, TTS confirms
3. Say nothing after wake word → timeout, restarts wake word detection
4. Say unrecognized command → logs to console
5. Multiple commands in sequence → wake word restarts each time

**Android-Specific:**
- Test wake word sensitivity (adjust in Android code if needed)
- Test TTS voice quality/speed
- Test background noise handling

---

### Cross-Platform Testing

**Goal:** Ensure identical behavior on both platforms

**Test Cases:**
1. Same command → same result (theme change)
2. Same TTS output (confirmation message)
3. Same error handling (no speech, unclear speech)
4. Same UI feedback in widget

---

## File Structure

```
js/
├── core/
│   ├── voice-service.js                    (NEW)
│   ├── voice-command-router.js             (NEW)
│   └── voice/
│       ├── web-voice-provider.js           (NEW)
│       └── android-voice-provider.js       (NEW)
│
├── widgets/
│   └── voice/
│       ├── voice-widget.html               (NEW)
│       ├── voice-widget.css                (NEW)
│       └── voice-widget.js                 (NEW)
│
└── modules/
    └── Settings/
        └── pages/
            └── voice-settings.js           (FUTURE)

.reference/
└── VOICE_ASSISTANT.md                      (EXISTS - API docs)
```

---

## Integration Points

### 1. Core Initialization

**File:** `js/core/initialization/core-initializer.js`

**Add after WidgetDataManager initialization:**
```javascript
// Initialize voice service
const { VoiceService } = await import('../voice-service.js');
window.voiceService = VoiceService.getInstance();
await window.voiceService.initialize();

// Initialize voice command router
const { VoiceCommandRouter } = await import('../voice-command-router.js');
window.voiceCommandRouter = VoiceCommandRouter.getInstance();
await window.voiceCommandRouter.initialize();
```

---

### 2. AppComms Events

**File:** `js/config.js` or wherever AppComms event types are defined

**Add new event types:**
```javascript
VOICE_LISTENING_STARTED: 'VOICE_LISTENING_STARTED',
VOICE_LISTENING_STOPPED: 'VOICE_LISTENING_STOPPED',
VOICE_PARTIAL_RESULT: 'VOICE_PARTIAL_RESULT',
VOICE_TRANSCRIPT_RECEIVED: 'VOICE_TRANSCRIPT_RECEIVED',
VOICE_ERROR: 'VOICE_ERROR',
VOICE_COMMAND_EXECUTED: 'VOICE_COMMAND_EXECUTED',
VOICE_COMMAND_SENT_TO_AI: 'VOICE_COMMAND_SENT_TO_AI',
VOICE_WAKE_WORD_DETECTED: 'VOICE_WAKE_WORD_DETECTED',
```

---

### 3. Widget Configuration

**File:** `js/modules/Dashboard/config/widget-config.js`

**Add voice widget:**
```javascript
{
  id: 'voice',
  name: 'Voice Assistant',
  path: '/js/widgets/voice/voice-widget.html',
  container: 'voice-widget-container',
  refreshInterval: null,
  dataTypes: [],
  cssClass: 'voice-widget'
}
```

---

### 4. Widget Event Bridge

**File:** `js/core/widget-data-manager.js` or similar

**Forward voice events to widgets:**
```javascript
// Subscribe to voice events and forward to voice widget
AppComms.on('VOICE_LISTENING_STARTED', () => {
  WidgetMessenger.sendToWidget('voice', 'data', 'voice-event', {
    eventType: 'VOICE_LISTENING_STARTED'
  });
});

AppComms.on('VOICE_PARTIAL_RESULT', (transcript) => {
  WidgetMessenger.sendToWidget('voice', 'data', 'voice-event', {
    eventType: 'VOICE_PARTIAL_RESULT',
    data: transcript
  });
});

// ... etc for all voice events
```

---

## Configuration

### Voice Service Config

**Location:** Could be in `js/config.js` or separate voice config

```javascript
export const VOICE_CONFIG = {
  // Web Speech API settings
  web: {
    lang: 'en-US',
    continuous: false,
    interimResults: true,
    maxAlternatives: 1
  },

  // TTS settings
  tts: {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voice: null // null = default system voice
  },

  // Command router settings
  commands: {
    caseSensitive: false,
    fuzzyMatching: false, // Future: handle typos/mishears
    confirmationTTS: true
  },

  // Android-specific (future)
  android: {
    wakeWordEnabled: true,
    wakeWordSensitivity: 0.5
  }
};
```

---

## Known Limitations & Considerations

### Web Speech API (PC)

**Limitations:**
- Requires HTTPS in production (localhost OK for dev)
- Chrome/Edge only (no Firefox/Safari support)
- No wake word detection
- Requires microphone permission
- Auto-stops after ~5 seconds of silence

**Mitigations:**
- Use mic button instead of wake word
- Clear permission prompts
- Visual feedback for auto-stop

---

### Android DashieNative

**Limitations:**
- Only works in Dashie Android app (not mobile web)
- Requires microphone permission
- Wake word may have false positives/negatives

**Mitigations:**
- Graceful degradation (detect platform)
- Clear feedback when wake word detected
- Ability to disable wake word in settings (future)

---

### Command Recognition

**Limitations:**
- Simple keyword matching (not NLP)
- May misinterpret similar-sounding words
- No support for complex multi-step commands (Phase 1)

**Mitigations:**
- Start with very specific commands ("dark mode" not "make it dark")
- Show transcript so user sees what was heard
- AI fallback for complex commands (future)

---

### Privacy Considerations

**Data Flow:**
- **Android**: Voice processing happens on-device (no cloud)
- **Web**: Chrome sends audio to Google servers for transcription
- **Future AI**: Transcripts sent to Claude API

**User Control (Future):**
- Settings to disable voice features
- Clear indication when listening
- Option to view/delete command history

---

## Success Metrics

### Phase 1 Complete When:

✅ User can click mic button on PC and speak "dark mode" → theme changes
✅ User can say "Hey Dashie" on Android, then "light mode" → theme changes
✅ Widget shows live transcript as user speaks
✅ TTS says "Theme changed to [dark/light] mode" after successful change
✅ Widget shows appropriate state (idle, listening, confirmation) at all times
✅ Both platforms route commands identically through VoiceCommandRouter
✅ Unrecognized commands log to console (AI fallback placeholder)

---

## Next Steps After Phase 1

1. **Add Voice Settings Page** - User control over voice features
2. **Expand Simple Commands** - Navigation, widget control
3. **Implement AI Integration** - Claude API for complex commands
4. **Add Wake Word to Web** - Porcupine or alternative
5. **Build Context Awareness** - Remember conversation state
6. **Add Voice Command History** - View past commands
7. **Multi-language Support** - Additional languages beyond English

---

## Troubleshooting Guide

### Issue: Mic button doesn't work on PC

**Diagnosis:**
- Check browser console for errors
- Verify HTTPS or localhost
- Check microphone permission (chrome://settings/content/microphone)

**Solution:**
- Grant microphone permission
- Use Chrome or Edge browser
- Check VoiceService initialization

---

### Issue: Wake word not detecting on Android

**Diagnosis:**
- Check if `DashieNative` is defined
- Verify microphone permission granted
- Check Android logs for Porcupine errors

**Solution:**
- Ensure running in Dashie Android app (not mobile web)
- Grant microphone permission in Android settings
- Verify `hey_dashy.ppn` file exists

---

### Issue: Theme not changing

**Diagnosis:**
- Check browser console for VoiceCommandRouter logs
- Verify transcript contains "dark" or "light"
- Check SettingsService integration

**Solution:**
- Verify VoiceCommandRouter initialized
- Check AppComms events emitting
- Test SettingsService.updateSettings() directly

---

### Issue: No TTS confirmation

**Diagnosis:**
- Check if VoiceService.speak() called
- Verify browser TTS support (Web)
- Check Android TTS initialization

**Solution:**
- Test `window.speechSynthesis.speak()` directly (Web)
- Test `DashieNative.speak()` directly (Android)
- Check volume settings

---

## Development Tips

### Quick Testing Commands

**PC (Web Speech API):**
```javascript
// Test speech recognition
window.voiceService.startListening();

// Test TTS
window.voiceService.speak("Testing text to speech");

// Test command routing
window.voiceCommandRouter.processCommand("dark mode");
```

**Android (DashieNative):**
```javascript
// Test if bridge available
console.log(typeof DashieNative !== 'undefined');

// Test TTS
DashieNative.speak("Testing Android TTS");

// Test speech recognition
DashieNative.startListening();
```

---

### Debugging Voice Events

**Add event logger:**
```javascript
// In core-initializer.js or voice-service.js
const VOICE_EVENTS = [
  'VOICE_LISTENING_STARTED',
  'VOICE_PARTIAL_RESULT',
  'VOICE_TRANSCRIPT_RECEIVED',
  'VOICE_COMMAND_EXECUTED',
  'VOICE_ERROR'
];

VOICE_EVENTS.forEach(event => {
  AppComms.on(event, (data) => {
    console.log(`[VOICE EVENT] ${event}:`, data);
  });
});
```

---

### Simulating Android Events (PC Testing)

**For testing Android provider logic on PC:**
```javascript
// Simulate wake word detection
window.onDashieVoiceEvent('wakeWordDetected', '');

// Simulate speech result
window.onDashieVoiceEvent('speechResult', 'dark mode');

// Simulate error
window.onDashieVoiceEvent('speechError', 'No speech input');
```

---

## References

- **[VOICE_ASSISTANT.md](../VOICE_ASSISTANT.md)** - Complete API documentation
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** - Overall system architecture
- **[WIDGETS_README.md](../../js/widgets/WIDGETS_README.md)** - Widget development guide
- **Web Speech API**: [MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- **Porcupine Wake Word**: [Picovoice Docs](https://picovoice.ai/docs/porcupine/)

---

**End of Build Plan**
