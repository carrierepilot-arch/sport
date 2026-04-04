#!/usr/bin/env node

import { prisma } from '@/lib/prisma';

async function main() {
  console.log('🔍 Recherche des utilisateurs avec @test.local...\n');

  const users = await prisma.user.findMany({
    where: {
      email: {
        contains: '@test.local'
      }
    },
    select: {
      id: true,
      email: true,
      name: true,
      pseudo: true
    }
  });

  console.log(`Trouvé ${users.length} utilisateurs avec @test.local\n`);

  for (const user of users) {
    console.log(`${user.pseudo} (${user.name}): ${user.email}`);
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
