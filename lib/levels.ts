export type LevelInfo = {
  level: number;
  name: string;
  minXp: number;
  maxXp: number | null; // null = no cap
  color: string;       // Tailwind text color
  bgColor: string;     // Tailwind bg color
  borderColor: string; // Tailwind border color
  badgeGradient: string; // inline style gradient for badge
};

export const LEVELS: LevelInfo[] = [
  {
    level: 1,
    name: 'Novice',
    minXp: 0,
    maxXp: 100,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    badgeGradient: 'linear-gradient(135deg, #9ca3af, #6b7280)',
  },
  {
    level: 2,
    name: 'Débutant',
    minXp: 100,
    maxXp: 300,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    badgeGradient: 'linear-gradient(135deg, #6ee7b7, #10b981)',
  },
  {
    level: 3,
    name: 'Confirmé',
    minXp: 300,
    maxXp: 700,
    color: 'text-sky-700',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-300',
    badgeGradient: 'linear-gradient(135deg, #7dd3fc, #0284c7)',
  },
  {
    level: 4,
    name: 'Avancé',
    minXp: 700,
    maxXp: 1500,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    badgeGradient: 'linear-gradient(135deg, #fde68a, #d97706)',
  },
  {
    level: 5,
    name: 'Expert',
    minXp: 1500,
    maxXp: 3000,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    badgeGradient: 'linear-gradient(135deg, #fed7aa, #ea580c)',
  },
  {
    level: 6,
    name: 'Élite',
    minXp: 3000,
    maxXp: 6000,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    badgeGradient: 'linear-gradient(135deg, #fca5a5, #dc2626)',
  },
  {
    level: 7,
    name: 'Légende',
    minXp: 6000,
    maxXp: null,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-400',
    badgeGradient: 'linear-gradient(135deg, #c084fc, #7c3aed, #4f46e5)',
  },
];

/** Returns the LevelInfo for a given XP amount. */
export function getLevelFromXp(xp: number): LevelInfo {
  let result = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.minXp) result = lvl;
  }
  return result;
}

/** Returns XP progress (0–1) within the current level band. */
export function getLevelProgress(xp: number): number {
  const lvl = getLevelFromXp(xp);
  if (lvl.maxXp === null) return 1;
  const range = lvl.maxXp - lvl.minXp;
  return Math.min((xp - lvl.minXp) / range, 1);
}
