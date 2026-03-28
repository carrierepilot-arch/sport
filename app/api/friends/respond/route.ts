import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
 try {
 const authHeader = request.headers.get('authorization');
 const token = authHeader?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const { requestId, action } = await request.json();
 if (!requestId || !['accept', 'reject'].includes(action)) {
 return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
 }

 const friendReq = await prisma.friendRequest.findUnique({ where: { id: requestId } });
 if (!friendReq || friendReq.receiverId !== payload.userId) {
 return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
 }

 if (action === 'accept') {
 await prisma.friendRequest.update({
 where: { id: requestId },
 data: { status: 'accepted' },
 });
 await prisma.activityLog.create({
 data: { userId: payload.userId, action: 'friend_request_accepted', details: `De: ${friendReq.senderId}` },
 });
 } else {
 await prisma.friendRequest.delete({ where: { id: requestId } });
 }

 return NextResponse.json({ success: true });
 } catch (error) {
 console.error('Respond friend request error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
