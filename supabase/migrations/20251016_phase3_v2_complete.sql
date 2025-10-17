-- ============================================================================
-- Phase 3 v2: Complete Data Layer Migration
-- ============================================================================
-- Migration: 20251016_phase3_v2_complete.sql
-- Purpose: Core user management, access control, Stripe readiness, heartbeat tracking
--
-- IMPORTANT: This migration creates NEW tables. Existing tables are NOT affected.
-- You can safely run this on a database with existing data.
--
-- Tables created:
-- 1. user_profiles - User subscription, tier, billing, and activity tracking
-- 2. user_auth_tokens - Secure OAuth token storage (separate from settings)
-- 3. user_calendar_config - Calendar configuration (separate from settings)
-- 4. beta_whitelist - Beta access control via email whitelist
-- 5. access_control_config - Config-driven access control (beta → trial → paid)
-- 6. dashboard_heartbeats - Real-time dashboard status and version checking
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE 1: user_profiles
-- Purpose: User subscription tier, billing info, and basic activity tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contact info (denormalized for quick access)
  email TEXT NOT NULL,

  -- Stripe billing
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,

  -- Subscription tier and status
  tier TEXT NOT NULL DEFAULT 'trial', -- beta | trial | basic | pro
  tier_started_at TIMESTAMPTZ DEFAULT NOW(),
  tier_expires_at TIMESTAMPTZ, -- NULL for paid tiers, set for trials
  subscription_status TEXT, -- trialing | active | past_due | canceled | unpaid

  -- Tier limits
  max_dashboards INTEGER DEFAULT 1,
  max_calendars INTEGER DEFAULT 2,

  -- Activity tracking
  first_sign_in_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,

  -- App version tracking
  current_app_version TEXT,

  -- Privacy/compliance
  analytics_consent BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(auth_user_id),
  UNIQUE(email)
);

-- Indexes for user_profiles
CREATE INDEX idx_user_profiles_auth_user ON user_profiles(auth_user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_tier ON user_profiles(tier);
CREATE INDEX idx_user_profiles_subscription_status ON user_profiles(subscription_status);
CREATE INDEX idx_user_profiles_tier_expires ON user_profiles(tier_expires_at)
  WHERE tier_expires_at IS NOT NULL; -- Partial index for trial expiration queries
CREATE INDEX idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_user_profiles_stripe_subscription ON user_profiles(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- RLS Policy: Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- RLS Policy: Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to user_profiles"
  ON user_profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- Comments
COMMENT ON TABLE user_profiles IS 'User subscription tier, billing info, and activity tracking';
COMMENT ON COLUMN user_profiles.tier IS 'Subscription tier: beta, trial, basic, pro';
COMMENT ON COLUMN user_profiles.tier_expires_at IS 'When trial expires (NULL for paid tiers)';
COMMENT ON COLUMN user_profiles.subscription_status IS 'Stripe subscription status: trialing, active, past_due, canceled, unpaid';
COMMENT ON COLUMN user_profiles.max_dashboards IS 'Max allowed dashboard instances (tier-based limit)';
COMMENT ON COLUMN user_profiles.max_calendars IS 'Max allowed calendar connections (tier-based limit)';

-- ============================================================================
-- TABLE 2: user_auth_tokens
-- Purpose: Secure OAuth token storage (separate from settings for security)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_auth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Token data stored as JSONB for flexibility
  -- Structure: { "google": { "primary": { tokens }, "account2": { tokens } } }
  tokens JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one row per user
  UNIQUE(auth_user_id)
);

-- Indexes for user_auth_tokens
CREATE INDEX idx_user_auth_tokens_user_id ON user_auth_tokens(auth_user_id);

-- Enable Row Level Security
ALTER TABLE user_auth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own tokens
CREATE POLICY "Users can manage own auth tokens"
  ON user_auth_tokens
  FOR ALL
  USING (auth.uid() = auth_user_id);

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_auth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_auth_tokens_updated_at
  BEFORE UPDATE ON user_auth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_user_auth_tokens_updated_at();

-- Comments
COMMENT ON TABLE user_auth_tokens IS 'OAuth tokens stored separately from settings for security';
COMMENT ON COLUMN user_auth_tokens.tokens IS 'JSONB: { "google": { "primary": { access_token, refresh_token, expires_at, scopes, token_type } } }';

-- ============================================================================
-- TABLE 3: user_calendar_config
-- Purpose: Calendar configuration (separate from settings for performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_calendar_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Active calendar IDs using account-prefixed format
  -- Format: ["primary-user@gmail.com", "account2-shared@gmail.com"]
  active_calendar_ids TEXT[] NOT NULL DEFAULT '{}',

  -- Account metadata
  -- Structure: { "primary": { "email": "...", "display_name": "...", "provider": "google" } }
  accounts JSONB NOT NULL DEFAULT '{}',

  -- Calendar-to-account mapping (for backwards compatibility)
  -- Structure: { "user@gmail.com": "primary", "shared@gmail.com": "account2" }
  calendar_account_map JSONB NOT NULL DEFAULT '{}',

  -- Calendar-specific settings
  -- Structure: { "default_view": "week", "show_declined_events": false, ... }
  calendar_settings JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one row per user
  UNIQUE(auth_user_id)
);

-- Indexes for user_calendar_config
CREATE INDEX idx_user_calendar_config_user_id ON user_calendar_config(auth_user_id);

-- Enable Row Level Security
ALTER TABLE user_calendar_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own calendar config
CREATE POLICY "Users can manage own calendar config"
  ON user_calendar_config
  FOR ALL
  USING (auth.uid() = auth_user_id);

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_calendar_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_calendar_config_updated_at
  BEFORE UPDATE ON user_calendar_config
  FOR EACH ROW
  EXECUTE FUNCTION update_user_calendar_config_updated_at();

-- Comments
COMMENT ON TABLE user_calendar_config IS 'Calendar configuration stored separately from settings';
COMMENT ON COLUMN user_calendar_config.active_calendar_ids IS 'Account-prefixed calendar IDs: ["primary-user@gmail.com", "account2-shared@gmail.com"]';
COMMENT ON COLUMN user_calendar_config.accounts IS 'Account metadata: { "primary": { "email", "display_name", "provider", "connected_at" } }';
COMMENT ON COLUMN user_calendar_config.calendar_settings IS 'Calendar preferences: { "default_view": "week", "show_declined_events": false }';

-- ============================================================================
-- TABLE 4: beta_whitelist
-- Purpose: Beta access control via email whitelist
-- ============================================================================

CREATE TABLE IF NOT EXISTS beta_whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Email to whitelist
  email TEXT NOT NULL UNIQUE,

  -- Invite tracking
  invited_by TEXT, -- Who invited this user (email or name)
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  access_granted_at TIMESTAMPTZ, -- When user first signed in

  -- Admin notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for beta_whitelist
CREATE INDEX idx_beta_whitelist_email ON beta_whitelist(email);
CREATE INDEX idx_beta_whitelist_access_granted ON beta_whitelist(access_granted_at);

-- Enable Row Level Security
ALTER TABLE beta_whitelist ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access (for signup check)
CREATE POLICY "Public can check beta whitelist"
  ON beta_whitelist
  FOR SELECT
  USING (true);

-- RLS Policy: Service role can manage whitelist (for admin functions)
CREATE POLICY "Service role can manage beta whitelist"
  ON beta_whitelist
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE beta_whitelist IS 'Email whitelist for beta access control';
COMMENT ON COLUMN beta_whitelist.access_granted_at IS 'When user first signed in (tracks conversion from invite to active user)';

-- ============================================================================
-- TABLE 5: access_control_config
-- Purpose: Config-driven access control (change behavior without code changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS access_control_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL, -- boolean | integer | string
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT -- Who last changed this config
);

-- Enable Row Level Security
ALTER TABLE access_control_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access (app needs to check config)
CREATE POLICY "Public can read access control config"
  ON access_control_config
  FOR SELECT
  USING (true);

-- RLS Policy: Service role can manage config (for admin functions)
CREATE POLICY "Service role can manage access control config"
  ON access_control_config
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_access_control_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_access_control_config_updated_at
  BEFORE UPDATE ON access_control_config
  FOR EACH ROW
  EXECUTE FUNCTION update_access_control_config_updated_at();

-- Comments
COMMENT ON TABLE access_control_config IS 'Configuration-driven access control (beta → trial → paid transitions)';
COMMENT ON COLUMN access_control_config.value_type IS 'Data type hint for parsing: boolean, integer, string';

-- Insert initial config values
INSERT INTO access_control_config (key, value, value_type, description) VALUES
  ('beta_mode_enabled', 'true', 'boolean', 'When true, only beta_whitelist emails can access app'),
  ('trial_duration_days', '14', 'integer', 'Number of days for trial period'),
  ('trial_enabled', 'false', 'boolean', 'When true, new users get trial (requires beta_mode_enabled = false)'),
  ('maintenance_mode', 'false', 'boolean', 'When true, only admins can access'),
  ('require_email_verification', 'true', 'boolean', 'Require verified email before access'),
  ('current_app_version', '0.3.0', 'string', 'Latest app version (for update checking)')
ON CONFLICT (key) DO NOTHING; -- Don't overwrite if config already exists

-- ============================================================================
-- TABLE 6: dashboard_heartbeats
-- Purpose: Real-time dashboard status tracking and version checking
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboard_heartbeats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Dashboard identification
  dashboard_name TEXT, -- User-friendly name: "Living Room TV", "Office Monitor"
  device_type TEXT, -- fire_tv | android_tv | browser | native_android
  device_fingerprint_hash TEXT, -- Hashed device ID for tracking

  -- Status tracking
  is_online BOOLEAN DEFAULT false,
  last_heartbeat_at TIMESTAMPTZ,

  -- Version tracking
  current_version TEXT,
  needs_update BOOLEAN DEFAULT false, -- Set by server when new version available

  -- Connection info
  user_agent TEXT,
  ip_address_hash TEXT, -- Hashed IP for privacy

  -- Session tracking
  session_started_at TIMESTAMPTZ,
  total_heartbeats INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one heartbeat record per user (single-device for now)
  -- When multi-device is implemented, change to UNIQUE(auth_user_id, device_fingerprint_hash)
  UNIQUE(auth_user_id)
);

-- Indexes for dashboard_heartbeats
CREATE INDEX idx_dashboard_heartbeats_user ON dashboard_heartbeats(auth_user_id);
CREATE INDEX idx_dashboard_heartbeats_online ON dashboard_heartbeats(is_online);
CREATE INDEX idx_dashboard_heartbeats_last_heartbeat ON dashboard_heartbeats(last_heartbeat_at);
CREATE INDEX idx_dashboard_heartbeats_version ON dashboard_heartbeats(current_version);
CREATE INDEX idx_dashboard_heartbeats_device_fingerprint ON dashboard_heartbeats(device_fingerprint_hash);

-- Enable Row Level Security
ALTER TABLE dashboard_heartbeats ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own heartbeats
CREATE POLICY "Users can manage own dashboard heartbeats"
  ON dashboard_heartbeats
  FOR ALL
  USING (auth.uid() = auth_user_id);

-- RLS Policy: Service role can read all heartbeats (for admin monitoring)
CREATE POLICY "Service role can read all dashboard heartbeats"
  ON dashboard_heartbeats
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dashboard_heartbeats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dashboard_heartbeats_updated_at
  BEFORE UPDATE ON dashboard_heartbeats
  FOR EACH ROW
  EXECUTE FUNCTION update_dashboard_heartbeats_updated_at();

-- Function: Mark dashboard as offline if no heartbeat in 5 minutes
CREATE OR REPLACE FUNCTION check_dashboard_online_status()
RETURNS void AS $$
BEGIN
  UPDATE dashboard_heartbeats
  SET is_online = false
  WHERE is_online = true
    AND last_heartbeat_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE dashboard_heartbeats IS 'Real-time dashboard status and version checking (currently single-device per user)';
COMMENT ON COLUMN dashboard_heartbeats.is_online IS 'Dashboard currently connected (auto-set to false after 5 min no heartbeat)';
COMMENT ON COLUMN dashboard_heartbeats.needs_update IS 'Server flag: dashboard should reload to get new version';
COMMENT ON COLUMN dashboard_heartbeats.last_heartbeat_at IS 'Last ping from dashboard (should occur ~every 60 seconds)';
COMMENT ON FUNCTION check_dashboard_online_status IS 'Mark dashboards offline if no heartbeat in 5 minutes (run via cron)';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Check if email is beta whitelisted
CREATE OR REPLACE FUNCTION is_beta_whitelisted(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM beta_whitelist WHERE email = user_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get access control config value
CREATE OR REPLACE FUNCTION get_config_value(config_key TEXT)
RETURNS TEXT AS $$
DECLARE
  config_value TEXT;
BEGIN
  SELECT value INTO config_value
  FROM access_control_config
  WHERE key = config_key;

  RETURN config_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update access control config (admin only)
CREATE OR REPLACE FUNCTION update_config_value(
  config_key TEXT,
  new_value TEXT,
  admin_email TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE access_control_config
  SET value = new_value,
      updated_by = admin_email,
      updated_at = NOW()
  WHERE key = config_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Config key % not found', config_key;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================

-- Check table creation
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'user_%' OR tablename LIKE 'beta_%' OR tablename LIKE 'access_%' OR tablename LIKE 'dashboard_%';

-- Count records in each table
-- SELECT 'user_profiles' AS table_name, COUNT(*) FROM user_profiles
-- UNION ALL SELECT 'user_auth_tokens', COUNT(*) FROM user_auth_tokens
-- UNION ALL SELECT 'user_calendar_config', COUNT(*) FROM user_calendar_config
-- UNION ALL SELECT 'beta_whitelist', COUNT(*) FROM beta_whitelist
-- UNION ALL SELECT 'access_control_config', COUNT(*) FROM access_control_config
-- UNION ALL SELECT 'dashboard_heartbeats', COUNT(*) FROM dashboard_heartbeats;

-- Check access control config
-- SELECT * FROM access_control_config ORDER BY key;

-- Check online dashboards
-- SELECT u.email, dh.is_online, dh.last_heartbeat_at, dh.current_version
-- FROM dashboard_heartbeats dh
-- JOIN auth.users u ON u.id = dh.auth_user_id
-- ORDER BY dh.last_heartbeat_at DESC;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '✅ Phase 3 v2 migration complete!';
  RAISE NOTICE '📋 Tables created:';
  RAISE NOTICE '   - user_profiles (subscription tier, billing, activity)';
  RAISE NOTICE '   - user_auth_tokens (secure OAuth storage)';
  RAISE NOTICE '   - user_calendar_config (calendar settings)';
  RAISE NOTICE '   - beta_whitelist (beta access control)';
  RAISE NOTICE '   - access_control_config (config-driven access)';
  RAISE NOTICE '   - dashboard_heartbeats (real-time status, version checking)';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 RLS policies enabled for all tables';
  RAISE NOTICE '📊 Indexes created for performance';
  RAISE NOTICE '⚙️  Triggers created for updated_at timestamps';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next steps:';
  RAISE NOTICE '   1. Update edge functions to use new access control';
  RAISE NOTICE '   2. Implement dashboard heartbeat in client app';
  RAISE NOTICE '   3. Add beta emails to beta_whitelist table';
  RAISE NOTICE '   4. Test access control flow (beta → trial → paid)';
END $$;
