const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const newPassword = 'Admin@1234'; // set what you want here

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const admin = await prisma.user.update({
    where: { email: 'admin@glorious.com' },
    data: {
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });

  console.log('✅ Super Admin Reset Successful!');
  console.log('Email:', admin.email);
  console.log('Password:', newPassword);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });