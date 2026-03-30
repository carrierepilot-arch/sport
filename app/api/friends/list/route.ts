import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getProfileImageUrl } from '@/lib/social';

export async function GET(request: NextRequest) {
 try {
 const authHeader = request.headers.get('authorization');
 const token = authHeader?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const [accepted, received, sent] = await Promise.all([
 // Amis acceptés (je suis sender ou receiver)
 prisma.friendRequest.findMany({
 where: {
 status: { in: ['accepted', 'accepte'] },
 OR: [{ senderId: payload.userId }, { receiverId: payload.userId }],
 },
 select: { id: true, senderId: true, receiverId: true },
 }),
 // Demandes reçues en attente
 prisma.friendRequest.findMany({
 where: { receiverId: payload.userId, status: { in: ['pending', 'en_attente'] } },
 select: { id: true, senderId: true },
 }),
 // Demandes envoyées en attente
 prisma.friendRequest.findMany({
 where: { senderId: payload.userId, status: { in: ['pending', 'en_attente'] } },
 select: { id: true, receiverId: true },
 }),
 ]);

 const userIds = Array.from(
 new Set([
 ...accepted.map((r) => r.senderId),
 ...accepted.map((r) => r.receiverId),
 ...received.map((r) => r.senderId),
 ...sent.map((r) => r.receiverId),
 ]),
 );
 const users = userIds.length
 ? await prisma.user.findMany({
 where: { id: { in: userIds } },
 select: { id: true, pseudo: true, name: true, email: true, equipmentData: true },
 })
 : [];
 const userMap = new Map(users.map((u) => [u.id, u]));

 const amis = accepted.map((r) => {
 const friendId = r.senderId === payload.userId ? r.receiverId : r.senderId;
 const friend = userMap.get(friendId);
 return {
 id: r.id,
 friendId,
 pseudo: friend?.pseudo ?? friend?.email ?? 'ami',
 nom: friend?.name ?? friend?.email ?? 'Ami',
 profileImageUrl: getProfileImageUrl(friend?.equipmentData),
 statut: 'accepte' as const,
 };
 });

 const recus = received.map((r) => ({
 id: r.id,
 friendId: r.senderId,
 pseudo: userMap.get(r.senderId)?.pseudo ?? userMap.get(r.senderId)?.email ?? 'ami',
 nom: userMap.get(r.senderId)?.name ?? userMap.get(r.senderId)?.email ?? 'Ami',
 profileImageUrl: getProfileImageUrl(userMap.get(r.senderId)?.equipmentData),
 statut: 'recu' as const,
 }));

 const enAttente = sent.map((r) => ({
 id: r.id,
 friendId: r.receiverId,
 pseudo: userMap.get(r.receiverId)?.pseudo ?? userMap.get(r.receiverId)?.email ?? 'ami',
 nom: userMap.get(r.receiverId)?.name ?? userMap.get(r.receiverId)?.email ?? 'Ami',
 profileImageUrl: getProfileImageUrl(userMap.get(r.receiverId)?.equipmentData),
 statut: 'en_attente' as const,
 }));

 return NextResponse.json({ amis, recus, enAttente });
 } catch (error) {
 console.error('List friends error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
