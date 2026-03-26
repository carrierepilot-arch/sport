import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// POST — add a member to a group
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { groupId, userId } = await request.json();
    if (!groupId || !userId) {
      return NextResponse.json({ error: 'groupId et userId requis' }, { status: 400 });
    }

    // Verify the requester is the owner of the group
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 });
    if (group.ownerId !== payload.userId) {
      return NextResponse.json({ error: 'Seul le créateur du groupe peut ajouter des membres' }, { status: 403 });
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

    // Check if already a member
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (existing) return NextResponse.json({ error: 'Déjà membre du groupe' }, { status: 409 });

    await prisma.groupMember.create({ data: { groupId, userId } });

    // Return updated group
    const updated = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: { select: { id: true, pseudo: true, name: true } },
        members: {
          include: { user: { select: { id: true, pseudo: true, name: true } } },
        },
      },
    });

    return NextResponse.json({ group: updated });
  } catch (error) {
    console.error('Add member error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE — remove a member from a group
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { groupId, userId } = await request.json();
    if (!groupId || !userId) {
      return NextResponse.json({ error: 'groupId et userId requis' }, { status: 400 });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 });

    // Owner can remove anyone, members can remove themselves
    if (group.ownerId !== payload.userId && payload.userId !== userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Cannot remove the owner
    if (userId === group.ownerId) {
      return NextResponse.json({ error: 'Le créateur ne peut pas être retiré du groupe' }, { status: 400 });
    }

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
