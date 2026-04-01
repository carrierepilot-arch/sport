'use client';

import { getLevelFromXp, getLevelProgress } from '@/lib/levels';

interface LevelBadgeProps {
  xp: number;
  /** 'sm' = small inline badge, 'md' = medium with progress bar, 'lg' = large hero display */
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  className?: string;
}

export default function LevelBadge({ xp, size = 'md', showProgress = false, className = '' }: LevelBadgeProps) {
  const lvl = getLevelFromXp(xp);
  const progress = getLevelProgress(xp);

  if (size === 'sm') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border ${lvl.color} ${lvl.bgColor} ${lvl.borderColor} ${className}`}
      >
        <LevelIcon level={lvl.level} size={12} gradient={lvl.badgeGradient} />
        Niv.{lvl.level} {lvl.name}
      </span>
    );
  }

  if (size === 'lg') {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg border-4"
          style={{ background: lvl.badgeGradient, borderColor: 'white' }}
        >
          <span className="text-3xl font-black text-white drop-shadow">{lvl.level}</span>
        </div>
        <div className="text-center">
          <p className={`text-base font-black ${lvl.color}`}>{lvl.name}</p>
          <p className="text-xs text-gray-500">{xp} XP</p>
        </div>
        {showProgress && lvl.maxXp !== null && (
          <div className="w-full max-w-[160px]">
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round(progress * 100)}%`, background: lvl.badgeGradient }}
              />
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-1">{xp} / {lvl.maxXp} XP</p>
          </div>
        )}
      </div>
    );
  }

  // md (default)
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm shrink-0"
        style={{ background: lvl.badgeGradient }}
      >
        <span className="text-sm font-black text-white">{lvl.level}</span>
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-bold leading-tight ${lvl.color}`}>Niv.{lvl.level} — {lvl.name}</p>
        {showProgress && lvl.maxXp !== null && (
          <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden w-24">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round(progress * 100)}%`, background: lvl.badgeGradient }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function LevelIcon({ level, size, gradient }: { level: number; size: number; gradient: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: gradient,
        fontSize: Math.round(size * 0.65),
        fontWeight: 900,
        color: 'white',
        lineHeight: 1,
      }}
    >
      {level}
    </span>
  );
}
