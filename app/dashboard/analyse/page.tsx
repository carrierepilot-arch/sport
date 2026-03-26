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
}

export default function AnalysePage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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

  return (
    <main className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
      <div className="max-w-4xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Analyse</h1>
          <p className="text-gray-500 mt-1">Vue d&apos;ensemble de vos performances.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Séances terminées', value: String(data.totalCompleted), color: 'bg-blue-50 text-blue-700' },
            { label: 'Temps total', value: timeStr, color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Séries totales', value: String(data.totalSeries), color: 'bg-orange-50 text-orange-700' },
            { label: 'Jours consécutifs', value: String(data.streak), color: 'bg-violet-50 text-violet-700' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 px-2 py-1 rounded-md inline-block ${s.color}`}>{s.label}</p>
              <p className="text-3xl font-bold text-gray-900 tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        {/* KPIs secondaires */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { label: 'Programmes créés', value: String(data.totalWorkouts), icon: '📋' },
            { label: 'Répétitions totales', value: String(data.totalReps), icon: '🔁' },
            { label: 'Cette semaine', value: `${data.thisWeekSessions} séance${data.thisWeekSessions !== 1 ? 's' : ''}`, icon: '📅' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-3">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Graphique séances par semaine */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-5">Séances par semaine (8 dernières)</h2>
          {data.weeklyData.every(d => d.count === 0) ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune séance terminée pour le moment.</p>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {data.weeklyData.map((p) => {
                const height = Math.round((p.count / maxWeekly) * 100);
                return (
                  <div key={p.label} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-500 tabular-nums">{p.count > 0 ? p.count : ''}</span>
                    <div
                      className="w-full bg-gray-900 rounded-t transition-all hover:bg-gray-700"
                      style={{ height: `${p.count > 0 ? Math.max(height, 4) : 2}%`, opacity: p.count === 0 ? 0.15 : 1 }}
                    />
                    <span className="text-xs text-gray-400">{p.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Objectif semaine */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Objectif de la semaine</h2>
            <span className="text-sm font-bold text-gray-900">{weekPercent} %</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>{data.thisWeekSessions} séance{data.thisWeekSessions !== 1 ? 's' : ''} réalisée{data.thisWeekSessions !== 1 ? 's' : ''}</span>
            <span>Objectif : {weekGoal} séances</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-gray-900 h-1.5 rounded-full transition-all" style={{ width: `${weekPercent}%` }} />
          </div>
          {data.thisWeekSessions < weekGoal && (
            <p className="text-xs text-gray-400 mt-3">Encore {weekGoal - data.thisWeekSessions} séance{weekGoal - data.thisWeekSessions > 1 ? 's' : ''} pour atteindre l&apos;objectif.</p>
          )}
          {data.thisWeekSessions >= weekGoal && (
            <p className="text-xs text-emerald-600 mt-3 font-medium">🎉 Objectif atteint cette semaine !</p>
          )}
        </div>
      </div>
    </main>
  );
}
