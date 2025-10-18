# Add Calendar Config Operations to database-operations Edge Function

## Instructions

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Edge Functions** in the left sidebar
4. Click on **database-operations** function
5. Add the following code to the function

## Step 1: Add Cases to the Switch Statement

Find the switch statement (around line 118-160) and add these TWO new cases before the `default:` case:

```javascript
      // Calendar configuration operations
      case 'save_calendar_config':
        result = await handleSaveCalendarConfig(supabase, userId, data);
        break;
      case 'load_calendar_config':
        result = await handleLoadCalendarConfig(supabase, userId);
        break;
      default:
```

## Step 2: Add Handler Functions

Add these TWO handler functions at the END of the file, right before the closing of the file:

```javascript
// ==================== CALENDAR CONFIG OPERATIONS ====================

async function handleSaveCalendarConfig(supabase, userId, data) {
  try {
    const { active_calendar_ids } = data;

    if (!Array.isArray(active_calendar_ids)) {
      throw new Error('active_calendar_ids must be an array');
    }

    console.log(`📅 Saving calendar config for user: ${userId}`, {
      count: active_calendar_ids.length,
      ids: active_calendar_ids
    });

    // Upsert to user_calendar_config table
    const { data: result, error } = await supabase
      .from('user_calendar_config')
      .upsert({
        auth_user_id: userId,
        active_calendar_ids: active_calendar_ids,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'auth_user_id'
      })
      .select();

    if (error) {
      console.error('🚨 Save calendar config failed:', error);
      throw new Error(`Failed to save calendar config: ${error.message}`);
    }

    console.log(`✅ Calendar config saved for user: ${userId}`);

    return {
      message: 'Calendar config saved',
      count: active_calendar_ids.length
    };

  } catch (error) {
    console.error('🚨 handleSaveCalendarConfig error:', error);
    throw error;
  }
}

async function handleLoadCalendarConfig(supabase, userId) {
  try {
    console.log(`📅 Loading calendar config for user: ${userId}`);

    // Load from user_calendar_config table
    const { data, error } = await supabase
      .from('user_calendar_config')
      .select('active_calendar_ids')
      .eq('auth_user_id', userId)
      .single();

    // If no record found, return empty array (first time user)
    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`📅 No calendar config found for user ${userId} (first time), returning empty array`);
        return {
          active_calendar_ids: []
        };
      }

      console.error('🚨 Load calendar config failed:', error);
      throw new Error(`Failed to load calendar config: ${error.message}`);
    }

    const activeCalendarIds = data?.active_calendar_ids || [];

    console.log(`✅ Calendar config loaded for user: ${userId}`, {
      count: activeCalendarIds.length
    });

    return {
      active_calendar_ids: activeCalendarIds
    };

  } catch (error) {
    console.error('🚨 handleLoadCalendarConfig error:', error);
    throw error;
  }
}
```

## Step 3: Save and Deploy

1. Click **Save** in the Supabase dashboard
2. The function will automatically redeploy

## Testing

After deploying, refresh your Dashie app and try selecting a calendar. You should see:
- ✅ Calendars save successfully
- ✅ Primary calendar auto-enabled on first login
- ✅ No more "JWT token required" errors

## What This Does

- `save_calendar_config`: Saves user's active calendar selections to the `user_calendar_config` table
- `load_calendar_config`: Loads user's active calendar selections (returns empty array for new users)

Both operations are authenticated via JWT token and tied to the logged-in user.
