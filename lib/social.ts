import { prisma } from '@/lib/prisma';

type MinimalUser = {
  id: string;
  isAdmin?: boolean | null;
  level?: string | null;
  xp?: number | null;
};

export function isVerifiedUser(user: MinimalUser, followersCount: number, validatedPerformanceCount: number): boolean {
  return Boolean(
    user.isAdmin ||
      user.level === 'elite' ||
      (user.xp ?? 0) >= 2500 ||
      followersCount >= 25 ||
      validatedPerformanceCount >= 12,
  );
}

export async function getFollowRows(userIds: string[]) {
  if (userIds.length === 0) return [];
  return prisma.suggestion.findMany({
    where: {
      category: 'follow_user',
      status: 'active',
      text: { in: userIds },
    },
    select: { userId: true, text: true },
  });
}

export async function getFollowingRows(userIds: string[]) {
  if (userIds.length === 0) return [];
  return prisma.suggestion.findMany({
    where: {
      category: 'follow_user',
      status: 'active',
      userId: { in: userIds },
    },
    select: { userId: true, text: true },
  });
}

export function buildCountMap(values: Array<string | null | undefined>): Map<string, number> {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return map;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function getProfileImageUrl(equipmentData: unknown): string | null {
  const record = asRecord(equipmentData);
  const profileImageUrl = record.profileImageUrl;
  return typeof profileImageUrl === 'string' && profileImageUrl.trim() ? profileImageUrl.trim() : null;
}

export function withoutProfileImageUrl(equipmentData: unknown): Record<string, unknown> {
  const record = { ...asRecord(equipmentData) };
  delete record.profileImageUrl;
  return record;
}

export type ProfileVisibility = 'public' | 'private';

export function getProfileVisibility(equipmentData: unknown): ProfileVisibility {
  const record = asRecord(equipmentData);
  const raw = record.profileVisibility;
  if (raw === 'private') return 'private';
  return 'public';
}

export function withProfileVisibility(equipmentData: unknown, visibility: ProfileVisibility): Record<string, unknown> {
  return {
    ...asRecord(equipmentData),
    profileVisibility: visibility,
  };
}

export function withProfileImageUrl(equipmentData: unknown, profileImageUrl: string): Record<string, unknown> {
  return {
    ...asRecord(equipmentData),
    profileImageUrl,
  };
}
