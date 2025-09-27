// js/testing/jwt-testing-interface.js
// CHANGE SUMMARY: New testing interface for JWT authentication service - adds controls to settings for Phase 1 testing

import { createLogger } from '../utils/logger.js';
import { JWTAuthService } from '../apis/api-auth/jwt-auth-service.js';

const logger = createLogger('JWTTesting');

/**
 * JWT Testing Interface
 * Provides UI controls and testing functionality for the JWT auth service
 */
export class JWTTestingInterface {
  constructor() {
    this.jwtService = new JWTAuthService();
    this.testResults = [];
    this.isRunningTest = false;
    
    logger.info('JWT Testing Interface initialized');
  }

  /**
   * Add JWT testing controls to the settings interface
   * @param {HTMLElement} container - Settings container to add controls to
   */
  addTestingControls(container) {
    logger.debug('Adding JWT testing controls to settings interface');

    const jwtSection = this.createJWTSection();
    container.appendChild(jwtSection);
    
    this.setupEventListeners();
    this.updateStatus();
  }

  /**
   * Create the JWT testing section HTML
   * @returns {HTMLElement} JWT testing section
   */
  createJWTSection() {
    const section = document.createElement('div');
    section.className = 'jwt-testing-section';
    section.innerHTML = `
      <div class="settings-section">
        <h3>🔐 JWT Authentication Testing (Phase 1)</h3>
        
        <div class="jwt-controls">
          <div class="jwt-toggle">
            <label>
              <input type="checkbox" id="jwt-enabled-toggle" ${this.jwtService.isEnabled ? 'checked' : ''}>
              Enable JWT Mode (for testing)
            </label>
          </div>
          
          <div class="jwt-status" id="jwt-status">
            <h4>Status:</h4>
            <div id="jwt-status-content">Loading...</div>
          </div>
          
          <div class="jwt-actions">
            <button id="jwt-test-connection" class="jwt-test-btn">Test Connection</button>
            <button id="jwt-test-load" class="jwt-test-btn">Test Load Settings</button>
            <button id="jwt-test-save" class="jwt-test-btn">Test Save Settings</button>
            <button id="jwt-clear-results" class="jwt-clear-btn">Clear Results</button>
          </div>
          
          <div class="jwt-results" id="jwt-results">
            <h4>Test Results:</h4>
            <div id="jwt-results-content"></div>
          </div>
        </div>
      </div>
    `;

    return section;
  }

  /**
   * Set up event listeners for JWT controls
   */
  setupEventListeners() {
    // JWT toggle
    const toggleCheckbox = document.getElementById('jwt-enabled-toggle');
    if (toggleCheckbox) {
      toggleCheckbox.addEventListener('change', (e) => {
        this.handleJWTToggle(e.target.checked);
      });
    }

    // Test buttons
    const testConnection = document.getElementById('jwt-test-connection');
    const testLoad = document.getElementById('jwt-test-load');
    const testSave = document.getElementById('jwt-test-save');
    const clearResults = document.getElementById('jwt-clear-results');

    if (testConnection) {
      testConnection.addEventListener('click', () => this.runConnectionTest());
    }

    if (testLoad) {
      testLoad.addEventListener('click', () => this.runLoadTest());
    }

    if (testSave) {
      testSave.addEventListener('click', () => this.runSaveTest());
    }

    if (clearResults) {
      clearResults.addEventListener('click', () => this.clearTestResults());
    }

    logger.debug('JWT testing event listeners set up');
  }

  /**
   * Handle JWT mode toggle
   * @param {boolean} enabled - Whether JWT mode should be enabled
   */
  handleJWTToggle(enabled) {
    logger.info('JWT toggle changed', { enabled });

    try {
      this.jwtService.setEnabled(enabled);
      this.updateStatus();
      
      this.addTestResult('info', `JWT mode ${enabled ? 'enabled' : 'disabled'}`);
      
    } catch (error) {
      logger.error('Failed to toggle JWT mode', error);
      
      // Reset checkbox on error
      const toggleCheckbox = document.getElementById('jwt-enabled-toggle');
      if (toggleCheckbox) {
        toggleCheckbox.checked = this.jwtService.isEnabled;
      }
      
      this.addTestResult('error', `Failed to toggle JWT mode: ${error.message}`);
    }
  }

  /**
   * Update the status display
   */
  updateStatus() {
    const statusContent = document.getElementById('jwt-status-content');
    if (!statusContent) return;

    const status = this.jwtService.getStatus();
    
    statusContent.innerHTML = `
      <div class="jwt-status-item">
        <strong>Enabled:</strong> ${status.enabled ? '✅ Yes' : '❌ No'}
      </div>
      <div class="jwt-status-item">
        <strong>Ready:</strong> ${status.ready ? '✅ Yes' : '❌ No'}
      </div>
      <div class="jwt-status-item">
        <strong>Edge Function:</strong> ${status.hasEdgeFunction ? '✅ Available' : '❌ Missing'}
      </div>
      <div class="jwt-status-item">
        <strong>Google Token:</strong> ${status.hasGoogleToken ? '✅ Available' : '❌ Missing'}
      </div>
      ${status.edgeFunctionUrl ? `
        <div class="jwt-status-item">
          <strong>Edge Function URL:</strong> <code>${status.edgeFunctionUrl}</code>
        </div>
      ` : ''}
      ${status.lastOperationTime ? `
        <div class="jwt-status-item">
          <strong>Last Operation:</strong> ${new Date(status.lastOperationTime).toLocaleString()}
        </div>
      ` : ''}
    `;

    logger.debug('JWT status display updated', status);
  }

  /**
   * Run connection test
   */
  async runConnectionTest() {
    if (this.isRunningTest) {
      logger.warn('Test already running, skipping connection test');
      return;
    }

    this.isRunningTest = true;
    this.addTestResult('info', 'Starting connection test...');

    try {
      const result = await this.jwtService.testConnection();
      
      if (result.success) {
        this.addTestResult('success', `Connection test passed! Duration: ${result.duration}ms`);
        
        if (result.data) {
          this.addTestResult('info', `RLS Status: ${result.rlsEnabled ? 'Enabled' : 'Disabled'}`);
          this.addTestResult('info', `User Verified: ${result.userVerified ? 'Yes' : 'No'}`);
        }
      } else {
        this.addTestResult('error', `Connection test failed: ${result.error}`);
      }
      
    } catch (error) {
      logger.error('Connection test exception', error);
      this.addTestResult('error', `Connection test exception: ${error.message}`);
      
    } finally {
      this.isRunningTest = false;
    }
  }

  /**
   * Run load settings test
   */
  async runLoadTest() {
    if (this.isRunningTest) {
      logger.warn('Test already running, skipping load test');
      return;
    }

    this.isRunningTest = true;
    
    // Get current user email
    const user = window.dashieAuth?.getUser() || window.authManager?.getUser();
    const userEmail = user?.email;
    
    if (!userEmail) {
      this.addTestResult('error', 'No user email available for load test');
      this.isRunningTest = false;
      return;
    }

    this.addTestResult('info', `Starting load test for user: ${userEmail}`);

    try {
      const settings = await this.jwtService.loadSettings(userEmail);
      
      if (settings) {
        this.addTestResult('success', `Settings loaded successfully! Keys: ${Object.keys(settings).join(', ')}`);
      } else {
        this.addTestResult('info', 'No settings found for user (this is normal for new users)');
      }
      
    } catch (error) {
      logger.error('Load test exception', error);
      this.addTestResult('error', `Load test failed: ${error.message}`);
      
    } finally {
      this.isRunningTest = false;
    }
  }

  /**
   * Run save settings test
   */
  async runSaveTest() {
    if (this.isRunningTest) {
      logger.warn('Test already running, skipping save test');
      return;
    }

    this.isRunningTest = true;
    
    // Get current user email
    const user = window.dashieAuth?.getUser() || window.authManager?.getUser();
    const userEmail = user?.email;
    
    if (!userEmail) {
      this.addTestResult('error', 'No user email available for save test');
      this.isRunningTest = false;
      return;
    }

    // Create test settings
    const testSettings = {
      jwtTest: {
        timestamp: new Date().toISOString(),
        testId: Math.random().toString(36).substring(7),
        message: 'JWT save test successful'
      }
    };

    this.addTestResult('info', `Starting save test for user: ${userEmail}`);

    try {
      const success = await this.jwtService.saveSettings(userEmail, testSettings);
      
      if (success) {
        this.addTestResult('success', `Settings saved successfully! Test ID: ${testSettings.jwtTest.testId}`);
      } else {
        this.addTestResult('error', 'Save operation returned false');
      }
      
    } catch (error) {
      logger.error('Save test exception', error);
      this.addTestResult('error', `Save test failed: ${error.message}`);
      
    } finally {
      this.isRunningTest = false;
    }
  }

  /**
   * Add a test result to the display
   * @param {string} type - Result type: 'info', 'success', 'error'
   * @param {string} message - Result message
   */
  addTestResult(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    const result = {
      type,
      message,
      timestamp
    };

    this.testResults.push(result);
    
    // Limit results to last 20 entries
    if (this.testResults.length > 20) {
      this.testResults = this.testResults.slice(-20);
    }

    this.updateTestResultsDisplay();
    
    logger.info(`JWT Test Result [${type}]: ${message}`);
  }

  /**
   * Update the test results display
   */
  updateTestResultsDisplay() {
    const resultsContent = document.getElementById('jwt-results-content');
    if (!resultsContent) return;

    if (this.testResults.length === 0) {
      resultsContent.innerHTML = '<div class="jwt-no-results">No test results yet</div>';
      return;
    }

    const resultsHTML = this.testResults
      .slice(-10) // Show last 10 results
      .reverse() // Show newest first
      .map(result => {
        const iconMap = {
          'info': 'ℹ️',
          'success': '✅',
          'error': '❌'
        };
        
        return `
          <div class="jwt-result-item jwt-result-${result.type}">
            <span class="jwt-result-icon">${iconMap[result.type]}</span>
            <span class="jwt-result-time">${result.timestamp}</span>
            <span class="jwt-result-message">${result.message}</span>
          </div>
        `;
      })
      .join('');

    resultsContent.innerHTML = resultsHTML;
  }

  /**
   * Clear test results
   */
  clearTestResults() {
    this.testResults = [];
    this.updateTestResultsDisplay();
    logger.info('JWT test results cleared');
  }

  /**
   * Get CSS styles for the JWT testing interface
   * @returns {string} CSS styles
   */
  static getCSS() {
    return `
      .jwt-testing-section {
        margin-top: 20px;
        padding: 15px;
        border: 1px solid var(--text-muted);
        border-radius: 5px;
        background: var(--bg-secondary);
      }

      .jwt-controls {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }

      .jwt-toggle label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: bold;
      }

      .jwt-status {
        padding: 10px;
        background: var(--bg-primary);
        border-radius: 3px;
        border: 1px solid var(--text-muted);
      }

      .jwt-status h4 {
        margin: 0 0 10px 0;
        color: var(--text-primary);
      }

      .jwt-status-item {
        margin: 5px 0;
        padding: 2px 0;
        font-family: monospace;
        font-size: 0.9em;
      }

      .jwt-status-item code {
        background: var(--bg-secondary);
        padding: 2px 4px;
        border-radius: 2px;
        font-size: 0.8em;
      }

      .jwt-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .jwt-test-btn, .jwt-clear-btn {
        padding: 8px 15px;
        border: 1px solid var(--text-muted);
        border-radius: 3px;
        background: var(--bg-primary);
        color: var(--text-primary);
        cursor: pointer;
        font-size: 0.9em;
      }

      .jwt-test-btn:hover {
        background: var(--text-muted);
        color: var(--bg-primary);
      }

      .jwt-clear-btn {
        background: #ff6b6b;
        color: white;
        border-color: #ff5252;
      }

      .jwt-clear-btn:hover {
        background: #ff5252;
      }

      .jwt-results {
        padding: 10px;
        background: var(--bg-primary);
        border-radius: 3px;
        border: 1px solid var(--text-muted);
        max-height: 300px;
        overflow-y: auto;
      }

      .jwt-results h4 {
        margin: 0 0 10px 0;
        color: var(--text-primary);
      }

      .jwt-no-results {
        color: var(--text-muted);
        font-style: italic;
        text-align: center;
        padding: 20px;
      }

      .jwt-result-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px;
        margin: 2px 0;
        border-radius: 2px;
        font-family: monospace;
        font-size: 0.85em;
      }

      .jwt-result-info {
        background: rgba(66, 165, 245, 0.1);
        border-left: 3px solid #42a5f5;
      }

      .jwt-result-success {
        background: rgba(76, 175, 80, 0.1);
        border-left: 3px solid #4caf50;
      }

      .jwt-result-error {
        background: rgba(244, 67, 54, 0.1);
        border-left: 3px solid #f44336;
      }

      .jwt-result-time {
        color: var(--text-muted);
        min-width: 80px;
      }

      .jwt-result-message {
        flex: 1;
        color: var(--text-primary);
      }
    `;
  }
}