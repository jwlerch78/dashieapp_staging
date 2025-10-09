# Account Deletion - Quick Test Guide

## 🧪 Testing the Delete Account Feature

### Prerequisites
✅ Edge function deployed to Supabase  
✅ Test account created (DO NOT use your main account!)  
✅ Some test data in the account (photos, settings, etc.)

---

## Test 1: Navigation & UI

**Steps:**
1. Open Settings
2. Navigate to System
3. Click "Delete Account" (red text at bottom)

**Expected Results:**
- ✅ Delete Account screen appears
- ✅ Warning header is red with ⚠️ icon
- ✅ Body text explains what will be deleted
- ✅ Two buttons visible: "Cancel" and "Delete My Account"
- ✅ Delete button has red text

---

## Test 2: D-pad Navigation (Desktop/TV)

**Steps:**
1. Navigate to Delete Account screen
2. Use Arrow Down to focus "Cancel" button
3. Use Arrow Down to focus "Delete My Account" button

**Expected Results:**
- ✅ Cancel button shows blue outline when focused
- ✅ Delete button shows RED outline when focused
- ✅ Can navigate between both buttons
- ✅ Pressing Enter on focused button triggers action

---

## Test 3: Cancel Button

**Steps:**
1. Navigate to Delete Account screen
2. Click or press Enter on "Cancel" button

**Expected Results:**
- ✅ Returns to System screen
- ✅ No modal appears
- ✅ No deletion occurs

---

## Test 4: Confirmation Modal

**Steps:**
1. Navigate to Delete Account screen
2. Click or press Enter on "Delete My Account" button

**Expected Results:**
- ✅ Modal appears with dark overlay
- ✅ Modal shows warning header with ⚠️
- ✅ Modal lists all data that will be deleted
- ✅ Two buttons: "Cancel" and "Delete Account"
- ✅ Cannot click outside modal to close it

---

## Test 5: Modal Cancel

**Steps:**
1. Open confirmation modal
2. Click "Cancel" button

**Expected Results:**
- ✅ Modal closes
- ✅ Still on Delete Account screen
- ✅ No deletion occurs

**Alternative:**
- Press Escape key
- ✅ Modal should close

---

## Test 6: Full Deletion (⚠️ USE TEST ACCOUNT)

**Steps:**
1. Open confirmation modal
2. Click "Delete Account" button

**Expected Results:**
- ✅ Button text changes to "Deleting..."
- ✅ Button becomes disabled
- ✅ Console shows deletion progress:
  - 🗑️ Starting account deletion process...
  - 🗑️ Database records deleted
  - 🗑️ Storage files deleted
  - 🗑️ Signing out user...
  - 🗑️ ✅ Account deletion process complete
- ✅ Settings modal closes
- ✅ User is signed out
- ✅ Sign-in screen appears

---

## Test 7: Verify Data Deletion

**After Test 6, check:**

### Database Check (Supabase Dashboard)
- ✅ No records in `user_photos` for test user
- ✅ No records in `user_storage_quota` for test user
- ✅ No records in `user_settings` for test user

### Storage Check (Supabase Dashboard)
- ✅ No files in `photos` bucket for test user
- ✅ User's folder is empty or deleted

### Browser Check (DevTools → Application → Local Storage)
- ✅ No `dashie-*` keys
- ✅ No `user-*` keys
- ✅ Clean local storage

---

## Test 8: Error Handling

**Simulate edge function failure:**
1. Temporarily rename edge function in Supabase
2. Try to delete account

**Expected Results:**
- ✅ Error message displayed to user
- ✅ Button re-enabled with original text
- ✅ User can try again or cancel
- ✅ Console shows error details

---

## 🔍 Console Monitoring

**Look for these log messages:**

### Successful Flow:
```
🗑️ Delete account button clicked
🗑️ Delete account modal displayed
🗑️ Delete account confirmed in modal
🗑️ Starting account deletion process...
🗑️ Account deletion completed: { tables_cleared: 3, files_deleted: 5 }
🗑️ Signing out user...
🗑️ ✅ Account deletion process complete
```

### If Tables Not in Config:
```
⚠️ TABLES WITH auth_user_id NOT IN DELETION CONFIG:
   - user_calendar_cache
   - user_preferences
💡 Add these to tablesToDelete if they should be deleted
```

---

## 🐛 Common Issues

### Issue: Button click does nothing
**Check:**
- Is event delegation working? (Check console for click logs)
- Is the modal element in the DOM? (Inspect element)

### Issue: Edge function error
**Check:**
- Is edge function deployed?
- Check Supabase Functions logs
- Verify JWT token is valid

### Issue: Storage files not deleted
**Check:**
- Are storage_paths being collected correctly?
- Check Supabase Storage logs
- Verify bucket permissions

### Issue: Not signed out after deletion
**Check:**
- Is `window.dashieAuth.signOut()` available?
- Check console for sign-out errors
- Verify auth service is initialized

---

## ✅ Sign-off Checklist

Before marking this feature as complete:

- [ ] All 8 tests pass
- [ ] No console errors
- [ ] Database confirms deletion
- [ ] Storage confirms deletion
- [ ] Local storage cleared
- [ ] User signed out properly
- [ ] Error handling works
- [ ] D-pad navigation works
- [ ] Touch/click works
- [ ] Modal can be cancelled
- [ ] Escape key works

---

## 📞 Support

If you encounter issues:

1. Check console logs first
2. Check Supabase Function logs
3. Review implementation summary document
4. Check that edge function is deployed

**Edge Function Location:**
`.reference/Supabase Edge Functions/database-operations.js`

**Deployment Command:**
```bash
supabase functions deploy database-operations
```
