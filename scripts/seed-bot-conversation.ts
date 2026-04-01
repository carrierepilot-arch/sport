/**
 * seed-bot-conversation.ts
 * Crée 2 comptes bot + un post initial,
 * puis les fait converser alternativement dans le feed (2 messages chacun).
 *
 * Usage: npx tsx scripts/seed-bot-conversation.ts
 */

const BASE = 'https://sport-levelflow.vercel.app';

const BOTS = [
  {
    name: 'Levelsense Coach',
    pseudo: 'coach_ia',
    email: 'levelbot.coach@sport.local',
    password: 'BotLevel2026!',
  },
  {
    name: 'Levelsense Companion',
    pseudo: 'buddy_bot',
    email: 'levelbot.buddy@sport.local',
    password: 'BotLevel2026!',
  },
];

const MESSAGES = {
  coach_ia: [
    "Salut ! Je remarque que beaucoup d'entre vous progressent super bien sur les tractions. Continuez comme ça !",
    'Excellent ! Avez-vous remarqué à quel point la progression est plus rapide avec une bonne alimentation ?',
  ],
  buddy_bot: [
    'Coucou Coach ! C\'est vrai, j\'ai vu qu\'une bonne nutrition fait vraiment la différence. Des conseils à partager ?',
    'Oui, exactement ! Et en combinant ça avec du repos régulier, c\'est imbattable. Merci pour les tips !',
  ],
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

async function main() {
  console.log('=== Inscription des bots ===\n');

  type BotUser = {
    pseudo: string;
    name: string;
    token: string;
    userId: string;
  };

  const bots: BotUser[] = [];

  for (const bot of BOTS) {
    process.stdout.write(`  ${bot.pseudo.padEnd(14)} … `);
    const data = await apiPost('/api/auth/register', {
      email: bot.email,
      password: bot.password,
      name: bot.name,
      pseudo: bot.pseudo,
    });

    if (data.token) {
      bots.push({
        pseudo: bot.pseudo,
        name: bot.name,
        token: data.token,
        userId: data.user.id,
      });
      console.log(`OK (id=${data.user.id})`);
    } else {
      console.log(`ERREUR: ${JSON.stringify(data)}`);
    }
    await sleep(400);
  }

  if (bots.length < 2) {
    console.error('Impossible de créer les 2 bots. Abandon.');
    process.exit(1);
  }

  console.log('\n=== Conversation dans le feed ===\n');

  // ── 1. Bot A (coach_ia) poste un message initial ──
  const coachBot = bots.find((b) => b.pseudo === 'coach_ia')!;
  const buddyBot = bots.find((b) => b.pseudo === 'buddy_bot')!;

  console.log(`${coachBot.pseudo} poste un message initial…`);
  const initialPost = await apiPost(
    '/api/feed',
    { content: MESSAGES.coach_ia[0] },
    coachBot.token,
  );

  if (!initialPost.post?.id) {
    console.error('Impossible de créer le post initial:', initialPost);
    process.exit(1);
  }

  const postId = initialPost.post.id;
  console.log(`  → Post créé (id=${postId})\n`);
  await sleep(500);

  // ── 2. Bot B (buddy_bot) répond au post ──
  console.log(`${buddyBot.pseudo} répond…`);
  const reply1 = await apiPost(
    `/api/feed/${postId}/replies`,
    { content: MESSAGES.buddy_bot[0] },
    buddyBot.token,
  );
  if (reply1.success) {
    console.log(`  → Réponse postée\n`);
  } else {
    console.log(`  ✗ Erreur: ${JSON.stringify(reply1)}\n`);
  }
  await sleep(500);

  // ── 3. Bot A (coach_ia) répond ──
  console.log(`${coachBot.pseudo} répond…`);
  const reply2 = await apiPost(
    `/api/feed/${postId}/replies`,
    { content: MESSAGES.coach_ia[1] },
    coachBot.token,
  );
  if (reply2.success) {
    console.log(`  → Réponse postée\n`);
  } else {
    console.log(`  ✗ Erreur: ${JSON.stringify(reply2)}\n`);
  }
  await sleep(500);

  // ── 4. Bot B (buddy_bot) répond à nouveau ──
  console.log(`${buddyBot.pseudo} répond…`);
  const reply3 = await apiPost(
    `/api/feed/${postId}/replies`,
    { content: MESSAGES.buddy_bot[1] },
    buddyBot.token,
  );
  if (reply3.success) {
    console.log(`  → Réponse postée\n`);
  } else {
    console.log(`  ✗ Erreur: ${JSON.stringify(reply3)}\n`);
  }
  await sleep(500);

  // ── Résumé ──
  console.log('=== Résumé ===\n');
  console.log(`✓ 2 bots créés:`);
  console.log(`  • ${coachBot.pseudo} (${coachBot.name})`);
  console.log(`  • ${buddyBot.pseudo} (${buddyBot.name})`);
  console.log(`\n✓ Conversation lancée dans le feed:`);
  console.log(`  1. ${coachBot.pseudo} poste un message initial`);
  console.log(`  2. ${buddyBot.pseudo} répond`);
  console.log(`  3. ${coachBot.pseudo} répond`);
  console.log(`  4. ${buddyBot.pseudo} répond à nouveau`);
  console.log('\nTerminé. Ils discutent maintenant dans le feed !');
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
