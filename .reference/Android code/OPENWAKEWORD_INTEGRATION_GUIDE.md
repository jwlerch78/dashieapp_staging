# OpenWakeWord Integration Guide

This guide shows how to replace Porcupine with OpenWakeWord for better Fire TV compatibility.

## Why OpenWakeWord?

- ✅ **Free unlimited training** via Google Colab
- ✅ **Better cross-platform compatibility** - uses ONNX Runtime
- ✅ **Open-source** (Apache 2.0) - no vendor lock-in
- ✅ **No monthly limits** - train as many models as you want
- ✅ **Works on Fire TV** - more universal than Porcupine's proprietary format

## Step 1: Update build.gradle Dependencies

Add OpenWakeWord dependency to your `app/build.gradle.kts` or `app/build.gradle`:

```kotlin
dependencies {
    // Remove Porcupine (comment out or delete):
    // implementation 'ai.picovoice:porcupine-android:3.0.1'

    // Add OpenWakeWord:
    implementation("xyz.rementia:openwakeword:0.1.5")

    // Add Kotlin Coroutines (if not already present):
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
}
```

## Step 2: Download the "Hey Jarvis" Model

1. Go to: https://github.com/dscripka/openWakeWord/releases/latest
2. Download `hey_jarvis.onnx` (or browse assets for this model)
3. Or download directly from: https://github.com/dscripka/openWakeWord/blob/main/openwakeword/resources/models/hey_jarvis.onnx

## Step 3: Add Model to Android Project

Place the downloaded model file in your Android project:

```
app/src/main/assets/models/hey_jarvis.onnx
```

**Important**: Create the `assets/models/` directory structure if it doesn't exist:
- Right-click on `app/src/main/` in Android Studio
- Select New → Directory
- Name it `assets`
- Create a subdirectory called `models`
- Copy `hey_jarvis.onnx` into `assets/models/`

## Step 4: Replace VoiceAssistantManager

Replace your existing `VoiceAssistantManager.kt` with the new version:

1. Backup your current `VoiceAssistantManager.kt`
2. Copy the contents of `voiceassistantmanager-openwakeword.kt` to `VoiceAssistantManager.kt`
3. Sync your Gradle project

**Key changes in the new version:**

- Removed Porcupine imports and `porcupine` variable
- Added OpenWakeWord `WakeWordEngine` and coroutines
- Changed `initializeWakeWord()` to use ONNX models
- Updated `startWakeWordDetection()` to use OpenWakeWord API
- Added proper coroutine cleanup in `destroy()`

## Step 5: No Changes Needed to MainActivity

Your existing `MainActivity.kt` should work without changes because we kept the same public API:

- `initialize()`
- `initializeWakeWord()`
- `startWakeWordDetection()`
- `stopWakeWordDetection()`
- `isWakeWordActive()`
- All callbacks remain the same

## Step 6: Test on Fire TV

1. Build and deploy the updated app to Fire TV
2. Grant microphone permission if prompted
3. Say **"Hey Jarvis"** instead of "Hey Dashie"
4. Check logcat for:
   - `[VoiceAssistantManager] OpenWakeWord initialized successfully`
   - `[VoiceAssistantManager] Starting wake word detection...`
   - `[VoiceAssistantManager] Wake word detected: Hey Jarvis`

## Step 7: Train Custom "Hey Dashie" Model (Optional)

Once "Hey Jarvis" works, you can train your own "Hey Dashie" model:

1. Go to Google Colab: https://colab.research.google.com/drive/1q1oe2zOyZp7UsB3jJiQ1IFn8z5YfjwEb
2. Follow the notebook instructions to train "hey dashie"
3. Download the generated `hey_dashie.onnx` file
4. Replace `hey_jarvis.onnx` in `assets/models/` with `hey_dashie.onnx`
5. Update the model configuration in `initializeWakeWord()`:

```kotlin
val models = listOf(
    WakeWordModel(
        name = "Hey Dashie",
        modelPath = "models/hey_dashie.onnx",  // Changed filename
        threshold = 0.5f
    )
)
```

## Troubleshooting

### Model file not found error

**Error**: `FileNotFoundException: models/hey_jarvis.onnx`

**Solution**: Make sure the model is in `app/src/main/assets/models/hey_jarvis.onnx` (not `res/raw/`)

### Wake word not detecting

**Try these threshold values**:
- `0.5f` - Default (balanced)
- `0.3f` - More sensitive (more false positives)
- `0.7f` - Less sensitive (fewer false positives)

**Check logcat for**:
- Audio permission granted?
- OpenWakeWord initialized message?
- Any error messages?

### Fire TV still not working

If OpenWakeWord still fails on Fire TV:
1. Check Fire TV's CPU architecture: `adb shell getprop ro.product.cpu.abi`
2. Verify ONNX Runtime supports that architecture
3. Check for any native library loading errors in logcat

## Model Performance Tips

From OpenWakeWord documentation:

- **Target accuracy**: <5% false-reject rates, <0.5 false activations per hour
- **Threshold tuning**: Start with 0.5, adjust based on your environment
- **Background noise**: Lower threshold for noisy environments
- **Multiple models**: Can detect multiple wake words simultaneously

## Switching Back to Porcupine (if needed)

If you need to revert:

1. Restore your backup of the original `VoiceAssistantManager.kt`
2. Remove OpenWakeWord dependency from `build.gradle`
3. Re-add Porcupine dependency
4. Sync Gradle project

## Next Steps

Once "Hey Jarvis" works on Fire TV:

1. ✅ Confirm wake word detection works
2. ✅ Test speech recognition after wake word
3. ✅ Verify TTS confirmation plays
4. ✅ Test theme switching voice command
5. ⏭️ Train custom "Hey Dashie" model
6. ⏭️ Continue with AI integration (Claude API)

## Resources

- **OpenWakeWord GitHub**: https://github.com/dscripka/openWakeWord
- **Android Library**: https://github.com/Re-MENTIA/openwakeword-android-kt
- **Training Notebook**: https://colab.research.google.com/drive/1q1oe2zOyZp7UsB3jJiQ1IFn8z5YfjwEb
- **Pre-trained Models**: https://github.com/dscripka/openWakeWord/releases

## Support

If you encounter issues:

1. Check Android Studio logcat for detailed error messages
2. Verify all dependencies are synced
3. Ensure model file is in correct location
4. Test on Google TV emulator first before Fire TV
5. File issues at: https://github.com/Re-MENTIA/openwakeword-android-kt/issues
