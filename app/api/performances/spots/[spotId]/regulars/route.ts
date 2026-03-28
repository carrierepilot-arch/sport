import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// POST /api/performances/spots/[spotId]/regulars — toggle regular status
export async function POST(
 request: NextRequest,
 { params }: { params: Promise<{ spotId: string }> }
) {
 try {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const { spotId } = await params;

 const spot = await prisma.spot.findUnique({ where: { id: spotId } });
 if (!spot) return NextResponse.json({ error: 'Spot introuvable' }, { status: 404 });

 // Check if already regular
 const existing = await prisma.spotRegular.findUnique({
 where: { spotId_userId: { spotId, userId: payload.userId } },
 });

 if (existing) {
 // Remove
 await prisma.spotRegular.delete({ where: { id: existing.id } });
 return NextResponse.json({ isRegular: false });
 } else {
 // Add
 await prisma.spotRegular.create({ data: { spotId, userId: payload.userId } });
 return NextResponse.json({ isRegular: true });
 }
 } catch (error) {
 console.error('Toggle regular error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
