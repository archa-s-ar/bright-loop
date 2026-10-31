// server/src/modules/billing/services/gateway.service.js
const crypto = require('crypto');
const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const decimal = require('../../../utils/decimal');
const env = require('../../../config/env');
const { razorpay, isConfigured, verifyPaymentSignature } = require('../../../config/razorpay');
const { calculateInvoiceBalance } = require('./invoice.service');
const { generatePaymentReference } = require('../../../utils/sequence');

async function createPaymentOrder(invoiceId, customAmount = null, user = null) {
  const inv = await prisma.invoice.findUnique({
    where: { id: Number(invoiceId) },
    include: { customer: true },
  });

  if (!inv) throw ApiError.notFound(`Invoice ${invoiceId} not found`);

  // Customer isolation check
  if (user && user.role === 'CUSTOMER' && Number(user.customerId) !== inv.customerId) {
    throw ApiError.forbidden('You are not authorized to make payments for this invoice');
  }

  if (['PAID', 'CANCELLED'].includes(inv.status)) {
    throw ApiError.badRequest(`Cannot create payment order for invoice in '${inv.status}' status`);
  }

  const balances = await calculateInvoiceBalance(inv.id);
  const orderAmount = customAmount
    ? decimal.round2(customAmount)
    : balances.outstandingAmount;

  if (orderAmount.lessThanOrEqualTo(decimal.ZERO)) {
    throw ApiError.badRequest('Invoice has zero outstanding balance.');
  }

  const amountInPaise = Math.round(Number(orderAmount) * 100);
  let providerOrderId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // If Razorpay SDK is configured with valid credentials, call official API
  if (isConfigured && razorpay) {
    try {
      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `inv_${inv.id}_${Date.now()}`,
        notes: {
          invoiceId: String(inv.id),
          invoiceNumber: inv.invoiceNumber,
          customerId: String(inv.customerId),
        },
      });
      providerOrderId = rzpOrder.id;
    } catch (err) {
      console.warn('⚠️ Razorpay order creation failed, falling back to local order ID:', err.message);
    }
  }

  const paymentReference = await generatePaymentReference();

  // Create PENDING Payment in database
  const payment = await prisma.payment.create({
    data: {
      paymentReference,
      customerId: inv.customerId,
      amount: orderAmount,
      currency: 'INR',
      paymentMethod: 'GATEWAY',
      provider: 'RAZORPAY',
      providerOrderId,
      status: 'PENDING',
      createdById: user ? Number(user.id) : null,
      note: `Online checkout order for Invoice ${inv.invoiceNumber}`,
    },
  });

  return {
    orderId: providerOrderId,
    amount: amountInPaise,
    amountRupees: decimal.format(orderAmount),
    currency: 'INR',
    keyId: env.RAZORPAY_KEY_ID,
    paymentReference: payment.paymentReference,
    invoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    customerName: inv.customer.companyName,
    customerEmail: inv.customer.email,
  };
}

async function verifyAndProcessPayment(payload, user = null) {
  const { invoiceId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;

  const inv = await prisma.invoice.findUnique({
    where: { id: Number(invoiceId) },
  });
  if (!inv) throw ApiError.notFound(`Invoice ${invoiceId} not found`);

  // Customer isolation check
  if (user && user.role === 'CUSTOMER' && Number(user.customerId) !== inv.customerId) {
    throw ApiError.forbidden('You are not authorized to make payments for this invoice');
  }

  // Verify HMAC SHA256 Signature
  const isValidSignature = isConfigured
    ? verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
    : true; // Dev fallback if using test mock

  if (!isValidSignature) {
    throw ApiError.badRequest('Invalid payment gateway signature verification');
  }

  // Find or create Payment record
  let payment = await prisma.payment.findUnique({
    where: { providerOrderId: razorpay_order_id },
  });

  const balances = await calculateInvoiceBalance(inv.id);
  const paymentAmount = payment ? payment.amount : balances.outstandingAmount;

  const result = await prisma.$transaction(async (tx) => {
    if (!payment) {
      const paymentReference = await generatePaymentReference();
      payment = await tx.payment.create({
        data: {
          paymentReference,
          customerId: inv.customerId,
          amount: paymentAmount,
          currency: 'INR',
          paymentMethod: 'GATEWAY',
          provider: 'RAZORPAY',
          providerOrderId,
          providerPaymentId: razorpay_payment_id,
          paymentDate: new Date(),
          status: 'SUCCEEDED',
          createdById: user ? Number(user.id) : null,
        },
      });
    } else {
      payment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
          providerPaymentId: razorpay_payment_id,
          paymentDate: new Date(),
        },
      });
    }

    // Allocate payment to invoice
    const existingAlloc = await tx.paymentAllocation.findUnique({
      where: {
        paymentId_invoiceId: {
          paymentId: payment.id,
          invoiceId: inv.id,
        },
      },
    });

    if (!existingAlloc) {
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: inv.id,
          allocatedAmount: payment.amount,
        },
      });
    }

    // Update invoice status
    const newBalances = await calculateInvoiceBalance(inv.id, tx);
    const newStatus = newBalances.outstandingAmount.isZero() ? 'PAID' : 'PARTIALLY_PAID';

    await tx.invoice.update({
      where: { id: inv.id },
      data: { status: newStatus },
    });

    return payment;
  });

  return {
    success: true,
    message: 'Payment verified and allocated successfully',
    paymentId: result.id,
    paymentReference: result.paymentReference,
    invoiceId: inv.id,
    status: 'SUCCEEDED',
  };
}

module.exports = {
  createPaymentOrder,
  verifyAndProcessPayment,
};
