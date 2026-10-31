const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function generateToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

function generateRandomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

module.exports = {
  generateToken,
  verifyToken,
  generateRandomToken,
  hashToken,
};
