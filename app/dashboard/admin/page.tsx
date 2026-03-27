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

type AdminTab = 'overview' | 'users' | 'logs' | 'analytics' | 'performances';

interface PerfRow {
  id: string;
  exercise: string;
  score: number;
  unit: string;
  status: string;
  videoUrl: string | null;
  createdAt: string;
  user: { id: string; pseudo: string | null; name: string | null; email: string };
  spot: { id: string; name: string; city: string | null } | null;
  validations: { validatorId: string; status: string }[];
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
    workout_generated: { label: 'Séance générée', color: 'bg-cyan-50 text-cyan-700' },
    ai_api_call: { label: 'Appel API IA', color: 'bg-indigo-50 text-indigo-700' },
  };
  return map[action] ?? { label: action, color: 'bg-gray-100 text-gray-600' };
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentSessions, setRecentSessions] = useState<{ lastSeen: string; browser: string | null; device: string | null; ipAddress: string | null; user: { email: string; name: string | null } }[]>([]);
  const [registrationsByDay, setRegistrationsByDay] = useState<TrendDay[]>([]);
  const [messagesByDay, setMessagesByDay] = useState<TrendDay[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [logFilter, setLogFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'createdAt' | 'messages' | 'name'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [performances, setPerformances] = useState<PerfRow[]>([]);
  const [editingPerf, setEditingPerf] = useState<string | null>(null);
  const [editScore, setEditScore] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, lRes, sRes, pRes] = await Promise.all([
        fetch('/api/admin/users', { headers: authHeader() }),
        fetch('/api/admin/logs', { headers: authHeader() }),
        fetch('/api/admin/stats', { headers: authHeader() }),
        fetch('/api/admin/performances', { headers: authHeader() }),
      ]);
      if (uRes.status === 403 || lRes.status === 403) {
        setError('Accès non autorisé');
        router.push('/dashboard');
        return;
      }
      const [uData, lData, sData, pData] = await Promise.all([uRes.json(), lRes.json(), sRes.json(), pRes.json()]);
      setUsers(uData.users ?? []);
      setLogs(lData.logs ?? []);
      setPerformances(pData.performances ?? []);
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

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    if (!confirm(isAdmin ? 'Donner les droits admin ?' : 'Retirer les droits admin ?')) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ isAdmin }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isAdmin } : u));
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur');
      }
    } catch { alert('Erreur réseau'); }
    setActionLoading(null);
  };

  const resetPassword = async (userId: string, email: string) => {
    if (!confirm(`Envoyer un email de réinitialisation à ${email} ?`)) return;
    setActionLoading(userId);
    try {
      await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: authHeader(),
      });
      alert('Demande de réinitialisation envoyée.');
    } catch { alert('Erreur réseau'); }
    setActionLoading(null);
  };

  const updatePerf = async (perfId: string, score: number, status: string) => {
    setActionLoading(perfId);
    try {
      const res = await fetch('/api/admin/performances', {
        method: 'PUT',
        headers: authHeader(),
        body: JSON.stringify({ performanceId: perfId, score, status }),
      });
      if (res.ok) {
        const { performance } = await res.json();
        setPerformances(prev => prev.map(p => p.id === perfId ? performance : p));
        setEditingPerf(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur');
      }
    } catch { alert('Erreur réseau'); }
    setActionLoading(null);
  };

  const deletePerf = async (perfId: string) => {
    if (!confirm('Supprimer cette performance ? Cette action est irréversible.')) return;
    setActionLoading(perfId);
    try {
      const res = await fetch('/api/admin/performances', {
        method: 'DELETE',
        headers: authHeader(),
        body: JSON.stringify({ performanceId: perfId }),
      });
      if (res.ok) {
        setPerformances(prev => prev.filter(p => p.id !== perfId));
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

  const filteredUsers = users
    .filter(u => {
      if (!userSearch.trim()) return true;
      const s = userSearch.toLowerCase();
      return u.email.toLowerCase().includes(s) || (u.name ?? '').toLowerCase().includes(s) || (u.pseudo ?? '').toLowerCase().includes(s);
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'messages') return (a._count.sentMessages - b._count.sentMessages) * dir;
      if (sortField === 'name') return ((a.name ?? a.email).localeCompare(b.name ?? b.email)) * dir;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });

  const filteredLogs = logs.filter(l => {
    if (!logFilter) return true;
    return l.action === logFilter;
  });

  const workoutGenerations = logs.filter(l => l.action === 'workout_generated').length;
  const aiApiCalls = logs.filter(l => l.action === 'ai_api_call').length;
  // Parse real token usage from AI call logs
  const aiStats = logs.filter(l => l.action === 'ai_api_call').reduce((acc, l) => {
    try {
      const d = JSON.parse(l.details || '{}');
      acc.totalTokens += d.totalTokens || 0;
      acc.promptTokens += d.promptTokens || 0;
      acc.completionTokens += d.completionTokens || 0;
      acc.totalCost += d.estimatedCost || 0;
    } catch { /* skip malformed */ }
    return acc;
  }, { totalTokens: 0, promptTokens: 0, completionTokens: 0, totalCost: 0 });
  const totalActions = logs.length;
  const actionsPerUser = stats && stats.totalUsers > 0 ? (totalActions / stats.totalUsers).toFixed(1) : '0';
  const messagesPerUser = stats && stats.totalUsers > 0 ? (stats.totalMessages / stats.totalUsers).toFixed(1) : '0';
  const activeUsers = users.filter(u => u.sessions.length > 0 && new Date(u.sessions[0].lastSeen) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
  const suspendedUsers = users.filter(u => u.suspended).length;
  const adminUsers = users.filter(u => u.isAdmin).length;

  const actionDistribution = logs.reduce((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hourlyActivity = Array.from({ length: 24 }, (_, h) => {
    const count = logs.filter(l => {
      const d = new Date(l.createdAt);
      const now = new Date();
      return d > new Date(now.getTime() - 24 * 60 * 60 * 1000) && d.getHours() === h;
    }).length;
    return { hour: `${h}h`, count };
  });

  const levelDistribution = users.reduce((acc, u) => {
    acc[u.level] = (acc[u.level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (!data.user?.isAdmin) {
          router.push('/dashboard');
          return;
        }
        charger();
      })
      .catch(() => router.push('/dashboard'));
  }, [charger, router]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </main>
    );
  }
  if (error) return <main className="flex-1 flex items-center justify-center p-4"><p className="text-red-600">{error}</p></main>;

  return (
    <main className="flex-1 px-3 py-6 sm:px-6 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-6xl w-full">

        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full border border-red-200">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" clipRule="evenodd" /></svg>
                Admin
              </span>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Vue administrateur</h1>
            </div>
            <p className="text-gray-500 text-sm">Supervision complète de la plateforme</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={charger} className="px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg hover:border-gray-400 transition font-medium text-gray-600">
              ↻ Actualiser
            </button>
            <button onClick={() => router.push('/dashboard/profil')} className="px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg hover:border-gray-400 transition font-medium text-gray-600">
              ← Retour profil
            </button>
          </div>
        </div>

        {/* Onglets — scrollable */}
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 mb-6 sm:mb-8">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit min-w-fit">
            {([
              { key: 'overview', label: 'Vue globale' },
              { key: 'users', label: `Utilisateurs (${users.length})` },
              { key: 'logs', label: `Activité (${logs.length})` },
              { key: 'performances', label: `🏆 Perfs (${performances.length})` },
              { key: 'analytics', label: '📊 Analytics' },
            ] as { key: AdminTab; label: string }[]).map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── VUE GLOBALE ── */}
        {tab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: 'Utilisateurs inscrits', value: stats.totalUsers, icon: '👥', color: 'text-blue-600', sub: `+${stats.newUsersThisWeek} cette semaine` },
                { label: 'Messages échangés', value: stats.totalMessages, icon: '💬', color: 'text-purple-600', sub: `${messagesByDay.reduce((a, d) => a + d.count, 0)} ces 7 jours` },
                { label: 'Amitiés établies', value: stats.totalFriendships, icon: '🤝', color: 'text-emerald-600', sub: `${stats.pendingFriendRequests} en attente` },
              ].map((k) => (
                <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl sm:text-2xl">{k.icon}</span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{k.label}</span>
                  </div>
                  <p className={`text-2xl sm:text-4xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: 'Demandes en attente', value: stats.pendingFriendRequests, icon: '⏳', color: stats.pendingFriendRequests > 0 ? 'text-amber-600' : 'text-gray-400', sub: 'Non encore acceptées' },
                { label: 'Pseudos configurés', value: `${stats.usersWithPseudo} / ${stats.totalUsers}`, icon: '🏷️', color: 'text-sky-600', sub: stats.totalUsers > 0 ? `${Math.round((stats.usersWithPseudo / stats.totalUsers) * 100)}% des membres` : '—' },
                { label: 'Nouvelles inscriptions', value: stats.newUsersThisWeek, icon: '📈', color: stats.newUsersThisWeek > 0 ? 'text-emerald-600' : 'text-gray-400', sub: '7 derniers jours' },
              ].map((k) => (
                <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl sm:text-2xl">{k.icon}</span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{k.label}</span>
                  </div>
                  <p className={`text-2xl sm:text-4xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Actifs (7j)', value: activeUsers, color: 'text-green-600' },
                { label: 'Suspendus', value: suspendedUsers, color: 'text-red-600' },
                { label: 'Admins', value: adminUsers, color: 'text-indigo-600' },
                { label: 'Moy. msg/user', value: messagesPerUser, color: 'text-purple-600' },
              ].map((k) => (
                <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">{k.label}</p>
                  <p className={`text-xl sm:text-2xl font-bold ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Inscriptions — 7 derniers jours', data: registrationsByDay, color: 'bg-blue-500' },
                { title: 'Messages envoyés — 7 derniers jours', data: messagesByDay, color: 'bg-purple-500' },
              ].map(({ title, data, color }) => {
                const maxVal = Math.max(...data.map((d) => d.count), 1);
                return (
                  <div key={title} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h2>
                    <div className="flex items-end gap-1 sm:gap-2 h-24">
                      {data.map((d) => (
                        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] sm:text-xs text-gray-500 font-semibold">{d.count > 0 ? d.count : ''}</span>
                          <div
                            className={`w-full rounded-t ${color} transition-all`}
                            style={{ height: `${Math.max((d.count / maxVal) * 72, d.count > 0 ? 4 : 2)}px`, opacity: d.count === 0 ? 0.15 : 1 }}
                          />
                          <span className="text-[9px] sm:text-[10px] text-gray-400 text-center leading-tight">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {topUsers.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Top utilisateurs par messages envoyés</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {topUsers.map((u, i) => (
                    <div key={u.email} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-500 flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.display[0].toUpperCase()}
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{u.display}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full font-semibold text-xs">{u.messages} msg</span>
                        <span className="hidden sm:inline-flex px-2 py-1 bg-amber-50 text-amber-700 rounded-full font-semibold text-xs">{u.friendRequests} dem.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Dernières connexions</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {recentSessions.slice(0, 10).map((s, i) => (
                  <div key={i} className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                        {(s.user.name ?? s.user.email)[0].toUpperCase()}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{s.user.name ?? s.user.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400 ml-11 sm:ml-0">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600">{s.browser ?? '?'}</span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600">{s.device ?? '?'}</span>
                      <span>{fmt(s.lastSeen)}</span>
                    </div>
                  </div>
                ))}
                {recentSessions.length === 0 && (
                  <p className="px-4 sm:px-6 py-4 text-sm text-gray-400">Aucune session enregistrée.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── UTILISATEURS ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Rechercher un utilisateur..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:border-gray-400"
              />
              <div className="flex gap-2">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as typeof sortField)}
                  className="px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white text-gray-700"
                >
                  <option value="createdAt">Date inscription</option>
                  <option value="messages">Messages</option>
                  <option value="name">Nom</option>
                </select>
                <button
                  onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white text-gray-700"
                >
                  {sortDir === 'asc' ? '↑' : '↓'}
                </button>
                <span className="px-3 py-2 text-xs sm:text-sm text-gray-400 bg-gray-50 rounded-lg border border-gray-200 whitespace-nowrap">
                  {filteredUsers.length}
                </span>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Utilisateur</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Pseudo</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Niveau</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase hidden xl:table-cell">Inscrit</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase hidden xl:table-cell">Dern. co.</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Msg</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className={`hover:bg-gray-50 transition ${u.suspended ? 'opacity-60 bg-red-50/50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
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
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{u.pseudo ? `@${u.pseudo}` : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            u.level === 'elite' ? 'bg-yellow-100 text-yellow-700' :
                            u.level === 'intermediaire' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{u.level === 'elite' ? 'Élite' : u.level === 'intermediaire' ? 'Inter.' : 'Débutant'}</span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-400 hidden xl:table-cell">{fmt(u.createdAt)}</td>
                        <td className="px-3 py-3 text-xs text-gray-400 hidden xl:table-cell">{u.sessions[0] ? fmt(u.sessions[0].lastSeen) : '—'}</td>
                        <td className="px-3 py-3 text-right text-sm font-semibold text-gray-700">{u._count.sentMessages}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            {!u.isAdmin && (
                              <>
                                <button onClick={() => toggleSuspend(u.id, !u.suspended)} disabled={actionLoading === u.id}
                                  className={`px-2 py-1 text-xs font-medium rounded-lg border transition ${u.suspended ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-amber-200 text-amber-700 hover:bg-amber-50'} disabled:opacity-50`}>
                                  {u.suspended ? 'Réact.' : 'Susp.'}
                                </button>
                                <button onClick={() => toggleAdmin(u.id, true)} disabled={actionLoading === u.id}
                                  className="px-2 py-1 text-xs font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-50">Admin</button>
                                <button onClick={() => deleteUser(u.id, u.email)} disabled={actionLoading === u.id}
                                  className="px-2 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50">Suppr.</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length === 0 && (
                <p className="px-6 py-6 text-sm text-gray-400 text-center">Aucun utilisateur trouvé.</p>
              )}
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-3">
              {filteredUsers.map((u) => (
                <div key={u.id} className={`bg-white border border-gray-200 rounded-xl p-4 ${u.suspended ? 'opacity-60 bg-red-50/50' : ''}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                      style={{ backgroundColor: u.isAdmin ? '#991b1b' : u.suspended ? '#9ca3af' : '#374151' }}>
                      {(u.name ?? u.email)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5 flex-wrap">
                        {u.name ?? u.email}
                        {u.isAdmin && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">ADMIN</span>}
                        {u.suspended && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">SUSPENDU</span>}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{u.pseudo ? `@${u.pseudo}` : u.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div><span className="text-gray-400">Niveau:</span> <span className="font-medium text-gray-700">{u.level === 'elite' ? 'Élite' : u.level === 'intermediaire' ? 'Inter.' : 'Déb.'}</span></div>
                    <div><span className="text-gray-400">Messages:</span> <span className="font-semibold text-gray-700">{u._count.sentMessages}</span></div>
                    <div><span className="text-gray-400">Inscrit:</span> <span className="text-gray-600">{fmt(u.createdAt)}</span></div>
                    <div><span className="text-gray-400">Dern. co:</span> <span className="text-gray-600">{u.sessions[0] ? fmt(u.sessions[0].lastSeen) : '—'}</span></div>
                  </div>
                  {!u.isAdmin && (
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => toggleSuspend(u.id, !u.suspended)} disabled={actionLoading === u.id}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex-1 min-w-[80px] ${u.suspended ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-amber-200 text-amber-700 hover:bg-amber-50'} disabled:opacity-50`}>
                        {u.suspended ? 'Réactiver' : 'Suspendre'}
                      </button>
                      <button onClick={() => toggleAdmin(u.id, true)} disabled={actionLoading === u.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-50">→ Admin</button>
                      <button onClick={() => resetPassword(u.id, u.email)} disabled={actionLoading === u.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">Reset MDP</button>
                      <button onClick={() => deleteUser(u.id, u.email)} disabled={actionLoading === u.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50">Supprimer</button>
                    </div>
                  )}
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-400 text-center">Aucun utilisateur trouvé.</p>
              )}
            </div>
          </div>
        )}

        {/* ── ACTIVITÉ ── */}
        {tab === 'logs' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <select value={logFilter} onChange={(e) => setLogFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700">
                <option value="">Toutes les actions</option>
                {Object.keys(actionDistribution).map(a => (
                  <option key={a} value={a}>{actionLabel(a).label} ({actionDistribution[a]})</option>
                ))}
              </select>
              <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 rounded-lg border border-gray-200">
                {filteredLogs.length} entrée{filteredLogs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Desktop */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Utilisateur</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Action</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Détails</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredLogs.slice(0, 100).map((l) => {
                      const { label, color } = actionLabel(l.action);
                      return (
                        <tr key={l.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900 truncate">{l.user.pseudo ? `@${l.user.pseudo}` : l.user.name ?? l.user.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 truncate max-w-[200px]">{l.details ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmt(l.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredLogs.length === 0 && (
                <p className="px-6 py-6 text-sm text-gray-400 text-center">Aucune activité.</p>
              )}
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-2">
              {filteredLogs.slice(0, 50).map((l) => {
                const { label, color } = actionLabel(l.action);
                return (
                  <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{l.user.pseudo ? `@${l.user.pseudo}` : l.user.name ?? l.user.email}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="truncate mr-2">{l.details ?? '—'}</span>
                      <span className="whitespace-nowrap">{fmt(l.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
              {filteredLogs.length === 0 && (
                <p className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-400 text-center">Aucune activité.</p>
              )}
            </div>
          </div>
        )}

        {/* ── PERFORMANCES ── */}
        {tab === 'performances' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Gestion des performances</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{performances.length} performance{performances.length !== 1 ? 's' : ''} enregistrée{performances.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Utilisateur</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Exercice</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Score</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Statut</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase hidden sm:table-cell">Spot</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase hidden md:table-cell">Vidéo</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase hidden lg:table-cell">Date</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {performances.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Aucune performance</td></tr>
                    )}
                    {performances.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">{p.user.pseudo ? `@${p.user.pseudo}` : p.user.name ?? p.user.email}</p>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">{p.exercise}</td>
                        <td className="px-3 py-3 text-right">
                          {editingPerf === p.id ? (
                            <input type="number" step="any" value={editScore} onChange={e => setEditScore(e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                          ) : (
                            <span className="text-sm font-semibold text-gray-900">{p.score} {p.unit}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {editingPerf === p.id ? (
                            <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900">
                              <option value="pending">En attente</option>
                              <option value="validated">Validé</option>
                              <option value="rejected">Rejeté</option>
                            </select>
                          ) : (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              p.status === 'validated' ? 'bg-green-100 text-green-700' :
                              p.status === 'rejected' ? 'bg-red-100 text-red-600' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {p.status === 'validated' ? 'Validé' : p.status === 'rejected' ? 'Rejeté' : 'En attente'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-500 hidden sm:table-cell truncate max-w-[100px]">{p.spot?.name ?? '—'}</td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          {p.videoUrl ? (
                            <a href={p.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Voir vidéo</a>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-400 hidden lg:table-cell whitespace-nowrap">{fmt(p.createdAt)}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {editingPerf === p.id ? (
                              <>
                                <button onClick={() => updatePerf(p.id, Number(editScore), editStatus)}
                                  disabled={actionLoading === p.id}
                                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                                  ✓
                                </button>
                                <button onClick={() => setEditingPerf(null)}
                                  className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300">
                                  ✕
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => { setEditingPerf(p.id); setEditScore(String(p.score)); setEditStatus(p.status); }}
                                  className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                                  ✏️
                                </button>
                                <button onClick={() => deletePerf(p.id)}
                                  disabled={actionLoading === p.id}
                                  className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50">
                                  🗑
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Video verification section */}
            {performances.filter(p => p.videoUrl).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">🎥 Vérification vidéo</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{performances.filter(p => p.videoUrl).length} performance{performances.filter(p => p.videoUrl).length > 1 ? 's' : ''} avec vidéo</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {performances.filter(p => p.videoUrl).map(p => (
                    <div key={`vid-${p.id}`} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {p.user.pseudo ? `@${p.user.pseudo}` : p.user.name ?? p.user.email} — {p.exercise}
                        </p>
                        <p className="text-xs text-gray-400">{p.score} {p.unit} · {fmt(p.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a href={p.videoUrl!} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
                          ▶ Voir vidéo
                        </a>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          p.status === 'validated' ? 'bg-green-100 text-green-700' :
                          p.status === 'rejected' ? 'bg-red-100 text-red-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {p.status === 'validated' ? 'Validé' : p.status === 'rejected' ? 'Rejeté' : 'En attente'}
                        </span>
                        {p.status !== 'validated' && (
                          <button onClick={() => updatePerf(p.id, p.score, 'validated')}
                            disabled={actionLoading === p.id}
                            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                            ✓ Valider
                          </button>
                        )}
                        {p.status !== 'rejected' && (
                          <button onClick={() => updatePerf(p.id, p.score, 'rejected')}
                            disabled={actionLoading === p.id}
                            className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 disabled:opacity-50">
                            ✕ Rejeter
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Séances IA générées', value: workoutGenerations, icon: '🤖', color: 'text-cyan-600', sub: 'via intelligence artificielle' },
                { label: 'Appels API IA', value: aiApiCalls, icon: '⚡', color: 'text-indigo-600', sub: 'Total appels API' },
                { label: 'Actions totales', value: totalActions, icon: '📝', color: 'text-gray-700', sub: `Moy: ${actionsPerUser}/utilisateur` },
                { label: 'Taux engagement', value: stats ? `${Math.round((activeUsers / Math.max(stats.totalUsers, 1)) * 100)}%` : '—', icon: '🎯', color: 'text-emerald-600', sub: `${activeUsers} actifs / ${stats?.totalUsers ?? 0}` },
              ].map((k) => (
                <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{k.icon}</span>
                    <span className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">{k.label}</span>
                  </div>
                  <p className={`text-xl sm:text-2xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Actions distribution */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Distribution des actions</h2>
                <div className="space-y-3">
                  {Object.entries(actionDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([action, count]) => {
                      const { label, color } = actionLabel(action);
                      const pct = totalActions > 0 ? (count / totalActions) * 100 : 0;
                      return (
                        <div key={action}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>
                            <span className="text-xs text-gray-500 font-semibold">{count} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-gray-700 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  {Object.keys(actionDistribution).length === 0 && <p className="text-sm text-gray-400">Aucune donnée.</p>}
                </div>
              </div>

              {/* Levels + hourly */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Répartition des niveaux</h2>
                <div className="space-y-4">
                  {[
                    { key: 'debutant', label: '🌱 Débutant', color: 'bg-gray-500' },
                    { key: 'intermediaire', label: '💪 Intermédiaire', color: 'bg-blue-500' },
                    { key: 'elite', label: '👑 Élite', color: 'bg-yellow-500' },
                  ].map(({ key, label, color }) => {
                    const count = levelDistribution[key] ?? 0;
                    const pct = users.length > 0 ? (count / users.length) * 100 : 0;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{label}</span>
                          <span className="text-sm font-bold text-gray-900">{count} <span className="text-xs text-gray-400 font-normal">({pct.toFixed(0)}%)</span></span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 mt-8">Activité par heure (24h)</h2>
                <div className="flex items-end gap-0.5 h-20">
                  {hourlyActivity.map((h) => {
                    const max = Math.max(...hourlyActivity.map(a => a.count), 1);
                    return (
                      <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5">
                        <span className="text-[8px] text-gray-400">{h.count > 0 ? h.count : ''}</span>
                        <div className="w-full bg-indigo-400 rounded-t transition-all"
                          style={{ height: `${Math.max((h.count / max) * 56, h.count > 0 ? 2 : 1)}px`, opacity: h.count === 0 ? 0.15 : 1 }} />
                        <span className="text-[7px] text-gray-400">{h.hour}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Engagement table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Engagement par utilisateur</h2>
                <p className="text-xs text-gray-400 mt-0.5">Messages, demandes d&apos;amis, logs</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Utilisateur</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Msg</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Amis</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.slice(0, 20).map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {(u.name ?? u.email)[0].toUpperCase()}
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate">{u.pseudo ? `@${u.pseudo}` : u.name ?? u.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{u._count.sentMessages}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">{u._count.sentFriendRequests}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">{u._count.activityLogs}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            u.suspended ? 'bg-red-100 text-red-600' :
                            u.sessions[0] && new Date(u.sessions[0].lastSeen) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {u.suspended ? 'Suspendu' : u.sessions[0] && new Date(u.sessions[0].lastSeen) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Technical info */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">📡 Suivi API en temps réel</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Appels API IA</p>
                  <p className="text-xl font-bold text-gray-900">{aiApiCalls}</p>
                  <p className="text-xs text-gray-400 mt-1">{workoutGenerations} séance{workoutGenerations !== 1 ? 's' : ''} sauvegardée{workoutGenerations !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Tokens réels</p>
                  <p className="text-xl font-bold text-gray-900">{aiStats.totalTokens > 0 ? aiStats.totalTokens.toLocaleString() : '—'}</p>
                  <p className="text-xs text-gray-400 mt-1">{aiStats.promptTokens > 0 ? `${aiStats.promptTokens.toLocaleString()} prompt · ${aiStats.completionTokens.toLocaleString()} compl.` : 'Aucun appel enregistré'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Coût réel (GPT-4o-mini)</p>
                  <p className="text-xl font-bold text-gray-900">${aiStats.totalCost > 0 ? aiStats.totalCost.toFixed(4) : '0.00'}</p>
                  <p className="text-xs text-gray-400 mt-1">$0.15 / 1M tokens</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">APIs utilisées</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">GPT-4o-mini</span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">ExerciseDB</span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">wger</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
