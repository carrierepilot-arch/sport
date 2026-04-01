import { prisma } from '@/lib/prisma';

const MENTION_REGEX = /@([\w\u00C0-\u017E_-]{1,30})/g;

/**
 * Extracts all @pseudo mentions from a text string.
 * Returns unique pseudo values found.
 */
export function extractMentions(text: string): string[] {
  const matches = text.matchAll(MENTION_REGEX);
  const pseudos = new Set<string>();
  for (const m of matches) {
    pseudos.add(m[1].toLowerCase());
  }
  return Array.from(pseudos);
}

/**
 * Resolve mention pseudos to user IDs, then create feed_mention
 * Suggestion records (one per mentionee) as notification entries.
 * Silent — never throws.
 */
export async function processMentions(params: {
  text: string;
  senderUserId: string;
  postId: string;
}): Promise<void> {
  const { text, senderUserId, postId } = params;
  const pseudos = extractMentions(text);
  if (pseudos.length === 0) return;

  try {
    const mentioned = await prisma.user.findMany({
      where: {
        pseudo: { in: pseudos, mode: 'insensitive' },
        id: { not: senderUserId },
      },
      select: { id: true },
    });

    if (mentioned.length === 0) return;

    await prisma.suggestion.createMany({
      data: mentioned.map((u) => ({
        userId: u.id,
        text: `mention:post:${postId}:from:${senderUserId}`,
        category: 'mention_notification',
        status: 'unread',
      })),
      skipDuplicates: true,
    });
  } catch (err) {
    console.error('processMentions error:', err);
  }
}
