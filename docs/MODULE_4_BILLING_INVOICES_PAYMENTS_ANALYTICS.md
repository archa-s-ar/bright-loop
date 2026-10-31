# Module 4: Billing, Invoices, Payments & Financial Analytics
## Brightloop Technical Documentation & Architecture Specification

**Author:** Lead Developer — Module 3 & Module 4  
**Git Branch:** `billing`  
**Dependencies:** Node.js, Express.js, Prisma ORM 6.19.3, MySQL 8+, Zod, PDFKit, Node-Cron, Razorpay SDK, Decimal.js

---

## 1. Module Overview & Responsibilities

Module 4 is the revenue engine of Brightloop. It manages the automated recurring generation of statutory tax invoices, processes partial and full customer payments, orchestrates payment gateway interactions, and produces real-time executive financial metrics.

Core capabilities:
- **Automated Recurring Billing Engine:** A resilient, scheduled cron job (`recurring-billing.job.js`) running daily at `00:00 UTC` (configurable via `BILLING_CRON_SCHEDULE`). Finds all active subscriptions where `nextBillingDate <= TODAY`, generates invoices, and advances billing periods atomically.
- **Idempotency Guarantees:** Database-level uniqueness constraints `@@unique([subscriptionId, billingPeriodStart, billingPeriodEnd])` on both `Invoice` and `BillingExecution` prevent duplicate billing under retries, server restarts, or concurrent runs.
- **Fixed vs Itemized Invoice Line Generation:**
  - `FIXED` plans: Generates a single consolidated invoice line for the base plan package (`planPrice`). Entitlement items are linked but not double-charged.
  - `ITEMIZED` plans: Computes distinct invoice lines for each product subscription line, multiplying unit price by subscribed quantity.
- **Immutable Tax & Discount Snapshots:** Snapshots statutory tax breakdowns (`InvoiceLineTax`) and promotional discount redemptions (`DiscountRedemption`) at the exact moment of billing to ensure historical financial immutability regardless of future tax code revisions.
- **Dynamic Overdue Calculation:** Follows the strict project rule that `OVERDUE` is not a persistent database enum value. Invoices dynamically evaluate to overdue when:
  $$\text{isOverdue} = (\text{status} \in [\,\text{'CONFIRMED'},\, \text{'PARTIALLY\_PAID'}\,]) \land (\text{dueDate} < \text{NOW()}) \land (\text{outstandingAmount} > 0)$$
- **Multi-Invoice Partial Payment Allocation:** Supports enterprise payment allocations where a single payment (e.g. ₹50,000 NEFT transfer) can be allocated across multiple outstanding invoices. System strictly bounds:
  $$\sum \text{allocatedAmount} \le \text{payment.amount} \quad \text{and} \quad \text{allocatedAmount} \le \text{invoice.outstandingAmount}$$
- **Razorpay Payment Gateway Bridge:** Full end-to-end integration supporting order creation, client-side checkout modal, cryptographic signature verification using HMAC SHA256 (`server/src/config/razorpay.js`), and idempotent webhook ingestion.
- **Real-Time Financial Analytics:** Instantaneous calculations of MRR, ARR, Cash Collected, Invoiced Revenue, Payment Method distribution, and 30/60/90-day Aging Brackets.
- **PDF Generation:** Production-ready statutory tax invoice PDFs streamed via `PDFKit` with customer GSTIN, tax tables, payment allocation history, and balance due stamps.

---

## 2. Idempotent Recurring Billing Architecture

```
                    ┌─────────────────────────┐
                    │  node-cron Scheduler    │
                    │  (Daily at 00:00 UTC)   │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Find Active Subs where  │
                    │ nextBillingDate <= TODAY│
                    └────────────┬────────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
        Subscription 1 (Valid)      Subscription 2 (Already Billed)
                   │                           │
                   ▼                           ▼
        ┌─────────────────────┐     ┌─────────────────────┐
        │  Check/Insert DB    │     │  Unique Constraint  │
        │  BillingExecution   │     │  Catches Duplicate  │
        └──────────┬──────────┘     └──────────┬──────────┘
                   │                           │
                   ▼                           ▼
        ┌─────────────────────┐     ┌─────────────────────┐
        │ Generate Invoice +  │     │ Skipped Cleanly     │
        │ Advance Next Billing│     │ No Duplicate Charge │
        └─────────────────────┘     └─────────────────────┘
```

### Manual Trigger API:
Administrators can trigger billing runs on-demand for operational testing or catch-up cycles:
```http
POST /api/billing/run
Authorization: Bearer <ADMIN_JWT>
```

---

## 3. Financial Metrics & Revenue Normalization

All financial calculations strictly utilize `server/src/utils/decimal.js` to ensure zero floating-point precision loss.

### 1. Normalized MRR & ARR Formulas:
Subscriptions with different billing cycles are normalized to monthly and annual equivalents:

| Billing Cycle | Monthly Recurring Revenue (MRR) | Annual Recurring Revenue (ARR) |
|---|---|---|
| `DAILY` | $\text{Rate} \times 30$ | $\text{Rate} \times 365$ |
| `WEEKLY` | $\text{Rate} \times 4.333333$ | $\text{Rate} \times 52$ |
| `MONTHLY` | $\text{Rate} \times 1$ | $\text{Rate} \times 12$ |
| `YEARLY` | $\text{Rate} \div 12$ | $\text{Rate} \times 1$ |

### 2. Aging Brackets:
Unpaid balances on confirmed/partially-paid invoices are grouped into standard accounting aging brackets based on days past `dueDate`:
- **Current (Not Due Yet):** $\text{dueDate} \ge \text{TODAY}$
- **1 – 30 Days Overdue:** $1 \le (\text{TODAY} - \text{dueDate}) \le 30$
- **31 – 60 Days Overdue:** $31 \le (\text{TODAY} - \text{dueDate}) \le 60$
- **60+ Days Overdue:** $(\text{TODAY} - \text{dueDate}) > 60$

---

## 4. Razorpay Gateway & Webhook Security

### 1. Order Creation (`POST /api/payments/create-order`):
Accepts `invoiceId` and optional `customAmount`. Verifies invoice is not in `PAID` or `CANCELLED` status, verifies customer tenant isolation, and issues a provider order ID via Razorpay SDK (falling back gracefully to sandbox simulation if mock keys are present).

### 2. Signature Verification (`POST /api/payments/verify`):
Cryptographically validates the checkout response using HMAC SHA256:
$$\text{Expected Signature} = \text{HMAC\_SHA256}(\text{order\_id} + "|" + \text{payment\_id},\, \text{RAZORPAY\_KEY\_SECRET})$$
Upon matching, records `Payment` record with `status = 'SUCCEEDED'` and atomically allocates funds to `PaymentAllocation`, transitioning `Invoice.status` to `PARTIALLY_PAID` or `PAID`.

### 3. Webhook Handling (`POST /api/payments/webhook`):
Public endpoint verified via `X-Razorpay-Signature`. Records raw payload into `PaymentGatewayEvent` for idempotency and audits. Unpacks events such as `payment.captured` or `payment.failed` to update transaction records.

---

## 5. API Endpoints Specification

### Invoices
| Method | Endpoint | Authorized Roles | Description |
|---|---|---|---|
| `GET` | `/api/invoices` | All (Customer-filtered) | List invoices with status, overdue, customer, and date filters. |
| `GET` | `/api/invoices/:id` | All (Customer-filtered) | Get invoice details with lines, tax snapshots, and payments. |
| `GET` | `/api/invoices/:id/pdf`| All (Customer-filtered) | Stream PDF Tax Invoice. |
| `POST` | `/api/invoices` | `ADMIN`, `STAFF` | Create manual direct invoice. |
| `POST` | `/api/invoices/:id/confirm`| `ADMIN`, `STAFF`| Confirm draft invoice (locks line items). |
| `POST` | `/api/invoices/:id/cancel` | `ADMIN`, `STAFF`| Cancel invoice. |

### Payments & Checkout
| Method | Endpoint | Authorized Roles | Description |
|---|---|---|---|
| `GET` | `/api/payments` | All (Customer-filtered) | List payments with method, status, and date filters. |
| `GET` | `/api/payments/:id` | All (Customer-filtered) | Get payment details with invoice allocations. |
| `POST` | `/api/payments` | `ADMIN`, `STAFF` | Record offline payment (Cash, Bank Transfer, Cheque). |
| `POST` | `/api/payments/create-order` | All (Customer-filtered) | Initiate Razorpay gateway order for invoice. |
| `POST` | `/api/payments/verify` | All (Customer-filtered) | Verify HMAC signature and allocate online payment. |
| `POST` | `/api/payments/:id/allocate` | `ADMIN`, `STAFF` | Allocate unallocated payment balance across invoices. |
| `POST` | `/api/payments/webhook` | Public (HMAC Verified) | Ingest Razorpay asynchronous webhook events. |

### Billing Engine & Analytics
| Method | Endpoint | Authorized Roles | Description |
|---|---|---|---|
| `POST` | `/api/billing/run` | `ADMIN` | Trigger manual batch execution of recurring billing engine. |
| `GET` | `/api/billing/executions` | `ADMIN`, `STAFF` | Audit log of automated and manual billing runs. |
| `GET` | `/api/analytics/overview` | `ADMIN`, `STAFF` | Executive KPI overview (MRR, ARR, Cash, Invoiced, Overdue). |
| `GET` | `/api/analytics/aging` | `ADMIN`, `STAFF` | Accounts receivable aging analysis by bracket. |
| `GET` | `/api/analytics/mrr-arr`| `ADMIN`, `STAFF` | Historical and cycle-breakdown subscription revenue. |
| `GET` | `/api/analytics/payment-methods` | `ADMIN`, `STAFF` | Payment collection distribution by gateway/offline channels. |

---

## 6. Sequence Generators & Identifier Formatting

- Invoices: `INV-YYYYMM-XXXX` (e.g. `INV-202610-0001`)
- Payments: `PAY-YYYYMM-XXXX` (e.g. `PAY-202610-0001`)

Generated deterministically via `server/src/utils/sequence.js` within atomic transactions.

