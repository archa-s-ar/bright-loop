// server/src/modules/quotations/quotations.routes.js
const { Router } = require('express');
const { authenticateUser, authorizeRoles } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');

const templateCtrl = require('./controllers/quotation-template.controller');
const quoteCtrl = require('./controllers/quotation.controller');

const { createTemplateSchema, updateTemplateSchema } = require('./validators/quotation-template.schema');
const { createQuotationSchema, updateQuotationSchema } = require('./validators/quotation.schema');

const router = Router();

// ==========================================
// Quotation Templates
// ==========================================
router.get(
  '/templates',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  templateCtrl.listTemplates
);
router.get(
  '/templates/:id',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  templateCtrl.getTemplateById
);
router.post(
  '/templates',
  authenticateUser,
  authorizeRoles('ADMIN'),
  validate(createTemplateSchema),
  templateCtrl.createTemplate
);
router.patch(
  '/templates/:id',
  authenticateUser,
  authorizeRoles('ADMIN'),
  validate(updateTemplateSchema),
  templateCtrl.updateTemplate
);
router.delete(
  '/templates/:id',
  authenticateUser,
  authorizeRoles('ADMIN'),
  templateCtrl.deactivateTemplate
);

// ==========================================
// Quotations Management
// ==========================================
router.get('/', authenticateUser, quoteCtrl.listQuotations);
router.get('/:id', authenticateUser, quoteCtrl.getQuotationById);
router.get('/:id/pdf', authenticateUser, quoteCtrl.downloadPdf);

router.post(
  '/',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  validate(createQuotationSchema),
  quoteCtrl.createQuotation
);

router.post(
  '/:id/send',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  quoteCtrl.sendQuotation
);

router.post(
  '/:id/accept',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF', 'CUSTOMER'),
  quoteCtrl.acceptQuotation
);

router.post(
  '/:id/reject',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF', 'CUSTOMER'),
  quoteCtrl.rejectQuotation
);

router.post(
  '/:id/convert',
  authenticateUser,
  authorizeRoles('ADMIN', 'STAFF'),
  quoteCtrl.convertQuotation
);

module.exports = router;

