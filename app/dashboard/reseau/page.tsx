'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type Tab = 'amis' | 'messages' | 'groupes' | 'performances';

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
  { key: 'tractions',         label: 'Tractions',         unit: 'reps', categorie: 'Endurance' },
  { key: 'pompes',            label: 'Pompes',             unit: 'reps', categorie: 'Endurance' },
  { key: 'dips',              label: 'Dips',               unit: 'reps', categorie: 'Endurance' },
  { key: 'squats',            label: 'Squats',             unit: 'reps', categorie: 'Endurance' },
  { key: 'tractions_lestees', label: 'Tractions lestées', unit: 'kg',   categorie: 'Force'     },
  { key: 'dips_lestes',       label: 'Dips lestés',       unit: 'kg',   categorie: 'Force'     },
] as const;

function authHeader(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReseauPage() {
  const [tab,          setTab]          = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reseau_tab') as Tab | null;
      if (saved && ['amis', 'messages', 'groupes', 'performances'].includes(saved)) return saved;
    }
    return 'amis';
  });
  const [recherche,    setRecherche]    = useState('');
  const [amis,         setAmis]         = useState<AmiItem[]>([]);
  const [nomGroupe,    setNomGroupe]    = useState('');
  const [convActive,   setConvActive]   = useState<string | null>(null);
  const [msgInput,     setMsgInput]     = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chat,         setChat]         = useState<ChatMessage[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [erreur,       setErreur]       = useState('');
  const [notif,        setNotif]        = useState('');
  const [acceptedShares, setAcceptedShares] = useState<Set<string>>(new Set());
  const [expandedShares, setExpandedShares] = useState<Set<string>>(new Set());
  const [mesGroupes,   setMesGroupes]   = useState<GroupData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [groupeActif,  setGroupeActif]  = useState<string | null>(null);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [groupesErreur, setGroupesErreur] = useState('');
  // ── Group chat state ──
  const [groupMsgs,    setGroupMsgs]    = useState<GroupMsg[]>([]);
  const [groupChatInput, setGroupChatInput] = useState('');
  const [groupChatUserId, setGroupChatUserId] = useState<string | null>(null);
  const groupChatEndRef = useRef<HTMLDivElement>(null);
  // ── Performance state ──
  const [spots,          setSpots]          = useState<SpotData[]>([]);
  const [spotActif,      setSpotActif]      = useState<string | null>(null);
  const [performances,   setPerformances]   = useState<PerfData[]>([]);
  const [perfUserId,     setPerfUserId]     = useState<string | null>(null);
  const [showAddPerf,    setShowAddPerf]    = useState(false);
  const [perfExercise,   setPerfExercise]   = useState('tractions');
  const [perfScore,      setPerfScore]      = useState('');
  const [perfSubmitting, setPerfSubmitting] = useState(false);
  const [showAddSpot,    setShowAddSpot]    = useState(false);
  const [newSpotName,    setNewSpotName]    = useState('');
  const [newSpotCity,    setNewSpotCity]    = useState('');
  const [spotSubmitting, setSpotSubmitting] = useState(false);
  // Validation request state
  const [perfReqOpen,     setPerfReqOpen]     = useState<string | null>(null);
  const [perfReqSelected, setPerfReqSelected] = useState<Set<string>>(new Set());
  const [sendingValReq,   setSendingValReq]   = useState(false);
  const [valRequestsIn,   setValRequestsIn]   = useState<PerfValidReq[]>([]);
  const [perfVideoFile,   setPerfVideoFile]   = useState<File | null>(null);
  const [videoUploading,  setVideoUploading]  = useState<string | null>(null);
  const [mobileMsgView, setMobileMsgView] = useState<'list' | 'chat'>('list');
  const [convType, setConvType] = useState<'dm' | 'group'>('dm');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeGroupMsgs, setActiveGroupMsgs] = useState<GroupMsg[]>([]);
  const [activeGroupInput, setActiveGroupInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          if (perfVideoFile.size > 50 * 1024 * 1024) {
            alert('Vidéo trop volumineuse (max 50 MB)');
          } else {
            setVideoUploading(performance.id);
            try {
              const fd = new FormData();
              fd.append('video', perfVideoFile);
              fd.append('performanceId', performance.id);
              const token = localStorage.getItem('token');
              const vRes = await fetch('/api/performances/upload-video', {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: fd,
              });
              if (!vRes.ok) {
                const vData = await vRes.json().catch(() => ({}));
                alert(vData.error || 'Erreur upload vidéo');
              }
            } catch {
              alert('Erreur réseau lors de l\'upload vidéo');
            }
            setVideoUploading(null);
          }
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
    if (file.size > 50 * 1024 * 1024) {
      alert('Vidéo trop volumineuse (max 50 MB)');
      return;
    }
    setVideoUploading(perfId);
    try {
      const fd = new FormData();
      fd.append('video', file);
      fd.append('performanceId', perfId);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/performances/upload-video', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (res.ok) {
        if (spotActif) await chargerPerformances(spotActif);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erreur lors de l\'upload');
      }
    } catch {
      alert('Erreur réseau lors de l\'upload');
    }
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

  useEffect(() => { if (tab === 'performances') { chargerSpots(); chargerValRequests(); } }, [tab, chargerSpots, chargerValRequests]);
  useEffect(() => { if (spotActif) chargerPerformances(spotActif); }, [spotActif, chargerPerformances]);

  // Reload group chat when active group changes
  useEffect(() => {
    if (groupeActif) { chargerGroupMessages(groupeActif); }
    else { setGroupMsgs([]); }
  }, [groupeActif, chargerGroupMessages]);

  // Polling group chat every 4s when a group is open
  useEffect(() => {
    if (!groupeActif) return;
    const interval = setInterval(() => chargerGroupMessages(groupeActif), 4000);
    return () => clearInterval(interval);
  }, [groupeActif, chargerGroupMessages]);

  // Scroll group chat to bottom (inside container only, not full page)
  const groupChatContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (groupChatContainerRef.current) {
      groupChatContainerRef.current.scrollTop = groupChatContainerRef.current.scrollHeight;
    }
  }, [groupMsgs]);

  useEffect(() => { chargerAmis(); chargerConversations(); chargerGroupes(); }, [chargerAmis, chargerConversations, chargerGroupes]);
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

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

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

  return (
    <main className="flex-1 px-3 py-6 sm:px-6 md:px-8 sm:py-10 overflow-x-hidden">
      <div className="max-w-5xl w-full">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reseau</h1>
          <p className="text-gray-500 mt-1">Amis, messagerie et groupes d'entrainement.</p>
        </div>

        {/* Onglets */}
        <div className="flex gap-0.5 sm:gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit mb-6 sm:mb-8 overflow-x-auto">
          {([
            { key: 'amis',          label: 'Amis'        },
            { key: 'messages',      label: 'Messages'    },
            { key: 'groupes',       label: 'Groupes'     },
            { key: 'performances',  label: 'Performance' },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); localStorage.setItem('reseau_tab', t.key); }}
              className={`flex-shrink-0 px-3 py-2 sm:px-5 rounded-lg text-xs sm:text-sm font-medium transition ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.key === 'amis' && amis.filter((a) => a.statut === 'recu').length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-4 h-4 text-xs bg-red-500 text-white rounded-full">
                  {amis.filter((a) => a.statut === 'recu').length}
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
                    <div key={a.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Avatar letter={a.pseudo[0] || a.nom[0]} />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">@{a.pseudo}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
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
                  <p className="text-sm text-gray-400 py-4 text-center">Aucun ami pour l'instant. Envoyez une demande !</p>
                )}
                {amis.filter((a) => a.statut === 'accepte').map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3">
                      <Avatar letter={(a.pseudo || a.nom)[0]} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">@{a.pseudo}</p>
                      </div>
                    </div>
                    <button onClick={() => ouvrirConversation(a.friendId)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition">
                      💬 Message
                    </button>
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

        {/* ── MESSAGES ── */}
        {tab === 'messages' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col md:flex-row h-[calc(100vh-220px)] min-h-[300px] sm:min-h-[400px] max-h-[700px] shadow-sm">
            <div className={`flex-col flex-shrink-0 md:w-80 border-b md:border-b-0 md:border-r border-gray-200 bg-white ${mobileMsgView === 'chat' ? 'hidden md:flex' : 'flex w-full'}`}>
              <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-emerald-600 to-teal-600">
                <h2 className="text-sm font-bold text-white">💬 Conversations</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {/* Section: DMs */}
                {(conversations.length > 0 || amis.filter((a) => a.statut === 'accepte').length > 0) && (
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Messages directs</p>
                  </div>
                )}
                {conversations.map((m) => (
                  <button key={m.friendId} onClick={() => { setConvType('dm'); setActiveGroupId(null); setConvActive(m.friendId); setMobileMsgView('chat'); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition border-b border-gray-50 ${convType === 'dm' && convActive === m.friendId ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-gray-50'}`}>
                    <Avatar letter={(m.pseudo || m.nom)[0]} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900 truncate">@{m.pseudo || m.nom}</p>
                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{m.heure}</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{m.dernier.startsWith('__WORKOUT_SHARE__') ? '📋 Programme partagé' : m.dernier}</p>
                    </div>
                    {m.nonLu > 0 && (
                      <span className="w-5 h-5 bg-gray-900 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                        {m.nonLu}
                      </span>
                    )}
                  </button>
                ))}
                {amis.filter((a) => a.statut === 'accepte' && !conversations.find((c) => c.friendId === a.friendId)).map((a) => (
                  <button key={a.friendId} onClick={() => { setConvType('dm'); setActiveGroupId(null); setConvActive(a.friendId); setMobileMsgView('chat'); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition border-b border-gray-50 ${convType === 'dm' && convActive === a.friendId ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-gray-50'}`}>
                    <Avatar letter={(a.pseudo || a.nom)[0]} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">@{a.pseudo}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">Pas encore de messages</p>
                    </div>
                  </button>
                ))}
                {/* Section: Groups */}
                {mesGroupes.length > 0 && (
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 border-t border-t-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Groupes</p>
                  </div>
                )}
                {mesGroupes.map((g) => (
                  <button key={g.id} onClick={() => ouvrirGroupeChat(g.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition border-b border-gray-50 ${convType === 'group' && activeGroupId === g.id ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-gray-50'}`}>
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

            <div className={`flex-1 flex-col ${mobileMsgView === 'list' ? 'hidden md:flex' : 'flex'}`}>
              {/* ── DM Chat ── */}
              {convType === 'dm' && convActive ? (
                <>
                  <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-600 to-teal-600 flex items-center gap-2 sm:gap-3">
                    <button
                      className="md:hidden flex-shrink-0 p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
                      onClick={() => setMobileMsgView('list')}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <Avatar letter={(convEnCours?.pseudo ?? amis.find((a) => a.friendId === convActive)?.pseudo ?? '?')[0]} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">
                        @{convEnCours?.pseudo ?? amis.find((a) => a.friendId === convActive)?.pseudo ?? 'ami'}
                      </p>
                      <p className="text-xs text-emerald-100">En ligne</p>
                    </div>
                    <span className="ml-auto text-xs text-emerald-100 flex items-center gap-1 flex-shrink-0"><span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse"></span> Sync</span>
                  </div>
                  <div className="flex-1 p-4 sm:p-5 overflow-y-auto flex flex-col gap-2" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%2310b981\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundColor: '#f0fdf4'}}>
                    {chat.length === 0 && (
                      <p className="text-sm text-gray-400 text-center my-auto">Aucun message. Envoyez le premier !</p>
                    )}
                    {chat.map((msg) => {
                      const isShare = msg.text.startsWith('__WORKOUT_SHARE__');
                      if (isShare) {
                        let shareData: WorkoutShareData | null = null;
                        try { shareData = JSON.parse(msg.text.slice('__WORKOUT_SHARE__'.length)) as WorkoutShareData; } catch { /* invalid */ }
                        if (shareData) {
                          return (
                            <div key={msg.id} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                              <div className="max-w-[80%] rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                                <div className="px-4 py-2.5 bg-gray-900 text-white flex items-center gap-2">
                                  <span className="text-sm">📋</span>
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
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2 items-end">
                    <input type="text" value={msgInput} onChange={(e) => setMsgInput(e.target.value)}
                      placeholder="Tapez un message..." onKeyDown={(e) => e.key === 'Enter' && envoyerMessage()}
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full text-sm text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                    <button onClick={envoyerMessage} className="w-10 h-10 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full transition flex items-center justify-center flex-shrink-0 shadow-md">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </>
              ) : convType === 'group' && activeGroupId && activeGroup ? (
                /* ── Group Chat ── */
                <>
                  <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-600 to-teal-600 flex items-center gap-2 sm:gap-3">
                    <button
                      className="md:hidden flex-shrink-0 p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
                      onClick={() => setMobileMsgView('list')}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{activeGroup.name}</p>
                      <p className="text-xs text-emerald-100">{activeGroup.members.length} membre{activeGroup.members.length > 1 ? 's' : ''}</p>
                    </div>
                    <span className="ml-auto text-xs text-emerald-100 flex items-center gap-1 flex-shrink-0"><span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse"></span> Sync</span>
                  </div>
                  <div className="flex-1 p-4 sm:p-5 overflow-y-auto flex flex-col gap-2" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%2310b981\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundColor: '#f0fdf4'}}>
                    {activeGroupMsgs.length === 0 && (
                      <p className="text-sm text-gray-400 text-center my-auto">Aucun message dans ce groupe. Écrivez le premier !</p>
                    )}
                    {activeGroupMsgs.map((m) => {
                      const isMe = m.userId === groupChatUserId;
                      return (
                        <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-emerald-500 text-white rounded-br-md' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'}`}>
                            {!isMe && (
                              <p className="text-xs font-semibold mb-0.5 text-emerald-600">@{m.user.pseudo || m.user.name}</p>
                            )}
                            <p>{m.content}</p>
                            <p className={`text-xs mt-1 ${isMe ? 'text-emerald-100' : 'text-gray-400'}`}>{new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2 items-end">
                    <input type="text" value={activeGroupInput} onChange={(e) => setActiveGroupInput(e.target.value)}
                      placeholder="Message au groupe..." onKeyDown={(e) => e.key === 'Enter' && envoyerActiveGroupMsg()}
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full text-sm text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition" />
                    <button onClick={envoyerActiveGroupMsg} className="w-10 h-10 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full transition flex items-center justify-center flex-shrink-0 shadow-md">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 hidden md:flex items-center justify-center">
                  <p className="text-sm text-gray-400">Sélectionnez une conversation</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── GROUPES ── */}
        {tab === 'groupes' && (
          <div className="space-y-5">
            {groupesErreur && (
              <div className="px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{groupesErreur}</div>
            )}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Créer un groupe</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" value={nomGroupe} onChange={(e) => setNomGroupe(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && creerGroupe()}
                  placeholder="Nom du groupe"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-900 outline-none transition" />
                <button onClick={creerGroupe}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition">
                  Créer
                </button>
              </div>
            </div>

            {/* Liste des groupes */}
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              <div className="px-5 py-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mes groupes ({mesGroupes.length})</h2>
              </div>
              {mesGroupes.length === 0 && (
                <p className="text-sm text-gray-400 text-center px-5 py-8">Aucun groupe pour l&apos;instant. Créez-en un !</p>
              )}
              {mesGroupes.map((g) => {
                const isOwner = currentUserId !== null && g.ownerId === currentUserId;
                const isOpen = groupeActif === g.id;
                return (
                  <div key={g.id}>
                    <div
                      className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => setGroupeActif(isOpen ? null : g.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{g.name}</p>
                          <p className="text-xs text-gray-400">{g.members.length} membre{g.members.length > 1 ? 's' : ''} · Créé par @{g.owner.pseudo || g.owner.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOwner && (
                          <button
                            onClick={(e) => { e.stopPropagation(); supprimerGroupe(g.id); }}
                            className="text-xs text-gray-400 hover:text-red-500 transition"
                          >
                            Supprimer
                          </button>
                        )}
                        {!isOwner && currentUserId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); retirerMembre(g.id, currentUserId); }}
                            className="text-xs text-gray-400 hover:text-red-500 transition"
                          >
                            Quitter
                          </button>
                        )}
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Détail du groupe */}
                    {isOpen && (
                      <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
                        {/* Chat du groupe */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Chat du groupe</p>
                          <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                            <div ref={groupChatContainerRef} className="h-52 overflow-y-auto p-3 flex flex-col gap-2">
                              {groupMsgs.length === 0 && (
                                <p className="text-xs text-gray-400 text-center my-auto">Aucun message. Écrivez le premier !</p>
                              )}
                              {groupMsgs.map((m) => {
                                const isMe = m.userId === groupChatUserId;
                                return (
                                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                                      isMe ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                                    }`}>
                                      {!isMe && (
                                        <p className="text-xs font-semibold mb-0.5" style={{ color: '#6b7280' }}>
                                          @{m.user.pseudo || m.user.name}
                                        </p>
                                      )}
                                      <p>{m.content}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex gap-2 p-2 border-t border-gray-100 bg-white">
                              <input
                                type="text"
                                value={groupChatInput}
                                onChange={(e) => setGroupChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && envoyerGroupMessage(g.id)}
                                placeholder="Écrivez un message..."
                                className="flex-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                              />
                              <button
                                onClick={() => envoyerGroupMessage(g.id)}
                                className="px-3 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition"
                              >
                                Envoyer
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Liste des membres */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Membres</p>
                          <div className="space-y-2">
                            {g.members.map((m) => (
                              <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <Avatar letter={(m.user.pseudo || m.user.name || '?')[0]} />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">@{m.user.pseudo || m.user.name || 'utilisateur'}</p>
                                  </div>
                                  {m.user.id === g.ownerId && (
                                    <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">Admin</span>
                                  )}
                                </div>
                                {isOwner && m.user.id !== g.ownerId && (
                                  <button
                                    onClick={() => retirerMembre(g.id, m.userId)}
                                    className="text-xs text-gray-400 hover:text-red-500 transition"
                                  >
                                    Retirer
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Ajouter un membre (owner uniquement) */}
                        {isOwner && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ajouter un ami au groupe</p>
                            {amis.filter((a) => a.statut === 'accepte').length === 0 ? (
                              <p className="text-xs text-gray-400">Aucun ami disponible. Ajoutez des amis d&apos;abord !</p>
                            ) : (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={addMemberSearch}
                                  onChange={(e) => setAddMemberSearch(e.target.value)}
                                  placeholder="Rechercher un ami..."
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-gray-900 outline-none"
                                />
                                <div className="max-h-40 overflow-y-auto space-y-1">
                                  {amis
                                    .filter((a) => a.statut === 'accepte')
                                    .filter((a) => !g.members.some((m) => m.userId === a.friendId))
                                    .filter((a) => !addMemberSearch || a.pseudo?.toLowerCase().includes(addMemberSearch.toLowerCase()) || a.nom?.toLowerCase().includes(addMemberSearch.toLowerCase()))
                                    .map((a) => (
                                      <button
                                        key={a.friendId}
                                        onClick={() => ajouterMembre(g.id, a.friendId)}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-emerald-50 text-left transition"
                                      >
                                        <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs font-semibold text-gray-700">
                                          {(a.pseudo || a.nom || '?')[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-900">@{a.pseudo}</p>
                                        </div>
                                        <span className="text-xs text-emerald-600 font-semibold">+ Ajouter</span>
                                      </button>
                                    ))}
                                  {amis
                                    .filter((a) => a.statut === 'accepte')
                                    .filter((a) => !g.members.some((m) => m.userId === a.friendId))
                                    .filter((a) => !addMemberSearch || a.pseudo?.toLowerCase().includes(addMemberSearch.toLowerCase()) || a.nom?.toLowerCase().includes(addMemberSearch.toLowerCase()))
                                    .length === 0 && (
                                    <p className="text-xs text-gray-400 text-center py-2">Tous vos amis sont déjà dans ce groupe</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                    📋 Demandes de validation reçues ({valRequestsIn.length})
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
                </div>
                {spots.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Chargement...</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {spots.map((s) => (
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
                      {perfVideoFile && <p className="text-xs text-gray-400 mt-1">{(perfVideoFile.size / 1024 / 1024).toFixed(1)} MB · {perfVideoFile.name}</p>}
                    </div>
                    <button
                      onClick={ajouterPerformance}
                      disabled={perfSubmitting || !perfScore}
                      className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition"
                    >
                      {perfSubmitting ? (videoUploading ? 'Upload vidéo...' : 'Enregistrement...') : 'Enregistrer ma performance'}
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
                                            🎥 Vidéo
                                          </a>
                                        ) : (
                                          <label className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-lg font-medium hover:bg-gray-200 cursor-pointer">
                                            {videoUploading === p.id ? '⏳...' : '📹 + Vidéo'}
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
                                            {isReqOpen ? '✕ Fermer' : '📋 Validation'}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    {/* Non-owner video badge */}
                                    {!isOwn && p.videoUrl && (
                                      <div className="mt-2 ml-9 sm:ml-10">
                                        <a href={p.videoUrl} target="_blank" rel="noopener noreferrer"
                                          className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
                                          🎥 Vidéo
                                        </a>
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
