// src/modules/catalog/controllers/plan.controller.js
const planService = require('../services/plan.service');
const pricingService = require('../services/pricing.service');

async function listPlans(req, res, next) {
  try {
    const { billingCycle, status, pricingMode } = req.query;
    const role = req.user?.role;
    const plans = await planService.listPlans({ billingCycle, status, pricingMode, role });
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
}

async function getPlanById(req, res, next) {
  try {
    const { id } = req.params;
    const plan = await planService.getPlanById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found.' });
    }
    if (req.user?.role === 'CUSTOMER' && plan.status !== 'ACTIVE') {
      return res.status(404).json({ success: false, message: 'Plan not found.' });
    }

    // Attach pricing breakdown
    const pricingSummary = await pricingService.calculatePlanPrice(id);
    res.json({ success: true, data: { ...plan, pricingSummary } });
  } catch (err) {
    next(err);
  }
}

async function createPlan(req, res, next) {
  try {
    const plan = await planService.createPlan(req.body);
    res.status(201).json({ success: true, message: 'Subscription plan created successfully.', data: plan });
  } catch (err) {
    next(err);
  }
}

async function updatePlan(req, res, next) {
  try {
    const { id } = req.params;
    const plan = await planService.updatePlan(id, req.body);
    res.json({ success: true, message: 'Subscription plan updated successfully.', data: plan });
  } catch (err) {
    next(err);
  }
}

async function setPlanStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const plan = await planService.setPlanStatus(id, status);
    res.json({ success: true, message: `Plan status updated to ${status}.`, data: plan });
  } catch (err) {
    next(err);
  }
}

async function assignPlanProducts(req, res, next) {
  try {
    const { id } = req.params;
    const products = await planService.assignPlanProducts(id, req.body.products);
    res.json({ success: true, message: 'Plan products updated successfully.', data: products });
  } catch (err) {
    next(err);
  }
}

async function removePlanProduct(req, res, next) {
  try {
    const { id, productId } = req.params;
    await planService.removePlanProduct(id, productId);
    res.json({ success: true, message: 'Product removed from plan successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  setPlanStatus,
  assignPlanProducts,
  removePlanProduct
};

