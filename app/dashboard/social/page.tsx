'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { UserAvatar } from '@/components/UserAvatar';

type Tab = 'feed' | 'boite' | 'performances';

type FeedReply = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    pseudo: string;
    profileImageUrl?: string | null;
  };
};

type FeedPost = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    pseudo: string;
    profileImageUrl?: string | null;
  };
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
  replies: FeedReply[];
  feedScore?: number;
  rankingReasons?: string[];
};

type SocialProfileCard = {
  id: string;
  pseudo: string;
  name: string | null;
  level: string;
  xp: number;
  verified: boolean;
  followedByMe: boolean;
  profileVisibility?: 'public' | 'private';
  isPrivate?: boolean;
  profileImageUrl?: string | null;
  counts: {
    followers: number;
    following: number;
    posts: number;
    validatedPerformances: number;
    weeklySessions: number;
  };
  bestPerformance: { exercise: string; score: number; unit: string } | null;
};

type CommunityPerformance = {
  id: string;
  exercise: string;
  score: number;
  unit: string;
  status: string;
  videoUrl: string | null;
  createdAt: string;
  validationQuestion: string;
  canVote: boolean;
  validation: {
    accepted: number;
    rejected: number;
    total: number;
    myVote: string | null;
  };
  author: {
    id: string;
    pseudo: string;
    level: string;
    xp: number;
    profileImageUrl?: string | null;
    verified: boolean;
  };
  spot: { id: string; name: string; city: string | null };
};

type Conversation = { friendId: string; pseudo: string; nom: string; dernier: string; heure: string; nonLu: number; profileImageUrl?: string | null };
type ChatMessage = { id: string; from: 'me' | 'them'; text: string; heure: string };
type AmiItem = {
  id: string;
  friendId: string;
  pseudo: string;
  nom: string;
  profileImageUrl?: string | null;
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

const FEED_MAX_VIDEO_SIZE = 8 * 1024 * 1024;
const FEED_MAX_VIDEO_DURATION = 10;
const FEED_ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// ── Performance video pipeline ──────────────────────────────────────────────
const PERF_MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB
const PERF_ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const PERF_EXERCISES = [
  { key: 'tractions', label: 'Tractions', unit: 'reps' },
  { key: 'pompes', label: 'Pompes', unit: 'reps' },
  { key: 'dips', label: 'Dips', unit: 'reps' },
  { key: 'squats', label: 'Squats', unit: 'reps' },
  { key: 'muscle_ups', label: 'Muscle-ups', unit: 'reps' },
  { key: 'tractions_lestees', label: 'Tractions lestées', unit: 'kg' },
  { key: 'dips_lestes', label: 'Dips lestés', unit: 'kg' },
] as const;

function isZipVideoUrl(url: string | null | undefined): boolean {
  return !!url && /\.zip($|\?)/i.test(url);
}

async function compressPerfVideo(file: File, onProgress: (pct: number) => void): Promise<File> {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLVideoElement === 'undefined') return file;
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
    ? 'video/webm;codecs=vp8,opus'
    : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : null;
  if (!mimeType) return file;
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.style.display = 'none';
    document.body.appendChild(video);
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.onloadedmetadata = () => {
      const MAX_H = 480;
      const scale = video.videoHeight > MAX_H ? MAX_H / video.videoHeight : 1;
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const stream = canvas.captureStream(24);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 800_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const duration = video.duration || 0;
      recorder.onstop = () => {
        URL.revokeObjectURL(objectUrl);
        document.body.removeChild(video);
        const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: mimeType.split(';')[0] }));
      };
      const drawFrame = () => {
        if (video.paused || video.ended) { recorder.stop(); return; }
        ctx.drawImage(video, 0, 0, w, h);
        if (duration > 0) onProgress(Math.round((video.currentTime / duration) * 90));
        requestAnimationFrame(drawFrame);
      };
      recorder.start();
      video.play().then(() => requestAnimationFrame(drawFrame)).catch(() => {
        recorder.stop();
        URL.revokeObjectURL(objectUrl);
        document.body.removeChild(video);
        resolve(file);
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      document.body.removeChild(video);
      resolve(file);
    };
  });
}

async function zipVideoFile(file: File, onProgress: (pct: number) => void): Promise<File> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file(file.name, file);
  onProgress(95);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
  onProgress(100);
  return new File([blob], file.name.replace(/\.[^.]+$/, '.zip'), { type: 'application/zip' });
}

async function readVideoMetadata(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({ duration: video.duration || 0, width: video.videoWidth || 0, height: video.videoHeight || 0 });
      URL.revokeObjectURL(objectUrl);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Impossible de lire la video.'));
    };
    video.src = objectUrl;
  });
}

async function compressFeedVideo(file: File, onProgress: (pct: number) => void): Promise<File> {
  const metadata = await readVideoMetadata(file);
  const needsCompression = file.size > FEED_MAX_VIDEO_SIZE || metadata.height > 480;
  if (!needsCompression) return file;

  if (typeof MediaRecorder === 'undefined' || typeof HTMLVideoElement === 'undefined') {
    return file;
  }

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
    ? 'video/webm;codecs=vp8,opus'
    : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : null;

  if (!mimeType) return file;

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.style.display = 'none';
    document.body.appendChild(video);

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.onloadedmetadata = () => {
      const maxHeight = 480;
      const scale = video.videoHeight > maxHeight ? maxHeight / video.videoHeight : 1;
      const width = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
      const height = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        document.body.removeChild(video);
        resolve(file);
        return;
      }

      const stream = canvas.captureStream(24);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 700_000 });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        URL.revokeObjectURL(objectUrl);
        document.body.removeChild(video);
        const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webm'), { type: mimeType.split(';')[0] }));
      };

      const maxDuration = Math.min(video.duration || FEED_MAX_VIDEO_DURATION, FEED_MAX_VIDEO_DURATION);
      const drawFrame = () => {
        if (video.paused || video.ended || video.currentTime >= maxDuration) {
          recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        if (maxDuration > 0) onProgress(Math.min(100, Math.round((video.currentTime / maxDuration) * 100)));
        requestAnimationFrame(drawFrame);
      };

      recorder.start();
      video.play().then(() => requestAnimationFrame(drawFrame)).catch(() => {
        recorder.stop();
        URL.revokeObjectURL(objectUrl);
        document.body.removeChild(video);
        resolve(file);
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      document.body.removeChild(video);
      resolve(file);
    };
  });
}

function parseFeedContent(content: string): { kind: 'text' | 'image' | 'video'; mediaUrl: string | null; text: string } {
  if (content.startsWith('__IMAGE__') || content.startsWith('__VIDEO__')) {
    const separatorIndex = content.indexOf('\n');
    const markerLength = content.startsWith('__IMAGE__') ? 9 : 9;
    const mediaUrl = separatorIndex >= 0 ? content.slice(markerLength, separatorIndex).trim() : content.slice(markerLength).trim();
    const text = separatorIndex >= 0 ? content.slice(separatorIndex + 1) : '';
    return {
      kind: content.startsWith('__VIDEO__') ? 'video' : 'image',
      mediaUrl: mediaUrl || null,
      text,
    };
  }
  return { kind: 'text', mediaUrl: null, text: content };
}

// ── Zip-aware video player ───────────────────────────────────────────────────
function ZipVideoPlayer({ url, className }: { url: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isZipVideoUrl(url)) {
      setSrc(url);
      return;
    }
    setExtracting(true);
    void import('jszip').then(({ default: JSZip }) =>
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buf) => JSZip.loadAsync(buf))
        .then((zip) => {
          const entry = Object.values(zip.files).find((f) => !f.dir && /\.(mp4|webm|mov)$/i.test(f.name));
          return entry ? entry.async('blob') : null;
        })
        .then((blob) => {
          if (blob) {
            const objUrl = URL.createObjectURL(blob);
            objectUrlRef.current = objUrl;
            setSrc(objUrl);
          } else {
            setSrc(url);
          }
        })
        .catch(() => setSrc(url)),
    ).finally(() => setExtracting(false));
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [url]);

  if (extracting) return <div className="mt-3 rounded-xl bg-slate-50 border border-gray-200 py-4 text-center text-xs text-gray-500">Decompression de la video...</div>;
  if (!src) return null;
  return <video controls preload="metadata" className={className} src={src} />;
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
  const [composerVideoUrl, setComposerVideoUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);

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
  const [publicProfiles, setPublicProfiles] = useState<SocialProfileCard[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [communityPerformances, setCommunityPerformances] = useState<CommunityPerformance[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState<string | null>(null);

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

  // Performance modal state
  const [showPerfModal, setShowPerfModal] = useState(false);
  const [perfModalExercise, setPerfModalExercise] = useState<string>('tractions');
  const [perfModalScore, setPerfModalScore] = useState('');
  const [perfModalVisibility, setPerfModalVisibility] = useState<'public' | 'private'>('private');
  const [perfModalVideoFile, setPerfModalVideoFile] = useState<File | null>(null);
  const [perfModalSubmitting, setPerfModalSubmitting] = useState(false);
  const [perfModalVideoProgress, setPerfModalVideoProgress] = useState<number | null>(null);
  const [perfModalError, setPerfModalError] = useState('');

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

  const loadPublicProfiles = useCallback(async () => {
    setProfilesLoading(true);
    try {
      const res = await fetch('/api/social/users', { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPublicProfiles(Array.isArray(data.users) ? data.users : []);
    } catch {
      // silent
    }
    setProfilesLoading(false);
  }, []);

  const loadCommunityPerformances = useCallback(async () => {
    setCommunityLoading(true);
    try {
      const res = await fetch('/api/performances/community?status=pending', { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setCommunityPerformances(Array.isArray(data.performances) ? data.performances : []);
    } catch {
      // silent
    }
    setCommunityLoading(false);
  }, []);

  const toggleFollow = async (profile: SocialProfileCard) => {
    if (followLoading) return;
    setFollowLoading(profile.id);
    setPublicProfiles((prev) => prev.map((item) => item.id === profile.id ? {
      ...item,
      followedByMe: !item.followedByMe,
      counts: { ...item.counts, followers: item.counts.followers + (item.followedByMe ? -1 : 1) },
    } : item));
    try {
      await fetch('/api/social/follow', {
        method: profile.followedByMe ? 'DELETE' : 'POST',
        headers: authHeader(),
        body: JSON.stringify({ targetUserId: profile.id }),
      });
    } catch {
      setPublicProfiles((prev) => prev.map((item) => item.id === profile.id ? {
        ...item,
        followedByMe: profile.followedByMe,
        counts: { ...item.counts, followers: profile.counts.followers },
      } : item));
    }
    setFollowLoading(null);
  };

  const votePerformance = async (performanceId: string, isValid: boolean) => {
    try {
      const res = await fetch('/api/performances/validate', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ action: 'respond', performanceId, isValid }),
      });
      if (!res.ok) return;
      await loadCommunityPerformances();
    } catch {
      // silent
    }
  };

  useEffect(() => {
    void loadFeed();
    void loadConversations();
    void loadAmis();
    void loadPublicProfiles();
    void loadCommunityPerformances();
  }, [loadFeed, loadConversations, loadAmis, loadPublicProfiles, loadCommunityPerformances]);

  const publishPost = async () => {
    if ((!composer.trim() && !composerImageUrl && !composerVideoUrl) || posting) return;
    setComposerError('');
    setPosting(true);
    try {
      const postContent = composerVideoUrl
        ? `__VIDEO__${composerVideoUrl}\n${composer.trim()}`
        : composerImageUrl
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
        setComposerVideoUrl(null);
        setVideoProgress(null);
        await loadFeed();
      } else if (res.ok) {
        setComposerError('Publication en attente de synchronisation.');
        await loadFeed();
      } else {
        setComposerError(typeof data?.error === 'string' ? data.error : 'Publication refusee par le serveur.');
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
        setComposerVideoUrl(null);
      }
    } catch { /* silent */ }
    setUploadingImage(false);
    e.target.value = '';
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setComposerError('');

    if (!FEED_ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setComposerError('Format video non supporte. Utilise mp4, webm ou mov.');
      e.target.value = '';
      return;
    }

    try {
      const metadata = await readVideoMetadata(file);
      if (metadata.duration > FEED_MAX_VIDEO_DURATION) {
        setComposerError('La video doit durer 10 secondes maximum.');
        e.target.value = '';
        return;
      }

      setUploadingVideo(true);
      setVideoProgress(0);
      const preparedFile = await compressFeedVideo(file, setVideoProgress);
      const formData = new FormData();
      formData.append('video', preparedFile);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/feed/upload-video', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.videoUrl) {
        setComposerVideoUrl(data.videoUrl);
        setComposerImageUrl(null);
        setVideoProgress(100);
      } else {
        setComposerError(typeof data.error === 'string' ? data.error : 'Upload video impossible.');
        setVideoProgress(null);
      }
    } catch {
      setComposerError('Erreur pendant la preparation de la video.');
      setVideoProgress(null);
    }

    setUploadingVideo(false);
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

  const closePerfModal = useCallback(() => {
    setShowPerfModal(false);
    setPerfModalExercise('tractions');
    setPerfModalScore('');
    setPerfModalVisibility('private');
    setPerfModalVideoFile(null);
    setPerfModalSubmitting(false);
    setPerfModalVideoProgress(null);
    setPerfModalError('');
  }, []);

  const submitPerfModal = useCallback(async () => {
    if (!perfModalScore || perfModalSubmitting) return;
    const scoreNum = parseFloat(perfModalScore);
    if (isNaN(scoreNum) || scoreNum <= 0) {
      setPerfModalError('Le score doit être un nombre positif.');
      return;
    }
    setPerfModalError('');
    setPerfModalSubmitting(true);
    setPerfModalVideoProgress(null);
    try {
      // 1. Create performance record (no spot required)
      const res = await fetch('/api/performances', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ exercise: perfModalExercise, score: scoreNum, visibility: perfModalVisibility }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPerfModalError(typeof data?.error === 'string' ? data.error : 'Erreur lors de l\'ajout.');
        setPerfModalSubmitting(false);
        return;
      }
      const performanceId = (data.performance as { id?: string } | undefined)?.id;

      // 2. If video selected: compress 480p → zip → upload
      if (perfModalVideoFile && performanceId) {
        setPerfModalVideoProgress(0);
        try {
          const compressed = await compressPerfVideo(perfModalVideoFile, (pct) =>
            setPerfModalVideoProgress(Math.round(pct * 0.9)),
          );
          const zipped = await zipVideoFile(compressed, (pct) => setPerfModalVideoProgress(pct));
          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
          const { upload } = await import('@vercel/blob/client');
          await upload(
            `performances/${performanceId}/${Date.now()}-${zipped.name}`,
            zipped,
            {
              access: 'public',
              handleUploadUrl: '/api/performances/upload-video/client',
              clientPayload: performanceId,
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
          );
        } catch {
          // Video upload failed but performance record is saved — continue silently
        }
        setPerfModalVideoProgress(null);
      }

      await loadCommunityPerformances();
      closePerfModal();
    } catch {
      setPerfModalError('Erreur réseau. Veuillez réessayer.');
      setPerfModalSubmitting(false);
    }
  }, [perfModalScore, perfModalSubmitting, perfModalExercise, perfModalVisibility, perfModalVideoFile, loadCommunityPerformances, closePerfModal]);

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
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chat, chatLoading]);


  return (
    <main className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_30%),linear-gradient(180deg,#f8fbff_0%,#ffffff_38%,#eef6ff_100%)] min-h-[calc(100vh-72px)]">
      <div className="absolute inset-x-0 top-0 z-20 px-3 pt-4 sm:px-6 md:px-8">
        <div className="mx-auto flex max-w-6xl justify-center">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/70 bg-white/90 p-1.5 shadow-[0_12px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              {([
                { key: 'feed' as Tab, label: 'Feed' },
                { key: 'boite' as Tab, label: 'Messagerie' },
                { key: 'performances' as Tab, label: 'Performance' },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`rounded-2xl px-4 py-3 text-xs font-bold transition sm:text-sm ${
                    activeTab === t.key
                      ? 'bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.22)]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-6xl flex-col px-3 pb-6 pt-24 sm:px-6 md:px-8 sm:pb-8 sm:pt-28">
        <div className="flex-1 space-y-6">
          {/* Feed Section */}
          {activeTab === 'feed' && (
            <section className="flex min-h-[calc(100vh-220px)] flex-col gap-6">
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-xs font-semibold ${remaining < 20 ? 'text-amber-600' : 'text-gray-400'}`}>{remaining} caractères</p>
                      <label className="cursor-pointer flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-sky-600 transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {uploadingImage ? 'Upload...' : 'Image'}
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => void handleImageUpload(e)} disabled={uploadingImage} />
                      </label>
                      <label className="cursor-pointer flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-sky-600 transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-9 5h8a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {uploadingVideo ? 'Compression...' : 'Vidéo'}
                        <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => void handleVideoUpload(e)} disabled={uploadingVideo} />
                      </label>
                    </div>
                    <button
                      onClick={() => void publishPost()}
                      disabled={(!composer.trim() && !composerImageUrl && !composerVideoUrl) || posting}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm font-bold disabled:opacity-50 hover:shadow-lg transition-all"
                    >
                      {posting ? 'Publication...' : 'Publier'}
                    </button>
                  </div>
                  {composerImageUrl && (
                    <div className="relative inline-block mt-2">
                      <img src={composerImageUrl} alt="Apercu" className="max-h-32 rounded-xl border border-gray-200 object-contain" />
                      <button onClick={() => setComposerImageUrl(null)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow">✕</button>
                    </div>
                  )}
                  {composerVideoUrl && (
                    <div className="relative mt-2 inline-block">
                      <video controls preload="metadata" className="max-h-40 rounded-xl border border-gray-200 bg-black object-contain">
                        <source src={composerVideoUrl} />
                      </video>
                      <button onClick={() => { setComposerVideoUrl(null); setVideoProgress(null); }} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow">✕</button>
                    </div>
                  )}
                  {videoProgress !== null && uploadingVideo && (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                      Compression et preparation de la video... {videoProgress}%
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
              <div className="flex-1 space-y-4 overflow-y-auto pr-1">
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
                              <Link href={`/dashboard/profil/${post.author.id}`}>
                                <UserAvatar src={post.author.profileImageUrl} name={post.author.pseudo} size="sm" />
                              </Link>
                              <div className="flex-1">
                                <Link href={`/dashboard/profil/${post.author.id}`} className="text-sm font-bold text-gray-900 hover:underline">@{post.author.pseudo}</Link>
                                <p className="text-xs text-gray-400">{formatRelativeDate(post.createdAt)}</p>
                              </div>
                            </div>
                            {canDelete && (
                              <button onClick={() => void deletePost(post.id)} className="text-xs font-semibold text-red-500 hover:text-red-600">
                                ✕
                              </button>
                            )}
                          </div>

                          <div className="text-sm sm:text-base text-gray-800 leading-relaxed whitespace-pre-wrap mb-4">
                            {(() => {
                              const parsed = parseFeedContent(post.content);
                              if (parsed.kind === 'image' && parsed.mediaUrl) {
                                return (
                                  <>
                                    <img src={parsed.mediaUrl} alt="Publication" className="w-full max-h-80 object-contain rounded-xl border border-gray-200 mb-3 bg-slate-50" />
                                    {parsed.text}
                                  </>
                                );
                              }
                              if (parsed.kind === 'video' && parsed.mediaUrl) {
                                return (
                                  <>
                                    <video controls preload="metadata" className="w-full max-h-96 object-contain rounded-xl border border-gray-200 mb-3 bg-black">
                                      <source src={parsed.mediaUrl} />
                                    </video>
                                    {parsed.text}
                                  </>
                                );
                              }
                              return parsed.text;
                            })()}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:gap-6 text-xs text-gray-500 pb-4 border-b border-gray-100">
                            {(post.rankingReasons?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {post.rankingReasons?.map((reason) => (
                                  <span key={reason} className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">{reason}</span>
                                ))}
                              </div>
                            )}
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
                                  <Link href={`/dashboard/profil/${reply.author.id}`} className="font-semibold text-gray-900 hover:underline">@{reply.author.pseudo}</Link>
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
            </section>
          )}

          {/* Messages Section */}
          {activeTab === 'boite' && (
            <section className="flex min-h-[calc(100vh-220px)] flex-col rounded-[32px] border border-slate-200 bg-white/95 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3 px-1">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Messagerie</h2>
                  <p className="text-sm text-slate-500">Conversation plein écran, accès rapide aux amis et profils suggérés.</p>
                </div>
                <button onClick={() => { void loadConversations(); void loadAmis(); void loadPublicProfiles(); }} className="text-xs font-semibold text-sky-600 hover:text-sky-700">Actualiser</button>
              </div>
              {boiteLoading ? (
                <div className="text-center py-8 text-gray-500">Chargement...</div>
              ) : (
                <div className="grid flex-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_280px]">
                  <div className={`space-y-2 overflow-y-auto rounded-[28px] border border-slate-200 bg-slate-50 p-3 ${mobileMsgView === 'chat' ? 'hidden xl:block' : 'block'}`}>
                    {conversations.length === 0 && (
                      <div className="p-4 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500">
                        Aucune conversation existante.
                      </div>
                    )}
                    {conversations.map((conv) => (
                      <div key={conv.friendId} className={`p-4 rounded-xl border transition ${selectedConvFriendId === conv.friendId ? 'bg-sky-50 border-sky-300 shadow-md' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-3 justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Link href={`/dashboard/profil/${conv.friendId}`}>
                              <UserAvatar src={conv.profileImageUrl} name={conv.pseudo} size="sm" />
                            </Link>
                            <div className="flex-1 min-w-0">
                              <Link href={`/dashboard/profil/${conv.friendId}`} className="text-sm font-semibold text-gray-900 truncate hover:underline block">@{conv.pseudo}</Link>
                              <p className="text-xs text-gray-500 break-words break-all line-clamp-2">{conv.dernier || 'Aucun message'}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="text-xs text-gray-400 whitespace-nowrap">{conv.heure}</p>
                            {conv.nonLu > 0 && <span className="inline-block mt-1 px-2 py-1 text-xs font-bold bg-sky-500 text-white rounded-full">{conv.nonLu}</span>}
                          </div>
                        </div>
                        <button onClick={() => openConversation(conv.friendId)} className="mt-3 w-full rounded-xl bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-200">Ouvrir la conversation</button>
                      </div>
                    ))}
                  </div>

                  <div className={`min-h-[480px] overflow-hidden rounded-[28px] border border-slate-200 bg-white ${mobileMsgView === 'list' ? 'hidden xl:flex' : 'flex'} flex-col`}> 
                    {!selectedConvFriendId ? (
                      <div className="flex-1 flex items-center justify-center text-sm text-gray-500 px-4 text-center bg-[linear-gradient(180deg,#ffffff,#f8fbff)]">
                        Sélectionne une conversation pour voir la discussion.
                      </div>
                    ) : (
                      <>
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-800 flex items-center gap-2">
                          <button
                            onClick={() => setMobileMsgView('list')}
                            className="xl:hidden p-1.5 rounded-lg hover:bg-gray-200 text-gray-600"
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

                        <div ref={chatContainerRef} className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4 pb-24 space-y-2">
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

                        <div className="sticky bottom-0 z-10 border-t border-gray-100 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-[0_-8px_24px_rgba(15,23,42,0.04)]">
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

                  <div className="grid gap-4 content-start">
                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-black text-gray-900">Amis</h3>
                      <div className="mt-3 space-y-2">
                        {acceptedAmis.length === 0 && <p className="text-sm text-gray-500">Aucun ami pour le moment.</p>}
                        {acceptedAmis.map((ami) => (
                          <div key={ami.id} className="rounded-xl border border-gray-200 bg-white p-3">
                            <div className="flex items-center gap-3">
                              <Link href={`/dashboard/profil/${ami.friendId}`}>
                                <UserAvatar src={ami.profileImageUrl} name={ami.pseudo} size="sm" />
                              </Link>
                              <div className="min-w-0 flex-1">
                                <Link href={`/dashboard/profil/${ami.friendId}`} className="block truncate text-sm font-semibold text-gray-900 hover:underline">@{ami.pseudo}</Link>
                                <p className="truncate text-xs text-gray-500">{ami.nom}</p>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button onClick={() => openConversation(ami.friendId)} className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-200">Message</button>
                              <Link href={`/dashboard/profil/${ami.friendId}`} className="rounded-xl border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-700 hover:bg-gray-50">Voir profil</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-black text-gray-900">Profils suggeres</h3>
                      <div className="mt-3 space-y-2">
                        {profilesLoading && <p className="text-sm text-gray-500">Chargement des profils...</p>}
                        {publicProfiles.slice(0, 6).map((profile) => (
                          <div key={profile.id} className="rounded-xl border border-gray-200 bg-white p-3">
                            <div className="flex items-center gap-3 justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <Link href={`/dashboard/profil/${profile.id}`}>
                                  <UserAvatar src={profile.profileImageUrl} name={profile.pseudo} size="sm" />
                                </Link>
                                <div className="min-w-0">
                                  <Link href={`/dashboard/profil/${profile.id}`} className="block truncate text-sm font-semibold text-gray-900 hover:underline">@{profile.pseudo}</Link>
                                  <p className="truncate text-xs text-gray-500">{profile.isPrivate ? 'Profil prive' : `${profile.level} · ${profile.xp} XP`}</p>
                                </div>
                              </div>
                              <button onClick={() => void toggleFollow(profile)} disabled={followLoading === profile.id} className={`rounded-xl px-3 py-2 text-xs font-bold ${profile.followedByMe ? 'bg-gray-900 text-white' : 'bg-sky-100 text-sky-700 hover:bg-sky-200'}`}>
                                {followLoading === profile.id ? '...' : profile.followedByMe ? 'Abonne' : 'Suivre'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Performances Section */}
          {activeTab === 'performances' && (
            <section className="flex min-h-[calc(100vh-220px)] flex-col gap-4">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Performances</h2>
                <p className="text-sm text-gray-500 mb-5">
                  Enregistre tes records, ajoute une preuve vidéo et demande une validation à tes amis.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <button
                    onClick={() => setShowPerfModal(true)}
                    className="w-full px-4 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition"
                  >
                    + Ajouter une performance
                  </button>
                  <button
                    onClick={() => setShowPerfModal(true)}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-sky-200 hover:border-sky-300 text-sky-700 text-sm font-semibold transition"
                  >
                    Enregistrer un nouveau record
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mb-5">
                  <Link href="/dashboard/analyse" className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-100">Voir la progression detaillee</Link>
                  <Link href="/dashboard/mini-jeux?game=duel" className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-100">Lancer un duel ou un defi</Link>
                </div>

                <div className="rounded-2xl border border-dashed border-gray-300 bg-slate-50 p-4">
                  <p className="text-xs text-gray-600">
                    Les preuves video sont compressees cote client a 480p maximum dans l espace Performances pour rester legeres et directement exploitables pour la validation communautaire.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-gray-900">Validation communautaire</h3>
                    <p className="text-sm text-gray-500">Sondage public sur les repetitions: oui ou non.</p>
                  </div>
                  <button onClick={() => void loadCommunityPerformances()} className="text-xs font-semibold text-sky-600 hover:text-sky-700">Actualiser</button>
                </div>

                {communityLoading ? (
                  <div className="text-center py-8 text-gray-500">Chargement des validations...</div>
                ) : communityPerformances.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-slate-50 p-6 text-center text-sm text-gray-500">
                    Aucune performance en attente de vote pour le moment.
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {communityPerformances.map((performance) => (
                      <article key={performance.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Link href={`/dashboard/profil/${performance.author.id}`} className="text-sm font-bold text-gray-900 hover:underline block">@{performance.author.pseudo}</Link>
                            <p className="text-xs text-gray-500">{performance.author.level} · {performance.author.xp} XP{performance.author.verified ? ' · verifie' : ''}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${performance.status === 'validated' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {performance.status === 'validated' ? 'validee' : 'a verifier'}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-sm text-gray-700">{performance.exercise} · <span className="font-black text-gray-900">{performance.score} {performance.unit}</span></p>
                          <p className="text-xs text-gray-500">{performance.spot.name}{performance.spot.city ? `, ${performance.spot.city}` : ''}</p>
                        </div>

                        {performance.videoUrl && (
                          <ZipVideoPlayer url={performance.videoUrl} className="mt-3 w-full rounded-xl border border-gray-200 bg-black max-h-80" />
                        )}

                        <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-3">
                          <p className="text-sm font-semibold text-gray-900">{performance.validationQuestion}</p>
                          <p className="mt-1 text-xs text-gray-500">Votes oui: {performance.validation.accepted} · non: {performance.validation.rejected}</p>
                          {performance.canVote ? (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => void votePerformance(performance.id, true)}
                                className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${performance.validation.myVote === 'accepted' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                              >
                                Oui, valide
                              </button>
                              <button
                                onClick={() => void votePerformance(performance.id, false)}
                                className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${performance.validation.myVote === 'rejected' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                              >
                                Non, a revoir
                              </button>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs font-semibold text-gray-500">Tu ne peux pas voter sur ta propre performance.</p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Performance Modal */}
      {showPerfModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">Ajouter une performance</h2>
                <p className="text-xs text-gray-500 mt-0.5">Enregistre ton record et demande une validation communautaire.</p>
              </div>
              <button
                onClick={closePerfModal}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition"
                aria-label="Fermer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {perfModalError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {perfModalError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Exercice</label>
                <select
                  value={perfModalExercise}
                  onChange={(e) => setPerfModalExercise(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  {PERF_EXERCISES.map((ex) => (
                    <option key={ex.key} value={ex.key}>{ex.label} ({ex.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Score ({PERF_EXERCISES.find((e) => e.key === perfModalExercise)?.unit ?? 'reps'})
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={perfModalScore}
                  onChange={(e) => setPerfModalScore(e.target.value)}
                  placeholder="Ex : 15"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Visibilite</label>
                <div className="flex gap-2">
                  {(['public', 'private'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setPerfModalVisibility(v)}
                      className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                        perfModalVisibility === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {v === 'public' ? 'Public' : 'Prive'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Preuve video (optionnel, max 200 MB)</label>
                {perfModalVideoFile ? (
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <span className="text-sm font-semibold text-gray-700 truncate">{perfModalVideoFile.name}</span>
                    <button
                      onClick={() => { setPerfModalVideoFile(null); setPerfModalVideoProgress(null); }}
                      className="ml-3 flex-shrink-0 text-xs font-bold text-red-500 hover:text-red-600"
                    >
                      Retirer
                    </button>
                  </div>
                ) : (
                  <label className="block w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-200 px-4 py-6 text-center hover:border-sky-300 transition">
                    <p className="text-sm font-semibold text-gray-500">Choisir une video</p>
                    <p className="text-xs text-gray-400 mt-1">mp4, webm ou mov · max 200 MB</p>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (!PERF_ALLOWED_VIDEO_TYPES.includes(f.type)) {
                          setPerfModalError('Format non supporte. Utilise mp4, webm ou mov.');
                          return;
                        }
                        if (f.size > PERF_MAX_VIDEO_SIZE) {
                          setPerfModalError('Video trop volumineuse (max 200 MB).');
                          return;
                        }
                        setPerfModalError('');
                        setPerfModalVideoFile(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
                {perfModalVideoProgress !== null && (
                  <div className="mt-2 rounded-xl bg-sky-50 border border-sky-200 px-4 py-2.5 text-xs font-semibold text-sky-700">
                    Pipeline : compression 480p → ZIP → upload... {perfModalVideoProgress}%
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => void submitPerfModal()}
              disabled={!perfModalScore || perfModalSubmitting}
              className="w-full rounded-2xl bg-sky-600 py-3.5 text-sm font-black text-white disabled:opacity-50 hover:bg-sky-500 transition"
            >
              {perfModalSubmitting ? 'Enregistrement...' : 'Enregistrer la performance'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

