import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, createToken } from '@/lib/auth';

function parseBrowser(ua: string): string {
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return 'Autre';
}

function parseDevice(ua: string): string {
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) return 'Mobile';
  if (ua.includes('Tablet') || ua.includes('iPad')) return 'Tablette';
  return 'Desktop';
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }

    // Use case-insensitive search to handle accounts registered with mixed-case emails
    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'Aucun compte trouve avec cet email' }, { status: 401 });
    }

    if (user.suspended) {
      return NextResponse.json({ error: 'Votre compte a été suspendu. Contactez un administrateur.' }, { status: 403 });
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });
    }

    const token = createToken(user.id, user.email);

    // Log session
    const ua = request.headers.get('user-agent') ?? '';
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'inconnu';
    await prisma.userSession.create({
      data: {
        userId: user.id,
        ipAddress: ip.split(',')[0].trim(),
        userAgent: ua,
        browser: parseBrowser(ua),
        device: parseDevice(ua),
      },
    });

    await prisma.activityLog.create({
      data: { userId: user.id, action: 'login', details: `IP: ${ip.split(',')[0].trim()} — ${parseBrowser(ua)}` },
    });

    return NextResponse.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, pseudo: user.pseudo, isAdmin: user.isAdmin },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

