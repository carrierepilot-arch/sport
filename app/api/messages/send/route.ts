import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { enforceRequestRateLimit } from '@/lib/request-rate-limit';
import { encryptMessageContent } from '@/lib/message-crypto';

export async function POST(request: NextRequest) {
 try {
 const limited = await enforceRequestRateLimit(request);
 if (limited) return limited;

 const authHeader = request.headers.get('authorization');
 const token = authHeader?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const { receiverId, content } = await request.json();
 if (!receiverId || !content?.trim()) {
 return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
 }

 const normalizedContent = content.trim();
 const msg = await prisma.message.create({
 data: { senderId: payload.userId, receiverId, content: encryptMessageContent(normalizedContent) },
 });

 await prisma.activityLog.create({
 data: { userId: payload.userId, action: 'message_sent', details: `À: ${receiverId}` },
 });

 return NextResponse.json({
 success: true,
 message: {
 id: msg.id,
 from: 'me' as const,
 text: normalizedContent,
 heure: new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
 },
 });
 } catch (error) {
 console.error('Send message error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
