// server/src/modules/subscriptions/subscriptions.routes.js
const { Router } = require('express');
const { authenticateUser, authorizeRoles } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');

const subCtrl = require('./controllers/subscription.controller');
const {
  createSubscriptionSchema,
  pauseSubscriptionSchema,
  resumeSubscriptionSchema,
  closeSubscriptionSchema,
} = require('./validators/subscription.schema');

const router = Router();

// List & Retrieve
router.get('/', authenticateUser, subCtrl.listSubscriptions);
router.get('/:id', authenticateUser, subCtrl.getSubscriptionById);
router.get('/:id/history', authenticateUser, authorizeRoles('ADMIN', 'STAFF'), subCtrl.getHistory);

// Create direct subscription
router.post(
  '/',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  validate(createSubscriptionSchema),
  subCtrl.createSubscription
);

// Lifecycle actions
router.post('/:id/activate', authenticateUser, authorizeRoles('ADMIN', 'STAFF'), subCtrl.activateSubscription);
router.post(
  '/:id/pause',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  validate(pauseSubscriptionSchema),
  subCtrl.pauseSubscription
);
router.post(
  '/:id/resume',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  validate(resumeSubscriptionSchema),
  subCtrl.resumeSubscription
);
router.post('/:id/renew', authenticateUser, authorizeRoles('ADMIN', 'STAFF'), subCtrl.renewSubscription);
router.post(
  '/:id/close',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  validate(closeSubscriptionSchema),
  subCtrl.closeSubscription
);

module.exports = router;

