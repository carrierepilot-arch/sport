'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/UserAvatar';
import LevelBadge from '@/app/components/LevelBadge';

type PublicProfilePayload = {
  id: string;
  pseudo: string;
  name: string | null;
  profileImageUrl: string | null;
  profileVisibility: 'public' | 'private';
  isPrivate: boolean;
  level: string;
  xp: number;
  verified: boolean;
  isMe: boolean;
  followedByMe: boolean;
  counts: {
    followers: number;
    following: number;
    posts: number;
    weeklyPosts: number;
    weeklySessions: number;
    badges: number;
    validatedPerformances: number;
  };
  recentPosts: Array<{ id: string; text: string; createdAt: string }>;
  recentPerformances: Array<{ id: string; exercise: string; score: number; unit: string; createdAt: string; spotName: string; spotCity: string | null; videoUrl: string | null }>;
};

export default function PublicProfilePage() {
  const params = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !params?.userId) return;
    setLoading(true);
    fetch(`/api/social/profile?userId=${params.userId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) setProfile(data.profile);
      })
      .finally(() => setLoading(false));
  }, [params?.userId]);

  const toggleFollow = async () => {
    if (!profile || profile.isMe) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const nextFollowed = !profile.followedByMe;
    setProfile({
      ...profile,
      followedByMe: nextFollowed,
      counts: {
        ...profile.counts,
        followers: profile.counts.followers + (nextFollowed ? 1 : -1),
      },
    });
    await fetch('/api/social/follow', {
      method: profile.followedByMe ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: profile.id }),
    });
  };

  if (loading) {
    return <main className="flex-1 px-4 py-8 text-sm text-gray-500">Chargement du profil...</main>;
  }

  if (!profile) {
    return <main className="flex-1 px-4 py-8 text-sm text-gray-500">Profil introuvable.</main>;
  }

  return (
    <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8 max-w-5xl mx-auto w-full space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <UserAvatar src={profile.profileImageUrl} name={profile.pseudo} size="xl" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-gray-900">@{profile.pseudo}</h1>
                {profile.verified && <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700">Verifie</span>}
              </div>
              <p className="mt-1 text-sm text-gray-500">{profile.name || 'Athlete street workout'}</p>
              <div className="mt-2">
                <LevelBadge xp={profile.xp} size="md" showProgress />
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2"><p className="text-[11px] text-gray-500">Followers</p><p className="font-black text-gray-900">{profile.counts.followers}</p></div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2"><p className="text-[11px] text-gray-500">Suit</p><p className="font-black text-gray-900">{profile.counts.following}</p></div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2"><p className="text-[11px] text-gray-500">Posts</p><p className="font-black text-gray-900">{profile.counts.posts}</p></div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2"><p className="text-[11px] text-gray-500">Perfs</p><p className="font-black text-gray-900">{profile.counts.validatedPerformances}</p></div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!profile.isMe && (
              <button onClick={toggleFollow} className={`rounded-2xl px-4 py-2 text-sm font-bold ${profile.followedByMe ? 'bg-gray-900 text-white' : 'bg-sky-100 text-sky-700'}`}>
                {profile.followedByMe ? 'Abonne' : 'Suivre'}
              </button>
            )}
            <Link href="/dashboard/social" className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Retour social</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
        {/* Galerie photos */}
        {!profile.isPrivate && profile.recentPosts.some((p) => p.text.startsWith('__IMAGE__')) && (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900">Photos</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {profile.recentPosts
                .filter((p) => p.text.startsWith('__IMAGE__'))
                .map((p) => {
                  const firstLine = p.text.split('\n')[0];
                  const imgUrl = firstLine.replace(/^__IMAGE__/, '').trim();
                  return (
                    <a key={p.id} href={imgUrl} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-gray-100">
                      <img src={imgUrl} alt="Publication" className="h-full w-full object-cover hover:scale-105 transition-transform duration-300" loading="lazy" />
                    </a>
                  );
                })}
            </div>
          </div>
        )}
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">Publications</h2>
          <div className="mt-4 space-y-3">
            {profile.isPrivate && <p className="text-sm font-semibold text-amber-700">Ce profil est prive.</p>}
            {!profile.isPrivate && profile.recentPosts.length === 0 && <p className="text-sm text-gray-500">Aucune publication visible pour le moment.</p>}
            {!profile.isPrivate && profile.recentPosts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="whitespace-pre-wrap text-sm text-gray-800">{post.text.replace(/^__IMAGE__[^\n]*\n?/, '')}</p>
                <p className="mt-2 text-xs text-gray-400">{new Date(post.createdAt).toLocaleString('fr-FR')}</p>
              </article>
            ))}
          </div>
        </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900">Infos utilisateur</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between"><span>Visibilite</span><span className="font-black text-gray-900">{profile.profileVisibility === 'private' ? 'Prive' : 'Public'}</span></div>
              <div className="flex items-center justify-between"><span>Sessions sur 7 jours</span><span className="font-black text-gray-900">{profile.counts.weeklySessions}</span></div>
              <div className="flex items-center justify-between"><span>Posts sur 7 jours</span><span className="font-black text-gray-900">{profile.counts.weeklyPosts}</span></div>
              <div className="flex items-center justify-between"><span>Badges</span><span className="font-black text-gray-900">{profile.counts.badges}</span></div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900">Performances</h2>
            <div className="mt-4 space-y-3">
              {profile.isPrivate && <p className="text-sm font-semibold text-amber-700">Ce profil est prive.</p>}
              {!profile.isPrivate && profile.recentPerformances.length === 0 && <p className="text-sm text-gray-500">Aucune performance publique validee.</p>}
              {!profile.isPrivate && profile.recentPerformances.map((performance) => (
                <article key={performance.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{performance.exercise}</p>
                    <p className="text-sm font-black text-gray-900">{performance.score} {performance.unit}</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{performance.spotName}{performance.spotCity ? `, ${performance.spotCity}` : ''}</p>
                  {performance.videoUrl && (
                    <video controls preload="metadata" className="mt-3 w-full rounded-xl border border-gray-200 bg-black max-h-56">
                      <source src={performance.videoUrl} />
                    </video>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}