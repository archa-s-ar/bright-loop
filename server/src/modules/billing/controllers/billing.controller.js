// server/src/modules/billing/controllers/billing.controller.js
const { runRecurringBilling, listExecutions } = require('../services/recurring-billing.service');
const ApiResponse = require('../../../utils/apiResponse');

async function triggerBillingRun(req, res, next) {
  try {
    const results = await runRecurringBilling(req.body);
    return ApiResponse.success(res, results, 'Recurring billing run completed');
  } catch (err) {
    next(err);
  }
}

async function getBillingExecutions(req, res, next) {
  try {
    const executions = await listExecutions(req.query);
    return ApiResponse.success(res, executions, 'Billing execution logs retrieved');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  triggerBillingRun,
  getBillingExecutions,
};

