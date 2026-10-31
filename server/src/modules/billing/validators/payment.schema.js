// server/src/modules/billing/validators/payment.schema.js
const { z } = require('zod');

const allocationItemSchema = z.object({
  invoiceId: z.number().int().positive('Invoice ID is required'),
  allocatedAmount: z.number().positive('Allocated amount must be positive'),
});

const createOfflinePaymentSchema = z.object({
  body: z.object({
    customerId: z.number().int().positive('Customer ID is required'),
    amount: z.number().positive('Amount must be positive'),
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'OTHER']).default('BANK_TRANSFER'),
    transactionReference: z.string().trim().max(150).optional().nullable(),
    paymentDate: z.string().optional(),
    note: z.string().trim().optional().nullable(),
    allocations: z.array(allocationItemSchema).optional().default([]),
  }),
});

const createOrderSchema = z.object({
  body: z.object({
    invoiceId: z.number().int().positive('Invoice ID is required'),
    amount: z.number().positive().optional(), // if omitted, uses current invoice balance
  }),
});

const verifyPaymentSchema = z.object({
  body: z.object({
    invoiceId: z.number().int().positive('Invoice ID is required'),
    razorpay_order_id: z.string().min(1, 'Order ID is required'),
    razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
    razorpay_signature: z.string().min(1, 'Signature is required'),
  }),
});

const allocatePaymentSchema = z.object({
  body: z.object({
    allocations: z.array(allocationItemSchema).min(1, 'At least one allocation is required'),
  }),
});

module.exports = {
  createOfflinePaymentSchema,
  createOrderSchema,
  verifyPaymentSchema,
  allocatePaymentSchema,
};

