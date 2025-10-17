# Heartbeat Configuration Guide

**Quick Reference:** How to adjust heartbeat frequency based on scale and Supabase tier

---

## Current Configuration

**Location:** `config.js`

```javascript
// Heartbeat frequency (how often to ping server with status)
export const HEARTBEAT_FREQUENCY_MS = 60000; // 60 seconds (1 minute)

// Offline detection threshold
export const HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 5; // Mark offline after 5 min
```

---

## How to Change Frequency

### Option 1: Quick Change (config.js)

Just edit the value in `config.js`:

```javascript
// 1 minute (current - beta/low traffic)
export const HEARTBEAT_FREQUENCY_MS = 60000;

// 5 minutes (recommended for 100+ users)
export const HEARTBEAT_FREQUENCY_MS = 300000;

// 15 minutes (high traffic / cost optimization)
export const HEARTBEAT_FREQUENCY_MS = 900000;
```

**Then adjust offline threshold** (should be 2-3x frequency):

```javascript
// For 1-min heartbeat:
export const HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 5;

// For 5-min heartbeat:
export const HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 15;

// For 15-min heartbeat:
export const HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 30;
```

---

### Option 2: Runtime Change (Advanced)

You can also change frequency at runtime without redeploying:

```javascript
// In browser console or admin panel
import HeartbeatService from './js/data/services/heartbeat-service.js';

// Change to 5 minutes
HeartbeatService.updateFrequency(5 * 60 * 1000);
```

---

## Recommended Settings by Scale

### Beta / Early Launch (< 20 users)
```javascript
HEARTBEAT_FREQUENCY_MS = 60000;  // 1 minute
HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 5;
```

**Database writes/day:** ~14,000 (10 users × 1,440 updates/day)
**Supabase tier:** Free tier (up to 500MB, 2GB egress)
**Cost:** $0

---

### Small Scale (20-100 users)
```javascript
HEARTBEAT_FREQUENCY_MS = 60000;  // 1 minute (keep)
HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 5;
```

**Database writes/day:** ~144,000 (100 users × 1,440 updates/day)
**Supabase tier:** Free tier still works
**Cost:** $0

---

### Medium Scale (100-1,000 users)
```javascript
HEARTBEAT_FREQUENCY_MS = 300000;  // 5 minutes
HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 15;
```

**Database writes/day:** ~288,000 (1,000 users × 288 updates/day)
**Supabase tier:** Pro tier ($25/month)
**Cost:** $25/month
**Why change:** Reduces writes by 80%, still good visibility

---

### Large Scale (1,000-10,000 users)
```javascript
HEARTBEAT_FREQUENCY_MS = 300000;  // 5 minutes
HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 15;
```

**Database writes/day:** ~2.88M (10,000 users × 288 updates/day)
**Supabase tier:** Pro tier with add-ons
**Cost:** $25-100/month (depends on actual usage)

---

### Enterprise Scale (10,000+ users)
```javascript
HEARTBEAT_FREQUENCY_MS = 900000;  // 15 minutes
HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 30;
```

**Database writes/day:** ~960K (10,000 users × 96 updates/day)
**Supabase tier:** Team or Enterprise
**Cost:** $599+/month

---

## Database Impact Comparison

| Frequency | Updates/User/Day | 10 Users | 100 Users | 1,000 Users | 10,000 Users |
|-----------|------------------|----------|-----------|-------------|--------------|
| 1 minute  | 1,440            | 14.4K    | 144K      | 1.44M       | 14.4M        |
| 5 minutes | 288              | 2.9K     | 28.8K     | 288K        | 2.88M        |
| 15 minutes| 96               | 960      | 9.6K      | 96K         | 960K         |

**Notes:**
- Postgres can handle millions of writes/day easily
- Supabase limits are based on total database size + egress, not writes
- Heartbeat updates are very small (~100 bytes each)

---

## Supabase Pricing Tiers

### Free Tier
- **Database:** 500 MB
- **Egress:** 2 GB
- **Perfect for:** Beta (< 50 users)
- **Cost:** $0

### Pro Tier
- **Database:** 8 GB included
- **Egress:** 50 GB
- **Perfect for:** 100-10,000 users
- **Cost:** $25/month

### Team Tier
- **Database:** 8 GB included
- **Egress:** 250 GB
- **Perfect for:** 10,000+ users
- **Cost:** $599/month

**Add-ons available:** Extra storage, compute, etc.

---

## When to Increase Frequency

You might want **more frequent** heartbeats (1 minute) when:
- ✅ Need real-time "who's online" visibility
- ✅ Testing new features and need quick feedback
- ✅ Debugging connection issues
- ✅ Building admin dashboard with live user view
- ✅ Low user count (< 100)

---

## When to Decrease Frequency

You might want **less frequent** heartbeats (5-15 min) when:
- ✅ High user count (1,000+)
- ✅ Approaching Supabase tier limits
- ✅ Optimizing costs
- ✅ Don't need real-time visibility
- ✅ Users have stable connections (not dropping frequently)

---

## Monitoring Your Usage

### Check Current Database Size

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Heartbeat Activity

```sql
-- Count heartbeats by user today
SELECT
  u.email,
  dh.total_heartbeats,
  dh.last_heartbeat_at,
  EXTRACT(EPOCH FROM (NOW() - dh.session_started_at)) / 3600 AS session_hours
FROM dashboard_heartbeats dh
JOIN auth.users u ON u.id = dh.auth_user_id
WHERE dh.last_heartbeat_at > NOW() - INTERVAL '24 hours'
ORDER BY dh.total_heartbeats DESC;
```

### Monitor Supabase Usage

1. Go to Supabase Dashboard → Settings → Usage
2. Check:
   - Database size
   - Egress bandwidth
   - API requests

---

## Recommended Approach

### Start Conservative (What We Built)
```javascript
HEARTBEAT_FREQUENCY_MS = 60000; // 1 minute
```

**Why:**
- ✅ Real-time visibility during beta
- ✅ Good for debugging
- ✅ Free tier handles it easily with < 50 users
- ✅ Can always dial back later

### Scale When Needed

**Trigger to change to 5 minutes:**
- When you have 100+ active users
- OR when approaching 80% of Supabase tier limits
- OR when optimizing costs

**Trigger to change to 15 minutes:**
- When you have 10,000+ active users
- OR when on Team tier and optimizing costs
- OR when users have stable connections

---

## Implementation Checklist

When changing frequency:

### 1. Update config.js
```javascript
export const HEARTBEAT_FREQUENCY_MS = 300000; // 5 minutes
export const HEARTBEAT_OFFLINE_THRESHOLD_MINUTES = 15; // 3x frequency
```

### 2. Update database function
```sql
CREATE OR REPLACE FUNCTION check_dashboard_online_status()
RETURNS void AS $$
BEGIN
  UPDATE dashboard_heartbeats
  SET is_online = false
  WHERE is_online = true
    AND last_heartbeat_at < NOW() - INTERVAL '15 minutes'; -- Match threshold
END;
$$ LANGUAGE plpgsql;
```

### 3. Update scheduled job (if using)
- Adjust cron schedule to run offline check at appropriate interval
- E.g., if heartbeat is 5 min, run offline check every 5 min

### 4. Deploy changes
```bash
# Client code (config.js change)
git add config.js
git commit -m "Update heartbeat frequency to 5 minutes"
git push

# Redeploy app (users get new config on next load/reload)
```

### 5. Monitor
- Watch database size growth
- Check online user counts are still accurate
- Verify offline detection works with new threshold

---

## Testing Different Frequencies

You can test frequency changes locally:

```javascript
// In browser console
import HeartbeatService from './js/data/services/heartbeat-service.js';

// Test 5-minute frequency
HeartbeatService.updateFrequency(5 * 60 * 1000);

// Check it's working
// Wait 5 minutes, check database:
// SELECT last_heartbeat_at FROM dashboard_heartbeats WHERE auth_user_id = 'your-id';

// Restore to 1 minute
HeartbeatService.updateFrequency(60 * 1000);
```

---

## Summary

**Current setup (1 minute heartbeat):**
- ✅ Perfect for beta (< 100 users)
- ✅ Real-time visibility
- ✅ Free Supabase tier handles it
- ✅ Easy to change later via config.js

**When you hit 100+ users:**
- Change to 5 minutes in config.js
- Update offline threshold to 15 minutes
- Reduces database writes by 80%
- Still good visibility (5 min lag acceptable)

**You're good to go with current settings!** 🚀
