import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// GET — list groups the user owns or is a member of
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const userId = payload.userId;

    const groups = await prisma.group.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        owner: { select: { id: true, pseudo: true, name: true } },
        members: {
          include: { user: { select: { id: true, pseudo: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ groups, currentUserId: userId });
  } catch (error) {
    console.error('Groups list error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — create a new group
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nom du groupe requis' }, { status: 400 });
    }

    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        ownerId: payload.userId,
        members: {
          create: { userId: payload.userId },
        },
      },
      include: {
        owner: { select: { id: true, pseudo: true, name: true } },
        members: {
          include: { user: { select: { id: true, pseudo: true, name: true } } },
        },
      },
    });

    return NextResponse.json({ group });
  } catch (error) {
    console.error('Group create error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE — delete a group (owner only)
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { groupId } = await request.json();
    if (!groupId) return NextResponse.json({ error: 'groupId requis' }, { status: 400 });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 });
    if (group.ownerId !== payload.userId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

    await prisma.group.delete({ where: { id: groupId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Group delete error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
