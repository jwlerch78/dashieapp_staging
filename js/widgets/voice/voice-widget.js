/**
 * Voice Widget - Visual feedback for voice interaction
 *
 * Displays microphone button, live transcript, and confirmation messages.
 * Communicates with parent window's VoiceService via postMessage.
 */

// Widget state
let state = 'idle'; // idle, listening, typing, transcribing, processing, confirmation, error
let isAndroid = false;

// DOM elements
let widgetEl;
let micButton;
let textInput;
let sendButton;
let promptText;
let transcriptText;
let statusText;
let progressBar;
let progressCircle;

// Audio context for beep sound
let audioContext = null;
let beepSound = null;

// Progress tracking
let progressInterval = null;
let progressStartTime = null;
const RECORDING_DURATION = 5000; // 5 seconds

/**
 * Initialize widget
 */
function initialize() {
  // Get DOM elements
  widgetEl = document.getElementById('voiceWidget');
  micButton = document.getElementById('micButton');
  textInput = document.getElementById('textInput');
  sendButton = document.getElementById('sendButton');
  promptText = document.getElementById('promptText');
  transcriptText = document.getElementById('transcriptText');
  statusText = document.getElementById('statusText');
  progressBar = document.getElementById('progressBar');
  progressCircle = document.getElementById('progressCircle');

  // Detect platform
  detectPlatform();

  // Setup event listeners
  setupEventListeners();

  // Send ready message to parent
  sendToParent('widget-ready', { widgetId: 'voice' });

  console.log('[VoiceWidget] Initialized');
}

/**
 * Detect if running on Android
 */
function detectPlatform() {
  // Check if DashieNative exists in parent window
  try {
    isAndroid = typeof window.parent.DashieNative !== 'undefined';
  } catch (e) {
    isAndroid = false;
  }

  // Update prompt text based on platform
  if (isAndroid) {
    // Android/Fire TV: Can use button OR wake word (when fixed)
    promptText.textContent = 'Click or say "Hey Dashie"';
    widgetEl.classList.add('voice-widget--android');
  } else {
    // PC: Button only
    promptText.textContent = 'Click to speak';
  }

  console.log('[VoiceWidget] Platform:', isAndroid ? 'Android' : 'Web');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Mic button click - now works on BOTH platforms!
  // PC: Uses Web Speech API via mic button
  // Android/Fire TV: Can bypass broken wake word by using button
  micButton.addEventListener('click', handleMicClick);

  // Text input events
  textInput.addEventListener('input', handleTextInput);
  textInput.addEventListener('focus', handleTextFocus);
  textInput.addEventListener('blur', handleTextBlur);
  textInput.addEventListener('keypress', handleTextKeypress);

  // Send button click
  sendButton.addEventListener('click', handleSendClick);

  // Initialize audio context on first click (Web only - for beep sound)
  if (!isAndroid) {
    micButton.addEventListener('click', () => {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('[VoiceWidget] AudioContext initialized on user click');
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('[VoiceWidget] AudioContext resumed');
        });
      }
    }, { once: false });
  }

  // Listen for messages from parent window
  window.addEventListener('message', handleParentMessage);
}

/**
 * Handle microphone button click (works on both PC and Android/Fire TV)
 */
function handleMicClick() {
  console.log('[VoiceWidget] Mic button clicked', { platform: isAndroid ? 'Android' : 'Web' });

  if (state === 'listening') {
    // Stop listening
    sendToParent('voice-action', { action: 'stop-listening' });
  } else {
    // Start listening - just send request to parent
    // UI update and beep will happen when parent confirms listening started
    sendToParent('voice-action', { action: 'start-listening' });
  }
}

/**
 * Handle messages from parent window
 */
function handleParentMessage(event) {
  const data = event.data;

  // Handle voice events
  if (data.type === 'data' && data.action === 'voice-event') {
    handleVoiceEvent(data.payload);
  }

  // Handle commands from parent
  if (data.type === 'command') {
    handleCommand(data.action, data.payload);
  }
}

/**
 * Handle voice events from VoiceService (via parent)
 */
function handleVoiceEvent(event) {
  console.log('[VoiceWidget] Voice event:', event.eventType, event.data);

  switch (event.eventType) {
    case 'VOICE_LISTENING_STARTED':
      playBeep(); // Play beep when listening starts
      setState('listening');
      transcriptText.textContent = 'Listening...';
      startProgressAnimation();
      break;

    case 'VOICE_LISTENING_STOPPED':
      stopProgressAnimation();
      if (state === 'listening') {
        setState('processing');
        transcriptText.textContent = 'Processing...';
      }
      break;

    case 'VOICE_PARTIAL_RESULT':
      // Ignore partial results, use circular progress instead
      break;

    case 'VOICE_TRANSCRIPT_RECEIVED':
      setState('processing');
      transcriptText.textContent = event.data;
      // Will transition to confirmation or back to idle based on command result
      break;

    case 'VOICE_COMMAND_EXECUTED':
      showConfirmation(event.data.result);
      break;

    case 'VOICE_ERROR':
      showError(event.data.message);
      break;

    case 'VOICE_COMMAND_SENT_TO_AI':
      // Command was sent to AI (unrecognized) - return to idle after brief delay
      setTimeout(() => {
        if (state === 'processing') {
          setState('idle');
          transcriptText.textContent = '';
        }
      }, 1500);
      break;

    case 'VOICE_WAKE_WORD_DETECTED':
      // Android only - visual feedback when wake word detected
      setState('listening');
      transcriptText.textContent = 'Listening...';
      break;
  }
}

/**
 * Handle commands from parent window
 */
function handleCommand(action, payload) {
  console.log('[VoiceWidget] Command:', action, payload);

  // Handle any widget-specific commands here
  // (Currently none defined)
}

/**
 * Set widget state
 */
function setState(newState) {
  // Remove old state class
  widgetEl.classList.remove(
    'voice-widget--idle',
    'voice-widget--listening',
    'voice-widget--typing',
    'voice-widget--transcribing',
    'voice-widget--processing',
    'voice-widget--confirmation',
    'voice-widget--error'
  );

  // Add new state class
  widgetEl.classList.add(`voice-widget--${newState}`);

  state = newState;
  console.log('[VoiceWidget] State changed to:', newState);
}

/**
 * Show confirmation message
 */
function showConfirmation(message) {
  setState('confirmation');
  statusText.textContent = message;
  transcriptText.textContent = ''; // Clear transcript

  // Return to idle after 3 seconds
  setTimeout(() => {
    if (state === 'confirmation') {
      setState('idle');
      statusText.textContent = '';
    }
  }, 3000);
}

/**
 * Show error message
 */
function showError(message) {
  setState('error');
  statusText.textContent = message;
  transcriptText.textContent = ''; // Clear transcript

  // Return to idle after 3 seconds
  setTimeout(() => {
    if (state === 'error') {
      setState('idle');
      statusText.textContent = '';
    }
  }, 3000);
}

/**
 * Send message to parent window
 */
function sendToParent(type, data) {
  window.parent.postMessage({
    type,
    ...data
  }, '*');
}

/**
 * Handle text input change
 */
function handleTextInput() {
  // Update state to typing if there's content
  if (textInput.value.trim() && state === 'idle') {
    setState('typing');
  } else if (!textInput.value.trim() && state === 'typing') {
    setState('idle');
  }
}

/**
 * Handle text input focus
 */
function handleTextFocus() {
  if (state === 'idle') {
    setState('typing');
  }
}

/**
 * Handle text input blur
 */
function handleTextBlur() {
  if (state === 'typing' && !textInput.value.trim()) {
    setState('idle');
  }
}

/**
 * Handle keypress in text input (Enter key to send)
 */
function handleTextKeypress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSendClick();
  }
}

/**
 * Handle send button click
 */
function handleSendClick() {
  const message = textInput.value.trim();

  if (!message) {
    console.log('[VoiceWidget] Cannot send empty message');
    return;
  }

  console.log('[VoiceWidget] Sending text message:', message);

  // Generate message ID
  const messageId = generateMessageId();

  // Send user-message to parent
  sendToParent('user-message', {
    widgetId: 'voice',
    payload: {
      messageId,
      source: 'text',
      content: message,
      timestamp: Date.now(),
      metadata: {
        platform: isAndroid ? 'android' : 'web'
      }
    }
  });

  // Update UI
  setState('processing');
  transcriptText.textContent = message;
  textInput.value = ''; // Clear input

  // Return to idle after a short delay (so user sees the message was sent)
  setTimeout(() => {
    if (state === 'processing') {
      setState('idle');
      transcriptText.textContent = '';
    }
  }, 1000);

  console.log('[VoiceWidget] Text message sent', { messageId, message });
}

/**
 * Generate unique message ID
 */
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start circular progress animation (5-second countdown)
 */
function startProgressAnimation() {
  // Reset progress
  progressStartTime = Date.now();
  const circumference = 2 * Math.PI * 45; // 2πr where r=45
  progressBar.style.strokeDashoffset = circumference; // Start empty

  // Clear any existing interval
  if (progressInterval) {
    clearInterval(progressInterval);
  }

  // Update progress every 50ms for smooth animation
  progressInterval = setInterval(() => {
    const elapsed = Date.now() - progressStartTime;
    const progress = Math.min(elapsed / RECORDING_DURATION, 1); // 0 to 1

    // Calculate stroke-dashoffset (starts at full circumference, goes to 0)
    const offset = circumference * (1 - progress);
    progressBar.style.strokeDashoffset = offset;

    // Stop when complete
    if (progress >= 1) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }, 50);

  console.log('[VoiceWidget] Progress animation started (5 seconds)');
}

/**
 * Stop circular progress animation
 */
function stopProgressAnimation() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }

  // Reset progress bar
  const circumference = 2 * Math.PI * 45;
  progressBar.style.strokeDashoffset = circumference;

  console.log('[VoiceWidget] Progress animation stopped');
}

/**
 * Play beep sound when listening starts
 */
function playBeep() {
  try {
    // Create audio context if it doesn't exist
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume audio context if suspended (required by some browsers)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Create two-tone beep (like Android)
    const currentTime = audioContext.currentTime;

    // First tone (higher pitch)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, currentTime); // 800 Hz
    gain1.gain.setValueAtTime(0, currentTime);
    gain1.gain.linearRampToValueAtTime(0.4, currentTime + 0.05);
    gain1.gain.linearRampToValueAtTime(0, currentTime + 0.15);
    osc1.start(currentTime);
    osc1.stop(currentTime + 0.15);

    // Second tone (lower pitch) - plays after first
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(600, currentTime + 0.15); // 600 Hz
    gain2.gain.setValueAtTime(0, currentTime + 0.15);
    gain2.gain.linearRampToValueAtTime(0.4, currentTime + 0.2);
    gain2.gain.linearRampToValueAtTime(0, currentTime + 0.3);
    osc2.start(currentTime + 0.15);
    osc2.stop(currentTime + 0.3);

    console.log('[VoiceWidget] Beep played (two-tone, 300ms)');
  } catch (error) {
    console.warn('[VoiceWidget] Failed to play beep:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
