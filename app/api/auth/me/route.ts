import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, pseudo: true, isAdmin: true, level: true, xp: true, equipmentData: true },
    });

    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
