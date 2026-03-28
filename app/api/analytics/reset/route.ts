import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
 try {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const userId = payload.userId;

 // Delete all workout sessions
 await prisma.workoutSession.deleteMany({ where: { userId } });

 // Delete all workouts
 await prisma.workout.deleteMany({ where: { userId } });

 // Delete challenge completions
 await prisma.challengeCompletion.deleteMany({ where: { userId } });

 // Reset physical data
 await prisma.user.update({
 where: { id: userId },
 data: { physicalData: Prisma.DbNull, xp: 0 },
 });

 // Delete level test activity logs
 await prisma.activityLog.deleteMany({
 where: { userId, action: { in: ['level_test', 'ai_api_call'] } },
 });

 return NextResponse.json({ success: true });
 } catch (error) {
 console.error('Reset error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
