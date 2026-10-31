// src/modules/catalog/services/tax.service.js
const prisma = require('../../../config/prisma');
const decimal = require('../../../utils/decimal');

/**
 * List tax rules.
 */
async function listTaxRules({ isActive } = {}) {
  const where = {};
  if (isActive !== undefined) {
    where.isActive = isActive === 'true' || isActive === true;
  }

  return prisma.taxRule.findMany({
    where,
    include: {
      _count: {
        select: {
          productTaxRules: true,
          invoiceLineTaxes: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Get tax rule by ID.
 */
async function getTaxRuleById(id) {
  return prisma.taxRule.findUnique({
    where: { id: Number(id) },
    include: {
      productTaxRules: {
        include: {
          product: {
            select: { id: true, name: true, productType: true, salesPrice: true }
          }
        }
      }
    }
  });
}

/**
 * Create a new tax rule.
 */
async function createTaxRule(data) {
  return prisma.taxRule.create({
    data: {
      name: data.name,
      taxRate: decimal.toDecimal(data.taxRate),
      description: data.description ?? null,
      effectiveFrom: new Date(data.effectiveFrom),
      effectiveUntil: data.effectiveUntil ? new Date(data.effectiveUntil) : null,
      isActive: data.isActive ?? true
    }
  });
}

/**
 * Update an existing tax rule.
 */
async function updateTaxRule(id, data) {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.taxRate !== undefined) updateData.taxRate = decimal.toDecimal(data.taxRate);
  if (data.description !== undefined) updateData.description = data.description;
  if (data.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(data.effectiveFrom);
  if (data.effectiveUntil !== undefined) updateData.effectiveUntil = data.effectiveUntil ? new Date(data.effectiveUntil) : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.taxRule.update({
    where: { id: Number(id) },
    data: updateData
  });
}

/**
 * Assign tax rules to a product (replaces existing associations).
 */
async function assignProductTaxes(productId, taxRuleIds) {
  const pId = Number(productId);
  const ids = (taxRuleIds || []).map(id => Number(id));

  return prisma.$transaction(async (tx) => {
    // Delete existing product-tax associations
    await tx.productTaxRule.deleteMany({
      where: { productId: pId }
    });

    if (ids.length > 0) {
      await tx.productTaxRule.createMany({
        data: ids.map(taxRuleId => ({
          productId: pId,
          taxRuleId
        }))
      });
    }

    return tx.productTaxRule.findMany({
      where: { productId: pId },
      include: { taxRule: true }
    });
  });
}

/**
 * Reusable tax calculation function for Member 4 (Billing) & Member 3 (Quotations).
 * Given a productId and taxableAmount, computes all active applicable taxes.
 * 
 * @param {number} productId 
 * @param {number|string|Decimal} taxableAmount 
 * @param {Date} [targetDate] Date to check effective validity (defaults to now)
 * @returns {Promise<{ taxes: Array<{ taxRuleId: number, taxName: string, taxRate: Decimal, taxAmount: Decimal }>, totalTaxAmount: Decimal }>}
 */
async function calculateProductTaxes(productId, taxableAmount, targetDate = new Date()) {
  const pId = Number(productId);
  const amount = decimal.toDecimal(taxableAmount);

  const productTaxRules = await prisma.productTaxRule.findMany({
    where: { productId: pId },
    include: { taxRule: true }
  });

  const taxes = [];
  let totalTaxAmount = decimal.ZERO;

  for (const ptr of productTaxRules) {
    const rule = ptr.taxRule;
    if (!rule || !rule.isActive) continue;

    // Check effective date window
    if (rule.effectiveFrom && targetDate < new Date(rule.effectiveFrom)) continue;
    if (rule.effectiveUntil && targetDate > new Date(rule.effectiveUntil)) continue;

    // Tax amount = taxableAmount * taxRate
    const ruleTaxAmount = decimal.round2(decimal.multiply(amount, rule.taxRate));
    totalTaxAmount = decimal.add(totalTaxAmount, ruleTaxAmount);

    taxes.push({
      taxRuleId: rule.id,
      taxName: rule.name,
      taxRate: rule.taxRate,
      taxAmount: ruleTaxAmount
    });
  }

  return {
    taxes,
    totalTaxAmount: decimal.round2(totalTaxAmount)
  };
}

module.exports = {
  listTaxRules,
  getTaxRuleById,
  createTaxRule,
  updateTaxRule,
  assignProductTaxes,
  calculateProductTaxes
};

