// server/tests/catalog.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const decimal = require('../src/utils/decimal');
const { createProductSchema, createVariantSchema } = require('../src/modules/catalog/validators/product.schema');
const { createPlanSchema } = require('../src/modules/catalog/validators/plan.schema');
const { createTaxRuleSchema } = require('../src/modules/catalog/validators/tax.schema');
const { createDiscountSchema } = require('../src/modules/catalog/validators/discount.schema');

describe('Module 2: Decimal Precision Arithmetic', () => {
  it('should correctly add decimal amounts without floating point errors', () => {
    // Standard JS 0.1 + 0.2 === 0.30000000000000004
    const res = decimal.add(0.1, 0.2);
    assert.equal(decimal.format(res), '0.30');
  });

  it('should accurately multiply quantity and unit price', () => {
    const qty = 7;
    const unitPrice = 149.99;
    const total = decimal.multiply(qty, unitPrice);
    assert.equal(decimal.format(total), '1049.93');
  });

  it('should divide accurately and handle zero division gracefully', () => {
    assert.equal(decimal.format(decimal.divide(100, 3)), '33.33');
    assert.equal(decimal.format(decimal.divide(100, 0)), '0.00');
  });

  it('should clamp negative values to zero', () => {
    const diff = decimal.subtract(50, 120);
    assert.equal(decimal.format(decimal.clampPositive(diff)), '0.00');
  });
});

describe('Module 2: Pricing Logic Simulation (Fixed vs Itemized)', () => {
  it('should calculate FIXED plan price strictly using planPrice and ignore line prices', () => {
    const plan = {
      pricingMode: 'FIXED',
      planPrice: 2499.00,
      lines: [
        { productName: 'Core ERP', quantity: 1, basePrice: 1999.00 },
        { productName: 'CRM Addon', quantity: 2, basePrice: 500.00 }
      ]
    };

    let totalCharged = decimal.ZERO;
    if (plan.pricingMode === 'FIXED') {
      totalCharged = decimal.toDecimal(plan.planPrice);
    } else {
      totalCharged = plan.lines.reduce((acc, l) => decimal.add(acc, decimal.multiply(l.quantity, l.basePrice)), decimal.ZERO);
    }

    assert.equal(decimal.format(totalCharged), '2499.00');
    // Ensure product sum (1999 + 1000 = 2999) was NOT double counted or added
    assert.notEqual(decimal.format(totalCharged), '5498.00');
  });

  it('should calculate ITEMIZED plan price summing each product line with quantity and unit override', () => {
    const lines = [
      { productId: 1, quantity: 2, unitPrice: 450.00 },
      { productId: 2, quantity: 1, unitPrice: 1200.00 } // override
    ];

    let total = decimal.ZERO;
    for (const line of lines) {
      total = decimal.add(total, decimal.multiply(line.quantity, line.unitPrice));
    }

    // 2 * 450 + 1 * 1200 = 900 + 1200 = 2100.00
    assert.equal(decimal.format(total), '2100.00');
  });

  it('should calculate variant price delta adjustments accurately', () => {
    const baseProductPrice = 1500.00;
    const enterpriseVariantDelta = 560.00;
    const starterVariantDelta = -200.00;

    const enterprisePrice = decimal.add(baseProductPrice, enterpriseVariantDelta);
    assert.equal(decimal.format(enterprisePrice), '2060.00');

    const starterPrice = decimal.add(baseProductPrice, starterVariantDelta);
    assert.equal(decimal.format(starterPrice), '1300.00');
  });
});

describe('Module 2: Tax Calculation Simulation', () => {
  it('should compute tax based on active effective date window and rate', () => {
    const taxRules = [
      { name: 'CGST', rate: 0.09, effectiveFrom: new Date('2026-01-01'), effectiveUntil: null, isActive: true },
      { name: 'SGST', rate: 0.09, effectiveFrom: new Date('2026-01-01'), effectiveUntil: null, isActive: true },
      { name: 'Old Cess', rate: 0.02, effectiveFrom: new Date('2025-01-01'), effectiveUntil: new Date('2025-12-31'), isActive: true }
    ];

    const targetDate = new Date('2026-10-31');
    const taxableAmount = 1000.00;

    let totalTax = decimal.ZERO;
    const activeTaxes = [];

    for (const rule of taxRules) {
      if (!rule.isActive) continue;
      if (rule.effectiveFrom && targetDate < rule.effectiveFrom) continue;
      if (rule.effectiveUntil && targetDate > rule.effectiveUntil) continue;

      const taxAmt = decimal.round2(decimal.multiply(taxableAmount, rule.rate));
      totalTax = decimal.add(totalTax, taxAmt);
      activeTaxes.push({ name: rule.name, amount: decimal.format(taxAmt) });
    }

    assert.equal(activeTaxes.length, 2); // Old Cess is excluded
    assert.equal(decimal.format(totalTax), '180.00');
  });
});

describe('Module 2: Discount Eligibility Simulation', () => {
  it('should apply percentage discount correctly and clamp within eligible amount', () => {
    const discount = {
      type: 'PERCENTAGE',
      value: 20, // 20%
      minPurchase: 1000.00,
      minQuantity: 2
    };

    const orderSubtotal = 1500.00;
    const totalQty = 3;

    assert.ok(orderSubtotal >= discount.minPurchase, 'Subtotal exceeds min purchase');
    assert.ok(totalQty >= discount.minQuantity, 'Quantity exceeds min quantity');

    const discountAmt = decimal.round2(decimal.multiply(orderSubtotal, decimal.divide(discount.value, 100)));
    const discountedTotal = decimal.subtract(orderSubtotal, discountAmt);

    assert.equal(decimal.format(discountAmt), '300.00');
    assert.equal(decimal.format(discountedTotal), '1200.00');
  });

  it('should reject discount if usage limit is reached', () => {
    const discount = { usageLimit: 5, redemptionCount: 5 };
    const isExhausted = discount.usageLimit !== null && discount.redemptionCount >= discount.usageLimit;
    assert.equal(isExhausted, true);
  });

  it('should clamp fixed discount so order total never becomes negative', () => {
    const discountValue = 500.00;
    const orderSubtotal = 350.00;

    let appliedDiscount = decimal.toDecimal(discountValue);
    if (appliedDiscount.greaterThan(orderSubtotal)) {
      appliedDiscount = decimal.toDecimal(orderSubtotal);
    }

    const netSubtotal = decimal.clampPositive(decimal.subtract(orderSubtotal, appliedDiscount));
    assert.equal(decimal.format(appliedDiscount), '350.00');
    assert.equal(decimal.format(netSubtotal), '0.00');
  });
});

describe('Module 2: Zod Schema Validation', () => {
  it('should validate valid product creation payload', () => {
    const payload = {
      name: 'Odoo ERP Integration',
      productType: 'SaaS Software',
      salesPrice: 4500.00,
      costPrice: 2000.00,
      status: 'ACTIVE'
    };
    const parsed = createProductSchema.safeParse(payload);
    assert.equal(parsed.success, true);
  });

  it('should reject product creation with negative salesPrice', () => {
    const payload = {
      name: 'Bad Product',
      productType: 'SaaS',
      salesPrice: -50.00,
      costPrice: 10.00
    };
    const parsed = createProductSchema.safeParse(payload);
    assert.equal(parsed.success, false);
  });

  it('should validate plan creation with products array', () => {
    const payload = {
      name: 'Business Pro Plan',
      pricingMode: 'FIXED',
      planPrice: 9999.00,
      billingCycle: 'YEARLY',
      availableFrom: '2026-01-01',
      products: [
        { productId: 1, quantity: 5, unitPriceOverride: 1800.00 }
      ]
    };
    const parsed = createPlanSchema.safeParse(payload);
    assert.equal(parsed.success, true);
  });

  it('should reject discount with percentage greater than 100%', () => {
    const payload = {
      name: 'SUPER_DISCOUNT',
      discountType: 'PERCENTAGE',
      discountValue: 150, // Invalid!
      startsAt: '2026-01-01',
      scope: 'SUBSCRIPTION'
    };
    const parsed = createDiscountSchema.safeParse(payload);
    assert.equal(parsed.success, false);
  });
});

