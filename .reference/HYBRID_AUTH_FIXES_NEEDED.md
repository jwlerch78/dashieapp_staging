# Hybrid Auth Fixes Needed

## Issue 1: FireTV Missing User Name and Profile Image

**Problem:** Poll function fetches from wrong table and wrong column

**Current Code** (lines 1082-1114):
```typescript
// Fetch user profile to get name and picture
const { data: profile } = await supabase
  .from('user_profiles')
  .select('display_name, email')
  .eq('user_id', session.user_id)  // ❌ Wrong column name
  .single();

return jsonResponse({
  ...
  user: {
    id: session.user_id,
    email: session.user_email,
    name: profile?.display_name || session.user_email,  // ❌ display_name doesn't exist in user_profiles
    provider: 'google'
    // ❌ Missing picture field!
  }
```

**Fix:** Fetch from `auth.users` table to get `user_metadata`
```typescript
// Fetch auth user to get name and picture from user_metadata
const { data: authUser } = await supabase.auth.admin.getUserById(session.user_id);

return jsonResponse({
  ...
  user: {
    id: session.user_id,
    email: session.user_email,
    name: authUser?.user?.user_metadata?.name || session.user_email,
    picture: authUser?.user?.user_metadata?.picture || null,
    provider: 'google'
  }
```

---

## Issue 2: Auth Screen UI Problems

### 2a. Remove TV Icon
**File:** `auth.html` line 20-22
```html
<div class="device-icon">📺</div>  <!-- ❌ Remove this -->
```

### 2b. Google Sign-In Button Wrong Style
**Problem:** Using default Google button, needs to match main login screen

**Current:** Generic Google Sign-In button with dropdown
**Needed:** Styled button matching main login (with colored G, no dropdown)

### 2c. Remove Help Footer
**File:** `auth.html` lines 59-63
```html
<div class="auth-footer">  <!-- ❌ Remove entire footer -->
  <p class="help-text">
    Having trouble? <a href="https://dashieapp.com/help" target="_blank">Get help</a>
  </p>
</div>
```

---

## Issue 3: Loading Screen After Google Login

**Problem:** OAuth callback has purple gradient background and blue spinner

**File:** `oauth-callback.html` lines 8-56 (inline styles)

**Fix:** Match main login loading screen (black background, orange spinner)

---

## Issue 4: Success/Error Screens

### 4a. Don't Show Auth Code on Success
**Problem:** Success screen shows device code again
**Fix:** Hide device-info section when showing success

### 4b. Auto-Redirect Not Working
**Problem:** Redirect in auth.js isn't triggering
**File:** `auth.js` lines 291-293

**Current:**
```javascript
setTimeout(() => {
  window.location.href = '/';
}, 1500);
```

**Issue:** This code is in the wrong function - it's in the `authorizeDeviceCode` function which runs on phone, not in the success display callback

**Fix:** Move redirect logic to the URL parameter check in `init()` function

---

## Priority Order

1. **Fix FireTV user data** (server-side - needs deployment)
2. **Fix auth screen UI** (client-side - immediate)
3. **Fix loading screen** (client-side - immediate)
4. **Fix success/redirect** (client-side - immediate)
