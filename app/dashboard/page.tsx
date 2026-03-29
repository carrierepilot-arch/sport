"use client";

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { getStoredSession, updateStoredUser } from '@/lib/clientRuntime';

const musclePlans = [
 { href: '/dashboard/entrainement', title: 'Corps complet', subtitle: 'Sans equipement · 12 min', image: '/images/full-body-card.svg' },
 { href: '/dashboard/entrainement', title: 'Abdos', subtitle: 'Objectif tonus · 8 min', image: '/images/core-card.svg' },
 { href: '/dashboard/entrainement', title: 'Bras & epaules', subtitle: 'Force fonctionnelle · 10 min', image: '/images/upper-card.svg' },
 { href: '/dashboard/entrainement', title: 'Jambes', subtitle: 'Stabilite · 10 min', image: '/images/lower-card.svg' },
];

const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type OnboardingStep = 1 | 2 | 3;
type LevelValue = 'debutant' | 'intermediaire' | 'elite';

const ONBOARDING_KEY = 'dashboard_onboarding_v3_done';

export default function DashboardPage() {
 const [showOnboarding, setShowOnboarding] = useState(false);
 const [step, setStep] = useState<OnboardingStep>(1);
 const [goal, setGoal] = useState('Force');
 const [level, setLevel] = useState<LevelValue>('intermediaire');
 const [days, setDays] = useState(3);
 const [saving, setSaving] = useState(false);
 const [userLevel, setUserLevel] = useState<LevelValue | ''>('');
 const [userXp, setUserXp] = useState(0);
 const [userName, setUserName] = useState('');

 const loadUserInfo = useCallback(async () => {
 const session = getStoredSession();
 const token = session?.token ?? null;
 if (session?.user) {
 if (session.user.level) setUserLevel(session.user.level as LevelValue);
 if (session.user.xp != null) setUserXp(session.user.xp);
 if (session.user.name) setUserName(session.user.name);
 }
 if (!token) return;
 try {
 const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
 if (!res.ok) return;
 const data = await res.json();
 if (data.user?.level) setUserLevel(data.user.level as LevelValue);
 if (data.user?.xp != null) setUserXp(data.user.xp);
 if (data.user?.name) setUserName(data.user.name);
 updateStoredUser(data.user ?? {});
 } catch { /* silencieux */ }
 }, []);

 useEffect(() => { loadUserInfo(); }, [loadUserInfo]);

 useEffect(() => {
 try {
 const done = localStorage.getItem(ONBOARDING_KEY);
 if (!done) setShowOnboarding(true);
 } catch {
 setShowOnboarding(true);
 }
 }, []);

 const finishOnboarding = async () => {
 setSaving(true);
 const token = getStoredSession()?.token ?? null;
 try {
 if (token) {
 await Promise.all([
 fetch('/api/user/update', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ level }),
 }),
 fetch('/api/user/equipment', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ equipmentData: { goal, frequence: days } }),
 }),
 ]);
 updateStoredUser({ level, equipmentData: { goal, frequence: days } });
 }
 } catch {
 updateStoredUser({ level, equipmentData: { goal, frequence: days } });
 // Silent fallback: onboarding still closes locally.
 }
 try {
 localStorage.setItem(ONBOARDING_KEY, '1');
 } catch {
 // ignore
 }
 setSaving(false);
 setShowOnboarding(false);
 };

 const stepPct = step === 1 ? 33 : step === 2 ? 66 : 100;

 return (
 <main className="px-4 py-6 md:px-8 md:py-8 max-w-6xl w-full mx-auto">
 {showOnboarding && (
 <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] p-4 flex items-center justify-center">
 <div className="ios-card w-full max-w-lg p-5 md:p-6">
 <p className="text-xs uppercase tracking-[0.16em] text-gray-400 font-semibold">Configuration rapide</p>
 <h2 className="text-xl font-bold text-gray-900 mt-1">Onboarding en 3 etapes</h2>
 <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
 <div className="h-2 bg-gray-900 transition-all" style={{ width: `${stepPct}%` }} />
 </div>

 {step === 1 && (
 <div className="mt-5 space-y-3">
 <p className="text-sm font-semibold text-gray-800">1. Quel est votre objectif principal ?</p>
 <div className="grid grid-cols-2 gap-2">
 {['Force', 'Cardio', 'Endurance', 'Hypertrophie'].map((g) => (
 <button
 key={g}
 onClick={() => setGoal(g)}
 className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${goal === g ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
 >
 {g}
 </button>
 ))}
 </div>
 </div>
 )}

 {step === 2 && (
 <div className="mt-5 space-y-3">
 <p className="text-sm font-semibold text-gray-800">2. Quel est votre niveau ?</p>
 <div className="grid grid-cols-3 gap-2">
 {([
 { key: 'debutant' as const, label: 'Debutant' },
 { key: 'intermediaire' as const, label: 'Intermediaire' },
 { key: 'elite' as const, label: 'Elite' },
 ]).map((l) => (
 <button
 key={l.key}
 onClick={() => setLevel(l.key)}
 className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${level === l.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
 >
 {l.label}
 </button>
 ))}
 </div>
 </div>
 )}

 {step === 3 && (
 <div className="mt-5 space-y-3">
 <p className="text-sm font-semibold text-gray-800">3. Combien de seances par semaine ?</p>
 <div className="grid grid-cols-4 gap-2">
 {[2, 3, 4, 5].map((n) => (
 <button
 key={n}
 onClick={() => setDays(n)}
 className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${days === n ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
 >
 {n} / sem.
 </button>
 ))}
 </div>
 </div>
 )}

 <div className="mt-6 flex gap-2 justify-end">
 {step > 1 && (
 <button
 onClick={() => setStep((s) => (s - 1) as OnboardingStep)}
 className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700"
 >
 Retour
 </button>
 )}
 {step < 3 ? (
 <button
 onClick={() => setStep((s) => (s + 1) as OnboardingStep)}
 className="px-4 py-2.5 rounded-xl bg-gray-900 text-sm font-semibold text-white"
 >
 Continuer
 </button>
 ) : (
 <button
 onClick={finishOnboarding}
 disabled={saving}
 className="px-4 py-2.5 rounded-xl bg-gray-900 text-sm font-semibold text-white disabled:opacity-60"
 >
 {saving ? 'Enregistrement...' : 'Terminer'}
 </button>
 )}
 </div>
 </div>
 </div>
 )}

 <header className="ios-card p-5 md:p-7 mb-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Routine du jour</p>
 <h1 className="ios-section-title mt-2 text-gray-900">{userName ? `Salut ${userName.split(' ')[0]}` : 'Pret pour votre seance'}</h1>
 <p className="mt-2 text-sm text-gray-600 max-w-2xl">{
 userLevel === 'elite' ? 'Poussez vos limites avec des seances avancees et du suivi precis.' :
 userLevel === 'debutant' ? 'Demarrez en douceur, chaque seance compte pour progresser.' :
 'Demarrez vite, puis suivez votre progression semaine apres semaine.'
 }</p>
 <div className="mt-4 flex flex-wrap gap-2">
 <Link
 href="/dashboard/entrainement"
 className="inline-flex items-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"
 >
 Commencer
 </Link>
 <Link
 href="/dashboard/analyse"
 className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
 >
 Voir ma progression
 </Link>
 </div>
 </div>
 <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
 <img src="/images/routine-hero.svg" alt="Illustration routine d'entrainement" className="w-full h-44 md:h-48 object-cover" />
 </div>
 </div>
 </header>

 {/* NIVEAU & XP */}
 <section className="mb-6">
 <div className={`ios-card overflow-hidden ${
 userLevel === 'elite' ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200' :
 userLevel === 'intermediaire' ? 'bg-gradient-to-r from-sky-50 to-indigo-50 border-sky-200' :
 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
 }`}>
 <div className="p-5 md:p-6">
 <div className="flex items-center justify-between gap-4">
 <div className="flex items-center gap-3">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-sm ${
 userLevel === 'elite' ? 'bg-gradient-to-br from-amber-500 to-yellow-600' :
 userLevel === 'intermediaire' ? 'bg-gradient-to-br from-sky-500 to-indigo-600' :
 'bg-gradient-to-br from-emerald-500 to-teal-600'
 }`}>
 {userLevel === 'elite' ? 'E' : userLevel === 'intermediaire' ? 'I' : 'D'}
 </div>
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Niveau actuel</p>
 <p className="text-lg font-black text-gray-900 capitalize">{userLevel || 'Non defini'}</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-2xl font-black text-gray-900">{userXp}</p>
 <p className="text-xs text-gray-500">XP</p>
 </div>
 </div>
 <div className="mt-3">
 <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
 <span>Progression</span>
 <span>{userXp % 500} / 500 XP</span>
 </div>
 <div className="bg-white/60 rounded-full h-2.5 overflow-hidden">
 <div className={`h-full rounded-full transition-all ${
 userLevel === 'elite' ? 'bg-amber-500' :
 userLevel === 'intermediaire' ? 'bg-sky-500' : 'bg-emerald-500'
 }`} style={{ width: `${Math.min(100, (userXp % 500) / 5)}%` }} />
 </div>
 </div>
 {!userLevel && (
 <Link href="/dashboard/entrainement" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-600 transition">
 Passer le test de niveau
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
 </Link>
 )}
 </div>
 </div>
 </section>

 <section className="mb-6">
 <div className="ios-card p-4 md:p-5">
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-xs uppercase tracking-[0.16em] text-gray-400 font-semibold">Semaine en cours</p>
 <p className="text-sm font-semibold text-gray-900 mt-1">3 seances sur 5 realisees</p>
 </div>
 <span className="text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 border border-emerald-200">Streak 6 jours</span>
 </div>
 <div className="mt-4 grid grid-cols-7 gap-2">
 {weekDays.map((day, idx) => (
 <div key={`${day}-${idx}`} className="text-center">
 <div className="text-[11px] text-gray-400 mb-1">{day}</div>
 <div className={`h-9 rounded-lg border ${idx < 3 ? 'bg-emerald-500 border-emerald-500' : idx === 3 ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200'}`} />
 </div>
 ))}
 </div>
 </div>
 </section>

 <section className="mb-7">
 <h2 className="text-base md:text-lg font-bold text-gray-900 mb-3">Plans rapides</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
 {musclePlans.map((item) => (
 <Link
 key={`${item.href}-${item.title}`}
 href={item.href}
 className="ios-card p-4 md:p-5 hover:-translate-y-0.5 transition"
 >
 <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 mb-3">
 <img src={item.image} alt={item.title} className="w-full h-24 object-cover" />
 </div>
 <p className="text-sm font-semibold text-gray-900">{item.title}</p>
 <p className="text-xs text-gray-500 mt-1">{item.subtitle}</p>
 <span className="inline-flex mt-3 text-sm font-semibold text-sky-700">Lancer</span>
 </Link>
 ))}
 </div>
 </section>

 <section>
 <h2 className="text-base md:text-lg font-bold text-gray-900 mb-3">Suivi personnel</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <Link
 href="/dashboard/analyse"
 className="ios-card p-4 md:p-5"
 >
 <p className="text-sm font-semibold text-gray-900">Progression</p>
 <p className="text-xs text-gray-500 mt-1">Poids, regularite, volume hebdo</p>
 <span className="inline-flex mt-3 text-sm font-semibold text-sky-700">Ouvrir</span>
 </Link>
 <Link
 href="/dashboard/profil"
 className="ios-card p-4 md:p-5"
 >
 <p className="text-sm font-semibold text-gray-900">Profil</p>
 <p className="text-xs text-gray-500 mt-1">Objectifs, niveau, preferences</p>
 <span className="inline-flex mt-3 text-sm font-semibold text-sky-700">Ouvrir</span>
 </Link>
 </div>
 </section>

 <section className="mt-6">
 <h2 className="text-base md:text-lg font-bold text-gray-900 mb-3">Plus</h2>
 <div className="ios-card p-3 md:p-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {[
 { href: '/dashboard/reseau', label: 'Reseau' },
 { href: '/dashboard/carte', label: 'Carte des spots' },
 { href: '/dashboard/classement', label: 'Classement' },
 { href: '/dashboard/idees', label: 'Idees & suggestions' },
 ].map((item) => (
 <Link
 key={item.href}
 href={item.href}
 className="flex items-center justify-between rounded-xl border border-gray-200/90 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
 >
 <span>{item.label}</span>
 <span className="text-gray-400">Voir</span>
 </Link>
 ))}
 </div>
 </div>
 </section>
 </main>
 );
}
