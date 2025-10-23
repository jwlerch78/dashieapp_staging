# Dashie Database Schema Reference

**Version:** 2.0
**Status:** Phase 3 Implementation
**Purpose:** Core user management, access control, and Stripe integration readiness

---

## Table of Contents

1. [Phase 3 Tables (Implement Now)](#phase-3-tables-implement-now)
   - [user_profiles](#user_profiles)
   - [user_auth_tokens](#user_auth_tokens)
   - [user_calendar_config](#user_calendar_config)
   - [beta_whitelist](#beta_whitelist)
   - [access_control_config](#access_control_config)
2. [Future Tables](#future-tables)
   - See [Feature Roadmap](.reference/Feature_Roadmap.md) for deferred tables

---

## Phase 3 Tables (Implement Now)

These tables are being implemented in Phase 3 to support:
- Access control (beta whitelist → trial → paid tiers)
- Stripe integration readiness
- Secure token storage
- Calendar configuration management

---

### user_profiles

**Purpose:** User subscription tier, billing info, and basic activity tracking

**When to use:**
- Checking user's subscription tier and limits
- Stripe customer/subscription management
- Basic activity tracking (last_seen, app version)
- Beta user identification

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique profile identifier | Primary key |
| `auth_user_id` | UUID | Supabase auth user ID | Link to auth.users table |
| `email` | TEXT | User's email (denormalized) | Quick access without auth table join |
| `stripe_customer_id` | TEXT | Stripe customer ID | Link to Stripe for billing |
| `stripe_subscription_id` | TEXT | Stripe subscription ID | Current active subscription |
| `tier` | TEXT | Subscription tier | Access control: `beta`, `trial`, `basic`, `pro` |
| `tier_started_at` | TIMESTAMPTZ | When current tier began | Track tier transitions |
| `tier_expires_at` | TIMESTAMPTZ | When trial expires (null for paid) | Trial expiration enforcement |
| `subscription_status` | TEXT | Stripe subscription status | `trialing`, `active`, `past_due`, `canceled`, `unpaid` |
| `max_dashboards` | INTEGER | Max allowed dashboard instances | Tier-based limit enforcement |
| `max_calendars` | INTEGER | Max calendar connections | Tier-based limit enforcement |
| `first_sign_in_at` | TIMESTAMPTZ | First authentication ever | User lifecycle tracking |
| `last_sign_in_at` | TIMESTAMPTZ | Most recent authentication | Login activity |
| `last_seen_at` | TIMESTAMPTZ | Last dashboard activity | Real engagement tracking |
| `current_app_version` | TEXT | App version user is running | Version adoption tracking |
| `analytics_consent` | BOOLEAN | User consented to analytics | GDPR compliance |
| `created_at` | TIMESTAMPTZ | Profile creation timestamp | Account age tracking |
| `updated_at` | TIMESTAMPTZ | Last profile update | Data freshness |

**Indexes:**
- Primary: `id`
- Unique: `auth_user_id`, `email`, `stripe_customer_id`, `stripe_subscription_id`
- Indexed: `tier`, `subscription_status`, `tier_expires_at` (for trial expiration queries)

**Tier Values:**
- `beta` - Beta testers (grandfathered, no expiration)
- `trial` - Free trial users (expires after X days)
- `basic` - Paid basic tier
- `pro` - Paid pro tier
- Future: `enterprise`, `lifetime`, etc.

**Subscription Status Values (from Stripe):**
- `trialing` - In trial period (Stripe managed)
- `active` - Paid and current
- `past_due` - Payment failed, grace period
- `canceled` - Canceled but active until period end
- `unpaid` - Payment failed, subscription suspended

---

### user_auth_tokens

**Purpose:** Secure storage of OAuth tokens separate from settings

**When to use:**
- Storing/retrieving OAuth access/refresh tokens
- Token refresh operations
- Disconnecting calendar accounts

**Security note:** Tokens are stored separately from settings to prevent accidental deletion during settings operations.

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique record identifier | Primary key |
| `auth_user_id` | UUID | Supabase auth user ID | Link to auth.users |
| `tokens` | JSONB | OAuth tokens by provider | Flexible token storage |
| `created_at` | TIMESTAMPTZ | Record creation | Token storage lifecycle |
| `updated_at` | TIMESTAMPTZ | Last token update | Token refresh tracking |

**Indexes:**
- Primary: `id`
- Unique: `auth_user_id`
- Indexed: `auth_user_id`

**JSONB Structure:**
```json
{
  "google": {
    "primary": {
      "access_token": "ya29.a0...",
      "refresh_token": "1//...",
      "expires_at": "2025-10-17T12:00:00Z",
      "scopes": ["calendar.readonly", "calendar.events"],
      "token_type": "Bearer"
    },
    "account2": {
      "access_token": "ya29.a0...",
      "refresh_token": "1//...",
      "expires_at": "2025-10-17T13:00:00Z",
      "scopes": ["calendar.readonly"],
      "token_type": "Bearer"
    }
  }
}
```

**RLS Policy:**
- Users can only access their own tokens
- Edge functions use service role to access all tokens

---

### user_calendar_config

**Purpose:** Calendar configuration and account metadata

**When to use:**
- Managing active calendar selections
- Tracking connected calendar accounts
- Calendar-specific settings (view preference, etc.)

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique config identifier | Primary key |
| `auth_user_id` | UUID | Supabase auth user ID | Link to auth.users |
| `active_calendar_ids` | TEXT[] | Account-prefixed calendar IDs | Active calendars: `["primary-user@gmail.com", "account2-shared@gmail.com"]` |
| `accounts` | JSONB | Account metadata | Account display info |
| `calendar_account_map` | JSONB | Calendar → account mapping | For backwards compatibility |
| `calendar_settings` | JSONB | Calendar preferences | View mode, filters, etc. |
| `created_at` | TIMESTAMPTZ | Config creation | Lifecycle tracking |
| `updated_at` | TIMESTAMPTZ | Last config update | Change tracking |

**Indexes:**
- Primary: `id`
- Unique: `auth_user_id`
- Indexed: `auth_user_id`

**JSONB Structure (accounts):**
```json
{
  "primary": {
    "email": "user@gmail.com",
    "display_name": "John Doe",
    "provider": "google",
    "connected_at": "2025-10-16T10:00:00Z"
  },
  "account2": {
    "email": "work@company.com",
    "display_name": "Work Account",
    "provider": "google",
    "connected_at": "2025-10-16T11:00:00Z"
  }
}
```

**JSONB Structure (calendar_settings):**
```json
{
  "default_view": "week",
  "show_declined_events": false,
  "show_all_day_events": true,
  "week_starts_on": "sunday"
}
```

**RLS Policy:**
- Users can only access their own calendar config

---

### beta_whitelist

**Purpose:** Control beta access via email whitelist

**When to use:**
- During beta phase to gate access
- Checking if new signup is allowed
- Tracking who invited beta users

**Lifecycle:** This table is only used when `access_control_config.beta_mode_enabled = true`. Once you move to public trial, this table becomes inactive but is kept for historical tracking.

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique record identifier | Primary key |
| `email` | TEXT | Whitelisted email address | Beta access control |
| `invited_by` | TEXT | Who invited this user | Track invite source |
| `invited_at` | TIMESTAMPTZ | When invite was created | Invite lifecycle |
| `access_granted_at` | TIMESTAMPTZ | When user first signed in | Conversion tracking |
| `notes` | TEXT | Admin notes about user | Context for beta testers |
| `created_at` | TIMESTAMPTZ | Record creation | Tracking |

**Indexes:**
- Primary: `id`
- Unique: `email`
- Indexed: `email` (for fast lookup during signup)

**Usage:**
```sql
-- Check if email is whitelisted
SELECT EXISTS(SELECT 1 FROM beta_whitelist WHERE email = 'user@example.com') AS is_whitelisted;

-- Grant access when user signs in
UPDATE beta_whitelist
SET access_granted_at = NOW()
WHERE email = 'user@example.com' AND access_granted_at IS NULL;
```

**RLS Policy:**
- Public read access (for signup check)
- Admin-only write access

---

### access_control_config

**Purpose:** Configuration-driven access control that evolves through launch phases

**When to use:**
- Checking if beta mode is active
- Getting trial duration for new users
- Feature flags for access control behavior

**Key concept:** Change access control behavior by updating config values, not code.

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `key` | TEXT | Config key name | Unique identifier |
| `value` | TEXT | Config value | Flexible string value |
| `value_type` | TEXT | Data type hint | `boolean`, `integer`, `string` |
| `description` | TEXT | What this config does | Documentation |
| `updated_at` | TIMESTAMPTZ | Last config change | Audit trail |
| `updated_by` | TEXT | Who changed it | Admin tracking |

**Indexes:**
- Primary: `key`

**Initial Config Values:**

| Key | Value | Type | Description |
|-----|-------|------|-------------|
| `beta_mode_enabled` | `true` | boolean | When true, only beta_whitelist emails can access |
| `trial_duration_days` | `14` | integer | How many days trial users get |
| `trial_enabled` | `false` | boolean | When true, new users get trial (beta_mode must be false) |
| `maintenance_mode` | `false` | boolean | When true, only admins can access |
| `require_email_verification` | `true` | boolean | Require verified email before access |

**Usage in Edge Function:**
```javascript
// Get config value
const config = await getConfig('beta_mode_enabled');
if (config.value === 'true') {
  // Beta mode logic
}

// Update config (admin only)
await updateConfig('beta_mode_enabled', 'false', 'admin@dashie.app');
```

**RLS Policy:**
- Public read access (app needs to check config)
- Admin-only write access

---

## Access Control Flow

### Phase 1: Beta (Current)

```
User signs up with email
  ↓
Edge function checks access_control_config.beta_mode_enabled
  ↓ (if true)
Check if email exists in beta_whitelist
  ↓
YES → Create user_profile with tier='beta'
  ↓
NO → Return error: "Beta is invite-only. Request access at [URL]"
```

### Phase 2: Public Trial

```
Admin updates: access_control_config.beta_mode_enabled = false
Admin updates: access_control_config.trial_enabled = true
  ↓
User signs up with email (any email)
  ↓
Edge function checks if user_profile exists
  ↓ (if not)
Create user_profile with:
  - tier = 'trial'
  - tier_expires_at = NOW() + trial_duration_days
  ↓
Return: { allowed: true, tier: 'trial', days_left: 14 }
```

### Phase 3: Trial Expired → Paid Conversion

```
User's trial expires (tier_expires_at < NOW())
  ↓
Edge function blocks access
  ↓
Return: { allowed: false, reason: 'trial_expired', redirect: '/pricing' }
  ↓
User subscribes via Stripe
  ↓
Stripe webhook updates user_profile:
  - tier = 'basic' or 'pro'
  - stripe_subscription_id = 'sub_...'
  - subscription_status = 'active'
  - tier_expires_at = NULL
  ↓
Edge function allows access
```

---

## Database Migration Plan

### Migration 1: Core Tables (Phase 3)
**File:** `supabase/migrations/20251016_phase3_v2_core_tables.sql`

**Creates:**
- `user_profiles`
- `user_auth_tokens` (already exists, may need updates)
- `user_calendar_config` (already exists)
- `beta_whitelist`
- `access_control_config`

**Includes:**
- RLS policies
- Indexes
- Triggers (updated_at)
- Initial config data

### Migration 2: Data Migration (After Testing)
**File:** `supabase/migrations/20251016_phase3_v2_data_migration.sql`

**Migrates:**
- Existing auth.users → user_profiles
- Existing token data → user_auth_tokens (if any)
- Existing calendar config → user_calendar_config (if any)

**Runs:** Only after schema is deployed and tested

---

## Edge Function Integration

### JWT Edge Function Updates

The JWT edge function needs to check access control before issuing tokens.

**Current flow:**
1. User authenticates with Supabase Auth
2. Edge function issues JWT
3. App uses JWT for settings/data

**New flow:**
1. User authenticates with Supabase Auth
2. **Edge function checks user access**
3. If allowed: Issue JWT with tier info
4. If denied: Return access error with reason
5. App handles access denial (show upgrade prompt, etc.)

**Implementation:**
```javascript
// In JWT edge function
async function handleJWTRequest(authUser) {
  // Check access control
  const access = await checkUserAccess(authUser.id, authUser.email);

  if (!access.allowed) {
    return new Response(JSON.stringify({
      error: 'access_denied',
      reason: access.reason,
      message: getAccessDeniedMessage(access.reason)
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Include tier info in JWT
  const jwt = await generateJWT({
    userId: authUser.id,
    email: authUser.email,
    tier: access.tier,
    tierExpiresAt: access.tier_expires_at,
    maxDashboards: access.max_dashboards,
    maxCalendars: access.max_calendars
  });

  return new Response(JSON.stringify({ jwt, access }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

## Tier Limits (Configured per tier)

| Feature | Beta | Trial | Basic | Pro |
|---------|------|-------|-------|-----|
| Dashboard instances | Unlimited | 1 | 1 | 3 |
| Calendar accounts | Unlimited | 2 | 2 | 5 |
| Photo storage (GB) | Unlimited | 1 | 5 | 25 |
| Widget access | All | All | All | All |
| Priority support | Yes | No | No | Yes |
| Custom themes | Yes | No | No | Yes |

**Stored in:** `user_profiles.max_dashboards`, `user_profiles.max_calendars`

**Enforcement:**
- Edge functions check limits before allowing operations
- Client-side checks for UX (but server is source of truth)

---

## Client-Side Usage

### Checking User Access

```javascript
// In client app initialization
const jwt = await JWTService.getToken();

if (jwt.error === 'access_denied') {
  // Show access denied screen
  if (jwt.reason === 'beta_not_whitelisted') {
    showBetaRequestScreen();
  } else if (jwt.reason === 'trial_expired') {
    showUpgradeScreen();
  } else if (jwt.reason === 'subscription_inactive') {
    showBillingScreen();
  }
  return;
}

// Access granted
const userTier = jwt.tier;
const daysLeft = jwt.trial_days_left;

if (userTier === 'trial' && daysLeft <= 3) {
  showTrialExpiringBanner(daysLeft);
}

// Initialize app...
```

### Checking Feature Access

```javascript
// Check if user can add another dashboard
if (userDashboardCount >= jwt.max_dashboards) {
  showUpgradePrompt('You\'ve reached your dashboard limit. Upgrade to Pro for 3 dashboards.');
  return;
}

// Check if user can add another calendar
if (userCalendarCount >= jwt.max_calendars) {
  showUpgradePrompt('You\'ve reached your calendar limit. Upgrade to Pro for 5 accounts.');
  return;
}
```

---

## Admin Tools Needed

### Beta Management
- Add/remove emails from beta_whitelist
- View beta user activity
- Bulk import beta emails

### Config Management
- Update access_control_config values
- View current access control state
- Schedule config changes (e.g., "exit beta on [date]")

### User Management
- View user profiles and tiers
- Manually grant/revoke access
- Change user tiers (for support/grandfathering)
- View subscription status

**Future phase:** Build admin dashboard for these operations

---

## Testing Checklist

### Beta Access Control
- [ ] New user with whitelisted email can sign up
- [ ] New user without whitelisted email is blocked
- [ ] Beta user is granted 'beta' tier
- [ ] access_granted_at is updated on first sign-in

### Trial Access Control
- [ ] Disable beta mode, enable trial mode
- [ ] New user gets trial tier with expiration
- [ ] Trial user can access app
- [ ] Edge function returns correct trial_days_left
- [ ] Expired trial user is blocked

### Stripe Integration
- [ ] Webhook updates user_profile on subscription created
- [ ] Tier changes from trial to basic/pro
- [ ] subscription_status updates on payment events
- [ ] Failed payment updates status to past_due
- [ ] Canceled subscription blocks access

### Tier Limits
- [ ] User cannot exceed max_dashboards
- [ ] User cannot exceed max_calendars
- [ ] Edge function enforces limits
- [ ] Client shows upgrade prompt at limit

---

## Next Steps After Phase 3

1. **Stripe Integration** - Webhook handlers, subscription management
2. **Admin Dashboard** - Tools to manage users, config, beta whitelist
3. **Analytics Tables** - Add tracking tables from Feature Roadmap (when needed)
4. **Multi-Device Support** - Add dashboards table (when requested by users)

---

## Summary

**Phase 3 Database (v2.0) includes:**
- ✅ `user_profiles` - Tier, subscription, limits
- ✅ `user_auth_tokens` - Secure OAuth storage
- ✅ `user_calendar_config` - Calendar settings
- ✅ `beta_whitelist` - Beta access control
- ✅ `access_control_config` - Config-driven access

**Deferred to future phases:**
- Analytics tables (user_sessions, widget_analytics, system_events)
- Multi-device table (dashboards)
- Fraud prevention (account_clusters, abuse_patterns)
- Feature usage tracking

See [Feature_Roadmap.md](.reference/Feature_Roadmap.md) for deferred table specs.
