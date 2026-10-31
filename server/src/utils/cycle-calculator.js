// server/src/utils/cycle-calculator.js
const decimal = require('./decimal');

/**
 * Given a start date and cycle, return the end date of that billing period.
 * (e.g. For MONTHLY starting on Jan 15, period is Jan 15 to Feb 14)
 */
function calculatePeriodEnd(startDateInput, billingCycle) {
  const d = new Date(startDateInput);
  const end = new Date(d);

  switch (billingCycle) {
    case 'DAILY':
      // 1 day duration
      end.setDate(end.getDate());
      break;
    case 'WEEKLY':
      end.setDate(end.getDate() + 6);
      break;
    case 'MONTHLY':
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);
      break;
    case 'YEARLY':
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
      break;
    default:
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);
  }

  return end;
}

/**
 * Given the current billing period start and cycle, compute the next billing date.
 */
function calculateNextBillingDate(currentBillingDateInput, billingCycle) {
  const d = new Date(currentBillingDateInput);
  const next = new Date(d);

  switch (billingCycle) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next;
}

/**
 * Normalize an amount to Monthly Recurring Revenue (MRR) based on its billing cycle.
 */
function toMonthlyRate(amount, billingCycle) {
  const dAmount = decimal.toDecimal(amount);
  switch (billingCycle) {
    case 'DAILY':
      return decimal.multiply(dAmount, 30);
    case 'WEEKLY':
      return decimal.multiply(dAmount, 4.3333);
    case 'MONTHLY':
      return dAmount;
    case 'YEARLY':
      return decimal.divide(dAmount, 12);
    default:
      return dAmount;
  }
}

/**
 * Normalize an amount to Annual Recurring Revenue (ARR).
 */
function toAnnualRate(amount, billingCycle) {
  const mrr = toMonthlyRate(amount, billingCycle);
  return decimal.multiply(mrr, 12);
}

module.exports = {
  calculatePeriodEnd,
  calculateNextBillingDate,
  toMonthlyRate,
  toAnnualRate,
};

