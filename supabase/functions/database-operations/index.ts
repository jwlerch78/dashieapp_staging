// ============================================================================
// Database Operations Edge Function - Phase 4.3
// ============================================================================
// Handles database CRUD operations requiring JWT authentication
//
// CALENDAR OPERATIONS:
// - save_calendar_config: Save active calendar IDs to user_calendar_config
// - load_calendar_config: Load active calendar IDs from user_calendar_config
//
// PHOTO STORAGE OPERATIONS:
// - get_storage_quota: Get user's photo storage quota and usage
// - init_storage_quota: Initialize storage quota for new user
// - create_photo_record: Create database record for uploaded photo
// - update_storage_quota: Update storage usage after upload/delete
// - list_photos: List all photos for user
// - list_folders: List all photo folders for user
// - delete_photo: Delete a single photo record
// - delete_all_photos: Delete all photo records for user
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
      .from('user_photo_quota')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found - user needs initialization
        console.log(`📸 No quota record found for user ${authUserId}`);
        return { quota: null, needs_init: true };
      }
      throw new Error(`Failed to get storage quota: ${error.message}`);
    }

    console.log(`✅ Storage quota retrieved for user: ${authUserId}`, {
      used: data.bytes_used,
      limit: data.bytes_limit
    });

    return { quota: data };
  } catch (error) {
    console.error('🚨 handleGetStorageQuota error:', error);
    throw error;
  }
}

async function handleInitStorageQuota(supabase: any, authUserId: string) {
  try {
    console.log(`📸 Initializing storage quota for user: ${authUserId}`);

    // Default quota: 100MB = 100 * 1024 * 1024 bytes
    const defaultQuota = 100 * 1024 * 1024;

    const { data, error} = await supabase
      .from('user_photo_quota')
      .insert({
        auth_user_id: authUserId,
        bytes_used: 0,
        bytes_limit: defaultQuota,
        photo_count: 0
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to initialize storage quota: ${error.message}`);
    }

    console.log(`✅ Storage quota initialized for user: ${authUserId}`, {
      limit: defaultQuota
    });

    return { quota: data };
  } catch (error) {
    console.error('🚨 handleInitStorageQuota error:', error);
    throw error;
  }
}

async function handleCreatePhotoRecord(supabase: any, authUserId: string, photoData: any) {
  try {
    const { photo_id, folder, file_size, thumbnail_size } = photoData;

    console.log(`📸 Creating photo record for user: ${authUserId}`, {
      photo_id,
      folder,
      file_size
    });

    const { data, error } = await supabase
      .from('user_photos')
      .insert({
        auth_user_id: authUserId,
        photo_id,
        folder,
        file_size,
        thumbnail_size,
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
    const { bytes_delta, photo_count_delta } = updateData;

    console.log(`📸 Updating storage quota for user: ${authUserId}`, {
      bytes_delta,
      photo_count_delta
    });

    // Get current quota
    const { data: currentQuota, error: fetchError } = await supabase
      .from('user_photo_quota')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch current quota: ${fetchError.message}`);
    }

    // Update quota
    const { data, error } = await supabase
      .from('user_photo_quota')
      .update({
        bytes_used: currentQuota.bytes_used + bytes_delta,
        photo_count: currentQuota.photo_count + photo_count_delta,
        updated_at: new Date().toISOString()
      })
      .eq('auth_user_id', authUserId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update storage quota: ${error.message}`);
    }

    console.log(`✅ Storage quota updated for user: ${authUserId}`, {
      new_bytes_used: data.bytes_used,
      new_photo_count: data.photo_count
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
      query = query.eq('folder', folder);
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
      .select('folder')
      .eq('auth_user_id', authUserId);

    if (error) {
      throw new Error(`Failed to list folders: ${error.message}`);
    }

    // Get unique folders with counts
    const folderCounts: Record<string, number> = {};
    data.forEach((row: any) => {
      const folder = row.folder || 'all-photos';
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

    const { data, error } = await supabase
      .from('user_photos')
      .delete()
      .eq('auth_user_id', authUserId)
      .eq('photo_id', photo_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete photo: ${error.message}`);
    }

    console.log(`✅ Photo deleted for user: ${authUserId}`, { photo_id });

    return { deleted_photo: data };
  } catch (error) {
    console.error('🚨 handleDeletePhoto error:', error);
    throw error;
  }
}

async function handleDeleteAllPhotos(supabase: any, authUserId: string) {
  try {
    console.log(`📸 Deleting all photos for user: ${authUserId}`);

    const { data, error } = await supabase
      .from('user_photos')
      .delete()
      .eq('auth_user_id', authUserId)
      .select();

    if (error) {
      throw new Error(`Failed to delete all photos: ${error.message}`);
    }

    console.log(`✅ All photos deleted for user: ${authUserId}`, {
      count: data.length
    });

    return { photo_count: data.length };
  } catch (error) {
    console.error('🚨 handleDeleteAllPhotos error:', error);
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
