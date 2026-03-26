'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  pseudo: string | null;
  isAdmin: boolean;
  suspended: boolean;
  level: string;
  createdAt: string;
  updatedAt: string;
  sessions: { lastSeen: string; browser: string | null; device: string | null; ipAddress: string | null; createdAt: string }[];
  _count: { sentMessages: number; sentFriendRequests: number; receivedFriendRequests: number; activityLogs: number };
}

interface LogRow {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: { email: string; name: string | null; pseudo: string | null };
}

interface ChallengeRow {
  id: string;
  title: string;
  description: string;
  exercise: string;
  target: number;
  unit: string;
  isPublic: boolean;
  submittedForReview: boolean;
  adminApproved: boolean;
  createdAt: string;
  creator: { id: string; pseudo: string | null; name: string | null; email: string } | null;
  _count: { completions: number };
}

interface Stats {
  totalUsers: number;
  totalMessages: number;
  totalFriendships: number;
  pendingFriendRequests: number;
  usersWithPseudo: number;
  newUsersThisWeek: number;
}

interface TrendDay { label: string; count: number }
interface TopUser { display: string; email: string; messages: number; friendRequests: number }

type AdminTab = 'overview' | 'users' | 'logs' | 'defis' | 'spots';

interface SpotRow {
  id: string;
  name: string;
  city: string | null;
  status: string;
  createdAt: string;
  addedByUser: { pseudo: string | null; name: string | null } | null;
  _count: { performances: number };
}

function authHeader(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function fmt(date: string) {
  return new Date(date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function actionLabel(action: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    login: { label: 'Connexion', color: 'bg-blue-50 text-blue-700' },
    register: { label: 'Inscription', color: 'bg-emerald-50 text-emerald-700' },
    message_sent: { label: 'Message envoyé', color: 'bg-purple-50 text-purple-700' },
    friend_request_sent: { label: 'Demande ami', color: 'bg-amber-50 text-amber-700' },
    friend_request_accepted: { label: 'Ami accepté', color: 'bg-green-50 text-green-700' },
  };
  return map[action] ?? { label: action, color: 'bg-gray-100 text-gray-600' };
}

export default function AdminPage() {
  const router = useRouter();
  const [tab,   setTab]   = useState<AdminTab>('overview');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs,  setLogs]  = useState<LogRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentSessions, setRecentSessions] = useState<{ lastSeen: string; browser: string | null; device: string | null; ipAddress: string | null; user: { email: string; name: string | null } }[]>([]);
  const [registrationsByDay, setRegistrationsByDay] = useState<TrendDay[]>([]);
  const [messagesByDay,      setMessagesByDay]      = useState<TrendDay[]>([]);
  const [topUsers,           setTopUsers]           = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adminSpots, setAdminSpots] = useState<SpotRow[]>([]);
  const [pendingChallenges, setPendingChallenges] = useState<ChallengeRow[]>([]);
  const [allChallenges,     setAllChallenges]     = useState<ChallengeRow[]>([]);
  const [chalActionLoading, setChalActionLoading] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, lRes, sRes] = await Promise.all([
        fetch('/api/admin/users', { headers: authHeader() }),
        fetch('/api/admin/logs',  { headers: authHeader() }),
        fetch('/api/admin/stats', { headers: authHeader() }),
      ]);
      if (uRes.status === 403 || lRes.status === 403) {
        setError('Accès non autorisé');
        router.push('/dashboard');
        return;
      }
      const [uData, lData, sData] = await Promise.all([uRes.json(), lRes.json(), sRes.json()]);
      setUsers(uData.users ?? []);
      setLogs(lData.logs ?? []);
      setStats(sData.stats ?? null);
      setRecentSessions(sData.recentSessions ?? []);
      setRegistrationsByDay(sData.registrationsByDay ?? []);
      setMessagesByDay(sData.messagesByDay ?? []);
      setTopUsers(sData.topUsers ?? []);
    } catch {
      setError('Erreur de chargement');
    }
    setLoading(false);
  }, [router]);

  const toggleSuspend = async (userId: string, suspended: boolean) => {
    if (!confirm(suspended ? 'Suspendre cet utilisateur ?' : 'Réactiver cet utilisateur ?')) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ suspended }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, suspended } : u));
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur');
      }
    } catch { alert('Erreur réseau'); }
    setActionLoading(null);
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`Supprimer définitivement ${email} et toutes ses données ? Cette action est irréversible.`)) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur');
      }
    } catch { alert('Erreur réseau'); }
    setActionLoading(null);
  };

  const filteredUsers = users.filter(u => {
    if (!userSearch.trim()) return true;
    const s = userSearch.toLowerCase();
    return u.email.toLowerCase().includes(s) || (u.name ?? '').toLowerCase().includes(s) || (u.pseudo ?? '').toLowerCase().includes(s);
  });

  const chargerDefis = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/challenges', { headers: authHeader() });
      if (!res.ok) return;
      const data = await res.json();
      setPendingChallenges(data.pending ?? []);
      setAllChallenges(data.all ?? []);
    } catch { /* silencieux */ }
  }, []);

  const handleChallengeAction = async (challengeId: string, action: string) => {
    const msg = action === 'delete' ? 'Supprimer ce défi définitivement ?' : action === 'approve' ? 'Approuver et rendre public ?' : action === 'reject' ? 'Refuser ce défi ?' : 'Modifier la visibilité ?';
    if (!confirm(msg)) return;
    setChalActionLoading(challengeId);
    try {
      const res = await fetch('/api/admin/challenges', {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ challengeId, action }),
      });
      if (res.ok) {
        await chargerDefis();
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur');
      }
    } catch { alert('Erreur réseau'); }
    setChalActionLoading(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (!data.user?.isAdmin) { router.push('/dashboard'); return; }
        charger();
      })
      .catch(() => router.push('/dashboard'));
  }, [charger, router]);

  useEffect(() => { if (tab === 'defis') chargerDefis(); }, [tab, chargerDefis]);

  const chargerSpots = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/spots', { headers: authHeader() });
      if (res.ok) { const data = await res.json(); setAdminSpots(data.spots ?? []); }
    } catch { /* silencieux */ }
  }, []);

  const spotAction = async (spotId: string, action: 'approve' | 'reject' | 'delete') => {
    setActionLoading(spotId);
    try {
      const res = await fetch('/api/admin/spots', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ spotId, action }),
      });
      if (res.ok) await chargerSpots();
    } catch { /* silencieux */ }
    setActionLoading(null);
  };

  useEffect(() => { if (tab === 'spots') chargerSpots(); }, [tab, chargerSpots]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </main>
    );
  }
  if (error) return <main className="flex-1 flex items-center justify-center"><p className="text-red-600">{error}</p></main>;

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-6xl">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full border border-red-200">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" clipRule="evenodd" /></svg>
                Admin
              </span>
              <h1 className="text-3xl font-bold text-gray-900">Vue administrateur</h1>
            </div>
            <p className="text-gray-500 text-sm">Supervision complète de la plateforme</p>
          </div>
          <div className="flex gap-2">
            <button onClick={charger} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:border-gray-400 transition font-medium text-gray-600">
              Actualiser
            </button>
            <button onClick={() => router.push('/dashboard/profil')} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:border-gray-400 transition font-medium text-gray-600">
              ← Retour profil
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-0.5 sm:gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit mb-8 overflow-x-auto">
          {([
            { key: 'overview', label: 'Vue globale' },
            { key: 'users',    label: `Utilisateurs (${users.length})` },
            { key: 'logs',     label: `Activité (${logs.length})` },
            { key: 'defis',    label: `Défis${pendingChallenges.length > 0 ? ` (${pendingChallenges.length} ⚠)` : ''}` },
            { key: 'spots',    label: `Spots${adminSpots.filter(s => s.status === 'pending').length > 0 ? ` (${adminSpots.filter(s => s.status === 'pending').length} ⚠)` : ''}` },
          ] as { key: AdminTab; label: string }[]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-3 py-2 sm:px-5 rounded-lg text-xs sm:text-sm font-medium transition ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── VUE GLOBALE ── */}
        {tab === 'overview' && stats && (
          <div className="space-y-6">

            {/* KPIs — ligne 1 */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Utilisateurs inscrits', value: stats.totalUsers,       icon: '👥', color: 'text-blue-600',    sub: `+${stats.newUsersThisWeek} cette semaine` },
                { label: 'Messages échangés',     value: stats.totalMessages,    icon: '💬', color: 'text-purple-600',  sub: `${messagesByDay.reduce((a, d) => a + d.count, 0)} ces 7 jours` },
                { label: 'Amitiés établies',      value: stats.totalFriendships, icon: '🤝', color: 'text-emerald-600', sub: `${stats.pendingFriendRequests} en attente` },
              ].map((k) => (
                <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{k.icon}</span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{k.label}</span>
                  </div>
                  <p className={`text-4xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* KPIs — ligne 2 */}
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: 'Demandes en attente',
                  value: stats.pendingFriendRequests,
                  icon: '⏳',
                  color: stats.pendingFriendRequests > 0 ? 'text-amber-600' : 'text-gray-400',
                  sub: 'Non encore acceptées',
                },
                {
                  label: 'Pseudos configurés',
                  value: `${stats.usersWithPseudo} / ${stats.totalUsers}`,
                  icon: '🏷️',
                  color: 'text-sky-600',
                  sub: stats.totalUsers > 0 ? `${Math.round((stats.usersWithPseudo / stats.totalUsers) * 100)}% des membres` : '—',
                },
                {
                  label: 'Nouvelles inscriptions',
                  value: stats.newUsersThisWeek,
                  icon: '📈',
                  color: stats.newUsersThisWeek > 0 ? 'text-emerald-600' : 'text-gray-400',
                  sub: '7 derniers jours',
                },
              ].map((k) => (
                <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{k.icon}</span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{k.label}</span>
                  </div>
                  <p className={`text-4xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Tendances 7 jours */}
            <div className="grid grid-cols-2 gap-4">
              {/* Inscriptions */}
              {[
                { title: 'Inscriptions — 7 derniers jours', data: registrationsByDay, color: 'bg-blue-500' },
                { title: 'Messages envoyés — 7 derniers jours', data: messagesByDay,      color: 'bg-purple-500' },
              ].map(({ title, data, color }) => {
                const maxVal = Math.max(...data.map((d) => d.count), 1);
                return (
                  <div key={title} className="bg-white border border-gray-200 rounded-xl p-5">
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h2>
                    <div className="flex items-end gap-2 h-24">
                      {data.map((d) => (
                        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-500 font-semibold">{d.count > 0 ? d.count : ''}</span>
                          <div
                            className={`w-full rounded-t ${color} transition-all`}
                            style={{ height: `${Math.max((d.count / maxVal) * 72, d.count > 0 ? 4 : 2)}px`, opacity: d.count === 0 ? 0.15 : 1 }}
                          />
                          <span className="text-[10px] text-gray-400 text-center leading-tight">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top utilisateurs */}
            {topUsers.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Top utilisateurs par messages envoyés</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {topUsers.map((u, i) => (
                    <div key={u.email} className="px-6 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-500 flex items-center justify-center">{i + 1}</span>
                        <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {u.display[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.display}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full font-semibold">{u.messages} msg</span>
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full font-semibold">{u.friendRequests} demandes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dernières connexions */}
            <div className="bg-white border border-gray-200 rounded-xl">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Dernières connexions</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {recentSessions.slice(0, 10).map((s, i) => (
                  <div key={i} className="px-6 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600">
                        {(s.user.name ?? s.user.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.user.name ?? s.user.email}</p>
                        <p className="text-xs text-gray-400">{s.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">{s.browser ?? '?'}</span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">{s.device ?? '?'}</span>
                      <span>{s.ipAddress ?? 'IP inconnue'}</span>
                      <span>{fmt(s.lastSeen)}</span>
                    </div>
                  </div>
                ))}
                {recentSessions.length === 0 && (
                  <p className="px-6 py-4 text-sm text-gray-400">Aucune session enregistrée.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── UTILISATEURS ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            {/* Recherche */}
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Rechercher un utilisateur..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
              />
              <span className="px-4 py-2 text-sm text-gray-400 bg-gray-50 rounded-lg border border-gray-200">
                {filteredUsers.length} résultat{filteredUsers.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="grid grid-cols-8 text-xs font-semibold text-gray-400 uppercase tracking-wider gap-4">
                  <span className="col-span-2">Utilisateur</span>
                  <span>Pseudo</span>
                  <span>Niveau</span>
                  <span>Inscription</span>
                  <span>Dernière connexion</span>
                  <span>Messages</span>
                  <span>Actions</span>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {filteredUsers.map((u) => (
                  <div key={u.id} className={`px-6 py-4 grid grid-cols-8 gap-4 items-center hover:bg-gray-50 transition ${u.suspended ? 'opacity-60 bg-red-50/50' : ''}`}>
                    <div className="col-span-2 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                        style={{ backgroundColor: u.isAdmin ? '#991b1b' : u.suspended ? '#9ca3af' : '#374151' }}>
                        {(u.name ?? u.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                          {u.name ?? u.email}
                          {u.isAdmin && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">ADMIN</span>}
                          {u.suspended && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">SUSPENDU</span>}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">{u.pseudo ? `@${u.pseudo}` : '—'}</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full w-fit ${
                      u.level === 'elite' ? 'bg-yellow-100 text-yellow-700' :
                      u.level === 'intermediaire' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{u.level === 'elite' ? 'Élite' : u.level === 'intermediaire' ? 'Intermédiaire' : 'Débutant'}</span>
                    <span className="text-xs text-gray-400">{fmt(u.createdAt)}</span>
                    <span className="text-xs text-gray-400">{u.sessions[0] ? fmt(u.sessions[0].lastSeen) : '—'}</span>
                    <span className="text-sm font-semibold text-gray-700">{u._count.sentMessages}</span>
                    <div className="flex gap-1.5">
                      {!u.isAdmin && (
                        <>
                          <button
                            onClick={() => toggleSuspend(u.id, !u.suspended)}
                            disabled={actionLoading === u.id}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${
                              u.suspended
                                ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                            } disabled:opacity-50`}
                          >
                            {u.suspended ? 'Réactiver' : 'Suspendre'}
                          </button>
                          <button
                            onClick={() => deleteUser(u.id, u.email)}
                            disabled={actionLoading === u.id}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="px-6 py-6 text-sm text-gray-400">Aucun utilisateur trouvé.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVITÉ ── */}
        {tab === 'logs' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="grid grid-cols-4 text-xs font-semibold text-gray-400 uppercase tracking-wider gap-4">
                <span>Utilisateur</span>
                <span>Action</span>
                <span>Détails</span>
                <span>Date</span>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {logs.map((l) => {
                const { label, color } = actionLabel(l.action);
                return (
                  <div key={l.id} className="px-6 py-3.5 grid grid-cols-4 gap-4 items-center hover:bg-gray-50 transition">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{l.user.name ?? l.user.email}</p>
                      <p className="text-xs text-gray-400">{l.user.email}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${color}`}>
                      {label}
                    </span>
                    <span className="text-xs text-gray-400 truncate">{l.details ?? '—'}</span>
                    <span className="text-xs text-gray-400">{fmt(l.createdAt)}</span>
                  </div>
                );
              })}
              {logs.length === 0 && (
                <p className="px-6 py-6 text-sm text-gray-400">Aucune activité enregistrée.</p>
              )}
            </div>
          </div>
        )}

        {/* ── DÉFIS ── */}
        {tab === 'defis' && (
          <div className="space-y-5">

            {/* En attente de validation */}
            {pendingChallenges.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4">
                <p className="text-sm text-emerald-700 font-medium">✓ Aucun défi en attente de validation.</p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-amber-100">
                  <h2 className="text-sm font-bold text-amber-800">⏳ Défis soumis en attente ({pendingChallenges.length})</h2>
                  <p className="text-xs text-amber-600 mt-0.5">Ces défis attendent votre validation pour être rendus publics à tous les utilisateurs.</p>
                </div>
                <div className="divide-y divide-amber-100">
                  {pendingChallenges.map((c) => (
                    <div key={c.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{c.title}</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{c.description}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">🏋️ {c.exercise} — {c.target} {c.unit}</span>
                          <span className="text-xs text-gray-400">👤 {c.creator?.name || c.creator?.pseudo || 'Inconnu'} ({c.creator?.email})</span>
                          <span className="text-xs text-gray-400">📅 {fmt(c.createdAt)}</span>
                          <span className="text-xs text-gray-400">✅ {c._count.completions} participation(s)</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleChallengeAction(c.id, 'approve')}
                          disabled={chalActionLoading === c.id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                        >
                          ✓ Approuver
                        </button>
                        <button
                          onClick={() => handleChallengeAction(c.id, 'reject')}
                          disabled={chalActionLoading === c.id}
                          className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg transition disabled:opacity-50"
                        >
                          ✗ Refuser
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tous les défis créés par les utilisateurs */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Tous les défis utilisateurs ({allChallenges.length})</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Gérez la visibilité et supprimez les contenus inappropriés.</p>
                </div>
              </div>
              {allChallenges.length === 0 ? (
                <p className="px-6 py-8 text-sm text-gray-400 text-center">Aucun défi créé par les utilisateurs.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {allChallenges.map((c) => (
                    <div key={c.id} className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.title}</p>
                          {c.isPublic && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Public</span>}
                          {c.submittedForReview && !c.adminApproved && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">En attente</span>}
                          {c.adminApproved && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Approuvé</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {c.exercise} — {c.target} {c.unit} · Par {c.creator?.name || c.creator?.pseudo || '?'} · {c._count.completions} completion(s) · {fmt(c.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleChallengeAction(c.id, 'toggle_public')}
                          disabled={chalActionLoading === c.id}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition disabled:opacity-50 ${
                            c.isPublic ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {c.isPublic ? 'Rendre privé' : 'Publier'}
                        </button>
                        <button
                          onClick={() => handleChallengeAction(c.id, 'delete')}
                          disabled={chalActionLoading === c.id}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                        >
                          Suppr.
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SPOTS ── */}
        {tab === 'spots' && (
          <div className="space-y-5">
            {/* Pending spots */}
            {adminSpots.filter(s => s.status === 'pending').length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-amber-100">
                  <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                    Spots en attente de validation ({adminSpots.filter(s => s.status === 'pending').length})
                  </h2>
                </div>
                <div className="divide-y divide-amber-100">
                  {adminSpots.filter(s => s.status === 'pending').map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">
                          {s.city && <>{s.city} · </>}
                          Proposé par {s.addedByUser?.pseudo || s.addedByUser?.name || 'inconnu'} · {fmt(s.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => spotAction(s.id, 'approve')}
                          disabled={actionLoading === s.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          ✓ Approuver
                        </button>
                        <button
                          onClick={() => spotAction(s.id, 'reject')}
                          disabled={actionLoading === s.id}
                          className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          ✗ Rejeter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All spots */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tous les spots ({adminSpots.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {adminSpots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block w-2 h-2 rounded-full ${s.status === 'approved' ? 'bg-emerald-500' : s.status === 'pending' ? 'bg-amber-500' : 'bg-red-400'}`} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-400">
                          {s.city && <>{s.city} · </>}
                          {s._count.performances} perf · {s.addedByUser ? `par ${s.addedByUser.pseudo || s.addedByUser.name}` : 'système'} · {fmt(s.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : s.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        {s.status === 'approved' ? 'Approuvé' : s.status === 'pending' ? 'En attente' : 'Rejeté'}
                      </span>
                      <button
                        onClick={() => spotAction(s.id, 'delete')}
                        disabled={actionLoading === s.id}
                        className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition disabled:opacity-50"
                      >
                        Suppr.
                      </button>
                    </div>
                  </div>
                ))}
                {adminSpots.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">Aucun spot</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
