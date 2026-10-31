// server/src/modules/billing/billing.routes.js
const { Router } = require('express');
const { authenticateUser, authorizeRoles } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');

const invoiceCtrl = require('./controllers/invoice.controller');
const paymentCtrl = require('./controllers/payment.controller');
const billingCtrl = require('./controllers/billing.controller');

const { createManualInvoiceSchema } = require('./validators/invoice.schema');
const {
  createOfflinePaymentSchema,
  createOrderSchema,
  verifyPaymentSchema,
  allocatePaymentSchema,
} = require('./validators/payment.schema');

const router = Router();

// ==========================================
// Invoices
// ==========================================
router.get('/invoices', authenticateUser, invoiceCtrl.listInvoices);
router.get('/invoices/:id', authenticateUser, invoiceCtrl.getInvoiceById);
router.get('/invoices/:id/pdf', authenticateUser, invoiceCtrl.downloadPdf);

router.post(
  '/invoices',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  validate(createManualInvoiceSchema),
  invoiceCtrl.createManualInvoice
);

router.post(
  '/invoices/:id/confirm',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  invoiceCtrl.confirmInvoice
);

router.post(
  '/invoices/:id/cancel',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  invoiceCtrl.cancelInvoice
);

// ==========================================
// Payments & Checkout
// ==========================================
router.get('/payments', authenticateUser, paymentCtrl.listPayments);
router.get('/payments/:id', authenticateUser, paymentCtrl.getPaymentById);

// Public webhook endpoint (signature verified inside controller/service)
router.post('/payments/webhook', paymentCtrl.handleWebhook);

router.post(
  '/payments',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  validate(createOfflinePaymentSchema),
  paymentCtrl.recordPayment
);

router.post(
  '/payments/create-order',
  authenticateUser,
  validate(createOrderSchema),
  paymentCtrl.createOrder
);

router.post(
  '/payments/verify',
  authenticateUser,
  validate(verifyPaymentSchema),
  paymentCtrl.verifyPayment
);

router.post(
  '/payments/:id/allocate',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  validate(allocatePaymentSchema),
  paymentCtrl.allocatePayment
);

// ==========================================
// Recurring Billing Engine & Logs
// ==========================================
router.post(
  '/billing/run',
  authenticateUser,
  authorizeRoles('ADMIN'),
  billingCtrl.triggerBillingRun
);

router.get(
  '/billing/executions',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  billingCtrl.getBillingExecutions
);

module.exports = router;

