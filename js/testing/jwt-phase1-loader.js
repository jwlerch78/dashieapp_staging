// Add this to your main.js or create a new file: js/testing/jwt-phase1-loader.js
// CHANGE SUMMARY: Simple loader for JWT Phase 1 testing - minimal integration with existing main.js

/**
 * JWT Phase 1 Testing Loader
 * Safely loads JWT testing capabilities without affecting existing functionality
 */
(async function jwtPhase1Loader() {
  'use strict';
  
  console.log('🔐 Loading JWT Phase 1 testing capabilities...');
  
  try {
    // Only load if we're in development or if JWT testing is explicitly enabled
    const isDevelopment = window.location.hostname.includes('dev') || 
                         window.location.hostname.includes('localhost') ||
                         localStorage.getItem('dashie-jwt-testing-enabled') === 'true';
    
    if (!isDevelopment) {
      console.log('🔐 JWT testing disabled (not in development environment)');
      return;
    }
    
    // Import and initialize JWT Phase 1
    const { initializeJWTPhase1 } = await import('./jwt-phase1-init.js');
    
    // Wait a bit for other systems to initialize
    setTimeout(async () => {
      try {
        await initializeJWTPhase1();
        
        // Show success message in console
        console.log('✅ JWT Phase 1 testing enabled!');
        console.log('🔧 Open Settings to find JWT testing controls');
        console.log('💡 Console commands available: testJWT(), enableJWT(), disableJWT(), jwtStatus()');
        
        // Add to global dashie object if it exists
        if (window.dashie) {
          window.dashie.jwtTesting = window.jwtPhase1;
        }
        
      } catch (error) {
        console.warn('⚠️ JWT Phase 1 initialization failed (non-critical):', error.message);
      }
    }, 3000); // 3 second delay to ensure other systems are ready
    
  } catch (error) {
    console.warn('⚠️ JWT Phase 1 loading failed (non-critical):', error.message);
  }
})();

// Alternative: Manual initialization function
window.loadJWTTesting = async function() {
  try {
    localStorage.setItem('dashie-jwt-testing-enabled', 'true');
    
    const { initializeJWTPhase1 } = await import('./jwt-phase1-init.js');
    await initializeJWTPhase1();
    
    console.log('✅ JWT testing manually enabled!');
    console.log('🔧 Refresh the page or open Settings to see JWT controls');
    
  } catch (error) {
    console.error('❌ Failed to manually load JWT testing:', error);
  }
};

// Disable JWT testing
window.disableJWTTesting = function() {
  localStorage.removeItem('dashie-jwt-testing-enabled');
  console.log('🔒 JWT testing disabled. Refresh page to take effect.');
};