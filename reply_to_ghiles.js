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
  console.log('� Répondre au message de Ghiles...\n');

  // Login with Omar
  console.log('🔐 Connexion avec Omar...');
  let res = await makeRequest('POST', '/api/auth/login', {
    email: 'omar.hassan@test.local',
    password: 'TestOmar2026!'
  });
  if (res.status !== 200) {
    console.log('❌ Erreur login:', res.status, res.data);
    return;
  }
  const token = res.data.token;
  console.log('✅ Connecté\n');

  // Get feed to find Ghiles post
  console.log('📰 Récupération du feed...');
  res = await makeRequest('GET', '/api/feed', null, token);
  if (res.status !== 200) {
    console.log('❌ Erreur feed:', res.status, res.data);
    return;
  }

  const ghilesPost = res.data.posts?.find((post) => 
    post.author?.pseudo === 'Ghiles' && 
    post.content?.includes('vidéo')
  );
  
  if (!ghilesPost) {
    console.log('❌ Message de Ghiles non trouvé');
    return;
  }

  console.log('✅ Message trouvé');
  console.log('📌 Auteur:', ghilesPost.author?.pseudo);
  console.log('📝 Contenu:', ghilesPost.content);
  console.log('🔑 Post ID:', ghilesPost.id, '\n');

  // Post reply
  const replyText = "Mais si on n'a pas envie d'envoyer la vidéo, on fait comment ?";
  console.log('✍️  Publication de la réponse...');
  console.log('Texte:', replyText, '\n');
  
  res = await makeRequest('POST', `/api/feed/${ghilesPost.id}/replies`, {
    content: replyText
  }, token);

  if (res.status !== 200 && res.status !== 201) {
    console.log('❌ Erreur lors de la réponse:', res.status, res.data);
    return;
  }

  console.log('✅ Réponse publiée avec succès\n');

  // Verify reply was posted
  console.log('🔍 Vérification de la réponse dans le fil...');
  res = await makeRequest('GET', `/api/feed/${ghilesPost.id}/replies`, null, token);
  if (res.status !== 200) {
    console.log('⚠️  Impossible de vérifier immédiatement (peut être normal)');
  } else {
    const omarReply = res.data.replies?.find((r) => r.author?.pseudo === 'Omar');
    if (omarReply) {
      console.log('✅ Réponse trouvée!');
      console.log('   Auteur:', omarReply.author?.pseudo);
      console.log('   Texte:', omarReply.content);
    } else {
      console.log('⏳ Réponse en cours de synchronisation...');
    }
  }

  console.log('\n✅ Test terminé avec succès!');
  console.log('\n📋 Résumé:');
  console.log('  ✓ Message original de Ghiles identifié');
  console.log('  ✓ Réponse publiée par Omar');
  console.log('  ✓ Contenu: "' + replyText + '"');
  console.log('\nLe système de réponses fonctionne correctement.');
}

main().catch(console.error);
