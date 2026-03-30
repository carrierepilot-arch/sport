import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getProfileImageUrl } from '@/lib/social';
import { buildMessagePreview } from '@/lib/message-crypto';

export async function GET(request: NextRequest) {
 try {
 const authHeader = request.headers.get('authorization');
 const token = authHeader?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 // Tous les messages impliquant cet utilisateur, groupés par interlocuteur.
 // Avoid relation includes here to tolerate orphaned historical rows.
 const messages = await prisma.message.findMany({
 where: {
 OR: [{ senderId: payload.userId }, { receiverId: payload.userId }],
 },
 select: {
 id: true,
 senderId: true,
 receiverId: true,
 content: true,
 read: true,
 createdAt: true,
 },
 orderBy: { createdAt: 'desc' },
 });

 const friendIds = Array.from(
 new Set(
 messages.map((m) => (m.senderId === payload.userId ? m.receiverId : m.senderId)).filter(Boolean),
 ),
 );

 const users = friendIds.length
 ? await prisma.user.findMany({
 where: { id: { in: friendIds } },
 select: { id: true, pseudo: true, name: true, email: true, equipmentData: true },
 })
 : [];
 const userMap = new Map(users.map((u) => [u.id, u]));

 // Dédupliquer par interlocuteur, garder le dernier message
 const convMap = new Map<string, {
 friendId: string; pseudo: string; nom: string; dernier: string; heure: string; nonLu: number; profileImageUrl: string | null;
 }>();

 for (const msg of messages) {
 const friendId = msg.senderId === payload.userId ? msg.receiverId : msg.senderId;
 const friend = userMap.get(friendId);
 const pseudo = friend?.pseudo ?? friend?.email ?? 'utilisateur';
 const nom = friend?.name ?? friend?.email ?? 'Utilisateur';
 if (!convMap.has(friendId)) {
 const nonLu = messages.filter(
 (m) => m.senderId === friendId && m.receiverId === payload.userId && !m.read
 ).length;
 convMap.set(friendId, {
 friendId,
 pseudo,
 nom,
 dernier: buildMessagePreview(msg.content),
 heure: new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
 nonLu,
 profileImageUrl: getProfileImageUrl(friend?.equipmentData),
 });
 }
 }

 return NextResponse.json({ conversations: Array.from(convMap.values()) });
 } catch (error) {
 console.error('List conversations error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
