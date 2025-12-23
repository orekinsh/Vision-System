/**
 * Instagram Feed Filter - Popup Script
 * Manages UI for allowlist configuration
 */

// DOM Elements
const toggleEnabled = document.getElementById('toggle-enabled');
const usernameInput = document.getElementById('username-input');
const addBtn = document.getElementById('add-btn');
const usernameList = document.getElementById('username-list');
const emptyState = document.getElementById('empty-state');
const countEl = document.getElementById('count');
const statusMsg = document.getElementById('status-msg');
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');
const clearBtn = document.getElementById('clear-btn');

// Current state
let currentState = { enabled: true, allowlist: [] };

/**
 * Send message to background script
 */
async function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

/**
 * Show status message
 */
function showStatus(message, isError = false) {
  statusMsg.textContent = message;
  statusMsg.className = `status-msg ${isError ? 'error' : 'success'}`;
  setTimeout(() => {
    statusMsg.className = 'status-msg';
  }, 2000);
}

/**
 * Render the username list
 */
function renderList() {
  const usernames = currentState.allowlist;

  // Update count
  countEl.textContent = usernames.length;

  // Show/hide empty state
  emptyState.style.display = usernames.length === 0 ? 'block' : 'none';
  usernameList.style.display = usernames.length === 0 ? 'none' : 'block';

  // Clear and rebuild list
  usernameList.innerHTML = '';

  usernames.sort().forEach((username) => {
    const li = document.createElement('li');
    li.className = 'username-item';
    li.innerHTML = `
      <span><span class="at-symbol">@</span>${escapeHtml(username)}</span>
      <button class="remove-btn" data-username="${escapeHtml(username)}" title="Remove">&times;</button>
    `;
    usernameList.appendChild(li);
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Load initial state
 */
async function loadState() {
  const response = await sendMessage({ type: 'GET_STATE' });
  if (response) {
    currentState = response;
    toggleEnabled.checked = currentState.enabled;
    renderList();
  }
}

/**
 * Handle toggle change
 */
toggleEnabled.addEventListener('change', async () => {
  const response = await sendMessage({
    type: 'SET_ENABLED',
    enabled: toggleEnabled.checked
  });

  if (response?.success) {
    currentState = response.state;
    showStatus(currentState.enabled ? 'Filter enabled' : 'Filter disabled');
  } else {
    showStatus('Failed to update setting', true);
    toggleEnabled.checked = currentState.enabled; // Revert
  }
});

/**
 * Handle add username
 */
async function addUsername() {
  const username = usernameInput.value.trim().replace(/^@/, '');

  if (!username) {
    showStatus('Please enter a username', true);
    return;
  }

  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    showStatus('Invalid username format', true);
    return;
  }

  addBtn.disabled = true;

  const response = await sendMessage({
    type: 'ADD_USERNAME',
    username
  });

  addBtn.disabled = false;

  if (response?.success) {
    currentState = response.state;
    usernameInput.value = '';
    renderList();
    showStatus(`Added @${username}`);
  } else {
    showStatus(response?.error || 'Failed to add username', true);
  }
}

addBtn.addEventListener('click', addUsername);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addUsername();
});

/**
 * Handle remove username
 */
usernameList.addEventListener('click', async (e) => {
  if (e.target.classList.contains('remove-btn')) {
    const username = e.target.dataset.username;

    const response = await sendMessage({
      type: 'REMOVE_USERNAME',
      username
    });

    if (response?.success) {
      currentState = response.state;
      renderList();
      showStatus(`Removed @${username}`);
    } else {
      showStatus('Failed to remove username', true);
    }
  }
});

/**
 * Handle import
 */
importBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      let usernames;

      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        usernames = Array.isArray(data) ? data : data.allowlist || data.usernames || [];
      } else {
        usernames = text.split(/[\n,]/).map(u => u.trim().replace(/^@/, '')).filter(Boolean);
      }

      if (usernames.length === 0) {
        showStatus('No usernames found in file', true);
        return;
      }

      const response = await sendMessage({
        type: 'IMPORT_ALLOWLIST',
        usernames
      });

      if (response?.success) {
        currentState = response.state;
        renderList();
        showStatus(`Imported ${response.added} usernames`);
      } else {
        showStatus('Failed to import', true);
      }
    } catch (error) {
      showStatus('Failed to read file', true);
    }
  };

  input.click();
});

/**
 * Handle export
 */
exportBtn.addEventListener('click', () => {
  if (currentState.allowlist.length === 0) {
    showStatus('Nothing to export', true);
    return;
  }

  const data = JSON.stringify({
    allowlist: currentState.allowlist,
    exportedAt: new Date().toISOString()
  }, null, 2);

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'ig-filter-allowlist.json';
  a.click();

  URL.revokeObjectURL(url);
  showStatus('Exported allowlist');
});

/**
 * Handle clear all
 */
clearBtn.addEventListener('click', async () => {
  if (currentState.allowlist.length === 0) {
    showStatus('List is already empty', true);
    return;
  }

  if (!confirm('Remove all usernames from the allowlist?')) {
    return;
  }

  const response = await sendMessage({ type: 'CLEAR_ALLOWLIST' });

  if (response?.success) {
    currentState = response.state;
    renderList();
    showStatus('Cleared all usernames');
  } else {
    showStatus('Failed to clear list', true);
  }
});

/**
 * Listen for storage changes
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes['ig-feed-filter']) {
    currentState = changes['ig-feed-filter'].newValue;
    toggleEnabled.checked = currentState.enabled;
    renderList();
  }
});

// Initialize
loadState();
