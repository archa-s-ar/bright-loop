// server/src/modules/quotations/services/quotation-converter.service.js
const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const { generateSubscriptionNumber } = require('../../../utils/sequence');
const { calculateNextBillingDate } = require('../../../utils/cycle-calculator');

async function convertQuotationToSubscription(quotationId, user, options = {}) {
  const quote = await prisma.quotation.findUnique({
    where: { id: Number(quotationId) },
    include: {
      template: { include: { plan: true } },
      lines: true,
      subscription: true,
    },
  });

  if (!quote) {
    throw ApiError.notFound(`Quotation with ID ${quotationId} not found`);
  }

  if (quote.subscription) {
    throw ApiError.badRequest(`Quotation ${quote.quotationNumber} has already been converted to Subscription ${quote.subscription.subscriptionNumber}`);
  }

  if (quote.status !== 'ACCEPTED') {
    throw ApiError.badRequest(`Only ACCEPTED quotations can be converted to subscriptions. Current status: '${quote.status}'`);
  }

  // Determine planId
  let planId = options.planId;
  let billingCycle = options.billingCycle || 'MONTHLY';
  if (!planId && quote.template) {
    planId = quote.template.planId;
    billingCycle = quote.template.plan.billingCycle;
  }

  if (!planId) {
    const firstPlan = await prisma.plan.findFirst({ where: { status: 'ACTIVE' } });
    if (!firstPlan) throw ApiError.badRequest('No active subscription plan found to link to this subscription');
    planId = firstPlan.id;
    billingCycle = firstPlan.billingCycle;
  } else {
    const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
    if (plan) billingCycle = plan.billingCycle;
  }

  const startDate = options.startDate ? new Date(options.startDate) : new Date();
  const nextBillingDate = calculateNextBillingDate(startDate, billingCycle);
  const subscriptionNumber = await generateSubscriptionNumber();

  // Execute conversion in an atomic transaction
  const subscription = await prisma.$transaction(async (tx) => {
    // 1. Create Subscription
    const sub = await tx.subscription.create({
      data: {
        subscriptionNumber,
        customerId: quote.customerId,
        planId: Number(planId),
        quotationId: quote.id,
        createdById: user ? Number(user.id) : quote.createdById,
        status: options.initialStatus || 'ACTIVE',
        startDate,
        nextBillingDate,
        lastBillingDate: null,
        billingCycle,
        paymentTermsDays: options.paymentTermsDays || 0,
        currency: quote.currency || 'INR',
        lines: {
          create: quote.lines.map((ql) => ({
            productId: ql.productId,
            variantId: ql.variantId,
            descriptionSnapshot: ql.descriptionSnapshot,
            quantity: ql.quantity,
            unitPrice: ql.unitPrice,
          })),
        },
      },
      include: {
        customer: true,
        plan: true,
        lines: true,
      },
    });

    // 2. Mark Quotation as CONVERTED
    await tx.quotation.update({
      where: { id: quote.id },
      data: { status: 'CONVERTED' },
    });

    // 3. Record Initial Subscription History Log
    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        previousStatus: null,
        newStatus: sub.status,
        changedById: user ? Number(user.id) : quote.createdById,
        reason: `Converted from Quotation ${quote.quotationNumber}`,
      },
    });

    return sub;
  });

  return subscription;
}

module.exports = {
  convertQuotationToSubscription,
};

