const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const usersRoutes = require('../modules/users/users.routes');
const customersRoutes = require('../modules/customers/customers.routes');
const ApiResponse = require('../utils/apiResponse');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  return ApiResponse.success(
    res,
    {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    'Brightloop API is operational'
  );
});

// Module 1: Authentication & Core Infrastructure
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/customers', customersRoutes);

// Integration Placeholders for other team members:
// Member 2: Catalog and Pricing
// router.use('/catalog', catalogRoutes);

// Member 3: Quotations and Subscriptions
// router.use('/quotations', quotationsRoutes);
// router.use('/subscriptions', subscriptionsRoutes);

// Member 4: Billing and Analytics
// router.use('/billing', billingRoutes);
// router.use('/analytics', analyticsRoutes);

module.exports = router;
