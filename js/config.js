// config.js

// Traccar proxy URL
const PROXY_URL = "https://traccar-proxy-fcj3.onrender.com";

// Devices
const DEVICES = [
  { name: "Dad", id: 1 },
  { name: "Mom", id: 2 },
  { name: "Charlie", id: 3 },
  { name: "Jack", id: 4 },
  { name: "Mary", id: 5 }
];

// Zones
const ZONES = [
  //{ name: "Home", lat: 27.93241, lon: -82.81062, radius: 0.002 },
  //{ name: "Osceola HS", lat: 27.9150, lon: -82.7800, radius: 0.002 },
  //{ name: "Soccer Field", lat: 27.9200, lon: -82.7700, radius: 0.002 },
  { name: "Home",        lat: 27.93241,      lon: -82.81062,     radius: 0.003 }, // ~110 m
  { name: "Osceola HS",  lat: 27.8616,       lon: -82.7711,      radius: 0.004 }, // ~440 m
  { name: "CFMS",        lat: 27.977,        lon: -82.765948,    radius: 0.004 },
  { name: "Auntie's",    lat: 27.9568,       lon: -82.80285,     radius: 0.003 },
  { name: "IRCS",        lat: 27.8832,       lon: -82.81443,     radius: 0.004 },
  { name: "TBU",         lat: 28.08333,      lon: -82.6080,      radius: 0.004 },
  { name: "SJ",          lat: 27.8775866,    lon: -82.814629,    radius: 0.004 },
  { name: "Belleair Rec",lat: 27.9351627598, lon: -82.80202,     radius: 0.003 },
  { name: "Sam's",       lat: 27.95929,      lon: -82.7317,      radius: 0.003 },
  { name: "Publix",      lat: 27.9166,       lon: -82.8135976,   radius: 0.003 },
  { name: "Molly's",     lat: 28.0023296,    lon: -82.76779518,  radius: 0.003 },
  { name: "Julia's",     lat: 28.071224355,  lon: -82.682356,    radius: 0.003 },
  { name: "Belcher",     lat: 27.89895,      lon: -82.74484,     radius: 0.004 },
  { name: "Carlouel",    lat: 28.006,        lon: -82.826,       radius: 0.004 },
  { name: "The Break",   lat: 27.922,     lon: -82.8145,     radius: 0.003} 
  
];


// Scroll Configuration
const SCROLL_CONFIG = {
  initial: -510,      // Initial scroll position for weekly/work modes
  step: 150,          // Pixels to scroll per up/down action
  max: -184,          // Maximum scroll up (closest to top)
  min: -750           // Maximum scroll down (furthest from top)
};

// General Calendar Settings
const CALENDAR_SETTINGS = {
  autoRefreshInterval: 900000,    // Auto-refresh every 15 minutes (in milliseconds)
  headerHeight: 184,              // Header container height in pixels
  transitionDuration: 300,        // CSS transition duration in milliseconds
  iframeHeightPercent: 250        // Iframe height as percentage for weekly/work modes
};

// Calendar embed
const BASE_URL = "https://calendar.google.com/calendar/embed?ctz=America/New_York&showTitle=0&showNav=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0&wkst=2";

const CALENDAR_SETS = {
  weekly: [
    { id: "desilerch@gmail.com", color: "%234285F4" },  // Blue
    { id: "e48b36883ae237a9551de738523b7a246d5a1f6b15a3dbb6c78ee455a3aa4688@group.calendar.google.com", color: "%23001F54" }, // Navy
    { id: "180b3d0e7c1ae0241b2e60ba9c566500949ff16a487adf11625cd72306b2310f@group.calendar.google.com", color: "%230B8043" }, // Green
    { id: "47489b378d24a631f96c2e6b4cbd6eda2876b98fa4d06fd1c83a8ac7badd5118@group.calendar.google.com", color: "%23d50000" }, // Red
    { id: "en.usa#holiday@group.v.calendar.google.com", color: "%23FDD835" }  // Yellow
  ],
  monthly: [
    { id: "desilerch@gmail.com", color: "%234285F4" },  // Blue
    { id: "0d9003b61604007a26868b678b71e5ad894354cbfdab1f071193207ed7e4b7e8@group.calendar.google.com", color: "%23001F54" }, // Navy
    { id: "a2ffcf08f82cc50f9d7d0d055f80652074979d74a9a0664e11d6a029a8c8b1ed@group.calendar.google.com", color: "%230B8043" }, // Green
    { id: "47489b378d24a631f96c2e6b4cbd6eda2876b98fa4d06fd1c83a8ac7badd5118@group.calendar.google.com", color: "%23d50000" }, // Red
    { id: "en.usa#holiday@group.v.calendar.google.com", color: "%23FDD835" } // Yellow
  ],
  work: [
    { id: "desilerch@gmail.com", color: "%234285F4" },
    { id: "e48b36883ae237a9551de738523b7a246d5a1f6b15a3dbb6c78ee455a3aa4688@group.calendar.google.com", color: "%23001F54" },
    { id: "180b3d0e7c1ae0241b2e60ba9c566500949ff16a487adf11625cd72306b2310f@group.calendar.google.com", color: "%230B8043" },
    { id: "en.usa#holiday@group.v.calendar.google.com", color: "%23FDD835" }, // Yellow
    { id: "fd5949d42a667f6ca3e88dcf1feb27818463bbdc19c5e56d2e0da62b87d881c5@group.calendar.google.com", color: "%23FF6F00" }
  ]
};

// Agenda calendars for left panel
const AGENDA_CALENDARS = [
  { id: "desilerch@gmail.com", color: "%23E67C73" },
  { id: "e48b36883ae237a9551de738523b7a246d5a1f6b15a3dbb6c78ee455a3aa4688@group.calendar.google.com", color: "%231565C0" },
  { id: "180b3d0e7c1ae0241b2e60ba9c566500949ff16a487adf11625cd72306b2310f@group.calendar.google.com", color: "%230B8043" },
  { id: "47489b378d24a631f96c2e6b4cbd6eda2876b98fa4d06fd1c83a8ac7badd5118@group.calendar.google.com", color: "%23d50000" },
  { id: "fd5949d42a667f6ca3e88dcf1feb27818463bbdc19c5e56d2e0da62b87d881c5@group.calendar.google.com", color: "%23F18B3C" },
  { id: "en.usa#holiday@group.v.calendar.google.com", color: "%23FDD835" }
];

// Calendar modes
const MODES = ["weekly","monthly","work"];
