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
  console.log('👥 5 personnes ajoutent Ghiles en ami...\n');

  // Select 5 users from the 20 created
  const users = [
    { prenom: 'Mohamed', nom: 'Ben Ali', email: 'mohamed.benali@test.local', password: 'TestMohamed2026!' },
    { prenom: 'Ali', nom: 'El Amri', email: 'ali.elamri@test.local', password: 'TestAli2026!' },
    { prenom: 'Karim', nom: 'Khoury', email: 'karim.khoury@test.local', password: 'TestKarim2026!' },
    { prenom: 'Ibrahim', nom: 'Mansour', email: 'ibrahim.mansour@test.local', password: 'TestIbrahim2026!' },
    { prenom: 'Youssef', nom: 'Nasri', email: 'youssef.nasri@test.local', password: 'TestYoussef2026!' }
  ];

  let successCount = 0;
  let failCount = 0;

  for (const user of users) {
    process.stdout.write(`${user.prenom} ${user.nom}... `);

    // Login
    let res = await makeRequest('POST', '/api/auth/login', {
      email: user.email,
      password: user.password
    });

    if (res.status !== 200) {
      console.log('❌ (login failed)');
      failCount++;
      continue;
    }

    const token = res.data.token;

    // Send friend request to Ghiles
    res = await makeRequest('POST', '/api/friends/send', {
      pseudo: 'Ghiles'
    }, token);

    if (res.status === 200 || res.status === 201) {
      console.log('✅');
      successCount++;
    } else {
      console.log('❌ (friend request failed: ' + res.status + ')');
      failCount++;
    }
  }

  console.log('\n✅ Demandes d\'ami envoyées!\n');
  console.log('📊 Statistiques:');
  console.log(`  Demandes réussies: ${successCount}/5`);
  console.log(`  Erreurs: ${failCount}/5`);

  if (successCount === 5) {
    console.log('\n🎉 Les 5 personnes ont ajouté Ghiles en ami!');
  }
}

main().catch(console.error);
