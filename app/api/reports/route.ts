import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { enforceRequestRateLimit } from '@/lib/request-rate-limit';

function getReportedUserId(payloadUserId: string, targetType: string, payload: Record<string, unknown>): string | null {
 if (targetType === 'user') {
 const userId = String(payload.userId || '').trim();
 return userId || null;
 }
 if (targetType === 'message') {
 const senderId = String(payload.senderId || '').trim();
 return senderId || null;
 }
 if (targetType === 'group') {
 const ownerId = String(payload.ownerId || '').trim();
 return ownerId || null;
 }
 if (targetType === 'performance') {
 const userId = String(payload.userId || '').trim();
 return userId || null;
 }
 return null;
}

export async function POST(request: NextRequest) {
 try {
 const limited = await enforceRequestRateLimit(request);
 if (limited) return limited;

 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const auth = verifyToken(token);
 if (!auth) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const body = await request.json();
 const targetType = String(body.targetType || '').trim();
 const targetId = String(body.targetId || '').trim();
 const reason = String(body.reason || '').trim();

 if (!targetType || !targetId) {
 return NextResponse.json({ error: 'targetType et targetId requis' }, { status: 400 });
 }

 const reportedUserId = getReportedUserId(auth.userId, targetType, body as Record<string, unknown>);

 await prisma.report.create({
 data: {
 reporterId: auth.userId,
 reportedUserId,
 targetType,
 targetId,
 reason: reason || null,
 },
 });

 return NextResponse.json({ success: true });
 } catch (error) {
 console.error('Report create error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
