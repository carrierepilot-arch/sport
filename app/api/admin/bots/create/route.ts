import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission, logAdminAction } from '@/lib/admin-auth';
import bcrypt from 'bcryptjs';

// POST — create a new bot/test account (level 3 only)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminPermission(request, 'users:write');
    if (!admin) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    if (admin.adminLevel < 3) return NextResponse.json({ error: 'Acces reserve au super-admin (niveau 3)' }, { status: 403 });

    const body = await request.json().catch(() => ({})) as {
      name?: string;
      pseudo?: string;
      email?: string;
      behavior?: string;
      interactionType?: string;
      frequency?: string;
    };

    const name = (body.name || '').trim();
    const pseudo = (body.pseudo || '').trim();
    const behavior = (body.behavior || 'actif').trim();
    const interactionType = (body.interactionType || 'feed').trim();
    const frequency = (body.frequency || 'quotidien').trim();

    if (!name || !pseudo) {
      return NextResponse.json({ error: 'Nom et pseudo requis' }, { status: 400 });
    }

    // Generate bot email using bot.local domain
    const emailBase = pseudo.toLowerCase().replace(/[^a-z0-9]/g, '');
    const email = body.email?.trim() || `${emailBase}@bot.local`;

    // Check uniqueness
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { pseudo },
        ],
      },
    });
    if (existing) {
      return NextResponse.json({ error: 'Email ou pseudo deja utilise' }, { status: 409 });
    }

    // Create bot account with a random hash as password (not usable for login)
    const passwordHash = await bcrypt.hash(`bot_${Date.now()}_${Math.random()}`, 10);

    const bot = await prisma.user.create({
      data: {
        email,
        name,
        pseudo,
        password: passwordHash,
        level: 'intermediaire',
        xp: Math.floor(Math.random() * 1000),
        equipmentData: JSON.stringify({
          botConfig: {
            behavior,
            interactionType,
            frequency,
            createdBy: admin.userId,
            createdAt: new Date().toISOString(),
          },
        }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        pseudo: true,
        level: true,
        xp: true,
        createdAt: true,
      },
    });

    await logAdminAction(admin.userId, 'admin.bot.create', `botId=${bot.id} pseudo=${pseudo} behavior=${behavior} type=${interactionType} freq=${frequency}`);

    return NextResponse.json({ success: true, bot });
  } catch (err) {
    console.error('Bot create error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
