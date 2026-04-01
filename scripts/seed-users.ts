/**
 * seed-users.ts
 * Inscrit 10 comptes sur l'appli, poste des performances variées
 * et les valide entre utilisateurs pour qu'elles apparaissent sur le classement.
 *
 * Usage: npx tsx scripts/seed-users.ts
 */

const BASE = 'https://sport-levelflow.vercel.app';

const USERS = [
  { name: 'Alexandre Moreau', pseudo: 'alex_moreau',   email: 'alex.moreau92@gmail.com',      password: 'Levelflow123!' },
  { name: 'Nicolas Dubois',   pseudo: 'nico_street',   email: 'nicolas.dubois75@gmail.com',   password: 'Levelflow123!' },
  { name: 'Théo Lambert',     pseudo: 'theo_fit',      email: 'theo.lambert69@gmail.com',     password: 'Levelflow123!' },
  { name: 'Maxime Girard',    pseudo: 'max_gains',     email: 'maxime.girard13@gmail.com',    password: 'Levelflow123!' },
  { name: 'Lucas Bernard',    pseudo: 'lucas_beast',   email: 'lucas.bernard33@gmail.com',    password: 'Levelflow123!' },
  { name: 'Emma Petit',       pseudo: 'emma_athl',     email: 'emma.petit75@gmail.com',       password: 'Levelflow123!' },
  { name: 'Camille Roy',      pseudo: 'cam_power',     email: 'camille.roy67@gmail.com',      password: 'Levelflow123!' },
  { name: 'Julien Fontaine',  pseudo: 'jul_street',    email: 'julien.fontaine44@gmail.com',  password: 'Levelflow123!' },
  { name: 'Antoine Leroy',    pseudo: 'toine_grnd',    email: 'antoine.leroy59@gmail.com',    password: 'Levelflow123!' },
  { name: 'Marie Blanc',      pseudo: 'marie_bl',      email: 'marie.blanc31@gmail.com',      password: 'Levelflow123!' },
];

const EXERCISES = [
  'tractions', 'pompes', 'dips', 'squats',
  'muscle_ups', 'tractions_lestees', 'dips_lestes',
] as const;

type Exercise = typeof EXERCISES[number];

const SCORE_RANGES: Record<Exercise, [number, number]> = {
  tractions:          [5,  25],
  pompes:             [15, 60],
  dips:               [10, 35],
  squats:             [20, 60],
  muscle_ups:         [3,  12],
  tractions_lestees:  [5,  30],
  dips_lestes:        [5,  30],
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // ── 1. Inscription du premier utilisateur (pour obtenir un token) ──────────
  console.log('=== Inscription des utilisateurs ===\n');

  type RegisteredUser = {
    token: string;
    userId: string;
    pseudo: string;
    name: string;
    performanceIds: string[];
  };

  const registered: RegisteredUser[] = [];

  for (const user of USERS) {
    process.stdout.write(`  Inscription de ${user.pseudo}... `);
    const data = await apiPost('/api/auth/register', user);
    if (data.token) {
      registered.push({
        token: data.token,
        userId: data.user.id,
        pseudo: user.pseudo,
        name: user.name,
        performanceIds: [],
      });
      console.log(`OK (id=${data.user.id})`);
    } else {
      console.log(`ERREUR: ${JSON.stringify(data)}`);
    }
    await sleep(400);
  }

  console.log(`\n${registered.length}/10 comptes créés\n`);
  if (registered.length === 0) {
    console.error('Aucun compte créé — abandon');
    process.exit(1);
  }

  // ── 2. Récupérer des spots IDs (avec le token du premier utilisateur) ───────
  console.log('Récupération des spots...');
  const firstToken = registered[0].token;
  const spotsRes = await fetch(`${BASE}/api/performances/spots?limit=100`, {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  const spotsData = await spotsRes.json();
  const spotIds: string[] = (spotsData.spots ?? []).map((s: any) => s.id);
  if (spotIds.length === 0) {
    console.error('Aucun spot trouvé — vérifiez l\'API');
    process.exit(1);
  }
  console.log(`${spotIds.length} spots disponibles\n`);
  console.log('=== Ajout des performances ===\n');

  for (const user of registered) {
    const count = randInt(3, 5);
    const exercises = pickN([...EXERCISES], count) as Exercise[];
    console.log(`  ${user.pseudo} — ${count} performance(s):`);

    for (const exercise of exercises) {
      const [min, max] = SCORE_RANGES[exercise];
      const score = randInt(min, max);
      const spotId = pickRandom(spotIds);

      const data = await apiPost(
        '/api/performances',
        { spotId, exercise, score, visibility: 'public' },
        user.token,
      );

      if (data.performance?.id) {
        user.performanceIds.push(data.performance.id);
        console.log(`    + ${exercise}: ${score} — id=${data.performance.id}`);
      } else {
        console.log(`    ✗ ${exercise}: ${JSON.stringify(data)}`);
      }
      await sleep(300);
    }
    console.log();
  }

  const totalPerfs = registered.reduce((sum, u) => sum + u.performanceIds.length, 0);
  console.log(`${totalPerfs} performances créées\n`);

  // ── 4. Valider les performances (2 validateurs différents par perf) ─────────
  console.log('=== Validation des performances ===\n');

  let validatedCount = 0;

  for (const owner of registered) {
    if (owner.performanceIds.length === 0) continue;

    // Choisit 2 validateurs parmi les autres utilisateurs inscrits
    const others = registered.filter((u) => u.userId !== owner.userId);
    const validators = pickN(others, Math.min(2, others.length));

    for (const perfId of owner.performanceIds) {
      let accepted = 0;
      for (const validator of validators) {
        const data = await apiPost(
          '/api/performances/validate',
          { action: 'respond', performanceId: perfId, isValid: true },
          validator.token,
        );
        if (data.ok) {
          accepted = data.accepted ?? accepted + 1;
          process.stdout.write('.');
        } else {
          process.stdout.write('x');
        }
        await sleep(200);
      }
      if (accepted >= 2) {
        validatedCount++;
        process.stdout.write(' ✓\n');
      } else {
        process.stdout.write(` (${accepted}/2)\n`);
      }
    }
  }

  console.log(`\n${validatedCount}/${totalPerfs} performances validées\n`);

  // ── Résumé ─────────────────────────────────────────────────────────────────
  console.log('=== Résumé ===\n');
  for (const u of registered) {
    console.log(`  ${u.pseudo.padEnd(14)} — ${u.performanceIds.length} perf(s) — id=${u.userId}`);
  }
  console.log('\nTerminé.');
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
