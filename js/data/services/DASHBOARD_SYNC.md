# Dashboard Synchronization System

**Location:** `js/services/dashboard-sync-service.js` and `js/data/services/heartbeat-service.js`

---

## Overview

The Dashboard Synchronization system enables real-time communication between multiple dashboard instances running in different browser windows or tabs. It uses the **BroadcastChannel API** for instant cross-window messaging and a **Heartbeat Service** for dashboard health tracking.

### Key Design Principles

1. **Instant Sync** - Changes propagate to all dashboard instances immediately
2. **Optimistic Updates** - Update local state first, then broadcast to others
3. **Health Tracking** - Monitor dashboard status and version via heartbeats
4. **Lightweight** - Uses browser-native BroadcastChannel API (no polling)

---

## Architecture Overview

```
Dashboard A                   Dashboard B                   Dashboard C
     │                             │                             │
     │ 1. User changes theme       │                             │
     ├─────────────────────────────┼─────────────────────────────┤
     │ 2. Update local UI          │                             │
     │ 3. Broadcast 'theme-changed'│                             │
     ├─────────────────────────────>                             │
     │                             │ 4. Receive broadcast        │
     │                             │ 5. Apply theme              │
     │                             <─────────────────────────────┤
     │                             │                             │
     │                             │                             │ 6. Receive broadcast
     │                             │                             │ 7. Apply theme
     │                             │                             │
```

**Components:**
- **DashboardSyncService** - BroadcastChannel wrapper for cross-window messaging
- **HeartbeatService** - Periodic status updates to server
- **BroadcastChannel API** - Browser-native cross-tab communication

---

## Cross-Dashboard Synchronization

### How It Works

**1. Initialization:**
```javascript
import { dashboardSync } from './services/dashboard-sync-service.js';

// Initialize during app startup
dashboardSync.initialize();

// Register listeners for specific events
dashboardSync.on('theme-changed', ({ theme }) => {
  themeApplier.applyTheme(theme);
});
```

**2. Broadcasting Changes:**
```javascript
// Dashboard A changes theme
themeApplier.applyTheme('dark');
dashboardSync.broadcast('theme-changed', { theme: 'dark' });

// Dashboard B, C, D all receive the message and update their themes
```

**3. Receiving Changes:**
```javascript
// Automatically handled by registered listeners
dashboardSync.on('theme-changed', ({ theme }) => {
  logger.info(`Theme changed to ${theme} by another dashboard`);
  themeApplier.applyTheme(theme);
});
```

### Optimistic Update Pattern

**The recommended pattern:**
```javascript
// 1. Update local state immediately (optimistic)
themeApplier.applyTheme('halloween');

// 2. Broadcast to other dashboards
dashboardSync.broadcast('theme-changed', { theme: 'halloween' });

// 3. Write to database (async, don't wait)
settingsService.set('interface.theme', 'halloween');
```

**Why this pattern?**
- ✅ Instant UI feedback
- ✅ No loading states
- ✅ Other dashboards update immediately
- ✅ Database write happens in background

---

## Broadcast Events

### Supported Event Types

| Event | When Fired | Payload | Listeners |
|-------|-----------|---------|-----------|
| `theme-changed` | Theme selection changed | `{ theme: string }` | ThemeApplier, Widgets |
| `photos-updated` | Photo added/deleted | `{ action?: string }` | PhotoWidget |
| `calendar-updated` | Calendar settings changed | `{ action?: string }` | CalendarWidget, AgendaWidget |
| `settings-changed` | General settings modified | `{ path: string, value: any }` | Settings pages, Widgets |

### Event Specifications

**theme-changed**
```javascript
dashboardSync.broadcastThemeChange('halloween');

// Equivalent to:
dashboardSync.broadcast('theme-changed', { theme: 'halloween' });
```

**photos-updated**
```javascript
dashboardSync.broadcastPhotosUpdate({ action: 'added', count: 5 });

// Triggers photo widgets to refresh
```

**calendar-updated**
```javascript
dashboardSync.broadcastCalendarUpdate({ action: 'calendars-changed' });

// Triggers calendar widgets to reload data
```

**settings-changed**
```javascript
dashboardSync.broadcastSettingsChange('interface.clockFormat', '24h');

// Payload: { path: 'interface.clockFormat', value: '24h' }
```

### Custom Events

You can broadcast custom events for your own features:

```javascript
// Broadcast custom event
dashboardSync.broadcast('custom-event', {
  data: 'anything',
  timestamp: Date.now()
});

// Listen for custom event
dashboardSync.on('custom-event', (payload) => {
  console.log('Custom event received', payload);
});
```

---

## Heartbeat Service

### Purpose

The Heartbeat Service tracks dashboard health, version, and active status by sending periodic updates to the server.

**What it tracks:**
- Dashboard online/offline status
- App version (for update notifications)
- Device type (Fire TV, Android TV, browser)
- Device fingerprint (unique identifier)
- User activity

### Configuration

**In `config.js`:**
```javascript
export const APP_VERSION = '3.0.0';
export const HEARTBEAT_FREQUENCY_MS = 60000; // 60 seconds
export const HEARTBEAT_VERSION_CHECK_ENABLED = true;
export const HEARTBEAT_AUTO_UPDATE_PROMPT = true;
```

### Initialization

```javascript
import heartbeatService from './data/services/heartbeat-service.js';

// Initialize with EdgeClient (for authenticated requests)
await heartbeatService.initialize(edgeClient);

// Heartbeat starts automatically
// Sends first heartbeat immediately, then every 60 seconds
```

### Heartbeat Payload

**Sent to server:**
```javascript
{
  version: '3.0.0',
  device_type: 'fire_tv',              // fire_tv | android_tv | native_android | browser
  device_fingerprint: 'abc123...',     // Hashed device identifier
  user_agent: 'Mozilla/5.0...',
  dashboard_name: 'Fire TV Dashboard'
}
```

**Response from server:**
```javascript
{
  success: true,
  is_first_heartbeat: false,
  needs_update: false,
  latest_version: '3.0.0'
}
```

### Version Mismatch Detection

When a new version is deployed:

**1. Server detects version mismatch:**
```javascript
// Server checks: APP_VERSION vs latest_version
if (APP_VERSION < latest_version) {
  return { needs_update: true, latest_version: '3.1.0' };
}
```

**2. Client prompts user to update:**
```javascript
// Heartbeat service shows browser confirm dialog
"🎉 New version 3.1.0 available!

You're running v3.0.0.

Update now? (Recommended)"
```

**3. User accepts → Auto-update:**
```javascript
// Clear caches (except JWT - stay logged in)
await heartbeatService.clearAllCaches();

// Reload with cache-busting timestamp
window.location.href = window.location.pathname + '?v=' + timestamp;
```

### Device Fingerprinting

**Purpose:** Uniquely identify dashboard instances

**Generation:**
```javascript
// Combines device characteristics
const data = [
  navigator.userAgent,
  screen.width + 'x' + screen.height,
  screen.colorDepth,
  Intl.DateTimeFormat().resolvedOptions().timeZone,
  navigator.language,
  navigator.hardwareConcurrency || 'unknown'
].join('|');

// SHA-256 hash (or fallback hash for Fire TV)
const fingerprint = await crypto.subtle.digest('SHA-256', data);
```

**Privacy:** Fingerprint is hashed and cannot be reversed to identify the user.

### Database Schema

**Table: `dashboard_heartbeats`**
```sql
CREATE TABLE dashboard_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  device_type TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  version TEXT NOT NULL,
  dashboard_name TEXT,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX idx_dashboard_heartbeats_user_id
ON dashboard_heartbeats(user_id);

-- Index for stale heartbeat cleanup
CREATE INDEX idx_dashboard_heartbeats_last_heartbeat
ON dashboard_heartbeats(last_heartbeat);
```

**Usage:**
- Track how many dashboards user has active
- Detect stale/offline dashboards
- Monitor app version distribution
- Device type analytics

---

## Usage Examples

### Example 1: Theme Synchronization

```javascript
import { dashboardSync } from './services/dashboard-sync-service.js';
import { themeApplier } from './ui/theme-applier.js';

// Initialize sync
dashboardSync.initialize();

// Listen for theme changes from other dashboards
dashboardSync.on('theme-changed', ({ theme }) => {
  logger.info(`Another dashboard changed theme to ${theme}`);
  themeApplier.applyTheme(theme);

  // Update widgets
  widgetMessenger.broadcast('theme-changed', { theme });
});

// When user changes theme locally
function handleThemeChange(newTheme) {
  // 1. Apply theme immediately (local)
  themeApplier.applyTheme(newTheme);

  // 2. Broadcast to other dashboards
  dashboardSync.broadcastThemeChange(newTheme);

  // 3. Save to database (async)
  settingsService.set('interface.theme', newTheme);
}
```

### Example 2: Calendar Data Refresh

```javascript
// After user adds a new calendar in Settings
function handleCalendarAdded(calendarId) {
  // 1. Update local state
  activeCalendars.push(calendarId);

  // 2. Refresh local calendar data
  await calendarService.refreshCalendarData();

  // 3. Broadcast to other dashboards
  dashboardSync.broadcastCalendarUpdate({
    action: 'calendar-added',
    calendarId
  });

  // 4. Save to database
  await settingsService.set('calendar.activeCalendars', activeCalendars);
}

// On other dashboards
dashboardSync.on('calendar-updated', async ({ action, calendarId }) => {
  if (action === 'calendar-added') {
    logger.info(`Calendar ${calendarId} added by another dashboard`);

    // Reload settings and refresh calendar data
    await settingsService.loadSettings();
    await calendarService.refreshCalendarData();
  }
});
```

### Example 3: Photo Library Sync

```javascript
// After user uploads photos
async function handlePhotosUploaded(newPhotos) {
  // 1. Add photos to local state
  photoLibrary.push(...newPhotos);

  // 2. Update UI immediately
  photoWidget.render(photoLibrary);

  // 3. Broadcast to other dashboards
  dashboardSync.broadcastPhotosUpdate({
    action: 'added',
    count: newPhotos.length
  });

  // 4. Upload to database (async)
  await photoService.uploadPhotos(newPhotos);
}

// On other dashboards
dashboardSync.on('photos-updated', async ({ action, count }) => {
  if (action === 'added') {
    logger.info(`${count} photos added by another dashboard`);

    // Reload photo library
    const photos = await photoService.loadPhotos();
    photoWidget.render(photos);
  }
});
```

### Example 4: Settings Page Sync

```javascript
// In Settings page (e.g., clock format toggle)
function handleClockFormatChange(format) {
  // 1. Update local state
  currentClockFormat = format;

  // 2. Update UI preview
  updateClockPreview(format);

  // 3. Broadcast to other dashboards
  dashboardSync.broadcastSettingsChange('interface.clockFormat', format);

  // 4. Save to database
  settingsService.set('interface.clockFormat', format);
}

// On other dashboards (including widgets)
dashboardSync.on('settings-changed', ({ path, value }) => {
  if (path === 'interface.clockFormat') {
    // Update clock widget display
    clockWidget.setFormat(value);
  }
});
```

---

## Configuration

### Dashboard Sync Configuration

**Channel Name:**
```javascript
// In dashboard-sync-service.js
this.channelName = 'dashie-dashboard-sync';
```

**Debouncing (Optional):**
If you're broadcasting frequently (e.g., on every keystroke), debounce:

```javascript
import { debounce } from './utils/debounce.js';

const debouncedBroadcast = debounce((path, value) => {
  dashboardSync.broadcastSettingsChange(path, value);
}, 500);

// Use debounced version
input.addEventListener('input', (e) => {
  debouncedBroadcast('interface.familyName', e.target.value);
});
```

### Heartbeat Configuration

**Adjusting Frequency:**
```javascript
// In config.js
export const HEARTBEAT_FREQUENCY_MS = 30000; // 30 seconds (more frequent)
// OR
export const HEARTBEAT_FREQUENCY_MS = 120000; // 2 minutes (less frequent)
```

**Runtime Frequency Change:**
```javascript
// Change frequency while app is running
heartbeatService.updateFrequency(30000); // 30 seconds
```

**Disable Version Checking:**
```javascript
// In config.js
export const HEARTBEAT_VERSION_CHECK_ENABLED = false;
export const HEARTBEAT_AUTO_UPDATE_PROMPT = false;
```

**Custom Dashboard Name:**
```javascript
// In heartbeat-service.js (TODO: make this user-configurable)
getDashboardName() {
  const customName = settingsService.get('interface.dashboardName');
  if (customName) return customName;

  // Fall back to device type
  return this.getDeviceType() === 'fire_tv' ? 'Fire TV Dashboard' : 'Browser Dashboard';
}
```

---

## Best Practices

### DO:

✅ **Use optimistic updates**
```javascript
// Update local first, broadcast second
applyChangeLocally();
dashboardSync.broadcast('event', data);
```

✅ **Clean up listeners on destroy**
```javascript
destroy() {
  dashboardSync.off('theme-changed', this.handleThemeChange);
}
```

✅ **Debounce high-frequency broadcasts**
```javascript
const debouncedBroadcast = debounce(dashboardSync.broadcast, 500);
```

✅ **Include helpful context in payloads**
```javascript
dashboardSync.broadcast('photos-updated', {
  action: 'deleted',
  photoIds: ['123', '456'],
  count: 2
});
```

### DON'T:

❌ **Don't broadcast on every keystroke**
```javascript
// BAD: Broadcasts 10 times while typing "HelloWorld"
input.addEventListener('input', (e) => {
  dashboardSync.broadcast('settings-changed', { value: e.target.value });
});

// GOOD: Debounced, broadcasts once after user stops typing
input.addEventListener('input', debounce((e) => {
  dashboardSync.broadcast('settings-changed', { value: e.target.value });
}, 500));
```

❌ **Don't send large payloads**
```javascript
// BAD: Sending entire photo library (could be MBs)
dashboardSync.broadcast('photos-updated', { photos: allPhotos });

// GOOD: Send notification, let receivers fetch data
dashboardSync.broadcast('photos-updated', { action: 'refresh' });
```

❌ **Don't forget to handle errors**
```javascript
dashboardSync.on('settings-changed', async ({ path, value }) => {
  try {
    await settingsService.set(path, value);
  } catch (error) {
    logger.error('Failed to apply settings change', error);
    // Show error toast to user
  }
});
```

❌ **Don't create infinite loops**
```javascript
// BAD: Broadcasts when receiving broadcast → infinite loop
dashboardSync.on('theme-changed', ({ theme }) => {
  themeApplier.applyTheme(theme);
  dashboardSync.broadcast('theme-changed', { theme }); // INFINITE LOOP!
});

// GOOD: Only broadcast when LOCAL user changes theme
function handleUserThemeChange(theme) {
  themeApplier.applyTheme(theme);
  dashboardSync.broadcast('theme-changed', { theme });
}
```

---

## Troubleshooting

### Events Not Syncing

**Symptoms:**
- Changes in one dashboard don't appear in others
- No console logs for received messages

**Checks:**
1. **BroadcastChannel supported?**
   ```javascript
   if (!window.BroadcastChannel) {
     console.error('BroadcastChannel not supported');
   }
   ```

2. **Sync initialized?**
   ```javascript
   // Check for initialization log
   // Console should show: "Dashboard sync initialized"
   ```

3. **Listeners registered?**
   ```javascript
   // Verify listeners are registered before broadcasts
   dashboardSync.on('theme-changed', handler); // Must be called first
   ```

4. **Same channel name?**
   ```javascript
   // All dashboards must use same channel name
   this.channelName = 'dashie-dashboard-sync';
   ```

### Heartbeat Not Updating

**Symptoms:**
- No heartbeat logs in console
- Dashboard shows as offline in database
- Version update prompts not appearing

**Checks:**
1. **EdgeClient initialized?**
   ```javascript
   // Heartbeat requires EdgeClient with valid JWT
   if (!heartbeatService.edgeClient || !heartbeatService.edgeClient.jwtToken) {
     console.error('No JWT token available');
   }
   ```

2. **Network errors?**
   ```javascript
   // Check Network tab for failed POST to /heartbeat
   // Should see: POST https://[project].supabase.co/functions/v1/heartbeat
   ```

3. **Too many consecutive failures?**
   ```javascript
   // Heartbeat stops after 3 failures to avoid spam
   // Check console for: "Too many consecutive heartbeat failures"
   ```

4. **Correct endpoint?**
   ```javascript
   // Verify URL is correct:
   const heartbeatUrl = `${baseUrl}/heartbeat`;
   // Should be: https://[project].supabase.co/functions/v1/heartbeat
   ```

### Version Mismatch Warnings

**Symptoms:**
- Constant update prompts
- Can't dismiss update notification

**Solutions:**

1. **Update app version in config.js:**
   ```javascript
   // In config.js
   export const APP_VERSION = '3.1.0'; // Match latest deployed version
   ```

2. **Clear browser cache:**
   ```javascript
   // Hard reload: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   ```

3. **Disable version checking temporarily:**
   ```javascript
   // In config.js
   export const HEARTBEAT_VERSION_CHECK_ENABLED = false;
   ```

### Infinite Broadcast Loops

**Symptoms:**
- Console flooded with broadcast messages
- App becomes unresponsive
- Rapid-fire theme/settings changes

**Fix:**
```javascript
// BAD: Broadcasts when receiving broadcast
dashboardSync.on('theme-changed', ({ theme }) => {
  themeApplier.applyTheme(theme);
  dashboardSync.broadcast('theme-changed', { theme }); // LOOP!
});

// GOOD: Only broadcast from user actions
function handleUserAction(theme) {
  themeApplier.applyTheme(theme);
  dashboardSync.broadcast('theme-changed', { theme });
}

dashboardSync.on('theme-changed', ({ theme }) => {
  // Just apply theme, don't re-broadcast
  themeApplier.applyTheme(theme);
});
```

---

## Related Documentation

- [ARCHITECTURE.md](../../../.reference/ARCHITECTURE.md) - System architecture overview
- [README.md](../../core/initialization/README.md) - Initialization system (includes sync setup)
- [SETTINGS_PAGE_BASE_GUIDE.md](../../modules/Settings/SETTINGS_PAGE_BASE_GUIDE.md) - Settings synchronization
- [config.js](../../../config.js) - Heartbeat configuration

---

## Summary

The Dashboard Synchronization system provides:

1. **Real-time cross-window sync** via BroadcastChannel API
2. **Dashboard health tracking** via Heartbeat Service
3. **Version update detection** with auto-update prompts
4. **Optimistic update pattern** for instant UI feedback

**Key Components:**
- **DashboardSyncService** - Cross-window messaging
- **HeartbeatService** - Health tracking & version checking
- **BroadcastChannel** - Browser-native communication

**Supported Events:**
- `theme-changed` - Theme updates
- `photos-updated` - Photo library changes
- `calendar-updated` - Calendar configuration changes
- `settings-changed` - General settings updates

**Best Practices:**
- ✅ Update local state first (optimistic)
- ✅ Broadcast to other dashboards second
- ✅ Write to database third (async)
- ✅ Debounce high-frequency updates
- ✅ Clean up listeners on destroy
- ❌ Don't create infinite broadcast loops
- ❌ Don't send large payloads

The sync system enables seamless multi-dashboard experiences where changes propagate instantly across all active dashboard instances.
