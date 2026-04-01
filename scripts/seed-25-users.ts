/**
 * seed-25-users.ts
 * Inscrit 25 comptes, ajoute des avatars animés/cartoon pour 13 d'entre eux,
 * poste des performances variées (min 3 par user) et les valide entre utilisateurs.
 *
 * Usage: npx tsx scripts/seed-25-users.ts
 */

import { FormData as NodeFormData } from 'undici';

const BASE = 'https://sport-levelflow.vercel.app';

// ── 25 profils réalistes ────────────────────────────────────────────────────
const USERS = [
  { name: 'Raphaël Morin',      pseudo: 'raph_morin',    email: 'raphael.morin77@gmail.com',    password: 'Levelflow123!', avatar: true  },
  { name: 'Baptiste Renard',    pseudo: 'bap_street',    email: 'baptiste.renard92@gmail.com',  password: 'Levelflow123!', avatar: true  },
  { name: 'Clément Giraud',     pseudo: 'clem_g',        email: 'clement.giraud38@gmail.com',   password: 'Levelflow123!', avatar: true  },
  { name: 'Florian Dupont',     pseudo: 'flo_power',     email: 'florian.dupont69@gmail.com',   password: 'Levelflow123!', avatar: true  },
  { name: 'Hugo Mercier',       pseudo: 'hugo_fit',      email: 'hugo.mercier59@gmail.com',     password: 'Levelflow123!', avatar: true  },
  { name: 'Axel Simon',         pseudo: 'axel_sim',      email: 'axel.simon75@gmail.com',       password: 'Levelflow123!', avatar: true  },
  { name: 'Dylan Perrin',       pseudo: 'dyl_beast',     email: 'dylan.perrin31@gmail.com',     password: 'Levelflow123!', avatar: true  },
  { name: 'Kévin Laurent',      pseudo: 'kev_street',    email: 'kevin.laurent13@gmail.com',    password: 'Levelflow123!', avatar: true  },
  { name: 'Tom Rousseau',       pseudo: 'tom_rdx',       email: 'tom.rousseau44@gmail.com',     password: 'Levelflow123!', avatar: true  },
  { name: 'Yanis Benali',       pseudo: 'yanis_b',       email: 'yanis.benali93@gmail.com',     password: 'Levelflow123!', avatar: true  },
  { name: 'Inès Fournier',      pseudo: 'ines_fit',      email: 'ines.fournier67@gmail.com',    password: 'Levelflow123!', avatar: true  },
  { name: 'Léa Marchand',       pseudo: 'lea_m',         email: 'lea.marchand75@gmail.com',     password: 'Levelflow123!', avatar: true  },
  { name: 'Jade Lefebvre',      pseudo: 'jade_lft',      email: 'jade.lefebvre42@gmail.com',    password: 'Levelflow123!', avatar: true  },
  { name: 'Pierre Dupuis',      pseudo: 'pierre_dp',     email: 'pierre.dupuis33@gmail.com',    password: 'Levelflow123!', avatar: false },
  { name: 'Vincent Thomas',     pseudo: 'vinc_thm',      email: 'vincent.thomas57@gmail.com',   password: 'Levelflow123!', avatar: false },
  { name: 'Samuel Blanc',       pseudo: 'sam_blc',       email: 'samuel.blanc76@gmail.com',     password: 'Levelflow123!', avatar: false },
  { name: 'Romain Pichon',      pseudo: 'romain_pch',    email: 'romain.pichon83@gmail.com',    password: 'Levelflow123!', avatar: false },
  { name: 'Adrien Faure',       pseudo: 'adri_f',        email: 'adrien.faure69@gmail.com',     password: 'Levelflow123!', avatar: false },
  { name: 'Mathieu Leblanc',    pseudo: 'mat_lbl',       email: 'mathieu.leblanc34@gmail.com',  password: 'Levelflow123!', avatar: false },
  { name: 'Théophile Martin',   pseudo: 'theo_mrt',      email: 'theophile.martin86@gmail.com', password: 'Levelflow123!', avatar: false },
  { name: 'Chloé Bourgeois',    pseudo: 'chloe_bgs',     email: 'chloe.bourgeois91@gmail.com',  password: 'Levelflow123!', avatar: false },
  { name: 'Margot Colin',       pseudo: 'margot_c',      email: 'margot.colin25@gmail.com',     password: 'Levelflow123!', avatar: false },
  { name: 'Zoé Garnier',        pseudo: 'zoe_g',         email: 'zoe.garnier62@gmail.com',      password: 'Levelflow123!', avatar: false },
  { name: 'Lena Bonnet',        pseudo: 'lena_bnt',      email: 'lena.bonnet74@gmail.com',      password: 'Levelflow123!', avatar: false },
  { name: 'Noémie Roland',      pseudo: 'noemie_r',      email: 'noemie.roland07@gmail.com',    password: 'Levelflow123!', avatar: false },
];

// ── Styles DiceBear (cartoon / animé) ──────────────────────────────────────
const AVATAR_STYLES = [
  'adventurer',
  'avataaars',
  'big-ears-neutral',
  'croodles',
  'fun-emoji',
  'lorelei',
  'micah',
  'miniavs',
  'notionists',
  'open-peeps',
  'personas',
  'pixel-art',
  'thumbs',
];

const EXERCISES = [
  'tractions', 'pompes', 'dips', 'squats',
  'muscle_ups', 'tractions_lestees', 'dips_lestes',
] as const;

type Exercise = typeof EXERCISES[number];

const SCORE_RANGES: Record<Exercise, [number, number]> = {
  tractions:          [5,  28],
  pompes:             [15, 65],
  dips:               [8,  40],
  squats:             [20, 65],
  muscle_ups:         [2,  14],
  tractions_lestees:  [5,  35],
  dips_lestes:        [5,  35],
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiPost(path: string, body: object, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return res.json();
}

// ── Télécharge une image DiceBear et l'upload comme avatar ─────────────────
async function uploadAvatar(pseudo: string, token: string): Promise<boolean> {
  try {
    const style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
    const bg = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'][Math.floor(Math.random() * 5)];
    const avatarUrl = `https://api.dicebear.com/8.x/${style}/png?seed=${encodeURIComponent(pseudo)}&backgroundColor=${bg}&size=256`;

    const imgRes = await fetch(avatarUrl);
    if (!imgRes.ok) {
      console.log(`    [avatar] échec téléchargement DiceBear pour ${pseudo}`);
      return false;
    }
    const imgBuffer = await imgRes.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);

    // Construit le FormData en Node.js natif
    const form = new NodeFormData();
    // Simule un File avec les bytes PNG
    const blob = new Blob([imgBytes], { type: 'image/png' });
    form.append('avatar', blob, `${pseudo}.png`);

    const uploadRes = await fetch(`${BASE}/api/user/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form as any,
    });
    const data = await uploadRes.json();
    if (data.success) {
      console.log(`    [avatar] ${style} → OK`);
      return true;
    } else {
      console.log(`    [avatar] erreur: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (e) {
    console.log(`    [avatar] exception: ${e}`);
    return false;
  }
}

async function main() {
  // ── 1. Inscription des 25 comptes ─────────────────────────────────────────
  console.log('=== Inscription des utilisateurs ===\n');

  type Registered = {
    token: string;
    userId: string;
    pseudo: string;
    name: string;
    performanceIds: string[];
    wantsAvatar: boolean;
  };

  const registered: Registered[] = [];

  for (const user of USERS) {
    process.stdout.write(`  ${user.pseudo.padEnd(16)} … `);
    const data = await apiPost('/api/auth/register', {
      email: user.email,
      password: user.password,
      name: user.name,
      pseudo: user.pseudo,
    });
    if (data.token) {
      registered.push({
        token: data.token,
        userId: data.user.id,
        pseudo: user.pseudo,
        name: user.name,
        performanceIds: [],
        wantsAvatar: user.avatar,
      });
      console.log(`OK  (id=${data.user.id})`);
    } else {
      console.log(`ERREUR: ${JSON.stringify(data)}`);
    }
    await sleep(350);
  }

  console.log(`\n${registered.length}/25 comptes créés\n`);
  if (registered.length === 0) { console.error('Abandon'); process.exit(1); }

  // ── 2. Récupération des spots ──────────────────────────────────────────────
  console.log('Récupération des spots…');
  const spotsRes = await fetch(`${BASE}/api/performances/spots?limit=200`, {
    headers: { Authorization: `Bearer ${registered[0].token}` },
  });
  const spotsData = await spotsRes.json();
  const spotIds: string[] = (spotsData.spots ?? []).map((s: any) => s.id);
  console.log(`${spotIds.length} spots disponibles\n`);
  if (spotIds.length === 0) { console.error('Pas de spots — abandon'); process.exit(1); }

  // ── 3. Upload des avatars (13 premiers) ────────────────────────────────────
  console.log('=== Upload des avatars ===\n');
  for (const user of registered) {
    if (!user.wantsAvatar) continue;
    process.stdout.write(`  ${user.pseudo.padEnd(16)} `);
    await uploadAvatar(user.pseudo, user.token);
    await sleep(500);
  }
  console.log();

  // ── 4. Performances (min 3 par user, max 6) ────────────────────────────────
  console.log('=== Ajout des performances ===\n');

  for (const user of registered) {
    const count = randInt(3, 6);
    const exercises = pickN([...EXERCISES], count) as Exercise[];
    console.log(`  ${user.pseudo} — ${count} perf(s):`);

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
        console.log(`    + ${exercise}: ${score}`);
      } else {
        console.log(`    ✗ ${exercise}: ${JSON.stringify(data)}`);
      }
      await sleep(280);
    }
  }

  const totalPerfs = registered.reduce((s, u) => s + u.performanceIds.length, 0);
  console.log(`\n${totalPerfs} performances créées\n`);

  // ── 5. Validation croisée (2 validateurs par perf) ─────────────────────────
  console.log('=== Validation des performances ===\n');

  let validated = 0;

  for (const owner of registered) {
    if (owner.performanceIds.length === 0) continue;
    const others = registered.filter((u) => u.userId !== owner.userId);
    const validators = pickN(others, Math.min(2, others.length));

    for (const perfId of owner.performanceIds) {
      let accepted = 0;
      for (const v of validators) {
        const d = await apiPost(
          '/api/performances/validate',
          { action: 'respond', performanceId: perfId, isValid: true },
          v.token,
        );
        if (d.ok) accepted = d.accepted ?? accepted + 1;
        await sleep(180);
      }
      process.stdout.write(accepted >= 2 ? '✓ ' : `(${accepted}/2) `);
      if (accepted >= 2) validated++;
    }
    console.log();
  }

  // ── Résumé ─────────────────────────────────────────────────────────────────
  console.log(`\n${validated}/${totalPerfs} performances validées\n`);
  console.log('=== Résumé ===\n');

  const withAvatar  = registered.filter(u => u.wantsAvatar);
  const withoutAvt  = registered.filter(u => !u.wantsAvatar);

  console.log(`Avec avatar  (${withAvatar.length}):`);
  for (const u of withAvatar)  console.log(`  ${u.pseudo.padEnd(16)} — ${u.performanceIds.length} perf(s)`);
  console.log(`\nSans avatar  (${withoutAvt.length}):`);
  for (const u of withoutAvt) console.log(`  ${u.pseudo.padEnd(16)} — ${u.performanceIds.length} perf(s)`);
  console.log('\nTerminé.');
}

main().catch((err) => { console.error('Erreur fatale:', err); process.exit(1); });
