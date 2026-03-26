import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { pseudo } = await request.json();
    if (!pseudo?.trim()) return NextResponse.json({ error: 'Pseudo, nom ou email requis' }, { status: 400 });

    const search = pseudo.trim();
    // Cherche par pseudo, nom ou email (insensible à la casse)
    const target = await prisma.user.findFirst({
      where: {
        OR: [
          { pseudo: { equals: search, mode: 'insensitive' } },
          { name:   { equals: search, mode: 'insensitive' } },
          { email:  { equals: search.toLowerCase() } },
        ],
      },
    });
    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    if (target.id === payload.userId) return NextResponse.json({ error: 'Vous ne pouvez pas vous ajouter vous-même' }, { status: 400 });

    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: payload.userId, receiverId: target.id },
          { senderId: target.id, receiverId: payload.userId },
        ],
      },
    });
    if (existing) return NextResponse.json({ error: 'Demande déjà existante' }, { status: 409 });

    const req = await prisma.friendRequest.create({
      data: { senderId: payload.userId, receiverId: target.id, status: 'pending' },
    });

    await prisma.activityLog.create({
      data: { userId: payload.userId, action: 'friend_request_sent', details: `À: ${target.email}` },
    });

    return NextResponse.json({ success: true, requestId: req.id });
  } catch (error) {
    console.error('Send friend request error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
