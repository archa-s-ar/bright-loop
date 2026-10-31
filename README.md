# BrightLoop Subscription Management System

Brightloop is an enterprise subscription management and recurring billing platform built for selling software subscriptions.

---

## Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript, Chart.js
- **Backend:** Node.js, Express.js
- **Database:** MySQL 8+, Prisma ORM 6.19.3
- **Security & Utilities:** bcrypt, jsonwebtoken, Zod, Helmet, CORS, Nodemailer, cookie-parser

---

## Team Modules

| Module | Lead / Owner | Scope | Status |
| :--- | :--- | :--- | :--- |
| **Module 1** | Member 1 (`feat/auth`) | Authentication, User & Customer Mgmt, Express Core Infrastructure | **Complete & Verified** |
| **Module 2** | Member 2 | Products, Variants, Plans, Taxes, Discounts | Planned |
| **Module 3** | Member 3 | Quotations, Subscriptions, Customer Portal | Planned |
| **Module 4** | Member 4 | Invoicing, Recurring Billing, Payments, Analytics | Planned |

---

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- MySQL 8+

### 2. Environment Setup
In `server/.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/brightloop"
JWT_SECRET=replace_with_local_secret
JWT_EXPIRES_IN=1d
CLIENT_URL=http://localhost:5000
APP_URL=http://localhost:5000
```

### 3. Installation & Run
```bash
cd server
npm install
npm run prisma:generate
npm run dev
```

Visit the application in your browser:
- **Web App / Login:** [http://localhost:5000/login.html](http://localhost:5000/login.html)
- **Customer Registration:** [http://localhost:5000/register.html](http://localhost:5000/register.html)
- **API Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 4. Running Integration Tests
```bash
cd server
npm run test:auth
```

---

## Integration Contracts for Team Members
See [docs/auth-integration.md](docs/auth-integration.md) for full identity contracts (`req.user`), authorization middleware, and router mounting instructions.
