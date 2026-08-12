/**
 * middleware/requireAuth.js
 *
 * Lightweight internal-API authentication guard (CWE-306).
 *
 * Checks for a shared secret in the Authorization header:
 *   Authorization: Bearer <INTERNAL_API_SECRET>
 *
 * Set INTERNAL_API_SECRET in your .env file.
 * All frontend fetch calls to protected routes must include this header.
 *
 * Replace this with a proper JWT / session-based auth system when you add
 * user accounts.
 */

const SECRET = process.env.INTERNAL_API_SECRET;

export function requireAuth(req, res, next) {
  if (!SECRET) {
    // If the secret is not configured, block all access to protected routes
    // rather than silently allowing everything through.
    console.error('[requireAuth] INTERNAL_API_SECRET is not set — blocking request');
    return res.status(503).json({ error: 'Server authentication is not configured' });
  }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || token !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
