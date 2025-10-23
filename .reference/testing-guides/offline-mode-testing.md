# Offline Mode & Testing Guide

## Overview

Dashie now includes resilience features to handle network outages and Supabase service interruptions. This guide explains how to test offline mode and use developer features.

## Features

### 1. Offline Mode Resilience

**What it does:**
- Detects when Supabase/backend is unavailable
- Serves cached calendar data from IndexedDB
- Shows offline indicator banner
- Continues retrying connection in background
- Auto-restores when service is back

**User Experience:**
```
┌─────────────────────────────────────────────────┐
│ SCENARIO: Internet Outage                      │
├─────────────────────────────────────────────────┤
│ ✅ Existing users: Dashboard loads from cache  │
│ ❌ New users: "System Unavailable" message     │
└─────────────────────────────────────────────────┘
```

### 2. Testing Simulation

Test offline behavior without disconnecting your internet!

#### Console Commands

```javascript
// Simulate complete internet outage
simulateOffline()

// Restore normal operation
simulateOnline()

// Check current connection status
getConnectionStatus()
```

**Example Output:**
```
🧪 Simulating offline mode...

⚠️  OFFLINE MODE SIMULATION ACTIVE

📡 All API calls will be blocked
💾 Dashboard will run on cached data only
🔄 Offline indicator should appear

💡 To restore: simulateOnline()
```

### 3. Auth Bypass (Developer Mode)

Work on UI/themes without needing authentication or data.

#### Usage

Add `?bypass-auth` to your URL:

```
http://localhost:8080/?bypass-auth=true
```

**What happens:**
- ✅ Skips authentication entirely
- ✅ Loads dashboard immediately
- ✅ Widgets load without data
- ⚠️ Developer-only feature
- ⚠️ Don't use settings (they need real data)

**When to use:**
- Working on CSS/themes
- Testing layout changes
- UI development
- Component styling

**Console logs:**
```
⚠️ AUTH BYPASS ACTIVE - Developer Mode
Dashboard will load without authentication or data
To disable: Remove ?bypass-auth from URL
```

## Architecture

### Connection Status Monitoring

Location: [connection-status.js](js/utils/connection-status.js)

**Tracks:**
- Network connectivity (navigator.onLine)
- Backend availability (Supabase health)
- Degraded mode state
- Last successful connection time

**Health Checks:**
- Automatic retries with exponential backoff
- Starts at 30 seconds
- Max interval: 5 minutes
- Auto-stops when connection restored

### Offline Indicator

Location: [offline-indicator.js](js/ui/offline-indicator.js)

**Shows when:**
- Network is offline
- Backend is unavailable
- Running in degraded mode

**Features:**
- Prominent banner at top of dashboard
- Shows reason for offline state
- "Retry Connection" button
- Auto-dismisses when online

### Calendar Cache

Location: [calendar-cache.js](js/utils/calendar-cache.js)

**Behavior:**
```
Age 0-2 min:  ✅ Serve cache (fresh)
Age 2-5 min:  ✅ Serve cache + background refresh
Age 5+ min:   ✅ Serve STALE cache + background refresh
              (User NEVER sees "loading" after first fetch!)
```

## Testing Scenarios

### Test 1: Simulate Offline

1. Load dashboard normally (gets cached data)
2. Open console
3. Run: `simulateOffline()`
4. **Expected:** Offline indicator appears, API calls blocked
5. Try refreshing calendar
6. **Expected:** Shows cached data instantly
7. Run: `simulateOnline()`
8. **Expected:** Indicator disappears

### Test 2: Auth Bypass

1. Navigate to: `http://localhost:8080/?bypass-auth=true`
2. **Expected:** Dashboard loads immediately
3. **Expected:** Console shows bypass warning
4. Widgets load empty (no data)
5. Work on themes/CSS
6. To disable: Remove `?bypass-auth` from URL

### Test 3: Cache Expiry

1. Load dashboard (caches data)
2. Wait 6+ minutes (cache expires)
3. Refresh page
4. **Expected:** Shows cached data instantly, refreshes in background
5. Check console: `getCacheStatus()`
6. **Expected:** Shows stale cache, background refresh

### Test 4: Real Outage

1. Disconnect internet OR Supabase goes down
2. Refresh page
3. **Existing users:** Dashboard loads from cache
4. **New users:** "System Unavailable" message
5. Reconnect internet
6. **Expected:** Auto-detects, indicator disappears

## Console Commands

### Connection Testing

```javascript
simulateOffline()        // Simulate internet outage
simulateOnline()         // Restore normal operation
getConnectionStatus()    // View current status
```

### Calendar Cache

```javascript
getCacheStatus()         // View cache metadata
refreshCalendar()        // Force refresh (bypass cache)
clearCache()             // Clear all cached data
```

### Developer Tools

```javascript
help()                   // Show all commands
getAppState()           // View application state
getAuthStatus()         // Check auth status
```

## Configuration

### Cache TTL Settings

Location: [config.js](config.js)

```javascript
// Mark cache as stale after 5 minutes
CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;

// Start background refresh after 2 minutes
CALENDAR_CACHE_REFRESH_THRESHOLD_MS = 2 * 60 * 1000;
```

### Health Check Settings

Location: [connection-status.js](js/utils/connection-status.js)

```javascript
healthCheckDelay = 30000;              // Start at 30 seconds
maxHealthCheckDelay = 5 * 60 * 1000;  // Max 5 minutes
healthCheckBackoffMultiplier = 1.5;    // Exponential backoff
```

## Troubleshooting

### "Auth Bypass not working"
- Check URL has `?bypass-auth=true`
- Refresh page after adding parameter
- Check console for bypass warning

### "Offline indicator stuck"
- Run: `simulateOnline()`
- Run: `getConnectionStatus()` to check state
- If in test mode, shows: `⚠️ TEST MODE ACTIVE`

### "Cache not loading"
- Run: `getCacheStatus()` to verify cache exists
- Check browser console for errors
- Try: `clearCache()` then reload page

### "API calls still working in offline mode"
- This is normal if not in test mode
- Test mode only simulates, doesn't actually block
- Real outage will block API calls naturally

## Future Enhancements

### Planned Features

- [ ] Service worker for true offline support
- [ ] Offline queue for writes (save when online returns)
- [ ] Progressive Web App (PWA) capabilities
- [ ] Background sync for calendar updates
- [ ] Network quality indicator (slow/fast)
- [ ] Automatic retry strategies per API endpoint

### Potential Improvements

- Add "Offline Mode" toggle in settings
- Cache photos in addition to calendar
- Offline-first architecture for all data
- Better error messages for specific failure types
- Telemetry for tracking outage patterns

## Summary

This offline mode implementation provides:

✅ **Resilience** - Dashboard works during outages
✅ **Testing** - Simulate failures without disconnecting
✅ **Developer Tools** - Bypass auth for UI work
✅ **User Experience** - Never see "loading" after first fetch
✅ **Visibility** - Clear indicators and status

The system is designed to degrade gracefully, keeping users productive even when services are unavailable.
