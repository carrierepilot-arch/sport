import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminPermission(request, 'users:write');
    if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

    const { receiverId, content } = await request.json();
    if (!receiverId || typeof receiverId !== 'string') {
      return NextResponse.json({ error: 'receiverId requis' }, { status: 400 });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Message vide' }, { status: 400 });
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, email: true, name: true, pseudo: true },
    });

    if (!receiver) {
      return NextResponse.json({ error: 'Utilisateur destinataire introuvable' }, { status: 404 });
    }

    const cleanContent = content.trim().slice(0, 2000);
    const created = await prisma.message.create({
      data: {
        senderId: admin.userId,
        receiverId: receiver.id,
        content: cleanContent,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    });

    await logAdminAction(
      admin.userId,
      'admin.message.send',
      `to=${receiver.email}; chars=${String(cleanContent.length)}`,
    );

    return NextResponse.json({
      success: true,
      message: {
        id: created.id,
        content: created.content,
        createdAt: created.createdAt,
      },
    });
  } catch (error) {
    console.error('Admin send message error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
