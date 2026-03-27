import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user?.isAdmin) return null;
  return user;
}

// GET — list all performances (admin)
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  try {
    const performances = await prisma.performance.findMany({
      include: {
        user: { select: { id: true, pseudo: true, name: true, email: true } },
        spot: { select: { id: true, name: true, city: true } },
        validations: { select: { validatorId: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ performances });
  } catch (error) {
    console.error('Admin performances GET:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT — update a performance (admin)
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  try {
    const { performanceId, score, status } = await request.json();
    if (!performanceId) return NextResponse.json({ error: 'performanceId requis' }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (score !== undefined) data.score = Number(score);
    if (status !== undefined) data.status = String(status);

    const updated = await prisma.performance.update({
      where: { id: performanceId },
      data,
      include: {
        user: { select: { id: true, pseudo: true, name: true, email: true } },
        spot: { select: { id: true, name: true, city: true } },
        validations: { select: { validatorId: true, status: true } },
      },
    });
    return NextResponse.json({ performance: updated });
  } catch (error) {
    console.error('Admin performances PUT:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE — delete a performance (admin)
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  try {
    const { performanceId } = await request.json();
    if (!performanceId) return NextResponse.json({ error: 'performanceId requis' }, { status: 400 });

    await prisma.performance.delete({ where: { id: performanceId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin performances DELETE:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
