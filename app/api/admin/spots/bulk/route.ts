import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/admin-auth';

const BULK_SECRET = (process.env.BULK_IMPORT_SECRET || '').trim();

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function gridKey(lat: number, lon: number, cellDeg: number): string {
  return `${Math.floor(lat / cellDeg)},${Math.floor(lon / cellDeg)}`;
}

function neighborKeys(lat: number, lon: number, cellDeg: number): string[] {
  const gx = Math.floor(lon / cellDeg);
  const gy = Math.floor(lat / cellDeg);
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      keys.push(`${gy + dy},${gx + dx}`);
    }
  }
  return keys;
}

function isBulkSecretAuth(request: NextRequest): boolean {
  if (!BULK_SECRET) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === `BulkSecret ${BULK_SECRET}`;
}

// GET: count stats
export async function GET(request: NextRequest) {
  if (!isBulkSecretAuth(request)) {
    const admin = await requireAdminPermission(request, 'spots:read');
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const [total, approved, pending, withCoords, withCity] = await Promise.all([
    prisma.spot.count(),
    prisma.spot.count({ where: { status: 'approved' } }),
    prisma.spot.count({ where: { status: 'pending' } }),
    prisma.spot.count({ where: { status: 'approved', latitude: { not: null }, longitude: { not: null } } }),
    prisma.spot.count({ where: { status: 'approved', city: { not: null } } }),
  ]);
  return NextResponse.json({ total, approved, pending, withCoords, withCity });
}

// POST: bulk import spots (admin or bulk-secret, additive — never deletes)
export async function POST(request: NextRequest) {
  if (!isBulkSecretAuth(request)) {
    const admin = await requireAdminPermission(request, 'spots:write');
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = await request.json();
  const spots: Array<{ name: string; city?: string; latitude?: number; longitude?: number }> = body.spots;

  if (!Array.isArray(spots) || spots.length === 0) {
    return NextResponse.json({ error: 'Array "spots" requis' }, { status: 400 });
  }

  // Load existing approved spots for dedup (40m proximity) with spatial grid
  const existing = await prisma.spot.findMany({
    where: { status: 'approved' },
    select: { latitude: true, longitude: true },
  });

  const DEDUP_M = 40;
  const CELL_DEG = 0.0006;
  const grid = new Map<string, Array<{ latitude: number; longitude: number }>>();
  for (const ex of existing) {
    if (typeof ex.latitude !== 'number' || typeof ex.longitude !== 'number') continue;
    const key = gridKey(ex.latitude, ex.longitude, CELL_DEG);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push({ latitude: ex.latitude, longitude: ex.longitude });
  }

  function isNearExisting(lat: number, lon: number): boolean {
    const neighbors = neighborKeys(lat, lon, CELL_DEG);
    for (const nk of neighbors) {
      const cell = grid.get(nk);
      if (!cell) continue;
      for (const ex of cell) {
        if (haversineM(lat, lon, ex.latitude!, ex.longitude!) <= DEDUP_M) return true;
      }
    }
    return false;
  }

  const toCreate = spots.filter((s) => {
    if (!s.name || typeof s.name !== 'string' || s.name.trim().length < 2) return false;
    if (typeof s.latitude !== 'number' || typeof s.longitude !== 'number') return false;
    if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return false;
    return !isNearExisting(s.latitude, s.longitude);
  });

  const data = toCreate.map((s) => ({
    name: s.name.trim().slice(0, 120),
    city: s.city?.trim().slice(0, 80) || null,
    latitude: Math.round(s.latitude! * 100000) / 100000,
    longitude: Math.round(s.longitude! * 100000) / 100000,
    status: 'approved' as const,
  }));

  let created = 0;
  for (let i = 0; i < data.length; i += 200) {
    const chunk = data.slice(i, i + 200);
    const result = await prisma.spot.createMany({ data: chunk, skipDuplicates: true });
    created += result.count;
    for (const s of chunk) {
      const key = gridKey(s.latitude, s.longitude, CELL_DEG);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push({ latitude: s.latitude, longitude: s.longitude });
    }
  }

  return NextResponse.json({ submitted: spots.length, duplicatesSkipped: spots.length - toCreate.length, created });
}
