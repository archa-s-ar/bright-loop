// server/src/modules/subscriptions/services/subscription.service.js
const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const { generateSubscriptionNumber } = require('../../../utils/sequence');
const { calculateNextBillingDate } = require('../../../utils/cycle-calculator');
const { logHistory } = require('./subscription-history.service');

async function listSubscriptions(query = {}, user = null) {
  const { customerId, planId, status, search, page = 1, limit = 20 } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};

  if (user && user.role === 'CUSTOMER') {
    where.customerId = Number(user.customerId);
  } else if (customerId) {
    where.customerId = Number(customerId);
  }

  if (planId) where.planId = Number(planId);
  if (status) where.status = status;

  if (search) {
    where.OR = [
      { subscriptionNumber: { contains: search } },
      { customer: { companyName: { contains: search } } },
      { plan: { name: { contains: search } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, companyName: true, email: true } },
        plan: { select: { id: true, name: true, billingCycle: true, planPrice: true, pricingMode: true } },
        _count: { select: { invoices: true, lines: true } },
      },
    }),
  ]);

  return {
    items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / take) || 1,
    },
  };
}

async function getSubscriptionById(id, user = null) {
  const sub = await prisma.subscription.findUnique({
    where: { id: Number(id) },
    include: {
      customer: true,
      plan: true,
      createdBy: { select: { id: true, fullName: true, email: true } },
      quotation: { select: { id: true, quotationNumber: true, status: true, totalAmount: true } },
      lines: {
        include: {
          product: { select: { id: true, name: true, salesPrice: true } },
          variant: { select: { id: true, attributeName: true, attributeValue: true, priceDelta: true } },
        },
      },
      subscriptionDiscounts: {
        where: { isActive: true },
        include: { discount: true },
      },
      invoices: {
        orderBy: { invoiceDate: 'desc' },
        take: 10,
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          totalAmount: true,
          status: true,
        },
      },
      history: {
        orderBy: { changedAt: 'desc' },
        take: 10,
        include: { changedBy: { select: { id: true, fullName: true, role: true } } },
      },
    },
  });

  if (!sub) {
    throw ApiError.notFound(`Subscription with ID ${id} not found`);
  }

  if (user && user.role === 'CUSTOMER' && sub.customerId !== user.customerId) {
    throw ApiError.forbidden('Access denied: You do not have permission to view this subscription');
  }

  return sub;
}

async function createSubscription(data, user) {
  const { customerId, planId, quotationId, startDate, paymentTermsDays = 0, discountIds = [], lines = [] } = data;

  const customer = await prisma.customer.findUnique({ where: { id: Number(customerId) } });
  if (!customer) throw ApiError.notFound(`Customer with ID ${customerId} not found`);

  const plan = await prisma.plan.findUnique({
    where: { id: Number(planId) },
    include: { planProducts: { include: { product: true } } },
  });
  if (!plan) throw ApiError.notFound(`Plan with ID ${planId} not found`);

  const sDate = startDate ? new Date(startDate) : new Date();
  const nextBillingDate = calculateNextBillingDate(sDate, plan.billingCycle);
  const subscriptionNumber = await generateSubscriptionNumber();

  // Populate lines if not passed
  let resolvedLines = [...lines];
  if (resolvedLines.length === 0 && plan.planProducts.length > 0) {
    resolvedLines = plan.planProducts.map((pp) => ({
      productId: pp.productId,
      quantity: pp.quantity,
      unitPrice: pp.unitPriceOverride ? Number(pp.unitPriceOverride) : Number(pp.product.salesPrice),
      description: pp.product.name,
    }));
  }

  if (resolvedLines.length === 0) {
    resolvedLines = [
      {
        description: `${plan.name} (${plan.billingCycle})`,
        quantity: 1,
        unitPrice: Number(plan.planPrice),
      },
    ];
  }

  const sub = await prisma.$transaction(async (tx) => {
    const created = await tx.subscription.create({
      data: {
        subscriptionNumber,
        customerId: Number(customerId),
        planId: Number(planId),
        quotationId: quotationId ? Number(quotationId) : null,
        createdById: user ? Number(user.id) : 1,
        status: 'ACTIVE',
        startDate: sDate,
        nextBillingDate,
        lastBillingDate: null,
        billingCycle: plan.billingCycle,
        paymentTermsDays: Number(paymentTermsDays) || 0,
        currency: 'INR',
        lines: {
          create: resolvedLines.map((l) => ({
            productId: l.productId ? Number(l.productId) : null,
            variantId: l.variantId ? Number(l.variantId) : null,
            descriptionSnapshot: l.description || 'Subscription Line Item',
            quantity: Number(l.quantity) || 1,
            unitPrice: l.unitPrice !== undefined ? l.unitPrice : 0,
          })),
        },
      },
      include: {
        customer: true,
        plan: true,
        lines: true,
      },
    });

    // Attach discounts if any
    if (discountIds.length > 0) {
      for (const dId of discountIds) {
        await tx.subscriptionDiscount.create({
          data: {
            subscriptionId: created.id,
            discountId: Number(dId),
            assignedById: user ? Number(user.id) : 1,
          },
        });
      }
    }

    // Record initial history
    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: created.id,
        previousStatus: null,
        newStatus: 'ACTIVE',
        changedById: user ? Number(user.id) : 1,
        reason: 'Initial direct subscription creation',
      },
    });

    return created;
  });

  return sub;
}

async function activateSubscription(id, user) {
  const sub = await getSubscriptionById(id, user);

  if (sub.status === 'ACTIVE') {
    throw ApiError.badRequest('Subscription is already ACTIVE');
  }

  const nextBillingDate = calculateNextBillingDate(new Date(), sub.billingCycle);

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.subscription.update({
      where: { id: Number(id) },
      data: {
        status: 'ACTIVE',
        nextBillingDate,
      },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        previousStatus: sub.status,
        newStatus: 'ACTIVE',
        changedById: user ? Number(user.id) : 1,
        reason: 'Subscription activated',
      },
    });

    return s;
  });

  return updated;
}

async function pauseSubscription(id, user, reason = 'Paused by administrator') {
  const sub = await getSubscriptionById(id, user);

  if (sub.status !== 'ACTIVE') {
    throw ApiError.badRequest(`Cannot pause subscription in '${sub.status}' status. Only ACTIVE subscriptions can be paused.`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.subscription.update({
      where: { id: Number(id) },
      data: { status: 'PAUSED' },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        previousStatus: 'ACTIVE',
        newStatus: 'PAUSED',
        changedById: user ? Number(user.id) : 1,
        reason,
      },
    });

    return s;
  });

  return updated;
}

async function resumeSubscription(id, user, reason = 'Resumed by administrator') {
  const sub = await getSubscriptionById(id, user);

  if (sub.status !== 'PAUSED') {
    throw ApiError.badRequest(`Cannot resume subscription in '${sub.status}' status. Only PAUSED subscriptions can be resumed.`);
  }

  // When resuming, set nextBillingDate to today if it was in the past, or calculate forward
  const today = new Date();
  const nextBillingDate = sub.nextBillingDate && new Date(sub.nextBillingDate) > today
    ? sub.nextBillingDate
    : today;

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.subscription.update({
      where: { id: Number(id) },
      data: {
        status: 'ACTIVE',
        nextBillingDate,
      },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        previousStatus: 'PAUSED',
        newStatus: 'ACTIVE',
        changedById: user ? Number(user.id) : 1,
        reason,
      },
    });

    return s;
  });

  return updated;
}

async function renewSubscription(id, user) {
  const sub = await getSubscriptionById(id, user);

  if (sub.status === 'CLOSED') {
    throw ApiError.badRequest('Cannot renew a CLOSED subscription.');
  }

  const baseDate = sub.nextBillingDate ? new Date(sub.nextBillingDate) : new Date();
  const nextBillingDate = calculateNextBillingDate(baseDate, sub.billingCycle);

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.subscription.update({
      where: { id: Number(id) },
      data: {
        status: 'ACTIVE',
        nextBillingDate,
      },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        previousStatus: sub.status,
        newStatus: 'ACTIVE',
        changedById: user ? Number(user.id) : 1,
        reason: `Subscription renewed. Next billing date advanced to ${nextBillingDate.toISOString().split('T')[0]}`,
      },
    });

    return s;
  });

  return updated;
}

async function closeSubscription(id, user, reason = 'Closed upon cancellation request') {
  const sub = await getSubscriptionById(id, user);

  if (sub.status === 'CLOSED') {
    throw ApiError.badRequest('Subscription is already CLOSED');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.subscription.update({
      where: { id: Number(id) },
      data: {
        status: 'CLOSED',
        nextBillingDate: null,
      },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        previousStatus: sub.status,
        newStatus: 'CLOSED',
        changedById: user ? Number(user.id) : 1,
        reason,
      },
    });

    return s;
  });

  return updated;
}

module.exports = {
  listSubscriptions,
  getSubscriptionById,
  createSubscription,
  activateSubscription,
  pauseSubscription,
  resumeSubscription,
  renewSubscription,
  closeSubscription,
};

