# Phase 5.5: Advanced Theming & Hybrid Device Authentication

**Status**: Planning
**Priority**: High
**Dependencies**: Phase 5 (Welcome & Photos)

---

## Overview

This phase introduces advanced theming capabilities including seasonal themes (Halloween), a custom theme builder interface, and a hybrid device authentication flow that authenticates both Fire TV and phone simultaneously.

---

## 1. Halloween Theme Development

### 1.1 Theme Assets
- [ ] Create Halloween color palette
  - Primary: Deep orange (#FF6B1A)
  - Secondary: Dark purple (#6B1FA0)
  - Accent: Bright green (#39FF14)
  - Background: Near-black with purple tint (#1A0A1F)
  - Surface: Dark grey with orange tint (#2D1F1A)
- [ ] Source/create Halloween-themed images:
  - Pumpkins
  - Bats
  - Ghosts
  - Spider webs
  - Moon/clouds
  - Autumn leaves
- [ ] Optimize images for dashboard (SVG preferred, PNG fallback)
- [ ] Store in `/assets/themes/halloween/` directory

### 1.2 Image Integration System
- [ ] Create `ImageLayer` component for theme backgrounds
  - Support multiple layers (parallax effect)
  - Position control (corner, edges, center, floating)
  - Opacity/blend mode support
  - Responsive scaling
- [ ] Add image support to theme system
  ```javascript
  {
    id: 'halloween',
    name: 'Halloween',
    colors: { ... },
    images: [
      {
        src: '/assets/themes/halloween/pumpkin-corner.svg',
        position: 'bottom-left',
        opacity: 0.3,
        scale: 1.0
      },
      {
        src: '/assets/themes/halloween/bats-floating.svg',
        position: 'top-right',
        opacity: 0.2,
        animation: 'float'
      }
    ]
  }
  ```
- [ ] Update `ThemeApplier` to handle images
- [ ] Add CSS variables for image overlays
- [ ] Implement image preloading for theme switches

### 1.3 Halloween Theme Definition
- [ ] Create `themes/halloween.js` with full theme spec
- [ ] Test on all widgets (calendar, agenda, photos, clock, header)
- [ ] Ensure text contrast/readability
- [ ] Add seasonal auto-activation (October)
- [ ] Add theme preview thumbnail

---

## 2. Custom Theme Builder

### 2.1 Theme Customization Interface

#### Main Areas to Customize
- [ ] **Background Colors**
  - Primary background
  - Secondary background (widgets/cards)
  - Header background
  - Modal/overlay background

- [ ] **Text Colors**
  - Primary text
  - Secondary text
  - Muted text
  - Link/accent text

- [ ] **UI Element Colors**
  - Primary button
  - Secondary button
  - Selected/active state
  - Border colors
  - Divider colors

- [ ] **Widget-Specific Colors**
  - Calendar event colors (default)
  - Agenda highlight
  - Photo frame/border
  - Clock face

- [ ] **Images/Overlays**
  - Background image
  - Corner decorations
  - Floating elements
  - Opacity/blend settings

#### UI Components
- [ ] Create `CustomThemeBuilder` modal
  ```
  ┌─────────────────────────────────────┐
  │  Create Your Theme                  │
  ├─────────────────────────────────────┤
  │  Theme Name: [____________]         │
  │                                     │
  │  ┌───────────┐  ┌──────────────┐   │
  │  │ Background│  │ ▓▓▓▓▓▓▓▓▓▓▓▓ │   │
  │  │ Primary   │  │ Live Preview │   │
  │  │ [Color]   │  │              │   │
  │  └───────────┘  │ Shows actual │   │
  │                 │ dashboard    │   │
  │  ┌───────────┐  │ with theme   │   │
  │  │ Text      │  │ applied      │   │
  │  │ Primary   │  │              │   │
  │  │ [Color]   │  └──────────────┘   │
  │  └───────────┘                     │
  │                                     │
  │  [Cancel]  [Save Theme]            │
  └─────────────────────────────────────┘
  ```
- [ ] Color picker component (HTML5 color input or custom)
- [ ] Live preview pane (miniature dashboard)
- [ ] Color contrast validator (WCAG AA minimum)
- [ ] Image upload/selection interface
- [ ] Preset starter themes ("Light", "Dark", "Blue", etc.)

### 2.2 Theme Storage & Management
- [ ] Extend `user_settings` table to store custom themes
  ```sql
  -- Add custom_themes JSONB column
  ALTER TABLE user_settings
  ADD COLUMN custom_themes JSONB DEFAULT '[]';
  ```
- [ ] Create edge function operations:
  - `save_custom_theme`
  - `delete_custom_theme`
  - `list_custom_themes`
  - `set_active_theme`
- [ ] Store theme images in Supabase Storage
  - Bucket: `user-theme-images`
  - Path: `{userId}/themes/{themeId}/{filename}`
- [ ] Implement theme validation
  - Check color format
  - Validate image URLs
  - Ensure required fields present
- [ ] Add theme export/import (JSON)

### 2.3 Theme Application
- [ ] Update `ThemeApplier` to support custom themes
- [ ] Merge custom theme with base theme
- [ ] Apply custom images to dashboard
- [ ] Save active custom theme to settings
- [ ] Sync across devices
- [ ] Handle theme deletion (fallback to default)

### 2.4 Theme Sharing (Future)
- [ ] Theme gallery (optional)
- [ ] Share theme code/JSON
- [ ] Import shared themes
- [ ] Rate/favorite themes

---

## 3. Hybrid Device Authentication Flow

### 3.1 Backend Architecture

#### Database Schema
```sql
-- Device authentication sessions
CREATE TABLE device_auth_sessions (
  device_code VARCHAR(64) PRIMARY KEY,
  user_code VARCHAR(16) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, authorized, expired
  user_id UUID REFERENCES auth.users(id),
  jwt_token TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  authorized_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  device_info JSONB,
  INDEX idx_user_code (user_code),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at)
);

-- Auto-cleanup expired sessions
CREATE FUNCTION cleanup_expired_device_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM device_auth_sessions
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Run cleanup every 5 minutes
SELECT cron.schedule('cleanup-device-sessions', '*/5 * * * *',
  'SELECT cleanup_expired_device_sessions()');
```

#### Edge Functions
- [ ] `/functions/device-auth/code` - Generate device code
  - Generate secure `device_code` (32 bytes)
  - Generate display `user_code` (8 chars, readable)
  - Store in `device_auth_sessions`
  - Return verification URL with device code
  - Set 10-minute expiration

- [ ] `/functions/device-auth/link` - Link devices
  - Accept `device_code` and `google_token`
  - Verify device code exists and is pending
  - Verify Google token with Google API
  - Get or create user in database
  - Generate JWT for Fire TV (30-day expiration)
  - Update device session with JWT
  - Generate session token for phone
  - Return phone token + user info

- [ ] `/functions/device-auth/token` - Token polling
  - Accept `device_code` from Fire TV
  - Check device session status
  - Return `authorization_pending` if pending
  - Return JWT if authorized
  - Return `expired_token` if expired
  - Clean up session after successful auth

- [ ] `/functions/device-auth/verify` - Verify JWT
  - Verify JWT signature
  - Check expiration
  - Return user info if valid

### 3.2 Fire TV Client Implementation

#### Device Flow Manager
- [ ] Create `DeviceAuthManager` class
  ```javascript
  class DeviceAuthManager {
    - initiateDeviceFlow()
    - displayQRCode(url)
    - displayUserCode(code)
    - startPolling(deviceCode, interval)
    - stopPolling()
    - handleAuthSuccess(jwt)
    - checkExistingAuth()
  }
  ```
- [ ] QR code generation
  - Use `qrcode.js` library
  - Display verification URL
  - Include device code in URL params
  - Make QR code large and centered

- [ ] Polling mechanism
  - Poll every 5 seconds
  - Max 120 attempts (10 minutes)
  - Handle all response states:
    - `authorization_pending` - continue polling
    - Success - store JWT, load dashboard
    - `expired_token` - show timeout error
  - Show countdown timer

- [ ] UI Components
  - QR code display
  - User code display (fallback)
  - Instructions
  - Loading/waiting state
  - Error state
  - Success state

#### Auth Screen UI
```html
<div class="device-auth-screen">
  <div class="auth-container">
    <h1>Sign in to Dashie</h1>
    <div class="qr-section">
      <canvas id="qr-code"></canvas>
      <p class="instructions">
        Scan this code with your phone to sign in
      </p>
    </div>
    <div class="user-code-section">
      <p class="code-label">Or enter this code:</p>
      <p class="user-code" id="user-code">XXXX-XXXX</p>
    </div>
    <div class="status" id="auth-status">
      Waiting for authorization...
    </div>
    <div class="timer" id="auth-timer">
      Expires in 9:45
    </div>
  </div>
</div>
```

### 3.3 Phone Web App Implementation

#### Phone Auth Handler
- [ ] Create `PhoneAuthHandler` class
  ```javascript
  class PhoneAuthHandler {
    - handleQRScan()
    - authenticateWithGoogle()
    - linkDevices(deviceCode, googleToken)
    - showGoogleSignInButton()
    - storeAuthToken(token)
  }
  ```
- [ ] QR scan flow
  - Extract `device` param from URL
  - Validate device code format
  - Show loading state
  - Trigger Google OAuth
  - Send both tokens to backend
  - Handle success/error

- [ ] Google Sign-In Integration
  - Use Google Identity Services (new SDK)
  - Prompt for Google sign-in
  - Get ID token
  - Handle sign-in errors

- [ ] Success handling
  - Store phone auth token
  - Store user info
  - Show success message
  - Redirect to phone dashboard
  - Show "TV authenticated" confirmation

#### Auth Page UI
```html
<!DOCTYPE html>
<html>
<head>
  <title>Sign In - Dashie</title>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <div class="phone-auth-container">
    <h1>Sign In</h1>
    <div id="status" class="status-message"></div>
    <div id="google-signin-button"></div>
    <div class="info">
      <p>Signing in will authenticate both your TV and phone</p>
    </div>
  </div>
</body>
</html>
```

### 3.4 Security Implementation
- [ ] Device code generation
  - Use `crypto.randomBytes(32)`
  - Hex encode for storage
  - User code: readable format (avoid O/0, I/1)

- [ ] Google token verification
  - Server-side only
  - Use `google-auth-library`
  - Verify audience matches client ID
  - Check expiration
  - Extract user claims

- [ ] JWT generation
  - Sign with strong secret (256-bit)
  - Include claims:
    - `userId`
    - `email`
    - `deviceType` ('firetv' or 'phone')
    - `deviceCode` (for audit)
    - `iat` (issued at)
    - `exp` (expiration - 30 days)
  - Use HS256 algorithm

- [ ] Rate limiting
  - Device code generation: 10/hour per IP
  - Token polling: 1/second per device
  - Link devices: 5/minute per device
  - Use Redis for rate limit storage

- [ ] Session cleanup
  - Auto-delete expired sessions
  - Single-use device codes
  - Invalidate after success
  - Log all auth attempts

### 3.5 Migration Strategy
- [ ] Keep existing OAuth flow as fallback
- [ ] Add feature flag for hybrid auth
- [ ] Test both flows in parallel
- [ ] Gradual rollout:
  1. Fire TV only (existing users)
  2. Fire TV + Phone (beta users)
  3. Full rollout (all users)
- [ ] Monitor auth success rates
- [ ] Handle edge cases:
  - QR scan fails
  - Google auth fails
  - Network interruption
  - Token expiration
  - Multiple devices

---

## 4. Testing Plan

### 4.1 Theme Testing
- [ ] Test Halloween theme on all widgets
- [ ] Test theme images on different screen sizes
- [ ] Test custom theme builder:
  - Create new theme
  - Edit theme colors
  - Upload images
  - Save theme
  - Delete theme
  - Switch between themes
- [ ] Test theme sync across devices
- [ ] Test invalid color values
- [ ] Test image upload limits
- [ ] Test theme export/import

### 4.2 Auth Flow Testing
- [ ] Test device code generation
- [ ] Test QR code display
- [ ] Test QR scan on phone
- [ ] Test Google sign-in
- [ ] Test successful linking
- [ ] Test polling timeout
- [ ] Test expired codes
- [ ] Test invalid codes
- [ ] Test network failures
- [ ] Test concurrent auth attempts
- [ ] Test rate limiting
- [ ] Test JWT verification
- [ ] Test token refresh
- [ ] Test logout (both devices)

### 4.3 Integration Testing
- [ ] Test theme changes with hybrid auth
- [ ] Test custom theme on phone after TV auth
- [ ] Test session sync between devices
- [ ] Test theme images load correctly
- [ ] Test performance impact of images
- [ ] Test theme memory usage

---

## 5. File Structure

```
js/
├── ui/
│   ├── theme-applier.js (update)
│   ├── image-layer.js (new)
│   └── custom-theme-builder.js (new)
├── modules/
│   └── Settings/
│       └── pages/
│           └── settings-theme-page.js (new)
├── data/
│   └── auth/
│       ├── device-auth-manager.js (new - Fire TV)
│       └── phone-auth-handler.js (new - Phone)
└── themes/
    ├── halloween.js (new)
    └── custom-theme-schema.js (new)

assets/
└── themes/
    └── halloween/
        ├── pumpkin-corner.svg
        ├── bats-floating.svg
        ├── ghost-overlay.svg
        └── moon-clouds.svg

supabase/
└── functions/
    └── device-auth/
        ├── code/
        │   └── index.ts (new)
        ├── link/
        │   └── index.ts (new)
        ├── token/
        │   └── index.ts (new)
        └── verify/
            └── index.ts (new)

phone/
├── auth.html (new)
├── auth.js (new)
└── auth.css (new)
```

---

## 6. Implementation Order

### Week 1: Halloween Theme
1. Create color palette and theme definition
2. Source/create theme images
3. Implement `ImageLayer` component
4. Update `ThemeApplier` for image support
5. Test Halloween theme on all widgets
6. Add seasonal auto-activation

### Week 2: Custom Theme Builder
1. Design and implement UI
2. Create color picker components
3. Implement live preview
4. Add image upload functionality
5. Implement theme storage (backend)
6. Test theme creation/editing

### Week 3: Theme Management
1. Implement theme listing
2. Add theme deletion
3. Implement theme export/import
4. Add theme validation
5. Test theme sync across devices

### Week 4-5: Hybrid Device Auth (Backend)
1. Create database schema
2. Implement device code generation
3. Implement link devices endpoint
4. Implement token polling endpoint
5. Implement JWT verification
6. Add security measures (rate limiting)
7. Test backend flows

### Week 6: Hybrid Device Auth (Clients)
1. Implement Fire TV device flow manager
2. Add QR code generation
3. Implement polling mechanism
4. Create Fire TV auth UI
5. Implement phone auth handler
6. Integrate Google Sign-In
7. Create phone auth page

### Week 7: Integration & Testing
1. End-to-end testing
2. Security testing
3. Performance testing
4. Bug fixes
5. Documentation

---

## 7. Success Criteria

### Halloween Theme
- ✓ Theme renders correctly on all widgets
- ✓ Images display without performance impact
- ✓ Text remains readable (WCAG AA)
- ✓ Auto-activates in October
- ✓ Can be manually selected

### Custom Theme Builder
- ✓ Users can create custom themes
- ✓ Live preview updates in real-time
- ✓ Themes save and persist across sessions
- ✓ Color contrast warnings work
- ✓ Image uploads are secure and optimized
- ✓ Themes sync across devices

### Hybrid Device Auth
- ✓ Single QR scan authenticates both devices
- ✓ Fire TV receives JWT successfully
- ✓ Phone receives session token successfully
- ✓ Both devices remain authenticated
- ✓ Auth success rate > 95%
- ✓ Average auth time < 30 seconds
- ✓ No security vulnerabilities
- ✓ Graceful error handling

---

## 8. Future Enhancements

### Themes
- Animated theme elements
- Time-based theme switching
- Location-based themes
- Weather-based themes
- Theme marketplace
- Community themes

### Auth
- Biometric authentication
- Multi-device management
- Device trust levels
- Session analytics
- Auth notifications
- OAuth provider options (Apple, Microsoft, etc.)

---

## Notes

- Keep existing OAuth flow as fallback
- Monitor performance impact of theme images
- Consider CDN for theme assets
- Document custom theme JSON schema
- Provide theme migration guide
- Add analytics for theme usage
- Add analytics for auth flow success rates
