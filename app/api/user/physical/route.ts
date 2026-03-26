import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

interface PhysicalEntry {
  date: string;
  weight?: number;
  height?: number;
  bodyFat?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  bicepsL?: number;
  bicepsR?: number;
  thighL?: number;
  thighR?: number;
}

// GET — return physical data history
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { physicalData: true },
    });

    const entries: PhysicalEntry[] = Array.isArray(user?.physicalData) ? (user.physicalData as unknown as PhysicalEntry[]) : [];
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Physical GET error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — add a new physical measurement entry
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const body = await request.json();
    const { weight, height, bodyFat, chest, waist, hips, bicepsL, bicepsR, thighL, thighR } = body;

    // Validate at least one measurement
    const values = [weight, height, bodyFat, chest, waist, hips, bicepsL, bicepsR, thighL, thighR];
    if (values.every(v => v == null || v === '' || v === 0)) {
      return NextResponse.json({ error: 'Au moins une mesure requise' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { physicalData: true },
    });

    const entries: PhysicalEntry[] = Array.isArray(user?.physicalData) ? (user.physicalData as unknown as PhysicalEntry[]) : [];
    const today = new Date().toISOString().slice(0, 10);

    // Update today's entry or add new
    const existingIdx = entries.findIndex(e => e.date === today);
    const newEntry: PhysicalEntry = {
      date: today,
      ...(weight ? { weight: Number(weight) } : {}),
      ...(height ? { height: Number(height) } : {}),
      ...(bodyFat ? { bodyFat: Number(bodyFat) } : {}),
      ...(chest ? { chest: Number(chest) } : {}),
      ...(waist ? { waist: Number(waist) } : {}),
      ...(hips ? { hips: Number(hips) } : {}),
      ...(bicepsL ? { bicepsL: Number(bicepsL) } : {}),
      ...(bicepsR ? { bicepsR: Number(bicepsR) } : {}),
      ...(thighL ? { thighL: Number(thighL) } : {}),
      ...(thighR ? { thighR: Number(thighR) } : {}),
    };

    if (existingIdx >= 0) {
      entries[existingIdx] = { ...entries[existingIdx], ...newEntry };
    } else {
      entries.push(newEntry);
    }

    // Sort by date
    entries.sort((a, b) => a.date.localeCompare(b.date));

    await prisma.user.update({
      where: { id: payload.userId },
      data: { physicalData: entries as object[] },
    });

    return NextResponse.json({ ok: true, entries });
  } catch (error) {
    console.error('Physical POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
