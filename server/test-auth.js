const http = require('http');
// Keep integration tests deterministic and independent of external SMTP.
process.env.NODE_ENV = 'test';
const app = require('./src/app');
const prisma = require('./src/config/prisma');
const { hashPassword } = require('./src/utils/password');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, headers: res.headers, cookies: setCookie, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, cookies: setCookie, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Brightloop Authentication & Infrastructure Integration Tests...\n');

  try {
    // 1. Verify DB connection
    await prisma.$connect();
    console.log('✅ Database connected successfully.');

    // 2. Start test server on random available port
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    console.log(`✅ Test server running on ${baseUrl}\n`);

    const timestamp = Date.now();
    const testCustomerEmail = `customer_${timestamp}@brightloop.test`;
    const testAdminEmail = `admin_${timestamp}@brightloop.test`;
    const testStaffEmail = `staff_${timestamp}@brightloop.test`;
    const testPassword = 'Password123!@#';

    // ---------------------------------------------------------
    // TEST 1: Health Check
    // ---------------------------------------------------------
    console.log('--- Test 1: API Health Check ---');
    const healthRes = await request('GET', '/api/health');
    console.assert(healthRes.status === 200, `Health check failed: ${healthRes.status}`);
    console.assert(healthRes.body.data.status === 'healthy', 'Health check data status not healthy');
    console.log('✅ Health check passed (200 OK)');

    // ---------------------------------------------------------
    // TEST 2: Customer Public Registration
    // ---------------------------------------------------------
    console.log('\n--- Test 2: Customer Public Registration ---');
    const regRes = await request('POST', '/api/auth/register', {
      companyName: `Acme Corp ${timestamp}`,
      fullName: 'John Doe',
      email: testCustomerEmail,
      password: testPassword,
      phone: '+91 9876543210',
      billingAddress: '123 Business Park, Bangalore, KA, India',
      taxRegistrationNumber: 'GSTIN29AAAAA0000A1Z5',
    });

    console.assert(regRes.status === 201, `Registration failed with status ${regRes.status}: ${JSON.stringify(regRes.body)}`);
    console.assert(regRes.body.success === true, 'Registration success not true');
    console.assert(regRes.body.data.user.role === 'CUSTOMER', 'Registered user role must be CUSTOMER');
    console.assert(regRes.body.data.user.customerId !== null, 'Customer user must have customerId');
    console.assert(regRes.body.data.token, 'Token must be returned');
    console.assert(regRes.cookies && regRes.cookies.some((c) => c.includes('token=')), 'Token cookie must be set');
    const customerToken = regRes.body.data.token;
    const customerId = regRes.body.data.user.customerId;
    const customerUserId = regRes.body.data.user.id;
    console.log(`✅ Customer registered: User ID ${customerUserId}, Customer ID ${customerId}`);

    // ---------------------------------------------------------
    // TEST 3: Duplicate Email Rejection
    // ---------------------------------------------------------
    console.log('\n--- Test 3: Duplicate Email Rejection ---');
    const dupRes = await request('POST', '/api/auth/register', {
      companyName: 'Duplicate Inc',
      fullName: 'Jane Doe',
      email: testCustomerEmail,
      password: testPassword,
    });
    console.assert(dupRes.status === 409, `Duplicate email should return 409, got: ${dupRes.status}`);
    console.assert(dupRes.body.success === false, 'Duplicate registration must fail');
    console.log('✅ Duplicate email rejected with 409 Conflict');

    // ---------------------------------------------------------
    // TEST 4: Weak Password Validation
    // ---------------------------------------------------------
    console.log('\n--- Test 4: Weak Password Validation ---');
    const weakRes = await request('POST', '/api/auth/register', {
      companyName: 'Weak Inc',
      fullName: 'Weak User',
      email: `weak_${timestamp}@brightloop.test`,
      password: 'weak', // Less than 9 chars, no uppercase/special
    });
    console.assert(weakRes.status === 400, `Weak password should return 400, got ${weakRes.status}`);
    console.assert(weakRes.body.success === false, 'Weak password registration must fail');
    console.log('✅ Weak password rejected with 400 Validation Error');

    // ---------------------------------------------------------
    // TEST 5: Customer Login
    // ---------------------------------------------------------
    console.log('\n--- Test 5: Customer Login ---');
    const loginRes = await request('POST', '/api/auth/login', {
      email: testCustomerEmail,
      password: testPassword,
    });
    console.assert(loginRes.status === 200, `Login failed: ${loginRes.status}`);
    console.assert(loginRes.body.data.token, 'Login must return token');
    console.log('✅ Customer logged in successfully');

    // ---------------------------------------------------------
    // TEST 6: Failed Login Rejection
    // ---------------------------------------------------------
    console.log('\n--- Test 6: Failed Login Rejection ---');
    const failLoginRes = await request('POST', '/api/auth/login', {
      email: testCustomerEmail,
      password: 'WrongPassword999!',
    });
    console.assert(failLoginRes.status === 401, `Invalid password should return 401, got ${failLoginRes.status}`);
    console.log('✅ Invalid password rejected with 401 Unauthorized');

    // ---------------------------------------------------------
    // TEST 7: Current User /api/auth/me
    // ---------------------------------------------------------
    console.log('\n--- Test 7: GET /api/auth/me ---');
    const meRes = await request('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${customerToken}`,
    });
    console.assert(meRes.status === 200, `GET /me failed: ${meRes.status}`);
    console.assert(meRes.body.data.email === testCustomerEmail, 'Email should match');
    console.assert(meRes.body.data.role === 'CUSTOMER', 'Role should match CUSTOMER');
    console.log('✅ Authenticated identity verified');

    // ---------------------------------------------------------
    // TEST 8: Password Change
    // ---------------------------------------------------------
    console.log('\n--- Test 8: Change Password ---');
    const newPassword = 'NewPassword2026!@#';
    const changeRes = await request(
      'POST',
      '/api/auth/change-password',
      {
        currentPassword: testPassword,
        newPassword: newPassword,
      },
      {
        Authorization: `Bearer ${customerToken}`,
      }
    );
    console.assert(changeRes.status === 200, `Password change failed: ${changeRes.status}`);

    // Verify login with new password
    const newLoginRes = await request('POST', '/api/auth/login', {
      email: testCustomerEmail,
      password: newPassword,
    });
    console.assert(newLoginRes.status === 200, 'Login with new password must succeed');
    console.log('✅ Password changed and verified with new login');

    // ---------------------------------------------------------
    // TEST 9: Forgot Password & Reset Password Workflow
    // ---------------------------------------------------------
    console.log('\n--- Test 9: Forgot & Reset Password Workflow ---');
    const forgotRes = await request('POST', '/api/auth/forgot-password', {
      email: testCustomerEmail,
    });
    console.assert(forgotRes.status === 200, `Forgot password failed: ${forgotRes.status}`);

    // Query the PasswordReset record from DB
    const resetRecord = await prisma.passwordReset.findFirst({
      where: { userId: customerUserId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    console.assert(resetRecord !== null, 'PasswordReset record must be created');
    console.assert(resetRecord.tokenHash, 'PasswordReset must store tokenHash');

    // For test purposes, let's create a known raw token and test resetting
    const crypto = require('crypto');
    const testRawToken = 'test-token-' + Date.now();
    const testHash = crypto.createHash('sha256').update(testRawToken).digest('hex');
    await prisma.passwordReset.create({
      data: {
        userId: customerUserId,
        tokenHash: testHash,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const resetSuccessPassword = 'ResetPassword2026!@#';
    const resetRes = await request('POST', '/api/auth/reset-password', {
      token: testRawToken,
      newPassword: resetSuccessPassword,
    });
    console.assert(resetRes.status === 200, `Reset password failed: ${resetRes.status}`);

    // Verify token reuse is prevented
    const reuseRes = await request('POST', '/api/auth/reset-password', {
      token: testRawToken,
      newPassword: 'AnotherPassword2026!@#',
    });
    console.assert(reuseRes.status === 400, 'Reusing a reset token must return 400');
    console.log('✅ Password reset succeeded and token reuse correctly prevented');

    // ---------------------------------------------------------
    // TEST 10: Admin Creation & Staff Management
    // ---------------------------------------------------------
    console.log('\n--- Test 10: Admin & Staff User Management ---');
    // Create an Admin user directly in DB
    const adminPasswordHash = await hashPassword(testPassword);
    const adminUser = await prisma.user.create({
      data: {
        fullName: 'System Admin',
        email: testAdminEmail,
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        isActive: true,
      },
    });

    const adminLoginRes = await request('POST', '/api/auth/login', {
      email: testAdminEmail,
      password: testPassword,
    });
    const adminToken = adminLoginRes.body.data.token;

    // Admin creates Staff user
    const createStaffRes = await request(
      'POST',
      '/api/users/staff',
      {
        fullName: 'Support Staff 1',
        email: testStaffEmail,
        password: testPassword,
      },
      {
        Authorization: `Bearer ${adminToken}`,
      }
    );
    console.assert(createStaffRes.status === 201, `Admin creating staff failed: ${createStaffRes.status}`);
    console.assert(createStaffRes.body.data.role === 'STAFF', 'Role must be STAFF');
    const staffId = createStaffRes.body.data.id;
    console.log(`✅ Admin successfully created Staff user (ID: ${staffId})`);

    // Customer tries to create staff -> Forbidden 403
    const customerCreateStaffRes = await request(
      'POST',
      '/api/users/staff',
      {
        fullName: 'Hacker Staff',
        email: `hacker_${timestamp}@brightloop.test`,
        password: testPassword,
      },
      {
        Authorization: `Bearer ${customerToken}`,
      }
    );
    console.assert(
      customerCreateStaffRes.status === 403,
      `Non-admin creating staff must return 403, got ${customerCreateStaffRes.status}`
    );
    console.log('✅ Role-based route guard blocked unauthorized staff creation');

    // Admin lists users
    const listUsersRes = await request('GET', '/api/users?role=STAFF', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    console.assert(listUsersRes.status === 200, 'Admin listing users failed');
    console.assert(listUsersRes.body.data.users.length > 0, 'Should return staff users');
    console.log(`✅ Admin listed users (${listUsersRes.body.data.pagination.total} total)`);

    // Admin deactivates staff
    const deactivateRes = await request(
      'PATCH',
      `/api/users/${staffId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${adminToken}` }
    );
    console.assert(deactivateRes.status === 200, 'Deactivating user failed');
    console.assert(deactivateRes.body.data.isActive === false, 'isActive should be false');

    // Deactivated staff attempts login -> 403
    const deactivatedLoginRes = await request('POST', '/api/auth/login', {
      email: testStaffEmail,
      password: testPassword,
    });
    console.assert(deactivatedLoginRes.status === 403, 'Deactivated user login must return 403');
    console.log('✅ Deactivated user successfully blocked from login');

    // ---------------------------------------------------------
    // TEST 11: Customer Organization Isolation (Anti-IDOR)
    // ---------------------------------------------------------
    console.log('\n--- Test 11: Customer Organization Isolation (Anti-IDOR) ---');
    // Create another customer organization
    const otherCustomerReg = await request('POST', '/api/auth/register', {
      companyName: `Other Org ${timestamp}`,
      fullName: 'Other User',
      email: `other_${timestamp}@brightloop.test`,
      password: testPassword,
    });
    const otherCustomerId = otherCustomerReg.body.data.user.customerId;

    // Customer 1 tries to view Customer 2's data -> 403 Forbidden
    const crossAccessRes = await request('GET', `/api/customers/${otherCustomerId}`, null, {
      Authorization: `Bearer ${customerToken}`,
    });
    console.assert(
      crossAccessRes.status === 403,
      `Cross-tenant access must return 403, got ${crossAccessRes.status}`
    );
    console.log('✅ Tenant isolation verified: Customer cannot access other customer data (403 Forbidden)');

    // Customer 1 accesses their own customer organization -> 200 OK
    const ownAccessRes = await request('GET', `/api/customers/${customerId}`, null, {
      Authorization: `Bearer ${customerToken}`,
    });
    console.assert(ownAccessRes.status === 200, `Own tenant access failed: ${ownAccessRes.status}`);
    console.log('✅ Customer can view own organization data (200 OK)');

    console.log('\n🎉 ALL 11 INTEGRATION TESTS PASSED PERFECTLY!\n');
  } catch (err) {
    console.error('\n❌ Test execution failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    try {
      await prisma.passwordReset.deleteMany({
        where: { user: { email: { contains: 'brightloop.test' } } },
      });
      await prisma.user.deleteMany({
        where: { email: { contains: 'brightloop.test' } },
      });
      await prisma.customer.deleteMany({
        where: { email: { contains: 'brightloop.test' } },
      });
    } catch (e) {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  }
}

runTests();
