import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    // Seed the first spot if none exist
    const count = await prisma.spot.count();
    if (count === 0) {
      await prisma.spot.create({
        data: { name: 'Street Rouge de Deuil-la-Barre', city: 'Deuil-la-Barre', status: 'approved' },
      });
    }

    const spots = await prisma.spot.findMany({
      where: { status: 'approved' },
      include: { _count: { select: { performances: true } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ spots });
  } catch (error) {
    console.error('Spots error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { name, city } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Nom du spot requis (min 2 caractères)' }, { status: 400 });
    }

    const spot = await prisma.spot.create({
      data: {
        name: name.trim(),
        city: city?.trim() || null,
        addedBy: payload.userId,
        status: 'pending',
      },
    });

    return NextResponse.json({ success: true, spot });
  } catch (error) {
    console.error('Create spot error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
