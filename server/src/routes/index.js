const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const usersRoutes = require('../modules/users/users.routes');
const customersRoutes = require('../modules/customers/customers.routes');
const catalogRoutes = require('../modules/catalog/catalog.routes');
const quotationsRoutes = require('../modules/quotations/quotations.routes');
const subscriptionsRoutes = require('../modules/subscriptions/subscriptions.routes');
const billingRoutes = require('../modules/billing/billing.routes');
const analyticsRoutes = require('../modules/analytics/analytics.routes');
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

// Module 2: Catalog, Plans, Taxes & Discounts
router.use('/', catalogRoutes);

// Module 3: Quotations & Subscriptions
router.use('/quotations', quotationsRoutes);
router.use('/quotation-templates', quotationsRoutes);
router.use('/subscriptions', subscriptionsRoutes);

// Module 4: Billing, Invoices, Payments & Analytics
router.use('/', billingRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
