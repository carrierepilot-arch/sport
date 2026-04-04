const https = require('https');

function makeRequest(method, path, bodyData = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sport-levelflow.vercel.app',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });

    req.on('error', reject);
    if (bodyData) req.write(JSON.stringify(bodyData));
    req.end();
  });
}

async function main() {
  console.log('📧 Création de 20 comptes avec emails @gmail.com...\n');

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
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}@gmail.com`;
    const password = `Test${firstName}2026!`;

    const user = {
      email: email,
      pseudo: firstName,
      name: `${firstName} ${lastName}`,
      password: password,
      passwordConfirm: password
    };

    process.stdout.write(`[${i + 1}/20] ${firstName} ${lastName}... `);

    const res = await makeRequest('POST', '/api/auth/register', user);
    
    if (res.status === 200 || res.status === 201) {
      console.log('✅');
      successCount++;
    } else {
      if (res.status === 409) {
        console.log('⏩ (existe déjà)');
      } else {
        console.log('❌ (status: ' + res.status + ')');
        failCount++;
      }
    }
  }

  console.log('\n✅ Création terminée!\n');
  console.log('📊 Statistiques:');
  console.log(`  Comptes créés: ${successCount}/20`);
  console.log(`  Erreurs: ${failCount}/20`);
  
  if (successCount + (20 - successCount - failCount) >= 20) {
    console.log('\n🎉 Les 20 comptes avec emails @gmail.com sont maintenant actifs!');
  }

  console.log('\n📋 Comptes avec emails @gmail.com:');
  arabicFirstNames.forEach((firstName, idx) => {
    const lastName = lastNames[idx];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}@gmail.com`;
    const password = `Test${firstName}2026!`;
    console.log(`  ${idx + 1}. ${firstName} ${lastName} - ${email}`);
  });
}

main().catch(console.error);
