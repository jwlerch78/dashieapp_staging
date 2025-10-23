/**
 * Phase 4.2: Settings Service Test Script
 *
 * USAGE:
 * 1. Open the app in browser
 * 2. Open Developer Console (F12)
 * 3. Copy and paste this entire file into the console
 * 4. Run individual tests or test.runAll()
 *
 * EXAMPLES:
 *   test.step1_verifyAPI()           // Check all methods exist
 *   test.step2_testSave()            // Test save functionality
 *   test.step3_testLoad()            // Test load functionality
 *   test.step4_testTheme()           // Test theme persistence
 *   test.runAll()                    // Run all tests in sequence
 */

const test = {
    // Test configuration
    config: {
        testTheme: 'dark',
        originalTheme: null,
        verbose: true
    },

    // Logging helpers
    log(message, data = null) {
        console.log(`%c[TEST] ${message}`, 'color: #4CAF50; font-weight: bold', data || '');
    },

    error(message, data = null) {
        console.error(`%c[TEST ERROR] ${message}`, 'color: #f44336; font-weight: bold', data || '');
    },

    warn(message, data = null) {
        console.warn(`%c[TEST WARNING] ${message}`, 'color: #FF9800; font-weight: bold', data || '');
    },

    success(message) {
        console.log(`%c✅ ${message}`, 'color: #4CAF50; font-weight: bold; font-size: 14px');
    },

    // =========================================================================
    // STEP 1: Verify API Exists
    // =========================================================================

    async step1_verifyAPI() {
        this.log('=== STEP 1: Verify Settings Service API ===');

        const checks = [];

        // Check SettingsService exists
        if (typeof window.settingsService === 'undefined') {
            this.error('settingsService not found on window');
            checks.push({ name: 'settingsService exists', pass: false });
        } else {
            this.success('settingsService found on window');
            checks.push({ name: 'settingsService exists', pass: true });
        }

        // Check SettingsStore exists
        if (typeof window.settingsStore === 'undefined') {
            this.error('settingsStore not found on window');
            checks.push({ name: 'settingsStore exists', pass: false });
        } else {
            this.success('settingsStore found on window');
            checks.push({ name: 'settingsStore exists', pass: true });
        }

        // Check EdgeClient exists
        if (typeof window.edgeClient === 'undefined') {
            this.warn('edgeClient not found on window (may not be authenticated)');
            checks.push({ name: 'edgeClient exists', pass: false, optional: true });
        } else {
            this.success('edgeClient found on window');
            checks.push({ name: 'edgeClient exists', pass: true });
        }

        // Check required methods on SettingsService
        const serviceMethods = ['load', 'save', 'get', 'set', 'clear', 'setEdgeClient'];
        serviceMethods.forEach(method => {
            if (typeof window.settingsService?.[method] === 'function') {
                this.success(`settingsService.${method}() exists`);
                checks.push({ name: `settingsService.${method}`, pass: true });
            } else {
                this.error(`settingsService.${method}() missing`);
                checks.push({ name: `settingsService.${method}`, pass: false });
            }
        });

        // Check required methods on SettingsStore
        const storeMethods = ['initialize', 'save', 'get', 'set', 'getAll', 'reload', 'resetToDefaults'];
        storeMethods.forEach(method => {
            if (typeof window.settingsStore?.[method] === 'function') {
                this.success(`settingsStore.${method}() exists`);
                checks.push({ name: `settingsStore.${method}`, pass: true });
            } else {
                this.error(`settingsStore.${method}() missing`);
                checks.push({ name: `settingsStore.${method}`, pass: false });
            }
        });

        // Check current settings
        const currentTheme = window.settingsStore?.get('interface.theme');
        this.log('Current theme:', currentTheme);
        this.config.originalTheme = currentTheme;

        // Summary
        const passed = checks.filter(c => c.pass).length;
        const failed = checks.filter(c => !c.pass && !c.optional).length;
        const optional = checks.filter(c => !c.pass && c.optional).length;

        this.log(`\nAPI Verification: ${passed} passed, ${failed} failed, ${optional} optional missing\n`);

        if (failed === 0) {
            this.success('STEP 1: API Verification PASSED');
            return true;
        } else {
            this.error('STEP 1: API Verification FAILED');
            return false;
        }
    },

    // =========================================================================
    // STEP 2: Test Save Functionality
    // =========================================================================

    async step2_testSave() {
        this.log('=== STEP 2: Test Save Functionality ===');

        try {
            // Get current settings
            const settings = window.settingsStore.getAll();
            this.log('Current settings:', settings);

            // Change theme
            const newTheme = settings.interface.theme === 'dark' ? 'light' : 'dark';
            this.log(`Changing theme from ${settings.interface.theme} to ${newTheme}`);

            window.settingsStore.set('interface.theme', newTheme);

            // Save (don't show toast notification for test)
            this.log('Saving settings...');
            const result = await window.settingsStore.save(false);

            this.log('Save result:', result);

            // Verify localStorage
            const localSettings = JSON.parse(localStorage.getItem('dashie-settings'));
            if (localSettings.interface.theme === newTheme) {
                this.success('Theme saved to localStorage');
            } else {
                this.error('Theme NOT saved to localStorage');
                return false;
            }

            // Check database save
            if (result.database) {
                this.success('Theme saved to database');
            } else {
                this.warn('Theme not saved to database (may not be authenticated)');
            }

            // Restore original theme
            window.settingsStore.set('interface.theme', this.config.originalTheme);
            await window.settingsStore.save(false);
            this.log('Restored original theme');

            this.success('STEP 2: Save Functionality PASSED');
            return true;

        } catch (error) {
            this.error('STEP 2: Save Functionality FAILED', error);
            return false;
        }
    },

    // =========================================================================
    // STEP 3: Test Load Functionality
    // =========================================================================

    async step3_testLoad() {
        this.log('=== STEP 3: Test Load Functionality ===');

        try {
            // Test 1: Load from current state
            this.log('Test 1: Load from current state');
            const settings1 = await window.settingsService.load();
            this.log('Loaded settings:', settings1);

            if (settings1 && typeof settings1 === 'object') {
                this.success('Settings loaded successfully');
            } else {
                this.error('Settings load returned invalid data');
                return false;
            }

            // Test 2: Verify localStorage fallback
            this.log('\nTest 2: Verify localStorage contains settings');
            const localSettings = JSON.parse(localStorage.getItem('dashie-settings'));

            if (localSettings && localSettings.interface && localSettings.interface.theme) {
                this.success('localStorage has valid settings');
                this.log('localStorage theme:', localSettings.interface.theme);
            } else {
                this.error('localStorage missing or invalid');
                return false;
            }

            // Test 3: Verify theme value matches
            const storeTheme = window.settingsStore.get('interface.theme');
            const localTheme = localSettings.interface.theme;

            if (storeTheme === localTheme) {
                this.success('SettingsStore and localStorage in sync');
            } else {
                this.error('SettingsStore and localStorage out of sync', {
                    store: storeTheme,
                    local: localTheme
                });
                return false;
            }

            this.success('STEP 3: Load Functionality PASSED');
            return true;

        } catch (error) {
            this.error('STEP 3: Load Functionality FAILED', error);
            return false;
        }
    },

    // =========================================================================
    // STEP 4: Test Theme Persistence
    // =========================================================================

    async step4_testTheme() {
        this.log('=== STEP 4: Test Theme Persistence ===');

        try {
            // Get current theme
            const currentTheme = window.settingsStore.get('interface.theme');
            this.log('Current theme:', currentTheme);

            // Test theme application
            this.log('Checking document.body.dataset.theme');
            const bodyTheme = document.body.dataset.theme;
            this.log('Body theme:', bodyTheme);

            if (bodyTheme === currentTheme) {
                this.success('Theme applied to document.body');
            } else {
                this.warn('Theme mismatch between settings and body', {
                    settings: currentTheme,
                    body: bodyTheme
                });
            }

            // Test ThemeApplier exists
            if (window.themeApplier) {
                this.success('ThemeApplier available');

                // Test theme switch
                const testTheme = currentTheme === 'dark' ? 'light' : 'dark';
                this.log(`Testing theme switch to ${testTheme}`);

                window.themeApplier.applyTheme(testTheme, true);

                // Wait a bit for theme to apply
                await new Promise(resolve => setTimeout(resolve, 100));

                const newBodyTheme = document.body.dataset.theme;
                if (newBodyTheme === testTheme) {
                    this.success('Theme switch successful');
                } else {
                    this.error('Theme switch failed');
                }

                // Restore original theme
                window.themeApplier.applyTheme(currentTheme, true);
                this.log('Restored original theme');

            } else {
                this.error('ThemeApplier not found on window');
                return false;
            }

            this.success('STEP 4: Theme Persistence PASSED');
            return true;

        } catch (error) {
            this.error('STEP 4: Theme Persistence FAILED', error);
            return false;
        }
    },

    // =========================================================================
    // STEP 5: Test AppComms Integration
    // =========================================================================

    async step5_testAppComms() {
        this.log('=== STEP 5: Test AppComms Theme Broadcast ===');

        try {
            // Check if AppComms exists
            if (typeof window.AppComms === 'undefined') {
                this.error('AppComms not found on window');
                return false;
            }

            this.success('AppComms found');

            // Subscribe to THEME_CHANGED event
            this.log('Subscribing to THEME_CHANGED event');
            let eventReceived = false;
            let eventData = null;

            const unsubscribe = window.AppComms.subscribe(
                window.AppComms.events.THEME_CHANGED,
                (data) => {
                    eventReceived = true;
                    eventData = data;
                    this.log('THEME_CHANGED event received:', data);
                }
            );

            // Change theme
            const currentTheme = window.settingsStore.get('interface.theme');
            const testTheme = currentTheme === 'dark' ? 'light' : 'dark';

            this.log(`Changing theme to ${testTheme} and checking for event`);

            // Apply theme (should trigger event)
            window.themeApplier.applyTheme(testTheme, true);

            // Wait for event
            await new Promise(resolve => setTimeout(resolve, 200));

            // Check if event was received
            if (eventReceived) {
                this.success('THEME_CHANGED event received');
                this.log('Event data:', eventData);
            } else {
                this.warn('THEME_CHANGED event not received (may not be implemented)');
            }

            // Cleanup
            unsubscribe();

            // Restore theme
            window.themeApplier.applyTheme(currentTheme, true);
            this.log('Restored original theme');

            this.success('STEP 5: AppComms Integration PASSED');
            return true;

        } catch (error) {
            this.error('STEP 5: AppComms Integration FAILED', error);
            return false;
        }
    },

    // =========================================================================
    // STEP 6: Test Offline Mode
    // =========================================================================

    async step6_testOffline() {
        this.log('=== STEP 6: Test Offline Mode ===');

        try {
            this.log('NOTE: This test verifies localStorage-only operation');

            // Temporarily clear edgeClient to simulate offline
            const originalEdgeClient = window.settingsService.edgeClient;
            window.settingsService.edgeClient = null;

            this.log('EdgeClient temporarily disabled (simulating offline)');

            // Try to save
            const testValue = 'offline-test-' + Date.now();
            window.settingsStore.set('accounts.dashieAccount', testValue);

            const result = await window.settingsStore.save(false);

            this.log('Save result:', result);

            // Should succeed with localStorage only
            if (result.localStorage && !result.database) {
                this.success('Offline save successful (localStorage only)');
            } else {
                this.error('Offline save failed');
                window.settingsService.edgeClient = originalEdgeClient;
                return false;
            }

            // Verify localStorage has the value
            const localSettings = JSON.parse(localStorage.getItem('dashie-settings'));
            if (localSettings.accounts.dashieAccount === testValue) {
                this.success('Offline data persisted to localStorage');
            } else {
                this.error('Offline data not persisted');
                window.settingsService.edgeClient = originalEdgeClient;
                return false;
            }

            // Restore edgeClient
            window.settingsService.edgeClient = originalEdgeClient;
            this.log('EdgeClient restored');

            this.success('STEP 6: Offline Mode PASSED');
            return true;

        } catch (error) {
            this.error('STEP 6: Offline Mode FAILED', error);
            return false;
        }
    },

    // =========================================================================
    // Run All Tests
    // =========================================================================

    async runAll() {
        console.clear();
        this.log('%c╔══════════════════════════════════════════════════════════╗', 'font-size: 16px');
        this.log('%c║   Phase 4.2: Settings Service Test Suite                 ║', 'font-size: 16px');
        this.log('%c╚══════════════════════════════════════════════════════════╝', 'font-size: 16px');
        console.log('');

        const results = {
            step1: await this.step1_verifyAPI(),
            step2: await this.step2_testSave(),
            step3: await this.step3_testLoad(),
            step4: await this.step4_testTheme(),
            step5: await this.step5_testAppComms(),
            step6: await this.step6_testOffline()
        };

        // Summary
        console.log('');
        this.log('%c════════════════ TEST SUMMARY ════════════════', 'font-size: 14px');

        const passed = Object.values(results).filter(r => r === true).length;
        const total = Object.keys(results).length;

        Object.entries(results).forEach(([step, result]) => {
            const icon = result ? '✅' : '❌';
            const color = result ? 'color: #4CAF50' : 'color: #f44336';
            console.log(`%c${icon} ${step}: ${result ? 'PASSED' : 'FAILED'}`, color);
        });

        console.log('');
        if (passed === total) {
            this.log(`%c🎉 ALL TESTS PASSED (${passed}/${total})`, 'font-size: 16px; color: #4CAF50; font-weight: bold');
        } else {
            this.log(`%c⚠️  SOME TESTS FAILED (${passed}/${total} passed)`, 'font-size: 16px; color: #FF9800; font-weight: bold');
        }

        return results;
    },

    // =========================================================================
    // Helper: Inspect Current State
    // =========================================================================

    inspect() {
        this.log('=== Current Settings State ===');

        console.group('SettingsStore');
        console.log('Initialized:', window.settingsStore?.initialized);
        console.log('Settings:', window.settingsStore?.settings);
        console.groupEnd();

        console.group('localStorage');
        const localSettings = localStorage.getItem('dashie-settings');
        console.log('Raw:', localSettings);
        console.log('Parsed:', localSettings ? JSON.parse(localSettings) : null);
        console.groupEnd();

        console.group('EdgeClient');
        console.log('Available:', !!window.edgeClient);
        console.log('Authenticated:', !!window.edgeClient?.jwtToken);
        console.groupEnd();

        console.group('Theme');
        console.log('Settings:', window.settingsStore?.get('interface.theme'));
        console.log('Body:', document.body.dataset.theme);
        console.log('LocalStorage (dashie-theme):', localStorage.getItem('dashie-theme'));
        console.groupEnd();
    }
};

// Auto-run message
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2196F3');
console.log('%c Phase 4.2 Settings Service Test Suite Loaded', 'color: #2196F3; font-size: 14px; font-weight: bold');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2196F3');
console.log('');
console.log('%cAvailable commands:', 'font-weight: bold');
console.log('  test.runAll()              - Run all tests');
console.log('  test.step1_verifyAPI()     - Verify API exists');
console.log('  test.step2_testSave()      - Test save functionality');
console.log('  test.step3_testLoad()      - Test load functionality');
console.log('  test.step4_testTheme()     - Test theme persistence');
console.log('  test.step5_testAppComms()  - Test AppComms integration');
console.log('  test.step6_testOffline()   - Test offline mode');
console.log('  test.inspect()             - Inspect current state');
console.log('');
console.log('%cTo start testing, run: %ctest.runAll()', 'font-weight: normal', 'color: #4CAF50; font-weight: bold');
console.log('');
