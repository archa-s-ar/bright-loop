// src/modules/catalog/services/plan.service.js
const prisma = require('../../../config/prisma');
const decimal = require('../../../utils/decimal');

/**
 * List subscription plans with optional filtering.
 */
async function listPlans({ billingCycle, status, pricingMode, role } = {}) {
  const where = {};

  // Role visibility: CUSTOMER or unauthenticated sees only ACTIVE plans
  if (role === 'CUSTOMER' || !role) {
    where.status = 'ACTIVE';
  } else if (status) {
    where.status = status;
  }

  if (billingCycle) where.billingCycle = billingCycle;
  if (pricingMode) where.pricingMode = pricingMode;

  return prisma.plan.findMany({
    where,
    include: {
      planProducts: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              productType: true,
              salesPrice: true,
              status: true
            }
          }
        }
      },
      _count: {
        select: {
          subscriptions: true,
          templates: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Get plan details by ID with products and pricing mode.
 */
async function getPlanById(id) {
  return prisma.plan.findUnique({
    where: { id: Number(id) },
    include: {
      planProducts: {
        include: {
          product: {
            include: {
              variants: {
                where: { isActive: true }
              },
              productTaxRules: {
                include: { taxRule: true }
              }
            }
          }
        }
      },
      _count: {
        select: {
          subscriptions: true,
          templates: true
        }
      }
    }
  });
}

/**
 * Create a new subscription plan with optional initial products.
 */
async function createPlan(data) {
  const { products, ...planData } = data;

  return prisma.$transaction(async (tx) => {
    const createdPlan = await tx.plan.create({
      data: {
        name: planData.name,
        description: planData.description ?? null,
        pricingMode: planData.pricingMode ?? 'FIXED',
        planPrice: decimal.toDecimal(planData.planPrice ?? 0),
        billingCycle: planData.billingCycle,
        minimumQuantity: planData.minimumQuantity ?? 1,
        availableFrom: new Date(planData.availableFrom),
        availableUntil: planData.availableUntil ? new Date(planData.availableUntil) : null,
        autoClose: planData.autoClose ?? false,
        allowEarlyClose: planData.allowEarlyClose ?? true,
        allowPause: planData.allowPause ?? true,
        allowRenewal: planData.allowRenewal ?? true,
        status: planData.status ?? 'ACTIVE'
      }
    });

    if (products && products.length > 0) {
      await tx.planProduct.createMany({
        data: products.map(p => ({
          planId: createdPlan.id,
          productId: Number(p.productId),
          quantity: Number(p.quantity),
          unitPriceOverride: p.unitPriceOverride !== undefined && p.unitPriceOverride !== null
            ? decimal.toDecimal(p.unitPriceOverride)
            : null
        }))
      });
    }

    return tx.plan.findUnique({
      where: { id: createdPlan.id },
      include: {
        planProducts: {
          include: { product: true }
        }
      }
    });
  });
}

/**
 * Update an existing subscription plan.
 */
async function updatePlan(id, data) {
  const { products, ...planData } = data;
  const planId = Number(id);

  const updateData = {};
  if (planData.name !== undefined) updateData.name = planData.name;
  if (planData.description !== undefined) updateData.description = planData.description;
  if (planData.pricingMode !== undefined) updateData.pricingMode = planData.pricingMode;
  if (planData.planPrice !== undefined) updateData.planPrice = decimal.toDecimal(planData.planPrice);
  if (planData.billingCycle !== undefined) updateData.billingCycle = planData.billingCycle;
  if (planData.minimumQuantity !== undefined) updateData.minimumQuantity = Number(planData.minimumQuantity);
  if (planData.availableFrom !== undefined) updateData.availableFrom = new Date(planData.availableFrom);
  if (planData.availableUntil !== undefined) updateData.availableUntil = planData.availableUntil ? new Date(planData.availableUntil) : null;
  if (planData.autoClose !== undefined) updateData.autoClose = planData.autoClose;
  if (planData.allowEarlyClose !== undefined) updateData.allowEarlyClose = planData.allowEarlyClose;
  if (planData.allowPause !== undefined) updateData.allowPause = planData.allowPause;
  if (planData.allowRenewal !== undefined) updateData.allowRenewal = planData.allowRenewal;
  if (planData.status !== undefined) updateData.status = planData.status;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.plan.update({
      where: { id: planId },
      data: updateData
    });

    // If products array is provided, replace planProducts
    if (products !== undefined) {
      await tx.planProduct.deleteMany({ where: { planId } });
      if (products.length > 0) {
        await tx.planProduct.createMany({
          data: products.map(p => ({
            planId,
            productId: Number(p.productId),
            quantity: Number(p.quantity),
            unitPriceOverride: p.unitPriceOverride !== undefined && p.unitPriceOverride !== null
              ? decimal.toDecimal(p.unitPriceOverride)
              : null
          }))
        });
      }
    }

    return tx.plan.findUnique({
      where: { id: planId },
      include: {
        planProducts: {
          include: { product: true }
        }
      }
    });
  });
}

/**
 * Set plan status (ACTIVE, INACTIVE, ARCHIVED).
 */
async function setPlanStatus(id, status) {
  return prisma.plan.update({
    where: { id: Number(id) },
    data: { status }
  });
}

/**
 * Assign or update products for a plan.
 */
async function assignPlanProducts(planId, products) {
  const pId = Number(planId);

  return prisma.$transaction(async (tx) => {
    await tx.planProduct.deleteMany({ where: { planId: pId } });

    if (products && products.length > 0) {
      await tx.planProduct.createMany({
        data: products.map(p => ({
          planId: pId,
          productId: Number(p.productId),
          quantity: Number(p.quantity),
          unitPriceOverride: p.unitPriceOverride !== undefined && p.unitPriceOverride !== null
            ? decimal.toDecimal(p.unitPriceOverride)
            : null
        }))
      });
    }

    return tx.planProduct.findMany({
      where: { planId: pId },
      include: { product: true }
    });
  });
}

/**
 * Remove a specific product from a plan.
 */
async function removePlanProduct(planId, productId) {
  return prisma.planProduct.delete({
    where: {
      planId_productId: {
        planId: Number(planId),
        productId: Number(productId)
      }
    }
  });
}

module.exports = {
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  setPlanStatus,
  assignPlanProducts,
  removePlanProduct
};

