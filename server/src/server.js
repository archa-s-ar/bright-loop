// server/src/server.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');

const catalogRoutes = require('./modules/catalog/catalog.routes');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_replace_me';

// Security & Parsing Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allows local CDN Chart.js & Vanilla JS scripts
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static client
const clientPath = path.join(__dirname, '../../client');
app.use(express.static(clientPath));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'Brightloop Subscription Management API',
    module: 'Module 2: Product Catalog, Subscription Plans & Pricing',
    status: 'ONLINE',
    timestamp: new Date().toISOString()
  });
});

/**
 * Dev Token Generation Helper Endpoint:
 * Allows frontend and automated tests to simulate ADMIN, STAFF, or CUSTOMER roles
 * before Member 1 finishes the auth registration/login infrastructure.
 */
app.post('/api/auth/dev-token', (req, res) => {
  const { role = 'ADMIN', userId = 1, customerId = null } = req.body;
  const validRoles = ['ADMIN', 'STAFF', 'CUSTOMER'];

  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role. Must be ADMIN, STAFF, or CUSTOMER.' });
  }

  const token = jwt.sign(
    { userId: Number(userId), role, customerId: customerId ? Number(customerId) : null },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    success: true,
    token,
    role,
    userId,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    message: `Generated development test token for role: ${role}`
  });
});

// Mount Module 2 Catalog, Pricing, Taxes, and Discounts
app.use('/api', catalogRoutes);

// 404 handler for unmatched /api requests
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `API route ${req.originalUrl} not found.` });
});

// Fallback for static client navigation
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(clientPath, 'index.html'), err => {
      if (err) next();
    });
  }
  next();
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: `A record with this unique value already exists (Field: ${err.meta?.target || 'unknown'}).`
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'The requested record was not found.'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.'
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[BRIGHTLOOP] Server running on port ${PORT}`);
    console.log(`[BRIGHTLOOP] Frontend available at: http://localhost:${PORT}`);
    console.log(`[BRIGHTLOOP] Catalog API active at: http://localhost:${PORT}/api/products`);
  });
}

module.exports = app;
