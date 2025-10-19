// ============================================================================
// Database Operations Edge Function - Phase 4.3+
// ============================================================================
// Handles database CRUD operations requiring JWT authentication
//
// CALENDAR OPERATIONS:
// - save_calendar_config: Save active calendar IDs to user_calendar_config
// - load_calendar_config: Load active calendar IDs from user_calendar_config
//
// PHOTO STORAGE OPERATIONS:
// - get_storage_quota: Get user's photo storage quota and usage from user_storage_quota
// - init_storage_quota: Initialize storage quota for new user in user_storage_quota
// - create_photo_record: Create database record for uploaded photo in user_photos
// - update_storage_quota: Update storage usage in user_storage_quota after upload/delete
// - list_photos: List all photos for user from user_photos
// - list_folders: List all photo folders for user from user_photos
// - delete_photo: Delete a single photo record from user_photos
// - delete_all_photos: Delete all photo records for user from user_photos
//
// ACCOUNT OPERATIONS:
// - delete_account: Delete user account and all associated data
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verify } from 'https://deno.land/x/djwt@v2.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Environment variables
const JWT_SECRET = Deno.env.get('JWT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!JWT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables');
}

// ============================================================================
// ACCOUNT DELETION CONFIGURATION
// ============================================================================

/**
 * DELETION CONFIGURATION
 *
 * Explicitly list all tables to delete during account deletion.
 * Updated based on current schema (2025-10-18).
 *
 * Tables with auth_user_id that should be deleted:
 * - user_profiles: User subscription, tier, billing info
 * - user_auth_tokens: OAuth tokens (Google Calendar, etc.)
 * - user_calendar_config: Calendar selections and settings
 * - user_photos: Photo metadata
 * - user_storage_quota: Storage usage tracking
 * - user_settings: General user settings (theme, etc.)
 * - dashboard_heartbeats: Dashboard activity tracking (optional)
 *
 * Tables with auth_user_id that should NOT be deleted:
 * - None currently (all user data should be removed)
 *
 * Tables without auth_user_id (global/admin tables):
 * - beta_whitelist: Beta access control (keep for audit)
 * - access_control_config: Global configuration (keep)
 */
const DELETION_CONFIG = {
  // Tables to delete during account deletion (in order)
  tablesToDelete: [
    'user_photos',           // Delete photos first
    'user_storage_quota',    // Then storage quota
    'user_calendar_config',  // Calendar config
    'user_auth_tokens',      // OAuth tokens
    'user_settings',         // User settings
    'dashboard_heartbeats',  // Activity tracking
    'user_profiles'          // Finally, user profile
    // Note: auth.users record deleted separately via supabase.auth.admin.deleteUser()
  ],

  // Tables with storage bucket files that need cleanup
  tablesWithStorage: [
    {
      table: 'user_photos',
      storagePathColumns: ['storage_path', 'thumbnail_path'],
      bucket: 'photos'
    }
  ]
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { operation, data, active_calendar_ids } = body;

    console.log(`📊 Database operation request: ${operation}`);

    // ==================== JWT AUTHENTICATION ====================

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing Supabase JWT in Authorization header' }, 401);
    }

    const supabaseJWT = authHeader.replace('Bearer ', '');
    const userId = await verifySupabaseJWT(supabaseJWT);

    if (!userId) {
      return jsonResponse({ error: 'Invalid Supabase JWT' }, 401);
    }

    console.log(`🔐 ${operation} authenticated via JWT for user: ${userId}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ==================== OPERATION ROUTING ====================

    let result;

    // Calendar operations
    if (operation === 'save_calendar_config') {
      result = await handleSaveCalendarConfig(supabase, userId, active_calendar_ids);
    } else if (operation === 'load_calendar_config') {
      result = await handleLoadCalendarConfig(supabase, userId);

    // Photo storage operations
    } else if (operation === 'get_storage_quota') {
      result = await handleGetStorageQuota(supabase, userId);
    } else if (operation === 'init_storage_quota') {
      result = await handleInitStorageQuota(supabase, userId);
    } else if (operation === 'create_photo_record') {
      result = await handleCreatePhotoRecord(supabase, userId, data);
    } else if (operation === 'update_storage_quota') {
      result = await handleUpdateStorageQuota(supabase, userId, data);
    } else if (operation === 'list_photos') {
      result = await handleListPhotos(supabase, userId, data);
    } else if (operation === 'list_folders') {
      result = await handleListFolders(supabase, userId);
    } else if (operation === 'delete_photo') {
      result = await handleDeletePhoto(supabase, userId, data);
    } else if (operation === 'delete_all_photos') {
      result = await handleDeleteAllPhotos(supabase, userId);

    // Account operations
    } else if (operation === 'delete_account') {
      result = await handleDeleteAccount(supabase, userId);

    } else {
      return jsonResponse({ error: 'Invalid operation' }, 400);
    }

    return jsonResponse({ success: true, ...result }, 200);

  } catch (error: any) {
    console.error('🚨 Database operation error:', error);
    return jsonResponse({
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    }, 500);
  }
});

// ============================================================================
// CALENDAR CONFIG OPERATIONS
// ============================================================================

async function handleSaveCalendarConfig(
  supabase: any,
  authUserId: string,
  activeCalendarIds: string[]
) {
  try {
    console.log(`📅 Saving calendar config for user: ${authUserId}`, {
      count: activeCalendarIds?.length || 0,
      ids: activeCalendarIds
    });

    if (!Array.isArray(activeCalendarIds)) {
      throw new Error('active_calendar_ids must be an array');
    }

    // Upsert to user_calendar_config table
    const { data, error } = await supabase
      .from('user_calendar_config')
      .upsert({
        auth_user_id: authUserId,
        active_calendar_ids: activeCalendarIds,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'auth_user_id'
      })
      .select();

    if (error) {
      console.error('🚨 Save calendar config failed:', error);
      throw new Error(`Failed to save calendar config: ${error.message}`);
    }

    console.log(`✅ Calendar config saved for user: ${authUserId}`, {
      count: activeCalendarIds.length
    });

    return {
      message: 'Calendar config saved',
      count: activeCalendarIds.length
    };

  } catch (error) {
    console.error('🚨 handleSaveCalendarConfig error:', error);
    throw error;
  }
}

async function handleLoadCalendarConfig(
  supabase: any,
  authUserId: string
) {
  try {
    console.log(`📅 Loading calendar config for user: ${authUserId}`);

    // Load from user_calendar_config table
    const { data, error } = await supabase
      .from('user_calendar_config')
      .select('active_calendar_ids')
      .eq('auth_user_id', authUserId)
      .single();

    // If no record found, return empty array (first time user)
    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`📅 No calendar config found for user ${authUserId} (first time), returning empty array`);
        return {
          active_calendar_ids: []
        };
      }

      console.error('🚨 Load calendar config failed:', error);
      throw new Error(`Failed to load calendar config: ${error.message}`);
    }

    const activeCalendarIds = data?.active_calendar_ids || [];

    console.log(`✅ Calendar config loaded for user: ${authUserId}`, {
      count: activeCalendarIds.length,
      ids: activeCalendarIds
    });

    return {
      active_calendar_ids: activeCalendarIds
    };

  } catch (error) {
    console.error('🚨 handleLoadCalendarConfig error:', error);
    throw error;
  }
}

// ============================================================================
// PHOTO STORAGE OPERATIONS
// ============================================================================

async function handleGetStorageQuota(supabase: any, authUserId: string) {
  try {
    console.log(`📸 Getting storage quota for user: ${authUserId}`);

    const { data, error } = await supabase
      .from('user_storage_quota')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found - user needs initialization
        console.log(`📸 No quota record found for user ${authUserId}`);
        return { quota_found: false };
      }
      throw new Error(`Failed to get storage quota: ${error.message}`);
    }

    console.log(`✅ Storage quota retrieved for user: ${authUserId}`, {
      used: data.bytes_used,
      limit: data.quota_bytes
    });

    // Return flat structure expected by PhotoStorageService
    return {
      quota_found: true,
      bytes_used: data.bytes_used,
      quota_bytes: data.quota_bytes,
      storage_tier: data.storage_tier || 'free',
      photo_count: 0  // Not stored in quota table, calculated from user_photos
    };
  } catch (error) {
    console.error('🚨 handleGetStorageQuota error:', error);
    throw error;
  }
}

async function handleInitStorageQuota(supabase: any, authUserId: string) {
  try {
    console.log(`📸 Initializing storage quota for user: ${authUserId}`);

    // Default quota: 1GB = 1024 * 1024 * 1024 bytes (for beta users)
    const defaultQuota = 1024 * 1024 * 1024;

    const { data, error} = await supabase
      .from('user_storage_quota')
      .insert({
        auth_user_id: authUserId,
        bytes_used: 0,
        quota_bytes: defaultQuota,
        storage_tier: 'free'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to initialize storage quota: ${error.message}`);
    }

    console.log(`✅ Storage quota initialized for user: ${authUserId}`, {
      limit: defaultQuota
    });

    // Return flat structure expected by PhotoStorageService
    return {
      bytes_used: data.bytes_used,
      quota_bytes: data.quota_bytes,
      storage_tier: data.storage_tier || 'free',
      photo_count: 0  // Not stored in quota table
    };
  } catch (error) {
    console.error('🚨 handleInitStorageQuota error:', error);
    throw error;
  }
}

async function handleCreatePhotoRecord(supabase: any, authUserId: string, photoData: any) {
  try {
    const { storage_path, thumbnail_path, filename, folder_name, file_size, mime_type } = photoData;

    console.log(`📸 Creating photo record for user: ${authUserId}`, {
      filename,
      folder_name,
      file_size
    });

    const { data, error } = await supabase
      .from('user_photos')
      .insert({
        auth_user_id: authUserId,
        storage_path,
        thumbnail_path,
        filename,
        folder_name,
        file_size,
        mime_type,
        uploaded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create photo record: ${error.message}`);
    }

    console.log(`✅ Photo record created for user: ${authUserId}`);

    return { photo: data };
  } catch (error) {
    console.error('🚨 handleCreatePhotoRecord error:', error);
    throw error;
  }
}

async function handleUpdateStorageQuota(supabase: any, authUserId: string, updateData: any) {
  try {
    const { bytes_to_add } = updateData;

    console.log(`📸 Updating storage quota for user: ${authUserId}`, {
      bytes_to_add
    });

    // Get current quota
    const { data: currentQuota, error: fetchError } = await supabase
      .from('user_storage_quota')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch current quota: ${fetchError.message}`);
    }

    // Update quota
    const { data, error } = await supabase
      .from('user_storage_quota')
      .update({
        bytes_used: currentQuota.bytes_used + bytes_to_add,
        last_calculated: new Date().toISOString()
      })
      .eq('auth_user_id', authUserId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update storage quota: ${error.message}`);
    }

    console.log(`✅ Storage quota updated for user: ${authUserId}`, {
      new_bytes_used: data.bytes_used
    });

    return { quota: data };
  } catch (error) {
    console.error('🚨 handleUpdateStorageQuota error:', error);
    throw error;
  }
}

async function handleListPhotos(supabase: any, authUserId: string, filterData: any) {
  try {
    const { folder } = filterData || {};

    console.log(`📸 Listing photos for user: ${authUserId}`, { folder });

    let query = supabase
      .from('user_photos')
      .select('*')
      .eq('auth_user_id', authUserId)
      .order('uploaded_at', { ascending: false });

    if (folder) {
      query = query.eq('folder_name', folder);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list photos: ${error.message}`);
    }

    console.log(`✅ Photos listed for user: ${authUserId}`, {
      count: data.length
    });

    return { photos: data };
  } catch (error) {
    console.error('🚨 handleListPhotos error:', error);
    throw error;
  }
}

async function handleListFolders(supabase: any, authUserId: string) {
  try {
    console.log(`📸 Listing folders for user: ${authUserId}`);

    const { data, error } = await supabase
      .from('user_photos')
      .select('folder_name')
      .eq('auth_user_id', authUserId);

    if (error) {
      throw new Error(`Failed to list folders: ${error.message}`);
    }

    // Get unique folders with counts
    const folderCounts: Record<string, number> = {};
    data.forEach((row: any) => {
      const folder = row.folder_name || 'all-photos';
      folderCounts[folder] = (folderCounts[folder] || 0) + 1;
    });

    const folders = Object.entries(folderCounts).map(([name, count]) => ({
      name,
      photo_count: count
    }));

    console.log(`✅ Folders listed for user: ${authUserId}`, {
      count: folders.length
    });

    return { folders };
  } catch (error) {
    console.error('🚨 handleListFolders error:', error);
    throw error;
  }
}

async function handleDeletePhoto(supabase: any, authUserId: string, deleteData: any) {
  try {
    const { photo_id } = deleteData;

    console.log(`📸 Deleting photo for user: ${authUserId}`, { photo_id });

    // photo_id is actually the storage_path
    const { data, error } = await supabase
      .from('user_photos')
      .delete()
      .eq('auth_user_id', authUserId)  // Security: ensure user owns this photo
      .eq('storage_path', photo_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete photo: ${error.message}`);
    }

    // Update quota - reduce by file_size only (no thumbnail_size column)
    const fileSize = data.file_size || 0;
    await supabase
      .from('user_storage_quota')
      .update({
        bytes_used: supabase.raw(`bytes_used - ${fileSize}`),
        last_calculated: new Date().toISOString()
      })
      .eq('auth_user_id', authUserId);

    // Build storage paths array
    const storagePaths: string[] = [];
    if (data.storage_path) storagePaths.push(data.storage_path);
    if (data.thumbnail_path) storagePaths.push(data.thumbnail_path);

    console.log(`✅ Photo deleted for user: ${authUserId}`, { photo_id });

    return { storage_paths: storagePaths };
  } catch (error) {
    console.error('🚨 handleDeletePhoto error:', error);
    throw error;
  }
}

async function handleDeleteAllPhotos(supabase: any, authUserId: string) {
  try {
    console.log(`📸 Deleting all photos for user: ${authUserId}`);

    // First, get all photo records to extract storage paths
    const { data: photos, error: fetchError } = await supabase
      .from('user_photos')
      .select('storage_path, thumbnail_path')
      .eq('auth_user_id', authUserId);

    if (fetchError) {
      throw new Error(`Failed to fetch photos: ${fetchError.message}`);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('user_photos')
      .delete()
      .eq('auth_user_id', authUserId);

    if (deleteError) {
      throw new Error(`Failed to delete all photos: ${deleteError.message}`);
    }

    // Reset quota to zero
    await supabase
      .from('user_storage_quota')
      .update({
        bytes_used: 0,
        last_calculated: new Date().toISOString()
      })
      .eq('auth_user_id', authUserId);

    // Build list of storage paths to delete
    const storagePaths: string[] = [];
    photos.forEach((photo: any) => {
      if (photo.storage_path) storagePaths.push(photo.storage_path);
      if (photo.thumbnail_path) storagePaths.push(photo.thumbnail_path);
    });

    console.log(`✅ All photos deleted for user: ${authUserId}`, {
      count: photos.length
    });

    return {
      deleted: true,
      photo_count: photos.length,
      storage_paths: storagePaths
    };
  } catch (error) {
    console.error('🚨 handleDeleteAllPhotos error:', error);
    throw error;
  }
}

// ============================================================================
// ACCOUNT DELETION OPERATIONS
// ============================================================================

async function handleDeleteAccount(supabase: any, authUserId: string) {
  try {
    console.log(`🗑️ DELETING ACCOUNT for user: ${authUserId}`);

    const deletionResults = {
      deleted: true,
      user_id: authUserId,
      storage_paths: [] as Array<{ path: string; bucket: string; table: string }>,
      tables_deleted: {} as Record<string, number>,
      total_records_deleted: 0,
      errors: [] as Array<{ table: string; error: string }>
    };

    // STEP 1: Collect storage paths from all relevant tables BEFORE deleting
    console.log('📦 Collecting storage paths...');

    for (const tableConfig of DELETION_CONFIG.tablesWithStorage) {
      try {
        const columns = tableConfig.storagePathColumns;

        const { data: rows } = await supabase
          .from(tableConfig.table)
          .select(columns.join(', '))
          .eq('auth_user_id', authUserId);

        if (rows && rows.length > 0) {
          const paths: string[] = [];

          rows.forEach((row: any) => {
            columns.forEach((col) => {
              if (row[col]) {
                paths.push(row[col]);
              }
            });
          });

          deletionResults.storage_paths.push(
            ...paths.map((path) => ({
              path,
              bucket: tableConfig.bucket,
              table: tableConfig.table
            }))
          );

          console.log(
            `📦 Collected ${paths.length} storage paths from ${tableConfig.table}`
          );
        }
      } catch (error: any) {
        console.warn(
          `⚠️ Failed to collect storage paths from ${tableConfig.table}:`,
          error
        );
        deletionResults.errors.push({
          table: tableConfig.table,
          error: `collect_storage: ${error?.message || 'Unknown error'}`
        });
      }
    }

    // STEP 2: Delete from all configured tables
    console.log('🗑️ Deleting from tables...');

    for (const tableName of DELETION_CONFIG.tablesToDelete) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .delete()
          .eq('auth_user_id', authUserId)
          .select();

        if (error) {
          // PGRST116 = no rows found (not an error for deletion)
          if (error.code !== 'PGRST116') {
            console.error(`❌ Failed to delete from ${tableName}:`, error);
            deletionResults.errors.push({
              table: tableName,
              error: error.message
            });
          } else {
            console.log(`✅ No records in ${tableName} (already empty)`);
            deletionResults.tables_deleted[tableName] = 0;
          }
        } else {
          const count = data?.length || 0;
          console.log(`✅ Deleted ${count} records from ${tableName}`);
          deletionResults.tables_deleted[tableName] = count;
          deletionResults.total_records_deleted += count;
        }
      } catch (error: any) {
        console.error(`❌ Exception deleting from ${tableName}:`, error);
        deletionResults.errors.push({
          table: tableName,
          error: error?.message || 'Unknown error'
        });
      }
    }

    // STEP 3: Delete auth user (CASCADE will clean up any remaining records)
    console.log('🗑️ Deleting auth user...');

    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(
        authUserId
      );

      if (authError) {
        throw new Error(`Failed to delete auth user: ${authError.message}`);
      }

      console.log(`✅ Auth user deleted: ${authUserId}`);
    } catch (error: any) {
      console.error('❌ Failed to delete auth user:', error);
      deletionResults.errors.push({
        table: 'auth.users',
        error: error?.message || 'Unknown error'
      });
      // Don't throw - we want to return partial results
    }

    console.log(`🗑️ ✅ Account deletion complete:`, {
      tables_deleted: Object.keys(deletionResults.tables_deleted).length,
      total_records: deletionResults.total_records_deleted,
      storage_items: deletionResults.storage_paths.length,
      errors: deletionResults.errors.length
    });

    return deletionResults;
  } catch (error) {
    console.error('🗑️ ❌ Account deletion failed:', error);
    throw error;
  }
}

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

async function verifySupabaseJWT(token: string): Promise<string | null> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const payload = await verify(token, key) as any;
    return payload?.sub || null;
  } catch (error) {
    console.error('🚨 JWT verification failed:', error);
    return null;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function jsonResponse(data: any, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
