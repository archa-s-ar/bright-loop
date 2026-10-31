// src/modules/catalog/validators/discount.schema.js
const { z } = require('zod');

const discountTypeEnum = z.enum(['FIXED', 'PERCENTAGE']);
const discountScopeEnum = z.enum(['PRODUCT', 'SUBSCRIPTION']);

const createDiscountSchema = z.object({
  name: z.string({ required_error: 'Discount name/code is required' }).trim().min(1).max(150),
  description: z.string().trim().optional().nullable(),
  discountType: discountTypeEnum,
  discountValue: z.union([z.number(), z.string()]).refine(val => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Discount value must be greater than 0'
  }),
  minimumPurchase: z.union([z.number(), z.string()]).refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Minimum purchase must be non-negative'
  }).optional().default(0),
  minimumQuantity: z.number().int().min(0).optional().default(0),
  usageLimit: z.number().int().positive().optional().nullable(),
  startsAt: z.string().or(z.date()).transform(val => new Date(val)),
  endsAt: z.string().or(z.date()).optional().nullable().transform(val => val ? new Date(val) : null),
  scope: discountScopeEnum,
  isActive: z.boolean().optional().default(true),
  productIds: z.array(z.number().int().positive()).optional()
}).refine(data => {
  if (data.discountType === 'PERCENTAGE') {
    return Number(data.discountValue) <= 100;
  }
  return true;
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discountValue']
});

const updateDiscountSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().optional().nullable(),
  discountType: discountTypeEnum.optional(),
  discountValue: z.union([z.number(), z.string()]).refine(val => !isNaN(Number(val)) && Number(val) > 0).optional(),
  minimumPurchase: z.union([z.number(), z.string()]).refine(val => !isNaN(Number(val)) && Number(val) >= 0).optional(),
  minimumQuantity: z.number().int().min(0).optional(),
  usageLimit: z.number().int().positive().optional().nullable(),
  startsAt: z.string().or(z.date()).transform(val => new Date(val)).optional(),
  endsAt: z.string().or(z.date()).optional().nullable().transform(val => val ? new Date(val) : null),
  scope: discountScopeEnum.optional(),
  isActive: z.boolean().optional(),
  productIds: z.array(z.number().int().positive()).optional()
});

const validateDiscountSchema = z.object({
  discountName: z.string({ required_error: 'Discount code or name is required' }).trim().min(1),
  customerId: z.number().int().positive().optional().nullable(),
  orderSubtotal: z.union([z.number(), z.string()]).refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Order subtotal must be a non-negative number'
  }),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1),
    unitPrice: z.union([z.number(), z.string()]).refine(val => !isNaN(Number(val)) && Number(val) >= 0)
  })).optional().default([])
});

module.exports = {
  createDiscountSchema,
  updateDiscountSchema,
  validateDiscountSchema
};

