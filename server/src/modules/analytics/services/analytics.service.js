// server/src/modules/analytics/services/analytics.service.js
const prisma = require('../../../config/prisma');
const decimal = require('../../../utils/decimal');
const { toMonthlyRate, toAnnualRate } = require('../../../utils/cycle-calculator');

async function getFinancialOverview() {
  const [invoices, activeSubscriptions, succeededPayments] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { not: 'CANCELLED' } },
      include: {
        paymentAllocations: {
          include: { payment: true },
        },
      },
    }),
    prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: {
        plan: true,
        lines: true,
      },
    }),
    prisma.payment.findMany({
      where: { status: 'SUCCEEDED' },
      select: { amount: true },
    }),
  ]);

  let totalInvoiced = decimal.ZERO;
  let totalOutstanding = decimal.ZERO;
  let totalOverdue = decimal.ZERO;
  let overdueCount = 0;
  const now = new Date();

  for (const inv of invoices) {
    const invTotal = decimal.toDecimal(inv.totalAmount);
    totalInvoiced = decimal.add(totalInvoiced, invTotal);

    let paid = decimal.ZERO;
    (inv.paymentAllocations || []).forEach((pa) => {
      if (pa.payment && pa.payment.status === 'SUCCEEDED') {
        paid = decimal.add(paid, pa.allocatedAmount);
      }
    });

    const bal = decimal.clampPositive(decimal.subtract(invTotal, paid));
    if (bal.greaterThan(decimal.ZERO)) {
      totalOutstanding = decimal.add(totalOutstanding, bal);
      if (new Date(inv.dueDate) < now && ['CONFIRMED', 'PARTIALLY_PAID'].includes(inv.status)) {
        totalOverdue = decimal.add(totalOverdue, bal);
        overdueCount += 1;
      }
    }
  }

  // Cash Collected
  let cashCollected = decimal.ZERO;
  succeededPayments.forEach((p) => {
    cashCollected = decimal.add(cashCollected, p.amount);
  });

  // Calculate MRR across active subscriptions
  let totalMrr = decimal.ZERO;
  for (const sub of activeSubscriptions) {
    let subPrice = decimal.ZERO;
    if (sub.plan.pricingMode === 'FIXED') {
      subPrice = decimal.toDecimal(sub.plan.planPrice);
    } else {
      sub.lines.forEach((l) => {
        subPrice = decimal.add(subPrice, decimal.multiply(l.quantity, l.unitPrice));
      });
    }

    const subMrr = toMonthlyRate(subPrice, sub.billingCycle);
    totalMrr = decimal.add(totalMrr, subMrr);
  }

  const totalArr = decimal.multiply(totalMrr, 12);

  return {
    invoicedRevenue: decimal.format(totalInvoiced),
    cashCollected: decimal.format(cashCollected),
    outstandingAmount: decimal.format(totalOutstanding),
    overdueAmount: decimal.format(totalOverdue),
    overdueCount,
    mrr: decimal.format(totalMrr),
    arr: decimal.format(totalArr),
    activeSubscriptionsCount: activeSubscriptions.length,
    totalInvoicesCount: invoices.length,
  };
}

async function getAgingReport() {
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ['CONFIRMED', 'PARTIALLY_PAID'] } },
    include: {
      paymentAllocations: {
        include: { payment: true },
      },
    },
  });

  const now = new Date();
  const brackets = {
    current: { label: 'Current (Not Due)', count: 0, amount: decimal.ZERO },
    days1_30: { label: '1 - 30 Days Overdue', count: 0, amount: decimal.ZERO },
    days31_60: { label: '31 - 60 Days Overdue', count: 0, amount: decimal.ZERO },
    days60_plus: { label: '60+ Days Overdue', count: 0, amount: decimal.ZERO },
  };

  for (const inv of invoices) {
    let paid = decimal.ZERO;
    (inv.paymentAllocations || []).forEach((pa) => {
      if (pa.payment && pa.payment.status === 'SUCCEEDED') {
        paid = decimal.add(paid, pa.allocatedAmount);
      }
    });

    const bal = decimal.clampPositive(decimal.subtract(inv.totalAmount, paid));
    if (bal.greaterThan(decimal.ZERO)) {
      const dueDate = new Date(inv.dueDate);
      const diffDays = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        brackets.current.count += 1;
        brackets.current.amount = decimal.add(brackets.current.amount, bal);
      } else if (diffDays <= 30) {
        brackets.days1_30.count += 1;
        brackets.days1_30.amount = decimal.add(brackets.days1_30.amount, bal);
      } else if (diffDays <= 60) {
        brackets.days31_60.count += 1;
        brackets.days31_60.amount = decimal.add(brackets.days31_60.amount, bal);
      } else {
        brackets.days60_plus.count += 1;
        brackets.days60_plus.amount = decimal.add(brackets.days60_plus.amount, bal);
      }
    }
  }

  return {
    current: { count: brackets.current.count, amount: decimal.format(brackets.current.amount) },
    days1_30: { count: brackets.days1_30.count, amount: decimal.format(brackets.days1_30.amount) },
    days31_60: { count: brackets.days31_60.count, amount: decimal.format(brackets.days31_60.amount) },
    days60_plus: { count: brackets.days60_plus.count, amount: decimal.format(brackets.days60_plus.amount) },
  };
}

async function getPaymentMethodsBreakdown() {
  const payments = await prisma.payment.findMany({
    where: { status: 'SUCCEEDED' },
    select: { paymentMethod: true, amount: true },
  });

  const breakdown = {};
  for (const p of payments) {
    const method = p.paymentMethod || 'OTHER';
    if (!breakdown[method]) {
      breakdown[method] = { count: 0, amount: decimal.ZERO };
    }
    breakdown[method].count += 1;
    breakdown[method].amount = decimal.add(breakdown[method].amount, p.amount);
  }

  const result = [];
  for (const [method, data] of Object.entries(breakdown)) {
    result.push({
      method,
      count: data.count,
      amount: decimal.format(data.amount),
    });
  }

  return result;
}

module.exports = {
  getFinancialOverview,
  getAgingReport,
  getPaymentMethodsBreakdown,
};

