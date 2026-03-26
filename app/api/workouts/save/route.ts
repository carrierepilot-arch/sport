import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { title, rawText, programme, config, sharedBy } = await request.json();
    if (!programme) return NextResponse.json({ error: 'Programme requis' }, { status: 400 });

    const workout = await prisma.workout.create({
      data: {
        userId: payload.userId,
        title: title ?? `Séance du ${new Date().toLocaleDateString('fr-FR')}`,
        rawText: rawText ?? '',
        programme,
        config: config ?? null,
        sharedBy: sharedBy ?? null,
      },
    });

    return NextResponse.json({ success: true, workout });
  } catch (error) {
    console.error('Save workout error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
