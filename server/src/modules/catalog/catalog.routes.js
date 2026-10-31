// src/modules/catalog/catalog.routes.js
const { Router } = require('express');
const { authenticateToken, optionalAuthenticateToken, authorizeRoles } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

const productCtrl = require('./controllers/product.controller');
const planCtrl = require('./controllers/plan.controller');
const taxCtrl = require('./controllers/tax.controller');
const discountCtrl = require('./controllers/discount.controller');
const pricingCtrl = require('./controllers/pricing.controller');

const productSchemas = require('./validators/product.schema');
const planSchemas = require('./validators/plan.schema');
const taxSchemas = require('./validators/tax.schema');
const discountSchemas = require('./validators/discount.schema');

const router = Router();

// ==========================================
// 1. PRODUCTS & VARIANTS
// ==========================================

router.get('/products', optionalAuthenticateToken, productCtrl.listProducts);
router.get('/products/:id', optionalAuthenticateToken, productCtrl.getProductById);
router.post(
  '/products',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(productSchemas.createProductSchema),
  productCtrl.createProduct
);
router.patch(
  '/products/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(productSchemas.updateProductSchema),
  productCtrl.updateProduct
);
router.patch(
  '/products/:id/status',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(productSchemas.setProductStatusSchema),
  productCtrl.setProductStatus
);

// Variants
router.get('/products/:id/variants', optionalAuthenticateToken, productCtrl.listVariants);
router.post(
  '/products/:id/variants',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(productSchemas.createVariantSchema),
  productCtrl.createVariant
);
router.patch(
  '/variants/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(productSchemas.updateVariantSchema),
  productCtrl.updateVariant
);
router.delete(
  '/variants/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  productCtrl.deleteVariant
);

// Product Taxes assignment
router.post(
  '/products/:id/taxes',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(taxSchemas.assignProductTaxesSchema),
  taxCtrl.assignProductTaxes
);

// ==========================================
// 2. SUBSCRIPTION PLANS & BUNDLE PRICING
// ==========================================

router.get('/plans', optionalAuthenticateToken, planCtrl.listPlans);
router.get('/plans/:id', optionalAuthenticateToken, planCtrl.getPlanById);
router.post(
  '/plans',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(planSchemas.createPlanSchema),
  planCtrl.createPlan
);
router.patch(
  '/plans/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(planSchemas.updatePlanSchema),
  planCtrl.updatePlan
);
router.patch(
  '/plans/:id/status',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(planSchemas.setPlanStatusSchema),
  planCtrl.setPlanStatus
);
router.post(
  '/plans/:id/products',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(planSchemas.assignPlanProductsSchema),
  planCtrl.assignPlanProducts
);
router.delete(
  '/plans/:id/products/:productId',
  authenticateToken,
  authorizeRoles('ADMIN'),
  planCtrl.removePlanProduct
);

// ==========================================
// 3. TAX RULES & APPLICABILITY
// ==========================================

router.get('/taxes', optionalAuthenticateToken, taxCtrl.listTaxRules);
router.get('/taxes/calculate', optionalAuthenticateToken, taxCtrl.calculateTaxes);
router.get('/taxes/:id', optionalAuthenticateToken, taxCtrl.getTaxRuleById);
router.post(
  '/taxes',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(taxSchemas.createTaxRuleSchema),
  taxCtrl.createTaxRule
);
router.patch(
  '/taxes/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(taxSchemas.updateTaxRuleSchema),
  taxCtrl.updateTaxRule
);

// ==========================================
// 4. DISCOUNTS & ELIGIBILITY VALIDATION
// ==========================================

router.get('/discounts', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), discountCtrl.listDiscounts);
router.get('/discounts/:id', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), discountCtrl.getDiscountById);
router.post(
  '/discounts',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(discountSchemas.createDiscountSchema),
  discountCtrl.createDiscount
);
router.patch(
  '/discounts/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validate(discountSchemas.updateDiscountSchema),
  discountCtrl.updateDiscount
);
router.patch(
  '/discounts/:id/status',
  authenticateToken,
  authorizeRoles('ADMIN'),
  discountCtrl.setDiscountStatus
);
router.post(
  '/discounts/validate',
  optionalAuthenticateToken,
  validate(discountSchemas.validateDiscountSchema),
  discountCtrl.validateDiscount
);

// ==========================================
// 5. PRICING ENGINE (INTEGRATION WITH M3 & M4)
// ==========================================

router.get('/pricing/plan/:planId', optionalAuthenticateToken, pricingCtrl.getPlanPricing);
router.get('/pricing/product/:productId', optionalAuthenticateToken, pricingCtrl.getProductVariantPricing);
router.post('/pricing/calculate-summary', optionalAuthenticateToken, pricingCtrl.calculateSummary);

module.exports = router;

