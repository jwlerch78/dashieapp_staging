# Dashie AI-Powered Voice Assistant - Unified Implementation Plan

**Version:** 2.1 (Unified with Phase 0 De-risking)  
**Date:** October 22, 2025  
**Status:** Phase 0 - Technical Feasibility Testing

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Implementation Phases](#implementation-phases)
5. [Technical Specifications](#technical-specifications)
6. [File Structure](#file-structure)
7. [Testing Strategy](#testing-strategy)
8. [Deployment Plan](#deployment-plan)
9. [Cost & Performance](#cost--performance)
10. [Open Questions & Decisions](#open-questions--decisions)

---

## Executive Summary

Dashie is adding a complete AI-powered voice assistant system that enables families to interact with their smart home dashboard using natural language. The system combines **local wake word detection**, **dual transcription** (local + cloud), **Claude AI intelligence**, and **voice output** to create a seamless hands-free experience.

### Key Capabilities

**Dashboard Control:**
- "Hey Dashie, where is Mary?" → Shows family member location on map
- "Hey Dashie, what's on my calendar today?" → Displays today's events
- "Hey Dashie, show me photos from last week" → Filters photo widget

**General Queries:**
- "Hey Dashie, what time do the Buccaneers play?" → Web search + spoken answer
- "Hey Dashie, what's the weather tomorrow?" → Weather lookup + display
- "Hey Dashie, set a reminder for 3pm" → Creates calendar event

### Design Philosophy

1. **Two-Layer Architecture:**
   - **Layer 1 (Voice Infrastructure):** Handles listening, wake word detection, and transcription
   - **Layer 2 (Voice Intelligence):** Handles understanding, decision-making, and response

2. **Hybrid Processing:**
   - Local transcription for speed and offline capability
   - Cloud transcription for accuracy
   - Claude AI for intelligent command routing

3. **Context-Aware:**
   - Understands family member names and relationships
   - Knows current dashboard state and available widgets
   - Provides relevant suggestions based on context

4. **Privacy-First:**
   - No persistent audio recording
   - User consent before enabling
   - Clear data usage disclosure

---

## System Architecture

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER SPEAKS                               │
│            "Hey Dashie, where is Mary?"                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              LAYER 1: VOICE INFRASTRUCTURE                   │
│                (Android Native + WebView)                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 1: Wake Word Detection                         │  │
│  │  • Porcupine always-on listening                     │  │
│  │  • Detects "Hey Dashie"                              │  │
│  │  • Sensitivity: 0.7 (tunable)                        │  │
│  │  • Battery optimized                                 │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 2: Dual Transcription                          │  │
│  │  ┌─────────────────────┬──────────────────────────┐ │  │
│  │  │ Local (Fast)        │ Cloud (Accurate)         │ │  │
│  │  │ • SpeechRecognizer  │ • Google Speech API      │ │  │
│  │  │ • 1-2s latency      │ • 2-3s latency           │ │  │
│  │  │ • Offline capable   │ • High accuracy          │ │  │
│  │  │ • Partial results   │ • Confidence scores      │ │  │
│  │  └─────────────────────┴──────────────────────────┘ │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 3: JavaScript Bridge                           │  │
│  │  • window.dashieVoiceCommand(text)                   │  │
│  │  • Sends transcribed text to WebView                 │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          LAYER 2: VOICE INTELLIGENCE                         │
│              (JavaScript WebView Layer)                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 4: Context Building                            │  │
│  │  • Gather family member data                         │  │
│  │  • Get active widget states                          │  │
│  │  • Build available command menu                      │  │
│  │  • Package current time/location                     │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 5: Claude API Request                          │  │
│  │  • Send voice command + context + menu               │  │
│  │  • Claude analyzes intent                            │  │
│  │  • Routes to dashboard command OR web search         │  │
│  │  • Returns structured response                       │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 6: Response Handling                           │  │
│  │  • Parse Claude's JSON response                      │  │
│  │  • Execute dashboard commands                        │  │
│  │  • Update widgets (map, calendar, etc.)              │  │
│  │  • Prepare text for TTS                              │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              VOICE OUTPUT (Text-to-Speech)                   │
│                (Android Native TTS)                          │
│                                                              │
│  "Mary is currently at Publix on Main Street.               │
│   I've updated the map on your dashboard."                  │
└─────────────────────────────────────────────────────────────┘
```

### Layer Integration Points

**Android → JavaScript Bridge:**
```javascript
// Android calls this when transcription completes
window.dashieVoiceCommand(transcribedText, source);

// JavaScript calls back to Android for TTS
window.dashieSpeak(text, options);
```

**JavaScript → Claude API:**
```javascript
// JavaScript sends structured request
POST https://api.anthropic.com/v1/messages
{
  "model": "claude-sonnet-4-5-20250929",
  "messages": [{
    "role": "user", 
    "content": "SYSTEM_PROMPT + VOICE_COMMAND + CONTEXT + MENU"
  }]
}
```

**Claude → Dashboard Commands:**
```javascript
// Claude returns structured instruction
{
  "action": "dashboard_command",
  "command": "show_location",
  "parameters": { "member_name": "Mary" },
  "response_text": "Mary is at Publix..."
}

// JavaScript executes
DashboardCommands.show_location("Mary");
TextToSpeech.speak("Mary is at Publix...");
```

---

## Core Components

### 1. Wake Word Detection Service (Android)

**File:** `android/app/src/main/java/com/dashie/app/VoiceRecognitionService.kt`

**Technology:** Porcupine by Picovoice

**Implementation:**
```kotlin
class VoiceRecognitionService : Service() {
    private var porcupineManager: PorcupineManager? = null
    
    override fun onCreate() {
        super.onCreate()
        initializePorcupine()
    }
    
    private fun initializePorcupine() {
        porcupineManager = PorcupineManager.Builder()
            .setAccessKey(PORCUPINE_ACCESS_KEY)
            .setKeyword(Porcupine.BuiltInKeyword.PORCUPINE) // or custom "Dashie"
            .setSensitivity(0.7f)
            .build(this) { keywordIndex ->
                // Wake word detected!
                sendWakeWordBroadcast()
                startTranscription()
            }
        porcupineManager?.start()
    }
}
```

**Configuration:**
- Access Key: Stored in `BuildConfig` or environment
- Custom Wake Word: Optional `.ppn` file trained on "Hey Dashie"
- Sensitivity: 0.5-0.9 (tunable for false positive vs miss rate)
- Battery Optimization: Sleep during quiet hours, adjust sampling rate

**Status:** Implementation ready, requires API key

---

### 2. Dual Transcription System (Android)

**File:** `android/app/src/main/java/com/dashie/app/MainActivity.kt`

#### 2a. Local Transcription (Fast)

**Technology:** Android SpeechRecognizer API

**Advantages:**
- 1-2 second latency
- Works offline
- Free (no API costs)
- Real-time partial results

**Implementation:**
```kotlin
private fun startLocalTranscription() {
    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
    
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, 
                 RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
    }
    
    speechRecognizer?.setRecognitionListener(object : RecognitionListener {
        override fun onPartialResults(results: Bundle?) {
            val matches = results?.getStringArrayList(
                SpeechRecognizer.RESULTS_RECOGNITION)
            sendToJavaScript(matches?.get(0), source = "local_partial")
        }
        
        override fun onResults(results: Bundle?) {
            val matches = results?.getStringArrayList(
                SpeechRecognizer.RESULTS_RECOGNITION)
            sendToJavaScript(matches?.get(0), source = "local_final")
        }
    })
    
    speechRecognizer?.startListening(intent)
}
```

#### 2b. Cloud Transcription (Accurate)

**Technology:** Google Cloud Speech-to-Text API

**Advantages:**
- 95%+ accuracy
- Better with accents/noise
- Confidence scores
- Language detection

**Implementation:**
```kotlin
private fun startCloudTranscription() {
    // Record audio
    mediaRecorder = MediaRecorder().apply {
        setAudioSource(MediaRecorder.AudioSource.MIC)
        setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP)
        setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB)
        setOutputFile(audioFile)
        prepare()
        start()
    }
    
    // After 5 seconds or silence detected, stop and upload
    Handler().postDelayed({
        mediaRecorder?.stop()
        uploadToCloudAPI(audioFile)
    }, 5000)
}

private fun uploadToCloudAPI(audioFile: File) {
    val client = CloudTranscriptionClient()
    client.transcribe(audioFile) { result ->
        sendToJavaScript(result.transcript, source = "cloud")
        sendToJavaScript(result.confidence.toString(), source = "cloud_confidence")
    }
}
```

**Via Supabase Edge Function:**
```typescript
// supabase/functions/transcribe-audio/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { audioContent } = await req.json()
  
  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${Deno.env.get('GOOGLE_CLOUD_API_KEY')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US',
        },
        audio: { content: audioContent }
      })
    }
  )
  
  const data = await response.json()
  return new Response(JSON.stringify(data), { 
    headers: { 'Content-Type': 'application/json' } 
  })
})
```

**Decision Logic:**
- Use **local** first for immediate feedback
- Run **cloud** in parallel for higher accuracy
- If local and cloud differ significantly, prefer cloud result
- Display both results during development/testing

---

### 3. JavaScript Bridge (Android ↔ WebView)

**File:** `android/app/src/main/java/com/dashie/app/WebViewBridge.kt`

**Android → JavaScript:**
```kotlin
class WebViewBridge(private val webView: WebView) {
    fun sendVoiceCommand(text: String, source: String) {
        val json = JSONObject().apply {
            put("text", text)
            put("source", source)
            put("timestamp", System.currentTimeMillis())
        }
        
        webView.evaluateJavascript(
            "window.dashieVoiceCommand(${json})", 
            null
        )
    }
    
    fun sendWakeWordDetected() {
        webView.evaluateJavascript(
            "window.dashieWakeWordDetected()", 
            null
        )
    }
}
```

**JavaScript → Android:**
```kotlin
@JavascriptInterface
fun speak(text: String, rate: Float = 1.0f, pitch: Float = 1.0f) {
    textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "dashie_tts")
}

@JavascriptInterface
fun stopSpeaking() {
    textToSpeech.stop()
}
```

---

### 4. Voice Command Handler (JavaScript)

**File:** `js/modules/VoiceCommand/voice-command-handler.js`

**Responsibilities:**
1. Receive transcribed voice command
2. Build current dashboard context
3. Generate available command menu
4. Call Claude API
5. Return structured response

**Implementation:**
```javascript
class VoiceCommandHandler {
    constructor() {
        this.contextBuilder = new ContextBuilder();
        this.menuBuilder = new MenuBuilder();
        this.claudeAPI = new ClaudeAPIClient();
    }
    
    async handleCommand(voiceText, source) {
        console.log(`[VoiceCommand] Received: "${voiceText}" from ${source}`);
        
        // 1. Build context
        const context = await this.contextBuilder.buildContext();
        
        // 2. Build command menu
        const commandMenu = this.menuBuilder.getAvailableCommands();
        
        // 3. Package request
        const request = {
            voice_command: voiceText,
            context: context,
            available_commands: commandMenu,
            source: source
        };
        
        // 4. Send to Claude
        try {
            const response = await this.claudeAPI.processCommand(request);
            return response;
        } catch (error) {
            console.error('[VoiceCommand] Claude API error:', error);
            return {
                action: 'error',
                response_text: "Sorry, I'm having trouble understanding that right now."
            };
        }
    }
}

// Initialize on page load
window.voiceCommandHandler = new VoiceCommandHandler();

// Exposed to Android bridge
window.dashieVoiceCommand = async (commandData) => {
    const response = await window.voiceCommandHandler.handleCommand(
        commandData.text, 
        commandData.source
    );
    
    // Pass to response handler
    window.voiceResponseHandler.handleResponse(response);
};
```

---

### 5. Context Builder (JavaScript)

**File:** `js/modules/VoiceCommand/context-builder.js`

**Gathers Current Dashboard State:**

```javascript
class ContextBuilder {
    async buildContext() {
        const context = {
            // Family members from Traccar or settings
            family_members: await this.getFamilyMembers(),
            
            // Current time and location
            current_time: new Date().toISOString(),
            user_location: await this.getUserLocation(),
            
            // Active widgets
            active_widgets: this.getActiveWidgets(),
            
            // Recent calendar events
            upcoming_events: await this.getUpcomingEvents(24), // next 24 hours
            
            // Current display state
            display_state: {
                current_view: window.dashieCore?.currentModule || 'dashboard',
                is_fullscreen: document.fullscreenElement !== null
            }
        };
        
        return context;
    }
    
    async getFamilyMembers() {
        // Query from data layer
        const members = await window.dataManager?.getService('traccar')
            ?.getFamilyMembers() || [];
            
        return members.map(member => ({
            id: member.id,
            name: member.name,
            phone: member.phone,
            last_location: member.last_known_location,
            last_updated: member.last_updated
        }));
    }
    
    getActiveWidgets() {
        // Return list of visible widgets
        const widgets = document.querySelectorAll('.widget[data-visible="true"]');
        return Array.from(widgets).map(w => ({
            type: w.dataset.type,
            id: w.dataset.widgetId
        }));
    }
    
    async getUpcomingEvents(hours = 24) {
        // Get from calendar service
        const calendarService = window.dataManager?.getService('calendar');
        if (!calendarService) return [];
        
        const now = new Date();
        const endTime = new Date(now.getTime() + (hours * 60 * 60 * 1000));
        
        const events = await calendarService.getEvents(now, endTime);
        return events.slice(0, 10); // Limit to 10 events
    }
}
```

---

### 6. Command Menu Builder (JavaScript)

**File:** `js/modules/VoiceCommand/menu-builder.js`

**Defines Available Dashboard Commands:**

```javascript
class MenuBuilder {
    getAvailableCommands() {
        return [
            {
                command: 'show_location',
                description: 'Display a family member\'s current location on the map',
                parameters: [
                    { name: 'member_name', type: 'string', required: true }
                ],
                examples: [
                    'where is Mary',
                    'show me Charlie\'s location',
                    'where is mom right now'
                ]
            },
            {
                command: 'show_calendar',
                description: 'Display calendar events for a specific person and date',
                parameters: [
                    { name: 'member_name', type: 'string', required: false },
                    { name: 'date', type: 'date', required: false, default: 'today' }
                ],
                examples: [
                    'what\'s on my calendar',
                    'show Mary\'s calendar for tomorrow',
                    'what do I have scheduled today'
                ]
            },
            {
                command: 'show_weather',
                description: 'Display weather information',
                parameters: [
                    { name: 'location', type: 'string', required: false },
                    { name: 'date', type: 'date', required: false, default: 'today' }
                ],
                examples: [
                    'what\'s the weather',
                    'weather tomorrow',
                    'will it rain today'
                ]
            },
            {
                command: 'show_photos',
                description: 'Display photo slideshow, optionally filtered',
                parameters: [
                    { name: 'filter', type: 'string', required: false },
                    { name: 'date_range', type: 'string', required: false }
                ],
                examples: [
                    'show photos',
                    'show photos from last week',
                    'show photos of the kids'
                ]
            },
            {
                command: 'navigate_to',
                description: 'Navigate to a different view or widget',
                parameters: [
                    { name: 'destination', type: 'string', required: true }
                ],
                examples: [
                    'go to calendar view',
                    'show the dashboard',
                    'open the map'
                ]
            },
            {
                command: 'set_reminder',
                description: 'Create a reminder or calendar event',
                parameters: [
                    { name: 'title', type: 'string', required: true },
                    { name: 'time', type: 'datetime', required: true },
                    { name: 'member_name', type: 'string', required: false }
                ],
                examples: [
                    'remind me to pick up groceries at 5pm',
                    'set a reminder for tomorrow at 3',
                    'add dentist appointment to Mary\'s calendar Wednesday at 2'
                ]
            }
        ];
    }
    
    getCommandByName(commandName) {
        return this.getAvailableCommands()
            .find(cmd => cmd.command === commandName);
    }
}
```

---

### 7. Claude API Client (JavaScript)

**File:** `js/services/claude-api.js`

**Security Note:** API key should be stored in backend, not exposed in JavaScript. Use proxy server.

```javascript
class ClaudeAPIClient {
    constructor() {
        this.apiEndpoint = '/api/claude'; // Proxy endpoint
        this.model = 'claude-sonnet-4-5-20250929';
    }
    
    async processCommand(request) {
        const systemPrompt = this.buildSystemPrompt(request);
        
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await this.getSessionToken()}`
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: systemPrompt
                }]
            })
        });
        
        if (!response.ok) {
            throw new Error(`Claude API error: ${response.status}`);
        }
        
        const data = await response.json();
        return this.parseClaudeResponse(data);
    }
    
    buildSystemPrompt(request) {
        return `You are the AI assistant for Dashie, a family smart home dashboard.

You receive voice commands from family members and must:
1. Analyze the voice command intent
2. Check if it matches available dashboard commands in the menu
3. Either execute a dashboard command OR provide an independent response
4. Format your response with clear instructions for the dashboard

VOICE COMMAND: "${request.voice_command}"

DASHBOARD CONTEXT:
${JSON.stringify(request.context, null, 2)}

AVAILABLE DASHBOARD COMMANDS (MENU):
${JSON.stringify(request.available_commands, null, 2)}

INSTRUCTIONS:
- If the command matches a dashboard command, respond with action: "dashboard_command"
- If the command is a general query (sports scores, news, facts), respond with action: "independent_response"
- For independent responses, you may use web search to find current information
- Always provide a natural, friendly response_text that will be spoken aloud

RESPONSE FORMAT (respond with valid JSON only):
{
  "action": "dashboard_command" | "independent_response",
  "command": "command_name",  // if dashboard_command
  "parameters": { key: value },  // if dashboard_command
  "display_instruction": "vocalize_and_display" | "display_only" | "display_image",
  "response_text": "What to display and/or speak to the user",
  "image_url": "URL"  // optional, if display_image
}`;
    }
    
    parseClaudeResponse(apiResponse) {
        // Extract JSON from Claude's response
        const content = apiResponse.content[0].text;
        
        // Claude might wrap JSON in markdown code blocks
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                         content.match(/{[\s\S]*}/);
        
        if (!jsonMatch) {
            console.error('[ClaudeAPI] Could not parse JSON from response:', content);
            return {
                action: 'error',
                response_text: 'I understood your command, but had trouble responding. Please try again.'
            };
        }
        
        try {
            return JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } catch (error) {
            console.error('[ClaudeAPI] JSON parse error:', error);
            return {
                action: 'error',
                response_text: 'I had trouble processing that command. Please try again.'
            };
        }
    }
    
    async getSessionToken() {
        // Get user's authenticated session token
        return window.dataManager?.auth?.getToken() || '';
    }
}
```

---

### 8. Response Handler (JavaScript)

**File:** `js/modules/VoiceCommand/response-handler.js`

**Routes Claude Response to Appropriate Action:**

```javascript
class VoiceResponseHandler {
    constructor() {
        this.dashboardCommands = new DashboardCommands();
        this.ttsHandler = new TTSHandler();
    }
    
    async handleResponse(response) {
        console.log('[VoiceResponse] Processing:', response);
        
        // Handle errors
        if (response.action === 'error') {
            await this.displayError(response.response_text);
            return;
        }
        
        // Route based on action type
        switch (response.action) {
            case 'dashboard_command':
                await this.executeDashboardCommand(response);
                break;
                
            case 'independent_response':
                await this.displayIndependentResponse(response);
                break;
                
            default:
                console.warn('[VoiceResponse] Unknown action:', response.action);
        }
        
        // Handle display instructions
        await this.handleDisplayInstructions(response);
    }
    
    async executeDashboardCommand(response) {
        const { command, parameters } = response;
        
        console.log(`[VoiceResponse] Executing: ${command}`, parameters);
        
        try {
            // Call the appropriate dashboard function
            await this.dashboardCommands.execute(command, parameters);
        } catch (error) {
            console.error('[VoiceResponse] Command execution error:', error);
            await this.displayError('Sorry, I had trouble executing that command.');
        }
    }
    
    async displayIndependentResponse(response) {
        // Show response text on screen
        this.showResponseOverlay(response.response_text);
        
        // If there's an image, display it
        if (response.image_url) {
            this.showImage(response.image_url);
        }
    }
    
    async handleDisplayInstructions(response) {
        const { display_instruction, response_text } = response;
        
        switch (display_instruction) {
            case 'vocalize_and_display':
                this.showResponseOverlay(response_text);
                await this.ttsHandler.speak(response_text);
                break;
                
            case 'display_only':
                this.showResponseOverlay(response_text);
                break;
                
            case 'vocalize_only':
                await this.ttsHandler.speak(response_text);
                break;
                
            case 'display_image':
                this.showResponseOverlay(response_text);
                this.showImage(response.image_url);
                await this.ttsHandler.speak(response_text);
                break;
        }
    }
    
    showResponseOverlay(text) {
        // Create temporary overlay with response
        const overlay = document.createElement('div');
        overlay.className = 'voice-response-overlay';
        overlay.textContent = text;
        document.body.appendChild(overlay);
        
        // Auto-hide after 5 seconds
        setTimeout(() => overlay.remove(), 5000);
    }
    
    showImage(imageUrl) {
        // Display image in modal or widget
        const modal = document.createElement('div');
        modal.className = 'voice-image-modal';
        modal.innerHTML = `<img src="${imageUrl}" alt="Response image">`;
        document.body.appendChild(modal);
        
        // Click to dismiss
        modal.addEventListener('click', () => modal.remove());
    }
    
    async displayError(message) {
        this.showResponseOverlay(message);
        await this.ttsHandler.speak(message);
    }
}
```

---

### 9. Dashboard Commands Implementation (JavaScript)

**File:** `js/modules/VoiceCommand/dashboard-commands.js`

**Implements Actual Dashboard Control Functions:**

```javascript
class DashboardCommands {
    constructor() {
        this.dataManager = window.dataManager;
        this.widgetController = window.widgetController;
    }
    
    async execute(commandName, parameters) {
        const handler = this[commandName];
        
        if (!handler) {
            throw new Error(`Unknown command: ${commandName}`);
        }
        
        return await handler.call(this, parameters);
    }
    
    // COMMAND: show_location
    async show_location(params) {
        const { member_name } = params;
        
        // Find family member by name (case-insensitive)
        const traccarService = this.dataManager.getService('traccar');
        const member = await traccarService.findMemberByName(member_name);
        
        if (!member) {
            throw new Error(`Could not find family member: ${member_name}`);
        }
        
        // Get current location
        const location = await traccarService.getMemberLocation(member.id);
        
        // Update map widget to show this location
        await this.widgetController.updateWidget('map', {
            center: location.coordinates,
            zoom: 15,
            highlight: member.id,
            show: true
        });
        
        // Navigate to map view if not already there
        if (window.dashieCore.currentModule !== 'dashboard') {
            window.dashieCore.navigateTo('dashboard');
        }
        
        return { success: true, location };
    }
    
    // COMMAND: show_calendar
    async show_calendar(params) {
        const { member_name, date = 'today' } = params;
        
        // Parse date
        const targetDate = this.parseDate(date);
        
        // Filter calendar events
        const calendarService = this.dataManager.getService('calendar');
        const events = await calendarService.getEventsForDate(targetDate);
        
        // If member_name specified, filter by that person
        if (member_name) {
            const filteredEvents = events.filter(event => 
                event.attendees?.some(a => 
                    a.name.toLowerCase().includes(member_name.toLowerCase())
                )
            );
            
            await this.widgetController.updateWidget('calendar', {
                events: filteredEvents,
                highlightDate: targetDate,
                show: true
            });
        } else {
            await this.widgetController.updateWidget('calendar', {
                events,
                highlightDate: targetDate,
                show: true
            });
        }
        
        return { success: true, eventCount: events.length };
    }
    
    // COMMAND: show_weather
    async show_weather(params) {
        const { location, date = 'today' } = params;
        
        const weatherService = this.dataManager.getService('weather');
        const targetDate = this.parseDate(date);
        
        // Get forecast
        const forecast = await weatherService.getForecast(location, targetDate);
        
        // Update weather widget
        await this.widgetController.updateWidget('weather', {
            forecast,
            location,
            date: targetDate,
            show: true
        });
        
        return { success: true, forecast };
    }
    
    // COMMAND: show_photos
    async show_photos(params) {
        const { filter, date_range } = params;
        
        const photosService = this.dataManager.getService('photos');
        
        // Apply filters
        let photos = await photosService.getPhotos();
        
        if (date_range) {
            const dateFilter = this.parseDateRange(date_range);
            photos = photos.filter(p => 
                p.date >= dateFilter.start && p.date <= dateFilter.end
            );
        }
        
        if (filter) {
            // Use Google Photos API search or local metadata
            photos = await photosService.searchPhotos(filter);
        }
        
        // Start slideshow
        await this.widgetController.updateWidget('photos', {
            photos,
            mode: 'slideshow',
            show: true
        });
        
        return { success: true, photoCount: photos.length };
    }
    
    // COMMAND: navigate_to
    async navigate_to(params) {
        const { destination } = params;
        
        // Map natural language to actual view names
        const viewMap = {
            'dashboard': 'dashboard',
            'home': 'dashboard',
            'calendar': 'calendar',
            'map': 'map',
            'photos': 'photos',
            'weather': 'weather',
            'settings': 'settings'
        };
        
        const viewName = viewMap[destination.toLowerCase()] || destination;
        
        // Navigate
        window.dashieCore.navigateTo(viewName);
        
        return { success: true, view: viewName };
    }
    
    // COMMAND: set_reminder
    async set_reminder(params) {
        const { title, time, member_name } = params;
        
        const calendarService = this.dataManager.getService('calendar');
        
        // Parse datetime
        const reminderTime = this.parseDateTime(time);
        
        // Create calendar event
        const event = await calendarService.createEvent({
            title,
            start: reminderTime,
            end: new Date(reminderTime.getTime() + 30 * 60000), // 30 min default
            attendees: member_name ? [member_name] : [],
            reminder: true
        });
        
        return { success: true, event };
    }
    
    // Helper methods
    parseDate(dateString) {
        const lower = dateString.toLowerCase();
        
        if (lower === 'today') {
            return new Date();
        } else if (lower === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        } else if (lower === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday;
        }
        
        // Try parsing as date string
        return new Date(dateString);
    }
    
    parseDateTime(timeString) {
        // Complex parsing logic for natural language times
        // "5pm", "tomorrow at 3", "Wednesday at 2:30", etc.
        // Could use a library like Chrono.js
        return new Date(timeString);
    }
    
    parseDateRange(rangeString) {
        const lower = rangeString.toLowerCase();
        const now = new Date();
        
        if (lower === 'last week') {
            return {
                start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
                end: now
            };
        }
        
        // Add more range parsing...
        return { start: now, end: now };
    }
}
```

---

### 10. Text-to-Speech Handler (JavaScript/Android)

**File:** `js/modules/VoiceCommand/tts-handler.js`

```javascript
class TTSHandler {
    constructor() {
        this.isAndroidApp = typeof Android !== 'undefined';
    }
    
    async speak(text, options = {}) {
        const {
            rate = 1.0,
            pitch = 1.0,
            volume = 1.0,
            interrupt = true
        } = options;
        
        if (this.isAndroidApp) {
            // Use Android native TTS (recommended)
            Android.speak(text, rate, pitch);
        } else {
            // Fallback to Web Speech API
            return this.speakWithWebAPI(text, options);
        }
    }
    
    speakWithWebAPI(text, options) {
        return new Promise((resolve, reject) => {
            if (!window.speechSynthesis) {
                reject(new Error('Speech synthesis not supported'));
                return;
            }
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = options.rate || 1.0;
            utterance.pitch = options.pitch || 1.0;
            utterance.volume = options.volume || 1.0;
            
            utterance.onend = () => resolve();
            utterance.onerror = (error) => reject(error);
            
            if (options.interrupt) {
                window.speechSynthesis.cancel();
            }
            
            window.speechSynthesis.speak(utterance);
        });
    }
    
    stop() {
        if (this.isAndroidApp) {
            Android.stopSpeaking();
        } else {
            window.speechSynthesis?.cancel();
        }
    }
}
```

**Android TTS Implementation:**

```kotlin
// In MainActivity.kt
private lateinit var textToSpeech: TextToSpeech

override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    // Initialize TTS
    textToSpeech = TextToSpeech(this) { status ->
        if (status == TextToSpeech.SUCCESS) {
            textToSpeech.language = Locale.US
        }
    }
}

@JavascriptInterface
fun speak(text: String, rate: Float = 1.0f, pitch: Float = 1.0f) {
    textToSpeech.setSpeechRate(rate)
    textToSpeech.setPitch(pitch)
    textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "dashie_tts")
}

@JavascriptInterface
fun stopSpeaking() {
    textToSpeech.stop()
}
```

---

## Implementation Phases

### Phase 0: Technical Feasibility & De-risking (Week 1-2)

**Goal:** Validate critical technical assumptions before building the full system

**Why This Phase Matters:**
Before investing 10-12 weeks building the complete system, we need to verify that the three most critical components will work acceptably on Fire TV hardware:
1. Microphone + wake word detection reliability
2. Text-to-speech voice quality and user acceptability
3. Claude API interaction framework and response structure

**Approach:** Build three isolated test applications to validate each component independently.

---

#### Test 1: Wake Word + Transcription Feasibility

**Question:** Can we reliably detect wake words and transcribe speech via USB microphone on Fire TV?

**Test Application Specs:**
- Minimal Android app with Porcupine wake word detection
- Android SpeechRecognizer for transcription
- Simple visual feedback on screen
- No WebView complexity, no Claude integration

**Features:**
- Visual indicator when wake word detected (e.g., banner turns green)
- Display transcribed text on screen in real-time
- Show both partial and final transcription results
- Log detection confidence and timing metrics
- Test with multiple microphone positions/distances

**Success Criteria:**
- [ ] Wake word detection rate: >90% from 6-10 feet
- [ ] False positive rate: <3 per hour in normal household
- [ ] Transcription accuracy: >80% for common phrases
- [ ] Total latency: <3 seconds wake word → text on screen

**Test Procedure:**
```
1. Install app on Fire TV
2. Connect USB microphone via OTG adapter
3. Say wake word from various distances (3ft, 6ft, 10ft)
4. Record success rate for each distance
5. Say test phrases after wake word:
   - "Where is Mary?"
   - "What's the weather today?"
   - "Show me the calendar"
   - "What time is it?"
6. Rate transcription accuracy for each
7. Test with background noise (TV on, family conversation)
8. Measure false positives over 2-hour period
```

**Deliverable:** 
- Android APK: `dashie-wake-word-test.apk`
- Test report with metrics and recommendations
- Decision: Proceed, adjust sensitivity, or pivot approach

**Time Estimate:** 2-3 days

---

#### Test 2: Text-to-Speech Quality Assessment

**Question:** Is Android TTS voice quality acceptable for a family dashboard assistant?

**Test Application Specs:**
- Simple Android app with WebView UI
- Text input field for typing test messages
- Controls for adjusting speech rate (0.5x - 2.0x)
- Controls for adjusting pitch (0.5x - 2.0x)
- Preset common Dashie responses
- Voice selection (if multiple TTS engines available)

**Features:**
- Type or select pre-written messages
- Adjust speech parameters in real-time
- A/B compare different voices
- Test natural-sounding responses
- Export audio recordings for family review

**Preset Test Messages:**
```
Short responses:
- "Mary is at the grocery store."
- "The weather today is 75 degrees and sunny."
- "You have 3 calendar events today."

Long responses:
- "Mary is currently at Publix on Main Street, about 2 miles from home. She was last there 5 minutes ago."
- "Today's weather will be partly cloudy with a high of 78 and a low of 62. There's a 20% chance of rain this afternoon."
- "You have three events today: dentist appointment at 10am, lunch with Sarah at noon, and soccer practice at 4pm."

Error messages:
- "Sorry, I didn't catch that. Could you try again?"
- "I'm having trouble understanding. Could you rephrase that?"
- "I need an internet connection for that command."
```

**Success Criteria:**
- [ ] Voice clarity: >4/5 rating from family members
- [ ] Natural cadence: No robotic or awkward pauses
- [ ] Volume: Audible from 10-15 feet away
- [ ] Speed: Understandable at 1.0x and 1.2x rate
- [ ] Emotional tone: Sounds helpful, not annoying

**Test Procedure:**
```
1. Install TTS test app on Fire TV
2. Play preset messages at various rates/pitches
3. Have 3-5 family members rate each (1-5 scale):
   - Clarity
   - Natural sound
   - Pleasantness
   - Understandability
4. Test in actual living room context (TV mounted, normal viewing distance)
5. Identify optimal rate/pitch settings
6. Compare to Alexa/Google Assistant if available
```

**Deliverable:**
- Android APK: `dashie-tts-quality-test.apk`
- Family feedback survey results
- Recommended TTS settings (rate, pitch, voice)
- Decision: Acceptable, needs tuning, or explore alternatives

**Time Estimate:** 1-2 days

---

#### Test 3: Claude API Interaction Framework

**Question:** Can we build a reliable prompt structure that Claude understands and returns properly formatted commands?

**Test Application Specs:**
- Node.js terminal application (not Android - simpler to iterate)
- Interactive REPL for sending commands
- Displays Claude's full response
- Validates JSON structure
- Allows testing different prompt formats

**Features:**
- Type voice commands in terminal
- Automatically builds context object (mock family data)
- Sends to Claude API with system prompt
- Displays raw response and parsed JSON
- Tests multiple prompt variations
- Measures response latency
- Validates JSON parsing reliability

**Test Commands:**
```
Dashboard commands (should match menu):
- "where is Mary"
- "show Mary's calendar"
- "what's the weather"
- "show photos from last week"
- "navigate to calendar view"
- "remind me to pick up groceries at 5pm"

Off-menu queries (should return independent_response):
- "what time do the Buccaneers play"
- "who won the election"
- "what's 15% of 250"
- "tell me a joke"

Ambiguous commands (test edge cases):
- "Mary" (incomplete)
- "where" (missing subject)
- "show me" (missing object)
```

**Context Mock Data:**
```javascript
{
  family_members: [
    { name: "Mary Johnson", last_location: "Publix" },
    { name: "Charlie Johnson", last_location: "Home" }
  ],
  current_time: "2025-10-22T14:30:00Z",
  available_commands: [
    { command: "show_location", parameters: ["member_name"] },
    { command: "show_calendar", parameters: ["member_name", "date"] },
    // ... etc
  ]
}
```

**Success Criteria:**
- [ ] Command matching accuracy: >90% for dashboard commands
- [ ] JSON parse success rate: >95%
- [ ] Appropriate routing: Dashboard vs independent response
- [ ] Parameter extraction: Correct names/dates/values
- [ ] Response latency: <3 seconds average
- [ ] Error handling: Graceful degradation

**Test Procedure:**
```
1. Run terminal app: `node test-claude-api.js`
2. Test each command type:
   - All 6 dashboard commands
   - 5 off-menu queries
   - 3 ambiguous commands
3. For each, verify:
   - Correct action type (dashboard_command vs independent_response)
   - Correct command name and parameters
   - Natural response_text
   - Proper JSON formatting
4. Test prompt variations to optimize accuracy
5. Measure average latency over 20 requests
6. Test error scenarios (invalid API key, network timeout)
```

**Deliverable:**
- Node.js script: `test-claude-api.js`
- Test results spreadsheet (command → action/parameters)
- Optimized system prompt template
- Decision: Framework viable, needs refinement, or requires rethinking

**Time Estimate:** 2-3 days

---

### Phase 0 Summary & Decision Gate

**Total Time:** 1-2 weeks (5-8 days total work)

**Go/No-Go Decision Criteria:**

| Component | Green Light | Yellow Light | Red Light |
|-----------|-------------|--------------|-----------|
| Wake Word Detection | >90% detection, <3 false positives/hr | 80-90% detection, 3-5 false positives/hr | <80% detection, >5 false positives/hr |
| TTS Quality | >4/5 family rating | 3-4/5 family rating | <3/5 family rating |
| Claude Framework | >90% command accuracy | 80-90% accuracy | <80% accuracy |

**Possible Outcomes:**

✅ **All Green:** Proceed confidently to Phase 1
- All critical components validated
- Build complete system as planned

🟡 **Some Yellow:** Proceed with adjustments
- Tune wake word sensitivity
- Adjust TTS settings (rate/pitch/voice)
- Refine Claude prompt structure
- May add 1-2 weeks to timeline

🔴 **Any Red:** Re-evaluate approach
- Consider alternative wake word engines
- Explore cloud TTS services (Google/AWS)
- Simplify Claude prompts or use fine-tuned model
- May require architecture changes

**Phase 0 Deliverables:**
1. Three working test applications (APKs + scripts)
2. Technical feasibility report with metrics
3. Recommendations for Phase 1+
4. Updated risk assessment
5. Go/No-Go decision with team

---

### Phase 1: Voice Input Foundation (Week 3-4)

**Goal:** Get voice into the system

**Note:** Timeline shifted by 2 weeks due to Phase 0

**Tasks:**
1. ✅ Integrate Porcupine wake word detection
   - Obtain Picovoice API key
   - Implement VoiceRecognitionService.kt
   - Test with built-in "Porcupine" wake word
   - Optional: Train custom "Hey Dashie" wake word

2. ✅ Implement dual transcription
   - Local: Android SpeechRecognizer
   - Cloud: Google Speech API via Supabase
   - Test accuracy comparison

3. ✅ Build Android ↔ JavaScript bridge
   - Implement WebViewBridge
   - Add @JavascriptInterface methods
   - Test bidirectional communication

**Deliverable:** Say "Hey Dashie, hello world" → Text appears on screen

**Testing:**
```bash
# Test wake word
adb logcat | grep "Wake word detected"

# Test transcription
adb logcat | grep "Transcription"

# Test bridge
# Check browser console for: window.dashieVoiceCommand() calls
```

---

### Phase 2: Claude Intelligence (Week 5-6)

**Goal:** Add AI decision-making

**Note:** Builds on validated framework from Phase 0 Test #3

**Tasks:**
1. ✅ Implement context builder
   - Gather family member data
   - Get active widget states
   - Package current time/location

2. ✅ Create command menu builder
   - Define 6 core commands
   - Add parameter definitions
   - Include usage examples

3. ✅ Build Claude API client
   - Set up proxy endpoint (security)
   - Implement system prompt
   - Parse JSON responses

4. ✅ Create voice command handler
   - Receive transcribed text
   - Build request package
   - Call Claude API
   - Return structured response

**Deliverable:** Voice command reaches Claude, gets intelligent response

**Testing:**
```bash
# Terminal-based testing
node scripts/test-claude-api.js

# Example:
Input: "where is Mary"
Context: { family_members: [...], available_commands: [...] }
Output: {
  action: "dashboard_command",
  command: "show_location",
  parameters: { member_name: "Mary" }
}
```

---

### Phase 3: Command Execution (Week 7-8)

**Goal:** Make it control the dashboard

**Tasks:**
1. ✅ Implement dashboard commands
   - show_location() → Update map widget
   - show_calendar() → Filter calendar
   - show_weather() → Display forecast
   - show_photos() → Start slideshow
   - navigate_to() → Change view
   - set_reminder() → Create event

2. ✅ Build response handler
   - Parse Claude's JSON
   - Route to command functions
   - Handle errors gracefully

3. ✅ Connect to existing widgets
   - Integrate with widget controller
   - Update widget states
   - Test visual updates

**Deliverable:** "Hey Dashie, where is Mary" → Map updates and shows location

**Testing:**
- Test each command individually
- Verify widget updates
- Check error handling
- Test edge cases (member not found, etc.)

---

### Phase 4: Voice Output (Week 9)

**Goal:** Close the loop with speech

**Note:** Uses optimized TTS settings validated in Phase 0 Test #2

**Tasks:**
1. ✅ Implement Android TTS
   - Initialize TextToSpeech in MainActivity
   - Add speak() JavascriptInterface
   - Test audio quality

2. ✅ Build TTS handler (JavaScript)
   - Wrap Android TTS calls
   - Add Web Speech API fallback
   - Handle speaking queue

3. ✅ Integrate with response handler
   - Respect display_instruction
   - Coordinate visual + audio
   - Test timing

**Deliverable:** Complete voice loop - "Hey Dashie" → Spoken response

**Testing:**
- Test all response types (vocalize_and_display, etc.)
- Verify audio quality
- Check synchronization with visual updates
- Test on actual Fire TV

---

### Phase 5: Polish & Production (Week 10-12)

**Goal:** Make it production-ready

**Tasks:**
1. ✅ Error handling
   - Network failures
   - API rate limits
   - Misunderstood commands
   - Fallback messages

2. ✅ User experience
   - Loading indicators
   - Visual feedback
   - Response overlays
   - Success confirmations

3. ✅ Performance optimization
   - Reduce latency
   - Optimize context building
   - Cache common responses
   - Battery optimization

4. ✅ Privacy & security
   - User consent flow
   - Privacy policy
   - API key protection
   - Data retention policy

5. ✅ Testing & QA
   - Fire TV testing
   - Echo Show testing
   - Google TV testing
   - Family user testing

6. ✅ Documentation
   - User guide
   - Privacy documentation
   - Admin configuration
   - Troubleshooting guide

**Deliverable:** Production-ready voice assistant in Dashie

---

## Technical Specifications

### Hardware Requirements

**Supported Devices:**
- Amazon Fire TV Stick 4K
- Amazon Fire TV Cube
- Google TV devices
- Echo Show 10/15
- Android tablets (7"+)

**Minimum Specs:**
- Android 7.0 (API 24)+
- 2GB RAM
- Microphone (USB or built-in)
- Internet connection (for cloud features)

**Recommended USB Microphone:**
- Blue Snowball iCE (~$50)
- Fifine K669B (~$30)
- Any USB mic with OTG adapter

---

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Wake word latency | < 500ms | Porcupine optimized |
| Local transcription | < 2s | Android API |
| Cloud transcription | < 3s | Google API + network |
| Claude response | < 3s | Depends on prompt length |
| Total response time | < 6s | From wake word to TTS start |
| TTS latency | < 1s | Android native |
| Battery impact | < 5% per hour | Always-on listening |

---

### API Rate Limits & Costs

#### Porcupine (Wake Word)
- **Free Tier:** 3 wake words, unlimited usage
- **Paid:** $0.70/month per wake word for custom training
- **Recommendation:** Use built-in "Porcupine" or single custom "Dashie"

#### Google Cloud Speech API
- **Free Tier:** 60 minutes/month
- **Paid:** $0.024/minute (standard), $0.048/minute (enhanced)
- **Expected Usage:** 10 commands/day × 5 seconds = ~25 minutes/month
- **Cost:** $0.60/user/month (standard model)

#### Claude API
- **Claude Sonnet 4.5 Pricing:**
  - Input: $0.03 per 1M tokens
  - Output: $0.15 per 1M tokens
- **Expected Usage:**
  - ~500 input tokens per command (context + menu)
  - ~100 output tokens per response
  - 10 commands/day = 300 commands/month
- **Cost:** ~$0.02/user/month

**Total per user:** ~$0.62/month

---

### Security Architecture

#### API Key Protection

**❌ DON'T: Store in JavaScript**
```javascript
// NEVER DO THIS
const CLAUDE_API_KEY = 'sk-ant-...';
```

**✅ DO: Use Backend Proxy**
```
User → WebView → Backend Proxy → Claude API
                  (validates JWT)
```

**Proxy Implementation (Node.js/Supabase Edge Function):**
```typescript
// supabase/functions/claude-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 1. Verify user authentication
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  // 2. Validate JWT token
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  )
  
  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  
  if (error || !user) {
    return new Response('Invalid token', { status: 401 })
  }
  
  // 3. Rate limit check (optional)
  const rateLimitKey = `claude_calls:${user.id}:${getDay()}`
  const calls = await incrementRateLimit(rateLimitKey)
  
  if (calls > 100) { // 100 calls per day limit
    return new Response('Rate limit exceeded', { status: 429 })
  }
  
  // 4. Forward to Claude API
  const { messages, model, max_tokens } = await req.json()
  
  const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ messages, model, max_tokens })
  })
  
  const data = await claudeResponse.json()
  
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

#### Privacy Controls

**User Consent:**
- First-run wizard explains voice features
- Explicit opt-in required
- Clear data usage disclosure
- Easy opt-out mechanism

**Data Handling:**
- ❌ No persistent audio recordings
- ✅ Transcribed text logged (encrypted, 7-day retention)
- ❌ No voice model training on user data
- ✅ All API calls authenticated

**Transparency:**
- Privacy policy clearly states:
  - What data is collected (transcribed text only)
  - How it's used (command processing)
  - Who has access (Claude AI, Google Speech API)
  - How long it's kept (7 days for debugging)
  - How to delete it (settings → clear voice history)

---

## File Structure

```
dashieapp_staging/
│
├── android/                                    # Android APK
│   └── app/src/main/
│       ├── java/com/dashie/app/
│       │   ├── MainActivity.kt                 # Main WebView + TTS
│       │   ├── VoiceRecognitionService.kt      # Wake word detection
│       │   ├── CloudTranscriptionClient.kt     # Google Speech API
│       │   └── WebViewBridge.kt                # JS ↔ Android bridge
│       │
│       ├── res/
│       │   └── raw/
│       │       └── dashie_wake_word.ppn        # Custom wake word model
│       │
│       └── AndroidManifest.xml                 # Permissions + service
│
├── js/                                         # JavaScript Layer
│   │
│   ├── modules/VoiceCommand/                   # Voice command module
│   │   ├── voice-command-handler.js            # Main coordinator
│   │   ├── response-handler.js                 # Response router
│   │   ├── dashboard-commands.js               # Command implementations
│   │   ├── context-builder.js                  # Context gathering
│   │   ├── menu-builder.js                     # Command menu
│   │   └── tts-handler.js                      # Text-to-speech
│   │
│   ├── services/
│   │   └── claude-api.js                       # Claude API client
│   │
│   └── ui/
│       └── voice-overlay.css                   # Voice UI styles
│
├── supabase/                                   # Backend services
│   └── functions/
│       ├── claude-proxy/                       # Claude API proxy
│       │   └── index.ts
│       │
│       └── transcribe-audio/                   # Google Speech proxy
│           └── index.ts
│
├── scripts/                                    # Development tools
│   ├── test-claude-api.js                      # Terminal API tester
│   ├── test-tts.html                           # TTS testing page
│   └── benchmark-latency.js                    # Performance testing
│
└── docs/
    ├── VOICE_USER_GUIDE.md                     # End-user documentation
    ├── VOICE_PRIVACY_POLICY.md                 # Privacy disclosure
    └── VOICE_ADMIN_CONFIG.md                   # Configuration guide
```

---

## Testing Strategy

### Unit Tests

**JavaScript:**
```javascript
// test/voice-command-handler.test.js
describe('VoiceCommandHandler', () => {
  it('should parse location command', async () => {
    const handler = new VoiceCommandHandler();
    const result = await handler.handleCommand('where is Mary', 'local');
    
    expect(result.action).toBe('dashboard_command');
    expect(result.command).toBe('show_location');
    expect(result.parameters.member_name).toBe('Mary');
  });
  
  it('should handle independent query', async () => {
    const handler = new VoiceCommandHandler();
    const result = await handler.handleCommand('what time is it', 'local');
    
    expect(result.action).toBe('independent_response');
    expect(result.response_text).toContain('time');
  });
});
```

**Android (Kotlin):**
```kotlin
@Test
fun testWakeWordDetection() {
    val service = VoiceRecognitionService()
    val result = service.processAudioBuffer(mockAudioData)
    assertTrue(result.wakeWordDetected)
}
```

---

### Integration Tests

**End-to-End Flow:**
```javascript
// test/integration/voice-flow.test.js
describe('Complete Voice Flow', () => {
  it('should complete show_location command', async () => {
    // 1. Simulate wake word
    await simulateWakeWord();
    
    // 2. Inject voice command
    await injectVoiceCommand('where is Mary');
    
    // 3. Wait for Claude response
    const response = await waitForClaudeResponse();
    
    // 4. Verify command execution
    expect(response.action).toBe('dashboard_command');
    expect(response.command).toBe('show_location');
    
    // 5. Verify widget update
    const mapWidget = document.querySelector('.widget[data-type="map"]');
    expect(mapWidget.dataset.highlighted).toBe('Mary');
    
    // 6. Verify TTS
    expect(mockTTS.spoken).toContain('Mary is currently at');
  });
});
```

---

### Manual Testing Checklist

**Phase 1: Voice Input**
- [ ] Wake word detection works reliably
- [ ] False positive rate acceptable (<2 per hour)
- [ ] Local transcription accurate (>85%)
- [ ] Cloud transcription accurate (>95%)
- [ ] Android bridge working
- [ ] Transcripts visible in WebView

**Phase 2: Claude Intelligence**
- [ ] Context includes family members
- [ ] Command menu generated correctly
- [ ] Claude matches commands properly
- [ ] Independent queries work
- [ ] JSON parsing successful
- [ ] Error handling graceful

**Phase 3: Command Execution**
- [ ] show_location updates map
- [ ] show_calendar filters events
- [ ] show_weather displays forecast
- [ ] show_photos starts slideshow
- [ ] navigate_to changes view
- [ ] set_reminder creates event

**Phase 4: Voice Output**
- [ ] TTS audio quality good
- [ ] Speech timing synchronized
- [ ] Visual + audio coordinated
- [ ] Response overlays visible
- [ ] Stop command works

**Phase 5: Production**
- [ ] Works on Fire TV Stick 4K
- [ ] Works on Fire TV Cube
- [ ] Works on Echo Show
- [ ] Battery impact acceptable
- [ ] Network failures handled
- [ ] Privacy consent shown
- [ ] User can disable feature

---

## Deployment Plan

### Pre-Launch Checklist

**Security:**
- [ ] API keys in environment variables (not code)
- [ ] Backend proxy deployed (Supabase Edge Functions)
- [ ] Rate limiting enabled
- [ ] JWT authentication enforced
- [ ] Privacy policy updated

**Testing:**
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing complete
- [ ] Performance benchmarks met
- [ ] Battery impact measured

**Documentation:**
- [ ] User guide written
- [ ] Privacy policy updated
- [ ] Admin configuration guide
- [ ] Troubleshooting FAQ
- [ ] API documentation

**Compliance:**
- [ ] Amazon App Store policies reviewed
- [ ] Microphone permission disclosure clear
- [ ] User consent mechanism implemented
- [ ] Opt-out mechanism working
- [ ] Data retention policy defined

---

### Staged Rollout

**Alpha (Internal Testing)**
- Deploy to personal devices only
- Test in real-world home environment
- Gather family feedback
- Iterate on UX issues
- Measure performance metrics

**Beta (Limited Release)**
- Deploy to 10-20 trusted users
- Collect usage analytics
- Monitor error rates
- Gather feedback surveys
- Fix critical bugs

**Production (Public Release)**
- Submit to Amazon App Store
- Announce feature in app updates
- Monitor support requests
- Scale backend infrastructure
- Iterate based on feedback

---

### Configuration Management

**Environment Variables:**
```bash
# Development
PORCUPINE_ACCESS_KEY=your_dev_key
GOOGLE_CLOUD_API_KEY=your_dev_key
ANTHROPIC_API_KEY=your_dev_key
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=your_dev_anon_key

# Production
PORCUPINE_ACCESS_KEY=your_prod_key
GOOGLE_CLOUD_API_KEY=your_prod_key
ANTHROPIC_API_KEY=your_prod_key
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=your_prod_anon_key
```

**Android Build Configuration:**
```kotlin
// android/app/build.gradle.kts
android {
    buildTypes {
        debug {
            buildConfigField("String", "PORCUPINE_KEY", 
                "\"${System.getenv("PORCUPINE_ACCESS_KEY_DEV")}\"")
        }
        release {
            buildConfigField("String", "PORCUPINE_KEY", 
                "\"${System.getenv("PORCUPINE_ACCESS_KEY_PROD")}\"")
        }
    }
}
```

---

## Cost & Performance

### Per-User Monthly Costs

**Scenario: 10 voice commands/day**

| Service | Usage | Cost/User/Month |
|---------|-------|----------------|
| Porcupine Wake Word | Unlimited | $0.00 (free tier) |
| Android SpeechRecognizer | Unlimited | $0.00 (native API) |
| Google Cloud Speech | 25 minutes | $0.60 |
| Claude API (Sonnet 4.5) | 300 requests | $0.02 |
| Supabase Edge Functions | 300 calls | $0.00 (free tier) |
| **Total** | | **$0.62/month** |

---

### Cost Optimization Strategies

1. **Prefer Local Transcription** (80% accuracy sufficient)
   - Use cloud only for critical commands
   - Saves $0.48/month → **$0.14/month**

2. **Cache Common Commands** (50% reduction)
   - "where is X", "what's the weather"
   - Saves $0.30/month → **$0.32/month**

3. **Rate Limit** (5 commands/day instead of 10)
   - User-configurable throttling
   - Saves 50% → **$0.31/month**

4. **Use Standard Speech Model** (Already assumed)
   - Enhanced costs 2× ($0.048/min vs $0.024/min)
   - Standard is sufficient for most use cases

**Optimized Cost:** **$0.15-0.30/user/month**

---

### Scaling Economics

| Users | Monthly Cost | Notes |
|-------|--------------|-------|
| 1 | $0.62 | Single user |
| 10 | $6.20 | Small family |
| 100 | $62.00 | Community |
| 1,000 | $620.00 | Optimize needed |
| 10,000 | $6,200.00 | Enterprise pricing |

**Break-Even Analysis:**
- At $2.99/month subscription: Break-even at ~5 commands/day/user
- At $4.99/month subscription: Profitable even at 10 commands/day/user

**Recommendation:** Include voice in base subscription, no per-command charges

---

### Performance Benchmarks

**Target vs Actual (Fire TV Stick 4K):**

| Metric | Target | Expected | Notes |
|--------|--------|----------|-------|
| Wake word latency | < 500ms | 300-400ms | Porcupine optimized |
| Local transcription | < 2s | 1.5-2.5s | Device dependent |
| Cloud transcription | < 3s | 2-4s | Network dependent |
| Claude response | < 3s | 2-5s | Context size dependent |
| Total end-to-end | < 6s | 5-8s | Acceptable range |
| Battery impact | < 5%/hr | 3-4%/hr | Always-on listening |

**Optimization Tips:**
- Reduce context size sent to Claude (only essential data)
- Use Claude's caching for repeated context
- Preload common responses
- Optimize wake word sensitivity (reduce false positives)

---

## Open Questions & Decisions

### 1. Wake Word: Built-in vs Custom?

**Option A: Use built-in "Porcupine"**
- ✅ Free, works immediately
- ✅ No training needed
- ❌ Not branded
- ❌ Generic keyword

**Option B: Train custom "Hey Dashie"**
- ✅ Branded experience
- ✅ Less false positives (unique phrase)
- ❌ $0.70/month per wake word
- ❌ Training time (~1 week)

**Recommendation:** Start with "Porcupine", upgrade to "Hey Dashie" when product-market fit validated.

---

### 2. Transcription: Local vs Cloud?

**Strategy Options:**

**A. Local-only (Cost-optimized)**
- Use Android SpeechRecognizer exclusively
- Free, works offline
- 80-85% accuracy

**B. Cloud-only (Accuracy-optimized)**
- Use Google Speech API exclusively
- 95%+ accuracy
- $0.60/user/month

**C. Hybrid (Recommended)**
- Run both in parallel
- Display local result immediately (fast)
- Update with cloud result (accurate)
- User sees both, can choose preference

**Decision:** **Hybrid approach** - gives best of both worlds

---

### 3. Claude Prompt: How verbose?

**Option A: Minimal Context**
```
Voice command: "where is Mary"
Family: ["Mary", "Charlie"]
Commands: ["show_location", "show_calendar", ...]
```
- ✅ Fast (fewer tokens)
- ✅ Cheap ($0.01/month)
- ❌ Less intelligent
- ❌ May need more back-and-forth

**Option B: Rich Context**
```
Voice command: "where is Mary"
Family: [
  { name: "Mary", last_location: {...}, calendar: [...] },
  { name: "Charlie", ... }
]
Current time: 2025-10-22T14:30:00Z
Active widgets: [...]
Recent events: [...]
Commands: [detailed parameter definitions]
```
- ✅ More intelligent
- ✅ One-shot responses
- ❌ Slower (more tokens)
- ❌ More expensive ($0.02/month)

**Decision:** **Rich context** - better UX worth extra $0.01/month

---

### 4. Rate Limiting: How many commands per day?

**Options:**

| Limit | Use Case | Monthly Cost |
|-------|----------|--------------|
| 5/day | Light users | $0.31 |
| 10/day | Average users | $0.62 |
| 20/day | Power users | $1.24 |
| Unlimited | Enterprise | Variable |

**Recommendation:**
- Free tier: 5 commands/day
- Paid tier: 20 commands/day
- Enterprise: Unlimited with rate limit of 100/day

---

### 5. Offline Mode: What to do when network down?

**Options:**

**A. Disable completely**
- Show "Network required" error
- Simple to implement
- Poor UX

**B. Local-only mode**
- Use Android SpeechRecognizer only
- Process simple commands locally
- "where is Mary" → Check local cache
- Better UX, complex implementation

**C. Queue commands**
- Queue commands when offline
- Process when network returns
- May be stale by then
- Confusing UX

**Recommendation:** **Local-only mode** with limited command set

**Offline-capable commands:**
- Navigate between views (no API needed)
- Show cached widget data
- Display stored photos

**Online-required commands:**
- Show current location (needs Traccar API)
- Web searches (needs Claude)
- Weather updates (needs API)

---

### 6. Multi-user: Identify speakers?

**Options:**

**A. No identification**
- Treat all voice commands equally
- Simpler implementation
- May lack personalization

**B. Voice recognition**
- Use speaker identification ML model
- Personalized responses
- More complex, less accurate

**C. Explicit identification**
- "Hey Dashie, this is Mary, where am I?"
- Requires verbal announcement
- Most accurate, slightly awkward

**D. Context-based**
- Infer from device location, time of day
- "Smart" guessing
- May be wrong

**Recommendation:** **Start with Option A** (no identification), add **Option C** (explicit) later if needed.

---

### 7. Error Handling: What to say when things fail?

**Scenarios & Responses:**

| Failure | User-Friendly Response |
|---------|------------------------|
| Wake word detection failed | (Silent - no false positive better than false negative) |
| Transcription failed | "Sorry, I didn't catch that. Could you try again?" |
| Claude API timeout | "I'm thinking... this is taking longer than usual. Please wait." |
| Claude API error | "I'm having trouble understanding. Could you rephrase that?" |
| Command not found | "I'm not sure how to do that yet. Try asking me to show location, calendar, or weather." |
| Widget update failed | "I understood your request but couldn't update the display. Please try again." |
| Network down | "I need an internet connection for that command. Check your network and try again." |

**General Principles:**
- Never blame the user
- Offer alternative phrasing
- Provide helpful suggestions
- Avoid technical jargon
- Keep responses friendly

---

## Success Metrics

### Phase 1 Goals (Voice Input)
- [ ] Wake word detection rate: >95%
- [ ] False positive rate: <2 per hour
- [ ] Local transcription accuracy: >85%
- [ ] Cloud transcription accuracy: >95%
- [ ] Average latency: <3 seconds

### Phase 2 Goals (Intelligence)
- [ ] Command matching accuracy: >90%
- [ ] Claude response time: <3 seconds
- [ ] JSON parse success rate: >99%
- [ ] Context building time: <500ms

### Phase 3 Goals (Execution)
- [ ] Command execution success: >95%
- [ ] Widget update success: >98%
- [ ] Error recovery rate: 100%

### Phase 4 Goals (Voice Output)
- [ ] TTS clarity: >90% understandable
- [ ] Response timing: <1s to start speaking
- [ ] Audio-visual sync: <200ms difference

### Phase 5 Goals (Production)
- [ ] Overall user satisfaction: >4.0/5.0
- [ ] Daily active usage: >5 commands/household
- [ ] Feature retention: >80% after 30 days
- [ ] Support tickets: <5% of users

---

## Next Actions

### Week 1: Phase 0 Setup & Test #1 (Wake Word)

**Monday-Tuesday: Obtain API Keys & Setup**
1. Get API credentials:
   - [ ] Picovoice Console → Get Porcupine access key
   - [ ] Google Cloud Console → Enable Speech-to-Text API (for Phase 0 Test #1)
   - [ ] Anthropic Console → Get Claude API key (for Phase 0 Test #3)

2. Set up development environment:
   - [ ] Install Android Studio
   - [ ] Install Node.js (for Phase 0 Test #3)
   - [ ] Clone dashieapp_staging repo
   - [ ] Purchase USB microphone + OTG adapter ($30-50)

**Wednesday-Friday: Build & Test Wake Word Detection**
3. Build Phase 0 Test #1: Wake Word + Transcription Test
   - [ ] Create minimal Android app project
   - [ ] Integrate Porcupine wake word detection
   - [ ] Add Android SpeechRecognizer
   - [ ] Build simple UI with visual feedback
   - [ ] Install APK on Fire TV
   - [ ] Connect USB microphone

4. Run feasibility tests:
   - [ ] Test wake word detection from various distances
   - [ ] Measure false positive rate over 2 hours
   - [ ] Test transcription accuracy with preset phrases
   - [ ] Document results and metrics

**Goal:** Validate that USB microphone + wake word detection works reliably

---

### Week 2: Phase 0 Tests #2 & #3 (TTS + Claude API)

**Monday-Tuesday: Build & Test TTS Quality**
1. Build Phase 0 Test #2: TTS Quality Test
   - [ ] Create Android app with WebView
   - [ ] Add TTS controls (rate, pitch, voice)
   - [ ] Add preset test messages
   - [ ] Install on Fire TV

2. Run TTS assessment:
   - [ ] Test with family members (3-5 people)
   - [ ] Collect ratings on clarity, naturalness, pleasantness
   - [ ] Identify optimal settings
   - [ ] Document family feedback

**Wednesday-Friday: Build & Test Claude API Framework**
3. Build Phase 0 Test #3: Claude API Interaction Test
   - [ ] Create Node.js terminal application
   - [ ] Build mock context and command menu
   - [ ] Implement Claude API client
   - [ ] Add interactive REPL

4. Run framework validation:
   - [ ] Test all dashboard commands
   - [ ] Test off-menu queries
   - [ ] Test edge cases and ambiguous commands
   - [ ] Measure response accuracy and latency
   - [ ] Optimize system prompt
   - [ ] Document results

**Goal:** Validate TTS acceptability and Claude framework viability

---

### Week 2 End: Phase 0 Decision Gate

**Go/No-Go Meeting:**
- [ ] Review all three feasibility test results
- [ ] Calculate Go/No-Go scores (Green/Yellow/Red)
- [ ] Make decision: Proceed, Adjust, or Re-evaluate
- [ ] If Green: Proceed to Phase 1 (Week 3)
- [ ] If Yellow: Spend extra week tuning, then Phase 1 (Week 4)
- [ ] If Red: Re-evaluate architecture, timeline extends

---

### Weeks 3-4: Phase 1 (Voice Input) - IF PHASE 0 SUCCESSFUL

**Week 3:**
1. Integrate validated components into main Dashie app:
   - [ ] Add Porcupine to existing Android APK
   - [ ] Add dual transcription (local + cloud)
   - [ ] Build Android ↔ JavaScript bridge
   - [ ] Test on Fire TV with Dashie WebView

**Week 4:**
2. Polish and test integration:
   - [ ] Add visual wake word indicator
   - [ ] Test transcription accuracy in Dashie context
   - [ ] Verify bridge communication
   - [ ] End-to-end smoke test

**Goal:** Say "Hey Dashie, hello world" → Text appears on dashboard

---

### Weeks 5-6: Phase 2 (Claude Intelligence)

**Week 5:**
- [ ] Port validated Claude framework from Phase 0
- [ ] Implement context builder (family data, widgets, etc.)
- [ ] Implement command menu builder
- [ ] Integrate Claude API client into Dashie

**Week 6:**
- [ ] Create voice command handler
- [ ] Test command routing
- [ ] Validate JSON parsing
- [ ] End-to-end intelligence test

**Goal:** Voice command reaches Claude, gets intelligent structured response

---

### Weeks 7-12: Complete Remaining Phases

**Weeks 7-8: Phase 3 (Command Execution)**
- Implement dashboard command functions
- Connect to existing widgets
- Test all command types

**Week 9: Phase 4 (Voice Output)**
- Integrate TTS with optimized settings from Phase 0
- Build response handler
- Test complete voice loop

**Weeks 10-12: Phase 5 (Production)**
- Error handling and edge cases
- Performance optimization
- Privacy controls
- Alpha/Beta testing
- App Store submission prep

**Goal:** Production-ready Dashie Voice Assistant

---

## Resources

### API Documentation
- **Claude API:** https://docs.anthropic.com/
- **Google Cloud Speech:** https://cloud.google.com/speech-to-text/docs
- **Porcupine (Picovoice):** https://picovoice.ai/docs/porcupine/
- **Android Speech:** https://developer.android.com/reference/android/speech/SpeechRecognizer
- **Supabase Functions:** https://supabase.com/docs/guides/functions

### Development Tools
- **Android Studio:** https://developer.android.com/studio
- **Node.js:** https://nodejs.org/ (for testing scripts)
- **adb (Android Debug Bridge):** Included with Android Studio

### Testing Resources
- **Fire TV Testing:** https://developer.amazon.com/docs/fire-tv/
- **Logcat Viewer:** Android Studio built-in or `adb logcat`

---

## Summary

This unified plan combines voice infrastructure (wake word, transcription) with AI intelligence (Claude understanding and routing) to create a complete voice assistant for Dashie. The system is designed to be:

- **Fast:** <6 second total response time
- **Smart:** Claude AI understands natural language
- **Flexible:** Works with dashboard commands OR general queries
- **Privacy-focused:** No persistent audio storage
- **Cost-effective:** ~$0.62/user/month
- **Production-ready:** Staged rollout with full testing

**Implementation is broken into 6 clear phases over 10-12 weeks, with well-defined milestones and deliverables for each phase.**

---

**Document Version:** 2.1 (Unified with Phase 0 De-risking)  
**Last Updated:** October 22, 2025  
**Status:** Phase 0 - Technical Feasibility Testing

**Next Step:** Begin Phase 0 feasibility tests (Wake Word, TTS Quality, Claude Framework) before full implementation.