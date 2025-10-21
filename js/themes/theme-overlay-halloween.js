// js/themes/theme-overlay-halloween.js
// Halloween theme overlay configuration
// Defines all animated overlay elements for Halloween themes

/**
 * Halloween Overlay Configuration
 *
 * Defines 6 overlay elements:
 * - bat-drop-1: Periodic bat dropping from top
 * - spider-walk-1: Periodic spider appearing at random positions
 * - bat-fly-1: Periodic bat flying across calendar widget
 * - pumpkin-glow-1: Static glowing pumpkin
 * - spider-drop: Static hanging spider
 * - ghosts-circle: Periodic ghosts floating across bottom
 */
export const HALLOWEEN_OVERLAY_CONFIG = {
    elements: [
        {
            id: 'bat-drop-1',
            src: '/assets/themes/halloween/animated/bat-flying.gif',
            container: 'dashboard', // Dashboard-level overlay
            size: { width: '120px' },
            position: {
                type: 'variable-x',
                y: '-50px',
                xRange: [10, 90]  // Random X between 10-90%
            },
            movement: {
                type: 'down',
                distance: '300px',
                duration: 3,
                easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            },
            visibility: {
                type: 'periodic',
                onDuration: 6,
                offDuration: 10  // Reduced for testing (was 50)
            }
        },
        {
            id: 'spider-walk-1',
            src: '/assets/themes/halloween/animated/spider-walking.gif',
            container: 'dashboard', // Dashboard-level overlay
            size: { width: '100px' },
            position: {
                type: 'variable-x',
                xRange: [70, 95],  // Random X between 70-90% (keep it visible)
                y: '51%'
            },
            movement: {
                type: 'none'  // GIF is already animated
            },
            visibility: {
                type: 'periodic',
                onDuration: 10,
                offDuration: 8
            }
        },
        {
            id: 'bat-fly-1',
            src: '/assets/themes/halloween/animated/bat-flying.gif',
            container: 'widget-main', // Calendar widget
            size: { width: '100px' },
            position: {
                type: 'variable-y',
                x: '-100px',
                yRange: [10, 40]  // Random Y between 10-40%
            },
            movement: {
                type: 'right',
                distance: 'calc(100vw + 200px)',
                duration: 12,
                easing: 'linear'
            },
            visibility: {
                type: 'rotating',
                group: 'flying-creatures',
                onDuration: 12  // Bat flies across for 12 seconds
            }
        },
        {
            id: 'pumpkin-glow-1',
            src: '/assets/themes/halloween/animated/pumpkin-glow.gif',
            container: 'dashboard', // Dashboard-level overlay
            size: { width: '75px' },
            position: {
                type: 'static-xy',
                x: '55%',
                y: '0%'
            },
            movement: {
                type: 'none'
            },
            visibility: {
                type: 'always'
            }
        },
        {
            id: 'spider-drop',
            src: '/assets/themes/halloween/animated/spider-drop.gif',
            container: 'dashboard', // Widget-specific overlay
            size: { width: '75px' },
            position: {
                type: 'static-xy',
                x: '15%', // top of header
                y: '1.2%'
            },
            movement: {
                type: 'none'
            },
            visibility: {
                type: 'always'
            }
        },
        {
            id: 'ghosts-circle',
            src: '/assets/themes/halloween/animated/ghosts-circle.gif',
            container: 'dashboard',
            size: { width: '150px' },
            position: {
                type: 'static-xy',
                x: '-100px',  // Start offscreen left
                y: '85%'      // Bottom of screen
            },
            movement: {
                type: 'right',
                distance: 'calc(100vw + 200px)',  // Full screen width plus extra
                duration: 20,  // 20 seconds to cross
                easing: 'linear'
            },
            visibility: {
                type: 'rotating',
                group: 'flying-creatures',
                onDuration: 20,   // Ghosts float across for 20 seconds
                offDuration: 30   // Wait 30s before restarting the cycle (bat → ghosts → wait → repeat)
            }
        }
    ]
};

export default HALLOWEEN_OVERLAY_CONFIG;
