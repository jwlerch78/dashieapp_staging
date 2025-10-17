-- Phase 3: Data Layer - Separate Auth Tokens and Calendar Config
-- Migration: 20251016_phase3_data_separation.sql
--
-- This migration separates authentication tokens and calendar configuration
-- from the main user_settings table to improve security, performance, and maintainability.

-- ============================================================================
-- TABLE: user_auth_tokens
-- Purpose: Store OAuth tokens and authentication credentials separately from settings
-- Security: Prevents settings operations from accidentally wiping auth data
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

-- Enable Row Level Security
ALTER TABLE user_auth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own tokens
CREATE POLICY "Users can manage own auth tokens"
  ON user_auth_tokens
  FOR ALL
  USING (auth.uid() = auth_user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_auth_tokens_user_id ON user_auth_tokens(auth_user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_auth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_auth_tokens_timestamp
  BEFORE UPDATE ON user_auth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_user_auth_tokens_updated_at();

COMMENT ON TABLE user_auth_tokens IS 'Stores OAuth tokens and authentication credentials separately from user settings for security';
COMMENT ON COLUMN user_auth_tokens.tokens IS 'JSONB object containing provider tokens: { "google": { "primary": { access_token, refresh_token, expires_at, ... } } }';

-- ============================================================================
-- TABLE: user_calendar_config
-- Purpose: Store calendar configuration separately from general settings
-- Performance: Reduces settings table size and allows independent updates
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_calendar_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Active calendar IDs using account-prefixed format
  -- Format: ["primary-user@gmail.com", "account2-shared@gmail.com"]
  active_calendar_ids TEXT[] NOT NULL DEFAULT '{}',

  -- Account metadata
  -- Structure: { "primary": { "email": "user@gmail.com", "display_name": "John", ... }, "account2": { ... } }
  accounts JSONB NOT NULL DEFAULT '{}',

  -- Calendar-to-account mapping (for backwards compatibility during migration)
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

-- Enable Row Level Security
ALTER TABLE user_calendar_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own calendar config
CREATE POLICY "Users can manage own calendar config"
  ON user_calendar_config
  FOR ALL
  USING (auth.uid() = auth_user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_calendar_config_user_id ON user_calendar_config(auth_user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_calendar_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_calendar_config_timestamp
  BEFORE UPDATE ON user_calendar_config
  FOR EACH ROW
  EXECUTE FUNCTION update_user_calendar_config_updated_at();

COMMENT ON TABLE user_calendar_config IS 'Stores calendar configuration separately from general settings for better performance and maintainability';
COMMENT ON COLUMN user_calendar_config.active_calendar_ids IS 'Array of active calendar IDs using account-prefixed format (e.g., "primary-user@gmail.com")';
COMMENT ON COLUMN user_calendar_config.accounts IS 'JSONB object containing account metadata for each connected calendar provider';
COMMENT ON COLUMN user_calendar_config.calendar_account_map IS 'Maps raw calendar IDs to account types (for backwards compatibility)';
COMMENT ON COLUMN user_calendar_config.calendar_settings IS 'Calendar-specific settings like default view, event display preferences, etc.';

-- ============================================================================
-- DATA MIGRATION (Optional - Run separately after deployment)
-- ============================================================================

-- Migration function to move data from user_settings to new tables
-- This is commented out by default - run manually after schema is deployed

/*
-- Migrate auth tokens
INSERT INTO user_auth_tokens (auth_user_id, tokens)
SELECT
  auth_user_id,
  COALESCE(settings->'tokenAccounts', '{}'::jsonb)
FROM user_settings
WHERE settings ? 'tokenAccounts'
ON CONFLICT (auth_user_id) DO UPDATE
  SET tokens = EXCLUDED.tokens;

-- Migrate calendar config
INSERT INTO user_calendar_config (
  auth_user_id,
  active_calendar_ids,
  accounts,
  calendar_account_map,
  calendar_settings
)
SELECT
  auth_user_id,
  COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(settings->'activeCalendarIds')),
    '{}'::text[]
  ),
  COALESCE(settings->'accounts', '{}'::jsonb),
  COALESCE(settings->'calendarAccountMap', '{}'::jsonb),
  COALESCE(settings->'calendar', '{}'::jsonb)
FROM user_settings
WHERE settings ? 'activeCalendarIds' OR settings ? 'accounts'
ON CONFLICT (auth_user_id) DO UPDATE
  SET
    active_calendar_ids = EXCLUDED.active_calendar_ids,
    accounts = EXCLUDED.accounts,
    calendar_account_map = EXCLUDED.calendar_account_map,
    calendar_settings = EXCLUDED.calendar_settings;

-- OPTIONAL: Clean up old data from user_settings after verification
-- Uncomment only after confirming migration was successful

-- UPDATE user_settings
-- SET settings = settings - 'tokenAccounts' - 'activeCalendarIds' - 'accounts' - 'calendarAccountMap'
-- WHERE settings ? 'tokenAccounts' OR settings ? 'activeCalendarIds';
*/

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================

-- Count users with tokens in old location
-- SELECT COUNT(*) FROM user_settings WHERE settings ? 'tokenAccounts';

-- Count users with tokens in new location
-- SELECT COUNT(*) FROM user_auth_tokens;

-- Count users with calendar config in old location
-- SELECT COUNT(*) FROM user_settings WHERE settings ? 'activeCalendarIds';

-- Count users with calendar config in new location
-- SELECT COUNT(*) FROM user_calendar_config;
