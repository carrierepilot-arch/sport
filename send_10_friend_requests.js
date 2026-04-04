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
  console.log('👥 10 personnes envoient des demandes d\'ami à Ghiles...\n');

  // Select 10 users from the gmail accounts
  const users = [
    { prenom: 'Khalid', nom: 'Hazem', email: 'khalid.hazem@gmail.com', password: 'TestKhalid2026!' },
    { prenom: 'Amr', nom: 'Malik', email: 'amr.malik@gmail.com', password: 'TestAmr2026!' },
    { prenom: 'Rayan', nom: 'Farsi', email: 'rayan.farsi@gmail.com', password: 'TestRayan2026!' },
    { prenom: 'Zain', nom: 'Anwar', email: 'zain.anwar@gmail.com', password: 'TestZain2026!' },
    { prenom: 'Nasir', nom: 'Rashid', email: 'nasir.rashid@gmail.com', password: 'TestNasir2026!' },
    { prenom: 'Hani', nom: 'Walid', email: 'hani.walid@gmail.com', password: 'TestHani2026!' },
    { prenom: 'Adel', nom: 'Aziz', email: 'adel.aziz@gmail.com', password: 'TestAdel2026!' },
    { prenom: 'Jamal', nom: 'Rafiq', email: 'jamal.rafiq@gmail.com', password: 'TestJamal2026!' },
    { prenom: 'Farid', nom: 'Halim', email: 'farid.halim@gmail.com', password: 'TestFarid2026!' },
    { prenom: 'Hamza', nom: 'Nazar', email: 'hamza.nazar@gmail.com', password: 'TestHamza2026!' }
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
    } else if (res.status === 409) {
      console.log('⏩ (déjà demandé)');
      successCount++;
    } else {
      console.log('❌ (status: ' + res.status + ')');
      failCount++;
    }
  }

  console.log('\n✅ Demandes d\'ami envoyées!\n');
  console.log('📊 Statistiques:');
  console.log(`  Demandes réussies: ${successCount}/10`);
  console.log(`  Erreurs: ${failCount}/10`);

  if (successCount === 10) {
    console.log('\n🎉 Les 10 personnes ont ajouté Ghiles en ami!');
  }
}

main().catch(console.error);
