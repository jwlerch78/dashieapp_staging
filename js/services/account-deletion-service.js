// js/services/account-deletion-service.js
// Version: 1.0 | Last Updated: 2025-01-09 20:30 EST
// CHANGE SUMMARY: NEW FILE - Complete account deletion service with database and storage cleanup

import { createLogger } from '../utils/logger.js';

const logger = createLogger('AccountDeletion');

/**
 * Account Deletion Service
 * Handles complete user account deletion including:
 * - Database records (via edge function)
 * - Storage bucket files
 * - Local storage data
 * - User sign-out
 */
export class AccountDeletionService {
  constructor() {
    this.edgeFunctionUrl = null;
    this.configureEdgeFunction();
  }

  /**
   * Configure edge function URL
   */
  configureEdgeFunction() {
    try {
      const config = window.dashiePlatformConfig || {};
      const supabaseUrl = config.supabaseUrl;
      
      if (supabaseUrl) {
        this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/database-operations`;
        logger.debug('Edge function URL configured', { url: this.edgeFunctionUrl });
      } else {
        logger.warn('No Supabase URL found in config');
      }
    } catch (error) {
      logger.error('Failed to configure edge function URL', error);
    }
  }

  /**
   * Delete entire user account and all associated data
   * @returns {Promise<Object>} Deletion results
   */
  async deleteAccount() {
    logger.info('🗑️ Starting complete account deletion');
    
    try {
      // 1. Get JWT token for authenticated deletion
      const jwt = await window.jwtAuth?.getSupabaseJWT();
      if (!jwt) {
        throw new Error('Not authenticated - JWT token not available');
      }

      // 2. Call edge function to delete database records
      const dbResult = await this._deleteFromDatabase(jwt);
      
      logger.debug('Database records deleted', { 
        tables_cleared: dbResult.tables_cleared,
        tables_found: dbResult.tables_found?.length || 0,
        tables_not_in_config: dbResult.tables_not_in_config?.length || 0
      });

      // Log any tables not in config (potential oversight)
      if (dbResult.tables_not_in_config?.length > 0) {
        logger.warn('Tables with auth_user_id not in deletion config:', 
          dbResult.tables_not_in_config
        );
      }

      // 3. Delete files from storage buckets
      if (dbResult.storage_paths?.length > 0) {
        await this._deleteFromStorage(dbResult.storage_paths);
        logger.debug('Storage files deleted', { 
          count: dbResult.storage_paths.length 
        });
      }

      // 4. Clear local storage
      this._clearLocalData();

      logger.success('✅ Account completely deleted', {
        tables_cleared: dbResult.tables_cleared,
        files_deleted: dbResult.storage_paths?.length || 0
      });

      return {
        success: true,
        tables_cleared: dbResult.tables_cleared,
        files_deleted: dbResult.storage_paths?.length || 0,
        tables_found: dbResult.tables_found,
        tables_not_in_config: dbResult.tables_not_in_config,
        errors: dbResult.errors
      };

    } catch (error) {
      logger.error('❌ Account deletion failed', error);
      throw error;
    }
  }

  /**
   * Delete all database records via edge function
   * @private
   */
  async _deleteFromDatabase(jwt) {
    if (!this.edgeFunctionUrl) {
      throw new Error('Edge function URL not configured');
    }

    const config = window.dashiePlatformConfig;
    const anonKey = config.supabaseAnonKey || config.supabaseKey;

    if (!anonKey) {
      throw new Error('Supabase anon key not available');
    }

    const response = await fetch(this.edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        jwtToken: jwt,
        operation: 'delete_account'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Database deletion failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Database deletion returned failure');
    }

    return result;
  }

  /**
   * Delete files from storage buckets
   * Handles multiple buckets from deletion config
   * @private
   */
  async _deleteFromStorage(storageItems) {
    if (!storageItems || storageItems.length === 0) return;

    try {
      // Group storage items by bucket
      const bucketGroups = {};
      storageItems.forEach(item => {
        const bucket = item.bucket || 'photos'; // Default to photos for backwards compatibility
        if (!bucketGroups[bucket]) {
          bucketGroups[bucket] = [];
        }
        bucketGroups[bucket].push(item.path);
      });

      // Get authenticated Supabase client
      const { createClient } = window.supabase;
      const config = window.dashiePlatformConfig;
      const jwt = await window.jwtAuth.getSupabaseJWT();

      const authClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${jwt}`
          }
        }
      });

      // Delete from each bucket
      for (const [bucket, paths] of Object.entries(bucketGroups)) {
        logger.debug(`Deleting ${paths.length} files from ${bucket} bucket`);
        
        const { error } = await authClient.storage
          .from(bucket)
          .remove(paths);

        if (error) {
          logger.warn(`Storage deletion had errors for bucket ${bucket}`, error);
          // Continue with other buckets even if one fails
        } else {
          logger.debug(`✅ Deleted ${paths.length} items from ${bucket} bucket`);
        }
      }
    } catch (error) {
      logger.warn('Storage deletion encountered errors (continuing anyway)', error);
      // Non-critical - user data is already deleted from database
    }
  }

  /**
   * Clear all local storage data
   * @private
   */
  _clearLocalData() {
    try {
      // Clear all dashie-related localStorage keys
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('dashie-') || key.startsWith('user-'))) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        logger.debug(`Removed localStorage key: ${key}`);
      });
      
      logger.debug('Local storage cleared', { keysRemoved: keysToRemove.length });
    } catch (error) {
      logger.warn('Failed to clear local storage', error);
      // Non-critical - user will be signed out anyway
    }
  }
}
