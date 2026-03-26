import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, pseudo } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caracteres' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: 'Un compte existe deja avec cet email' }, { status: 409 });
    }

    const hashed = await hashPassword(password);
    const ADMIN_EMAILS = ['carrierepilote@gmail.com', 'balalobidudi2@gmail.com'];
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase().trim());
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashed,
        name: name?.trim() || null,
        pseudo: pseudo?.trim() || null,
        isAdmin,
      },
    });

    await prisma.activityLog.create({
      data: { userId: user.id, action: 'register', details: `Email: ${user.email}` },
    });

    const token = createToken(user.id, user.email);
    return NextResponse.json(
      { success: true, token, user: { id: user.id, email: user.email, name: user.name, pseudo: user.pseudo, isAdmin: user.isAdmin } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
