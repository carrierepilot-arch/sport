/**
 * seed-feed-scenario.ts
 *
 * 1. Re-send correct friend requests from bots → real Ghiles (by email)
 * 2. Bot 1 (coach_ia) posts in the feed
 * 3. Bot 2 (buddy_bot) replies ~3 min later (simulated via DB-created timestamp)
 *
 * Usage: npx tsx scripts/seed-feed-scenario.ts
 */

const BASE = 'https://sport-levelflow.vercel.app';

const BOTS = [
  { pseudo: 'coach_ia',  email: 'levelbot.coach@sport.local', password: 'BotLevel2026!' },
  { pseudo: 'buddy_bot', email: 'levelbot.buddy@sport.local', password: 'BotLevel2026!' },
];

// Real Ghiles account (identified by email to avoid pseudo collision)
const GHILES_EMAIL = 'ghiles@test.local';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiPost(path: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: false, status: res.status, data: text }; }
}

async function apiGet(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: false, status: res.status, data: text }; }
}

async function login(email: string, password: string): Promise<{ token: string; userId: string } | null> {
  const r = await apiPost('/api/auth/login', { email, password });
  if (r.ok && r.data.token) return { token: r.data.token, userId: r.data.user?.id };
  return null;
}

async function main() {
  console.log('=== Connexion des bots ===\n');

  type BotSession = { pseudo: string; token: string; userId: string };
  const sessions: BotSession[] = [];

  for (const bot of BOTS) {
    process.stdout.write(`  ${bot.pseudo.padEnd(14)} … `);
    const sess = await login(bot.email, bot.password);
    if (!sess) { console.log('ERREUR login'); continue; }
    sessions.push({ pseudo: bot.pseudo, ...sess });
    console.log(`OK (id=${sess.userId})`);
    await sleep(300);
  }

  if (sessions.length < 2) {
    console.error('\nImpossible de connecter les 2 bots. Abandon.');
    process.exit(1);
  }

  const coach = sessions.find((s) => s.pseudo === 'coach_ia')!;
  const buddy = sessions.find((s) => s.pseudo === 'buddy_bot')!;

  // ── 1. Récupérer l'ID réel de Ghiles (par email) ──────────────────────────
  console.log('\n=== Identification de Ghiles ===\n');

  const ghilesLogin = await login(GHILES_EMAIL, 'TestGhiles2026!');
  if (!ghilesLogin) {
    console.error('  ✗ Connexion Ghiles impossible — abandon.');
    process.exit(1);
  }
  const ghilesId = ghilesLogin.userId;
  console.log(`  ID Ghiles réel : ${ghilesId}`);

  const meRes = await apiGet('/api/auth/me', ghilesLogin.token);
  console.log(`  Pseudo : ${meRes.data?.user?.pseudo}\n`);

  // ── 2. Re-send friend requests via email (avoid pseudo collision) ──────────
  console.log('=== Demandes d\'ami → Ghiles (email) ===\n');

  for (const bot of sessions) {
    process.stdout.write(`  ${bot.pseudo} → ${GHILES_EMAIL} … `);
    const r = await apiPost('/api/friends/send', { pseudo: GHILES_EMAIL }, bot.token);
    if (r.ok && r.data.success) {
      console.log('OK');
    } else if (r.data?.error?.includes('déjà existante') || r.data?.error?.includes('already')) {
      console.log('(demande déjà envoyée au bon utilisateur)');
    } else {
      console.log(`${r.status}: ${JSON.stringify(r.data)}`);
    }
    await sleep(400);
  }

  // ── 3. Vérifier que Ghiles voit les demandes ───────────────────────────────
  console.log('\n=== Vérification côté Ghiles ===\n');

  const friendList = await apiGet('/api/friends/list', ghilesLogin.token);
  const recus = friendList.data?.recus ?? [];
  console.log(`  Demandes reçues : ${recus.length}`);
  for (const r of recus) {
    console.log(`    - ${r.pseudo} (id demande: ${r.id})`);
  }

  const pendingCount = await apiGet('/api/friends/pending-count', ghilesLogin.token);
  console.log(`  pending-count : ${pendingCount.data?.count}`);

  // ── 4. Bot 1 poste dans le feed ────────────────────────────────────────────
  console.log('\n=== Publication dans le feed ===\n');

  const postContent =
    "c comment ici ? j'avais une question, je fais 14 tractions max et j'aimerais monter à 20, vous faites comment vous ?";

  process.stdout.write(`  coach_ia poste … `);
  const postRes = await apiPost('/api/feed', { content: postContent }, coach.token);
  if (!postRes.ok || !postRes.data?.post?.id) {
    console.log(`ERREUR: ${JSON.stringify(postRes.data)}`);
    process.exit(1);
  }
  const postId = postRes.data.post.id;
  console.log(`OK (id=${postId})`);

  // ── 5. Attendre ~3 min (simulé : 180 000ms → réduit à 3s pour le test) ─────
  // En prod, on insère directement via reply avec un délai réel symbolique.
  // Pour ne pas bloquer le script, on attend 3 secondes seulement,
  // mais le timestamp réel de la réponse sera postérieur de quelques secondes.
  console.log('\n  Pause 5 secondes (simule le délai 3 min côté affichage)…');
  await sleep(5000);

  // ── 6. Bot 2 répond ───────────────────────────────────────────────────────
  process.stdout.write(`  buddy_bot répond … `);
  const replyRes = await apiPost(
    `/api/feed/${postId}/replies`,
    { content: "ouais je vois, viens en pv si tu veux je t'explique" },
    buddy.token,
  );
  if (replyRes.ok && (replyRes.data?.success || replyRes.data?.reply)) {
    console.log('OK');
  } else {
    console.log(`ERREUR: ${JSON.stringify(replyRes.data)}`);
  }

  // ── 7. Récap ──────────────────────────────────────────────────────────────
  console.log('\n===============================');
  console.log('RÉSUMÉ');
  console.log('===============================');
  console.log(`Post feed   : ${postId}`);
  console.log(`Demandes ami: ${recus.length} reçues par Ghiles`);
  console.log('\nOuvre le feed sur https://sport-levelflow.vercel.app/dashboard/social');
  console.log('Connecte-toi en tant que Ghiles pour voir les demandes d\'ami.');
}

main().catch((e) => { console.error(e); process.exit(1); });
