const { z } = require('zod');

// Password policy: >8 characters, at least 1 uppercase, 1 lowercase, 1 special character
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{9,}$/;

const strongPasswordRule = z
  .string()
  .min(9, 'Password must be longer than 8 characters')
  .regex(
    strongPasswordRegex,
    'Password must contain at least one uppercase letter, one lowercase letter, and one special character'
  );

const registerSchema = {
  body: z.object({
    companyName: z.string().trim().min(2, 'Company name must be at least 2 characters').max(150),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(150),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: strongPasswordRule,
    phone: z.string().trim().max(20).optional().nullable(),
    billingAddress: z.string().trim().optional().nullable(),
    taxRegistrationNumber: z.string().trim().max(50).optional().nullable(),
  }),
};

const loginSchema = {
  body: z.object({
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
};

const forgotPasswordSchema = {
  body: z.object({
    email: z.string().trim().email('Invalid email address').toLowerCase(),
  }),
};

const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: strongPasswordRule,
  }),
};

const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPasswordRule,
  }),
};

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
};
