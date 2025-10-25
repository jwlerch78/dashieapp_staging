# Voice and AI Architecture - Consolidated Reference

**Version:** 2.0
**Last Updated:** 2025-10-24
**Status:** Production - Phase 1 Complete, Phase 2+ In Progress

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Current Implementation Status](#current-implementation-status)
4. [Voice System Architecture](#voice-system-architecture)
5. [AI System Architecture](#ai-system-architecture)
6. [Configuration Reference](#configuration-reference)
7. [Implementation Guide](#implementation-guide)
8. [API Reference](#api-reference)
9. [Widget Integration](#widget-integration)
10. [Testing & Troubleshooting](#testing--troubleshooting)
11. [Future Roadmap](#future-roadmap)
12. [File Reference](#file-reference)

---

## Executive Summary

Dashie features a comprehensive voice and AI system that provides:
- **Text-to-Speech (TTS)**: High-quality cloud-based voice output via ElevenLabs Flash v2.5 or OpenAI TTS
- **Speech-to-Text (STT)**: Multiple options - Deepgram Nova-3 (fastest), OpenAI Whisper, or native platform APIs
- **Voice Commands**: Local keyword matching for simple commands (theme changes, navigation)
- **AI Chat**: Claude Sonnet 4.5 integration for natural language conversations
- **Cross-Platform**: Unified experience on PC (Web), Android, and Fire TV

### Key Achievements
- ✅ **Unified Voice System**: Same voice quality across all platforms via cloud TTS
- ✅ **Fast TTS**: Sub-200ms latency with ElevenLabs Flash (vs 2400ms with previous OpenAI implementation)
- ✅ **Intelligent Caching**: Permanent cache for common phrases, instant playback on repeat
- ✅ **Voice Commands**: Theme switching, navigation, widget control
- ✅ **AI Integration**: Claude API for complex queries and conversations

---

## System Architecture Overview

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                          │
│     Voice Input (Mic) OR Text Input (Keyboard)              │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   VOICE WIDGET (UI)                          │
│  - Microphone button + Text input field                     │
│  - Live transcript display                                   │
│  - Status messages                                           │
└────────────┬────────────────────────────────────────────────┘
             │ postMessage
             ▼
┌─────────────────────────────────────────────────────────────┐
│               WIDGET DATA MANAGER                            │
│  - Receives widget actions                                   │
│  - Routes to VoiceService                                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│               VOICE SERVICE (Platform Abstraction)           │
│  - Detects platform (Android vs Web)                        │
│  - Loads appropriate provider                               │
│  - Exposes unified API                                       │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌──────────────┐  ┌──────────────────────┐
│ WebVoice     │  │ AndroidVoice         │
│ Provider     │  │ Provider             │
│              │  │                      │
│ STT:         │  │ STT:                 │
│ - Deepgram   │  │ - Deepgram           │ ← FASTEST (200ms)
│ - Whisper    │  │ - Whisper            │
│ - Web Speech │  │ - Android Native     │
│              │  │                      │
│ TTS:         │  │ TTS:                 │
│ - ElevenLabs │  │ - ElevenLabs         │ ← UNIFIED QUALITY
│ - OpenAI     │  │ - OpenAI             │
│ - Web Speech │  │ - Android Native     │
│              │  │                      │
│ Wake Word:   │  │ Wake Word:           │
│ - None       │  │ - Porcupine          │
└──────────────┘  └──────────────────────┘
       │                    │
       └────────┬───────────┘
                ↓
    ┌───────────────────────────┐
    │ Supabase Edge Functions   │
    │ - elevenlabs-tts          │
    │ - openai-tts              │
    │ - deepgram-stt            │
    │ - whisper-stt             │
    │ - claude-chat             │
    └───────────┬───────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ ElevenLabs   │  │ Deepgram     │
│ Flash v2.5   │  │ Nova-3       │
│ (TTS)        │  │ (STT)        │
└──────────────┘  └──────────────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ OpenAI       │  │ Claude       │
│ TTS/Whisper  │  │ Sonnet 4.5   │
└──────────────┘  └──────────────┘
       │
       ↓ AppComms Events
┌─────────────────────────────────────────────────────────────┐
│ VOICE_TRANSCRIPT_RECEIVED                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│          VOICE COMMAND ROUTER                                │
│  - Simple keyword matching (theme, nav)                      │
│  - Routes complex commands to AI                             │
│  - Executes local commands                                   │
│  - Triggers TTS confirmations                                │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Local        │  │ AI Service   │
│ Commands     │  │ (Claude)     │
│              │  │              │
│ - Theme      │  │ - Natural    │
│ - Navigation │  │   Language   │
│ - Widget     │  │ - Context    │
│   Control    │  │ - History    │
└──────────────┘  └──────────────┘
       │                 │
       └────────┬────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│           VOICE OUTPUT (Text-to-Speech)                      │
│  - ElevenLabs Flash: 150ms latency, highest quality          │
│  - Permanent cache: Instant playback for common phrases     │
│  - Fallback: Native TTS if cloud fails                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Current Implementation Status

### ✅ Phase 1: Voice Infrastructure (COMPLETE)

**Text-to-Speech (TTS)**
- ✅ ElevenLabs Flash v2.5 integration (150ms latency, 16x faster than old OpenAI)
- ✅ OpenAI TTS fallback
- ✅ Unified voice across PC and Android/Fire TV
- ✅ Voice configuration in `config.js` (5 voices: Bella, Rachel, Domi, Adam, Antoni)
- ✅ Client-side audio cache (50 phrases, instant playback)
- ✅ Settings integration (user can change voice)

**Speech-to-Text (STT)**
- ✅ Deepgram Nova-3 (200ms, 96.7% accuracy, recommended)
- ✅ OpenAI Whisper API fallback
- ✅ Web Speech API (PC)
- ✅ Android SpeechRecognizer (Android/Fire TV)
- ✅ Audio recording and cloud transcription

**Voice Commands**
- ✅ Theme switching ("dark mode", "light mode")
- ✅ Live transcript display
- ✅ Audio beep feedback
- ✅ Error handling

**Platform Support**
- ✅ PC (Web Speech API + Cloud TTS/STT)
- ✅ Android/Fire TV (Native APIs + Cloud TTS/STT)
- ✅ Unified codebase via platform abstraction

### 🔄 Phase 2: Advanced Features (IN PROGRESS)

**Permanent Audio Cache**
- ✅ IndexedDB cache manager (`voice-audio-cache.js`)
- ✅ Phrase preloader with categories (`voice-phrase-preloader.js`)
- ⏸️ Supabase Storage integration (tier 2 cache)
- ⏸️ Pre-generation script
- ⏸️ Voice sample playback in settings

**AI Integration**
- ✅ Claude Sonnet 4.5 integration (`ai-service.js`)
- ✅ Conversation history management
- ✅ Token usage tracking
- ✅ AI Response widget for chat display
- ✅ Voice command routing to AI for complex queries
- 🔄 Context enrichment (family data, calendar, widgets)

**Wake Word Detection**
- ⏸️ Porcupine integration (Android/Fire TV)
- ⏸️ Custom "Hey Dashie" wake word training
- ⏸️ Hands-free operation

### 📋 Phase 3: Future Enhancements

- Advanced voice commands (navigation, widget control, calendar queries)
- Multi-language support
- Voice cloning
- Emotion and speed control
- Offline mode
- Voice biometrics (speaker identification)

---

## Voice System Architecture

### Core Components

#### 1. VoiceService (Platform Abstraction Layer)

**File:** `js/core/voice-service.js`

**Purpose:** Single entry point for all voice functionality, auto-detects platform and loads appropriate provider.

**Key Methods:**
```javascript
// Initialize voice service
await VoiceService.initialize();

// Start listening for voice input
VoiceService.startListening();

// Stop listening
VoiceService.stopListening();

// Speak text using TTS
VoiceService.speak("Hello, world!");

// Stop speaking
VoiceService.stopSpeaking();

// Check state
VoiceService.isListening(); // boolean
VoiceService.isSpeaking();  // boolean

// Platform detection
VoiceService.isAndroid();     // boolean
VoiceService.isWebPlatform(); // boolean
```

**Events Emitted (via AppComms):**
- `VOICE_LISTENING_STARTED`
- `VOICE_LISTENING_STOPPED`
- `VOICE_PARTIAL_RESULT` (live transcript)
- `VOICE_TRANSCRIPT_RECEIVED` (final)
- `VOICE_ERROR`

---

#### 2. WebVoiceProvider (PC/Browser)

**File:** `js/core/voice/web-voice-provider.js`

**Features:**
- **STT Options:**
  - Deepgram Nova-3 (200ms, 96.7% accuracy, recommended)
  - OpenAI Whisper API (slower but accurate)
  - Web Speech API (native, fallback)
- **TTS:** ElevenLabs Flash v2.5 or OpenAI TTS via Supabase Edge Functions
- **Cache:** 50-item client-side cache for instant playback

**Configuration:**
```javascript
// Set in config.js
VOICE_CONFIG.sttProvider = 'deepgram'; // 'deepgram', 'whisper', or 'native'
VOICE_CONFIG.ttsProvider = 'elevenlabs'; // 'elevenlabs' or 'openai'
```

**Performance:**
- **TTS Latency:** 150ms (ElevenLabs) vs 2400ms (old OpenAI) = 16x faster
- **STT Latency:** 200ms (Deepgram) vs 6-7s (Whisper)
- **Cache Hit:** 0ms (instant playback)

---

#### 3. AndroidVoiceProvider (Android/Fire TV)

**File:** `js/core/voice/android-voice-provider.js`

**Features:**
- **STT Options:**
  - Deepgram Nova-3 (same as web)
  - OpenAI Whisper API
  - Android SpeechRecognizer (native)
- **TTS:** Same cloud implementation as WebVoiceProvider (unified quality!)
- **Wake Word:** Porcupine (when enabled)
- **Bridge:** Communicates with native Android layer via `DashieNative` interface

**Native Bridge Interface:**
```javascript
// Android → JavaScript events
window.onDashieVoiceEvent(event, data)
// Events: 'listeningStarted', 'speechResult', 'wakeWordDetected', etc.

// JavaScript → Android calls
window.DashieNative.startListening()
window.DashieNative.stopListening()
window.DashieNative.speak(text)
window.DashieNative.startWakeWordDetection()
```

---

#### 4. VoiceCommandRouter (Command Processing)

**File:** `js/core/voice-command-router.js`

**Purpose:** Routes voice commands to appropriate handlers (local or AI).

**Command Flow:**
1. Receives `VOICE_TRANSCRIPT_RECEIVED` event
2. Checks if simple command (keyword match)
3. If simple → Execute locally (theme, navigation)
4. If complex → Route to AI Service
5. Emit `VOICE_COMMAND_EXECUTED` event
6. Trigger TTS confirmation

**Current Local Commands:**

| Command Type | Keywords | Examples | Action |
|--------------|----------|----------|--------|
| **Theme** | dark, light, night mode, day mode | "dark mode", "switch to light theme" | Changes theme via SettingsService |

**Adding New Commands:**
```javascript
// In voice-command-router.js
_buildCommandPatterns() {
  return {
    theme: { /* existing */ },

    // Add new command
    navigation: {
      keywords: ['go to', 'open', 'show'],
      patterns: {
        settings: ['settings', 'preferences'],
        calendar: ['calendar', 'schedule']
      }
    }
  };
}
```

---

#### 5. Voice Audio Cache System

**Files:**
- `js/core/voice/voice-audio-cache.js` - IndexedDB cache manager
- `js/core/voice/voice-phrase-preloader.js` - Phrase definitions and preloader

**Three-Tier Caching Strategy:**

```
1st: Runtime Cache (Map) → 0ms (fastest, in-memory)
     ↓ (on miss)
2nd: IndexedDB (local) → ~10ms (permanent, persists across sessions)
     ↓ (on miss)
3rd: Supabase Storage (CDN) → ~100ms (shared across devices)
     ↓ (on miss)
4th: API Generation → ~150ms (ElevenLabs) or ~2400ms (OpenAI)
```

**Common Phrases (Cached Permanently):**
```javascript
// Voice samples (5 voices × 1 phrase = 5 files)
"Hi, I'm Bella", "Hi, I'm Rachel", etc.

// Theme changes (5 voices × 3 phrases = 15 files)
"Theme changed to dark mode"
"Theme changed to light mode"
"Theme changed to Halloween"

// System responses (5 voices × 6 phrases = 30 files)
"OK", "Done", "Got it", "Settings saved", etc.

// Confirmations (5 voices × 3 phrases = 15 files)
"Calendar refreshed", "Photos updated", etc.

// Errors (5 voices × 3 phrases = 15 files)
"Sorry, I didn't catch that", "Something went wrong", etc.
```

**Total:** ~80 files, ~5-10MB

**Cache API:**
```javascript
import { voiceAudioCache } from './voice-audio-cache.js';

// Initialize
await voiceAudioCache.initialize();

// Get cached audio
const audioBlob = await voiceAudioCache.get(text, voiceId);

// Store audio
await voiceAudioCache.set(text, voiceId, audioBlob);

// Check if cached
const isCached = await voiceAudioCache.has(text, voiceId);

// Clear voice
await voiceAudioCache.clearVoice('bella');

// Get stats
const stats = await voiceAudioCache.getStats();
// { count: 45, totalSize: 2048000, totalSizeMB: "1.95" }
```

---

## AI System Architecture

### AIService (Claude Integration)

**File:** `js/data/services/ai-service.js`

**Purpose:** Manages conversational AI interactions with Claude Sonnet 4.5.

**Features:**
- Conversation history management (keeps last 20 messages)
- Automatic history pruning (when > 30 messages, keep 10 most recent)
- Token usage tracking
- Cost estimation
- Error handling with retries

**API:**
```javascript
import { AIService } from '../data/services/ai-service.js';

// Initialize
await AIService.initialize();

// Send message and get response
const response = await AIService.chat("What's the weather?");

// Clear conversation
AIService.clearConversation();

// Get history
const history = AIService.getConversationHistory();

// Get stats
const stats = AIService.getStats();
// { messageCount: 10, totalTokensUsed: 5000, estimatedCost: "0.0450" }
```

**Configuration:**
```javascript
// In config.js
AI_CONFIG = {
  provider: 'claude',
  claude: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 1024,
    temperature: 1.0,
    systemPrompt: 'Keep responses concise and conversational...'
  },
  conversation: {
    maxHistoryMessages: 20,
    pruneThreshold: 30,
    keepRecentCount: 10
  }
};
```

**Cost Analysis:**
```
Claude Sonnet 4.5 Pricing:
- Input: $3/million tokens
- Output: $15/million tokens

Example usage (10 commands/day):
- ~500 input tokens per command
- ~100 output tokens per response
- 300 commands/month
- Cost: ~$0.02/user/month
```

---

## Configuration Reference

### Voice Configuration (config.js)

```javascript
// Available voices
export const AVAILABLE_VOICES = {
  BELLA: {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    gender: 'female',
    description: 'Young, energetic, friendly',
    language: 'en'
  },
  RACHEL: {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    gender: 'female',
    description: 'Calm, clear, professional',
    language: 'en'
  },
  DOMI: {
    id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    gender: 'female',
    description: 'Warm, friendly, conversational',
    language: 'en'
  },
  ADAM: {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    gender: 'male',
    description: 'Deep, confident, clear',
    language: 'en'
  },
  ANTONI: {
    id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    gender: 'male',
    description: 'Well-rounded, versatile',
    language: 'en'
  }
};

// Voice system configuration
export const VOICE_CONFIG = {
  // TTS Provider
  ttsProvider: 'elevenlabs', // 'elevenlabs' or 'openai'

  // STT Provider
  sttProvider: 'deepgram', // 'deepgram' (fastest), 'whisper', or 'native'

  // Default voice
  defaultVoice: AVAILABLE_VOICES.BELLA,

  // ElevenLabs settings
  elevenlabs: {
    model: 'eleven_flash_v2_5', // Fast + quality
    voiceSettings: {
      stability: 0.5,           // 0-1: Lower = expressive, Higher = stable
      similarityBoost: 0.75,    // 0-1: Voice consistency
      style: 0.0,               // 0-1: Style exaggeration
      useSpeakerBoost: true     // Enhanced clarity
    }
  },

  // Deepgram settings (STT)
  deepgram: {
    model: 'nova-3',            // Nova-3 (fastest, most accurate)
    language: 'en',
    smartFormat: true,          // Auto punctuation
    punctuate: true
  },

  // OpenAI settings (TTS + STT)
  openai: {
    ttsModel: 'tts-1',          // 'tts-1' or 'tts-1-hd'
    voice: 'nova',              // alloy, echo, fable, onyx, nova, shimmer
    speed: 1.0,                 // 0.25 - 4.0
    sttModel: 'whisper-1',      // Whisper model
    language: 'en'
  }
};
```

### Changing Voice at Runtime

**Via Settings Service (persisted to database):**
```javascript
import { AVAILABLE_VOICES } from './config.js';

// Update settings
await window.settingsStore.set('interface.voiceId', AVAILABLE_VOICES.ADAM.id);

// VoiceService automatically applies the change
```

**Direct API Call (session only):**
```javascript
const provider = window.voiceService.provider;

provider.setVoiceSettings({
  voice: AVAILABLE_VOICES.ADAM,
  provider: 'elevenlabs'
});

// Test it
await window.voiceService.speak("Hello, I'm Adam");
```

---

## Implementation Guide

### Adding a New Voice Command

**1. Define Command Pattern:**
```javascript
// In js/core/voice-command-router.js

_buildCommandPatterns() {
  return {
    // ... existing patterns

    refresh: {
      keywords: ['refresh', 'reload', 'update'],
      patterns: {
        calendar: ['calendar', 'schedule', 'events'],
        photos: ['photos', 'pictures', 'gallery'],
        all: ['everything', 'all', 'dashboard']
      }
    }
  };
}
```

**2. Add Detection Method:**
```javascript
_matchesRefreshCommand(lower) {
  const { refresh } = this.commandPatterns;
  return refresh.keywords.some(keyword => lower.includes(keyword));
}
```

**3. Add Handler Method:**
```javascript
async _handleRefresh(lower) {
  const { patterns } = this.commandPatterns.refresh;

  if (patterns.calendar.some(kw => lower.includes(kw))) {
    // Refresh calendar
    await window.dataManager.getService('calendar').refresh();
    this._speakConfirmation('Calendar refreshed');
    this._emitCommandExecuted('refresh', 'Calendar refreshed');
  }
  else if (patterns.all.some(kw => lower.includes(kw))) {
    // Refresh everything
    await window.dataManager.refreshAll();
    this._speakConfirmation('Dashboard refreshed');
    this._emitCommandExecuted('refresh', 'Dashboard refreshed');
  }
}
```

**4. Wire Up:**
```javascript
_handleLocalCommand(transcript) {
  const lower = transcript.toLowerCase();

  if (this._matchesThemeCommand(lower)) {
    this._handleThemeChange(lower);
  }
  else if (this._matchesRefreshCommand(lower)) {
    this._handleRefresh(lower);
  }
  // ... other commands
}
```

---

### Integrating Voice into a New Widget

**1. Add Voice Action Handler in Widget:**
```javascript
// In your-widget.js

// Listen for voice commands
window.addEventListener('message', (event) => {
  if (event.data.type === 'command' && event.data.action === 'voice-command') {
    handleVoiceCommand(event.data.payload);
  }
});

function handleVoiceCommand(command) {
  if (command.includes('show details')) {
    showDetails();
    sendToParent('action-completed', { action: 'show-details' });
  }
}
```

**2. Send Voice Feedback to Widget Data Manager:**
```javascript
// In widget-data-manager.js

handleVoiceCommand(widgetId, command) {
  const widget = this.widgets.get(widgetId);
  if (!widget) return;

  widget.iframe.contentWindow.postMessage({
    type: 'command',
    action: 'voice-command',
    payload: command
  }, '*');
}
```

---

## API Reference

### VoiceService API

```javascript
// Singleton instance
import VoiceService from './js/core/voice-service.js';

// Initialize (call once on app start)
await VoiceService.initialize();

// Speech-to-Text
VoiceService.startListening();     // Start voice recognition
VoiceService.stopListening();      // Stop and process
VoiceService.cancelListening();    // Cancel without result
VoiceService.isListening();        // Check state

// Text-to-Speech
VoiceService.speak(text);          // Speak text
VoiceService.stopSpeaking();       // Stop current speech
VoiceService.isSpeaking();         // Check state

// Platform Detection
VoiceService.isAndroid();          // true if Android/Fire TV
VoiceService.isWebPlatform();      // true if PC/browser

// Cleanup
VoiceService.destroy();
```

### AIService API

```javascript
import { AIService } from './js/data/services/ai-service.js';

// Initialize
await AIService.initialize();

// Chat
const response = await AIService.chat("What's the weather?");

// Manage conversation
AIService.clearConversation();
const history = AIService.getConversationHistory();
const stats = AIService.getStats();

// Check state
AIService.isReady(); // boolean

// Cleanup
AIService.destroy();
```

### Voice Audio Cache API

```javascript
import { voiceAudioCache } from './js/core/voice/voice-audio-cache.js';

// Initialize
await voiceAudioCache.initialize();

// Cache operations
const blob = await voiceAudioCache.get(text, voiceId);
await voiceAudioCache.set(text, voiceId, blob, metadata);
const exists = await voiceAudioCache.has(text, voiceId);
await voiceAudioCache.delete(text, voiceId);

// Bulk operations
await voiceAudioCache.clearVoice(voiceId);
await voiceAudioCache.clearAll();
const stats = await voiceAudioCache.getStats();
```

---

## Widget Integration

### Voice Widget

**Location:** `js/widgets/voice/`

**Files:**
- `voice-widget.html` - UI structure
- `voice-widget.css` - Styles
- `voice-widget.js` - Logic
- `VOICE_WIDGET_README.md` - Documentation

**Features:**
- Microphone button for voice input
- Text input field for typed commands
- Live transcript display
- Status messages and confirmations
- Visual state indicators (idle, listening, processing, etc.)
- Audio beep feedback

**States:**
- `idle` - Ready for input
- `listening` - Recording voice (pulsing animation)
- `typing` - User typing text
- `transcribing` - Live transcript updating
- `processing` - Command being processed
- `confirmation` - Success message shown
- `error` - Error message shown

**Communication:**
```javascript
// Widget → Parent
sendToParent('voice-action', { action: 'start-listening' });
sendToParent('user-message', { content: text, source: 'text' });

// Parent → Widget (via postMessage)
{
  type: 'data',
  action: 'voice-event',
  payload: {
    eventType: 'VOICE_LISTENING_STARTED',
    data: null
  }
}
```

---

### AI Response Widget

**Location:** `js/widgets/ai-response/`

**Files:**
- `ai-response.html` - Chat UI
- `ai-response.css` - Styles
- `ai-response.js` - Chat logic

**Features:**
- Chat-style conversation display
- User, AI, and system message bubbles
- Auto-scrolling to latest message
- Clear chat button
- Loading indicators
- User profile picture integration
- Timestamp display

**Message Format:**
```javascript
{
  sender: 'user' | 'ai' | 'system',
  content: 'Message text',
  timestamp: 1729800000000,
  messageId: 'msg_123_abc',
  metadata: { /* optional */ },
  isLoading: false
}
```

**API:**
```javascript
// Add message
window.aiResponseWidget.addMessage({
  sender: 'user',
  content: 'Hello!',
  timestamp: Date.now(),
  messageId: generateId()
});

// Clear chat
window.aiResponseWidget.clearChat();

// Scroll to bottom
window.aiResponseWidget.scrollToBottom();

// Get all messages
const messages = window.aiResponseWidget.getMessages();
```

---

## Testing & Troubleshooting

### Testing Voice Commands

**PC Testing:**
1. Navigate to voice widget (page 2)
2. Click microphone button
3. Speak command (e.g., "dark mode")
4. Verify:
   - ✅ Beep plays
   - ✅ "Listening..." appears
   - ✅ Live transcript updates
   - ✅ Command executes
   - ✅ Confirmation spoken
   - ✅ Success message shown

**Android/Fire TV Testing:**
1. Deploy to device
2. Click microphone button (or say "Hey Dashie" when wake word works)
3. Speak command
4. Verify same flow as PC

**Text Input Testing:**
1. Type command in text field
2. Press Enter or click send
3. Verify command processes correctly

### Performance Testing

**Measure TTS Latency:**
```javascript
const start = performance.now();
await VoiceService.speak("Test phrase");
const end = performance.now();
console.log(`TTS took ${Math.round(end - start)}ms`);

// Expected:
// - ElevenLabs Flash: 150ms (first time), 0ms (cached)
// - OpenAI TTS: 2400ms (first time), 0ms (cached)
```

**Measure STT Latency:**
```javascript
// Start recording
VoiceService.startListening();

// Speak
// (transcript appears in console with timing)

// Expected:
// - Deepgram: 200ms
// - Whisper: 6000ms
// - Native Web Speech: 1500ms
```

**Check Cache Stats:**
```javascript
const stats = await voiceAudioCache.getStats();
console.log('Cache:', stats);
// { count: 45, totalSize: 2048000, totalSizeMB: "1.95" }
```

### Common Issues

#### Issue: No beep sound on PC

**Cause:** Browser autoplay policy blocking AudioContext

**Fix:**
1. Click mic button twice (first initializes AudioContext)
2. Check browser console for errors
3. Ensure volume is up

#### Issue: Poor transcription accuracy

**Cause:**
- Web Speech API limitations (PC)
- Background noise
- Unclear speech

**Fix:**
- Use Deepgram STT instead of native (change `sttProvider` in config.js)
- Speak clearly and slowly
- Minimize background noise
- Use Android for better accuracy

#### Issue: TTS not working

**Cause:**
- Network issue
- Supabase Edge Function not deployed
- API key missing/invalid

**Fix:**
1. Check network connection
2. Verify Edge Functions are deployed
3. Check API keys in Supabase dashboard
4. Test with fallback: `VOICE_CONFIG.ttsProvider = 'openai'`

#### Issue: Voice changes not persisting

**Cause:** Settings not saved to database

**Fix:**
```javascript
// Check if settings service is working
const voiceId = window.settingsStore.get('interface.voiceId');
console.log('Current voice ID:', voiceId);

// Manually set
await window.settingsStore.set('interface.voiceId', AVAILABLE_VOICES.ADAM.id);

// Verify
const newVoiceId = window.settingsStore.get('interface.voiceId');
console.log('New voice ID:', newVoiceId);
```

---

## Future Roadmap

### Phase 2: Permanent Cache (In Progress)

- ⏸️ Supabase Storage bucket for voice cache
- ⏸️ Pre-generation script (`scripts/generate-voice-cache.js`)
- ⏸️ Voice sample playback in settings
- ⏸️ Auto-preload on app startup

**Benefits:**
- 99% cost reduction for common phrases
- Instant playback (0ms)
- Offline support for cached phrases

### Phase 3: Advanced Voice Commands

**Navigation:**
- "Go to settings"
- "Open calendar view"
- "Show the map"

**Widget Control:**
- "Refresh calendar"
- "Update photos"
- "Show next photo"

**Calendar Queries:**
- "What's on my calendar tomorrow?"
- "Do I have any meetings today?"
- "When is my next appointment?"

**Photo Queries:**
- "Show me photos from Christmas"
- "Display pictures of the kids"
- "Show me photos from last month"

### Phase 4: AI Context Enrichment

**Enhanced System Prompt:**
```javascript
AI_CONFIG.claude.systemPrompt = `
You are Dashie, a family smart home assistant.

Current context:
- Family: ${familyMembers.map(m => m.name).join(', ')}
- Time: ${currentTime}
- Location: ${userLocation}
- Active widgets: ${activeWidgets.join(', ')}
- Upcoming events: ${upcomingEvents.slice(0, 3).map(e => e.title).join(', ')}

You can:
1. Control the dashboard (theme, navigation, widgets)
2. Answer questions using web search
3. Provide personalized family assistance

Keep responses concise and conversational for TTS output.
`;
```

**Dashboard Commands:**
```javascript
// AI can execute these via structured responses
{
  "action": "dashboard_command",
  "command": "show_location",
  "parameters": { "member_name": "Mary" },
  "response_text": "Mary is currently at Publix. I've shown her on the map."
}
```

### Phase 5: Multi-Language Support

**Configuration:**
```javascript
VOICE_CONFIG.language = 'en'; // 'en', 'es', 'fr', etc.

// Language-specific voices
AVAILABLE_VOICES.BELLA_ES = {
  id: 'spanish_bella_id',
  name: 'Bella (Spanish)',
  language: 'es'
};
```

### Phase 6: Advanced Features

- **Voice Cloning:** Upload custom voice samples to ElevenLabs
- **Emotion Control:** Adjust voice expressiveness dynamically
- **Speed Control:** Variable speech rate for accessibility
- **Voice Biometrics:** Identify speakers for personalized responses
- **Offline Mode:** Local TTS/STT when network unavailable
- **Conversation Memory:** Long-term context across sessions

---

## File Reference

### Core Voice System

```
js/core/
├── voice-service.js                    # Platform abstraction layer
├── voice-command-router.js             # Command processing and routing
└── voice/
    ├── web-voice-provider.js           # Web Speech API + Cloud TTS/STT
    ├── android-voice-provider.js       # Android native + Cloud TTS/STT
    ├── voice-audio-cache.js            # Permanent cache (IndexedDB)
    └── voice-phrase-preloader.js       # Common phrase definitions
```

### AI System

```
js/data/services/
└── ai-service.js                       # Claude API integration
```

### Widgets

```
js/widgets/
├── voice/
│   ├── voice-widget.html               # Voice input widget UI
│   ├── voice-widget.css                # Styles
│   ├── voice-widget.js                 # Logic
│   └── VOICE_WIDGET_README.md          # Documentation
└── ai-response/
    ├── ai-response.html                # Chat widget UI
    ├── ai-response.css                 # Styles
    └── ai-response.js                  # Chat logic
```

### Configuration

```
config.js                               # VOICE_CONFIG and AI_CONFIG
```

### Supabase Edge Functions

```
supabase/functions/
├── elevenlabs-tts/                     # ElevenLabs TTS proxy
├── openai-tts/                         # OpenAI TTS proxy
├── deepgram-stt/                       # Deepgram STT proxy
├── whisper-stt/                        # Whisper STT proxy
└── claude-chat/                        # Claude API proxy
```

### Documentation

```
.reference/
├── build-plans/
│   ├── UNIFIED_VOICE_SYSTEM.md         # Voice unification plan
│   ├── PERMANENT_VOICE_CACHE.md        # Cache implementation plan
│   ├── VOICE_CONFIGURATION_GUIDE.md    # Voice configuration guide
│   ├── voice-ai-assistant-plan.md      # Original AI assistant plan
│   ├── cloud-voice-architecture.md     # Cloud TTS/STT architecture
│   └── TTS_API_COMPARISON.md           # TTS provider comparison
└── VOICE_AND_AI_ARCHITECTURE.md        # This document
```

---

## Summary

Dashie's voice and AI system provides a comprehensive, production-ready solution for voice-controlled smart home interaction. Key highlights:

### Achievements
- ✅ **16x faster TTS** (150ms vs 2400ms) with ElevenLabs Flash
- ✅ **Unified voice quality** across all platforms
- ✅ **Intelligent caching** for instant playback
- ✅ **Multiple STT options** (Deepgram fastest at 200ms)
- ✅ **AI integration** with Claude Sonnet 4.5
- ✅ **Platform abstraction** for seamless cross-platform support

### Active Development
- 🔄 Permanent cache system with Supabase Storage
- 🔄 AI context enrichment for smarter responses
- 🔄 Wake word detection for hands-free operation
- 🔄 Advanced voice commands

### Cost-Effective
- **TTS:** ~$0.05-0.10 per 1K characters (cached phrases are free)
- **STT:** ~$0.006 per minute (Whisper) or ~$0.004 per minute (Deepgram)
- **AI:** ~$0.02 per user per month (300 commands)
- **Total:** ~$0.50-1.00 per user per month

### Next Steps
1. Complete permanent cache implementation
2. Deploy pre-generated audio to Supabase Storage
3. Add advanced voice commands (navigation, widget control)
4. Enrich AI context with family/calendar/widget data
5. Train custom "Hey Dashie" wake word
6. Implement multi-language support

---

**Document Version:** 2.0
**Last Updated:** 2025-10-24
**Status:** Production - Active Development

For questions or contributions, see `.reference/CONTRIBUTING.md`.
