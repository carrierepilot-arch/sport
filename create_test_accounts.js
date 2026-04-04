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
  console.log('🔄 Création des deux comptes avec prénoms arabes...\n');

  // Compte 1: Omar
  const user1 = {
    email: 'omar.hassan@test.local',
    nom: 'Hassan',
    prenom: 'Omar',
    password: 'TestOmar2026!',
    passwordConfirm: 'TestOmar2026!'
  };

  console.log('📝 Création du compte 1:', user1.prenom, user1.nom);
  let res = await makeRequest('POST', '/api/auth/register', user1);
  if (res.status !== 200 && res.status !== 201) {
    console.log('❌ Erreur:', res.status, res.data);
    return;
  }
  console.log('✅ Compte créé\n');

  // Compte 2: Ahmed
  const user2 = {
    email: 'ahmed.khalil@test.local',
    nom: 'Khalil',
    prenom: 'Ahmed',
    password: 'TestAhmed2026!',
    passwordConfirm: 'TestAhmed2026!'
  };

  console.log('📝 Création du compte 2:', user2.prenom, user2.nom);
  res = await makeRequest('POST', '/api/auth/register', user2);
  if (res.status !== 200 && res.status !== 201) {
    console.log('❌ Erreur:', res.status, res.data);
    return;
  }
  console.log('✅ Compte créé\n');

  // Login user 1
  console.log('🔐 Connexion', user1.prenom, '...');
  res = await makeRequest('POST', '/api/auth/login', {
    email: user1.email,
    password: user1.password
  });
  if (res.status !== 200) {
    console.log('❌ Erreur login:', res.status, res.data);
    return;
  }
  const token1 = res.data.token;
  console.log('✅ Connecté\n');

  // Register performance for user 1
  console.log('⚽ Enregistrement performance pour', user1.prenom, '...');
  res = await makeRequest('POST', '/api/performances', {
    exercise: 'tractions',
    score: 15,
    visibility: 'public'
  }, token1);
  if (res.status !== 200 && res.status !== 201) {
    console.log('❌ Erreur perf:', res.status, res.data);
    return;
  }
  console.log('✅ Performance enregistrée: 15 tractions\n');

  // Login user 2
  console.log('🔐 Connexion', user2.prenom, '...');
  res = await makeRequest('POST', '/api/auth/login', {
    email: user2.email,
    password: user2.password
  });
  if (res.status !== 200) {
    console.log('❌ Erreur login:', res.status, res.data);
    return;
  }
  const token2 = res.data.token;
  console.log('✅ Connecté\n');

  // Register performance for user 2
  console.log('⚽ Enregistrement performance pour', user2.prenom, '...');
  res = await makeRequest('POST', '/api/performances', {
    exercise: 'dips',
    score: 20,
    visibility: 'public'
  }, token2);
  if (res.status !== 200 && res.status !== 201) {
    console.log('❌ Erreur perf:', res.status, res.data);
    return;
  }
  console.log('✅ Performance enregistrée: 20 dips\n');

  console.log('✅ Tout est prêt!');
  console.log('\n📋 Résumé:');
  console.log('  Compte 1: Omar Hassan - 15 tractions');
  console.log('  Compte 2: Ahmed Khalil - 20 dips');
  console.log('\nIDs de connexion:');
  console.log('  Omar: ' + user1.email + ' / ' + user1.password);
  console.log('  Ahmed: ' + user2.email + ' / ' + user2.password);
}

main().catch(console.error);
