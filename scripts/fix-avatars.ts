/**
 * fix-avatars.ts
 * Applique des avatars DiceBear (cartoon/animé) aux 13 utilisateurs
 * créés par seed-25-users.ts, via POST /api/user/equipment.
 *
 * Usage: npx tsx scripts/fix-avatars.ts
 */

const BASE = 'https://sport-levelflow.vercel.app';

// 13 utilisateurs que l'on veut équiper d'un avatar
const USERS_WITH_AVATAR = [
  { email: 'raphael.morin77@gmail.com',   pseudo: 'raph_morin',  password: 'Levelflow123!' },
  { email: 'baptiste.renard92@gmail.com',  pseudo: 'bap_street',  password: 'Levelflow123!' },
  { email: 'clement.giraud38@gmail.com',   pseudo: 'clem_g',      password: 'Levelflow123!' },
  { email: 'florian.dupont69@gmail.com',   pseudo: 'flo_power',   password: 'Levelflow123!' },
  { email: 'hugo.mercier59@gmail.com',     pseudo: 'hugo_fit',    password: 'Levelflow123!' },
  { email: 'axel.simon75@gmail.com',       pseudo: 'axel_sim',    password: 'Levelflow123!' },
  { email: 'dylan.perrin31@gmail.com',     pseudo: 'dyl_beast',   password: 'Levelflow123!' },
  { email: 'kevin.laurent13@gmail.com',    pseudo: 'kev_street',  password: 'Levelflow123!' },
  { email: 'tom.rousseau44@gmail.com',     pseudo: 'tom_rdx',     password: 'Levelflow123!' },
  { email: 'yanis.benali93@gmail.com',     pseudo: 'yanis_b',     password: 'Levelflow123!' },
  { email: 'ines.fournier67@gmail.com',    pseudo: 'ines_fit',    password: 'Levelflow123!' },
  { email: 'lea.marchand75@gmail.com',     pseudo: 'lea_m',       password: 'Levelflow123!' },
  { email: 'jade.lefebvre42@gmail.com',    pseudo: 'jade_lft',    password: 'Levelflow123!' },
];

// Styles DiceBear variés (PNG, 256px)
const STYLES = [
  'adventurer', 'avataaars', 'big-ears-neutral', 'croodles',
  'fun-emoji', 'lorelei', 'micah', 'miniavs',
  'notionists', 'open-peeps', 'personas', 'pixel-art', 'thumbs',
];
const BG_COLORS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'e8f5e9', 'fff9c4'];

function buildAvatarUrl(pseudo: string, styleIndex: number): string {
  const style = STYLES[styleIndex % STYLES.length];
  const bg = BG_COLORS[styleIndex % BG_COLORS.length];
  return `https://api.dicebear.com/8.x/${style}/svg?seed=${encodeURIComponent(pseudo)}&backgroundColor=${bg}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.token ?? null;
}

async function main() {
  console.log('=== Ajout des avatars DiceBear ===\n');

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < USERS_WITH_AVATAR.length; i++) {
    const user = USERS_WITH_AVATAR[i];
    const avatarUrl = buildAvatarUrl(user.pseudo, i);

    process.stdout.write(`  ${user.pseudo.padEnd(14)} (${STYLES[i % STYLES.length]}) … `);

    // Login pour obtenir un vrai token
    const token = await login(user.email, user.password);
    if (!token) {
      console.log('ERREUR login');
      fail++;
      continue;
    }

    const res = await fetch(`${BASE}/api/user/equipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        equipmentData: {
          profileImageUrl: avatarUrl,
        },
      }),
    });

    const data = await res.json();
    if (data.success) {
      console.log('OK');
      ok++;
    } else {
      console.log(`ERREUR: ${JSON.stringify(data)}`);
      fail++;
    }

    await sleep(300);
  }

  console.log(`\n${ok} avatar(s) appliqués, ${fail} échec(s)\n`);

  // Vérification rapide sur un user
  const sample = USERS_WITH_AVATAR[0];
  const checkToken = await login(sample.email, sample.password);
  const check = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${checkToken}` },
  });
  const meData = await check.json();
  console.log(`Vérification ${sample.pseudo}:`);
  console.log(`  profileImageUrl = ${meData.user?.profileImageUrl ?? '(non défini)'}`);
  console.log('\nTerminé.');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
