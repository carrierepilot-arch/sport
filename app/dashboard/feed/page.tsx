'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type FeedReply = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    pseudo: string;
  };
};

type FeedPost = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    pseudo: string;
  };
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
  replies: FeedReply[];
};

type FeedScope = 'all' | 'friends';

function authHeader(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function formatRelativeDate(input: string): string {
  const date = new Date(input);
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  if (diffSec < 60) return 'a l\'instant';
  if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`;
  if (diffSec < 604800) return `il y a ${Math.floor(diffSec / 86400)} j`;

  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [meId, setMeId] = useState('');
  const [scope, setScope] = useState<FeedScope>('all');
  const [composer, setComposer] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const remaining = useMemo(() => 280 - composer.length, [composer.length]);

  const loadFeed = useCallback(async (nextScope: FeedScope) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/feed?scope=${nextScope}`, { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Impossible de charger le feed');
        setLoading(false);
        return;
      }
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setMeId(typeof data.me === 'string' ? data.me : '');
      setScope(nextScope);
      setLoading(false);
    } catch {
      setError('Erreur reseau');
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadFeed('all');
  }, [loadFeed]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const publishPost = async () => {
    if (!composer.trim() || posting) return;
    setPosting(true);
    setError('');
    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ content: composer.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Publication impossible');
        setPosting(false);
        return;
      }

      setPosts((prev) => [data.post as FeedPost, ...prev]);
      setComposer('');
      setPosting(false);
    } catch {
      setError('Erreur reseau');
      setPosting(false);
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/feed/${postId}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      if (!res.ok) return;
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      // no-op
    }
  };

  const toggleLike = async (postId: string, liked: boolean) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const nextLiked = !liked;
      return {
        ...p,
        likedByMe: nextLiked,
        likeCount: Math.max(0, p.likeCount + (nextLiked ? 1 : -1)),
      };
    }));

    try {
      await fetch(`/api/feed/${postId}/likes`, {
        method: liked ? 'DELETE' : 'POST',
        headers: authHeader(),
      });
    } catch {
      setPosts((prev) => prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          likedByMe: liked,
          likeCount: Math.max(0, p.likeCount + (liked ? 1 : -1)),
        };
      }));
    }
  };

  const sendReply = async (postId: string) => {
    const content = (replyDraft[postId] || '').trim();
    if (!content || sendingReplyId) return;

    setSendingReplyId(postId);
    try {
      const res = await fetch(`/api/feed/${postId}/replies`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Reponse impossible');
        setSendingReplyId(null);
        return;
      }

      const createdReply = data.reply as FeedReply;
      setPosts((prev) => prev.map((p) => {
        if (p.id !== postId) return p;
        const nextReplies = [...p.replies, createdReply].slice(-3);
        return {
          ...p,
          replyCount: p.replyCount + 1,
          replies: nextReplies,
        };
      }));
      setReplyDraft((prev) => ({ ...prev, [postId]: '' }));
      setSendingReplyId(null);
    } catch {
      setError('Erreur reseau');
      setSendingReplyId(null);
    }
  };

  return (
    <main className="flex-1 px-3 py-6 sm:px-6 md:px-8 sm:py-8 overflow-x-hidden">
      <div className="max-w-3xl w-full mx-auto space-y-4">
        <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-5 sm:p-6 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Feed</h1>
          <p className="text-sm text-gray-600 mt-1">Publie des messages courts et suis les actus de ta communaute.</p>
          <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-3 sm:p-4">
            <textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value.slice(0, 280))}
              placeholder="Quoi de neuf aujourd'hui ?"
              rows={4}
              className="w-full resize-none bg-transparent text-gray-900 placeholder:text-gray-400 outline-none text-sm sm:text-base"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className={`text-xs font-semibold ${remaining < 20 ? 'text-amber-600' : 'text-gray-400'}`}>
                {remaining} caracteres restants
              </p>
              <button
                onClick={() => void publishPost()}
                disabled={!composer.trim() || posting}
                className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-bold disabled:bg-gray-300 hover:bg-sky-500 transition"
              >
                {posting ? 'Publication...' : 'Publier'}
              </button>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Timeline</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void loadFeed('all')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${scope === 'all' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-600 hover:bg-white'}`}
              >
                Tous
              </button>
              <button
                onClick={() => void loadFeed('friends')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${scope === 'friends' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-white'}`}
              >
                Mes amis
              </button>
              <button
                onClick={() => void loadFeed(scope)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white"
              >
                Rafraichir
              </button>
            </div>
          </div>

          {loading && <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500">Chargement du feed...</div>}

          {!loading && posts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
              <p className="text-sm font-semibold text-gray-800">Aucune publication</p>
              <p className="text-xs text-gray-500 mt-1">Sois le premier a lancer le feed.</p>
            </div>
          )}

          {!loading && posts.map((post) => {
            const canDelete = meId && post.author.id === meId;
            return (
              <article key={post.id} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm sm:text-base font-bold text-gray-900">@{post.author.pseudo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatRelativeDate(post.createdAt)}</p>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => void deletePost(post.id)}
                      className="text-xs font-semibold text-red-500 hover:text-red-600"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
                <p className="mt-3 text-sm sm:text-base text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                  <button
                    onClick={() => void toggleLike(post.id, post.likedByMe)}
                    className={`font-semibold transition ${post.likedByMe ? 'text-rose-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {post.likedByMe ? 'J\'aime' : 'Aimer'} ({post.likeCount})
                  </button>
                  <span className="font-semibold">Reponses: {post.replyCount}</span>
                </div>

                <div className="mt-3 space-y-2 rounded-xl bg-gray-50 border border-gray-200 p-3">
                  {post.replies.length === 0 ? (
                    <p className="text-xs text-gray-400">Aucune reponse pour le moment.</p>
                  ) : (
                    post.replies.map((reply) => (
                      <div key={reply.id} className="text-xs sm:text-sm text-gray-700">
                        <p className="font-semibold text-gray-900">@{reply.author.pseudo} <span className="font-normal text-gray-400">· {formatRelativeDate(reply.createdAt)}</span></p>
                        <p className="mt-0.5 whitespace-pre-wrap">{reply.content}</p>
                      </div>
                    ))
                  )}

                  <div className="pt-1 flex items-center gap-2">
                    <input
                      value={replyDraft[post.id] || ''}
                      onChange={(e) => setReplyDraft((prev) => ({ ...prev, [post.id]: e.target.value.slice(0, 280) }))}
                      placeholder="Repondre..."
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      onClick={() => void sendReply(post.id)}
                      disabled={!((replyDraft[post.id] || '').trim()) || sendingReplyId === post.id}
                      className="px-3 py-2 rounded-lg bg-sky-600 text-white text-xs font-bold disabled:bg-gray-300 hover:bg-sky-500 transition"
                    >
                      {sendingReplyId === post.id ? '...' : 'Envoyer'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
