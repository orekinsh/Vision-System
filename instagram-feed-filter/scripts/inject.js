/**
 * Instagram Feed Filter - Fetch Interceptor
 * Runs in MAIN world before Instagram's bundle loads
 */

(function() {
  'use strict';

  console.log('[IG Feed Filter] Initializing fetch interceptor...');

  // In-memory cache for allowlist and settings
  let allowlist = new Set();
  let filterEnabled = true;

  // Load initial state from storage via custom event
  const STORAGE_KEY = 'ig-feed-filter';

  // Listen for allowlist updates from the extension
  window.addEventListener('ig-filter-update', (event) => {
    const { usernames, enabled } = event.detail;
    if (usernames) {
      allowlist = new Set(usernames.map(u => u.toLowerCase()));
      console.log('[IG Feed Filter] Allowlist updated:', [...allowlist]);
    }
    if (typeof enabled === 'boolean') {
      filterEnabled = enabled;
      console.log('[IG Feed Filter] Filter enabled:', filterEnabled);
    }
  });

  // Request initial state
  window.dispatchEvent(new CustomEvent('ig-filter-request-state'));

  // Store original fetch
  const originalFetch = window.fetch;

  // GraphQL URL patterns to intercept
  const GRAPHQL_PATTERNS = [
    '/graphql/query',
    '/api/graphql'
  ];

  // Feed-related query identifiers
  const FEED_QUERY_INDICATORS = [
    'FeedTimelineConnection',
    'edge_web_feed_timeline',
    'xdt_api__v1__feed__timeline',
    'PolarisHomeQuery',
    'FeedQuery'
  ];

  /**
   * Check if URL is a GraphQL feed query
   */
  function isFeedQuery(url, body) {
    const urlStr = url.toString();
    const isGraphQL = GRAPHQL_PATTERNS.some(pattern => urlStr.includes(pattern));

    if (!isGraphQL) return false;

    // Check URL params for feed indicators
    if (FEED_QUERY_INDICATORS.some(indicator => urlStr.includes(indicator))) {
      return true;
    }

    // Check request body if available
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      if (FEED_QUERY_INDICATORS.some(indicator => bodyStr.includes(indicator))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract username from various node structures
   */
  function getUsername(node) {
    if (!node) return null;

    // Direct user object
    if (node.user?.username) return node.user.username;

    // Owner object (for posts)
    if (node.owner?.username) return node.owner.username;

    // Media owner
    if (node.media?.owner?.username) return node.media.owner.username;
    if (node.media?.user?.username) return node.media.user.username;

    // Nested in various Instagram structures
    if (node.node?.user?.username) return node.node.user.username;
    if (node.node?.owner?.username) return node.node.owner.username;

    return null;
  }

  /**
   * Check if node is an ad or suggested content
   */
  function isAdOrSuggested(node) {
    if (!node) return false;

    const typename = node.__typename || node.node?.__typename;

    // Known ad/suggested type names
    const adTypes = [
      'GraphAd',
      'Ad',
      'SponsoredContent',
      'XDTAdMedia',
      'SuggestedUser',
      'SuggestedPost'
    ];

    if (adTypes.includes(typename)) return true;

    // Check for ad markers in the node
    if (node.is_ad || node.is_sponsored) return true;
    if (node.node?.is_ad || node.node?.is_sponsored) return true;

    // Check for "Suggested for you" type content
    if (node.explore_source_token) return true;
    if (node.injected_viewer_data) return true;

    return false;
  }

  /**
   * Filter edges array based on allowlist
   */
  function filterEdges(edges) {
    if (!Array.isArray(edges)) return edges;

    return edges.filter(edge => {
      // Always filter out ads/suggested content
      if (isAdOrSuggested(edge) || isAdOrSuggested(edge?.node)) {
        console.log('[IG Feed Filter] Filtered ad/suggested content');
        return false;
      }

      // If allowlist is empty, show all non-ad content
      if (allowlist.size === 0) return true;

      const username = getUsername(edge) || getUsername(edge?.node);

      if (!username) {
        // Can't determine username, keep the content
        return true;
      }

      const isAllowed = allowlist.has(username.toLowerCase());
      if (!isAllowed) {
        console.log('[IG Feed Filter] Filtered post from:', username);
      }
      return isAllowed;
    });
  }

  /**
   * Recursively find and filter feed edges in response data
   */
  function filterFeedData(data) {
    if (!data || typeof data !== 'object') return data;

    // Create a shallow copy to avoid mutating original
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

  /**
   * Override fetch to intercept GraphQL responses
   */
  window.fetch = async function(input, init) {
    const url = input instanceof Request ? input.url : input;
    const body = init?.body;

    // Check if this is a feed query we want to intercept
    const shouldIntercept = filterEnabled && isFeedQuery(url, body);

    if (!shouldIntercept) {
      return originalFetch.apply(this, arguments);
    }

    console.log('[IG Feed Filter] Intercepting feed query:', url);

    try {
      // Make the original request
      const response = await originalFetch.apply(this, arguments);

      // Clone response before reading (streams are single-use)
      const clone = response.clone();

      try {
        const json = await clone.json();

        // Filter the feed data
        const filteredData = filterFeedData(json);

        console.log('[IG Feed Filter] Filtered response:', {
          original: json,
          filtered: filteredData
        });

        // Return new Response with filtered data
        return new Response(JSON.stringify(filteredData), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch (parseError) {
        // If we can't parse JSON, return original response
        console.warn('[IG Feed Filter] Could not parse response:', parseError);
        return response;
      }
    } catch (fetchError) {
      // If fetch fails, let it propagate naturally
      console.error('[IG Feed Filter] Fetch error:', fetchError);
      throw fetchError;
    }
  };

  console.log('[IG Feed Filter] Fetch interceptor installed successfully');
})();
