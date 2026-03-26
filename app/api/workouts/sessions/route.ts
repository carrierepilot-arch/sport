import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// POST — créer ou mettre à jour une session d'entraînement
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { workoutId, dayLabel, status, results, startedAt, finishedAt } = await request.json();
    if (!workoutId || !dayLabel) {
      return NextResponse.json({ error: 'workoutId et dayLabel requis' }, { status: 400 });
    }

    // Chercher une session existante pour ce jour
    const existing = await prisma.workoutSession.findFirst({
      where: { userId: payload.userId, workoutId, dayLabel },
    });

    let session;
    if (existing) {
      session = await prisma.workoutSession.update({
        where: { id: existing.id },
        data: {
          status: status ?? existing.status,
          results: results ?? existing.results,
          startedAt: startedAt ? new Date(startedAt) : existing.startedAt,
          finishedAt: finishedAt ? new Date(finishedAt) : existing.finishedAt,
        },
      });
    } else {
      session = await prisma.workoutSession.create({
        data: {
          userId: payload.userId,
          workoutId,
          dayLabel,
          status: status ?? 'in-progress',
          results: results ?? null,
          startedAt: startedAt ? new Date(startedAt) : new Date(),
          finishedAt: finishedAt ? new Date(finishedAt) : null,
        },
      });
    }

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('Workout session error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
