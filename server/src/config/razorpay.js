// server/src/config/razorpay.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const env = require('./env');

let razorpayClient = null;

const isConfigured = Boolean(
  env.RAZORPAY_KEY_ID &&
  env.RAZORPAY_KEY_SECRET &&
  !env.RAZORPAY_KEY_ID.includes('placeholder')
);

if (isConfigured) {
  try {
    razorpayClient = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  } catch (err) {
    console.warn('⚠️ Razorpay initialization warning:', err.message);
  }
}

/**
 * Verify Razorpay payment signature: HMAC SHA256(order_id + "|" + payment_id, secret)
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  const secret = env.RAZORPAY_KEY_SECRET;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

/**
 * Verify Razorpay Webhook signature: HMAC SHA256(rawBody, webhookSecret)
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}

module.exports = {
  razorpay: razorpayClient,
  isConfigured,
  verifyPaymentSignature,
  verifyWebhookSignature,
};

