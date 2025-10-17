# Heartbeat Configuration - Summary

**Status:** ✅ Configured and ready to use
**Frequency:** Adjustable via config.js (currently 1 minute)

---

## What We Built

### 1. Configurable Heartbeat Settings

**File:** `config.js`

```javascript
// Heartbeat frequency (how often to ping server)
export const HEARTBEAT_FREQUENCY_MS = 60000; // 60 seconds (1 minute)

// Offline detection threshold
export const HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 5; // Mark offline after 5 min

// Version check behavior
export const HEARTBEAT_VERSION_CHECK_ENABLED = true;
export const HEARTBEAT_AUTO_UPDATE_PROMPT = true;
```

**To change frequency later:**
- Edit `HEARTBEAT_FREQUENCY_MS` in config.js
- Options: 60000 (1 min), 300000 (5 min), 900000 (15 min)
- Redeploy app (users get new config on reload)

---

### 2. HeartbeatService Class

**File:** `js/data/services/heartbeat-service.js`

**Features:**
- ✅ Uses frequency from config.js (no hardcoded values)
- ✅ Auto-generates device fingerprint (hashed for privacy)
- ✅ Detects device type (Fire TV, Android TV, Browser)
- ✅ Checks for version updates
- ✅ Shows update prompt automatically
- ✅ Handles connection failures gracefully
- ✅ Can update frequency at runtime

---

## Database Impact

### Current Configuration (1 minute)

**With 10 beta users:**
- Updates per day: ~14,400
- Database impact: Minimal (~1-2 MB/day)
- Supabase tier: Free tier handles it easily

**When to adjust:**
- Keep 1 minute for beta (< 100 users)
- Switch to 5 minutes at 100+ users (80% fewer writes)
- Switch to 15 minutes at 10,000+ users (cost optimization)

---

## How Database Writes Work

**Important:** Heartbeat does NOT create new rows each minute!

```sql
-- What actually happens:
-- Just UPDATES one existing row per user

UPDATE dashboard_heartbeats
SET
  last_heartbeat_at = NOW(),           -- Update timestamp
  is_online = true,                    -- Set online
  total_heartbeats = total_heartbeats + 1,  -- Increment counter
  updated_at = NOW()
WHERE auth_user_id = 'user-id';        -- Same row every time
```

**Result:**
- Only 1 row per user in `dashboard_heartbeats` table
- Gets updated frequently, but doesn't grow
- Very cheap operation (just index lookup + update)

---

## Supabase Tier Guidance

### Free Tier ($0/month)
- **Perfect for:** Beta with < 50 users
- **Database:** 500 MB
- **Writes/day:** Can handle millions
- **Your setup:** ✅ Works perfectly

### Pro Tier ($25/month)
- **Perfect for:** 100-10,000 users
- **Database:** 8 GB included
- **Upgrade when:** You hit 100+ users OR need more features
- **Your setup:** Future consideration

**Bottom line:** You're good with free tier for now, even with 1-minute heartbeats.

---

## Monitoring & Analytics

### See Who's Online Right Now

```sql
SELECT
  u.email,
  dh.is_online,
  dh.last_heartbeat_at,
  dh.device_type,
  EXTRACT(EPOCH FROM (NOW() - dh.last_heartbeat_at)) / 60 AS minutes_ago
FROM dashboard_heartbeats dh
JOIN auth.users u ON u.id = dh.auth_user_id
WHERE dh.is_online = true
ORDER BY dh.last_heartbeat_at DESC;
```

### Check Total Heartbeats (Engagement Metric)

```sql
SELECT
  u.email,
  dh.total_heartbeats,
  dh.session_started_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - dh.session_started_at)) / 3600, 1) AS hours_online
FROM dashboard_heartbeats dh
JOIN auth.users u ON u.id = dh.auth_user_id
ORDER BY dh.total_heartbeats DESC;
```

---

## Quick Reference: Change Frequency

### To change from 1 min → 5 min:

**1. Edit config.js:**
```javascript
export const HEARTBEAT_FREQUENCY_MS = 300000; // 5 minutes
export const HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 15; // 3x frequency
```

**2. Update database function:**
```sql
CREATE OR REPLACE FUNCTION check_dashboard_online_status()
RETURNS void AS $$
BEGIN
  UPDATE dashboard_heartbeats
  SET is_online = false
  WHERE is_online = true
    AND last_heartbeat_at < NOW() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql;
```

**3. Redeploy app**

That's it! No edge function changes needed.

---

## Next Steps

1. **Now:** Deploy with 1-minute heartbeat (perfect for beta)
2. **At 100 users:** Consider switching to 5 minutes
3. **Monitor:** Watch Supabase usage dashboard
4. **Adjust:** Change config.js if needed

---

## Files Created/Updated

### New Files:
- ✅ `js/data/services/heartbeat-service.js` - Heartbeat implementation
- ✅ `supabase/functions/heartbeat/index.ts` - Edge function
- ✅ `.reference/Heartbeat_Configuration_Guide.md` - Full guide

### Updated Files:
- ✅ `config.js` - Added heartbeat configuration section

---

## Documentation

- **Full guide:** [Heartbeat_Configuration_Guide.md](Heartbeat_Configuration_Guide.md)
- **Deployment:** [Phase3_Edge_Functions_Deployment.md](Phase3_Edge_Functions_Deployment.md)
- **Architecture:** [Database_schema_v2.md](Database_schema_v2.md)

---

**You're all set!** Heartbeat frequency is configurable and ready to scale. Start with 1 minute for beta, adjust as needed when you grow. 🚀
