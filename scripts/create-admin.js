const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email    = 'admin@glorious.com';
  const password = 'Admin@1234';
  const name     = 'Super Admin';

  const hashed = await bcrypt.hash(password, 12);

  // upsert = update if exists, create if not
  const user = await prisma.user.upsert({
    where:  { email },
    update: { password: hashed, isActive: true, role: 'SUPER_ADMIN' },
    create: { name, email, password: hashed, role: 'SUPER_ADMIN', isActive: true },
  });

  console.log('');
  console.log('✅ Admin ready!');
  console.log('   Email:    ' + user.email);
  console.log('   Password: ' + password);
  console.log('   Role:     ' + user.role);
  console.log('');
  console.log('👉 Go to http://localhost:3000/login');
}

main()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
