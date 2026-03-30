import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { decryptMessageContent } from '@/lib/message-crypto';

export async function GET(
 request: NextRequest,
 { params }: { params: Promise<{ userId: string }> }
) {
 try {
 const authHeader = request.headers.get('authorization');
 const token = authHeader?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const { userId: otherId } = await params;

 const messages = await prisma.message.findMany({
 where: {
 OR: [
 { senderId: payload.userId, receiverId: otherId },
 { senderId: otherId, receiverId: payload.userId },
 ],
 },
 orderBy: { createdAt: 'asc' },
 });

 // Marquer les messages reçus comme lus
 await prisma.message.updateMany({
 where: { senderId: otherId, receiverId: payload.userId, read: false },
 data: { read: true },
 });

 const result = messages.map((m) => ({
 id: m.id,
 from: m.senderId === payload.userId ? ('me' as const) : ('them' as const),
 text: decryptMessageContent(m.content),
 heure: new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
 }));

 return NextResponse.json({ messages: result });
 } catch (error) {
 console.error('Get messages error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
