import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
 try {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const { searchParams } = new URL(request.url);
 const cityFilter = searchParams.get('city')?.trim() || '';
 const rawLimit = searchParams.get('limit');
 const limitNum = rawLimit ? parseInt(rawLimit, 10) : null;
 const take = limitNum && limitNum > 0 ? Math.min(limitNum, 5000) : undefined;

 const spots = await prisma.spot.findMany({
 where: {
 status: 'approved',
 ...(cityFilter
 ? { city: { contains: cityFilter, mode: 'insensitive' } }
 : {}),
 },
 select: {
 id: true,
 name: true,
 city: true,
 latitude: true,
 longitude: true,
 _count: {
 select: { performances: true, regulars: true },
 },
 },
 orderBy: { name: 'asc' },
 ...(take ? { take } : {}),
 });

 return NextResponse.json({ spots });
 } catch (error) {
 console.error('Spots error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}

export async function POST(request: NextRequest) {
 try {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const { name, city, latitude, longitude } = await request.json();
 if (!name || typeof name !== 'string' || name.trim().length < 2) {
 return NextResponse.json({ error: 'Nom du spot requis (min 2 caractères)' }, { status: 400 });
 }

 const spot = await prisma.spot.create({
 data: {
 name: name.trim(),
 city: city?.trim() || null,
 latitude: typeof latitude === 'number' ? latitude : null,
 longitude: typeof longitude === 'number' ? longitude : null,
 addedBy: payload.userId,
 status: 'pending',
 },
 });

 return NextResponse.json({ success: true, spot });
 } catch (error) {
 console.error('Create spot error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
