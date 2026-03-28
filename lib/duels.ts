export const DUEL_EXERCISES = ['tractions', 'pompes', 'dips', 'squats'] as const;

export type DuelStatus = 'pending' | 'accepted' | 'finished';

export type DuelData = {
  type: 'duel_1v1';
  status: DuelStatus;
  inviterId: string;
  inviteeId: string;
  exercises: string[];
  scores: Record<string, Record<string, number>>;
  createdAt: string;
  acceptedAt: string | null;
  finishedAt: string | null;
};

export function createDuelData(input: {
  inviterId: string;
  inviteeId: string;
  initialExercise: string;
  initialScore: number;
}): DuelData {
  const now = new Date().toISOString();
  return {
    type: 'duel_1v1',
    status: 'pending',
    inviterId: input.inviterId,
    inviteeId: input.inviteeId,
    exercises: [...DUEL_EXERCISES],
    scores: {
      [input.inviterId]: {
        [input.initialExercise]: Math.max(0, Number(input.initialScore) || 0),
      },
      [input.inviteeId]: {},
    },
    createdAt: now,
    acceptedAt: null,
    finishedAt: null,
  };
}

export function parseDuelData(raw: unknown): DuelData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<DuelData>;
  if (data.type !== 'duel_1v1') return null;
  if (!data.inviterId || !data.inviteeId) return null;

  const status: DuelStatus =
    data.status === 'accepted' || data.status === 'finished' ? data.status : 'pending';

  const exercises = Array.isArray(data.exercises)
    ? data.exercises.filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
    : [...DUEL_EXERCISES];

  const safeScores: Record<string, Record<string, number>> = {};
  if (data.scores && typeof data.scores === 'object') {
    for (const [userId, userScores] of Object.entries(data.scores)) {
      if (!userId || typeof userScores !== 'object' || !userScores) continue;
      safeScores[userId] = {};
      for (const [exercise, value] of Object.entries(userScores as Record<string, unknown>)) {
        if (!exercise) continue;
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) continue;
        safeScores[userId][exercise] = parsed;
      }
    }
  }

  if (!safeScores[data.inviterId]) safeScores[data.inviterId] = {};
  if (!safeScores[data.inviteeId]) safeScores[data.inviteeId] = {};

  return {
    type: 'duel_1v1',
    status,
    inviterId: data.inviterId,
    inviteeId: data.inviteeId,
    exercises: exercises.length > 0 ? exercises : [...DUEL_EXERCISES],
    scores: safeScores,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    acceptedAt: typeof data.acceptedAt === 'string' ? data.acceptedAt : null,
    finishedAt: typeof data.finishedAt === 'string' ? data.finishedAt : null,
  };
}

export function serializeDuelInviteMessage(payload: { duelId: string; exercise: string; score: number; inviterId: string }) {
  return `__DUEL_INVITE__${JSON.stringify(payload)}`;
}

export function serializeDuelAcceptedMessage(payload: { duelId: string; inviteeId: string }) {
  return `__DUEL_ACCEPTED__${JSON.stringify(payload)}`;
}

export function deserializePrefixedJson<T>(text: string, prefix: string): T | null {
  if (!text.startsWith(prefix)) return null;
  try {
    return JSON.parse(text.slice(prefix.length)) as T;
  } catch {
    return null;
  }
}
