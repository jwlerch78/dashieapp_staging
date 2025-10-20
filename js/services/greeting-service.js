// js/services/greeting-service.js
// v2.0 - 10/20/25 - Theme-aware greetings with Halloween support

/**
 * Dynamic Greeting Service
 * Provides context-aware and theme-aware greetings
 * Supports different greeting sets for different themes (e.g., Halloween)
 */

// ============================================================================
// DEFAULT GREETINGS
// ============================================================================

const DEFAULT_GREETINGS = {
  // Early Morning (5am - 8am)
  earlyMorning: {
    monday: [
      "Rise and shine, {family} Family.",
      "Good morning, {family} Family.",
      "Early start, {family} Family.",
      "Morning, {family} Family.",
      "Happy Monday, {family} Family!"
    ],
    friday: [
      "Good morning, {family} Family.",
      "Friday is here, {family} Family!",
      "Morning, {family} Family.",
      "Rise and shine, {family} Family.",
      "Happy Friday, {family} Family!"
    ],
    weekend: [
      "Good morning, {family} Family.",
      "Rise and shine, {family} Family.",
      "Happy weekend, {family} Family!",
      "Morning, {family} Family.",
      "Weekend mornings, {family} Family."
    ],
    default: [
      "Good morning, {family} Family.",
      "Rise and shine, {family} Family.",
      "Morning energy, {family} Family.",
      "Morning, {family} Family.",
      "Have a great day, {family} Family."
    ]
  },

  // Morning (8am - 12pm)
  morning: {
    monday: [
      "Good morning, {family} Family.",
      "Happy Monday, {family} Family!",
      "Morning, {family} Family.",
      "Monday morning, {family} Family.",
      "Start strong, {family} Family."
    ],
    friday: [
      "Happy Friday, {family} Family!",
      "Good morning, {family} Family.",
      "Friday morning, {family} Family.",
      "Morning, {family} Family.",
      "TGIF, {family} Family!"
    ],
    weekend: [
      "Good morning, {family} Family.",
      "Weekend mornings, {family} Family.",
      "Happy weekend, {family} Family!",
      "Morning, {family} Family.",
      "Relax and recharge, {family} Family."
    ],
    default: [
      "Good morning, {family} Family.",
      "Morning, {family} Family.",
      "Hello, {family} Family.",
      "Have a great day, {family} Family.",
      "Ready for today, {family} Family?"
    ]
  },

  // Afternoon (12pm - 5pm)
  afternoon: {
    monday: [
      "Good afternoon, {family} Family.",
      "Afternoon, {family} Family.",
      "Happy Monday afternoon, {family} Family.",
      "You're doing great, {family} Family.",
      "Keep going, {family} Family."
    ],
    friday: [
      "Happy Friday afternoon, {family} Family!",
      "Afternoon, {family} Family.",
      "Friday vibes, {family} Family.",
      "Almost the weekend, {family} Family!",
      "Keep it up, {family} Family."
    ],
    weekend: [
      "Good afternoon, {family} Family.",
      "Happy weekend, {family} Family!",
      "Afternoon, {family} Family.",
      "Enjoying your day, {family} Family?",
      "Weekend vibes, {family} Family."
    ],
    default: [
      "Good afternoon, {family} Family.",
      "Afternoon, {family} Family.",
      "Keep going, {family} Family.",
      "You're doing great, {family} Family.",
      "Happy afternoon, {family} Family."
    ]
  },

  // Evening (5pm - 9pm)
  evening: {
    monday: [
      "Good evening, {family} Family.",
      "Evening, {family} Family.",
      "Monday complete, {family} Family.",
      "Time to relax, {family} Family.",
      "Well done today, {family} Family."
    ],
    friday: [
      "Happy Friday evening, {family} Family!",
      "Evening, {family} Family.",
      "Weekend is here, {family} Family!",
      "Friday night, {family} Family.",
      "Time to celebrate, {family} Family!"
    ],
    weekend: [
      "Good evening, {family} Family.",
      "Happy weekend evening, {family} Family.",
      "Evening, {family} Family.",
      "Weekend relaxation, {family} Family.",
      "Enjoy your evening, {family} Family."
    ],
    default: [
      "Good evening, {family} Family.",
      "Evening, {family} Family.",
      "Time to unwind, {family} Family.",
      "Relax and recharge, {family} Family.",
      "Happy evening, {family} Family."
    ]
  },

  // Night (9pm - 5am)
  night: {
    monday: [
      "Good night, {family} Family.",
      "Sweet dreams, {family} Family.",
      "Rest well, {family} Family.",
      "Sleep tight, {family} Family.",
      "Time for bed, {family} Family."
    ],
    friday: [
      "Good night, {family} Family.",
      "Friday night, {family} Family!",
      "Sweet dreams, {family} Family.",
      "Rest up, {family} Family.",
      "Sleep well, {family} Family."
    ],
    weekend: [
      "Good night, {family} Family.",
      "Sweet dreams, {family} Family.",
      "Weekend rest, {family} Family.",
      "Sleep tight, {family} Family.",
      "Rest well, {family} Family."
    ],
    default: [
      "Good night, {family} Family.",
      "Sweet dreams, {family} Family.",
      "Time for rest, {family} Family.",
      "Sleep tight, {family} Family.",
      "Rest well, {family} Family."
    ]
  }
};

// Default greetings without family name (for variety - 20% chance)
const DEFAULT_NO_FAMILY_GREETINGS = {
  earlyMorning: [
    "Rise and shine.",
    "Early bird gets the worm.",
    "Good morning.",
    "Wakey wakey!",
    "Morning has broken."
  ],
  morning: [
    "Good morning.",
    "Have a great day.",
    "Make today amazing.",
    "Seize the day.",
    "Hello sunshine!"
  ],
  afternoon: [
    "Good afternoon.",
    "Happy afternoon.",
    "Keep going strong.",
    "You're doing great.",
    "Afternoon vibes."
  ],
  evening: [
    "Good evening.",
    "Time to unwind.",
    "Relax and recharge.",
    "Evening relaxation.",
    "Wind down time."
  ],
  night: [
    "Good night.",
    "Sweet dreams.",
    "Time for rest.",
    "Sleep tight.",
    "Late night vibes."
  ]
};

// ============================================================================
// HALLOWEEN GREETINGS
// ============================================================================

const HALLOWEEN_GREETINGS = {
  // Early Morning (5am - 8am)
  earlyMorning: {
    monday: [
      "Rise from the grave, {family} Family.",
      "Spooky Monday morning, {family} Family!",
      "The witching hour has passed, {family} Family.",
      "Good morning, ghosts and ghouls of the {family} Family.",
      "Happy Haunted Monday, {family} Family!"
    ],
    friday: [
      "Frightful Friday morning, {family} Family!",
      "The bats are still sleeping, {family} Family.",
      "Spooky Friday greetings, {family} Family!",
      "Rise and haunt, {family} Family.",
      "Happy Fright-day, {family} Family!"
    ],
    weekend: [
      "Spooky weekend morning, {family} Family!",
      "The monsters are stirring, {family} Family.",
      "Weekend hauntings begin, {family} Family!",
      "Good morning, creatures of the {family} Family.",
      "Happy Haunted Weekend, {family} Family!"
    ],
    default: [
      "Rise and haunt, {family} Family.",
      "Spooky morning, {family} Family!",
      "The creatures are awakening, {family} Family.",
      "Good morning, ghouls of the {family} Family.",
      "Happy Haunted Morning, {family} Family!"
    ]
  },

  // Morning (8am - 12pm)
  morning: {
    monday: [
      "Spooky Monday, {family} Family!",
      "The ghosts say hello, {family} Family.",
      "Bewitching Monday morning, {family} Family!",
      "Happy Haunted Monday, {family} Family.",
      "Creepy good morning, {family} Family!"
    ],
    friday: [
      "Frightful Friday, {family} Family!",
      "The witches are brewing, {family} Family.",
      "Spooky Friday vibes, {family} Family!",
      "Happy Fright-day, {family} Family!",
      "Bewitching Friday, {family} Family!"
    ],
    weekend: [
      "Spooky weekend, {family} Family!",
      "The haunted mansion is open, {family} Family.",
      "Weekend of frights, {family} Family!",
      "Happy Haunted Weekend, {family} Family!",
      "Creepy good morning, {family} Family!"
    ],
    default: [
      "Spooky greetings, {family} Family!",
      "The pumpkins are glowing, {family} Family.",
      "Bewitching morning, {family} Family!",
      "Happy Haunted Day, {family} Family!",
      "Creepy good vibes, {family} Family!"
    ]
  },

  // Afternoon (12pm - 5pm)
  afternoon: {
    monday: [
      "Spooky Monday afternoon, {family} Family.",
      "The cauldron is bubbling, {family} Family.",
      "Haunted afternoon, {family} Family!",
      "Keep haunting, {family} Family.",
      "Bewitching Monday vibes, {family} Family!"
    ],
    friday: [
      "Frightful Friday afternoon, {family} Family!",
      "The monsters are lurking, {family} Family.",
      "Spooky Friday fun, {family} Family!",
      "Almost haunted weekend, {family} Family!",
      "Keep up the spooks, {family} Family!"
    ],
    weekend: [
      "Spooky weekend afternoon, {family} Family!",
      "The graveyard is lively, {family} Family.",
      "Haunted weekend vibes, {family} Family!",
      "Enjoying the frights, {family} Family?",
      "Creepy good afternoon, {family} Family!"
    ],
    default: [
      "Spooky afternoon, {family} Family!",
      "The spirits are active, {family} Family.",
      "Keep up the haunting, {family} Family.",
      "Bewitching vibes, {family} Family!",
      "Happy Haunted Afternoon, {family} Family!"
    ]
  },

  // Evening (5pm - 9pm)
  evening: {
    monday: [
      "Spooky Monday evening, {family} Family.",
      "The moon is rising, {family} Family.",
      "Haunted Monday complete, {family} Family.",
      "Time for tricks and treats, {family} Family!",
      "Bewitching evening, {family} Family!"
    ],
    friday: [
      "Frightful Friday night, {family} Family!",
      "The creatures come alive, {family} Family!",
      "Spooky weekend is here, {family} Family!",
      "Friday night frights, {family} Family!",
      "Time to celebrate the spooks, {family} Family!"
    ],
    weekend: [
      "Spooky weekend evening, {family} Family!",
      "The haunted hour arrives, {family} Family.",
      "Ghostly evening vibes, {family} Family!",
      "Weekend haunting continues, {family} Family.",
      "Enjoy your eerie evening, {family} Family!"
    ],
    default: [
      "Spooky evening, {family} Family!",
      "The witching hour approaches, {family} Family.",
      "Time to haunt and unwind, {family} Family.",
      "Bewitching relaxation, {family} Family!",
      "Happy Haunted Evening, {family} Family!"
    ]
  },

  // Night (9pm - 5am)
  night: {
    monday: [
      "Good fright, {family} Family.",
      "Sweet screams, {family} Family!",
      "Rest in peace, {family} Family.",
      "Sleep fright, {family} Family!",
      "Time to haunt your dreams, {family} Family."
    ],
    friday: [
      "Frightful Friday night, {family} Family!",
      "Sweet nightmares, {family} Family!",
      "Rest with the ghosts, {family} Family.",
      "Sleep among the spirits, {family} Family!",
      "Friday night frights, {family} Family!"
    ],
    weekend: [
      "Spooky dreams, {family} Family!",
      "Sweet haunted sleep, {family} Family.",
      "Weekend rest with the spirits, {family} Family.",
      "Sleep fright, {family} Family!",
      "Rest in the haunted house, {family} Family."
    ],
    default: [
      "Good fright, {family} Family.",
      "Sweet screams, {family} Family!",
      "Time for haunted rest, {family} Family.",
      "Sleep among the spirits, {family} Family!",
      "Rest with the ghosts, {family} Family."
    ]
  }
};

// Halloween greetings without family name
const HALLOWEEN_NO_FAMILY_GREETINGS = {
  earlyMorning: [
    "Rise and haunt.",
    "The creatures are stirring.",
    "Spooky morning.",
    "Boo! Good morning!",
    "The witching hour has passed."
  ],
  morning: [
    "Spooky greetings!",
    "Have a frightful day.",
    "Make today spooktacular!",
    "Seize the boo!",
    "Hello, fellow ghost!"
  ],
  afternoon: [
    "Spooky afternoon.",
    "Happy haunted day.",
    "Keep haunting strong.",
    "You're doing boo-tifully.",
    "Creepy good vibes."
  ],
  evening: [
    "Spooky evening.",
    "Time to trick or treat.",
    "Haunt and recharge.",
    "Bewitching hour begins.",
    "Wind down with the spirits."
  ],
  night: [
    "Good fright.",
    "Sweet screams.",
    "Time for haunted rest.",
    "Sleep fright.",
    "May the spirits watch over you."
  ]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get current time period
 * @returns {string} Time period key
 */
function getTimePeriod() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 8) return 'earlyMorning';
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Get current day context
 * @returns {string} Day context key
 */
function getDayContext() {
  const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday

  if (day === 1) return 'monday';
  if (day === 5) return 'friday';
  if (day === 0 || day === 6) return 'weekend';
  return 'default';
}

/**
 * Select a random greeting from array
 * @param {Array} greetings - Array of greeting strings
 * @returns {string} Selected greeting
 */
function selectRandom(greetings) {
  return greetings[Math.floor(Math.random() * greetings.length)];
}

/**
 * Detect if theme is Halloween-themed
 * @param {string} theme - Theme name (e.g., 'halloween-dark', 'halloween-light')
 * @returns {boolean} True if Halloween theme
 */
function isHalloweenTheme(theme) {
  if (!theme) return false;
  return theme.toLowerCase().includes('halloween');
}

/**
 * Get appropriate greeting set based on theme
 * @param {string} theme - Current theme name
 * @returns {Object} Greeting set object
 */
function getGreetingSet(theme) {
  if (isHalloweenTheme(theme)) {
    return {
      greetings: HALLOWEEN_GREETINGS,
      noFamilyGreetings: HALLOWEEN_NO_FAMILY_GREETINGS
    };
  }

  return {
    greetings: DEFAULT_GREETINGS,
    noFamilyGreetings: DEFAULT_NO_FAMILY_GREETINGS
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get a dynamic greeting based on current context and theme
 * @param {string} familyName - The family name to use
 * @param {string} theme - Current theme name (optional)
 * @returns {string} Formatted greeting
 */
export function getGreeting(familyName, theme = null) {
  const timePeriod = getTimePeriod();
  const dayContext = getDayContext();
  const greetingSet = getGreetingSet(theme);

  // 20% chance of no family name for variety
  if (Math.random() < 0.2) {
    return selectRandom(greetingSet.noFamilyGreetings[timePeriod]);
  }

  // Get greetings for this time period
  const timeGreetings = greetingSet.greetings[timePeriod];

  // Try to get day-specific greetings, fall back to default
  const dayGreetings = timeGreetings[dayContext] || timeGreetings.default;

  // Select random greeting and format with family name
  const template = selectRandom(dayGreetings);
  return template.replace('{family}', familyName);
}

/**
 * Get all available greetings for current context and theme
 * @param {string} familyName - The family name to use
 * @param {string} theme - Current theme name (optional)
 * @returns {Array<string>} Array of all possible greetings
 */
export function getAllGreetings(familyName, theme = null) {
  const timePeriod = getTimePeriod();
  const dayContext = getDayContext();
  const greetingSet = getGreetingSet(theme);

  const allGreetings = [];

  // Get greetings for this time period
  const timeGreetings = greetingSet.greetings[timePeriod];

  // Get day-specific greetings
  const dayGreetings = timeGreetings[dayContext] || timeGreetings.default;

  // Add all day-specific greetings with family name
  dayGreetings.forEach(template => {
    allGreetings.push(template.replace('{family}', familyName));
  });

  // Add no-family greetings
  const noFamilyGreetings = greetingSet.noFamilyGreetings[timePeriod];
  allGreetings.push(...noFamilyGreetings);

  return allGreetings;
}

/**
 * Get static family greeting (original format)
 * @param {string} familyName - The family name to use
 * @returns {string} Formatted static greeting
 */
export function getStaticGreeting(familyName) {
  return `The ${familyName} Family`;
}

/**
 * Check if a theme uses special greetings
 * @param {string} theme - Theme name
 * @returns {boolean} True if theme has custom greetings
 */
export function hasThemeGreetings(theme) {
  return isHalloweenTheme(theme);
}
