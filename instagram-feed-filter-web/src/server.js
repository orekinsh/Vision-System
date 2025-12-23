/**
 * Instagram Feed Filter - Web Proxy Server
 * Proxies Instagram requests and injects filtering script
 */

const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const INSTAGRAM_BASE = 'https://www.instagram.com';

// Session middleware for storing allowlist per user
app.use(session({
  secret: process.env.SESSION_SECRET || 'ig-filter-dev-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize session defaults
app.use((req, res, next) => {
  if (!req.session.allowlist) {
    req.session.allowlist = [];
  }
  if (req.session.enabled === undefined) {
    req.session.enabled = true;
  }
  next();
});

// =============================================================================
// API Routes for allowlist management
// =============================================================================

app.get('/api/state', (req, res) => {
  res.json({
    enabled: req.session.enabled,
    allowlist: req.session.allowlist
  });
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
// GraphQL API Proxy with Filtering
// =============================================================================

app.all('/api/graphql*', async (req, res) => {
  try {
    const igUrl = `${INSTAGRAM_BASE}/graphql${req.url.replace('/api/graphql', '')}`;

    // Forward the request to Instagram
    const igResponse = await fetch(igUrl, {
      method: req.method,
      headers: {
        ...filterHeaders(req.headers),
        'Host': 'www.instagram.com',
        'Origin': 'https://www.instagram.com',
        'Referer': 'https://www.instagram.com/'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const contentType = igResponse.headers.get('content-type') || '';

    if (contentType.includes('application/json') && req.session.enabled) {
      // Parse and filter JSON response
      const data = await igResponse.json();
      const filtered = filterFeedData(data, req.session.allowlist);
      res.json(filtered);
    } else {
      // Pass through non-JSON or if filtering disabled
      const body = await igResponse.buffer();
      res.set('Content-Type', contentType);
      res.send(body);
    }
  } catch (error) {
    console.error('GraphQL proxy error:', error);
    res.status(500).json({ error: 'Proxy error' });
  }
});

// =============================================================================
// Instagram Page Proxy
// =============================================================================

app.get('/browse/*', async (req, res) => {
  try {
    const igPath = req.url.replace('/browse', '');
    const igUrl = `${INSTAGRAM_BASE}${igPath}`;

    const igResponse = await fetch(igUrl, {
      headers: {
        ...filterHeaders(req.headers),
        'Host': 'www.instagram.com',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const contentType = igResponse.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      let html = await igResponse.text();

      // Rewrite URLs to go through our proxy
      html = rewriteUrls(html);

      // Inject our filter script
      html = injectFilterScript(html, req.session.allowlist, req.session.enabled);

      res.set('Content-Type', 'text/html');
      res.send(html);
    } else {
      // Pass through other content types
      const body = await igResponse.buffer();
      res.set('Content-Type', contentType);
      res.send(body);
    }
  } catch (error) {
    console.error('Page proxy error:', error);
    res.status(500).send('Proxy error');
  }
});

// =============================================================================
// Static Asset Proxy
// =============================================================================

app.get('/ig-static/*', async (req, res) => {
  try {
    const assetPath = req.url.replace('/ig-static', '');
    const assetUrl = `https://static.cdninstagram.com${assetPath}`;

    const response = await fetch(assetUrl);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const body = await response.buffer();

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000');
    res.send(body);
  } catch (error) {
    res.status(404).send('Asset not found');
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

function filterHeaders(headers) {
  const filtered = {};
  const skipHeaders = ['host', 'connection', 'content-length', 'accept-encoding'];

  for (const [key, value] of Object.entries(headers)) {
    if (!skipHeaders.includes(key.toLowerCase())) {
      filtered[key] = value;
    }
  }

  return filtered;
}

function rewriteUrls(html) {
  // Rewrite Instagram URLs to go through our proxy
  html = html.replace(/https:\/\/www\.instagram\.com/g, '/browse');
  html = html.replace(/https:\/\/static\.cdninstagram\.com/g, '/ig-static');

  // Fix relative URLs
  html = html.replace(/href="\//g, 'href="/browse/');
  html = html.replace(/src="\//g, 'src="/browse/');

  return html;
}

function injectFilterScript(html, allowlist, enabled) {
  const script = `
<script>
(function() {
  'use strict';

  const ALLOWLIST = new Set(${JSON.stringify(allowlist)});
  const FILTER_ENABLED = ${enabled};

  console.log('[IG Filter] Initialized with', ALLOWLIST.size, 'allowed accounts');

  if (!FILTER_ENABLED) {
    console.log('[IG Filter] Filtering disabled');
    return;
  }

  const originalFetch = window.fetch;

  window.fetch = async function(input, init) {
    const url = (input instanceof Request ? input.url : input) || '';

    // Check if this is a GraphQL request
    if (url.includes('/graphql') || url.includes('/api/graphql')) {
      console.log('[IG Filter] Intercepting:', url);

      try {
        const response = await originalFetch.apply(this, arguments);
        const clone = response.clone();

        try {
          const json = await clone.json();
          const filtered = filterFeedData(json);

          return new Response(JSON.stringify(filtered), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        } catch (e) {
          return response;
        }
      } catch (e) {
        throw e;
      }
    }

    return originalFetch.apply(this, arguments);
  };

  function getUsername(node) {
    if (!node) return null;
    return node.user?.username || node.owner?.username ||
           node.media?.owner?.username || node.media?.user?.username ||
           node.node?.user?.username || node.node?.owner?.username || null;
  }

  function isAdOrSuggested(node) {
    if (!node) return false;
    const typename = node.__typename || node.node?.__typename;
    if (['GraphAd', 'Ad', 'SponsoredContent', 'XDTAdMedia'].includes(typename)) return true;
    if (node.is_ad || node.is_sponsored) return true;
    if (node.node?.is_ad || node.node?.is_sponsored) return true;
    return false;
  }

  function filterEdges(edges) {
    if (!Array.isArray(edges)) return edges;

    return edges.filter(edge => {
      if (isAdOrSuggested(edge) || isAdOrSuggested(edge?.node)) {
        console.log('[IG Filter] Removed ad/suggested');
        return false;
      }

      if (ALLOWLIST.size === 0) return true;

      const username = getUsername(edge) || getUsername(edge?.node);
      if (!username) return true;

      const allowed = ALLOWLIST.has(username.toLowerCase());
      if (!allowed) console.log('[IG Filter] Filtered:', username);
      return allowed;
    });
  }

  function filterFeedData(data) {
    if (!data || typeof data !== 'object') return data;

    const result = Array.isArray(data) ? [...data] : { ...data };

    for (const key in result) {
      if (key === 'edges' && Array.isArray(result[key])) {
        result[key] = filterEdges(result[key]);
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        result[key] = filterFeedData(result[key]);
      }
    }

    return result;
  }

  console.log('[IG Filter] Fetch interceptor installed');
})();
</script>
`;

  // Inject before closing head tag
  return html.replace('</head>', script + '</head>');
}

function filterFeedData(data, allowlist) {
  const allowSet = new Set(allowlist.map(u => u.toLowerCase()));

  function getUsername(node) {
    if (!node) return null;
    return node.user?.username || node.owner?.username ||
           node.media?.owner?.username || node.media?.user?.username ||
           node.node?.user?.username || node.node?.owner?.username || null;
  }

  function isAdOrSuggested(node) {
    if (!node) return false;
    const typename = node.__typename || node.node?.__typename;
    if (['GraphAd', 'Ad', 'SponsoredContent', 'XDTAdMedia'].includes(typename)) return true;
    if (node.is_ad || node.is_sponsored) return true;
    return false;
  }

  function filterEdges(edges) {
    if (!Array.isArray(edges)) return edges;

    return edges.filter(edge => {
      if (isAdOrSuggested(edge) || isAdOrSuggested(edge?.node)) return false;
      if (allowSet.size === 0) return true;

      const username = getUsername(edge) || getUsername(edge?.node);
      if (!username) return true;

      return allowSet.has(username.toLowerCase());
    });
  }

  function recursiveFilter(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const result = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in result) {
      if (key === 'edges' && Array.isArray(result[key])) {
        result[key] = filterEdges(result[key]);
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        result[key] = recursiveFilter(result[key]);
      }
    }

    return result;
  }

  return recursiveFilter(data);
}

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
  console.log(`Instagram Feed Filter running at http://localhost:${PORT}`);
  console.log('Open the app to configure your allowlist, then browse Instagram');
});
