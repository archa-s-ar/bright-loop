// server/src/modules/billing/controllers/payment.controller.js
const paymentService = require('../services/payment.service');
const gatewayService = require('../services/gateway.service');
const { processGatewayWebhook } = require('../services/webhook.service');
const ApiResponse = require('../../../utils/apiResponse');

async function listPayments(req, res, next) {
  try {
    const result = await paymentService.listPayments(req.query, req.user);
    return ApiResponse.success(res, result, 'Payments retrieved successfully');
  } catch (err) {
    next(err);
  }
}

async function getPaymentById(req, res, next) {
  try {
    const payment = await paymentService.getPaymentById(req.params.id, req.user);
    return ApiResponse.success(res, payment, 'Payment details retrieved');
  } catch (err) {
    next(err);
  }
}

async function recordPayment(req, res, next) {
  try {
    const payment = await paymentService.recordPayment(req.body, req.user);
    return ApiResponse.created(res, payment, 'Payment recorded and allocated successfully');
  } catch (err) {
    next(err);
  }
}

async function createOrder(req, res, next) {
  try {
    const orderData = await gatewayService.createPaymentOrder(
      req.body.invoiceId,
      req.body.amount,
      req.user
    );
    return ApiResponse.created(res, orderData, 'Payment order created');
  } catch (err) {
    next(err);
  }
}

async function verifyPayment(req, res, next) {
  try {
    const verification = await gatewayService.verifyAndProcessPayment(req.body, req.user);
    return ApiResponse.success(res, verification, 'Payment verified and credited');
  } catch (err) {
    next(err);
  }
}

async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const result = await processGatewayWebhook(rawBody, signature, req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function allocatePayment(req, res, next) {
  try {
    const payment = await paymentService.allocatePayment(
      req.params.id,
      req.body.allocations,
      req.user
    );
    return ApiResponse.success(res, payment, 'Payment allocated to invoices');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPayments,
  getPaymentById,
  recordPayment,
  createOrder,
  verifyPayment,
  handleWebhook,
  allocatePayment,
};

