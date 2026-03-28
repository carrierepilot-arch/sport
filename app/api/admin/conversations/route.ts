import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'conversations:read');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 const [dmMessages, groups] = await Promise.all([
 prisma.message.findMany({
 select: {
 senderId: true,
 receiverId: true,
 createdAt: true,
 sender: { select: { pseudo: true, name: true, email: true } },
 receiver: { select: { pseudo: true, name: true, email: true } },
 },
 orderBy: { createdAt: 'desc' },
 take: 3000,
 }),
 prisma.group.findMany({
 include: {
 owner: { select: { pseudo: true, name: true, email: true } },
 _count: { select: { messages: true, members: true } },
 },
 orderBy: { createdAt: 'desc' },
 take: 200,
 }),
 ]);

 const dmMap = new Map<string, {
 key: string;
 userAId: string;
 userBId: string;
 userA: string;
 userB: string;
 count: number;
 lastAt: string;
 }>();

 for (const msg of dmMessages) {
 const ids = [msg.senderId, msg.receiverId].sort();
 const key = `${ids[0]}:${ids[1]}`;
 const entry = dmMap.get(key);
 if (entry) {
 entry.count += 1;
 if (new Date(msg.createdAt) > new Date(entry.lastAt)) entry.lastAt = msg.createdAt.toISOString();
 continue;
 }

 const senderName = msg.sender.pseudo || msg.sender.name || msg.sender.email;
 const receiverName = msg.receiver.pseudo || msg.receiver.name || msg.receiver.email;
 dmMap.set(key, {
 key,
 userAId: ids[0],
 userBId: ids[1],
 userA: ids[0] === msg.senderId ? senderName : receiverName,
 userB: ids[1] === msg.receiverId ? receiverName : senderName,
 count: 1,
 lastAt: msg.createdAt.toISOString(),
 });
 }

 const directConversations = Array.from(dmMap.values()).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
 const groupConversations = groups.map((g) => ({
 id: g.id,
 name: g.name,
 owner: g.owner.pseudo || g.owner.name || g.owner.email,
 members: g._count.members,
 messages: g._count.messages,
 createdAt: g.createdAt.toISOString(),
 }));

 return NextResponse.json({ directConversations, groupConversations });
}

export async function DELETE(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'conversations:write');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 try {
 const { type, userAId, userBId, groupId } = await request.json();

 if (type === 'direct') {
 if (!userAId || !userBId) return NextResponse.json({ error: 'userAId et userBId requis' }, { status: 400 });
 const result = await prisma.message.deleteMany({
 where: {
 OR: [
 { senderId: userAId, receiverId: userBId },
 { senderId: userBId, receiverId: userAId },
 ],
 },
 });
 await logAdminAction(admin.userId, 'admin.conversation.delete_direct', `userAId=${userAId} userBId=${userBId} deleted=${result.count}`);
 return NextResponse.json({ success: true, deleted: result.count });
 }

 if (type === 'group') {
 if (!groupId) return NextResponse.json({ error: 'groupId requis' }, { status: 400 });
 await prisma.group.delete({ where: { id: groupId } });
 await logAdminAction(admin.userId, 'admin.conversation.delete_group', `groupId=${groupId}`);
 return NextResponse.json({ success: true });
 }

 return NextResponse.json({ error: 'type invalide' }, { status: 400 });
 } catch {
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
