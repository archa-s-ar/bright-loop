// server/src/modules/billing/validators/invoice.schema.js
const { z } = require('zod');

const createManualInvoiceSchema = z.object({
  body: z.object({
    subscriptionId: z.number().int().positive('Subscription ID is required'),
    billingPeriodStart: z.string().optional(),
    billingPeriodEnd: z.string().optional(),
    dueDate: z.string().optional(),
    note: z.string().trim().optional(),
  }),
});

module.exports = {
  createManualInvoiceSchema,
};

