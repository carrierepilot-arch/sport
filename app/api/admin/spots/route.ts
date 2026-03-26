import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { isAdmin: true } });
  return user?.isAdmin ? payload : null;
}

// GET — spots en attente + tous les spots
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const spots = await prisma.spot.findMany({
    include: {
      addedByUser: { select: { pseudo: true, name: true } },
      _count: { select: { performances: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ spots });
}

// POST — approve / reject / delete spot
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { spotId, action } = await request.json();
  if (!spotId || !['approve', 'reject', 'delete'].includes(action)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  if (action === 'delete') {
    await prisma.performance.deleteMany({ where: { spotId } });
    await prisma.spot.delete({ where: { id: spotId } });
    return NextResponse.json({ success: true });
  }

  const spot = await prisma.spot.update({
    where: { id: spotId },
    data: { status: action === 'approve' ? 'approved' : 'rejected' },
  });

  return NextResponse.json({ success: true, spot });
}
