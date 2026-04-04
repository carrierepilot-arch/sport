import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission, logAdminAction } from '@/lib/admin-auth';
import { del } from '@vercel/blob';

type DeleteAction = 'scores' | 'videos' | 'feed_posts' | 'users' | 'all';

export async function POST(request: NextRequest) {
  const admin = await requireAdminPermission(request, 'control:write');
  if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  // Only super-admin (level 3) can delete content
  if (admin.adminLevel < 3) {
    return NextResponse.json({ error: 'Acces reserve au super-admin (niveau 3)' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { action?: string };
  const action = body.action as DeleteAction | undefined;

  if (!action || !['scores', 'videos', 'feed_posts', 'users', 'all'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  const deleted: Record<string, number> = {};

  try {
    // Step 1: delete video blobs (must happen before deleting performance records)
    if (action === 'videos' || action === 'all') {
      const withVideos = await prisma.performance.findMany({
        where: { videoUrl: { not: null } },
        select: { id: true, videoUrl: true, videoStoragePath: true },
      });

      for (const perf of withVideos) {
        try {
          const blobUrl = perf.videoUrl ?? perf.videoStoragePath ?? null;
          if (blobUrl) await del(blobUrl);
        } catch {
          // ignore individual blob errors
        }
      }

      deleted.videos = withVideos.length;

      if (action === 'videos') {
        // Only null out video fields; keep performance records
        await prisma.performance.updateMany({
          where: { videoUrl: { not: null } },
          data: { videoUrl: null, videoStoragePath: null },
        });
      }
    }

    // Step 2: delete all performance scores
    if (action === 'scores' || action === 'all') {
      const count = await prisma.performance.count();
      await prisma.performanceValidation.deleteMany({});
      await prisma.performance.deleteMany({});
      deleted.scores = count;
    }

    // Step 3: delete all feed posts + replies + likes, and their media blobs
    if (action === 'feed_posts' || action === 'all') {
      const feedWithMedia = await prisma.suggestion.findMany({
        where: {
          category: 'feed_post',
          OR: [
            { text: { startsWith: '__IMAGE__' } },
            { text: { startsWith: '__VIDEO__' } },
          ],
        },
        select: { id: true, text: true },
      });

      for (const post of feedWithMedia) {
        try {
          const urlMatch = post.text.match(/__(?:IMAGE|VIDEO)__(https?:\/\/[^\n]+)/);
          if (urlMatch?.[1]) await del(urlMatch[1].trim());
        } catch {
          // ignore
        }
      }

      const count = await prisma.suggestion.count({
        where: { category: { in: ['feed_post', 'feed_reply', 'feed_like'] } },
      });

      await prisma.suggestion.deleteMany({
        where: { category: { in: ['feed_post', 'feed_reply', 'feed_like'] } },
      });

      deleted.feed_posts = count;
    }

    // Step 4: delete all users except adminLevel >= 3
    if (action === 'users') {
      const toDelete = await prisma.user.findMany({
        where: { adminLevel: { lt: 3 } },
        select: { id: true },
      });
      const ids = toDelete.map(u => u.id);
      deleted.users = ids.length;

      if (ids.length > 0) {
        // Collect cross-user dependency IDs
        const [ownedWorkouts, ownedGroups, ownedPerfs] = await Promise.all([
          prisma.workout.findMany({ where: { userId: { in: ids } }, select: { id: true } }),
          prisma.group.findMany({ where: { ownerId: { in: ids } }, select: { id: true } }),
          prisma.performance.findMany({ where: { userId: { in: ids } }, select: { id: true } }),
        ]);
        const workoutIds = ownedWorkouts.map(w => w.id);
        const ownedGroupIds = ownedGroups.map(g => g.id);
        const perfIds = ownedPerfs.map(p => p.id);

        await prisma.$transaction(async (tx) => {
          await tx.spot.updateMany({ where: { addedBy: { in: ids } }, data: { addedBy: null } });
          await tx.spotRegular.deleteMany({ where: { userId: { in: ids } } });
          await tx.spotFavorite.deleteMany({ where: { userId: { in: ids } } });
          await tx.challenge.updateMany({ where: { creatorId: { in: ids } }, data: { creatorId: null } });
          await tx.challengeCompletion.deleteMany({ where: { userId: { in: ids } } });
          await tx.performanceValidation.deleteMany({ where: { validatorId: { in: ids } } });
          if (perfIds.length > 0) {
            await tx.performanceValidation.deleteMany({ where: { performanceId: { in: perfIds } } });
          }
          await tx.performance.deleteMany({ where: { userId: { in: ids } } });
          await tx.groupMessage.deleteMany({ where: { userId: { in: ids } } });
          await tx.groupMember.deleteMany({ where: { userId: { in: ids } } });
          if (ownedGroupIds.length > 0) {
            await tx.groupMessage.deleteMany({ where: { groupId: { in: ownedGroupIds } } });
            await tx.groupMember.deleteMany({ where: { groupId: { in: ownedGroupIds } } });
          }
          await tx.group.deleteMany({ where: { ownerId: { in: ids } } });
          await tx.apiLog.deleteMany({ where: { userId: { in: ids } } });
          await tx.badge.deleteMany({ where: { userId: { in: ids } } });
          await tx.activityLog.deleteMany({ where: { userId: { in: ids } } });
          await tx.userSession.deleteMany({ where: { userId: { in: ids } } });
          await tx.message.deleteMany({ where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }] } });
          await tx.friendRequest.deleteMany({ where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }] } });
          if (workoutIds.length > 0) {
            await tx.workoutSession.deleteMany({ where: { workoutId: { in: workoutIds } } });
          }
          await tx.workoutSession.deleteMany({ where: { userId: { in: ids } } });
          await tx.workout.deleteMany({ where: { userId: { in: ids } } });
          await tx.user.deleteMany({ where: { id: { in: ids } } });
        });
      }
    }

    await logAdminAction(
      admin.userId,
      'admin.content.delete',
      `action=${action} deleted=${JSON.stringify(deleted)}`,
    );

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Content delete error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
