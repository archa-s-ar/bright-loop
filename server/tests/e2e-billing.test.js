// server/tests/e2e-billing.test.js
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/config/prisma');
const quotationService = require('../src/modules/quotations/services/quotation.service');
const { convertQuotationToSubscription } = require('../src/modules/quotations/services/quotation-converter.service');
const subscriptionService = require('../src/modules/subscriptions/services/subscription.service');
const invoiceService = require('../src/modules/billing/services/invoice.service');
const paymentService = require('../src/modules/billing/services/payment.service');
const analyticsService = require('../src/modules/analytics/services/analytics.service');

describe('Module 3 & 4: End-to-End Database Integration Suite', () => {
  let testCustomer;
  let testUser;
  let testPlan;
  let testProduct;
  let createdQuotation;
  let createdSubscription;
  let createdInvoice;

  before(async () => {
    // 1. Setup Test Customer
    testCustomer = await prisma.customer.create({
      data: {
        companyName: `E2E Test Corp ${Date.now()}`,
        email: `billing_test_${Date.now()}@example.com`,
        phone: '9876543210',
        billingAddress: '42 Tech Park, Bengaluru, KA',
        taxRegistrationNumber: '29ABCDE1234F1Z5',
      },
    });

    // 2. Setup Test User
    testUser = await prisma.user.create({
      data: {
        customerId: testCustomer.id,
        fullName: 'Billing Test Admin',
        email: `admin_${Date.now()}@example.com`,
        passwordHash: 'hashed_password_mock',
        role: 'ADMIN',
      },
    });

    // 3. Setup Test Product
    testProduct = await prisma.product.create({
      data: {
        name: 'Enterprise Cloud Addon',
        productType: 'SOFTWARE',
        salesPrice: 2000.00,
        costPrice: 500.00,
      },
    });

    // 4. Setup Test Subscription Plan
    testPlan = await prisma.plan.create({
      data: {
        name: 'Gold Enterprise Plan',
        pricingMode: 'FIXED',
        planPrice: 9999.00,
        billingCycle: 'MONTHLY',
        availableFrom: new Date(),
        status: 'ACTIVE',
      },
    });
  });

  after(async () => {
    // Clean up created test data safely
    try {
      if (createdInvoice) {
        await prisma.paymentAllocation.deleteMany({ where: { invoiceId: createdInvoice.id } });
        await prisma.invoiceLineTax.deleteMany({ where: { invoiceLine: { invoiceId: createdInvoice.id } } });
        await prisma.invoiceLine.deleteMany({ where: { invoiceId: createdInvoice.id } });
        await prisma.billingExecution.deleteMany({ where: { invoiceId: createdInvoice.id } });
        await prisma.invoice.delete({ where: { id: createdInvoice.id } });
      }
      if (createdSubscription) {
        await prisma.subscriptionHistory.deleteMany({ where: { subscriptionId: createdSubscription.id } });
        await prisma.subscriptionLine.deleteMany({ where: { subscriptionId: createdSubscription.id } });
        await prisma.billingExecution.deleteMany({ where: { subscriptionId: createdSubscription.id } });
        await prisma.subscription.delete({ where: { id: createdSubscription.id } });
      }
      if (createdQuotation) {
        await prisma.quotationLine.deleteMany({ where: { quotationId: createdQuotation.id } });
        await prisma.quotation.delete({ where: { id: createdQuotation.id } });
      }
      if (testProduct) {
        await prisma.product.delete({ where: { id: testProduct.id } });
      }
      if (testPlan) {
        await prisma.plan.delete({ where: { id: testPlan.id } });
      }
      if (testUser) {
        await prisma.user.delete({ where: { id: testUser.id } });
      }
      if (testCustomer) {
        await prisma.payment.deleteMany({ where: { customerId: testCustomer.id } });
        await prisma.customer.delete({ where: { id: testCustomer.id } });
      }
    } catch (err) {
      console.warn('Cleanup note:', err.message);
    }
  });

  it('Step 1: Should create a quotation with itemized & fixed plan items', async () => {
    createdQuotation = await quotationService.createQuotation(
      {
        customerId: testCustomer.id,
        planId: testPlan.id,
        validityDays: 15,
        lines: [
          {
            productId: testProduct.id,
            quantity: 2,
            unitPrice: 2000.00,
          },
        ],
      },
      testUser
    );

    assert.ok(createdQuotation.id);
    assert.match(createdQuotation.quotationNumber, /^QUO-\d{6}-\d{4}$/);
    assert.equal(createdQuotation.status, 'DRAFT');
    assert.equal(Number(createdQuotation.subtotal), 4000.00);
  });

  it('Step 2: Should transition quotation DRAFT -> SENT -> ACCEPTED', async () => {
    const sent = await quotationService.transitionStatus(createdQuotation.id, 'SENT', testUser);
    assert.equal(sent.status, 'SENT');

    const accepted = await quotationService.transitionStatus(createdQuotation.id, 'ACCEPTED', testUser);
    assert.equal(accepted.status, 'ACCEPTED');
  });

  it('Step 3: Should convert ACCEPTED quotation to active Subscription', async () => {
    createdSubscription = await convertQuotationToSubscription(
      createdQuotation.id,
      testUser,
      {
        planId: testPlan.id,
        billingCycle: 'MONTHLY',
        startDate: new Date(),
      }
    );

    assert.ok(createdSubscription.id);
    assert.match(createdSubscription.subscriptionNumber, /^SUB-\d{6}-\d{4}$/);
    assert.equal(createdSubscription.status, 'ACTIVE');

    // Verify quotation is marked CONVERTED
    const refetchedQuote = await quotationService.getQuotationById(createdQuotation.id);
    assert.equal(refetchedQuote.status, 'CONVERTED');

    // Verify history log was created
    const history = await prisma.subscriptionHistory.findFirst({
      where: { subscriptionId: createdSubscription.id },
    });
    assert.ok(history);
    assert.equal(history.newStatus, 'ACTIVE');
  });

  it('Step 4: Should generate an invoice from the active subscription', async () => {
    createdInvoice = await invoiceService.generateInvoiceForSubscription(
      createdSubscription.id,
      { initialStatus: 'CONFIRMED' }
    );

    assert.ok(createdInvoice.id);
    assert.match(createdInvoice.invoiceNumber, /^INV-\d{6}-\d{4}$/);
    assert.equal(createdInvoice.status, 'CONFIRMED');
    assert.equal(Number(createdInvoice.totalAmount), 9999.00); // Fixed plan price billed
  });

  it('Step 5: Should reject duplicate invoice for the same subscription period (Idempotency)', async () => {
    const duplicate = await invoiceService.generateInvoiceForSubscription(
      createdSubscription.id,
      {
        billingPeriodStart: createdInvoice.billingPeriodStart,
        billingPeriodEnd: createdInvoice.billingPeriodEnd,
      }
    );

    // Returns the exact same invoice without creating a duplicate record
    assert.equal(duplicate.id, createdInvoice.id);
    assert.equal(duplicate.invoiceNumber, createdInvoice.invoiceNumber);
  });

  it('Step 6: Should record partial payment and update invoice to PARTIALLY_PAID', async () => {
    const payment = await paymentService.recordPayment(
      {
        customerId: testCustomer.id,
        amount: 4999.00,
        paymentMethod: 'UPI',
        allocations: [
          {
            invoiceId: createdInvoice.id,
            allocatedAmount: 4999.00,
          },
        ],
      },
      testUser
    );

    assert.ok(payment.id);
    assert.equal(payment.status, 'SUCCEEDED');

    // Verify invoice status updated to PARTIALLY_PAID
    const invoice = await invoiceService.getInvoiceById(createdInvoice.id);
    assert.equal(invoice.status, 'PARTIALLY_PAID');
    assert.equal(invoice.paidAmount, '4999.00');
    assert.equal(invoice.outstandingAmount, '5000.00');
  });

  it('Step 7: Should allocate remaining balance and mark invoice as PAID', async () => {
    const payment = await paymentService.recordPayment(
      {
        customerId: testCustomer.id,
        amount: 5000.00,
        paymentMethod: 'BANK_TRANSFER',
        allocations: [
          {
            invoiceId: createdInvoice.id,
            allocatedAmount: 5000.00,
          },
        ],
      },
      testUser
    );

    assert.ok(payment.id);

    // Verify invoice status is now PAID
    const invoice = await invoiceService.getInvoiceById(createdInvoice.id);
    assert.equal(invoice.status, 'PAID');
    assert.equal(invoice.paidAmount, '9999.00');
    assert.equal(invoice.outstandingAmount, '0.00');
  });

  it('Step 8: Financial Overview should accurately aggregate revenue and MRR', async () => {
    const overview = await analyticsService.getFinancialOverview();

    assert.ok(Number(overview.invoicedRevenue) > 0);
    assert.ok(Number(overview.cashCollected) > 0);
    assert.ok(Number(overview.mrr) > 0);
    assert.ok(overview.activeSubscriptionsCount >= 1);
  });
});

