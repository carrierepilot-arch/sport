import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user?.isAdmin) return null;
  return payload;
}

// PATCH — suspend/unsuspend a user
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { suspended } = body;

    if (typeof suspended !== 'boolean') {
      return NextResponse.json({ error: 'Champ "suspended" requis (boolean)' }, { status: 400 });
    }

    // Prevent suspending yourself
    if (id === admin.userId) {
      return NextResponse.json({ error: 'Vous ne pouvez pas vous suspendre vous-même' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    if (target.isAdmin) return NextResponse.json({ error: 'Impossible de suspendre un administrateur' }, { status: 400 });

    const updated = await prisma.user.update({
      where: { id },
      data: { suspended },
      select: { id: true, email: true, suspended: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('Admin suspend error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE — delete a user and all their data
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;

    // Prevent self-deletion
    if (id === admin.userId) {
      return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    if (target.isAdmin) return NextResponse.json({ error: 'Impossible de supprimer un administrateur' }, { status: 400 });

    // Delete all related data then the user (cascading via Prisma relations)
    await prisma.$transaction([
      prisma.badge.deleteMany({ where: { userId: id } }),
      prisma.activityLog.deleteMany({ where: { userId: id } }),
      prisma.userSession.deleteMany({ where: { userId: id } }),
      prisma.message.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } }),
      prisma.friendRequest.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } }),
      prisma.workoutSession.deleteMany({ where: { userId: id } }),
      prisma.workout.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
