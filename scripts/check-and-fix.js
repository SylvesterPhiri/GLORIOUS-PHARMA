const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email    = 'admin@glorious.com';
  const password = 'Admin@1234';

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log('NO USER FOUND - creating...');
    const hash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { name: 'Super Admin', email, password: hash, role: 'SUPER_ADMIN', isActive: true }
    });
    console.log('Created. Try login now.');
    return;
  }

  console.log('User found:', user.email, '| isActive:', user.isActive);
  console.log('Stored hash:', user.password);

  const match = await bcrypt.compare(password, user.password);
  console.log('Password matches:', match);

  if (!match) {
    console.log('Fixing password...');
    const hash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { email }, data: { password: hash } });
    const recheck = await bcrypt.compare(password, hash);
    console.log('Re-check after fix:', recheck);
    console.log('DONE. Try login now.');
  } else {
    console.log('Password is fine. Check your auth.ts path.');
    console.log('Does C:\\glorious\\src\\lib\\auth.ts exist?');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
