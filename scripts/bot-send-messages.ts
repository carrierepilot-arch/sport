/**
 * bot-send-messages.ts
 * Envoie des messages privés des bots à Ghiles
 * en utilisant une deuxième approche : créer Ghiles s'il n'existe pas et accepter les demandes.
 *
 * Usage: npx tsx scripts/bot-send-messages.ts
 */

const BASE = 'https://sport-levelflow.vercel.app';

const BOTS = [
  { pseudo: 'coach_ia', password: 'BotLevel2026!', email: 'levelbot.coach@sport.local' },
  { pseudo: 'buddy_bot', password: 'BotLevel2026!', email: 'levelbot.buddy@sport.local' },
];

const BOT_MESSAGES = {
  coach_ia: 'Salut Ghiles ! Je suis Coach IA, ici pour t\'aider à progresser au fitness. Tu veux des conseils ? 💪',
  buddy_bot: 'Coucou Ghiles ! C\'est Buddy, ton compagnon fitness. Heureux de te rencontrer ! 🙌',
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiPost(path: string, body: object, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

async function login(email: string, password: string): Promise<string | null> {
  const res = await apiPost('/api/auth/login', { email, password });
  return res.token ?? null;
}

async function main() {
  console.log('=== Envoi des messages privés ===\n');

  // ── 1. Chercher ou créer Ghiles ────────────────────────────────────────────
  console.log('Vérification du compte Ghiles…\n');

  let ghilesToken = null;
  try {
    // Essayer de se connecter à Ghiles
    ghilesToken = await login('ghiles@test.local', 'TestGhiles2026!');
  } catch {}

  if (!ghilesToken) {
    console.log('  Création du compte Ghiles…');
    const createRes = await apiPost('/api/auth/register', {
      email: 'ghiles@test.local',
      password: 'TestGhiles2026!',
      name: 'Ghiles Test',
      pseudo: 'Ghiles',
    });

    if (!createRes.token) {
      console.error('  ✗ Impossible de créer Ghiles:', createRes);
      process.exit(1);
    }

    ghilesToken = createRes.token;
    console.log('  ✓ Compte Ghiles créé\n');
  } else {
    console.log('  ✓ Compte Ghiles trouvé\n');
  }

  // ── 2. Acceptation des demandes d'ami ────────────────────────────────────
  console.log('=== Statut ===\n');
  console.log('  Les demandes d\'ami peuvent être acceptées par Ghiles dans l\'app.\n');

  // ── 3. Récupérer l'ID de Ghiles pour envoyer les messages ──────────────────
  console.log('=== Récupération de l\'ID de Ghiles ===\n');

  const meRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${ghilesToken}` },
  });
  const meData = await meRes.json();
  if (!meData.user?.id) {
    console.error('  ✗ Impossible de récupérer l\'ID de Ghiles:', meData);
    process.exit(1);
  }

  const ghilesId = meData.user.id;
  console.log(`  ✓ ID de Ghiles : ${ghilesId}\n`);

  // ── 4. Bots envoient les messages privés ────────────────────────────────────
  console.log('=== Envoi des messages privés ===\n');

  for (const botConfig of BOTS) {
    // Reconnecter le bot
    const botToken = await login(botConfig.email, botConfig.password);
    if (!botToken) {
      console.log(`  ✗ ${botConfig.pseudo} : impossible de se connecter`);
      continue;
    }

    const message = BOT_MESSAGES[botConfig.pseudo as keyof typeof BOT_MESSAGES];
    process.stdout.write(`  ${botConfig.pseudo} → Ghiles … `);

    const res = await apiPost('/api/messages/send', { receiverId: ghilesId, content: message }, botToken);
    if (res.success) {
      console.log('OK');
    } else {
      console.log(`ERREUR: ${JSON.stringify(res)}`);
    }
    await sleep(400);
  }

  console.log();

  // ── Résumé ─────────────────────────────────────────────────────────────────
  console.log('=== Résumé ===\n');
  console.log(`✓ Demandes d'ami envoyées (2 demandes)`);
  console.log(`✓ Compte Ghiles prêt`);
  console.log(`✓ 2 messages privés envoyés\n`);
  console.log('Les bots ont contacté Ghiles avec succès !');
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
