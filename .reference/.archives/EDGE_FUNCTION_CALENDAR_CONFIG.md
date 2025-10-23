# Edge Function Updates for Calendar Config

## Overview

The calendar settings have been moved from the generic `settings` storage to the dedicated `user_calendar_config` table as defined in Database_schema_v2.md.

## Required Edge Function Changes

Your Supabase Edge Function needs to handle two new operations:

### 1. `save_calendar_config`

**Request:**
```json
{
  "operation": "save_calendar_config",
  "active_calendar_ids": [
    "primary-user@gmail.com",
    "primary-shared@gmail.com",
    "account2-work@company.com"
  ]
}
```

**Edge Function Handler:**
```javascript
if (operation === 'save_calendar_config') {
  const { active_calendar_ids } = requestBody;

  // Upsert to user_calendar_config table
  const { data, error } = await supabase
    .from('user_calendar_config')
    .upsert({
      auth_user_id: authUserId,
      active_calendar_ids: active_calendar_ids,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'auth_user_id'
    });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Calendar config saved'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 2. `load_calendar_config`

**Request:**
```json
{
  "operation": "load_calendar_config"
}
```

**Edge Function Handler:**
```javascript
if (operation === 'load_calendar_config') {
  // Load from user_calendar_config table
  const { data, error } = await supabase
    .from('user_calendar_config')
    .select('active_calendar_ids')
    .eq('auth_user_id', authUserId)
    .single();

  if (error) {
    // If no record found, return empty array (first time user)
    if (error.code === 'PGRST116') {
      return new Response(JSON.stringify({
        active_calendar_ids: []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    active_calendar_ids: data.active_calendar_ids || []
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Database Table Structure

Make sure the `user_calendar_config` table exists:

```sql
CREATE TABLE IF NOT EXISTS user_calendar_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active_calendar_ids TEXT[] DEFAULT '{}',
  accounts JSONB DEFAULT '{}',
  calendar_account_map JSONB DEFAULT '{}',
  calendar_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_calendar_config_auth_user_id
ON user_calendar_config(auth_user_id);

-- RLS policy - users can only access their own config
ALTER TABLE user_calendar_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own calendar config"
ON user_calendar_config
FOR ALL
USING (auth_user_id = auth.uid());
```

## Testing

After deploying the edge function changes:

1. **Test Save:**
   - Open calendar settings
   - Toggle a few calendars
   - Check console for "Successfully saved calendar config"
   - Verify in Supabase: `SELECT * FROM user_calendar_config WHERE auth_user_id = '<your-user-id>'`

2. **Test Load:**
   - Reload the page
   - Calendar selections should persist
   - Check console for "Successfully loaded calendar config"

3. **Test First-Time User:**
   - Create a new test user
   - Open calendar settings
   - Should load empty array (no error)
   - Select calendars
   - Should create new record in user_calendar_config

## Migration Notes

**Existing Users:** If you have users with calendar settings in the old `settings.calendar.activeCalendarIds` location, you may want to migrate them:

```sql
-- One-time migration script
INSERT INTO user_calendar_config (auth_user_id, active_calendar_ids, updated_at)
SELECT
  auth_user_id,
  (settings->'calendar'->'activeCalendarIds')::TEXT[] as active_calendar_ids,
  NOW()
FROM user_settings -- or wherever old settings are stored
WHERE settings->'calendar'->'activeCalendarIds' IS NOT NULL
ON CONFLICT (auth_user_id) DO NOTHING;
```

## What Changed in the Client

**Before:**
```javascript
// Saved to generic settings
await edgeClient.saveSettings({
  calendar: {
    activeCalendarIds: [...]
  }
});
```

**After:**
```javascript
// Saves to user_calendar_config table
await edgeClient.saveCalendarConfig([...]);
```

**Benefits:**
- ✅ Dedicated table for calendar data
- ✅ Better performance (no JSON parsing)
- ✅ Easier to query and manage
- ✅ Follows database schema v2.0
- ✅ Supports future calendar features (accounts metadata, calendar_settings, etc.)
