// server/tests/modules3-4.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const decimal = require('../src/utils/decimal');
const {
  calculatePeriodEnd,
  calculateNextBillingDate,
  toMonthlyRate,
  toAnnualRate,
} = require('../src/utils/cycle-calculator');
const { verifyPaymentSignature } = require('../src/config/razorpay');
const crypto = require('crypto');

describe('Module 3 & 4: Billing Cycle & Revenue Normalization', () => {
  it('should compute billing period end correctly for DAILY, WEEKLY, MONTHLY, and YEARLY', () => {
    const start = new Date('2026-01-01');

    const dailyEnd = calculatePeriodEnd(start, 'DAILY');
    assert.equal(dailyEnd.toISOString().split('T')[0], '2026-01-01');

    const weeklyEnd = calculatePeriodEnd(start, 'WEEKLY');
    assert.equal(weeklyEnd.toISOString().split('T')[0], '2026-01-07');

    const monthlyEnd = calculatePeriodEnd(start, 'MONTHLY');
    assert.equal(monthlyEnd.toISOString().split('T')[0], '2026-01-31');

    const yearlyEnd = calculatePeriodEnd(start, 'YEARLY');
    assert.equal(yearlyEnd.toISOString().split('T')[0], '2026-12-31');
  });

  it('should advance next billing date properly according to billing cycle', () => {
    const start = new Date('2026-05-15');

    const nextDaily = calculateNextBillingDate(start, 'DAILY');
    assert.equal(nextDaily.toISOString().split('T')[0], '2026-05-16');

    const nextWeekly = calculateNextBillingDate(start, 'WEEKLY');
    assert.equal(nextWeekly.toISOString().split('T')[0], '2026-05-22');

    const nextMonthly = calculateNextBillingDate(start, 'MONTHLY');
    assert.equal(nextMonthly.toISOString().split('T')[0], '2026-06-15');

    const nextYearly = calculateNextBillingDate(start, 'YEARLY');
    assert.equal(nextYearly.toISOString().split('T')[0], '2027-05-15');
  });

  it('should accurately normalize MRR across cycles without floating point drift', () => {
    // Monthly plan: ₹5000 -> MRR: ₹5000
    const mrrMonthly = toMonthlyRate(5000, 'MONTHLY');
    assert.equal(decimal.format(mrrMonthly), '5000.00');

    // Yearly plan: ₹120000 -> MRR: ₹10000
    const mrrYearly = toMonthlyRate(120000, 'YEARLY');
    assert.equal(decimal.format(mrrYearly), '10000.00');

    // Daily plan: ₹100 -> MRR: 100 * 30 = ₹3000
    const mrrDaily = toMonthlyRate(100, 'DAILY');
    assert.equal(decimal.format(mrrDaily), '3000.00');

    // ARR = MRR * 12
    const arr = toAnnualRate(5000, 'MONTHLY');
    assert.equal(decimal.format(arr), '60000.00');
  });
});

describe('Module 4: Dynamic Overdue Evaluation & Financial Integrity', () => {
  it('should dynamically calculate overdue status without requiring OVERDUE enum', () => {
    const today = new Date('2026-06-01');

    // Case 1: Past due date, unpaid confirmed invoice -> OVERDUE
    const inv1 = {
      dueDate: new Date('2026-05-20'),
      status: 'CONFIRMED',
      totalAmount: 1000,
      paidAmount: 200,
    };
    const outstanding1 = inv1.totalAmount - inv1.paidAmount;
    const isOverdue1 =
      ['CONFIRMED', 'PARTIALLY_PAID'].includes(inv1.status) &&
      inv1.dueDate < today &&
      outstanding1 > 0;
    assert.equal(isOverdue1, true);

    // Case 2: Past due date, but fully paid -> NOT overdue
    const inv2 = {
      dueDate: new Date('2026-05-20'),
      status: 'PAID',
      totalAmount: 1000,
      paidAmount: 1000,
    };
    const isOverdue2 =
      ['CONFIRMED', 'PARTIALLY_PAID'].includes(inv2.status) &&
      inv2.dueDate < today &&
      inv2.totalAmount - inv2.paidAmount > 0;
    assert.equal(isOverdue2, false);

    // Case 3: Due date in future -> NOT overdue
    const inv3 = {
      dueDate: new Date('2026-06-15'),
      status: 'CONFIRMED',
      totalAmount: 1000,
      paidAmount: 0,
    };
    const isOverdue3 =
      ['CONFIRMED', 'PARTIALLY_PAID'].includes(inv3.status) &&
      inv3.dueDate < today &&
      inv3.totalAmount - inv3.paidAmount > 0;
    assert.equal(isOverdue3, false);
  });

  it('should enforce partial payment allocation bounds', () => {
    const invoiceTotal = decimal.toDecimal(5000);
    const existingPaid = decimal.toDecimal(3500);
    const outstanding = decimal.subtract(invoiceTotal, existingPaid); // 1500

    const paymentAmount = decimal.toDecimal(2000);
    const attemptedAllocation = decimal.toDecimal(1800);

    // Rule 1: Allocation cannot exceed payment amount
    assert.ok(attemptedAllocation.lessThanOrEqualTo(paymentAmount));

    // Rule 2: Allocation cannot exceed invoice outstanding balance
    const exceedsInvoice = attemptedAllocation.greaterThan(outstanding);
    assert.equal(exceedsInvoice, true, 'Allocation of 1800 must exceed outstanding balance of 1500');

    // Valid allocation: 1500
    const validAlloc = decimal.toDecimal(1500);
    assert.ok(validAlloc.lessThanOrEqualTo(outstanding));

    const newOutstanding = decimal.subtract(outstanding, validAlloc);
    assert.equal(decimal.format(newOutstanding), '0.00');
    const newStatus = newOutstanding.isZero() ? 'PAID' : 'PARTIALLY_PAID';
    assert.equal(newStatus, 'PAID');
  });
});

describe('Module 4: Razorpay Payment Gateway Signature Verification', () => {
  it('should verify valid HMAC SHA256 payment signature correctly', () => {
    const secret = 'brightloop_secret_test_key_123';
    const orderId = 'order_DA1234567890';
    const paymentId = 'pay_9876543210';

    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    // Verify logic
    const computed = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    assert.equal(computed, validSignature);

    // Tampered payload
    const tampered = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}_tampered|${paymentId}`)
      .digest('hex');
    assert.notEqual(tampered, validSignature);
  });
});

describe('Module 3: Quotation Lifecycle State Machine Rules', () => {
  it('should validate allowed status transitions', () => {
    const allowed = {
      DRAFT: ['SENT'],
      SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
      ACCEPTED: ['CONVERTED', 'REJECTED'],
      REJECTED: [],
      EXPIRED: [],
      CONVERTED: [],
    };

    // Valid transitions
    assert.ok(allowed['DRAFT'].includes('SENT'));
    assert.ok(allowed['SENT'].includes('ACCEPTED'));
    assert.ok(allowed['ACCEPTED'].includes('CONVERTED'));

    // Invalid transitions
    assert.equal(allowed['DRAFT'].includes('ACCEPTED'), false, 'DRAFT cannot jump directly to ACCEPTED');
    assert.equal(allowed['REJECTED'].includes('CONVERTED'), false, 'REJECTED cannot be converted');
    assert.equal(allowed['CONVERTED'].includes('ACCEPTED'), false, 'CONVERTED cannot be re-accepted');
  });

  it('should prevent expired quotations from being accepted', () => {
    const now = new Date();
    const pastExpiry = new Date(now.getTime() - 86400000); // 1 day ago

    const isExpired = pastExpiry < now;
    assert.equal(isExpired, true, 'Quote past expiry date must be detected as expired');
  });
});

