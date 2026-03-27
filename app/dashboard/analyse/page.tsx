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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
      <main className="flex-1 px-8 py-10">
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
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Analyse</h1>
          <p className="text-gray-500 mt-1">Vue d&apos;ensemble de vos performances et de votre évolution.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
          {([
            { key: 'performance' as const, label: '📊 Performance' },
            { key: 'physique' as const, label: '📏 Physique' },
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
                { label: 'Séances terminées', value: String(data.totalCompleted), icon: '✅', color: 'from-blue-500 to-blue-600' },
                { label: 'Temps total', value: timeStr, icon: '⏱️', color: 'from-emerald-500 to-emerald-600' },
                { label: 'Jours consécutifs', value: String(data.streak), icon: '🔥', color: 'from-orange-500 to-orange-600' },
                { label: 'XP Total', value: String(data.xp), icon: '⚡', color: 'from-violet-500 to-violet-600' },
              ].map(s => (
                <div key={s.label} className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                  <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl ${s.color} opacity-10 rounded-bl-3xl`} />
                  <span className="text-2xl">{s.icon}</span>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2 tabular-nums">{s.value}</p>
                  <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Séries totales', value: data.totalSeries.toLocaleString(), icon: '🔁' },
                { label: 'Répétitions', value: data.totalReps.toLocaleString(), icon: '💪' },
                { label: 'Défis relevés', value: String(data.challengesCompleted), icon: '🏆' },
                { label: 'Durée moy.', value: `${data.avgMinutes}min`, icon: '⏳' },
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

            {/* Weekly chart + Week goal */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-5">Séances par semaine</h2>
                {data.weeklyData.every(d => d.count === 0) ? (
                  <p className="text-sm text-gray-400 text-center py-8">Aucune séance terminée pour le moment.</p>
                ) : (
                  <div className="flex items-end gap-2 sm:gap-3 h-36 sm:h-44">
                    {data.weeklyData.map(p => {
                      const height = Math.round((p.count / maxWeekly) * 100);
                      return (
                        <div key={p.label} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-gray-600 tabular-nums">{p.count > 0 ? p.count : ''}</span>
                          <div className="w-full bg-gradient-to-t from-gray-900 to-gray-700 rounded-t-lg transition-all hover:from-gray-700 hover:to-gray-500"
                            style={{ height: `${p.count > 0 ? Math.max(height, 6) : 2}%`, opacity: p.count === 0 ? 0.15 : 1 }} />
                          <span className="text-xs text-gray-400">{p.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Objectif semaine</h2>
                <div className="flex flex-col items-center justify-center h-32">
                  <div className="relative w-24 h-24">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#111827" strokeWidth="8"
                        strokeDasharray={`${weekPercent * 2.64} ${264 - weekPercent * 2.64}`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-gray-900">{weekPercent}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">{data.thisWeekSessions}/{weekGoal} séances</p>
                </div>
              </div>
            </div>

            {/* Monthly evolution */}
            {data.monthlyData && data.monthlyData.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
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

            {/* Intensité & Volume */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  const level = Math.floor(data.xp / 500) + 1;
                  const xpInLevel = data.xp % 500;
                  const xpPercent = Math.round((xpInLevel / 500) * 100);
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
                        {data.xp >= 2500 ? '🏆 Athlète confirmé !' : data.xp >= 1000 ? '💪 En bonne voie !' : '🚀 Continuez comme ça !'}
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
                  { key: 'weight' as const, label: 'Poids', unit: 'kg', icon: '⚖️' },
                  { key: 'bodyFat' as const, label: 'Masse grasse', unit: '%', icon: '📉' },
                  { key: 'chest' as const, label: 'Tour poitrine', unit: 'cm', icon: '📐' },
                  { key: 'waist' as const, label: 'Tour taille', unit: 'cm', icon: '📏' },
                  { key: 'hips' as const, label: 'Tour hanches', unit: 'cm', icon: '🔄' },
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
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">📝 Nouvelle mesure</h2>
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
                <span className="text-5xl">📏</span>
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
