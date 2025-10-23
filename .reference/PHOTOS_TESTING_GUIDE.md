# Photos Migration Testing Guide

**Purpose:** Verify that the migrated photos module works correctly after migration from `.legacy/`

---

## Prerequisites

1. ✅ Migration complete (all files moved)
2. ✅ Import paths updated
3. ✅ JavaScript syntax valid
4. Start local dev server: `python -m http.server 8000`
5. Open: `http://localhost:8000`

---

## Test Plan

### Test 1: Modal Opens
**Path:** Dashboard → Settings → Photos

**Steps:**
1. Open app in browser
2. Navigate to Settings
3. Click "Photos"

**Expected:**
- Photos modal opens in iframe
- Modal shows header with "Photos" title
- Back button shows "‹ Settings"
- Close button (×) visible

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: ___________

---

### Test 2: Stats Display
**Path:** Photos modal main screen

**Steps:**
1. Open Photos modal
2. Check stats box

**Expected:**
- Photo count displays (number)
- Storage usage displays (XX MB / XX GB)
- Progress bar shows usage percentage

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: ___________

---

### Test 3: File Upload (Desktop/Mobile)
**Path:** Photos modal → Add Photos

**Steps:**
1. Click "Add Photos"
2. Select 1-3 image files
3. Confirm selection

**Expected:**
- File picker opens
- Upload progress modal appears
- Progress bar fills
- Success message shows
- Photo count increases
- Modal refreshes with new stats

**Actual:**
- [ ] Pass / [ ] Fail
- Files uploaded: ___________
- Notes: ___________

---

### Test 4: QR Code (TV Mode)
**Path:** Photos modal → Add Photos (TV platform)

**Steps:**
1. Open app with `?platform=tv` parameter
2. Navigate to Photos
3. Click "Add Photos"

**Expected:**
- QR code modal displays
- URL shown for mobile upload
- "Close" button present

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: ___________

---

### Test 5: Delete All Photos
**Path:** Photos modal → Delete Photos → Delete All Photos

**Steps:**
1. Open Photos modal (with existing photos)
2. Click "Delete Photos"
3. Click "Delete All Photos"
4. Confirm in confirmation modal

**Expected:**
- Confirmation modal appears
- Message warns about irreversibility
- After confirm: progress shows
- All photos deleted
- Photo count = 0
- Storage usage = 0 MB

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: ___________

---

### Test 6: Transition Settings
**Path:** Photos modal → Photo Transition Time

**Steps:**
1. Click "Photo Transition Time"
2. Select "10 seconds"
3. Navigate back
4. Reopen Photos modal

**Expected:**
- Transition screen shows options
- Selected option has checkmark
- Main screen shows "10 seconds"
- Setting persists after modal close/reopen

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: ___________

---

### Test 7: Theme Support
**Path:** Settings → Display → Theme

**Steps:**
1. Open Photos modal (light theme)
2. Note appearance
3. Close modal
4. Change to dark theme
5. Reopen Photos modal

**Expected:**
- Light theme: white/gray background
- Dark theme: dark background
- All text readable in both themes
- No visual glitches

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: ___________

---

### Test 8: Navigation (D-pad/Keyboard)
**Path:** Photos modal

**Steps:**
1. Open Photos modal
2. Press arrow down key
3. Press arrow up key
4. Press Enter on focused item
5. Press Escape

**Expected:**
- Arrow down: focus moves to next item
- Arrow up: focus moves to previous item
- Enter: activates focused item
- Escape: closes modal (returns to Settings)
- Orange highlight on focused item

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: ___________

---

### Test 9: Widget Refresh After Upload
**Path:** Dashboard → Photos widget

**Steps:**
1. Note current photos in widget
2. Open Settings → Photos
3. Upload new photos
4. Close Photos modal
5. Return to Dashboard

**Expected:**
- Photos widget shows new photos
- Widget cycles through all photos including new ones
- No duplicate photos displayed

**Actual:**
- [ ] Pass / [ ] Fail
- Notes: ___________

---

### Test 10: Console Errors
**Path:** Browser DevTools → Console

**Steps:**
1. Open DevTools (F12)
2. Go to Console tab
3. Perform all above tests
4. Watch for errors

**Expected:**
- No JavaScript errors
- No 404 errors for missing files
- Logger messages show (debug/info level)
- No warnings about legacy code

**Actual:**
- [ ] Pass / [ ] Fail
- Errors found: ___________

---

## Common Issues & Fixes

### Issue: Modal doesn't open
**Symptoms:** Click "Photos" but nothing happens

**Check:**
1. Console errors?
2. `window.photosSettingsManager` exists? (type in console)
3. Photo service ready? `window.photoDataService.isReady()` (type in console)

**Fix:**
- Ensure service initialization completed
- Check import paths are correct

---

### Issue: 404 errors for HTML/CSS
**Symptoms:** Modal opens but blank, console shows 404

**Check:**
1. DevTools Network tab
2. Which file is 404?

**Fix:**
- Verify iframe src path: `/js/modules/Settings/photos/photos-settings.html`
- Check HTML file exists at that location

---

### Issue: Upload fails
**Symptoms:** Upload starts but errors

**Check:**
1. JWT token valid? `await window.edgeClient.getSupabaseJWT()` (console)
2. Edge function reachable?
3. Storage bucket permissions?

**Fix:**
- Refresh JWT: `await window.edgeClient.refreshJWT()`
- Check Supabase dashboard for errors

---

### Issue: Theme doesn't apply
**Symptoms:** Modal stays light even in dark theme

**Check:**
1. Body class: `document.body.classList` (console)
2. CSS loaded? (DevTools → Network → CSS)

**Fix:**
- Verify CSS import in HTML: `/css/core/themes.css`
- Check theme classes match in CSS

---

## Success Criteria

✅ **All 10 tests pass**
✅ **No console errors**
✅ **Photos functionality identical to before migration**

---

## If Tests Fail

### Minor Issues (1-2 tests fail)
- Document the issue
- Check console for specific error
- Refer to Common Issues section
- Fix and retest

### Major Issues (3+ tests fail)
- Consider rollback (see PHOTOS_MIGRATION_COMPLETE.md)
- Review import paths carefully
- Check file contents weren't corrupted during migration
- Verify all files copied correctly

---

## Sign-off

**Tester:** ___________
**Date:** ___________
**Overall Status:** [ ] Pass / [ ] Fail
**Notes:**
___________
___________
___________
