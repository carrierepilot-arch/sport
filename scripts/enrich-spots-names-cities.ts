import { prisma } from '../lib/prisma';

const OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const BBOX = '48.1,1.4,49.3,3.6';
const BAN_REVERSE_URL = 'https://api-adresse.data.gouv.fr/reverse/';
const NAME_MATCH_RADIUS_M = 180;
const CITY_FETCH_CONCURRENCY = 8;

type OSMPoint = {
  lat: number;
  lon: number;
  name: string;
  city: string | null;
  operator: string | null;
  brand: string | null;
};

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeName(raw: string): string {
  const n = raw.trim().replace(/\s+/g, ' ');
  return n.slice(0, 100);
}

function isSyntheticName(name: string): boolean {
  return /^SW IDF\s+\d+/i.test(name.trim());
}

function isGenericWorkoutName(name: string): boolean {
  const n = name.trim();
  return /^Street Workout\b/i.test(n) && !/\bpar\b/i.test(n);
}

function buildOperatorName(operator: string | null, brand: string | null, city: string | null): string | null {
  const source = normalizeName((operator || brand || '').trim());
  if (!source) return null;
  if (city) return `Street Workout par ${source} (${city})`;
  return `Street Workout par ${source}`;
}

async function fetchNamedOSMPoints(): Promise<OSMPoint[]> {
  const query = `[out:json][timeout:120];(node["leisure"="fitness_station"](${BBOX});way["leisure"="fitness_station"](${BBOX});node["sport"~"workout|street_workout|fitness|exercise"](${BBOX});way["sport"~"workout|street_workout|fitness|exercise"](${BBOX}););out center body;`;
  let data: { elements?: Array<{ type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> } | null = null;

  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim().startsWith('{')) continue;
      data = JSON.parse(text) as { elements?: Array<{ type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
      break;
    } catch {
      // Try next endpoint
    }
  }

  if (!data) throw new Error('Overpass unavailable on all endpoints');

  const points = (data.elements || []).map((el) => {
    const lat = el.type === 'way' ? el.center?.lat : el.lat;
    const lon = el.type === 'way' ? el.center?.lon : el.lon;
    const name = el.tags?.name || el.tags?.['name:fr'] || '';
    const city = el.tags?.['addr:city'] || null;
    const operator = el.tags?.operator || null;
    const brand = el.tags?.brand || null;
    return {
      lat: Number(lat),
      lon: Number(lon),
      name: name.trim(),
      city,
      operator,
      brand,
    };
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && (p.name.length >= 3 || !!p.operator || !!p.brand));

  return points.map((p) => ({ ...p, name: p.name ? normalizeName(p.name) : '' }));
}

async function reverseCity(lat: number, lon: number): Promise<string | null> {
  const url = `${BAN_REVERSE_URL}?lat=${lat}&lon=${lon}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json() as { features?: Array<{ properties?: { city?: string } }> };
    const city = data.features?.[0]?.properties?.city;
    return city?.trim() || null;
  } catch {
    return null;
  }
}

async function runInPool<T>(items: T[], worker: (item: T, idx: number) => Promise<void>, concurrency: number) {
  let index = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const i = index++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

async function main() {
  console.log('Loading DB spots...');
  const spots = await prisma.spot.findMany({
    where: { status: 'approved', latitude: { not: null }, longitude: { not: null } },
    select: { id: true, name: true, city: true, latitude: true, longitude: true },
  });

  console.log(`Spots loaded: ${spots.length}`);
  console.log('Fetching named OSM points...');
  const namedPoints = await fetchNamedOSMPoints();
  console.log(`Named OSM points: ${namedPoints.length}`);

  let renamedFromOsm = 0;
  let cityFromOsm = 0;

  for (const spot of spots) {
    const lat = spot.latitude as number;
    const lon = spot.longitude as number;

    let best: OSMPoint | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const p of namedPoints) {
      const d = haversineM(lat, lon, p.lat, p.lon);
      if (d <= NAME_MATCH_RADIUS_M && d < bestDist) {
        best = p;
        bestDist = d;
      }
    }

    const updates: { name?: string; city?: string | null } = {};

    if (isSyntheticName(spot.name) || isGenericWorkoutName(spot.name)) {
      if (best?.name) {
        updates.name = best.name;
        renamedFromOsm++;
      } else {
        const operatorName = buildOperatorName(best?.operator || null, best?.brand || null, spot.city);
        if (operatorName) {
          updates.name = operatorName;
          renamedFromOsm++;
        }
      }
    }

    if (!spot.city && best?.city) {
      updates.city = best.city;
      cityFromOsm++;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.spot.update({ where: { id: spot.id }, data: updates });
    }
  }

  console.log(`Renamed from OSM: ${renamedFromOsm}`);
  console.log(`City filled from OSM: ${cityFromOsm}`);

  console.log('Loading spots still missing city...');
  const missingCity = await prisma.spot.findMany({
    where: { status: 'approved', city: null, latitude: { not: null }, longitude: { not: null } },
    select: { id: true, latitude: true, longitude: true },
  });

  let cityFromReverse = 0;
  await runInPool(missingCity, async (spot, idx) => {
    const city = await reverseCity(spot.latitude as number, spot.longitude as number);
    if (city) {
      await prisma.spot.update({ where: { id: spot.id }, data: { city } });
      cityFromReverse++;
    }
    if ((idx + 1) % 100 === 0) {
      console.log(`Reverse city progress: ${idx + 1}/${missingCity.length}`);
    }
  }, CITY_FETCH_CONCURRENCY);

  console.log(`City filled from reverse geocode: ${cityFromReverse}`);

  console.log('Normalizing remaining synthetic names using city fallback...');
  const stillSynthetic = await prisma.spot.findMany({
    where: { status: 'approved', name: { startsWith: 'SW IDF ' } },
    select: { id: true, city: true },
  });

  let fallbackRenamed = 0;
  for (const s of stillSynthetic) {
    const fallback = s.city ? `Street Workout ${s.city}` : 'Street Workout Île-de-France';
    await prisma.spot.update({ where: { id: s.id }, data: { name: fallback } });
    fallbackRenamed++;
  }

  console.log(`Fallback renamed: ${fallbackRenamed}`);

  const finalStats = {
    total: await prisma.spot.count({ where: { status: 'approved' } }),
    synthetic: await prisma.spot.count({ where: { status: 'approved', name: { startsWith: 'SW IDF ' } } }),
    noCity: await prisma.spot.count({ where: { status: 'approved', city: null } }),
  };

  console.log('Final stats:', finalStats);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
