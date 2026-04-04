const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  console.log('📧 Modification des emails en @gmail.com...\n');

  const arabicFirstNames = [
    'Mohamed', 'Ali', 'Karim', 'Ibrahim', 'Youssef',
    'Malik', 'Tariq', 'Rashid', 'Noureddine', 'Samir',
    'Adel', 'Jamal', 'Farid', 'Hamza', 'Khalid',
    'Amr', 'Rayan', 'Zain', 'Nasir', 'Hani'
  ];

  const lastNames = [
    'Ben Ali', 'El Amri', 'Khoury', 'Mansour', 'Nasri',
    'Boucher', 'Salam', 'Hassan', 'Medina', 'Saleh',
    'Aziz', 'Rafiq', 'Halim', 'Nazar', 'Hazem',
    'Malik', 'Farsi', 'Anwar', 'Rashid', 'Walid'
  ];

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < arabicFirstNames.length; i++) {
    const firstName = arabicFirstNames[i];
    const lastName = lastNames[i];
    const oldEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}@test.local`;
    const newEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}@gmail.com`;

    process.stdout.write(`[${i + 1}/20] ${firstName} ${lastName}... `);

    try {
      const user = await prisma.user.update({
        where: { email: oldEmail },
        data: { email: newEmail }
      });

      if (user) {
        console.log('✅');
        successCount++;
      } else {
        console.log('❌ (utilisateur non trouvé)');
        failCount++;
      }
    } catch (error) {
      console.log('❌ (' + error.code + ')');
      failCount++;
    }
  }

  console.log('\n✅ Modification terminée!\n');
  console.log('📊 Statistiques:');
  console.log(`  Emails modifiés: ${successCount}/20`);
  console.log(`  Erreurs: ${failCount}/20`);

  if (successCount === 20) {
    console.log('\n🎉 Tous les emails ont été changés en @gmail.com!');
  }

  console.log('\n📋 Nouveaux emails:');
  arabicFirstNames.forEach((firstName, idx) => {
    const lastName = lastNames[idx];
    const newEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}@gmail.com`;
    console.log(`  ${idx + 1}. ${firstName} ${lastName} - ${newEmail}`);
  });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
