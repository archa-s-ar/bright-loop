// src/modules/catalog/controllers/pricing.controller.js
const pricingService = require('../services/pricing.service');

async function getPlanPricing(req, res, next) {
  try {
    const { planId } = req.params;
    const pricing = await pricingService.calculatePlanPrice(planId);
    res.json({ success: true, data: pricing });
  } catch (err) {
    next(err);
  }
}

async function getProductVariantPricing(req, res, next) {
  try {
    const { productId } = req.params;
    const { variantId } = req.query;
    const pricing = await pricingService.calculateProductWithVariantPrice(productId, variantId);
    res.json({ success: true, data: pricing });
  } catch (err) {
    next(err);
  }
}

async function calculateSummary(req, res, next) {
  try {
    const { planId, quantity, variants, discountName, customerId } = req.body;
    if (!planId) {
      return res.status(400).json({ success: false, message: 'planId is required.' });
    }
    const summary = await pricingService.calculateSummary({
      planId,
      quantity,
      variants,
      discountName,
      customerId
    });
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPlanPricing,
  getProductVariantPricing,
  calculateSummary
};

