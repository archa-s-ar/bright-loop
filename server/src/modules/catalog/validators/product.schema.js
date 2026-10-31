// src/modules/catalog/validators/product.schema.js
const { z } = require('zod');

const productStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);

const createProductSchema = z.object({
  name: z.string({ required_error: 'Product name is required' }).trim().min(1, 'Name cannot be empty').max(150),
  productType: z.string({ required_error: 'Product type is required' }).trim().min(1, 'Product type cannot be empty').max(100),
  description: z.string().trim().optional().nullable(),
  salesPrice: z.union([z.number(), z.string()]).refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Sales price must be a non-negative number'
  }),
  costPrice: z.union([z.number(), z.string()]).refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Cost price must be a non-negative number'
  }),
  notes: z.string().trim().optional().nullable(),
  status: productStatusEnum.optional().default('ACTIVE')
});

const updateProductSchema = createProductSchema.partial();

const setProductStatusSchema = z.object({
  status: productStatusEnum
});

const createVariantSchema = z.object({
  attributeName: z.string({ required_error: 'Attribute name is required' }).trim().min(1).max(100),
  attributeValue: z.string({ required_error: 'Attribute value is required' }).trim().min(1).max(100),
  priceDelta: z.union([z.number(), z.string()]).refine(val => !isNaN(Number(val)), {
    message: 'Price delta must be a valid number'
  }).optional().default(0),
  isActive: z.boolean().optional().default(true)
});

const updateVariantSchema = z.object({
  attributeName: z.string().trim().min(1).max(100).optional(),
  attributeValue: z.string().trim().min(1).max(100).optional(),
  priceDelta: z.union([z.number(), z.string()]).refine(val => !isNaN(Number(val)), {
    message: 'Price delta must be a valid number'
  }).optional(),
  isActive: z.boolean().optional()
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  setProductStatusSchema,
  createVariantSchema,
  updateVariantSchema
};

