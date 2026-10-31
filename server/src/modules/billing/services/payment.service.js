// server/src/modules/billing/services/payment.service.js
const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const decimal = require('../../../utils/decimal');
const { generatePaymentReference } = require('../../../utils/sequence');
const { calculateInvoiceBalance } = require('./invoice.service');

async function listPayments(query = {}, user = null) {
  const { customerId, status, paymentMethod, provider, page = 1, limit = 20 } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};

  if (user && user.role === 'CUSTOMER') {
    where.customerId = Number(user.customerId);
  } else if (customerId) {
    where.customerId = Number(customerId);
  }

  if (status) where.status = status;
  if (paymentMethod) where.paymentMethod = paymentMethod;
  if (provider) where.provider = provider;

  const [total, items] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, companyName: true, email: true } },
        createdBy: { select: { id: true, fullName: true, role: true } },
        allocations: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true } },
          },
        },
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

async function getPaymentById(id, user = null) {
  const payment = await prisma.payment.findUnique({
    where: { id: Number(id) },
    include: {
      customer: true,
      createdBy: { select: { id: true, fullName: true, email: true } },
      allocations: {
        include: {
          invoice: true,
        },
      },
      gatewayEvents: {
        orderBy: { receivedAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!payment) {
    throw ApiError.notFound(`Payment with ID ${id} not found`);
  }

  if (user && user.role === 'CUSTOMER' && payment.customerId !== user.customerId) {
    throw ApiError.forbidden('Access denied: You do not have permission to view this payment');
  }

  return payment;
}

/**
 * Record a manual / offline payment with optional invoice allocations in a transaction.
 */
async function recordPayment(data, user) {
  const {
    customerId,
    amount,
    paymentMethod = 'BANK_TRANSFER',
    transactionReference,
    paymentDate,
    note,
    allocations = [],
    provider = null,
    providerOrderId = null,
    providerPaymentId = null,
    status = 'SUCCEEDED',
  } = data;

  const customer = await prisma.customer.findUnique({ where: { id: Number(customerId) } });
  if (!customer) throw ApiError.notFound(`Customer ${customerId} not found`);

  const paymentAmount = decimal.toDecimal(amount);
  if (paymentAmount.lessThanOrEqualTo(decimal.ZERO)) {
    throw ApiError.badRequest('Payment amount must be greater than zero');
  }

  // Validate allocations sum does not exceed total payment amount
  let totalAllocated = decimal.ZERO;
  for (const alloc of allocations) {
    totalAllocated = decimal.add(totalAllocated, alloc.allocatedAmount);
  }

  if (totalAllocated.greaterThan(paymentAmount)) {
    throw ApiError.badRequest(
      `Sum of allocations (₹${decimal.format(totalAllocated)}) cannot exceed total payment amount (₹${decimal.format(paymentAmount)})`
    );
  }

  const paymentReference = await generatePaymentReference();

  // Execute in database transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Payment record
    const payment = await tx.payment.create({
      data: {
        paymentReference,
        customerId: Number(customerId),
        amount: paymentAmount,
        currency: 'INR',
        paymentMethod,
        status,
        provider,
        providerOrderId,
        providerPaymentId,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        transactionReference,
        note,
        createdById: user ? Number(user.id) : null,
      },
    });

    // 2. Process Allocations & Update Invoices
    for (const alloc of allocations) {
      const inv = await tx.invoice.findUnique({
        where: { id: Number(alloc.invoiceId) },
        include: {
          paymentAllocations: {
            include: { payment: true },
          },
        },
      });

      if (!inv) throw ApiError.notFound(`Invoice ${alloc.invoiceId} not found`);

      if (inv.status === 'CANCELLED') {
        throw ApiError.badRequest(`Cannot allocate payment to CANCELLED invoice ${inv.invoiceNumber}`);
      }

      // Calculate existing paid balance
      let currentPaid = decimal.ZERO;
      for (const pa of inv.paymentAllocations) {
        if (pa.payment && pa.payment.status === 'SUCCEEDED') {
          currentPaid = decimal.add(currentPaid, pa.allocatedAmount);
        }
      }

      const outstanding = decimal.clampPositive(decimal.subtract(inv.totalAmount, currentPaid));
      const allocAmount = decimal.toDecimal(alloc.allocatedAmount);

      if (allocAmount.greaterThan(outstanding)) {
        throw ApiError.badRequest(
          `Allocation of ₹${decimal.format(allocAmount)} exceeds outstanding balance of ₹${decimal.format(outstanding)} on Invoice ${inv.invoiceNumber}`
        );
      }

      // Create allocation record
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: inv.id,
          allocatedAmount: allocAmount,
        },
      });

      // Update invoice status based on new balance
      const newPaid = decimal.add(currentPaid, allocAmount);
      const remaining = decimal.subtract(inv.totalAmount, newPaid);
      const newStatus = remaining.isZero() ? 'PAID' : 'PARTIALLY_PAID';

      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: newStatus },
      });
    }

    return payment;
  });

  return getPaymentById(result.id, user);
}

/**
 * Allocate unallocated portion of an existing payment to invoices.
 */
async function allocatePayment(paymentId, allocations, user) {
  const payment = await prisma.payment.findUnique({
    where: { id: Number(paymentId) },
    include: { allocations: true },
  });

  if (!payment) throw ApiError.notFound(`Payment ${paymentId} not found`);
  if (payment.status !== 'SUCCEEDED') {
    throw ApiError.badRequest(`Cannot allocate payment in '${payment.status}' status. Only SUCCEEDED payments can be allocated.`);
  }

  let alreadyAllocated = decimal.ZERO;
  payment.allocations.forEach((a) => {
    alreadyAllocated = decimal.add(alreadyAllocated, a.allocatedAmount);
  });

  const available = decimal.clampPositive(decimal.subtract(payment.amount, alreadyAllocated));

  let newAllocationTotal = decimal.ZERO;
  allocations.forEach((a) => {
    newAllocationTotal = decimal.add(newAllocationTotal, a.allocatedAmount);
  });

  if (newAllocationTotal.greaterThan(available)) {
    throw ApiError.badRequest(
      `New allocations (₹${decimal.format(newAllocationTotal)}) exceed available payment balance (₹${decimal.format(available)})`
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const alloc of allocations) {
      const inv = await tx.invoice.findUnique({
        where: { id: Number(alloc.invoiceId) },
        include: { paymentAllocations: { include: { payment: true } } },
      });

      if (!inv) throw ApiError.notFound(`Invoice ${alloc.invoiceId} not found`);

      const balances = await calculateInvoiceBalance(inv.id, tx);
      const allocAmount = decimal.toDecimal(alloc.allocatedAmount);

      if (allocAmount.greaterThan(balances.outstandingAmount)) {
        throw ApiError.badRequest(
          `Allocation of ₹${decimal.format(allocAmount)} exceeds invoice balance of ₹${decimal.format(balances.outstandingAmount)}`
        );
      }

      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: inv.id,
          allocatedAmount: allocAmount,
        },
      });

      const updatedRemaining = decimal.subtract(balances.outstandingAmount, allocAmount);
      const newStatus = updatedRemaining.isZero() ? 'PAID' : 'PARTIALLY_PAID';

      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: newStatus },
      });
    }
  });

  return getPaymentById(paymentId, user);
}

module.exports = {
  listPayments,
  getPaymentById,
  recordPayment,
  allocatePayment,
};

