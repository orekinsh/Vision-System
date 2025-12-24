/**
 * Instagram Feed Filter - Web Proxy Server (Enhanced)
 * Full proxy support for Instagram's multiple domains
 */

const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Railway/Heroku
app.set('trust proxy', 1);

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'ig-filter-secret-key-change-in-prod',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Initialize session
app.use((req, res, next) => {
  if (!req.session.allowlist) req.session.allowlist = [];
  if (req.session.enabled === undefined) req.session.enabled = true;
  if (!req.session.igCookies) req.session.igCookies = '';
  next();
});

// =============================================================================
// API Routes
// =============================================================================

app.get('/api/state', (req, res) => {
  res.json({ enabled: req.session.enabled, allowlist: req.session.allowlist });
});

app.post('/api/enabled', (req, res) => {
  req.session.enabled = !!req.body.enabled;
  res.json({ success: true, enabled: req.session.enabled });
});

app.post('/api/allowlist/add', (req, res) => {
  const username = (req.body.username || '').toLowerCase().trim().replace(/^@/, '');
  if (!username || !/^[a-zA-Z0-9._]+$/.test(username)) {
    return res.status(400).json({ error: 'Invalid username' });
  }
  if (!req.session.allowlist.includes(username)) {
    req.session.allowlist.push(username);
  }
  res.json({ success: true, allowlist: req.session.allowlist });
});

app.post('/api/allowlist/remove', (req, res) => {
  const username = (req.body.username || '').toLowerCase().trim();
  req.session.allowlist = req.session.allowlist.filter(u => u !== username);
  res.json({ success: true, allowlist: req.session.allowlist });
});

app.post('/api/allowlist/clear', (req, res) => {
  req.session.allowlist = [];
  res.json({ success: true, allowlist: [] });
});

app.post('/api/allowlist/import', (req, res) => {
  const usernames = (req.body.usernames || [])
    .map(u => u.toLowerCase().trim().replace(/^@/, ''))
    .filter(u => u && /^[a-zA-Z0-9._]+$/.test(u));
  const added = usernames.filter(u => !req.session.allowlist.includes(u));
  req.session.allowlist.push(...added);
  res.json({ success: true, allowlist: req.session.allowlist, added: added.length });
});

// =============================================================================
// Instagram Domain Mappings
// =============================================================================

const DOMAIN_MAP = {
  '/ig/': 'https://www.instagram.com',
  '/ig-i/': 'https://i.instagram.com',
  '/ig-graph/': 'https://graph.instagram.com',
  '/ig-static/': 'https://static.cdninstagram.com',
};

// Common headers for Instagram requests
function getIGHeaders(req, targetHost) {
  return {
    'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    'Accept': req.headers['accept'] || '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Host': targetHost,
    'Origin': 'https://www.instagram.com',
    'Referer': 'https://www.instagram.com/',
    'X-IG-App-ID': '936619743392459',
    'X-Requested-With': 'XMLHttpRequest',
    'Cookie': req.session.igCookies || '',
  };
}

// Store cookies from Instagram response
function storeCookies(req, response) {
  const setCookies = response.headers.raw()['set-cookie'];
  if (setCookies) {
    const cookies = setCookies.map(c => c.split(';')[0]).join('; ');
    if (cookies) {
      req.session.igCookies = req.session.igCookies
        ? req.session.igCookies + '; ' + cookies
        : cookies;
    }
  }
}

// =============================================================================
// Main Instagram Proxy
// =============================================================================

// Static bundles route MUST come before general /ig/* route
app.all('/ig/static/*', async (req, res) => {
  try {
    const staticPath = req.url.replace('/ig/static', '/static');
    // Try static CDN first, fall back to www
    const cdnUrl = `https://static.cdninstagram.com${staticPath}`;
    const wwwUrl = `https://www.instagram.com${staticPath}`;

    console.log(`[Static] Trying CDN: ${cdnUrl}`);

    let response = await fetch(cdnUrl, {
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        'Referer': 'https://www.instagram.com/',
        'Accept': '*/*',
      }
    });

    // If CDN fails, try www
    if (!response.ok) {
      console.log(`[Static] CDN failed (${response.status}), trying www`);
      response = await fetch(wwwUrl, {
        headers: {
          'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
          'Referer': 'https://www.instagram.com/',
          'Accept': '*/*',
        }
      });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // If we got HTML back for a JS/CSS file, Instagram is blocking
    if (contentType.includes('text/html')) {
      if (staticPath.endsWith('.js')) {
        console.log(`[Static] Blocked: ${staticPath}`);
        res.set('Content-Type', 'application/javascript');
        res.send('console.log("Resource unavailable");');
        return;
      }
      if (staticPath.endsWith('.css')) {
        res.set('Content-Type', 'text/css');
        res.send('/* unavailable */');
        return;
      }
    }

    const buffer = await response.buffer();
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000');
    res.send(buffer);
  } catch (error) {
    console.error('[Static Error]', error.message);
    res.status(502).send('// Error loading resource');
  }
});

app.all('/ig/*', handleProxy('https://www.instagram.com', '/ig'));
app.all('/ig-i/*', handleProxy('https://i.instagram.com', '/ig-i'));
app.all('/ig-graph/*', handleProxy('https://graph.instagram.com', '/ig-graph'));

function handleProxy(baseUrl, prefix) {
  return async (req, res) => {
    try {
      const targetPath = req.url.replace(prefix, '') || '/';
      const targetUrl = baseUrl + targetPath;
      const targetHost = new URL(baseUrl).host;

      // Check if this is a static bundle request - these need special handling
      const isStaticBundle = targetPath.includes('/static/bundles/') ||
                             targetPath.includes('/rsrc.php/') ||
                             targetPath.endsWith('.js') ||
                             targetPath.endsWith('.css');

      console.log(`[Proxy] ${req.method} ${targetUrl} ${isStaticBundle ? '(static)' : ''}`);

      const headers = getIGHeaders(req, targetHost);

      // Forward content-type for POST requests
      if (req.headers['content-type']) {
        headers['Content-Type'] = req.headers['content-type'];
      }

      const fetchOptions = {
        method: req.method,
        headers,
        redirect: 'manual',
      };

      // Handle request body
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        if (req.headers['content-type']?.includes('application/json')) {
          fetchOptions.body = JSON.stringify(req.body);
        } else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
          fetchOptions.body = new URLSearchParams(req.body).toString();
        }
      }

      const response = await fetch(targetUrl, fetchOptions);

      // Store any cookies Instagram sends back
      storeCookies(req, response);

      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        let location = response.headers.get('location');
        if (location) {
          location = rewriteUrl(location);
          res.redirect(response.status, location);
          return;
        }
      }

      const contentType = response.headers.get('content-type') || '';

      // For static bundle requests that return HTML, Instagram is blocking us
      // Return empty JS to prevent breaking the page
      if (isStaticBundle && contentType.includes('text/html')) {
        console.log(`[Proxy] Static file returned HTML (blocked): ${targetUrl}`);
        if (targetPath.endsWith('.js')) {
          res.set('Content-Type', 'application/javascript');
          res.send('// Resource blocked by Instagram');
          return;
        }
        if (targetPath.endsWith('.css')) {
          res.set('Content-Type', 'text/css');
          res.send('/* Resource blocked */');
          return;
        }
      }

      // Handle HTML responses
      if (contentType.includes('text/html')) {
        let html = await response.text();
        html = rewriteHtml(html, req.session.allowlist, req.session.enabled);
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
        return;
      }

      // Handle JSON responses (apply filtering)
      if (contentType.includes('application/json')) {
        try {
          const data = await response.json();
          const filtered = req.session.enabled ? filterFeedData(data, req.session.allowlist) : data;
          res.json(filtered);
          return;
        } catch (e) {
          // If JSON parsing fails, pass through
        }
      }

      // Handle JavaScript - rewrite URLs in scripts
      if (contentType.includes('javascript')) {
        let js = await response.text();
        js = rewriteUrls(js);
        res.set('Content-Type', contentType);
        res.send(js);
        return;
      }

      // Pass through other content types
      const buffer = await response.buffer();
      res.set('Content-Type', contentType);

      // Copy cache headers
      const cacheControl = response.headers.get('cache-control');
      if (cacheControl) res.set('Cache-Control', cacheControl);

      res.send(buffer);

    } catch (error) {
      console.error('[Proxy Error]', error.message);
      res.status(502).json({ error: 'Proxy error', message: error.message });
    }
  };
}

// =============================================================================
// Static CDN Proxy (images, videos, etc.)
// =============================================================================

app.get('/ig-static/*', async (req, res) => {
  try {
    const assetPath = req.url.replace('/ig-static', '');
    const assetUrl = `https://static.cdninstagram.com${assetPath}`;

    const response = await fetch(assetUrl, {
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'Referer': 'https://www.instagram.com/',
      }
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.buffer();

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000');
    res.send(buffer);
  } catch (error) {
    res.status(404).send('Asset not found');
  }
});

// Proxy for scontent CDN (images/videos)
app.get('/ig-cdn/*', async (req, res) => {
  try {
    // The path contains the full CDN URL encoded
    const cdnPath = req.url.replace('/ig-cdn/', '');
    const cdnUrl = decodeURIComponent(cdnPath);

    const response = await fetch(cdnUrl, {
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'Referer': 'https://www.instagram.com/',
      }
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.buffer();

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (error) {
    res.status(404).send('CDN asset not found');
  }
});

// =============================================================================
// URL Rewriting
// =============================================================================

function rewriteUrl(url) {
  if (!url) return url;

  return url
    .replace(/https?:\/\/www\.instagram\.com/g, '/ig')
    .replace(/https?:\/\/i\.instagram\.com/g, '/ig-i')
    .replace(/https?:\/\/graph\.instagram\.com/g, '/ig-graph')
    .replace(/https?:\/\/static\.cdninstagram\.com/g, '/ig-static')
    // Handle scontent CDN URLs by encoding them
    .replace(/https?:\/\/scontent[^"'\s]*/g, (match) => '/ig-cdn/' + encodeURIComponent(match));
}

function rewriteUrls(content) {
  return content
    .replace(/https?:\/\/www\.instagram\.com/g, '/ig')
    .replace(/https?:\/\/i\.instagram\.com/g, '/ig-i')
    .replace(/https?:\/\/graph\.instagram\.com/g, '/ig-graph')
    .replace(/https?:\/\/static\.cdninstagram\.com/g, '/ig-static')
    .replace(/"https?:\/\/scontent[^"]*"/g, (match) => {
      const url = match.slice(1, -1);
      return '"/ig-cdn/' + encodeURIComponent(url) + '"';
    });
}

function rewriteHtml(html, allowlist, enabled) {
  // Rewrite all Instagram URLs
  html = rewriteUrls(html);

  // Fix relative URLs
  html = html.replace(/href="\//g, 'href="/ig/');
  html = html.replace(/src="\//g, 'src="/ig/');
  html = html.replace(/action="\//g, 'action="/ig/');

  // Inject our filter script
  const script = getFilterScript(allowlist, enabled);
  html = html.replace('</head>', script + '</head>');

  return html;
}

function getFilterScript(allowlist, enabled) {
  return `
<script>
(function() {
  'use strict';

  const ALLOWLIST = new Set(${JSON.stringify(allowlist)});
  const FILTER_ENABLED = ${enabled};

  console.log('[IG Filter] Loaded with', ALLOWLIST.size, 'allowed accounts');

  // Rewrite URLs in dynamically loaded content
  const rewriteUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    return url
      .replace(/https?:\\/\\/www\\.instagram\\.com/g, '/ig')
      .replace(/https?:\\/\\/i\\.instagram\\.com/g, '/ig-i')
      .replace(/https?:\\/\\/graph\\.instagram\\.com/g, '/ig-graph')
      .replace(/https?:\\/\\/static\\.cdninstagram\\.com/g, '/ig-static');
  };

  // Override fetch
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    let url = input instanceof Request ? input.url : input;

    // Rewrite Instagram URLs to go through proxy
    if (typeof url === 'string') {
      const newUrl = rewriteUrl(url);
      if (newUrl !== url) {
        console.log('[IG Filter] Rewriting fetch:', url, '->', newUrl);
        url = newUrl;
        if (input instanceof Request) {
          input = new Request(url, input);
        } else {
          input = url;
        }
      }
    }

    const response = await originalFetch.call(this, input, init);

    // Filter GraphQL responses
    if (FILTER_ENABLED && url && url.includes('/graphql')) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        const filtered = filterData(data);
        return new Response(JSON.stringify(filtered), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch (e) {}
    }

    return response;
  };

  // Override XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    const newUrl = rewriteUrl(url);
    if (newUrl !== url) {
      console.log('[IG Filter] Rewriting XHR:', url, '->', newUrl);
    }
    return originalXHROpen.call(this, method, newUrl, ...args);
  };

  function filterData(data) {
    if (!data || typeof data !== 'object') return data;
    const result = Array.isArray(data) ? [...data] : {...data};

    for (const key in result) {
      if (key === 'edges' && Array.isArray(result[key])) {
        result[key] = result[key].filter(edge => {
          // Filter ads
          const node = edge?.node || edge;
          if (node?.__typename?.includes('Ad') || node?.is_ad) {
            console.log('[IG Filter] Removed ad');
            return false;
          }
          // Filter by allowlist
          if (ALLOWLIST.size === 0) return true;
          const username = node?.user?.username || node?.owner?.username;
          if (username && !ALLOWLIST.has(username.toLowerCase())) {
            console.log('[IG Filter] Filtered:', username);
            return false;
          }
          return true;
        });
      } else if (typeof result[key] === 'object') {
        result[key] = filterData(result[key]);
      }
    }
    return result;
  }

  console.log('[IG Filter] Interceptors installed');
})();
</script>`;
}

// =============================================================================
// Feed Filtering
// =============================================================================

function filterFeedData(data, allowlist) {
  const allowSet = new Set((allowlist || []).map(u => u.toLowerCase()));

  function shouldKeep(node) {
    if (!node) return true;

    // Filter ads
    if (node.__typename?.includes('Ad') || node.is_ad || node.is_sponsored) {
      return false;
    }

    // If no allowlist, keep everything (except ads)
    if (allowSet.size === 0) return true;

    // Check username
    const username = node.user?.username || node.owner?.username;
    if (username && !allowSet.has(username.toLowerCase())) {
      return false;
    }

    return true;
  }

  function filterRecursive(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const result = Array.isArray(obj) ? [...obj] : {...obj};

    for (const key in result) {
      if (key === 'edges' && Array.isArray(result[key])) {
        result[key] = result[key].filter(edge => shouldKeep(edge?.node || edge));
      } else if (typeof result[key] === 'object') {
        result[key] = filterRecursive(result[key]);
      }
    }

    return result;
  }

  return filterRecursive(data);
}

// =============================================================================
// Redirect root /browse to /ig
// =============================================================================

app.get('/browse', (req, res) => res.redirect('/ig/'));
app.get('/browse/*', (req, res) => res.redirect(req.url.replace('/browse', '/ig')));

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
  console.log(`Instagram Feed Filter running on port ${PORT}`);
  console.log('Routes:');
  console.log('  / - Main app (allowlist management)');
  console.log('  /ig/ - Instagram proxy');
});
