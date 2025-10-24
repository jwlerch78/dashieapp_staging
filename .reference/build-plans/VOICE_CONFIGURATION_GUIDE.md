# Voice Configuration Guide

## Overview

Voice settings are now centralized in `config.js` for easy management. You can change the voice for all users by editing the config, and later wire it to user settings for per-user customization.

## Quick Start: Changing the Voice

### Option 1: Edit config.js (Affects Everyone)

**File:** [config.js:450](../../config.js#L450)

```javascript
export const VOICE_CONFIG = {
  provider: 'elevenlabs',  // or 'openai'

  // Change this line to switch voices:
  defaultVoice: AVAILABLE_VOICES.RACHEL,  // ← Change RACHEL to any voice below

  // ...
};
```

**Available voices:**
- `AVAILABLE_VOICES.RACHEL` - Calm, clear, professional (female)
- `AVAILABLE_VOICES.DOMI` - Warm, friendly, conversational (female)
- `AVAILABLE_VOICES.BELLA` - Young, energetic, friendly (female)
- `AVAILABLE_VOICES.ADAM` - Deep, confident, clear (male)
- `AVAILABLE_VOICES.ANTONI` - Well-rounded, versatile (male)

**Then:** Just refresh your browser - no redeployment needed!

### Option 2: Add Custom Voice

If you have a custom voice from ElevenLabs:

**File:** [config.js:400](../../config.js#L400)

```javascript
export const AVAILABLE_VOICES = {
  // Add your custom voice:
  MY_CUSTOM_VOICE: {
    id: 'voice_id_from_elevenlabs',
    name: 'My Custom Voice',
    gender: 'female', // or 'male' or 'neutral'
    description: 'Description here',
    language: 'en'
  },

  // Existing voices...
  RACHEL: { ... },
  // ...
};
```

Then set it as default:
```javascript
defaultVoice: AVAILABLE_VOICES.MY_CUSTOM_VOICE,
```

## Testing Voices

After changing the voice in config.js:

```javascript
// Refresh browser first (Cmd+Shift+R)
const VoiceService = (await import('./js/core/voice-service.js')).default;
await VoiceService.speak('Hello, this is my new voice!');
```

## Advanced Settings

### Adjust Voice Quality/Speed

**File:** [config.js:453](../../config.js#L453)

```javascript
elevenlabs: {
  model: 'eleven_flash_v2_5',  // Fast + quality
  // Or try: 'eleven_turbo_v2_5' for even faster (slightly lower quality)

  voiceSettings: {
    stability: 0.5,           // 0-1: Higher = more consistent
    similarityBoost: 0.75,    // 0-1: Voice accuracy
    style: 0.0,               // 0-1: Expressiveness
    useSpeakerBoost: true     // Enhanced clarity
  }
}
```

**Stability recommendations:**
- `0.3-0.5` - More expressive, varied intonation (conversational)
- `0.5-0.7` - Balanced (default)
- `0.7-1.0` - Very consistent, predictable (robotic)

### Switch to OpenAI (Fallback)

```javascript
export const VOICE_CONFIG = {
  provider: 'openai',  // ← Change to 'openai'

  // OpenAI will use these settings:
  openai: {
    model: 'tts-1',    // or 'tts-1-hd' for higher quality
    voice: 'nova',     // alloy, echo, fable, onyx, nova, shimmer
    speed: 1.0         // 0.25 - 4.0
  }
};
```

## For Settings UI Integration (Later)

When you're ready to add voice selection to settings, use these methods:

### Get Available Voices

```javascript
import { AVAILABLE_VOICES } from '../../../config.js';

// Returns object with all voices
const voices = AVAILABLE_VOICES;

// For dropdown:
const voiceList = Object.values(AVAILABLE_VOICES);
// [
//   { id: '...', name: 'Rachel', gender: 'female', ... },
//   { id: '...', name: 'Domi', gender: 'female', ... },
//   ...
// ]
```

### Change Voice at Runtime

```javascript
import { AVAILABLE_VOICES } from '../../../config.js';

const VoiceService = (await import('./js/core/voice-service.js')).default;

// Get provider (WebVoiceProvider or AndroidVoiceProvider)
const provider = VoiceService.provider;

// Change voice:
provider.setVoiceSettings({
  voice: AVAILABLE_VOICES.ADAM  // Switch to Adam
});

// Test new voice:
await VoiceService.speak('Hello, I am Adam now');
```

### Get Current Voice

```javascript
const currentSettings = VoiceService.provider.getVoiceSettings();
console.log('Current voice:', currentSettings.voice.name);
console.log('Provider:', currentSettings.provider);
```

### Save to Database (User Settings)

```javascript
// When user changes voice in settings UI:
const selectedVoice = AVAILABLE_VOICES.DOMI;

// 1. Update runtime
VoiceService.provider.setVoiceSettings({ voice: selectedVoice });

// 2. Save to database
await SettingsService.updateSetting('voice.defaultVoice', {
  id: selectedVoice.id,
  name: selectedVoice.name,
  gender: selectedVoice.gender,
  description: selectedVoice.description,
  language: selectedVoice.language
});
```

### Load from Database (On App Start)

```javascript
// In initialization:
const savedVoice = await SettingsService.getSetting('voice.defaultVoice');

if (savedVoice) {
  VoiceService.provider.setVoiceSettings({
    voice: savedVoice
  });
}
```

## Settings UI Example Structure

When you build the voice settings page, here's a suggested structure:

```javascript
{
  id: 'voice',
  label: 'Voice Settings',
  pages: [
    {
      id: 'voice-selection',
      title: 'Choose Voice',
      items: [
        {
          type: 'dropdown',
          label: 'Voice',
          options: Object.values(AVAILABLE_VOICES).map(v => ({
            value: v.id,
            label: `${v.name} (${v.gender})`,
            description: v.description
          })),
          onChange: (voiceId) => {
            const voice = Object.values(AVAILABLE_VOICES)
              .find(v => v.id === voiceId);
            VoiceService.provider.setVoiceSettings({ voice });
          }
        },
        {
          type: 'button',
          label: 'Test Voice',
          action: async () => {
            const voice = VoiceService.provider.getVoiceSettings().voice;
            await VoiceService.speak(`Hello, this is ${voice.name}`);
          }
        }
      ]
    }
  ]
}
```

## File Locations

- **Voice Config:** [config.js:391-473](../../config.js#L391-L473)
- **Available Voices:** [config.js:400-439](../../config.js#L400-L439)
- **Default Voice:** [config.js:450](../../config.js#L450)
- **WebVoiceProvider:** [js/core/voice/web-voice-provider.js](../../js/core/voice/web-voice-provider.js)

## Examples

### Example 1: Switch to Domi Voice

```javascript
// config.js
defaultVoice: AVAILABLE_VOICES.DOMI,  // Warm, friendly voice
```

### Example 2: Switch to Male Voice

```javascript
// config.js
defaultVoice: AVAILABLE_VOICES.ADAM,  // Deep, confident male voice
```

### Example 3: Add & Use Custom Voice

```javascript
// config.js - Add custom voice
export const AVAILABLE_VOICES = {
  MY_BRAND_VOICE: {
    id: 'abc123def456',  // From ElevenLabs
    name: 'Brand Voice',
    gender: 'female',
    description: 'Custom branded voice',
    language: 'en'
  },
  // ... other voices
};

// Set as default
defaultVoice: AVAILABLE_VOICES.MY_BRAND_VOICE,
```

## Performance Notes

- **Cache is voice-specific** - Switching voices clears the cache
- **First call is slower** - Subsequent calls use cache (instant)
- **Voice changes are immediate** - No redeployment needed

## Troubleshooting

### Voice not changing

1. Hard refresh browser (Cmd+Shift+R)
2. Check console for errors
3. Verify voice ID is correct in config.js

### Voice sounds wrong

1. Test voice at ElevenLabs: https://elevenlabs.io/app/voice-library
2. Verify voice ID matches
3. Check `voiceSettings` in config (stability, etc.)

### Still using old voice

1. Clear browser cache
2. Check `defaultVoice` in config.js
3. Run: `VoiceService.provider.getVoiceSettings()` to see current voice
