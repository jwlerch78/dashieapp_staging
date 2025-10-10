// js/services/greeting-service.js
// v1.0 - 10/9/25 - Dynamic greeting system with context-aware phrases

/**
 * Dynamic Greeting Service
 * Provides context-aware greetings based on time of day and day of week
 */

// Greeting database organized by time period and day context
const GREETINGS = {
  // Early Morning (5am - 8am)
  earlyMorning: {
    monday: [
      "Rise and shine, {family}! New week ahead!",
      "Good morning, {family}! Monday motivation time!",
      "Early start, {family}! Let's make it count!",
      "Morning, {family}! Fresh week, fresh start!",
      "Up early, {family}! Ready to tackle Monday?"
    ],
    friday: [
      "Good morning, {family}! Friday is here!",
      "Early bird catches the weekend, {family}!",
      "Morning, {family}! The weekend is almost here!",
      "Rise and shine, {family}! Friday vibes!",
      "Good morning, {family}! One more day until the weekend!"
    ],
    weekend: [
      "Good morning, {family}! Enjoy your weekend!",
      "Rise and shine, {family}! Weekend mode activated!",
      "Early weekend morning, {family}!",
      "Good morning, {family}! Time to relax!",
      "Up early on the weekend, {family}? Impressive!"
    ],
    default: [
      "Good morning, {family}!",
      "Rise and shine, {family}!",
      "Early morning energy, {family}!",
      "Morning, {family}! Have a great day!",
      "Good morning, {family}! Ready for the day?"
    ]
  },

  // Morning (8am - 12pm)
  morning: {
    monday: [
      "Good morning, {family}! Let's conquer Monday!",
      "Happy Monday, {family}!",
      "Morning, {family}! New week, new opportunities!",
      "Monday morning, {family}! You've got this!",
      "Good morning, {family}! Start strong!"
    ],
    friday: [
      "Happy Friday, {family}!",
      "Good morning, {family}! The weekend is near!",
      "Friday morning, {family}! Almost there!",
      "Morning, {family}! Friday energy activated!",
      "TGIF, {family}!"
    ],
    weekend: [
      "Good morning, {family}! Enjoy your weekend!",
      "Weekend mornings are the best, {family}!",
      "Happy Saturday/Sunday, {family}!",
      "Morning, {family}! Relax and recharge!",
      "Good morning, {family}! Weekend vibes!"
    ],
    default: [
      "Good morning, {family}!",
      "Morning, {family}! Have a wonderful day!",
      "Hello, {family}! Great day ahead!",
      "Good morning, {family}! Make it count!",
      "Morning, {family}! Ready for today?"
    ]
  },

  // Afternoon (12pm - 5pm)
  afternoon: {
    monday: [
      "Good afternoon, {family}! Monday's halfway done!",
      "Afternoon, {family}! Keep pushing!",
      "Happy Monday afternoon, {family}!",
      "Afternoon check-in, {family}! You're doing great!",
      "Monday afternoon, {family}! Almost there!"
    ],
    friday: [
      "Happy Friday afternoon, {family}!",
      "Afternoon, {family}! The weekend is so close!",
      "Friday afternoon vibes, {family}!",
      "Almost the weekend, {family}!",
      "Happy Friday, {family}! Time to wrap up!"
    ],
    weekend: [
      "Good afternoon, {family}! Enjoying the weekend?",
      "Afternoon, {family}! Weekend mode!",
      "Happy weekend afternoon, {family}!",
      "Afternoon, {family}! Hope you're relaxing!",
      "Good afternoon, {family}! Weekend fun time!"
    ],
    default: [
      "Good afternoon, {family}!",
      "Afternoon, {family}! Hope your day is going well!",
      "Happy afternoon, {family}!",
      "Good afternoon, {family}! Keep it up!",
      "Afternoon check-in, {family}!"
    ]
  },

  // Evening (5pm - 9pm)
  evening: {
    monday: [
      "Good evening, {family}! Monday's done!",
      "Evening, {family}! Time to unwind!",
      "Happy Monday evening, {family}!",
      "Evening, {family}! You made it through Monday!",
      "Good evening, {family}! Relax time!"
    ],
    friday: [
      "Happy Friday evening, {family}!",
      "Evening, {family}! The weekend is here!",
      "Friday night vibes, {family}!",
      "Good evening, {family}! Time to celebrate!",
      "Weekend mode activated, {family}!"
    ],
    weekend: [
      "Good evening, {family}! Enjoying the weekend?",
      "Evening, {family}! Weekend relaxation time!",
      "Happy weekend evening, {family}!",
      "Evening, {family}! Hope it's been a great day!",
      "Good evening, {family}! Unwind and enjoy!"
    ],
    default: [
      "Good evening, {family}!",
      "Evening, {family}! Time to relax!",
      "Happy evening, {family}!",
      "Good evening, {family}! Hope your day was great!",
      "Evening, {family}! Kick back and relax!"
    ]
  },

  // Night (9pm - 5am)
  night: {
    monday: [
      "Good night, {family}! Rest up for Tuesday!",
      "Late night, {family}? Monday's over!",
      "Evening, {family}! Time to wind down!",
      "Good night, {family}! Sleep well!",
      "Late Monday night, {family}!"
    ],
    friday: [
      "Happy Friday night, {family}!",
      "Late night fun, {family}?",
      "Friday night, {family}! Enjoy!",
      "Good evening, {family}! Weekend's here!",
      "Friday night vibes, {family}!"
    ],
    weekend: [
      "Good night, {family}! Enjoy your weekend evening!",
      "Late weekend night, {family}!",
      "Evening, {family}! Hope you're having fun!",
      "Good night, {family}! Rest well!",
      "Late night weekend vibes, {family}!"
    ],
    default: [
      "Good evening, {family}!",
      "Late night, {family}?",
      "Evening, {family}! Time to rest!",
      "Good night, {family}!",
      "Late night check-in, {family}!"
    ]
  }
};

// Phrases without family name for variety
const NO_FAMILY_GREETINGS = {
  earlyMorning: [
    "Rise and shine!",
    "Early bird gets the worm!",
    "Good morning sunshine!",
    "Wakey wakey!",
    "Morning has broken!"
  ],
  morning: [
    "Good morning!",
    "Have a great day!",
    "Make today amazing!",
    "Seize the day!",
    "Hello sunshine!"
  ],
  afternoon: [
    "Good afternoon!",
    "Happy afternoon!",
    "Keep going strong!",
    "You're doing great!",
    "Afternoon vibes!"
  ],
  evening: [
    "Good evening!",
    "Time to unwind!",
    "Relax and recharge!",
    "Evening relaxation!",
    "Wind down time!"
  ],
  night: [
    "Good night!",
    "Sweet dreams!",
    "Time for rest!",
    "Sleep tight!",
    "Late night vibes!"
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
 * Get static family greeting (original format)
 * @param {string} familyName - The family name to use
 * @returns {string} Formatted static greeting
 */
export function getStaticGreeting(familyName) {
  return `The ${familyName} Family`;
}
