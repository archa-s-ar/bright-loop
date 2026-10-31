// server/src/modules/quotations/services/quotation.service.js
const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const decimal = require('../../../utils/decimal');
const { generateQuotationNumber } = require('../../../utils/sequence');
const pricingService = require('../../catalog/services/pricing.service');
const taxService = require('../../catalog/services/tax.service');
const discountService = require('../../catalog/services/discount.service');

async function listQuotations(query = {}, user = null) {
  const { customerId, status, search, page = 1, limit = 20 } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};

  // Enforce customer organization data isolation
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
      { quotationNumber: { contains: search } },
      { customer: { companyName: { contains: search } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.quotation.count({ where }),
    prisma.quotation.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, companyName: true, email: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        template: { select: { id: true, name: true } },
        subscription: { select: { id: true, subscriptionNumber: true, status: true } },
        _count: { select: { lines: true } },
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

async function getQuotationById(id, user = null) {
  const quote = await prisma.quotation.findUnique({
    where: { id: Number(id) },
    include: {
      customer: true,
      createdBy: { select: { id: true, fullName: true, email: true } },
      template: true,
      subscription: {
        select: { id: true, subscriptionNumber: true, status: true, startDate: true, nextBillingDate: true },
      },
      lines: {
        include: {
          product: { select: { id: true, name: true, productType: true } },
          variant: { select: { id: true, attributeName: true, attributeValue: true, priceDelta: true } },
        },
      },
    },
  });

  if (!quote) {
    throw ApiError.notFound(`Quotation with ID ${id} not found`);
  }

  // Tenant security guard
  if (user && user.role === 'CUSTOMER' && quote.customerId !== user.customerId) {
    throw ApiError.forbidden('Access denied: You do not have permission to view this quotation');
  }

  return quote;
}

async function createQuotation(data, user) {
  const { customerId, planId, templateId, quotationDate, validityDays = 30, discountName, lines = [] } = data;

  // 1. Verify customer
  const customer = await prisma.customer.findUnique({ where: { id: Number(customerId) } });
  if (!customer) throw ApiError.notFound(`Customer with ID ${customerId} not found`);

  // 2. Verify plan
  const plan = await prisma.plan.findUnique({
    where: { id: Number(planId) },
    include: { planProducts: { include: { product: true } } },
  });
  if (!plan) throw ApiError.notFound(`Plan with ID ${planId} not found`);

  // 3. Resolve line items (merge template lines if provided)
  let resolvedLines = [...lines];
  if (resolvedLines.length === 0 && templateId) {
    const template = await prisma.quotationTemplate.findUnique({
      where: { id: Number(templateId) },
      include: { lines: true },
    });
    if (template && template.lines.length > 0) {
      resolvedLines = template.lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
      }));
    }
  }

  // If still empty and plan has planProducts, populate from planProducts
  if (resolvedLines.length === 0 && plan.planProducts.length > 0) {
    resolvedLines = plan.planProducts.map((pp) => ({
      productId: pp.productId,
      quantity: pp.quantity,
      unitPrice: pp.unitPriceOverride ? Number(pp.unitPriceOverride) : Number(pp.product.salesPrice),
    }));
  }

  // Fallback: If plan is FIXED and no products defined, create a default line representing the plan
  if (resolvedLines.length === 0) {
    resolvedLines = [
      {
        description: `${plan.name} (${plan.billingCycle})`,
        quantity: 1,
        unitPrice: Number(plan.planPrice),
      },
    ];
  }

  // 4. Calculate line pricing, taxes, and subtotal safely using Decimal
  const qDate = quotationDate ? new Date(quotationDate) : new Date();
  const expDate = new Date(qDate);
  expDate.setDate(expDate.getDate() + (Number(validityDays) || 30));

  let subtotal = decimal.ZERO;
  let taxTotal = decimal.ZERO;
  let computedLines = [];

  for (const line of resolvedLines) {
    let unitPrice = line.unitPrice !== undefined ? decimal.toDecimal(line.unitPrice) : decimal.ZERO;
    let description = line.description || '';
    let variantDelta = decimal.ZERO;

    if (line.productId) {
      const prod = await prisma.product.findUnique({ where: { id: Number(line.productId) } });
      if (prod) {
        if (!line.description) description = prod.name;
        if (line.unitPrice === undefined) unitPrice = decimal.toDecimal(prod.salesPrice);
      }
    }

    if (line.variantId) {
      const v = await prisma.productVariant.findUnique({ where: { id: Number(line.variantId) } });
      if (v) {
        variantDelta = decimal.toDecimal(v.priceDelta);
        description += ` (${v.attributeName}: ${v.attributeValue})`;
      }
    }

    const effectiveUnitPrice = decimal.add(unitPrice, variantDelta);
    const quantity = Number(line.quantity) || 1;
    const lineSubtotal = decimal.multiply(quantity, effectiveUnitPrice);

    // Compute line tax via Member 2 Tax Service if product has tax rules
    let lineTaxAmount = decimal.ZERO;
    if (line.productId) {
      try {
        const taxRes = await taxService.calculateProductTaxes(line.productId, lineSubtotal, qDate);
        lineTaxAmount = decimal.toDecimal(taxRes.totalTaxAmount);
      } catch (err) {
        lineTaxAmount = decimal.ZERO;
      }
    }

    const lineTotal = decimal.add(lineSubtotal, lineTaxAmount);
    subtotal = decimal.add(subtotal, lineSubtotal);
    taxTotal = decimal.add(taxTotal, lineTaxAmount);

    computedLines.push({
      productId: line.productId ? Number(line.productId) : null,
      variantId: line.variantId ? Number(line.variantId) : null,
      descriptionSnapshot: description || 'Subscription Plan Item',
      quantity,
      unitPrice: effectiveUnitPrice,
      discountAmount: decimal.ZERO,
      taxAmount: lineTaxAmount,
      lineTotal,
    });
  }

  // 5. Apply Promo / Discount code via Member 2 Discount Service if present
  let discountTotal = decimal.ZERO;
  if (discountName) {
    try {
      const discRes = await discountService.validateDiscountEligibility({
        discountName,
        customerId: Number(customerId),
        orderSubtotal: subtotal,
        items: computedLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });

      if (discRes.isValid) {
        discountTotal = decimal.toDecimal(discRes.discountAmount);
      }
    } catch (err) {
      // Ignore or log invalid promo code
    }
  }

  // Total = (Subtotal - Discount) + Tax
  const discountedSubtotal = decimal.clampPositive(decimal.subtract(subtotal, discountTotal));
  const totalAmount = decimal.add(discountedSubtotal, taxTotal);

  const quotationNumber = await generateQuotationNumber();

  // 6. Persist Quotation & Lines in a Transaction
  const quotation = await prisma.$transaction(async (tx) => {
    return tx.quotation.create({
      data: {
        quotationNumber,
        customerId: Number(customerId),
        templateId: templateId ? Number(templateId) : null,
        createdById: user ? Number(user.id) : 1,
        status: 'DRAFT',
        quotationDate: qDate,
        expiryDate: expDate,
        currency: 'INR',
        subtotal,
        discountTotal,
        taxTotal,
        totalAmount,
        lines: {
          create: computedLines,
        },
      },
      include: {
        customer: true,
        lines: true,
      },
    });
  });

  return quotation;
}

async function transitionStatus(id, targetStatus, user, options = {}) {
  const quote = await getQuotationById(id, user);

  // Validate Allowed State Transitions
  const allowed = {
    DRAFT: ['SENT'],
    SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
    ACCEPTED: ['CONVERTED', 'REJECTED'],
    REJECTED: [],
    EXPIRED: [],
    CONVERTED: [],
  };

  if (!allowed[quote.status] || !allowed[quote.status].includes(targetStatus)) {
    throw ApiError.badRequest(
      `Cannot transition quotation from '${quote.status}' to '${targetStatus}'. Allowed: [${(allowed[quote.status] || []).join(', ')}]`
    );
  }

  // Check expiration guard
  if (targetStatus === 'ACCEPTED' && new Date(quote.expiryDate) < new Date()) {
    throw ApiError.badRequest(`Quotation ${quote.quotationNumber} expired on ${quote.expiryDate.toISOString().split('T')[0]} and cannot be accepted`);
  }

  const updated = await prisma.quotation.update({
    where: { id: Number(id) },
    data: { status: targetStatus },
    include: { customer: true, lines: true },
  });

  return updated;
}

module.exports = {
  listQuotations,
  getQuotationById,
  createQuotation,
  transitionStatus,
};

