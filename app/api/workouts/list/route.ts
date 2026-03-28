import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
 try {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const workouts = await prisma.workout.findMany({
 where: { userId: payload.userId },
 orderBy: { createdAt: 'desc' },
 include: {
 sessions: {
 orderBy: { createdAt: 'desc' },
 },
 },
 });

 return NextResponse.json({ workouts });
 } catch (error) {
 console.error('List workouts error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
