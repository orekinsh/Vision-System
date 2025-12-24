/**
 * Instagram Feed Filter - Simplified Proxy
 * Goal: Get basic Instagram loading first, then add filtering
 */

const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Session for storing cookies
app.use(session({
  secret: process.env.SESSION_SECRET || 'ig-filter-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Initialize session
app.use((req, res, next) => {
  if (!req.session.igCookies) req.session.igCookies = '';
  next();
});

// =============================================================================
// Simple Proxy - Just forward everything to Instagram
// =============================================================================

const IG_DOMAINS = {
  '/ig/': 'https://www.instagram.com',
  '/ig-i/': 'https://i.instagram.com',
  '/ig-api/': 'https://i.instagram.com/api',
};

// Proxy all Instagram requests
app.use('/ig', async (req, res) => {
  const igPath = req.url || '/';
  const igUrl = `https://www.instagram.com${igPath}`;

  console.log(`[Proxy] ${req.method} ${igUrl}`);

  try {
    const headers = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity', // Don't request compression
      'Cookie': req.session.igCookies || '',
      'Referer': 'https://www.instagram.com/',
    };

    // Forward POST body
    let body;
    if (req.method === 'POST') {
      headers['Content-Type'] = req.headers['content-type'] || 'application/x-www-form-urlencoded';
      if (req.headers['content-type']?.includes('json')) {
        body = JSON.stringify(req.body);
      } else {
        body = new URLSearchParams(req.body).toString();
      }
    }

    const response = await fetch(igUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });

    // Store cookies from response
    const setCookies = response.headers.raw()['set-cookie'];
    if (setCookies) {
      const newCookies = setCookies.map(c => c.split(';')[0]).join('; ');
      req.session.igCookies = req.session.igCookies
        ? req.session.igCookies + '; ' + newCookies
        : newCookies;
      console.log('[Proxy] Stored cookies');
    }

    // Handle redirects - rewrite Instagram URLs to our proxy
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      let location = response.headers.get('location') || '';
      console.log(`[Proxy] Redirect to: ${location}`);

      // Rewrite absolute Instagram URLs to our proxy
      location = location
        .replace('https://www.instagram.com', '/ig')
        .replace('https://instagram.com', '/ig');

      res.redirect(response.status, location);
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    console.log(`[Proxy] Response: ${response.status} ${contentType}`);

    // For HTML, rewrite URLs
    if (contentType.includes('text/html')) {
      let html = await response.text();

      // Rewrite URLs to go through our proxy
      html = html
        .replace(/https:\/\/www\.instagram\.com/g, '/ig')
        .replace(/https:\/\/instagram\.com/g, '/ig')
        .replace(/"\/static\//g, '"/ig/static/')
        .replace(/"\/accounts\//g, '"/ig/accounts/')
        .replace(/"\/api\//g, '"/ig/api/')
        .replace(/"\/graphql/g, '"/ig/graphql');

      // Don't rewrite CDN URLs - let them load directly from Instagram
      // This is key - we let static files load from Instagram's CDN

      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      return;
    }

    // For everything else, pass through as-is
    const buffer = await response.buffer();

    // Set content type
    res.set('Content-Type', contentType);

    // Copy cache headers
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl) res.set('Cache-Control', cacheControl);

    res.status(response.status).send(buffer);

  } catch (error) {
    console.error('[Proxy Error]', error.message);
    res.status(502).send(`Proxy error: ${error.message}`);
  }
});

// API state endpoint (for our frontend)
app.get('/api/state', (req, res) => {
  res.json({ enabled: true, allowlist: [] });
});

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
  console.log(`Instagram Proxy running on port ${PORT}`);
  console.log('Open /ig/ to browse Instagram');
});
