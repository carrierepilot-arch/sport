import { prisma } from '../lib/prisma';

const OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const BBOX = '48.1,1.4,49.3,3.6'; // Ile-de-France approx bbox
const CLUSTER_RADIUS_M = 80;

type Point = {
  lat: number;
  lon: number;
  name: string;
  city: string;
};

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cleanName(raw: string): string {
  const n = (raw || '').trim().replace(/\s+/g, ' ');
  if (n.length < 3) return '';
  return n.slice(0, 90);
}

function pickBestName(clusterPoints: Point[], index: number): string {
  const candidates = clusterPoints
    .map((p) => cleanName(p.name))
    .filter(Boolean)
    .filter((n) => !/^\d+$/.test(n));

  const priority = candidates.find((n) => /street|workout|calisthenics|fitness|musculation|pull\s?up|traction/i.test(n));
  if (priority) return priority;

  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.length - a.length)[0];
  }

  return `SW IDF ${String(index + 1).padStart(4, '0')}`;
}

function cluster(points: Point[]): number[][] {
  const used = new Set<number>();
  const clusters: number[][] = [];

  for (let i = 0; i < points.length; i++) {
    if (used.has(i)) continue;

    const ids = [i];
    used.add(i);
    const queue = [i];

    while (queue.length) {
      const current = queue.shift();
      if (current === undefined) break;
      for (let j = 0; j < points.length; j++) {
        if (used.has(j)) continue;
        if (haversineM(points[current].lat, points[current].lon, points[j].lat, points[j].lon) <= CLUSTER_RADIUS_M) {
          used.add(j);
          ids.push(j);
          queue.push(j);
        }
      }
    }

    clusters.push(ids);
  }

  return clusters;
}

async function fetchPoints(): Promise<Point[]> {
  // Broader query:
  // - leisure=fitness_station, leisure=outdoor_gym
  // - sport=workout|street_workout|fitness|exercise|calisthenics|musculation
  // - amenity=exercise_point
  const query = [
    `[out:json][timeout:180];`,
    `(`,
    `node["leisure"="fitness_station"](${BBOX});`,
    `way["leisure"="fitness_station"](${BBOX});`,
    `node["leisure"="outdoor_gym"](${BBOX});`,
    `way["leisure"="outdoor_gym"](${BBOX});`,
    `node["amenity"="exercise_point"](${BBOX});`,
    `way["amenity"="exercise_point"](${BBOX});`,
    `node["sport"~"workout|street_workout|fitness|exercise|calisthenics|musculation"](${BBOX});`,
    `way["sport"~"workout|street_workout|fitness|exercise|calisthenics|musculation"](${BBOX});`,
    `);out center body;`,
  ].join('');

  type OverpassData = { elements?: Array<{ type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
  let data: OverpassData | null = null;

  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim().startsWith('{')) continue;
      data = JSON.parse(text) as OverpassData;
      console.log(`Using Overpass endpoint: ${url}`);
      break;
    } catch {
      // try next
    }
  }

  if (!data) throw new Error('All Overpass endpoints failed');

  return (data.elements || []).map((el) => {
    const lat = el.type === 'way' ? el.center?.lat : el.lat;
    const lon = el.type === 'way' ? el.center?.lon : el.lon;
    return {
      lat: Number(lat),
      lon: Number(lon),
      name: el.tags?.name || el.tags?.['name:fr'] || '',
      city: el.tags?.['addr:city'] || '',
    };
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

async function main() {
  console.log('Fetching OSM points...');
  const points = await fetchPoints();
  console.log(`Fetched ${points.length} points`);

  console.log('Clustering nearby stations into parks...');
  const groups = cluster(points);
  console.log(`Built ${groups.length} clusters`);

  const spots = groups.map((ids, idx) => {
    const clusterPoints = ids.map((id) => points[id]);
    const lat = clusterPoints.reduce((s, p) => s + p.lat, 0) / clusterPoints.length;
    const lon = clusterPoints.reduce((s, p) => s + p.lon, 0) / clusterPoints.length;
    const city = clusterPoints.find((p) => p.city)?.city || null;

    return {
      name: pickBestName(clusterPoints, idx),
      city,
      latitude: Math.round(lat * 10000) / 10000,
      longitude: Math.round(lon * 10000) / 10000,
      status: 'approved' as const,
    };
  });

  const seen = new Set<string>();
  const deduped: typeof spots = [];
  for (const s of spots) {
    const key = `${s.latitude}|${s.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  deduped.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Final deduped spots: ${deduped.length}`);

  // Keep any spots that are already referenced by performances/regulars.
  // Remove only old seeded spots that are safe to delete.
  const deleted = await prisma.spot.deleteMany({
    where: {
      status: 'approved',
      addedBy: null,
      performances: { none: {} },
      regulars: { none: {} },
    },
  });

  const existingApproved = await prisma.spot.findMany({
    where: { status: 'approved' },
    select: { latitude: true, longitude: true },
  });

  const toCreate = deduped.filter((spot) => {
    return !existingApproved.some((ex) => {
      if (typeof ex.latitude !== 'number' || typeof ex.longitude !== 'number') return false;
      return haversineM(spot.latitude!, spot.longitude!, ex.latitude, ex.longitude) <= 40;
    });
  });

  const created = toCreate.length ? await prisma.spot.createMany({ data: toCreate }) : { count: 0 };

  console.log(`Deleted unreferenced old spots: ${deleted.count}`);
  console.log(`Created new spots: ${created.count}`);

  const approxBytes = JSON.stringify(deduped).length;
  console.log(`Approx JSON payload size: ${(approxBytes / 1024).toFixed(1)} KB`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
