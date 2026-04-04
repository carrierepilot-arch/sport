import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getAdminControlConfig,
  patchRateLimitConfig,
  patchSectionControl,
  patchFeedLock,
  patchMessagingLock,
  SectionStatus,
} from '@/lib/admin-control-config';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';

function classifyReportTarget(targetType: string): 'groups' | 'private' | 'other' {
  const tt = targetType.toLowerCase();
  if (tt.includes('group')) return 'groups';
  if (tt.includes('message') || tt.includes('direct') || tt.includes('conversation')) return 'private';
  return 'other';
}

async function loadAnalytics() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [reports, directMessages7d, groupMessages7d, friendRequests7d, totalGroups, totalGroupMessages] = await Promise.all([
    prisma.report.findMany({
      select: { targetType: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }),
    prisma.message.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.groupMessage.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.friendRequest.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.group.count(),
    prisma.groupMessage.count(),
  ]);

  const reportClassification = reports.reduce(
    (acc, report) => {
      const bucket = classifyReportTarget(report.targetType);
      acc[bucket] += 1;
      return acc;
    },
    { groups: 0, private: 0, other: 0 },
  );

  const dmMessages = await prisma.message.findMany({
    select: { senderId: true, receiverId: true },
    orderBy: { createdAt: 'desc' },
    take: 4000,
  });
  const directPairs = new Set<string>();
  for (const msg of dmMessages) {
    const pair = [msg.senderId, msg.receiverId].sort().join(':');
    directPairs.add(pair);
  }

  return {
    reportClassification,
    interactions: {
      directMessages7d,
      groupMessages7d,
      friendRequests7d,
      reports7d: reports.length,
    },
    conversationTypes: {
      directConversations: directPairs.size,
      directMessagesTotal: dmMessages.length,
      groupConversations: totalGroups,
      groupMessagesTotal: totalGroupMessages,
    },
  };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminPermission(request, 'control:read');
  if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  const [config, analytics] = await Promise.all([getAdminControlConfig(), loadAnalytics()]);

  return NextResponse.json({
    config,
    analytics,
  });
}

export async function PATCH(request: NextRequest) {
  let admin: Awaited<ReturnType<typeof requireAdminPermission>>;
  try {
    admin = await requireAdminPermission(request, 'control:write');
  } catch {
    return NextResponse.json({ error: 'Erreur d\'authentification' }, { status: 500 });
  }
  if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    sectionUpdates?: Array<{ key?: string; status?: SectionStatus; maintenanceMessage?: string | null }>;
    rateLimit?: { enabled?: boolean; maxRequests?: number; windowMs?: number; mutatingOnly?: boolean };
    feedLocked?: boolean;
    messagingLocked?: boolean;
  };

  let config = await getAdminControlConfig();

  try {
    if (Array.isArray(body.sectionUpdates)) {
      for (const update of body.sectionUpdates) {
        if (!update?.key) continue;
        if (!update.status) continue;
        config = await patchSectionControl(update.key, {
          status: update.status,
          maintenanceMessage: typeof update.maintenanceMessage === 'string' ? update.maintenanceMessage : undefined,
        });
      }
    }

    if (body.rateLimit && typeof body.rateLimit === 'object') {
      config = await patchRateLimitConfig(body.rateLimit);
    }

    if (typeof body.feedLocked === 'boolean') {
      config = await patchFeedLock(body.feedLocked);
    }

    if (typeof body.messagingLocked === 'boolean') {
      config = await patchMessagingLock(body.messagingLocked);
    }
  } catch (err) {
    console.error('[control-center PATCH] config update error:', err);
    return NextResponse.json({ error: 'Erreur lors de la mise a jour de la configuration' }, { status: 500 });
  }

  await logAdminAction(
    admin.userId,
    'admin.control_center.update',
    `sections=${Array.isArray(body.sectionUpdates) ? body.sectionUpdates.length : 0} rl=${Boolean(body.rateLimit)}`,
  );

  let analytics = null;
  try {
    analytics = await loadAnalytics();
  } catch {
    // Analytics failure must not block the config update response.
  }

  return NextResponse.json({ config, analytics, ok: true });
}
