import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// GET — fetch pending validation requests for the logged-in user (as validator)
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const requests = await prisma.performanceValidation.findMany({
      where: { validatorId: payload.userId, status: 'pending' },
      include: {
        performance: {
          include: {
            user: { select: { id: true, pseudo: true, name: true } },
            spot: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Validate GET error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — action: 'request' (owner sends to friends) | 'respond' (friend validates/invalidates)
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    // ── 1. Owner sends validation requests to friends ──
    if (action === 'request') {
      const { performanceId, validatorIds } = body as { performanceId: string; validatorIds: string[] };
      if (!performanceId || !Array.isArray(validatorIds) || validatorIds.length === 0) {
        return NextResponse.json({ error: 'performanceId et validatorIds requis' }, { status: 400 });
      }

      const perf = await prisma.performance.findUnique({ where: { id: performanceId } });
      if (!perf) return NextResponse.json({ error: 'Performance introuvable' }, { status: 404 });
      if (perf.userId !== payload.userId) {
        return NextResponse.json({ error: 'Vous ne pouvez envoyer des demandes que pour vos propres performances' }, { status: 403 });
      }

      // Upsert: only create pending if no record exists yet (don't override accepted/rejected)
      const results = await Promise.all(
        validatorIds.map((validatorId) =>
          prisma.performanceValidation.upsert({
            where: { performanceId_validatorId: { performanceId, validatorId } },
            update: {},
            create: { performanceId, validatorId, status: 'pending' },
          }),
        ),
      );

      return NextResponse.json({ sent: results.length });
    }

    // ── 2. Friend responds to a validation request ──
    if (action === 'respond') {
      const { performanceId, isValid } = body as { performanceId: string; isValid: boolean };
      if (!performanceId || isValid === undefined) {
        return NextResponse.json({ error: 'performanceId et isValid requis' }, { status: 400 });
      }

      const perf = await prisma.performance.findUnique({ where: { id: performanceId } });
      if (!perf) return NextResponse.json({ error: 'Performance introuvable' }, { status: 404 });
      if (perf.userId === payload.userId) {
        return NextResponse.json({ error: 'Vous ne pouvez pas valider votre propre performance' }, { status: 403 });
      }

      const newStatus = isValid ? 'accepted' : 'rejected';

      await prisma.performanceValidation.upsert({
        where: { performanceId_validatorId: { performanceId, validatorId: payload.userId } },
        update: { status: newStatus },
        create: { performanceId, validatorId: payload.userId, status: newStatus },
      });

      // Auto-validate: 2+ accepted → validated
      const acceptedCount = await prisma.performanceValidation.count({
        where: { performanceId, status: 'accepted' },
      });

      if (acceptedCount >= 2 && perf.status === 'pending') {
        await prisma.performance.update({ where: { id: performanceId }, data: { status: 'validated' } });
      }

      return NextResponse.json({ ok: true, accepted: acceptedCount });
    }

    return NextResponse.json({ error: 'action invalide' }, { status: 400 });
  } catch (error) {
    console.error('Validate POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
