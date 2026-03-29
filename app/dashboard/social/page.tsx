'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type Tab = 'feed' | 'boite' | 'amis' | 'jeux' | 'defis' | 'performances';

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

type Conversation = { friendId: string; pseudo: string; nom: string; dernier: string; heure: string; nonLu: number };
type ChatMessage = { id: string; from: 'me' | 'them'; text: string; heure: string };
type AmiItem = {
  id: string;
  friendId: string;
  pseudo: string;
  nom: string;
  statut: 'accepte' | 'accepted' | 'en_attente' | 'pending' | 'recu';
};

type Challenge = {
  id: string;
  title: string;
  description: string;
  target: number;
  unit: string;
  badgeCode: string;
  badgeLabel: string;
  completed: boolean;
  _count: { completions: number };
  type?: 'system' | 'user' | 'public';
  creatorId?: string | null;
  creator?: { id: string; pseudo: string | null; name: string | null } | null;
  submittedForReview?: boolean;
  challengeType?: string;
  difficulty?: number;
  circuitData?: { exercises: { nom: string; reps: number }[]; repos: number; tours: number } | null;
  completions?: unknown[];
};

function authHeader(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
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

function Avatar({ letter, size = 'sm' }: { letter: string; size?: 'xs' | 'sm' | 'md' }) {
  const palette = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-teal-500', 'bg-sky-500', 'bg-blue-500', 'bg-violet-500'];
  const bg = palette[letter.toUpperCase().charCodeAt(0) % palette.length];
  const sizeClass = size === 'xs' ? 'w-6 h-6 text-xs' : size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';
  return <div className={`${bg} ${sizeClass} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>{letter.toUpperCase()}</div>;
}

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [meId, setMeId] = useState('');
  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState('');
  const [feedLoading, setFeedLoading] = useState(false);
  const [composerImageUrl, setComposerImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Boîte state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [boiteLoading, setBoiteLoading] = useState(false);
  const [selectedConvFriendId, setSelectedConvFriendId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgError, setMsgError] = useState('');
  const [mobileMsgView, setMobileMsgView] = useState<'list' | 'chat'>('list');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Amis state
  const [amis, setAmis] = useState<AmiItem[]>([]);
  const [amiseLoading, setAmiseLoading] = useState(false);

  // Défis state
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [newChallTitle, setNewChallTitle] = useState('');
  const [newChallDesc, setNewChallDesc] = useState('');
  const [newChallExercise, setNewChallExercise] = useState('');
  const [newChallTarget, setNewChallTarget] = useState('');
  const [newChallUnit, setNewChallUnit] = useState('reps');
  const [newChallType, setNewChallType] = useState<'simple' | 'circuit'>('simple');
  const [newChallDifficulty, setNewChallDifficulty] = useState<1 | 2 | 3>(1);
  const [newChallVisibility, setNewChallVisibility] = useState<'friends' | 'private' | 'public'>('friends');
  const [circuitExercises, setCircuitExercises] = useState<{ nom: string; reps: number }[]>([{ nom: '', reps: 10 }]);
  const [circuitRepos, setCircuitRepos] = useState(120);
  const [circuitTours, setCircuitTours] = useState(3);
  const [createChallengeLoading, setCreateChallengeLoading] = useState(false);
  const [challengeActionLoading, setChallengeActionLoading] = useState<Set<string>>(new Set());
  const [challengeNotif, setChallengeNotif] = useState<Record<string, string>>({});
  const challengeLoadingRef = useRef(false);

  const acceptedAmis = useMemo(
    () => amis.filter((a) => a.statut === 'accepte' || a.statut === 'accepted'),
    [amis],
  );

  const remaining = useMemo(() => 280 - composer.length, [composer.length]);
  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const res = await fetch('/api/feed?scope=all', { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPosts(Array.isArray(data.posts) ? data.posts : []);
        setMeId(typeof data.me === 'string' ? data.me : '');
      }
    } catch {
      // silent
    }
    setFeedLoading(false);
  }, []);

  const loadConversations = useCallback(async () => {
    setBoiteLoading(true);
    try {
      const res = await fetch('/api/messages/conversations', { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setConversations(data.conversations ?? []);
    } catch {
      // silent
    }
    setBoiteLoading(false);
  }, []);

  const loadAmis = useCallback(async () => {
    setAmiseLoading(true);
    try {
      const res = await fetch('/api/friends/list', { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const raw = [...(data.amis || []), ...(data.recus || []), ...(data.enAttente || [])] as Array<Record<string, unknown>>;
        const normalized: AmiItem[] = raw.reduce<AmiItem[]>((acc, item) => {
            const statutRaw = String(item.statut || item.status || '').toLowerCase();
            const statut: AmiItem['statut'] =
              statutRaw === 'accepted' || statutRaw === 'accepte'
                ? 'accepte'
                : statutRaw === 'pending' || statutRaw === 'en_attente'
                  ? 'en_attente'
                  : 'recu';
            const friendId = String(item.friendId || item.id || '').trim();
            if (!friendId) return acc;
            acc.push({
              id: String(item.id || friendId),
              friendId,
              pseudo: String(item.pseudo || 'ami'),
              nom: String(item.nom || item.pseudo || 'Ami'),
              statut,
            });
            return acc;
          }, []);
        setAmis(normalized);
      }
    } catch {
      // silent
    }
    setAmiseLoading(false);
  }, []);

  useEffect(() => {
    void loadFeed();
    void loadConversations();
    void loadAmis();
  }, [loadFeed, loadConversations, loadAmis]);

  const publishPost = async () => {
    if ((!composer.trim() && !composerImageUrl) || posting) return;
    setComposerError('');
    setPosting(true);
    try {
      const postContent = composerImageUrl
        ? `__IMAGE__${composerImageUrl}\n${composer.trim()}`
        : composer.trim();
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ content: postContent }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.post && typeof data.post === 'object' && typeof (data.post as FeedPost).id === 'string') {
        setPosts((prev) => [data.post as FeedPost, ...prev]);
        setComposer('');
        setComposerImageUrl(null);
      } else if (res.ok) {
        setComposerError('Publication en attente de synchronisation.');
        await loadFeed();
      }
    } catch {
      setComposerError('Erreur reseau. Publication en attente de synchronisation.');
    }
    setPosting(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/feed/upload-image', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.imageUrl) {
        setComposerImageUrl(data.imageUrl);
      }
    } catch { /* silent */ }
    setUploadingImage(false);
    e.target.value = '';
  };

  const toggleLike = async (postId: string, liked: boolean) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          likedByMe: !liked,
          likeCount: Math.max(0, p.likeCount + (!liked ? 1 : -1)),
        };
      }),
    );
    try {
      await fetch(`/api/feed/${postId}/likes`, {
        method: liked ? 'DELETE' : 'POST',
        headers: authHeader(),
      });
    } catch {
      // silent
    }
  };

  const deletePost = async (postId: string) => {
    try {
      await fetch(`/api/feed/${postId}`, { method: 'DELETE', headers: authHeader() });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      // silent
    }
  };

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replySending, setReplySending] = useState(false);

  const submitReply = async (postId: string) => {
    if (!replyContent.trim() || replySending) return;
    setReplySending(true);
    try {
      const res = await fetch(`/api/feed/${postId}/replies`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ content: replyContent.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, replyCount: p.replyCount + 1, replies: [...p.replies, data.reply as FeedReply] }
              : p,
          ),
        );
        setReplyContent('');
        setReplyingTo(null);
      }
    } catch { /* silent */ }
    setReplySending(false);
  };

  const loadMessages = useCallback(async (friendId: string) => {
    setChatLoading(true);
    setMsgError('');
    try {
      const res = await fetch(`/api/messages/${friendId}`, { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setChat(Array.isArray(data.messages) ? data.messages : []);
      } else {
        setMsgError(typeof data.error === 'string' ? data.error : 'Impossible de charger les messages.');
      }
    } catch {
      setMsgError('Erreur réseau lors du chargement des messages.');
    }
    setChatLoading(false);
  }, []);

  const openConversation = (friendId: string) => {
    setSelectedConvFriendId(friendId);
    setActiveTab('boite');
    setMobileMsgView('chat');
    void loadMessages(friendId);
  };

  const sendMessage = async () => {
    if (!selectedConvFriendId || !msgInput.trim() || sendingMsg) return;
    setSendingMsg(true);
    setMsgError('');
    const texte = msgInput.trim();
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ receiverId: selectedConvFriendId, content: texte }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.message) {
        setChat((prev) => [...prev, data.message as ChatMessage]);
        setMsgInput('');
        void loadConversations();
      } else {
        setMsgError(typeof data.error === 'string' ? data.error : 'Envoi impossible. Réessaie.');
      }
    } catch {
      setMsgError('Erreur réseau lors de l\'envoi du message.');
    }
    setSendingMsg(false);
  };

  const openPerformanceHub = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('reseau_tab', 'performances');
      window.location.assign('/dashboard/reseau');
    }
  };

  const loadChallenges = useCallback(async () => {
    if (challengeLoadingRef.current) return;
    challengeLoadingRef.current = true;
    setChallengeLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/challenges', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const mapped = (data.challenges ?? []).map((c: Challenge) => ({
        ...c,
        completed: Array.isArray(c.completions) && (c as unknown as { completions: unknown[] }).completions.length > 0,
      }));
      setChallenges(mapped);
    } finally {
      setChallengeLoading(false);
      challengeLoadingRef.current = false;
    }
  }, []);

  const completeChallenge = useCallback(async (id: string) => {
    setChallengeActionLoading((prev) => { const s = new Set(prev); s.add(id); return s; });
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'complete', challengeId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        const msg = data.badgeLabel ? ` Badge « ${data.badgeLabel} » obtenu !` : '✓ Défi relevé !';
        setChallengeNotif((prev) => ({ ...prev, [id]: msg }));
        await loadChallenges();
      } else {
        setChallengeNotif((prev) => ({ ...prev, [id]: data.error ?? 'Erreur' }));
      }
    } catch {
      setChallengeNotif((prev) => ({ ...prev, [id]: 'Erreur réseau' }));
    } finally {
      setChallengeActionLoading((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [loadChallenges]);

  const createChallenge = useCallback(async () => {
    if (!newChallTitle || !newChallDesc) return;
    if (newChallType === 'simple' && (!newChallExercise || !newChallTarget)) return;
    if (newChallType === 'circuit' && (circuitExercises.some((e) => !e.nom) || circuitTours < 1)) return;
    setCreateChallengeLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const bodyData: Record<string, unknown> = {
        action: 'create',
        title: newChallTitle,
        description: newChallDesc,
        challengeType: newChallType,
        difficulty: newChallDifficulty,
        visibility: newChallVisibility,
      };
      if (newChallType === 'circuit') {
        bodyData.exercise = 'circuit';
        bodyData.target = circuitTours;
        bodyData.unit = 'tours';
        bodyData.circuitData = { exercises: circuitExercises, repos: circuitRepos, tours: circuitTours };
      } else {
        bodyData.exercise = newChallExercise;
        bodyData.target = Number(newChallTarget);
        bodyData.unit = newChallUnit;
      }
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(bodyData),
      });
      if (res.ok) {
        setShowCreateChallenge(false);
        setNewChallTitle('');
        setNewChallDesc('');
        setNewChallExercise('');
        setNewChallTarget('');
        setNewChallUnit('reps');
        setNewChallType('simple');
        setNewChallDifficulty(1);
        setNewChallVisibility('friends');
        setCircuitExercises([{ nom: '', reps: 10 }]);
        setCircuitRepos(120);
        setCircuitTours(3);
        await loadChallenges();
      }
    } finally {
      setCreateChallengeLoading(false);
    }
  }, [newChallTitle, newChallDesc, newChallExercise, newChallTarget, newChallUnit, newChallType, newChallDifficulty, newChallVisibility, circuitExercises, circuitRepos, circuitTours, loadChallenges]);

  useEffect(() => {
    if (activeTab === 'defis') {
      void loadChallenges();
    }
  }, [activeTab, loadChallenges]);

  useEffect(() => {
    if (activeTab !== 'boite' || !selectedConvFriendId) return;
    const interval = setInterval(() => {
      void loadMessages(selectedConvFriendId);
      void loadConversations();
    }, 4000);
    return () => clearInterval(interval);
  }, [activeTab, selectedConvFriendId, loadMessages, loadConversations]);

  useEffect(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chat, chatLoading]);


  return (
    <main className="flex-1 px-3 py-6 sm:px-6 md:px-8 sm:py-8 overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-slate-50 min-h-screen">
      <div className="max-w-5xl w-full mx-auto">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center text-white font-black text-lg shadow-lg">
              S
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">Social Hub</h1>
              <p className="text-sm text-gray-500">Connecte-toi, partage et joue avec ta communauté</p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-1 sm:gap-2 rounded-2xl bg-white border border-gray-200 p-1.5 mb-8 shadow-sm overflow-x-auto">
          {([
            { key: 'feed' as Tab, label: 'Actualités' },
            { key: 'boite' as Tab, label: 'Messages' },
            { key: 'amis' as Tab, label: 'Amis' },
            { key: 'performances' as Tab, label: 'Performances' },
            { key: 'defis' as Tab, label: 'Défis' },
            { key: 'jeux' as Tab, label: 'Jeux' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-shrink-0 px-4 sm:px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === t.key ? 'bg-gradient-to-br from-sky-50 to-blue-50 text-sky-700 shadow-md border border-sky-200' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* Feed Section */}
          {activeTab === 'feed' && (
            <div className="space-y-6">
              {/* Composer */}
              <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Quoi de neuf ?</h2>
                <div className="space-y-3">
                  <textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value.slice(0, 280))}
                    placeholder="Partage tes bonnes vibes ici&apos;..."
                    rows={4}
                    className="w-full resize-none bg-gray-50 text-gray-900 placeholder:text-gray-400 outline-none text-sm sm:text-base p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-semibold ${remaining < 20 ? 'text-amber-600' : 'text-gray-400'}`}>{remaining} caractères</p>
                      <label className="cursor-pointer flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-sky-600 transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {uploadingImage ? 'Upload...' : 'Image'}
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => void handleImageUpload(e)} disabled={uploadingImage} />
                      </label>
                    </div>
                    <button
                      onClick={() => void publishPost()}
                      disabled={(!composer.trim() && !composerImageUrl) || posting}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm font-bold disabled:opacity-50 hover:shadow-lg transition-all"
                    >
                      {posting ? 'Publication...' : 'Publier'}
                    </button>
                  </div>
                  {composerImageUrl && (
                    <div className="relative inline-block mt-2">
                      <img src={composerImageUrl} alt="Apercu" className="max-h-32 rounded-xl border border-gray-200" />
                      <button onClick={() => setComposerImageUrl(null)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow">✕</button>
                    </div>
                  )}
                  {composerError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      {composerError}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Fil d&apos;actualités</h3>
                  <button onClick={() => void loadFeed()} className="text-xs font-semibold text-sky-600 hover:text-sky-700">
                    Rafraîchir
                  </button>
                </div>

                {feedLoading && <div className="text-center py-8 text-gray-500">Chargement...</div>}

                {!feedLoading && posts.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
                    <p className="text-sm font-semibold text-gray-800">Aucune publication</p>
                    <p className="text-xs text-gray-500 mt-1">Sois le premier à lancer le feed.</p>
                  </div>
                )}

                {!feedLoading &&
                  posts.filter((post) => post && typeof post.id === 'string').map((post) => {
                    const canDelete = meId && post.author.id === meId;
                    return (
                      <article key={post.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 flex-1">
                              <Avatar letter={(post.author.pseudo || '?')[0]} size="sm" />
                              <div className="flex-1">
                                <p className="text-sm font-bold text-gray-900">@{post.author.pseudo}</p>
                                <p className="text-xs text-gray-400">{formatRelativeDate(post.createdAt)}</p>
                              </div>
                            </div>
                            {canDelete && (
                              <button onClick={() => void deletePost(post.id)} className="text-xs font-semibold text-red-500 hover:text-red-600">
                                ✕
                              </button>
                            )}
                          </div>

                          <p className="text-sm sm:text-base text-gray-800 leading-relaxed whitespace-pre-wrap mb-4">{
                            (() => {
                              const txt = post.content;
                              if (txt.startsWith('__IMAGE__')) {
                                const nlIdx = txt.indexOf('\n');
                                const imgUrl = nlIdx > 9 ? txt.slice(9, nlIdx) : txt.slice(9);
                                const textPart = nlIdx > 9 ? txt.slice(nlIdx + 1) : '';
                                return (
                                  <>
                                    <img src={imgUrl} alt="Publication" className="w-full max-h-80 object-cover rounded-xl border border-gray-200 mb-3" />
                                    {textPart}
                                  </>
                                );
                              }
                              return txt;
                            })()
                          }</p>

                          <div className="flex items-center gap-6 text-xs text-gray-500 pb-4 border-b border-gray-100">
                            <button
                              onClick={() => void toggleLike(post.id, post.likedByMe)}
                              className={`font-semibold transition ${post.likedByMe ? 'text-rose-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                              ❤ {post.likeCount}
                            </button>
                            <button
                              onClick={() => { setReplyingTo(replyingTo === post.id ? null : post.id); setReplyContent(''); }}
                              className="font-semibold text-gray-500 hover:text-sky-600 transition"
                            >
                              💬 {post.replyCount}
                            </button>
                          </div>

                          {post.replies.length > 0 && (
                            <div className="mt-4 pt-4 space-y-2 border-t border-gray-100">
                              {post.replies.map((reply) => (
                                <div key={reply.id} className="text-xs sm:text-sm text-gray-700">
                                  <p className="font-semibold text-gray-900">@{reply.author.pseudo}</p>
                                  <p className="text-gray-600 whitespace-pre-wrap">{reply.content}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {replyingTo === post.id && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="flex gap-2">
                                <input
                                  value={replyContent}
                                  onChange={(e) => setReplyContent(e.target.value.slice(0, 280))}
                                  placeholder="Ecrire un commentaire..."
                                  maxLength={280}
                                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitReply(post.id); } }}
                                />
                                <button
                                  onClick={() => void submitReply(post.id)}
                                  disabled={!replyContent.trim() || replySending}
                                  className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-sky-500 transition"
                                >
                                  {replySending ? '...' : 'Envoyer'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Messages Section */}
          {activeTab === 'boite' && (
            <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Messages</h2>
              {boiteLoading ? (
                <div className="text-center py-8 text-gray-500">Chargement...</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
                  <div className={`space-y-2 max-h-[520px] overflow-y-auto pr-1 ${mobileMsgView === 'chat' ? 'hidden lg:block' : 'block'}`}>
                    {conversations.length === 0 && (
                      <div className="p-4 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500">
                        Aucune conversation existante.
                      </div>
                    )}
                    {conversations.map((conv) => (
                      <div
                        key={conv.friendId}
                        onClick={() => openConversation(conv.friendId)}
                        className={`p-4 rounded-xl border transition cursor-pointer ${selectedConvFriendId === conv.friendId ? 'bg-sky-50 border-sky-300 shadow-md' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-3 justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Avatar letter={(conv.pseudo || '?')[0]} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">@{conv.pseudo}</p>
                              <p className="text-xs text-gray-500 break-words break-all line-clamp-2">{conv.dernier || 'Aucun message'}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="text-xs text-gray-400 whitespace-nowrap">{conv.heure}</p>
                            {conv.nonLu > 0 && <span className="inline-block mt-1 px-2 py-1 text-xs font-bold bg-sky-500 text-white rounded-full">{conv.nonLu}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={`border border-gray-200 rounded-2xl min-h-[360px] overflow-hidden ${mobileMsgView === 'list' ? 'hidden lg:flex' : 'flex'} flex-col`}>
                    {!selectedConvFriendId ? (
                      <div className="flex-1 flex items-center justify-center text-sm text-gray-500 px-4 text-center">
                        Sélectionne une conversation pour voir la discussion.
                      </div>
                    ) : (
                      <>
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-800 flex items-center gap-2">
                          <button
                            onClick={() => setMobileMsgView('list')}
                            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-200 text-gray-600"
                            aria-label="Retour"
                          >
                            ←
                          </button>
                          {(() => {
                            const c = conversations.find((x) => x.friendId === selectedConvFriendId);
                            if (c) return `Discussion avec @${c.pseudo}`;
                            const ami = amis.find((a) => a.friendId === selectedConvFriendId);
                            return ami ? `Discussion avec @${ami.pseudo}` : 'Discussion';
                          })()}
                        </div>

                        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
                          {chatLoading ? (
                            <p className="text-sm text-gray-500">Chargement des messages...</p>
                          ) : chat.length === 0 ? (
                            <p className="text-sm text-gray-500">Aucun message pour le moment.</p>
                          ) : (
                            chat.map((m) => (
                              <div key={m.id} className={`max-w-[85%] ${m.from === 'me' ? 'ml-auto' : 'mr-auto'}`}>
                                <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words break-all ${m.from === 'me' ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                                  {m.text}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1 px-1">{m.heure}</p>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="p-3 border-t border-gray-100 bg-white">
                          {msgError && (
                            <div className="mb-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                              {msgError}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              value={msgInput}
                              onChange={(e) => setMsgInput(e.target.value)}
                              placeholder="Message..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void sendMessage();
                                }
                              }}
                              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                            />
                            <button
                              onClick={() => void sendMessage()}
                              disabled={sendingMsg || chatLoading || !msgInput.trim()}
                              className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold disabled:opacity-50"
                            >
                              {sendingMsg ? 'Envoi...' : 'Envoyer'}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Friends Section */}
          {activeTab === 'amis' && (
            <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Réseau</h2>
              {amiseLoading ? (
                <div className="text-center py-8 text-gray-500">Chargement...</div>
              ) : acceptedAmis.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Aucun ami pour le moment</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {acceptedAmis.map((ami) => (
                      <div key={ami.id} className="p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3 mb-2">
                          <Avatar letter={(ami.pseudo || '?')[0]} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">@{ami.pseudo}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => openConversation(ami.friendId)}
                          className="w-full mt-2 px-3 py-2 text-xs font-semibold rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-200 transition"
                        >
                          Message
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Games Section */}
          {activeTab === 'jeux' && (
            <div className="space-y-6">
              {/* Games Online */}
              <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4">🌐 Jeux en Ligne</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { name: 'Duel 1v1', icon: '⚔️', path: '/dashboard/mini-jeux?game=duel' },
                    { name: 'Défi Ami', icon: '🎯', path: '/dashboard/mini-jeux?game=defiami' },
                    { name: 'Top Semaine', icon: '📊', path: '/dashboard/mini-jeux?game=topsemaine' },
                    { name: 'Rush Classement', icon: '🚀', path: '/dashboard/mini-jeux?game=rush' },
                  ].map((game) => (
                    <Link key={game.name} href={game.path}>
                      <div className="p-5 rounded-xl border border-gray-200 hover:border-sky-300 bg-gradient-to-br hover:from-sky-50 hover:to-blue-50 cursor-pointer transition">
                        <div className="text-3xl mb-2">{game.icon}</div>
                        <p className="text-sm font-bold text-gray-900">{game.name}</p>
                        <p className="text-xs text-gray-500 mt-1">Participe maintenant</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Games Offline */}
              <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4">📱 Jeux Hors Ligne</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: 'Roulette', icon: '🎰', path: '/dashboard/mini-jeux?game=roulette' },
                    { name: 'Défi Chrono', icon: '⏱️', path: '/dashboard/mini-jeux?game=chrono' },
                    { name: 'Escalade', icon: '🗻', path: '/dashboard/mini-jeux?game=escalade' },
                    { name: 'Bingo Fitness', icon: '🎯', path: '/dashboard/mini-jeux?game=bingo' },
                    { name: 'Dé Fitness', icon: '🎲', path: '/dashboard/mini-jeux?game=de' },
                    { name: 'Shuffle HIIT', icon: '🔥', path: '/dashboard/mini-jeux?game=hiit' },
                    { name: 'Memory Muscu', icon: '🧠', path: '/dashboard/mini-jeux?game=memory' },
                    { name: 'Combo Breaker', icon: '🔗', path: '/dashboard/mini-jeux?game=combo' },
                  ].map((game) => (
                    <Link key={game.name} href={game.path}>
                      <div className="p-5 rounded-xl border border-gray-200 hover:border-emerald-300 bg-gradient-to-br hover:from-emerald-50 hover:to-teal-50 cursor-pointer transition">
                        <div className="text-3xl mb-2">{game.icon}</div>
                        <p className="text-sm font-bold text-gray-900">{game.name}</p>
                        <p className="text-xs text-gray-500 mt-1">Joue en solo</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Performances Section */}
          {activeTab === 'performances' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Performances</h2>
                <p className="text-sm text-gray-500 mb-5">
                  Enregistre tes records, ajoute une preuve vidéo et demande une validation à tes amis.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <button
                    onClick={openPerformanceHub}
                    className="w-full px-4 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition"
                  >
                    + Ajouter une performance
                  </button>
                  <button
                    onClick={openPerformanceHub}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-sky-200 hover:border-sky-300 text-sky-700 text-sm font-semibold transition"
                  >
                    Ouvrir le classement performances
                  </button>
                </div>

                <div className="rounded-2xl border border-dashed border-gray-300 bg-slate-50 p-4">
                  <p className="text-xs text-gray-600">
                    L&apos;ajout détaillé des performances est disponible dans l&apos;espace Réseau (onglet Performances),
                    avec sélection du spot, exercice, score, preuve vidéo et validation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Challenges Section */}
          {activeTab === 'defis' && (
            <div className="space-y-4">
              {/* Header + create button */}
              <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Défis Sportifs</h2>
                  <p className="text-xs sm:text-sm text-gray-500">Créez et relevez des défis personnels</p>
                </div>
                <button
                  onClick={() => setShowCreateChallenge((v) => !v)}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-xl transition shrink-0"
                >
                  {showCreateChallenge ? '✕ Annuler' : '+ Créer un défi'}
                </button>
              </div>

              {/* Create challenge form - simplified */}
              {showCreateChallenge && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
                  <p className="text-sm font-semibold text-gray-800">Nouveau Défi</p>
                  <input
                    type="text"
                    placeholder="Titre du défi"
                    value={newChallTitle}
                    onChange={(e) => setNewChallTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                  />
                  <textarea
                    placeholder="Description"
                    value={newChallDesc}
                    onChange={(e) => setNewChallDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none resize-none"
                  />
                  <input
                    type="text"
                    placeholder="Exercice (ex: Pompes)"
                    value={newChallExercise}
                    onChange={(e) => setNewChallExercise(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Objectif"
                      value={newChallTarget}
                      onChange={(e) => setNewChallTarget(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                    />
                    <select
                      value={newChallUnit}
                      onChange={(e) => setNewChallUnit(e.target.value)}
                      className="px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                    >
                      <option>reps</option>
                      <option>km</option>
                      <option>min</option>
                      <option>séries</option>
                    </select>
                  </div>
                  <button
                    onClick={() => void createChallenge()}
                    disabled={createChallengeLoading || !newChallTitle || !newChallDesc || !newChallExercise || !newChallTarget}
                    className="w-full px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition"
                  >
                    {createChallengeLoading ? 'Création...' : 'Publier le défi'}
                  </button>
                </div>
              )}

              {/* Challenges List */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                {challengeLoading ? (
                  <div className="text-center py-8 text-gray-500">Chargement des défis...</div>
                ) : challenges.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Aucun défi disponible</div>
                ) : (
                  <div className="space-y-3">
                    {challenges.map((challenge) => (
                      <div key={challenge.id} className="p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">{challenge.title}</p>
                            <p className="text-xs text-gray-500 mt-1">{challenge.description}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              Objectif: {challenge.target} {challenge.unit} • {challenge._count?.completions || 0} complétions
                            </p>
                          </div>
                          <button
                            onClick={() => void completeChallenge(challenge.id)}
                            disabled={challengeActionLoading.has(challenge.id) || challenge.completed}
                            className={`px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                              challenge.completed
                                ? 'bg-green-100 text-green-700'
                                : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                            }`}
                          >
                            {challengeActionLoading.has(challenge.id) ? '...' : challenge.completed ? '✓ Complété' : 'Relever'}
                          </button>
                        </div>
                        {challengeNotif[challenge.id] && (
                          <p className="text-xs text-green-600 font-semibold mt-2">{challengeNotif[challenge.id]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

