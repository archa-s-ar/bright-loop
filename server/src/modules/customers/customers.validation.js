const { z } = require('zod');

const createCustomerSchema = {
  body: z.object({
    companyName: z.string().trim().min(2, 'Company name must be at least 2 characters').max(150),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    phone: z.string().trim().max(20).optional().nullable(),
    billingAddress: z.string().trim().optional().nullable(),
    taxRegistrationNumber: z.string().trim().max(50).optional().nullable(),
    currency: z.string().trim().length(3).default('INR'),
  }),
};

const updateCustomerSchema = {
  body: z.object({
    companyName: z.string().trim().min(2).max(150).optional(),
    email: z.string().trim().email('Invalid email address').toLowerCase().optional(),
    phone: z.string().trim().max(20).optional().nullable(),
    billingAddress: z.string().trim().optional().nullable(),
    taxRegistrationNumber: z.string().trim().max(50).optional().nullable(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Customer ID must be a numeric integer').transform(Number),
  }),
};

const getCustomerByIdSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Customer ID must be a numeric integer').transform(Number),
  }),
};

const listCustomersSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
    limit: z
      .string()
      .optional()
      .default('20')
      .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 20))),
  }),
};

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
  getCustomerByIdSchema,
  listCustomersSchema,
};
