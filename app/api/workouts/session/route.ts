import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// POST /api/workouts/session — créer ou mettre à jour une WorkoutSession
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { workoutId, dayLabel, status, results, sessionId } = await request.json();

    if (sessionId) {
      // Mise à jour d'une session existante
      const updated = await prisma.workoutSession.update({
        where: { id: sessionId },
        data: {
          status,
          results: results ?? undefined,
          finishedAt: status === 'done' ? new Date() : undefined,
        },
      });
      return NextResponse.json({ success: true, session: updated });
    }

    // Vérifier que le workout appartient à cet utilisateur
    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId: payload.userId },
    });
    if (!workout) return NextResponse.json({ error: 'Workout introuvable' }, { status: 404 });

    // Créer une nouvelle session
    const session = await prisma.workoutSession.create({
      data: {
        userId: payload.userId,
        workoutId,
        dayLabel,
        status: status ?? 'started',
        results: results ?? undefined,
        startedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('Workout session error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
