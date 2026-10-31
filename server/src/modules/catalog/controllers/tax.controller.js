// src/modules/catalog/controllers/tax.controller.js
const taxService = require('../services/tax.service');

async function listTaxRules(req, res, next) {
  try {
    const { isActive } = req.query;
    const taxes = await taxService.listTaxRules({ isActive });
    res.json({ success: true, data: taxes });
  } catch (err) {
    next(err);
  }
}

async function getTaxRuleById(req, res, next) {
  try {
    const { id } = req.params;
    const tax = await taxService.getTaxRuleById(id);
    if (!tax) {
      return res.status(404).json({ success: false, message: 'Tax rule not found.' });
    }
    res.json({ success: true, data: tax });
  } catch (err) {
    next(err);
  }
}

async function createTaxRule(req, res, next) {
  try {
    const tax = await taxService.createTaxRule(req.body);
    res.status(201).json({ success: true, message: 'Tax rule created successfully.', data: tax });
  } catch (err) {
    next(err);
  }
}

async function updateTaxRule(req, res, next) {
  try {
    const { id } = req.params;
    const tax = await taxService.updateTaxRule(id, req.body);
    res.json({ success: true, message: 'Tax rule updated successfully.', data: tax });
  } catch (err) {
    next(err);
  }
}

async function assignProductTaxes(req, res, next) {
  try {
    const { id } = req.params; // productId
    const { taxRuleIds } = req.body;
    const associations = await taxService.assignProductTaxes(id, taxRuleIds);
    res.json({ success: true, message: 'Product tax rules updated successfully.', data: associations });
  } catch (err) {
    next(err);
  }
}

async function calculateTaxes(req, res, next) {
  try {
    const { productId, taxableAmount } = req.query;
    if (!productId || taxableAmount === undefined) {
      return res.status(400).json({ success: false, message: 'productId and taxableAmount are required.' });
    }
    const result = await taxService.calculateProductTaxes(productId, taxableAmount);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTaxRules,
  getTaxRuleById,
  createTaxRule,
  updateTaxRule,
  assignProductTaxes,
  calculateTaxes
};

