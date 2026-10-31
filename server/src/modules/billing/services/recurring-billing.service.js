// server/src/modules/billing/services/recurring-billing.service.js
const prisma = require('../../../config/prisma');
const { calculatePeriodEnd, calculateNextBillingDate } = require('../../../utils/cycle-calculator');
const { generateInvoiceForSubscription } = require('./invoice.service');

/**
 * Executes a full recurring billing run across all eligible subscriptions.
 * Can be triggered on a schedule (node-cron) or manually by an administrator.
 */
async function runRecurringBilling(options = {}) {
  const targetDate = options.targetDate ? new Date(options.targetDate) : new Date();
  targetDate.setHours(23, 59, 59, 999); // Inclusive of full target day

  console.log(`⏳ [BILLING ENGINE] Starting recurring billing run for date: ${targetDate.toISOString().split('T')[0]}`);

  // 1. Find all billable active subscriptions whose next billing date has arrived
  const eligibleSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      nextBillingDate: {
        lte: targetDate,
      },
    },
    include: {
      plan: true,
      customer: true,
    },
    orderBy: {
      nextBillingDate: 'asc',
    },
  });

  console.log(`🔍 [BILLING ENGINE] Found ${eligibleSubscriptions.length} eligible subscription(s) for billing.`);

  const results = {
    totalEligible: eligibleSubscriptions.length,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  for (const sub of eligibleSubscriptions) {
    results.processed += 1;
    const periodStart = new Date(sub.nextBillingDate);
    const periodEnd = calculatePeriodEnd(periodStart, sub.billingCycle);

    try {
      // 2. Check or Create BillingExecution record with status PROCESSING (Idempotency Guard)
      let execution = await prisma.billingExecution.findFirst({
        where: {
          subscriptionId: sub.id,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
        },
      });

      if (execution && execution.status === 'SUCCESS') {
        console.log(`⏭️ [BILLING ENGINE] Sub ${sub.subscriptionNumber} already billed for period ${periodStart.toISOString().split('T')[0]}. Skipping.`);
        results.skipped += 1;
        results.details.push({
          subscriptionNumber: sub.subscriptionNumber,
          status: 'SKIPPED',
          reason: 'Already successfully billed for this period',
        });
        continue;
      }

      if (!execution) {
        execution = await prisma.billingExecution.create({
          data: {
            subscriptionId: sub.id,
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            status: 'PROCESSING',
          },
        });
      } else {
        // Increment retry attempt count
        execution = await prisma.billingExecution.update({
          where: { id: execution.id },
          data: {
            status: 'PROCESSING',
            attemptCount: execution.attemptCount + 1,
            errorMessage: null,
          },
        });
      }

      // 3. Atomically Generate Invoice & Advance Subscription Next Billing Date
      const invoice = await prisma.$transaction(async (tx) => {
        const inv = await generateInvoiceForSubscription(
          sub.id,
          {
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            invoiceDate: new Date(),
            initialStatus: 'CONFIRMED',
          },
          tx
        );

        const nextDate = calculateNextBillingDate(periodStart, sub.billingCycle);

        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            lastBillingDate: periodStart,
            nextBillingDate: nextDate,
          },
        });

        await tx.billingExecution.update({
          where: { id: execution.id },
          data: {
            invoiceId: inv.id,
            status: 'SUCCESS',
            errorMessage: null,
          },
        });

        return inv;
      });

      results.successful += 1;
      results.details.push({
        subscriptionNumber: sub.subscriptionNumber,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        status: 'SUCCESS',
      });
      console.log(`✅ [BILLING ENGINE] Sub ${sub.subscriptionNumber} billed -> Invoice ${invoice.invoiceNumber}`);
    } catch (err) {
      results.failed += 1;
      console.error(`❌ [BILLING ENGINE] Error billing Sub ${sub.subscriptionNumber}:`, err.message);

      // Record failure on BillingExecution record
      try {
        await prisma.billingExecution.upsert({
          where: {
            subscriptionId_billingPeriodStart_billingPeriodEnd: {
              subscriptionId: sub.id,
              billingPeriodStart: periodStart,
              billingPeriodEnd: periodEnd,
            },
          },
          update: {
            status: 'FAILED',
            errorMessage: err.message,
          },
          create: {
            subscriptionId: sub.id,
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            status: 'FAILED',
            errorMessage: err.message,
          },
        });
      } catch (upsertErr) {
        console.error('Failed to update billing execution log:', upsertErr.message);
      }

      results.details.push({
        subscriptionNumber: sub.subscriptionNumber,
        status: 'FAILED',
        error: err.message,
      });
    }
  }

  console.log(`🏁 [BILLING ENGINE] Run finished: ${results.successful} succeeded, ${results.failed} failed, ${results.skipped} skipped.`);
  return results;
}

async function listExecutions(query = {}) {
  const { status, subscriptionId, page = 1, limit = 20 } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};
  if (status) where.status = status;
  if (subscriptionId) where.subscriptionId = Number(subscriptionId);

  const [total, items] = await Promise.all([
    prisma.billingExecution.count({ where }),
    prisma.billingExecution.findMany({
      where,
      skip,
      take,
      orderBy: { executedAt: 'desc' },
      include: {
        subscription: {
          select: {
            id: true,
            subscriptionNumber: true,
            billingCycle: true,
            customer: { select: { companyName: true } },
          },
        },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true } },
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

module.exports = {
  runRecurringBilling,
  listExecutions,
};

