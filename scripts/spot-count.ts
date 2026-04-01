import { prisma } from '../lib/prisma';

async function check() {
  const total = await prisma.spot.count();
  const approved = await prisma.spot.count({ where: { status: 'approved' } });
  const pending = await prisma.spot.count({ where: { status: 'pending' } });
  const withCoords = await prisma.spot.count({ where: { status: 'approved', latitude: { not: null }, longitude: { not: null } } });
  const withCity = await prisma.spot.count({ where: { status: 'approved', city: { not: null } } });
  console.log(`Total spots:     ${total}`);
  console.log(`Approved:        ${approved}`);
  console.log(`Pending:         ${pending}`);
  console.log(`With coords:     ${withCoords}`);
  console.log(`With city:       ${withCity}`);
  await prisma.$disconnect();
}

check().catch(console.error);
