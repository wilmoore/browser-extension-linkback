/**
 * URL normalization utilities
 *
 * Design principles:
 * - Strip tracking parameters where safe
 * - Preserve essential parameters for apps that rely on them
 * - Consistent normalization for deduplication
 */

/**
 * Common tracking parameters to strip
 * These are generally safe to remove without breaking functionality
 */
const TRACKING_PARAMS = new Set([
  // Google Analytics
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  // Facebook
  'fbclid',
  'fb_action_ids',
  'fb_action_types',
  'fb_source',
  // Twitter
  'twclid',
  // Microsoft
  'msclkid',
  // Google Ads
  'gclid',
  'gclsrc',
  // Generic
  'ref',
  'ref_src',
  'ref_url',
  '_ga',
  '_gl',
  'mc_cid',
  'mc_eid',
  // Mailchimp
  'mc_cid',
  'mc_eid',
  // HubSpot
  '__hstc',
  '__hssc',
  '__hsfp',
  'hsCtaTracking',
  // Others
  'zanpid',
  'dclid',
  'yclid',
  'igshid',
  's_kwcid',
  'si',
  'trk',
  'trkInfo',
]);

/**
 * Domains where we should preserve all query parameters
 * These apps rely on query params for core functionality
 */
const PRESERVE_PARAMS_DOMAINS = new Set([
  'docs.google.com',
  'drive.google.com',
  'sheets.google.com',
  'slides.google.com',
  'notion.so',
  'www.notion.so',
  'airtable.com',
  'figma.com',
  'www.figma.com',
  'miro.com',
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'linear.app',
  'asana.com',
  'app.asana.com',
  'trello.com',
  'jira.atlassian.com',
  'confluence.atlassian.com',
  'slack.com',
  'app.slack.com',
  'zoom.us',
  'meet.google.com',
  'calendar.google.com',
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'chat.openai.com',
  'claude.ai',
]);

/**
 * Normalize a URL for consistent storage and comparison
 *
 * @param url - The URL to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Lowercase protocol and hostname
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove default ports
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }

    // Remove trailing slash from path (except for root)
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Remove fragment/hash
    parsed.hash = '';

    // Handle query parameters
    if (!shouldPreserveAllParams(parsed.hostname)) {
      const cleanParams = new URLSearchParams();
      const sortedKeys: string[] = [];

      parsed.searchParams.forEach((value, key) => {
        if (!isTrackingParam(key)) {
          sortedKeys.push(key);
        }
      });

      // Sort params for consistent ordering
      sortedKeys.sort();

      for (const key of sortedKeys) {
        const value = parsed.searchParams.get(key);
        if (value !== null) {
          cleanParams.set(key, value);
        }
      }

      // Replace search params
      parsed.search = cleanParams.toString();
    }

    return parsed.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Check if a domain should preserve all query parameters
 */
function shouldPreserveAllParams(hostname: string): boolean {
  // Check exact match
  if (PRESERVE_PARAMS_DOMAINS.has(hostname)) {
    return true;
  }

  // Check if it's a subdomain of a preserved domain
  for (const domain of PRESERVE_PARAMS_DOMAINS) {
    if (hostname.endsWith(`.${domain}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a query parameter is a tracking parameter
 */
function isTrackingParam(param: string): boolean {
  return TRACKING_PARAMS.has(param.toLowerCase());
}

/**
 * Extract a readable title from a URL
 * Used as fallback when page title is unavailable
 *
 * @param url - The URL to extract title from
 * @returns Human-readable title
 */
export function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Get hostname without www
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    // Get path segments
    const pathSegments = parsed.pathname
      .split('/')
      .filter((s) => s.length > 0)
      .map(decodeURIComponent);

    if (pathSegments.length === 0) {
      return hostname;
    }

    // Use last meaningful path segment
    const lastSegment = pathSegments[pathSegments.length - 1];

    // Clean up the segment
    const cleaned = lastSegment
      // Remove file extensions
      .replace(/\.(html?|php|aspx?|jsp)$/i, '')
      // Replace hyphens and underscores with spaces
      .replace(/[-_]/g, ' ')
      // Capitalize first letter of each word
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return `${cleaned} - ${hostname}`;
  } catch {
    return url;
  }
}

/**
 * Check if two URLs point to the same normalized resource
 */
export function urlsAreEqual(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/**
 * Validate that a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Get the domain from a URL for display purposes
 */
export function getDomain(url: string): string {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return url;
  }
}
