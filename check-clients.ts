// Check existing clients
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      type: true
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log('Existing clients:')
  console.log(JSON.stringify(clients, null, 2))
  console.log(`\nTotal: ${clients.length} clients`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
