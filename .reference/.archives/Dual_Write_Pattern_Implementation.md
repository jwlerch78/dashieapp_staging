# Dual-Write Abstraction Pattern Implementation

## Overview
Implemented a **dual-write/dual-read abstraction pattern** for TokenStore to automatically handle persistence to both localStorage and Supabase database without requiring manual synchronization throughout the codebase.

**Created:** 2025-10-17
**Status:** Implemented, Pending Testing

---

## The Problem We Solved

### Before (Manual Dual-Write):
```javascript
// Every save location had to manually write to both places:
localStorage.setItem('tokens', JSON.stringify(tokens));
await edgeFunction.storeTokens(tokens); // Easy to forget!

// Every load location had to check both places:
let tokens = localStorage.getItem('tokens');
if (!tokens) {
    tokens = await edgeFunction.loadTokens(); // Inconsistent logic
}
```

**Issues:**
- Easy to forget one location
- Inconsistent sync logic scattered everywhere
- No fallback strategy when Supabase unavailable
- Debugging nightmare when sources diverge

### After (Abstracted Dual-Write):
```javascript
// Just one call - handles everything automatically:
await tokenStore.save();  // Writes to BOTH localStorage AND Supabase

await tokenStore.loadTokens();  // Reads from Supabase, falls back to localStorage
```

**Benefits:**
- ✅ Impossible to forget to sync
- ✅ Consistent sync logic in one place
- ✅ Automatic fallback when offline
- ✅ Easy to test and debug

---

## Architecture

### Storage Strategy

```
┌─────────────────────────────────────────────────────────┐
│  Application Code                                       │
│  ├── tokenStore.save()          (ONE METHOD CALL)      │
│  └── tokenStore.loadTokens()    (ONE METHOD CALL)      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  TokenStore (Abstraction Layer)                         │
│  ├── Dual-Write on Save:                               │
│  │   ├── localStorage (fast, always succeeds)          │
│  │   └── Supabase (persistent, may fail gracefully)    │
│  └── Dual-Read on Load:                                │
│      ├── Try Supabase first (authoritative)            │
│      └── Fallback to localStorage if unavailable       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Storage Backends                                       │
│  ├── localStorage: dashie-auth-tokens                  │
│  │   └── Fast local cache, survives page refresh       │
│  └── Supabase: user_auth_tokens table                  │
│      └── Persistent, syncs across devices              │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Dual-Write (Save Operation)

**File:** `js/data/auth/token-store.js`

```javascript
async save() {
    // WRITE 1: Save to localStorage (fast, always succeeds)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tokens));

    // WRITE 2: Save to Supabase (authoritative, may fail)
    if (this.edgeClient) {
        try {
            await this.syncToSupabase();
        } catch (supabaseError) {
            // Don't fail the save if Supabase is down
            // Tokens are in localStorage, will sync on next successful connection
            logger.warn('Failed to sync tokens to Supabase (will retry later)', supabaseError);
        }
    }
}

async syncToSupabase() {
    const promises = [];
    for (const [provider, providerAccounts] of Object.entries(this.tokens)) {
        for (const [accountType, tokenData] of Object.entries(providerAccounts)) {
            promises.push(this.edgeClient.storeTokens(provider, accountType, tokenData));
        }
    }
    await Promise.all(promises);
}
```

**Behavior:**
- localStorage write **always succeeds** (optimistic)
- Supabase write **may fail gracefully** (no error thrown)
- Next successful save will re-sync any missed updates

---

### 2. Dual-Read (Load Operation)

```javascript
async loadTokens() {
    let loadedFromSupabase = false;

    // STRATEGY 1: Try loading from Supabase (authoritative)
    if (this.edgeClient) {
        try {
            const supabaseTokens = await this.loadFromSupabase();
            if (supabaseTokens && Object.keys(supabaseTokens).length > 0) {
                this.tokens = supabaseTokens;
                loadedFromSupabase = true;

                // Sync to localStorage for offline access
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tokens));
            }
        } catch (supabaseError) {
            logger.warn('Failed to load from Supabase, falling back to localStorage');
        }
    }

    // STRATEGY 2: Fallback to localStorage if Supabase unavailable
    if (!loadedFromSupabase) {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            this.tokens = JSON.parse(stored);
        } else {
            this.tokens = {};
        }
    }
}
```

**Behavior:**
- Always tries Supabase first (most up-to-date)
- Falls back to localStorage if Supabase unavailable
- Updates localStorage with Supabase data when available (keeps cache fresh)

---

## Supporting Components

### EdgeClient (js/data/auth/edge-client.js)

Wrapper for edge function calls with authentication:

```javascript
const edgeClient = new EdgeClient(jwtToken);

// Store tokens to Supabase
await edgeClient.storeTokens('google', 'primary', tokenData);

// Load tokens from Supabase
const tokens = await edgeClient.loadTokens();

// Get valid (auto-refreshed) token
const validToken = await edgeClient.getValidToken('google', 'primary');

// Remove account
await edgeClient.removeAccount('google', 'primary');

// Settings operations (future)
await edgeClient.saveSettings(settings);
const settings = await edgeClient.loadSettings();
```

**Methods:**
- `storeTokens(provider, accountType, tokenData)` - Store single account
- `loadTokens()` - Load all accounts from database
- `getValidToken(provider, accountType)` - Get token with auto-refresh
- `removeAccount(provider, accountType)` - Delete account tokens
- `saveSettings(settings)` - Save settings (future)
- `loadSettings()` - Load settings (future)

---

## Integration Points

### How TokenStore Gets EdgeClient

**File:** `index.html` or initialization code

```javascript
// During auth initialization:
const edgeClient = new EdgeClient(jwtToken);
await tokenStore.initialize(edgeClient);

// TokenStore now has access to Supabase operations
await tokenStore.save();  // Automatically uses edgeClient
```

**Initialization Flow:**
1. User logs in → Get JWT token
2. Create EdgeClient with JWT
3. Initialize TokenStore with EdgeClient
4. All subsequent saves/loads use dual-write pattern

---

## Error Handling Strategy

### Save Failures

| Scenario | localStorage | Supabase | Result |
|----------|-------------|----------|---------|
| Both succeed | ✅ Written | ✅ Written | Perfect sync |
| Supabase timeout | ✅ Written | ❌ Failed | Saved locally, will retry later |
| Supabase 401 | ✅ Written | ❌ Auth failed | Need to re-authenticate |
| localStorage full | ❌ Throws | ⚠️ Not attempted | Critical error, no save |

### Load Failures

| Scenario | Supabase | localStorage | Result |
|----------|----------|--------------|---------|
| Both available | ✅ Used | ✅ Updated from Supabase | Authoritative source wins |
| Supabase down | ❌ Failed | ✅ Used | Offline mode works |
| Both empty | ❌ No data | ❌ No data | Fresh start, no tokens |
| Supabase newer | ✅ Used | ✅ Overwritten | Sync from server |

---

## Benefits of This Pattern

### 1. **Developer Experience**
- Single method call for save: `await tokenStore.save()`
- No need to remember multiple storage locations
- Consistent behavior everywhere

### 2. **Reliability**
- Automatic fallback when Supabase unavailable
- Optimistic localStorage writes never block
- Graceful degradation in offline mode

### 3. **Data Integrity**
- Supabase is authoritative (prevents divergence)
- localStorage updated from Supabase on load (keeps cache fresh)
- All accounts stored/loaded atomically

### 4. **Testability**
- All sync logic in one place (TokenStore)
- Mock EdgeClient for testing
- Clear separation of concerns

### 5. **Future-Proof**
- Easy to add new storage backends
- Can add retry queues for failed Supabase writes
- Can add conflict resolution if needed

---

## Future Enhancements

### 1. Retry Queue for Failed Writes
```javascript
// If Supabase write fails, queue for retry
if (supabaseError) {
    this.retryQueue.push({ operation: 'save', data: this.tokens });
    // Retry on next successful connection
}
```

### 2. Conflict Resolution
```javascript
// If localStorage and Supabase differ, use most recent
const localUpdated = new Date(localTokens.updated_at);
const remoteUpdated = new Date(supabaseTokens.updated_at);
this.tokens = localUpdated > remoteUpdated ? localTokens : supabaseTokens;
```

### 3. Settings Manager
Apply the same pattern to settings:
```javascript
await settingsManager.save();  // Writes to both localStorage and Supabase
await settingsManager.load();  // Reads from Supabase, falls back to localStorage
```

---

## Testing Checklist

### TokenStore Tests
- [ ] Save writes to both localStorage and Supabase
- [ ] Save succeeds if Supabase unavailable (localStorage only)
- [ ] Load prefers Supabase over localStorage
- [ ] Load falls back to localStorage if Supabase unavailable
- [ ] Load syncs localStorage from Supabase when available

### EdgeClient Tests
- [ ] storeTokens() calls edge function with correct payload
- [ ] loadTokens() reconstructs token structure correctly
- [ ] getValidToken() returns valid token
- [ ] getValidToken() refreshes expired tokens automatically
- [ ] removeAccount() deletes account from database

### Integration Tests
- [ ] Login → Save tokens → Tokens in both locations
- [ ] Refresh page → Load tokens → Loaded from Supabase
- [ ] Supabase down → Load tokens → Loaded from localStorage
- [ ] Clear localStorage → Load tokens → Loaded from Supabase

---

## Files Modified/Created

### Created:
1. `js/data/auth/edge-client.js` - Edge function wrapper
2. `.reference/Dual_Write_Pattern_Implementation.md` - This document

### Modified:
1. `js/data/auth/token-store.js` - Implemented dual-write pattern
   - Lines 64-143: loadTokens() with dual-read
   - Lines 215-274: save() with dual-write and syncToSupabase()

---

## Next Steps

1. **Update initialization code** to create EdgeClient and pass to TokenStore
2. **Test the pattern** with actual login flow
3. **Apply same pattern** to SettingsManager (future)
4. **Implement token refresh** in GoogleAPIClient using EdgeClient.getValidToken()
5. **Add retry queue** for failed Supabase writes (enhancement)

---

## Conclusion

The dual-write abstraction pattern provides a **single source of truth** (Supabase) with **fast local caching** (localStorage) and **automatic synchronization**. Developers never need to think about where data is stored - just call `save()` or `load()` and the pattern handles everything.

This makes the codebase more maintainable, reliable, and easier to debug.
