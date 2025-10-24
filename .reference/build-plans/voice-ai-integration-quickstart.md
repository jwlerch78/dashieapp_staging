# Voice AI Integration Quick-Start Guide

**For Next Session**
**Goal:** Add text input to Voice Widget + integrate Claude API for natural language commands

---

## Current State (What's Done)

✅ **Voice system working:**
- VoiceService (platform abstraction)
- WebVoiceProvider (PC) & AndroidVoiceProvider (Fire TV)
- VoiceCommandRouter (processes commands)
- Voice Widget (UI with mic button, transcript, beep)
- Theme switching working ("dark mode", "light mode")

✅ **Files created:**
- `js/core/voice-service.js`
- `js/core/voice-command-router.js`
- `js/core/voice/web-voice-provider.js`
- `js/core/voice/android-voice-provider.js`
- `js/widgets/voice/voice-widget.html`
- `js/widgets/voice/voice-widget.css`
- `js/widgets/voice/voice-widget.js`

✅ **Documentation:**
- `js/widgets/voice/VOICE_WIDGET_README.md` - Complete system docs
- `.reference/VOICE_ASSISTANT_ANDROID_API.md` - Android API reference
- `.reference/build-plans/voice-widget-implementation.md` - Original build plan

---

## What to Build Next

### Phase 1: Add Text Input (30 min)

**Goal:** Add text box to Voice Widget for typing commands (better for AI testing than voice recognition on PC)

**Tasks:**
1. Add text input field to `voice-widget.html`
2. Add "Send" button next to input
3. Wire up Enter key and button click
4. Send typed text to VoiceCommandRouter (same flow as voice)
5. Clear input after sending

**Location:** `js/widgets/voice/`

**Files to modify:**
- `voice-widget.html` - Add `<input>` and `<button>`
- `voice-widget.css` - Style the input/button
- `voice-widget.js` - Handle send events

**Implementation hint:**
```javascript
// In voice-widget.js
function handleTextInput() {
  const text = textInput.value.trim();
  if (text) {
    // Send to parent (same as voice transcript)
    sendToParent('voice-action', {
      action: 'text-command',
      text: text
    });
    textInput.value = ''; // Clear input
  }
}
```

Then in widget-data-manager, handle 'text-command' same as voice transcript.

---

### Phase 2: Create AIService (1 hour)

**Goal:** Service to send commands to Claude API and get responses

**Create:** `js/services/ai-service.js`

**Key methods:**
```javascript
class AIService {
  async processCommand(transcript, context) {
    // Send to Claude API
    // Parse response
    // Return structured action
  }

  async chat(messages) {
    // For conversational AI
  }
}
```

**What you'll need:**
- Claude API key (from Anthropic console)
- API endpoint: `https://api.anthropic.com/v1/messages`
- Model: `claude-3-5-sonnet-20241022` (latest)

**Context to send to Claude:**
- Current theme
- Current page
- Available widgets
- User's calendar data (future)
- User's photos (future)

**Example request:**
```javascript
{
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: `You are a smart home dashboard assistant.

      User said: "${transcript}"

      Current context:
      - Theme: ${theme}
      - Page: ${currentPage}
      - Available commands: theme change, navigation, widget control

      What should I do? Respond with JSON:
      {
        "action": "theme_change|navigate|widget_control|speak_only",
        "params": {...},
        "speak": "What to say to user"
      }`
    }
  ]
}
```

---

### Phase 3: Wire AI to VoiceCommandRouter (30 min)

**Goal:** Send unrecognized commands to AI instead of saying "I didn't understand"

**Modify:** `js/core/voice-command-router.js`

**Current code:**
```javascript
_sendToAI(transcript) {
  logger.info('Unrecognized command - would send to AI:', transcript);
  this._speakError('I didn\'t understand that command');
}
```

**New code:**
```javascript
async _sendToAI(transcript) {
  logger.info('Sending to AI:', transcript);

  // Get context
  const context = {
    theme: window.themeApplier?.getCurrentTheme(),
    page: /* get current page */,
    user: /* get user info */
  };

  // Send to AI
  const aiService = window.aiService;
  const response = await aiService.processCommand(transcript, context);

  // Execute AI action
  await this._executeAIAction(response);

  // Speak AI response
  this._speakConfirmation(response.speak);
}

_executeAIAction(response) {
  switch(response.action) {
    case 'theme_change':
      this._handleThemeChange(response.params.theme);
      break;
    case 'navigate':
      AppStateManager.setCurrentModule(response.params.module);
      break;
    // ... more actions
  }
}
```

---

## Step-by-Step for Next Session

### 1. Read Documentation (5 min)

**Read these first:**
- `js/widgets/voice/VOICE_WIDGET_README.md` - How everything works
- `.reference/build-plans/voice-widget-implementation.md` - Original plan

### 2. Test Current System (5 min)

**Verify voice system works:**
1. Start local server: `python -m http.server 8000`
2. Navigate to: `http://localhost:8000?bypass-auth`
3. Navigate to page 2 (voice widget)
4. Click mic, say "dark mode"
5. Verify theme changes and you hear confirmation

### 3. Add Text Input (30 min)

**Follow Phase 1 tasks above**

**Test:** Type "light mode" in text box, press Enter, verify it works

### 4. Get Claude API Key (5 min)

**Get API key:**
1. Go to: https://console.anthropic.com/
2. Create account / log in
3. Go to API Keys
4. Create new key
5. Copy key (starts with `sk-ant-...`)

**Store key:**
- Add to environment variable: `ANTHROPIC_API_KEY`
- Or hardcode for testing (remove before committing!)

### 5. Create AIService (1 hour)

**Follow Phase 2 tasks above**

**Test:**
```javascript
// In console
const aiService = window.aiService;
const response = await aiService.processCommand("change to dark mode", {theme: 'light'});
console.log(response);
```

### 6. Wire to VoiceCommandRouter (30 min)

**Follow Phase 3 tasks above**

**Test:**
- Type: "Can you please change the theme to dark?"
- Should work even though it's not a simple keyword match

### 7. Test End-to-End (10 min)

**Test flow:**
1. Type: "Make it dark in here"
2. AI should understand → change theme → speak confirmation
3. Type: "What's the weather?" (won't work yet, but AI should respond)
4. Type: "Go to settings" (if nav implemented)

---

## API Reference

### Claude API

**Endpoint:** `https://api.anthropic.com/v1/messages`

**Headers:**
```javascript
{
  'Content-Type': 'application/json',
  'x-api-key': 'YOUR_API_KEY',
  'anthropic-version': '2023-06-01'
}
```

**Request:**
```javascript
{
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Your prompt here' }
  ]
}
```

**Response:**
```javascript
{
  id: 'msg_...',
  type: 'message',
  role: 'assistant',
  content: [
    { type: 'text', text: 'AI response here' }
  ],
  ...
}
```

---

## Testing Commands

### Simple Commands (Already Work)

- "dark mode"
- "light mode"
- "change theme to dark"
- "switch to light mode"

### AI Commands (To Build)

- "Make it darker in here"
- "I can't see, it's too bright"
- "What's on my calendar?"
- "Show me my photos"
- "Go to settings"
- "What time is it?"

---

## Prompt Engineering Tips

### System Prompt

```
You are a smart home dashboard assistant for Dashie, a family dashboard app.

Available actions:
- theme_change: Change theme (light/dark)
- navigate: Navigate to a page (dashboard/settings)
- widget_control: Control widgets (refresh, next, etc.)
- speak_only: Just speak a response (no action)

Context provided:
- Current theme
- Current page
- User preferences

Respond with JSON only:
{
  "action": "...",
  "params": {...},
  "speak": "What to say to user"
}

Be conversational and friendly. The dashboard is for families.
```

### Example Prompts

**User:** "Make it dark"
**AI:**
```json
{
  "action": "theme_change",
  "params": {"theme": "dark"},
  "speak": "Switching to dark mode"
}
```

**User:** "I can't see anything"
**AI:**
```json
{
  "action": "theme_change",
  "params": {"theme": "light"},
  "speak": "I'll brighten things up for you"
}
```

**User:** "What time is it?"
**AI:**
```json
{
  "action": "speak_only",
  "params": {},
  "speak": "I don't have access to the time yet, but you can add a clock widget to see it"
}
```

---

## Code Locations

### Files to Create

- `js/services/ai-service.js` - NEW
- `js/services/ai-prompt-builder.js` - NEW (optional, for complex prompts)

### Files to Modify

- `js/widgets/voice/voice-widget.html` - Add text input
- `js/widgets/voice/voice-widget.css` - Style text input
- `js/widgets/voice/voice-widget.js` - Handle text input events
- `js/core/widget-data-manager.js` - Handle 'text-command' action
- `js/core/voice-command-router.js` - Call AIService for unrecognized commands
- `js/core/initialization/core-initializer.js` - Initialize AIService

### Files to Reference

- `js/core/voice-service.js` - How service pattern works
- `js/data/services/settings-service.js` - Example service implementation
- `js/data/services/calendar-service.js` - Example API service

---

## Success Criteria

✅ **Phase 1 Complete When:**
- Text input field visible in voice widget
- Can type command and press Enter
- Typed text processed same as voice command
- Theme changes when typing "dark mode"

✅ **Phase 2 Complete When:**
- AIService can send requests to Claude API
- Receives JSON response from Claude
- Can parse response into actions

✅ **Phase 3 Complete When:**
- Natural language commands work ("make it dark")
- AI responses are spoken via TTS
- Complex queries handled gracefully ("what time is it?")

---

## Estimated Time

- **Phase 1 (Text Input):** 30 minutes
- **Phase 2 (AIService):** 1 hour
- **Phase 3 (Integration):** 30 minutes
- **Testing & Polish:** 30 minutes

**Total:** ~2.5 hours

---

## Next Steps After AI Integration

1. **Add more actions:**
   - Navigation commands
   - Widget control
   - Calendar queries
   - Photo searches

2. **Conversation context:**
   - Remember last 5 messages
   - Allow follow-up questions
   - "Show me tomorrow" (after asking about calendar)

3. **Voice Settings Page:**
   - Enable/disable voice
   - AI personality/tone
   - Quiet hours

4. **Command history:**
   - View past commands
   - Re-run commands
   - Command shortcuts

---

## Questions to Consider

1. **API costs:** Claude API costs ~$3 per million tokens. How often will users use voice commands?

2. **Privacy:** Voice transcripts sent to Claude. Need privacy policy update?

3. **Context:** What data should we send to Claude? (Calendar events, photos, etc.)

4. **Rate limiting:** Should we limit AI requests per user/day?

5. **Fallback:** What if Claude API is down? Fall back to simple keyword matching?

---

**Ready to start! Good luck with the next session!** 🚀
