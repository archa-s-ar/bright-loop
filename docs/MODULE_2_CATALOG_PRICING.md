# Module 2: Product Catalog, Subscription Plans & Pricing Engine
## Brightloop Technical Documentation & Integration Contracts

**Author:** Lead Developer — Module 2  
**Git Branch:** `pricing`  
**Dependencies:** Node.js, Express.js, Prisma ORM 6.19.3, MySQL 8+, Zod

---

## 1. Module Overview & Responsibilities

Module 2 provides the core catalog, pricing calculations, statutory tax assignments, and discount eligibility rules for Brightloop Software.

It fulfills:
- **Product Catalog Management:** Products, categorization, active status, pricing, and notes.
- **Product Variants & Add-ons:** Single and multi-tier attributes (`attributeName`, `attributeValue`) and pricing deltas (`priceDelta`).
- **Subscription Plan Management:** Daily, Weekly, Monthly, and Yearly plans.
- **Fixed & Itemized Pricing:**
  - `FIXED`: Base bundle price is billed strictly from `planPrice`. Inclusions are bundled entitlements and are **never** added again.
  - `ITEMIZED`: Plan total is dynamically computed from line items: $\sum \left( \text{quantity} \times (\text{unitPriceOverride} \mathbin{??} \text{product.salesPrice}) \right)$.
- **Statutory Tax Rules:** Mapping tax rules (CGST, SGST, IGST) to products (`ProductTaxRule`) and calculating active tax snapshots.
- **Discounts & Promotions:** Fixed amount and percentage discounts, product-specific and subscription-level scopes, minimum purchase/quantity thresholds, and usage limits.
- **Precision Arithmetic:** Decimal-safe arithmetic via `server/src/utils/decimal.js` ensuring no floating-point rounding errors.

---

## 2. Shared Services & Contracts for Team Members

### Contract for Member 3 (Quotations & Subscriptions)
Member 3 requires plan pricing and discount eligibility when generating quotations or subscriptions.

#### 1. Plan Price & Entitlements Evaluation
```javascript
const pricingService = require('../modules/catalog/services/pricing.service');

// Call whenever a quotation or subscription is drafted
const planSummary = await pricingService.calculatePlanPrice(planId);
```
**Output Structure:**
```json
{
  "planId": 1,
  "planName": "Growth ERP Suite",
  "billingCycle": "MONTHLY",
  "pricingMode": "FIXED",
  "configuredPlanPrice": "4999.00",
  "totalUnitAmount": "4999.00",
  "lines": [
    {
      "productId": 10,
      "productName": "Core ERP",
      "quantity": 1,
      "effectiveUnitPrice": "3999.00",
      "includedInFixedBundle": true
    }
  ]
}
```

#### 2. Promo Code & Discount Eligibility
```javascript
const discountService = require('../modules/catalog/services/discount.service');

const eligibility = await discountService.validateDiscountEligibility({
  discountName: 'WELCOME10',
  customerId: 42,
  orderSubtotal: 4999.00,
  items: [{ productId: 10, quantity: 1, unitPrice: 3999.00 }]
});
```
**Output Structure:**
```json
{
  "isValid": true,
  "discountId": 3,
  "discountName": "WELCOME10",
  "discountType": "PERCENTAGE",
  "discountValue": "10.00",
  "discountAmount": "499.90",
  "effectiveSubtotal": "4499.10",
  "message": "Discount 'WELCOME10' applied successfully (-₹499.90)."
}
```

---

### Contract for Member 4 (Recurring Billing & Invoices)
Member 4 requires active product tax rules for generating `InvoiceLineTax` snapshots and evaluating recurring invoice amounts.

#### 1. Product Tax Snapshot Calculation
```javascript
const taxService = require('../modules/catalog/services/tax.service');

// Call for each invoice line item
const taxSnapshot = await taxService.calculateProductTaxes(productId, taxableLineAmount, invoiceDate);
```
**Output Structure:**
```json
{
  "taxes": [
    {
      "taxRuleId": 1,
      "taxName": "CGST 9%",
      "taxRate": "0.0900",
      "taxAmount": "90.00"
    },
    {
      "taxRuleId": 2,
      "taxName": "SGST 9%",
      "taxRate": "0.0900",
      "taxAmount": "90.00"
    }
  ],
  "totalTaxAmount": "180.00"
}
```

---

## 3. REST API Reference

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | Public / Customer (Active only), Staff/Admin (All) | List products with pagination, search, status filter |
| `GET` | `/api/products/:id` | Public / Customer (Active only), Staff/Admin (All) | Get product details, variants, and attached tax rules |
| `POST` | `/api/products` | `ADMIN` | Create new product |
| `PATCH` | `/api/products/:id` | `ADMIN` | Update product details |
| `PATCH` | `/api/products/:id/status`| `ADMIN` | Activate/deactivate/archive product |
| `GET` | `/api/products/:id/variants`| Public / Staff / Admin | List variants for a product |
| `POST` | `/api/products/:id/variants`| `ADMIN` | Add variant with `priceDelta` |
| `PATCH` | `/api/variants/:id` | `ADMIN` | Update variant delta or active status |
| `DELETE` | `/api/variants/:id` | `ADMIN` | Delete variant |
| `POST` | `/api/products/:id/taxes`| `ADMIN` | Associate tax rules with a product |
| `GET` | `/api/plans` | Public / Customer (Active only), Staff/Admin (All) | List subscription plans with cycle & mode filters |
| `GET` | `/api/plans/:id` | Public / Customer (Active only), Staff/Admin (All) | Get plan details and product inclusions |
| `POST` | `/api/plans` | `ADMIN` | Create subscription plan |
| `PATCH` | `/api/plans/:id` | `ADMIN` | Update subscription plan |
| `PATCH` | `/api/plans/:id/status` | `ADMIN` | Activate/deactivate plan |
| `POST` | `/api/plans/:id/products` | `ADMIN` | Assign products and unit price overrides |
| `GET` | `/api/taxes` | Public / Staff / Admin | List configured tax rules |
| `POST` | `/api/taxes` | `ADMIN` | Create statutory tax rule |
| `PATCH` | `/api/taxes/:id` | `ADMIN` | Update tax rule parameters |
| `GET` | `/api/taxes/calculate` | Public / Staff / Admin | Evaluate taxes for product and taxable amount |
| `GET` | `/api/discounts` | `ADMIN`, `STAFF` | List discounts with redemption counters |
| `POST` | `/api/discounts` | `ADMIN` | Create promotional or subscription discount |
| `PATCH` | `/api/discounts/:id` | `ADMIN` | Update discount parameters |
| `PATCH` | `/api/discounts/:id/status`| `ADMIN` | Toggle discount active status |
| `POST` | `/api/discounts/validate`| Public / Staff / Admin | Validate discount code eligibility against an order |
| `GET` | `/api/pricing/plan/:planId`| Public / Staff / Admin | Inspect plan pricing breakdown |
| `POST` | `/api/pricing/calculate-summary`| Public / Staff / Admin | Complete quote pricing summary engine |

---

## 4. Test Suite Execution

Run automated unit and schema tests:
```bash
cd bright-loop/server
npm test
```
All 15 automated test suites verify decimal rounding, fixed vs itemized plan calculations, variant adjustments, date window restrictions, usage limit rejections, and negative balance clamping.

