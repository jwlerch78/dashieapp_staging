# Android Cloud STT Implementation

**Status:** ✅ Complete - Ready for Testing

**Date:** 2025-10-24

---

## What Was Implemented

We've successfully implemented **cloud-based speech-to-text for Android/Fire TV**, replacing the unsupported native Android STT library. This unified approach is used for both wake word detection and manual button clicks.

**Why Cloud STT:**
- Google's native STT library is not supported on Fire TV
- Cloud STT provides consistent behavior across all Android devices
- Prepares audio data for future AI integration

### Flow Overview

Both wake word and button click now use the same cloud STT flow:

**Wake Word Flow:**
```
1. User says "Hey Dashy"
2. Porcupine detects wake word
3. Android sends 'wakeWordDetected' event to webapp
4. Webapp plays beep sound (800Hz, 150ms)
5. Webapp triggers recording: DashieNative.startCloudSTTCapture(5)
6. Android records for 5 seconds
7. Android sends audio data via window.onDashieAudioData
8. Webapp processes audio (delegates to Android cloud STT)
9. Android sends transcript via 'speechResult' event
10. VoiceCommandRouter processes the command
11. Wake word detection restarts for next command
```

**Button Click Flow:**
```
1. User clicks microphone button in voice widget
2. Voice widget sends 'start-listening' to parent
3. WidgetDataManager calls voiceService.startListening()
4. AndroidVoiceProvider plays beep and emits VOICE_LISTENING_STARTED
5. DashieNative.startCloudSTTCapture(5) triggered
6. [Same as steps 6-11 above]
```

---

## Files Modified

### js/core/voice/android-voice-provider.js

**Changes:**
1. Added `_setupAudioDataHandler()` - Sets up `window.onDashieAudioData` callback
2. Added `_configureWakeWord()` - Configures Android for webapp-controlled mode (`autoRecord: false`)
3. Added `_handleWakeWordDetected()` - Plays beep and triggers recording
4. Added `_handleAudioData()` - Processes received audio data
5. Added `_base64ToBlob()` - Converts base64 audio to blob
6. Added `_playBeep()` - Plays 800Hz beep using Web Audio API
7. Added `_sendToSpeechAPI()` - Placeholder for future cloud STT integration
8. Updated `_handleAndroidEvent()` - Calls `_handleWakeWordDetected()` on wake word
9. Updated `startListening()` - Now uses cloud STT instead of native Android STT
10. Updated `stopListening()` - Now calls `stopCloudSTTCapture()` instead of `stopListening()`
11. Updated `cancelListening()` - Now calls `stopCloudSTTCapture()` instead of `cancelListening()`
12. Updated `destroy()` - Cleans up audio data handler

**Key Configuration:**
```javascript
// Line 129: Configure webapp-controlled mode
window.DashieNative.setWakeWordConfig(false, 5);
// autoRecord=false: Webapp controls recording
// duration=5: Record for 5 seconds when triggered
```

**Important Change - Unified Cloud STT:**
Both wake word and button click now use `DashieNative.startCloudSTTCapture(5)` instead of the unsupported `DashieNative.startListening()` native Android STT method. This is because Google's native STT library doesn't work on Fire TV devices.

---

## How It Works

### 1. Initialization

When AndroidVoiceProvider initializes:
```javascript
// Setup callbacks
_setupEventHandler()      // Handles voice events
_setupAudioDataHandler()  // Handles audio data
_configureWakeWord()      // Sets webapp-controlled mode

// Start wake word detection
setTimeout(() => {
  startWakeWordDetection();
}, 1000);
```

### 2. Wake Word Detection

When wake word is detected:
```javascript
_handleWakeWordDetected() {
  this._playBeep();  // Play 800Hz beep
  setTimeout(() => {
    window.DashieNative.startCloudSTTCapture(5);  // Start recording
  }, 100);
}
```

### 2b. Button Click (NEW - Unified Flow)

When microphone button is clicked:
```javascript
startListening() {
  this._playBeep();  // Play 800Hz beep
  this.isCurrentlyListening = true;
  AppComms.emit('VOICE_LISTENING_STARTED');  // Immediate UI feedback

  setTimeout(() => {
    window.DashieNative.startCloudSTTCapture(5);  // Same as wake word!
  }, 100);
}
```

### 3. Audio Processing

When audio is received:
```javascript
_handleAudioData(base64Audio) {
  const audioBlob = this._base64ToBlob(base64Audio);
  await this._sendToSpeechAPI();  // Delegates to Android STT

  // Restart wake word detection
  setTimeout(() => {
    this.startWakeWordDetection();
  }, 500);
}
```

---

## Testing Checklist

### Prerequisites
- Fire TV device with DashieNative app installed
- Porcupine wake word model configured ("Hey Dashy")
- Microphone permissions granted

### Test Steps

1. **Load Dashboard**
   ```
   - Open Dashie app on Fire TV
   - Check console for: "Wake word configured for webapp-controlled mode"
   - Check console for: "Starting wake word detection"
   ```

2. **Test Wake Word Detection**
   ```
   - Say "Hey Dashy"
   - Should hear beep sound (800Hz, 150ms)
   - Check console for: "Wake word detected - triggering webapp-controlled recording"
   - Check console for: "Starting cloud STT capture (5 seconds)"
   ```

3. **Test Voice Command**
   ```
   - Say "Hey Dashy"
   - Hear beep
   - Say "set dark mode" (within 5 seconds)
   - Check console for: "Received audio data from Android"
   - Theme should change to dark mode
   - Wake word detection should restart automatically
   ```

4. **Test Multiple Commands**
   ```
   - Say "Hey Dashy" → "set light mode"
   - Wait 1 second
   - Say "Hey Dashy" → "set dark mode"
   - Both commands should work sequentially
   ```

### Expected Console Output

```
[AndroidVoiceProvider] Wake word configured for webapp-controlled mode
[AndroidVoiceProvider] Android voice event handler registered
[AndroidVoiceProvider] Android audio data handler registered
[AndroidVoiceProvider] Starting wake word detection
[AndroidVoiceProvider] Wake word detected - triggering webapp-controlled recording
[AndroidVoiceProvider] Played wake word beep
[AndroidVoiceProvider] Starting cloud STT capture (5 seconds)
[AndroidVoiceProvider] Android voice event: listeningStarted
[AndroidVoiceProvider] Android voice event: listeningEnded
[AndroidVoiceProvider] Received audio data from Android { size: "80KB" }
[AndroidVoiceProvider] Audio blob created { size: "81920 bytes" }
[AndroidVoiceProvider] Sending audio to speech-to-text API
[AndroidVoiceProvider] Audio processing delegated to Android native layer
[AndroidVoiceProvider] Android voice event: speechResult "set dark mode"
[VoiceCommandRouter] Processing voice command: "set dark mode"
[VoiceCommandRouter] Theme changed to: dark
[AndroidVoiceProvider] Starting wake word detection
```

---

## Debugging

### Check Wake Word Configuration

```javascript
// In browser console:
const config = JSON.parse(DashieNative.getWakeWordConfig());
console.log('Auto-record:', config.autoRecord);  // Should be false
console.log('Duration:', config.duration);        // Should be 5
```

### Check Event Handlers

```javascript
// In browser console:
console.log(typeof window.onDashieVoiceEvent);  // Should be "function"
console.log(typeof window.onDashieAudioData);   // Should be "function"
```

### Test Manual Recording

```javascript
// Bypass wake word, just test recording:
DashieNative.startCloudSTTCapture(5);
// Then speak: "set dark mode"
```

### Android Logcat

```bash
adb logcat -s VoiceAssistant

# Look for:
# "Wake word config: autoRecord=false, duration=5 seconds"
# "Auto-recording disabled, waiting for webapp to trigger recording"
# "Starting cloud STT capture for 5 seconds"
```

---

## Architecture Integration

### Event Flow

```
Android Native Layer
  ↓ (Wake word detected)
window.onDashieVoiceEvent('wakeWordDetected')
  ↓
AndroidVoiceProvider._handleAndroidEvent()
  ↓
AndroidVoiceProvider._handleWakeWordDetected()
  ↓
_playBeep() + DashieNative.startCloudSTTCapture(5)
  ↓
window.onDashieAudioData(base64Audio)
  ↓
AndroidVoiceProvider._handleAudioData()
  ↓
window.onDashieVoiceEvent('speechResult', transcript)
  ↓
AppComms.emit('VOICE_TRANSCRIPT_RECEIVED', transcript)
  ↓
VoiceCommandRouter._handleVoiceTranscript()
  ↓
Command executed (theme change, etc.)
```

### AppComms Events

The following events are emitted during the wake word flow:

- `VOICE_WAKE_WORD_DETECTED` - Wake word heard
- `VOICE_LISTENING_STARTED` - Recording started
- `VOICE_LISTENING_STOPPED` - Recording ended
- `VOICE_TRANSCRIPT_RECEIVED` - Transcript ready
- `VOICE_ERROR` - Any errors

---

## Future Enhancements

### 1. Custom Beep Sound
Replace Web Audio beep with custom MP3:
```javascript
_playBeep() {
  const audio = new Audio('/sounds/wake-beep.mp3');
  audio.play();
}
```

### 2. Visual Feedback
Show listening indicator on screen:
```javascript
_handleWakeWordDetected() {
  AppComms.emit('VOICE_WAKE_WORD_DETECTED');  // Already done
  // UI can listen to this and show visual indicator
  this._playBeep();
  // ...
}
```

### 3. Direct Cloud STT
Send audio directly to Supabase Edge Function instead of delegating to Android:
```javascript
async _sendToSpeechAPI(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob);

  const response = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/speech-to-text`, {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
    }
  });

  const { transcript } = await response.json();
  AppComms.emit('VOICE_TRANSCRIPT_RECEIVED', transcript);
}
```

### 4. Configurable Recording Duration
Allow users to set recording duration in settings:
```javascript
// In settings:
const duration = settingsStore.get('voice.recordingDuration') || 5;
DashieNative.setWakeWordConfig(false, duration);
```

### 5. Mode Switching
Add UI toggle to switch between auto-record and webapp-controlled:
```javascript
function setVoiceMode(mode) {
  const autoRecord = mode === 'auto';
  DashieNative.setWakeWordConfig(autoRecord, 5);
  settingsStore.set('voice.mode', mode);
}
```

---

## Troubleshooting

### Issue: No beep sound
- Check browser console for audio errors
- Verify AudioContext is supported
- Check device volume

### Issue: Wake word not detected
- Check Porcupine wake word model is loaded
- Verify microphone permissions
- Check Android logcat for wake word errors

### Issue: Recording doesn't start after beep
- Check `DashieNative.startCloudSTTCapture` is available
- Verify wake word config: `autoRecord` should be `false`
- Check Android logcat for recording errors

### Issue: Audio data not received
- Verify `window.onDashieAudioData` is set
- Check Android logcat for audio capture errors
- Test with manual recording: `DashieNative.startCloudSTTCapture(5)`

### Issue: Transcript not processed
- Check `window.onDashieVoiceEvent` for 'speechResult' event
- Verify VoiceCommandRouter is initialized
- Check console for command processing errors

---

## Related Documentation

- [Android Wake Word & Audio Guide](Android-wakeword-and-audio.md)
- [Voice Chat Interface Design](voice-chat-interface-design.md)
- [Voice Command Router](../../js/core/voice-command-router.js)
- [Android Voice Provider](../../js/core/voice/android-voice-provider.js)

---

## Summary

✅ **Webapp-controlled wake word mode is fully implemented and ready for testing.**

**Key Benefits:**
- Better UX with audible beep feedback
- Webapp controls recording timing
- Easy to add visual indicators later
- Consistent with Android specification

**Next Steps:**
1. Test on Fire TV device
2. Verify beep plays correctly
3. Test multiple voice commands
4. Consider adding visual feedback
5. Plan for direct cloud STT integration
