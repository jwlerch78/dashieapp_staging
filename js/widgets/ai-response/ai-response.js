/**
 * AI Response Widget - Chat-style conversation display
 *
 * Displays user messages and AI responses in a chat interface.
 * Supports user, AI, and system messages with auto-scrolling.
 */

// Widget state
let messages = []; // Array of message objects
let messagesContainer;
let clearButton;

/**
 * Initialize widget
 */
function initialize() {
  // Get DOM elements
  messagesContainer = document.getElementById('messagesContainer');
  clearButton = document.getElementById('clearButton');

  // Setup event listeners
  setupEventListeners();

  // Show empty state
  showEmptyState();

  // Send ready message to parent
  sendToParent('widget-ready', { widgetId: 'ai-response' });

  console.log('[AIResponseWidget] Initialized');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Clear button
  clearButton.addEventListener('click', handleClearClick);

  // Listen for messages from parent window
  window.addEventListener('message', handleParentMessage);
}

/**
 * Handle messages from parent window
 */
function handleParentMessage(event) {
  const data = event.data;

  // Handle data messages
  if (data.type === 'data' && data.payload) {
    // Extract action and payload from the nested structure
    const { action, payload } = data.payload;
    if (action) {
      handleDataMessage(action, payload);
    }
  }

  // Handle command messages
  if (data.type === 'command') {
    handleCommand(data.action, data.payload);
  }
}

/**
 * Handle data messages from parent
 */
function handleDataMessage(action, payload) {
  console.log('[AIResponseWidget] Data message:', action, payload);

  switch (action) {
    case 'add-message':
      addMessage(payload);
      break;

    case 'clear-chat':
      clearChat();
      break;

    default:
      console.log('[AIResponseWidget] Unknown data action:', action);
      break;
  }
}

/**
 * Handle commands from parent window
 */
function handleCommand(action, payload) {
  console.log('[AIResponseWidget] Command:', action, payload);

  switch (action) {
    case 'scroll-to-bottom':
      scrollToBottom();
      break;

    case 'enter-focus':
    case 'exit-focus':
    case 'enter-active':
    case 'exit-active':
      // Handle focus/active state changes if needed
      break;

    default:
      console.log('[AIResponseWidget] Unknown command:', action);
      break;
  }
}

/**
 * Add a message to the chat
 * @param {object} messageData - Message object
 */
function addMessage(messageData) {
  const {
    sender,        // 'user' | 'ai' | 'system'
    content,       // Message text
    timestamp,     // Unix timestamp
    messageId,     // Unique ID
    metadata,      // Optional metadata
    isLoading      // Optional loading state
  } = messageData;

  // Validate required fields
  if (!sender || !content || !messageId) {
    console.warn('[AIResponseWidget] Invalid message data', messageData);
    return;
  }

  // Remove empty state if present
  const emptyState = messagesContainer.querySelector('.ai-response__empty');
  if (emptyState) {
    emptyState.remove();
  }

  // Create message object
  const message = {
    sender,
    content,
    timestamp: timestamp || Date.now(),
    messageId,
    metadata: metadata || {},
    isLoading: isLoading || false
  };

  // Add to messages array
  messages.push(message);

  // Render message
  const messageEl = createMessageElement(message);
  messagesContainer.appendChild(messageEl);

  // Auto-scroll to bottom
  scrollToBottom();

  console.log('[AIResponseWidget] Message added', {
    messageId,
    sender,
    totalMessages: messages.length
  });
}

/**
 * Create message DOM element
 * @param {object} message - Message object
 * @returns {HTMLElement}
 */
function createMessageElement(message) {
  const { sender, content, timestamp, messageId, isLoading } = message;

  // Create container
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message chat-message--${sender}`;
  messageDiv.dataset.messageId = messageId;

  if (isLoading) {
    messageDiv.classList.add('chat-message--loading');
  }

  // Create avatar
  const avatar = document.createElement('div');
  avatar.className = 'chat-message__avatar';
  avatar.textContent = getAvatarEmoji(sender);

  // Create bubble
  const bubble = document.createElement('div');
  bubble.className = 'chat-message__bubble';

  // Create content
  const contentP = document.createElement('p');
  contentP.className = 'chat-message__content';

  if (isLoading) {
    // Show loading dots
    contentP.innerHTML = `
      <span>Thinking</span>
      <span class="chat-message__loading-dots">
        <span class="chat-message__loading-dot"></span>
        <span class="chat-message__loading-dot"></span>
        <span class="chat-message__loading-dot"></span>
      </span>
    `;
  } else {
    contentP.textContent = content;
  }

  bubble.appendChild(contentP);

  // Add timestamp (optional - only for user/ai messages)
  if (sender !== 'system' && timestamp) {
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'chat-message__timestamp';
    timestampDiv.textContent = formatTimestamp(timestamp);
    bubble.appendChild(timestampDiv);
  }

  // Assemble message
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(bubble);

  return messageDiv;
}

/**
 * Get avatar emoji for sender type
 * @param {string} sender - Sender type
 * @returns {string}
 */
function getAvatarEmoji(sender) {
  switch (sender) {
    case 'user':
      return '👤';
    case 'ai':
      return '🤖';
    case 'system':
      return 'ℹ️';
    default:
      return '•';
  }
}

/**
 * Format timestamp to readable time
 * @param {number} timestamp - Unix timestamp
 * @returns {string}
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const minuteStr = minutes.toString().padStart(2, '0');

  return `${hour12}:${minuteStr} ${ampm}`;
}

/**
 * Show empty state when no messages
 */
function showEmptyState() {
  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'ai-response__empty';
  emptyDiv.innerHTML = `
    <div class="ai-response__empty-icon">💬</div>
    <p class="ai-response__empty-text">No messages yet.<br>Start by typing or speaking a command.</p>
  `;

  messagesContainer.appendChild(emptyDiv);
}

/**
 * Clear all chat messages
 */
function clearChat() {
  console.log('[AIResponseWidget] Clearing chat');

  // Clear messages array
  messages = [];

  // Clear DOM
  messagesContainer.innerHTML = '';

  // Show empty state
  showEmptyState();

  // Send event to parent
  sendToParent('action-requested', {
    action: 'chat-cleared',
    timestamp: Date.now()
  });
}

/**
 * Handle clear button click
 */
function handleClearClick() {
  // Confirm before clearing (optional)
  if (messages.length > 0) {
    clearChat();
  }
}

/**
 * Scroll messages container to bottom
 */
function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
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
 * Update an existing message (useful for loading states)
 * @param {string} messageId - Message ID to update
 * @param {object} updates - Fields to update
 */
function updateMessage(messageId, updates) {
  // Find message in array
  const messageIndex = messages.findIndex(m => m.messageId === messageId);

  if (messageIndex === -1) {
    console.warn('[AIResponseWidget] Message not found for update', messageId);
    return;
  }

  // Update message object
  Object.assign(messages[messageIndex], updates);

  // Find and update DOM element
  const messageEl = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);

  if (messageEl) {
    // Replace with updated element
    const newMessageEl = createMessageElement(messages[messageIndex]);
    messageEl.replaceWith(newMessageEl);
  }

  console.log('[AIResponseWidget] Message updated', messageId);
}

/**
 * Export functions for testing/debugging
 */
window.aiResponseWidget = {
  addMessage,
  clearChat,
  updateMessage,
  scrollToBottom,
  getMessages: () => messages
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
