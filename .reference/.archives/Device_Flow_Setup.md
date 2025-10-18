# Device Flow OAuth - Fire TV Setup Guide

**Date:** 2025-10-17
**Status:** Ready for testing ✅

---

## What Was Built

Added **Device Flow OAuth** support for Fire TV and other limited-input devices. The app now automatically detects the platform and uses the appropriate OAuth flow:

- **Desktop/Mobile:** Web OAuth (redirect-based)
- **Fire TV/Android TV:** Device Flow (QR code + user code)

---

## Files Created/Modified

### New File:
```
js/data/auth/providers/device-flow.js    [Complete Device Flow implementation]
```

### Modified Files:
```
index.html                                [Platform detection + device flow integration]
```

---

## How It Works

### Platform Detection:
```javascript
const platform = getPlatformDetector();
const isFireTV = platform.getPlatformDescription().includes('Fire TV');

if (isFireTV) {
  // Use Device Flow
  deviceFlowProvider = new DeviceFlowProvider();
} else {
  // Use Web OAuth
  webOAuthProvider = new WebOAuthProvider();
}
```

### Device Flow UI:
When on Fire TV, clicking "Sign in with Google" shows:
1. **QR Code** - Scan with phone
2. **URL** - google.com/device
3. **User Code** - Enter on device (e.g., "ABCD-EFGH")
4. **Countdown Timer** - Code expires in X minutes
5. **Cancel Button** - D-pad navigable

### Token Storage:
After successful authentication, tokens are stored in TokenStore just like web OAuth:
```javascript
await tokenStore.storeAccountTokens('google', 'primary', {
  access_token: '...',
  refresh_token: '...',
  expires_at: '...',
  email: '...',
  display_name: '...'
});
```

---

## Testing on Fire TV

### Steps to Test:

1. **Deploy to Fire TV**:
   ```bash
   # Copy files to Fire TV or use your existing deployment method
   ```

2. **Open app on Fire TV**

3. **Click "Sign in with Google"**:
   - Device Flow UI should appear
   - QR code displayed
   - User code shown (e.g., "ABCD-EFGH")

4. **On your phone/computer**:
   - Go to **google.com/device**
   - Enter the user code
   - Approve the permissions

5. **Back on Fire TV**:
   - Should automatically detect approval
   - Store tokens
   - Show "Welcome, [Your Name]!"
   - Fade to dashboard

### What to Watch For:

✅ **Success Indicators:**
- QR code renders correctly
- User code displayed in large orange text
- Countdown timer shows minutes remaining
- After approval, tokens stored successfully
- Dashboard loads after authentication

❌ **Potential Issues:**
- QR code fails to load (CDN blocked?)
- User code incorrect format
- Token polling timeout (15+ minutes)
- Platform detection fails (shows web OAuth instead)

---

## Testing Token Persistence Over Time

Since you want to test token refresh naturally:

### Day 1 (Now):
- Sign in on Fire TV using Device Flow
- Verify dashboard loads
- Check console: tokens should be stored

### Day 2-7:
- Open app daily
- Should automatically restore session (no login needed)
- Tokens valid for ~1 hour, but refresh_token lasts longer

### When Tokens Expire:
- Access token expires after ~1 hour
- App will try to use expired token
- **Currently**: Will throw error "Token expired. Refresh not implemented yet."
- **Future**: Will use refresh_token to get new access_token

This natural testing will reveal:
1. How often tokens need refreshing in real usage
2. When refresh logic is actually needed
3. User experience when tokens expire

---

## Device Flow vs Web OAuth Comparison

| Feature | Web OAuth | Device Flow |
|---------|-----------|-------------|
| Platform | Desktop/Mobile | Fire TV / Limited Input |
| User Flow | Redirect → Approve → Redirect Back | Show Code → Approve on Phone → Auto-detect |
| UI | Browser redirect | Full-screen modal with QR |
| Input | Mouse/Touch | D-pad navigation |
| Cancel | Browser back button | On-screen cancel button |
| Token Storage | TokenStore | TokenStore (same) |
| Refresh Support | Yes | Yes |

---

## Architecture

```
User on Fire TV
     │
     ├─> index.html loads
     │
     ├─> Platform detection
     │   └─> Detects Fire TV
     │
     ├─> DeviceFlowProvider initialized
     │
     ├─> User clicks "Sign in"
     │
     ├─> Device Flow UI shown
     │   ├─> QR code
     │   ├─> User code
     │   └─> google.com/device
     │
     ├─> User approves on phone/computer
     │
     ├─> Polling detects approval
     │
     ├─> Tokens stored in TokenStore
     │
     └─> Dashboard loads
```

---

## Code Highlights

### Device Flow Provider Structure:
```javascript
export class DeviceFlowProvider {
  constructor() {
    this.config = {
      client_id: '...',  // Device flow client ID
      device_code_endpoint: 'https://oauth2.googleapis.com/device/code',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      scope: '...'
    };
  }

  async signIn() {
    // 1. Get device code + user code
    const deviceData = await this.getDeviceCode();

    // 2. Show UI with QR code + user code
    // 3. Poll Google for token approval
    const result = await this.showUIAndPoll(deviceData);

    return result; // { success, user, tokens }
  }
}
```

### Platform-Aware Sign-In:
```javascript
document.getElementById('login-button').onclick = async () => {
  if (isFireTV) {
    // Device Flow: Show QR code + user code
    const result = await googleAccountAuth.signIn({ useDeviceFlow: true });
    // Store tokens after approval
  } else {
    // Web OAuth: Redirect to Google
    await googleAccountAuth.signIn();
  }
};
```

---

## Next Steps

1. **Test on Fire TV**:
   - Deploy and test device flow
   - Verify QR code renders
   - Test with real Google approval

2. **Monitor Token Expiration**:
   - Use app daily
   - Note when tokens expire
   - Document actual refresh timing needs

3. **Implement Token Refresh** (Future):
   - Use refresh_token when access_token expires
   - Implement in GoogleAPIClient.getAccessToken()
   - Test with expired tokens

---

## Known Limitations

1. **No Token Refresh Yet**:
   - Tokens expire after ~1 hour
   - Currently throws error on expiry
   - Need to implement refresh logic

2. **QR Code Dependency**:
   - Loads QR library from CDN
   - If CDN blocked, fallback text shown
   - Consider bundling library locally

3. **Single Account Only**:
   - Device flow only supports primary account
   - Multi-account would need multiple device codes

---

## Troubleshooting

### Issue: "Platform detection shows web OAuth on Fire TV"
**Fix**: Check platform detector logic, ensure Fire TV user agent is recognized

### Issue: "QR code doesn't render"
**Fix**: Check CDN access, try loading https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js manually

### Issue: "User code format incorrect"
**Fix**: Google returns format like "ABCD-EFGH", ensure it's displayed uppercase

### Issue: "Polling timeout"
**Fix**: Default timeout is expires_in (usually 15 min), increase if needed

### Issue: "Tokens not stored after approval"
**Fix**: Check console for errors in token storage, verify TokenStore is initialized

---

*Generated: 2025-10-17*
*Ready for Fire TV testing!* 🔥📺
