import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type AdminPermission =
  | 'users:read'
  | 'users:write'
  | 'logs:read'
  | 'stats:read'
  | 'control:read'
  | 'control:write'
  | 'conversations:read'
  | 'conversations:write'
  | 'reports:read'
  | 'suggestions:read'
  | 'suggestions:write'
  | 'challenges:read'
  | 'challenges:write'
  | 'spots:read'
  | 'spots:write'
  | 'performances:read'
  | 'performances:write'
  | 'scraper:read'
  | 'scraper:write'
  | 'exercises:read'
  | 'api-test:write';

export type AdminContext = {
  userId: string;
  email: string;
  adminLevel: number;
};

const ALL_PERMISSIONS: AdminPermission[] = [
  'users:read',
  'users:write',
  'logs:read',
  'stats:read',
  'control:read',
  'control:write',
  'conversations:read',
  'conversations:write',
  'reports:read',
  'suggestions:read',
  'suggestions:write',
  'challenges:read',
  'challenges:write',
  'spots:read',
  'spots:write',
  'performances:read',
  'performances:write',
  'scraper:read',
  'scraper:write',
  'exercises:read',
  'api-test:write',
];

function normalizeLevel(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(3, Math.trunc(value)));
}

export function getPermissionsForLevel(level: number): Set<AdminPermission> {
  const normalized = normalizeLevel(level);

  // Level 3: full admin
  if (normalized >= 3) return new Set(ALL_PERMISSIONS);

  // Level 2: performance manager (can moderate ranking/perfs only + read basic panels)
  if (normalized === 2) {
    return new Set<AdminPermission>([
      'performances:read',
      'performances:write',
      'logs:read',
      'stats:read',
    ]);
  }

  // Level 1: read-only admin dashboard
  if (normalized === 1) {
    return new Set<AdminPermission>([
      'users:read',
      'logs:read',
      'stats:read',
      'conversations:read',
      'reports:read',
      'suggestions:read',
      'challenges:read',
      'spots:read',
      'performances:read',
      'scraper:read',
      'exercises:read',
    ]);
  }

  return new Set<AdminPermission>();
}

export async function requireAdminPermission(request: NextRequest, permission: AdminPermission): Promise<AdminContext | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isAdmin: true, adminLevel: true },
    });

    if (!user?.isAdmin) return null;
    const level = normalizeLevel(user.adminLevel ?? 1);
    const permissions = getPermissionsForLevel(level);
    if (!permissions.has(permission)) return null;

    return { userId: payload.userId, email: payload.email, adminLevel: level };
  } catch {
    // Legacy fallback when adminLevel column is not yet available.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) return null;

    const permissions = getPermissionsForLevel(3);
    if (!permissions.has(permission)) return null;

    return { userId: payload.userId, email: payload.email, adminLevel: 3 };
  }
}

export async function logAdminAction(adminUserId: string, action: string, details?: string) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: adminUserId,
        action,
        details: details?.slice(0, 1200) || null,
      },
    });
  } catch {
    // Never block primary business action on logging failures.
  }
}
