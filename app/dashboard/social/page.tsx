'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { UserAvatar } from '@/components/UserAvatar';
import LevelBadge from '@/app/components/LevelBadge';

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
  pinned?: boolean;
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
  spot: { id: string; name: string; city: string | null } | null;
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

const FEED_MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB — stockage direct sans compression bloquante
const FEED_MAX_VIDEO_DURATION = 90; // seconds — used only in legacy compression path
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

// ── Workout share card component ─────────────────────────────────────────────
function WorkoutShareCard({ workoutData, isMine }: { workoutData: { title: string; programme: { jours?: { jour: string; focus: string; exercices: { nom: string; series: number; reps: string; repos: string }[] }[] } }; isMine: boolean }) {
  const [showDetail, setShowDetail] = useState(false);
  const [saved, setSaved] = useState(false);
  const jours = workoutData.programme?.jours ?? [];
  return (
    <div className={`rounded-2xl overflow-hidden border ${isMine ? 'border-sky-300 bg-sky-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <div className={`px-4 py-3 ${isMine ? 'bg-sky-600' : 'bg-emerald-600'}`}>
        <p className="text-xs text-white/70 uppercase tracking-widest font-semibold">Programme partage</p>
        <p className="text-sm font-bold text-white mt-0.5">{workoutData.title || 'Programme'}</p>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-gray-600">{jours.length} jour{jours.length > 1 ? 's' : ''} · {jours.reduce((s, j) => s + (j.exercices?.length ?? 0), 0)} exercices</p>
        {!showDetail && jours.length > 0 && (
          <button onClick={() => setShowDetail(true)} className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-500 transition">
            Afficher plus
          </button>
        )}
        {showDetail && (
          <div className="mt-3 space-y-2">
            {jours.map((jour, ji) => (
              <div key={ji} className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-bold text-gray-800">{jour.jour} — {jour.focus}</p>
                <div className="mt-1.5 space-y-1">
                  {(jour.exercices ?? []).map((ex, ei) => (
                    <p key={ei} className="text-xs text-gray-600">
                      {ex.nom} — {ex.series}x{ex.reps} · repos {ex.repos}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => setShowDetail(false)} className="text-xs text-gray-400 hover:text-gray-600 transition">
              Masquer
            </button>
          </div>
        )}
        {!saved ? (
          <button
            onClick={() => {
              const token = localStorage.getItem('token');
              if (!token || !workoutData.programme) return;
              fetch('/api/workouts/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ title: workoutData.title || 'Programme recu', rawText: JSON.stringify(workoutData.programme), programme: workoutData.programme, sharedBy: isMine ? undefined : 'ami' }),
              }).then(r => { if (r.ok) setSaved(true); }).catch(() => {});
            }}
            className={`mt-2 w-full py-2 rounded-lg text-xs font-bold transition ${isMine ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
          >
            Valider et sauvegarder
          </button>
        ) : (
          <p className="mt-2 text-xs text-emerald-600 font-semibold text-center py-2">Programme sauvegarde</p>
        )}
      </div>
    </div>
  );
}

type PollData = { question: string; options: string[]; votes: Record<string, number[]> };

function parseFeedContent(content: string): { kind: 'text' | 'image' | 'video' | 'poll'; mediaUrl: string | null; text: string; pollData?: PollData } {
  if (content.startsWith('__POLL__')) {
    try {
      const pollData = JSON.parse(content.slice(8)) as PollData;
      return { kind: 'poll', mediaUrl: null, text: pollData.question, pollData };
    } catch {
      return { kind: 'text', mediaUrl: null, text: content };
    }
  }
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

function parseChatContent(content: string): { kind: 'text' | 'image' | 'video' | 'workout_share'; mediaUrl: string | null; text: string; workoutData?: { title: string; programme: { jours?: { jour: string; focus: string; exercices: { nom: string; series: number; reps: string; repos: string }[] }[] } } } {
  if (content.startsWith('__WORKOUT_SHARE__')) {
    try {
      const jsonStr = content.slice('__WORKOUT_SHARE__'.length);
      const data = JSON.parse(jsonStr);
      return { kind: 'workout_share', mediaUrl: null, text: '', workoutData: data };
    } catch {
      return { kind: 'text', mediaUrl: null, text: content };
    }
  }
  return parseFeedContent(content) as { kind: 'text' | 'image' | 'video' | 'workout_share'; mediaUrl: string | null; text: string };
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

  // Poll state
  const [pollMode, setPollMode] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollPublishing, setPollPublishing] = useState(false);
  const [pollVotingId, setPollVotingId] = useState<string | null>(null);

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
  const [convSearch, setConvSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<SocialProfileCard[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [friendReqLoading, setFriendReqLoading] = useState<string | null>(null);
  const [friendReqSentIds, setFriendReqSentIds] = useState<Set<string>>(new Set());
  const [respondingReqId, setRespondingReqId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // @ mention autocomplete state
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<Array<{id: string; pseudo: string; profileImageUrl?: string | null}>>([]);
  const [mentionAnchorPos, setMentionAnchorPos] = useState<number | null>(null);

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

  // Spots state
  type SpotItem = { id: string; name: string; city: string | null; _count: { performances: number; regulars: number } };
  const [spots, setSpots] = useState<SpotItem[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);
  const [spotSearch, setSpotSearch] = useState('');
  const [spotFavorites, setSpotFavorites] = useState<Set<string>>(new Set());
  const [spotFavLoading, setSpotFavLoading] = useState<string | null>(null);

  // Add spot modal
  const [showAddSpot, setShowAddSpot] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotCity, setNewSpotCity] = useState('');
  const [newSpotPhotos, setNewSpotPhotos] = useState<string[]>([]);
  const [addSpotLoading, setAddSpotLoading] = useState(false);
  const [addSpotError, setAddSpotError] = useState('');
  const [addSpotSuccess, setAddSpotSuccess] = useState(false);

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
              profileImageUrl: typeof item.profileImageUrl === 'string' ? item.profileImageUrl : undefined,
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

  const sendFriendRequest = useCallback(async (pseudo: string, userId: string) => {
    setFriendReqLoading(userId);
    try {
      const res = await fetch('/api/friends/send', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ pseudo }),
      });
      if (res.ok) {
        setFriendReqSentIds((prev) => new Set([...prev, userId]));
        void loadAmis();
      }
    } catch {
      // silent
    }
    setFriendReqLoading(null);
  }, [loadAmis]);

  const respondToFriendRequest = useCallback(async (requestId: string, action: 'accept' | 'reject') => {
    setRespondingReqId(requestId);
    try {
      await fetch('/api/friends/respond', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ requestId, action }),
      });
      void loadAmis();
    } catch {
      // silent
    }
    setRespondingReqId(null);
  }, [loadAmis]);

  useEffect(() => {
    const q = convSearch.trim();
    if (q.length < 2) {
      setUserSearchResults([]);
      setUserSearchLoading(false);
      return;
    }
    setUserSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/social/users?query=${encodeURIComponent(q)}`, { headers: authHeader() });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setUserSearchResults(Array.isArray(data.users) ? data.users : []);
        else setUserSearchResults([]);
      } catch {
        setUserSearchResults([]);
      }
      setUserSearchLoading(false);
    }, 400);
    return () => { clearTimeout(timer); };
  }, [convSearch]);

  // Mention autocomplete fetch
  useEffect(() => {
    if (!mentionSearch || mentionSearch.length < 1) { setMentionSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/social/users?query=${encodeURIComponent(mentionSearch)}`, { headers: authHeader() });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setMentionSuggestions((Array.isArray(data.users) ? data.users : []).slice(0, 5));
        else setMentionSuggestions([]);
      } catch { setMentionSuggestions([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [mentionSearch]);

  const handleComposerChange = useCallback((text: string) => {
    const sliced = text.slice(0, 280);
    setComposer(sliced);
    const cursorPos = composerRef.current?.selectionStart ?? sliced.length;
    const before = sliced.slice(0, cursorPos);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0) {
      const query = before.slice(atIdx + 1);
      if (query.length >= 1 && !/\s/.test(query)) {
        setMentionSearch(query);
        setMentionAnchorPos(atIdx);
        return;
      }
    }
    setMentionSearch('');
    setMentionAnchorPos(null);
    setMentionSuggestions([]);
  }, []);

  const insertMention = useCallback((pseudo: string) => {
    if (mentionAnchorPos === null) return;
    const before = composer.slice(0, mentionAnchorPos);
    const cursorPos = composerRef.current?.selectionStart ?? (mentionAnchorPos + mentionSearch.length + 1);
    const after = composer.slice(cursorPos);
    const newText = `${before}@${pseudo} ${after}`.slice(0, 280);
    setComposer(newText);
    setMentionSearch('');
    setMentionAnchorPos(null);
    setMentionSuggestions([]);
    setTimeout(() => {
      const el = composerRef.current;
      if (el) { const pos = before.length + pseudo.length + 2; el.setSelectionRange(pos, pos); el.focus(); }
    }, 0);
  }, [composer, mentionAnchorPos, mentionSearch]);

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

  const loadSpots = useCallback(async (city: string = '') => {
    setSpotsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '10' });
      if (city.trim()) params.set('city', city.trim());
      const res = await fetch(`/api/performances/spots?${params.toString()}`, { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSpots(Array.isArray(data.spots) ? data.spots : []);
    } catch {
      // silent
    }
    setSpotsLoading(false);
  }, []);

  const loadSpotFavorites = useCallback(async () => {
    try {
      const res = await fetch('/api/performances/spots/favorites', { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.favoriteIds)) {
        setSpotFavorites(new Set<string>(data.favoriteIds));
      }
    } catch {
      // silent
    }
  }, []);

  const toggleSpotFavorite = async (spotId: string) => {
    if (spotFavLoading) return;
    setSpotFavLoading(spotId);
    const wasFav = spotFavorites.has(spotId);
    setSpotFavorites((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(spotId); else next.add(spotId);
      return next;
    });
    try {
      const res = await fetch('/api/performances/spots/favorites', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ spotId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSpotFavorites((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(spotId); else next.delete(spotId);
        return next;
      });
    }
    setSpotFavLoading(null);
  };

  const submitNewSpot = async () => {
    if (!newSpotName.trim() || addSpotLoading) return;
    setAddSpotLoading(true);
    setAddSpotError('');
    try {
      const res = await fetch('/api/performances/spots', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ name: newSpotName.trim(), city: newSpotCity.trim() || null, photoUrls: newSpotPhotos }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAddSpotSuccess(true);
        setNewSpotName('');
        setNewSpotCity('');
        setNewSpotPhotos([]);
        setTimeout(() => { setShowAddSpot(false); setAddSpotSuccess(false); }, 2000);
      } else {
        setAddSpotError(typeof data.error === 'string' ? data.error : 'Erreur lors de la soumission.');
      }
    } catch {
      setAddSpotError('Erreur réseau.');
    }
    setAddSpotLoading(false);
  };

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
    void loadSpots();
    void loadSpotFavorites();
  }, [loadFeed, loadConversations, loadAmis, loadPublicProfiles, loadCommunityPerformances, loadSpots, loadSpotFavorites]);

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

  const publishPoll = async () => {
    const cleanOptions = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || cleanOptions.length < 2) return;
    setPollPublishing(true);
    setComposerError('');
    try {
      const res = await fetch('/api/feed/poll', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ question: pollQuestion.trim(), options: cleanOptions }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.post) {
        setPosts((prev) => [data.post as FeedPost, ...prev]);
        setPollMode(false);
        setPollQuestion('');
        setPollOptions(['', '']);
        await loadFeed();
      } else {
        setComposerError(typeof data?.error === 'string' ? data.error : 'Erreur lors de la creation du sondage.');
      }
    } catch {
      setComposerError('Erreur reseau.');
    }
    setPollPublishing(false);
  };

  const votePoll = async (postId: string, optionIndex: number) => {
    setPollVotingId(postId);
    try {
      const res = await fetch('/api/feed/poll/vote', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ postId, optionIndex }),
      });
      if (res.ok) {
        await loadFeed();
      }
    } catch { /* silent */ }
    setPollVotingId(null);
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
      setComposerError('Format non supporté. Utilise mp4, webm ou mov.');
      e.target.value = '';
      return;
    }

    if (file.size > FEED_MAX_VIDEO_SIZE) {
      setComposerError('Vidéo trop volumineuse (max 200 MB).');
      e.target.value = '';
      return;
    }

    try {
      setUploadingVideo(true);
      setVideoProgress(5);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const { upload } = await import('@vercel/blob/client');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      // Direct upload to Vercel Blob \u2014 no server-side blocking compression
      const blob = await upload(
        `feed-videos/${Date.now()}-${safeName}`,
        file,
        {
          access: 'public',
          handleUploadUrl: '/api/feed/upload-video/client',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      setComposerVideoUrl(blob.url);
      setComposerImageUrl(null);
      setVideoProgress(100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setComposerError(msg || "Erreur lors de l'upload de la vidéo.");
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

      // 2. If video selected: zip → upload directly (no client-side compression which is unreliable)
      if (perfModalVideoFile && performanceId) {
        setPerfModalVideoProgress(0);
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
          setPerfModalVideoProgress(10);
          const zipped = await zipVideoFile(perfModalVideoFile, (pct) =>
            setPerfModalVideoProgress(10 + Math.round(pct * 0.4)),
          );
          setPerfModalVideoProgress(50);
          const { upload } = await import('@vercel/blob/client');
          const blob = await upload(
            `performances/${performanceId}/${Date.now()}-${zipped.name}`,
            zipped,
            {
              access: 'public',
              handleUploadUrl: '/api/performances/upload-video/client',
              clientPayload: performanceId,
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              onUploadProgress: ({ percentage }) => {
                setPerfModalVideoProgress(50 + Math.round((percentage ?? 0) * 0.5));
              },
            },
          );
          setPerfModalVideoProgress(100);
          // Explicitly persist the video URL in the DB from the client side
          try {
            await fetch('/api/performances/upload-video', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify({ performanceId, videoUrl: blob.url, videoStoragePath: blob.pathname }),
            });
          } catch {
            // PATCH failed — onUploadCompleted webhook is the fallback
          }
        } catch (err) {
          // Show error to user instead of silently ignoring
          const msg = err instanceof Error ? err.message : '';
          setPerfModalError(msg ? `Erreur vidéo : ${msg}` : 'Erreur lors de l\'upload vidéo. La performance a été enregistrée sans vidéo.');
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
              {/* Friend request banner */}
              {amis.filter((a) => a.statut === 'recu').length > 0 && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-sky-900">
                      {amis.filter((a) => a.statut === 'recu').length} demande{amis.filter((a) => a.statut === 'recu').length > 1 ? 's' : ''} d&apos;ami en attente
                    </p>
                    <p className="text-xs text-sky-700 mt-0.5">Ouvre l&apos;onglet Messagerie pour les accepter.</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('boite')}
                    className="shrink-0 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 transition"
                  >
                    Voir
                  </button>
                </div>
              )}

              {/* Composer */}
              <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">{pollMode ? 'Creer un sondage' : 'Quoi de neuf ?'}</h2>
                  <button
                    onClick={() => { setPollMode(!pollMode); setComposerError(''); }}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${pollMode ? 'bg-gray-200 text-gray-700' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'}`}
                  >
                    {pollMode ? 'Annuler' : 'Sondage'}
                  </button>
                </div>

                {pollMode ? (
                  <div className="space-y-3">
                    <input
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Pose ta question..."
                      className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 outline-none text-sm p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                    />
                    <div className="space-y-2">
                      {pollOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            value={opt}
                            onChange={(e) => {
                              const copy = [...pollOptions];
                              copy[i] = e.target.value;
                              setPollOptions(copy);
                            }}
                            placeholder={`Option ${i + 1}`}
                            className="flex-1 bg-gray-50 text-gray-900 placeholder:text-gray-400 outline-none text-sm p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
                          />
                          {pollOptions.length > 2 && (
                            <button
                              onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                              className="w-7 h-7 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center hover:bg-red-200 transition"
                            >✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                    {pollOptions.length < 6 && (
                      <button
                        onClick={() => setPollOptions([...pollOptions, ''])}
                        className="text-xs font-semibold text-violet-600 hover:text-violet-700 transition"
                      >+ Ajouter une option</button>
                    )}
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <p className="text-xs text-gray-400">{pollOptions.filter(o => o.trim()).length} option{pollOptions.filter(o => o.trim()).length > 1 ? 's' : ''}</p>
                      <button
                        onClick={() => void publishPoll()}
                        disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2 || pollPublishing}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold disabled:opacity-50 hover:shadow-lg transition-all"
                      >
                        {pollPublishing ? 'Publication...' : 'Publier le sondage'}
                      </button>
                    </div>
                    {composerError && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{composerError}</div>
                    )}
                  </div>
                ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      ref={composerRef}
                      value={composer}
                      onChange={(e) => handleComposerChange(e.target.value)}
                      placeholder="Partage tes bonnes vibes... tape @ pour mentionner quelqu'un"
                      rows={4}
                      className="w-full resize-none bg-gray-50 text-gray-900 placeholder:text-gray-400 outline-none text-sm sm:text-base p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
                    />
                    {mentionSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                        {mentionSuggestions.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); insertMention(user.pseudo); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-sky-50 text-left transition"
                          >
                            <UserAvatar src={user.profileImageUrl} name={user.pseudo} size="sm" />
                            <span className="text-sm font-semibold text-gray-900">@{user.pseudo}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                        {uploadingVideo ? 'Upload...' : 'Vidéo'}
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
                )}
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
                      <article key={post.id} className={`rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow ${post.pinned ? 'border-amber-300' : 'border-gray-200'}`}>
                        {post.pinned && (
                          <div className="bg-amber-50 border-b border-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-700">
                            Message epingle
                          </div>
                        )}
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
                              if (parsed.kind === 'poll' && parsed.pollData) {
                                const pd = parsed.pollData;
                                const allVotes = Object.values(pd.votes).flat();
                                const totalVotes = allVotes.length;
                                const myVotes = meId && pd.votes[meId] ? pd.votes[meId] : null;
                                const hasVoted = myVotes !== null;
                                const voteCounts = pd.options.map((_, oi) => allVotes.filter(v => v === oi).length);
                                return (
                                  <div className="space-y-3">
                                    <p className="font-bold text-gray-900">{pd.question}</p>
                                    <div className="space-y-2">
                                      {pd.options.map((opt, oi) => {
                                        const count = voteCounts[oi];
                                        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                        const isMyVote = hasVoted && myVotes?.includes(oi);
                                        if (hasVoted) {
                                          return (
                                            <div key={oi} className="relative rounded-xl border border-gray-200 overflow-hidden">
                                              <div className="absolute inset-0 bg-violet-100 transition-all" style={{ width: `${pct}%` }} />
                                              <div className="relative flex items-center justify-between px-4 py-2.5">
                                                <span className={`text-sm ${isMyVote ? 'font-bold text-violet-800' : 'text-gray-700'}`}>{opt}</span>
                                                <span className="text-xs font-semibold text-gray-500">{pct}%</span>
                                              </div>
                                            </div>
                                          );
                                        }
                                        return (
                                          <button
                                            key={oi}
                                            onClick={() => void votePoll(post.id, oi)}
                                            disabled={pollVotingId === post.id}
                                            className="w-full text-left rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:bg-violet-50 hover:border-violet-300 transition disabled:opacity-50"
                                          >
                                            {opt}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <p className="text-xs text-gray-400">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
                                  </div>
                                );
                              }
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
                    {/* Barre de recherche */}
                    <div className="relative mb-2">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input
                        value={convSearch}
                        onChange={(e) => setConvSearch(e.target.value)}
                        placeholder="Rechercher ou ajouter..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                      />
                    </div>
                    {conversations.length === 0 && !convSearch && (
                      <div className="p-4 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500">
                        Aucune conversation existante.
                      </div>
                    )}
                    {conversations.filter(conv => !convSearch.trim() || conv.pseudo.toLowerCase().includes(convSearch.toLowerCase())).map((conv) => (
                      <button
                        key={conv.friendId}
                        onClick={() => openConversation(conv.friendId)}
                        className={`w-full text-left p-3 rounded-xl border transition ${selectedConvFriendId === conv.friendId ? 'bg-sky-50 border-sky-300 shadow-md' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <UserAvatar src={conv.profileImageUrl} name={conv.pseudo} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">@{conv.pseudo}</p>
                            <p className="text-[11px] text-gray-500 truncate">{conv.dernier || 'Aucun message'}</p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-[11px] text-gray-400">{conv.heure}</p>
                            {conv.nonLu > 0 && <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-sky-500 text-white rounded-full">{conv.nonLu}</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                    {convSearch.trim() && conversations.filter(conv => conv.pseudo.toLowerCase().includes(convSearch.toLowerCase())).length === 0 && !userSearchLoading && userSearchResults.length === 0 && (
                      <div className="p-3 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 text-center">
                        Aucune conversation trouvée. Recherche d&apos;utilisateurs...
                      </div>
                    )}
                    {/* User search results */}
                    {convSearch.trim().length >= 2 && (
                      <div className="mt-1 space-y-1.5">
                        {userSearchLoading && (
                          <p className="px-2 text-xs text-gray-400">Recherche en cours...</p>
                        )}
                        {!userSearchLoading && userSearchResults.length > 0 && (
                          <>
                            <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Utilisateurs</p>
                            {userSearchResults.map((user) => {
                              const alreadyFriend = amis.some(
                                (a) => a.friendId === user.id && (a.statut === 'accepte' || a.statut === 'accepted'),
                              );
                              const pendingSent =
                                amis.some((a) => a.friendId === user.id && (a.statut === 'en_attente' || a.statut === 'pending')) ||
                                friendReqSentIds.has(user.id);
                              const pendingReceived = amis.some((a) => a.friendId === user.id && a.statut === 'recu');
                              return (
                                <div
                                  key={user.id}
                                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5"
                                >
                                  <UserAvatar src={user.profileImageUrl} name={user.pseudo} size="sm" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-gray-900">@{user.pseudo}</p>
                                    <p className="truncate text-[11px] text-gray-400">{user.level} · {user.xp} XP</p>
                                  </div>
                                  {alreadyFriend ? (
                                    <button
                                      onClick={() => openConversation(user.id)}
                                      className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-200"
                                    >
                                      Message
                                    </button>
                                  ) : pendingReceived ? (
                                    <button
                                      onClick={() => {
                                        const req = amis.find((a) => a.friendId === user.id && a.statut === 'recu');
                                        if (req) void respondToFriendRequest(req.id, 'accept');
                                      }}
                                      disabled={respondingReqId !== null}
                                      className="rounded-lg bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-50"
                                    >
                                      Accepter
                                    </button>
                                  ) : pendingSent ? (
                                    <span className="text-[11px] text-gray-400">Demande envoyée</span>
                                  ) : (
                                    <button
                                      onClick={() => void sendFriendRequest(user.pseudo, user.id)}
                                      disabled={friendReqLoading === user.id}
                                      className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-200 disabled:opacity-50"
                                    >
                                      {friendReqLoading === user.id ? '...' : 'Ajouter'}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`h-[540px] sm:h-[640px] overflow-hidden rounded-[28px] border border-slate-200 bg-white ${mobileMsgView === 'list' ? 'hidden xl:flex' : 'flex'} flex-col`}> 
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

                        <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4 space-y-2">
                          {chatLoading ? (
                            <p className="text-sm text-gray-500">Chargement des messages...</p>
                          ) : chat.length === 0 ? (
                            <p className="text-sm text-gray-500">Aucun message pour le moment.</p>
                          ) : (
                            chat.map((m) => (
                              <div key={m.id} className={`max-w-[85%] ${m.from === 'me' ? 'ml-auto' : 'mr-auto'}`}>
                                {(() => {
                                  const parsed = parseChatContent(m.text);

                                  // Workout share card
                                  if (parsed.kind === 'workout_share' && parsed.workoutData) {
                                    return (
                                      <WorkoutShareCard workoutData={parsed.workoutData} isMine={m.from === 'me'} />
                                    );
                                  }

                                  return (
                                    <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words break-all ${m.from === 'me' ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                                      {parsed.kind === 'image' && parsed.mediaUrl ? (
                                        <img
                                          src={parsed.mediaUrl}
                                          alt="Image message"
                                          className="mb-2 max-h-64 w-full rounded-xl object-cover"
                                        />
                                      ) : null}
                                      {parsed.kind === 'video' && parsed.mediaUrl ? (
                                        <video
                                          controls
                                          preload="metadata"
                                          src={parsed.mediaUrl}
                                          className="mb-2 max-h-64 w-full rounded-xl"
                                        />
                                      ) : null}
                                      {parsed.text ? parsed.text : parsed.kind !== 'text' ? ' ' : m.text}
                                    </div>
                                  );
                                })()}
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
                          <div className="flex items-end gap-2">
                            <textarea
                              value={msgInput}
                              onChange={(e) => setMsgInput(e.target.value)}
                              placeholder="Message..."
                              rows={3}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  void sendMessage();
                                }
                              }}
                              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
                            />
                            <button
                              onClick={() => void sendMessage()}
                              disabled={sendingMsg || chatLoading || !msgInput.trim()}
                              className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold disabled:opacity-50 flex-shrink-0"
                            >
                              {sendingMsg ? '...' : 'Envoyer'}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="grid gap-4 content-start">
                    {/* Demandes reçues */}
                    {amis.filter((a) => a.statut === 'recu').length > 0 && (
                      <div className="rounded-[28px] border border-sky-200 bg-sky-50 p-4">
                        <h3 className="text-sm font-black text-sky-900">
                          Demandes reçues{' '}
                          <span className="ml-1 rounded-full bg-sky-500 px-2 py-0.5 text-[11px] font-bold text-white">
                            {amis.filter((a) => a.statut === 'recu').length}
                          </span>
                        </h3>
                        <div className="mt-3 space-y-2">
                          {amis
                            .filter((a) => a.statut === 'recu')
                            .map((req) => (
                              <div key={req.id} className="rounded-xl border border-sky-100 bg-white p-3">
                                <div className="flex items-center gap-3 mb-2">
                                  <UserAvatar src={req.profileImageUrl} name={req.pseudo} size="sm" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-gray-900">@{req.pseudo}</p>
                                    <p className="truncate text-xs text-gray-500">{req.nom}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => void respondToFriendRequest(req.id, 'accept')}
                                    disabled={respondingReqId === req.id}
                                    className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                                  >
                                    {respondingReqId === req.id ? '...' : 'Accepter'}
                                  </button>
                                  <button
                                    onClick={() => void respondToFriendRequest(req.id, 'reject')}
                                    disabled={respondingReqId === req.id}
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    Refuser
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

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

              {/* Spots Section */}
              <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-black text-gray-900">Streets &amp; Spots</h3>
                    <p className="text-sm text-gray-500">Trouve un spot près de chez toi ou ajoute le tien.</p>
                  </div>
                  <button
                    onClick={() => { setShowAddSpot(true); setAddSpotError(''); setAddSpotSuccess(false); }}
                    className="shrink-0 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-2 transition"
                  >
                    + Ajouter
                  </button>
                </div>

                {/* City Search */}
                <div className="relative mb-3">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Rechercher par ville..."
                    value={spotSearch}
                    onChange={(e) => {
                      setSpotSearch(e.target.value);
                      void loadSpots(e.target.value);
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                {/* Spots List with internal scroll */}
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {spotsLoading ? (
                    <div className="py-6 text-center text-sm text-gray-400">Chargement...</div>
                  ) : spots.length === 0 ? (
                    <div className="py-6 text-center text-sm text-gray-400">
                      {spotSearch.trim() ? `Aucun spot trouvé pour "${spotSearch}".` : 'Aucun spot approuvé pour l\'instant.'}
                    </div>
                  ) : (
                    spots.map((spot) => (
                      <div key={spot.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{spot.name}</p>
                          <p className="text-xs text-gray-500">{spot.city ?? 'Ville inconnue'} · {spot._count.performances} perf. · {spot._count.regulars} régulier{spot._count.regulars > 1 ? 's' : ''}</p>
                        </div>
                        <button
                          onClick={() => void toggleSpotFavorite(spot.id)}
                          disabled={spotFavLoading === spot.id}
                          aria-label={spotFavorites.has(spot.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          className={`shrink-0 p-2 rounded-xl transition ${spotFavorites.has(spot.id) ? 'text-amber-500 hover:text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill={spotFavorites.has(spot.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {spots.length >= 10 && (
                  <p className="mt-2 text-xs text-center text-gray-400">10 résultats max — affinez la recherche par ville</p>
                )}
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
                            <LevelBadge xp={performance.author.xp} size="sm" />{performance.author.verified ? <span className="text-xs text-sky-600 font-bold"> verifie</span> : null}
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${performance.status === 'validated' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {performance.status === 'validated' ? 'validee' : 'a verifier'}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-sm text-gray-700">{performance.exercise} · <span className="font-black text-gray-900">{performance.score} {performance.unit}</span></p>
                          {performance.spot && (
                            <p className="text-xs text-gray-500">{performance.spot.name}{performance.spot.city ? `, ${performance.spot.city}` : ''}</p>
                          )}
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

      {/* Add Spot Modal */}
      {showAddSpot && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">Proposer un spot</h2>
                <p className="text-xs text-gray-500 mt-0.5">Soumis à validation avant publication.</p>
              </div>
              <button onClick={() => setShowAddSpot(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {addSpotSuccess ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center text-sm font-semibold text-emerald-700">
                Spot soumis avec succès ! Il sera visible après validation.
              </div>
            ) : (
              <>
                {addSpotError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{addSpotError}</div>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nom du spot *</label>
                  <input
                    type="text"
                    value={newSpotName}
                    onChange={(e) => setNewSpotName(e.target.value)}
                    placeholder="ex: Parc des Buttes-Chaumont"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Ville</label>
                  <input
                    type="text"
                    value={newSpotCity}
                    onChange={(e) => setNewSpotCity(e.target.value)}
                    placeholder="ex: Paris"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Photos du spot (optionnel)</label>
                  <label className="flex items-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 transition">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-gray-500">Ajouter des photos ({newSpotPhotos.length}/3)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={newSpotPhotos.length >= 3}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []).slice(0, 3 - newSpotPhotos.length);
                        for (const file of files) {
                          const fd = new FormData();
                          fd.append('image', file);
                          try {
                            const res = await fetch('/api/upload-image', { method: 'POST', headers: authHeader(), body: fd });
                            const d = await res.json().catch(() => ({}));
                            if (res.ok && d.imageUrl) setNewSpotPhotos((prev) => [...prev, d.imageUrl as string].slice(0, 3));
                          } catch { /* silent */ }
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {newSpotPhotos.length > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {newSpotPhotos.map((url, i) => (
                        <div key={i} className="relative">
                          <img src={url} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                          <button
                            onClick={() => setNewSpotPhotos((prev) => prev.filter((_, j) => j !== i))}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => void submitNewSpot()}
                  disabled={addSpotLoading || !newSpotName.trim()}
                  className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3 text-sm transition"
                >
                  {addSpotLoading ? 'Envoi...' : 'Proposer ce spot'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

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

