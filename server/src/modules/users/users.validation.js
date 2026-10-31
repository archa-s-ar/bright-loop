const { z } = require('zod');

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{9,}$/;

const createStaffSchema = {
  body: z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(150),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z
      .string()
      .min(9, 'Password must be longer than 8 characters')
      .regex(
        strongPasswordRegex,
        'Password must contain at least one uppercase letter, one lowercase letter, and one special character'
      ),
  }),
};

const updateUserSchema = {
  body: z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(150).optional(),
    email: z.string().trim().email('Invalid email address').toLowerCase().optional(),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a numeric integer').transform(Number),
  }),
};

const toggleStatusSchema = {
  body: z.object({
    isActive: z.boolean(),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a numeric integer').transform(Number),
  }),
};

const getUserByIdSchema = {
  params: z.object({
    id: z.string().regex(/^\d+$/, 'User ID must be a numeric integer').transform(Number),
  }),
};

const listUsersSchema = {
  query: z.object({
    role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER']).optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    search: z.string().trim().optional(),
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
  createStaffSchema,
  updateUserSchema,
  toggleStatusSchema,
  getUserByIdSchema,
  listUsersSchema,
};
