// server/src/modules/billing/services/invoice.service.js
const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const decimal = require('../../../utils/decimal');
const { generateInvoiceNumber } = require('../../../utils/sequence');
const { calculatePeriodEnd } = require('../../../utils/cycle-calculator');
const taxService = require('../../catalog/services/tax.service');

/**
 * Calculates current balance, paid amount and dynamic overdue status for an invoice.
 */
async function calculateInvoiceBalance(invoiceId, tx = prisma) {
  const inv = await tx.invoice.findUnique({
    where: { id: Number(invoiceId) },
    include: {
      paymentAllocations: {
        include: { payment: true },
      },
    },
  });

  if (!inv) return null;

  let paidAmount = decimal.ZERO;
  for (const alloc of inv.paymentAllocations) {
    if (alloc.payment && alloc.payment.status === 'SUCCEEDED') {
      paidAmount = decimal.add(paidAmount, alloc.allocatedAmount);
    }
  }

  const totalAmount = decimal.toDecimal(inv.totalAmount);
  const outstandingAmount = decimal.clampPositive(decimal.subtract(totalAmount, paidAmount));
  const isOverdue =
    ['CONFIRMED', 'PARTIALLY_PAID'].includes(inv.status) &&
    new Date(inv.dueDate) < new Date() &&
    outstandingAmount.greaterThan(decimal.ZERO);

  return {
    totalAmount,
    paidAmount,
    outstandingAmount,
    isOverdue,
    isFullyPaid: outstandingAmount.isZero(),
  };
}

async function listInvoices(query = {}, user = null) {
  const { customerId, status, isOverdue, search, page = 1, limit = 20 } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};

  if (user && user.role === 'CUSTOMER') {
    where.customerId = Number(user.customerId);
  } else if (customerId) {
    where.customerId = Number(customerId);
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search } },
      { customer: { companyName: { contains: search } } },
    ];
  }

  const [total, rawInvoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take,
      orderBy: { invoiceDate: 'desc' },
      include: {
        customer: { select: { id: true, companyName: true, email: true } },
        subscription: { select: { id: true, subscriptionNumber: true, billingCycle: true } },
        paymentAllocations: {
          include: { payment: { select: { id: true, status: true, amount: true } } },
        },
      },
    }),
  ]);

  // Enrich with dynamic balances and overdue status
  const items = rawInvoices.map((inv) => {
    let paid = decimal.ZERO;
    (inv.paymentAllocations || []).forEach((pa) => {
      if (pa.payment && pa.payment.status === 'SUCCEEDED') {
        paid = decimal.add(paid, pa.allocatedAmount);
      }
    });

    const total = decimal.toDecimal(inv.totalAmount);
    const outstanding = decimal.clampPositive(decimal.subtract(total, paid));
    const overdue =
      ['CONFIRMED', 'PARTIALLY_PAID'].includes(inv.status) &&
      new Date(inv.dueDate) < new Date() &&
      outstanding.greaterThan(decimal.ZERO);

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      subscriptionId: inv.subscriptionId,
      subscriptionNumber: inv.subscription?.subscriptionNumber,
      customerId: inv.customerId,
      customerName: inv.customer?.companyName,
      customerEmail: inv.customer?.email,
      billingPeriodStart: inv.billingPeriodStart,
      billingPeriodEnd: inv.billingPeriodEnd,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      currency: inv.currency,
      subtotal: decimal.format(inv.subtotal),
      discountTotal: decimal.format(inv.discountTotal),
      taxTotal: decimal.format(inv.taxTotal),
      totalAmount: decimal.format(inv.totalAmount),
      paidAmount: decimal.format(paid),
      outstandingAmount: decimal.format(outstanding),
      isOverdue: overdue,
      status: inv.status,
      createdAt: inv.createdAt,
    };
  });

  // If filtered specifically by overdue
  let filteredItems = items;
  if (isOverdue === 'true' || isOverdue === true) {
    filteredItems = items.filter((i) => i.isOverdue);
  }

  return {
    items: filteredItems,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / take) || 1,
    },
  };
}

async function getInvoiceById(id, user = null) {
  const inv = await prisma.invoice.findUnique({
    where: { id: Number(id) },
    include: {
      customer: true,
      subscription: {
        include: {
          plan: { select: { id: true, name: true, billingCycle: true, pricingMode: true, planPrice: true } },
        },
      },
      lines: {
        include: {
          product: { select: { id: true, name: true } },
          taxes: true,
        },
      },
      discountRedemptions: {
        include: { discount: true },
      },
      paymentAllocations: {
        include: {
          payment: {
            select: {
              id: true,
              paymentReference: true,
              paymentMethod: true,
              provider: true,
              status: true,
              paymentDate: true,
              amount: true,
            },
          },
        },
      },
    },
  });

  if (!inv) {
    throw ApiError.notFound(`Invoice with ID ${id} not found`);
  }

  if (user && user.role === 'CUSTOMER' && inv.customerId !== user.customerId) {
    throw ApiError.forbidden('Access denied: You do not have permission to view this invoice');
  }

  const balances = await calculateInvoiceBalance(inv.id);

  return {
    ...inv,
    paidAmount: decimal.format(balances.paidAmount),
    outstandingAmount: decimal.format(balances.outstandingAmount),
    isOverdue: balances.isOverdue,
  };
}

/**
 * Core Invoice Generator:
 * Generates an invoice for a subscription and billing period window.
 */
async function generateInvoiceForSubscription(subscriptionId, options = {}, clientTx = null) {
  const runTransaction = async (tx) => {
    // 1. Fetch Subscription with Plan, Lines, and Discounts
    const subscription = await tx.subscription.findUnique({
      where: { id: Number(subscriptionId) },
      include: {
        customer: true,
        plan: true,
        lines: {
          include: { product: true, variant: true },
        },
        subscriptionDiscounts: {
          where: { isActive: true },
          include: { discount: true },
        },
      },
    });

    if (!subscription) {
      throw ApiError.notFound(`Subscription ${subscriptionId} not found`);
    }

    // Determine billing period
    const periodStart = options.billingPeriodStart
      ? new Date(options.billingPeriodStart)
      : subscription.nextBillingDate
      ? new Date(subscription.nextBillingDate)
      : new Date();

    const periodEnd = options.billingPeriodEnd
      ? new Date(options.billingPeriodEnd)
      : calculatePeriodEnd(periodStart, subscription.billingCycle);

    // 2. Strict Idempotency Check (Database Unique constraint @@unique([subscriptionId, billingPeriodStart, billingPeriodEnd]))
    const existing = await tx.invoice.findFirst({
      where: {
        subscriptionId: subscription.id,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
      },
    });

    if (existing) {
      return existing; // Idempotently return existing invoice
    }

    const invoiceDate = options.invoiceDate ? new Date(options.invoiceDate) : new Date();
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + (subscription.paymentTermsDays || 0));

    // 3. Evaluate Line Items & Pricing (FIXED vs ITEMIZED Mode)
    let rawLines = [];
    if (subscription.plan.pricingMode === 'FIXED') {
      // In FIXED mode: Bill the plan's fixed price
      rawLines = [
        {
          productId: null,
          description: `${subscription.plan.name} (${subscription.plan.billingCycle})`,
          quantity: 1,
          unitPrice: decimal.toDecimal(subscription.plan.planPrice),
        },
      ];
    } else {
      // In ITEMIZED mode: Bill lines configured on the subscription
      rawLines = subscription.lines.map((sl) => ({
        productId: sl.productId,
        description: sl.descriptionSnapshot,
        quantity: sl.quantity,
        unitPrice: decimal.toDecimal(sl.unitPrice),
      }));
    }

    let subtotal = decimal.ZERO;
    let taxTotal = decimal.ZERO;
    const computedLines = [];

    for (const line of rawLines) {
      const quantity = line.quantity || 1;
      const unitPrice = line.unitPrice;
      const taxableAmount = decimal.multiply(quantity, unitPrice);

      // Snapshot statutory tax rules via Member 2 Tax Service
      let lineTaxAmount = decimal.ZERO;
      let lineTaxes = [];

      if (line.productId) {
        try {
          const taxRes = await taxService.calculateProductTaxes(line.productId, taxableAmount, invoiceDate);
          lineTaxAmount = decimal.toDecimal(taxRes.totalTaxAmount);
          lineTaxes = (taxRes.taxes || []).map((t) => ({
            taxRuleId: t.taxRuleId || null,
            taxNameSnapshot: t.taxName,
            taxRateSnapshot: decimal.toDecimal(t.taxRate),
            taxAmount: decimal.toDecimal(t.taxAmount),
          }));
        } catch (err) {
          lineTaxAmount = decimal.ZERO;
        }
      }

      const lineTotal = decimal.add(taxableAmount, lineTaxAmount);
      subtotal = decimal.add(subtotal, taxableAmount);
      taxTotal = decimal.add(taxTotal, lineTaxAmount);

      computedLines.push({
        productId: line.productId,
        descriptionSnapshot: line.description,
        quantity,
        unitPrice,
        discountAmount: decimal.ZERO,
        taxableAmount,
        taxAmount: lineTaxAmount,
        lineTotal,
        taxes: {
          create: lineTaxes,
        },
      });
    }

    // 4. Evaluate Active Subscription Discounts
    let discountTotal = decimal.ZERO;
    const discountRedemptionsToCreate = [];

    for (const subDisc of subscription.subscriptionDiscounts) {
      const disc = subDisc.discount;
      if (disc && disc.isActive) {
        let discAmount = decimal.ZERO;
        if (disc.discountType === 'PERCENTAGE') {
          discAmount = decimal.divide(decimal.multiply(subtotal, disc.discountValue), 100);
        } else {
          discAmount = decimal.toDecimal(disc.discountValue);
        }

        discAmount = decimal.round2(discAmount);
        if (discAmount.greaterThan(decimal.ZERO)) {
          discountTotal = decimal.add(discountTotal, discAmount);
          discountRedemptionsToCreate.push({
            discountId: disc.id,
            subscriptionId: subscription.id,
            discountAmount: discAmount,
          });
        }
      }
    }

    // Total = (Subtotal - Discount) + Tax
    const discountedSubtotal = decimal.clampPositive(decimal.subtract(subtotal, discountTotal));
    const totalAmount = decimal.add(discountedSubtotal, taxTotal);

    const invoiceNumber = await generateInvoiceNumber();

    // 5. Create Invoice Header, Lines, Line Taxes, and Discount Redemptions
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        invoiceDate,
        dueDate,
        currency: subscription.currency || 'INR',
        subtotal,
        discountTotal,
        taxTotal,
        totalAmount,
        status: options.initialStatus || 'CONFIRMED',
        lines: {
          create: computedLines,
        },
        discountRedemptions: {
          create: discountRedemptionsToCreate,
        },
      },
      include: {
        lines: { include: { taxes: true } },
        discountRedemptions: true,
        customer: true,
      },
    });

    return invoice;
  };

  if (clientTx) {
    return runTransaction(clientTx);
  }
  return prisma.$transaction(runTransaction);
}

async function confirmInvoice(id, user) {
  const inv = await prisma.invoice.findUnique({ where: { id: Number(id) } });
  if (!inv) throw ApiError.notFound(`Invoice ${id} not found`);

  if (inv.status !== 'DRAFT') {
    throw ApiError.badRequest(`Cannot confirm invoice in '${inv.status}' status. Only DRAFT invoices can be confirmed.`);
  }

  return prisma.invoice.update({
    where: { id: Number(id) },
    data: { status: 'CONFIRMED' },
    include: { customer: true, lines: true },
  });
}

async function cancelInvoice(id, user) {
  const inv = await prisma.invoice.findUnique({
    where: { id: Number(id) },
    include: { paymentAllocations: { include: { payment: true } } },
  });

  if (!inv) throw ApiError.notFound(`Invoice ${id} not found`);

  if (inv.status === 'CANCELLED') {
    throw ApiError.badRequest('Invoice is already CANCELLED');
  }

  // Prevent cancelling if any succeeded payments have been allocated
  const hasAllocatedPayment = inv.paymentAllocations.some(
    (pa) => pa.payment && pa.payment.status === 'SUCCEEDED'
  );
  if (hasAllocatedPayment) {
    throw ApiError.badRequest('Cannot cancel an invoice that already has succeeded payments allocated to it.');
  }

  return prisma.invoice.update({
    where: { id: Number(id) },
    data: { status: 'CANCELLED' },
  });
}

module.exports = {
  calculateInvoiceBalance,
  listInvoices,
  getInvoiceById,
  generateInvoiceForSubscription,
  confirmInvoice,
  cancelInvoice,
};

