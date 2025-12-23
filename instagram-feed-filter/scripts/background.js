/**
 * Instagram Feed Filter - Background Service Worker
 * Handles storage and message relay between popup and content scripts
 */

const STORAGE_KEY = 'ig-feed-filter';

// Default state
const DEFAULT_STATE = {
  enabled: true,
  allowlist: []
};

/**
 * Get current state from storage
 */
async function getState() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return { ...DEFAULT_STATE, ...result[STORAGE_KEY] };
  } catch (error) {
    console.error('[IG Feed Filter BG] Error getting state:', error);
    return DEFAULT_STATE;
  }
}

/**
 * Save state to storage
 */
async function saveState(state) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    console.log('[IG Feed Filter BG] State saved:', state);
    return true;
  } catch (error) {
    console.error('[IG Feed Filter BG] Error saving state:', error);
    return false;
  }
}

/**
 * Broadcast state to all Instagram tabs
 */
async function broadcastToTabs(state) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://www.instagram.com/*' });

    for (const tab of tabs) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: (usernames, enabled) => {
            window.dispatchEvent(new CustomEvent('ig-filter-update', {
              detail: { usernames, enabled }
            }));
          },
          args: [state.allowlist, state.enabled]
        });
      } catch (tabError) {
        console.warn('[IG Feed Filter BG] Could not update tab:', tab.id, tabError);
      }
    }
  } catch (error) {
    console.error('[IG Feed Filter BG] Error broadcasting to tabs:', error);
  }
}

/**
 * Handle messages from popup or content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[IG Feed Filter BG] Received message:', message);

  switch (message.type) {
    case 'GET_STATE':
      getState().then(sendResponse);
      return true; // Async response

    case 'SET_ENABLED':
      getState().then(state => {
        state.enabled = message.enabled;
        return saveState(state).then(() => {
          broadcastToTabs(state);
          sendResponse({ success: true, state });
        });
      });
      return true;

    case 'ADD_USERNAME':
      getState().then(state => {
        const username = message.username.toLowerCase().trim();
        if (username && !state.allowlist.includes(username)) {
          state.allowlist.push(username);
          return saveState(state).then(() => {
            broadcastToTabs(state);
            sendResponse({ success: true, state });
          });
        }
        sendResponse({ success: false, error: 'Invalid or duplicate username' });
      });
      return true;

    case 'REMOVE_USERNAME':
      getState().then(state => {
        const username = message.username.toLowerCase().trim();
        const index = state.allowlist.indexOf(username);
        if (index > -1) {
          state.allowlist.splice(index, 1);
          return saveState(state).then(() => {
            broadcastToTabs(state);
            sendResponse({ success: true, state });
          });
        }
        sendResponse({ success: false, error: 'Username not found' });
      });
      return true;

    case 'CLEAR_ALLOWLIST':
      getState().then(state => {
        state.allowlist = [];
        return saveState(state).then(() => {
          broadcastToTabs(state);
          sendResponse({ success: true, state });
        });
      });
      return true;

    case 'IMPORT_ALLOWLIST':
      getState().then(state => {
        const usernames = message.usernames
          .map(u => u.toLowerCase().trim())
          .filter(u => u && !state.allowlist.includes(u));
        state.allowlist.push(...usernames);
        return saveState(state).then(() => {
          broadcastToTabs(state);
          sendResponse({ success: true, state, added: usernames.length });
        });
      });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

/**
 * Listen for storage changes and broadcast to tabs
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEY]) {
    const newState = changes[STORAGE_KEY].newValue;
    console.log('[IG Feed Filter BG] Storage changed:', newState);
    broadcastToTabs(newState);
  }
});

/**
 * Initialize on install
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[IG Feed Filter BG] Extension installed:', details.reason);

  // Set default state if fresh install
  if (details.reason === 'install') {
    await saveState(DEFAULT_STATE);
  }
});

console.log('[IG Feed Filter BG] Service worker initialized');
