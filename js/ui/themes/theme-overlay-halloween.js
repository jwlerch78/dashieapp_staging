// js/themes/theme-overlay-halloween.js
// Halloween theme overlay configuration
// Defines all animated overlay elements for Halloween themes

/**
 * Halloween Overlay Configuration
 *
 * New additions:
 * - Static header rotations: header-left and header-right
 * - Motion animations: spider-walking, ghost-floating, witch-on-broom, ghosts-circle, floating-witches-hat, bat-fly-1
 * - 2.5s gap between motion animations
 * - Existing elements preserved and updated where needed
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
    'header-left': [
        { element: 'haunted-house', duration: 10 },
        { element: 'cauldron', duration: 10 },
        { element: 'spider-drop', duration: 10 },
        { element: 'moon-and-bats', duration: 10 }
    ],
    'header-right': [
        { element: 'graveyard', duration: 10 },
        { element: 'cat-and-bats', duration: 10 },
        { element: 'pumpkin-glow', duration: 10 },
        { element: 'pumpkin-bat', duration: 10 }
    ],
    'motion-animations': [
        { element: 'spider-walk-1', duration: 10 },
        { blank: 2.5 },
        { element: 'ghost-floating', duration: 8 },
        { blank: 2.5 },
        { element: 'witch-on-broom', duration: 1.5 },
        { blank: 2.5 },
        { element: 'ghosts-circle', duration: 2 },
        { blank: 2.5 },
        { element: 'floating-witches-hat', duration: 6 },
        { blank: 2.5 },
        { element: 'bat-drop-1', duration: 12 }
    ]
};

/**
 * Individual Element Definitions
 * Define visual properties, positioning, and movement for each element
 */
const ELEMENTS = [
    // Static header left
    {
        id: 'haunted-house',
        src: '/assets/themes/halloween/animated/Haunted-house.gif',
        container: 'dashboard',
        size: { width: '50px' },
        position: { type: 'static-xy', x: '15%', y: '1.2%' },
        movement: { type: 'none' }
    },
    {
        id: 'cauldron',
        src: '/assets/themes/halloween/animated/Cauldron.gif',
        container: 'dashboard',
        size: { width: '50px' },
        position: { type: 'static-xy', x: '15%', y: '1.2%' },
        movement: { type: 'none' }
    },
    {
        id: 'spider-drop',
        src: '/assets/themes/halloween/animated/spider-drop.gif',
        container: 'dashboard',
        size: { width: '50px' },
        position: { type: 'static-xy', x: '15%', y: '1.2%' },
        movement: { type: 'none' }
        // No visibility - controlled by 'header-left' rotation sequence
    },
    {
        id: 'moon-and-bats',
        src: '/assets/themes/halloween/animated/Moon-and-Bats.gif',
        container: 'dashboard',
        size: { width: '50px' },
        position: { type: 'static-xy', x: '15%', y: '1.2%' },
        movement: { type: 'none' }
    },

    // Static header right
    {
        id: 'graveyard',
        src: '/assets/themes/halloween/animated/Graveyard.gif',
        container: 'dashboard',
        size: { width: '50px' },
        position: { type: 'static-xy', x: '58%', y: '0%' },
        movement: { type: 'none' }
    },
    {
        id: 'cat-and-bats',
        src: '/assets/themes/halloween/animated/Cat-and-bats.gif',
        container: 'dashboard',
        size: { width: '50px' },
        position: { type: 'static-xy', x: '58%', y: '2%' },
        movement: { type: 'none' }
    },
    {
        id: 'pumpkin-bat',
        src: '/assets/themes/halloween/animated/Pumpkin-bat.gif',
        container: 'dashboard',
        size: { width: '50px' },
        position: { type: 'static-xy', x: '58%', y: '0%' },
        movement: { type: 'none' }
    },
    {
        id: 'pumpkin-glow',
        src: '/assets/themes/halloween/animated/pumpkin-glow.gif',
        container: 'dashboard',
        size: { width: '50px' },
        position: { type: 'static-xy', x: '58%', y: '0%' },
        movement: { type: 'none' }
    },

    // Motion animations
    {
        id: 'spider-walk-1',
        src: '/assets/themes/halloween/animated/spider-walking.gif',
        container: 'dashboard',
        size: { width: '100px' },
        position: { type: 'variable-x', xRange: [70, 95], y: '51%' },
        movement: { type: 'none' }
        // No visibility - controlled by 'motion-animations' rotation sequence
    },
    {
        id: 'ghost-floating',
        src: '/assets/themes/halloween/animated/ghost-floating.gif',
        container: 'dashboard',
        size: { width: '70px' },
        position: { type: 'static-xy', x: '0%', y: '100%' },
        movement: { type: 'up', distance: '100vh', duration: 8, easing: 'linear' }
    },
    {
        id: 'witch-on-broom',
        src: '/assets/themes/halloween/animated/witch-on-broom.gif',
        container: 'dashboard',
        size: { width: '100px' },
        position: { type: 'variable-y', x: '-100px', yRange: [10, 80] },
        movement: { type: 'right', distance: 'calc(100vw + 200px)', duration: 1.5, easing: 'linear' }
    },
    {
        id: 'ghosts-circle',
        src: '/assets/themes/halloween/animated/ghosts-circle.gif',
        container: 'dashboard',
        size: { width: '100px' },
        position: { type: 'static-xy', x: '80%', y: '70%' },
        movement: { type: 'none' }
    },
    {
        id: 'floating-witches-hat',
        src: '/assets/themes/halloween/animated/Floating-witches-hat.gif',
        container: 'dashboard',
        size: { width: '60px' },
        position: { type: 'variable-y', x: '-100px', yRange: [20, 50] },
        movement: { type: 'right', distance: '50vw', duration: 6, easing: 'linear' }
    },

    // Existing periodic bat drop
    {
        id: 'bat-drop-1',
        src: '/assets/themes/halloween/animated/bat-flying.gif',
        container: 'dashboard',
        size: { width: '75px' },
        position: { type: 'static-xy', x: '-10px', y: '0%' },
        movement: { type: 'down', distance: '200px', duration: 3, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    }
];

/**
 * Export Halloween Overlay Configuration
 */
export const HALLOWEEN_OVERLAY_CONFIG = {
    rotations: ROTATION_SEQUENCES,
    elements: ELEMENTS
};

export default HALLOWEEN_OVERLAY_CONFIG;
