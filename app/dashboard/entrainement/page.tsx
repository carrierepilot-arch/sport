'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ExerciseMotionPreview } from '@/components/ExerciseMotionPreview';
import { fetchExerciseMedia } from '@/lib/exercise-media-client';

// ─── Types ───
type Objectif = 'Force' | 'Cardio' | 'Endurance' | 'Hypertrophie';
type UserLevel = 'debutant' | 'intermediaire' | 'elite';
type TempsSeance = '30min' | '1h' | '1h30' | '2h' | '';
type DureeProgramme = '1_semaine' | '2_semaines' | '1_mois' | '2_mois' | '3_mois' | '';
type Lieu = 'Salle de sport' | 'Maison' | 'Street workout' | '';
type Equipement = 'Ceinture lestee' | 'Gilet leste' | 'Elastiques' | 'Halteres' | 'Barre de traction' | 'Parallettes' | 'Anneaux' | 'Autre';
interface EquipementConfig { maxKg: number; progression: string; detail?: string }

type Figure = 'Front lever' | 'Back lever' | 'Handstand' | 'Drapeau' | 'Planche' | 'Muscle up' | 'L-sit' | 'V-sit' | 'Dragon flag' | 'Pistol squat' | 'Handstand push-up' | '360 pull-up';
type Muscle = 'Pectoraux' | 'Dos' | 'Epaules' | 'Biceps' | 'Triceps' | 'Abdominaux' | 'Jambes';

const FIGURES: Figure[] = ['Front lever', 'Back lever', 'Handstand', 'Drapeau', 'Planche', 'Muscle up', 'L-sit', 'V-sit', 'Dragon flag', 'Pistol squat', 'Handstand push-up', '360 pull-up'];

const NIVEAUX: Record<Figure, string[]> = {
 'Front lever': ['Tuck front lever', 'Advanced tuck', 'Straddle', 'Front lever partiel', 'Front lever tenu 10s+'],
 'Back lever': ['Tuck back lever', 'Advanced tuck', 'Straddle', 'Back lever partiel', 'Back lever tenu 10s+'],
 'Handstand': ['Contre le mur', 'Decolle du mur 5s', 'Tenu libre 10s', 'Tenu libre 30s', 'Handstand maitrise'],
 'Drapeau': ['Tuck drapeau', 'Genoux plies', 'Straddle', 'Drapeau partiel', 'Drapeau tenu 10s+'],
 'Planche': ['Lean planche', 'Tuck planche', 'Advanced tuck', 'Straddle', 'Full planche'],
 'Muscle up': ['Traction haute', 'Transition basse', 'Transition mi-hauteur', 'Muscle up assiste', 'Muscle up strict'],
 'L-sit': ['L-sit au sol 5s', 'L-sit au sol 15s', 'L-sit aux barres 10s', 'L-sit aux barres 20s', 'L-sit tenu 30s+'],
 'V-sit': ['L-sit maitrise', 'V-sit assiste', 'V-sit partiel', 'V-sit 5s', 'V-sit tenu 10s+'],
 'Dragon flag': ['Tuck dragon flag', 'Un genou tendu', 'Straddle dragon flag', 'Dragon flag negatif', 'Dragon flag complet'],
 'Pistol squat': ['Squat bulgare', 'Pistol assiste (support)', 'Pistol negatif', 'Pistol partiel', 'Pistol squat complet'],
 'Handstand push-up': ['Pike push-up', 'Pike push-up sureleve', 'HSPU assiste mur', 'HSPU strict mur', 'HSPU libre'],
 '360 pull-up': ['Traction explosive poitrine', 'Traction explosive lacher', 'Rotation 180', 'Rotation 270', '360 complet'],
};

const MUSCLES: Muscle[] = ['Pectoraux', 'Dos', 'Epaules', 'Biceps', 'Triceps', 'Abdominaux', 'Jambes'];

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Programme structuré
interface ProgrammeExercice { nom: string; series: number; reps: string; repos: string; conseil?: string }
interface ProgrammeJour { jour: string; focus: string; exercices: ProgrammeExercice[] }
interface ProgrammeSemaine { semaine: number; description?: string; jours: ProgrammeJour[] }
interface ProgrammeData { jours: ProgrammeJour[]; semaines?: ProgrammeSemaine[]; conseils_generaux?: string; progression_4_semaines?: string }

// Amis réels (chargés depuis l'API)
interface Ami { id: string; friendId: string; pseudo: string; nom: string; statut: string }

// ─── Wger Exercise ───
interface ExerciseDBItem {
 id: number;
 name: string;
 description: string;
 category: { name: string };
 muscles: { name_en: string }[];
 equipment: { name: string }[];
 gifUrl?: string | null;
 animationFrames?: string[] | null;
 instructionFr?: string | null;
}

// ─── Test de niveau ───
type TestType = 'endurance' | 'force' | 'statique' | '';
interface TestExercice { nom: string; duree: number }

const TESTS_ENDURANCE: TestExercice[] = [
 { nom: 'Pompes', duree: 60 },
 { nom: 'Dips', duree: 60 },
 { nom: 'Tractions', duree: 60 },
 { nom: 'Squats', duree: 60 },
];

const TESTS_FORCE_1RM = [
 { nom: 'Tractions lestees', unite: 'kg' },
 { nom: 'Dips lestes', unite: 'kg' },
 { nom: 'Squats lestes', unite: 'kg' },
 { nom: 'Pompes lestees', unite: 'kg' },
];

type ForceRMType = '1RM' | '2RM' | '3RM';

const TESTS_STATIQUE: TestExercice[] = [
 { nom: 'Traction - menton au-dessus de la barre', duree: 15 },
 { nom: 'Dips - position haute (bras tendus)', duree: 15 },
 { nom: 'Dips - position basse (fin du mouvement)', duree: 15 },
 { nom: 'Pompes - position intermediaire (mi-descente)', duree: 15 },
];

// ─── Components ───
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
 return (
 <section className="bg-white rounded-xl border border-gray-200 p-5">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{title}</h2>
 {subtitle && <p className="text-xs text-gray-400 mb-3 -mt-1">{subtitle}</p>}
 {children}
 </section>
 );
}

// ─── Timer sounds ───
function getAudioCtx(): AudioContext | null {
 if (typeof window === 'undefined') return null;
 try {
 const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
 return new AudioCtx();
 } catch { return null; }
}

/** Short tick for countdown (3-2-1) */
function playTick() {
 const ctx = getAudioCtx();
 if (!ctx) return;
 try {
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.connect(gain);
 gain.connect(ctx.destination);
 osc.frequency.value = 660;
 osc.type = 'sine';
 gain.gain.setValueAtTime(0.35, ctx.currentTime);
 gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
 osc.start(ctx.currentTime);
 osc.stop(ctx.currentTime + 0.15);
 } catch { /* silencieux */ }
}

/** Triple ascending beep when timer completes */
function playBeep() {
 const ctx = getAudioCtx();
 if (!ctx) return;
 try {
 const freqs = [523, 659, 784]; // C5 E5 G5
 freqs.forEach((freq, i) => {
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.connect(gain);
 gain.connect(ctx.destination);
 osc.frequency.value = freq;
 osc.type = 'sine';
 const t = ctx.currentTime + i * 0.18;
 gain.gain.setValueAtTime(0.5, t);
 gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
 osc.start(t);
 osc.stop(t + 0.35);
 });
 } catch { /* silencieux */ }
}

// ─── Timer Component ───
function Timer({ seconds, onComplete }: { seconds: number; onComplete: () => void }) {
 const [remaining, setRemaining] = useState(seconds);

 useEffect(() => {
 setRemaining(seconds);
 }, [seconds]);

 useEffect(() => {
 if (remaining <= 0) { playBeep(); onComplete(); return; }
 if (remaining <= 3) playTick();
 const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
 return () => clearTimeout(t);
 }, [remaining, onComplete]);

 const mins = Math.floor(remaining / 60);
 const secs = remaining % 60;
 const pct = seconds > 0 ? ((seconds - remaining) / seconds) * 100 : 100;

 return (
 <div className="text-center">
 <div className="text-5xl font-mono font-bold text-gray-900 tabular-nums mb-3">
 {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
 </div>
 <div className="w-full bg-gray-200 rounded-full h-2">
 <div className="h-2 rounded-full bg-emerald-500 transition-all duration-1000" style={{ width: `${pct}%` }} />
 </div>
 </div>
 );
}

// ─── Test de niveau component ───
function TestNiveau({ onComplete }: { onComplete?: () => void }) {
 const [testType, setTestType] = useState<TestType>('');
 const [testStarted, setTestStarted] = useState(false);
 const [currentExo, setCurrentExo] = useState(0);
 const [phase, setPhase] = useState<'exercice' | 'saisie' | 'repos' | 'termine'>('exercice');
 const [reposDuree, setReposDuree] = useState(240);
 const [reps, setReps] = useState<number[]>([]);
 const [currentReps, setCurrentReps] = useState('');
 const [evaluation, setEvaluation] = useState<string | null>(null);
 const [evaluating, setEvaluating] = useState(false);
 // Manual level entry state
 const [manualMode, setManualMode] = useState(false);
 const [manualLevel, setManualLevel] = useState<'debutant' | 'intermediaire' | 'elite'>('intermediaire');
 const [manualEndurance, setManualEndurance] = useState<Record<string, string>>({});
 const [manualForce, setManualForce] = useState<Record<string, string>>({});
 const [manualSaving, setManualSaving] = useState(false);
 const [manualSaved, setManualSaved] = useState(false);
 // Force 1RM state
 const [forceRMType, setForceRMType] = useState<ForceRMType>('1RM');
 const [forceInputs, setForceInputs] = useState<Record<string, string>>({});
 const [forceRepsInputs, setForceRepsInputs] = useState<Record<string, string>>({});

 const exercises = testType === 'endurance' ? TESTS_ENDURANCE : testType === 'statique' ? TESTS_STATIQUE : TESTS_ENDURANCE;

 const startTest = (type: TestType) => {
 setTestType(type);
 setTestStarted(true);
 setCurrentExo(0);
 setPhase(type === 'force' ? 'termine' : 'exercice');
 setReps([]);
 setCurrentReps('');
 setReposDuree(240);
 setEvaluation(null);
 setForceInputs({});
 setForceRepsInputs({});
 };

 const onExerciceComplete = useCallback(() => {
 setPhase('saisie');
 }, []);

 // Submit for endurance / static tests (timed)
 const submitReps = () => {
 const val = parseInt(currentReps) || 0;
 const newReps = [...reps, val];
 setReps(newReps);
 setCurrentReps('');
 if (currentExo < exercises.length - 1) {
 setPhase('repos');
 setReposDuree(240);
 } else {
 setPhase('termine');
 const nomExercices = exercises.map((e) => e.nom);
 setEvaluating(true);
 const token = localStorage.getItem('token');
 fetch('/api/evaluer-test', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
 body: JSON.stringify({ testType, exercices: nomExercices, resultats: newReps }),
 })
 .then((r) => r.json())
 .then((d) => { setEvaluation(d.evaluation || d.error || null); onComplete?.(); })
 .catch(() => setEvaluation('Erreur de connexion.'))
 .finally(() => setEvaluating(false));
 }
 };

 // Submit for force test (1RM/2RM/3RM weights)
 const submitForceTest = () => {
 const nomExercices = TESTS_FORCE_1RM.map((e) => e.nom);
 const resultats = TESTS_FORCE_1RM.map((e) => parseFloat(forceInputs[e.nom] || '0'));
 const repsPerExo = TESTS_FORCE_1RM.map((e) => parseInt(forceRepsInputs[e.nom] || (forceRMType === '1RM' ? '1' : forceRMType === '2RM' ? '2' : '3')));
 setEvaluating(true);
 const token = localStorage.getItem('token');
 fetch('/api/evaluer-test', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
 body: JSON.stringify({ testType: 'force', exercices: nomExercices, resultats, forceRMType, forceRepsPerExo: repsPerExo }),
 })
 .then((r) => r.json())
 .then((d) => { setEvaluation(d.evaluation || d.error || null); onComplete?.(); })
 .catch(() => setEvaluation('Erreur de connexion.'))
 .finally(() => setEvaluating(false));
 };

 const onReposComplete = useCallback(() => {
 setCurrentExo((c) => c + 1);
 setPhase('exercice');
 }, []);

 const resetTest = () => {
 setTestType('');
 setTestStarted(false);
 setCurrentExo(0);
 setPhase('exercice');
 setReps([]);
 setEvaluation(null);
 setManualMode(false);
 setManualSaved(false);
 };

 // Save manual level entry
 const saveManualLevel = async () => {
 setManualSaving(true);
 const token = localStorage.getItem('token');
 try {
 // Save level
 await fetch('/api/user/update', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
 body: JSON.stringify({ level: manualLevel }),
 });
 // Save test results (manual) via evaluer-test
 await fetch('/api/evaluer-test', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
 body: JSON.stringify({
 testType: 'manual',
 exercices: ['Pompes', 'Tractions', 'Dips', 'Squats'],
 resultats: [
 parseInt(manualEndurance['Pompes'] || '0'),
 parseInt(manualEndurance['Tractions'] || '0'),
 parseInt(manualEndurance['Dips'] || '0'),
 parseInt(manualEndurance['Squats'] || '0'),
 ],
 manualLevel,
 manualForce: {
 pompes_lestees: manualForce['pompes_lestees'] || '0',
 tractions_lestees: manualForce['tractions_lestees'] || '0',
 dips_lestes: manualForce['dips_lestes'] || '0',
 squats_lestes: manualForce['squats_lestes'] || '0',
 },
 }),
 });
 setManualSaved(true);
 onComplete?.();
 } catch { /* silencieux */ }
 setManualSaving(false);
 };

 if (!testStarted && !manualMode) {
 return (
 <div className="space-y-3">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 {([
 { type: 'endurance' as TestType, label: 'Test Endurance', desc: '4 exercices, 1 min chacun' },
 { type: 'force' as TestType, label: 'Test Force', desc: '1RM / 2RM / 3RM (charges)' },
 { type: 'statique' as TestType, label: 'Test Positionnel', desc: '4 positions, maintien max' },
 ]).map((t) => (
 <button
 key={t.type}
 onClick={() => startTest(t.type)}
 className="py-5 rounded-xl border-2 border-gray-200 text-sm font-semibold transition hover:border-emerald-500 hover:bg-emerald-50 bg-white text-gray-700"
 >
 <div className="font-bold">{t.label}</div>
 <div className="text-xs text-gray-400 mt-1">{t.desc}</div>
 </button>
 ))}
 </div>
 <button
 onClick={() => setManualMode(true)}
 className="w-full py-4 rounded-xl border-2 border-dashed border-gray-300 text-sm font-semibold transition hover:border-emerald-400 hover:bg-emerald-50 bg-white text-gray-500"
 >
 Niveau déjà connu — Entrer mes performances manuellement
 </button>
 </div>
 );
 }

 // ── Manual level entry form ──
 if (manualMode) {
 if (manualSaved) {
 return (
 <div className="space-y-4">
 <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
 <span className="text-4xl"></span>
 <h3 className="text-lg font-bold text-gray-900 mt-2">Profil enregistré !</h3>
 <p className="text-sm text-gray-600 mt-1">Votre niveau <span className="font-semibold capitalize">{manualLevel}</span> et vos performances ont été sauvegardés.</p>
 </div>
 <button onClick={resetTest} className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition">
 Retour
 </button>
 </div>
 );
 }
 return (
 <div className="space-y-5">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-bold text-gray-900"> Niveau déjà connu</h3>
 <button onClick={() => setManualMode(false)} className="text-sm text-gray-400 hover:text-gray-600 transition">Annuler</button>
 </div>

 {/* Level selection */}
 <div>
 <p className="text-sm font-medium text-gray-700 mb-2">Quel est votre niveau global ?</p>
 <div className="grid grid-cols-3 gap-2">
 {([
 { key: 'debutant' as const, label: 'Débutant', desc: '< 6 mois' },
 { key: 'intermediaire' as const, label: 'Intermédiaire', desc: '6 mois - 2 ans' },
 { key: 'elite' as const, label: 'Élite', desc: '2+ ans' },
 ]).map((l) => (
 <button key={l.key} onClick={() => setManualLevel(l.key)}
 className={`py-3 rounded-xl border-2 text-sm font-semibold transition text-center ${
 manualLevel === l.key ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-200 text-gray-600 hover:border-emerald-400 bg-white'
 }`}>
 <span className="block">{l.label}</span>
 <span className="block text-xs mt-0.5 opacity-75">{l.desc}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Endurance max reps */}
 <div>
 <p className="text-sm font-medium text-gray-700 mb-2">Vos max en endurance (reps en 1 série)</p>
 <div className="grid grid-cols-2 gap-3">
 {['Pompes', 'Tractions', 'Dips', 'Squats'].map((exo) => (
 <div key={exo}>
 <label className="text-xs text-gray-500 font-medium mb-1 block">{exo}</label>
 <input type="number" min={0} placeholder="0"
 value={manualEndurance[exo] ?? ''}
 onChange={(e) => setManualEndurance((p) => ({ ...p, [exo]: e.target.value }))}
 className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" />
 </div>
 ))}
 </div>
 </div>

 {/* Force (optional) */}
 {manualLevel !== 'debutant' && (
 <div>
 <p className="text-sm font-medium text-gray-700 mb-2">Charge max lestée (optionnel, en kg)</p>
 <div className="grid grid-cols-2 gap-3">
 {[
 { key: 'tractions_lestees', label: 'Tractions lestées' },
 { key: 'dips_lestes', label: 'Dips lestés' },
 { key: 'squats_lestes', label: 'Squats lestés' },
 { key: 'pompes_lestees', label: 'Pompes lestées' },
 ].map((f) => (
 <div key={f.key}>
 <label className="text-xs text-gray-500 font-medium mb-1 block">{f.label}</label>
 <input type="number" min={0} placeholder="0 kg"
 value={manualForce[f.key] ?? ''}
 onChange={(e) => setManualForce((p) => ({ ...p, [f.key]: e.target.value }))}
 className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" />
 </div>
 ))}
 </div>
 </div>
 )}

 <button onClick={saveManualLevel} disabled={manualSaving}
 className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600 text-white font-semibold rounded-lg transition">
 {manualSaving ? 'Enregistrement...' : 'Enregistrer mon niveau'}
 </button>
 </div>
 );
 }

 if (phase === 'termine') {
 // ── Force test: 1RM / 2RM / 3RM input form ──
 if (testType === 'force' && !evaluation) {
 return (
 <div className="space-y-5">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-bold text-gray-900">Test de Force (RM)</h3>
 <button onClick={resetTest} className="text-sm text-gray-400 hover:text-gray-600 transition">Annuler</button>
 </div>

 <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
 <p className="text-sm text-amber-800 font-medium">Renseignez la charge maximale que vous pouvez soulever pour 1, 2 ou 3 repetitions sur chaque exercice.</p>
 </div>

 {/* RM type selector */}
 <div>
 <p className="text-sm font-medium text-gray-700 mb-2">Type de mesure</p>
 <div className="grid grid-cols-3 gap-2">
 {(['1RM', '2RM', '3RM'] as ForceRMType[]).map((rm) => (
 <button key={rm} onClick={() => setForceRMType(rm)}
 className={`py-3 rounded-xl border-2 text-sm font-semibold transition text-center ${
 forceRMType === rm ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-200 text-gray-600 hover:border-emerald-400 bg-white'
 }`}>
 <span className="block font-bold">{rm}</span>
 <span className="block text-xs mt-0.5 opacity-75">{rm === '1RM' ? '1 rep max' : rm === '2RM' ? '2 reps max' : '3 reps max'}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Weight inputs per exercise */}
 <div className="space-y-3">
 <p className="text-sm font-medium text-gray-700">Charges par exercice ({forceRMType})</p>
 {TESTS_FORCE_1RM.map((exo) => (
 <div key={exo.nom} className="bg-white border border-gray-200 rounded-xl p-4">
 <label className="text-sm font-semibold text-gray-800 block mb-2">{exo.nom}</label>
 <div className="flex items-center gap-3">
 <div className="flex-1">
 <input type="number" min={0} step={0.5} placeholder="0"
 value={forceInputs[exo.nom] ?? ''}
 onChange={(e) => setForceInputs((p) => ({ ...p, [exo.nom]: e.target.value }))}
 className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none text-center text-lg font-bold" />
 <span className="text-xs text-gray-400 mt-1 block text-center">kg</span>
 </div>
 {forceRMType !== '1RM' && (
 <div className="w-20">
 <input type="number" min={1} max={forceRMType === '2RM' ? 2 : 3} placeholder={forceRMType === '2RM' ? '2' : '3'}
 value={forceRepsInputs[exo.nom] ?? ''}
 onChange={(e) => setForceRepsInputs((p) => ({ ...p, [exo.nom]: e.target.value }))}
 className="w-full px-2 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none text-center" />
 <span className="text-xs text-gray-400 mt-1 block text-center">reps</span>
 </div>
 )}
 </div>
 </div>
 ))}
 </div>

 <button onClick={submitForceTest} disabled={evaluating || TESTS_FORCE_1RM.every((e) => !forceInputs[e.nom])}
 className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-300 disabled:text-gray-500 text-white font-semibold rounded-lg transition">
 {evaluating ? 'Analyse en cours...' : 'Evaluer mon niveau de force'}
 </button>
 </div>
 );
 }

 // ── Results display for all test types (after evaluation) ──
 return (
 <div className="space-y-4">
 <h3 className="text-lg font-bold text-gray-900">Resultats du test</h3>

 {testType === 'force' ? (
 <div className="grid grid-cols-2 gap-3">
 {TESTS_FORCE_1RM.map((exo) => (
 <div key={exo.nom} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
 <p className="text-sm font-medium text-gray-700">{exo.nom}</p>
 <p className="text-2xl font-bold text-emerald-600 tabular-nums">{forceInputs[exo.nom] || 0} kg</p>
 <p className="text-xs text-gray-400">{forceRMType}</p>
 </div>
 ))}
 </div>
 ) : (
 <>
 <div className="grid grid-cols-2 gap-3">
 {exercises.map((ex, i) => (
 <div key={ex.nom} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
 <p className="text-sm font-medium text-gray-700">{ex.nom}</p>
 <p className="text-2xl font-bold text-emerald-600 tabular-nums">{reps[i] ?? 0} {testType === 'statique' ? 'sec' : 'reps'}</p>
 </div>
 ))}
 </div>
 <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
 <p className="text-sm font-medium text-emerald-800">
 Total : {reps.reduce((a, b) => a + b, 0)} {testType === 'statique' ? 'secondes' : 'repetitions'}
 </p>
 </div>
 </>
 )}

 {/* Evaluation IA */}
 <div className="bg-white border border-gray-200 rounded-xl p-5">
 <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-2">Evaluation IA</p>
 {evaluating && (
 <div className="flex items-center gap-2 text-sm text-gray-500">
 <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
 Analyse de vos resultats...
 </div>
 )}
 {!evaluating && evaluation && (
 <p className="text-sm text-gray-700 leading-relaxed">{evaluation}</p>
 )}
 </div>

 <button onClick={resetTest} className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition">
 Refaire un test
 </button>
 </div>
 );
 }

 const exo = exercises[currentExo];

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-gray-400 uppercase tracking-widest">Exercice {currentExo + 1} / {exercises.length}</p>
 <h3 className="text-xl font-bold text-gray-900">{exo.nom}</h3>
 </div>
 <button onClick={resetTest} className="text-sm text-gray-400 hover:text-gray-600 transition">Annuler</button>
 </div>

 {phase === 'exercice' && (
 <div className="bg-gray-50 border border-gray-200 rounded-xl p-8">
 <p className="text-sm text-gray-500 mb-4 text-center">Realisez un maximum de repetitions</p>
 <Timer seconds={exo.duree} onComplete={onExerciceComplete} />
 </div>
 )}

 {phase === 'saisie' && (
 <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 space-y-4">
 <p className="text-sm font-medium text-emerald-800">Combien de {testType === 'statique' ? 'secondes' : 'repetitions'} as-tu realise ?</p>
 <input
 type="number"
 min={0}
 value={currentReps}
 onChange={(e) => setCurrentReps(e.target.value)}
 placeholder="0"
 className="w-full px-4 py-3 rounded-lg border border-emerald-300 text-center text-2xl font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
 />
 <button
 onClick={submitReps}
 className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-lg transition"
 >
 Valider
 </button>
 </div>
 )}

 {phase === 'repos' && (
 <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 space-y-4">
 <p className="text-sm text-gray-500 text-center">Temps de repos</p>
 <Timer seconds={reposDuree} onComplete={onReposComplete} />
 <div className="flex justify-center gap-3">
 <button
 onClick={() => setReposDuree((d) => Math.max(15, d - 15))}
 className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
 >
 -15s
 </button>
 <button
 onClick={() => setReposDuree((d) => d + 15)}
 className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
 >
 +15s
 </button>
 </div>
 </div>
 )}

 {/* Progress dots */}
 <div className="flex justify-center gap-2">
 {exercises.map((_, i) => (
 <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < currentExo ? 'bg-emerald-500' : i === currentExo ? 'bg-emerald-300' : 'bg-gray-200'}`} />
 ))}
 </div>
 </div>
 );
}

// ─── SessionPlayer : interface interactive pendant la séance ─────────────────
interface ExerciceResult { nom: string; series: number; targetReps: string; repos: string; sets: { success: boolean; repsActuelles?: number }[] }

type ExerciseAnimationType = 'push' | 'pull' | 'squat' | 'dip' | 'core' | 'generic';

function inferExerciseAnimationType(name: string): ExerciseAnimationType {
 const n = name.toLowerCase();
 if (/(pompe|push[ -]?up|burpee|développé)/.test(n)) return 'push';
 if (/(traction|pull[ -]?up|chin[ -]?up|row|tirage|muscle[ -]?up)/.test(n)) return 'pull';
 if (/(squat|fente|lunge|pistol|jump squat|leg press)/.test(n)) return 'squat';
 if (/(dip|dips|parallettes|anneaux)/.test(n)) return 'dip';
 if (/(gainage|plank|abdo|crunch|leg raise|hollow|core|l-sit)/.test(n)) return 'core';
 return 'generic';
}

const EXERCISE_TYPE_META: Record<ExerciseAnimationType, { emoji: string; label: string; color: string; bg: string; border: string; muscles: string }> = {
 push: { emoji: '💪', label: 'Push', color: 'text-orange-600', bg: 'from-orange-50 to-amber-50', border: 'border-orange-200', muscles: 'Pectoraux · Triceps · Épaules' },
 pull: { emoji: '🏋️', label: 'Pull', color: 'text-blue-600', bg: 'from-blue-50 to-indigo-50', border: 'border-blue-200', muscles: 'Dos · Biceps · Rhomboïdes' },
 squat: { emoji: '🦵', label: 'Jambes', color: 'text-emerald-600', bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-200', muscles: 'Quadriceps · Ischio · Fessiers' },
 dip: { emoji: '🤸', label: 'Dip', color: 'text-purple-600', bg: 'from-purple-50 to-fuchsia-50', border: 'border-purple-200', muscles: 'Triceps · Pectoraux · Épaules' },
 core: { emoji: '⚡', label: 'Core', color: 'text-rose-600', bg: 'from-rose-50 to-pink-50', border: 'border-rose-200', muscles: 'Abdominaux · Gainage · Lombaires' },
 generic: { emoji: '🏃', label: 'Exercice', color: 'text-gray-600', bg: 'from-gray-50 to-slate-50', border: 'border-gray-200', muscles: 'Musculation · Cardio' },
};

function FallbackExerciseAnimation({ type, label }: { type: ExerciseAnimationType; label: string }) {
 const meta = EXERCISE_TYPE_META[type];
 return (
 <div className={`w-full mb-3 rounded-2xl border ${meta.border} bg-gradient-to-br ${meta.bg} overflow-hidden`} style={{ height: 172 }}>
 <style>{`
 @keyframes exo-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.18);opacity:0.8} }
 @keyframes exo-ring1 { 0%{stroke-dashoffset:283} 60%{stroke-dashoffset:40} 100%{stroke-dashoffset:283} }
 @keyframes exo-ring2 { 0%{stroke-dashoffset:220} 70%{stroke-dashoffset:60} 100%{stroke-dashoffset:220} }
 @keyframes exo-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
 @keyframes exo-dot { 0%,100%{opacity:0.3} 50%{opacity:1} }
 @keyframes exo-bar { 0%,100%{width:30%} 50%{width:85%} }
 `}</style>
 <div className="flex h-full">
 {/* Left: animated visual */}
 <div className="flex-1 flex flex-col items-center justify-center relative">
 {/* Animated rings */}
 <div style={{ animation: 'exo-float 2.2s ease-in-out infinite', position: 'relative', width: 88, height: 88 }}>
 <svg width="88" height="88" viewBox="0 0 88 88">
 <circle cx="44" cy="44" r="38" fill="none" stroke="#e5e7eb" strokeWidth="5" />
 <circle cx="44" cy="44" r="38" fill="none" stroke="currentColor"
 strokeWidth="5" strokeLinecap="round"
 strokeDasharray="283"
 style={{ stroke: type === 'push' ? '#f97316' : type === 'pull' ? '#3b82f6' : type === 'squat' ? '#10b981' : type === 'dip' ? '#a855f7' : type === 'core' ? '#f43f5e' : '#6b7280',
 animation: 'exo-ring1 2.5s ease-in-out infinite', transform: 'rotate(-90deg)', transformOrigin: '44px 44px' }} />
 <circle cx="44" cy="44" r="28" fill="none" stroke="currentColor"
 strokeWidth="3" strokeLinecap="round" strokeDasharray="220" strokeDashoffset="100"
 style={{ stroke: type === 'push' ? '#fed7aa' : type === 'pull' ? '#bfdbfe' : type === 'squat' ? '#a7f3d0' : type === 'dip' ? '#e9d5ff' : type === 'core' ? '#fce7f3' : '#f3f4f6',
 animation: 'exo-ring2 3s ease-in-out infinite 0.4s', transform: 'rotate(-90deg)', transformOrigin: '44px 44px' }} />
 <text x="44" y="50" textAnchor="middle" fontSize="26" style={{ animation: 'exo-pulse 2.5s ease-in-out infinite' }}>{meta.emoji}</text>
 </svg>
 </div>
 {/* Activity dots */}
 <div className="flex gap-2 mt-2">
 {[0, 0.4, 0.8].map((d, i) => (
 <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: type === 'push' ? '#f97316' : type === 'pull' ? '#3b82f6' : type === 'squat' ? '#10b981' : type === 'dip' ? '#a855f7' : type === 'core' ? '#f43f5e' : '#6b7280', animation: `exo-dot 1.4s ease-in-out ${d}s infinite` }} />
 ))}
 </div>
 </div>
 {/* Right: info panel */}
 <div className="flex flex-col justify-center pr-4 pl-2 py-4 min-w-0" style={{ width: 165 }}>
 <span className={`text-[10px] font-bold uppercase tracking-widest ${meta.color} mb-1`}>{meta.label}</span>
 <p className="text-sm font-bold text-gray-900 leading-tight mb-2 line-clamp-2">{label}</p>
 <div className="space-y-1.5">
 <div>
 <p className="text-[9px] text-gray-400 uppercase mb-0.5">Muscles</p>
 <p className="text-[10px] text-gray-600 leading-tight">{meta.muscles}</p>
 </div>
 <div>
 <p className="text-[9px] text-gray-400 uppercase mb-1">Intensité</p>
 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
 <div style={{ height: '100%', borderRadius: 999, background: type === 'push' ? '#f97316' : type === 'pull' ? '#3b82f6' : type === 'squat' ? '#10b981' : type === 'dip' ? '#a855f7' : type === 'core' ? '#f43f5e' : '#6b7280', animation: 'exo-bar 2.5s ease-in-out infinite' }} />
 </div>
 </div>
 </div>
 <div className="mt-2 flex items-center gap-1">
 <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
 <span className="text-[9px] text-gray-400">Prêt à commencer</span>
 </div>
 </div>
 </div>
 </div>
 );
}

function SessionPlayer({ jour, onFinish, onClose }: {
 jour: ProgrammeJour;
 onFinish: (results: ExerciceResult[]) => void;
 onClose: () => void;
}) {
 const [exoIdx, setExoIdx] = useState(0);
 const [setIdx, setSetIdx] = useState(0);
 const [phase, setPhase] = useState<'exercise' | 'fail_input' | 'rest' | 'done'>('exercise');
 const [failReps, setFailReps] = useState('');
 const [exerciseMediaMap, setExerciseMediaMap] = useState<Record<string, { gifUrl?: string | null; animationFrames?: string[] | null; instructionFr?: string | null }>>({});
 const [mediaLoading, setMediaLoading] = useState(false);
 const loadedMediaRef = useRef<Set<string>>(new Set());
 const [results, setResults] = useState<ExerciceResult[]>(() =>
 jour.exercices.map((e) => ({ nom: e.nom, series: e.series, targetReps: e.reps, repos: e.repos, sets: [] }))
 );

 const exo = jour.exercices[exoIdx];
 const res = results[exoIdx];
 const totalSets = exo?.series ?? 1;

 const loadExerciseMedia = useCallback(async (exerciseName: string, showLoading = false) => {
 const key = exerciseName.trim().toLowerCase();
 if (!key || loadedMediaRef.current.has(key)) return;
 loadedMediaRef.current.add(key);
 if (showLoading) setMediaLoading(true);
 try {
 const token = localStorage.getItem('token');
 const media = await fetchExerciseMedia(exerciseName, token);
 if (media) {
 setExerciseMediaMap((prev) => ({
 ...prev,
 [key]: {
 gifUrl: media.gifUrl || null,
 animationFrames: media.animationFrames || null,
 instructionFr: media.instructionFr || null,
 },
 }));
 }
 } catch {
 // silencieux
 } finally {
 if (showLoading) setMediaLoading(false);
 }
 }, []);

 useEffect(() => {
 const exerciseName = exo?.nom?.trim();
 if (!exerciseName) return;
 const nextExercise = jour.exercices[exoIdx + 1]?.nom?.trim();
 void loadExerciseMedia(exerciseName, true);
 if (nextExercise) void loadExerciseMedia(nextExercise, false);
 }, [exo?.nom, exoIdx, jour.exercices, loadExerciseMedia]);

 // Parse repos "90s" / "2min" / "90 secondes" → seconds
 const parseRepos = (repos: string): number => {
 const m = repos.match(/(\d+)\s*(min|m)/i);
 if (m) return parseInt(m[1]) * 60;
 const s = repos.match(/(\d+)/);
 return s ? parseInt(s[1]) : 90;
 };

 const reposSec = exo ? parseRepos(exo.repos) : 90;
 const totExo = jour.exercices.length;

 const pushSet = (success: boolean, repsActuelles?: number) => {
 const newResults = results.map((r, i) => {
 if (i !== exoIdx) return r;
 return { ...r, sets: [...r.sets, { success, repsActuelles }] };
 });
 setResults(newResults);

 const newSetIdx = setIdx + 1;

 if (newSetIdx < totalSets) {
 // Encore des séries → repos puis prochaine série
 setSetIdx(newSetIdx);
 setPhase('rest');
 } else {
 // Toutes les séries de cet exercice terminées
 const newExoIdx = exoIdx + 1;
 if (newExoIdx < totExo) {
 setExoIdx(newExoIdx);
 setSetIdx(0);
 setPhase('rest');
 } else {
 setPhase('done');
 onFinish(newResults);
 }
 }
 };

 const onRestDone = useCallback(() => {
 setPhase('exercise');
 setFailReps('');
 }, []);

 if (!exo && phase !== 'done') return null;

 // ── Écran terminé ───────────────────────────────────────
 if (phase === 'done') {
 const totalSetsAll = results.reduce((a, r) => a + r.sets.length, 0);
 const totalSuccess = results.reduce((a, r) => a + r.sets.filter((s) => s.success).length, 0);
 const totalFail = totalSetsAll - totalSuccess;
 const scorePct = totalSetsAll > 0 ? Math.round((totalSuccess / totalSetsAll) * 100) : 0;

 return (
 <div className="fixed inset-0 bg-[var(--ios-bg)] z-50 flex flex-col overflow-y-auto">
 <div className="max-w-lg mx-auto w-full px-6 py-10 flex flex-col gap-6">
 <div className="text-center">
 <div className="text-5xl mb-3"></div>
 <h2 className="text-2xl font-bold text-gray-900">Séance terminée</h2>
 <p className="text-gray-500 mt-1">{jour.jour} — {jour.focus}</p>
 </div>

 {/* Score global */}
 <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
 <p className="text-6xl font-black text-emerald-400">{scorePct}%</p>
 <p className="text-gray-500 text-sm mt-1">de réussite</p>
 <div className="w-full bg-gray-100 rounded-full h-2 mt-4">
 <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${scorePct}%` }} />
 </div>
 </div>

 {/* Stats */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 {[
 { label: 'Séries réussies', value: totalSuccess, color: 'text-emerald-400' },
 { label: 'Séries ratées', value: totalFail, color: 'text-red-400' },
 { label: 'Total séries', value: totalSetsAll, color: 'text-gray-900' },
 ].map((s) => (
 <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
 <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
 <p className="text-xs text-gray-500 mt-1">{s.label}</p>
 </div>
 ))}
 </div>

 {/* Détail par exercice */}
 <div className="space-y-3">
 {results.map((r) => {
 const ok = r.sets.filter((s) => s.success).length;
 const fail = r.sets.filter((s) => !s.success);
 return (
 <div key={r.nom} className="bg-white border border-gray-200 rounded-xl p-4">
 <div className="flex items-center justify-between mb-2">
 <p className="text-sm font-semibold text-gray-900">{r.nom}</p>
 <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ok === r.series ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
 {ok}/{r.series} séries ✓
 </span>
 </div>
 {fail.length > 0 && (
 <div className="flex flex-wrap gap-1.5 mt-1">
 {fail.map((f, i) => (
 <span key={i} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded">
 Série {r.sets.indexOf(f) + 1} : {f.repsActuelles ?? 0} reps
 </span>
 ))}
 </div>
 )}
 </div>
 );
 })}
 </div>

 <button
 onClick={onClose}
 className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-xl transition text-lg"
 >
 Retour au programme
 </button>
 </div>
 </div>
 );
 }

 const totalSlots = jour.exercices.reduce((sum, e) => sum + Math.max(1, e.series), 0);
 const doneSlots = results.reduce((sum, r) => sum + r.sets.length, 0);
 const progressPct = totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 0;

 return (
 <div className="fixed inset-0 bg-[var(--ios-bg)] z-50 flex flex-col">
 {/* Header */}
 <div className="px-6 py-4 border-b border-gray-200 bg-white/90 backdrop-blur-md flex items-center justify-between">
 <div>
 <p className="text-xs text-gray-500 uppercase tracking-widest">{jour.jour} — {jour.focus}</p>
 <p className="text-sm font-semibold text-gray-900 mt-0.5">
 Exercice {exoIdx + 1}/{totExo} · Série {setIdx + 1}/{totalSets}
 </p>
 </div>
 <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition text-sm">Quitter</button>
 </div>

 {/* Barre de progression globale */}
 <div className="h-1 bg-gray-200">
 <div className="h-1 bg-emerald-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
 </div>

 <div className="flex-1 flex flex-col items-center justify-center px-6 gap-7">

 {/* Phase exercice */}
 {phase === 'exercise' && (
 <>
 <div className="text-center w-full max-w-md">
 {(() => {
 const mediaKey = exo.nom.trim().toLowerCase();
 const gifUrl = exerciseMediaMap[mediaKey]?.gifUrl || '';
 const animationFrames = exerciseMediaMap[mediaKey]?.animationFrames || [];
 const animationType = inferExerciseAnimationType(exo.nom);
 return (
 <>
 {mediaLoading && (
 <div className="w-full h-40 mb-3 rounded-2xl border border-gray-200 bg-gray-100 animate-pulse" />
 )}
 {!mediaLoading && (gifUrl || animationFrames.length > 0) && (
 <ExerciseMotionPreview
 title={`Animation ${exo.nom}`}
 gifUrl={gifUrl}
 frames={animationFrames}
 className="mb-3 overflow-hidden rounded-2xl border border-gray-200"
 imgClassName="w-full h-40 object-contain bg-slate-50"
 />
 )}
 {!mediaLoading && !gifUrl && animationFrames.length === 0 && (
 <FallbackExerciseAnimation type={animationType} label={exo.nom} />
 )}
 </>
 );
 })()}
 <p className="text-xs text-emerald-600 uppercase tracking-widest mb-2">Exercice actif</p>
 <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-3 leading-tight">{exo.nom}</h2>
 <div className="grid grid-cols-2 gap-2">
 <div className="rounded-2xl bg-white border border-gray-200 py-3">
 <p className="text-[11px] uppercase tracking-wider text-gray-400">Objectif</p>
 <p className="text-2xl font-black text-gray-900 mt-1">{exo.reps}</p>
 </div>
 <div className="rounded-2xl bg-white border border-gray-200 py-3">
 <p className="text-[11px] uppercase tracking-wider text-gray-400">Repos</p>
 <p className="text-xl font-bold text-gray-700 mt-1">{exo.repos}</p>
 </div>
 </div>
 {exo.conseil && (
 <p className="text-sm text-emerald-400 mt-3 max-w-xs mx-auto">{exo.conseil}</p>
 )}
 {exerciseMediaMap[exo.nom.trim().toLowerCase()]?.instructionFr && (
 <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto">{exerciseMediaMap[exo.nom.trim().toLowerCase()]?.instructionFr}</p>
 )}
 </div>

 {/* Dots séries */}
 <div className="flex gap-2 justify-center">
 {Array.from({ length: totalSets }).map((_, i) => (
 <div key={i} className={`w-3 h-3 rounded-full ${
 i < setIdx ? 'bg-emerald-500' : i === setIdx ? 'bg-gray-900' : 'bg-gray-300'
 }`} />
 ))}
 </div>

 <div className="flex flex-col gap-3 w-full max-w-sm">
 <button
 onClick={() => pushSet(true)}
 className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xl rounded-2xl transition shadow-[0_10px_30px_rgba(16,185,129,0.35)]"
 >
 Terminer la serie
 </button>
 <button
 onClick={() => setPhase('fail_input')}
 className="w-full py-3.5 border border-gray-300 text-gray-600 hover:border-gray-500 hover:text-gray-900 font-medium rounded-2xl transition"
 >
 Ajuster mes repetitions
 </button>
 </div>
 </>
 )}

 {/* Phase échec — saisie reps */}
 {phase === 'fail_input' && (
 <div className="w-full max-w-sm space-y-6 text-center">
 <div>
 <p className="text-4xl mb-3"></p>
 <h2 className="text-xl font-bold text-gray-900">{exo.nom}</h2>
 <p className="text-gray-400 mt-1 text-sm">Combien de reps as-tu réussi ?</p>
 <p className="text-xs text-gray-600 mt-0.5">Objectif : {exo.reps} reps</p>
 </div>
 <input
 type="number"
 min={0}
 value={failReps}
 onChange={(e) => setFailReps(e.target.value)}
 placeholder="0"
 className="w-full px-4 py-5 rounded-2xl bg-white border border-gray-300 text-gray-900 text-3xl font-bold text-center focus:outline-none focus:border-emerald-500"
 autoFocus
 />
 <button
 onClick={() => pushSet(false, parseInt(failReps) || 0)}
 className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-white font-bold text-lg rounded-2xl transition"
 >
 Valider et continuer
 </button>
 <button onClick={() => setPhase('exercise')} className="text-sm text-gray-500 hover:text-gray-700">
 ← Retour
 </button>
 </div>
 )}

 {/* Phase repos */}
 {phase === 'rest' && (
 <div className="text-center w-full max-w-sm space-y-5">
 <p className="text-gray-400 text-sm uppercase tracking-widest">Repos</p>
 <Timer seconds={reposSec} onComplete={onRestDone} />
 <p className="text-gray-500 text-sm">
 {exoIdx < totExo - 1 || setIdx < totalSets
 ? `Prochain : ${jour.exercices[setIdx < totalSets ? exoIdx : exoIdx + 1]?.nom ?? '—'}`
 : 'Dernier exercice !'}
 </p>
 <button
 onClick={onRestDone}
 className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl text-sm transition hover:bg-gray-700"
 >
 Continuer maintenant
 </button>
 </div>
 )}
 </div>
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
interface SavedWorkout {
 id: string;
 title: string;
 createdAt: string;
 programme: ProgrammeData;
 sharedBy?: string | null;
 sessions: { id: string; dayLabel: string; status: string; results?: ExerciceResult[] | null }[];
}

type SessionType = 'force' | 'cardio' | 'endurance';

const SESSION_META: Record<SessionType, { label: string; image: string; badgeClass: string }> = {
 force: { label: 'Force', image: '/images/type-force.svg', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
 cardio: { label: 'Cardio', image: '/images/type-cardio.svg', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
 endurance: { label: 'Endurance', image: '/images/type-endurance.svg', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function inferSessionType(text: string): SessionType {
 const t = text.toLowerCase();
 if (/(cardio|hiit|course|run|velo|interval)/.test(t)) return 'cardio';
 if (/(endurance|volume|circuit|long|resistance)/.test(t)) return 'endurance';
 return 'force';
}

// ── Tutoriels Street Workout ──────────────────────────────────────────────

const TUTOS = [
 {
 id: 'front-lever',
 title: 'Front Lever',
 level: 'Avancé',
 levelColor: 'bg-red-100 text-red-700',
 description: 'Mouvement de gainage isométrique à la barre horizontale où le corps est maintenu horizontal, bras tendus.',
 muscles: ['Dorsaux', 'Abdominaux', 'Biceps', 'Épaules'],
 etapes: [
 { titre: 'Prérequis', contenu: 'Maîtriser ≥ 12 tractions strictes. Bonne force de gainage (planche 2 min).' },
 { titre: 'Progressions', contenu: '1. Tucked front lever (genoux pliés) → 2. Advanced tucked → 3. Jambe tendue écart → 4. Half lever (1 jambe) → 5. Front lever complet.' },
 { titre: 'Technique', contenu: 'Saisir la barre en pronation. Contracter les dorsaux et scapulas. Maintenir les hanches alignées avec les épaules. Corps rigide, tête neutre.' },
 { titre: 'Durée & volume', contenu: 'Viser 3×5 sec en débutant. Progresser jusqu\'à 3×10 sec. Ajouter 1-2 secondes par semaine.' },
 { titre: 'Erreurs fréquentes', contenu: 'Hanches qui tombent, bras fléchis, épaules arrondies. Se concentrer sur le gainage global.' },
 ],
 },
 {
 id: 'muscle-up',
 title: 'Muscle Up',
 level: 'Intermédiaire',
 levelColor: 'bg-orange-100 text-orange-700',
 description: 'Mouvement combinant une traction explosive au-dessus de la barre suivi d\'un dip complet.',
 muscles: ['Dorsaux', 'Triceps', 'Pectoraux', 'Biceps', 'Épaules'],
 etapes: [
 { titre: 'Prérequis', contenu: 'Maîtriser ≥ 10 tractions strictes + ≥ 10 dips solides. Bonne force explosive.' },
 { titre: 'Progressions', contenu: '1. Traction haute (menton bien au-dessus) → 2. Negative muscle up (descente contrôlée) → 3. Kipping muscle up → 4. Strict muscle up.' },
 { titre: 'Technique', contenu: 'Position de saisie en pronation légèrement large. Phase pull : traction verticale explosive en ramenant les coudes vers la hanche. Phase transition : incliner le buste vers l\'avant. Phase push : pousser au-dessus de la barre.' },
 { titre: 'Durée & volume', contenu: 'Commencer par 3×1 rep. Progresser : 3×3, 3×5. Viser des séries propres avant d\'augmenter le volume.' },
 { titre: 'Erreurs fréquentes', contenu: 'Saisie trop large, pas assez d\'explosivité, transition bloquée au niveau de la poitrine.' },
 ],
 },
 {
 id: 'human-flag',
 title: 'Human Flag',
 level: 'Expert',
 levelColor: 'bg-purple-100 text-purple-700',
 description: 'Corps maintenu horizontalement à côté d\'un poteau vertical, bras tendus en opposition.',
 muscles: ['Obliques', 'Dorsaux', 'Épaules', 'Abdominaux', 'Triceps'],
 etapes: [
 { titre: 'Prérequis', contenu: 'Front lever maîtrisé. Très forte stabilité d\'épaule. Bonne force latérale globale.' },
 { titre: 'Progressions', contenu: '1. Tucked side lever (genoux repliés) → 2. Un genou tendu → 3. Jambes écartées → 4. Human flag strict.' },
 { titre: 'Technique', contenu: 'Main basse en pronation (pousse), main haute en supination (tire). Contracter les obliques, garder le corps rigide. Regard droit devant.' },
 { titre: 'Durée & volume', contenu: '3×3 sec au début. Progresser à 3×8-10 sec. Travailler les deux côtés.' },
 { titre: 'Erreurs fréquentes', contenu: 'Hanches qui tombent du mauvais côté, bras qui plient, épaules qui remontent.' },
 ],
 },
 {
 id: 'planche',
 title: 'Planche',
 level: 'Expert',
 levelColor: 'bg-purple-100 text-purple-700',
 description: 'Position isométrique où le corps est maintenu horizontal face au sol, bras tendus, sans appui sur les jambes.',
 muscles: ['Épaules', 'Pectoraux', 'Abdominaux', 'Dorsaux', 'Triceps'],
 etapes: [
 { titre: 'Prérequis', contenu: 'Maîtriser les pompes pseudo-planche (20 reps). Bonne mobilité des poignets. Épaules très stables.' },
 { titre: 'Progressions', contenu: '1. Lean planche (inclinaison avant) → 2. Tuck planche (genoux repliés) → 3. Advanced tuck (genoux moins repliés) → 4. Straddle planche (jambes écartées) → 5. Full planche.' },
 { titre: 'Technique', contenu: 'Mains au sol, doigts orientés vers l\'extérieur. Pousser fort dans le sol, protracter les scapulas. Corps parallèle au sol, hanches à la hauteur des épaules.' },
 { titre: 'Durée & volume', contenu: '5×3-5 sec en tuck. Progresser de 1 sec par semaine. Travailler 3-4 fois par semaine.' },
 { titre: 'Erreurs fréquentes', contenu: 'Hanches trop hautes ou trop basses, épaules insuffisamment protractées, poignets non conditionnés.' },
 ],
 },
 {
 id: 'back-lever',
 title: 'Back Lever',
 level: 'Intermédiaire',
 levelColor: 'bg-orange-100 text-orange-700',
 description: 'Position isométrique suspendue à la barre, corps horizontal face vers le sol, saisie en supination.',
 muscles: ['Dorsaux', 'Biceps', 'Épaules', 'Abdominaux', 'Pectoraux'],
 etapes: [
 { titre: 'Prérequis', contenu: 'Maîtriser le skin the cat. 10+ tractions strictes. Bonne mobilité d\'épaule en extension.' },
 { titre: 'Progressions', contenu: '1. German hang (position basse) → 2. Tuck back lever → 3. Advanced tuck → 4. Straddle → 5. Back lever complet.' },
 { titre: 'Technique', contenu: 'Saisir la barre en supination. Passer en position inversée puis descendre lentement. Contracter les dorsaux, rentrer le menton. Corps rigide et aligné.' },
 { titre: 'Durée & volume', contenu: '3×5 sec en tuck. Progresser à 3×10 sec. Ajouter 2 sec par semaine.' },
 { titre: 'Erreurs fréquentes', contenu: 'Épaules trop tendues, manque de contrôle à la descente, dos cambré.' },
 ],
 },
 {
 id: 'handstand',
 title: 'Handstand',
 level: 'Intermédiaire',
 levelColor: 'bg-orange-100 text-orange-700',
 description: 'Équilibre sur les mains, corps vertical et aligné. Base fondamentale du calisthenics avancé.',
 muscles: ['Épaules', 'Triceps', 'Abdominaux', 'Trapèzes', 'Poignets'],
 etapes: [
 { titre: 'Prérequis', contenu: 'Tenir le handstand mur 45+ sec. Bonne mobilité d\'épaule (180°). Poignets conditionnés.' },
 { titre: 'Progressions', contenu: '1. Handstand mur ventre face au mur → 2. Décollements 1-2 sec → 3. Kick-up libre 5 sec → 4. Tenu libre 15-30 sec → 5. Handstand walk / presses.' },
 { titre: 'Technique', contenu: 'Mains largeur d\'épaules, doigts écartés. Corps droit (épaules ouvertes, côtes rentrées, fessiers serrés). Regard entre les mains. Corrections par les doigts.' },
 { titre: 'Durée & volume', contenu: 'Pratiquer 15-20 min par jour. Viser de nombreux essais courts. Progresser en durée et en contrôle.' },
 { titre: 'Erreurs fréquentes', contenu: 'Dos cambré (banana handstand), épaules fermées, regard trop en avant, corrections tardives.' },
 ],
 },
 {
 id: 'handstand-push-up',
 title: 'Handstand Push-Up',
 level: 'Avancé',
 levelColor: 'bg-red-100 text-red-700',
 description: 'Pompe en position inversée (handstand). Développé militaire au poids du corps ultime.',
 muscles: ['Épaules', 'Triceps', 'Trapèzes', 'Abdominaux'],
 etapes: [
 { titre: 'Prérequis', contenu: 'Handstand mur stable 30+ sec. Pike push-ups surélevés 10+ reps. Bonne force de poussée verticale.' },
 { titre: 'Progressions', contenu: '1. Pike push-ups au sol → 2. Pike push-ups pieds surélevés → 3. HSPU assisté au mur (amplitude partielle) → 4. HSPU strict au mur (amplitude complète) → 5. HSPU libre.' },
 { titre: 'Technique', contenu: 'Face au mur, mains légèrement plus larges que les épaules. Descendre en contrôle, tête au sol. Pousser de manière explosive. Gainage serré tout le long.' },
 { titre: 'Durée & volume', contenu: 'Commencer par 5×3 en amplitude partielle mur. Progresser vers amplitude complète. Viser 5×5 strict au mur avant de passer au libre.' },
 { titre: 'Erreurs fréquentes', contenu: 'Amplitude insuffisante, dos cambré, coudes qui partent vers l\'extérieur, manque de gainage.' },
 ],
 },
 {
 id: 'l-sit',
 title: 'L-Sit',
 level: 'Intermédiaire',
 levelColor: 'bg-orange-100 text-orange-700',
 description: 'Position isométrique où le corps forme un L, bras tendus, jambes parallèles au sol.',
 muscles: ['Abdominaux', 'Fléchisseurs de hanche', 'Triceps', 'Épaules', 'Quadriceps'],
 etapes: [
 { titre: 'Prérequis', contenu: 'Planche au sol 60 sec. Leg raises suspendus 10+ reps. Bonne compression de hanche.' },
 { titre: 'Progressions', contenu: '1. L-sit un genou replié → 2. L-sit au sol genoux pliés → 3. L-sit au sol jambes tendues → 4. L-sit aux barres parallèles → 5. L-sit suspendu à la barre.' },
 { titre: 'Technique', contenu: 'Bras verrouillés, épaules basses et protractées. Jambes tendues, orteils pointés. Contracter les abdos et les fléchisseurs de hanche en permanence.' },
 { titre: 'Durée & volume', contenu: '5×5 sec au début. Progresser à 3×15-20 sec. Pratiquer 3-4 fois par semaine.' },
 { titre: 'Erreurs fréquentes', contenu: 'Épaules qui remontent vers les oreilles, jambes qui tombent, dos arrondi.' },
 ],
 },
 {
 id: 'v-sit',
 title: 'V-Sit',
 level: 'Expert',
 levelColor: 'bg-purple-100 text-purple-700',
 description: 'Version avancée du L-sit où les jambes sont levées au-dessus de la ligne des épaules, formant un V.',
 muscles: ['Abdominaux', 'Fléchisseurs de hanche', 'Épaules', 'Triceps'],
 etapes: [
 { titre: 'Prérequis', contenu: 'L-sit tenu 15+ sec. Excellente compression de hanche. Souplesse ischio-jambiers avancée.' },
 { titre: 'Progressions', contenu: '1. L-sit maîtrisé → 2. Compression hold (genoux vers poitrine) → 3. V-sit partiel (jambes à 45°) → 4. V-sit pieds au niveau de la tête → 5. Manna (stade ultime).' },
 { titre: 'Technique', contenu: 'Depuis le L-sit, lever les jambes en contractant les abdos et les fléchisseurs. Presser fort dans le sol, protracter au maximum les épaules. Garder les jambes tendues.' },
 { titre: 'Durée & volume', contenu: 'Commencer par 5×2-3 sec. Chaque semaine, viser +1 sec. Travailler la compression au quotidien.' },
 { titre: 'Erreurs fréquentes', contenu: 'Jambes pliées, épaules qui montent, manque de compression, perte de gainage.' },
 ],
 },
 {
 id: 'dragon-flag',
 title: 'Dragon Flag',
 level: 'Avancé',
 levelColor: 'bg-red-100 text-red-700',
 description: 'Mouvement d\'abdominaux avancé popularisé par Bruce Lee. Corps rigide pivoté sur les épaules.',
 muscles: ['Abdominaux', 'Obliques', 'Dorsaux', 'Fléchisseurs de hanche'],
 etapes: [
 { titre: 'Prérequis', contenu: 'Leg raises suspendus 15+ reps. Planche au sol 90+ sec. Bonne force de gainage global.' },
 { titre: 'Progressions', contenu: '1. Tuck dragon flag (genoux repliés) → 2. Un genou tendu → 3. Straddle dragon flag → 4. Dragon flag négatif (descente lente) → 5. Dragon flag complet (montée + descente).' },
 { titre: 'Technique', contenu: 'Allongé sur un banc, saisir l\'arrière au-dessus de la tête. Monter le corps en pivot sur les épaules (pas sur la nuque). Descendre en contrôle, corps rigide comme une planche.' },
 { titre: 'Durée & volume', contenu: '3-4 x 3-5 reps en négatif. Progresser vers la version complète. 2-3 séances par semaine.' },
 { titre: 'Erreurs fréquentes', contenu: 'Pivoter sur la nuque au lieu des épaules, hanches qui plient, descente trop rapide.' },
 ],
 },
 {
 id: 'pistol-squat',
 title: 'Pistol Squat',
 level: 'Intermédiaire',
 levelColor: 'bg-orange-100 text-orange-700',
 description: 'Squat unipodal complet, jambe libre tendue devant. Test ultime de force et mobilité des jambes.',
 muscles: ['Quadriceps', 'Fessiers', 'Ischio-jambiers', 'Mollets', 'Abdominaux'],
 etapes: [
 { titre: 'Prérequis', contenu: 'Squat complet (full range) 20+ reps. Bonne mobilité de cheville. Équilibre unipodal stable.' },
 { titre: 'Progressions', contenu: '1. Squat bulgare profond → 2. Pistol squat assisté (avec support) → 3. Pistol négatif (descente lente) → 4. Pistol partiel (sur box) → 5. Pistol squat complet.' },
 { titre: 'Technique', contenu: 'Debout sur un pied, l\'autre jambe tendue devant. Descendre en contrôle en gardant le talon au sol. Dos droit, genou dans l\'axe du pied. Remonter en poussant fort dans le sol.' },
 { titre: 'Durée & volume', contenu: '3×3-5 reps par jambe. Alterner les jambes. Progresser vers 3×8 reps. 2-3 sessions par semaine.' },
 { titre: 'Erreurs fréquentes', contenu: 'Talon qui décolle, genou en valgus, perte d\'équilibre, manque de profondeur.' },
 ],
 },
 {
 id: 'pull-ups-avances',
 title: 'Tractions avancées',
 level: 'Intermédiaire',
 levelColor: 'bg-orange-100 text-orange-700',
 description: 'Toutes les variantes de tractions au-delà de la traction classique : archer, typewriter, one arm.',
 muscles: ['Dorsaux', 'Biceps', 'Avant-bras', 'Épaules', 'Abdominaux'],
 etapes: [
 { titre: 'Prérequis', contenu: '15+ tractions strictes. Bonne force de grip. Stabilité scapulaire solide.' },
 { titre: 'Progressions', contenu: '1. Traction large (wide grip) → 2. Traction commando (alternée) → 3. Archer pull-up → 4. Typewriter pull-up → 5. One-arm chin-up (assisté puis strict).' },
 { titre: 'Technique', contenu: 'Archer : un bras tire, l\'autre guide le long de la barre. Typewriter : au sommet, déplacer latéralement. One-arm : saisie à un bras, l\'autre main sur le poignet puis sans aide.' },
 { titre: 'Durée & volume', contenu: 'Archer : 3×5 par côté. Typewriter : 3×3. One-arm négatif : 5×1 par bras.' },
 { titre: 'Erreurs fréquentes', contenu: 'Balancement excessif, amplitude incomplète, bras guide qui travaille trop.' },
 ],
 },
 {
 id: 'explosive-pull-ups',
 title: 'Tractions explosives',
 level: 'Avancé',
 levelColor: 'bg-red-100 text-red-700',
 description: 'Tractions avec phase de vol : clap, lâcher de barre, 360. Développe la puissance maximale.',
 muscles: ['Dorsaux', 'Biceps', 'Épaules', 'Avant-bras', 'Abdominaux'],
 etapes: [
 { titre: 'Prérequis', contenu: '15+ tractions strictes rapides. Tractions poitrine à la barre. Bonne coordination et explosivité.' },
 { titre: 'Progressions', contenu: '1. Traction explosive (poitrine à la barre) → 2. Traction clap → 3. Traction lâcher complet → 4. Traction 180° → 5. Traction 360°.' },
 { titre: 'Technique', contenu: 'Phase de tirage maximale et explosive. Lâcher la barre au sommet. Effectuer le geste aérien. Rattraper la barre avec contrôle. Toujours commencer avec un tapis de sécurité en dessous.' },
 { titre: 'Durée & volume', contenu: 'Commencer par 5×1 rep. Chaque variante doit être maîtrisée avant de passer à la suivante. 2-3 séances par semaine.' },
 { titre: 'Erreurs fréquentes', contenu: 'Manque de hauteur, mauvais timing de lâcher, rattrapage mal contrôlé, entraînement sans sécurité.' },
 ],
 },
 {
 id: 'archer-push-ups',
 title: 'Pompes avancées',
 level: 'Intermédiaire',
 levelColor: 'bg-orange-100 text-orange-700',
 description: 'Du pseudo-planche push-up aux pompes une main. Variantes de poussée pour progresser vers la planche.',
 muscles: ['Pectoraux', 'Triceps', 'Épaules', 'Abdominaux'],
 etapes: [
 { titre: 'Prérequis', contenu: '30+ pompes strictes. Bonne force de poussée. Poignets conditionnés.' },
 { titre: 'Progressions', contenu: '1. Pompes diamant → 2. Archer push-up → 3. Pompes pseudo-planche (mains reculeés) → 4. Pompe une main assistée → 5. Pompe une main stricte.' },
 { titre: 'Technique', contenu: 'Archer : un bras pousse, l\'autre est tendu sur le côté. Pseudo-planche : mains au niveau des hanches, incliner vers l\'avant. One-arm : pieds écartés pour l\'équilibre, corps rigide.' },
 { titre: 'Durée & volume', contenu: 'Archer : 3×8 par côté. Pseudo-planche : 3×8. One-arm : 3×3 par bras. Progresser +1 rep par semaine.' },
 { titre: 'Erreurs fréquentes', contenu: 'Hanches qui tournent sur les one-arm, amplitude insuffisante, coudes trop écartés.' },
 ],
 },
 {
 id: 'dips-avances',
 title: 'Dips avancés',
 level: 'Intermédiaire',
 levelColor: 'bg-orange-100 text-orange-700',
 description: 'Progressions de dips : lestés, aux anneaux, impossible dips, korean dips.',
 muscles: ['Triceps', 'Pectoraux', 'Épaules', 'Abdominaux'],
 etapes: [
 { titre: 'Prérequis', contenu: '20+ dips strictes aux barres parallèles. Bonne stabilité des épaules.' },
 { titre: 'Progressions', contenu: '1. Dips lestés → 2. Dips anneaux (instabilité) → 3. Korean dips (barre derrière) → 4. Impossible dips (barre devant, montée) → 5. Dips en L-sit.' },
 { titre: 'Technique', contenu: 'Lestés : ceinture ou gilet, même technique que les dips classiques. Korean dips : barre derrière le dos, descente profonde. Anneaux : stabiliser avant de descendre.' },
 { titre: 'Durée & volume', contenu: 'Lestés : 4×6-8 reps. Anneaux : 3×8. Korean : 3×5. Progresser en charge ou en reps par semaine.' },
 { titre: 'Erreurs fréquentes', contenu: 'Trop de charge trop vite sur les lestés, instabilité aux anneaux, amplitude partielle.' },
 ],
 },
 {
 id: 'core-avance',
 title: 'Core avancé',
 level: 'Intermédiaire',
 levelColor: 'bg-orange-100 text-orange-700',
 description: 'Gainage et abdominaux avancés : windshield wipers, toes to bar, front lever raises.',
 muscles: ['Abdominaux', 'Obliques', 'Fléchisseurs de hanche', 'Dorsaux'],
 etapes: [
 { titre: 'Prérequis', contenu: 'Leg raises suspendus 12+ reps. Planche 90+ sec. L-sit 10+ sec.' },
 { titre: 'Progressions', contenu: '1. Toes to bar → 2. Windshield wipers (genoux) → 3. Windshield wipers (jambes tendues) → 4. Front lever raises → 5. Combo : L-sit to V-sit.' },
 { titre: 'Technique', contenu: 'Toes to bar : jambes tendues, monter les pieds jusqu\'à la barre. Windshield wipers : en position de suspension, pivoter les jambes d\'un côté à l\'autre. Contrôle maximal.' },
 { titre: 'Durée & volume', contenu: 'Toes to bar : 3×10. Windshield wipers : 3×5 par côté. Front lever raises : 3×5. 3 séances par semaine.' },
 { titre: 'Erreurs fréquentes', contenu: 'Momentum au lieu du contrôle, balancement, amplitude réduite.' },
 ],
 },
];

function TutoTab() {
 const [modal, setModal] = useState<{ id: string; step: number } | null>(null);
 const tuto = modal ? TUTOS.find((t) => t.id === modal.id) ?? null : null;

 return (
 <div className="space-y-5">
 <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
 <h2 className="text-lg font-bold text-gray-900 mb-1">Skills Street Workout</h2>
 <p className="text-sm text-gray-500">Maitrisez les mouvements emblematiques du calisthenics, etape par etape.</p>
 </div>

 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 {TUTOS.map((t) => (
 <div key={t.id} className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
 <div className="flex-1 p-5 space-y-3">
 <div className="flex items-center justify-between gap-2">
 <h3 className="text-base font-black text-gray-900">{t.title}</h3>
 <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${t.levelColor}`}>{t.level}</span>
 </div>
 <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{t.description}</p>
 <div className="flex flex-wrap gap-1.5">
 {t.muscles.slice(0, 3).map((m) => (
 <span key={m} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-100">{m}</span>
 ))}
 {t.muscles.length > 3 && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-semibold border border-gray-200">+{t.muscles.length - 3}</span>}
 </div>
 </div>
 <div className="px-5 pb-5">
 <button
 onClick={() => setModal({ id: t.id, step: 0 })}
 className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-700 transition"
 >
 Démarrer
 </button>
 </div>
 </div>
 ))}
 </div>

 <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
 <p className="text-sm font-semibold text-gray-600">D&apos;autres skills arrivent regulierement</p>
 <p className="text-xs text-gray-400 mt-1">Victorian, Maltese, Iron cross...</p>
 </div>

 {/* Modal tutoriel */}
 {modal && tuto && (
 <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setModal(null)}>
 <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
 <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
 <div>
 <h3 className="text-lg font-black text-gray-900">{tuto.title}</h3>
 <div className="flex items-center gap-2 mt-0.5">
 <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tuto.levelColor}`}>{tuto.level}</span>
 <span className="text-xs text-gray-400">Étape {modal.step + 1}/{tuto.etapes.length}</span>
 </div>
 </div>
 <button onClick={() => setModal(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
 </button>
 </div>
 <div className="px-6 py-5 space-y-4 min-h-[200px]">
 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{modal.step + 1}. {tuto.etapes[modal.step].titre}</p>
 <p className="text-sm text-gray-700 leading-relaxed">{tuto.etapes[modal.step].contenu}</p>
 </div>
 <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100">
 <button
 onClick={() => setModal((m) => m ? { ...m, step: m.step - 1 } : m)}
 disabled={modal.step === 0}
 className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
 >
 Précédent
 </button>
 {modal.step < tuto.etapes.length - 1 ? (
 <button
 onClick={() => setModal((m) => m ? { ...m, step: m.step + 1 } : m)}
 className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-700 transition"
 >
 Suivant
 </button>
 ) : (
 <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition">
 Terminer
 </button>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

export default function EntrainementPage() {
 // Config state
 const [userLevel, setUserLevel] = useState<UserLevel | ''>('');
 const [userXp, setUserXp] = useState(0);
 const [showEquip, setShowEquip] = useState(false);
 const [objectifs, setObjectifs] = useState<Objectif[]>([]);
 const [tempsSeance, setTempsSeance] = useState<TempsSeance>('');
 const [dureeProgramme, setDureeProgramme] = useState<DureeProgramme>('');
 const [figuresSelectees, setFiguresSelectees] = useState<Figure[]>([]);
 const [niveauxFigures, setNiveauxFigures] = useState<Record<string, string>>({});
 const [musclesCibles, setMusclesCibles] = useState<Muscle[]>([]);
 const [frequence, setFrequence] = useState(3);
 const [joursSelectes, setJoursSelectes] = useState<string[]>([]);
 const [lieu, setLieu] = useState<Lieu>('');
 const [equipements, setEquipements] = useState<Equipement[]>([]);
 const [equipConfig, setEquipConfig] = useState<Record<string, EquipementConfig>>({
 'Ceinture lestee': { maxKg: 10, progression: '+1 kg' },
 'Gilet leste': { maxKg: 10, progression: '+1 kg' },
 'Elastiques': { maxKg: 0, progression: '', detail: '' },
 'Halteres': { maxKg: 20, progression: '+2 kg' },
 'Barre de traction': { maxKg: 0, progression: '' },
 'Parallettes': { maxKg: 0, progression: '' },
 'Anneaux': { maxKg: 0, progression: '' },
 'Autre': { maxKg: 0, progression: '', detail: '' },
 });

 // Generation state
 const [programme, setProgramme] = useState<string | null>(null);
 const [programmeData, setProgrammeData] = useState<ProgrammeData | null>(null);
 const [generating, setGenerating] = useState(false);
 const [genProgress, setGenProgress] = useState(0);
 const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
 const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
 const [editMode, setEditMode] = useState(false);
 const [editedProgramme, setEditedProgramme] = useState('');
 const [iaFeedback, setIaFeedback] = useState<string | null>(null);
 const [shareOpen, setShareOpen] = useState(false);
 const [shareTarget, setShareTarget] = useState<string | null>(null);
 const [shareSent, setShareSent] = useState(false);
 const [shareSending, setShareSending] = useState(false);
 const [shareError, setShareError] = useState<string | null>(null);
 const [shareWorkoutId, setShareWorkoutId] = useState<string | null>(null);
 const [creationMode, setCreationMode] = useState(false);
 const [entrainementTab, setEntrainementTab] = useState<'config' | 'seances' | 'tuto' | 'defis'>('seances');
 // ── Défis de la semaine ──
 const [challenges, setChallenges] = useState<{
 id: string; title: string; description: string;
 target: number; unit: string; badgeCode: string; badgeLabel: string;
 completed: boolean; _count: { completions: number };
 type?: 'system' | 'user' | 'public';
 creatorId?: string | null;
 creator?: { id: string; pseudo: string | null; name: string | null } | null;
 submittedForReview?: boolean;
 challengeType?: string;
 difficulty?: number;
 circuitData?: { exercises: { nom: string; reps: number }[]; repos: number; tours: number } | null;
 }[]>([]);
 const [challengeLoading, setChallengeLoading] = useState(false);
 const [challengeNotif, setChallengeNotif] = useState<Record<string, string>>({});
 // Create challenge form
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
 const [customProgramme, setCustomProgramme] = useState('');
 // Block-based manual creation
 const [manualBlocks, setManualBlocks] = useState<{ jour: string; focus: string; exercices: { nom: string; series: number; reps: string; repos: string }[] }[]>([
 { jour: 'Jour 1', focus: '', exercices: [{ nom: '', series: 3, reps: '10', repos: '90s' }] }
 ]);
 const [amis, setAmis] = useState<Ami[]>([]);
 const [shareSearch, setShareSearch] = useState('');

 // Saved workouts state
 const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
 const [activeWorkout, setActiveWorkout] = useState<SavedWorkout | null>(null);
 const [renamingId, setRenamingId] = useState<string | null>(null);
 const [renameValue, setRenameValue] = useState('');
 const [testSkipped, setTestSkipped] = useState(false);
 const [testCompleted, setTestCompleted] = useState(false);

 // Elite-specific options
 const [pointsDouleur, setPointsDouleur] = useState<string[]>([]);
 const [musclesRetard, setMusclesRetard] = useState<string[]>([]);
 const [lieuParJour, setLieuParJour] = useState<Record<string, Lieu>>({});

 // Session en cours (mode exécution)
 const [activeSession, setActiveSession] = useState<{ jour: ProgrammeJour; workoutId: string } | null>(null)

 // Toggles
 const toggleJour = (j: string) => setJoursSelectes((p) => p.includes(j) ? p.filter((x) => x !== j) : [...p, j]);
 const toggleEquip = (e: Equipement) => {
 setEquipements((p) => {
 const nv = p.includes(e) ? p.filter((x) => x !== e) : [...p, e];
 saveEquipment(nv, equipConfig);
 return nv;
 });
 };
 const updateEquipKg = (eq: Equipement, val: number) =>
 setEquipConfig((p) => { const nv = { ...p, [eq]: { ...p[eq], maxKg: val } }; saveEquipment(equipements, nv); return nv; });
 const updateEquipProg = (eq: Equipement, val: string) =>
 setEquipConfig((p) => { const nv = { ...p, [eq]: { ...p[eq], progression: val } }; saveEquipment(equipements, nv); return nv; });
 const toggleObjectif = (o: Objectif) =>
 setObjectifs((p) => p.includes(o) ? p.filter((x) => x !== o) : [...p, o]);

 const toggleFigure = (f: Figure) => {
 setFiguresSelectees((p) => {
 if (p.includes(f)) {
 const updated = p.filter((x) => x !== f);
 setNiveauxFigures((n) => { const copy = { ...n }; delete copy[f]; return copy; });
 return updated;
 }
 return [...p, f];
 });
 };

 const toggleMuscle = (m: Muscle) => setMusclesCibles((p) => p.includes(m) ? p.filter((x) => x !== m) : [...p, m]);

 // Charger les workouts sauvegardés au montage
 const loadSavedWorkouts = useCallback(async () => {
 const token = localStorage.getItem('token');
 if (!token) return;
 try {
 const res = await fetch('/api/workouts/list', { headers: { Authorization: `Bearer ${token}` } });
 if (!res.ok) return;
 const data = await res.json();
 setSavedWorkouts(data.workouts ?? []);
 } catch { /* silencieux */ }
 }, []);

 const renameWorkout = async (workoutId: string, newTitle: string) => {
 const token = localStorage.getItem('token');
 if (!token || !newTitle.trim()) return;
 try {
 const res = await fetch('/api/workouts', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ workoutId, title: newTitle.trim() }),
 });
 if (res.ok) {
 setSavedWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, title: newTitle.trim() } : w));
 }
 } catch { /* silencieux */ }
 setRenamingId(null);
 };

 // Charger les amis réels
 const loadAmis = useCallback(async () => {
 const token = localStorage.getItem('token');
 if (!token) return;
 try {
 const res = await fetch('/api/friends/list', { headers: { Authorization: `Bearer ${token}` } });
 if (!res.ok) return;
 const data = await res.json();
 setAmis(data.amis ?? []);
 } catch { /* silencieux */ }
 }, []);

 // Charger le niveau utilisateur
 const loadUserLevel = useCallback(async () => {
 const token = localStorage.getItem('token');
 if (!token) return;
 try {
 const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
 if (!res.ok) return;
 const data = await res.json();
 if (data.user?.level) setUserLevel(data.user.level as UserLevel);
 if (data.user?.xp != null) setUserXp(data.user.xp);
 if (data.user?.levelTestData) {
 const testData = data.user.levelTestData as Record<string, unknown>;
 if (testData.evaluation || testData.testType) {
 setTestCompleted(true);
 setTestSkipped(true);
 }
 }
 } catch { /* silencieux */ }
 }, []);

 // Charger l'équipement depuis la DB
 const loadEquipment = useCallback(async () => {
 const token = localStorage.getItem('token');
 if (!token) return;
 try {
 const res = await fetch('/api/user/equipment', { headers: { Authorization: `Bearer ${token}` } });
 if (!res.ok) return;
 const data = await res.json();
 if (data.equipmentData) {
 if (data.equipmentData.equipements) setEquipements(data.equipmentData.equipements);
 if (data.equipmentData.equipConfig) setEquipConfig((prev) => ({ ...prev, ...data.equipmentData.equipConfig }));
 }
 } catch { /* silencieux */ }
 }, []);

 // Sauvegarder l'équipement dans la DB
 const saveEquipment = useCallback(async (eqs: string[], conf: Record<string, any>) => {
 const token = localStorage.getItem('token');
 if (!token) return;
 try {
 await fetch('/api/user/equipment', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ equipmentData: { equipements: eqs, equipConfig: conf } }),
 });
 } catch { /* silencieux */ }
 }, []);

 useEffect(() => { loadSavedWorkouts(); loadAmis(); loadUserLevel(); loadEquipment(); }, [loadSavedWorkouts, loadAmis, loadUserLevel, loadEquipment]);

 // ── Défis callbacks ──
 const loadChallenges = useCallback(async () => {
 if (challengeLoading) return;
 setChallengeLoading(true);
 try {
 const token = localStorage.getItem('token');
 const res = await fetch('/api/challenges', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
 if (!res.ok) return;
 const data = await res.json();
 // Map API response: derive `completed` from completions array
 const mapped = (data.challenges ?? []).map((c: Record<string, unknown>) => ({
 ...c,
 completed: Array.isArray(c.completions) && (c.completions as unknown[]).length > 0,
 }));
 setChallenges(mapped);
 } finally { setChallengeLoading(false); }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 const completeChallenge = useCallback(async (id: string) => {
 setChallengeActionLoading((prev) => { const s = new Set(prev); s.add(id); return s; });
 const token = localStorage.getItem('token');
 try {
 const res = await fetch('/api/challenges', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
 body: JSON.stringify({ action: 'complete', challengeId: id }),
 });
 const data = await res.json();
 if (res.ok) {
 const msg = data.badgeLabel ? ` Badge « ${data.badgeLabel} » obtenu !` : '✓ Défi relevé !';
 setChallengeNotif((prev) => ({ ...prev, [id]: msg }));
 await loadChallenges();
 loadUserLevel(); // reload XP
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
 const token = localStorage.getItem('token');
 const bodyData: Record<string, unknown> = {
 action: 'create', title: newChallTitle, description: newChallDesc,
 challengeType: newChallType, difficulty: newChallDifficulty, visibility: newChallVisibility,
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
 setNewChallTitle(''); setNewChallDesc(''); setNewChallExercise(''); setNewChallTarget(''); setNewChallUnit('reps');
 setNewChallType('simple'); setNewChallDifficulty(1); setNewChallVisibility('friends'); setCircuitExercises([{ nom: '', reps: 10 }]); setCircuitRepos(120); setCircuitTours(3);
 await loadChallenges();
 }
 } finally { setCreateChallengeLoading(false); }
 }, [newChallTitle, newChallDesc, newChallExercise, newChallTarget, newChallUnit, newChallType, newChallDifficulty, newChallVisibility, circuitExercises, circuitRepos, circuitTours, loadChallenges]);

 const submitChallenge = useCallback(async (challengeId: string) => {
 const token = localStorage.getItem('token');
 const res = await fetch('/api/challenges', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
 body: JSON.stringify({ action: 'submit', challengeId }),
 });
 if (res.ok) {
 setChallenges((prev) => prev.map((c) => c.id === challengeId ? { ...c, submittedForReview: true } : c));
 }
 }, []);

 useEffect(() => { if (entrainementTab === ('defis' as string)) loadChallenges(); }, [entrainementTab, loadChallenges]);

 const persistGeneratedWorkout = useCallback(async (programmeText: string, nextProgrammeData: ProgrammeData) => {
 const token = localStorage.getItem('token');
 if (!token) return null;
 setSaveStatus('saving');
 try {
 const res = await fetch('/api/workouts/save', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({
 title: `${objectifs.join(', ') || 'Programme'} — ${joursSelectes.join(', ') || new Date().toLocaleDateString('fr-FR')}`,
 rawText: programmeText,
 programme: nextProgrammeData,
 config: { objectifs, frequence, joursSelectes, lieu, tempsSeance, dureeProgramme },
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok || !data.workout?.id) {
 setSaveStatus('error');
 return null;
 }
 setSavedWorkoutId(data.workout.id);
 setSaveStatus('saved');
 await loadSavedWorkouts();
 setActiveWorkout(data.workout);
 return data.workout.id as string;
 } catch {
 setSaveStatus('error');
 return null;
 }
 }, [dureeProgramme, frequence, joursSelectes, lieu, loadSavedWorkouts, objectifs, tempsSeance]);

 // Generate avec barre de progression
 const handleGenerate = async () => {
 setGenerating(true);
 setGenProgress(0);
 setProgramme(null);
 setProgrammeData(null);
 setSavedWorkoutId(null);
 setSaveStatus('idle');
 setEditMode(false);
 setShareOpen(false);
 setShareSent(false);

 // Barre de progression animée pendant la génération
 const startTime = Date.now();
 const progressInterval = setInterval(() => {
 const elapsed = Date.now() - startTime;
 // Courbe asymptotique : monte vite jusqu'à 85%, puis ralentit
 const pct = Math.min(85, Math.round(85 * (1 - Math.exp(-elapsed / 8000))));
 setGenProgress(pct);
 }, 200);

 try {
 const res = await fetch('/api/generate-workout', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}) },
 body: JSON.stringify({ objectif: objectifs.join(', ') || 'general', frequence, joursSelectes, lieu, equipements, equipConfig, figuresSelectees, niveauxFigures, musclesCibles, tempsSeance, dureeProgramme, pointsDouleur, musclesRetard, lieuParJour: Object.keys(lieuParJour).length > 0 ? lieuParJour : undefined }),
 });
 clearInterval(progressInterval);
 setGenProgress(95);
 const data = await res.json();
 if (data.programmeData?.jours?.length) {
 const parsed = data.programmeData as ProgrammeData;
 const nextProgrammeText = JSON.stringify(parsed, null, 2);
 setProgrammeData(parsed);
 setProgramme(nextProgrammeText);
 await persistGeneratedWorkout(nextProgrammeText, parsed);
 setTimeout(() => setGenProgress(100), 200);
 } else {
 setProgramme('Erreur : ' + (data.error || 'Impossible de générer le programme.'));
 setGenProgress(0);
 }
 } catch {
 clearInterval(progressInterval);
 setGenProgress(0);
 setProgramme('Erreur de connexion. Vérifiez votre clé API dans .env.local.');
 } finally {
 setGenerating(false);
 }
 };

 // Sauvegarde en BDD
 const handleSave = async () => {
 if (!programme || !programmeData) return;
 await persistGeneratedWorkout(programme, programmeData);
 };

 // Démarrer une séance interactive
 const handleStartSession = (jour: ProgrammeJour, workoutId: string) => {
 setActiveSession({ jour, workoutId });
 };

 // Fin de séance interactive → sauvegarder les résultats
 const handleSessionFinish = async (results: ExerciceResult[], jour: ProgrammeJour, workoutId: string) => {
 const token = localStorage.getItem('token');
 await fetch('/api/workouts/session', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ workoutId, dayLabel: jour.jour, status: 'done', results }),
 });
 setActiveSession(null);
 await loadSavedWorkouts();
 loadUserLevel(); // reload XP
 };

 // Valider une séance sans l'exécuter interactivement
 const handleValidateSession = async (workoutId: string, dayLabel: string) => {
 const token = localStorage.getItem('token');
 await fetch('/api/workouts/session', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ workoutId, dayLabel, status: 'done', results: null }),
 });
 await loadSavedWorkouts();
 loadUserLevel(); // reload XP
 };

 const handleShare = (workoutId?: string) => {
 setShareOpen(true);
 setShareTarget(null);
 setShareSent(false);
 setShareSending(false);
 setShareError(null);
 setShareSearch('');
 setShareWorkoutId(workoutId ?? null);
 };

 const handleDeleteWorkout = async (workoutId: string) => {
 if (!confirm('Supprimer cette séance ? Cette action est irréversible.')) return;
 const token = localStorage.getItem('token');
 try {
 await fetch('/api/workouts', {
 method: 'DELETE',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ workoutId }),
 });
 if (activeWorkout?.id === workoutId) setActiveWorkout(null);
 await loadSavedWorkouts();
 } catch { /* silencieux */ }
 };

 const confirmShare = async () => {
 if (!shareTarget) return;
 const token = localStorage.getItem('token');
 if (!token) {
 setShareError('Connexion requise pour partager un programme.');
 return;
 }
 setShareSending(true);
 setShareError(null);
 try {
 let content: string;
 if (shareWorkoutId) {
 const w = savedWorkouts.find((sw) => sw.id === shareWorkoutId);
 if (w) {
 content = `__WORKOUT_SHARE__${JSON.stringify({ title: w.title, programme: w.programme })}`;
 } else {
 content = ` Programme partagé`;
 }
 } else if (programmeData) {
 const title = objectifs.length > 0 ? `Programme ${objectifs.join(' + ')}` : 'Programme partagé';
 content = `__WORKOUT_SHARE__${JSON.stringify({ title, programme: programmeData })}`;
 } else {
 content = ` Je partage mon programme d'entraînement avec toi !`;
 }
 const response = await fetch('/api/messages/send', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ receiverId: shareTarget, content }),
 });
 const data = await response.json().catch(() => ({}));
 if (!response.ok) {
 setShareError(typeof data?.error === 'string' ? data.error : 'Impossible de partager ce programme.');
 setShareSending(false);
 return;
 }
 } catch {
 setShareError('Erreur reseau pendant le partage.');
 setShareSending(false);
 return;
 }
 setShareSent(true);
 setShareSending(false);
 setTimeout(() => { setShareOpen(false); setShareSent(false); }, 2000);
 };
 const handleEdit = () => { setEditMode(true); setEditedProgramme(programme || ''); };
 const handleSaveEdit = () => { setProgramme(editedProgramme); setEditMode(false); };
 const handleCreationIA = () => { setCreationMode(true); setCustomProgramme(''); setIaFeedback(null); setManualBlocks([{ jour: 'Jour 1', focus: '', exercices: [{ nom: '', series: 3, reps: '10', repos: '90s' }] }]); };
 const handleAnalyseIA = async () => {
 if (!customProgramme.trim()) return;
 setIaFeedback('Analyse en cours...');
 try {
 const res = await fetch('/api/analyse-programme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ programme: customProgramme }) });
 const data = await res.json();
 setIaFeedback(data.feedback || data.error || 'Feedback indisponible.');
 } catch { setIaFeedback('Erreur de connexion.'); }
 };

 // Sauvegarder le niveau utilisateur
 const saveUserLevel = async (level: UserLevel) => {
 setUserLevel(level);
 const token = localStorage.getItem('token');
 if (!token) return;
 try {
 await fetch('/api/user/update', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ level }),
 });
 } catch { /* silencieux */ }
 };

 const filteredAmis = amis.filter((a) =>
 !shareSearch || a.pseudo?.toLowerCase().includes(shareSearch.toLowerCase()) || a.nom?.toLowerCase().includes(shareSearch.toLowerCase())
 );

 // ExerciseDB
 const [exoLibFilter, setExoLibFilter] = useState<Muscle | ''>('');
 const [exoLibResults, setExoLibResults] = useState<ExerciseDBItem[]>([]);
 const [exoLibLoading, setExoLibLoading] = useState(false);
 const [exoDetail, setExoDetail] = useState<ExerciseDBItem | null>(null);
 const [exerciseMediaMap, setExerciseMediaMap] = useState<Record<string, { nameFr?: string | null; gifUrl?: string | null; animationFrames?: string[] | null; instructionFr?: string | null }>>({});
 const loadedMediaRef = useRef<Set<string>>(new Set());

 const loadExerciseMedia = useCallback(async (exerciseName: string) => {
 const key = exerciseName.trim().toLowerCase();
 if (!key || loadedMediaRef.current.has(key)) return;
 loadedMediaRef.current.add(key);
 try {
 const token = localStorage.getItem('token');
 const media = await fetchExerciseMedia(exerciseName, token);
 if (media) {
 setExerciseMediaMap((prev) => ({
 ...prev,
 [key]: {
 nameFr: media.name || null,
 gifUrl: media.gifUrl || null,
 animationFrames: media.animationFrames || null,
 instructionFr: media.instructionFr || null,
 },
 }));
 }
 } catch {
 // silent
 }
 }, []);

 const fetchExercises = async (muscle: Muscle | '') => {
 setExoLibFilter(muscle);
 setExoLibLoading(true);
 setExoLibResults([]);
 setExoDetail(null);
 try {
 const params = new URLSearchParams();
 if (muscle) params.set('muscle', muscle);
 else params.set('lieu', lieu || 'Maison');
 params.set('limit', '12');
 const token = localStorage.getItem('token');
 const res = await fetch(`/api/wger-exercises?${params}`, {
 headers: token ? { Authorization: `Bearer ${token}` } : {},
 });
 const data = await res.json();
 setExoLibResults(data.exercises ?? []);
 (data.exercises ?? []).slice(0, 8).forEach((ex: ExerciseDBItem) => {
 void loadExerciseMedia(ex.name);
 });
 } catch { setExoLibResults([]); } finally { setExoLibLoading(false); }
 };

 useEffect(() => {
 const names = new Set<string>();
 for (const day of programmeData?.jours || []) {
 for (const ex of day.exercices || []) {
 if (ex.nom) names.add(ex.nom);
 }
 }
 Array.from(names).slice(0, 20).forEach((name) => {
 void loadExerciseMedia(name);
 });
 }, [programmeData, loadExerciseMedia]);

 // Stats basées sur les vraies sessions sauvegardées
 const allSessions = savedWorkouts.flatMap((w) => w.sessions);
 const doneSessions = allSessions.filter((s) => s.status === 'done');
 const sessionsRealisees = doneSessions.length;
 const respectPct = frequence > 0 ? Math.min(Math.round((sessionsRealisees / (frequence * 4)) * 100), 100) : 0;

 // Helper pour savoir si une journée du workout actif a déjà une session done
 const isDayDone = (workoutId: string, dayLabel: string) => {
 const w = savedWorkouts.find((x) => x.id === workoutId);
 return w?.sessions.some((s) => s.dayLabel === dayLabel && s.status === 'done') ?? false;
 };

 const nextSession = savedWorkouts
 .map((w) => ({
 workoutId: w.id,
 title: w.title,
 jour: (w.programme?.jours ?? []).find((j) => !isDayDone(w.id, j.jour)) || null,
 type: inferSessionType(`${w.title} ${(w.programme?.jours ?? []).map((j) => j.focus).join(' ')}`),
 }))
 .find((entry) => entry.jour !== null);

 return (
 <>
 {/* Interface SessionPlayer (overlay plein écran) */}
 {activeSession && (
 <SessionPlayer
 jour={activeSession.jour}
 onFinish={(results) => handleSessionFinish(results, activeSession.jour, activeSession.workoutId)}
 onClose={() => setActiveSession(null)}
 />
 )}

 <main className="flex-1 px-3 py-6 sm:px-6 md:px-8 sm:py-10 w-full max-w-3xl overflow-x-hidden">
 <div className="mb-4 sm:mb-5">
 <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Entrainement</h1>
 {/* XP display */}
 <div className="mt-3 flex items-center gap-3">
 <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
 <span className="text-sm"></span>
 <span className="text-sm font-bold text-amber-700">{userXp} XP</span>
 </div>
 <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[200px]">
 <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (userXp % 500) / 5)}%` }} />
 </div>
 <span className="text-xs text-gray-400">Palier {Math.floor(userXp / 500) + 1}</span>
 </div>
 </div>

 {/* Sub-tabs */}
 <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit mb-5 sm:mb-6 overflow-x-auto no-scrollbar snap-x snap-mandatory">
 {([
 { key: 'seances' as const, label: `Mes séances${savedWorkouts.length > 0 ? ` (${savedWorkouts.length})` : ''}` },
 { key: 'config' as const, label: 'Programmes sur mesure' },
 { key: 'tuto' as const, label: 'Skills' },
 ]).map((t) => (
 <button key={t.key} onClick={() => setEntrainementTab(t.key)}
 className={`snap-start flex-shrink-0 px-4 py-2 sm:px-5 rounded-lg text-xs sm:text-sm font-medium transition ${entrainementTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
 {t.label}
 </button>
 ))}
 </div>

 <div className="mb-5 sm:mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 flex items-center justify-between gap-3">
 <p className="text-xs sm:text-sm text-sky-800 font-medium">La rubrique Défis a été déplacée dans Social.</p>
 <button
 onClick={() => { if (typeof window !== 'undefined') window.location.assign('/dashboard/social'); }}
 className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition"
 >
 Ouvrir Social
 </button>
 </div>

 <div className="space-y-5">

 {/* ═══════ TAB: GÉNÉRATEUR / CONFIGURATION ═══════ */}
 {entrainementTab === 'config' && (<>

 {/* ── TEST DE NIVEAU (en haut) ── */}
 {!testSkipped && (
 <section className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200 p-6 sm:p-8 shadow-sm">
 <div className="flex items-center gap-3 mb-2">
 <span className="text-3xl"></span>
 <div>
 <h2 className="text-lg font-bold text-gray-900">Test de niveau</h2>
 <p className="text-sm text-gray-600">Évaluez vos capacités pour générer des séances parfaitement adaptées à votre niveau.</p>
 </div>
 </div>
 <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
 <span className="text-base"></span>
 <p className="text-sm text-amber-800 font-medium">Il est recommandé de passer ce test pour des séances personnalisées et optimales.</p>
 </div>
 <TestNiveau onComplete={() => { loadUserLevel(); setTestCompleted(true); setTestSkipped(true); }} />
 <div className="mt-4 text-center">
 <button
 onClick={() => setTestSkipped(true)}
 className="text-xs text-gray-400 hover:text-gray-600 underline transition"
 >
 Passer le test pour l&apos;instant →
 </button>
 </div>
 </section>
 )}
 {testSkipped && !testCompleted && (
 <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-base"></span>
 <p className="text-sm text-amber-800">Vous n&apos;avez pas passé le test de niveau. Vos séances seront moins personnalisées.</p>
 </div>
 <button
 onClick={() => setTestSkipped(false)}
 className="text-xs font-semibold text-emerald-700 hover:text-emerald-500 underline transition shrink-0 ml-3"
 >
 Passer le test
 </button>
 </div>
 )}
 {testCompleted && (
 <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-base">&#10003;</span>
 <p className="text-sm text-emerald-800">Test de niveau terminé. Vos séances sont adaptées à votre profil.</p>
 </div>
 <button
 onClick={() => { setTestSkipped(false); setTestCompleted(false); }}
 className="text-xs font-semibold text-emerald-700 hover:text-emerald-500 underline transition shrink-0 ml-3"
 >
 Refaire le test
 </button>
 </div>
 )}

 {/* ── 0. NIVEAU UTILISATEUR ── */}
 {!userLevel && (
 <Section title="Votre niveau" subtitle="Choisissez votre niveau pour adapter l'interface.">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 {([
 { key: 'debutant' as UserLevel, label: 'Débutant', desc: 'Interface simplifiée' },
 { key: 'intermediaire' as UserLevel, label: 'Intermédiaire', desc: 'Accès complet' },
 { key: 'elite' as UserLevel, label: 'Élite', desc: 'Toutes les options' },
 ]).map((l) => (
 <button
 key={l.key}
 onClick={() => saveUserLevel(l.key)}
 className="py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold transition hover:border-emerald-400 bg-white text-gray-600 text-center"
 >
 <span className="block text-base">{l.label}</span>
 <span className="block text-xs text-gray-400 mt-1 font-normal">{l.desc}</span>
 </button>
 ))}
 </div>
 </Section>
 )}

 {userLevel && (
 <div className="flex items-center gap-2 text-xs text-gray-400">
 <span>Niveau : <span className="font-semibold text-gray-700 capitalize">{userLevel}</span></span>
 <button onClick={() => setUserLevel('')} className="text-emerald-500 hover:underline">Changer</button>
 </div>
 )}

 {/* ── 1. OBJECTIF ── */}
 <Section title="Objectif">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {(['Force', 'Cardio', 'Endurance', 'Hypertrophie'] as Objectif[]).map((o) => (
 <button
 key={o}
 onClick={() => toggleObjectif(o)}
 className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${
 objectifs.includes(o)
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : 'border-gray-200 text-gray-600 hover:border-emerald-400 bg-white'
 }`}
 >
 {o}
 </button>
 ))}
 </div>
 {objectifs.length > 1 && (
 <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mt-3">
 <p className="text-sm font-medium text-amber-800">
 Il n&apos;est pas judicieux de sélectionner plus d&apos;un objectif
 </p>
 </div>
 )}
 </Section>

 {/* ── 1b. TEMPS DE SÉANCE ── */}
 <Section title="Temps de séance">
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {([
 { key: '30min' as TempsSeance, label: '30 min' },
 { key: '1h' as TempsSeance, label: '1 heure' },
 { key: '1h30' as TempsSeance, label: '1h30' },
 { key: '2h' as TempsSeance, label: '2 heures' },
 ]).map((t) => (
 <button
 key={t.key}
 onClick={() => setTempsSeance(t.key)}
 className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${
 tempsSeance === t.key
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : 'border-gray-200 text-gray-600 hover:border-emerald-400 bg-white'
 }`}
 >
 {t.label}
 </button>
 ))}
 </div>
 </Section>

 {/* ── 1c. DURÉE DU PROGRAMME ── */}
 <Section title="Durée du programme">
 <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
 {([
 { key: '1_semaine' as DureeProgramme, label: '1 semaine' },
 { key: '2_semaines' as DureeProgramme, label: '2 semaines' },
 { key: '1_mois' as DureeProgramme, label: '1 mois' },
 { key: '2_mois' as DureeProgramme, label: '2 mois' },
 { key: '3_mois' as DureeProgramme, label: '3 mois' },
 ]).map((d) => (
 <button
 key={d.key}
 onClick={() => setDureeProgramme(d.key)}
 className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${
 dureeProgramme === d.key
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : 'border-gray-200 text-gray-600 hover:border-emerald-400 bg-white'
 }`}
 >
 {d.label}
 </button>
 ))}
 </div>
 {dureeProgramme && dureeProgramme !== '1_semaine' && (
 <p className="text-xs text-emerald-600 mt-3">Le programme inclura une progression d&apos;intensité automatique semaine par semaine.</p>
 )}
 </Section>

 {/* ── 2. SKILLS (figures statiques) — masqué pour débutants ── */}
 {userLevel !== 'debutant' && (
 <Section title="Skills">
 {figuresSelectees.length > 2 && (
 <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
 <p className="text-sm font-medium text-amber-800">
 Attention : il n&apos;est pas recommande de travailler plus de deux figures en meme temps.
 </p>
 </div>
 )}
 <div className="grid grid-cols-2 gap-3">
 {FIGURES.map((f) => (
 <button
 key={f}
 onClick={() => toggleFigure(f)}
 className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition text-left ${
 figuresSelectees.includes(f)
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : 'border-gray-200 text-gray-600 hover:border-emerald-400 bg-white'
 }`}
 >
 {f}
 </button>
 ))}
 </div>

 {/* Niveaux pour chaque figure selectionnee */}
 {figuresSelectees.length > 0 && (
 <div className="mt-5 space-y-4">
 {figuresSelectees.map((fig) => (
 <div key={fig} className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
 <p className="text-sm font-medium text-emerald-800 mb-3">Quel est ton niveau sur {fig} ?</p>
 <div className="space-y-1.5">
 {NIVEAUX[fig].map((niv, idx) => (
 <button
 key={niv}
 onClick={() => setNiveauxFigures((p) => ({ ...p, [fig]: niv }))}
 className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm font-medium transition flex items-center gap-3 ${
 niveauxFigures[fig] === niv
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : 'border-gray-200 text-gray-600 bg-white hover:border-emerald-400'
 }`}
 >
 <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
 niveauxFigures[fig] === niv ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
 }`}>{idx + 1}</span>
 {niv}
 </button>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}
 </Section>
 )}

 {/* ── 3. MUSCLES CIBLES — masqué pour débutants ── */}
 {userLevel !== 'debutant' && (
 <Section title="Muscle a developper">
 <div className="flex gap-2 flex-wrap">
 {MUSCLES.map((m) => (
 <button
 key={m}
 onClick={() => toggleMuscle(m)}
 className={`px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition ${
 musclesCibles.includes(m)
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : 'border-gray-200 text-gray-600 hover:border-emerald-400 bg-white'
 }`}
 >
 {m}
 </button>
 ))}
 </div>
 </Section>
 )}

 {/* ── 4. FREQUENCE ── */}
 <Section title="Frequence">
 <div className="space-y-6">
 <div>
 <p className="text-sm font-medium text-gray-700 mb-3">Combien de fois par semaine ?</p>
 <div className="flex gap-2 flex-wrap">
 {[1, 2, 3, 4, 5, 6, 7].map((n) => (
 <button
 key={n}
 onClick={() => setFrequence(n)}
 className={`w-11 h-11 rounded-lg text-sm font-semibold border-2 transition ${
 frequence === n
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : 'border-gray-200 text-gray-600 hover:border-emerald-400 bg-white'
 }`}
 >
 {n}
 </button>
 ))}
 <span className="self-center text-sm text-gray-400 ml-1">j / semaine</span>
 </div>
 </div>
 <div>
 <p className="text-sm font-medium text-gray-700 mb-3">Quels jours ?</p>
 <div className="space-y-2">
 {JOURS.map((jour) => (
 <button
 key={jour}
 onClick={() => toggleJour(jour)}
 className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
 joursSelectes.includes(jour)
 ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
 : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400'
 }`}
 >
 {jour}
 </button>
 ))}
 </div>
 </div>
 </div>
 </Section>

 {/* ── 5. LIEU ── */}
 <Section title="Lieu">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 {(['Salle de sport', 'Maison', 'Street workout'] as const).map((l) => (
 <button
 key={l}
 onClick={() => setLieu(l)}
 className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${
 lieu === l
 ? 'border-gray-900 bg-gray-900 text-white'
 : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'
 }`}
 >
 {l}
 </button>
 ))}
 </div>
 </Section>

 {/* ── 6a. ÉLITE: Points de douleur ── */}
 {userLevel === 'elite' && (
 <Section title="Zones sensibles">
 <div className="flex gap-2 flex-wrap">
 {['Coude', 'Épaule', 'Poignet', 'Genou', 'Dos lombaire', 'Tendon biceps', 'Tendon rotulien', 'Cervicales'].map((p) => (
 <button key={p}
 onClick={() => setPointsDouleur((prev) => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
 className={`px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition ${
 pointsDouleur.includes(p) ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:border-red-300 bg-white'
 }`}>
 {p}
 </button>
 ))}
 </div>
 </Section>
 )}

 {/* ── 6b. ÉLITE: Muscles en retard ── */}
 {userLevel === 'elite' && (
 <Section title="Muscles en retard">
 <div className="flex gap-2 flex-wrap">
 {['Deltoïde antérieur', 'Deltoïde postérieur', 'Trapèze supérieur', 'Trapèze inférieur', 'Rhomboïdes', 'Grand dorsal', 'Biceps long', 'Triceps long', 'Avant-bras', 'Mollets', 'Ischio-jambiers', 'Fessiers', 'Obliques'].map((m) => (
 <button key={m}
 onClick={() => setMusclesRetard((prev) => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
 className={`px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition ${
 musclesRetard.includes(m) ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-amber-300 bg-white'
 }`}>
 {m}
 </button>
 ))}
 </div>
 </Section>
 )}

 {/* ── 6c. ÉLITE: Lieu par jour ── */}
 {userLevel === 'elite' && joursSelectes.length > 1 && (
 <Section title="Lieu par jour">
 <div className="space-y-2">
 {joursSelectes.map((jour) => (
 <div key={jour} className="flex items-center gap-3">
 <span className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">{jour}</span>
 <div className="flex gap-2 flex-wrap flex-1">
 {(['Salle de sport', 'Maison', 'Street workout'] as const).map((l) => (
 <button key={l}
 onClick={() => setLieuParJour((prev) => ({ ...prev, [jour]: l }))}
 className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
 (lieuParJour[jour] || lieu) === l ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400 bg-white'
 }`}>
 {l === 'Salle de sport' ? ' Salle' : l === 'Maison' ? ' Maison' : ' Street'}
 </button>
 ))}
 </div>
 </div>
 ))}
 </div>
 </Section>
 )}

 {/* ── 7. GENERATEUR ── */}
 <Section title="Générer un programme">
 <div className="flex gap-3 mb-5 flex-wrap">
 <button
 onClick={handleGenerate}
 disabled={generating}
 className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition min-w-[200px]"
 >
 {generating ? `Génération… ${genProgress}%` : ' Créer avec l\'IA'}
 </button>
 <button
 onClick={handleCreationIA}
 className="px-6 py-3 border-2 border-emerald-500 text-emerald-600 text-sm font-semibold rounded-lg hover:bg-emerald-50 transition"
 >
 Créer avec l’assistance de l’IA
 </button>
 <button
 onClick={() => setCreationMode(creationMode ? false : true)}
 className="px-6 py-3 border-2 border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition"
 >
 Créer manuellement
 </button>
 {programme && (
 <button
 onClick={handleSave}
 disabled={saveStatus === 'saving'}
 className={`px-6 py-3 text-sm font-semibold rounded-lg border-2 transition ${
 saveStatus === 'saved'
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : saveStatus === 'error'
 ? 'border-red-400 text-red-600 bg-red-50'
 : 'border-gray-300 text-gray-700 bg-white hover:border-gray-500'
 }`}
 >
 {saveStatus === 'saving' ? 'Enregistrement…' : saveStatus === 'saved' ? '✓ Enregistré' : saveStatus === 'error' ? 'Erreur — réessayer' : 'Enregistrer'}
 </button>
 )}
 </div>

 {/* Barre de progression génération */}
 {generating && (
 <div className="mb-5">
 <div className="flex justify-between text-xs text-gray-400 mb-1">
 <span>Génération du programme en cours…</span>
 <span className="font-bold">{genProgress}%</span>
 </div>
 <div className="w-full bg-gray-200 rounded-full h-2">
 <div
 className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
 style={{ width: `${genProgress}%` }}
 />
 </div>
 <p className="mt-2 text-xs text-amber-600 font-medium">La création du programme peut prendre jusqu&apos;à 2 minutes.</p>
 </div>
 )}

 {/* Barre 100% brève après génération */}
 {!generating && genProgress === 100 && (
 <div className="mb-5">
 <div className="w-full bg-emerald-100 rounded-full h-2">
 <div className="h-2 rounded-full bg-emerald-500 w-full" />
 </div>
 </div>
 )}

 {/* Creation mode - Block-based editor */}
 {creationMode && (
 <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-5 space-y-4">
 <p className="text-sm font-medium text-emerald-800"> Créez votre propre entraînement par blocs :</p>

 {manualBlocks.map((block, bi) => (
 <div key={bi} className="bg-white border border-emerald-200 rounded-xl p-4 space-y-3">
 <div className="flex items-center gap-2 flex-wrap">
 <input type="text" value={block.jour} onChange={(e) => {
 const nb = [...manualBlocks]; nb[bi] = { ...nb[bi], jour: e.target.value }; setManualBlocks(nb);
 }} placeholder="Jour 1" className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-900 w-28 focus:ring-2 focus:ring-emerald-500 outline-none" />
 <input type="text" value={block.focus} onChange={(e) => {
 const nb = [...manualBlocks]; nb[bi] = { ...nb[bi], focus: e.target.value }; setManualBlocks(nb);
 }} placeholder="Focus (ex: Haut du corps)" className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none" />
 {manualBlocks.length > 1 && (
 <button onClick={() => setManualBlocks(manualBlocks.filter((_, i) => i !== bi))} className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
 )}
 </div>

 {block.exercices.map((exo, ei) => (
 <div key={ei} className="flex items-center gap-2 flex-wrap pl-2 border-l-2 border-emerald-200">
 <span className="text-xs text-emerald-600 font-bold w-5 flex-shrink-0">{ei + 1}</span>
 <input type="text" value={exo.nom} onChange={(e) => {
 const nb = [...manualBlocks]; nb[bi].exercices[ei] = { ...nb[bi].exercices[ei], nom: e.target.value }; setManualBlocks(nb);
 }} placeholder="Exercice" className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" />
 <input type="number" min={1} value={exo.series} onChange={(e) => {
 const nb = [...manualBlocks]; nb[bi].exercices[ei] = { ...nb[bi].exercices[ei], series: parseInt(e.target.value) || 1 }; setManualBlocks(nb);
 }} className="w-14 px-2 py-2 rounded-lg border border-gray-200 text-sm text-center text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" />
 <span className="text-xs text-gray-400">×</span>
 <input type="text" value={exo.reps} onChange={(e) => {
 const nb = [...manualBlocks]; nb[bi].exercices[ei] = { ...nb[bi].exercices[ei], reps: e.target.value }; setManualBlocks(nb);
 }} placeholder="10" className="w-14 px-2 py-2 rounded-lg border border-gray-200 text-sm text-center text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" />
 <span className="text-xs text-gray-400">repos</span>
 <input type="text" value={exo.repos} onChange={(e) => {
 const nb = [...manualBlocks]; nb[bi].exercices[ei] = { ...nb[bi].exercices[ei], repos: e.target.value }; setManualBlocks(nb);
 }} placeholder="90s" className="w-16 px-2 py-2 rounded-lg border border-gray-200 text-sm text-center text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none" />
 {block.exercices.length > 1 && (
 <button onClick={() => {
 const nb = [...manualBlocks]; nb[bi].exercices = nb[bi].exercices.filter((_, i) => i !== ei); setManualBlocks(nb);
 }} className="text-red-300 hover:text-red-500 text-xs">✕</button>
 )}
 </div>
 ))}
 <button onClick={() => {
 const nb = [...manualBlocks]; nb[bi].exercices = [...nb[bi].exercices, { nom: '', series: 3, reps: '10', repos: '90s' }]; setManualBlocks(nb);
 }} className="text-xs text-emerald-600 hover:text-emerald-500 font-medium">+ Ajouter un exercice</button>
 </div>
 ))}

 <button onClick={() => setManualBlocks([...manualBlocks, { jour: `Jour ${manualBlocks.length + 1}`, focus: '', exercices: [{ nom: '', series: 3, reps: '10', repos: '90s' }] }])}
 className="w-full py-2.5 border-2 border-dashed border-emerald-300 text-emerald-600 text-sm font-semibold rounded-xl hover:bg-emerald-50 transition">
 + Ajouter un jour
 </button>

 {/* Free text option */}
 <details className="text-sm">
 <summary className="text-gray-500 cursor-pointer hover:text-gray-700">Ou collez un programme en texte libre…</summary>
 <textarea
 value={customProgramme}
 onChange={(e) => setCustomProgramme(e.target.value)}
 placeholder={"Jour 1 : Pompes 4x10, Tractions 3x8...\nJour 2 : Squats 4x12, Course 20min..."}
 rows={4}
 className="w-full mt-2 px-4 py-3 rounded-lg border border-emerald-300 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
 />
 </details>

 <div className="flex gap-3 flex-wrap">
 <button onClick={handleAnalyseIA} className="px-5 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-400 transition">
 Analyser par l&apos;IA
 </button>
 <button onClick={() => {
 // Build programmeData from blocks
 const validBlocks = manualBlocks.filter(b => b.exercices.some(e => e.nom.trim()));
 if (validBlocks.length > 0) {
 const data: ProgrammeData = {
 jours: validBlocks.map(b => ({
 jour: b.jour || 'Jour',
 focus: b.focus || 'Entraînement',
 exercices: b.exercices.filter(e => e.nom.trim()).map(e => ({
 nom: e.nom, series: e.series, reps: e.reps, repos: e.repos,
 })),
 })),
 };
 setProgrammeData(data);
 setProgramme(JSON.stringify(data, null, 2));
 } else if (customProgramme.trim()) {
 setProgramme(customProgramme);
 // Try to parse as JSON
 try {
 const raw = customProgramme.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
 const parsed = JSON.parse(raw) as ProgrammeData;
 if (parsed.jours?.length) setProgrammeData(parsed);
 } catch { setProgrammeData(null); }
 }
 setCreationMode(false);
 setSavedWorkoutId(null);
 setSaveStatus('idle');
 }} className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition">
 Utiliser ce programme
 </button>
 <button onClick={() => setCreationMode(false)} className="px-5 py-2.5 text-gray-400 text-sm hover:text-gray-600 transition">
 Annuler
 </button>
 </div>
 {iaFeedback && (
 <div className="bg-white border border-emerald-300 rounded-lg p-4">
 <p className="text-xs text-emerald-600 font-semibold uppercase tracking-widest mb-1">Feedback IA</p>
 <p className="text-sm text-gray-700">{iaFeedback}</p>
 </div>
 )}
 </div>
 )}

 {/* Programme généré - CARTES VISUELLES avec Démarrer + Valider */}
 {programme && !editMode && (
 <div className="space-y-4 mb-5">
 <div className="flex items-center justify-between">
 <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Programme généré</p>
 <div className="flex gap-2">
 <button onClick={handleEdit} className="text-xs text-emerald-600 hover:text-emerald-500 transition font-medium">Modifier</button>
 <button onClick={() => handleShare()} className="text-xs font-medium text-gray-500 hover:text-emerald-600 transition">Partager</button>
 </div>
 </div>

 {programmeData ? (
 <div className="space-y-4">
 {/* Week description headers for multi-week programs */}
 {programmeData.semaines && programmeData.semaines.length > 0 && (
 <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-2">
 <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Programme multi-semaines ({programmeData.semaines.length} semaines)</p>
 <p className="text-sm text-gray-600">Le programme évolue progressivement chaque semaine pour optimiser vos gains.</p>
 </div>
 )}
 {programmeData.jours.map((jour, ji) => {
 const wid = savedWorkoutId ?? activeWorkout?.id ?? '';
 const done = wid ? isDayDone(wid, jour.jour) : false;
 // Show week separator for multi-week programs
 const weekMatch = jour.jour.match(/^S(\d+)\s*-\s*/);
 const weekNum = weekMatch ? parseInt(weekMatch[1]) : null;
 const prevWeek = ji > 0 ? programmeData.jours[ji - 1].jour.match(/^S(\d+)\s*-\s*/) : null;
 const showWeekHeader = weekNum !== null && (ji === 0 || (prevWeek && parseInt(prevWeek[1]) !== weekNum));
 const weekDesc = weekNum && programmeData.semaines ? programmeData.semaines.find((s) => s.semaine === weekNum)?.description : null;
 return (
 <div key={ji}>
 {showWeekHeader && (
 <div className="flex items-center gap-3 mt-4 mb-2">
 <div className="h-px flex-1 bg-gray-200" />
 <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Semaine {weekNum}</span>
 <div className="h-px flex-1 bg-gray-200" />
 </div>
 )}
 {showWeekHeader && weekDesc && (
 <p className="text-xs text-gray-400 mb-2 text-center">{weekDesc}</p>
 )}
 <div className={`bg-white border rounded-xl overflow-hidden ${done ? 'border-emerald-300 opacity-80' : 'border-gray-200'}`}>
 <div className={`px-4 sm:px-5 py-3 flex items-center justify-between gap-2 ${done ? 'bg-emerald-500' : 'bg-gray-900'}`}>
 <h3 className="text-sm font-bold text-white flex items-center gap-2 truncate min-w-0">
 {done && <span>✓</span>}
 {jour.jour}
 </h3>
 <span className="text-xs text-white/70 font-medium flex-shrink-0">{jour.focus}</span>
 </div>
 <div className="divide-y divide-gray-100">
 {jour.exercices.map((exo, ei) => (
 <div key={ei} className="px-4 sm:px-5 py-3.5 flex items-start gap-3 sm:gap-4">
 <span className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
 {ei + 1}
 </span>
 <div className="flex-1 min-w-0">
{(exerciseMediaMap[exo.nom.trim().toLowerCase()]?.gifUrl || exerciseMediaMap[exo.nom.trim().toLowerCase()]?.animationFrames?.length) && (
<ExerciseMotionPreview
title={exo.nom}
gifUrl={exerciseMediaMap[exo.nom.trim().toLowerCase()]?.gifUrl}
frames={exerciseMediaMap[exo.nom.trim().toLowerCase()]?.animationFrames}
className="mb-2 max-w-[220px] overflow-hidden rounded-lg border border-gray-200"
imgClassName="w-full h-32 object-contain bg-slate-50"
/>
)}
 <p className="text-sm font-semibold text-gray-900 break-words">{exerciseMediaMap[exo.nom.trim().toLowerCase()]?.nameFr || exo.nom}</p>
 <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
 <span className="text-xs text-gray-500">{exo.series} séries</span>
 <span className="text-xs text-gray-400">×</span>
 <span className="text-xs text-gray-500">{exo.reps} reps</span>
 <span className="text-xs text-gray-400">|</span>
 <span className="text-xs text-gray-500">Repos {exo.repos}</span>
 </div>
 {exo.conseil && <p className="text-xs text-emerald-600 mt-1">{exo.conseil}</p>}
 {exerciseMediaMap[exo.nom.trim().toLowerCase()]?.instructionFr && (
 <p className="text-xs text-gray-500 mt-1">{exerciseMediaMap[exo.nom.trim().toLowerCase()]?.instructionFr}</p>
 )}
 </div>
 </div>
 ))}
 </div>

 {/* Boutons Démarrer + Valider */}
 {!done && (
 <div className="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 sm:gap-3">
 {wid && (
 <button
 onClick={() => handleStartSession(jour, wid)}
 className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition"
 >
 Démarrer
 </button>
 )}
 {wid && (
 <button
 onClick={() => handleValidateSession(wid, jour.jour)}
 className="flex-1 py-2.5 border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 text-sm font-semibold rounded-lg transition"
 >
 ✓ Valider
 </button>
 )}
 {!wid && (
 <p className="text-xs text-gray-400 italic">Enregistrez d&apos;abord le programme pour démarrer une séance</p>
 )}
 </div>
 )}
 {done && (
 <div className="px-5 py-3 border-t border-emerald-100 bg-emerald-50">
 <p className="text-xs text-emerald-700 font-semibold">✓ Séance réalisée</p>
 </div>
 )}
 </div>
 </div>
 );
 })}

 {(programmeData.conseils_generaux || programmeData.progression_4_semaines) && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {programmeData.conseils_generaux && (
 <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
 <p className="text-xs text-emerald-600 font-semibold uppercase tracking-widest mb-2">Conseils</p>
 <p className="text-sm text-gray-700 leading-relaxed">{programmeData.conseils_generaux}</p>
 </div>
 )}
 {programmeData.progression_4_semaines && (
 <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
 <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-2">Progression 4 semaines</p>
 <p className="text-sm text-gray-700 leading-relaxed">{programmeData.progression_4_semaines}</p>
 </div>
 )}
 </div>
 )}
 </div>
 ) : (
 <div className="bg-white border border-gray-200 rounded-xl p-6">
 <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
 Le programme n&apos;est pas dans un format exploitable. Relancez la génération pour obtenir des blocs structurés.
 </p>
 </div>
 )}
 </div>
 )}

 {/* Modal de partage */}
 {shareOpen && (
 <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShareOpen(false)}>
 <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
 <div className="px-6 py-5 border-b border-gray-100">
 <h3 className="text-base font-bold text-gray-900">Partager l&apos;entraînement</h3>
 <p className="text-xs text-gray-400 mt-0.5">Sélectionnez un ami pour lui envoyer ce programme</p>
 </div>
 <div className="px-4 pt-3">
 <input
 type="text"
 placeholder="Rechercher un ami..."
 value={shareSearch}
 onChange={(e) => setShareSearch(e.target.value)}
 className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
 />
 </div>
 <div className="p-3 max-h-64 overflow-y-auto">
 {filteredAmis.length === 0 && (
 <p className="text-sm text-gray-400 text-center py-4">Aucun ami trouvé</p>
 )}
 {filteredAmis.map((ami) => (
 <button
 key={ami.id}
 onClick={() => setShareTarget(ami.friendId)}
 className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition ${
 shareTarget === ami.friendId ? 'bg-emerald-50 border border-emerald-300' : 'hover:bg-gray-50 border border-transparent'
 }`}
 >
 <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold text-gray-700">{(ami.nom || ami.pseudo || '?')[0]}</div>
 <div className="flex-1">
 <p className="text-sm font-semibold text-gray-900">{ami.nom || ami.pseudo}</p>
 {ami.pseudo && <p className="text-xs text-gray-400">@{ami.pseudo}</p>}
 </div>
 {shareTarget === ami.friendId && (
 <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
 </svg>
 )}
 </button>
 ))}
 </div>
 {shareError && (
 <div className="px-6 pb-2">
 <p className="text-xs text-red-600">{shareError}</p>
 </div>
 )}
 <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
 <button onClick={() => { setShareOpen(false); setShareSending(false); setShareError(null); }} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition">Annuler</button>
 <button
 onClick={confirmShare}
 disabled={!shareTarget || shareSent || shareSending}
 className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition ${shareSent ? 'bg-emerald-500 text-white' : shareTarget && !shareSending ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
 >
 {shareSent ? 'Envoye !' : shareSending ? 'Envoi...' : 'Envoyer'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Edit mode */}
 {editMode && (
 <div className="bg-gray-950 rounded-xl p-6 mb-5 space-y-3">
 <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Modifier le programme</p>
 <textarea
 value={editedProgramme}
 onChange={(e) => setEditedProgramme(e.target.value)}
 rows={12}
 className="w-full px-4 py-3 rounded-lg bg-gray-900 text-emerald-400 font-mono text-sm border border-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
 />
 <div className="flex gap-3">
 <button onClick={handleSaveEdit} className="px-5 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-400 transition">Sauvegarder</button>
 <button onClick={() => setEditMode(false)} className="px-5 py-2 text-gray-400 text-sm hover:text-gray-300 transition">Annuler</button>
 </div>
 </div>
 )}

 {/* Config summary */}
 {(objectifs.length > 0 || joursSelectes.length > 0 || lieu) && (
 <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
 <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-3">Configuration</p>
 <div className="space-y-1.5 text-sm">
 {[
 ['Objectif', objectifs.length ? objectifs.join(', ') : '--'],
 ['Temps', tempsSeance || '--'],
 ['Durée', dureeProgramme ? dureeProgramme.replace('_', ' ') : '--'],
 ['Figures', figuresSelectees.length ? figuresSelectees.map((f) => `${f} (${niveauxFigures[f] || '?'})`).join(', ') : '--'],
 ['Muscles', musclesCibles.length ? musclesCibles.join(', ') : '--'],
 ['Fréquence', `${frequence}x / semaine`],
 ['Jours', joursSelectes.length ? joursSelectes.join(', ') : '--'],
 ['Lieu', lieu || '--'],
 ['Équipement', equipements.length ? equipements.join(', ') : '--'],
 ].map(([l, v]) => (
 <div key={l} className="flex flex-col sm:flex-row sm:gap-4">
 <span className="text-gray-400 sm:w-24 flex-shrink-0">{l}</span>
 <span className="text-gray-900 font-medium break-words min-w-0">{v}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </Section>

 </>)} {/* ── end tab génération ── */}

 {/* ═══════ TAB: MES SÉANCES ═══════ */}
 {entrainementTab === 'seances' && (<>

 {nextSession?.jour && (
 <div className="mb-4 sm:mb-5 rounded-2xl border border-gray-200 bg-white overflow-hidden">
 <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-stretch">
 <div className="bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200">
 <img src={SESSION_META[nextSession.type].image} alt="Seance suivante" className="w-full h-32 sm:h-full object-contain bg-slate-50" />
 </div>
 <div className="p-4 sm:p-5">
 <div className="flex items-center gap-2 mb-1">
 <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400 font-semibold">Seance suivante</p>
 <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${SESSION_META[nextSession.type].badgeClass}`}>{SESSION_META[nextSession.type].label}</span>
 </div>
 <h3 className="text-base sm:text-lg font-bold text-gray-900 mt-1">{nextSession.jour.jour}</h3>
 <p className="text-sm text-gray-500 mt-0.5 truncate">{nextSession.title}</p>
 <p className="text-xs text-gray-500 mt-2">{nextSession.jour.exercices.length} exercices · {nextSession.jour.focus}</p>
 <button
 onClick={() => handleStartSession(nextSession.jour as ProgrammeJour, nextSession.workoutId)}
 className="mt-3 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition"
 >
 Demarrer maintenant
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── SÉANCES SAUVEGARDÉES ── */}
 {savedWorkouts.length > 0 && (
 <Section title="Mes séances" subtitle="Programmes sauvegardés">
 <div className="space-y-4">
 {savedWorkouts.map((w) => {
 const total = w.programme?.jours?.length ?? 0;
 const done = w.sessions.filter((s) => s.status === 'done').length;
 const pct = total > 0 ? Math.round((done / total) * 100) : 0;
 const wType = inferSessionType(`${w.title} ${(w.programme?.jours ?? []).map((j) => j.focus).join(' ')}`);
 return (
 <div key={w.id} className="border border-gray-200 rounded-xl overflow-hidden">
 <div
 className="px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50 transition"
 onClick={() => setActiveWorkout(activeWorkout?.id === w.id ? null : w)}
 >
 <div className="flex-1 min-w-0">
 {renamingId === w.id ? (
 <form onSubmit={(e) => { e.preventDefault(); renameWorkout(w.id, renameValue); }} className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
 <input
 autoFocus
 value={renameValue}
 onChange={(e) => setRenameValue(e.target.value)}
 className="text-sm font-semibold text-gray-900 border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400"
 onBlur={() => renameWorkout(w.id, renameValue)}
 />
 </form>
 ) : (
 <div className="flex items-center gap-2 min-w-0">
 <img src={SESSION_META[wType].image} alt={SESSION_META[wType].label} className="w-8 h-8 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
 <p className="text-sm font-semibold text-gray-900 truncate">{w.title}</p>
 <button
 onClick={(e) => { e.stopPropagation(); setRenamingId(w.id); setRenameValue(w.title); }}
 className="text-gray-300 hover:text-gray-500 transition"
 title="Renommer"
 >
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
 </button>
 </div>
 )}
 <div className="mt-1 flex items-center gap-2">
 <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${SESSION_META[wType].badgeClass}`}>{SESSION_META[wType].label}</span>
 <span className="text-xs text-gray-400">{new Date(w.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
 {w.sharedBy && <span className="text-xs text-gray-400">partage</span>}
 </div>
 </div>
 <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
 <button
 onClick={(e) => { e.stopPropagation(); handleShare(w.id); }}
 className="text-xs text-gray-400 hover:text-emerald-500 transition font-medium"
 title="Partager"
 >
 <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
 <span className="hidden sm:inline">Partager</span>
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); handleDeleteWorkout(w.id); }}
 className="text-xs text-gray-400 hover:text-red-500 transition font-medium"
 title="Supprimer"
 >
 <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
 <span className="hidden sm:inline">Supprimer</span>
 </button>
 <div className="text-right">
 <p className="text-xs text-gray-500 font-medium">{pct}%</p>
 <div className="w-16 sm:w-20 bg-gray-200 rounded-full h-1.5 mt-1">
 <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
 </div>
 </div>
 <svg className={`w-4 h-4 text-gray-400 transition-transform ${activeWorkout?.id === w.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
 </svg>
 </div>
 </div>

 {activeWorkout?.id === w.id && w.programme?.jours && (
 <div className="border-t border-gray-100 divide-y divide-gray-100">
 {w.programme.jours.map((jour, ji) => {
 const dayDone = isDayDone(w.id, jour.jour);
 const dayType = inferSessionType(`${jour.focus} ${w.title}`);
 return (
 <div key={ji} className={`px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 ${dayDone ? 'bg-emerald-50' : ''}`}>
 <div className="flex items-center gap-3 min-w-0">
 <img src={SESSION_META[dayType].image} alt={SESSION_META[dayType].label} className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
 <div className="min-w-0">
 <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
 {dayDone && <span className="text-emerald-500">✓</span>}
 {jour.jour}
 </p>
 <p className="text-xs text-gray-500 truncate">{jour.exercices.length} ex · {jour.focus}</p>
 </div>
 </div>
 {!dayDone ? (
 <div className="flex gap-2">
 <button
 onClick={() => handleStartSession(jour, w.id)}
 className="px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition"
 >
 Démarrer
 </button>
 <button
 onClick={() => handleValidateSession(w.id, jour.jour)}
 className="px-3 py-1.5 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 text-xs font-semibold rounded-lg transition"
 >
 ✓ Valider
 </button>
 </div>
 ) : (
 <span className="text-xs text-emerald-600 font-semibold">Réalisée</span>
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
 </Section>
 )}

 {/* ═══════ ÉQUIPEMENT (dans séances) ═══════ */}
 <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm mt-5">
 <div className="flex items-center justify-between gap-3 mb-2">
 <div>
 <h2 className="text-lg font-bold text-gray-900">Équipement disponible</h2>
 <p className="text-sm text-gray-500">{equipements.length > 0 ? `${equipements.length} équipement${equipements.length !== 1 ? 's' : ''} sélectionné${equipements.length !== 1 ? 's' : ''}` : 'Aucun équipement sélectionné'}</p>
 </div>
 <button onClick={() => setShowEquip((v) => !v)} className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition">
 {showEquip ? 'Masquer' : 'Afficher'}
 </button>
 </div>
 {showEquip && (
 <>
 <div className="space-y-3 mt-4">
 {(['Ceinture lestee', 'Gilet leste', 'Elastiques', 'Halteres', 'Barre de traction', 'Parallettes', 'Anneaux', 'Autre'] as Equipement[]).map((eq) => {
 const needsKg = ['Ceinture lestee', 'Gilet leste', 'Halteres'].includes(eq);
 const needsDetail = ['Elastiques', 'Autre'].includes(eq);
 const icon = eq === 'Ceinture lestee' ? '' : eq === 'Gilet leste' ? '' : eq === 'Elastiques' ? '' : eq === 'Halteres' ? '' : eq === 'Barre de traction' ? '' : eq === 'Parallettes' ? '' : eq === 'Anneaux' ? '' : '';
 return (
 <div key={eq}>
 <button
 onClick={() => toggleEquip(eq)}
 className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 text-sm font-semibold transition ${
 equipements.includes(eq)
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'
 }`}
 >
 <span>{icon} {eq}</span>
 <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
 equipements.includes(eq) ? 'border-white bg-white/20' : 'border-gray-300'
 }`}>
 {equipements.includes(eq) && (
 <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 10 10">
 <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
 </svg>
 )}
 </span>
 </button>
 {equipements.includes(eq) && (
 <div className="mt-2 ml-3 border border-emerald-200 bg-emerald-50 rounded-xl p-5 space-y-4">
 {needsKg && (
 <div>
 <p className="text-sm font-medium text-gray-700 mb-2">Charge maximale</p>
 <div className="flex items-center gap-4">
 <input type="range" min={0} max={80} step={0.5} value={equipConfig[eq]?.maxKg ?? 0} onChange={(e) => updateEquipKg(eq, Number(e.target.value))} className="flex-1 accent-emerald-500" />
 <span className="w-16 text-right text-sm font-bold text-emerald-800 tabular-nums">{equipConfig[eq]?.maxKg ?? 0} kg</span>
 </div>
 </div>
 )}
 {needsKg && (
 <div>
 <p className="text-sm font-medium text-gray-700 mb-2">Progression par palier</p>
 <input type="text" value={equipConfig[eq]?.progression ?? ''} onChange={(e) => updateEquipProg(eq, e.target.value)} placeholder="ex: +2 kg, +5 kg..." className="w-full px-4 py-2.5 rounded-lg border border-emerald-300 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
 </div>
 )}
 {needsDetail && (
 <div>
 <p className="text-sm font-medium text-gray-700 mb-2">{eq === 'Elastiques' ? 'Résistance disponible (ex: légère, moyenne, forte)' : 'Précisez votre équipement'}</p>
 <input type="text" value={equipConfig[eq]?.detail ?? ''} onChange={(e) => setEquipConfig((p) => { const nv = { ...p, [eq]: { ...p[eq], detail: e.target.value } }; saveEquipment(equipements, nv); return nv; })} placeholder={eq === 'Elastiques' ? 'ex: légère (5kg), moyenne (15kg), forte (25kg)' : 'ex: kettlebell 16kg, TRX...'} className="w-full px-4 py-2.5 rounded-lg border border-emerald-300 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
 </div>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 <div className="mt-6 p-4 bg-gray-50 rounded-xl">
 <p className="text-xs text-gray-500"><strong>{equipements.length}</strong> équipement{equipements.length !== 1 ? 's' : ''} sélectionné{equipements.length !== 1 ? 's' : ''}</p>
 </div>
 </>)}
 </section>

 </>)} {/* ── end tab séances (saved workouts) ── */}

 {/* ═══════ TAB: GÉNÉRATEUR (test & biblio) ═══════ */}
 {entrainementTab === 'config' && (<>

 {/* ── 9. BIBLIOTHEQUE D'EXERCICES ── */}
 <Section title="Bibliotheque d'exercices" subtitle="1300+ exercices avec demonstrations animees (ExerciseDB).">
 <div className="mb-4 flex gap-2 flex-wrap">
 <button
 onClick={() => fetchExercises('')}
 className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${
 exoLibFilter === '' && exoLibResults.length > 0
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : 'border-gray-200 text-gray-600 hover:border-emerald-400 bg-white'
 }`}
 >
 Selon mon lieu
 </button>
 {MUSCLES.map((m) => (
 <button
 key={m}
 onClick={() => fetchExercises(m)}
 className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${
 exoLibFilter === m
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : 'border-gray-200 text-gray-600 hover:border-emerald-400 bg-white'
 }`}
 >
 {m}
 </button>
 ))}
 </div>

 {exoLibLoading && (
 <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-500">
 <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
 Chargement des exercices...
 </div>
 )}

 {!exoLibLoading && exoLibResults.length === 0 && (
 <p className="text-sm text-gray-400 text-center py-6">Selectionnez un groupe musculaire pour explorer les exercices.</p>
 )}

 {exoDetail && (
 <div className="bg-white border border-emerald-200 rounded-xl p-5 mb-4">
 <div className="flex items-start justify-between gap-2 mb-3">
 <h4 className="font-bold text-gray-900 capitalize text-base">{exerciseMediaMap[exoDetail.name.trim().toLowerCase()]?.nameFr || exoDetail.name}</h4>
 <button onClick={() => setExoDetail(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-xl leading-none">&times;</button>
 </div>
 <div className="flex gap-2 flex-wrap mb-3">
 {exoDetail.category?.name && (
 <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium capitalize">{exoDetail.category.name}</span>
 )}
 {exoDetail.muscles?.map((m) => (
 <span key={m.name_en} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium capitalize">{m.name_en}</span>
 ))}
 {exoDetail.equipment?.map((e) => (
 <span key={e.name} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium capitalize">{e.name}</span>
 ))}
 </div>
{(exerciseMediaMap[exoDetail.name.trim().toLowerCase()]?.gifUrl || exerciseMediaMap[exoDetail.name.trim().toLowerCase()]?.animationFrames?.length) && (
<ExerciseMotionPreview
title={exoDetail.name}
gifUrl={exerciseMediaMap[exoDetail.name.trim().toLowerCase()]?.gifUrl}
frames={exerciseMediaMap[exoDetail.name.trim().toLowerCase()]?.animationFrames}
className="mb-3 max-w-md overflow-hidden rounded-lg border border-gray-200"
imgClassName="w-full h-52 object-contain bg-slate-50"
/>
)}
 {exoDetail.description && (
 <p className="text-xs text-gray-600 leading-relaxed"
 dangerouslySetInnerHTML={{ __html: exoDetail.description.replace(/<[^>]+>/g, '').slice(0, 300) + (exoDetail.description.length > 300 ? '...' : '') }}
 />
 )}
 {exerciseMediaMap[exoDetail.name.trim().toLowerCase()]?.instructionFr && (
 <p className="text-xs text-emerald-700 mt-2">{exerciseMediaMap[exoDetail.name.trim().toLowerCase()]?.instructionFr}</p>
 )}
 </div>
 )}

 {!exoLibLoading && exoLibResults.length > 0 && (
 <div className="grid grid-cols-2 gap-3">
 {exoLibResults.map((ex) => (
 <button
 key={ex.id}
 onClick={() => setExoDetail(exoDetail?.id === ex.id ? null : ex)}
 className={`text-left rounded-xl border-2 p-4 transition ${
 exoDetail?.id === ex.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-400 bg-white'
 }`}
 >
{(exerciseMediaMap[ex.name.trim().toLowerCase()]?.gifUrl || exerciseMediaMap[ex.name.trim().toLowerCase()]?.animationFrames?.length) && (
<ExerciseMotionPreview
title={ex.name}
gifUrl={exerciseMediaMap[ex.name.trim().toLowerCase()]?.gifUrl}
frames={exerciseMediaMap[ex.name.trim().toLowerCase()]?.animationFrames}
className="mb-2 overflow-hidden rounded-lg border border-gray-200"
imgClassName="w-full h-28 object-contain bg-slate-50"
/>
)}
 <p className="text-sm font-semibold text-gray-900 capitalize leading-snug mb-1">{exerciseMediaMap[ex.name.trim().toLowerCase()]?.nameFr || ex.name}</p>
 <div className="flex gap-1.5 flex-wrap">
 {ex.category?.name && (
 <span className="text-xs text-emerald-600 font-medium capitalize">{ex.category.name}</span>
 )}
 {ex.muscles?.slice(0, 2).map((m) => (
 <span key={m.name_en} className="text-xs text-gray-400 capitalize">{m.name_en}</span>
 ))}
 </div>
 </button>
 ))}
 </div>
 )}
 </Section>

 </>)} {/* ── end tab config (test & biblio) ── */}

 {/* ═══════ TAB: MES SÉANCES (analyse) ═══════ */}
 {entrainementTab === 'seances' && (<>

 {/* ── 10. ANALYSE ── */}
 <Section title="Analyse et suivi" subtitle="Performances et engagement.">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
 {[
 { label: 'Séances réalisées', value: String(sessionsRealisees) },
 { label: 'Programmes sauvegardés', value: String(savedWorkouts.length) },
 { label: 'Respect fréquence', value: `${respectPct} %` },
 ].map((k) => (
 <div key={k.label} className="bg-gray-50 border border-gray-200 rounded-xl p-5">
 <p className="text-2xl font-bold text-gray-900 tabular-nums">{k.value}</p>
 <p className="text-xs text-gray-500 mt-1 leading-snug">{k.label}</p>
 </div>
 ))}
 </div>

 {doneSessions.length > 0 && (
 <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
 <p className="text-sm font-medium text-gray-700 mb-3">Dernières séances réalisées</p>
 <div className="space-y-2">
 {doneSessions.slice(0, 5).map((s, i) => (
 <div key={i} className="flex items-center justify-between text-sm">
 <span className="text-gray-700 font-medium">{s.dayLabel}</span>
 <span className="text-xs text-emerald-600 font-semibold">✓ Réalisée</span>
 </div>
 ))}
 </div>
 </div>
 )}

 <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-5">
 <div className="flex justify-between text-sm mb-2">
 <span className="font-medium text-gray-700">Respect de la fréquence</span>
 <span className="font-bold text-gray-900 tabular-nums">{sessionsRealisees} séances</span>
 </div>
 <div className="w-full bg-gray-200 rounded-full h-1.5">
 <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${respectPct}%` }} />
 </div>
 </div>
 </Section>

 </>)} {/* ── end tab séances (analyse) ── */}

 {/* ═══════ TAB: TUTO ═══════ */}
 {entrainementTab === 'tuto' && (
 <TutoTab />
 )}

 {/* ═══════ TAB: ÉQUIPEMENT (désactivé - fusionné dans séances) ═══════ */}
 {false && (
 <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
 <div className="flex items-center gap-3 mb-6">
 <span className="text-3xl"></span>
 <div>
 <h2 className="text-lg font-bold text-gray-900">Équipement disponible</h2>
 <p className="text-sm text-gray-500">Sélectionnez votre matériel pour des séances adaptées. Sauvegardé automatiquement.</p>
 </div>
 </div>
 <div className="space-y-3">
 {(['Ceinture lestee', 'Gilet leste', 'Elastiques', 'Halteres', 'Barre de traction', 'Parallettes', 'Anneaux', 'Autre'] as Equipement[]).map((eq) => {
 const needsKg = ['Ceinture lestee', 'Gilet leste', 'Halteres'].includes(eq);
 const needsDetail = ['Elastiques', 'Autre'].includes(eq);
 const icon = eq === 'Ceinture lestee' ? '' : eq === 'Gilet leste' ? '' : eq === 'Elastiques' ? '' : eq === 'Halteres' ? '' : eq === 'Barre de traction' ? '' : eq === 'Parallettes' ? '' : eq === 'Anneaux' ? '' : '';
 return (
 <div key={eq}>
 <button
 onClick={() => toggleEquip(eq)}
 className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 text-sm font-semibold transition ${
 equipements.includes(eq)
 ? 'border-emerald-500 bg-emerald-500 text-white'
 : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'
 }`}
 >
 <span>{icon} {eq}</span>
 <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
 equipements.includes(eq) ? 'border-white bg-white/20' : 'border-gray-300'
 }`}>
 {equipements.includes(eq) && (
 <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 10 10">
 <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
 </svg>
 )}
 </span>
 </button>
 {equipements.includes(eq) && (
 <div className="mt-2 ml-3 border border-emerald-200 bg-emerald-50 rounded-xl p-5 space-y-4">
 {needsKg && (
 <div>
 <p className="text-sm font-medium text-gray-700 mb-2">Charge maximale</p>
 <div className="flex items-center gap-4">
 <input type="range" min={0} max={80} step={0.5} value={equipConfig[eq]?.maxKg ?? 0} onChange={(e) => updateEquipKg(eq, Number(e.target.value))} className="flex-1 accent-emerald-500" />
 <span className="w-16 text-right text-sm font-bold text-emerald-800 tabular-nums">{equipConfig[eq]?.maxKg ?? 0} kg</span>
 </div>
 </div>
 )}
 {needsKg && (
 <div>
 <p className="text-sm font-medium text-gray-700 mb-2">Progression par palier</p>
 <input type="text" value={equipConfig[eq]?.progression ?? ''} onChange={(e) => updateEquipProg(eq, e.target.value)} placeholder="ex: +2 kg, +5 kg..." className="w-full px-4 py-2.5 rounded-lg border border-emerald-300 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
 </div>
 )}
 {needsDetail && (
 <div>
 <p className="text-sm font-medium text-gray-700 mb-2">{eq === 'Elastiques' ? 'Résistance disponible (ex: légère, moyenne, forte)' : 'Précisez votre équipement'}</p>
 <input type="text" value={equipConfig[eq]?.detail ?? ''} onChange={(e) => setEquipConfig((p) => { const nv = { ...p, [eq]: { ...p[eq], detail: e.target.value } }; saveEquipment(equipements, nv); return nv; })} placeholder={eq === 'Elastiques' ? 'ex: légère (5kg), moyenne (15kg), forte (25kg)' : 'ex: kettlebell 16kg, TRX...'} className="w-full px-4 py-2.5 rounded-lg border border-emerald-300 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
 </div>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 <div className="mt-6 p-4 bg-gray-50 rounded-xl">
 <p className="text-xs text-gray-500"><strong>{equipements.length}</strong> équipement{equipements.length !== 1 ? 's' : ''} sélectionné{equipements.length !== 1 ? 's' : ''}</p>
 </div>
 </section>
 )}

 {/* ═══════ TAB: DÉFIS ═══════ */}
 {(entrainementTab as string) === 'defis' && (
 <div className="space-y-4">
 {/* Header + create button */}
 <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-2">
 <div>
 <h2 className="text-lg font-bold text-gray-900"> Défis sportifs</h2>
 <p className="text-xs sm:text-sm text-gray-500">Défis de la semaine + vos défis personnels.</p>
 </div>
 <button
 onClick={() => setShowCreateChallenge((v) => !v)}
 className="w-full sm:w-auto px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-xl transition shrink-0"
 >
 {showCreateChallenge ? '✕ Annuler' : '+ Créer un défi'}
 </button>
 </div>

 {/* Create challenge form */}
 {showCreateChallenge && (
 <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
 <p className="text-sm font-semibold text-gray-800">Nouveau défi</p>

 {/* Visibility selector */}
 <div>
 <p className="text-xs text-gray-500 font-medium mb-1">Visibilité</p>
 <div className="flex gap-2 flex-wrap">
 {([{ key: 'friends' as const, label: ' Amis', desc: 'Vos amis' }, { key: 'private' as const, label: ' Privé', desc: 'Vous seul' }, { key: 'public' as const, label: ' Public', desc: 'Tout le monde' }]).map((v) => (
 <button key={v.key} onClick={() => setNewChallVisibility(v.key)}
 className={`flex-1 min-w-[80px] py-2 rounded-lg text-xs font-semibold transition border-2 ${newChallVisibility === v.key ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
 {v.label}
 </button>
 ))}
 </div>
 </div>

 {/* Type selector */}
 <div className="flex gap-2">
 <button onClick={() => setNewChallType('simple')}
 className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border-2 ${newChallType === 'simple' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
 Défi simple
 </button>
 <button onClick={() => setNewChallType('circuit')}
 className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border-2 ${newChallType === 'circuit' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
 Défi circuit
 </button>
 </div>

 {/* Difficulty selector */}
 <div>
 <p className="text-xs text-gray-500 font-medium mb-1">Difficulté</p>
 <div className="flex gap-2 flex-wrap">
 {([1, 2, 3] as const).map((d) => (
 <button key={d} onClick={() => setNewChallDifficulty(d)}
 className={`flex-1 min-w-[90px] py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition border-2 ${newChallDifficulty === d ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
 {''.repeat(d)} {d === 1 ? 'Facile' : d === 2 ? 'Moyen' : 'Difficile'} ({d === 1 ? '25' : d === 2 ? '50' : '100'} XP)
 </button>
 ))}
 </div>
 </div>

 <input
 type="text" placeholder="Titre du défi" value={newChallTitle} onChange={(e) => setNewChallTitle(e.target.value)}
 className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
 />
 <textarea
 placeholder="Description (comment le réussir, règles...)" value={newChallDesc} onChange={(e) => setNewChallDesc(e.target.value)}
 rows={2} className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none resize-none"
 />

 {newChallType === 'simple' && (
 <div className="flex flex-col sm:flex-row gap-2">
 <input
 type="text" placeholder="Exercice (ex: tractions)" value={newChallExercise} onChange={(e) => setNewChallExercise(e.target.value)}
 className="flex-1 min-w-0 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
 />
 <div className="flex gap-2">
 <input
 type="number" placeholder="Objectif" value={newChallTarget} onChange={(e) => setNewChallTarget(e.target.value)}
 className="w-24 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
 />
 <select
 value={newChallUnit} onChange={(e) => setNewChallUnit(e.target.value)}
 className="px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
 >
 <option value="reps">répétitions</option>
 <option value="kg">kg</option>
 <option value="min">minutes</option>
 <option value="km">km</option>
 </select>
 </div>
 </div>
 )}

 {newChallType === 'circuit' && (
 <div className="space-y-3 bg-white border border-gray-200 rounded-xl p-4">
 <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Exercices du circuit</p>
 {circuitExercises.map((ex, i) => (
 <div key={i} className="flex flex-wrap gap-2 items-center">
 <input
 type="text" placeholder={`Exercice ${i + 1}`} value={ex.nom}
 onChange={(e) => {
 const updated = [...circuitExercises];
 updated[i] = { ...updated[i], nom: e.target.value };
 setCircuitExercises(updated);
 }}
 className="flex-1 min-w-0 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
 />
 <div className="flex gap-2 items-center">
 <input
 type="number" min={1} value={ex.reps}
 onChange={(e) => {
 const updated = [...circuitExercises];
 updated[i] = { ...updated[i], reps: parseInt(e.target.value) || 1 };
 setCircuitExercises(updated);
 }}
 className="w-16 sm:w-20 px-2 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-center"
 />
 <span className="text-xs text-gray-400">reps</span>
 {circuitExercises.length > 1 && (
 <button onClick={() => setCircuitExercises(circuitExercises.filter((_, idx) => idx !== i))}
 className="text-red-400 hover:text-red-600 text-sm">✕</button>
 )}
 </div>
 </div>
 ))}
 <button
 onClick={() => setCircuitExercises([...circuitExercises, { nom: '', reps: 10 }])}
 className="text-xs text-emerald-600 hover:text-emerald-500 font-semibold"
 >
 + Ajouter un exercice
 </button>
 <div className="flex gap-3 pt-2 border-t border-gray-100">
 <div className="flex-1">
 <label className="text-xs text-gray-500 font-medium block mb-1">Repos entre tours</label>
 <div className="flex items-center gap-2">
 <input type="number" min={0} step={15} value={circuitRepos}
 onChange={(e) => setCircuitRepos(parseInt(e.target.value) || 0)}
 className="w-20 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg outline-none text-center" />
 <span className="text-xs text-gray-400">secondes</span>
 </div>
 </div>
 <div className="flex-1">
 <label className="text-xs text-gray-500 font-medium block mb-1">Nombre de tours</label>
 <input type="number" min={1} max={20} value={circuitTours}
 onChange={(e) => setCircuitTours(parseInt(e.target.value) || 1)}
 className="w-20 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg outline-none text-center" />
 </div>
 </div>
 </div>
 )}

 <button
 onClick={createChallenge}
 disabled={createChallengeLoading || !newChallTitle || !newChallDesc || (newChallType === 'simple' && (!newChallExercise || !newChallTarget)) || (newChallType === 'circuit' && (circuitExercises.some((e) => !e.nom) || circuitTours < 1))}
 className="px-5 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition"
 >
 {createChallengeLoading ? 'Création...' : 'Publier le défi'}
 </button>
 </div>
 )}

 {challengeLoading && <p className="text-sm text-gray-400 text-center py-8">Chargement des défis...</p>}

 {/* System weekly challenges + admin-approved public challenges */}
 {challenges.filter((c) => c.type !== 'user').length > 0 && (
 <div>
 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Défis de la semaine & défis publics</p>
 <div className="space-y-3">
 {challenges.filter((c) => c.type !== 'user').map((c) => (
 <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
 <div className="flex flex-col sm:flex-row items-start gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex flex-wrap items-center gap-2 mb-1">
 <span className="text-base"></span>
 <h3 className="text-sm font-bold text-gray-900 break-words min-w-0">{c.title}</h3>
 <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">{''.repeat(c.difficulty || 1)}</span>
 </div>
 <p className="text-sm text-gray-600 mb-1">{c.description}</p>
 <p className="text-xs text-gray-400">
 Objectif : <span className="font-semibold text-gray-700">{c.target} {c.unit}</span>
 {c.badgeLabel && <> &nbsp;•&nbsp; Badge : <span className="font-semibold text-gray-700">{c.badgeLabel}</span></>}
 &nbsp;•&nbsp; {c._count.completions} participant{c._count.completions !== 1 ? 's' : ''}
 </p>
 </div>
 <div className="shrink-0">
 {c.completed ? (
 <span className="px-3 py-2 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg">✓ Relevé</span>
 ) : (
 <button onClick={() => completeChallenge(c.id)}
 disabled={challengeActionLoading.has(c.id)}
 className="px-4 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition">
 {challengeActionLoading.has(c.id) ? '...' : '✓ Défi relevé !'}
 </button>
 )}
 </div>
 </div>
 {challengeNotif[c.id] && (
 <p className="mt-3 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">{challengeNotif[c.id]}</p>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* User-created challenges */}
 {challenges.filter((c) => c.type === 'user').length > 0 && (
 <div>
 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Défis personnels</p>
 <div className="space-y-3">
 {challenges.filter((c) => c.type === 'user').map((c) => (
 <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
 <div className="flex flex-col sm:flex-row items-start gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex flex-wrap items-center gap-2 mb-1">
 <span className="text-base">{c.challengeType === 'circuit' ? '' : ''}</span>
 <h3 className="text-sm font-bold text-gray-900 break-words min-w-0">{c.title}</h3>
 {c.challengeType === 'circuit' && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold">Circuit</span>}
 <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">{''.repeat(c.difficulty || 1)}</span>
 </div>
 {c.creator && (
 <p className="text-xs text-gray-400 mb-1">Défi créé par <span className="font-semibold text-gray-600">{c.creator.name || c.creator.pseudo}</span></p>
 )}
 <p className="text-sm text-gray-600 mb-1">{c.description}</p>
 {c.challengeType === 'circuit' && c.circuitData ? (
 <div className="text-xs text-gray-500 space-y-1 mt-1">
 <p className="font-semibold text-gray-700">{(c.circuitData as any).tours} tour{(c.circuitData as any).tours > 1 ? 's' : ''} — Repos entre tours : {(c.circuitData as any).reposTours}s</p>
 <ul className="list-disc list-inside space-y-0.5">
 {((c.circuitData as any).exercices || []).map((ex: any, i: number) => (
 <li key={i}>{ex.nom} — {ex.reps} reps — repos {ex.repos}s</li>
 ))}
 </ul>
 <p className="text-gray-400">{c._count.completions} participant{c._count.completions !== 1 ? 's' : ''}
 {c.submittedForReview && <span className="ml-2 text-amber-500"> En attente de validation admin</span>}
 </p>
 </div>
 ) : (
 <p className="text-xs text-gray-400">
 Objectif : <span className="font-semibold text-gray-700">{c.target} {c.unit}</span>
 &nbsp;•&nbsp; {c._count.completions} participant{c._count.completions !== 1 ? 's' : ''}
 {c.submittedForReview && <span className="ml-2 text-amber-500"> En attente de validation admin</span>}
 </p>
 )}
 </div>
 <div className="flex flex-col items-end gap-2 shrink-0">
 {c.completed ? (
 <span className="px-3 py-2 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg">✓ Relevé</span>
 ) : (
 <button onClick={() => completeChallenge(c.id)}
 disabled={challengeActionLoading.has(c.id)}
 className="px-4 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition">
 {challengeActionLoading.has(c.id) ? '...' : '✓ Défi relevé !'}
 </button>
 )}
 {/* Submit for admin review (own challenges only) */}
 {!c.submittedForReview && c.creator && (
 <button onClick={() => submitChallenge(c.id)}
 className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg transition">
 Soumettre au public
 </button>
 )}
 </div>
 </div>
 {challengeNotif[c.id] && (
 <p className="mt-3 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">{challengeNotif[c.id]}</p>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {!challengeLoading && challenges.length === 0 && (
 <p className="text-sm text-gray-400 text-center py-8">Aucun défi disponible pour le moment.</p>
 )}
 </div>
 )}

 </div>
 </main>
 </>
 );
}
