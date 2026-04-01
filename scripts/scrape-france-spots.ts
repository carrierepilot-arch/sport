/**
 * Comprehensive spot scraper for all of France.
 * Sources: OpenStreetMap Overpass API.
 * Categories: street workout, outdoor fitness, calisthenics, gyms, sports parks.
 *
 * This script:
 *   1. Queries Overpass API region by region (France is too large for a single query)
 *   2. Clusters nearby points into logical spots
 *   3. Outputs a JSON file ready for bulk import via /api/admin/spots/bulk
 *
 * Usage: npx tsx scripts/scrape-france-spots.ts
 */

const OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// France split into bboxes (south,west,north,east) to avoid timeouts
const REGIONS: { name: string; bbox: string }[] = [
  // Île-de-France
  { name: 'Île-de-France', bbox: '48.1,1.4,49.3,3.6' },
  // Nord / Pas-de-Calais / Picardie
  { name: 'Hauts-de-France', bbox: '49.0,1.3,51.1,4.3' },
  // Normandie
  { name: 'Normandie', bbox: '48.2,-2.0,49.8,1.9' },
  // Bretagne
  { name: 'Bretagne', bbox: '47.2,-5.2,48.9,-1.0' },
  // Pays de la Loire
  { name: 'Pays de la Loire', bbox: '46.2,-2.6,48.1,0.9' },
  // Centre-Val de Loire
  { name: 'Centre-Val de Loire', bbox: '46.3,0.0,48.5,3.2' },
  // Grand Est
  { name: 'Grand Est', bbox: '47.4,3.4,49.6,8.3' },
  // Bourgogne-Franche-Comté
  { name: 'Bourgogne-Franche-Comté', bbox: '46.0,2.8,48.4,7.2' },
  // Auvergne-Rhône-Alpes
  { name: 'Auvergne-Rhône-Alpes', bbox: '44.1,2.1,46.8,7.2' },
  // Provence-Alpes-Côte d\'Azur
  { name: 'PACA', bbox: '43.0,4.2,45.2,7.8' },
  // Occitanie
  { name: 'Occitanie', bbox: '42.3,-0.4,44.9,4.9' },
  // Nouvelle-Aquitaine
  { name: 'Nouvelle-Aquitaine', bbox: '43.5,-1.8,47.1,2.6' },
  // Corse
  { name: 'Corse', bbox: '41.3,8.5,43.1,9.7' },
  // DOM-TOM main
  { name: 'Martinique', bbox: '14.3,-61.3,14.9,-60.8' },
  { name: 'Guadeloupe', bbox: '15.8,-61.9,16.6,-61.0' },
  { name: 'Réunion', bbox: '-21.4,55.2,-20.8,55.9' },
  { name: 'Guyane', bbox: '2.1,-54.6,5.8,-51.6' },
];

type Point = {
  lat: number;
  lon: number;
  name: string;
  city: string;
  category: string;
};

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildQuery(bbox: string): string {
  return [
    `[out:json][timeout:120];`,
    `(`,
    // Street workout / outdoor fitness
    `node["leisure"="fitness_station"](${bbox});`,
    `way["leisure"="fitness_station"](${bbox});`,
    `node["leisure"="outdoor_gym"](${bbox});`,
    `way["leisure"="outdoor_gym"](${bbox});`,
    `node["leisure"="fitness_centre"]["sport"~"fitness|musculation|crossfit"](${bbox});`,
    `way["leisure"="fitness_centre"]["sport"~"fitness|musculation|crossfit"](${bbox});`,
    `node["amenity"="exercise_point"](${bbox});`,
    `way["amenity"="exercise_point"](${bbox});`,
    // Sport tags
    `node["sport"~"workout|street_workout|calisthenics|fitness|exercise|musculation|crossfit"](${bbox});`,
    `way["sport"~"workout|street_workout|calisthenics|fitness|exercise|musculation|crossfit"](${bbox});`,
    // Gyms / fitness centres
    `node["leisure"="sports_centre"](${bbox});`,
    `way["leisure"="sports_centre"](${bbox});`,
    // Parks marked for sport
    `node["leisure"="pitch"]["sport"~"multi|fitness"](${bbox});`,
    `way["leisure"="pitch"]["sport"~"multi|fitness"](${bbox});`,
    `);out center body;`,
  ].join('');
}

function classifyCategory(tags: Record<string, string>): string {
  const sport = (tags.sport || '').toLowerCase();
  const leisure = (tags.leisure || '').toLowerCase();
  const amenity = (tags.amenity || '').toLowerCase();

  if (sport.includes('street_workout') || sport.includes('calisthenics') || sport.includes('workout')) return 'street_workout';
  if (leisure === 'outdoor_gym' || leisure === 'fitness_station' || amenity === 'exercise_point') return 'outdoor_fitness';
  if (leisure === 'fitness_centre' || sport.includes('fitness') || sport.includes('musculation') || sport.includes('crossfit')) return 'gym';
  if (leisure === 'sports_centre') return 'sports_centre';
  return 'outdoor_fitness';
}

type OverpassElement = {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function fetchRegion(region: { name: string; bbox: string }): Promise<Point[]> {
  const query = buildQuery(region.bbox);

  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim().startsWith('{')) continue;
      const data = JSON.parse(text) as { elements?: OverpassElement[] };
      const elements = data?.elements || [];

      const points: Point[] = elements
        .map((el) => {
          const lat = el.type === 'way' ? el.center?.lat : el.lat;
          const lon = el.type === 'way' ? el.center?.lon : el.lon;
          const tags = el.tags || {};
          return {
            lat: Number(lat),
            lon: Number(lon),
            name: tags.name || tags['name:fr'] || tags.operator || '',
            city: tags['addr:city'] || tags['addr:commune'] || '',
            category: classifyCategory(tags),
          };
        })
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

      console.log(`  ${region.name}: ${points.length} points from ${url}`);
      return points;
    } catch (err) {
      console.warn(`  ${region.name}: failed on ${url}, trying next...`);
    }
  }
  console.error(`  ${region.name}: ALL endpoints failed`);
  return [];
}

const CLUSTER_RADIUS_M = 80;

function cluster(points: Point[]): number[][] {
  const CELL_DEG = 0.001; // ~110m at 45°N — ensures 80m neighbors are in adjacent cells
  // Build spatial grid: cell -> list of point indices
  const grid = new Map<string, number[]>();
  for (let i = 0; i < points.length; i++) {
    const key = gridKey(points[i].lat, points[i].lon, CELL_DEG);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(i);
  }

  const used = new Set<number>();
  const clusters: number[][] = [];

  for (let i = 0; i < points.length; i++) {
    if (used.has(i)) continue;
    const ids = [i];
    used.add(i);
    const queue = [i];
    while (queue.length) {
      const current = queue.shift()!;
      const neighbors = neighborKeys(points[current].lat, points[current].lon, CELL_DEG);
      for (const nk of neighbors) {
        const cell = grid.get(nk);
        if (!cell) continue;
        for (const j of cell) {
          if (used.has(j)) continue;
          if (haversineM(points[current].lat, points[current].lon, points[j].lat, points[j].lon) <= CLUSTER_RADIUS_M) {
            used.add(j);
            ids.push(j);
            queue.push(j);
          }
        }
      }
    }
    clusters.push(ids);
  }
  return clusters;
}

function pickBestName(clusterPoints: Point[], regionIndex: number, clusterIndex: number): string {
  const candidates = clusterPoints
    .map((p) => p.name.trim())
    .filter((n) => n.length >= 3 && !/^\d+$/.test(n));

  const priority = candidates.find((n) =>
    /street|workout|calisth|fitness|muscul|traction|pull.?up|outdoor|parcours|gym/i.test(n)
  );
  if (priority) return priority.slice(0, 120);
  if (candidates.length > 0) return candidates.sort((a, b) => b.length - a.length)[0].slice(0, 120);

  const bestCat = clusterPoints.find((p) => p.category === 'street_workout')?.category
    || clusterPoints.find((p) => p.category === 'outdoor_fitness')?.category
    || clusterPoints[0].category;

  const prefixes: Record<string, string> = {
    street_workout: 'Street Workout',
    outdoor_fitness: 'Aire de fitness',
    gym: 'Salle de sport',
    sports_centre: 'Centre sportif',
  };

  return `${prefixes[bestCat] || 'Spot'} #${regionIndex * 10000 + clusterIndex + 1}`;
}

// Spatial grid helpers for O(n) proximity operations
function gridKey(lat: number, lon: number, cellSizeDeg: number): string {
  return `${Math.floor(lat / cellSizeDeg)},${Math.floor(lon / cellSizeDeg)}`;
}

function neighborKeys(lat: number, lon: number, cellSizeDeg: number): string[] {
  const gx = Math.floor(lon / cellSizeDeg);
  const gy = Math.floor(lat / cellSizeDeg);
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      keys.push(`${gy + dy},${gx + dx}`);
    }
  }
  return keys;
}

// Global dedup: remove points that are within 30m of each other across regions
// Uses spatial grid for O(n) performance instead of O(n²)
function globalDedup(allPoints: Point[]): Point[] {
  const DEDUP_M = 30;
  const CELL_DEG = 0.0005; // ~55m at 45°N — ensures 30m neighbors are in adjacent cells
  const grid = new Map<string, Point[]>();
  const kept: Point[] = [];

  for (const p of allPoints) {
    const neighbors = neighborKeys(p.lat, p.lon, CELL_DEG);
    let isDuplicate = false;
    for (const nk of neighbors) {
      const cell = grid.get(nk);
      if (!cell) continue;
      for (const k of cell) {
        if (haversineM(p.lat, p.lon, k.lat, k.lon) <= DEDUP_M) {
          isDuplicate = true;
          break;
        }
      }
      if (isDuplicate) break;
    }
    if (!isDuplicate) {
      kept.push(p);
      const key = gridKey(p.lat, p.lon, CELL_DEG);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(p);
    }
  }
  return kept;
}

async function main() {
  console.log(`\n=== Scraping spots across ${REGIONS.length} French regions ===\n`);

  let allPoints: Point[] = [];

  for (let i = 0; i < REGIONS.length; i++) {
    const region = REGIONS[i];
    console.log(`[${i + 1}/${REGIONS.length}] Querying ${region.name}...`);
    const points = await fetchRegion(region);
    allPoints.push(...points);
    // Be polite to Overpass API
    if (i < REGIONS.length - 1) {
      await sleep(3000);
    }
  }

  console.log(`\nTotal raw points: ${allPoints.length}`);

  // Global dedup
  console.log('Global deduplication...');
  const deduped = globalDedup(allPoints);
  console.log(`After global dedup: ${deduped.length}`);

  // Cluster into logical spots
  console.log('Clustering nearby stations...');
  const groups = cluster(deduped);
  console.log(`Clusters: ${groups.length}`);

  const spots = groups.map((ids, idx) => {
    const cp = ids.map((id) => deduped[id]);
    const lat = cp.reduce((s, p) => s + p.lat, 0) / cp.length;
    const lon = cp.reduce((s, p) => s + p.lon, 0) / cp.length;
    const city = cp.find((p) => p.city)?.city || null;
    const regionIdx = Math.floor(idx / 10000);

    return {
      name: pickBestName(cp, regionIdx, idx),
      city,
      latitude: Math.round(lat * 100000) / 100000,
      longitude: Math.round(lon * 100000) / 100000,
    };
  });

  // Final name-level dedup
  const seen = new Set<string>();
  const final = spots.filter((s) => {
    const key = `${s.latitude}|${s.longitude}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  final.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`\nFinal spots: ${final.length}`);

  // Save to file
  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'france-spots.json');
  fs.writeFileSync(outPath, JSON.stringify(final, null, 2));
  console.log(`Saved to ${outPath} (${(JSON.stringify(final).length / 1024).toFixed(0)} KB)`);

  // Stats
  const withCity = final.filter((s) => s.city).length;
  console.log(`With city: ${withCity}/${final.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
