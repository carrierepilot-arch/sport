import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

async function getPayload(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload(request);
    if (!payload) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { targetUserId?: string };
    const targetUserId = (body.targetUserId ?? '').trim();
    if (!targetUserId || targetUserId === payload.userId) {
      return NextResponse.json({ error: 'Utilisateur cible invalide' }, { status: 400 });
    }

    await prisma.suggestion.deleteMany({
      where: { category: 'follow_user', userId: payload.userId, text: targetUserId },
    });

    await prisma.suggestion.create({
      data: {
        userId: payload.userId,
        text: targetUserId,
        category: 'follow_user',
        status: 'active',
      },
    });

    return NextResponse.json({ ok: true, following: true });
  } catch (error) {
    console.error('Follow POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getPayload(request);
    if (!payload) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { targetUserId?: string };
    const targetUserId = (body.targetUserId ?? '').trim();
    if (!targetUserId) {
      return NextResponse.json({ error: 'Utilisateur cible invalide' }, { status: 400 });
    }

    await prisma.suggestion.deleteMany({
      where: { category: 'follow_user', userId: payload.userId, text: targetUserId },
    });

    return NextResponse.json({ ok: true, following: false });
  } catch (error) {
    console.error('Follow DELETE error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
