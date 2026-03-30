import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { enforceRequestRateLimit } from '@/lib/request-rate-limit';
import { decryptMessageContent, encryptMessageContent } from '@/lib/message-crypto';

// GET — get messages for a group (must be a member)
export async function GET(request: NextRequest) {
 try {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const { searchParams } = new URL(request.url);
 const groupId = searchParams.get('groupId');
 if (!groupId) return NextResponse.json({ error: 'groupId requis' }, { status: 400 });

 // Verify membership
 const member = await prisma.groupMember.findUnique({
 where: { groupId_userId: { groupId, userId: payload.userId } },
 });
 if (!member) return NextResponse.json({ error: 'Non membre du groupe' }, { status: 403 });

 const messages = await prisma.groupMessage.findMany({
 where: { groupId },
 include: { user: { select: { id: true, pseudo: true, name: true } } },
 orderBy: { createdAt: 'asc' },
 take: 100,
 });

 return NextResponse.json({
 messages: messages.map((message) => ({
 ...message,
 content: decryptMessageContent(message.content),
 })),
 currentUserId: payload.userId,
 });
 } catch (error) {
 console.error('Group messages GET error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}

// POST — send a message to a group
export async function POST(request: NextRequest) {
 try {
 const limited = await enforceRequestRateLimit(request);
 if (limited) return limited;

 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const { groupId, content } = await request.json();
 if (!groupId || !content?.trim()) {
 return NextResponse.json({ error: 'groupId et content requis' }, { status: 400 });
 }

 // Verify membership
 const member = await prisma.groupMember.findUnique({
 where: { groupId_userId: { groupId, userId: payload.userId } },
 });
 if (!member) return NextResponse.json({ error: 'Non membre du groupe' }, { status: 403 });

 const normalizedContent = content.trim();
 const message = await prisma.groupMessage.create({
 data: { groupId, userId: payload.userId, content: encryptMessageContent(normalizedContent) },
 include: { user: { select: { id: true, pseudo: true, name: true } } },
 });

 return NextResponse.json({ message: { ...message, content: normalizedContent } });
 } catch (error) {
 console.error('Group messages POST error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
