// server/src/modules/analytics/controllers/analytics.controller.js
const analyticsService = require('../services/analytics.service');
const ApiResponse = require('../../../utils/apiResponse');

async function getOverview(req, res, next) {
  try {
    const overview = await analyticsService.getFinancialOverview();
    return ApiResponse.success(res, overview, 'Financial overview metrics retrieved');
  } catch (err) {
    next(err);
  }
}

async function getAging(req, res, next) {
  try {
    const aging = await analyticsService.getAgingReport();
    return ApiResponse.success(res, aging, 'Aging report retrieved');
  } catch (err) {
    next(err);
  }
}

async function getPaymentMethods(req, res, next) {
  try {
    const methods = await analyticsService.getPaymentMethodsBreakdown();
    return ApiResponse.success(res, methods, 'Payment methods breakdown retrieved');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverview,
  getAging,
  getPaymentMethods,
};

