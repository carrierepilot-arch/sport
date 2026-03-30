import { normalizeExerciseName, toExerciseMediaSlug, EXERCISE_MEDIA_CATALOG } from '@/lib/exercise-media';

export type MatchCandidate = {
  name: string;
  aliases?: string[];
};

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeExerciseName(value).split(' ').filter(Boolean));
}

function jaccard(a: string, b: string): number {
  const aa = tokenSet(a);
  const bb = tokenSet(b);
  if (aa.size === 0 && bb.size === 0) return 1;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection += 1;
  const union = new Set([...aa, ...bb]).size;
  return union === 0 ? 0 : intersection / union;
}

export function scoreExerciseNameMatch(input: string, candidate: string): number {
  const normInput = normalizeExerciseName(input);
  const normCandidate = normalizeExerciseName(candidate);
  if (!normInput || !normCandidate) return 0;
  if (normInput === normCandidate) return 1;
  if (toExerciseMediaSlug(normInput) === toExerciseMediaSlug(normCandidate)) return 0.98;
  const distance = levenshtein(normInput, normCandidate);
  const maxLen = Math.max(normInput.length, normCandidate.length, 1);
  const levScore = 1 - distance / maxLen;
  const jac = jaccard(normInput, normCandidate);
  const contains = normInput.includes(normCandidate) || normCandidate.includes(normInput) ? 0.1 : 0;
  return Math.max(0, Math.min(1, levScore * 0.55 + jac * 0.45 + contains));
}

export function findBestNameMatch(input: string, candidates: MatchCandidate[], minScore = 0.62) {
  let best: { name: string; matchedOn: string; score: number } | null = null;
  for (const candidate of candidates) {
    const pool = [candidate.name, ...(candidate.aliases ?? [])];
    for (const alias of pool) {
      const score = scoreExerciseNameMatch(input, alias);
      if (!best || score > best.score) {
        best = { name: candidate.name, matchedOn: alias, score };
      }
    }
  }
  return best && best.score >= minScore ? best : null;
}

export function listCatalogCandidates(): MatchCandidate[] {
  return Object.entries(EXERCISE_MEDIA_CATALOG).map(([key, value]) => ({
    name: key,
    aliases: [value.label, ...(value.aliases ?? [])],
  }));
}