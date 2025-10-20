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
- [ ] Source/create Halloween-themed decorative elements:
  - **Static Elements**: Pumpkins, ghosts, spider webs, moon/clouds, autumn leaves
  - **Animated Elements**:
    - Spiders dropping down grid lines and bouncing
    - Bats flying across dashboard
    - Glowing pumpkins with periodic glow effects
    - Floating ghosts with drift animations
- [ ] Optimize assets for dashboard
  - SVG preferred for static elements
  - GIF for simple animations
  - Lottie JSON for complex smooth animations
- [ ] Store in `/assets/themes/halloween/` directory
  - `/static/` - SVG/PNG static decorations
  - `/animated/` - GIF animations
  - `/lottie/` - Lottie animation files

### 1.2 Dynamic Overlay System with Animated Stickers

#### Concept
Create a dynamic overlay layer that sits above the main dashboard grid to display themed decorative elements including static stickers and animated GIFs. This system is click-through to maintain dashboard interactivity.

#### Technical Implementation
- [ ] Create `ThemeOverlay` component
  - HTML layer with high z-index (above dashboard, below modals)
  - CSS `pointer-events: none` for click-through functionality
  - Absolute positioning with responsive units
  - CSS transforms using translate percentages
  - Position elements relative to grid lines and between widgets

- [ ] Implement overlay element positioning system
  - Grid intersection anchoring (e.g., "top of widget row 2, left of column 3")
  - "Sweet spot" positioning (visually appealing empty spaces)
  - Responsive scaling based on viewport size
  - Elements avoid obscuring important content

- [ ] Add CSS animation engine
  - CSS keyframe animations for smooth movement
  - Timed appearances and disappearances
  - Multiple elements cycling through display
  - Configurable animation speeds and delays
  - GPU-accelerated transforms for performance

- [ ] Animation examples:
  ```css
  @keyframes spider-drop {
    0% { transform: translateY(-100px) rotate(0deg); }
    70% { transform: translateY(200px) rotate(360deg); }
    85% { transform: translateY(180px) rotate(360deg); }
    100% { transform: translateY(200px) rotate(360deg); }
  }

  @keyframes bat-fly {
    0% { transform: translate(-50px, 0) scaleX(1); }
    50% { transform: translate(50vw, -30px) scaleX(1); }
    51% { transform: translate(50vw, -30px) scaleX(-1); }
    100% { transform: translate(100vw, 0) scaleX(-1); }
  }

  @keyframes pumpkin-glow {
    0%, 100% { filter: brightness(1) drop-shadow(0 0 0 #FF6B1A); }
    50% { filter: brightness(1.5) drop-shadow(0 0 20px #FF6B1A); }
  }
  ```

#### Configuration System
- [ ] Extend theme system to support overlay configuration
  ```javascript
  {
    id: 'halloween',
    name: 'Halloween',
    colors: { ... },
    overlay: {
      enabled: true,
      elements: [
        {
          type: 'animated-gif',
          src: '/assets/themes/halloween/animated/spider-drop.gif',
          position: { type: 'grid-line', row: 2, col: 1 },
          timing: { delay: 0, duration: 3000, loop: true },
          scale: 1.0
        },
        {
          type: 'lottie',
          src: '/assets/themes/halloween/lottie/bats.json',
          position: { type: 'viewport-relative', x: '10%', y: '20%' },
          animation: 'bat-fly',
          timing: { delay: 1000, duration: 8000, loop: true }
        },
        {
          type: 'static',
          src: '/assets/themes/halloween/static/pumpkin-corner.svg',
          position: { type: 'corner', corner: 'bottom-left' },
          animation: 'pumpkin-glow',
          opacity: 0.7
        }
      ],
      settings: {
        maxConcurrentAnimations: 3,
        respectReducedMotion: true
      }
    }
  }
  ```

- [ ] Add UI controls in Settings module
  - Toggle theme overlays on/off
  - Adjust animation intensity (none, low, medium, high)
  - Configure number of concurrent animations
  - Preview overlay configurations

#### Animation Sources & Integration
**Option 1: GIF Services (Recommended for Phase 1)**
- [ ] Integrate Giphy API for Halloween GIF library
- [ ] Integrate Tenor API as fallback
- [ ] Create curated collection of family-friendly Halloween GIFs
- [ ] Implement caching for frequently used animations

**Option 2: Lottie Animations (Future Enhancement)**
- [ ] Research LottieFiles Halloween collection
- [ ] Evaluate custom animation creation workflow
- [ ] Test Lottie player library integration
- [ ] Compare performance: Lottie vs GIF

**Option 3: Curated Local Collection (Phase 1)**
- [ ] Search and download high-quality Halloween GIFs
- [ ] Optimize file sizes (compress, reduce dimensions if needed)
- [ ] Store locally in project repository
- [ ] Organize by element type and animation style
- [ ] Create attribution file for sources

**Implementation Strategy**: Start with curated local collection of GIFs from Giphy/Tenor for quick Phase 1 implementation. Evaluate Lottie animations for Phase 2 if smoother animations are needed.

#### Animation Behavior Controls
- [ ] Implement animation state machine
  - Playing, paused, hidden states
  - Smooth transitions between states
  - Coordinated timing for multiple elements

- [ ] Add performance monitoring
  - FPS tracking during animations
  - Automatic throttling if performance degrades
  - Disable on low-end devices

- [ ] Respect user preferences
  - Honor `prefers-reduced-motion` media query
  - Provide manual disable option
  - Fallback to static elements if needed

### 1.3 Halloween Theme Definition
- [ ] Create `themes/halloween.js` with full theme spec
- [ ] Test on all widgets (calendar, agenda, photos, clock, header)
- [ ] Ensure text contrast/readability
- [ ] Add seasonal auto-activation (October)
- [ ] Add theme preview thumbnail

---

## 2. Quotables Widget

### 2.1 Widget Concept
New dashboard widget that displays themed quotes, facts, and statistics with background imagery. Content cycles automatically with user controls similar to the existing photos widget. Widget is theme-aware and changes content based on active dashboard theme.

### 2.2 Core Features
- [ ] Display quotes, facts, and themed statistics
- [ ] Background images appropriate to each quote/fact
- [ ] Automatic cycling through content (configurable timing)
- [ ] User navigation controls (forward/backward arrows)
- [ ] Theme-aware content switching
- [ ] Smooth transitions between content items
- [ ] Text overlay with readable contrast
- [ ] Responsive text sizing

### 2.3 Content Sources

#### Quotes & Facts APIs
**Option 1: Public Quote APIs**
- [ ] Evaluate QuoteGarden API - general quote library
- [ ] Evaluate Quotable API - alternative quote service
- [ ] Test API reliability and rate limits
- [ ] Implement API key management

**Option 2: Curated Collections (Recommended)**
- [ ] Create JSON-based quote/fact storage
- [ ] Build Halloween-specific collection:
  - Halloween facts and trivia
  - Spooky quotes from literature/movies
  - Holiday-related statistics
  - Fun Halloween traditions from around the world
- [ ] Create general/default collection for non-themed usage
- [ ] Structure: `data/quotables/[theme-id].json`

**Hybrid Approach (Recommended)**:
- Use curated collections for themed content (Halloween, Christmas, etc.)
- Use APIs for general daily quotes when no theme is active
- Fallback to local curated content if API fails

#### Background Images
**Option 1: Image APIs**
- [ ] Evaluate Unsplash API for themed photography
- [ ] Test Pexels API as alternative
- [ ] Implement image caching

**Option 2: Curated Image Library (Recommended)**
- [ ] Create theme-specific image collections
- [ ] Halloween images: pumpkins, autumn scenes, spooky atmospheres
- [ ] Store in `/assets/quotables/[theme-id]/backgrounds/`
- [ ] Optimize images (WebP format, appropriate dimensions)
- [ ] Ensure family-friendly content

**Implementation Strategy**: Start with curated collections for better quality control and offline support. Consider APIs for future content variety.

### 2.4 Data Structure
```javascript
// data/quotables/halloween.json
{
  "theme": "halloween",
  "items": [
    {
      "type": "quote",
      "text": "It's Halloween, everyone's entitled to one good scare.",
      "author": "Halloween (1978)",
      "background": "/assets/quotables/halloween/backgrounds/pumpkin-patch.jpg"
    },
    {
      "type": "fact",
      "text": "Halloween originated from the ancient Celtic festival of Samhain, celebrated over 2,000 years ago.",
      "background": "/assets/quotables/halloween/backgrounds/autumn-trees.jpg"
    },
    {
      "type": "statistic",
      "text": "Americans spend over $10 billion on Halloween annually, making it the second-largest commercial holiday.",
      "background": "/assets/quotables/halloween/backgrounds/candy-corn.jpg"
    }
  ]
}
```

### 2.5 Technical Implementation

#### Widget Foundation
- [ ] Create `QuotablesWidget` class extending base widget
- [ ] Build on existing photos widget architecture:
  - Content cycling mechanism
  - Navigation controls (next/previous)
  - Auto-advance timer
  - Pause on hover/interaction

#### Widget Components
- [ ] Create `QuotableDisplay` component
  - Background image layer
  - Text overlay with gradient backdrop for readability
  - Author/source attribution
  - Type indicator (quote, fact, statistic)

- [ ] Implement content manager
  - Load theme-specific content based on active theme
  - Cache loaded content
  - Preload next/previous items
  - Handle content transitions

- [ ] Add navigation controls
  - Previous/Next buttons (same style as photos widget)
  - Pause/Resume auto-advance
  - Keyboard navigation support (arrow keys)

#### Theme Integration
- [ ] Detect active dashboard theme
- [ ] Load corresponding quotables content collection
- [ ] Update content when theme changes
- [ ] Fallback to default collection if theme has no custom content
- [ ] Smooth content refresh on theme switch

#### Settings & Configuration
- [ ] Add quotables widget to settings UI
  - Enable/disable widget
  - Configure auto-advance timing (30s, 60s, 120s, manual only)
  - Toggle background images on/off
  - Font size adjustment
- [ ] Store settings in user preferences
- [ ] Sync settings across devices

### 2.6 Halloween-Specific Content
- [ ] Curate 20-30 Halloween quotes/facts/statistics
- [ ] Source/create 15-20 Halloween-themed background images
- [ ] Ensure all content is family-friendly
- [ ] Test readability with Halloween color palette
- [ ] Verify text contrast on all backgrounds

### 2.7 UI/UX Design
```html
<div class="quotables-widget">
  <div class="quotable-background" style="background-image: url(...)">
    <div class="quotable-overlay">
      <div class="quotable-content">
        <div class="quotable-type">Quote</div>
        <blockquote class="quotable-text">
          It's Halloween, everyone's entitled to one good scare.
        </blockquote>
        <div class="quotable-attribution">
          — Halloween (1978)
        </div>
      </div>
    </div>
  </div>
  <div class="quotable-controls">
    <button class="quotable-prev" aria-label="Previous quote">←</button>
    <button class="quotable-pause" aria-label="Pause">⏸</button>
    <button class="quotable-next" aria-label="Next quote">→</button>
  </div>
</div>
```

### 2.8 Future Enhancements
- [ ] User-submitted quotes/facts
- [ ] Social sharing functionality
- [ ] Favorite/bookmark specific quotables
- [ ] Custom font selection
- [ ] Text-to-speech for accessibility
- [ ] Daily quotable notifications

---

## 3. Custom Theme Builder

### 3.1 Theme Customization Interface

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

### 3.2 Theme Storage & Management
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

### 3.3 Theme Application
- [ ] Update `ThemeApplier` to support custom themes
- [ ] Merge custom theme with base theme
- [ ] Apply custom images to dashboard
- [ ] Save active custom theme to settings
- [ ] Sync across devices
- [ ] Handle theme deletion (fallback to default)

### 3.4 Theme Sharing (Future)
- [ ] Theme gallery (optional)
- [ ] Share theme code/JSON
- [ ] Import shared themes
- [ ] Rate/favorite themes

---

## 4. Modular Widget System Architecture

### 4.1 Current State & Limitations
Currently, widgets are fixed HTML files that require manual code changes to add or remove. This makes it difficult to:
- Add new widgets without modifying core dashboard code
- Allow families to customize which widgets they see
- Test widgets independently
- Create themed widget variations

### 4.2 Phase 1: Startup Configuration (This Phase)

#### Widget Registry System
- [ ] Create widget registry mapping types to implementations
  ```javascript
  // js/widgets/widget-registry.js
  const WIDGET_REGISTRY = {
    'calendar': {
      component: CalendarWidget,
      defaultConfig: { ... },
      requiredAuth: true
    },
    'agenda': {
      component: AgendaWidget,
      defaultConfig: { ... },
      requiredAuth: true
    },
    'photos': {
      component: PhotosWidget,
      defaultConfig: { ... },
      requiredAuth: true
    },
    'quotables': {
      component: QuotablesWidget,
      defaultConfig: { ... },
      requiredAuth: false
    },
    'clock': {
      component: ClockWidget,
      defaultConfig: { ... },
      requiredAuth: false
    }
  };
  ```

#### Configuration-Based Loading
- [ ] Create startup configuration file
  ```javascript
  // data/widget-config.json
  {
    "widgets": [
      { "id": "header", "type": "header", "position": "top", "span": "full" },
      { "id": "calendar", "type": "calendar", "position": "grid-1", "span": 2 },
      { "id": "agenda", "type": "agenda", "position": "grid-2", "span": 1 },
      { "id": "quotables", "type": "quotables", "position": "grid-3", "span": 1 },
      { "id": "photos", "type": "photos", "position": "grid-4", "span": 2 }
    ],
    "layout": {
      "columns": 3,
      "gap": "20px",
      "responsiveBreakpoints": { ... }
    }
  }
  ```

#### Widget Manager
- [ ] Create `WidgetManager` class
  - Load widget configuration at startup
  - Instantiate widgets from registry
  - Mount widgets to dashboard
  - Handle widget lifecycle (init, mount, unmount)
  - Provide widget communication bus

#### Self-Contained Widget Modules
- [ ] Refactor existing widgets to be self-contained
  - Widget component (HTML structure)
  - Widget controller (logic)
  - Widget styles (scoped CSS)
  - Widget configuration schema
  - Widget dependencies clearly defined

- [ ] Create base widget interface
  ```javascript
  class BaseWidget {
    constructor(config) { ... }
    async init() { ... }
    mount(container) { ... }
    unmount() { ... }
    update(data) { ... }
    destroy() { ... }
  }
  ```

### 4.3 Phase 2: User Control (Future Enhancement)

#### Widget Picker Interface
- [ ] Design widget selection UI
- [ ] Allow families to enable/disable widgets
- [ ] Save widget preferences per user
- [ ] Hot-swap widgets without page reload

#### Drag-and-Drop Layout
- [ ] Implement drag-and-drop for widget positioning
- [ ] Allow widget resizing
- [ ] Save custom layouts
- [ ] Provide layout presets

---

## 5. Hybrid Device Authentication Flow

### 5.1 Backend Architecture

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

### 5.2 Fire TV Client Implementation

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

### 5.3 Phone Web App Implementation

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

### 5.4 Security Implementation
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

### 5.5 Migration Strategy
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

## 6. Testing Plan

### 6.1 Theme Testing
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

### 6.2 Quotables Widget Testing
- [ ] Test quotables widget with Halloween theme
- [ ] Test quotables widget with default theme
- [ ] Test content cycling (automatic and manual)
- [ ] Test navigation controls
- [ ] Test image loading and caching
- [ ] Test text readability on all backgrounds
- [ ] Test theme switching (content updates correctly)
- [ ] Test settings (timing, enable/disable)

### 6.3 Widget System Testing
- [ ] Test widget registry loading
- [ ] Test configuration-based widget instantiation
- [ ] Test widget lifecycle (init, mount, unmount)
- [ ] Test adding/removing widgets from config
- [ ] Test widget communication
- [ ] Test responsive layout with different widget configurations

### 6.4 Overlay System Testing
- [ ] Test overlay animations on different screen sizes
- [ ] Test click-through functionality (dashboard remains interactive)
- [ ] Test animation performance (FPS monitoring)
- [ ] Test multiple concurrent animations
- [ ] Test reduced motion preference
- [ ] Test animation timing and coordination
- [ ] Test GIF loading and caching
- [ ] Test overlay enable/disable in settings

### 6.5 Auth Flow Testing
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

### 6.6 Integration Testing
- [ ] Test theme changes with hybrid auth
- [ ] Test custom theme on phone after TV auth
- [ ] Test session sync between devices
- [ ] Test theme images load correctly
- [ ] Test performance impact of images
- [ ] Test theme memory usage

---

## 7. File Structure

```
js/
├── ui/
│   ├── theme-applier.js (update)
│   ├── theme-overlay.js (new - dynamic overlay system)
│   ├── custom-theme-builder.js (new)
│   └── animation-controller.js (new - manages overlay animations)
├── widgets/
│   ├── widget-registry.js (new - registry of all widgets)
│   ├── widget-manager.js (new - widget lifecycle management)
│   ├── base-widget.js (new - base widget class)
│   ├── quotables-widget.js (new - quotables widget)
│   └── quotable-display.js (new - quotable content component)
├── modules/
│   └── Settings/
│       └── pages/
│           ├── settings-theme-page.js (new)
│           └── settings-widgets-page.js (new)
├── data/
│   ├── auth/
│   │   ├── device-auth-manager.js (new - Fire TV)
│   │   └── phone-auth-handler.js (new - Phone)
│   └── quotables/
│       ├── halloween.json (new - Halloween quotes/facts)
│       └── default.json (new - default quotes)
└── themes/
    ├── halloween.js (new)
    └── custom-theme-schema.js (new)

assets/
├── themes/
│   └── halloween/
│       ├── static/
│       │   ├── pumpkin-corner.svg
│       │   ├── ghost-overlay.svg
│       │   └── moon-clouds.svg
│       ├── animated/
│       │   ├── spider-drop.gif
│       │   ├── bat-fly.gif
│       │   └── pumpkin-glow.gif
│       └── lottie/
│           └── (future Lottie animations)
└── quotables/
    ├── halloween/
    │   └── backgrounds/
    │       ├── pumpkin-patch.jpg
    │       ├── autumn-trees.jpg
    │       ├── candy-corn.jpg
    │       └── spooky-house.jpg
    └── default/
        └── backgrounds/
            └── (default background images)

data/
└── widget-config.json (new - startup widget configuration)

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

## 8. Implementation Order

### Week 1-2: Halloween Theme Foundation & Overlay System
1. Create Halloween color palette and theme definition
2. Curate/download Halloween GIFs and static images
3. Organize assets in `/assets/themes/halloween/` structure
4. Implement `ThemeOverlay` component with click-through functionality
5. Create CSS keyframe animations (spider-drop, bat-fly, pumpkin-glow)
6. Implement overlay configuration system in theme schema
7. Add animation state machine and timing controls
8. Implement performance monitoring (FPS tracking)
9. Add `prefers-reduced-motion` support
10. Test overlay system on different screen sizes
11. Add seasonal auto-activation (October)

### Week 3: Quotables Widget
1. Design quotables widget UI (based on photos widget)
2. Create `QuotablesWidget` class with base widget structure
3. Implement content cycling and navigation controls
4. Curate 20-30 Halloween quotes/facts/statistics
5. Source/optimize 15-20 Halloween background images
6. Create data structure (`data/quotables/halloween.json`)
7. Implement theme-aware content loading
8. Add settings controls (timing, enable/disable)
9. Test readability and contrast
10. Test content cycling and theme switching

### Week 4: Widget System Foundation
1. Create `BaseWidget` class with lifecycle methods
2. Implement `WidgetRegistry` with widget definitions
3. Create `WidgetManager` for dynamic loading
4. Design `widget-config.json` schema
5. Refactor existing widgets to use base class
6. Test widget loading and lifecycle
7. Test adding/removing widgets via config
8. Document widget development guide

### Week 5: Custom Theme Builder
1. Design and implement custom theme builder UI
2. Create color picker components
3. Implement live preview pane
4. Add color contrast validator
5. Add image upload/selection interface
6. Implement preset starter themes
7. Test theme creation/editing flow

### Week 6: Theme Management
1. Extend `user_settings` table for custom themes
2. Create edge function operations (save, delete, list)
3. Implement theme validation
4. Add theme export/import (JSON)
5. Test theme persistence and sync
6. Add overlay configuration to custom theme builder

### Week 7-8: Hybrid Device Auth (Backend)
1. Create database schema for device auth sessions
2. Implement device code generation endpoint
3. Implement link devices endpoint with Google verification
4. Implement token polling endpoint
5. Implement JWT generation and verification
6. Add rate limiting and security measures
7. Create cleanup cron job for expired sessions
8. Test all backend flows and edge cases

### Week 9: Hybrid Device Auth (Clients)
1. Implement `DeviceAuthManager` for Fire TV
2. Add QR code generation and display
3. Implement polling mechanism with countdown timer
4. Create Fire TV auth screen UI
5. Implement `PhoneAuthHandler` for phone
6. Integrate Google Sign-In on phone
7. Create phone auth page UI
8. Test complete auth flow end-to-end

### Week 10: Integration & Testing
1. End-to-end testing of all features
2. Test overlay animations with all themes
3. Test quotables widget with theme switching
4. Test widget system with different configurations
5. Security testing (auth, rate limiting, validation)
6. Performance testing (animations, image loading)
7. Cross-device sync testing
8. Bug fixes and optimization
9. Documentation and user guides
10. Prepare for production deployment

---

## 9. Success Criteria

### Halloween Theme & Overlay System
- ✓ Theme renders correctly on all widgets
- ✓ Color palette provides good contrast and readability (WCAG AA)
- ✓ Auto-activates in October
- ✓ Overlay animations are smooth (60 FPS)
- ✓ Animations are click-through (don't block interactions)
- ✓ Multiple concurrent animations work without performance issues
- ✓ Respects `prefers-reduced-motion` accessibility setting
- ✓ GIFs load efficiently and are cached
- ✓ Overlay can be toggled on/off in settings
- ✓ Animations coordinate well (not overwhelming)

### Quotables Widget
- ✓ Widget displays quotes/facts with background images
- ✓ Content cycles automatically with configurable timing
- ✓ Navigation controls work (forward, backward, pause)
- ✓ Text is readable on all background images
- ✓ Theme-aware content switching works correctly
- ✓ Smooth transitions between content items
- ✓ Settings save and sync across devices
- ✓ Halloween content is family-friendly and engaging
- ✓ Widget integrates seamlessly with dashboard layout

### Widget System Architecture
- ✓ Widgets load dynamically from configuration file
- ✓ Widget registry correctly maps types to implementations
- ✓ Widget lifecycle (init, mount, unmount) works reliably
- ✓ Easy to add new widgets without modifying core code
- ✓ Configuration changes apply without code changes
- ✓ All existing widgets refactored to new system
- ✓ Documentation for creating new widgets exists

### Custom Theme Builder
- ✓ Users can create custom themes
- ✓ Live preview updates in real-time
- ✓ Themes save and persist across sessions
- ✓ Color contrast warnings work
- ✓ Image uploads are secure and optimized
- ✓ Themes sync across devices
- ✓ Can configure overlay elements in custom themes

### Hybrid Device Auth
- ✓ Single QR scan authenticates both devices
- ✓ Fire TV receives JWT successfully
- ✓ Phone receives session token successfully
- ✓ Both devices remain authenticated
- ✓ Auth success rate > 95%
- ✓ Average auth time < 30 seconds
- ✓ No security vulnerabilities
- ✓ Graceful error handling
- ✓ Rate limiting prevents abuse

---

## 10. Future Enhancements

### Themes & Overlays
- Lottie animations for smoother, scalable animations
- Additional seasonal themes (Christmas, Spring, Summer)
- Time-based theme switching (auto-switch based on time of day)
- Location-based themes
- Weather-based themes
- Interactive overlay elements (respond to user actions)
- Theme marketplace for sharing/downloading themes
- Community-created theme gallery

### Quotables Widget
- User-submitted quotes/facts
- Social sharing functionality
- Favorite/bookmark specific quotables
- Custom font selection
- Text-to-speech for accessibility
- Daily quotable notifications
- API integration for dynamic quote sources
- Multiple quote categories

### Widget System
- Widget picker UI for users to add/remove widgets
- Drag-and-drop widget positioning
- Widget resizing capabilities
- Widget-to-widget communication events
- Third-party widget support
- Widget marketplace
- Widget analytics (usage tracking)

### Auth
- Biometric authentication
- Multi-device management dashboard
- Device trust levels
- Session analytics
- Auth notifications
- OAuth provider options (Apple, Microsoft, etc.)
- Remember device functionality

---

## Notes

- Keep existing OAuth flow as fallback
- Monitor performance impact of theme images
- Consider CDN for theme assets
- Document custom theme JSON schema
- Provide theme migration guide
- Add analytics for theme usage
- Add analytics for auth flow success rates
