// js/services/telemetry-service.js
// v1.1 - 10/11/25 11:50pm - Made crash reporting opt-out (enabled by default) for beta testing
// v1.0 - 10/11/25 11:30pm - Initial telemetry service for remote crash monitoring
// CHANGE SUMMARY: Telemetry now enabled by default - user can opt-out in Settings

import { createLogger } from '../utils/logger.js';
import { getPlatformDetector } from '../utils/platform-detector.js';

const logger = createLogger('TelemetryService');

/**
 * Telemetry Service - Uploads crash logs and errors to Supabase
 * Only uploads when user opts in via settings
 */
class TelemetryService {
  constructor() {
    this.uploadInterval = null;
    this.uploadFrequency = 5 * 60 * 1000; // 5 minutes
    this.isEnabled = false;
    this.isUploading = false;
    this.lastUploadTime = null;
    this.platform = null;
    this.edgeFunctionUrl = null;
    
    logger.info('Telemetry service created');
  }

  /**
   * Initialize telemetry service
   * @returns {Promise<boolean>} True if initialized successfully
   */
  async initialize() {
    try {
      logger.info('Initializing telemetry service...');
      
      // Get platform info
      const platformDetector = getPlatformDetector();
      this.platform = {
        type: platformDetector.getDeviceType(),
        name: platformDetector.getPlatformName(),
        isTV: platformDetector.isTV(),
        isMobile: platformDetector.isMobile()
      };
      
      // Configure edge function URL based on environment
      const hostname = window.location.hostname;
      const isDev = hostname.includes('localhost') || hostname.includes('dev.');
      
      if (isDev) {
        this.edgeFunctionUrl = 'https://cwglbtosingboqepsmjk.supabase.co/functions/v1/telemetry';
        logger.info('Using DEV Supabase edge function');
      } else {
        this.edgeFunctionUrl = 'https://cwglbtosingboqepsmjk.supabase.co/functions/v1/telemetry';
        logger.info('Using PROD Supabase edge function');
      }
      
      // Check if user has opted in
      this.checkOptInStatus();
      
      // Start background upload if enabled
      if (this.isEnabled) {
        this.startBackgroundUpload();
      }
      
      logger.success('Telemetry service initialized', {
        enabled: this.isEnabled,
        platform: this.platform.name,
        uploadFrequency: `${this.uploadFrequency / 1000 / 60} minutes`
      });
      
      return true;
      
    } catch (error) {
      logger.error('Failed to initialize telemetry service', error);
      return false;
    }
  }

  /**
   * Check if user has opted in to telemetry
   * DEFAULT: Enabled (opt-out model for beta testing)
   */
  checkOptInStatus() {
    try {
      const setting = localStorage.getItem('dashie_telemetry_enabled');
      
      // If never set, default to ENABLED for beta testing
      if (setting === null) {
        this.isEnabled = true;
        logger.info('Telemetry enabled by default (beta testing mode)');
      } else {
        // Respect explicit user choice
        this.isEnabled = setting === 'true';
        logger.debug('Telemetry status from user preference', { enabled: this.isEnabled });
      }
      
    } catch (error) {
      logger.warn('Could not check telemetry opt-in status', error);
      // Default to enabled even on error (beta testing)
      this.isEnabled = true;
    }
  }

  /**
   * Enable telemetry uploads
   */
  enable() {
    logger.info('Enabling telemetry uploads');
    this.isEnabled = true;
    
    try {
      localStorage.setItem('dashie_telemetry_enabled', 'true');
    } catch (error) {
      logger.warn('Could not save telemetry preference', error);
    }
    
    this.startBackgroundUpload();
  }

  /**
   * Disable telemetry uploads
   */
  disable() {
    logger.info('Disabling telemetry uploads');
    this.isEnabled = false;
    
    try {
      localStorage.setItem('dashie_telemetry_enabled', 'false');
    } catch (error) {
      logger.warn('Could not save telemetry preference', error);
    }
    
    this.stopBackgroundUpload();
  }

  /**
   * Start background upload timer
   */
  startBackgroundUpload() {
    if (this.uploadInterval) {
      logger.debug('Background upload already running');
      return;
    }
    
    logger.info('Starting background telemetry upload', {
      frequency: `${this.uploadFrequency / 1000 / 60} minutes`
    });
    
    // Upload immediately on start
    this.uploadLogs().catch(err => 
      logger.warn('Initial telemetry upload failed', err)
    );
    
    // Then upload every 5 minutes
    this.uploadInterval = setInterval(() => {
      this.uploadLogs().catch(err => 
        logger.warn('Background telemetry upload failed', err)
      );
    }, this.uploadFrequency);
  }

  /**
   * Stop background upload timer
   */
  stopBackgroundUpload() {
    if (this.uploadInterval) {
      clearInterval(this.uploadInterval);
      this.uploadInterval = null;
      logger.info('Background telemetry upload stopped');
    }
  }

  /**
   * Upload logs to Supabase edge function
   * @param {boolean} force - Force upload even if disabled
   * @returns {Promise<Object>} Upload result
   */
  async uploadLogs(force = false) {
    // Check if enabled
    if (!this.isEnabled && !force) {
      return {
        success: false,
        error: 'Telemetry is disabled. Enable in Settings → System → Privacy'
      };
    }
    
    // Prevent concurrent uploads
    if (this.isUploading) {
      logger.debug('Upload already in progress, skipping');
      return { success: false, error: 'Upload in progress' };
    }
    
    try {
      this.isUploading = true;
      
      // Get logs from DashieDebug
      if (!window.DashieDebug) {
        logger.warn('DashieDebug not available');
        return { success: false, error: 'Debug system not available' };
      }
      
      const allLogs = window.DashieDebug.getLogs();
      
      // Filter to only errors and warnings
      const relevantLogs = allLogs.filter(log => 
        log.level === 'error' || log.level === 'warn'
      );
      
      // If no new logs since last upload, skip
      if (relevantLogs.length === 0) {
        logger.debug('No errors/warnings to upload');
        return { success: true, uploaded: 0, message: 'No errors to upload' };
      }
      
      // Get session ID
      const sessionId = window.DashieDebug.sessionId || 'unknown';
      
      // Format logs for upload
      const formattedLogs = relevantLogs.map(log => ({
        sessionId: sessionId,
        type: log.level === 'error' ? 'error' : 'warning',
        severity: log.level,
        platform: this.platform.name,
        message: log.message,
        context: log.context,
        timestamp: log.timestamp,
        stack: log.stack
      }));
      
      // Get JWT token
      let token = null;
      if (window.jwtAuth && window.jwtAuth.isServiceReady()) {
        try {
          const tokenResult = await window.jwtAuth.getValidToken();
          if (tokenResult && tokenResult.success && tokenResult.access_token) {
            token = tokenResult.access_token;
          }
        } catch (err) {
          logger.warn('Could not get JWT token for telemetry', err);
        }
      }
      
      if (!token) {
        logger.error('No JWT token available - cannot upload telemetry');
        return { success: false, error: 'Authentication required' };
      }
      
      // Upload to edge function
      logger.info(`Uploading ${formattedLogs.length} log entries...`);
      
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          logs: formattedLogs
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      
      this.lastUploadTime = new Date();
      
      logger.success(`✅ Uploaded ${result.inserted || formattedLogs.length} telemetry entries`);
      
      return {
        success: true,
        uploaded: result.inserted || formattedLogs.length,
        timestamp: this.lastUploadTime
      };
      
    } catch (error) {
      logger.error('Telemetry upload failed', error);
      return {
        success: false,
        error: error.message
      };
      
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * Get telemetry status for debugging
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      uploading: this.isUploading,
      lastUpload: this.lastUploadTime,
      uploadFrequency: `${this.uploadFrequency / 1000 / 60} minutes`,
      platform: this.platform,
      edgeFunctionUrl: this.edgeFunctionUrl
    };
  }
}

// Create singleton instance
const telemetryService = new TelemetryService();

// Export
export default telemetryService;
export { TelemetryService };
