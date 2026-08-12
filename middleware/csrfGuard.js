/**
 * middleware/csrfGuard.js
 *
 * JSON-only API double-submit CSRF guard (CWE-352).
 * Requires both X-Requested-With: XMLHttpRequest and Content-Type: application/json
 * on all state-mutating requests. Browsers enforce CORS preflight for both,
 * so a cross-origin attacker cannot forge either header.
 */
export function csrfGuard(req, res, next) {
  const xrw = req.headers['x-requested-with'];
  const ct  = (req.headers['content-type'] || '').split(';')[0].trim();
  if (xrw !== 'XMLHttpRequest' || ct !== 'application/json') {
    return res.status(403).json({ error: 'CSRF check failed' });
  }
  next();
}
