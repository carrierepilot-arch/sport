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
  console.log('🔍 Inspection du Feed...\n');

  // Login with Omar
  console.log('🔐 Connexion...');
  let res = await makeRequest('POST', '/api/auth/login', {
    email: 'omar.hassan@test.local',
    password: 'TestOmar2026!'
  });
  const token = res.data.token;
  console.log('✅ Connecté\n');

  // Get feed
  console.log('📰 Récupération du feed...');
  res = await makeRequest('GET', '/api/feed', null, token);

  console.log('Status:', res.status);
  console.log('Structure:', JSON.stringify(res.data, null, 2).substring(0, 2000));

  // Find Ghiles post
  if (res.data.posts) {
    console.log('\n🔍 Recherche de posts de Ghiles...');
    res.data.posts.forEach((post, idx) => {
      console.log(`\n[${idx}] Post:`);
      console.log('  Keys:', Object.keys(post));
      console.log('  author:', post.author?.pseudo);
      console.log('  content:', post.content?.substring(0, 60));
      console.log('  description:', post.description?.substring(0, 60));
      console.log('  id:', post.id);
    });
  }
}

main().catch(console.error);
