type UserAvatarProps = {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

function getPaletteClass(seed: string): string {
  const palette = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-teal-500', 'bg-sky-500', 'bg-blue-500', 'bg-violet-500'];
  return palette[seed.toUpperCase().charCodeAt(0) % palette.length];
}

export function UserAvatar({ src, name, size = 'md', className = '' }: UserAvatarProps) {
  const fallback = (name?.trim()?.[0] ?? 'U').toUpperCase();
  const sizeClass = SIZE_CLASSES[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `Photo de ${name}` : 'Photo de profil'}
        className={`${sizeClass} rounded-full object-cover border border-white/60 shadow-sm flex-shrink-0 ${className}`.trim()}
      />
    );
  }

  return (
    <div className={`${getPaletteClass(fallback)} ${sizeClass} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`.trim()}>
      {fallback}
    </div>
  );
}
