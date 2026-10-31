// server/src/modules/quotations/validators/quotation-template.schema.js
const { z } = require('zod');

const templateLineSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive().default(1),
});

const createTemplateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required').max(150),
    description: z.string().trim().optional().nullable(),
    planId: z.number().int().positive('Plan ID is required'),
    validityDays: z.number().int().positive().default(30),
    paymentTerms: z.string().trim().max(100).optional().nullable(),
    lines: z.array(templateLineSchema).optional().default([]),
  }),
});

const updateTemplateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().optional().nullable(),
    planId: z.number().int().positive().optional(),
    validityDays: z.number().int().positive().optional(),
    paymentTerms: z.string().trim().max(100).optional().nullable(),
    isActive: z.boolean().optional(),
    lines: z.array(templateLineSchema).optional(),
  }),
});

module.exports = {
  createTemplateSchema,
  updateTemplateSchema,
};

