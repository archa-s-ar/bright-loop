// server/src/modules/subscriptions/validators/subscription.schema.js
const { z } = require('zod');

const subscriptionLineSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional().nullable(),
  description: z.string().trim().max(255).optional().nullable(),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative().optional(),
});

const createSubscriptionSchema = z.object({
  body: z.object({
    customerId: z.number().int().positive('Customer ID is required'),
    planId: z.number().int().positive('Plan ID is required'),
    quotationId: z.number().int().positive().optional().nullable(),
    startDate: z.string().optional(), // defaults to today (YYYY-MM-DD)
    paymentTermsDays: z.number().int().nonnegative().optional().default(0),
    discountIds: z.array(z.number().int().positive()).optional().default([]),
    lines: z.array(subscriptionLineSchema).optional().default([]),
  }),
});

const pauseSubscriptionSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(255).optional().default('Subscription paused by user request'),
  }),
});

const resumeSubscriptionSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(255).optional().default('Subscription resumed'),
  }),
});

const closeSubscriptionSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(1, 'Reason for closing is required').max(255),
  }),
});

module.exports = {
  createSubscriptionSchema,
  pauseSubscriptionSchema,
  resumeSubscriptionSchema,
  closeSubscriptionSchema,
};

