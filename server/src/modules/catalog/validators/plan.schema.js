// src/modules/catalog/validators/plan.schema.js
const { z } = require('zod');

const billingCycleEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
const planPricingModeEnum = z.enum(['FIXED', 'ITEMIZED']);
const planStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);

const planProductItemSchema = z.object({
  productId: z.number({ required_error: 'Product ID is required' }).int().positive(),
  quantity: z.number({ required_error: 'Quantity is required' }).int().min(1, 'Quantity must be at least 1'),
  unitPriceOverride: z.union([z.number(), z.string()]).refine(val => val === null || val === undefined || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: 'Unit price override must be a non-negative number'
  }).optional().nullable()
});

const createPlanSchema = z.object({
  name: z.string({ required_error: 'Plan name is required' }).trim().min(1).max(150),
  description: z.string().trim().optional().nullable(),
  pricingMode: planPricingModeEnum.optional().default('FIXED'),
  planPrice: z.union([z.number(), z.string()]).refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Plan price must be a non-negative number'
  }).optional().default(0),
  billingCycle: billingCycleEnum,
  minimumQuantity: z.number().int().min(1).optional().default(1),
  availableFrom: z.string().or(z.date()).transform(val => new Date(val)),
  availableUntil: z.string().or(z.date()).optional().nullable().transform(val => val ? new Date(val) : null),
  autoClose: z.boolean().optional().default(false),
  allowEarlyClose: z.boolean().optional().default(true),
  allowPause: z.boolean().optional().default(true),
  allowRenewal: z.boolean().optional().default(true),
  status: planStatusEnum.optional().default('ACTIVE'),
  products: z.array(planProductItemSchema).optional()
});

const updatePlanSchema = createPlanSchema.partial();

const setPlanStatusSchema = z.object({
  status: planStatusEnum
});

const assignPlanProductsSchema = z.object({
  products: z.array(planProductItemSchema, { required_error: 'Products list is required' })
});

module.exports = {
  createPlanSchema,
  updatePlanSchema,
  setPlanStatusSchema,
  assignPlanProductsSchema
};

