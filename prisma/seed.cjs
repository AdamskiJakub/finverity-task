const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const program = await prisma.program.upsert({
    where: { id: 'prog_001' },
    update: {},
    create: {
      id: 'prog_001',
      name: 'Main Financing Program',
      currency: 'USD',
      totalLimit: 10_000_00,
      reservedAmount: 0,
      version: 1,
    },
  });

  console.log(`Created program: ${program.id} (${program.name})`);
  console.log(`  Currency: ${program.currency}`);
  console.log(
    `  Total limit: ${program.totalLimit} (${program.totalLimit / 100} ${program.currency})`,
  );
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
