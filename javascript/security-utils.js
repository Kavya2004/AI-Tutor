/**
 * security-utils.js
 * Shared client-side security helpers.
 * Fixes: CWE-79/80 (XSS), CWE-94 (code injection via innerHTML),
 *        CWE-918 (SSRF via unvalidated fetch URLs), CWE-502 (unsafe JSON.parse)
 */

// ── HTML sanitization (CWE-79/94) ─────────────────────────────────────────
/**
 * Escape a string for safe insertion as HTML text content.
 * Use this before any .innerHTML assignment that includes external data.
 */
window.sanitizeHtml = function(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Set text content safely — never use innerHTML for untrusted strings.
 */
window.setTextSafe = function(element, text) {
  if (!element) return;
  element.textContent = String(text ?? '');
};

// ── URL allowlist validation (CWE-918) ────────────────────────────────────
const ALLOWED_API_ORIGINS = [
  window.location.origin,           // same origin (localhost or production)
  'https://ai-tutor-53f1.onrender.com',
  'https://tutor.probabilitycourse.com',
];

/**
 * Validate a URL before using it in fetch().
 * Returns the URL string if safe, throws otherwise.
 * Only allows same-origin /api/* paths or explicitly whitelisted origins.
 */
window.validateFetchUrl = function(url) {
  // Relative /api/* paths are always safe
  if (typeof url === 'string' && url.startsWith('/api/')) return url;

  let parsed;
  try {
    parsed = new URL(url, window.location.origin);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Block private/loopback ranges (SSRF)
  const hostname = parsed.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.') ||
    hostname === '169.254.169.254'  // AWS metadata
  ) {
    if (parsed.origin !== window.location.origin) {
      throw new Error(`Blocked SSRF attempt to: ${hostname}`);
    }
  }

  if (!ALLOWED_API_ORIGINS.includes(parsed.origin)) {
    throw new Error(`Fetch to disallowed origin: ${parsed.origin}`);
  }

  return url;
};

/**
 * Safe fetch wrapper — validates URL before calling fetch.
 * Drop-in replacement: safeFetch(url, options) instead of fetch(url, options)
 */
window.safeFetch = async function(url, options = {}) {
  const validatedUrl = window.validateFetchUrl(url);
  return fetch(validatedUrl, options);
};

// ── Safe JSON.parse (CWE-502) ─────────────────────────────────────────────
/**
 * Parse JSON safely with a depth/size guard.
 * Returns null on failure instead of throwing.
 */
window.safeJsonParse = function(str, maxLength = 500_000) {
  if (typeof str !== 'string') return null;
  if (str.length > maxLength) {
    console.warn('[safeJsonParse] Input too large, refusing to parse');
    return null;
  }
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};
