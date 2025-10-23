# Widget Messenger Architecture

## Overview

The WidgetMessenger is responsible for broadcasting application state to all widget iframes. It implements a **deduplication system** to avoid sending redundant updates to widgets.

## Critical: Adding New State Properties

⚠️ **IMPORTANT**: When adding a new property to `currentState`, you MUST update three locations or widgets won't receive updates:

### 1. Define the property in `currentState` (constructor)

```javascript
this.currentState = {
  calendar: null,
  photos: null,
  weather: null,
  auth: { ready: false, user: null },
  theme: 'light',
  settings: {},
  // YOUR NEW PROPERTY HERE
};
```

### 2. Add change detection in `shouldSendStateUpdate()`

```javascript
shouldSendStateUpdate(widgetWindow) {
  // ... existing checks ...

  // Check if YOUR_PROPERTY has changed
  if (this.hasYourPropertyChanged(lastSent)) {
    return true;
  }
}
```

### 3. Track last sent value in `updateLastSentState()`

```javascript
updateLastSentState(widgetWindow) {
  this.lastSentState.set(widgetWindow, {
    // ... existing properties ...
    yourProperty: this.currentState.yourProperty ? { timestamp: this.currentState.yourProperty.timestamp } : null
  });
}
```

### 4. Subscribe to AppComms event in `setupEventSubscriptions()`

```javascript
AppComms.subscribe(AppComms.events.YOUR_PROPERTY_UPDATED, (data) => {
  this.currentState.yourProperty = data;
  logger.debug('Your property updated, broadcasting to widgets');
  this.broadcastCurrentState();
});
```

## Deduplication System

### How It Works

1. **Initial Send**: When a widget first loads, `shouldSendStateUpdate()` returns `true` because there's no `lastSent` data
2. **After Send**: `updateLastSentState()` stores metadata about what was sent (timestamps, not full objects)
3. **Subsequent Updates**: `shouldSendStateUpdate()` compares current state to last sent state
4. **Smart Comparison**: Uses timestamps for data objects, direct comparison for primitives

### Why This Exists

Without deduplication:
- Every state change would broadcast to ALL widgets (even if unchanged)
- Widgets would receive duplicate data constantly
- Performance degradation with many widgets

### The Bug We Fixed (Settings)

**Problem**: When `settings` was added to `currentState`, we forgot to:
1. Add `hasSettingsChanged()` check in `shouldSendStateUpdate()`
2. Include `settings` in `updateLastSentState()`

**Result**: Widgets only received settings on first load. Subsequent settings changes were broadcast but **skipped by deduplication** because the deduplication logic didn't detect the change.

**Symptoms**:
- `broadcastCount: 1, skippedCount: 5` (only 1 widget received update)
- Photos widget transition time wouldn't update
- Settings appeared to save but widgets didn't apply them

## State Properties Reference

| Property | Type | Change Detection | Update Trigger |
|----------|------|------------------|----------------|
| `calendar` | Object | `lastUpdated` timestamp | `CALENDAR_UPDATED` event |
| `photos` | Object | `lastUpdated` timestamp | `PHOTOS_UPDATED` event |
| `weather` | Object | `lastUpdated` timestamp | `WEATHER_UPDATED` event |
| `settings` | Object | `lastModified` timestamp | `SETTINGS_CHANGED` event |
| `theme` | String | Direct comparison | `THEME_CHANGED` event |
| `auth` | Object | Not checked (triggers reload) | `AUTH_USER_CHANGED` event |

## Best Practices

### For Data Objects (with timestamps)

```javascript
// When publishing data, always include a timestamp
AppComms.publish(AppComms.events.YOUR_DATA_UPDATED, {
  items: [...],
  lastUpdated: Date.now()  // Required for deduplication
});
```

### For Settings-like Objects

```javascript
// Settings should have lastModified timestamp
{
  photos: { transitionTime: 10 },
  interface: { theme: 'dark' },
  lastModified: Date.now()  // Required for deduplication
}
```

### Testing Deduplication

When testing broadcasts, check logs for:
```
Broadcast complete {
  totalIframes: 6,
  broadcastCount: 6,  // Should match totalIframes if state changed
  skippedCount: 0     // Should be 0 if state changed
}
```

If `skippedCount > 0` when state DID change, it means deduplication is incorrectly skipping widgets.

## Common Pitfalls

1. **Forgetting timestamp**: Data objects without `lastUpdated` can't be deduplicated properly
2. **Missing deduplication check**: New state properties not checked in `shouldSendStateUpdate()`
3. **Not tracking in lastSent**: New properties not stored in `updateLastSentState()`
4. **Full object storage**: Don't store full objects in `lastSentState`, just timestamps (memory leak)

## Related Files

- `js/core/widget-messenger.js` - Main implementation
- `js/core/app-comms.js` - Event bus for state changes
- `js/widgets/WIDGETS_README.md` - Widget development guide
- `.reference/ARCHITECTURE.md` - System architecture overview
