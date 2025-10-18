/**
 * Phase 4.3: Calendar Service Test Script
 *
 * USAGE:
 * 1. Open the app in browser (must be logged in with Google account)
 * 2. Open Developer Console (F12)
 * 3. Copy and paste this entire file into the console
 * 4. Run individual tests or calendarTest.runAll()
 *
 * EXAMPLES:
 *   calendarTest.step1_verifyService()     // Check service exists
 *   calendarTest.step2_testPrefixedIds()   // Test ID creation/parsing
 *   calendarTest.step3_fetchCalendars()    // Fetch calendars from Google
 *   calendarTest.step4_toggleActive()      // Test enable/disable
 *   calendarTest.runAll()                  // Run all tests
 */

const calendarTest = {
    // Test configuration
    config: {
        testAccountType: 'primary',
        testCalendarId: null, // Will be set from first calendar
        verbose: true
    },

    // Logging helpers
    log(message, data = null) {
        console.log(`%c[CALENDAR TEST] ${message}`, 'color: #2196F3; font-weight: bold', data || '');
    },

    error(message, data = null) {
        console.error(`%c[CALENDAR TEST ERROR] ${message}`, 'color: #f44336; font-weight: bold', data || '');
    },

    success(message) {
        console.log(`%c✅ ${message}`, 'color: #4CAF50; font-weight: bold; font-size: 14px');
    },

    // =========================================================================
    // STEP 1: Verify CalendarService Exists
    // =========================================================================

    async step1_verifyService() {
        this.log('=== STEP 1: Verify CalendarService ===');

        const checks = [];

        // Check if CalendarService is available
        try {
            const service = window.calendarService || (await import('/js/data/services/calendar-service.js')).getCalendarService();

            if (service) {
                this.success('CalendarService found');
                checks.push({ name: 'CalendarService exists', pass: true });

                // Check required methods
                const methods = [
                    'initialize',
                    'createPrefixedId',
                    'parsePrefixedId',
                    'getCalendars',
                    'enableCalendar',
                    'disableCalendar',
                    'isCalendarActive',
                    'getActiveCalendarIds',
                    'getAllActiveEvents'
                ];

                methods.forEach(method => {
                    if (typeof service[method] === 'function') {
                        this.success(`CalendarService.${method}() exists`);
                        checks.push({ name: `Method: ${method}`, pass: true });
                    } else {
                        this.error(`CalendarService.${method}() missing`);
                        checks.push({ name: `Method: ${method}`, pass: false });
                    }
                });

            } else {
                this.error('CalendarService not found');
                checks.push({ name: 'CalendarService exists', pass: false });
            }

        } catch (error) {
            this.error('Failed to load CalendarService', error);
            checks.push({ name: 'CalendarService exists', pass: false });
        }

        // Summary
        const passed = checks.filter(c => c.pass).length;
        const total = checks.length;

        this.log(`\nAPI Verification: ${passed}/${total} passed\n`);

        if (passed === total) {
            this.success('STEP 1: Service Verification PASSED');
            return true;
        } else {
            this.error('STEP 1: Service Verification FAILED');
            return false;
        }
    },

    // =========================================================================
    // STEP 2: Test Prefixed ID Methods
    // =========================================================================

    async step2_testPrefixedIds() {
        this.log('=== STEP 2: Test Prefixed ID Methods ===');

        try {
            const service = window.calendarService || (await import('/js/data/services/calendar-service.js')).getCalendarService();

            // Test createPrefixedId
            const testCases = [
                { account: 'primary', calendar: 'user@gmail.com', expected: 'primary-user@gmail.com' },
                { account: 'account2', calendar: 'work@company.com', expected: 'account2-work@company.com' },
                { account: 'primary', calendar: 'shared-calendar@group.calendar.google.com', expected: 'primary-shared-calendar@group.calendar.google.com' }
            ];

            let allPassed = true;

            for (const test of testCases) {
                const result = service.createPrefixedId(test.account, test.calendar);

                if (result === test.expected) {
                    this.success(`createPrefixedId: ${test.account} + ${test.calendar} = ${result}`);
                } else {
                    this.error(`createPrefixedId failed`, {
                        expected: test.expected,
                        got: result
                    });
                    allPassed = false;
                }

                // Test parsing it back
                const parsed = service.parsePrefixedId(result);

                if (parsed.accountType === test.account && parsed.calendarId === test.calendar) {
                    this.success(`parsePrefixedId: ${result} → ${JSON.stringify(parsed)}`);
                } else {
                    this.error(`parsePrefixedId failed`, {
                        input: result,
                        expected: { accountType: test.account, calendarId: test.calendar },
                        got: parsed
                    });
                    allPassed = false;
                }
            }

            if (allPassed) {
                this.success('STEP 2: Prefixed ID Methods PASSED');
                return true;
            } else {
                this.error('STEP 2: Prefixed ID Methods FAILED');
                return false;
            }

        } catch (error) {
            this.error('STEP 2: Prefixed ID Methods FAILED', error);
            return false;
        }
    },

    // =========================================================================
    // STEP 3: Fetch Calendars from Google
    // =========================================================================

    async step3_fetchCalendars() {
        this.log('=== STEP 3: Fetch Calendars from Google ===');

        try {
            const service = window.calendarService || (await import('/js/data/services/calendar-service.js')).getCalendarService();

            this.log('Fetching calendars for primary account...');

            const calendars = await service.getCalendars('primary');

            this.log(`Found ${calendars.length} calendars:`);

            calendars.forEach((cal, index) => {
                console.log(`  ${index + 1}. ${cal.summary || 'Unnamed'}`);
                console.log(`     Raw ID: ${cal.rawId || cal.id}`);
                console.log(`     Prefixed ID: ${cal.prefixedId}`);
                console.log(`     Active: ${cal.isActive}`);
                console.log('');
            });

            // Store first calendar for next test
            if (calendars.length > 0) {
                this.config.testCalendarId = calendars[0].rawId || calendars[0].id;
                this.success(`Test calendar set: ${this.config.testCalendarId}`);
            }

            // Verify each calendar has required fields
            const hasAllFields = calendars.every(cal =>
                cal.prefixedId && cal.rawId && cal.accountType !== undefined && cal.isActive !== undefined
            );

            if (hasAllFields) {
                this.success('All calendars have required fields (prefixedId, rawId, accountType, isActive)');
            } else {
                this.error('Some calendars missing required fields');
                return false;
            }

            this.success('STEP 3: Fetch Calendars PASSED');
            return true;

        } catch (error) {
            this.error('STEP 3: Fetch Calendars FAILED', error);
            return false;
        }
    },

    // =========================================================================
    // STEP 4: Test Toggle Active
    // =========================================================================

    async step4_toggleActive() {
        this.log('=== STEP 4: Test Toggle Active ===');

        try {
            const service = window.calendarService || (await import('/js/data/services/calendar-service.js')).getCalendarService();

            if (!this.config.testCalendarId) {
                this.error('No test calendar ID available. Run step3_fetchCalendars first.');
                return false;
            }

            const accountType = this.config.testAccountType;
            const calendarId = this.config.testCalendarId;

            this.log(`Testing with: ${accountType} / ${calendarId}`);

            // Check initial state
            const initialState = service.isCalendarActive(accountType, calendarId);
            this.log(`Initial state: ${initialState ? 'Active' : 'Inactive'}`);

            // Enable calendar
            this.log('Enabling calendar...');
            await service.enableCalendar(accountType, calendarId);

            const afterEnable = service.isCalendarActive(accountType, calendarId);
            if (afterEnable) {
                this.success('Calendar enabled successfully');
            } else {
                this.error('Calendar enable failed');
                return false;
            }

            // Check active calendar IDs
            const activeIds = service.getActiveCalendarIds();
            const prefixedId = service.createPrefixedId(accountType, calendarId);

            if (activeIds.includes(prefixedId)) {
                this.success(`Active calendar list includes: ${prefixedId}`);
                this.log('All active calendars:', activeIds);
            } else {
                this.error('Active calendar list missing prefixed ID');
                return false;
            }

            // Disable calendar
            this.log('Disabling calendar...');
            await service.disableCalendar(accountType, calendarId);

            const afterDisable = service.isCalendarActive(accountType, calendarId);
            if (!afterDisable) {
                this.success('Calendar disabled successfully');
            } else {
                this.error('Calendar disable failed');
                return false;
            }

            // Restore initial state
            if (initialState) {
                this.log('Restoring initial state (enabled)...');
                await service.enableCalendar(accountType, calendarId);
            }

            this.success('STEP 4: Toggle Active PASSED');
            return true;

        } catch (error) {
            this.error('STEP 4: Toggle Active FAILED', error);
            return false;
        }
    },

    // =========================================================================
    // STEP 5: Test Settings Persistence
    // =========================================================================

    async step5_testPersistence() {
        this.log('=== STEP 5: Test Settings Persistence ===');

        try {
            const service = window.calendarService || (await import('/js/data/services/calendar-service.js')).getCalendarService();

            if (!this.config.testCalendarId) {
                this.error('No test calendar ID available. Run step3_fetchCalendars first.');
                return false;
            }

            const accountType = this.config.testAccountType;
            const calendarId = this.config.testCalendarId;

            // Enable a calendar
            this.log('Enabling calendar and saving...');
            await service.enableCalendar(accountType, calendarId);

            // Check if it persisted to settings
            const settings = await window.edgeClient.loadSettings();

            if (settings.calendar && Array.isArray(settings.calendar.activeCalendarIds)) {
                this.success('Settings have calendar.activeCalendarIds array');

                const prefixedId = service.createPrefixedId(accountType, calendarId);

                if (settings.calendar.activeCalendarIds.includes(prefixedId)) {
                    this.success(`Settings contain: ${prefixedId}`);
                    this.log('All persisted IDs:', settings.calendar.activeCalendarIds);
                } else {
                    this.error('Settings missing the enabled calendar');
                    return false;
                }
            } else {
                this.error('Settings missing calendar.activeCalendarIds');
                return false;
            }

            this.success('STEP 5: Settings Persistence PASSED');
            return true;

        } catch (error) {
            this.error('STEP 5: Settings Persistence FAILED', error);
            return false;
        }
    },

    // =========================================================================
    // Run All Tests
    // =========================================================================

    async runAll() {
        console.clear();
        this.log('%c╔══════════════════════════════════════════════════════════╗', 'font-size: 16px');
        this.log('%c║   Phase 4.3: Calendar Service Test Suite                 ║', 'font-size: 16px');
        this.log('%c╚══════════════════════════════════════════════════════════╝', 'font-size: 16px');
        console.log('');

        const results = {
            step1: await this.step1_verifyService(),
            step2: await this.step2_testPrefixedIds(),
            step3: await this.step3_fetchCalendars(),
            step4: await this.step4_toggleActive(),
            step5: await this.step5_testPersistence()
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

    async inspect() {
        this.log('=== Current Calendar State ===');

        try {
            const service = window.calendarService || (await import('/js/data/services/calendar-service.js')).getCalendarService();

            console.group('CalendarService');
            console.log('Active Calendar IDs:', service.getActiveCalendarIds());
            console.groupEnd();

            console.group('Settings (Database)');
            const settings = await window.edgeClient.loadSettings();
            console.log('calendar.activeCalendarIds:', settings.calendar?.activeCalendarIds);
            console.groupEnd();

        } catch (error) {
            this.error('Failed to inspect state', error);
        }
    }
};

// Auto-run message
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2196F3');
console.log('%c Phase 4.3 Calendar Service Test Suite Loaded', 'color: #2196F3; font-size: 14px; font-weight: bold');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2196F3');
console.log('');
console.log('%cAvailable commands:', 'font-weight: bold');
console.log('  calendarTest.runAll()              - Run all tests');
console.log('  calendarTest.step1_verifyService() - Verify service exists');
console.log('  calendarTest.step2_testPrefixedIds() - Test ID methods');
console.log('  calendarTest.step3_fetchCalendars() - Fetch calendars');
console.log('  calendarTest.step4_toggleActive()  - Test enable/disable');
console.log('  calendarTest.step5_testPersistence() - Test settings save');
console.log('  calendarTest.inspect()             - Inspect current state');
console.log('');
console.log('%cTo start testing, run: %ccalendarTest.runAll()', 'font-weight: normal', 'color: #4CAF50; font-weight: bold');
console.log('');
