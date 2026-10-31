// server/src/modules/billing/services/webhook.service.js
const prisma = require('../../../config/prisma');
const { verifyWebhookSignature, isConfigured } = require('../../../config/razorpay');
const { calculateInvoiceBalance } = require('./invoice.service');
const decimal = require('../../../utils/decimal');

async function processGatewayWebhook(rawBody, signature, eventData) {
  // 1. Verify signature if configured
  if (isConfigured && signature) {
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn('⚠️ Webhook signature mismatch rejected');
      return { status: 'IGNORED', message: 'Signature verification failed' };
    }
  }

  const eventId = eventData.id || `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const eventType = eventData.event || 'payment.captured';

  // 2. Check for duplicate event (Idempotency)
  const existing = await prisma.paymentGatewayEvent.findUnique({
    where: { providerEventId: eventId },
  });

  if (existing) {
    console.log(`⏭️ [WEBHOOK] Duplicate event ${eventId} already received. Skipping.`);
    return { status: 'DUPLICATE', message: 'Duplicate event ignored' };
  }

  // 3. Record Event
  const gatewayEvent = await prisma.paymentGatewayEvent.create({
    data: {
      provider: 'RAZORPAY',
      providerEventId: eventId,
      eventType,
      status: 'RECEIVED',
      payload: eventData,
    },
  });

  // 4. Process event business logic
  try {
    if (eventType === 'payment.captured') {
      const paymentEntity = eventData.payload?.payment?.entity;
      if (paymentEntity) {
        const orderId = paymentEntity.order_id;
        const paymentId = paymentEntity.id;

        if (orderId) {
          const payment = await prisma.payment.findUnique({
            where: { providerOrderId: orderId },
            include: { allocations: true },
          });

          if (payment) {
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: 'SUCCEEDED',
                providerPaymentId: paymentId,
                paymentDate: new Date(),
              },
            });

            // If payment has an allocation, update invoice status
            if (payment.allocations && payment.allocations.length > 0) {
              for (const alloc of payment.allocations) {
                const balances = await calculateInvoiceBalance(alloc.invoiceId);
                if (balances) {
                  const newStatus = balances.outstandingAmount.isZero() ? 'PAID' : 'PARTIALLY_PAID';
                  await prisma.invoice.update({
                    where: { id: alloc.invoiceId },
                    data: { status: newStatus },
                  });
                }
              }
            }
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = eventData.payload?.payment?.entity;
      if (paymentEntity && paymentEntity.order_id) {
        await prisma.payment.updateMany({
          where: { providerOrderId: paymentEntity.order_id },
          data: { status: 'FAILED' },
        });
      }
    }

    // Mark event as PROCESSED
    await prisma.paymentGatewayEvent.update({
      where: { id: gatewayEvent.id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    return { status: 'PROCESSED', eventId };
  } catch (err) {
    console.error('❌ Error processing webhook event:', err);
    await prisma.paymentGatewayEvent.update({
      where: { id: gatewayEvent.id },
      data: {
        status: 'FAILED',
        processedAt: new Date(),
      },
    });
    return { status: 'FAILED', error: err.message };
  }
}

module.exports = {
  processGatewayWebhook,
};

