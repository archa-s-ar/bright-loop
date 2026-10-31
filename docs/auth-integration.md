# Module 1: Authentication, User Management & Core Infrastructure
## Developer Integration Guide & Contract Specifications

This document defines the core infrastructure, authentication middleware, identity contracts, and API endpoints provided by Module 1 for Brightloop.

---

## 1. Core Architecture Overview

Module 1 establishes the shared backend and frontend infrastructure for all team members:

- **Express Application Entry Point:** `server/src/app.js` and `server/src/server.js`
- **Prisma Client Singleton:** `server/src/config/prisma.js`
- **Central Route Aggregator:** `server/src/routes/index.js`
- **Security Middleware:** Helmet, CORS, Cookie-Parser, Zod validation
- **Static Frontend Hosting:** Express serves `client/` directly on `http://localhost:5000`

---

## 2. Standard Identity & Request Contract (`req.user`)

Any route protected by `authenticateUser` has access to `req.user`:

```javascript
const { authenticateUser, authorizeRoles, requireCustomerOwnership } = require('../middleware/auth.middleware');

router.get('/my-secure-endpoint', authenticateUser, (req, res) => {
  // Guaranteed shape of req.user:
  const { id, email, fullName, role, customerId } = req.user;
  
  // role is: 'ADMIN' | 'STAFF' | 'CUSTOMER'
  // customerId is: Int (for CUSTOMER) or null (for ADMIN / STAFF)
});
```

### Authorization Middleware Helpers

1. **`authenticateUser`**:
   - Inspects `token` in HTTP-Only cookies (primary) and `Authorization: Bearer <token>` (fallback).
   - Verifies JWT signature and account `isActive` status in MySQL.
   - Rejects unauthenticated requests with `401 Unauthorized`.

2. **`authorizeRoles(...allowedRoles)`**:
   - Example: `router.post('/products', authenticateUser, authorizeRoles('ADMIN', 'STAFF'), ...)`
   - Rejects unauthorized roles with `403 Forbidden`.

3. **`requireCustomerOwnership(fieldKey)`**:
   - Automatically prevents Insecure Direct Object References (IDOR).
   - Allows ADMIN and STAFF to view any customer data.
   - Restricts CUSTOMER users strictly to records matching `req.user.customerId`.

---

## 3. Standard API Envelopes

### Success Envelope
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Envelope
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "password", "message": "Password must be longer than 8 characters" }
  ]
}
```

Throwing operational errors in services or controllers:
```javascript
const ApiError = require('../../utils/apiError');

throw ApiError.notFound('Plan not found');
throw ApiError.badRequest('Invalid billing cycle');
throw ApiError.forbidden('Access denied');
```

---

## 4. API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Registers customer organization and initial user |
| `POST` | `/api/auth/login` | Public | Verifies credentials, sets signed HTTP-only cookie |
| `POST` | `/api/auth/logout` | Authenticated | Clears authentication cookie |
| `GET` | `/api/auth/me` | Authenticated | Returns current authenticated profile & customer org |
| `POST` | `/api/auth/forgot-password` | Public | Generates SHA-256 token and dispatches reset email |
| `POST` | `/api/auth/reset-password` | Public | Resets password with one-time token |
| `POST` | `/api/auth/change-password` | Authenticated | Updates password after verifying current password |

### User Management (`/api/users`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | `ADMIN`, `STAFF` | List users with pagination, role, & status filters |
| `GET` | `/api/users/:id` | `ADMIN`, `STAFF`, Self | Get user profile |
| `POST` | `/api/users/staff` | `ADMIN` only | Create a new STAFF account with temporary credentials |
| `PATCH` | `/api/users/:id` | `ADMIN`, Self | Update name/email |
| `PATCH` | `/api/users/:id/status` | `ADMIN` only | Activate or deactivate a user account |

### Customer Accounts (`/api/customers`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/customers` | `ADMIN`, `STAFF` | List customer organizations with counts |
| `GET` | `/api/customers/:id` | `ADMIN`, `STAFF`, Own Org | Get customer organization details |
| `POST` | `/api/customers` | `ADMIN`, `STAFF` | Create customer organization |
| `PATCH` | `/api/customers/:id` | `ADMIN`, `STAFF`, Own Org | Update customer profile |

---

## 5. Team Integration Mounting Instructions

Each team member should create their module directory under `server/src/modules/<name>/` and mount their router into `server/src/routes/index.js`:

```javascript
// Example in server/src/routes/index.js:

// Member 2 (Catalog and Pricing):
const catalogRoutes = require('../modules/catalog/catalog.routes');
router.use('/catalog', catalogRoutes);

// Member 3 (Quotations and Subscriptions):
const quotationsRoutes = require('../modules/quotations/quotations.routes');
const subscriptionsRoutes = require('../modules/subscriptions/subscriptions.routes');
router.use('/quotations', quotationsRoutes);
router.use('/subscriptions', subscriptionsRoutes);

// Member 4 (Billing and Analytics):
const billingRoutes = require('../modules/billing/billing.routes');
const analyticsRoutes = require('../modules/analytics/analytics.routes');
router.use('/billing', billingRoutes);
router.use('/analytics', analyticsRoutes);
```

---

## 6. How to Run the Application

```bash
# 1. Install dependencies
cd server
npm install

# 2. Run database migrations (already applied)
npm run prisma:generate

# 3. Start development server with auto-reload
npm run dev

# 4. Run automated integration test suite
npm run test:auth
```

Frontend application is immediately available at `http://localhost:5000/`.
