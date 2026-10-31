// src/modules/catalog/controllers/discount.controller.js
const discountService = require('../services/discount.service');

async function listDiscounts(req, res, next) {
  try {
    const { isActive, scope } = req.query;
    const discounts = await discountService.listDiscounts({ isActive, scope });
    res.json({ success: true, data: discounts });
  } catch (err) {
    next(err);
  }
}

async function getDiscountById(req, res, next) {
  try {
    const { id } = req.params;
    const discount = await discountService.getDiscountById(id);
    if (!discount) {
      return res.status(404).json({ success: false, message: 'Discount not found.' });
    }
    res.json({ success: true, data: discount });
  } catch (err) {
    next(err);
  }
}

async function createDiscount(req, res, next) {
  try {
    const discount = await discountService.createDiscount(req.body);
    res.status(201).json({ success: true, message: 'Discount created successfully.', data: discount });
  } catch (err) {
    next(err);
  }
}

async function updateDiscount(req, res, next) {
  try {
    const { id } = req.params;
    const discount = await discountService.updateDiscount(id, req.body);
    res.json({ success: true, message: 'Discount updated successfully.', data: discount });
  } catch (err) {
    next(err);
  }
}

async function setDiscountStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const discount = await discountService.setDiscountStatus(id, isActive);
    res.json({ success: true, message: `Discount status updated to ${isActive ? 'active' : 'inactive'}.`, data: discount });
  } catch (err) {
    next(err);
  }
}

async function validateDiscount(req, res, next) {
  try {
    const { discountName, customerId, orderSubtotal, items } = req.body;
    const result = await discountService.validateDiscountEligibility({
      discountName,
      customerId,
      orderSubtotal,
      items
    });
    if (!result.isValid) {
      return res.status(400).json({ success: false, ...result });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  setDiscountStatus,
  validateDiscount
};

