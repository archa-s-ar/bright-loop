# Module 3: Quotations & Subscription Management
## Brightloop Technical Documentation & Architecture Specification

**Author:** Lead Developer — Module 3 & Module 4  
**Git Branch:** `billing`  
**Dependencies:** Node.js, Express.js, Prisma ORM 6.19.3, MySQL 8+, Zod, PDFKit, Decimal.js

---

## 1. Module Overview & Responsibilities

Module 3 is the bridge between sales proposals and ongoing subscription revenue. It provides enterprise quoting capabilities, customer acceptance workflows, atomic quotation-to-subscription conversions, and recurring subscription lifecycle controls.

Key capabilities:
- **Quotation Templates:** Predefined commercial bundles and default line items for rapid sales proposal drafting (`QuotationTemplate`, `QuotationTemplateLine`).
- **Quotation Lifecycle Engine:** Robust state machine strictly enforcing:
  $$\text{DRAFT} \longrightarrow \text{SENT} \longrightarrow \text{ACCEPTED} \longrightarrow \text{CONVERTED}$$
  With terminal transitions for `REJECTED` and time-based auto-invalidation for `EXPIRED`.
- **Atomic Conversion Engine:** Converts an `ACCEPTED` quotation into an `ACTIVE` subscription, snapshotting all product line configurations, unit prices, and quantities, linking the quotation to the created subscription (`quotation.subscriptionId`), and logging the transition in `SubscriptionHistory`.
- **Subscription Lifecycle Management:** Comprehensive controls for recurring subscriptions:
  - `ACTIVE`: Eligible for recurring automated billing.
  - `PAUSED`: Temporarily on hold; excluded from scheduled billing until resumed.
  - `CLOSED`: Terminated contracts; history preserved.
  - `PENDING`: Newly created direct subscriptions awaiting first activation.
- **Audit Logging:** Every lifecycle status modification records timestamp, user/actor ID, old status, new status, and contextual notes in `SubscriptionHistory`.
- **PDF Document Generation:** Commercial PDF quotations streamed directly via `PDFKit` with Brightloop branding, tax breakdown lines, and validity notices.
- **Customer Self-Service:** Dedicated customer portal pages where client organizations review proposals, download PDF quotes, and execute legally binding one-click acceptances.

---

## 2. Quotation State Machine

The quotation state machine is strictly validated at both the service and controller layers:

```
          ┌─────────────┐
          │    DRAFT    │
          └──────┬──────┘
                 │ (Send Quote to Customer)
                 ▼
          ┌─────────────┐
          │    SENT     │◄──────────── (Can also accept directly from DRAFT in internal sales)
          └──────┬──────┘
                 │
       ┌─────────┴─────────┐
       │ (Customer Accepts)│ (Customer Rejects or Times Out)
       ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  ACCEPTED   │     │  REJECTED   │     │   EXPIRED   │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │ (Convert to Subscription)
       ▼
┌─────────────┐
│  CONVERTED  │ (Immutable; subscription active)
└─────────────┘
```

### State Machine Rules:
1. `DRAFT` can transition to `SENT`, `ACCEPTED`, or `REJECTED`.
2. `SENT` can transition to `ACCEPTED`, `REJECTED`, or `EXPIRED`.
3. An `ACCEPTED` quotation can only transition to `CONVERTED`.
4. Quotations past their `validUntil` timestamp cannot be accepted and automatically evaluate to `EXPIRED`.
5. Once `CONVERTED`, the quotation becomes read-only and immutable.

---

## 3. Quotation-to-Subscription Conversion Contract

When `POST /api/quotations/:id/convert` is executed, the following atomic database transaction is performed:

1. **Validation:** Verifies the quotation exists, is in `ACCEPTED` status, and has not already been converted (`subscriptionId == null`).
2. **Subscription Initialization:**
   - Generates unique subscription sequence number: `SUB-YYYYMM-XXXX`.
   - Assigns customer, start date (`NOW()`), and initial billing period.
   - Calculates `currentPeriodStart = NOW()` and `currentPeriodEnd = calculatePeriodEnd(startDate, billingCycle)`.
   - Computes `nextBillingDate = calculateNextBillingDate(startDate, billingCycle)`.
3. **Line Snapshotting:** Iterates over all `QuotationLine` records and clones them into `SubscriptionLine` records, snapshotting:
   - `productId`
   - `productVariantId`
   - `quantity`
   - `unitPrice`
4. **Quotation Update:** Updates `Quotation.status = 'CONVERTED'` and sets `Quotation.subscriptionId = subscription.id`.
5. **Audit Trail:** Appends an entry to `SubscriptionHistory` documenting creation from quotation number.

---

## 4. API Endpoints Specification

### Quotation Templates
| Method | Endpoint | Authorized Roles | Description |
|---|---|---|---|
| `GET` | `/api/quotations/templates` | `ADMIN`, `STAFF` | List quotation templates with pagination and search. |
| `GET` | `/api/quotations/templates/:id` | `ADMIN`, `STAFF` | Get template details with bundled lines. |
| `POST` | `/api/quotations/templates` | `ADMIN` | Create a reusable quotation template. |
| `PATCH` | `/api/quotations/templates/:id` | `ADMIN` | Update template metadata and lines. |
| `DELETE`| `/api/quotations/templates/:id` | `ADMIN` | Soft-deactivate a quotation template. |

### Quotations
| Method | Endpoint | Authorized Roles | Description |
|---|---|---|---|
| `GET` | `/api/quotations` | All (Customer-filtered) | List quotations with status, search, and date filters. |
| `GET` | `/api/quotations/:id` | All (Customer-filtered) | Get quotation details with itemized lines, taxes & discounts. |
| `GET` | `/api/quotations/:id/pdf`| All (Customer-filtered) | Stream commercial PDF quotation copy. |
| `POST` | `/api/quotations` | `ADMIN`, `STAFF` | Create a draft quotation from template or custom lines. |
| `POST` | `/api/quotations/:id/send` | `ADMIN`, `STAFF` | Mark quotation as `SENT` to client. |
| `POST` | `/api/quotations/:id/accept` | All (Customer self-service)| Accept quotation. |
| `POST` | `/api/quotations/:id/reject` | All | Reject quotation with optional reason. |
| `POST` | `/api/quotations/:id/convert`| `ADMIN`, `STAFF` | Convert accepted quotation to active subscription. |

### Subscriptions
| Method | Endpoint | Authorized Roles | Description |
|---|---|---|---|
| `GET` | `/api/subscriptions` | All (Customer-filtered) | List subscriptions with status, customer, and plan filters. |
| `GET` | `/api/subscriptions/:id` | All (Customer-filtered) | Get subscription details with lines, plan & invoice history. |
| `GET` | `/api/subscriptions/:id/history` | `ADMIN`, `STAFF` | Fetch full audit history timeline. |
| `POST` | `/api/subscriptions` | `ADMIN`, `STAFF` | Create direct subscription without quotation. |
| `POST` | `/api/subscriptions/:id/activate` | `ADMIN`, `STAFF` | Transition subscription to `ACTIVE`. |
| `POST` | `/api/subscriptions/:id/pause` | `ADMIN`, `STAFF` | Pause subscription (suspends recurring billing). |
| `POST` | `/api/subscriptions/:id/resume`| `ADMIN`, `STAFF` | Resume paused subscription to `ACTIVE`. |
| `POST` | `/api/subscriptions/:id/renew` | `ADMIN`, `STAFF` | Manually advance billing cycle and period dates. |
| `POST` | `/api/subscriptions/:id/close` | `ADMIN`, `STAFF` | Terminate subscription (`CLOSED`). |

---

## 5. Sequence Generators & Identifier Formatting

All business entities generate collision-resistant human-readable sequential identifiers using `server/src/utils/sequence.js`:
- Quotations: `QUO-YYYYMM-XXXX` (e.g. `QUO-202610-0001`)
- Subscriptions: `SUB-YYYYMM-XXXX` (e.g. `SUB-202610-0001`)

Sequences reset safely across months and query existing database records atomically to guarantee uniqueness under concurrent operations.

