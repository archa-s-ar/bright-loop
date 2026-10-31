// server/src/modules/analytics/analytics.routes.js
const { Router } = require('express');
const { authenticateUser, authorizeRoles } = require('../../middleware/auth.middleware');

const analyticsCtrl = require('./controllers/analytics.controller');

const router = Router();

// Financial Analytics Dashboard Endpoints (ADMIN, STAFF)
router.get(
  '/overview',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  analyticsCtrl.getOverview
);

router.get(
  '/aging',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  analyticsCtrl.getAging
);

router.get(
  '/payment-methods',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  analyticsCtrl.getPaymentMethods
);

module.exports = router;

