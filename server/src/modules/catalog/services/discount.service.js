// src/modules/catalog/services/discount.service.js
const prisma = require('../../../config/prisma');
const decimal = require('../../../utils/decimal');

/**
 * List discounts with redemptions count and optional filters.
 */
async function listDiscounts({ isActive, scope } = {}) {
  const where = {};
  if (isActive !== undefined) {
    where.isActive = isActive === 'true' || isActive === true;
  }
  if (scope) {
    where.scope = scope;
  }

  return prisma.discount.findMany({
    where,
    include: {
      discountProducts: {
        include: {
          product: {
            select: { id: true, name: true, salesPrice: true }
          }
        }
      },
      _count: {
        select: {
          redemptions: true,
          subscriptionDiscounts: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Get discount details by ID.
 */
async function getDiscountById(id) {
  return prisma.discount.findUnique({
    where: { id: Number(id) },
    include: {
      discountProducts: {
        include: {
          product: true
        }
      },
      _count: {
        select: {
          redemptions: true,
          subscriptionDiscounts: true
        }
      }
    }
  });
}

/**
 * Create a new discount.
 */
async function createDiscount(data) {
  const { productIds, ...discountData } = data;

  return prisma.$transaction(async (tx) => {
    const createdDiscount = await tx.discount.create({
      data: {
        name: discountData.name.trim(),
        description: discountData.description ?? null,
        discountType: discountData.discountType,
        discountValue: decimal.toDecimal(discountData.discountValue),
        minimumPurchase: decimal.toDecimal(discountData.minimumPurchase ?? 0),
        minimumQuantity: Number(discountData.minimumQuantity ?? 0),
        usageLimit: discountData.usageLimit ? Number(discountData.usageLimit) : null,
        startsAt: new Date(discountData.startsAt),
        endsAt: discountData.endsAt ? new Date(discountData.endsAt) : null,
        scope: discountData.scope,
        isActive: discountData.isActive ?? true
      }
    });

    if (discountData.scope === 'PRODUCT' && productIds && productIds.length > 0) {
      await tx.discountProduct.createMany({
        data: productIds.map(productId => ({
          discountId: createdDiscount.id,
          productId: Number(productId)
        }))
      });
    }

    return tx.discount.findUnique({
      where: { id: createdDiscount.id },
      include: {
        discountProducts: {
          include: { product: true }
        }
      }
    });
  });
}

/**
 * Update an existing discount.
 */
async function updateDiscount(id, data) {
  const { productIds, ...discountData } = data;
  const discountId = Number(id);

  const updateData = {};
  if (discountData.name !== undefined) updateData.name = discountData.name.trim();
  if (discountData.description !== undefined) updateData.description = discountData.description;
  if (discountData.discountType !== undefined) updateData.discountType = discountData.discountType;
  if (discountData.discountValue !== undefined) updateData.discountValue = decimal.toDecimal(discountData.discountValue);
  if (discountData.minimumPurchase !== undefined) updateData.minimumPurchase = decimal.toDecimal(discountData.minimumPurchase);
  if (discountData.minimumQuantity !== undefined) updateData.minimumQuantity = Number(discountData.minimumQuantity);
  if (discountData.usageLimit !== undefined) updateData.usageLimit = discountData.usageLimit ? Number(discountData.usageLimit) : null;
  if (discountData.startsAt !== undefined) updateData.startsAt = new Date(discountData.startsAt);
  if (discountData.endsAt !== undefined) updateData.endsAt = discountData.endsAt ? new Date(discountData.endsAt) : null;
  if (discountData.scope !== undefined) updateData.scope = discountData.scope;
  if (discountData.isActive !== undefined) updateData.isActive = discountData.isActive;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.discount.update({
      where: { id: discountId },
      data: updateData
    });

    // If productIds provided for PRODUCT scope, update relations
    if (productIds !== undefined) {
      await tx.discountProduct.deleteMany({ where: { discountId } });
      if (productIds.length > 0) {
        await tx.discountProduct.createMany({
          data: productIds.map(productId => ({
            discountId,
            productId: Number(productId)
          }))
        });
      }
    }

    return tx.discount.findUnique({
      where: { id: discountId },
      include: {
        discountProducts: {
          include: { product: true }
        }
      }
    });
  });
}

/**
 * Toggle discount active status.
 */
async function setDiscountStatus(id, isActive) {
  return prisma.discount.update({
    where: { id: Number(id) },
    data: { isActive }
  });
}

/**
 * Validate discount eligibility and compute discount amount.
 * Reusable for Member 3 (Quotations) and Member 4 (Billing).
 * 
 * @param {Object} params
 * @param {string} params.discountName Discount promo code / name
 * @param {number} [params.customerId] Customer ID
 * @param {number|string|Decimal} params.orderSubtotal Current total before discount
 * @param {Array<{ productId: number, quantity: number, unitPrice: number }>} [params.items]
 * @param {Date} [params.currentDate]
 */
async function validateDiscountEligibility({ discountName, customerId, orderSubtotal, items = [], currentDate = new Date() }) {
  const subtotal = decimal.toDecimal(orderSubtotal);

  // Look up discount by name (case-insensitive)
  const discount = await prisma.discount.findFirst({
    where: {
      name: discountName.trim(),
      isActive: true
    },
    include: {
      discountProducts: true,
      _count: {
        select: { redemptions: true }
      }
    }
  });

  if (!discount) {
    return {
      isValid: false,
      message: `Discount code '${discountName}' is invalid or inactive.`
    };
  }

  // 1. Date window check
  if (discount.startsAt && currentDate < new Date(discount.startsAt)) {
    return {
      isValid: false,
      message: `Discount '${discount.name}' has not started yet.`
    };
  }

  if (discount.endsAt && currentDate > new Date(discount.endsAt)) {
    return {
      isValid: false,
      message: `Discount '${discount.name}' has expired.`
    };
  }

  // 2. Usage limit check
  if (discount.usageLimit !== null && discount._count.redemptions >= discount.usageLimit) {
    return {
      isValid: false,
      message: `Discount '${discount.name}' has reached its maximum usage limit.`
    };
  }

  // 3. Scope and thresholds check
  let eligibleBaseAmount = decimal.ZERO;
  let totalEligibleQuantity = 0;

  if (discount.scope === 'PRODUCT') {
    const eligibleProductIds = new Set(discount.discountProducts.map(dp => dp.productId));

    if (eligibleProductIds.size > 0) {
      const eligibleItems = items.filter(it => eligibleProductIds.has(Number(it.productId)));

      if (eligibleItems.length === 0) {
        return {
          isValid: false,
          message: `Discount '${discount.name}' only applies to specific qualifying products not present in this order.`
        };
      }

      for (const item of eligibleItems) {
        const itemQty = Number(item.quantity) || 1;
        const itemPrice = decimal.toDecimal(item.unitPrice);
        totalEligibleQuantity += itemQty;
        eligibleBaseAmount = decimal.add(eligibleBaseAmount, decimal.multiply(itemQty, itemPrice));
      }
    } else {
      // PRODUCT scope but no specific products configured: applies to all order items
      for (const item of items) {
        const itemQty = Number(item.quantity) || 1;
        const itemPrice = decimal.toDecimal(item.unitPrice);
        totalEligibleQuantity += itemQty;
        eligibleBaseAmount = decimal.add(eligibleBaseAmount, decimal.multiply(itemQty, itemPrice));
      }
    }
  } else {
    // SUBSCRIPTION scope: applies to entire order subtotal
    eligibleBaseAmount = subtotal;
    totalEligibleQuantity = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
  }

  // 4. Minimum quantity check
  if (discount.minimumQuantity > 0 && totalEligibleQuantity < discount.minimumQuantity) {
    return {
      isValid: false,
      message: `Discount requires a minimum quantity of ${discount.minimumQuantity} qualifying items (found ${totalEligibleQuantity}).`
    };
  }

  // 5. Minimum purchase amount check
  if (discount.minimumPurchase && decimal.toDecimal(discount.minimumPurchase).greaterThan(decimal.ZERO)) {
    if (eligibleBaseAmount.lessThan(discount.minimumPurchase)) {
      return {
        isValid: false,
        message: `Discount requires a minimum qualifying purchase of ₹${decimal.format(discount.minimumPurchase)} (current eligible: ₹${decimal.format(eligibleBaseAmount)}).`
      };
    }
  }

  // 6. Calculate discount amount
  let calculatedDiscount = decimal.ZERO;

  if (discount.discountType === 'PERCENTAGE') {
    // discountAmount = eligibleBaseAmount * (discountValue / 100)
    const percentageFraction = decimal.divide(discount.discountValue, 100);
    calculatedDiscount = decimal.round2(decimal.multiply(eligibleBaseAmount, percentageFraction));
  } else {
    // FIXED amount discount
    calculatedDiscount = decimal.round2(discount.discountValue);
  }

  // Clamping: discount cannot exceed eligible base amount or order subtotal
  if (calculatedDiscount.greaterThan(eligibleBaseAmount)) {
    calculatedDiscount = eligibleBaseAmount;
  }
  if (calculatedDiscount.greaterThan(subtotal)) {
    calculatedDiscount = subtotal;
  }

  const effectiveSubtotal = decimal.clampPositive(decimal.subtract(subtotal, calculatedDiscount));

  return {
    isValid: true,
    discountId: discount.id,
    discountName: discount.name,
    discountType: discount.discountType,
    discountValue: discount.discountValue,
    scope: discount.scope,
    eligibleBaseAmount: decimal.format(eligibleBaseAmount),
    discountAmount: decimal.format(calculatedDiscount),
    effectiveSubtotal: decimal.format(effectiveSubtotal),
    message: `Discount '${discount.name}' applied successfully (-₹${decimal.format(calculatedDiscount)}).`
  };
}

module.exports = {
  listDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  setDiscountStatus,
  validateDiscountEligibility
};

