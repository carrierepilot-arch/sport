'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { upload } from '@vercel/blob/client';

type Tab = 'amis' | 'messages' | 'performances';

interface AmiItem {
 id: string;
 friendId: string;
 pseudo: string;
 nom: string;
 statut: 'accepte' | 'en_attente' | 'recu';
}
interface ChatMessage { id: string; from: 'me' | 'them'; text: string; heure: string }
interface Conversation { friendId: string; pseudo: string; nom: string; dernier: string; heure: string; nonLu: number }
interface WorkoutShareData { title: string; programme: { jours: { jour: string; focus: string; exercices: { nom: string; series: number; reps: string }[] }[] } }
type DuelInvitePayload = { duelId: string; exercise: string; score: number; inviterId: string };
type DuelAcceptedPayload = { duelId: string; inviteeId: string };
interface GroupMember { id: string; pseudo: string | null; name: string | null }
interface GroupData {
 id: string;
 name: string;
 ownerId: string;
 createdAt: string;
 owner: { id: string; pseudo: string | null; name: string | null };
 members: { id: string; userId: string; user: GroupMember }[];
}
interface GroupMsg {
 id: string;
 userId: string;
 content: string;
 createdAt: string;
 user: { id: string; pseudo: string | null; name: string | null };
}
interface SpotData {
 id: string;
 name: string;
 city: string | null;
 _count: { performances: number };
}
interface PerfData {
 id: string;
 userId: string;
 exercise: string;
 score: number;
 unit: string;
 status: string;
 videoUrl: string | null;
 createdAt: string;
 user: { id: string; pseudo: string | null; name: string | null };
 validations: { validatorId: string; status: string }[];
}
interface PerfValidReq {
 id: string;
 performanceId: string;
 status: string;
 performance: {
 id: string; exercise: string; score: number; unit: string;
 user: { id: string; pseudo: string | null; name: string | null };
 spot: { id: string; name: string };
 };
}
const PERF_EXERCISES = [
 { key: 'tractions', label: 'Tractions', unit: 'reps', categorie: 'Endurance' },
 { key: 'pompes', label: 'Pompes', unit: 'reps', categorie: 'Endurance' },
 { key: 'dips', label: 'Dips', unit: 'reps', categorie: 'Endurance' },
 { key: 'squats', label: 'Squats', unit: 'reps', categorie: 'Endurance' },
 { key: 'tractions_lestees', label: 'Tractions lestées', unit: 'kg', categorie: 'Force' },
 { key: 'dips_lestes', label: 'Dips lestés', unit: 'kg', categorie: 'Force' },
] as const;

const MAX_VIDEO_SIZE = 80 * 1024 * 1024; // 80 MB
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

function authHeader(): HeadersInit {
 const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
 return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function parsePrefixedJson<T>(text: string, prefix: string): T | null {
 if (!text.startsWith(prefix)) return null;
 try {
 return JSON.parse(text.slice(prefix.length)) as T;
 } catch {
 return null;
 }
}

function isZipProofUrl(url: string | null | undefined): boolean {
 return !!url && /\.zip($|\?)/i.test(url);
}

function Avatar({ letter, actif }: { letter: string; actif?: boolean }) {
 const palette = ['bg-rose-500','bg-orange-500','bg-amber-500','bg-emerald-500','bg-teal-500','bg-sky-500','bg-blue-500','bg-violet-500','bg-pink-500','bg-red-500','bg-green-500','bg-indigo-500'];
 const bg = palette[letter.toUpperCase().charCodeAt(0) % palette.length];
 return (
 <div className="relative flex-shrink-0">
 <div className={`w-9 h-9 ${bg} rounded-full flex items-center justify-center text-sm font-semibold text-white`}>
 {letter.toUpperCase()}
 </div>
 {actif && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />}
 </div>
 );
}

// ─── Client-side video compression ────────────────────────────────────────────
async function compressVideo(
 file: File,
 onProgress: (pct: number) => void,
): Promise<File> {
 // Skip tiny files — not worth the overhead
 const SKIP_THRESHOLD = 8 * 1024 * 1024; // 8 MB
 if (file.size < SKIP_THRESHOLD) return file;

 if (typeof MediaRecorder === 'undefined' || typeof HTMLVideoElement === 'undefined') {
 return file; // Fallback: unsupported browser
 }

 const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
 ? 'video/webm;codecs=vp8,opus'
 : MediaRecorder.isTypeSupported('video/webm')
 ? 'video/webm'
 : null;

 if (!mimeType) return file; // Fallback: encoder not available

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
 const recorder = new MediaRecorder(stream, {
 mimeType,
 videoBitsPerSecond: 800_000,
 });

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
 if (video.paused || video.ended) {
 recorder.stop();
 return;
 }
 ctx.drawImage(video, 0, 0, w, h);
 if (duration > 0) onProgress(Math.round((video.currentTime / duration) * 100));
 requestAnimationFrame(drawFrame);
 };

 recorder.start();
 video.play().then(() => requestAnimationFrame(drawFrame)).catch(() => {
 recorder.stop();
 URL.revokeObjectURL(objectUrl);
 document.body.removeChild(video);
 resolve(file); // Fallback on play error
 });
 };

 video.onerror = () => {
 URL.revokeObjectURL(objectUrl);
 document.body.removeChild(video);
 resolve(file); // Fallback on video error
 };
 });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReseauPage() {
 const [tab, setTab] = useState<Tab>(() => {
 if (typeof window !== 'undefined') {
 const saved = localStorage.getItem('reseau_tab');
 if (saved && ['amis', 'messages', 'performances'].includes(saved)) return saved as Tab;
 if (saved === 'groupes') return 'messages';
 }
 return 'amis';
 });
 const [recherche, setRecherche] = useState('');
 const [amis, setAmis] = useState<AmiItem[]>([]);
 const [nomGroupe, setNomGroupe] = useState('');
 const [convActive, setConvActive] = useState<string | null>(null);
 const [msgInput, setMsgInput] = useState('');
 const [conversations, setConversations] = useState<Conversation[]>([]);
 const [chat, setChat] = useState<ChatMessage[]>([]);
 const [loading, setLoading] = useState(false);
 const [erreur, setErreur] = useState('');
 const [notif, setNotif] = useState('');
 const [acceptedShares, setAcceptedShares] = useState<Set<string>>(new Set());
 const [acceptedDuelInvites, setAcceptedDuelInvites] = useState<Set<string>>(new Set());
 const [acceptingDuelId, setAcceptingDuelId] = useState<string | null>(null);
 const [expandedShares, setExpandedShares] = useState<Set<string>>(new Set());
 const [mesGroupes, setMesGroupes] = useState<GroupData[]>([]);
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);
 const [groupeActif, setGroupeActif] = useState<string | null>(null);
 const [addMemberSearch, setAddMemberSearch] = useState('');
 const [groupesErreur, setGroupesErreur] = useState('');
 // ── Group chat state ──
 const [groupMsgs, setGroupMsgs] = useState<GroupMsg[]>([]);
 const [groupChatInput, setGroupChatInput] = useState('');
 const [groupChatUserId, setGroupChatUserId] = useState<string | null>(null);
 const groupChatEndRef = useRef<HTMLDivElement>(null);
 // ── Performance state ──
 const [spots, setSpots] = useState<SpotData[]>([]);
 const [spotSearch, setSpotSearch] = useState('');
 const [favoriteSpotIds, setFavoriteSpotIds] = useState<Set<string>>(new Set());
 const [spotActif, setSpotActif] = useState<string | null>(null);
 const [performances, setPerformances] = useState<PerfData[]>([]);
 const [perfUserId, setPerfUserId] = useState<string | null>(null);
 const [showAddPerf, setShowAddPerf] = useState(false);
 const [perfExercise, setPerfExercise] = useState('tractions');
 const [perfScore, setPerfScore] = useState('');
 const [perfSubmitting, setPerfSubmitting] = useState(false);
 const [showAddSpot, setShowAddSpot] = useState(false);
 const [newSpotName, setNewSpotName] = useState('');
 const [newSpotCity, setNewSpotCity] = useState('');
 const [spotSubmitting, setSpotSubmitting] = useState(false);
 // Validation request state
 const [perfReqOpen, setPerfReqOpen] = useState<string | null>(null);
 const [perfReqSelected, setPerfReqSelected] = useState<Set<string>>(new Set());
 const [sendingValReq, setSendingValReq] = useState(false);
 const [valRequestsIn, setValRequestsIn] = useState<PerfValidReq[]>([]);
 const [perfVideoFile, setPerfVideoFile] = useState<File | null>(null);
 const [videoUploading, setVideoUploading] = useState<string | null>(null);
 const [compressProgress, setCompressProgress] = useState<number | null>(null);
 const [mobileMsgView, setMobileMsgView] = useState<'list' | 'chat'>('list');
 const [convType, setConvType] = useState<'dm' | 'group'>('dm');
 const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
 const [activeGroupMsgs, setActiveGroupMsgs] = useState<GroupMsg[]>([]);
 const [activeGroupInput, setActiveGroupInput] = useState('');
 const [showGroupInfo, setShowGroupInfo] = useState(false);
 const [showCreateGroup, setShowCreateGroup] = useState(false);
 const messagesEndRef = useRef<HTMLDivElement>(null);
 const prevChatLenRef = useRef(0);

 const chargerAmis = useCallback(async () => {
 try {
 const res = await fetch('/api/friends/list', { headers: authHeader() });
 if (!res.ok) return;
 const data = await res.json();
 const tous: AmiItem[] = [...data.amis, ...data.recus, ...data.enAttente];
 setAmis(tous);
 } catch { /* silencieux */ }
 }, []);

 const chargerConversations = useCallback(async () => {
 try {
 const res = await fetch('/api/messages/conversations', { headers: authHeader() });
 if (!res.ok) return;
 const data = await res.json();
 setConversations(data.conversations ?? []);
 } catch { /* silencieux */ }
 }, []);

 const chargerMessages = useCallback(async (friendId: string) => {
 try {
 const res = await fetch(`/api/messages/${friendId}`, { headers: authHeader() });
 if (!res.ok) return;
 const data = await res.json();
 setChat(data.messages ?? []);
 } catch { /* silencieux */ }
 }, []);

 const chargerGroupes = useCallback(async () => {
 try {
 const res = await fetch('/api/groups', { headers: authHeader() });
 const data = await res.json();
 if (!res.ok) {
 setGroupesErreur(data.error ?? 'Erreur de chargement des groupes');
 return;
 }
 setGroupesErreur('');
 setMesGroupes(data.groups ?? []);
 if (data.currentUserId) setCurrentUserId(data.currentUserId);
 } catch { setGroupesErreur('Erreur réseau lors du chargement des groupes'); }
 }, []);

 const chargerGroupMessages = useCallback(async (groupId: string) => {
 try {
 const res = await fetch(`/api/groups/messages?groupId=${groupId}`, { headers: authHeader() });
 if (!res.ok) return;
 const data = await res.json();
 setGroupMsgs(data.messages ?? []);
 if (data.currentUserId) setGroupChatUserId(data.currentUserId);
 } catch { /* silencieux */ }
 }, []);

 const envoyerGroupMessage = async (groupId: string) => {
 if (!groupChatInput.trim()) return;
 const texte = groupChatInput.trim();
 setGroupChatInput('');
 try {
 const res = await fetch('/api/groups/messages', {
 method: 'POST', headers: authHeader(),
 body: JSON.stringify({ groupId, content: texte }),
 });
 if (res.ok) await chargerGroupMessages(groupId);
 } catch { /* silencieux */ }
 };

 const chargerSpots = useCallback(async () => {
 try {
 const res = await fetch('/api/performances/spots', { headers: authHeader() });
 if (!res.ok) return;
 const data = await res.json();
 setSpots(data.spots ?? []);
 } catch { /* silencieux */ }
 }, []);

 const chargerFavorisSpots = useCallback(async () => {
 try {
 const res = await fetch('/api/performances/spots/favorites', { headers: authHeader() });
 if (!res.ok) return;
 const data = await res.json();
 setFavoriteSpotIds(new Set(data.favorites ?? []));
 } catch {
 // silent
 }
 }, []);

 const toggleSpotFavori = async (spotId: string) => {
 // Optimistic update
 const prev = new Set(favoriteSpotIds);
 setFavoriteSpotIds((old) => {
 const next = new Set(old);
 if (next.has(spotId)) next.delete(spotId); else next.add(spotId);
 return next;
 });
 try {
 const res = await fetch('/api/performances/spots/favorites', {
 method: 'POST',
 headers: authHeader(),
 body: JSON.stringify({ spotId }),
 });
 if (!res.ok) { setFavoriteSpotIds(prev); setNotif('Erreur: impossible de modifier le favori'); setTimeout(() => setNotif(''), 3000); return; }
 const data = await res.json();
 setFavoriteSpotIds((old) => {
 const next = new Set(old);
 if (data.isFavorite) next.add(spotId); else next.delete(spotId);
 return next;
 });
 } catch {
 setFavoriteSpotIds(prev);
 setNotif('Erreur réseau');
 setTimeout(() => setNotif(''), 3000);
 }
 };

 const reportTarget = async (payload: {
 targetType: 'user' | 'message' | 'group' | 'performance';
 targetId: string;
 userId?: string;
 senderId?: string;
 ownerId?: string;
 reason?: string;
 }) => {
 try {
 const res = await fetch('/api/reports', {
 method: 'POST',
 headers: authHeader(),
 body: JSON.stringify(payload),
 });
 if (res.ok) {
 setNotif('Signalement envoyé. Merci pour votre vigilance.');
 setTimeout(() => setNotif(''), 3000);
 }
 } catch {
 // silent
 }
 };

 const submitNewSpot = async () => {
 if (!newSpotName.trim() || spotSubmitting) return;
 setSpotSubmitting(true);
 try {
 const res = await fetch('/api/performances/spots', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', ...authHeader() },
 body: JSON.stringify({ name: newSpotName.trim(), city: newSpotCity.trim() || null }),
 });
 if (res.ok) {
 setNewSpotName(''); setNewSpotCity(''); setShowAddSpot(false);
 setNotif('Spot soumis ! Il sera visible après validation admin.');
 setTimeout(() => setNotif(''), 4000);
 }
 } catch { setErreur('Erreur lors de la soumission'); }
 setSpotSubmitting(false);
 };

 const chargerPerformances = useCallback(async (spotId: string) => {
 try {
 const res = await fetch(`/api/performances?spotId=${spotId}`, { headers: authHeader() });
 if (!res.ok) return;
 const data = await res.json();
 setPerformances(data.performances ?? []);
 if (data.currentUserId) setPerfUserId(data.currentUserId);
 } catch { /* silencieux */ }
 }, []);

 const ajouterPerformance = async () => {
 if (!spotActif || !perfScore) return;
 setPerfSubmitting(true);
 try {
 const res = await fetch('/api/performances', {
 method: 'POST', headers: authHeader(),
 body: JSON.stringify({ spotId: spotActif, exercise: perfExercise, score: parseFloat(perfScore) }),
 });
 if (res.ok) {
 const { performance } = await res.json();
 // Upload video if selected
 if (perfVideoFile && performance?.id) {
 await uploadVideoForPerf(performance.id, perfVideoFile);
 }
 setPerfScore(''); setPerfVideoFile(null); setShowAddPerf(false);
 await chargerPerformances(spotActif);
 await chargerSpots();
 }
 } catch {
 alert('Erreur lors de l\'ajout de la performance');
 }
 setPerfSubmitting(false);
 };

 const validerPerformance = async (perfId: string) => {
 try {
 const res = await fetch('/api/performances/validate', {
 method: 'POST', headers: authHeader(),
 body: JSON.stringify({ performanceId: perfId }),
 });
 if (res.ok && spotActif) await chargerPerformances(spotActif);
 } catch { /* silencieux */ }
 };

 const uploadVideoForPerf = async (perfId: string, file: File) => {
 if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
 alert('Format non supporte (mp4, webm, mov)');
 return;
 }
 if (file.size > MAX_VIDEO_SIZE) {
 alert('Video trop volumineuse (max 80 MB)');
 return;
 }

 setVideoUploading(perfId);
 try {
 const token = localStorage.getItem('token');
 if (!token) {
 alert('Session expiree, reconnectez-vous.');
 return;
 }
 // Compress client-side before upload (skip if < 8 MB)
 setCompressProgress(0);
 const fileToUpload = await compressVideo(file, setCompressProgress);
 setCompressProgress(null);

 // Direct browser → Vercel Blob upload (bypasses 4.5 MB serverless body limit)
 await upload(
 `performances/${perfId}/${Date.now()}-${fileToUpload.name || 'video.mp4'}`,
 fileToUpload,
 {
 access: 'public',
 handleUploadUrl: '/api/performances/upload-video/client',
 clientPayload: perfId,
 headers: { Authorization: `Bearer ${token}` },
 },
 );

 if (spotActif) {
 await chargerPerformances(spotActif);
 }
 } catch (err) {
 const msg = err instanceof Error ? err.message : String(err);
 alert(msg || 'Erreur réseau lors de l\'upload');
 }
 setCompressProgress(null);
 setVideoUploading(null);
 };

 const chargerValRequests = useCallback(async () => {
 try {
 const res = await fetch('/api/performances/validate', { headers: authHeader() });
 if (!res.ok) return;
 const data = await res.json();
 setValRequestsIn(data.requests ?? []);
 } catch { /* silencieux */ }
 }, []);

 const envoyerValRequest = async (performanceId: string) => {
 const validatorIds = Array.from(perfReqSelected);
 if (!validatorIds.length) return;
 setSendingValReq(true);
 try {
 const res = await fetch('/api/performances/validate', {
 method: 'POST', headers: authHeader(),
 body: JSON.stringify({ action: 'request', performanceId, validatorIds }),
 });
 if (res.ok) { setPerfReqOpen(null); setPerfReqSelected(new Set()); }
 } catch { /* silencieux */ }
 setSendingValReq(false);
 };

 const repondreValidation = async (performanceId: string, isValid: boolean) => {
 try {
 const res = await fetch('/api/performances/validate', {
 method: 'POST', headers: authHeader(),
 body: JSON.stringify({ action: 'respond', performanceId, isValid }),
 });
 if (res.ok) {
 setValRequestsIn((prev) => prev.filter((r) => r.performanceId !== performanceId));
 if (spotActif) await chargerPerformances(spotActif);
 }
 } catch { /* silencieux */ }
 };

 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(() => { if (tab === 'performances') { chargerSpots(); chargerFavorisSpots(); chargerValRequests(); } }, [tab, chargerSpots, chargerFavorisSpots, chargerValRequests]);
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(() => { if (spotActif) chargerPerformances(spotActif); }, [spotActif, chargerPerformances]);

 // Reload group chat when active group changes
 /* eslint-disable react-hooks/set-state-in-effect */
 useEffect(() => {
 if (groupeActif) { chargerGroupMessages(groupeActif); }
 else { setGroupMsgs([]); }
 }, [groupeActif, chargerGroupMessages]);
 /* eslint-enable react-hooks/set-state-in-effect */

 // Polling group chat every 4s when a group is open
 useEffect(() => {
 if (!groupeActif) return;
 const interval = setInterval(() => chargerGroupMessages(groupeActif), 4000);
 return () => clearInterval(interval);
 }, [groupeActif, chargerGroupMessages]);

 // Scroll group chat to bottom (inside container only, not full page)
 const groupChatContainerRef = useRef<HTMLDivElement>(null);
 const prevGroupMsgsLenRef = useRef(0);
 useEffect(() => {
 if (groupChatContainerRef.current && groupMsgs.length > prevGroupMsgsLenRef.current) {
 groupChatContainerRef.current.scrollTop = groupChatContainerRef.current.scrollHeight;
 }
 prevGroupMsgsLenRef.current = groupMsgs.length;
 }, [groupMsgs]);

 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(() => { chargerAmis(); chargerConversations(); chargerGroupes(); }, [chargerAmis, chargerConversations, chargerGroupes]);
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(() => { if (convActive) chargerMessages(convActive); }, [convActive, chargerMessages]);

 // Polling messages toutes les 4 secondes (quand une conversation est ouverte)
 useEffect(() => {
 if (!convActive) return;
 const interval = setInterval(() => { chargerMessages(convActive); chargerConversations(); }, 4000);
 return () => clearInterval(interval);
 }, [convActive, chargerMessages, chargerConversations]);

 // Polling conversations toutes les 5 secondes même sans conversation active
 // (pour recevoir les nouveaux messages sans avoir à cliquer)
 useEffect(() => {
 if (convActive) return; // Already handled by the above effect
 const interval = setInterval(() => chargerConversations(), 5000);
 return () => clearInterval(interval);
 }, [convActive, chargerConversations]);

 // Polling demandes d'amis toutes les 8 secondes
 useEffect(() => {
 const interval = setInterval(() => chargerAmis(), 8000);
 return () => clearInterval(interval);
 }, [chargerAmis]);

 useEffect(() => {
 // Only auto-scroll when new messages arrive (not on every poll)
 if (chat.length > prevChatLenRef.current) {
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }
 prevChatLenRef.current = chat.length;
 }, [chat]);

 const envoyerDemande = async () => {
 if (!recherche.trim()) return;
 setLoading(true); setErreur('');
 try {
 const res = await fetch('/api/friends/send', {
 method: 'POST', headers: authHeader(),
 body: JSON.stringify({ pseudo: recherche.trim() }),
 });
 const data = await res.json();
 if (!res.ok) { setErreur(data.error ?? 'Erreur'); }
 else { setNotif('Demande envoyée !'); setRecherche(''); chargerAmis(); setTimeout(() => setNotif(''), 3000); }
 } catch { setErreur('Erreur réseau'); }
 setLoading(false);
 };

 const repondreDemande = async (requestId: string, action: 'accept' | 'reject') => {
 try {
 await fetch('/api/friends/respond', {
 method: 'POST', headers: authHeader(),
 body: JSON.stringify({ requestId, action }),
 });
 chargerAmis();
 if (action === 'accept') chargerConversations();
 } catch { /* silencieux */ }
 };

 const ouvrirConversation = (friendId: string) => { setConvType('dm'); setActiveGroupId(null); setConvActive(friendId); setMobileMsgView('chat'); setTab('messages'); localStorage.setItem('reseau_tab', 'messages'); };

 const envoyerMessage = async () => {
 if (!msgInput.trim() || !convActive) return;
 const texte = msgInput.trim();
 setMsgInput('');
 try {
 const res = await fetch('/api/messages/send', {
 method: 'POST', headers: authHeader(),
 body: JSON.stringify({ receiverId: convActive, content: texte }),
 });
 const data = await res.json();
 if (res.ok && data.message) { setChat((prev) => [...prev, data.message]); chargerConversations(); }
 } catch { /* silencieux */ }
 };

 const convEnCours = conversations.find((c) => c.friendId === convActive);
 const activeGroup = mesGroupes.find((g) => g.id === activeGroupId);

 const ouvrirGroupeChat = (groupId: string) => {
 setConvType('group');
 setActiveGroupId(groupId);
 setConvActive(null);
 setMobileMsgView('chat');
 setTab('messages');
 localStorage.setItem('reseau_tab', 'messages');
 chargerGroupMessages(groupId).then((data) => {/* loaded via effect */});
 };

 // Load group messages when activeGroupId changes (for unified chat)
 /* eslint-disable react-hooks/set-state-in-effect */
 useEffect(() => {
 if (!activeGroupId) { setActiveGroupMsgs([]); return; }
 const load = async () => {
 try {
 const res = await fetch(`/api/groups/messages?groupId=${activeGroupId}`, { headers: authHeader() });
 if (!res.ok) return;
 const data = await res.json();
 setActiveGroupMsgs(data.messages ?? []);
 if (data.currentUserId) setGroupChatUserId(data.currentUserId);
 } catch {/* */}
 };
 load();
 const interval = setInterval(load, 4000);
 return () => clearInterval(interval);
 }, [activeGroupId]);
 /* eslint-enable react-hooks/set-state-in-effect */

 const envoyerActiveGroupMsg = async () => {
 if (!activeGroupInput.trim() || !activeGroupId) return;
 const texte = activeGroupInput.trim();
 setActiveGroupInput('');
 try {
 const res = await fetch('/api/groups/messages', {
 method: 'POST', headers: authHeader(),
 body: JSON.stringify({ groupId: activeGroupId, content: texte }),
 });
 if (res.ok) {
 const r2 = await fetch(`/api/groups/messages?groupId=${activeGroupId}`, { headers: authHeader() });
 if (r2.ok) { const d = await r2.json(); setActiveGroupMsgs(d.messages ?? []); }
 }
 } catch {/* */}
 };

 const creerGroupe = async () => {
 if (!nomGroupe.trim()) return;
 try {
 const res = await fetch('/api/groups', {
 method: 'POST', headers: authHeader(),
 body: JSON.stringify({ name: nomGroupe.trim() }),
 });
 if (res.ok) {
 setNomGroupe('');
 setNotif('Groupe créé !');
 setTimeout(() => setNotif(''), 3000);
 await chargerGroupes();
 } else {
 const data = await res.json();
 setErreur(data.error ?? 'Erreur');
 }
 } catch { setErreur('Erreur réseau'); }
 };

 const supprimerGroupe = async (groupId: string) => {
 try {
 await fetch('/api/groups', {
 method: 'DELETE', headers: authHeader(),
 body: JSON.stringify({ groupId }),
 });
 if (groupeActif === groupId) setGroupeActif(null);
 await chargerGroupes();
 } catch { /* silencieux */ }
 };

 const ajouterMembre = async (groupId: string, userId: string) => {
 try {
 const res = await fetch('/api/groups/members', {
 method: 'POST', headers: authHeader(),
 body: JSON.stringify({ groupId, userId }),
 });
 const data = await res.json();
 if (res.ok) {
 setNotif('Membre ajouté !');
 setTimeout(() => setNotif(''), 3000);
 setAddMemberSearch('');
 await chargerGroupes();
 } else {
 setErreur(data.error ?? 'Erreur');
 setTimeout(() => setErreur(''), 3000);
 }
 } catch { setErreur('Erreur réseau'); }
 };

 const retirerMembre = async (groupId: string, userId: string) => {
 try {
 await fetch('/api/groups/members', {
 method: 'DELETE', headers: authHeader(),
 body: JSON.stringify({ groupId, userId }),
 });
 await chargerGroupes();
 } catch { /* silencieux */ }
 };

 const acceptWorkout = async (shareData: WorkoutShareData, msgId: string) => {
 const token = localStorage.getItem('token');
 try {
 await fetch('/api/workouts/save', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
 body: JSON.stringify({ title: `(Partagé) ${shareData.title}`, programme: shareData.programme, rawText: JSON.stringify(shareData.programme), sharedBy: conversations.find(c => c.friendId === convActive)?.pseudo || conversations.find(c => c.friendId === convActive)?.nom || 'Ami' }),
 });
 setAcceptedShares((prev) => { const s = new Set(prev); s.add(msgId); return s; });
 setNotif('Entraînement ajouté à vos séances !');
 setTimeout(() => setNotif(''), 3000);
 } catch { setErreur('Erreur lors de l\'acceptation'); }
 };

 const acceptDuelInvite = async (payload: DuelInvitePayload, msgId: string) => {
 if (acceptingDuelId || acceptedDuelInvites.has(msgId)) return;
 setAcceptingDuelId(msgId);
 try {
 const res = await fetch('/api/duels/accept', {
 method: 'POST',
 headers: authHeader(),
 body: JSON.stringify({ duelId: payload.duelId }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 setErreur(data.error || 'Erreur acceptation duel');
 setTimeout(() => setErreur(''), 2500);
 setAcceptingDuelId(null);
 return;
 }
 setAcceptedDuelInvites((prev) => {
 const next = new Set(prev);
 next.add(msgId);
 return next;
 });
 window.location.assign(`/dashboard/mini-jeux?game=duel&duelId=${encodeURIComponent(payload.duelId)}`);
 } catch {
 setErreur('Erreur reseau');
 setTimeout(() => setErreur(''), 2500);
 setAcceptingDuelId(null);
 }
 };

 return (
 <main className="flex-1 px-4 py-6 sm:px-6 md:px-8 sm:py-8 overflow-x-hidden">
 <div className="max-w-5xl w-full">
 <div className="mb-4">
 <h1 className="ios-section-title text-gray-900">Reseau</h1>
 </div>

 {/* Onglets */}
 <div className="flex gap-1 bg-white/80 backdrop-blur-md border border-gray-200 p-1.5 rounded-2xl w-full sm:w-fit mb-6 sm:mb-8 overflow-x-auto shadow-[0_6px_16px_rgba(15,23,42,0.08)]">
 {([
 { key: 'amis', label: 'Amis' },
 { key: 'messages', label: 'Messages' },
 { key: 'performances', label: 'Performance' },
 ] as { key: Tab; label: string }[]).map((t) => (
 <button
 key={t.key}
 onClick={() => { setTab(t.key); localStorage.setItem('reseau_tab', t.key); }}
 className={`flex-shrink-0 px-4 py-2.5 sm:px-6 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
 tab === t.key ? 'bg-sky-50 text-sky-700 shadow-sm border border-sky-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white'
 }`}
 >
 {t.label}
 {t.key === 'amis' && amis.filter((a) => a.statut === 'recu').length > 0 && (
 <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] bg-red-500 text-white rounded-full font-bold">
 {amis.filter((a) => a.statut === 'recu').length}
 </span>
 )}
 {t.key === 'messages' && conversations.reduce((acc, c) => acc + (c.nonLu ?? 0), 0) > 0 && (
 <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] bg-emerald-500 text-white rounded-full font-bold">
 {conversations.reduce((acc, c) => acc + (c.nonLu ?? 0), 0)}
 </span>
 )}
 </button>
 ))}
 </div>

 {notif && (
 <div className="mb-4 px-4 py-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200">{notif}</div>
 )}

 {/* ── AMIS ── */}
 {tab === 'amis' && (
 <div className="space-y-5">
 <div className="bg-white border border-gray-200 rounded-xl p-5">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Ajouter un ami</h2>
 {erreur && <p className="text-sm text-red-600 mb-3">{erreur}</p>}
 <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
 <div className="relative flex-1">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
 <input
 type="text" value={recherche}
 onChange={(e) => { setRecherche(e.target.value); setErreur(''); }}
 onKeyDown={(e) => e.key === 'Enter' && envoyerDemande()}
 placeholder="pseudo, prénom ou email"
 className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-900 outline-none transition"
 />
 </div>
 <button onClick={envoyerDemande} disabled={loading}
 className="w-full sm:w-auto px-5 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition">
 {loading ? 'Envoi...' : 'Envoyer'}
 </button>
 </div>
 </div>

 {amis.filter((a) => a.statut === 'recu').length > 0 && (
 <div className="bg-white border border-gray-200 rounded-xl p-5">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
 Demandes reçues ({amis.filter((a) => a.statut === 'recu').length})
 </h2>
 <div className="space-y-3">
 {amis.filter((a) => a.statut === 'recu').map((a) => (
 <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2">
 <div className="flex items-center gap-3 min-w-0">
 <Avatar letter={a.pseudo[0] || a.nom[0]} />
 <div>
 <p className="text-sm font-semibold text-gray-900">@{a.pseudo}</p>
 </div>
 </div>
 <div className="flex flex-wrap gap-2 sm:justify-end">
 <button onClick={() => reportTarget({ targetType: 'user', targetId: a.friendId, userId: a.friendId, reason: 'Signalement depuis demande ami' })}
 className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition">
 Signaler
 </button>
 <button onClick={() => repondreDemande(a.id, 'accept')}
 className="px-4 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition">
 Accepter
 </button>
 <button onClick={() => repondreDemande(a.id, 'reject')}
 className="px-4 py-1.5 border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 text-xs font-semibold rounded-lg transition">
 Refuser
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 <div className="bg-white border border-gray-200 rounded-xl p-5">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
 Mes amis ({amis.filter((a) => a.statut === 'accepte').length})
 </h2>
 <div className="space-y-1">
 {amis.filter((a) => a.statut === 'accepte').length === 0 && (
 <p className="text-sm text-gray-400 py-4 text-center">Aucun ami pour l&apos;instant. Envoyez une demande !</p>
 )}
 {amis.filter((a) => a.statut === 'accepte').map((a) => (
 <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 px-2 rounded-lg hover:bg-gray-50 transition">
 <div className="flex items-center gap-3 min-w-0">
 <Avatar letter={(a.pseudo || a.nom)[0]} />
 <div>
 <p className="text-sm font-semibold text-gray-900">@{a.pseudo}</p>
 </div>
 </div>
 <div className="flex items-center gap-2 flex-wrap sm:justify-end">
 <button onClick={() => reportTarget({ targetType: 'user', targetId: a.friendId, userId: a.friendId, reason: 'Signalement depuis amis' })}
 className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition">
 Signaler
 </button>
 <button onClick={() => ouvrirConversation(a.friendId)}
 className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition">
 Message
 </button>
 </div>
 </div>
 ))}
 {amis.filter((a) => a.statut === 'en_attente').length > 0 && (
 <div className="pt-3 mt-2 border-t border-gray-100">
 <p className="text-xs text-gray-400 font-medium mb-2">En attente de réponse</p>
 {amis.filter((a) => a.statut === 'en_attente').map((a) => (
 <div key={a.id} className="flex items-center gap-3 py-2 px-2">
 <Avatar letter={(a.pseudo || a.nom)[0]} />
 <div>
 <p className="text-sm text-gray-600">@{a.pseudo}</p>
 <p className="text-xs text-amber-600">Demande envoyée</p>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {/* ── MESSAGES (WhatsApp-style) ── */}
 {tab === 'messages' && (
 <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col md:flex-row h-[calc(100vh-200px)] min-h-[400px] shadow-sm">
 {/* ── Sidebar ── */}
 <div className={`flex-col flex-shrink-0 md:w-72 border-b md:border-b-0 md:border-r border-gray-100 bg-white ${mobileMsgView === 'chat' ? 'hidden md:flex' : 'flex w-full'}`}>
 <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
 <h2 className="text-base font-bold text-gray-900">Messages</h2>
 <button
 onClick={() => setShowCreateGroup(!showCreateGroup)}
 className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-600"
 title="Nouveau groupe"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
 </button>
 </div>
 {/* Inline create group form */}
 {showCreateGroup && (
 <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-2">
 <p className="text-xs font-semibold text-gray-500">Nouveau groupe</p>
 <input type="text" value={nomGroupe} onChange={(e) => setNomGroupe(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && creerGroupe()} placeholder="Nom du groupe"
 className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none" />
 <div className="flex gap-2">
 <button onClick={creerGroupe} disabled={!nomGroupe.trim()}
 className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition">
 Créer
 </button>
 <button onClick={() => { setShowCreateGroup(false); setNomGroupe(''); }}
 className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 font-medium">
 Annuler
 </button>
 </div>
 </div>
 )}
 <div className="flex-1 overflow-y-auto">
 {/* Section: DMs */}
 {(conversations.length > 0 || amis.filter((a) => a.statut === 'accepte').length > 0) && (
 <div className="px-4 py-2 bg-gray-50/60">
 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Privés</p>
 </div>
 )}
 {conversations.map((m) => (
 <button key={m.friendId} onClick={() => { setConvType('dm'); setActiveGroupId(null); setShowGroupInfo(false); setConvActive(m.friendId); setMobileMsgView('chat'); }}
 className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${convType === 'dm' && convActive === m.friendId ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
 <Avatar letter={(m.pseudo || m.nom)[0]} />
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <p className="text-sm font-semibold text-gray-900 truncate">@{m.pseudo || m.nom}</p>
 <span className="text-[11px] text-gray-400 ml-2 flex-shrink-0">{m.heure}</span>
 </div>
 <p className="text-xs text-gray-400 truncate mt-0.5">{m.dernier.startsWith('__WORKOUT_SHARE__') ? ' Programme partagé' : m.dernier}</p>
 </div>
 {m.nonLu > 0 && (
 <span className="w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
 {m.nonLu}
 </span>
 )}
 </button>
 ))}
 {amis.filter((a) => a.statut === 'accepte' && !conversations.find((c) => c.friendId === a.friendId)).map((a) => (
 <button key={a.friendId} onClick={() => { setConvType('dm'); setActiveGroupId(null); setShowGroupInfo(false); setConvActive(a.friendId); setMobileMsgView('chat'); }}
 className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${convType === 'dm' && convActive === a.friendId ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
 <Avatar letter={(a.pseudo || a.nom)[0]} />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-gray-900 truncate">@{a.pseudo}</p>
 <p className="text-xs text-gray-400 truncate mt-0.5">Nouveau contact</p>
 </div>
 </button>
 ))}
 {/* Section: Groups */}
 {mesGroupes.length > 0 && (
 <div className="px-4 py-2 bg-gray-50/60">
 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Groupes</p>
 </div>
 )}
 {mesGroupes.map((g) => (
 <button key={g.id} onClick={() => { ouvrirGroupeChat(g.id); setShowGroupInfo(false); }}
 className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${convType === 'group' && activeGroupId === g.id ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
 <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
 <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-gray-900 truncate">{g.name}</p>
 <p className="text-xs text-gray-400 truncate mt-0.5">{g.members.length} membre{g.members.length > 1 ? 's' : ''}</p>
 </div>
 </button>
 ))}
 {conversations.length === 0 && amis.filter((a) => a.statut === 'accepte').length === 0 && mesGroupes.length === 0 && (
 <p className="text-xs text-gray-400 text-center p-6">Ajoutez des amis ou créez un groupe pour démarrer.</p>
 )}
 </div>
 </div>

 <div className={`flex-1 flex flex-col min-h-0 ${mobileMsgView === 'list' ? 'hidden md:flex' : 'flex'}`}>
 {/* ── DM Chat ── */}
 {convType === 'dm' && convActive ? (
 <>
 <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center gap-3">
 <button
 className="md:hidden flex-shrink-0 p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100 transition"
 onClick={() => setMobileMsgView('list')}
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <Avatar letter={(convEnCours?.pseudo ?? amis.find((a) => a.friendId === convActive)?.pseudo ?? '?')[0]} />
 <div className="min-w-0 flex-1">
 <p className="text-sm font-bold text-gray-900 truncate">
 @{convEnCours?.pseudo ?? amis.find((a) => a.friendId === convActive)?.pseudo ?? 'ami'}
 </p>
 <p className="text-xs text-gray-400">En ligne</p>
 </div>
 <div className="ml-auto flex items-center gap-1 flex-shrink-0">
 <button
 onClick={() => reportTarget({ targetType: 'user', targetId: convActive, userId: convActive, reason: 'Signalement depuis conversation privée' })}
 className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition text-gray-400 hover:text-red-500"
 title="Signaler"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
 </button>
 </div>
 </div>
 <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-2 bg-gray-50">
 {chat.length === 0 && (
 <p className="text-sm text-gray-400 text-center my-auto">Aucun message. Envoyez le premier !</p>
 )}
 {chat.map((msg) => {
 const duelInvite = parsePrefixedJson<DuelInvitePayload>(msg.text, '__DUEL_INVITE__');
 if (duelInvite) {
 const alreadyAccepted = acceptedDuelInvites.has(msg.id);
 return (
 <div key={msg.id} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
 <div className="max-w-[80%] rounded-2xl overflow-hidden border border-indigo-200 bg-indigo-50 shadow-sm">
 <div className="px-4 py-2.5 bg-indigo-600 text-white flex items-center gap-2">
 <span className="text-sm">⚔️</span>
 <p className="text-xs font-semibold">Invitation Duel 1v1</p>
 </div>
 <div className="px-4 py-3">
 <p className="text-sm font-bold text-gray-900">Exercice: {duelInvite.exercise}</p>
 <p className="text-xs text-gray-600 mt-1">Score annonce: {duelInvite.score} reps</p>
 <div className="mt-3 flex items-center justify-between gap-3">
 <p className="text-xs text-gray-400">{msg.heure}</p>
 {msg.from === 'them' ? (
 <button
 onClick={() => void acceptDuelInvite(duelInvite, msg.id)}
 disabled={alreadyAccepted || acceptingDuelId === msg.id}
 className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${alreadyAccepted ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60'}`}
 >
 {alreadyAccepted ? '✓ Accepte' : acceptingDuelId === msg.id ? 'Acceptation...' : 'Accepter'}
 </button>
 ) : (
 <button
 onClick={() => {
 window.location.href = `/dashboard/mini-jeux?game=duel&duelId=${encodeURIComponent(duelInvite.duelId)}`;
 }}
 className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition"
 >
 Ouvrir le duel
 </button>
 )}
 </div>
 </div>
 </div>
 </div>
 );
 }

 const duelAccepted = parsePrefixedJson<DuelAcceptedPayload>(msg.text, '__DUEL_ACCEPTED__');
 if (duelAccepted) {
 return (
 <div key={msg.id} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
 <div className="max-w-[80%] rounded-2xl overflow-hidden border border-emerald-200 bg-emerald-50 shadow-sm">
 <div className="px-4 py-2.5 bg-emerald-600 text-white flex items-center gap-2">
 <span className="text-sm">✅</span>
 <p className="text-xs font-semibold">Duel accepte</p>
 </div>
 <div className="px-4 py-3">
 <p className="text-sm text-gray-800">Ton ami a accepte le duel. Vous pouvez commencer.</p>
 <div className="mt-3 flex items-center justify-between">
 <p className="text-xs text-gray-400">{msg.heure}</p>
 <button
 onClick={() => {
 window.location.href = `/dashboard/mini-jeux?game=duel&duelId=${encodeURIComponent(duelAccepted.duelId)}`;
 }}
 className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition"
 >
 Rejoindre le duel
 </button>
 </div>
 </div>
 </div>
 </div>
 );
 }

 const isShare = msg.text.startsWith('__WORKOUT_SHARE__');
 if (isShare) {
 let shareData: WorkoutShareData | null = null;
 try { shareData = JSON.parse(msg.text.slice('__WORKOUT_SHARE__'.length)) as WorkoutShareData; } catch { /* invalid */ }
 if (shareData) {
 return (
 <div key={msg.id} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
 <div className="max-w-[80%] rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
 <div className="px-4 py-2.5 bg-gray-900 text-white flex items-center gap-2">
 <span className="text-sm"></span>
 <p className="text-xs font-semibold">Programme partagé</p>
 </div>
 <div className="px-4 py-3">
 <p className="text-sm font-bold text-gray-900 mb-2">{shareData.title}</p>
 <div className="space-y-1 mb-3">
 {shareData.programme.jours?.slice(0, 3).map((jour, i) => (
 <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />
 <span className="font-medium">{jour.jour}</span>
 <span className="text-gray-400">— {jour.focus} ({jour.exercices.length} exo)</span>
 </div>
 ))}
 {(shareData.programme.jours?.length ?? 0) > 3 && !expandedShares.has(msg.id) && (
 <p className="text-xs text-gray-400">+ {shareData.programme.jours.length - 3} jour(s) supplémentaire(s)</p>
 )}
 </div>

 {/* Vue détaillée expanded */}
 {expandedShares.has(msg.id) && (
 <div className="space-y-3 mb-3 border-t border-gray-100 pt-3">
 {shareData.programme.jours?.map((jour, ji) => (
 <div key={ji} className="bg-gray-50 rounded-lg overflow-hidden">
 <div className="px-3 py-2 bg-gray-100">
 <p className="text-xs font-bold text-gray-800">{jour.jour} — {jour.focus}</p>
 </div>
 <div className="px-3 py-2 space-y-1.5">
 {jour.exercices.map((exo, ei) => (
 <div key={ei} className="flex items-center gap-2 text-xs">
 <span className="w-4 h-4 bg-emerald-100 text-emerald-700 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0">{ei + 1}</span>
 <span className="font-medium text-gray-800">{exo.nom}</span>
 <span className="text-gray-400">{exo.series}×{exo.reps}</span>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Bouton voir détails */}
 <button
 onClick={() => setExpandedShares((prev) => {
 const next = new Set(prev);
 if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id);
 return next;
 })}
 className="text-xs text-emerald-600 hover:text-emerald-500 font-medium mb-2 block"
 >
 {expandedShares.has(msg.id) ? '▲ Masquer les détails' : '▼ Voir tous les détails'}
 </button>

 <div className="flex items-center justify-between">
 <p className="text-xs text-gray-400">{msg.heure}</p>
 {msg.from === 'them' && (
 <button
 onClick={() => acceptWorkout(shareData!, msg.id)}
 disabled={acceptedShares.has(msg.id)}
 className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${acceptedShares.has(msg.id) ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-emerald-500 hover:bg-emerald-400 text-white'}`}
 >
 {acceptedShares.has(msg.id) ? '✓ Ajouté' : "Accepter l'entraînement"}
 </button>
 )}
 </div>
 </div>
 </div>
 </div>
 );
 }
 }
 return (
 <div key={msg.id} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
 <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${msg.from === 'me' ? 'bg-emerald-500 text-white rounded-br-md' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'}`}>
 <p>{msg.text}</p>
 <p className={`text-xs mt-1 ${msg.from === 'me' ? 'text-emerald-100' : 'text-gray-400'}`}>{msg.heure}</p>
 {msg.from === 'them' && convActive && (
 <button
 onClick={() => reportTarget({ targetType: 'message', targetId: msg.id, senderId: convActive, reason: 'Message prive inapproprie' })}
 className="mt-1 text-[11px] text-red-500 hover:text-red-600 font-semibold"
 >
 Signaler
 </button>
 )}
 </div>
 </div>
 );
 })}
 <div ref={messagesEndRef} />
 </div>
 <div className="p-3 border-t border-gray-100 bg-white flex gap-2 items-end">
 <input type="text" value={msgInput} onChange={(e) => setMsgInput(e.target.value)}
 placeholder="Message..." onKeyDown={(e) => e.key === 'Enter' && envoyerMessage()}
 className="flex-1 px-4 py-2.5 border border-gray-200 rounded-2xl text-sm text-gray-900 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
 <button onClick={envoyerMessage} className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition flex items-center justify-center flex-shrink-0">
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
 </svg>
 </button>
 </div>
 </>
 ) : convType === 'group' && activeGroupId && activeGroup ? (
 /* ── Group Chat ── */
 <>
 <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center gap-3">
 <button
 className="md:hidden flex-shrink-0 p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100 transition"
 onClick={() => setMobileMsgView('list')}
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
 <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
 </div>
 <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setShowGroupInfo(!showGroupInfo)}>
 <p className="text-sm font-bold text-gray-900 truncate">{activeGroup.name}</p>
 <p className="text-xs text-gray-400">{activeGroup.members.length} membre{activeGroup.members.length > 1 ? 's' : ''} · Toucher pour infos</p>
 </div>
 <div className="ml-auto flex items-center gap-1 flex-shrink-0">
 <button
 onClick={() => setShowGroupInfo(!showGroupInfo)}
 className={`w-8 h-8 flex items-center justify-center rounded-full transition ${showGroupInfo ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-gray-100 text-gray-400'}`}
 title="Info groupe"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
 </button>
 <button
 onClick={() => reportTarget({ targetType: 'group', targetId: activeGroup.id, ownerId: activeGroup.ownerId, reason: 'Signalement de groupe' })}
 className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition text-gray-400 hover:text-red-500"
 title="Signaler"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
 </button>
 </div>
 </div>
 {/* Group Info Panel */}
 {showGroupInfo && (
 <div className="border-b border-gray-100 bg-white px-4 py-4 space-y-3 max-h-64 overflow-y-auto">
 <div className="flex items-center justify-between">
 <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Membres ({activeGroup.members.length})</p>
 {currentUserId === activeGroup.ownerId && (
 <button onClick={() => supprimerGroupe(activeGroup.id)}
 className="text-xs text-red-500 hover:text-red-600 font-medium">Supprimer le groupe</button>
 )}
 {currentUserId !== activeGroup.ownerId && currentUserId && (
 <button onClick={() => retirerMembre(activeGroup.id, currentUserId)}
 className="text-xs text-red-500 hover:text-red-600 font-medium">Quitter</button>
 )}
 </div>
 <div className="space-y-1">
 {activeGroup.members.map((m) => (
 <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
 <div className="flex items-center gap-2">
 <Avatar letter={(m.user.pseudo || m.user.name || '?')[0]} />
 <span className="text-sm text-gray-900">@{m.user.pseudo || m.user.name || 'utilisateur'}</span>
 {m.user.id === activeGroup.ownerId && (
 <span className="text-[10px] bg-gray-900 text-white px-1.5 py-0.5 rounded-full font-medium">Admin</span>
 )}
 </div>
 {currentUserId === activeGroup.ownerId && m.user.id !== activeGroup.ownerId && (
 <button onClick={() => retirerMembre(activeGroup.id, m.userId)}
 className="text-xs text-gray-400 hover:text-red-500">Retirer</button>
 )}
 </div>
 ))}
 </div>
 {/* Add member */}
 {currentUserId === activeGroup.ownerId && (
 <div className="pt-2 border-t border-gray-100">
 <p className="text-[11px] font-semibold text-gray-400 mb-1">Ajouter un ami</p>
 <div className="space-y-1 max-h-32 overflow-y-auto">
 {amis.filter((a) => a.statut === 'accepte' && !activeGroup.members.some((m) => m.userId === a.friendId)).map((a) => (
 <button key={a.friendId} onClick={() => ajouterMembre(activeGroup.id, a.friendId)}
 className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-emerald-50 text-left transition text-sm">
 <Avatar letter={(a.pseudo || a.nom || '?')[0]} />
 <span className="text-gray-800">@{a.pseudo}</span>
 <span className="ml-auto text-xs text-emerald-600 font-medium">+ Ajouter</span>
 </button>
 ))}
 {amis.filter((a) => a.statut === 'accepte' && !activeGroup.members.some((m) => m.userId === a.friendId)).length === 0 && (
 <p className="text-xs text-gray-400 py-1">Tous vos amis sont déjà dans ce groupe</p>
 )}
 </div>
 </div>
 )}
 </div>
 )}
 <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-2 bg-gray-50">
 {activeGroupMsgs.length === 0 && (
 <p className="text-sm text-gray-400 text-center my-auto">Aucun message. Écrivez le premier !</p>
 )}
 {activeGroupMsgs.map((m) => {
 const isMe = m.userId === groupChatUserId;
 return (
 <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
 <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-emerald-500 text-white rounded-br-md' : 'bg-white border border-gray-100 text-gray-900 rounded-bl-md shadow-sm'}`}>
 {!isMe && (
 <p className="text-xs font-semibold mb-0.5 text-emerald-600">@{m.user.pseudo || m.user.name}</p>
 )}
 <p>{m.content}</p>
 <p className={`text-[11px] mt-1 ${isMe ? 'text-emerald-100' : 'text-gray-400'}`}>{new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
 {!isMe && (
 <button
 onClick={() => reportTarget({ targetType: 'message', targetId: m.id, senderId: m.userId, reason: 'Message groupe inapproprie' })}
 className="mt-1 text-[11px] text-red-400 hover:text-red-500 font-medium"
 >
 Signaler
 </button>
 )}
 </div>
 </div>
 );
 })}
 <div ref={messagesEndRef} />
 </div>
 <div className="p-3 border-t border-gray-100 bg-white flex gap-2 items-end">
 <input type="text" value={activeGroupInput} onChange={(e) => setActiveGroupInput(e.target.value)}
 placeholder="Message..." onKeyDown={(e) => e.key === 'Enter' && envoyerActiveGroupMsg()}
 className="flex-1 px-4 py-2.5 border border-gray-200 rounded-2xl text-sm text-gray-900 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
 <button onClick={envoyerActiveGroupMsg} className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition flex items-center justify-center flex-shrink-0">
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
 </svg>
 </button>
 </div>
 </>
 ) : (
 <div className="flex-1 hidden md:flex items-center justify-center bg-gray-50">
 <div className="text-center">
 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
 <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
 </div>
 <p className="text-sm text-gray-400">Sélectionnez une conversation</p>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* ── PERFORMANCES ── */}
 {tab === 'performances' && (
 <div className="space-y-5">

 {/* ── DEMANDES DE VALIDATION REÇUES ── */}
 {valRequestsIn.length > 0 && (
 <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
 <div className="px-5 py-3 border-b border-amber-100">
 <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
 Demandes de validation reçues ({valRequestsIn.length})
 </h2>
 </div>
 <div className="divide-y divide-amber-100">
 {valRequestsIn.map((req) => (
 <div key={req.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-3 gap-2 sm:gap-4">
 <div>
 <p className="text-sm font-semibold text-gray-900">
 @{req.performance.user.pseudo}
 </p>
 <p className="text-xs text-gray-600">
 {req.performance.exercise} — <span className="font-bold">{req.performance.score} {req.performance.unit}</span>
 <span className="ml-1 text-gray-400">• {req.performance.spot.name}</span>
 </p>
 </div>
 <div className="flex gap-2 flex-shrink-0">
 <button
 onClick={() => repondreValidation(req.performanceId, true)}
 className="flex-1 sm:flex-none px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
 >
 ✓ Valider
 </button>
 <button
 onClick={() => repondreValidation(req.performanceId, false)}
 className="flex-1 sm:flex-none px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition"
 >
 ✗ Invalider
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Retour à la liste des spots */}
 {spotActif && (
 <button
 onClick={() => { setSpotActif(null); setPerformances([]); setShowAddPerf(false); setPerfReqOpen(null); }}
 className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition font-medium"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
 </svg>
 Retour aux spots
 </button>
 )}

 {/* ── LISTE DES SPOTS ── */}
 {!spotActif && (
 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
 <div className="px-5 py-4 border-b border-gray-100">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Spots Street Workout</h2>
 <p className="text-xs text-gray-400 mt-1">Cliquez sur un spot pour voir les classements et poster vos records.</p>
 <div className="mt-3">
 <input
 type="text"
 value={spotSearch}
 onChange={(e) => setSpotSearch(e.target.value)}
 placeholder="Rechercher un spot ou une ville..."
 className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
 />
 </div>
 </div>
 {spots.length === 0 ? (
 <p className="text-sm text-gray-400 text-center py-8">Chargement...</p>
 ) : (
 <div className="divide-y divide-gray-50">
 {spots
 .filter((s) => {
 if (!spotSearch.trim()) return true;
 const q = spotSearch.toLowerCase();
 return s.name.toLowerCase().includes(q) || (s.city || '').toLowerCase().includes(q);
 })
 .sort((a, b) => {
 const aFav = favoriteSpotIds.has(a.id) ? 1 : 0;
 const bFav = favoriteSpotIds.has(b.id) ? 1 : 0;
 if (aFav !== bFav) return bFav - aFav;
 return a.name.localeCompare(b.name);
 })
 .map((s) => (
 <button
 key={s.id}
 onClick={() => setSpotActif(s.id)}
 className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition text-left"
 >
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
 <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
 <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
 </div>
 <div>
 <p className="text-sm font-semibold text-gray-900">{s.name}</p>
 {s.city && <p className="text-xs text-gray-400">{s.city}</p>}
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span
 onClick={(e) => { e.stopPropagation(); toggleSpotFavori(s.id); }}
 className={`px-2 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer ${favoriteSpotIds.has(s.id) ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-700'}`}
 >
 {favoriteSpotIds.has(s.id) ? '★ Favori' : '☆ Favori'}
 </span>
 <span className="text-xs text-gray-400">{s._count.performances} record{s._count.performances !== 1 ? 's' : ''}</span>
 <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
 </svg>
 </div>
 </button>
 ))}
 </div>
 )}
 </div>
 )}

 {/* ── AJOUTER UN SPOT ── */}
 {!spotActif && (
 !showAddSpot ? (
 <button
 onClick={() => setShowAddSpot(true)}
 className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-400 hover:border-emerald-400 hover:text-emerald-600 transition"
 >
 + Proposer un nouveau street
 </button>
 ) : (
 <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Proposer un nouveau spot</p>
 <input
 value={newSpotName}
 onChange={(e) => setNewSpotName(e.target.value)}
 placeholder="Nom du spot (ex: Parc de la Villette)"
 className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
 />
 <input
 value={newSpotCity}
 onChange={(e) => setNewSpotCity(e.target.value)}
 placeholder="Ville (optionnel)"
 className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
 />
 <div className="flex gap-2">
 <button
 onClick={submitNewSpot}
 disabled={!newSpotName.trim() || spotSubmitting}
 className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
 >
 {spotSubmitting ? '...' : 'Soumettre'}
 </button>
 <button
 onClick={() => { setShowAddSpot(false); setNewSpotName(''); setNewSpotCity(''); }}
 className="px-4 py-2 border border-gray-200 text-gray-500 hover:text-gray-700 text-xs font-semibold rounded-lg transition"
 >
 Annuler
 </button>
 </div>
 <p className="text-[11px] text-gray-400">Le spot sera visible après validation par un administrateur.</p>
 </div>
 )
 )}

 {/* ── LEADERBOARD D'UN SPOT ── */}
 {spotActif && (
 <div className="space-y-4">

 {/* Header spot + bouton ajouter */}
 <div className="bg-white border border-gray-200 rounded-xl px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div className="min-w-0">
 <h2 className="text-sm font-bold text-gray-900 truncate">{spots.find((s) => s.id === spotActif)?.name}</h2>
 <p className="text-xs text-gray-400 mt-0.5">Classement par exercice · validé par la communauté</p>
 </div>
 <button
 onClick={() => setShowAddPerf(!showAddPerf)}
 className="w-full sm:w-auto px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition flex-shrink-0"
 >
 {showAddPerf ? '✕ Annuler' : '+ Mon record'}
 </button>
 </div>

 {/* Formulaire d'ajout */}
 {showAddPerf && (
 <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
 <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Enregistrer une performance</h3>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-gray-500 mb-1">Exercice</label>
 <select
 value={perfExercise}
 onChange={(e) => setPerfExercise(e.target.value)}
 className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-900 outline-none"
 >
 <optgroup label="Endurance (reps)">
 {PERF_EXERCISES.filter((e) => e.categorie === 'Endurance').map((e) => (
 <option key={e.key} value={e.key}>{e.label}</option>
 ))}
 </optgroup>
 <optgroup label="Force (kg lesté)">
 {PERF_EXERCISES.filter((e) => e.categorie === 'Force').map((e) => (
 <option key={e.key} value={e.key}>{e.label}</option>
 ))}
 </optgroup>
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-gray-500 mb-1">
 Score&nbsp;({PERF_EXERCISES.find((e) => e.key === perfExercise)?.unit ?? 'reps'})
 </label>
 <input
 type="number" min="1" step="0.5"
 value={perfScore}
 onChange={(e) => setPerfScore(e.target.value)}
 placeholder={PERF_EXERCISES.find((e) => e.key === perfExercise)?.unit === 'kg' ? 'ex: 20' : 'ex: 15'}
 className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-900 outline-none"
 />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-gray-500 mb-1">Preuve vidéo (optionnel)</label>
 <input
 type="file"
 accept="video/mp4,video/webm,video/quicktime"
 onChange={(e) => setPerfVideoFile(e.target.files?.[0] ?? null)}
 className="w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
 />
 {perfVideoFile && (
 <div className="mt-1 space-y-1">
 <p className="text-xs text-gray-400">{(perfVideoFile.size / 1024 / 1024).toFixed(1)} MB · {perfVideoFile.name}</p>
 {compressProgress !== null && (
 <div className="flex items-center gap-2">
 <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
 <div
 className="bg-gray-800 h-1.5 rounded-full transition-all duration-200"
 style={{ width: `${compressProgress}%` }}
 />
 </div>
 <span className="text-xs text-gray-500 tabular-nums w-10 text-right">
 {compressProgress < 100 ? `${compressProgress}%` : 'Envoi...'}
 </span>
 </div>
 )}
 </div>
 )}
 <p className="text-[11px] text-gray-400 mt-1">La vidéo sera compressée automatiquement avant l&apos;envoi.</p>
 </div>
 <button
 onClick={ajouterPerformance}
 disabled={perfSubmitting || !perfScore}
 className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition"
 >
 {perfSubmitting
 ? (compressProgress !== null
 ? `Compression ${compressProgress}%...`
 : videoUploading
 ? 'Upload vidéo...'
 : 'Enregistrement...')
 : 'Enregistrer ma performance'}
 </button>
 </div>
 )}

 {/* Classements par exercice */}
 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
 {PERF_EXERCISES.map((exo) => {
 const perfsExo = performances
 .filter((p) => p.exercise === exo.key)
 .sort((a, b) => b.score - a.score);
 return (
 <div key={exo.key} className="border-b border-gray-100 last:border-0">
 {/* En-tête exercice */}
 <div className="px-5 py-3 bg-gray-50 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-sm font-semibold text-gray-800">{exo.label}</span>
 <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
 exo.categorie === 'Force'
 ? 'bg-purple-100 text-purple-700'
 : 'bg-emerald-100 text-emerald-700'
 }`}>{exo.categorie}</span>
 </div>
 <span className="text-xs text-gray-400">{exo.unit === 'reps' ? 'Max répétitions' : 'Max kg soulevé'}</span>
 </div>
 {/* Performances */}
 {perfsExo.length === 0 ? (
 <p className="text-xs text-gray-400 text-center py-4 italic">Aucune performance — soyez le premier !</p>
 ) : (
 <div className="divide-y divide-gray-50">
 {perfsExo.slice(0, 10).map((p, idx) => {
 const acceptedValidations = p.validations.filter((v) => v.status === 'accepted' || v.status === undefined);
 const isOwn = p.userId === perfUserId;
 const isReqOpen = perfReqOpen === p.id;
 const acceptedFriends = amis.filter((a) => a.statut === 'accepte');
 return (
 <div key={p.id}>
 <div className={`px-4 sm:px-5 py-3 ${ isOwn ? 'bg-gray-50' : '' }`}>
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2 sm:gap-3 min-w-0">
 <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
 idx === 0 ? 'bg-yellow-100 text-yellow-700' :
 idx === 1 ? 'bg-gray-200 text-gray-600' :
 idx === 2 ? 'bg-orange-100 text-orange-600' :
 'bg-gray-100 text-gray-400'
 }`}>
 {idx + 1}
 </div>
 <p className="text-sm font-semibold text-gray-900 truncate">
 @{p.user.pseudo}
 {isOwn && <span className="ml-1 text-xs text-gray-400">(moi)</span>}
 </p>
 </div>
 <div className="text-right flex-shrink-0">
 <p className="text-base font-bold text-gray-900">
 {p.score}&nbsp;<span className="text-xs font-normal text-gray-400">{p.unit}</span>
 </p>
 {p.status === 'validated' ? (
 <span className="text-xs text-emerald-600 font-medium">✓ Validé</span>
 ) : (
 <span className="text-xs text-amber-500">
 {acceptedValidations.length}/2 conf.
 </span>
 )}
 </div>
 </div>
 {/* Action buttons — second row on mobile */}
 {isOwn && (
 <div className="flex items-center gap-2 mt-2 ml-9 sm:ml-10 flex-wrap">
 {p.videoUrl ? (
 <a href={p.videoUrl} target="_blank" rel="noopener noreferrer"
 className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
 {isZipProofUrl(p.videoUrl) ? ' Preuve ZIP' : ' Video'}
 </a>
 ) : (
 <label className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-lg font-medium hover:bg-gray-200 cursor-pointer">
 {videoUploading === p.id ? '...' : ' + Vidéo'}
 <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
 onChange={(e) => { if (e.target.files?.[0]) uploadVideoForPerf(p.id, e.target.files[0]); }} />
 </label>
 )}
 {p.status !== 'validated' && (
 <button
 onClick={() => {
 setPerfReqOpen(isReqOpen ? null : p.id);
 setPerfReqSelected(new Set());
 }}
 className={`px-2 py-1 text-xs font-semibold rounded-lg transition border ${
 isReqOpen
 ? 'bg-gray-100 border-gray-300 text-gray-700'
 : 'border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600'
 }`}
 >
 {isReqOpen ? '✕ Fermer' : ' Validation'}
 </button>
 )}
 </div>
 )}
 {/* Non-owner video badge */}
 {!isOwn && p.videoUrl && (
 <div className="mt-2 ml-9 sm:ml-10">
 <a href={p.videoUrl} target="_blank" rel="noopener noreferrer"
 className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
 {isZipProofUrl(p.videoUrl) ? ' Preuve ZIP' : ' Video'}
 </a>
 <button
 onClick={() => reportTarget({ targetType: 'performance', targetId: p.id, userId: p.userId, reason: 'Performance suspecte' })}
 className="ml-2 px-2 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
 >
 Signaler
 </button>
 </div>
 )}
 </div>
 {/* Inline validation request picker */}
 {isReqOpen && (
 <div className="mx-5 mb-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
 <p className="text-xs font-semibold text-amber-800 mb-3">
 Sélectionnez les amis à qui demander de confirmer votre performance :
 </p>
 {acceptedFriends.length === 0 ? (
 <p className="text-xs text-gray-400">Ajoutez des amis pour leur envoyer des demandes.</p>
 ) : (
 <>
 <div className="space-y-1 max-h-36 overflow-y-auto mb-3">
 {acceptedFriends.map((a) => (
 <label key={a.friendId} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-amber-100 cursor-pointer">
 <input
 type="checkbox"
 checked={perfReqSelected.has(a.friendId)}
 onChange={(e) => {
 setPerfReqSelected((prev) => {
 const next = new Set(prev);
 if (e.target.checked) next.add(a.friendId); else next.delete(a.friendId);
 return next;
 });
 }}
 className="rounded border-gray-300"
 />
 <span className="text-sm text-gray-800">@{a.pseudo}</span>
 </label>
 ))}
 </div>
 <button
 onClick={() => envoyerValRequest(p.id)}
 disabled={sendingValReq || perfReqSelected.size === 0}
 className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
 >
 {sendingValReq ? 'Envoi...' : `Envoyer à ${perfReqSelected.size} ami${perfReqSelected.size > 1 ? 's' : ''}`}
 </button>
 </>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </main>
 );
}
