# Configurable Wake Word Recording - Quick Reference

## Overview

You now have two recording modes that can be switched on the fly:

### Mode 1: Auto-Record (Fast & Simple)
```
Wake word → Android automatically records → Sends audio → Process
```

### Mode 2: Webapp-Controlled (Better UX)
```
Wake word → Notify webapp → Play beep → Webapp triggers recording → Sends audio → Process
```

---

## JavaScript API

### Configuration

```javascript
// Set mode at initialization
DashieNative.setWakeWordConfig(autoRecord, duration);

// Examples:
DashieNative.setWakeWordConfig(true, 5);   // Auto-record for 5 seconds
DashieNative.setWakeWordConfig(false, 5);  // Webapp-controlled

// Get current config
const config = DashieNative.getWakeWordConfig();
console.log(JSON.parse(config));
// Returns: {"autoRecord":true,"duration":5}
```

### Manual Recording

```javascript
// Trigger recording manually (regardless of mode)
DashieNative.startCloudSTTCapture(5);  // Record for 5 seconds

// Stop early
DashieNative.stopCloudSTTCapture();
```

### Receiving Audio

```javascript
// This callback fires when audio is captured (both modes)
window.onDashieAudioData = function(base64Audio) {
    // Convert to Blob
    const audioBlob = base64ToBlob(base64Audio);
    
    // Send to your API
    sendToYourAPI(audioBlob);
};

function base64ToBlob(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'audio/wav' });
}
```

---

## Implementation Examples

### Simple Auto-Record Setup

```javascript
// Initialize
DashieNative.setWakeWordConfig(true, 5);
DashieNative.startWakeWordDetection();

// Handle audio
window.onDashieAudioData = function(base64Audio) {
    const blob = base64ToBlob(base64Audio);
    sendToAPI(blob);
};

// Done! Android handles everything automatically
```

### Webapp-Controlled with Beep

```javascript
// Initialize
DashieNative.setWakeWordConfig(false, 5);
DashieNative.startWakeWordDetection();

// Handle wake word
window.onDashieVoiceEvent = function(event, data) {
    if (event === 'wakeWordDetected') {
        playBeep();
        setTimeout(() => {
            DashieNative.startCloudSTTCapture(5);
        }, 100);
    }
};

// Handle audio (same as auto-record)
window.onDashieAudioData = function(base64Audio) {
    const blob = base64ToBlob(base64Audio);
    sendToAPI(blob);
};
```

---

## Audio Format Specifications

The captured audio has these characteristics:
- **Sample Rate**: 16,000 Hz
- **Encoding**: PCM 16-bit (LINEAR16)
- **Channels**: Mono
- **Byte Order**: Little-endian
- **Format**: Raw PCM data (no WAV headers)

Most speech APIs (Google, OpenAI Whisper, etc.) can accept raw PCM with these specs.

---

## Complete Flow Diagram

### Auto-Record Mode
```
1. User: "Hey Dashy"
2. Porcupine detects wake word
3. Android fires: window.onDashieVoiceEvent('wakeWordDetected')
4. Android auto-starts recording (5 seconds)
5. Android fires: window.onDashieVoiceEvent('listeningStarted')
6. [Recording happening...]
7. Android fires: window.onDashieVoiceEvent('listeningEnded')
8. Android fires: window.onDashieAudioData(base64Audio)
9. Webapp sends to API
10. Webapp restarts wake word detection
```

### Webapp-Controlled Mode
```
1. User: "Hey Dashy"
2. Porcupine detects wake word
3. Android fires: window.onDashieVoiceEvent('wakeWordDetected')
4. Webapp plays beep
5. Webapp calls: DashieNative.startCloudSTTCapture(5)
6. Android fires: window.onDashieVoiceEvent('listeningStarted')
7. [Recording happening...]
8. Android fires: window.onDashieVoiceEvent('listeningEnded')
9. Android fires: window.onDashieAudioData(base64Audio)
10. Webapp sends to API
11. Webapp restarts wake word detection
```

---

## Event Reference

All events come through `window.onDashieVoiceEvent(event, data)`:

| Event | Data | When |
|-------|------|------|
| `wakeWordDetected` | `""` | Wake word heard |
| `listeningStarted` | `""` | Recording started |
| `listeningEnded` | `""` | Recording stopped |
| `partialResult` | `"Recording: 40%"` | Progress updates |
| `speechError` | `"Error message"` | Recording failed |
| `wakeWordError` | `"Error message"` | Wake word failed |

Audio data comes through separate callback:
- `window.onDashieAudioData(base64Audio)` - Base64 encoded PCM audio

---

## Switching Modes at Runtime

```javascript
// Switch to auto-record
function enableAutoRecord() {
    DashieNative.setWakeWordConfig(true, 5);
    localStorage.setItem('voiceMode', 'auto');
}

// Switch to webapp-controlled
function enableWebappControl() {
    DashieNative.setWakeWordConfig(false, 5);
    localStorage.setItem('voiceMode', 'webapp');
}

// Load saved preference
const savedMode = localStorage.getItem('voiceMode');
const isAuto = savedMode === 'auto';
DashieNative.setWakeWordConfig(isAuto, 5);
```

---

## Debugging

### Check Current Configuration
```javascript
const config = JSON.parse(DashieNative.getWakeWordConfig());
console.log('Auto-record:', config.autoRecord);
console.log('Duration:', config.duration);
```

### Test Manual Recording
```javascript
// Bypass wake word, just record
DashieNative.startCloudSTTCapture(5);
```

### Logcat Monitoring
```bash
# Watch Android logs
adb logcat -s VoiceAssistant

# Look for:
# "Wake word config: autoRecord=true, duration=5 seconds"
# "Auto-recording enabled, starting 5s capture..."
# "Auto-recording disabled, waiting for webapp to trigger recording"
```

---

## Best Practices

1. **Always restart wake word detection** after processing audio
2. **Add small delays** (100-500ms) between beep and recording start
3. **Show visual indicators** so users know recording is happening
4. **Handle errors gracefully** and restart wake word detection
5. **Save user preference** for which mode they prefer
6. **Test both modes** to see which feels better for your users

---

## Troubleshooting

**Audio not captured in auto-record mode?**
- Check logcat for "Auto-recording enabled" message
- Verify `autoRecord` is set to `true`

**Webapp not getting wake word notification?**
- Ensure `window.onDashieVoiceEvent` is defined before wake word fires
- Check browser console for errors

**Audio quality issues?**
- Sample rate is fixed at 16kHz (optimal for speech)
- Check your API's expected format

**Long delay before recording?**
- Auto-record mode has ~100ms delay (intentional for stability)
- Webapp mode adds your beep duration + 100ms

---

## Example: Complete Implementation

See the full example in `configurable-wake-word.js` for:
- Both mode implementations
- Audio conversion helpers
- Error handling
- Runtime mode switching
- Debug utilities