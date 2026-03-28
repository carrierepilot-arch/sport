import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

type EquipmentDataLike = {
 favoriteSpotIds?: string[];
 [key: string]: unknown;
};

function readFavoriteIds(value: unknown): string[] {
 if (!value || typeof value !== 'object') return [];
 const data = value as EquipmentDataLike;
 return Array.isArray(data.favoriteSpotIds)
 ? data.favoriteSpotIds.filter((x): x is string => typeof x === 'string')
 : [];
}

function getUserId(request: NextRequest): string | null {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return null;
 const payload = verifyToken(token);
 return payload?.userId || null;
}

export async function GET(request: NextRequest) {
 const userId = getUserId(request);
 if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

 try {
 const favorites = await prisma.spotFavorite.findMany({
 where: { userId },
 select: { spotId: true },
 });
 return NextResponse.json({ favorites: favorites.map((f) => f.spotId) });
 } catch {
 const user = await prisma.user.findUnique({ where: { id: userId }, select: { equipmentData: true } });
 return NextResponse.json({ favorites: readFavoriteIds(user?.equipmentData) });
 }
}

export async function POST(request: NextRequest) {
 const userId = getUserId(request);
 if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

 const { spotId } = await request.json();
 if (!spotId) return NextResponse.json({ error: 'spotId requis' }, { status: 400 });

 try {
 const existing = await prisma.spotFavorite.findUnique({ where: { spotId_userId: { spotId, userId } } });
 if (existing) {
 await prisma.spotFavorite.delete({ where: { spotId_userId: { spotId, userId } } });
 return NextResponse.json({ success: true, isFavorite: false });
 }

 await prisma.spotFavorite.create({ data: { spotId, userId } });
 return NextResponse.json({ success: true, isFavorite: true });
 } catch {
 const user = await prisma.user.findUnique({ where: { id: userId }, select: { equipmentData: true } });
 const current = readFavoriteIds(user?.equipmentData);
 const exists = current.includes(spotId);
 const next = exists ? current.filter((id) => id !== spotId) : [...current, spotId];

 const baseData: EquipmentDataLike = user?.equipmentData && typeof user.equipmentData === 'object'
 ? (user.equipmentData as EquipmentDataLike)
 : {};

 await prisma.user.update({
 where: { id: userId },
 data: {
 equipmentData: {
 ...baseData,
 favoriteSpotIds: next,
 },
 },
 });

 return NextResponse.json({ success: true, isFavorite: !exists });
 }
}
