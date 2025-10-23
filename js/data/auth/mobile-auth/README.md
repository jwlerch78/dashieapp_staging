# Mobile Auth Pages

This directory contains the mobile authentication pages for Dashie's **Hybrid Device Flow**.

## Purpose

Handles mobile phone authentication when scanning QR codes from Fire TV devices during the device authorization flow.

## Files

- **index.html** - Main authentication page (shows device code, Google Sign-In button)
- **phone-auth-handler.js** - Phone authentication logic (PhoneAuthHandler class)
- **styles.css** - Styles for authentication UI
- **callback.html** - OAuth callback handler for token exchange

## URL Routing

These pages are accessed via thin router files in the project root:

- `/auth.html` → redirects to → `/js/data/auth/mobile-auth/index.html`
- `/oauth-callback.html` → redirects to → `/js/data/auth/mobile-auth/callback.html`

This keeps the public URLs clean while organizing implementation files logically under `js/data/auth/`.

## Flow

1. **Fire TV** displays QR code pointing to: `dashieapp.com/auth?code=XXXX&type=firetv`
2. **User scans** QR code with phone → lands on `index.html`
3. **User signs in** with Google → triggers OAuth flow
4. **OAuth redirects** to `callback.html` with authorization code
5. **Callback exchanges** code for tokens → authorizes device
6. **Success redirect** back to `index.html?status=success`
7. **Auto-redirect** to mobile interface (`/`)

## Related Code

- **Fire TV device flow**: `js/data/auth/providers/hybrid-device-auth.js`
- **Backend edge function**: `supabase/functions/jwt-auth/index.ts`
- **Auth documentation**: `js/data/auth/HYBRID_DEVICE_FLOW.md`

## Notes

- Uses Google OAuth Web Client ID (not TV client ID)
- Generates separate JWT for phone and TV (same user, different devices)
- Phone JWT stored in localStorage for mobile interface access
- TV JWT delivered via backend polling mechanism
