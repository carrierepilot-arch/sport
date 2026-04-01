'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface UserRow {
 id: string;
 email: string;
 name: string | null;
 pseudo: string | null;
 profileImageUrl?: string | null;
 profileVisibility?: 'public' | 'private';
 isAdmin: boolean;
 adminLevel?: number;
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

interface ApiStatsPayload {
 apiByDay: Array<Record<string, number | string>>;
 apiTotals: Record<string, number>;
 openAi: { tokens: number; cost: number };
}

interface TrendDay { label: string; count: number }
interface TopUser { display: string; email: string; messages: number; friendRequests: number }

type AdminTab = 'overview' | 'users' | 'logs' | 'analytics' | 'performances' | 'suggestions' | 'exerciseScraper' | 'controlCenter' | 'posts';

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

interface StorageStats {
 usedBytes: number;
 quotaBytes: number;
 remainingBytes: number;
 fileCount?: number;
}

type FileCategory = 'video' | 'image' | 'audio' | 'other';

interface SupabaseBucketStats {
 name: string;
 fileCount: number;
 totalBytes: number;
 byType: Partial<Record<FileCategory, { count: number; bytes: number }>>;
 topFiles: { path: string; size: number; mimeType: string }[];
}

interface SupabaseStats {
 updatedAt: string;
 storage: {
 usedBytes: number;
 quotaBytes: number;
 remainingBytes: number;
 usedPercent: number;
 fileCount: number;
 };
 bandwidth: { quotaBytes: number; note: string };
 limits: {
 storage: { bytes: number; label: string };
 bandwidth: { bytes: number; label: string };
 database: { bytes: number; label: string };
 };
 buckets: SupabaseBucketStats[];
}

interface DirectConversationRow {
 key: string;
 messageId: string;
 sender: string;
 recipient: string;
 preview: string;
 reason: string | null;
 reportCount: number;
 lastAt: string;
}

interface GroupConversationRow {
 id: string;
 messageId: string;
 name: string;
 owner: string;
 preview: string;
 reason: string | null;
 members: number;
 messages: number;
 createdAt: string;
}

interface ReportRow {
 id: string;
 targetType: string;
 targetId: string;
 reason: string | null;
 createdAt: string;
 reporter: { id: string; pseudo: string | null; name: string | null; email: string };
 reportedUser: { id: string; pseudo: string | null; name: string | null; email: string } | null;
}

interface ReportTotalRow {
 key: string;
 reportedUserId: string | null;
 reportedDisplay: string;
 total: number;
 lastAt: string;
}

interface SuggestionRow {
 id: string;
 text: string;
 category: string;
 status: string;
 createdAt: string;
 user: { id: string; pseudo: string | null; name: string | null; email: string } | null;
}

interface ScraperSummary {
 exists: boolean;
 generatedAt: string | null;
 pagesVisited: number;
 rawItems: number;
 uniqueExercises: number;
 config: { maxPagesPerSource?: number; timeoutMs?: number; delayMs?: number; seedCount?: number; topic?: string | null } | null;
 filePath: string;
}

interface ControlSection {
 key: string;
 label: string;
 paths: string[];
 status: 'active' | 'disabled' | 'standby' | 'stopped' | 'hidden';
 maintenanceMessage: string | null;
 updatedAt: string;
}

interface ControlRateLimit {
 enabled: boolean;
 maxRequests: number;
 windowMs: number;
 mutatingOnly: boolean;
}

interface ControlCenterPayload {
 config: {
 sections: Record<string, ControlSection>;
 rateLimit: ControlRateLimit;
 updatedAt: string;
 };
 analytics: {
 reportClassification: { groups: number; private: number; other: number };
 interactions: { directMessages7d: number; groupMessages7d: number; friendRequests7d: number; reports7d: number };
 conversationTypes: { directConversations: number; directMessagesTotal: number; groupConversations: number; groupMessagesTotal: number };
 };
}

interface ScraperCandidate {
 id: string;
 sourceName: string;
 translatedName: string;
 translatedDescription: string;
 categories: string[];
 sourceCount: number;
 qualityScore: number;
 existsInDb: boolean;
}

function authHeader(): HeadersInit {
 const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
 return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function fmt(date: string) {
 return new Date(date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number): string {
 if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
 const units = ['B', 'KB', 'MB', 'GB', 'TB'];
 let value = bytes;
 let idx = 0;
 while (value >= 1024 && idx < units.length - 1) {
 value /= 1024;
 idx++;
 }
 return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function isZipProofUrl(url: string | null | undefined): boolean {
 return !!url && /\.zip($|\?)/i.test(url);
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
 exercisedb_api_call: { label: 'Appel ExerciseDB', color: 'bg-green-50 text-green-700' },
 wger_api_call: { label: 'Appel Wger', color: 'bg-purple-50 text-purple-700' },
 ncbi_api_call: { label: 'Appel NCBI', color: 'bg-cyan-50 text-cyan-700' },
 'admin.user.admin_toggle': { label: 'Admin: droits', color: 'bg-red-50 text-red-700' },
 'admin.user.level_change': { label: 'Admin: niveau', color: 'bg-red-50 text-red-700' },
 'admin.user.suspend_toggle': { label: 'Admin: suspension', color: 'bg-red-50 text-red-700' },
 'admin.user.reset_password': { label: 'Admin: reset mdp', color: 'bg-red-50 text-red-700' },
 'admin.user.delete': { label: 'Admin: suppression', color: 'bg-red-50 text-red-700' },
 'admin.user.profile_moderation': { label: 'Admin: moderation profil', color: 'bg-red-50 text-red-700' },
 'admin.performance.update': { label: 'Admin: modif perf', color: 'bg-red-50 text-red-700' },
 'admin.performance.delete': { label: 'Admin: suppression perf', color: 'bg-red-50 text-red-700' },
 'admin.performance.video_delete': { label: 'Admin: suppression video', color: 'bg-red-50 text-red-700' },
 'admin.scraper.run': { label: 'Admin: scrape', color: 'bg-red-50 text-red-700' },
 'admin.scraper.stream_run': { label: 'Admin: scrape stream', color: 'bg-red-50 text-red-700' },
 'admin.suggestion.status_update': { label: 'Admin: suggestion', color: 'bg-red-50 text-red-700' },
 'admin.challenge.approve': { label: 'Admin: challenge approve', color: 'bg-red-50 text-red-700' },
 'admin.challenge.reject': { label: 'Admin: challenge reject', color: 'bg-red-50 text-red-700' },
 'admin.challenge.delete': { label: 'Admin: challenge delete', color: 'bg-red-50 text-red-700' },
 'admin.challenge.toggle_public': { label: 'Admin: challenge public', color: 'bg-red-50 text-red-700' },
 'admin.spot.status_update': { label: 'Admin: spot status', color: 'bg-red-50 text-red-700' },
 'admin.spot.delete': { label: 'Admin: spot delete', color: 'bg-red-50 text-red-700' },
 'admin.conversation.delete_direct': { label: 'Admin: suppression DM', color: 'bg-red-50 text-red-700' },
 'admin.conversation.delete_group': { label: 'Admin: suppression groupe', color: 'bg-red-50 text-red-700' },
 'admin.message.send': { label: 'Admin: message', color: 'bg-red-50 text-red-700' },
 };
 return map[action] ?? { label: action, color: 'bg-gray-100 text-gray-600' };
}

export default function AdminPage() {
 const router = useRouter();
 const [tab, setTab] = useState<AdminTab>('overview');
 const [users, setUsers] = useState<UserRow[]>([]);
 const [logs, setLogs] = useState<LogRow[]>([]);
 const [stats, setStats] = useState<Stats | null>(null);
 const [apiStats, setApiStats] = useState<ApiStatsPayload | null>(null);
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
 const [performanceSearch, setPerformanceSearch] = useState('');
 const [performanceStatusFilter, setPerformanceStatusFilter] = useState('');
 const [performanceSort, setPerformanceSort] = useState<'recent' | 'score_desc' | 'score_asc'>('recent');
 const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
 const [supabaseStats, setSupabaseStats] = useState<SupabaseStats | null>(null);
 const [supabaseStatsLoading, setSupabaseStatsLoading] = useState(false);
 const [supabaseStatsError, setSupabaseStatsError] = useState<string | null>(null);
 const [editingPerf, setEditingPerf] = useState<string | null>(null);
 const [editScore, setEditScore] = useState('');
 const [editStatus, setEditStatus] = useState('');
 const [apiTestProvider, setApiTestProvider] = useState<'exerciseDB' | 'wger' | 'ncbi' | 'openai'>('exerciseDB');
 const [apiTestQuery, setApiTestQuery] = useState('push up');
 const [apiTestLoading, setApiTestLoading] = useState(false);
 const [apiTestResult, setApiTestResult] = useState<string>('');
 const [directConversations, setDirectConversations] = useState<DirectConversationRow[]>([]);
 const [groupConversations, setGroupConversations] = useState<GroupConversationRow[]>([]);
 const [reports, setReports] = useState<ReportRow[]>([]);
 const [reportTotals, setReportTotals] = useState<ReportTotalRow[]>([]);
 const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
 const [suggestionsUnavailable, setSuggestionsUnavailable] = useState(false);
 const [feedPosts, setFeedPosts] = useState<Array<{ id: string; content: string; createdAt: string; author: { id: string; pseudo: string } }>>([]);
 const [feedPostsLoading, setFeedPostsLoading] = useState(false);
 const [deletingPost, setDeletingPost] = useState<string | null>(null);
 const [scraperSummary, setScraperSummary] = useState<ScraperSummary | null>(null);
 const [scraperDbCount, setScraperDbCount] = useState(0);
 const [scraperRunning, setScraperRunning] = useState(false);
 const [scrapeMaxPages, setScrapeMaxPages] = useState('8');
 const [scrapeTimeoutMs, setScrapeTimeoutMs] = useState('9000');
 const [scrapeMinSources, setScrapeMinSources] = useState('2');
 const [scrapeMinQuality, setScrapeMinQuality] = useState('5');
 const [scrapeTopic, setScrapeTopic] = useState('');
 const [scraperOutput, setScraperOutput] = useState('');
 const [scrapeLog, setScrapeLog] = useState<string[]>([]);
 const [scrapeProgress, setScrapeProgress] = useState<{
 phase: 'idle' | 'scraping' | 'importing' | 'done' | 'error';
 currentSource: string;
 sourceIndex: number;
 sourceTotal: number;
 pagesVisited: number;
 exercisesFound: number;
 rawItems: number;
 } | null>(null);
 const scrapeLogRef = useRef<HTMLPreElement>(null);
 const [exercisesList, setExercisesList] = useState<Array<{ id: string; name: string; sourceName: string; qualityScore: number; sourceCount: number; categories: string[]; createdAt: string }>>([]);
 const [exercisesPage, setExercisesPage] = useState(1);
 const [exercisesTotal, setExercisesTotal] = useState(0);
 const exercisesPageSize = 10;
 const [exercisesSearch, setExercisesSearch] = useState('');
 const [exercisesMinQuality, setExercisesMinQuality] = useState('0');
 const [exercisesLoading, setExercisesLoading] = useState(false);
 const [controlCenter, setControlCenter] = useState<ControlCenterPayload | null>(null);
 const [savingControlCenter, setSavingControlCenter] = useState(false);
 const [scraperCandidates, setScraperCandidates] = useState<ScraperCandidate[]>([]);
 const [candidatesLoading, setCandidatesLoading] = useState(false);
 const [candidateSelection, setCandidateSelection] = useState<Record<string, boolean>>({});

 const charger = useCallback(async () => {
 setLoading(true);
 setError('');
 const h = authHeader();
 const safe = async (url: string) => {
 try {
 const r = await fetch(url, { headers: h });
 if (r.status === 403) return { __forbidden: true };
 const json = await r.json().catch(() => ({}));
 if (!r.ok) return { __error: true, __status: r.status, __message: json?.error || `Erreur ${r.status}` };
 return json;
 } catch {
 return { __error: true, __status: 0, __message: 'Erreur réseau' };
 }
 };
 try {
 const [uData, lData, sData, pData, convData, repData, sugData, scraperData, controlData] = await Promise.all([
 safe('/api/admin/users'),
 safe('/api/admin/logs'),
 safe('/api/admin/stats'),
 safe('/api/admin/performances'),
 safe('/api/admin/conversations'),
 safe('/api/admin/reports'),
 safe('/api/admin/suggestions'),
 safe('/api/admin/exercises-scraper'),
 safe('/api/admin/control-center'),
 ]);
 if ('__forbidden' in pData) {
 setLoading(false);
 setError('Accès non autorisé');
 router.push('/dashboard');
 return;
 }
 if ('__error' in uData && !('__forbidden' in uData)) {
 setLoading(false);
 setError(`Utilisateurs: ${uData.__message}`);
 return;
 }
 if ('__error' in lData && !('__forbidden' in lData)) {
 setLoading(false);
 setError(`Activité: ${lData.__message}`);
 return;
 }
 setUsers('__forbidden' in uData || '__error' in uData ? [] : (uData.users ?? []));
 setLogs('__forbidden' in lData || '__error' in lData ? [] : (lData.logs ?? []));
 setPerformances('__forbidden' in pData || '__error' in pData ? [] : (pData.performances ?? []));
 setStorageStats('__forbidden' in pData || '__error' in pData ? null : (pData.storage ?? null));
 setStats('__forbidden' in sData || '__error' in sData ? null : (sData.stats ?? null));
 setApiStats('__forbidden' in sData || '__error' in sData ? null : (sData.apiStats ?? null));
 setRecentSessions('__forbidden' in sData || '__error' in sData ? [] : (sData.recentSessions ?? []));
 setRegistrationsByDay('__forbidden' in sData || '__error' in sData ? [] : (sData.registrationsByDay ?? []));
 setMessagesByDay('__forbidden' in sData || '__error' in sData ? [] : (sData.messagesByDay ?? []));
 setTopUsers('__forbidden' in sData || '__error' in sData ? [] : (sData.topUsers ?? []));
 setDirectConversations('__forbidden' in convData || '__error' in convData ? [] : (convData.directConversations ?? []));
 setGroupConversations('__forbidden' in convData || '__error' in convData ? [] : (convData.groupConversations ?? []));
 setReports('__forbidden' in repData || '__error' in repData ? [] : (repData.reports ?? []));
 setReportTotals('__forbidden' in repData || '__error' in repData ? [] : (repData.reportTotals ?? []));
 if (!('__error' in sugData) && !('__forbidden' in sugData)) {
 setSuggestions(sugData.suggestions ?? []);
 setSuggestionsUnavailable(Boolean(sugData.unavailable));
 } else {
 setSuggestions([]);
 setSuggestionsUnavailable(true);
 }
 if (!('__error' in scraperData) && !('__forbidden' in scraperData)) {
 setScraperSummary((scraperData.summary ?? null) as ScraperSummary | null);
 setScraperDbCount(Number(scraperData.dbCount ?? 0));
 }
 if (!('__error' in controlData) && !('__forbidden' in controlData)) {
 setControlCenter(controlData as ControlCenterPayload);
 }
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
 const data = await res.json();
 setUsers(prev => prev.map(u => u.id === userId ? { ...u, isAdmin: data.user?.isAdmin ?? isAdmin, adminLevel: data.user?.adminLevel ?? (isAdmin ? 1 : 0) } : u));
 } else {
 const data = await res.json();
 alert(data.error || 'Erreur');
 }
 } catch { alert('Erreur réseau'); }
 setActionLoading(null);
 };

 const setAdminLevel = async (userId: string, adminLevel: number) => {
 setActionLoading(userId);
 try {
 const res = await fetch(`/api/admin/users/${userId}`, {
 method: 'PATCH',
 headers: authHeader(),
 body: JSON.stringify({ adminLevel }),
 });
 const data = await res.json().catch(() => ({}));
 if (res.ok) {
 setUsers(prev => prev.map(u => u.id === userId ? { ...u, adminLevel: Number(data.user?.adminLevel ?? adminLevel) } : u));
 } else {
 alert(data.error || 'Erreur');
 }
 } catch {
 alert('Erreur réseau');
 }
 setActionLoading(null);
 };

 const moderatePseudo = async (user: UserRow) => {
	 const nextPseudo = window.prompt('Nouveau pseudo:', user.pseudo ?? '');
	 if (nextPseudo === null) return;
	 const cleaned = nextPseudo.trim();
	 if (!cleaned) return;
	 setActionLoading(user.id);
	 try {
		 const res = await fetch(`/api/admin/users/${user.id}`, {
			 method: 'PATCH',
			 headers: authHeader(),
			 body: JSON.stringify({ pseudo: cleaned }),
		 });
		 const data = await res.json().catch(() => ({}));
		 if (!res.ok) {
			 alert(data.error || 'Erreur');
		 } else {
			 setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, pseudo: data.user?.pseudo ?? cleaned } : u)));
		 }
	 } catch {
		 alert('Erreur reseau');
	 }
	 setActionLoading(null);
 };

 const moderateName = async (user: UserRow) => {
	 const nextName = window.prompt('Nouveau nom (laisser vide pour supprimer):', user.name ?? '');
	 if (nextName === null) return;
	 setActionLoading(user.id);
	 try {
		 const res = await fetch(`/api/admin/users/${user.id}`, {
			 method: 'PATCH',
			 headers: authHeader(),
			 body: JSON.stringify({ name: nextName }),
		 });
		 const data = await res.json().catch(() => ({}));
		 if (!res.ok) {
			 alert(data.error || 'Erreur');
		 } else {
			 setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, name: data.user?.name ?? null } : u)));
		 }
	 } catch {
		 alert('Erreur reseau');
	 }
	 setActionLoading(null);
 };

 const removeProfilePhoto = async (user: UserRow) => {
	 if (!confirm(`Supprimer la photo de profil de ${user.email} ?`)) return;
	 setActionLoading(user.id);
	 try {
		 const res = await fetch(`/api/admin/users/${user.id}`, {
			 method: 'PATCH',
			 headers: authHeader(),
			 body: JSON.stringify({ removeProfileImage: true }),
		 });
		 const data = await res.json().catch(() => ({}));
		 if (!res.ok) {
			 alert(data.error || 'Erreur');
		 } else {
			 setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, profileImageUrl: data.user?.profileImageUrl ?? null } : u)));
		 }
	 } catch {
		 alert('Erreur reseau');
	 }
	 setActionLoading(null);
 };

 const uploadProfilePhoto = async (user: UserRow, file: File | null) => {
	 if (!file) return;
	 setActionLoading(user.id);
	 try {
		 const formData = new FormData();
		 formData.append('image', file);
		 const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
		 const uploadRes = await fetch('/api/feed/upload-image', {
			 method: 'POST',
			 headers: token ? { Authorization: `Bearer ${token}` } : {},
			 body: formData,
		 });
		 const uploadData = await uploadRes.json().catch(() => ({}));
		 if (!uploadRes.ok) { alert(uploadData.error || 'Erreur upload'); setActionLoading(null); return; }
		 const patchRes = await fetch(`/api/admin/users/${user.id}`, {
			 method: 'PATCH',
			 headers: authHeader(),
			 body: JSON.stringify({ profileImageUrl: uploadData.imageUrl }),
		 });
		 const patchData = await patchRes.json().catch(() => ({}));
		 if (!patchRes.ok) {
			 alert(patchData.error || 'Erreur');
		 } else {
			 setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, profileImageUrl: patchData.user?.profileImageUrl ?? uploadData.imageUrl } : u)));
		 }
	 } catch {
		 alert('Erreur reseau');
	 }
	 setActionLoading(null);
 };

 const sendAdminMessage = async (userId: string, email: string) => {
 const text = prompt(`Message admin a envoyer a ${email}`);
 if (!text || !text.trim()) return;

 setActionLoading(userId);
 try {
 const res = await fetch('/api/admin/messages', {
 method: 'POST',
 headers: { ...authHeader(), 'Content-Type': 'application/json' },
 body: JSON.stringify({ receiverId: userId, content: text.trim() }),
 });
 const data = await res.json().catch(() => ({}));
 if (res.ok) {
 alert('Message admin envoye.');
 } else {
 alert(data.error || 'Erreur envoi message');
 }
 } catch {
 alert('Erreur reseau');
 }
 setActionLoading(null);
 };

 const deleteReportedContent = async (report: ReportRow) => {
	 if (report.targetType !== 'feed_post') {
		 alert('Action rapide dispo uniquement pour les posts du feed.');
		 return;
	 }
	 if (!confirm('Supprimer ce contenu signale ?')) return;
	 setActionLoading(report.id);
	 try {
		 const res = await fetch(`/api/feed/${report.targetId}`, {
			 method: 'DELETE',
			 headers: authHeader(),
		 });
		 const data = await res.json().catch(() => ({}));
		 if (!res.ok) {
			 alert(data.error || 'Erreur lors de la moderation');
		 } else {
			 setReports(prev => prev.filter(r => r.targetId !== report.targetId));
		 }
	 } catch {
		 alert('Erreur reseau');
	 }
	 setActionLoading(null);
 };

 const resetPassword = async (userId: string, email: string) => {
 if (!confirm(`Réinitialiser le mot de passe de ${email} ? Un mot de passe temporaire sera généré.`)) return;
 setActionLoading(userId);
 try {
 const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
 method: 'POST',
 headers: authHeader(),
 });
 const data = await res.json();
 if (res.ok && data.tempPassword) {
 alert(`Mot de passe temporaire pour ${email} :\n\n${data.tempPassword}\n\nCommuniquez-le de manière sécurisée.`);
 } else {
 alert(data.error || 'Erreur');
 }
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

 const deletePerfVideo = async (perfId: string) => {
 if (!confirm('Supprimer uniquement la video/preuve de cette performance ?')) return;
 setActionLoading(perfId);
 try {
 const res = await fetch('/api/admin/performances', {
 method: 'DELETE',
 headers: authHeader(),
 body: JSON.stringify({ performanceId: perfId, videoOnly: true }),
 });
 if (res.ok) {
 const { performance } = await res.json();
 setPerformances((prev) => prev.map((p) => (p.id === perfId ? { ...p, videoUrl: performance?.videoUrl ?? null } : p)));
 await charger();
 } else {
 const data = await res.json();
 alert(data.error || 'Erreur');
 }
 } catch {
 alert('Erreur réseau');
 }
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

 const runApiTest = async () => {
 if (!apiTestQuery.trim()) return;
 setApiTestLoading(true);
 setApiTestResult('');
 try {
 const res = await fetch('/api/admin/api-test', {
 method: 'POST',
 headers: authHeader(),
 body: JSON.stringify({ provider: apiTestProvider, query: apiTestQuery.trim() }),
 });
 const data = await res.json();
 setApiTestResult(JSON.stringify(data, null, 2));
 } catch {
 setApiTestResult(JSON.stringify({ error: 'Erreur réseau' }, null, 2));
 }
 setApiTestLoading(false);
 };

 const deleteConversation = async (payload: { type: 'direct'; messageId: string } | { type: 'group'; groupId: string }) => {
 if (!confirm('Supprimer cette conversation ? Cette action est irréversible.')) return;
 setActionLoading(payload.type === 'direct' ? payload.messageId : payload.groupId);
 try {
 const res = await fetch('/api/admin/conversations', {
 method: 'DELETE',
 headers: authHeader(),
 body: JSON.stringify(payload),
 });
 if (res.ok) {
 await charger();
 }
 } catch {
 // silent
 }
 setActionLoading(null);
 };

 const updateSuggestionStatus = async (suggestionId: string, status: SuggestionRow['status']) => {
 setActionLoading(suggestionId);
 try {
 const res = await fetch('/api/admin/suggestions', {
 method: 'PATCH',
 headers: authHeader(),
 body: JSON.stringify({ suggestionId, status }),
 });
 const data = await res.json().catch(() => ({}));
 if (res.ok && data.suggestion) {
 setSuggestions((prev) => prev.map((item) => (item.id === suggestionId ? data.suggestion : item)));
 } else {
 alert(data.error || 'Erreur');
 }
 } catch {
 alert('Erreur réseau');
 }
 setActionLoading(null);
 };

 const runExerciseScraper = async () => {
 setScraperRunning(true);
 setScrapeLog([]);
 setScraperOutput('');
 setScrapeProgress({ phase: 'scraping', currentSource: '', sourceIndex: 0, sourceTotal: 0, pagesVisited: 0, exercisesFound: 0, rawItems: 0 });

 const cumulativeLog: string[] = [];
 const appendLog = (msg: string) => {
 cumulativeLog.push(msg);
 setScrapeLog([...cumulativeLog]);
 // Auto-scroll to bottom
 setTimeout(() => {
 if (scrapeLogRef.current) {
 scrapeLogRef.current.scrollTop = scrapeLogRef.current.scrollHeight;
 }
 }, 0);
 };

 try {
 const res = await fetch('/api/admin/exercises-scraper/stream', {
 method: 'POST',
 headers: authHeader(),
 body: JSON.stringify({
 maxPages: Number(scrapeMaxPages),
 timeoutMs: Number(scrapeTimeoutMs),
 minSources: Number(scrapeMinSources),
 minQuality: Number(scrapeMinQuality),
 topic: scrapeTopic.trim(),
 }),
 });

 if (!res.ok || !res.body) {
 const data = await res.json().catch(() => ({})) as Record<string, unknown>;
 appendLog((data.error as string) || 'Erreur pendant le scraping');
 setScrapeProgress((prev) => prev ? { ...prev, phase: 'error' } : null);
 setScraperRunning(false);
 return;
 }

 const reader = res.body.getReader();
 const decoder = new TextDecoder();
 let buffer = '';

 while (true) {
 const { done, value } = await reader.read();
 if (done) break;

 buffer += decoder.decode(value, { stream: true });
 const chunks = buffer.split('\n\n');
 buffer = chunks.pop() ?? '';

 for (const chunk of chunks) {
 const line = chunk.trim();
 if (!line.startsWith('data: ')) continue;
 try {
 const event = JSON.parse(line.slice(6)) as Record<string, unknown>;

 if (event.type === 'start') {
 setScrapeProgress({ phase: 'scraping', currentSource: '', sourceIndex: 0, sourceTotal: Number(event.totalSources), pagesVisited: 0, exercisesFound: 0, rawItems: 0 });
 appendLog(`Demarrage: ${event.totalSources} sources${event.topic ? `, sujet: ${event.topic}` : ''}`);
 } else if (event.type === 'source_start') {
 setScrapeProgress((prev) => prev ? { ...prev, sourceIndex: Number(event.index), sourceTotal: Number(event.total), currentSource: String(event.url) } : null);
 appendLog(`[${event.index}/${event.total}] → ${event.url}`);
 } else if (event.type === 'page_done') {
 setScrapeProgress((prev) => prev ? { ...prev, pagesVisited: Number(event.pagesVisited), rawItems: Number(event.totalItems) } : null);
 } else if (event.type === 'source_done') {
 appendLog(` ✓ pages=${event.pagesVisited} exercices trouvés=${event.items}`);
 } else if (event.type === 'done') {
 setScrapeProgress((prev) => prev ? { ...prev, phase: 'importing', pagesVisited: Number(event.pagesVisited), rawItems: Number(event.rawItems), exercisesFound: Number(event.uniqueExercises) } : null);
 appendLog(`Scrape terminé — ${event.uniqueExercises} exercices uniques (${event.rawItems} bruts, ${event.pagesVisited} pages)`);
 } else if (event.type === 'import_start') {
 appendLog('Import en base de données...');
 } else if (event.type === 'import_done') {
 setScraperDbCount(Number(event.dbCount));
 setScrapeProgress((prev) => prev ? { ...prev, phase: 'done' } : null);
 appendLog(`Import terminé — ${event.upserted ?? '?'} ajoutés/mis à jour, ${event.dbCount} en DB total`);
 } else if (event.type === 'finished') {
 appendLog('--- Terminé ---');
 charger().catch(() => null);
 } else if (event.type === 'log') {
 appendLog(String(event.message));
 } else if (event.type === 'error') {
 appendLog(`ERREUR [${event.phase}]: ${event.message}`);
 setScrapeProgress((prev) => prev ? { ...prev, phase: 'error' } : null);
 }
 } catch {
 // ignore malformed event
 }
 }
 }
 } catch {
 appendLog('Erreur réseau');
 setScrapeProgress((prev) => prev ? { ...prev, phase: 'error' } : null);
 }

 setScraperRunning(false);
 };

 const loadExercises = useCallback(async (page: number = 1, search: string = '', minQuality: string = '') => {
 setExercisesLoading(true);
 try {
 const params = new URLSearchParams({
 page: String(page),
 pageSize: String(exercisesPageSize),
 ...(search && { search }),
 ...(minQuality && Number(minQuality) > 0 && { minQuality }),
 });
 const res = await fetch(`/api/admin/exercises-list?${params}`, { headers: authHeader() });
 const data = await res.json().catch(() => ({}));
 if (res.ok && data.items) {
 setExercisesList(data.items);
 setExercisesTotal(data.total ?? 0);
 setExercisesPage(data.page ?? 1);
 }
 } catch {
 // error fetching
 }
 setExercisesLoading(false);
 }, [exercisesPageSize]);

 const loadScraperCandidates = useCallback(async () => {
 setCandidatesLoading(true);
 try {
 const res = await fetch('/api/admin/exercises-scraper/candidates', { headers: authHeader() });
 const data = await res.json().catch(() => ({}));
 if (res.ok && Array.isArray(data.candidates)) {
 const items = data.candidates as ScraperCandidate[];
 setScraperCandidates(items);
 setCandidateSelection(Object.fromEntries(items.map((item) => [item.id, !item.existsInDb])));
 } else {
 setScraperCandidates([]);
 }
 } catch {
 setScraperCandidates([]);
 }
 setCandidatesLoading(false);
 }, []);

 const saveControlCenter = async () => {
 if (!controlCenter) return;
 setSavingControlCenter(true);
 try {
 const sectionUpdates = Object.values(controlCenter.config.sections).map((section) => ({
 key: section.key,
 status: section.status,
 maintenanceMessage: section.maintenanceMessage,
 }));
 const res = await fetch('/api/admin/control-center', {
 method: 'PATCH',
 headers: authHeader(),
 body: JSON.stringify({ sectionUpdates, rateLimit: controlCenter.config.rateLimit }),
 });
 const data = await res.json().catch(() => ({}));
 if (res.ok && data.config) {
 setControlCenter(data as ControlCenterPayload);
 alert('Controle admin mis a jour.');
 } else {
 alert(data.error || 'Erreur de sauvegarde');
 }
 } catch {
 alert('Erreur reseau');
 }
 setSavingControlCenter(false);
 };

 const saveValidatedCandidates = async () => {
 const ids = Object.entries(candidateSelection)
 .filter(([, selected]) => selected)
 .map(([id]) => id);

 if (ids.length === 0) {
 alert('Selectionne au moins un exercice.');
 return;
 }

 setCandidatesLoading(true);
 try {
 const res = await fetch('/api/admin/exercises-scraper/candidates', {
 method: 'POST',
 headers: authHeader(),
 body: JSON.stringify({ ids }),
 });
 const data = await res.json().catch(() => ({}));
 if (res.ok) {
 alert(`Enregistrement termine: ${data.upserted ?? 0} exercice(s).`);
 await Promise.all([loadScraperCandidates(), charger()]);
 } else {
 alert(data.error || 'Erreur lors de lenregistrement');
 }
 } catch {
 alert('Erreur reseau');
 }
 setCandidatesLoading(false);
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

 const filteredPerformances = performances
 .filter((performance) => {
 if (performanceStatusFilter && performance.status !== performanceStatusFilter) return false;
 if (!performanceSearch.trim()) return true;
 const search = performanceSearch.toLowerCase();
 return [
 performance.exercise,
 performance.status,
 performance.user.pseudo ?? '',
 performance.user.name ?? '',
 performance.user.email,
 performance.spot?.name ?? '',
 performance.spot?.city ?? '',
 ].some((value) => value.toLowerCase().includes(search));
 })
 .sort((left, right) => {
 if (performanceSort === 'score_desc') return right.score - left.score;
 if (performanceSort === 'score_asc') return left.score - right.score;
 return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
 });

 const workoutGenerations = logs.filter(l => l.action === 'workout_generated').length;
 const aiApiCalls = apiStats?.apiTotals?.openai ?? 0;
 const exerciseDbApiCalls = apiStats?.apiTotals?.exerciseDB ?? 0;
 const wgerApiCalls = apiStats?.apiTotals?.wger ?? 0;
 const ncbiApiCalls = apiStats?.apiTotals?.ncbi ?? 0;
 // Parse real token usage from AI call logs
 const aiStats = {
 totalTokens: apiStats?.openAi?.tokens ?? 0,
 promptTokens: 0,
 completionTokens: 0,
 totalCost: apiStats?.openAi?.cost ?? 0,
 };
 const totalActions = logs.length;
 const actionsPerUser = stats && stats.totalUsers > 0 ? (totalActions / stats.totalUsers).toFixed(1) : '0';
 const messagesPerUser = stats && stats.totalUsers > 0 ? (stats.totalMessages / stats.totalUsers).toFixed(1) : '0';
 const activeUsers = users.filter(u => u.sessions.length > 0).length;
 const suspendedUsers = users.filter(u => u.suspended).length;
 const adminUsers = users.filter(u => u.isAdmin).length;
 const newSuggestions = suggestions.filter((item) => item.status === 'new').length;
 const reviewedSuggestions = suggestions.filter((item) => item.status === 'reviewed').length;
 const doneSuggestions = suggestions.filter((item) => item.status === 'done').length;

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

 const loadSupabaseStats = useCallback(async () => {
 setSupabaseStatsLoading(true);
 setSupabaseStatsError(null);
 try {
 const res = await fetch('/api/admin/supabase-stats', { headers: authHeader() });
 if (!res.ok) {
 let msg = `HTTP ${res.status}`;
 if (res.status === 429) msg = 'Trop de requêtes. Patientez quelques secondes.';
 if (res.status === 403) msg = 'Accès non autorisé.';
 if (res.status >= 500) msg = 'Erreur serveur. Réessayez.';
 throw new Error(msg);
 }
 const data: SupabaseStats = await res.json();
 setSupabaseStats(data);
 } catch (err) {
 console.error('[supabase-stats]', err);
 setSupabaseStatsError(String(err));
 } finally {
 setSupabaseStatsLoading(false);
 }
 }, []);

 useEffect(() => {
 if (tab !== 'performances') return;
 loadSupabaseStats();
 const interval = setInterval(loadSupabaseStats, 60_000);
 return () => clearInterval(interval);
 }, [tab, loadSupabaseStats]);

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
 <main className="flex-1 px-2 py-5 sm:px-6 md:px-8 md:py-10 overflow-x-hidden">
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
 <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
 <button onClick={charger} className="px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg hover:border-gray-400 transition font-medium text-gray-600">
 ↻ Actualiser
 </button>
 <button onClick={() => router.push('/dashboard/profil')} className="px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg hover:border-gray-400 transition font-medium text-gray-600">
 ← Retour profil
 </button>
 </div>
 </div>

 {/* Onglets — scrollable */}
 <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 mb-5 sm:mb-8 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
 <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit min-w-fit">
 {([
 { key: 'posts', label: `Posts feed (${feedPosts.length})`, shortLabel: `Posts (${feedPosts.length})` },
 { key: 'overview', label: 'Vue globale', shortLabel: 'Global' },
 { key: 'users', label: `Utilisateurs (${users.length})`, shortLabel: `Users (${users.length})` },
 { key: 'logs', label: `Activité (${logs.length})`, shortLabel: `Logs (${logs.length})` },
 { key: 'performances', label: ` Perfs (${performances.length})`, shortLabel: ` (${performances.length})` },
 { key: 'suggestions', label: ` Idees (${suggestions.length})`, shortLabel: ` (${suggestions.length})` },
 { key: 'exerciseScraper', label: ` Scraper exos (${scraperDbCount})`, shortLabel: ` (${scraperDbCount})` },
 { key: 'controlCenter', label: ' Controle total N3', shortLabel: ' N3' },
 { key: 'analytics', label: ' Analytics', shortLabel: ' Stats' },
 ] as { key: AdminTab; label: string; shortLabel: string }[]).map((t) => (
 <button
 key={t.key}
 onClick={() => {
 setTab(t.key);
 if (t.key === 'controlCenter') void loadScraperCandidates();
 if (t.key === 'posts') {
 setFeedPostsLoading(true);
 fetch('/api/feed?scope=all&limit=200', { headers: authHeader() })
 .then(r => r.json())
 .then(d => setFeedPosts(Array.isArray(d.posts) ? d.posts : []))
 .catch(() => {})
 .finally(() => setFeedPostsLoading(false));
 }
 }}
 className={`px-2.5 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
 <span className="sm:hidden">{t.shortLabel}</span>
 <span className="hidden sm:inline">{t.label}</span>
 </button>
 ))}
 </div>
 </div>

 {/* ── VUE GLOBALE ── */}
 {tab === 'overview' && stats && (
 <div className="space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
 {[
 { label: 'Utilisateurs inscrits', value: stats.totalUsers, icon: '', color: 'text-blue-600', sub: `+${stats.newUsersThisWeek} cette semaine` },
 { label: 'Messages échangés', value: stats.totalMessages, icon: '', color: 'text-purple-600', sub: `${messagesByDay.reduce((a, d) => a + d.count, 0)} ces 7 jours` },
 { label: 'Amitiés établies', value: stats.totalFriendships, icon: '', color: 'text-emerald-600', sub: `${stats.pendingFriendRequests} en attente` },
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
 { label: 'Demandes en attente', value: stats.pendingFriendRequests, icon: '', color: stats.pendingFriendRequests > 0 ? 'text-amber-600' : 'text-gray-400', sub: 'Non encore acceptées' },
 { label: 'Pseudos configurés', value: `${stats.usersWithPseudo} / ${stats.totalUsers}`, icon: '', color: 'text-sky-600', sub: stats.totalUsers > 0 ? `${Math.round((stats.usersWithPseudo / stats.totalUsers) * 100)}% des membres` : '—' },
 { label: 'Nouvelles inscriptions', value: stats.newUsersThisWeek, icon: '', color: stats.newUsersThisWeek > 0 ? 'text-emerald-600' : 'text-gray-400', sub: '7 derniers jours' },
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
 <div className="grid grid-cols-2 sm:flex gap-2">
 <select
 value={sortField}
 onChange={(e) => setSortField(e.target.value as typeof sortField)}
 className="col-span-2 sm:col-span-1 px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white text-gray-700"
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
 <span className="px-3 py-2 text-xs sm:text-sm text-gray-400 bg-gray-50 rounded-lg border border-gray-200 whitespace-nowrap text-center">
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
 <button onClick={() => toggleAdmin(u.id, !u.isAdmin)} disabled={actionLoading === u.id}
 className="px-2 py-1 text-xs font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-50">
 {u.isAdmin ? 'Retire' : 'Admin'}
 </button>
 {u.isAdmin && (
 <select
 value={u.adminLevel ?? 1}
 onChange={(e) => setAdminLevel(u.id, Number(e.target.value))}
 disabled={actionLoading === u.id}
 className="px-2 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-red-50 disabled:opacity-50"
 >
 <option value={1}>N1 Lecture</option>
 <option value={2}>N2 Perfs</option>
 <option value={3}>N3 Full</option>
 </select>
 )}
 {!u.isAdmin && (
 <>
 <button onClick={() => moderatePseudo(u)} disabled={actionLoading === u.id}
 className="px-2 py-1 text-xs font-medium rounded-lg border border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-50 transition disabled:opacity-50">Pseudo</button>
 <button onClick={() => moderateName(u)} disabled={actionLoading === u.id}
 className="px-2 py-1 text-xs font-medium rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 transition disabled:opacity-50">Nom</button>
 <button onClick={() => removeProfilePhoto(u)} disabled={actionLoading === u.id}
 className="px-2 py-1 text-xs font-medium rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition disabled:opacity-50">Suppr. photo</button>
 <label className={`cursor-pointer px-2 py-1 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition${actionLoading === u.id ? ' opacity-50 pointer-events-none' : ''}`}>
 Changer photo
 <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void uploadProfilePhoto(u, e.target.files?.[0] ?? null)} disabled={actionLoading === u.id} />
 </label>
 <button onClick={() => sendAdminMessage(u.id, u.email)} disabled={actionLoading === u.id}
 className="px-2 py-1 text-xs font-medium rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition disabled:opacity-50">Msg</button>
 <button onClick={() => toggleSuspend(u.id, !u.suspended)} disabled={actionLoading === u.id}
 className={`px-2 py-1 text-xs font-medium rounded-lg border transition ${u.suspended ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-amber-200 text-amber-700 hover:bg-amber-50'} disabled:opacity-50`}>
 {u.suspended ? 'Réact.' : 'Susp.'}
 </button>
 <button onClick={() => resetPassword(u.id, u.email)} disabled={actionLoading === u.id}
 className="px-2 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">Reset MDP</button>
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
 <div className="grid grid-cols-1 gap-1.5 text-xs mb-3">
 <div><span className="text-gray-400">Niveau:</span> <span className="font-medium text-gray-700">{u.level === 'elite' ? 'Élite' : u.level === 'intermediaire' ? 'Inter.' : 'Déb.'}</span></div>
 <div><span className="text-gray-400">Messages:</span> <span className="font-semibold text-gray-700">{u._count.sentMessages}</span></div>
 <div className="break-words"><span className="text-gray-400">Inscrit:</span> <span className="text-gray-600">{fmt(u.createdAt)}</span></div>
 <div className="break-words"><span className="text-gray-400">Dern. co:</span> <span className="text-gray-600">{u.sessions[0] ? fmt(u.sessions[0].lastSeen) : '—'}</span></div>
 </div>
 <div className="flex gap-2 flex-wrap">
 <button onClick={() => toggleAdmin(u.id, !u.isAdmin)} disabled={actionLoading === u.id}
 className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-50">{u.isAdmin ? 'Retire Admin' : '→ Admin'}</button>
 {u.isAdmin && (
 <select
 value={u.adminLevel ?? 1}
 onChange={(e) => setAdminLevel(u.id, Number(e.target.value))}
 disabled={actionLoading === u.id}
 className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-red-50 disabled:opacity-50"
 >
 <option value={1}>N1 Lecture</option>
 <option value={2}>N2 Perfs</option>
 <option value={3}>N3 Full</option>
 </select>
 )}
 {!u.isAdmin && (
 <>
 <button onClick={() => moderatePseudo(u)} disabled={actionLoading === u.id}
 className="px-3 py-1.5 text-xs font-medium rounded-lg border border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-50 transition disabled:opacity-50">Pseudo</button>
 <button onClick={() => moderateName(u)} disabled={actionLoading === u.id}
 className="px-3 py-1.5 text-xs font-medium rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 transition disabled:opacity-50">Nom</button>
 <button onClick={() => removeProfilePhoto(u)} disabled={actionLoading === u.id}
 className="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition disabled:opacity-50">Suppr. photo</button>
 <label className={`cursor-pointer px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition${actionLoading === u.id ? ' opacity-50 pointer-events-none' : ''}`}>
 Changer photo
 <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void uploadProfilePhoto(u, e.target.files?.[0] ?? null)} disabled={actionLoading === u.id} />
 </label>
 <button onClick={() => sendAdminMessage(u.id, u.email)} disabled={actionLoading === u.id}
 className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition disabled:opacity-50">Message</button>
 <button onClick={() => toggleSuspend(u.id, !u.suspended)} disabled={actionLoading === u.id}
 className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex-1 min-w-[80px] ${u.suspended ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-amber-200 text-amber-700 hover:bg-amber-50'} disabled:opacity-50`}>
 {u.suspended ? 'Réactiver' : 'Suspendre'}
 </button>
 <button onClick={() => resetPassword(u.id, u.email)} disabled={actionLoading === u.id}
 className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">Reset MDP</button>
 <button onClick={() => deleteUser(u.id, u.email)} disabled={actionLoading === u.id}
 className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50">Supprimer</button>
 </>
 )}
 </div>
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
 className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 sm:min-w-[240px]">
 <option value="">Toutes les actions</option>
 {Object.keys(actionDistribution).map(a => (
 <option key={a} value={a}>{actionLabel(a).label} ({actionDistribution[a]})</option>
 ))}
 </select>
 <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 rounded-lg border border-gray-200 self-start sm:self-auto">
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
 <div className="flex flex-col gap-1 text-xs text-gray-400">
 <span className="break-words">{l.details ?? '—'}</span>
 <span className="text-[11px]">{fmt(l.createdAt)}</span>
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

 {/* ── POSTS FEED (MODERATION) ── */}
 {tab === 'posts' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between gap-3">
 <div>
 <h2 className="text-lg font-black text-gray-900">Modération des posts</h2>
 <p className="text-sm text-gray-500">Supprimez les publications inappropriées du feed.</p>
 </div>
 <button
 onClick={() => {
 setFeedPostsLoading(true);
 fetch('/api/feed?scope=all&limit=200', { headers: authHeader() })
 .then(r => r.json())
 .then(d => setFeedPosts(Array.isArray(d.posts) ? d.posts : []))
 .catch(() => {})
 .finally(() => setFeedPostsLoading(false));
 }}
 className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
 >
 Actualiser
 </button>
 </div>
 {feedPostsLoading ? (
 <div className="py-12 text-center text-sm text-gray-400">Chargement des posts...</div>
 ) : feedPosts.length === 0 ? (
 <div className="py-12 text-center text-sm text-gray-400">Aucun post pour l&apos;instant.</div>
 ) : (
 <div className="space-y-3">
 {feedPosts.map((post) => {
 const rawText = post.content ?? '';
 const isImage = rawText.startsWith('__IMAGE__');
 const isVideo = rawText.startsWith('__VIDEO__');
 const firstLine = rawText.split('\n')[0] ?? '';
 const mediaUrl = (isImage || isVideo) ? firstLine.replace(/^__(IMAGE|VIDEO)__/, '').trim() : null;
 const caption = rawText.replace(/^__(IMAGE|VIDEO)__[^\n]*\n?/, '').trim();
 return (
 <div key={post.id} className="rounded-2xl border border-gray-200 bg-white p-4">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="text-xs font-bold text-gray-700">@{post.author?.pseudo ?? 'inconnu'}</p>
 <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleString('fr-FR')}</p>
 {isImage && mediaUrl && (
 <img src={mediaUrl} alt="" className="mt-2 max-h-32 rounded-xl border border-gray-100 object-cover" />
 )}
 {isVideo && mediaUrl && (
 <video src={mediaUrl} className="mt-2 max-h-32 rounded-xl border border-gray-100" controls muted />
 )}
 {caption && <p className="mt-2 text-sm text-gray-800 line-clamp-3 whitespace-pre-wrap">{caption}</p>}
 {!isImage && !isVideo && <p className="mt-2 text-sm text-gray-800 line-clamp-3 whitespace-pre-wrap">{rawText}</p>}
 </div>
 <button
 onClick={async () => {
 if (!confirm('Supprimer ce post définitivement ?')) return;
 setDeletingPost(post.id);
 try {
 const res = await fetch(`/api/feed/${post.id}`, { method: 'DELETE', headers: authHeader() });
 if (res.ok) setFeedPosts(prev => prev.filter(p => p.id !== post.id));
 else alert('Erreur lors de la suppression.');
 } catch { alert('Erreur réseau.'); }
 setDeletingPost(null);
 }}
 disabled={deletingPost === post.id}
 className="shrink-0 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold px-3 py-1.5 transition disabled:opacity-50"
 >
 {deletingPost === post.id ? '...' : 'Supprimer'}
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* ── PERFORMANCES ── */}
 {tab === 'performances' && (
 <div className="space-y-4">

 {/* Vercel Blob Monitoring Card */}
 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
 <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
 <div>
 <h2 className="text-sm font-semibold text-gray-900">Monitoring Stockage</h2>
 {supabaseStats && (
 <p className="text-xs text-gray-400 mt-0.5">
 Mis à jour il y a {Math.round((Date.now() - new Date(supabaseStats.updatedAt).getTime()) / 1000)}s
 </p>
 )}
 </div>
 <button
 onClick={loadSupabaseStats}
 disabled={supabaseStatsLoading}
 className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:border-gray-400 transition font-medium text-gray-600 disabled:opacity-40"
 >
 {supabaseStatsLoading ? '...' : '↻ Rafraîchir'}
 </button>
 </div>

 {supabaseStatsError && (
 <div className="px-4 sm:px-6 py-3 bg-red-50 border-b border-red-100">
 <p className="text-xs text-red-600">{supabaseStatsError}</p>
 </div>
 )}

 {!supabaseStats && !supabaseStatsLoading && !supabaseStatsError && (
 <div className="px-4 sm:px-6 py-8 text-center">
 <p className="text-sm text-gray-400">Cliquez sur Rafraîchir pour charger les stats.</p>
 </div>
 )}

 {supabaseStatsLoading && !supabaseStats && (
 <div className="px-4 sm:px-6 py-8 text-center">
 <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin mx-auto" />
 </div>
 )}

 {supabaseStats && (() => {
 const { storage, bandwidth, limits, buckets } = supabaseStats;
 const barColor = storage.usedPercent >= 90 ? 'bg-red-500' : storage.usedPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
 const catLabels: Record<string, string> = { video: 'Vidéos', image: 'Images', audio: 'Audio', other: 'Autres' };
 return (
 <div className="divide-y divide-gray-100">
 {/* Storage global */}
 <div className="px-4 sm:px-6 py-4">
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-medium text-gray-700">Stockage</span>
 <span className={`text-xs font-semibold ${storage.usedPercent >= 90 ? 'text-red-600' : storage.usedPercent >= 70 ? 'text-amber-600' : 'text-emerald-700'}`}>
 {formatBytes(storage.usedBytes)} / {limits.storage.label}
 </span>
 </div>
 <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
 <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, storage.usedPercent)}%` }} />
 </div>
 <div className="flex items-center justify-between">
 <span className="text-[11px] text-gray-400">{storage.usedPercent}% utilisé · {storage.fileCount} fichier{storage.fileCount !== 1 ? 's' : ''}</span>
 <span className="text-[11px] text-gray-400">Restant: {formatBytes(storage.remainingBytes)}</span>
 </div>
 </div>

 {/* Per-prefix breakdown */}
 {buckets.length > 0 && (
 <div className="px-4 sm:px-6 py-4">
 <p className="text-xs font-medium text-gray-700 mb-3">Dossiers ({buckets.length})</p>
 <div className="space-y-3">
 {buckets.map((b) => {
 const bPct = limits.storage.bytes > 0 ? Math.round((b.totalBytes / limits.storage.bytes) * 100) : 0;
 const bColor = bPct >= 90 ? 'bg-red-400' : bPct >= 70 ? 'bg-amber-400' : 'bg-blue-400';
 return (
 <div key={b.name}>
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs font-medium text-gray-800 font-mono">{b.name}/</span>
 <span className="text-[11px] text-gray-500">{formatBytes(b.totalBytes)} · {b.fileCount} fichier{b.fileCount !== 1 ? 's' : ''}</span>
 </div>
 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
 <div className={`h-full rounded-full ${bColor}`} style={{ width: `${Math.min(100, bPct)}%` }} />
 </div>
 {Object.keys(b.byType).length > 0 && (
 <div className="flex flex-wrap gap-2 mt-1.5">
 {(Object.entries(b.byType) as [string, { count: number; bytes: number }][]).map(([cat, info]) => (
 <span key={cat} className="text-[10px] text-gray-400">
 {catLabels[cat] ?? cat}: {info.count} · {formatBytes(info.bytes)}
 </span>
 ))}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Bandwidth note */}
 <div className="px-4 sm:px-6 py-3 bg-gray-50">
 <div className="flex items-center justify-between">
 <span className="text-xs font-medium text-gray-600">Bande passante</span>
 <span className="text-xs text-gray-500">{limits.bandwidth.label}</span>
 </div>
 <p className="text-[11px] text-gray-400 mt-0.5">{bandwidth.note}</p>
 </div>

 {/* Vercel Hobby plan limits */}
 <div className="px-4 sm:px-6 py-4">
 <p className="text-xs font-medium text-gray-700 mb-3">Limites plan Hobby (Vercel)</p>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
 {[
 { label: 'Blob storage', value: limits.storage.label },
 { label: 'Bande passante', value: limits.bandwidth.label },
 { label: 'Base de données', value: limits.database.label },
 ].map((item) => (
 <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
 <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{item.label}</p>
 <p className="text-xs font-semibold text-gray-800 mt-0.5">{item.value}</p>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
 })()}
 </div>

 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
 <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div>
 <h2 className="text-sm font-semibold text-gray-900">Gestion des performances</h2>
 <p className="text-xs text-gray-400 mt-0.5">{filteredPerformances.length} performance{filteredPerformances.length !== 1 ? 's' : ''} affichée{filteredPerformances.length !== 1 ? 's' : ''}</p>
 </div>
 </div>
 <div className="px-4 sm:px-6 py-4 border-b border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3">
 <input
 value={performanceSearch}
 onChange={(e) => setPerformanceSearch(e.target.value)}
 placeholder="Recherche utilisateur, spot, exercice..."
 className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 />
 <select
 value={performanceStatusFilter}
 onChange={(e) => setPerformanceStatusFilter(e.target.value)}
 className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 >
 <option value="">Tous les statuts</option>
 <option value="private">Privée</option>
 <option value="pending">En attente</option>
 <option value="validated">Validée</option>
 <option value="rejected">Rejetée</option>
 </select>
 <select
 value={performanceSort}
 onChange={(e) => setPerformanceSort(e.target.value as 'recent' | 'score_desc' | 'score_asc')}
 className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 >
 <option value="recent">Plus récentes</option>
 <option value="score_desc">Score décroissant</option>
 <option value="score_asc">Score croissant</option>
 </select>
 </div>
 {/* Desktop table */}
 <div className="hidden md:block overflow-x-auto">
 <table className="w-full">
 <thead className="bg-gray-50 border-b border-gray-100">
 <tr>
 <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Utilisateur</th>
 <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Exercice</th>
 <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Score</th>
 <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Statut</th>
 <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Spot</th>
 <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Vidéo</th>
 <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase hidden lg:table-cell">Date</th>
 <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {filteredPerformances.length === 0 && (
 <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Aucune performance</td></tr>
 )}
 {filteredPerformances.map((p) => (
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
 <td className="px-3 py-3 text-sm text-gray-500 truncate max-w-[100px]">{p.spot?.name ?? '—'}</td>
 <td className="px-3 py-3">
 {p.videoUrl ? (
 <a href={p.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
 {isZipProofUrl(p.videoUrl) ? 'Telecharger preuve (zip)' : 'Voir video'}
 </a>
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
 
 </button>
 <button onClick={() => deletePerf(p.id)}
 disabled={actionLoading === p.id}
 className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50">
 
 </button>
 {p.videoUrl && (
 <button onClick={() => deletePerfVideo(p.id)}
 disabled={actionLoading === p.id}
 className="px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded hover:bg-orange-100 disabled:opacity-50">
 Vidéo
 </button>
 )}
 </>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 {/* Mobile cards */}
 <div className="md:hidden divide-y divide-gray-50">
 {filteredPerformances.length === 0 && (
 <p className="px-4 py-8 text-center text-sm text-gray-400">Aucune performance</p>
 )}
 {filteredPerformances.map((p) => (
 <div key={p.id} className="px-4 py-3 space-y-2">
 <div className="flex items-center justify-between gap-2">
 <p className="text-sm font-medium text-gray-900 truncate">{p.user.pseudo ? `@${p.user.pseudo}` : p.user.name ?? p.user.email}</p>
 <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
 p.status === 'validated' ? 'bg-green-100 text-green-700' :
 p.status === 'rejected' ? 'bg-red-100 text-red-600' :
 'bg-amber-100 text-amber-700'
 }`}>
 {p.status === 'validated' ? 'Validé' : p.status === 'rejected' ? 'Rejeté' : 'En attente'}
 </span>
 </div>
 {editingPerf === p.id ? (
 <div className="flex gap-2 items-center flex-wrap">
 <input type="number" step="any" value={editScore} onChange={e => setEditScore(e.target.value)}
 className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
 <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
 className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900">
 <option value="pending">En attente</option>
 <option value="validated">Validé</option>
 <option value="rejected">Rejeté</option>
 </select>
 <button onClick={() => updatePerf(p.id, Number(editScore), editStatus)}
 disabled={actionLoading === p.id}
 className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">✓</button>
 <button onClick={() => setEditingPerf(null)}
 className="px-3 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300">✕</button>
 </div>
 ) : (
 <div className="flex items-start justify-between gap-2">
 <div className="text-xs text-gray-500 min-w-0">
 <p className="break-words">
 {p.exercise} · <span className="font-semibold text-gray-900">{p.score} {p.unit}</span>
 </p>
 {p.spot && <p className="break-words mt-0.5">Spot: {p.spot.name}</p>}
 {p.videoUrl && (
 <p className="mt-0.5">
 <a href={p.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 break-all">
 {isZipProofUrl(p.videoUrl) ? 'preuve zip' : 'video'}
 </a>
 </p>
 )}
 </div>
 <div className="flex gap-1 flex-shrink-0">
 <button onClick={() => { setEditingPerf(p.id); setEditScore(String(p.score)); setEditStatus(p.status); }}
 className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"></button>
 <button onClick={() => deletePerf(p.id)} disabled={actionLoading === p.id}
 className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"></button>
 {p.videoUrl && (
 <button onClick={() => deletePerfVideo(p.id)} disabled={actionLoading === p.id}
 className="px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded hover:bg-orange-100 disabled:opacity-50"></button>
 )}
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>

 {/* Video verification section */}
 {performances.filter(p => p.videoUrl).length > 0 && (
 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
 <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
 <h2 className="text-sm font-semibold text-gray-900"> Vérification vidéo</h2>
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
 <div className="flex items-center gap-2 flex-wrap sm:justify-end">
 <a href={p.videoUrl!} target="_blank" rel="noopener noreferrer"
 className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
 {isZipProofUrl(p.videoUrl) ? ' Telecharger ZIP' : ' Voir video'}
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
 <button onClick={() => deletePerfVideo(p.id)}
 disabled={actionLoading === p.id}
 className="px-3 py-1.5 text-xs bg-orange-50 text-orange-700 rounded-lg font-medium hover:bg-orange-100 disabled:opacity-50">
 Supprimer video
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 {tab === 'suggestions' && (
 <div className="space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 {[
 { label: 'Nouvelles', value: newSuggestions, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
 { label: 'En etude', value: reviewedSuggestions, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
 { label: 'Mises en place', value: doneSuggestions, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
 ].map((card) => (
 <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
 <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{card.label}</p>
 <p className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</p>
 </div>
 ))}
 </div>

 {suggestionsUnavailable && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
 La table des suggestions n est pas encore disponible en base sur cet environnement. L interface est prete, mais il faut appliquer la migration Prisma.
 </div>
 )}

 <div className="space-y-3">
 {suggestions.length === 0 && !suggestionsUnavailable && (
 <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
 Aucune idee utilisateur pour le moment.
 </div>
 )}

 {suggestions.map((item) => {
 const display = item.user?.pseudo || item.user?.name || item.user?.email || 'Utilisateur inconnu';
 return (
 <article key={item.id} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-2 mb-2">
 <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">{item.category}</span>
 <span className="text-xs text-gray-400">{fmt(item.createdAt)}</span>
 </div>
 <p className="text-sm font-semibold text-gray-900 break-words">{display}</p>
 <p className="mt-2 text-sm leading-6 text-gray-700 whitespace-pre-wrap break-words">{item.text}</p>
 </div>

 <div className="flex gap-2 flex-wrap sm:flex-col sm:items-stretch sm:min-w-[140px]">
 {[
 { key: 'new', label: 'Nouvelle', className: 'border-slate-300 text-slate-700 hover:bg-slate-50' },
 { key: 'reviewed', label: 'En etude', className: 'border-amber-300 text-amber-700 hover:bg-amber-50' },
 { key: 'done', label: 'Mise en place', className: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' },
 ].map((statusOption) => (
 <button
 key={statusOption.key}
 onClick={() => updateSuggestionStatus(item.id, statusOption.key)}
 disabled={actionLoading === item.id || item.status === statusOption.key}
 className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${statusOption.className} ${item.status === statusOption.key ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-900' : ''}`}
 >
 {actionLoading === item.id && item.status !== statusOption.key ? '...' : statusOption.label}
 </button>
 ))}
 </div>
 </div>
 </article>
 );
 })}
 </div>
 </div>
 )}
 {tab === 'exerciseScraper' && (
 <div className="space-y-6">
 <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
 <h2 className="text-sm font-semibold text-gray-900">Scraper exercices (street workout, salle, maison)</h2>
 <p className="text-xs text-gray-400 mt-1">Lance le scrape web puis importe automatiquement dans la table ExerciseTranslation (sourceApi: web-scrape).</p>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
 <label className="text-xs text-gray-600 sm:col-span-2">
 Sujet a scraper
 <input
 type="text"
 value={scrapeTopic}
 onChange={(e) => setScrapeTopic(e.target.value)}
 placeholder="Ex: abdos, pectoraux, tractions, jambes maison, street workout debutant..."
 className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 />
 <span className="mt-1 block text-[11px] text-gray-400">Laissez vide pour utiliser les sources par defaut. Si vous renseignez un sujet, le bot cible des sources et resultats lies a ce theme.</span>
 </label>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
 <label className="text-xs text-gray-600">
 Pages max/source
 <input
 type="number"
 min={1}
 max={30}
 value={scrapeMaxPages}
 onChange={(e) => setScrapeMaxPages(e.target.value)}
 className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 />
 </label>
 <label className="text-xs text-gray-600">
 Timeout HTML (ms)
 <input
 type="number"
 min={4000}
 max={30000}
 value={scrapeTimeoutMs}
 onChange={(e) => setScrapeTimeoutMs(e.target.value)}
 className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 />
 </label>
 <label className="text-xs text-gray-600">
 Sources min/import
 <input
 type="number"
 min={1}
 max={10}
 value={scrapeMinSources}
 onChange={(e) => setScrapeMinSources(e.target.value)}
 className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 />
 </label>
 <label className="text-xs text-gray-600">
 Qualite min
 <input
 type="number"
 min={1}
 max={20}
 value={scrapeMinQuality}
 onChange={(e) => setScrapeMinQuality(e.target.value)}
 className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 />
 </label>
 </div>

 <div className="mt-4 flex flex-wrap gap-2">
 <button
 onClick={runExerciseScraper}
 disabled={scraperRunning}
 className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60"
 >
 {scraperRunning ? (
 <span className="flex items-center gap-2">
 <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
 {scrapeProgress?.phase === 'importing' ? 'Import BD...' : 'Scraping...'}
 </span>
 ) : 'Lancer scrape + import'}
 </button>
 <button
 onClick={charger}
 disabled={scraperRunning}
 className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400 disabled:opacity-40"
 >
 Recharger stats
 </button>
 </div>

 {/* Live progress bar */}
 {scrapeProgress && scrapeProgress.phase !== 'idle' && (
 <div className="mt-4 space-y-2">
 <div className="flex items-center justify-between text-xs text-gray-500">
 <span>
 {scrapeProgress.phase === 'scraping' && scrapeProgress.sourceTotal > 0
 ? `Source ${scrapeProgress.sourceIndex}/${scrapeProgress.sourceTotal}`
 : scrapeProgress.phase === 'importing'
 ? 'Import en base...'
 : scrapeProgress.phase === 'done'
 ? '✓ Terminé'
 : scrapeProgress.phase === 'error'
 ? '✗ Erreur'
 : 'Démarrage...'}
 </span>
 <span className="font-medium text-gray-700">
 {scrapeProgress.exercisesFound > 0 ? `${scrapeProgress.exercisesFound} exos` : scrapeProgress.rawItems > 0 ? `${scrapeProgress.rawItems} bruts` : ''}
 </span>
 </div>
 <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
 <div
 className={`h-2 rounded-full transition-all duration-300 ${
 scrapeProgress.phase === 'error' ? 'bg-red-500' :
 scrapeProgress.phase === 'done' ? 'bg-emerald-500' :
 scrapeProgress.phase === 'importing' ? 'bg-blue-400' :
 'bg-indigo-500'
 }`}
 style={{
 width: scrapeProgress.phase === 'done' ? '100%' :
 scrapeProgress.phase === 'importing' ? '90%' :
 scrapeProgress.phase === 'error' ? '100%' :
 scrapeProgress.sourceTotal > 0
 ? `${Math.max(4, (scrapeProgress.sourceIndex / scrapeProgress.sourceTotal) * 85)}%`
 : '4%',
 }}
 />
 </div>
 {scrapeProgress.currentSource && scrapeProgress.phase === 'scraping' && (
 <p className="text-[11px] text-gray-400 truncate">{scrapeProgress.currentSource}</p>
 )}
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
 <div className="bg-white border border-gray-200 rounded-xl p-4">
 <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Dernier scrape</p>
 <p className="mt-2 text-sm font-semibold text-gray-900 break-words">{scraperSummary?.generatedAt ? fmt(scraperSummary.generatedAt) : 'Aucun'}</p>
 </div>
 <div className="bg-white border border-gray-200 rounded-xl p-4">
 <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Sujet</p>
 <p className="mt-2 text-sm font-semibold text-gray-900 break-words">{scraperSummary?.config?.topic || 'Par defaut'}</p>
 </div>
 <div className="bg-white border border-gray-200 rounded-xl p-4">
 <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Pages visitees</p>
 <p className="mt-2 text-2xl font-bold text-gray-900">{scraperSummary?.pagesVisited ?? 0}</p>
 </div>
 <div className="bg-white border border-gray-200 rounded-xl p-4">
 <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Exos uniques JSON</p>
 <p className="mt-2 text-2xl font-bold text-indigo-600">{scraperSummary?.uniqueExercises ?? 0}</p>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="bg-white border border-gray-200 rounded-xl p-4">
 <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Items bruts detectes</p>
 <p className="mt-2 text-2xl font-bold text-gray-900">{scraperSummary?.rawItems ?? 0}</p>
 </div>
 <div className="bg-white border border-gray-200 rounded-xl p-4">
 <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Exos importes DB</p>
 <p className="mt-2 text-2xl font-bold text-emerald-600">{scraperDbCount}</p>
 </div>
 </div>

 {scraperSummary?.filePath && (
 <div className="bg-white border border-gray-200 rounded-xl p-4">
 <p className="text-xs text-gray-400">Fichier de sortie</p>
 <p className="text-sm text-gray-700 break-all mt-1">{scraperSummary.filePath}</p>
 </div>
 )}

 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
 <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
 <h3 className="text-sm font-semibold text-gray-900">Logs en temps réel</h3>
 {scrapeLog.length > 0 && (
 <button
 onClick={() => { setScrapeLog([]); setScrapeProgress(null); }}
 className="text-xs text-gray-400 hover:text-gray-600"
 >
 Effacer
 </button>
 )}
 </div>
 <pre
 ref={scrapeLogRef}
 className="p-4 text-xs text-gray-700 bg-gray-50 overflow-auto max-h-[380px] whitespace-pre-wrap break-words font-mono"
 >
 {scrapeLog.length > 0 ? scrapeLog.join('\n') : scraperOutput || 'Aucun log pour le moment. Lancez un scrape pour voir la progression en direct.'}
 </pre>
 </div>

 <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
 <h2 className="text-sm font-semibold text-gray-900 mb-4">Verifier les exercices importe</h2>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
 <input
 type="text"
 placeholder="Chercher par nom..."
 value={exercisesSearch}
 onChange={(e) => {
 setExercisesSearch(e.target.value);
 setExercisesPage(1);
 }}
 className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400"
 />
 <input
 type="number"
 placeholder="Qualite min..."
 min={0}
 max={20}
 value={exercisesMinQuality}
 onChange={(e) => {
 setExercisesMinQuality(e.target.value);
 setExercisesPage(1);
 }}
 className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400"
 />
 <button
 onClick={() => loadExercises(1, exercisesSearch, exercisesMinQuality)}
 className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
 >
 Chercher
 </button>
 </div>

 {exercisesLoading ? (
 <p className="text-center text-gray-500 py-4">Chargement...</p>
 ) : exercisesList.length === 0 ? (
 <p className="text-center text-gray-500 py-4">Aucun exercice trovuve</p>
 ) : (
 <>
 <div className="overflow-x-auto mb-4">
 <table className="w-full text-xs">
 <thead className="border-b border-gray-200 bg-gray-50">
 <tr>
 <th className="text-left px-3 py-2 font-semibold text-gray-700">Nom</th>
 <th className="text-left px-3 py-2 font-semibold text-gray-700">Qualite</th>
 <th className="text-left px-3 py-2 font-semibold text-gray-700">Sources</th>
 <th className="text-left px-3 py-2 font-semibold text-gray-700">Categories</th>
 <th className="text-left px-3 py-2 font-semibold text-gray-700">Date</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {exercisesList.map((ex) => (
 <tr key={ex.id} className="hover:bg-gray-50 transition">
 <td className="px-3 py-2 text-gray-900 font-medium max-w-xs truncate">{ex.name}</td>
 <td className="px-3 py-2">
 <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${ex.qualityScore >= 7 ? 'bg-green-50 text-green-700' : ex.qualityScore >= 5 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
 {ex.qualityScore}
 </span>
 </td>
 <td className="px-3 py-2">
 <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${ex.sourceCount >= 2 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
 {ex.sourceCount}
 </span>
 </td>
 <td className="px-3 py-2 text-gray-600">
 <div className="flex flex-wrap gap-1">
 {ex.categories.slice(0, 2).map((cat) => (
 <span key={cat} className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
 {cat}
 </span>
 ))}
 {ex.categories.length > 2 && <span className="text-xs text-gray-400">+{ex.categories.length - 2}</span>}
 </div>
 </td>
 <td className="px-3 py-2 text-gray-500 text-xs">{fmt(ex.createdAt)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <div className="flex items-center justify-between border-t border-gray-100 pt-4">
 <p className="text-xs text-gray-500">
 {exercisesTotal === 0 ? 'Aucun' : `${(exercisesPage - 1) * exercisesPageSize + 1}–${Math.min(exercisesPage * exercisesPageSize, exercisesTotal)} sur ${exercisesTotal}`} exercices
 </p>
 <div className="flex gap-2">
 <button
 onClick={() => loadExercises(exercisesPage - 1, exercisesSearch, exercisesMinQuality)}
 disabled={exercisesPage <= 1}
 className="px-3 py-1 border border-gray-200 rounded text-xs font-medium disabled:opacity-50"
 >
 ← Prec
 </button>
 <button
 onClick={() => loadExercises(exercisesPage + 1, exercisesSearch, exercisesMinQuality)}
 disabled={exercisesPage >= Math.ceil(exercisesTotal / exercisesPageSize)}
 className="px-3 py-1 border border-gray-200 rounded text-xs font-medium disabled:opacity-50"
 >
 Suiv →
 </button>
 </div>
 </div>
 </>
 )}
 </div>
 </div>
 )}
 {tab === 'controlCenter' && (
 <div className="space-y-6">
 {!controlCenter ? (
 <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">Chargement du centre de controle...</div>
 ) : (
 <>
 <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div>
 <h2 className="text-sm font-semibold text-gray-900">Gestion des rubriques</h2>
 <p className="text-xs text-gray-400 mt-0.5">Desactive, stand-by, stop ou masque une rubrique sans redeploiement.</p>
 </div>
 <button
 onClick={saveControlCenter}
 disabled={savingControlCenter}
 className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
 >
 {savingControlCenter ? 'Sauvegarde...' : 'Sauvegarder'}
 </button>
 </div>

 <div className="space-y-3">
 {Object.values(controlCenter.config.sections).map((section) => (
 <div key={section.key} className="rounded-xl border border-gray-200 p-3 sm:p-4">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <p className="text-sm font-semibold text-gray-900">{section.label}</p>
 <p className="text-[11px] text-gray-400 mt-0.5">{section.paths.join(' , ')}</p>
 </div>
 <select
 value={section.status}
 onChange={(e) => {
 const status = e.target.value as ControlSection['status'];
 setControlCenter((prev) => {
 if (!prev) return prev;
 return {
 ...prev,
 config: {
 ...prev.config,
 sections: {
 ...prev.config.sections,
 [section.key]: {
 ...prev.config.sections[section.key],
 status,
 },
 },
 },
 };
 });
 }}
 className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700"
 >
 <option value="active">Active</option>
 <option value="disabled">Desactivee</option>
 <option value="standby">Stand-by</option>
 <option value="stopped">Stop serveur</option>
 <option value="hidden">Masquee</option>
 </select>
 </div>
 <textarea
 value={section.maintenanceMessage || ''}
 onChange={(e) => {
 const maintenanceMessage = e.target.value;
 setControlCenter((prev) => {
 if (!prev) return prev;
 return {
 ...prev,
 config: {
 ...prev.config,
 sections: {
 ...prev.config.sections,
 [section.key]: {
 ...prev.config.sections[section.key],
 maintenanceMessage,
 },
 },
 },
 };
 });
 }}
 rows={2}
 placeholder="Message maintenance affiche aux utilisateurs"
 className="mt-3 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700"
 />
 </div>
 ))}
 </div>
 </div>

 <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
 <h2 className="text-sm font-semibold text-gray-900">Protection serveur: limitation des requetes</h2>
 <p className="text-xs text-gray-400 mt-1">Exemple recommande: 3 requetes/seconde par utilisateur.</p>
 <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4">
 <label className="text-xs text-gray-600">
 Active
 <select
 value={controlCenter.config.rateLimit.enabled ? '1' : '0'}
 onChange={(e) => setControlCenter((prev) => prev ? ({
 ...prev,
 config: {
 ...prev.config,
 rateLimit: { ...prev.config.rateLimit, enabled: e.target.value === '1' },
 },
 }) : prev)}
 className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 >
 <option value="1">Oui</option>
 <option value="0">Non</option>
 </select>
 </label>
 <label className="text-xs text-gray-600">
 Max requetes
 <input
 type="number"
 min={1}
 max={50}
 value={controlCenter.config.rateLimit.maxRequests}
 onChange={(e) => setControlCenter((prev) => prev ? ({
 ...prev,
 config: {
 ...prev.config,
 rateLimit: { ...prev.config.rateLimit, maxRequests: Number(e.target.value) || 1 },
 },
 }) : prev)}
 className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 />
 </label>
 <label className="text-xs text-gray-600">
 Fenetre (ms)
 <input
 type="number"
 min={250}
 max={60000}
 value={controlCenter.config.rateLimit.windowMs}
 onChange={(e) => setControlCenter((prev) => prev ? ({
 ...prev,
 config: {
 ...prev.config,
 rateLimit: { ...prev.config.rateLimit, windowMs: Number(e.target.value) || 1000 },
 },
 }) : prev)}
 className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 />
 </label>
 <label className="text-xs text-gray-600">
 Cible
 <select
 value={controlCenter.config.rateLimit.mutatingOnly ? 'mutating' : 'all'}
 onChange={(e) => setControlCenter((prev) => prev ? ({
 ...prev,
 config: {
 ...prev.config,
 rateLimit: { ...prev.config.rateLimit, mutatingOnly: e.target.value === 'mutating' },
 },
 }) : prev)}
 className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 >
 <option value="mutating">POST / PUT / PATCH / DELETE</option>
 <option value="all">Toutes les requetes</option>
 </select>
 </label>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 <div className="bg-white border border-gray-200 rounded-xl p-4">
 <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Classification signalements</p>
 <div className="mt-3 space-y-2 text-sm">
 <div className="flex items-center justify-between"><span className="text-gray-600">Groupes</span><span className="font-bold text-gray-900">{controlCenter.analytics.reportClassification.groups}</span></div>
 <div className="flex items-center justify-between"><span className="text-gray-600">Conversations privees</span><span className="font-bold text-gray-900">{controlCenter.analytics.reportClassification.private}</span></div>
 <div className="flex items-center justify-between"><span className="text-gray-600">Autres</span><span className="font-bold text-gray-900">{controlCenter.analytics.reportClassification.other}</span></div>
 </div>
 </div>
 <div className="bg-white border border-gray-200 rounded-xl p-4">
 <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Interactions (7 jours)</p>
 <div className="mt-3 space-y-2 text-sm">
 <div className="flex items-center justify-between"><span className="text-gray-600">Messages prives</span><span className="font-bold text-gray-900">{controlCenter.analytics.interactions.directMessages7d}</span></div>
 <div className="flex items-center justify-between"><span className="text-gray-600">Messages groupes</span><span className="font-bold text-gray-900">{controlCenter.analytics.interactions.groupMessages7d}</span></div>
 <div className="flex items-center justify-between"><span className="text-gray-600">Demandes ami</span><span className="font-bold text-gray-900">{controlCenter.analytics.interactions.friendRequests7d}</span></div>
 <div className="flex items-center justify-between"><span className="text-gray-600">Signalements</span><span className="font-bold text-gray-900">{controlCenter.analytics.interactions.reports7d}</span></div>
 </div>
 </div>
 <div className="bg-white border border-gray-200 rounded-xl p-4">
 <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Types de conversations</p>
 <div className="mt-3 space-y-2 text-sm">
 <div className="flex items-center justify-between"><span className="text-gray-600">Conversations privees</span><span className="font-bold text-gray-900">{controlCenter.analytics.conversationTypes.directConversations}</span></div>
 <div className="flex items-center justify-between"><span className="text-gray-600">Messages prives</span><span className="font-bold text-gray-900">{controlCenter.analytics.conversationTypes.directMessagesTotal}</span></div>
 <div className="flex items-center justify-between"><span className="text-gray-600">Groupes</span><span className="font-bold text-gray-900">{controlCenter.analytics.conversationTypes.groupConversations}</span></div>
 <div className="flex items-center justify-between"><span className="text-gray-600">Messages groupes</span><span className="font-bold text-gray-900">{controlCenter.analytics.conversationTypes.groupMessagesTotal}</span></div>
 </div>
 </div>
 </div>

 <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
 <div>
 <h2 className="text-sm font-semibold text-gray-900">Scraper: validation manuelle avant enregistrement</h2>
 <p className="text-xs text-gray-400 mt-0.5">Affiche les elements trouves, valide manuellement, puis enregistre en base.</p>
 </div>
 <div className="flex gap-2">
 <button onClick={loadScraperCandidates} className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-700 hover:border-gray-400">Actualiser liste</button>
 <button onClick={saveValidatedCandidates} disabled={candidatesLoading} className="px-3 py-2 text-xs rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50">Valider + enregistrer</button>
 </div>
 </div>

 {candidatesLoading ? (
 <p className="text-sm text-gray-500">Chargement des candidats...</p>
 ) : scraperCandidates.length === 0 ? (
 <p className="text-sm text-gray-500">Aucun element trouve. Lance d abord un scrape.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-xs">
 <thead className="bg-gray-50 border-b border-gray-100">
 <tr>
 <th className="text-left px-3 py-2">Valider</th>
 <th className="text-left px-3 py-2">Exercice</th>
 <th className="text-left px-3 py-2">Qualite</th>
 <th className="text-left px-3 py-2">Sources</th>
 <th className="text-left px-3 py-2">Categories</th>
 <th className="text-left px-3 py-2">Etat DB</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {scraperCandidates.slice(0, 200).map((item) => (
 <tr key={item.id}>
 <td className="px-3 py-2">
 <input
 type="checkbox"
 checked={Boolean(candidateSelection[item.id])}
 onChange={(e) => setCandidateSelection((prev) => ({ ...prev, [item.id]: e.target.checked }))}
 />
 </td>
 <td className="px-3 py-2 text-gray-900 font-medium">{item.translatedName}</td>
 <td className="px-3 py-2">{item.qualityScore}</td>
 <td className="px-3 py-2">{item.sourceCount}</td>
 <td className="px-3 py-2 text-gray-600">{item.categories.slice(0, 3).join(', ') || 'general'}</td>
 <td className="px-3 py-2">
 <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${item.existsInDb ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
 {item.existsInDb ? 'Deja en base' : 'Nouveau'}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </>
 )}
 </div>
 )}
 {tab === 'analytics' && (
 <div className="space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
 {[
 { label: 'Séances IA générées', value: workoutGenerations, icon: '', color: 'text-cyan-600', sub: 'via intelligence artificielle' },
 { label: 'Appels API IA', value: aiApiCalls, icon: '', color: 'text-indigo-600', sub: 'Total appels API' },
 { label: 'Actions totales', value: totalActions, icon: '', color: 'text-gray-700', sub: `Moy: ${actionsPerUser}/utilisateur` },
 { label: 'Taux engagement', value: stats ? `${Math.round((activeUsers / Math.max(stats.totalUsers, 1)) * 100)}%` : '—', icon: '', color: 'text-emerald-600', sub: `${activeUsers} actifs / ${stats?.totalUsers ?? 0}` },
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
 { key: 'debutant', label: ' Débutant', color: 'bg-gray-500' },
 { key: 'intermediaire', label: ' Intermédiaire', color: 'bg-blue-500' },
 { key: 'elite', label: ' Élite', color: 'bg-yellow-500' },
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
 u.sessions[0] ? 'bg-green-100 text-green-700' :
 'bg-gray-100 text-gray-500'
 }`}>
 {u.suspended ? 'Suspendu' : u.sessions[0] ? 'Actif' : 'Inactif'}
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
 <h2 className="text-sm font-semibold text-gray-900 mb-4"> Suivi API en temps réel</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
 <div className="flex flex-wrap gap-1 mt-2 mb-2">
 <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">GPT-4o-mini</span>
 <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">ExerciseDB</span>
 <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">wger</span>
 <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded text-xs font-medium">NCBI</span>
 </div>
 <p className="text-xs text-gray-500">ExerciseDB: <span className="font-semibold">{exerciseDbApiCalls}</span></p>
 <p className="text-xs text-gray-500">Wger: <span className="font-semibold">{wgerApiCalls}</span></p>
 <p className="text-xs text-gray-500">NCBI: <span className="font-semibold">{ncbiApiCalls}</span></p>
 </div>
 </div>

 {apiStats?.apiByDay?.length ? (
 <div className="mt-5 overflow-x-auto">
 <table className="w-full text-xs">
 <thead>
 <tr className="text-gray-400 border-b border-gray-100">
 <th className="text-left py-2">Jour</th>
 <th className="text-right py-2">OpenAI</th>
 <th className="text-right py-2">ExerciseDB</th>
 <th className="text-right py-2">Wger</th>
 <th className="text-right py-2">NCBI</th>
 </tr>
 </thead>
 <tbody>
 {apiStats.apiByDay.map((row, idx) => (
 <tr key={`${row.label}-${idx}`} className="border-b border-gray-50 text-gray-700">
 <td className="py-2">{String(row.label)}</td>
 <td className="py-2 text-right font-semibold">{Number(row.openai || 0)}</td>
 <td className="py-2 text-right font-semibold">{Number(row.exerciseDB || 0)}</td>
 <td className="py-2 text-right font-semibold">{Number(row.wger || 0)}</td>
 <td className="py-2 text-right font-semibold">{Number(row.ncbi || 0)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : null}
 </div>

 <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-900 mb-3"> Testeur d&apos;API en direct</h2>
 <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
 <select
 value={apiTestProvider}
 onChange={(e) => setApiTestProvider(e.target.value as 'exerciseDB' | 'wger' | 'ncbi' | 'openai')}
 className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 >
 <option value="exerciseDB">ExerciseDB</option>
 <option value="wger">Wger</option>
 <option value="ncbi">NCBI</option>
 <option value="openai">OpenAI</option>
 </select>
 <input
 value={apiTestQuery}
 onChange={(e) => setApiTestQuery(e.target.value)}
 className="sm:col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
 placeholder="Requête de test..."
 />
 <button
 onClick={runApiTest}
 disabled={apiTestLoading}
 className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
 >
 {apiTestLoading ? 'Test...' : 'Tester API'}
 </button>
 </div>
 {apiTestResult && (
 <pre className="mt-3 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{apiTestResult}</pre>
 )}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
 <div className="px-4 py-3 border-b border-gray-100">
 <h2 className="text-sm font-semibold text-gray-900">Messages privés signalés</h2>
 </div>
 <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
 {directConversations.map((c) => (
 <div key={c.key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
 <div className="min-w-0">
 <p className="text-sm text-gray-900 truncate">{c.sender} → {c.recipient}</p>
 <p className="text-xs text-gray-500 truncate">{c.preview}</p>
 <p className="text-xs text-gray-400">{c.reportCount} signalement{c.reportCount > 1 ? 's' : ''} · {c.reason || 'Sans motif'} · {fmt(c.lastAt)}</p>
 </div>
 <button
 onClick={() => deleteConversation({ type: 'direct', messageId: c.messageId })}
 className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
 >
 Supprimer message
 </button>
 </div>
 ))}
 {directConversations.length === 0 && <p className="px-4 py-4 text-sm text-gray-400">Aucun message privé signalé.</p>}
 </div>
 </div>

 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
 <div className="px-4 py-3 border-b border-gray-100">
 <h2 className="text-sm font-semibold text-gray-900">Messages de groupe signalés</h2>
 </div>
 <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
 {groupConversations.map((g) => (
 <div key={g.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
 <div className="min-w-0">
 <p className="text-sm text-gray-900 truncate">{g.name}</p>
 <p className="text-xs text-gray-500 truncate">{g.preview}</p>
 <p className="text-xs text-gray-400">Auteur: {g.owner} · {g.members} signalement{g.members > 1 ? 's' : ''} · {g.reason || 'Sans motif'}</p>
 </div>
 <button
 onClick={() => deleteConversation({ type: 'group', groupId: g.messageId })}
 className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
 >
 Supprimer message
 </button>
 </div>
 ))}
 {groupConversations.length === 0 && <p className="px-4 py-4 text-sm text-gray-400">Aucun message de groupe signalé.</p>}
 </div>
 </div>
 </div>

 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
 <div className="px-4 py-3 border-b border-gray-100">
 <h2 className="text-sm font-semibold text-gray-900"> Signalements utilisateurs</h2>
 </div>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-4">
 <div className="p-4 border-b lg:border-b-0 lg:border-r border-gray-100">
 <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Totaux par utilisateur</p>
 <div className="space-y-2 max-h-56 overflow-y-auto">
 {reportTotals.map((row) => (
 <div key={row.key} className="flex items-center justify-between text-sm">
 <span className="text-gray-700 truncate">{row.reportedDisplay}</span>
 <span className="text-red-600 font-bold">{row.total}</span>
 </div>
 ))}
 {reportTotals.length === 0 && <p className="text-sm text-gray-400">Aucun signalement.</p>}
 </div>
 </div>
 <div className="p-4">
 <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Derniers signalements</p>
 <div className="space-y-2 max-h-56 overflow-y-auto">
 {reports.map((r) => (
 <div key={r.id} className="text-xs border border-gray-100 rounded-lg p-2">
 <p className="text-gray-800 font-semibold">
 {r.reporter.pseudo || r.reporter.name || r.reporter.email} → {r.reportedUser?.pseudo || r.reportedUser?.name || r.reportedUser?.email || `${r.targetType}:${r.targetId}`}
 </p>
 <p className="text-gray-500">{r.targetType} · {r.reason || 'Sans motif'} · {fmt(r.createdAt)}</p>
 {r.targetType === 'feed_post' && (
 <button
 onClick={() => deleteReportedContent(r)}
 disabled={actionLoading === r.id}
 className="mt-2 rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
 >
 {actionLoading === r.id ? 'Suppression...' : 'Supprimer le post'}
 </button>
 )}
 </div>
 ))}
 {reports.length === 0 && <p className="text-sm text-gray-400">Aucun signalement.</p>}
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
