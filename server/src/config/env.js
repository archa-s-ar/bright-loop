const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from server/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().default('brightloop_jwt_secure_dev_secret_key_2026'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CLIENT_URL: z.string().default('http://localhost:5000'),
  APP_URL: z.string().default('http://localhost:5000'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.string().default('587').transform((value) => Number.parseInt(value, 10)),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Brightloop Software <no-reply@brightloop.local>'),
  COOKIE_SECRET: z.string().default('brightloop_cookie_secret_key_2026'),
  // Module 4: Payment Gateway & Billing Engine
  RAZORPAY_KEY_ID: z.string().optional().default('rzp_test_placeholder_key'),
  RAZORPAY_KEY_SECRET: z.string().optional().default('rzp_test_placeholder_secret'),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default('rzp_test_webhook_secret'),
  BILLING_CRON_SCHEDULE: z.string().default('0 0 * * *'), // Midnight daily
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

module.exports = parsed.data;
