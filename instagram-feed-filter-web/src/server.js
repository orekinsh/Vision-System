/**
 * Instapump - Custom Instagram Reels Viewer
 * Login with credentials, view reels, filter content
 */

const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'instapump-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// =============================================================================
// Instagram API Configuration
// =============================================================================

const IG_API = 'https://i.instagram.com/api/v1';
const IG_WEB = 'https://www.instagram.com';

// Generate device ID (consistent per user)
function generateDeviceId(seed) {
  return 'android-' + crypto.createHash('md5').update(seed).digest('hex').substring(0, 16);
}

// Generate UUID
function generateUUID() {
  return crypto.randomUUID();
}

// Instagram API headers
function getHeaders(session = {}) {
  const headers = {
    'User-Agent': 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229237)',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'X-IG-App-ID': '567067343352427',
    'X-IG-Device-ID': session.deviceId || generateUUID(),
    'X-IG-Android-ID': session.androidId || generateDeviceId('default'),
    'X-IG-Connection-Type': 'WIFI',
    'X-IG-Capabilities': '3brTvx0=',
    'X-IG-App-Locale': 'en_US',
    'X-IG-Device-Locale': 'en_US',
    'X-IG-Mapped-Locale': 'en_US',
    'X-Pigeon-Session-Id': generateUUID(),
    'X-Pigeon-Rawclienttime': (Date.now() / 1000).toFixed(3),
    'X-IG-Bandwidth-Speed-KBPS': '-1.000',
    'X-IG-Bandwidth-TotalBytes-B': '0',
    'X-IG-Bandwidth-TotalTime-MS': '0',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  };

  if (session.csrfToken) {
    headers['X-CSRFToken'] = session.csrfToken;
  }

  if (session.cookies) {
    headers['Cookie'] = session.cookies;
  }

  if (session.authorization) {
    headers['Authorization'] = session.authorization;
  }

  return headers;
}

// Parse cookies from response
function parseCookies(response) {
  const setCookies = response.headers.raw()['set-cookie'] || [];
  return setCookies.map(c => c.split(';')[0]).join('; ');
}

// Extract CSRF token from cookies
function extractCSRF(cookies) {
  const match = cookies.match(/csrftoken=([^;]+)/);
  return match ? match[1] : null;
}

// =============================================================================
// Auth Check Middleware
// =============================================================================

function requireAuth(req, res, next) {
  if (!req.session.ig || !req.session.ig.loggedIn) {
    return res.status(401).json({ error: 'Not logged in', requiresLogin: true });
  }
  next();
}

// =============================================================================
// API Routes
// =============================================================================

// Check login status
app.get('/api/auth/status', (req, res) => {
  res.json({
    loggedIn: !!(req.session.ig && req.session.ig.loggedIn),
    username: req.session.ig?.username || null
  });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    // Initialize session data
    const deviceId = generateUUID();
    const androidId = generateDeviceId(username);

    // First, get CSRF token
    const preLoginRes = await fetch(`${IG_WEB}/api/v1/public/landing_info/`, {
      headers: getHeaders({ deviceId, androidId })
    });

    let cookies = parseCookies(preLoginRes);
    let csrfToken = extractCSRF(cookies);

    // Prepare login data
    const loginData = new URLSearchParams({
      username: username,
      enc_password: `#PWD_INSTAGRAM:0:${Math.floor(Date.now() / 1000)}:${password}`,
      device_id: androidId,
      login_attempt_count: '0',
    });

    // Attempt login
    const loginRes = await fetch(`${IG_API}/accounts/login/`, {
      method: 'POST',
      headers: getHeaders({ deviceId, androidId, csrfToken, cookies }),
      body: loginData.toString()
    });

    // Update cookies
    cookies = cookies + '; ' + parseCookies(loginRes);
    csrfToken = extractCSRF(cookies) || csrfToken;

    const loginText = await loginRes.text();
    console.log('[Login] Raw response:', loginText);
    console.log('[Login] Status:', loginRes.status);
    console.log('[Login] Headers:', JSON.stringify([...loginRes.headers.entries()]));

    let loginJson;
    try {
      loginJson = JSON.parse(loginText);
    } catch (e) {
      console.error('[Login] Failed to parse JSON:', e);
      return res.status(500).json({
        error: 'Instagram returned invalid response',
        details: loginText.substring(0, 200)
      });
    }

    console.log('[Login] Parsed:', JSON.stringify(loginJson, null, 2));

    if (loginJson.logged_in_user || loginJson.status === 'ok') {
      // Success!
      req.session.ig = {
        loggedIn: true,
        userId: loginJson.logged_in_user?.pk || loginJson.user_id,
        username: loginJson.logged_in_user?.username || username,
        deviceId,
        androidId,
        csrfToken,
        cookies,
        authorization: loginRes.headers.get('ig-set-authorization') || null
      };

      return res.json({
        success: true,
        username: req.session.ig.username
      });
    }

    // Handle 2FA
    if (loginJson.two_factor_required) {
      req.session.twoFactor = {
        identifier: loginJson.two_factor_info.two_factor_identifier,
        deviceId,
        androidId,
        csrfToken,
        cookies,
        username
      };

      return res.json({
        success: false,
        twoFactorRequired: true,
        twoFactorInfo: {
          obfuscatedPhone: loginJson.two_factor_info.obfuscated_phone_number
        }
      });
    }

    // Handle challenge
    if (loginJson.challenge) {
      return res.json({
        success: false,
        challengeRequired: true,
        message: 'Instagram requires verification. Please login via the Instagram app first.'
      });
    }

    // Login failed
    return res.status(401).json({
      success: false,
      error: loginJson.message || loginJson.error_message || 'Login failed',
      errorType: loginJson.error_type,
      details: loginJson
    });

  } catch (error) {
    console.error('[Login Error]', error);
    res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

// 2FA verification
app.post('/api/auth/verify-2fa', async (req, res) => {
  const { code } = req.body;
  const twoFactor = req.session.twoFactor;

  if (!twoFactor) {
    return res.status(400).json({ error: 'No 2FA session found' });
  }

  try {
    const verifyData = new URLSearchParams({
      verification_code: code,
      two_factor_identifier: twoFactor.identifier,
      username: twoFactor.username,
      device_id: twoFactor.androidId,
      trust_this_device: '1'
    });

    const verifyRes = await fetch(`${IG_API}/accounts/two_factor_login/`, {
      method: 'POST',
      headers: getHeaders(twoFactor),
      body: verifyData.toString()
    });

    const cookies = twoFactor.cookies + '; ' + parseCookies(verifyRes);
    const verifyJson = await verifyRes.json();

    if (verifyJson.logged_in_user || verifyJson.status === 'ok') {
      req.session.ig = {
        loggedIn: true,
        userId: verifyJson.logged_in_user?.pk,
        username: verifyJson.logged_in_user?.username || twoFactor.username,
        deviceId: twoFactor.deviceId,
        androidId: twoFactor.androidId,
        csrfToken: extractCSRF(cookies) || twoFactor.csrfToken,
        cookies,
        authorization: verifyRes.headers.get('ig-set-authorization') || null
      };
      delete req.session.twoFactor;

      return res.json({ success: true, username: req.session.ig.username });
    }

    return res.status(401).json({ error: verifyJson.message || '2FA verification failed' });
  } catch (error) {
    console.error('[2FA Error]', error);
    res.status(500).json({ error: '2FA verification failed' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// =============================================================================
// Reels Feed
// =============================================================================

app.get('/api/reels', requireAuth, async (req, res) => {
  try {
    const ig = req.session.ig;
    const maxId = req.query.max_id || '';

    // Fetch reels tray (clips)
    const url = maxId
      ? `${IG_API}/clips/user/?max_id=${maxId}`
      : `${IG_API}/feed/reels_tray/`;

    const reelsRes = await fetch(url, {
      headers: getHeaders(ig)
    });

    // Update cookies
    const newCookies = parseCookies(reelsRes);
    if (newCookies) {
      req.session.ig.cookies = ig.cookies + '; ' + newCookies;
    }

    const reelsJson = await reelsRes.json();

    if (reelsJson.status !== 'ok' && !reelsJson.tray) {
      console.error('[Reels Error]', reelsJson);
      return res.status(400).json({ error: 'Failed to fetch reels' });
    }

    res.json(reelsJson);
  } catch (error) {
    console.error('[Reels Error]', error);
    res.status(500).json({ error: 'Failed to fetch reels' });
  }
});

// Fetch reels feed (video clips)
app.get('/api/reels/feed', requireAuth, async (req, res) => {
  try {
    const ig = req.session.ig;
    const maxId = req.query.max_id || '';

    const url = `${IG_API}/clips/reels_tray/`;

    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(ig),
      body: new URLSearchParams({
        _uuid: ig.deviceId,
        _uid: ig.userId,
        device_id: ig.androidId
      }).toString()
    });

    const json = await response.json();
    res.json(json);
  } catch (error) {
    console.error('[Reels Feed Error]', error);
    res.status(500).json({ error: 'Failed to fetch reels feed' });
  }
});

// Get timeline feed
app.get('/api/feed', requireAuth, async (req, res) => {
  try {
    const ig = req.session.ig;

    const response = await fetch(`${IG_API}/feed/timeline/`, {
      method: 'POST',
      headers: getHeaders(ig),
      body: new URLSearchParams({
        _uuid: ig.deviceId,
        _uid: ig.userId,
        device_id: ig.androidId,
        is_async_ads_rti: '0',
        is_async_ads_double_request: '0',
        rti_delivery_backend: '0',
        is_async_ads_in_headload_enabled: '0'
      }).toString()
    });

    const json = await response.json();
    res.json(json);
  } catch (error) {
    console.error('[Feed Error]', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// Proxy media (images/videos) to avoid CORS
app.get('/api/media', requireAuth, async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('URL required');

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Instagram 275.0.0.27.98 Android',
        'Referer': 'https://www.instagram.com/'
      }
    });

    const contentType = response.headers.get('content-type');
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');

    const buffer = await response.buffer();
    res.send(buffer);
  } catch (error) {
    res.status(500).send('Failed to load media');
  }
});

// =============================================================================
// Filter Settings
// =============================================================================

app.get('/api/settings', (req, res) => {
  res.json({
    approvedAccounts: req.session.approvedAccounts || [],
    rejectedAccounts: req.session.rejectedAccounts || [],
    approvedRatio: req.session.approvedRatio || 80
  });
});

app.post('/api/settings/approve', (req, res) => {
  const { username } = req.body;
  if (!req.session.approvedAccounts) req.session.approvedAccounts = [];
  if (!req.session.approvedAccounts.includes(username)) {
    req.session.approvedAccounts.push(username);
  }
  // Remove from rejected if present
  if (req.session.rejectedAccounts) {
    req.session.rejectedAccounts = req.session.rejectedAccounts.filter(u => u !== username);
  }
  res.json({ success: true, approvedAccounts: req.session.approvedAccounts });
});

app.post('/api/settings/reject', (req, res) => {
  const { username } = req.body;
  if (!req.session.rejectedAccounts) req.session.rejectedAccounts = [];
  if (!req.session.rejectedAccounts.includes(username)) {
    req.session.rejectedAccounts.push(username);
  }
  // Remove from approved if present
  if (req.session.approvedAccounts) {
    req.session.approvedAccounts = req.session.approvedAccounts.filter(u => u !== username);
  }
  res.json({ success: true, rejectedAccounts: req.session.rejectedAccounts });
});

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
  console.log(`Instapump running on port ${PORT}`);
});
