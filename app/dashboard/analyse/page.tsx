'use client';

import { useState, useEffect } from 'react';

interface Analytics {
 totalWorkouts: number;
 totalCompleted: number;
 totalMinutes: number;
 totalSeries: number;
 totalReps: number;
 streak: number;
 thisWeekSessions: number;
 weeklyData: { label: string; count: number }[];
 topExercises: { name: string; count: number; totalReps: number }[];
 monthlyData: { label: string; sessions: number; minutes: number }[];
 avgMinutes: number;
 challengesCompleted: number;
 xp: number;
 weeklyVolume?: { label: string; tractions: number; pompes: number; dips: number; squats: number }[];
 levelTestHistory?: { testType?: string; exercices?: string[]; resultats?: number[]; manualLevel?: string; date: string }[];
}

interface PhysicalEntry {
 date: string;
 weight?: number;
 height?: number;
 bodyFat?: number;
 chest?: number;
 waist?: number;
 hips?: number;
 bicepsL?: number;
 bicepsR?: number;
 thighL?: number;
 thighR?: number;
}

export default function AnalysePage() {
 const [data, setData] = useState<Analytics | null>(null);
 const [loading, setLoading] = useState(true);
 const [tab, setTab] = useState<'performance' | 'physique'>('performance');
 const [physical, setPhysical] = useState<PhysicalEntry[]>([]);
 const [physLoading, setPhysLoading] = useState(false);
 const [physForm, setPhysForm] = useState<Partial<PhysicalEntry>>({});
 const [physSaving, setPhysSaving] = useState(false);
 const [physFeedback, setPhysFeedback] = useState('');
 const [showResetConfirm, setShowResetConfirm] = useState(false);
 const [resetting, setResetting] = useState(false);

 const loadAnalytics = () => {
 const token = localStorage.getItem('token');
 if (!token) return;
 setLoading(true);
 fetch('/api/analytics', { headers: { Authorization: `Bearer ${token}` } })
 .then(r => r.json())
 .then(d => { setData(d); setLoading(false); })
 .catch(() => setLoading(false));
 };

 useEffect(() => { loadAnalytics(); }, []);

 useEffect(() => {
 if (tab !== 'physique') return;
 const token = localStorage.getItem('token');
 if (!token) return;
 setPhysLoading(true);
 fetch('/api/user/physical', { headers: { Authorization: `Bearer ${token}` } })
 .then(r => r.json())
 .then(d => { setPhysical(d.entries || []); setPhysLoading(false); })
 .catch(() => setPhysLoading(false));
 }, [tab]);

 const savePhysical = async () => {
 const token = localStorage.getItem('token');
 if (!token) return;
 setPhysSaving(true);
 setPhysFeedback('');
 try {
 const res = await fetch('/api/user/physical', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify(physForm),
 });
 if (res.ok) {
 const d = await res.json();
 setPhysical(d.entries || []);
 setPhysForm({});
 setPhysFeedback('Mesures enregistrées !');
 setTimeout(() => setPhysFeedback(''), 3000);
 }
 } finally { setPhysSaving(false); }
 };

 if (loading) {
 return (
 <main className="flex-1 flex items-center justify-center">
 <div className="text-center">
 <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
 <p className="text-sm text-gray-500">Chargement des analyses...</p>
 </div>
 </main>
 );
 }

 if (!data) {
 return (
 <main className="flex-1 px-3 py-6 sm:px-6 md:px-8 sm:py-10">
 <p className="text-gray-500">Impossible de charger les données.</p>
 </main>
 );
 }

 const hours = Math.floor(data.totalMinutes / 60);
 const mins = data.totalMinutes % 60;
 const timeStr = hours > 0 ? `${hours}h${mins > 0 ? `${mins}` : ''}` : `${mins}min`;
 const maxWeekly = Math.max(...data.weeklyData.map(d => d.count), 1);
 const weekGoal = 5;
 const weekPercent = Math.min(Math.round((data.thisWeekSessions / weekGoal) * 100), 100);
 const maxMonthly = Math.max(...(data.monthlyData?.map(d => d.sessions) || [0]), 1);
 const maxExoCount = Math.max(...(data.topExercises?.map(d => d.count) || [0]), 1);
 const level = Math.floor(data.xp / 500) + 1;
 const xpInLevel = data.xp % 500;
 const xpPercent = Math.round((xpInLevel / 500) * 100);
 const monthlySessions = data.monthlyData?.map(m => m.sessions) || [];
 const monthlyMinutes = data.monthlyData?.map(m => m.minutes) || [];
 const monthlySessionTotal = monthlySessions.reduce((acc, v) => acc + v, 0);
 const monthlyMinuteTotal = monthlyMinutes.reduce((acc, v) => acc + v, 0);
 const monthlyAvgMinutes = monthlySessionTotal > 0 ? Math.round(monthlyMinuteTotal / monthlySessionTotal) : 0;
 const recentSlice = data.weeklyData.slice(-3).reduce((acc, d) => acc + d.count, 0);
 const previousSlice = data.weeklyData.slice(0, Math.max(data.weeklyData.length - 3, 0)).reduce((acc, d) => acc + d.count, 0);
 const activityScore = Math.min(
  100,
  Math.round(
   Math.min(data.thisWeekSessions / weekGoal, 1) * 45 +
   Math.min(data.streak / 14, 1) * 30 +
   Math.min(data.avgMinutes / 45, 1) * 25,
  ),
 );
 const focusBuckets = data.topExercises.reduce(
  (acc, ex) => {
   const name = ex.name.toLowerCase();
   if (name.includes('course') || name.includes('cardio') || name.includes('burpee') || name.includes('jump')) {
	acc.cardio += ex.count;
   } else if (name.includes('gainage') || name.includes('core') || name.includes('mobil') || name.includes('yoga') || name.includes('stretch')) {
	acc.mobilite += ex.count;
   } else {
	acc.force += ex.count;
   }
   return acc;
  },
  { force: 0, cardio: 0, mobilite: 0 },
 );
 const focusTotal = Math.max(focusBuckets.force + focusBuckets.cardio + focusBuckets.mobilite, 1);
 const focusAngles = {
  force: Math.round((focusBuckets.force / focusTotal) * 360),
  cardio: Math.round((focusBuckets.cardio / focusTotal) * 360),
  mobilite: Math.round((focusBuckets.mobilite / focusTotal) * 360),
 };

 // Physical helpers
 const lastPhys = physical.length > 0 ? physical[physical.length - 1] : null;
 const prevPhys = physical.length > 1 ? physical[physical.length - 2] : null;
 const physDelta = (key: keyof PhysicalEntry) => {
 if (!lastPhys || !prevPhys) return null;
 const curr = lastPhys[key] as number | undefined;
 const prev = prevPhys[key] as number | undefined;
 if (curr == null || prev == null) return null;
 return Math.round((curr - prev) * 10) / 10;
 };

 return (
 <main className="flex-1 px-3 py-6 sm:px-6 md:px-8 sm:py-10 overflow-x-hidden">
 <div className="max-w-5xl w-full">
 <div className="mb-4 sm:mb-6">
 <h1 className="ios-section-title text-gray-900">Analyse</h1>
 </div>

 <div className="mb-4 sm:mb-5 rounded-2xl border border-gray-200 bg-white overflow-hidden">
 <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] items-stretch">
 <div className="bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200">
 <img src="/images/progression-hero.svg" alt="Progression sportive" className="w-full h-28 sm:h-full object-cover" />
 </div>
 <div className="p-4 sm:p-5">
 <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400 font-semibold">Progression</p>
 <h2 className="text-base sm:text-lg font-bold text-gray-900 mt-1">Suivi hebdo et volume d'entrainement</h2>
 <p className="text-sm text-gray-500 mt-1">Visualisez rapidement vos tendances et vos points forts.</p>
 </div>
 </div>
 </div>

 {/* Reset button */}
 <div className="flex items-center justify-end mb-4">
 <button
 onClick={() => setShowResetConfirm(true)}
 className="px-3 py-2 text-[11px] font-semibold text-red-600 border border-red-200 rounded-xl bg-white hover:bg-red-50 transition"
 >
 Zone sensible: réinitialiser
 </button>
 </div>

 {/* Reset confirmation modal */}
 {showResetConfirm && (
 <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowResetConfirm(false)}>
 <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
 <div className="text-center">
 <span className="text-4xl"></span>
 <h3 className="text-lg font-bold text-gray-900 mt-2">Êtes-vous sûr ?</h3>
 <p className="text-sm text-gray-500 mt-1">Cette action supprimera toutes vos séances, programmes, mesures physiques et remettra votre XP à zéro. Cette action est irréversible.</p>
 </div>
 <div className="flex gap-3">
 <button onClick={() => setShowResetConfirm(false)}
 className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition">
 Annuler
 </button>
 <button onClick={async () => {
 setResetting(true);
 const token = localStorage.getItem('token');
 try {
 await fetch('/api/analytics/reset', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
 setShowResetConfirm(false);
 loadAnalytics();
 } catch { /* silencieux */ }
 setResetting(false);
 }} disabled={resetting}
 className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white text-sm font-semibold rounded-lg transition">
 {resetting ? 'Suppression...' : 'Oui, tout supprimer'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Tabs */}
 <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
 {([
 { key: 'performance' as const, label: 'Performance' },
 { key: 'physique' as const, label: 'Physique' },
 ]).map(t => (
 <button key={t.key} onClick={() => setTab(t.key)}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
 {t.label}
 </button>
 ))}
 </div>

 {/* ═══════ TAB: PERFORMANCE ═══════ */}
 {tab === 'performance' && (
 <div className="space-y-6">
 {/* Main KPIs */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
 {[
 { label: 'Séances terminées', value: String(data.totalCompleted), icon: '/images/icon-workout.svg', color: 'from-blue-500 to-blue-600' },
 { label: 'Temps total', value: timeStr, icon: '/images/icon-time.svg', color: 'from-emerald-500 to-emerald-600' },
 { label: 'Jours consécutifs', value: String(data.streak), icon: '/images/icon-streak.svg', color: 'from-orange-500 to-orange-600' },
 { label: 'XP Total', value: String(data.xp), icon: '/images/icon-trophy.svg', color: 'from-violet-500 to-violet-600' },
 ].map(s => (
 <div key={s.label} className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
 <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl ${s.color} opacity-10 rounded-bl-3xl`} />
 <img src={s.icon} alt="" className="w-7 h-7 rounded-md object-cover" />
 <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2 tabular-nums">{s.value}</p>
 <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
 </div>
 ))}
 </div>

 {/* Apple activity rings + useful insights */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Anneaux d&apos;activité</h2>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {[
 { label: 'Objectif semaine', value: weekPercent, color: '#111827', note: `${data.thisWeekSessions}/${weekGoal} seances` },
 { label: 'Niveau XP', value: xpPercent, color: '#7c3aed', note: `${xpInLevel}/500 XP` },
 { label: 'Regularite', value: Math.min(Math.round((data.streak / 14) * 100), 100), color: '#f97316', note: `${data.streak} jours` },
 ].map((ring) => (
 <div key={ring.label} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 flex items-center gap-3">
 <div
 className="relative w-16 h-16 rounded-full"
 style={{ background: `conic-gradient(${ring.color} ${ring.value}%, #e5e7eb ${ring.value}% 100%)` }}
 >
 <div className="absolute inset-[7px] rounded-full bg-white flex items-center justify-center">
 <span className="text-xs font-bold text-gray-900 tabular-nums">{ring.value}%</span>
 </div>
 </div>
 <div className="min-w-0">
 <p className="text-xs font-semibold text-gray-900">{ring.label}</p>
 <p className="text-[11px] text-gray-500 mt-0.5">{ring.note}</p>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Score forme</h2>
 <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 p-4 text-white">
 <p className="text-[11px] uppercase tracking-[0.12em] text-white/70">Indice global</p>
 <p className="text-4xl font-black mt-1 tabular-nums">{activityScore}</p>
 <p className="text-xs text-white/80 mt-1">Basé sur fréquence, régularité et durée moyenne.</p>
 </div>
 <div className="mt-4 space-y-2">
 <div className="flex items-center justify-between text-xs">
 <span className="text-gray-500">Tendance récente</span>
 <span className={`font-semibold ${recentSlice >= previousSlice ? 'text-emerald-600' : 'text-orange-600'}`}>
 {recentSlice >= previousSlice ? 'En hausse' : 'À relancer'}
 </span>
 </div>
 <div className="flex items-center justify-between text-xs">
 <span className="text-gray-500">Durée moyenne mensuelle</span>
 <span className="font-semibold text-gray-900">{monthlyAvgMinutes || data.avgMinutes} min</span>
 </div>
 <div className="flex items-center justify-between text-xs">
 <span className="text-gray-500">Niveau actuel</span>
 <span className="font-semibold text-gray-900">Palier {level}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Secondary KPIs */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {[
 { label: 'Séries totales', value: data.totalSeries.toLocaleString(), icon: '' },
 { label: 'Répétitions', value: data.totalReps.toLocaleString(), icon: '' },
 { label: 'Défis relevés', value: String(data.challengesCompleted), icon: '' },
 { label: 'Durée moy.', value: `${data.avgMinutes}min`, icon: '' },
 ].map(s => (
 <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
 <span className="text-xl">{s.icon}</span>
 <div>
 <p className="text-lg font-bold text-gray-900 tabular-nums">{s.value}</p>
 <p className="text-xs text-gray-400">{s.label}</p>
 </div>
 </div>
 ))}
 </div>

 {/* Weekly timeline + Week goal */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Timeline semaine</h2>
 {data.weeklyData.every(d => d.count === 0) ? (
 <p className="text-sm text-gray-400 text-center py-8">Aucune seance terminee pour le moment.</p>
 ) : (
 <div className="space-y-3">
 {data.weeklyData.map((p, idx) => {
 const width = Math.max(8, Math.round((p.count / maxWeekly) * 100));
 return (
 <div key={p.label} className="flex items-center gap-3">
 <div className="w-8 text-xs font-semibold text-gray-500">{p.label}</div>
 <div className="flex-1 h-8 rounded-xl bg-gray-100 overflow-hidden relative">
 <div className={`h-8 rounded-xl transition-all ${idx === data.weeklyData.length - 1 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-gray-900 to-gray-700'}`} style={{ width: `${width}%` }} />
 <span className="absolute inset-0 px-3 flex items-center text-xs font-semibold text-white">{p.count} seance{p.count > 1 ? 's' : ''}</span>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Objectif semaine</h2>
 <div className="space-y-3">
 <div className="flex items-center justify-between text-sm">
 <span className="text-gray-500">Progression</span>
 <span className="font-bold text-gray-900">{weekPercent}%</span>
 </div>
 <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
 <div className="h-2.5 rounded-full bg-gray-900 transition-all" style={{ width: `${weekPercent}%` }} />
 </div>
 <p className="text-xs text-gray-500">{data.thisWeekSessions}/{weekGoal} seances</p>
 </div>
 </div>
 </div>

 {/* Monthly evolution */}
 {data.monthlyData && data.monthlyData.length > 0 && (
 <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
 <div className="xl:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-5">Évolution mensuelle (6 mois)</h2>
 <div className="flex items-end gap-3 sm:gap-4 h-36 sm:h-44">
 {data.monthlyData.map(m => {
 const height = Math.round((m.sessions / maxMonthly) * 100);
 return (
 <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
 <span className="text-xs font-bold text-emerald-600 tabular-nums">{m.sessions > 0 ? m.sessions : ''}</span>
 <div className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-lg transition-all"
 style={{ height: `${m.sessions > 0 ? Math.max(height, 6) : 2}%`, opacity: m.sessions === 0 ? 0.15 : 1 }} />
 <span className="text-xs text-gray-500 font-medium">{m.label}</span>
 {m.minutes > 0 && <span className="text-[10px] text-gray-400">{m.minutes}min</span>}
 </div>
 );
 })}
 </div>
 </div>

 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Répartition des focus</h2>
 <div className="flex items-center gap-4">
 <div
 className="w-24 h-24 rounded-full"
 style={{
 background: `conic-gradient(#1f2937 0 ${focusAngles.force}deg, #0ea5e9 ${focusAngles.force}deg ${focusAngles.force + focusAngles.cardio}deg, #f97316 ${focusAngles.force + focusAngles.cardio}deg 360deg)`,
 }}
 >
 <div className="m-4 w-16 h-16 rounded-full bg-white border border-gray-100 flex items-center justify-center">
 <span className="text-[10px] font-semibold text-gray-500">Focus</span>
 </div>
 </div>
 <div className="space-y-2 text-xs flex-1">
 <div className="flex items-center justify-between"><span className="text-gray-500">Force</span><span className="font-semibold text-gray-900">{focusBuckets.force}</span></div>
 <div className="flex items-center justify-between"><span className="text-gray-500">Cardio</span><span className="font-semibold text-gray-900">{focusBuckets.cardio}</span></div>
 <div className="flex items-center justify-between"><span className="text-gray-500">Mobilité</span><span className="font-semibold text-gray-900">{focusBuckets.mobilite}</span></div>
 </div>
 </div>
 <p className="text-[11px] text-gray-500 mt-3">Équilibrez la semaine en visant au moins 20% de mobilité.</p>
 </div>
 </div>
 )}

 {/* Trend line + heatmap */}
 {data.monthlyData && data.monthlyData.length > 1 && (
 <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
 <div className="xl:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 overflow-x-auto">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Tendance charge vs temps</h2>
 {(() => {
 const chartW = Math.max(data.monthlyData.length * 72, 360);
 const maxSessions = Math.max(...data.monthlyData.map(m => m.sessions), 1);
 const maxMinutes = Math.max(...data.monthlyData.map(m => m.minutes), 1);
 const toY = (value: number, max: number) => 140 - (value / max) * 120;
 const sessionPoints = data.monthlyData.map((m, i) => `${i * 72 + 36},${toY(m.sessions, maxSessions)}`).join(' ');
 const minutePoints = data.monthlyData.map((m, i) => `${i * 72 + 36},${toY(m.minutes, maxMinutes)}`).join(' ');
 return (
 <div>
 <svg className="h-44" style={{ width: chartW, minWidth: '100%' }} viewBox={`0 0 ${chartW} 160`} preserveAspectRatio="none">
 <line x1="0" y1="20" x2={chartW} y2="20" stroke="#f3f4f6" strokeWidth="1" />
 <line x1="0" y1="80" x2={chartW} y2="80" stroke="#f3f4f6" strokeWidth="1" />
 <line x1="0" y1="140" x2={chartW} y2="140" stroke="#f3f4f6" strokeWidth="1" />
 <polyline fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={sessionPoints} />
 <polyline fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={minutePoints} />
 {data.monthlyData.map((m, i) => (
 <g key={m.label}>
 <circle cx={i * 72 + 36} cy={toY(m.sessions, maxSessions)} r="4" fill="#111827" />
 <circle cx={i * 72 + 36} cy={toY(m.minutes, maxMinutes)} r="4" fill="#0ea5e9" />
 </g>
 ))}
 </svg>
 <div className="flex" style={{ width: chartW }}>
 {data.monthlyData.map((m) => (
 <span key={m.label} className="text-[10px] text-gray-400 text-center" style={{ width: 72 }}>{m.label}</span>
 ))}
 </div>
 <div className="mt-3 flex flex-wrap gap-3 text-xs">
 <span className="inline-flex items-center gap-1 text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-gray-900" />Séances</span>
 <span className="inline-flex items-center gap-1 text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" />Minutes</span>
 </div>
 </div>
 );
 })()}
 </div>

 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Heatmap 6 mois</h2>
 <div className="grid grid-cols-3 gap-2">
 {data.monthlyData.map((m) => {
 const intensity = maxMonthly > 0 ? m.sessions / maxMonthly : 0;
 const bg = intensity > 0.75 ? 'bg-emerald-600' : intensity > 0.45 ? 'bg-emerald-400' : intensity > 0.2 ? 'bg-emerald-200' : 'bg-gray-100';
 return (
 <div key={m.label} className="rounded-xl border border-gray-100 p-2.5">
 <div className={`h-8 rounded-lg ${bg}`} />
 <p className="text-[10px] text-gray-500 mt-1">{m.label}</p>
 <p className="text-xs font-semibold text-gray-900 tabular-nums">{m.sessions} seance{m.sessions > 1 ? 's' : ''}</p>
 </div>
 );
 })}
 </div>
 <p className="text-[11px] text-gray-500 mt-3">Visualisez en un coup d&apos;oeil les mois forts et les creux.</p>
 </div>
 </div>
 )}

 {/* Top exercises */}
 {data.topExercises && data.topExercises.length > 0 && (
 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Exercices les plus pratiqués</h2>
 <div className="space-y-3">
 {data.topExercises.map((ex, i) => (
 <div key={ex.name} className="flex items-center gap-3">
 <span className="text-xs font-bold text-gray-400 w-5 text-right">#{i + 1}</span>
 <div className="flex-1">
 <div className="flex items-center justify-between mb-1">
 <span className="text-sm font-medium text-gray-900 capitalize">{ex.name}</span>
 <span className="text-xs text-gray-500">{ex.count} fois · {ex.totalReps} reps</span>
 </div>
 <div className="w-full bg-gray-100 rounded-full h-2">
 <div className="bg-gradient-to-r from-gray-800 to-gray-600 h-2 rounded-full transition-all"
 style={{ width: `${Math.round((ex.count / maxExoCount) * 100)}%` }} />
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Stats summary */}
 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Récapitulatif</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {[
 { label: 'Programmes créés', value: String(data.totalWorkouts) },
 { label: 'Cette semaine', value: `${data.thisWeekSessions} séance${data.thisWeekSessions !== 1 ? 's' : ''}` },
 { label: 'Durée moyenne', value: `${data.avgMinutes} min / séance` },
 { label: 'Palier XP', value: `Palier ${Math.floor(data.xp / 500) + 1}` },
 ].map(s => (
 <div key={s.label} className="flex justify-between items-center py-2 border-b border-gray-50">
 <span className="text-sm text-gray-500">{s.label}</span>
 <span className="text-sm font-semibold text-gray-900">{s.value}</span>
 </div>
 ))}
 </div>
 </div>

 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Actions recommandées</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
 <p className="text-xs font-semibold text-gray-900">Plan anti-plateau</p>
 <p className="text-xs text-gray-500 mt-1">
 {weekPercent < 70
 ? `Il vous reste ${Math.max(weekGoal - data.thisWeekSessions, 0)} seance(s) pour atteindre l'objectif de la semaine.`
 : 'Objectif semaine atteint, passez à un cycle plus intense la semaine prochaine.'}
 </p>
 </div>
 <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
 <p className="text-xs font-semibold text-gray-900">Equilibre training</p>
 <p className="text-xs text-gray-500 mt-1">
 {focusBuckets.mobilite < Math.ceil(focusTotal * 0.2)
 ? 'Ajoutez une session mobilité pour limiter les tensions et mieux récupérer.'
 : 'Bonne répartition globale. Gardez une session légère dédiée à la récupération.'}
 </p>
 </div>
 </div>
 </div>

 {/* Intensité & Volume */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

 {/* Weekly volume per exercise (colored) */}
 {data.weeklyVolume && data.weeklyVolume.some(w => w.tractions + w.pompes + w.dips + w.squats > 0) && (
 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 lg:col-span-2">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Volume hebdomadaire par exercice</h2>
 <div className="flex gap-3 mb-4 flex-wrap">
 {[
 { key: 'tractions', label: 'Tractions', color: 'bg-blue-500' },
 { key: 'pompes', label: 'Pompes', color: 'bg-red-400' },
 { key: 'dips', label: 'Dips', color: 'bg-amber-500' },
 { key: 'squats', label: 'Squats', color: 'bg-emerald-500' },
 ].map(e => (
 <div key={e.key} className="flex items-center gap-1.5">
 <div className={`w-3 h-3 rounded-sm ${e.color}`} />
 <span className="text-xs text-gray-500">{e.label}</span>
 </div>
 ))}
 </div>
 {(() => {
 const maxVol = Math.max(...data.weeklyVolume!.map(w => Math.max(w.tractions, w.pompes, w.dips, w.squats)), 1);
 return (
 <div className="flex items-end gap-2 sm:gap-3 h-44">
 {data.weeklyVolume!.map(w => {
 const bars = [
 { val: w.tractions, color: 'bg-blue-500' },
 { val: w.pompes, color: 'bg-red-400' },
 { val: w.dips, color: 'bg-amber-500' },
 { val: w.squats, color: 'bg-emerald-500' },
 ];
 return (
 <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
 <div className="flex items-end gap-0.5 h-32 w-full">
 {bars.map((b, i) => {
 const h = b.val > 0 ? Math.max(Math.round((b.val / maxVol) * 100), 4) : 0;
 return (
 <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
 {b.val > 0 && <span className="text-[9px] text-gray-500 tabular-nums mb-0.5">{b.val}</span>}
 <div className={`w-full ${b.color} rounded-t transition-all`} style={{ height: `${h}%`, opacity: b.val === 0 ? 0.1 : 1 }} />
 </div>
 );
 })}
 </div>
 <span className="text-xs text-gray-400">{w.label}</span>
 </div>
 );
 })}
 </div>
 );
 })()}
 </div>
 )}

 {/* Intensité & Volume (existing) */}
 {/* Volume chart (séries + reps par semaine) */}
 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Volume d&apos;entraînement</h2>
 <div className="space-y-4">
 <div>
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs text-gray-500">Séries totales</span>
 <span className="text-sm font-bold text-gray-900">{data.totalSeries.toLocaleString()}</span>
 </div>
 <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
 <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{ width: `${Math.min((data.totalSeries / Math.max(data.totalSeries, 500)) * 100, 100)}%` }} />
 </div>
 </div>
 <div>
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs text-gray-500">Répétitions totales</span>
 <span className="text-sm font-bold text-gray-900">{data.totalReps.toLocaleString()}</span>
 </div>
 <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
 <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${Math.min((data.totalReps / Math.max(data.totalReps, 5000)) * 100, 100)}%` }} />
 </div>
 </div>
 <div>
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs text-gray-500">Temps total</span>
 <span className="text-sm font-bold text-gray-900">{timeStr}</span>
 </div>
 <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
 <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full" style={{ width: `${Math.min((data.totalMinutes / Math.max(data.totalMinutes, 600)) * 100, 100)}%` }} />
 </div>
 </div>
 <div className="pt-2 border-t border-gray-100">
 <p className="text-xs text-gray-400">
 Ratio reps/série : <span className="font-semibold text-gray-700">{data.totalSeries > 0 ? (data.totalReps / data.totalSeries).toFixed(1) : '—'}</span> reps/série en moyenne
 </p>
 </div>
 </div>
 </div>

 {/* Progression & Niveau */}
 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Progression XP</h2>
 {(() => {
 return (
 <div className="space-y-4">
 <div className="flex items-center gap-4">
 <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
 <span className="text-2xl font-black text-white">{level}</span>
 </div>
 <div className="flex-1">
 <p className="text-sm font-semibold text-gray-900">Palier {level}</p>
 <p className="text-xs text-gray-400 mb-2">{xpInLevel} / 500 XP pour le palier suivant</p>
 <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
 <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all" style={{ width: `${xpPercent}%` }} />
 </div>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3 pt-2">
 <div className="bg-gray-50 rounded-xl p-3 text-center">
 <p className="text-lg font-bold text-gray-900">{data.totalCompleted}</p>
 <p className="text-xs text-gray-400">Séances</p>
 </div>
 <div className="bg-gray-50 rounded-xl p-3 text-center">
 <p className="text-lg font-bold text-gray-900">{data.challengesCompleted}</p>
 <p className="text-xs text-gray-400">Défis</p>
 </div>
 </div>
 <p className="text-xs text-gray-400 text-center">
 {data.xp >= 2500 ? ' Athlète confirmé !' : data.xp >= 1000 ? ' En bonne voie !' : ' Continuez comme ça !'}
 </p>
 </div>
 );
 })()}
 </div>
 </div>
 </div>
 )}

 {/* ═══════ TAB: PHYSIQUE ═══════ */}
 {tab === 'physique' && (
 <div className="space-y-6">
 {/* Current stats */}
 {lastPhys && (
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
 {([
 { key: 'weight' as const, label: 'Poids', unit: 'kg', icon: '' },
 { key: 'bodyFat' as const, label: 'Masse grasse', unit: '%', icon: '' },
 { key: 'chest' as const, label: 'Tour poitrine', unit: 'cm', icon: '' },
 { key: 'waist' as const, label: 'Tour taille', unit: 'cm', icon: '' },
 { key: 'hips' as const, label: 'Tour hanches', unit: 'cm', icon: '' },
 ]).filter(m => lastPhys[m.key] != null).map(m => {
 const delta = physDelta(m.key);
 return (
 <div key={m.key} className="bg-white border border-gray-200 rounded-2xl p-4">
 <span className="text-lg">{m.icon}</span>
 <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{lastPhys[m.key]} <span className="text-sm text-gray-400">{m.unit}</span></p>
 <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
 {delta !== null && (
 <p className={`text-xs font-semibold mt-1 ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-green-500' : 'text-gray-400'}`}>
 {delta > 0 ? '+' : ''}{delta} {m.unit}
 </p>
 )}
 </div>
 );
 })}
 </div>
 )}

 {/* Evolution chart for weight */}
 {physical.filter(e => e.weight).length > 1 && (
 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-5">Évolution du poids</h2>
 {(() => {
 const weights = physical.filter(e => e.weight).map(e => ({ date: e.date, value: e.weight! }));
 const minW = Math.min(...weights.map(w => w.value)) - 2;
 const maxW = Math.max(...weights.map(w => w.value)) + 2;
 const range = maxW - minW || 1;
 const chartW = Math.max(weights.length * 60, 300);
 
 return (
 <div className="relative h-48">
 <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-xs text-gray-400">
 <span>{Math.round(maxW)}kg</span>
 <span>{Math.round((maxW + minW) / 2)}kg</span>
 <span>{Math.round(minW)}kg</span>
 </div>
 <div className="ml-12 h-full pb-6 overflow-x-auto">
 <svg className="h-full" style={{ width: chartW, minWidth: '100%' }} viewBox={`0 0 ${chartW} 160`} preserveAspectRatio="none">
 <line x1="0" y1="0" x2={chartW} y2="0" stroke="#f3f4f6" strokeWidth="1" />
 <line x1="0" y1="80" x2={chartW} y2="80" stroke="#f3f4f6" strokeWidth="1" />
 <line x1="0" y1="160" x2={chartW} y2="160" stroke="#f3f4f6" strokeWidth="1" />
 <polyline
 fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
 points={weights.map((w, i) => `${i * 60 + 30},${160 - ((w.value - minW) / range) * 150}`).join(' ')}
 />
 {weights.map((w, i) => (
 <circle key={i} cx={i * 60 + 30} cy={160 - ((w.value - minW) / range) * 150} r="5" fill="#10b981" stroke="white" strokeWidth="2" />
 ))}
 </svg>
 <div className="flex" style={{ width: chartW }}>
 {weights.map((w, i) => (
 <span key={i} className="text-[10px] text-gray-400 text-center" style={{ width: 60 }}>{w.date.slice(5)}</span>
 ))}
 </div>
 </div>
 </div>
 );
 })()}
 </div>
 )}

 {/* Measurements table */}
 {physical.length > 0 && (
 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 overflow-x-auto">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Historique des mesures</h2>
 <table className="w-full text-sm min-w-[600px]">
 <thead>
 <tr className="border-b border-gray-100">
 <th className="text-left py-2 pr-4 text-gray-500 font-medium">Date</th>
 <th className="text-right py-2 px-2 text-gray-500 font-medium">Poids</th>
 <th className="text-right py-2 px-2 text-gray-500 font-medium">Graisse</th>
 <th className="text-right py-2 px-2 text-gray-500 font-medium">Poitrine</th>
 <th className="text-right py-2 px-2 text-gray-500 font-medium">Taille</th>
 <th className="text-right py-2 px-2 text-gray-500 font-medium">Hanches</th>
 <th className="text-right py-2 px-2 text-gray-500 font-medium">Biceps G</th>
 <th className="text-right py-2 px-2 text-gray-500 font-medium">Biceps D</th>
 </tr>
 </thead>
 <tbody>
 {[...physical].reverse().slice(0, 10).map(e => (
 <tr key={e.date} className="border-b border-gray-50">
 <td className="py-2 pr-4 text-gray-900 font-medium">{e.date}</td>
 <td className="py-2 px-2 text-right tabular-nums">{e.weight ? `${e.weight}kg` : '-'}</td>
 <td className="py-2 px-2 text-right tabular-nums">{e.bodyFat ? `${e.bodyFat}%` : '-'}</td>
 <td className="py-2 px-2 text-right tabular-nums">{e.chest ? `${e.chest}cm` : '-'}</td>
 <td className="py-2 px-2 text-right tabular-nums">{e.waist ? `${e.waist}cm` : '-'}</td>
 <td className="py-2 px-2 text-right tabular-nums">{e.hips ? `${e.hips}cm` : '-'}</td>
 <td className="py-2 px-2 text-right tabular-nums">{e.bicepsL ? `${e.bicepsL}cm` : '-'}</td>
 <td className="py-2 px-2 text-right tabular-nums">{e.bicepsR ? `${e.bicepsR}cm` : '-'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Add measurement form */}
 <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
 <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4"> Nouvelle mesure</h2>
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
 {([
 { key: 'weight', label: 'Poids (kg)', placeholder: '75' },
 { key: 'height', label: 'Taille (cm)', placeholder: '178' },
 { key: 'bodyFat', label: 'Masse grasse (%)', placeholder: '15' },
 { key: 'chest', label: 'Tour poitrine (cm)', placeholder: '100' },
 { key: 'waist', label: 'Tour taille (cm)', placeholder: '80' },
 { key: 'hips', label: 'Tour hanches (cm)', placeholder: '95' },
 { key: 'bicepsL', label: 'Biceps G (cm)', placeholder: '35' },
 { key: 'bicepsR', label: 'Biceps D (cm)', placeholder: '35' },
 ] as { key: string; label: string; placeholder: string }[]).map(f => (
 <div key={f.key}>
 <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
 <input
 type="number" step="0.1" placeholder={f.placeholder}
 value={(physForm as Record<string, number | undefined>)[f.key] ?? ''}
 onChange={e => setPhysForm(p => ({ ...p, [f.key]: e.target.value ? Number(e.target.value) : undefined }))}
 className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
 />
 </div>
 ))}
 </div>
 <div className="flex items-center gap-3 mt-4">
 <button onClick={savePhysical} disabled={physSaving}
 className="px-5 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition">
 {physSaving ? 'Enregistrement...' : 'Enregistrer'}
 </button>
 {physFeedback && <span className="text-sm text-emerald-600 font-medium">{physFeedback}</span>}
 </div>
 </div>

 {physical.length === 0 && !physLoading && (
 <div className="text-center py-12">
 <span className="text-5xl"></span>
 <p className="text-gray-500 mt-3">Aucune mesure enregistrée. Ajoutez votre première mesure ci-dessus !</p>
 </div>
 )}
 {physLoading && (
 <div className="text-center py-8">
 <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
 </div>
 )}
 </div>
 )}
 </div>
 </main>
 );
}
