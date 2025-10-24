# Voice Chat Interface Design
**Version:** 1.0
**Date:** 2025-10-24
**Status:** Design Phase

---

## Overview

A chat-style interface for testing voice/AI capabilities with two widgets:
1. **Voice Widget** (enhanced) - Input widget with mic button + text input
2. **AI Response Widget** (new) - Output widget that displays AI responses

This creates a conversational testing interface similar to ChatGPT but integrated into Dashie.

---

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard Layout (2-column grid)                            │
│                                                              │
│  ┌───────────────────┐  ┌───────────────────────────────┐  │
│  │  Voice Widget     │  │  AI Response Widget           │  │
│  │  (Left Column)    │  │  (Right Column)               │  │
│  │                   │  │                                 │  │
│  │  [🎤] Mic Button  │  │  ┌─────────────────────────┐  │  │
│  │                   │  │  │ AI: Here's your theme   │  │  │
│  │  ┌──────────────┐ │  │  │ changed to dark mode... │  │  │
│  │  │ Text Input   │ │  │  └─────────────────────────┘  │  │
│  │  │ Type here... │ │  │                                 │  │
│  │  └──────────────┘ │  │  ┌─────────────────────────┐  │  │
│  │  [Send]           │  │  │ User: What's my         │  │  │
│  │                   │  │  │ calendar tomorrow?      │  │  │
│  │  Transcript:      │  │  └─────────────────────────┘  │  │
│  │  "Dark mode..."   │  │                                 │  │
│  └───────────────────┘  │  ┌─────────────────────────┐  │  │
│                          │  │ AI: Tomorrow you have... │  │
│                          │  └─────────────────────────┘  │
│                          └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ↓ postMessage
          ┌──────────────────────────────────────┐
          │  WidgetMessenger / VoiceService      │
          │  - Routes messages between widgets   │
          │  - Handles voice recognition         │
          │  - Sends to AI service               │
          └──────────────────────────────────────┘
                             │
                             ↓
          ┌──────────────────────────────────────┐
          │  VoiceCommandRouter / AIService      │
          │  - Routes to local commands OR AI    │
          │  - Returns structured responses      │
          └──────────────────────────────────────┘
```

---

## Widget 1: Voice Widget (Enhanced)

### Purpose
Input widget that accepts both voice and text input for testing.

### Current Features (Keep)
- ✅ Microphone button with voice recognition
- ✅ Live transcript display
- ✅ Visual states (idle, listening, transcribing, etc.)
- ✅ Audio beep when listening starts
- ✅ Platform detection (Web vs Android)

### New Features (Add)
- ✅ Text input field for typing commands
- ✅ Send button for submitting text
- ✅ Both voice AND text route through same command pipeline
- ✅ Shows user's input (whether spoken or typed)

### UI Layout

```
┌─────────────────────────────────┐
│ Voice Widget                    │
├─────────────────────────────────┤
│                                 │
│        [🎤] Microphone          │
│      (pulsing when listening)   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Type your command...    │   │
│  └─────────────────────────┘   │
│                                 │
│          [Send Button]          │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  Last Input:                    │
│  "Change theme to dark mode"    │
│                                 │
│  Status: Processing...          │
│                                 │
└─────────────────────────────────┘
```

### State Machine

```
States:
- idle: Waiting for input
- listening: Mic active, capturing voice
- typing: User typing in text field
- processing: Sent to backend, waiting for response
- sent: Message successfully sent
- error: Error occurred

Transitions:
idle → listening (mic button clicked)
idle → typing (text field focused)
listening → processing (voice captured)
typing → processing (send clicked/enter pressed)
processing → sent (response received)
processing → error (error occurred)
sent → idle (after 2 seconds)
error → idle (after 3 seconds)
```

### Messages TO Voice Widget

| Message Type | Action | Payload | Description |
|--------------|--------|---------|-------------|
| `command` | `enter-focus` | - | Widget focused (shows selection) |
| `command` | `enter-active` | - | Widget active (can control) |
| `command` | `exit-active` | - | Widget no longer active |
| `command` | `exit-focus` | - | Widget no longer focused |
| `data` | `voice-event` | `{ eventType, data }` | Voice recognition events |
| `data` | `message-sent-confirmation` | `{ messageId, timestamp }` | Confirmation message was sent |

### Messages FROM Voice Widget

| Message Type | Data | Description |
|--------------|------|-------------|
| `widget-ready` | `{ widgetId: 'voice' }` | Widget initialized |
| `voice-action` | `{ action: 'start-listening' }` | User clicked mic button |
| `voice-action` | `{ action: 'stop-listening' }` | User stopped recording |
| `user-message` | `{ source, content, timestamp, messageId }` | User sent message (voice or text) |

### User Message Format

```javascript
{
  type: 'user-message',
  widgetId: 'voice',
  payload: {
    messageId: 'msg_1234567890',      // Unique ID
    source: 'voice' | 'text',          // How was it input?
    content: 'Change theme to dark',   // The actual message
    timestamp: 1234567890,             // Unix timestamp
    metadata: {                        // Optional metadata
      confidence: 0.95,                // Voice: transcription confidence
      interim: false,                  // Voice: final or interim result
      platform: 'web' | 'android'      // Platform
    }
  }
}
```

---

## Widget 2: AI Response Widget (New)

### Purpose
Output widget that displays conversation history in a chat-style interface.

### Features
- Shows chat bubbles (user messages + AI responses)
- Auto-scrolls to latest message
- Supports markdown formatting in responses
- Shows loading indicator when AI is thinking
- Can show error messages
- Theme-aware styling

### UI Layout

```
┌─────────────────────────────────────────┐
│ AI Response                             │
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │ 🧑 You: Dark mode                │  │  ← User message (right-aligned)
│  └──────────────────────────────────┘  │
│                                         │
│ ┌────────────────────────────────────┐ │
│ │ 🤖 AI: Theme changed to dark mode. │ │  ← AI response (left-aligned)
│ │      Would you like anything else? │ │
│ └────────────────────────────────────┘ │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 🧑 You: What's on my calendar    │  │
│  │      tomorrow?                    │  │
│  └──────────────────────────────────┘  │
│                                         │
│ ┌────────────────────────────────────┐ │
│ │ 🤖 AI: [Loading...]               │ │  ← Loading state
│ └────────────────────────────────────┘ │
│                                         │
│                        [Clear Chat] ↓   │  ← Action buttons at bottom
└─────────────────────────────────────────┘
```

### Message Types

```javascript
// User message (echo from voice widget)
{
  sender: 'user',
  content: 'Change theme to dark mode',
  timestamp: 1234567890,
  messageId: 'msg_1234567890',
  source: 'voice' | 'text'
}

// AI response
{
  sender: 'ai',
  content: 'Theme changed to dark mode. Is there anything else?',
  timestamp: 1234567891,
  messageId: 'msg_1234567891',
  metadata: {
    command: 'theme-change',        // What command was executed
    success: true,                   // Did it work?
    executionTime: 123               // How long it took (ms)
  }
}

// System message
{
  sender: 'system',
  content: 'Connection lost. Retrying...',
  timestamp: 1234567892,
  messageId: 'msg_1234567892',
  level: 'error' | 'info' | 'warning'
}
```

### Messages TO AI Response Widget

| Message Type | Action | Payload | Description |
|--------------|--------|---------|-------------|
| `command` | `enter-focus` | - | Widget focused |
| `command` | `enter-active` | - | Widget active |
| `command` | `exit-active` | - | Widget no longer active |
| `command` | `exit-focus` | - | Widget no longer focused |
| `data` | `add-message` | `{ sender, content, timestamp, messageId, metadata }` | Add message to chat |
| `data` | `clear-chat` | - | Clear all messages |
| `command` | `scroll-to-bottom` | - | Scroll to latest message |

### Messages FROM AI Response Widget

| Message Type | Data | Description |
|--------------|------|-------------|
| `widget-ready` | `{ widgetId: 'ai-response' }` | Widget initialized |
| `message-clicked` | `{ messageId }` | User clicked a message |
| `action-requested` | `{ action, context }` | User requested action (e.g., retry) |

### Chat Message Component

```javascript
class ChatMessage {
  constructor(data) {
    this.sender = data.sender;        // 'user' | 'ai' | 'system'
    this.content = data.content;      // Message text
    this.timestamp = data.timestamp;  // Unix timestamp
    this.messageId = data.messageId;  // Unique ID
    this.metadata = data.metadata;    // Optional extra data
  }

  render() {
    // Returns HTML element with appropriate styling
  }

  getAlignmentClass() {
    // user: right-aligned
    // ai: left-aligned
    // system: center-aligned
  }

  getAvatarEmoji() {
    // user: 🧑
    // ai: 🤖
    // system: ℹ️
  }
}
```

---

## Communication Flow

### Flow 1: User Types Text Message

```
1. User types in Voice Widget text input
2. User presses Enter or clicks Send
3. Voice Widget generates message:
   {
     type: 'user-message',
     payload: {
       messageId: 'msg_123',
       source: 'text',
       content: 'Dark mode',
       timestamp: 1234567890
     }
   }
4. Message sent to parent via postMessage
5. Parent routes to:
   a) VoiceCommandRouter (processes command)
   b) AI Response Widget (displays user message)
6. Command executed (theme changes)
7. Parent sends AI response to AI Response Widget:
   {
     type: 'data',
     action: 'add-message',
     payload: {
       sender: 'ai',
       content: 'Theme changed to dark mode',
       timestamp: 1234567891,
       messageId: 'msg_124'
     }
   }
8. AI Response Widget displays response
```

### Flow 2: User Speaks Voice Command

```
1. User clicks mic button in Voice Widget
2. Voice Widget sends: { action: 'start-listening' }
3. Parent starts voice recognition (VoiceService)
4. Parent sends voice events to Voice Widget:
   - VOICE_LISTENING_STARTED
   - VOICE_PARTIAL_RESULT (live transcript)
   - VOICE_TRANSCRIPT_RECEIVED (final)
5. Voice Widget generates message (same format as text):
   {
     type: 'user-message',
     payload: {
       messageId: 'msg_125',
       source: 'voice',
       content: 'Dark mode',
       timestamp: 1234567892,
       metadata: {
         confidence: 0.95,
         platform: 'web'
       }
     }
   }
6. Flow continues same as Flow 1 (steps 5-8)
```

### Flow 3: AI Processing (Future - Cloud Integration)

```
1. User message received by parent
2. VoiceCommandRouter checks:
   a) Simple command? → Execute locally
   b) Complex query? → Send to AI
3. If AI needed:
   - Parent sends to AI Response Widget:
     { sender: 'ai', content: '[Thinking...]' }
   - Parent calls AIService.processQuery(message)
   - AIService makes API call to Claude
   - Claude returns structured response
   - Parent sends to AI Response Widget:
     { sender: 'ai', content: 'Here's the answer...' }
   - Parent executes any actions in response
```

---

## Data Structures

### Message ID Generation

```javascript
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

### Message Storage (Optional - for chat history)

```javascript
class ChatHistory {
  constructor() {
    this.messages = [];
    this.maxMessages = 100; // Keep last 100 messages
  }

  addMessage(message) {
    this.messages.push(message);
    if (this.messages.length > this.maxMessages) {
      this.messages.shift(); // Remove oldest
    }
    this.save();
  }

  save() {
    localStorage.setItem('dashie_chat_history', JSON.stringify(this.messages));
  }

  load() {
    const saved = localStorage.getItem('dashie_chat_history');
    if (saved) {
      this.messages = JSON.parse(saved);
    }
  }

  clear() {
    this.messages = [];
    localStorage.removeItem('dashie_chat_history');
  }
}
```

---

## Parent Window Changes

### New/Updated Files

1. **`js/core/widget-messenger.js`**
   - Add `broadcastToWidget(widgetId, type, action, payload)` method
   - Add `broadcastUserMessage(message)` method
   - Add `broadcastAIResponse(response)` method

2. **`js/core/command-router.js`** (RENAME from voice-command-router.js)
   - Determines WHERE to route commands (local vs AI)
   - Accept messages from text input (not just voice)
   - Routes to CommandProcessor for local commands
   - Routes to AIService for complex queries

3. **`js/core/command-processor.js`** (NEW - extract from voice-command-router.js)
   - Executes local commands (theme, navigation, widgets, etc.)
   - Contains all command patterns and matchers
   - Emits structured responses for AI widget
   - Add `_emitAIResponse(content, metadata)` method

4. **`js/core/widget-data-manager.js`** (update)
   - Forward user messages to AI Response widget
   - Forward AI responses to AI Response widget
   - Handle new message types

### New Event Types (AppComms)

```javascript
// User sent message (voice or text)
AppComms.publish('USER_MESSAGE_SENT', {
  messageId: 'msg_123',
  source: 'voice' | 'text',
  content: 'Dark mode',
  timestamp: 1234567890
});

// AI response generated
AppComms.publish('AI_RESPONSE_GENERATED', {
  messageId: 'msg_124',
  content: 'Theme changed to dark mode',
  timestamp: 1234567891,
  metadata: {
    command: 'theme-change',
    success: true
  }
});

// System message
AppComms.publish('SYSTEM_MESSAGE', {
  messageId: 'msg_125',
  content: 'Error: Could not connect to AI',
  level: 'error',
  timestamp: 1234567892
});
```

---

## Widget Configuration

### Update page-config.js

```javascript
// Page 2 - Voice/AI Testing Page
{
  id: 'page2',
  label: 'Voice & AI',
  gridTemplate: {
    columns: '1fr 1fr',  // Two equal columns
    rows: '1fr',          // Single row
    areas: [
      { row: 1, col: 1, widgetId: 'voice' },        // Left: Voice input
      { row: 1, col: 2, widgetId: 'ai-response' }   // Right: AI responses
    ]
  }
}
```

### Register Widgets

```javascript
// In widget-config.js or initialization
const widgetRegistry = {
  voice: {
    id: 'voice',
    src: '/js/widgets/voice/voice-widget.html',
    canCenter: false,
    focusMenu: { enabled: false }
  },
  'ai-response': {
    id: 'ai-response',
    src: '/js/widgets/ai-response/ai-response.html',
    canCenter: false,
    focusMenu: { enabled: false }
  }
};
```

---

## Implementation Plan

### Phase 1: Update Voice Widget (Priority)

**Tasks:**
1. ✅ Add HTML for text input + send button
2. ✅ Add CSS styling for input field
3. ✅ Add event listeners for input/send
4. ✅ Generate `user-message` from text input
5. ✅ Update state machine to handle typing state
6. ✅ Test text input → command execution flow
7. ✅ Update VOICE_WIDGET_README.md

**Files to modify:**
- `js/widgets/voice/voice-widget.html`
- `js/widgets/voice/voice-widget.css`
- `js/widgets/voice/voice-widget.js`
- `js/core/voice-command-router.js` (accept text source)

**Estimated time:** 2-3 hours

---

### Phase 2: Create AI Response Widget

**Tasks:**
1. ✅ Create widget folder structure
2. ✅ Create HTML template
3. ✅ Create CSS for chat bubbles
4. ✅ Create JavaScript class
5. ✅ Implement message rendering
6. ✅ Implement auto-scroll
7. ✅ Test receiving messages from parent
8. ✅ Add theme support
9. ✅ Create widget README

**Files to create:**
- `js/widgets/ai-response/ai-response.html`
- `js/widgets/ai-response/ai-response.css`
- `js/widgets/ai-response/ai-response.js`
- `js/widgets/ai-response/AI_RESPONSE_WIDGET_README.md`

**Estimated time:** 3-4 hours

---

### Phase 3: Wire Up Communication

**Tasks:**
1. ✅ Update WidgetMessenger to route user messages
2. ✅ Update VoiceCommandRouter to emit AI responses
3. ✅ Update WidgetDataManager to forward messages
4. ✅ Test end-to-end flow (text → response)
5. ✅ Test end-to-end flow (voice → response)
6. ✅ Add error handling
7. ✅ Add loading states

**Files to modify:**
- `js/core/widget-messenger.js`
- `js/core/voice-command-router.js`
- `js/core/widget-data-manager.js`

**Estimated time:** 2-3 hours

---

### Phase 4: Polish & Testing

**Tasks:**
1. ✅ Add clear chat button
2. ✅ Add message timestamps
3. ✅ Add markdown support in responses
4. ✅ Test on all platforms (PC, Android, Fire TV)
5. ✅ Test theme switching
6. ✅ Add keyboard shortcuts (Enter to send)
7. ✅ Add visual polish (animations, transitions)
8. ✅ Update documentation

**Estimated time:** 2 hours

---

## Future Enhancements

### Chat Features
- [ ] Message history persistence (localStorage)
- [ ] Export chat to file
- [ ] Copy message to clipboard
- [ ] Retry failed messages
- [ ] Edit and resend messages

### AI Integration
- [ ] Claude API integration
- [ ] Streaming responses (show as AI "types")
- [ ] Context awareness (remember conversation)
- [ ] Tool calling (AI can trigger dashboard actions)
- [ ] Suggested follow-up questions

### Voice Enhancements
- [ ] Voice playback of AI responses (TTS)
- [ ] Multiple language support
- [ ] Voice commands for chat (e.g., "clear chat")
- [ ] Voice activity detection (auto-start on speech)

### UI/UX
- [ ] Rich message formatting (code blocks, tables)
- [ ] Inline images/media in responses
- [ ] Message reactions/feedback
- [ ] Compact mode (smaller bubbles)
- [ ] Side-by-side vs stacked layout option

---

## Testing Checklist

### Voice Widget Tests
- [ ] Mic button starts voice recognition
- [ ] Text input accepts typing
- [ ] Enter key sends message
- [ ] Send button sends message
- [ ] Messages include correct metadata (source, timestamp)
- [ ] Voice and text messages look the same to backend
- [ ] Loading state shows when processing
- [ ] Error states display correctly
- [ ] Theme updates apply correctly

### AI Response Widget Tests
- [ ] Widget receives and displays user messages
- [ ] Widget receives and displays AI responses
- [ ] Messages scroll automatically to bottom
- [ ] User messages align right
- [ ] AI messages align left
- [ ] System messages align center
- [ ] Clear chat button works
- [ ] Theme updates apply to all messages
- [ ] Long messages wrap correctly
- [ ] Timestamps display correctly

### Integration Tests
- [ ] Text message → local command → response displayed
- [ ] Voice message → local command → response displayed
- [ ] Error handling works end-to-end
- [ ] Both widgets update simultaneously
- [ ] Page switching preserves chat state
- [ ] Multiple rapid messages handled correctly

---

## Documentation References

- **Current Voice System:** `js/widgets/voice/VOICE_WIDGET_README.md`
- **Widget Development:** `js/widgets/WIDGETS_README.md`
- **Message Protocol:** `js/widgets/WIDGETS_README.md#message-protocol`
- **Theme Support:** `js/ui/themes/THEME_OVERLAY.md`
- **Architecture:** `.reference/ARCHITECTURE.md`

---

## Current State & Context (Session Notes)

### Completed Before This Design
- ✅ Voice widget with mic button working (PC and Android)
- ✅ Voice recognition via VoiceService (Web Speech API / DashieNative)
- ✅ Theme command working ("dark mode", "light mode")
- ✅ Full message flow working: Widget → WidgetDataManager → VoiceService → VoiceCommandRouter → SettingsService

### Current File Structure (Before Refactor)
```
js/core/
├── voice-service.js           # Platform abstraction (Web/Android)
├── voice-command-router.js    # Command parsing AND execution (will split)
├── widget-data-manager.js     # Message broker between widgets and services
├── widget-messenger.js        # Widget communication
└── voice/
    ├── web-voice-provider.js     # Web Speech API wrapper
    └── android-voice-provider.js # DashieNative wrapper

js/widgets/voice/
├── voice-widget.html          # Current: Mic button only
├── voice-widget.js            # Current: Voice input only
├── voice-widget.css
└── VOICE_WIDGET_README.md
```

### Key Findings from Context Analysis
1. **Current theme execution**: `VoiceCommandRouter` directly calls `settingsService.updateSettings()` (line 218)
2. **Message types**: Widget uses `voice-action` postMessage, parent uses `voice-event` data messages
3. **Event bus**: All voice events flow through AppComms (pub/sub pattern)
4. **File bloat concern**: Need to split voice-command-router.js before adding more commands

### Planned Refactoring (Do First)
Before adding text input, split the router:

1. **Rename**: `voice-command-router.js` → `command-router.js`
   - Keep: Command routing logic (local vs AI)
   - Keep: `processCommand()` entry point
   - Keep: `_isSimpleCommand()` detection

2. **Extract**: Create `command-processor.js`
   - Move: All command execution code (`_handleThemeChange`, etc.)
   - Move: Command patterns (`_buildCommandPatterns`)
   - Move: All pattern matching (`_matchesThemeCommand`, etc.)
   - Keep interface: `CommandProcessor.executeLocal(command, params)`

3. **Update**: `command-router.js` becomes thin:
   ```javascript
   processCommand(transcript) {
     if (this._isSimpleCommand(transcript)) {
       CommandProcessor.execute(transcript);
     } else {
       AIService.processQuery(transcript);
     }
   }
   ```

### Next Steps for Implementation
1. ✅ Refactor: Split voice-command-router → command-router + command-processor
2. ✅ Phase 1: Add text input to Voice Widget
3. ✅ Phase 2: Create AI Response Widget
4. ✅ Phase 3: Wire up communication
5. ✅ Phase 4: Polish & testing

### Important Context for Next Session
- **Widget postMessage format**: `{ type, action, payload }` (documented in lines 350-380)
- **Voice widget state machine**: idle → listening → transcribing → processing (line 191)
- **AppComms events**: All voice events listed in widget-data-manager.js lines 71-79
- **Current working command**: "dark mode" / "light mode" (test before changes)
- **Platform detection**: Check `window.DashieNative` for Android (voice-widget.js line 50)

### References for Next Session
- **Current Voice System**: `js/widgets/voice/VOICE_WIDGET_README.md`
- **Widget Dev Guide**: `js/widgets/WIDGETS_README.md`
- **Message Flow Diagram**: Lines 99-133 in this doc
- **Complete message breakdown**: Covered in previous session context

---

**Ready to implement!**

**IMPORTANT**: Before adding text input, refactor voice-command-router.js into command-router.js + command-processor.js to prevent file bloat.

Then start with Phase 1 (update Voice Widget) since that's the foundation for everything else.
