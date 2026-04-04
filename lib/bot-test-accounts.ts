import type { Prisma } from '@/lib/generated/prisma/client';

const TEST_EMAIL_MARKERS = ['@test.local', '@bot.local', '@sport.local'];

// Explicit allow-list for internally created gmail test accounts.
const TEST_GMAIL_ALLOWLIST = [
  'omar.hassan@gmail.com',
  'ahmed.khalil@gmail.com',
  'mohamed.benali@gmail.com',
  'ali.elamri@gmail.com',
  'karim.khoury@gmail.com',
  'ibrahim.mansour@gmail.com',
  'youssef.nasri@gmail.com',
  'malik.boucher@gmail.com',
  'tariq.salam@gmail.com',
  'rashid.hassan@gmail.com',
  'noureddine.medina@gmail.com',
  'samir.saleh@gmail.com',
  'adel.aziz@gmail.com',
  'jamal.rafiq@gmail.com',
  'farid.halim@gmail.com',
  'hamza.nazar@gmail.com',
  'khalid.hazem@gmail.com',
  'amr.malik@gmail.com',
  'rayan.farsi@gmail.com',
  'zain.anwar@gmail.com',
  'nasir.rashid@gmail.com',
  'hani.walid@gmail.com',
];

export function buildBotTestWhere(): Prisma.UserWhereInput {
  return {
    isAdmin: false,
    OR: [
      ...TEST_EMAIL_MARKERS.map((marker) => ({ email: { contains: marker } })),
      { email: { in: TEST_GMAIL_ALLOWLIST } },
      { pseudo: { contains: 'bot', mode: 'insensitive' } },
      { name: { contains: 'bot', mode: 'insensitive' } },
      { name: { contains: 'test', mode: 'insensitive' } },
    ],
  };
}
