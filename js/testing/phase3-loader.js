// Add this to your main.js or create js/testing/phase3-loader.js
// CHANGE SUMMARY: Phase 3 loader - simplified import to fix initializePhase3 function error

/**
 * Phase 3 RLS + JWT Default Mode Loader
 * Adds Phase 3 capabilities without affecting existing functionality
 */
(async function phase3Loader() {
  'use strict';
  
  console.log('🔐 Loading Phase 3: RLS + JWT Default Mode capabilities...');
  
  try {
    // Wait for other systems to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Import Phase 3 integration - use default import
    const phase3Module = await import('./phase3-rls-integration.js');
    
    // Try different ways to access the initializer
    const initializePhase3 = phase3Module.initializePhase3 || phase3Module.default;
    
    if (typeof initializePhase3 !== 'function') {
      console.error('initializePhase3 function not found in module');
      console.log('Available exports:', Object.keys(phase3Module));
      return;
    }
    
    // Initialize Phase 3 (but don't enable it yet)
    await initializePhase3();
    
    console.log('✅ Phase 3 capabilities loaded!');
    console.log('🚀 Use enablePhase3() to activate RLS + JWT default mode');
    console.log('💡 Commands: enablePhase3(), disablePhase3(), testPhase3(), phase3Status()');
    
    // Add to global dashie object if it exists
    if (window.dashie) {
      window.dashie.phase3 = {
        enable: window.enablePhase3,
        disable: window.disablePhase3,
        test: window.testPhase3,
        status: window.phase3Status
      };
    }
    
  } catch (error) {
    console.warn('⚠️ Phase 3 loading failed (non-critical):', error.message);
    console.error('Full error:', error);
  }
})();