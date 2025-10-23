# Dashie Feature Roadmap - Deferred Database Tables

**Purpose:** Track deferred features and database tables for future phases
**Status:** Living document - Updated as features are prioritized
**Source:** Tables from Database Schema v1.0 deferred to future implementation

---

## Quick Reference: When to Add Each Table

| Table | Phase | Trigger | Priority |
|-------|-------|---------|----------|
| `stripe_webhook_events` | 5 (Stripe) | Before disabling beta mode | **High** |
| `system_events` | 7 (Analytics) | After 50+ users | **Medium** |
| `user_sessions` | 7 (Analytics) | After 100+ users | Medium |
| `widget_analytics` | 9 (Advanced) | Only if needed for decisions | Low |
| `daily_metrics` | 7 (Analytics) | After 100+ users | Medium |
| `geographic_stats` | 9 (Advanced) | If targeting regions | Low |
| `dashboards` (multi-device) | 8 (Feature) | When users request it | Medium |
| `account_clusters` | 10 (Fraud) | If abuse detected | Low |
| `abuse_patterns` | 10 (Fraud) | If abuse detected | Low |
| `feature_usage` | 11 (Usage-based) | If usage-based pricing | Low |

---

## Deferred Tables

### stripe_webhook_events (Phase 5 - High Priority)

**Purpose:** Audit trail for Stripe payment and subscription events

**Add when:** Before disabling beta mode and accepting payments

```sql
CREATE TABLE stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_tier TEXT,
  new_tier TEXT,
  processed_at TIMESTAMPTZ,
  event_data JSONB NOT NULL,
  processing_status TEXT DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_webhooks_event_type ON stripe_webhook_events(event_type);
CREATE INDEX idx_stripe_webhooks_user ON stripe_webhook_events(user_id);
CREATE INDEX idx_stripe_webhooks_status ON stripe_webhook_events(processing_status);
```

**Why needed:** Idempotent webhook processing, audit trail, debugging billing issues

---

### system_events (Phase 7 - Medium Priority)

**Purpose:** Error logging, crash reporting, system health monitoring

**Add when:** After 50+ users, need proactive error tracking

```sql
CREATE TABLE system_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dashboard_id UUID, -- Reference to dashboards table when implemented
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- info, warning, error, critical
  message TEXT NOT NULL,
  error_details JSONB,
  user_agent TEXT,
  app_version TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_events_type ON system_events(event_type);
CREATE INDEX idx_system_events_severity ON system_events(severity);
CREATE INDEX idx_system_events_created ON system_events(created_at);
CREATE INDEX idx_system_events_version ON system_events(app_version);
```

**Why needed:** Proactive error monitoring, version-specific bug tracking

---

### user_sessions (Phase 7 - Medium Priority)

**Purpose:** Track usage sessions for engagement analysis

**Add when:** After 100+ users, need retention metrics

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dashboard_id UUID, -- Nullable until multi-device
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  ip_address_hash TEXT,
  user_agent TEXT,
  country_code TEXT,
  auth_method TEXT,
  widgets_interacted TEXT[],
  settings_changed BOOLEAN DEFAULT false,
  error_count INTEGER DEFAULT 0
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_started ON user_sessions(started_at);
CREATE INDEX idx_sessions_country ON user_sessions(country_code);
```

**Data retention:** Auto-delete after 90 days

---

### widget_analytics (Phase 9 - Low Priority)

**Purpose:** Granular widget interaction tracking

**Add when:** Need to understand feature popularity, A/B test changes

**Warning:** High data volume - needs partitioning

```sql
CREATE TABLE widget_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dashboard_id UUID,
  session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  event_type TEXT NOT NULL, -- view, click, configure, focus, active
  event_data JSONB,
  duration_seconds INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

CREATE INDEX idx_widget_analytics_type ON widget_analytics(widget_type);
CREATE INDEX idx_widget_analytics_timestamp ON widget_analytics(timestamp);
```

**Data retention:** Auto-delete after 30 days
**Estimated volume:** 1000 users × 100 events/session × 30 days = 3M records/month

---

### daily_metrics (Phase 7 - Medium Priority)

**Purpose:** Aggregated daily statistics

**Add when:** After 100+ users, need automated growth tracking

```sql
CREATE TABLE daily_metrics (
  date DATE PRIMARY KEY,
  new_signups INTEGER DEFAULT 0,
  returning_users INTEGER DEFAULT 0,
  active_dashboards INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  avg_session_minutes DECIMAL,
  trial_to_paid_conversions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Implementation:** Populate via nightly scheduled function

---

### geographic_stats (Phase 9 - Low Priority)

**Purpose:** Country-level usage analytics

**Add when:** Considering regional pricing or targeting

```sql
CREATE TABLE geographic_stats (
  country_code TEXT PRIMARY KEY,
  total_users INTEGER DEFAULT 0,
  active_users_30d INTEGER DEFAULT 0,
  trial_users INTEGER DEFAULT 0,
  paid_users INTEGER DEFAULT 0,
  avg_session_duration_minutes DECIMAL,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

**Implementation:** Materialized view, refresh daily

---

### dashboards (Phase 8 - Multi-Device Support)

**Purpose:** Track multiple dashboard instances per user

**Add when:** Users request multi-device support

**Note:** Currently user_profiles.dashboard_heartbeat serves single-device tracking

```sql
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT, -- fire_tv, android_tv, browser
  device_fingerprint_hash TEXT,
  active_widgets JSONB DEFAULT '{}',
  theme TEXT DEFAULT 'dark',
  is_online BOOLEAN DEFAULT false,
  last_heartbeat_at TIMESTAMPTZ,
  current_version TEXT,
  needs_update BOOLEAN DEFAULT false,
  total_sessions INTEGER DEFAULT 0,
  total_uptime_minutes BIGINT DEFAULT 0,
  last_crash_at TIMESTAMPTZ,
  crash_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dashboards_user ON dashboards(user_id);
CREATE INDEX idx_dashboards_online ON dashboards(is_online);
CREATE INDEX idx_dashboards_fingerprint ON dashboards(device_fingerprint_hash);
```

---

### account_clusters (Phase 10 - Fraud Prevention)

**Purpose:** Detect related accounts for abuse prevention

**Add when:** Abuse patterns detected

```sql
CREATE TABLE account_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_type TEXT NOT NULL, -- ip_hash, device_fingerprint, payment_method
  identifier_hash TEXT NOT NULL,
  user_ids UUID[] NOT NULL,
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  is_reviewed BOOLEAN DEFAULT false,
  admin_notes TEXT,
  risk_level TEXT -- low, medium, high
);

CREATE INDEX idx_clusters_type ON account_clusters(cluster_type);
CREATE INDEX idx_clusters_identifier ON account_clusters(identifier_hash);
CREATE INDEX idx_clusters_reviewed ON account_clusters(is_reviewed);
```

---

### abuse_patterns (Phase 10 - Fraud Prevention)

**Purpose:** Flag suspicious behavior

**Add when:** Automated abuse detection needed

```sql
CREATE TABLE abuse_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_type TEXT NOT NULL, -- trial_abuse, payment_fraud, api_abuse
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  confidence_score DECIMAL NOT NULL, -- 0.0-1.0
  auto_flagged BOOLEAN DEFAULT true,
  human_reviewed BOOLEAN DEFAULT false,
  action_taken TEXT -- warned, suspended, banned, false_positive
);

CREATE INDEX idx_abuse_type ON abuse_patterns(pattern_type);
CREATE INDEX idx_abuse_confidence ON abuse_patterns(confidence_score);
CREATE INDEX idx_abuse_detected ON abuse_patterns(detected_at);
```

---

### feature_usage (Phase 11 - Usage-Based Billing)

**Purpose:** Track feature consumption for limits

**Add when:** Implementing usage-based pricing

```sql
CREATE TABLE feature_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL, -- photo_uploads, calendar_syncs, api_calls
  usage_count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  reset_date DATE NOT NULL,
  PRIMARY KEY (user_id, feature_name, period_start)
);

CREATE INDEX idx_feature_usage_reset ON feature_usage(reset_date);
```

---

## Implementation Phases

### Phase 5: Stripe Integration (Before Public Launch)
**Tables:** `stripe_webhook_events`
**Why:** Essential for billing, high priority

### Phase 7: Analytics (Post-Launch, 100+ users)
**Tables:** `system_events`, `user_sessions`, `daily_metrics`
**Why:** Need data-driven decisions, error tracking

### Phase 8: Multi-Device (When Requested)
**Tables:** `dashboards`
**Why:** User feature request

### Phase 9: Advanced Analytics (Optional)
**Tables:** `widget_analytics`, `geographic_stats`
**Why:** Only if specific questions need answering

### Phase 10: Fraud Prevention (If Needed)
**Tables:** `account_clusters`, `abuse_patterns`
**Why:** Only if abuse becomes a problem

### Phase 11: Usage-Based Billing (Future)
**Tables:** `feature_usage`
**Why:** Only if changing pricing model

---

## Data Retention Policies (Implement with tables)

| Table | Retention | Strategy |
|-------|-----------|----------|
| `stripe_webhook_events` | 7 years | Legal requirement |
| `system_events` | 90 days | Auto-delete old events |
| `user_sessions` | 90 days | Auto-delete old sessions |
| `widget_analytics` | 30 days | Partition + auto-drop |
| `daily_metrics` | Forever | Small, aggregated |
| `geographic_stats` | Forever | Materialized view |

---

## Summary

**Current Phase 3:** Core tables only (user_profiles, auth_tokens, calendar_config, beta_whitelist, access_control_config, dashboard_heartbeats)

**Deferred:** All analytics, multi-device, fraud prevention tables

**Add tables incrementally** based on actual need, not speculation.
