// src/middleware/auth.js
// Auth middleware stub for Module 2 (Catalog & Pricing).
// Full implementation belongs to Member 1 (Auth & Infrastructure).
// This stub parses a Bearer JWT so catalog routes can reference req.user.
// Replace with Member 1's final implementation when integrated.

const jwt = require('jsonwebtoken');

/**
 * Middleware: Verify Bearer JWT and attach req.user.
 * req.user = { id, role, customerId }
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_replace_me');
    req.user = { id: payload.userId, role: payload.role, customerId: payload.customerId ?? null };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

/**
 * Middleware factory: Restrict access to specific roles.
 * @param {...string} roles  e.g. 'ADMIN', 'STAFF'
 */
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
    }
    next();
  };
}

/**
 * Middleware: Verify Bearer JWT and attach req.user if token is provided.
 * If no token is provided, req.user remains null without returning 401.
 */
function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_replace_me');
    req.user = { id: payload.userId, role: payload.role, customerId: payload.customerId ?? null };
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

module.exports = { authenticateToken, optionalAuthenticateToken, authorizeRoles };
