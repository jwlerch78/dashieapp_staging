// js/ui/themes/theme-overlay-container-manager.js
// Container management for theme overlays
// Handles dashboard and widget iframe overlay containers

import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ThemeOverlayContainer');

/**
 * ThemeOverlayContainerManager
 * Manages overlay containers in dashboard and widget iframes
 */
export class ThemeOverlayContainerManager {
    constructor() {
        this.overlayElement = null;
    }

    /**
     * Create the main overlay container element (lazy)
     * @returns {HTMLElement|null} The overlay container
     */
    createOverlayContainer() {
        if (this.overlayElement) return this.overlayElement;

        logger.debug('Creating overlay container');

        this.overlayElement = document.createElement('div');
        this.overlayElement.id = 'theme-overlay';
        this.overlayElement.className = 'theme-overlay';

        const dashboard = document.getElementById('dashboard-container');
        if (dashboard) {
            dashboard.appendChild(this.overlayElement);
            logger.debug('Overlay container added to dashboard');
        } else {
            logger.warn('Dashboard container not found, appending to body');
            document.body.appendChild(this.overlayElement);
        }

        return this.overlayElement;
    }

    /**
     * Get target container for overlay element
     * @param {string} containerSpec - Container specification ('dashboard' or 'widget-{name}')
     * @returns {HTMLElement|null}
     */
    getTargetContainer(containerSpec) {
        // Default to dashboard overlay
        if (!containerSpec || containerSpec === 'dashboard') {
            return this.overlayElement;
        }

        // Widget container (e.g., 'widget-clock')
        if (containerSpec.startsWith('widget-')) {
            const widgetId = containerSpec; // e.g., 'widget-clock'
            const widgetIframe = document.getElementById(widgetId);

            if (!widgetIframe) {
                // This is expected during initial theme application before widgets are created
                logger.debug(`Widget iframe not found: ${widgetId} (will retry after widgets initialize)`);
                const allWidgetIframes = Array.from(document.querySelectorAll('.widget-iframe')).map(el => el.id);
                logger.debug(`Available widget iframes:`, allWidgetIframes);
                return null;
            }

            // Try to access the iframe's content document
            let iframeDoc;
            try {
                iframeDoc = widgetIframe.contentDocument || widgetIframe.contentWindow?.document;
            } catch (error) {
                logger.error(`Cannot access iframe document for ${widgetId} (cross-origin?)`, error);
                return null;
            }

            if (!iframeDoc || !iframeDoc.body) {
                logger.warn(`Widget iframe document not ready: ${widgetId}`, {
                    hasDoc: !!iframeDoc,
                    hasBody: !!iframeDoc?.body,
                    readyState: iframeDoc?.readyState
                });
                return null;
            }

            // Create or get overlay container inside iframe's body
            let widgetOverlay = iframeDoc.body.querySelector('.widget-theme-overlay');
            if (!widgetOverlay) {
                widgetOverlay = iframeDoc.createElement('div');
                widgetOverlay.className = 'widget-theme-overlay';
                widgetOverlay.style.position = 'fixed';
                widgetOverlay.style.top = '0';
                widgetOverlay.style.left = '0';
                widgetOverlay.style.width = '100%';
                widgetOverlay.style.height = '100%';
                widgetOverlay.style.pointerEvents = 'none';
                widgetOverlay.style.overflow = 'hidden';
                widgetOverlay.style.zIndex = '9999'; // Top layer in iframe
                iframeDoc.body.appendChild(widgetOverlay);
                logger.debug(`Created overlay container inside iframe: ${widgetId}`);
            } else {
                logger.debug(`Reusing overlay container in iframe: ${widgetId}`);
            }

            return widgetOverlay;
        }

        logger.warn(`Unknown container specification: ${containerSpec}`);
        return null;
    }

    /**
     * Clear all overlay elements from dashboard and widgets
     */
    clearAllContainers() {
        // Remove dashboard overlay elements
        if (this.overlayElement) {
            while (this.overlayElement.firstChild) {
                this.overlayElement.removeChild(this.overlayElement.firstChild);
            }
        }

        // Remove all widget overlay containers
        const widgetOverlays = document.querySelectorAll('.widget-theme-overlay');
        widgetOverlays.forEach(overlay => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });

        logger.debug('Cleared all overlay containers');
    }

    /**
     * Destroy the main overlay container
     */
    destroy() {
        this.clearAllContainers();

        if (this.overlayElement && this.overlayElement.parentNode) {
            this.overlayElement.parentNode.removeChild(this.overlayElement);
        }

        this.overlayElement = null;
    }
}
