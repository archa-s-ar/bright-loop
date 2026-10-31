// server/src/modules/quotations/validators/quotation.schema.js
const { z } = require('zod');

const quotationLineSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional().nullable(),
  description: z.string().trim().max(255).optional().nullable(),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative().optional(), // If omitted, fetched from product/plan
  discountAmount: z.number().nonnegative().optional().default(0),
});

const createQuotationSchema = z.object({
  body: z.object({
    customerId: z.number().int().positive('Customer ID is required'),
    planId: z.number().int().positive('Plan ID is required'),
    templateId: z.number().int().positive().optional().nullable(),
    quotationDate: z.string().optional(), // defaults to today (YYYY-MM-DD)
    validityDays: z.number().int().positive().optional().default(30),
    discountName: z.string().trim().optional().nullable(), // Optional promo code from Member 2
    lines: z.array(quotationLineSchema).optional().default([]),
  }),
});

const updateQuotationSchema = z.object({
  body: z.object({
    validityDays: z.number().int().positive().optional(),
    expiryDate: z.string().optional(),
    discountName: z.string().trim().optional().nullable(),
    lines: z.array(quotationLineSchema).optional(),
  }),
});

module.exports = {
  createQuotationSchema,
  updateQuotationSchema,
};

