// src/modules/catalog/validators/tax.schema.js
const { z } = require('zod');

const createTaxRuleSchema = z.object({
  name: z.string({ required_error: 'Tax rule name is required' }).trim().min(1).max(100),
  taxRate: z.union([z.number(), z.string()]).refine(val => {
    const num = Number(val);
    return !isNaN(num) && num >= 0 && num <= 1;
  }, {
    message: 'Tax rate must be a valid decimal fraction between 0 and 1 (e.g. 0.18 for 18%)'
  }),
  description: z.string().trim().optional().nullable(),
  effectiveFrom: z.string().or(z.date()).transform(val => new Date(val)),
  effectiveUntil: z.string().or(z.date()).optional().nullable().transform(val => val ? new Date(val) : null),
  isActive: z.boolean().optional().default(true)
});

const updateTaxRuleSchema = createTaxRuleSchema.partial();

const assignProductTaxesSchema = z.object({
  taxRuleIds: z.array(z.number().int().positive(), { required_error: 'Array of tax rule IDs is required' })
});

module.exports = {
  createTaxRuleSchema,
  updateTaxRuleSchema,
  assignProductTaxesSchema
};

