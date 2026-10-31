// server/src/utils/sequence.js
const prisma = require('../config/prisma');

/**
 * Generate sequential formatted numbers:
 * Quotes: QUO-YYYYMM-XXXX
 * Subscriptions: SUB-YYYYMM-XXXX
 * Invoices: INV-YYYYMM-XXXX
 * Payments: PAY-YYYYMM-XXXX
 */
async function generateSequence(prefix, modelName, fieldName) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const pattern = `${prefix}-${yearMonth}-`;

  // Find latest record matching current yearMonth
  const latest = await prisma[modelName].findFirst({
    where: {
      [fieldName]: {
        startsWith: pattern,
      },
    },
    orderBy: {
      id: 'desc',
    },
    select: {
      [fieldName]: true,
    },
  });

  let nextIndex = 1;
  if (latest && latest[fieldName]) {
    const parts = latest[fieldName].split('-');
    if (parts.length >= 3) {
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextIndex = lastSeq + 1;
      }
    }
  }

  const padded = String(nextIndex).padStart(4, '0');
  return `${pattern}${padded}`;
}

module.exports = {
  generateQuotationNumber: () => generateSequence('QUO', 'quotation', 'quotationNumber'),
  generateSubscriptionNumber: () => generateSequence('SUB', 'subscription', 'subscriptionNumber'),
  generateInvoiceNumber: () => generateSequence('INV', 'invoice', 'invoiceNumber'),
  generatePaymentReference: () => generateSequence('PAY', 'payment', 'paymentReference'),
};

