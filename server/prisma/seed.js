const prisma = require('../src/config/prisma');
const { hashPassword } = require('../src/utils/password');

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@brightloop.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Brightloop@Admin2026!';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';

  console.log(`Checking for existing admin account (${adminEmail})...`);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`Admin account (${adminEmail}) already exists. Skipping creation.`);
    return;
  }

  const passwordHash = await hashPassword(adminPassword);

  const admin = await prisma.user.create({
    data: {
      fullName: adminName,
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      customerId: null,
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  console.log('✅ Initial Administrator account created successfully:');
  console.log(`   - ID: ${admin.id}`);
  console.log(`   - Name: ${admin.fullName}`);
  console.log(`   - Email: ${admin.email}`);
  console.log(`   - Role: ${admin.role}`);
}

seedAdmin()
  .catch((e) => {
    console.error('❌ Failed to seed admin user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
