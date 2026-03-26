import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// GET — liste les workouts de l'utilisateur
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const workouts = await prisma.workout.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: { orderBy: { createdAt: 'desc' } },
      },
    });

    return NextResponse.json({ workouts });
  } catch (error) {
    console.error('Get workouts error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — sauvegarder un nouveau workout
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { title, rawText, programme, config, sharedBy } = await request.json();
    if (!rawText && !programme) {
      return NextResponse.json({ error: 'Programme requis' }, { status: 400 });
    }

    const workout = await prisma.workout.create({
      data: {
        userId: payload.userId,
        title: title || null,
        rawText: rawText || JSON.stringify(programme),
        programme: programme || {},
        config: config || null,
        sharedBy: sharedBy || null,
      },
    });

    return NextResponse.json({ success: true, workout });
  } catch (error) {
    console.error('Save workout error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH — renommer un workout
export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { workoutId, title } = await request.json();
    if (!workoutId || typeof title !== 'string') {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const workout = await prisma.workout.findUnique({ where: { id: workoutId } });
    if (!workout || workout.userId !== payload.userId) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }

    const updated = await prisma.workout.update({
      where: { id: workoutId },
      data: { title: title.trim() || workout.title },
    });

    return NextResponse.json({ success: true, workout: updated });
  } catch (error) {
    console.error('Rename workout error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE — supprimer un workout
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { workoutId } = await request.json();
    const workout = await prisma.workout.findUnique({ where: { id: workoutId } });
    if (!workout || workout.userId !== payload.userId) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    }

    await prisma.workoutSession.deleteMany({ where: { workoutId } });
    await prisma.workout.delete({ where: { id: workoutId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workout error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
