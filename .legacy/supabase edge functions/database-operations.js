// supabase/functions/database-operations/index.ts
// Version: 1.2 | Last Updated: 2025-10-09 15:22 EST
// CHANGE SUMMARY: Added support for multiple storage path columns (e.g., storage_path + thumbnail_path)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verify } from 'https://deno.land/x/djwt@v2.8/mod.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const JWT_SECRET = Deno.env.get('JWT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
if (!JWT_SECRET || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables');
}
// ==================== DELETION CONFIGURATION ====================
/**
 * DELETION CONFIGURATION
 * 
 * Explicitly list all tables to delete during account deletion.
 * This approach is safer and more maintainable than auto-discovery.
 * 
 * IMPORTANT: When you create a new user table:
 * 1. Add it to tablesToDelete if it contains user data to remove
 * 2. Add it to tablesWithStorage if it references files in storage
 * 3. DON'T add it if it's for analytics/billing/audit trails
 * 
 * The edge function will LOG all tables it finds with auth_user_id
 * to help you remember to update this config.
 */ const DELETION_CONFIG = {
  // Tables to delete during account deletion
  tablesToDelete: [
    'user_photos',
    'user_storage_quota',
    'user_settings'
  ],
  // Tables with storage bucket files that need cleanup
  // Add table + storage info for any table that references uploaded files
  // UPDATED: Now supports multiple columns via storagePathColumns array
  tablesWithStorage: [
    {
      table: 'user_photos',
      storagePathColumns: [
        'storage_path',
        'thumbnail_path'
      ],
      bucket: 'photos'
    }
  ],
  // Enable discovery mode to list all tables with auth_user_id
  // Set to true during development to find tables you might have missed
  enableDiscoveryMode: true
};
/**
 * Discover all tables with auth_user_id column
 * This helps you remember to add new tables to the deletion config
 * Only runs in discovery mode
 */ async function discoverUserTables(supabase) {
  if (!DELETION_CONFIG.enableDiscoveryMode) return [];
  try {
    // Query information_schema to find tables with auth_user_id column
    const { data, error } = await supabase.rpc('get_user_tables');
    if (error) {
      console.warn('⚠️ Could not discover user tables:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.warn('⚠️ Discovery mode failed:', error);
    return [];
  }
}
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { jwtToken, operation, data } = await req.json();
    if (!jwtToken) {
      return new Response(JSON.stringify({
        error: 'JWT token required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Verify JWT and extract userId
    const userId = await verifyJWT(jwtToken);
    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Invalid or expired JWT'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`🔐 JWT verified for user: ${userId}`);
    // Create Supabase client with the user's JWT token
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${jwtToken}`
        }
      }
    });
    // Route to appropriate handler
    let result;
    switch(operation){
      // Photo quota operations
      case 'get_storage_quota':
        result = await handleGetStorageQuota(supabase, userId);
        break;
      case 'init_storage_quota':
        result = await handleInitStorageQuota(supabase, userId);
        break;
      case 'update_storage_quota':
        result = await handleUpdateStorageQuota(supabase, userId, data);
        break;
      // Photo folder operations
      case 'list_folders':
        result = await handleListFolders(supabase, userId);
        break;
      // Photo metadata operations
      case 'list_photos':
        result = await handleListPhotos(supabase, userId, data);
        break;
      case 'create_photo_record':
        result = await handleCreatePhotoRecord(supabase, userId, data);
        break;
      case 'delete_photo':
        result = await handleDeletePhoto(supabase, userId, data);
        break;
      case 'delete_all_photos':
        result = await handleDeleteAllPhotos(supabase, userId);
        break;
      // Account deletion
      case 'delete_account':
        result = await handleDeleteAccount(supabase, userId, data);
        break;
      default:
        return new Response(JSON.stringify({
          error: 'Invalid operation'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
    }
    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('🚨 Database operation error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
// ==================== JWT VERIFICATION ====================
async function verifyJWT(token) {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);
    const key = await crypto.subtle.importKey('raw', keyData, {
      name: 'HMAC',
      hash: 'SHA-256'
    }, false, [
      'verify'
    ]);
    const payload = await verify(token, key);
    return payload.sub;
  } catch (error) {
    console.error('🚨 JWT verification failed:', error);
    return null;
  }
}
// ==================== PHOTO QUOTA OPERATIONS ====================
async function handleGetStorageQuota(supabase, userId) {
  console.log(`📦 Getting storage quota for user: ${userId}`);
  const { data, error } = await supabase.from('user_storage_quota').select('bytes_used, quota_bytes, storage_tier').eq('auth_user_id', userId).single();
  if (error) {
    if (error.code === 'PGRST116') {
      console.log(`📦 No quota record found for user: ${userId}`);
      return {
        quota_found: false
      };
    }
    throw error;
  }
  console.log(`📦 ✅ Quota retrieved`);
  return {
    quota_found: true,
    bytes_used: data.bytes_used,
    quota_bytes: data.quota_bytes,
    storage_tier: data.storage_tier
  };
}
async function handleInitStorageQuota(supabase, userId) {
  console.log(`📦 Initializing storage quota for user: ${userId}`);
  const { error } = await supabase.from('user_storage_quota').insert({
    auth_user_id: userId,
    bytes_used: 0,
    quota_bytes: 1073741824,
    storage_tier: 'free'
  });
  if (error) throw error;
  console.log(`📦 ✅ Quota initialized`);
  return {
    initialized: true,
    bytes_used: 0,
    quota_bytes: 1073741824,
    storage_tier: 'free'
  };
}
async function handleUpdateStorageQuota(supabase, userId, data) {
  console.log(`📦 Updating storage quota for user: ${userId}`);
  const { bytes_to_add } = data;
  // Get current usage
  const { data: currentData } = await supabase.from('user_storage_quota').select('bytes_used').eq('auth_user_id', userId).single();
  const currentUsage = currentData?.bytes_used || 0;
  const newUsage = currentUsage + bytes_to_add;
  // Update usage
  const { error } = await supabase.from('user_storage_quota').update({
    bytes_used: newUsage
  }).eq('auth_user_id', userId);
  if (error) throw error;
  console.log(`📦 ✅ Quota updated`);
  return {
    updated: true,
    new_bytes_used: newUsage
  };
}
// ==================== PHOTO FOLDER OPERATIONS ====================
async function handleListFolders(supabase, userId) {
  console.log(`📁 Listing folders for user: ${userId}`);
  const { data, error } = await supabase.from('user_photos').select('folder_name').eq('auth_user_id', userId);
  if (error) throw error;
  // Group by folder and count photos
  const folderMap = {};
  data.forEach((photo)=>{
    const folder = photo.folder_name || 'all-photos';
    folderMap[folder] = (folderMap[folder] || 0) + 1;
  });
  const folders = Object.entries(folderMap).map(([name, count])=>({
      name,
      photo_count: count
    }));
  console.log(`📁 ✅ Found ${folders.length} folders`);
  return {
    folders
  };
}
// ==================== PHOTO METADATA OPERATIONS ====================
async function handleListPhotos(supabase, userId, data) {
  console.log(`📸 Listing photos for user: ${userId}`);
  const { folder, limit = 100 } = data || {};
  let query = supabase.from('user_photos').select('id, storage_path, thumbnail_path, filename, folder_name, uploaded_at, file_size, mime_type').eq('auth_user_id', userId).order('uploaded_at', {
    ascending: false
  }).limit(limit);
  if (folder) {
    query = query.eq('folder_name', folder);
  }
  const { data: photos, error } = await query;
  if (error) throw error;
  console.log(`📸 ✅ Found ${photos.length} photos`);
  return {
    photos
  };
}
async function handleCreatePhotoRecord(supabase, userId, data) {
  console.log(`📸 Creating photo record for user: ${userId}`);
  const { storage_path, thumbnail_path, filename, folder_name, file_size, mime_type } = data;
  if (!storage_path || !filename) {
    throw new Error('Missing required photo data');
  }
  const { error } = await supabase.from('user_photos').insert({
    auth_user_id: userId,
    storage_path,
    thumbnail_path: thumbnail_path || null,
    filename,
    folder_name: folder_name || 'all-photos',
    file_size: file_size || 0,
    mime_type: mime_type || 'image/jpeg'
  });
  if (error) throw error;
  console.log(`📸 ✅ Photo record created`);
  return {
    created: true
  };
}
async function handleDeletePhoto(supabase, userId, data) {
  console.log(`📸 Deleting photo for user: ${userId}`);
  const { photo_id } = data;
  if (!photo_id) {
    throw new Error('Missing photo_id');
  }
  // Get photo details before deletion (including thumbnail_path)
  const { data: photo, error: fetchError } = await supabase.from('user_photos').select('storage_path, thumbnail_path, file_size').eq('id', photo_id).eq('auth_user_id', userId).single();
  if (fetchError) throw fetchError;
  if (!photo) throw new Error('Photo not found');
  // FIXED: Collect both storage_path AND thumbnail_path
  const pathsToDelete = [];
  if (photo.storage_path) pathsToDelete.push(photo.storage_path);
  if (photo.thumbnail_path) pathsToDelete.push(photo.thumbnail_path);
  // Delete from database
  const { error: deleteError } = await supabase.from('user_photos').delete().eq('id', photo_id).eq('auth_user_id', userId);
  if (deleteError) throw deleteError;
  // Update quota
  const { data: currentQuota } = await supabase.from('user_storage_quota').select('bytes_used').eq('auth_user_id', userId).single();
  const currentUsage = currentQuota?.bytes_used || 0;
  const newUsage = Math.max(0, currentUsage - (photo.file_size || 0));
  await supabase.from('user_storage_quota').update({
    bytes_used: newUsage
  }).eq('auth_user_id', userId);
  console.log(`📸 ✅ Photo deleted`);
  return {
    deleted: true,
    storage_paths: pathsToDelete // FIXED: Return array of paths to delete
  };
}
async function handleDeleteAllPhotos(supabase, userId) {
  console.log(`🗑️ Deleting all photos for user: ${userId}`);
  // Get all photo records with storage paths AND thumbnail paths
  const { data: photos, error: fetchError } = await supabase.from('user_photos').select('id, storage_path, thumbnail_path, file_size').eq('auth_user_id', userId);
  if (fetchError) throw fetchError;
  if (!photos || photos.length === 0) {
    console.log(`🗑️ No photos to delete for user: ${userId}`);
    return {
      deleted: true,
      photo_count: 0,
      storage_paths: []
    };
  }
  const photoCount = photos.length;
  // FIXED: Collect both storage_path AND thumbnail_path
  const storagePaths = [];
  photos.forEach((p)=>{
    if (p.storage_path) storagePaths.push(p.storage_path);
    if (p.thumbnail_path) storagePaths.push(p.thumbnail_path);
  });
  console.log(`💾 Collected ${storagePaths.length} paths (${photoCount} photos + thumbnails)`);
  // Delete all photo records
  const { error: deleteError } = await supabase.from('user_photos').delete().eq('auth_user_id', userId);
  if (deleteError) throw deleteError;
  // Reset quota to 0
  const { error: quotaError } = await supabase.from('user_storage_quota').update({
    bytes_used: 0
  }).eq('auth_user_id', userId);
  if (quotaError) {
    console.warn(`⚠️ Failed to update quota for user: ${userId}`, quotaError);
  }
  console.log(`🗑️ ✅ Deleted ${photoCount} photos for user: ${userId}`);
  return {
    deleted: true,
    photo_count: photoCount,
    storage_paths: storagePaths
  };
}
// ==================== ACCOUNT DELETION ====================
/**
 * Delete user account and all associated data
 * Uses explicit configuration with optional discovery mode
 */ async function handleDeleteAccount(supabase, userId, data) {
  console.log(`🗑️ DELETING ACCOUNT for user: ${userId}`);
  try {
    const deletionResults = {
      deleted: true,
      storage_paths: [],
      tables_cleared: 0,
      tables_found: [],
      tables_not_in_config: [],
      errors: []
    };
    // DISCOVERY MODE: Find all tables with auth_user_id
    if (DELETION_CONFIG.enableDiscoveryMode) {
      console.log('🔍 Discovery mode enabled - checking for user tables...');
      const discoveredTables = await discoverUserTables(supabase);
      deletionResults.tables_found = discoveredTables;
      // Find tables not in our deletion config
      const configuredTables = DELETION_CONFIG.tablesToDelete;
      const notInConfig = discoveredTables.filter((table)=>!configuredTables.includes(table));
      if (notInConfig.length > 0) {
        console.warn('⚠️ TABLES WITH auth_user_id NOT IN DELETION CONFIG:');
        notInConfig.forEach((table)=>{
          console.warn(`   - ${table}`);
        });
        console.warn('💡 Add these to tablesToDelete if they should be deleted');
        deletionResults.tables_not_in_config = notInConfig;
      }
    }
    // 1. Collect storage paths from all relevant tables BEFORE deleting
    // UPDATED: Now supports multiple columns via storagePathColumns array
    for (const tableConfig of DELETION_CONFIG.tablesWithStorage){
      try {
        // Support both single column (backwards compat) and multiple columns (new)
        const columns = Array.isArray(tableConfig.storagePathColumns) ? tableConfig.storagePathColumns : [
          tableConfig.storagePathColumn
        ]; // Fallback for old config format
        const { data: rows } = await supabase.from(tableConfig.table).select(columns.join(', ')) // Select all specified columns
        .eq('auth_user_id', userId);
        if (rows && rows.length > 0) {
          // Collect paths from all specified columns
          const paths = [];
          rows.forEach((row)=>{
            columns.forEach((col)=>{
              if (row[col]) {
                paths.push(row[col]);
              }
            });
          });
          deletionResults.storage_paths.push(...paths.map((path)=>({
              path,
              bucket: tableConfig.bucket,
              table: tableConfig.table
            })));
          console.log(`📦 Collected ${paths.length} storage paths from ${tableConfig.table} (${columns.length} columns)`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to collect storage paths from ${tableConfig.table}:`, error);
        deletionResults.errors.push({
          table: tableConfig.table,
          operation: 'collect_storage_paths',
          error: error.message
        });
      }
    }
    // 2. Delete from all configured tables
    for (const table of DELETION_CONFIG.tablesToDelete){
      try {
        const { error, count } = await supabase.from(table).delete().eq('auth_user_id', userId);
        if (error && error.code !== 'PGRST116') {
          console.error(`❌ Failed to delete from ${table}:`, error);
          deletionResults.errors.push({
            table,
            operation: 'delete',
            error: error.message
          });
        } else {
          console.log(`✅ Deleted from ${table} (${count || 0} rows)`);
          deletionResults.tables_cleared++;
        }
      } catch (error) {
        console.error(`❌ Exception deleting from ${table}:`, error);
        deletionResults.errors.push({
          table,
          operation: 'delete',
          error: error.message
        });
      }
    }
    console.log(`🗑️ ✅ Account deletion complete:`, {
      tables_cleared: deletionResults.tables_cleared,
      storage_items: deletionResults.storage_paths.length,
      tables_found: deletionResults.tables_found.length,
      tables_missing_from_config: deletionResults.tables_not_in_config.length,
      errors: deletionResults.errors.length
    });
    return deletionResults;
  } catch (error) {
    console.error('🗑️ ❌ Account deletion failed:', error);
    throw error;
  }
}
