# FireTV User Data Fix - Server Side

## Issue
When Fire TV polls for device authorization status, it doesn't receive the user's name or profile picture, only the email. This causes the UI to show "logout jwlerch@gmail.com" instead of the user's name with their profile picture.

## Root Cause
The `handlePollDeviceCodeStatus` function (line 1082-1114) tries to fetch user data from the wrong table with the wrong column name:

```typescript
// ❌ CURRENT (WRONG)
const { data: profile } = await supabase
  .from('user_profiles')
  .select('display_name, email')
  .eq('user_id', session.user_id)  // Wrong: should be 'auth_user_id'
  .single();

// Returns:
user: {
  id: session.user_id,
  email: session.user_email,
  name: profile?.display_name || session.user_email,  // display_name doesn't exist in user_profiles
  provider: 'google'
  // Missing: picture field!
}
```

The user's name and picture are actually stored in Supabase's `auth.users` table in `user_metadata`, not in `user_profiles`.

## Fix

**File:** `supabase/functions/jwt-auth/index.ts`
**Function:** `handlePollDeviceCodeStatus`
**Lines:** ~1082-1114

Replace the profile fetch and user return with:

```typescript
// Authorized! Generate Fire TV JWT
if (session.status === 'authorized') {
  console.log(`✅ Device authorized: ${session.user_email}`);

  // Fetch auth user to get name and picture from user_metadata
  const { data: authUserData, error: authError } = await supabase.auth.admin.getUserById(
    session.user_id
  );

  const authUser = authUserData?.user;
  const userName = authUser?.user_metadata?.name || session.user_email;
  const userPicture = authUser?.user_metadata?.picture || null;

  // Generate Fire TV JWT (unique for this device)
  const firetvJWT = await generateSupabaseJWT(
    session.user_id,
    session.user_email,
    {
      device_type: session.device_type || 'firetv',
      device_id: `firetv-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      session_id: `sess-firetv-${Date.now()}`
    }
  );

  // Delete session (we're done with it!)
  await supabase
    .from('device_auth_sessions')
    .delete()
    .eq('device_code', device_code);

  return jsonResponse({
    success: true,
    status: 'authorized',
    jwtToken: firetvJWT,
    user: {
      id: session.user_id,
      email: session.user_email,
      name: userName,
      picture: userPicture,
      provider: 'google'
    }
  }, 200);
}
```

## Changes Summary

1. **Removed:** Query to `user_profiles` table (doesn't have the data we need)
2. **Added:** Fetch from `auth.users` using `supabase.auth.admin.getUserById()`
3. **Added:** Extract `name` from `user_metadata.name`
4. **Added:** Extract `picture` from `user_metadata.picture`
5. **Added:** Include `picture` field in returned user object

## Expected Result

After this fix and deployment, Fire TV will display:
- ✅ User's full name instead of email
- ✅ User's Google profile picture
- ✅ Proper "Logout [Name]" text

## Deployment

```bash
npx supabase functions deploy jwt-auth --project-ref cwglbtosingboqepsmjk
```

## Testing

1. Clear Fire TV app data/cache
2. Start new device auth flow
3. Scan QR code and authenticate on phone
4. Fire TV should now show user's name and picture in the UI
