// js/core/widget-registration-coordinator.js
// CHANGE SUMMARY: New file - Event-based widget registration system to replace fixed 2s timeout

import { createLogger } from '../utils/logger.js';
import { events as eventSystem } from '../utils/event-emitter.js';

const logger = createLogger('WidgetRegistration');

/**
 * Widget Registration Coordinator
 * Waits for specific widgets to signal ready before proceeding
 * Replaces fixed timeout with event-based confirmation
 */
export class WidgetRegistrationCoordinator {
  constructor() {
    this.registeredWidgets = new Set();
    this.requiredWidgets = ['calendar', 'photos', 'clock']; // Core widgets that must load
    this.registrationPromises = new Map();
    
    // CRITICAL: Listen directly to postMessage events, not eventSystem
    // WidgetMessenger is created later, so we must listen ourselves
    this.setupDirectMessageListener();
    
    logger.info('Widget registration coordinator initialized', {
      requiredWidgets: this.requiredWidgets
    });
  }

  /**
   * Set up direct message listener for widget-ready postMessages
   * This is critical because WidgetMessenger doesn't exist yet
   */
  setupDirectMessageListener() {
    window.addEventListener('message', (event) => {
      // DEBUG: Log ALL postMessages to see what we're receiving
      if (event.data && event.data.type) {
        logger.debug('Received postMessage', {
          type: event.data.type,
          widget: event.data.widget,
          source: event.source ? 'iframe' : 'unknown'
        });
      }
      
      if (!event.data || event.data.type !== 'widget-ready') return;
      
      const widgetName = event.data.widget;
      if (!widgetName) {
        logger.warn('Received widget-ready without widget name', event.data);
        return;
      }
      
      logger.info('Widget ready message received', { widgetName });
      
      // Handle the widget ready notification
      this.handleWidgetReady({
        name: widgetName,
        source: event.source,
        readyAt: Date.now()
      });
    });
    
    logger.debug('Direct postMessage listener configured for widget-ready events');
  }

  /**
   * Handle widget ready notification
   * @param {Object} widgetInfo - Widget information
   */
  handleWidgetReady(widgetInfo) {
    const widgetName = widgetInfo.name;
    
    if (this.registeredWidgets.has(widgetName)) {
      logger.debug('Widget already registered, ignoring duplicate', { widgetName });
      return;
    }
    
    this.registeredWidgets.add(widgetName);
    logger.info('Widget registered', {
      widgetName,
      totalRegistered: this.registeredWidgets.size,
      required: this.requiredWidgets.length
    });
    
    // Resolve any waiting promises for this widget
    const resolver = this.registrationPromises.get(widgetName);
    if (resolver) {
      resolver();
      this.registrationPromises.delete(widgetName);
    }
  }

  /**
   * Check if widgets have already loaded by examining iframes
   * Fallback in case widget-ready messages were sent before we started listening
   * @returns {Array<string>} Names of widgets that appear to be loaded
   */
  checkForAlreadyLoadedWidgets() {
    const loadedWidgets = [];
    const allIframes = document.querySelectorAll('iframe');
    
    allIframes.forEach((iframe) => {
      try {
        // Try to access iframe content to see if it's loaded
        if (iframe.contentWindow && iframe.contentDocument) {
          // Check if iframe has a body with content (means it loaded)
          const hasContent = iframe.contentDocument.body && 
                            iframe.contentDocument.body.children.length > 0;
          
          if (hasContent) {
            // Try to determine widget name from iframe src or id
            const src = iframe.src || '';
            let widgetName = null;
            
            if (src.includes('calendar')) widgetName = 'calendar';
            else if (src.includes('photos')) widgetName = 'photos';
            else if (src.includes('clock')) widgetName = 'clock';
            else if (src.includes('agenda')) widgetName = 'agenda';
            
            if (widgetName && this.requiredWidgets.includes(widgetName)) {
              loadedWidgets.push(widgetName);
              logger.info('Detected already-loaded widget', {
                widgetName,
                hasContent,
                src: src.substring(0, 50)
              });
            }
          }
        }
      } catch (e) {
        // Can't access iframe (cross-origin), skip
        logger.debug('Cannot access iframe for inspection', { error: e.message });
      }
    });
    
    return loadedWidgets;
  }

  /**
   * Wait for specific widgets to be ready
   * @param {Array<string>} widgetNames - Widget names to wait for (defaults to required widgets)
   * @param {Object} options - Wait options
   * @param {number} options.timeout - Max wait time in ms (default: 5000)
   * @param {number} options.minWaitTime - Minimum wait time even if ready earlier (default: 500ms)
   * @returns {Promise<Object>} Registration results
   */
  async waitForWidgets(widgetNames = null, options = {}) {
    const {
      timeout = 5000,
      minWaitTime = 500
    } = options;
    
    const widgetsToWaitFor = widgetNames || this.requiredWidgets;
    const startTime = Date.now();
    
    logger.info('Waiting for widgets to register', {
      widgets: widgetsToWaitFor,
      timeout,
      minWaitTime
    });
    
    // FIRST: Check for already-loaded widgets (fallback for missed messages)
    const alreadyLoaded = this.checkForAlreadyLoadedWidgets();
    alreadyLoaded.forEach(widgetName => {
      if (!this.registeredWidgets.has(widgetName)) {
        logger.info('Registering already-loaded widget', { widgetName });
        this.registeredWidgets.add(widgetName);
      }
    });
    
    // Check which widgets are already registered
    const alreadyRegistered = widgetsToWaitFor.filter(name => 
      this.registeredWidgets.has(name)
    );
    
    const stillWaiting = widgetsToWaitFor.filter(name => 
      !this.registeredWidgets.has(name)
    );
    
    if (alreadyRegistered.length > 0) {
      logger.debug('Some widgets already registered', {
        registered: alreadyRegistered
      });
    }
    
    if (stillWaiting.length === 0) {
      logger.info('All widgets already registered, applying minimum wait time');
      await new Promise(resolve => setTimeout(resolve, minWaitTime));
      
      return {
        success: true,
        registered: widgetsToWaitFor,
        timedOut: [],
        duration: Date.now() - startTime
      };
    }
    
    // Create promises for widgets we're still waiting for
    const waitPromises = stillWaiting.map(widgetName => {
      return new Promise((resolve) => {
        // Store resolver so handleWidgetReady can trigger it
        this.registrationPromises.set(widgetName, resolve);
        
        // Set up timeout
        setTimeout(() => {
          if (this.registrationPromises.has(widgetName)) {
            logger.warn('Widget registration timed out', {
              widgetName,
              timeout
            });
            this.registrationPromises.delete(widgetName);
            resolve(); // Resolve anyway to not block
          }
        }, timeout);
      });
    });
    
    // Wait for all widgets (or timeouts)
    await Promise.all(waitPromises);
    
    // Apply minimum wait time if we finished too quickly
    const elapsed = Date.now() - startTime;
    if (elapsed < minWaitTime) {
      const remainingWait = minWaitTime - elapsed;
      logger.debug('Applying remaining minimum wait time', {
        remainingMs: remainingWait
      });
      await new Promise(resolve => setTimeout(resolve, remainingWait));
    }
    
    // Determine which widgets actually registered
    const finalRegistered = widgetsToWaitFor.filter(name => 
      this.registeredWidgets.has(name)
    );
    
    const timedOut = widgetsToWaitFor.filter(name => 
      !this.registeredWidgets.has(name)
    );
    
    const finalDuration = Date.now() - startTime;
    
    logger.info('Widget registration complete', {
      registered: finalRegistered,
      timedOut,
      duration: finalDuration
    });
    
    return {
      success: timedOut.length === 0,
      registered: finalRegistered,
      timedOut,
      duration: finalDuration
    };
  }

  /**
   * Check if a specific widget is registered
   * @param {string} widgetName - Widget name
   * @returns {boolean}
   */
  isWidgetRegistered(widgetName) {
    return this.registeredWidgets.has(widgetName);
  }

  /**
   * Get all registered widgets
   * @returns {Array<string>}
   */
  getRegisteredWidgets() {
    return Array.from(this.registeredWidgets);
  }

  /**
   * Get registration status
   * @returns {Object}
   */
  getStatus() {
    return {
      required: this.requiredWidgets,
      registered: Array.from(this.registeredWidgets),
      pending: this.requiredWidgets.filter(name => 
        !this.registeredWidgets.has(name)
      )
    };
  }
}