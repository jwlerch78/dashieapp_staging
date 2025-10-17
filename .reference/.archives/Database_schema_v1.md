# Dashie Database Schema Reference

**Version:** 1.0  
**Status:** Draft Concept  
**Purpose:** Comprehensive user analytics, multi-device management, and abuse prevention

---

## Table of Contents

1. [Core Tables](#core-tables)
   - [users](#users)
   - [dashboards](#dashboards)
2. [Activity Tracking](#activity-tracking)
   - [user_sessions](#user_sessions)
   - [widget_analytics](#widget_analytics)
   - [system_events](#system_events)
3. [Usage & Billing](#usage--billing)
   - [feature_usage](#feature_usage)
   - [stripe_webhook_events](#stripe_webhook_events)
4. [Analytics & Metrics](#analytics--metrics)
   - [daily_metrics](#daily_metrics)
   - [geographic_stats](#geographic_stats)
5. [Fraud Prevention](#fraud-prevention)
   - [account_clusters](#account_clusters)
   - [abuse_patterns](#abuse_patterns)

---

## Core Tables

### users

**Purpose:** Central user account and profile management

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique user identifier | Primary key for all user references |
| `email` | TEXT | User's email address | Authentication identifier and contact |
| `name` | TEXT | User's display name | Personalization and UI display |
| `picture_url` | TEXT | URL to user's profile photo | Avatar display in UI |
| `auth_provider` | TEXT | Authentication method used | Track which auth flow user came from |
| `stripe_customer_id` | TEXT | Stripe customer ID | Link user to Stripe subscription data |
| `tier` | TEXT | Current subscription tier | Access control and feature gating |
| `max_dashboards` | INTEGER | Maximum allowed dashboards | Tier-based usage enforcement |
| `first_sign_in_at` | TIMESTAMPTZ | When user first authenticated | User lifecycle tracking |
| `last_sign_in_at` | TIMESTAMPTZ | Most recent authentication event | Distinguish auth from activity |
| `sign_in_count` | INTEGER | Total authentication events | Login frequency analytics |
| `last_seen_at` | TIMESTAMPTZ | Most recent dashboard activity | Real usage vs just signed up |
| `last_heartbeat_at` | TIMESTAMPTZ | Last system health ping | Active dashboard detection |
| `is_currently_active` | BOOLEAN | Dashboard currently running | Real-time active user count |
| `signup_ip_hash` | TEXT | Hashed IP from registration | Geographic analytics and abuse detection |
| `last_known_ip_hash` | TEXT | Hashed current IP address | Location tracking and multi-account detection |
| `country_code` | TEXT | User's country code | Geographic usage patterns |
| `timezone` | TEXT | User's timezone | Activity pattern analysis |
| `device_fingerprint_hash` | TEXT | Hashed browser/device signature | Multi-account and fraud detection |
| `current_app_version` | TEXT | Version of app user is running | Version adoption tracking |
| `last_version_check` | TIMESTAMPTZ | When app last checked for updates | Update deployment monitoring |
| `needs_reload` | BOOLEAN | Force app reload flag | Admin control for critical updates |
| `analytics_consent` | BOOLEAN | User agreed to analytics tracking | GDPR compliance and privacy |
| `data_retention_days` | INTEGER | How long to keep user's data | Data governance and privacy |
| `data_deletion_requested_at` | TIMESTAMPTZ | When user requested data deletion | Right to be forgotten compliance |
| `is_active` | BOOLEAN | Account is active (not suspended) | Account status management |
| `created_at` | TIMESTAMPTZ | Account creation timestamp | User lifecycle and cohort analysis |
| `updated_at` | TIMESTAMPTZ | Last profile update | Data freshness tracking |

**Indexes:**
- Primary: `id`
- Unique: `email`, `stripe_customer_id`
- Indexed: `tier`, `is_currently_active`, `country_code`

---

### dashboards

**Purpose:** Track individual dashboard instances across multiple devices per user

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique dashboard identifier | Primary key for dashboard instances |
| `user_id` | UUID | Owner of this dashboard | Link dashboard to user account |
| `device_name` | TEXT | User-friendly device name | Dashboard identification in multi-device setups |
| `device_type` | TEXT | Type of device running dashboard | Platform-specific analytics and support |
| `device_fingerprint_hash` | TEXT | Hashed unique device identifier | Device tracking and fraud prevention |
| `active_widgets` | TEXT[] | List of enabled widgets | Feature usage and preference tracking |
| `theme` | TEXT | UI theme preference | User experience personalization |
| `is_online` | BOOLEAN | Dashboard currently connected | Real-time system health monitoring |
| `last_heartbeat_at` | TIMESTAMPTZ | Last health check ping | Connection status and uptime tracking |
| `current_version` | TEXT | App version running on device | Version distribution and compatibility |
| `needs_update` | BOOLEAN | Device needs app update | Forced update deployment |
| `total_sessions` | INTEGER | Lifetime session count | Usage frequency analytics |
| `total_uptime_minutes` | BIGINT | Total time dashboard has been running | Engagement and value metrics |
| `last_crash_at` | TIMESTAMPTZ | When dashboard last crashed | Stability and reliability tracking |
| `crash_count` | INTEGER | Total number of crashes | Device/platform reliability metrics |
| `created_at` | TIMESTAMPTZ | When dashboard was first set up | Dashboard lifecycle tracking |
| `updated_at` | TIMESTAMPTZ | Last configuration change | Activity and maintenance tracking |

**Indexes:**
- Primary: `id`
- Foreign Key: `user_id` → `users.id`
- Indexed: `user_id`, `is_online`, `device_fingerprint_hash`

---

## Activity Tracking

### user_sessions

**Purpose:** Track individual usage sessions for engagement and behavior analysis

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique session identifier | Primary key for activity sessions |
| `user_id` | UUID | User who owns this session | Link session to user account |
| `dashboard_id` | UUID | Dashboard instance for this session | Multi-device session tracking |
| `started_at` | TIMESTAMPTZ | When session began | Session timing and duration analysis |
| `ended_at` | TIMESTAMPTZ | When session ended | Session completion tracking |
| `duration_minutes` | INTEGER | Total session length | Engagement and usage pattern analysis |
| `ip_address_hash` | TEXT | Hashed IP address for session | Geographic and network analysis |
| `user_agent` | TEXT | Browser/device info | Platform compatibility tracking |
| `country_code` | TEXT | Session location | Geographic usage patterns |
| `auth_method` | TEXT | How user authenticated | Auth method effectiveness tracking |
| `widgets_interacted` | TEXT[] | Widgets used during session | Feature engagement tracking |
| `settings_changed` | BOOLEAN | User modified settings | Configuration activity tracking |
| `error_count` | INTEGER | Errors encountered in session | Session quality metrics |

**Indexes:**
- Primary: `id`
- Foreign Keys: `user_id` → `users.id`, `dashboard_id` → `dashboards.id`
- Indexed: `user_id`, `started_at`, `country_code`

---

### widget_analytics

**Purpose:** Granular tracking of widget interactions and feature usage

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique event identifier | Primary key for widget events |
| `user_id` | UUID | User who triggered event | User behavior attribution |
| `dashboard_id` | UUID | Dashboard where event occurred | Device-specific usage patterns |
| `session_id` | UUID | Session containing this event | Event context and session flow |
| `widget_type` | TEXT | Which widget was interacted with | Feature popularity and usage |
| `event_type` | TEXT | Type of interaction | Engagement depth analysis |
| `event_data` | JSONB | Detailed event information | Custom analytics and debugging |
| `duration_seconds` | INTEGER | Time spent on widget | Engagement intensity metrics |
| `timestamp` | TIMESTAMPTZ | When event occurred | Event timing and sequence analysis |

**Indexes:**
- Primary: `id`
- Foreign Keys: `user_id` → `users.id`, `session_id` → `user_sessions.id`
- Indexed: `widget_type`, `timestamp`, `user_id`

---

### system_events

**Purpose:** Error logging, crash reporting, and system health monitoring

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique event identifier | Primary key for system events |
| `user_id` | UUID | User associated with event | Error attribution and user impact |
| `dashboard_id` | UUID | Dashboard where event occurred | Device-specific issue tracking |
| `event_type` | TEXT | Category of system event | Error classification and trending |
| `severity` | TEXT | Impact level of event | Issue prioritization and alerting |
| `message` | TEXT | Human-readable event description | Error reporting and debugging |
| `error_details` | JSONB | Technical error information | Debugging and root cause analysis |
| `user_agent` | TEXT | Browser/device info | Platform-specific issue tracking |
| `app_version` | TEXT | App version when error occurred | Version-specific bug tracking |
| `resolved_at` | TIMESTAMPTZ | When issue was fixed | Issue resolution tracking |
| `created_at` | TIMESTAMPTZ | When event was logged | Event timing and pattern analysis |

**Indexes:**
- Primary: `id`
- Foreign Keys: `user_id` → `users.id`
- Indexed: `event_type`, `severity`, `created_at`, `app_version`

---

## Usage & Billing

### feature_usage

**Purpose:** Track feature consumption for tier limits and billing

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `user_id` | UUID | User consuming the feature | Feature usage attribution |
| `feature_name` | TEXT | Name of feature being tracked | Feature identification |
| `usage_count` | INTEGER | How many times feature was used | Usage frequency for tier limits |
| `period_start` | DATE | Start of usage tracking period | Usage period management |
| `reset_date` | DATE | When usage count resets | Billing cycle alignment |

**Indexes:**
- Composite Primary: `(user_id, feature_name, period_start)`
- Foreign Key: `user_id` → `users.id`

---

### stripe_webhook_events

**Purpose:** Audit trail for Stripe payment and subscription events

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique webhook identifier | Primary key for Stripe events |
| `stripe_event_id` | TEXT | Stripe's unique event ID | Deduplication and audit trail |
| `event_type` | TEXT | Type of Stripe event | Event classification and routing |
| `user_id` | UUID | User affected by event | Event attribution |
| `old_tier` | TEXT | Previous subscription tier | Tier change tracking |
| `new_tier` | TEXT | New subscription tier | Tier change tracking |
| `processed_at` | TIMESTAMPTZ | When webhook was handled | Processing timing |
| `event_data` | JSONB | Full Stripe webhook payload | Complete event context |
| `processing_status` | TEXT | Webhook handling status | Error and retry tracking |
| `created_at` | TIMESTAMPTZ | When webhook was received | Event timing |

**Indexes:**
- Primary: `id`
- Unique: `stripe_event_id`
- Foreign Key: `user_id` → `users.id`
- Indexed: `event_type`, `created_at`

---

## Analytics & Metrics

### daily_metrics

**Purpose:** Aggregated daily statistics for business intelligence

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `date` | DATE | Date for metrics snapshot | Time series analytics |
| `new_signups` | INTEGER | New user registrations | Growth tracking |
| `returning_users` | INTEGER | Users who came back | Retention metrics |
| `active_dashboards` | INTEGER | Dashboards that were online | Real usage vs signups |
| `total_sessions` | INTEGER | Total activity sessions | Engagement volume |
| `avg_session_minutes` | DECIMAL | Average session length | Engagement quality |
| `trial_to_paid_conversions` | INTEGER | Users who upgraded from trial | Conversion funnel tracking |
| `created_at` | TIMESTAMPTZ | When metrics were calculated | Data freshness tracking |

**Indexes:**
- Primary: `date`
- Indexed: `date` (for time series queries)

---

### geographic_stats

**Purpose:** Country-level usage and revenue analytics

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `country_code` | TEXT | ISO country code | Geographic identification |
| `total_users` | INTEGER | All users from country | Market size tracking |
| `active_users_30d` | INTEGER | Recently active users | Market engagement |
| `trial_users` | INTEGER | Users on trial tier | Conversion opportunity size |
| `paid_users` | INTEGER | Users on paid tiers | Revenue-generating market size |
| `avg_session_duration_minutes` | DECIMAL | Average engagement time | Market engagement quality |
| `last_updated` | TIMESTAMPTZ | When stats were refreshed | Data freshness tracking |

**Indexes:**
- Primary: `country_code`
- Indexed: `paid_users`, `active_users_30d`

---

## Fraud Prevention

### account_clusters

**Purpose:** Detect and track potentially related accounts for abuse prevention

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique cluster identifier | Primary key for account groups |
| `cluster_type` | TEXT | How accounts were grouped | Clustering algorithm identification |
| `identifier_hash` | TEXT | Hashed common identifier | Privacy-safe grouping key |
| `user_ids` | UUID[] | List of users in cluster | Account group membership |
| `first_detected_at` | TIMESTAMPTZ | When cluster was discovered | Pattern detection timing |
| `is_reviewed` | BOOLEAN | Human has reviewed cluster | Manual verification status |
| `admin_notes` | TEXT | Investigation notes | Manual review documentation |
| `risk_level` | TEXT | Assessed threat level | Risk prioritization |

**Indexes:**
- Primary: `id`
- Indexed: `cluster_type`, `identifier_hash`, `is_reviewed`

---

### abuse_patterns

**Purpose:** Flag and track suspicious user behavior

| Column | Type | Description | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | Unique pattern identifier | Primary key for abuse detection |
| `pattern_type` | TEXT | Type of suspicious behavior | Abuse classification |
| `user_id` | UUID | User exhibiting pattern | Individual abuse tracking |
| `detected_at` | TIMESTAMPTZ | When pattern was identified | Detection timing |
| `confidence_score` | DECIMAL | Algorithm confidence level | Detection reliability metric |
| `auto_flagged` | BOOLEAN | System automatically flagged | Automation vs manual detection |
| `human_reviewed` | BOOLEAN | Person has reviewed case | Manual verification status |
| `action_taken` | TEXT | What was done about it | Response tracking |

**Indexes:**
- Primary: `id`
- Foreign Key: `user_id` → `users.id`
- Indexed: `pattern_type`, `confidence_score`, `detected_at`

---

## Relationships