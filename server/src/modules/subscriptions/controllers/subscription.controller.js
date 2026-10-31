// server/src/modules/subscriptions/controllers/subscription.controller.js
const subscriptionService = require('../services/subscription.service');
const { getSubscriptionHistory } = require('../services/subscription-history.service');
const ApiResponse = require('../../../utils/apiResponse');

async function listSubscriptions(req, res, next) {
  try {
    const result = await subscriptionService.listSubscriptions(req.query, req.user);
    return ApiResponse.success(res, result, 'Subscriptions retrieved successfully');
  } catch (err) {
    next(err);
  }
}

async function getSubscriptionById(req, res, next) {
  try {
    const sub = await subscriptionService.getSubscriptionById(req.params.id, req.user);
    return ApiResponse.success(res, sub, 'Subscription details retrieved');
  } catch (err) {
    next(err);
  }
}

async function createSubscription(req, res, next) {
  try {
    const sub = await subscriptionService.createSubscription(req.body, req.user);
    return ApiResponse.created(res, sub, 'Subscription created successfully');
  } catch (err) {
    next(err);
  }
}

async function activateSubscription(req, res, next) {
  try {
    const sub = await subscriptionService.activateSubscription(req.params.id, req.user);
    return ApiResponse.success(res, sub, 'Subscription activated successfully');
  } catch (err) {
    next(err);
  }
}

async function pauseSubscription(req, res, next) {
  try {
    const sub = await subscriptionService.pauseSubscription(req.params.id, req.user, req.body.reason);
    return ApiResponse.success(res, sub, 'Subscription paused successfully');
  } catch (err) {
    next(err);
  }
}

async function resumeSubscription(req, res, next) {
  try {
    const sub = await subscriptionService.resumeSubscription(req.params.id, req.user, req.body.reason);
    return ApiResponse.success(res, sub, 'Subscription resumed successfully');
  } catch (err) {
    next(err);
  }
}

async function renewSubscription(req, res, next) {
  try {
    const sub = await subscriptionService.renewSubscription(req.params.id, req.user);
    return ApiResponse.success(res, sub, 'Subscription renewed successfully');
  } catch (err) {
    next(err);
  }
}

async function closeSubscription(req, res, next) {
  try {
    const sub = await subscriptionService.closeSubscription(req.params.id, req.user, req.body.reason);
    return ApiResponse.success(res, sub, 'Subscription closed');
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    // Verify access to parent subscription
    await subscriptionService.getSubscriptionById(req.params.id, req.user);
    const history = await getSubscriptionHistory(req.params.id);
    return ApiResponse.success(res, history, 'Subscription audit history retrieved');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSubscriptions,
  getSubscriptionById,
  createSubscription,
  activateSubscription,
  pauseSubscription,
  resumeSubscription,
  renewSubscription,
  closeSubscription,
  getHistory,
};

