// js/themes/theme-overlay-halloween.js
// Halloween theme overlay configuration
// Defines all animated overlay elements for Halloween themes

/**
 * Halloween Overlay Configuration
 *
 * ROTATION SEQUENCES:
 * - flying-creatures: bat-fly-1 (12s) → ghosts-circle (20s) → blank (30s) → repeat
 * - pumpkins: pumpkin-bat-1 (15s) → pumpkin-glow-1 (15s) → repeat (no gap)
 *
 * INDIVIDUAL ELEMENTS:
 * - bat-drop-1: Periodic bat dropping from top
 * - spider-walk-1: Periodic spider appearing at random positions
 * - spider-drop: Static hanging spider
 */

/**
 * Rotation Sequences
 * Define the order and timing for rotating elements
 *
 * Format:
 * - { element: 'element-id', duration: seconds } - Show element for duration
 * - { blank: seconds } - Show nothing for duration
 */
const ROTATION_SEQUENCES = {
    'flying-creatures': [
        { element: 'bat-fly-1', duration: 12 },      // Bat flies across calendar
        { element: 'ghosts-circle', duration: 20 },  // Ghosts float across bottom
        { blank: 30 }                                // 30 seconds of nothing
        // Then repeats from bat-fly-1
    ],

    'pumpkins': [
        { element: 'pumpkin-bat-1', duration: 15 },   // Pumpkin with bat
        { element: 'pumpkin-glow-1', duration: 15 }   // Glowing pumpkin
        // Loops immediately, no gap
    ]
};

/**
 * Individual Element Definitions
 * Define visual properties, positioning, and movement for each element
 * Visibility timing is controlled by rotation sequences or individual periodic settings
 */
const ELEMENTS = [
    {
        id: 'bat-drop-1',
        src: '/assets/themes/halloween/animated/bat-flying.gif',
        container: 'dashboard',
        size: { width: '120px' },
        position: {
            type: 'variable-x',
            y: '-50px',
            xRange: [10, 90]
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
            offDuration: 10
        }
    },
    {
        id: 'spider-walk-1',
        src: '/assets/themes/halloween/animated/spider-walking.gif',
        container: 'dashboard',
        size: { width: '100px' },
        position: {
            type: 'variable-x',
            xRange: [70, 95],
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
        container: 'widget-main',
        size: { width: '100px' },
        position: {
            type: 'variable-y',
            x: '-100px',
            yRange: [10, 40]
        },
        movement: {
            type: 'right',
            distance: 'calc(100vw + 200px)',
            duration: 12,
            easing: 'linear'
        }
        // Visibility controlled by 'flying-creatures' rotation sequence
    },
    {
        id: 'pumpkin-bat-1',
        src: '/assets/themes/halloween/animated/Pumpkin-bat.gif',
        container: 'dashboard',
        size: { width: '75px' },
        position: {
            type: 'static-xy',
            x: '55%',
            y: '0%'
        },
        movement: {
            type: 'none'
        }
        // Visibility controlled by 'pumpkins' rotation sequence
    },
    {
        id: 'pumpkin-glow-1',
        src: '/assets/themes/halloween/animated/pumpkin-glow.gif',
        container: 'dashboard',
        size: { width: '75px' },
        position: {
            type: 'static-xy',
            x: '55%',
            y: '0%'
        },
        movement: {
            type: 'none'
        }
        // Visibility controlled by 'pumpkins' rotation sequence
    },
    {
        id: 'spider-drop',
        src: '/assets/themes/halloween/animated/spider-drop.gif',
        container: 'dashboard',
        size: { width: '75px' },
        position: {
            type: 'static-xy',
            x: '15%',
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
            x: '-100px',
            y: '85%'
        },
        movement: {
            type: 'right',
            distance: 'calc(100vw + 200px)',
            duration: 20,
            easing: 'linear'
        }
        // Visibility controlled by 'flying-creatures' rotation sequence
    }
];

/**
 * Export Halloween Overlay Configuration
 * Combines rotation sequences and individual element definitions
 */
export const HALLOWEEN_OVERLAY_CONFIG = {
    rotations: ROTATION_SEQUENCES,
    elements: ELEMENTS
};

export default HALLOWEEN_OVERLAY_CONFIG;
