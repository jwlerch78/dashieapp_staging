// js/supabase/supabase-config.js - Supabase Configuration

import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

// Get these from your Supabase dashboard under Settings > API
const supabaseUrl = 'https://your-project-ref.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-actual-anon-key-here';

// NEVER use the service_role key in frontend code!
// const supabaseServiceKey = 'service_role_key'; // ❌ DON'T DO THIS

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Don't persist session in localStorage since we handle auth ourselves
    persistSession: false,
    // Don't auto-refresh tokens
    autoRefreshToken: false,
    // Don't detect session from URL
    detectSessionInUrl: false
  }
});

console.log('📊 Supabase client initialized:', supabaseUrl);
