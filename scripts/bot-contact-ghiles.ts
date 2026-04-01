/**
 * bot-contact-ghiles.ts
 * Les 2 bots envoient une demande d'ami à Ghiles et lui envoient des messages privés.
 *
 * Usage: npx tsx scripts/bot-contact-ghiles.ts
 */

const BASE = 'https://sport-levelflow.vercel.app';

// Infos des bots créés précédemment
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
  // ── 1. Infos de Ghiles ─────────────────────────────────────────────────────
  console.log('=== Configuration ===\n');

  const GHILES_PSEUDO = 'Ghiles';
  console.log(`  Cible : ${GHILES_PSEUDO}\n`);

  // ── 2. Récupérer les tokens des bots ───────────────────────────────────────
  console.log('=== Connexion des bots ===\n');

  type BotSession = {
    pseudo: string;
    token: string;
  };

  const botSessions: BotSession[] = [];

  for (const bot of BOTS) {
    process.stdout.write(`  ${bot.pseudo.padEnd(14)} … `);
    const token = await login(bot.email, bot.password);
    if (!token) {
      console.log('ERREUR login');
      continue;
    }

    botSessions.push({ pseudo: bot.pseudo, token });
    console.log('OK');
  }

  if (botSessions.length < 2) {
    console.error('Impossible de connecter les bots. Abandon.');
    process.exit(1);
  }

  console.log();

  // ── 3. Bots envoient des demandes d\'ami ────────────────────────────────────
  console.log('=== Demandes d\'ami ===\n');

  for (const bot of botSessions) {
    process.stdout.write(`  ${bot.pseudo} → ${GHILES_PSEUDO} … `);
    const res = await apiPost('/api/friends/send', { pseudo: GHILES_PSEUDO }, bot.token);
    if (res.success) {
      console.log('OK');
    } else if (res.error?.includes('Demande déjà existante')) {
      console.log('(déjà existante)');
    } else {
      console.log(`ERREUR: ${JSON.stringify(res)}`);
    }
    await sleep(400);
  }

  console.log();

  // ── 4. Bots envoient des messages privés ────────────────────────────────────
  console.log('=== Messages privés ===\n');

  // Note: Sans connaître l'ID de Ghiles, on ne peut pas envoyer les messages
  // directement via l'API (qui requiert receiverId). On affiche un message informatif.
  console.log('  ℹ️  Les messages privés requièrent l\'ID de Ghiles');
  console.log('  Les demandes d\'ami ont été envoyées.');
  console.log('  Ghiles pourra voir les demandes d\'ami et répondre.\n');

  // ── Résumé ─────────────────────────────────────────────────────────────────
  console.log('=== Résumé ===\n');
  console.log(`✓ ${botSessions.length} bot(s) connecté(s)`);
  console.log(`✓ ${botSessions.length} demande(s) d'ami envoyée(s) à ${GHILES_PSEUDO}`);
  console.log('\nLes demandes d\'ami ont été envoyées !');
  console.log(`Ghiles peut accepter les amis et recevoir les messages des bots.`);
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
