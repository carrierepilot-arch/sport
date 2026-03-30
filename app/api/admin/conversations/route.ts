import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';
import { decryptMessageContent } from '@/lib/message-crypto';

export async function GET(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'conversations:read');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 const reports = await prisma.report.findMany({
 where: { targetType: 'message' },
 orderBy: { createdAt: 'desc' },
 include: {
 reporter: { select: { id: true, pseudo: true, name: true, email: true } },
 reportedUser: { select: { id: true, pseudo: true, name: true, email: true } },
 },
 take: 500,
 });

 const targetIds = Array.from(new Set(reports.map((report) => report.targetId)));
 const [directMessages, groupMessages] = await Promise.all([
 targetIds.length
 ? prisma.message.findMany({
 select: {
 id: true,
 senderId: true,
 receiverId: true,
 content: true,
 createdAt: true,
 sender: { select: { pseudo: true, name: true, email: true } },
 receiver: { select: { pseudo: true, name: true, email: true } },
 },
 where: { id: { in: targetIds } },
 })
 : Promise.resolve([]),
 targetIds.length
 ? prisma.groupMessage.findMany({
 select: {
 id: true,
 userId: true,
 groupId: true,
 content: true,
 createdAt: true,
 user: { select: { pseudo: true, name: true, email: true } },
 group: { select: { id: true, name: true } },
 },
 where: { id: { in: targetIds } },
 })
 : Promise.resolve([]),
 ]);

 const directById = new Map(directMessages.map((message) => [message.id, message]));
 const groupById = new Map(groupMessages.map((message) => [message.id, message]));
 const groupedReports = reports.reduce((acc, report) => {
 const bucket = acc.get(report.targetId) ?? [];
 bucket.push(report);
 acc.set(report.targetId, bucket);
 return acc;
 }, new Map<string, typeof reports>());

 const directConversations = Array.from(groupedReports.entries())
 .map(([targetId, items]) => {
 const message = directById.get(targetId);
 if (!message) return null;
 return {
 key: targetId,
 messageId: targetId,
 sender: message.sender.pseudo || message.sender.name || message.sender.email,
 recipient: message.receiver.pseudo || message.receiver.name || message.receiver.email,
 preview: decryptMessageContent(message.content),
 reason: items[0]?.reason ?? null,
 reportCount: items.length,
 lastAt: message.createdAt.toISOString(),
 };
 })
 .filter((item): item is NonNullable<typeof item> => !!item)
 .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

 const groupConversations = Array.from(groupedReports.entries())
 .map(([targetId, items]) => {
 const message = groupById.get(targetId);
 if (!message) return null;
 return {
 id: targetId,
 messageId: targetId,
 name: message.group.name,
 owner: message.user.pseudo || message.user.name || message.user.email,
 preview: decryptMessageContent(message.content),
 reason: items[0]?.reason ?? null,
 members: items.length,
 messages: 1,
 createdAt: message.createdAt.toISOString(),
 };
 })
 .filter((item): item is NonNullable<typeof item> => !!item)
 .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

 return NextResponse.json({ directConversations, groupConversations });
}

export async function DELETE(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'conversations:write');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 try {
 const { type, messageId, groupId } = await request.json();

 if (type === 'direct') {
 if (!messageId) return NextResponse.json({ error: 'messageId requis' }, { status: 400 });
 await prisma.message.delete({ where: { id: messageId } });
 await prisma.report.deleteMany({ where: { targetType: 'message', targetId: messageId } });
 await logAdminAction(admin.userId, 'admin.conversation.delete_direct', `messageId=${messageId}`);
 return NextResponse.json({ success: true, deleted: 1 });
 }

 if (type === 'group') {
 if (!groupId) return NextResponse.json({ error: 'messageId requis' }, { status: 400 });
 await prisma.groupMessage.delete({ where: { id: groupId } });
 await prisma.report.deleteMany({ where: { targetType: 'message', targetId: groupId } });
 await logAdminAction(admin.userId, 'admin.conversation.delete_group', `messageId=${groupId}`);
 return NextResponse.json({ success: true, deleted: 1 });
 }

 return NextResponse.json({ error: 'type invalide' }, { status: 400 });
 } catch {
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
