// js/services/greeting-service.js
// v1.2 - 10/10/25 2:25pm - Varied punctuation to reduce over-enthusiasm

/**
 * Dynamic Greeting Service
 * Provides context-aware greetings based on time of day and day of week
 */

// Greeting database organized by time period and day context
const GREETINGS = {
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

// Greetings without family name (for variety - 20% chance)
const NO_FAMILY_GREETINGS = {
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
 * Get a dynamic greeting based on current context
 * @param {string} familyName - The family name to use
 * @returns {string} Formatted greeting
 */
export function getGreeting(familyName) {
  const timePeriod = getTimePeriod();
  const dayContext = getDayContext();
  
  // 20% chance of no family name for variety
  if (Math.random() < 0.2) {
    return selectRandom(NO_FAMILY_GREETINGS[timePeriod]);
  }
  
  // Get greetings for this time period
  const timeGreetings = GREETINGS[timePeriod];
  
  // Try to get day-specific greetings, fall back to default
  const dayGreetings = timeGreetings[dayContext] || timeGreetings.default;
  
  // Select random greeting and format with family name
  const template = selectRandom(dayGreetings);
  return template.replace('{family}', familyName);
}

/**
 * Get all available greetings for current context
 * @param {string} familyName - The family name to use
 * @returns {Array<string>} Array of all possible greetings
 */
export function getAllGreetings(familyName) {
  const timePeriod = getTimePeriod();
  const dayContext = getDayContext();
  
  const allGreetings = [];
  
  // Get greetings for this time period
  const timeGreetings = GREETINGS[timePeriod];
  
  // Get day-specific greetings
  const dayGreetings = timeGreetings[dayContext] || timeGreetings.default;
  
  // Add all day-specific greetings with family name
  dayGreetings.forEach(template => {
    allGreetings.push(template.replace('{family}', familyName));
  });
  
  // Add no-family greetings
  const noFamilyGreetings = NO_FAMILY_GREETINGS[timePeriod];
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
