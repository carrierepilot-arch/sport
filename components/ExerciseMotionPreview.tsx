'use client';

import { useEffect, useState } from 'react';

type ExerciseMotionPreviewProps = {
  title: string;
  gifUrl?: string | null;
  frames?: string[] | null;
  className?: string;
  imgClassName?: string;
};

export function ExerciseMotionPreview({
  title,
  gifUrl,
  frames,
  className = '',
  imgClassName = 'w-full h-full object-cover',
}: ExerciseMotionPreviewProps) {
  const usableFrames = (frames ?? []).filter(Boolean);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (usableFrames.length <= 1) return;
    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % usableFrames.length);
    }, 650);
    return () => window.clearInterval(interval);
  }, [usableFrames]);

  const imageSrc = gifUrl || usableFrames[frameIndex] || usableFrames[0] || null;
  if (!imageSrc) return null;

  return (
    <div className={className}>
      <img src={imageSrc} alt={title} className={imgClassName} loading="lazy" />
    </div>
  );
}