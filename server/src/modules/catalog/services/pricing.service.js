// src/modules/catalog/services/pricing.service.js
const prisma = require('../../../config/prisma');
const decimal = require('../../../utils/decimal');
const taxService = require('./tax.service');
const discountService = require('./discount.service');

/**
 * Calculate the unit price and line breakdown for a plan.
 * Reusable for Member 3 (Quotations & Subscriptions) and Member 4 (Billing).
 * 
 * STRICT RULES:
 * - FIXED: plan.planPrice represents the bundle price. Product entries describe inclusions.
 *   DO NOT add product prices again.
 * - ITEMIZED: calculate plan price by summing product lines: quantity * (unitPriceOverride ?? product.salesPrice).
 * - Never double-count planPrice and itemized prices.
 * - All calculations use Decimal-safe arithmetic.
 * 
 * @param {number} planId 
 * @returns {Promise<{ mode: string, planPrice: Decimal, totalUnitAmount: Decimal, lines: Array }>}
 */
async function calculatePlanPrice(planId) {
  const plan = await prisma.plan.findUnique({
    where: { id: Number(planId) },
    include: {
      planProducts: {
        include: {
          product: {
            include: {
              variants: { where: { isActive: true } },
              productTaxRules: { include: { taxRule: true } }
            }
          }
        }
      }
    }
  });

  if (!plan) {
    throw new Error(`Plan with ID ${planId} not found.`);
  }

  const lines = [];
  let computedItemizedTotal = decimal.ZERO;

  for (const pp of plan.planProducts) {
    const qty = pp.quantity;
    const baseProductPrice = pp.product.salesPrice;
    const unitPrice = pp.unitPriceOverride !== null && pp.unitPriceOverride !== undefined
      ? decimal.toDecimal(pp.unitPriceOverride)
      : decimal.toDecimal(baseProductPrice);

    const lineTotal = decimal.multiply(qty, unitPrice);
    computedItemizedTotal = decimal.add(computedItemizedTotal, lineTotal);

    lines.push({
      planProductId: pp.id,
      productId: pp.productId,
      productName: pp.product.name,
      productType: pp.product.productType,
      quantity: qty,
      baseSalesPrice: decimal.round2(baseProductPrice),
      unitPriceOverride: pp.unitPriceOverride ? decimal.round2(pp.unitPriceOverride) : null,
      effectiveUnitPrice: decimal.round2(unitPrice),
      lineTotal: decimal.round2(lineTotal),
      includedInFixedBundle: plan.pricingMode === 'FIXED'
    });
  }

  let totalUnitAmount = decimal.ZERO;

  if (plan.pricingMode === 'FIXED') {
    // FIXED: Only planPrice is charged. Included items are not added again.
    totalUnitAmount = decimal.round2(plan.planPrice);
  } else {
    // ITEMIZED: Sum of item lines.
    totalUnitAmount = decimal.round2(computedItemizedTotal);
  }

  return {
    planId: plan.id,
    planName: plan.name,
    billingCycle: plan.billingCycle,
    pricingMode: plan.pricingMode,
    configuredPlanPrice: decimal.round2(plan.planPrice),
    totalUnitAmount,
    lines
  };
}

/**
 * Calculate effective price for a product with an optional variant selection.
 * @param {number} productId 
 * @param {number} [variantId] 
 * @returns {Promise<{ productId: number, productName: string, variantId?: number, attribute?: string, basePrice: Decimal, priceDelta: Decimal, effectivePrice: Decimal }>}
 */
async function calculateProductWithVariantPrice(productId, variantId) {
  const product = await prisma.product.findUnique({
    where: { id: Number(productId) }
  });

  if (!product) {
    throw new Error(`Product with ID ${productId} not found.`);
  }

  let priceDelta = decimal.ZERO;
  let variant = null;

  if (variantId) {
    variant = await prisma.productVariant.findUnique({
      where: { id: Number(variantId) }
    });
    if (variant && variant.productId === product.id && variant.isActive) {
      priceDelta = decimal.toDecimal(variant.priceDelta);
    }
  }

  const effectivePrice = decimal.add(product.salesPrice, priceDelta);

  return {
    productId: product.id,
    productName: product.name,
    variantId: variant ? variant.id : null,
    variantAttribute: variant ? `${variant.attributeName}: ${variant.attributeValue}` : null,
    basePrice: decimal.round2(product.salesPrice),
    priceDelta: decimal.round2(priceDelta),
    effectivePrice: decimal.round2(effectivePrice)
  };
}

/**
 * Comprehensive pricing summary calculation.
 * Computes: Plan Subtotal + Variant Adjustments + Taxes - Discounts = Grand Total.
 * 
 * Reusable for Member 3 (Quotation creation) and Member 4 (Invoice preview).
 * 
 * @param {Object} params
 * @param {number} params.planId
 * @param {number} [params.quantity=1] Plan quantity / seats
 * @param {Array<{ productId: number, variantId: number }>} [params.variants]
 * @param {string} [params.discountName] Optional promo code
 * @param {number} [params.customerId]
 */
async function calculateSummary({ planId, quantity = 1, variants = [], discountName, customerId }) {
  const planPricing = await calculatePlanPrice(planId);
  const planQuantity = Math.max(1, Number(quantity) || 1);

  // Base plan price multiplied by quantity
  const planBaseTotal = decimal.multiply(planQuantity, planPricing.totalUnitAmount);

  // Variant price adjustments
  let totalVariantDeltas = decimal.ZERO;
  const variantBreakdown = [];

  for (const vSel of variants) {
    if (!vSel.variantId) continue;
    const variant = await prisma.productVariant.findUnique({
      where: { id: Number(vSel.variantId) },
      include: { product: true }
    });
    if (variant && variant.isActive) {
      const deltaForQty = decimal.multiply(planQuantity, variant.priceDelta);
      totalVariantDeltas = decimal.add(totalVariantDeltas, deltaForQty);

      variantBreakdown.push({
        productId: variant.productId,
        productName: variant.product.name,
        variantId: variant.id,
        attributeName: variant.attributeName,
        attributeValue: variant.attributeValue,
        priceDelta: decimal.round2(variant.priceDelta),
        totalDelta: decimal.round2(deltaForQty)
      });
    }
  }

  // Subtotal before discount and tax
  const subtotalBeforeDiscount = decimal.round2(decimal.add(planBaseTotal, totalVariantDeltas));

  // Items list for discount and tax calculations
  const orderItems = planPricing.lines.map(line => ({
    productId: line.productId,
    quantity: line.quantity * planQuantity,
    unitPrice: line.effectiveUnitPrice
  }));

  // Discount calculation
  let discountInfo = null;
  let discountAmount = decimal.ZERO;

  if (discountName) {
    const valResult = await discountService.validateDiscountEligibility({
      discountName,
      customerId,
      orderSubtotal: subtotalBeforeDiscount,
      items: orderItems
    });

    if (valResult.isValid) {
      discountAmount = decimal.toDecimal(valResult.discountAmount);
      discountInfo = valResult;
    } else {
      discountInfo = valResult;
    }
  }

  const discountedSubtotal = decimal.clampPositive(decimal.subtract(subtotalBeforeDiscount, discountAmount));

  // Tax calculation: compute taxes on included products
  // If plan is FIXED, distribute tax proportionally across lines, or calculate taxes for each product line
  const taxMap = new Map();
  let totalTaxAmount = decimal.ZERO;

  for (const line of planPricing.lines) {
    // Determine taxable base for this line
    let lineTaxableBase = decimal.ZERO;
    if (planPricing.pricingMode === 'ITEMIZED') {
      lineTaxableBase = decimal.multiply(line.quantity * planQuantity, line.effectiveUnitPrice);
    } else {
      // In FIXED mode, calculate proportional line amount based on product sales price ratio
      lineTaxableBase = decimal.multiply(line.quantity * planQuantity, line.effectiveUnitPrice);
    }

    const { taxes } = await taxService.calculateProductTaxes(line.productId, lineTaxableBase);

    for (const t of taxes) {
      const existing = taxMap.get(t.taxRuleId);
      if (existing) {
        existing.taxAmount = decimal.add(existing.taxAmount, t.taxAmount);
      } else {
        taxMap.set(t.taxRuleId, {
          taxRuleId: t.taxRuleId,
          taxName: t.taxName,
          taxRate: t.taxRate,
          taxAmount: t.taxAmount
        });
      }
      totalTaxAmount = decimal.add(totalTaxAmount, t.taxAmount);
    }
  }

  const taxList = Array.from(taxMap.values()).map(t => ({
    taxRuleId: t.taxRuleId,
    taxName: t.taxName,
    taxRate: decimal.format(decimal.multiply(t.taxRate, 100)) + '%',
    taxAmount: decimal.format(t.taxAmount)
  }));

  const grandTotal = decimal.round2(decimal.add(discountedSubtotal, totalTaxAmount));

  return {
    planId: planPricing.planId,
    planName: planPricing.planName,
    billingCycle: planPricing.billingCycle,
    pricingMode: planPricing.pricingMode,
    quantity: planQuantity,
    unitPrice: decimal.format(planPricing.totalUnitAmount),
    planBaseTotal: decimal.format(planBaseTotal),
    variantAdjustments: {
      total: decimal.format(totalVariantDeltas),
      items: variantBreakdown
    },
    subtotal: decimal.format(subtotalBeforeDiscount),
    discount: discountInfo ? {
      applied: discountInfo.isValid,
      discountName: discountInfo.discountName,
      discountAmount: decimal.format(discountAmount),
      message: discountInfo.message
    } : null,
    discountedSubtotal: decimal.format(discountedSubtotal),
    taxes: {
      items: taxList,
      totalTax: decimal.format(totalTaxAmount)
    },
    grandTotal: decimal.format(grandTotal),
    currency: 'INR'
  };
}

module.exports = {
  calculatePlanPrice,
  calculateProductWithVariantPrice,
  calculateSummary
};

