import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';
import { encryptMessageContent } from '@/lib/message-crypto';
import { buildBotTestWhere } from '@/lib/bot-test-accounts';
import { put } from '@vercel/blob';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'application/zip'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const VALID_EXERCISES = ['tractions', 'pompes', 'dips', 'squats', 'tractions_lestees', 'dips_lestes', 'muscle_ups'];
const EXERCISE_UNIT: Record<string, string> = {
  tractions: 'reps',
  pompes: 'reps',
  dips: 'reps',
  squats: 'reps',
  tractions_lestees: 'kg',
  dips_lestes: 'kg',
  muscle_ups: 'reps',
};

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

type BotAction =
  | 'friend_request'
  | 'message'
  | 'message_image'
  | 'feed_post'
  | 'feed_image'
  | 'feed_reply'
  | 'performance_create';

// POST — perform an action as a bot (level 3 only)
// body: { botId, action, payload }
// actions: friend_request | message | message_image | feed_post | feed_image | feed_reply | performance_create
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminPermission(request, 'users:write');
    if (!admin) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (admin.adminLevel < 3) return NextResponse.json({ error: 'Accès réservé au super-admin (niveau 3)' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';

    let botId = '';
    let action = '' as BotAction;
    let payload: Record<string, string> = {};
    let imageFile: File | null = null;
    let videoFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      botId = String(formData.get('botId') || '');
      action = String(formData.get('action') || '') as BotAction;
      payload = {
        targetPseudo: String(formData.get('targetPseudo') || ''),
        content: String(formData.get('content') || ''),
        postId: String(formData.get('postId') || ''),
        exercise: String(formData.get('exercise') || ''),
        score: String(formData.get('score') || ''),
        visibility: String(formData.get('visibility') || 'public'),
      };
      const img = formData.get('image');
      imageFile = img instanceof File ? img : null;
      const vid = formData.get('video');
      videoFile = vid instanceof File ? vid : null;
    } else {
      const body = await request.json();
      const parsed = body as { botId?: string; action?: BotAction; payload?: Record<string, string> };
      botId = parsed.botId || '';
      action = (parsed.action || '') as BotAction;
      payload = parsed.payload || {};
    }

    if (!botId || !action) {
      return NextResponse.json({ error: 'botId et action requis' }, { status: 400 });
    }

    // Validate bot exists and is a test account
    const bot = await prisma.user.findFirst({
      where: {
        id: botId,
        ...buildBotTestWhere(),
      },
      select: { id: true, email: true, pseudo: true, name: true },
    });
    if (!bot) return NextResponse.json({ error: 'Bot introuvable ou non autorisé' }, { status: 404 });

    let result: Record<string, unknown> = {};

    if (action === 'friend_request') {
      // Send friend request from bot to target user
      const targetPseudo = payload.targetPseudo?.trim();
      if (!targetPseudo) return NextResponse.json({ error: 'targetPseudo requis' }, { status: 400 });

      const target = await prisma.user.findFirst({
        where: { pseudo: { equals: targetPseudo, mode: 'insensitive' } },
        select: { id: true, pseudo: true },
      });
      if (!target) return NextResponse.json({ error: 'Utilisateur cible introuvable' }, { status: 404 });
      if (target.id === botId) return NextResponse.json({ error: 'Le bot ne peut pas s\'ajouter lui-même' }, { status: 400 });

      const existing = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId: botId, receiverId: target.id },
            { senderId: target.id, receiverId: botId },
          ],
        },
      });
      if (existing) return NextResponse.json({ error: 'Demande déjà existante' }, { status: 409 });

      const req = await prisma.friendRequest.create({
        data: { senderId: botId, receiverId: target.id, status: 'pending' },
      });
      await prisma.activityLog.create({
        data: { userId: botId, action: 'friend_request_sent', details: `Bot action by admin ${admin.email} → @${target.pseudo}` },
      });
      await logAdminAction(admin.userId, 'admin.bot_test.friend_request', `bot=${bot.pseudo ?? bot.id} target=@${target.pseudo}`);
      result = { requestId: req.id, to: target.pseudo };

    } else if (action === 'message') {
      // Send private message from bot to target
      const targetPseudo = payload.targetPseudo?.trim();
      const content = payload.content?.trim();
      if (!targetPseudo || !content) return NextResponse.json({ error: 'targetPseudo et content requis' }, { status: 400 });

      const target = await prisma.user.findFirst({
        where: { pseudo: { equals: targetPseudo, mode: 'insensitive' } },
        select: { id: true, pseudo: true },
      });
      if (!target) return NextResponse.json({ error: 'Utilisateur cible introuvable' }, { status: 404 });

      const msg = await prisma.message.create({
        data: { senderId: botId, receiverId: target.id, content: encryptMessageContent(content) },
      });
      await prisma.activityLog.create({
        data: { userId: botId, action: 'message_sent', details: `Bot action by admin ${admin.email} → @${target.pseudo}: "${content.slice(0, 50)}"` },
      });
      await logAdminAction(admin.userId, 'admin.bot_test.message', `bot=${bot.pseudo ?? bot.id} target=@${target.pseudo}`);
      result = { messageId: msg.id, to: target.pseudo };

    } else if (action === 'message_image') {
      const targetPseudo = payload.targetPseudo?.trim();
      const caption = payload.content?.trim() || '';
      if (!targetPseudo) return NextResponse.json({ error: 'targetPseudo requis' }, { status: 400 });
      if (!imageFile) return NextResponse.json({ error: 'Image requise' }, { status: 400 });
      if (!IMAGE_TYPES.includes(imageFile.type)) return NextResponse.json({ error: 'Format image non supporte' }, { status: 400 });
      if (imageFile.size > MAX_IMAGE_SIZE) return NextResponse.json({ error: 'Image trop volumineuse (max 10 MB)' }, { status: 400 });

      const target = await prisma.user.findFirst({
        where: { pseudo: { equals: targetPseudo, mode: 'insensitive' } },
        select: { id: true, pseudo: true },
      });
      if (!target) return NextResponse.json({ error: 'Utilisateur cible introuvable' }, { status: 404 });

      const storagePath = `messages/${bot.id}/${Date.now()}-${sanitizeName(imageFile.name || 'image.jpg')}`;
      const uploaded = await put(storagePath, imageFile, { access: 'public', contentType: imageFile.type });
      const normalizedContent = `__IMAGE__${uploaded.url}\n${caption}`.trim();

      const msg = await prisma.message.create({
        data: { senderId: botId, receiverId: target.id, content: encryptMessageContent(normalizedContent) },
      });

      await prisma.activityLog.create({
        data: { userId: botId, action: 'message_sent', details: `Bot image message by admin ${admin.email} → @${target.pseudo}` },
      });
      await logAdminAction(admin.userId, 'admin.bot_test.message_image', `bot=${bot.pseudo ?? bot.id} target=@${target.pseudo}`);
      result = { messageId: msg.id, to: target.pseudo, imageUrl: uploaded.url };

    } else if (action === 'feed_post') {
      // Publish a feed post as bot
      const content = payload.content?.trim();
      if (!content) return NextResponse.json({ error: 'content requis' }, { status: 400 });

      const post = await prisma.suggestion.create({
        data: {
          userId: botId,
          category: 'feed_post',
          status: 'published',
          text: content,
        },
      });
      await prisma.activityLog.create({
        data: { userId: botId, action: 'feed_post', details: `Bot action by admin ${admin.email}: "${content.slice(0, 80)}"` },
      });
      await logAdminAction(admin.userId, 'admin.bot_test.feed_post', `bot=${bot.pseudo ?? bot.id} post=${post.id}`);
      result = { postId: post.id };

    } else if (action === 'feed_image') {
      const caption = payload.content?.trim() || '';
      if (!imageFile) return NextResponse.json({ error: 'Image requise' }, { status: 400 });
      if (!IMAGE_TYPES.includes(imageFile.type)) return NextResponse.json({ error: 'Format image non supporte' }, { status: 400 });
      if (imageFile.size > MAX_IMAGE_SIZE) return NextResponse.json({ error: 'Image trop volumineuse (max 10 MB)' }, { status: 400 });

      const storagePath = `feed/${bot.id}/${Date.now()}-${sanitizeName(imageFile.name || 'image.jpg')}`;
      const uploaded = await put(storagePath, imageFile, { access: 'public', contentType: imageFile.type });
      const text = `__IMAGE__${uploaded.url}\n${caption}`.trim();

      const post = await prisma.suggestion.create({
        data: {
          userId: botId,
          category: 'feed_post',
          status: 'published',
          text,
        },
      });
      await prisma.activityLog.create({
        data: { userId: botId, action: 'feed_post', details: `Bot image post by admin ${admin.email}` },
      });
      await logAdminAction(admin.userId, 'admin.bot_test.feed_image', `bot=${bot.pseudo ?? bot.id} post=${post.id}`);
      result = { postId: post.id, imageUrl: uploaded.url };

    } else if (action === 'feed_reply') {
      // Reply to a feed post as bot
      const postId = payload.postId?.trim();
      const content = payload.content?.trim();
      if (!postId || !content) return NextResponse.json({ error: 'postId et content requis' }, { status: 400 });

      const parent = await prisma.suggestion.findFirst({
        where: { id: postId, category: 'feed_post' },
        select: { id: true },
      });
      if (!parent) return NextResponse.json({ error: 'Post parent introuvable' }, { status: 404 });

      const reply = await prisma.suggestion.create({
        data: {
          userId: botId,
          category: 'feed_reply',
          status: 'published',
          text: `post:${postId}\n${content}`,
        },
      });
      await prisma.activityLog.create({
        data: { userId: botId, action: 'feed_reply', details: `Bot action by admin ${admin.email} on post ${postId}: "${content.slice(0, 80)}"` },
      });
      await logAdminAction(admin.userId, 'admin.bot_test.feed_reply', `bot=${bot.pseudo ?? bot.id} post=${postId}`);
      result = { replyId: reply.id };

    } else if (action === 'performance_create') {
      const exercise = payload.exercise?.trim();
      const visibility = payload.visibility === 'private' ? 'private' : 'public';
      const scoreNum = Number(payload.score);

      if (!exercise || !VALID_EXERCISES.includes(exercise)) {
        return NextResponse.json({ error: 'Exercice invalide' }, { status: 400 });
      }
      if (!Number.isFinite(scoreNum) || scoreNum <= 0) {
        return NextResponse.json({ error: 'Score invalide' }, { status: 400 });
      }
      if (videoFile) {
        if (!VIDEO_TYPES.includes(videoFile.type)) {
          return NextResponse.json({ error: 'Format video non supporte' }, { status: 400 });
        }
        if (videoFile.size > MAX_VIDEO_SIZE) {
          return NextResponse.json({ error: 'Video trop volumineuse (max 200 MB)' }, { status: 400 });
        }
      }

      const performance = await prisma.performance.create({
        data: {
          userId: botId,
          exercise,
          score: scoreNum,
          unit: EXERCISE_UNIT[exercise] ?? 'reps',
          status: visibility === 'private' ? 'private' : 'pending',
        },
      });

      let uploadedVideoUrl: string | null = null;
      if (videoFile) {
        const storagePath = `performances/${bot.id}/${performance.id}/${Date.now()}-${sanitizeName(videoFile.name || 'video.mp4')}`;
        const uploaded = await put(storagePath, videoFile, {
          access: 'public',
          contentType: videoFile.type,
        });
        uploadedVideoUrl = uploaded.url;
        await prisma.performance.update({
          where: { id: performance.id },
          data: { videoUrl: uploaded.url, videoStoragePath: storagePath },
        });
      }

      await prisma.activityLog.create({
        data: { userId: botId, action: 'performance_created', details: `Bot performance by admin ${admin.email}` },
      });
      await logAdminAction(
        admin.userId,
        'admin.bot_test.performance_create',
        `bot=${bot.pseudo ?? bot.id} performance=${performance.id} video=${uploadedVideoUrl ? 'yes' : 'no'}`,
      );

      result = { performanceId: performance.id, videoUrl: uploadedVideoUrl, status: performance.status };

    } else {
      return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, action, bot: { id: bot.id, pseudo: bot.pseudo }, result });
  } catch (err) {
    console.error('Bot act error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
