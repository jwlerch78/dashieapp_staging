# Voice Widget & Voice System Documentation

**Version:** 1.0
**Last Updated:** October 23, 2025
**Status:** Phase 1 Complete - Theme Commands Working

---

## Overview

The Voice Widget provides a unified interface for voice commands on both PC (Web Speech API) and Android (native DashieNative bridge). Users can speak commands to control the dashboard, with plans for AI-powered natural language processing.

### Current Features (Phase 1)

- ✅ Voice input on PC (Web Speech API) and Android (DashieNative)
- ✅ Live transcript display as user speaks
- ✅ Audio beep confirmation when listening starts
- ✅ Theme switching via voice ("dark mode", "light mode")
- ✅ Text-to-Speech confirmation of actions
- ✅ Visual feedback (pulsing animation, status messages)

### Planned Features (Phase 2+)

- 🔄 Text input for command testing
- 🔄 Claude API integration for natural language understanding
- 🔄 Navigation commands ("Go to settings")
- 🔄 Widget control commands ("Refresh calendar")
- 🔄 Calendar queries ("What's on my calendar tomorrow?")
- 🔄 Photo searches ("Show me Christmas photos")

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│ Voice Widget (UI Layer)                                 │
│ - Microphone button                                     │
│ - Live transcript display                               │
│ - Status messages & confirmations                       │
│ - (Future: Text input box)                              │
└────────────┬────────────────────────────────────────────┘
             │ postMessage
             ↓
┌─────────────────────────────────────────────────────────┐
│ VoiceService (Platform Abstraction)                     │
│ - Auto-detects Android vs Web                           │
│ - Initializes appropriate provider                      │
│ - Emits AppComms events                                 │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    ↓                 ↓
┌─────────────┐  ┌──────────────────┐
│ Web Speech  │  │ Android Native   │
│ API         │  │ DashieNative     │
└─────────────┘  └──────────────────┘
             │
             ↓ AppComms Events
┌─────────────────────────────────────────────────────────┐
│ VoiceCommandRouter (Command Processing)                 │
│ - Simple keyword matching (theme, nav, etc.)            │
│ - Routes complex commands to AI (future)                │
│ - Executes local commands                               │
│ - Triggers TTS confirmations                            │
└─────────────────────────────────────────────────────────┘
```

---

## File Structure

```
js/
├── core/
│   ├── voice-service.js                    # Platform abstraction
│   ├── voice-command-router.js             # Command processing
│   └── voice/
│       ├── web-voice-provider.js           # Web Speech API wrapper
│       └── android-voice-provider.js       # DashieNative wrapper
│
├── widgets/
│   └── voice/
│       ├── voice-widget.html               # Widget UI
│       ├── voice-widget.css                # Widget styles
│       ├── voice-widget.js                 # Widget logic
│       └── VOICE_WIDGET_README.md          # This file
│
└── core/
    └── widget-data-manager.js              # Forwards voice events to widget
```

---

## How It Works

### Voice Command Flow

1. **User Action**
   - PC: Click microphone button
   - Android/Fire TV: Click microphone button OR say "Hey Dashie" (wake word)

2. **Voice Recognition Starts**
   - VoiceService.startListening() called
   - WebVoiceProvider or AndroidVoiceProvider starts recognition
   - Emits `VOICE_LISTENING_STARTED` event

3. **Widget Shows Feedback**
   - Receives event via postMessage
   - Plays beep sound
   - Shows "Listening..." with pulsing animation

4. **User Speaks**
   - Partial results emit `VOICE_PARTIAL_RESULT` events
   - Widget displays live transcript

5. **Speech Recognition Completes**
   - Final transcript emits `VOICE_TRANSCRIPT_RECEIVED`
   - Sent to VoiceCommandRouter

6. **Command Processing**
   - VoiceCommandRouter checks for simple commands (theme, nav, etc.)
   - If match: Executes locally
   - If no match: Routes to AI (future)

7. **Action & Confirmation**
   - Action executed (e.g., theme changes)
   - Emits `VOICE_COMMAND_EXECUTED` event
   - Speaks confirmation via TTS
   - Widget shows success message

---

## AppComms Events

### Events Emitted by VoiceService

| Event | Data | Description |
|-------|------|-------------|
| `VOICE_LISTENING_STARTED` | `null` | Speech recognition started |
| `VOICE_LISTENING_STOPPED` | `null` | Speech recognition stopped |
| `VOICE_PARTIAL_RESULT` | `string` | Live transcript (partial) |
| `VOICE_TRANSCRIPT_RECEIVED` | `string` | Final transcript |
| `VOICE_ERROR` | `{ message: string }` | Error occurred |

### Events Emitted by VoiceCommandRouter

| Event | Data | Description |
|-------|------|-------------|
| `VOICE_COMMAND_EXECUTED` | `{ command, result, ...extra }` | Command executed successfully |
| `VOICE_COMMAND_SENT_TO_AI` | `{ transcript }` | Command sent to AI (future) |

---

## Current Commands (Phase 1)

### Theme Commands

**Keywords:** `theme`, `dark`, `light`, `dark mode`, `light mode`, `night mode`, `day mode`

**Examples:**
- "Dark mode"
- "Switch to light mode"
- "Change theme to dark"
- "Turn on night mode"

**Action:** Updates theme via SettingsService, broadcasts to all widgets, speaks confirmation.

---

## Widget UI States

| State | Visual | Trigger |
|-------|--------|---------|
| **Idle** | Mic icon + "Click to speak" | Default |
| **Listening** | Pulsing rings + "Listening..." | `VOICE_LISTENING_STARTED` |
| **Transcribing** | Pulsing + live transcript | `VOICE_PARTIAL_RESULT` |
| **Processing** | Transcript shown | `VOICE_TRANSCRIPT_RECEIVED` |
| **Confirmation** | Success message | `VOICE_COMMAND_EXECUTED` |
| **Error** | Error message | `VOICE_ERROR` |

---

## Adding New Commands (Developer Guide)

### 1. Add Command Pattern to VoiceCommandRouter

Edit `js/core/voice-command-router.js`:

```javascript
_buildCommandPatterns() {
  return {
    theme: { ... },

    // Add new command type
    navigation: {
      keywords: ['go to', 'open', 'show', 'navigate'],
      patterns: {
        settings: ['settings', 'preferences', 'options'],
        calendar: ['calendar', 'schedule'],
        photos: ['photos', 'pictures', 'gallery']
      }
    }
  };
}
```

### 2. Add Detection Method

```javascript
_matchesNavigationCommand(lower) {
  const { navigation } = this.commandPatterns;
  return navigation.keywords.some(keyword => lower.includes(keyword));
}
```

### 3. Add Handler Method

```javascript
_handleNavigation(lower) {
  const { patterns } = this.commandPatterns.navigation;

  if (patterns.settings.some(kw => lower.includes(kw))) {
    // Navigate to settings
    AppStateManager.setCurrentModule('settings');
    this._speakConfirmation('Opening settings');
    this._emitCommandExecuted('navigation', 'Opened settings');
  }
  // ... more navigation handlers
}
```

### 4. Wire Up in _handleLocalCommand

```javascript
_handleLocalCommand(transcript) {
  const lower = transcript.toLowerCase();

  if (this._matchesThemeCommand(lower)) {
    this._handleThemeChange(lower);
  } else if (this._matchesNavigationCommand(lower)) {
    this._handleNavigation(lower);
  }
}
```

---

## Platform Differences

### PC (Web Speech API)

**Pros:**
- No special setup required
- Works in Chrome/Edge

**Cons:**
- No wake word detection
- Requires mic button click
- Less accurate transcription
- Requires HTTPS (production)
- May timeout after ~5 seconds of silence

**Best Use:** Development and testing

---

### Android/Fire TV (DashieNative)

**Pros:**
- Much better transcription accuracy
- Wake word detection ("Hey Dashie") - when working
- Hands-free operation (via wake word)
- Button also works as fallback/testing method
- On-device processing (no cloud)
- Optimized for Fire TV

**Cons:**
- Only works in Dashie Android app
- Requires microphone permission
- Wake word currently has issues (use button instead)

**Best Use:** Production deployment

---

## Testing

### PC Testing

1. Navigate to page 2 (voice widget page)
2. Click microphone button
3. Speak a command (e.g., "dark mode")
4. Verify:
   - Beep plays
   - "Listening..." appears
   - Transcript updates as you speak
   - Theme changes
   - Confirmation message appears
   - TTS speaks "Theme changed to dark mode"

### Android/Fire TV Testing

**Option 1: Using Button (Recommended while wake word is broken)**
1. Deploy to Fire TV or Android device
2. Click the microphone button (or use Fire TV remote to select it)
3. Speak a command (e.g., "dark mode")
4. Verify same flow as PC

**Option 2: Using Wake Word (when fixed)**
1. Deploy to Fire TV or Android device
2. Say "Hey Dashie"
3. Speak a command
4. Verify same flow as PC

---

## Troubleshooting

### Beep Not Playing (PC)

**Cause:** Browser autoplay policy blocking AudioContext

**Fix:**
- Click mic button twice (first click initializes AudioContext)
- Check browser console for AudioContext errors
- Ensure volume is up

### Transcript Not Showing

**Cause:** Widget not receiving events from parent

**Check:**
1. Is widget registered? `window.widgetDataManager.widgets.has('voice')`
2. Are events firing? Look for `[WidgetDataManager] Sending voice event to widget` logs
3. Is widget on page 2? Navigate to page 2

### No Speech Recognition

**Cause:**
- PC: Microphone permission denied
- Android: Not running in Dashie app

**Fix:**
- PC: Grant mic permission in browser settings
- Android: Must run in Dashie Android app (not mobile web)

### Poor Transcription Accuracy (PC)

**Cause:** Web Speech API limitations

**Fix:**
- Speak clearly and slowly
- Minimize background noise
- Speak immediately after beep
- Use Android for better accuracy

---

## Future: AI Integration

### Planned Architecture

```
VoiceCommandRouter
  ↓
  Simple keyword match?
  ├─ Yes → Execute locally
  └─ No → Send to AI
            ↓
      ┌─────────────────┐
      │ AIService       │
      │ (Claude API)    │
      └─────────────────┘
            ↓
      Parse AI response
            ↓
      Execute actions
            ↓
      Speak AI response
```

### AI Command Examples

- "What's on my calendar tomorrow?"
- "Show me photos from last Christmas"
- "Set a reminder for 3pm"
- "What's the weather like today?"
- "Turn on do not disturb mode"

### Text Input Alternative

For testing AI without voice recognition issues:
- Add text input field to widget
- Type command and press Enter
- Sends to VoiceCommandRouter (same flow as voice)
- Better for development/testing

---

## Related Documentation

- **Android API:** See `.reference/VOICE_ASSISTANT_ANDROID_API.md`
- **Build Plan:** See `.reference/build-plans/voice-widget-implementation.md`
- **Widget Development:** See `js/widgets/WIDGETS_README.md`
- **Architecture:** See `.reference/ARCHITECTURE.md`

---

**End of Documentation**
