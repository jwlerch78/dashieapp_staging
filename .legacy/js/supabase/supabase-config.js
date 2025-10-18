// js/supabase/supabase-config.js - Supabase Configuration
// CHANGE SUMMARY: Lazy initialization to work with new architecture

import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

// Get config from parent window if in iframe, otherwise from current window
function getSupabaseConfig() {
  const config = window.parent?.currentDbConfig || window.currentDbConfig;

  if (!config) {
    console.error('❌ Supabase config not available in window or parent window!');
    throw new Error('Database configuration not initialized. Check load order.');
  }

  return config;
}

// Lazy initialization - don't create client until first access
let _supabase = null;
let _initialized = false;

function initializeSupabase() {
  if (_initialized) {
    return _supabase;
  }

  // Get database config based on environment (prod vs dev)
  const config = getSupabaseConfig();
  const supabaseUrl = config.supabaseUrl;
  const supabaseAnonKey = config.supabaseKey;

  // Create Supabase client
  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Don't persist session in localStorage since we handle auth ourselves
      persistSession: false,
      // Don't auto-refresh tokens
      autoRefreshToken: false,
      // Don't detect session from URL
      detectSessionInUrl: false
    }
  });

  // CRITICAL: Expose globally for real-time subscriptions
  window.supabase = _supabase;
  _initialized = true;

  console.log('📊 Supabase client initialized:', supabaseUrl);
  console.log('📊 Supabase client exposed globally as window.supabase');

  return _supabase;
}

// Export lazy getter
export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = initializeSupabase();
    return client[prop];
  }
});