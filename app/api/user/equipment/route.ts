import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { equipmentData: true } });
    return NextResponse.json({ equipmentData: user?.equipmentData ?? null });
  } catch (error) { console.error('Equipment GET error:', error); return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    const { equipmentData } = await request.json();
    const existing = await prisma.user.findUnique({ where: { id: payload.userId }, select: { equipmentData: true } });
    const previous = existing?.equipmentData && typeof existing.equipmentData === 'object' ? (existing.equipmentData as Record<string, unknown>) : {};
    const incoming = equipmentData && typeof equipmentData === 'object' ? (equipmentData as Record<string, unknown>) : {};
    await prisma.user.update({
      where: { id: payload.userId },
      data: {
        equipmentData: {
          ...incoming,
          ...(typeof previous.profileImageUrl === 'string' && previous.profileImageUrl ? { profileImageUrl: previous.profileImageUrl } : {}),
          ...(Array.isArray(previous.favoriteSpotIds) ? { favoriteSpotIds: previous.favoriteSpotIds } : {}),
        },
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) { console.error('Equipment POST error:', error); return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }); }
}