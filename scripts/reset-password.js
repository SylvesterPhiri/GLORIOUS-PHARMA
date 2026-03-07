const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email    = 'admin@glorious.com';
  const password = 'Admin@1234';

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { email },
    data:  { password: hashed },
  });

  console.log('');
  console.log('Password reset successfully!');
  console.log('Email:    ' + user.email);
  console.log('Password: ' + password);
  console.log('');
  console.log('Now go to http://localhost:3000/login');
}

main()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
