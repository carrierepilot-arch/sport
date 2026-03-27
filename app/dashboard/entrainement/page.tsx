'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───
type Objectif = 'Force' | 'Cardio' | 'Endurance' | 'Hypertrophie';
type UserLevel = 'debutant' | 'intermediaire' | 'elite';
type TempsSeance = '30min' | '1h' | '1h30' | '2h' | '';
type DureeProgramme = '1_semaine' | '2_semaines' | '1_mois' | '2_mois' | '3_mois' | '';
type Lieu = 'Salle de sport' | 'Maison' | 'Street workout' | '';
type Equipement = 'Ceinture lestee' | 'Gilet leste' | 'Elastiques' | 'Halteres' | 'Barre de traction' | 'Parallettes' | 'Anneaux' | 'Autre';
interface EquipementConfig { maxKg: number; progression: string; detail?: string }

type Figure = 'Front lever' | 'Back lever' | 'Handstand' | 'Drapeau' | 'Planche' | 'Muscle up statique';
type Muscle = 'Pectoraux' | 'Dos' | 'Epaules' | 'Biceps' | 'Triceps' | 'Abdominaux' | 'Jambes';

const FIGURES: Figure[] = ['Front lever', 'Back lever', 'Handstand', 'Drapeau', 'Planche', 'Muscle up statique'];

const NIVEAUX: Record<Figure, string[]> = {
  'Front lever': ['Tuck front lever', 'Advanced tuck', 'Straddle', 'Front lever partiel', 'Front lever tenu 10s+'],
  'Back lever': ['Tuck back lever', 'Advanced tuck', 'Straddle', 'Back lever partiel', 'Back lever tenu 10s+'],
  'Handstand': ['Contre le mur', 'Decolle du mur 5s', 'Tenu libre 10s', 'Tenu libre 30s', 'Handstand maitrise'],
  'Drapeau': ['Tuck drapeau', 'Genoux plies', 'Straddle', 'Drapeau partiel', 'Drapeau tenu 10s+'],
  'Planche': ['Lean planche', 'Tuck planche', 'Advanced tuck', 'Straddle', 'Full planche'],
  'Muscle up statique': ['Traction haute', 'Transition basse', 'Transition mi-hauteur', 'Muscle up assiste', 'Muscle up strict'],
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

const TESTS_FORCE: TestExercice[] = [
  { nom: 'Pompes lestees max', duree: 60 },
  { nom: 'Tractions lestees max', duree: 60 },
  { nom: 'Dips lestes max', duree: 60 },
  { nom: 'Squat a une jambe', duree: 60 },
];

const TESTS_STATIQUE: TestExercice[] = [
  { nom: 'Front lever - maintien max', duree: 30 },
  { nom: 'Back lever - maintien max', duree: 30 },
  { nom: 'Handstand - maintien max', duree: 60 },
  { nom: 'Drapeau - maintien max', duree: 30 },
];

// ─── Components ───
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-8">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mb-6">{subtitle}</p>}
      {!subtitle && <div className="mb-5" />}
      {children}
    </section>
  );
}

// ─── Beep on timer end ───
function playBeep() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
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
function TestNiveau() {
  const [testType, setTestType] = useState<TestType>('');
  const [testStarted, setTestStarted] = useState(false);
  const [currentExo, setCurrentExo] = useState(0);
  const [phase, setPhase] = useState<'exercice' | 'saisie' | 'repos' | 'termine'>('exercice');
  const [reposDuree, setReposDuree] = useState(240);
  const [reps, setReps] = useState<number[]>([]);
  const [currentReps, setCurrentReps] = useState('');
  const [evaluation, setEvaluation] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const exercises = testType === 'endurance' ? TESTS_ENDURANCE : testType === 'force' ? TESTS_FORCE : TESTS_STATIQUE;

  const startTest = (type: TestType) => {
    setTestType(type);
    setTestStarted(true);
    setCurrentExo(0);
    setPhase('exercice');
    setReps([]);
    setCurrentReps('');
    setReposDuree(240);
    setEvaluation(null);
  };

  const onExerciceComplete = useCallback(() => {
    setPhase('saisie');
  }, []);

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
      // Appel API evaluation
      const nomExercices = exercises.map((e) => e.nom);
      setEvaluating(true);
      fetch('/api/evaluer-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType, exercices: nomExercices, resultats: newReps }),
      })
        .then((r) => r.json())
        .then((d) => setEvaluation(d.evaluation || d.error || null))
        .catch(() => setEvaluation('Erreur de connexion.'))
        .finally(() => setEvaluating(false));
    }
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
  };

  if (!testStarted) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { type: 'endurance' as TestType, label: 'Test Endurance', desc: '4 exercices, 1 min chacun' },
          { type: 'force' as TestType, label: 'Test Force', desc: '4 exercices lestes' },
          { type: 'statique' as TestType, label: 'Test Statique', desc: '4 figures, maintien max' },
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
    );
  }

  if (phase === 'termine') {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Resultats du test</h3>
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

function SessionPlayer({ jour, onFinish, onClose }: {
  jour: ProgrammeJour;
  onFinish: (results: ExerciceResult[]) => void;
  onClose: () => void;
}) {
  const [exoIdx,      setExoIdx]      = useState(0);
  const [setIdx,      setSetIdx]      = useState(0);
  const [phase,       setPhase]       = useState<'exercise' | 'fail_input' | 'rest' | 'done'>('exercise');
  const [failReps,    setFailReps]    = useState('');
  const [results,     setResults]     = useState<ExerciceResult[]>(() =>
    jour.exercices.map((e) => ({ nom: e.nom, series: e.series, targetReps: e.reps, repos: e.repos, sets: [] }))
  );

  const exo  = jour.exercices[exoIdx];
  const res  = results[exoIdx];
  const totalSets = exo?.series ?? 1;

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
    const totalSetsAll   = results.reduce((a, r) => a + r.sets.length, 0);
    const totalSuccess   = results.reduce((a, r) => a + r.sets.filter((s) => s.success).length, 0);
    const totalFail      = totalSetsAll - totalSuccess;
    const scorePct       = totalSetsAll > 0 ? Math.round((totalSuccess / totalSetsAll) * 100) : 0;

    return (
      <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col overflow-y-auto">
        <div className="max-w-lg mx-auto w-full px-6 py-10 flex flex-col gap-6">
          <div className="text-center">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-2xl font-bold text-white">Séance terminée !</h2>
            <p className="text-gray-400 mt-1">{jour.jour} — {jour.focus}</p>
          </div>

          {/* Score global */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <p className="text-6xl font-black text-emerald-400">{scorePct}%</p>
            <p className="text-gray-400 text-sm mt-1">de réussite</p>
            <div className="w-full bg-white/10 rounded-full h-2 mt-4">
              <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${scorePct}%` }} />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Séries réussies', value: totalSuccess, color: 'text-emerald-400' },
              { label: 'Séries ratées', value: totalFail, color: 'text-red-400' },
              { label: 'Total séries', value: totalSetsAll, color: 'text-white' },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Détail par exercice */}
          <div className="space-y-3">
            {results.map((r) => {
              const ok   = r.sets.filter((s) => s.success).length;
              const fail = r.sets.filter((s) => !s.success);
              return (
                <div key={r.nom} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-white">{r.nom}</p>
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
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition text-lg"
          >
            Terminer
          </button>
        </div>
      </div>
    );
  }

  const progressPct = Math.round(((exoIdx * totalSets + setIdx) / (totExo * totalSets)) * 100);

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">{jour.jour} — {jour.focus}</p>
          <p className="text-sm font-semibold text-white mt-0.5">
            Exercice {exoIdx + 1}/{totExo} · Série {setIdx + 1}/{totalSets}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition text-sm">Quitter</button>
      </div>

      {/* Barre de progression globale */}
      <div className="h-1 bg-white/10">
        <div className="h-1 bg-emerald-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">

        {/* Phase exercice */}
        {phase === 'exercise' && (
          <>
            <div className="text-center">
              <p className="text-xs text-emerald-400 uppercase tracking-widest mb-2">À réaliser</p>
              <h2 className="text-4xl font-black text-white mb-3">{exo.nom}</h2>
              <div className="flex items-center justify-center gap-4">
                <span className="px-4 py-2 bg-white/10 rounded-xl text-white font-bold text-xl">{exo.reps} reps</span>
                <span className="text-gray-500">·</span>
                <span className="px-4 py-2 bg-white/5 rounded-xl text-gray-400 text-sm">Repos {exo.repos}</span>
              </div>
              {exo.conseil && (
                <p className="text-sm text-emerald-400 mt-3 max-w-xs mx-auto">{exo.conseil}</p>
              )}
            </div>

            {/* Dots séries */}
            <div className="flex gap-2 justify-center">
              {Array.from({ length: totalSets }).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${
                  i < setIdx ? 'bg-emerald-500' : i === setIdx ? 'bg-white' : 'bg-white/20'
                }`} />
              ))}
            </div>

            <div className="flex flex-col gap-3 w-full max-w-sm">
              <button
                onClick={() => pushSet(true)}
                className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xl rounded-2xl transition"
              >
                ✓ Réussi
              </button>
              <button
                onClick={() => setPhase('fail_input')}
                className="w-full py-4 border border-white/20 text-gray-400 hover:border-white/40 hover:text-white font-medium rounded-2xl transition"
              >
                Je n&apos;ai pas réussi
              </button>
            </div>
          </>
        )}

        {/* Phase échec — saisie reps */}
        {phase === 'fail_input' && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div>
              <p className="text-4xl mb-3">😤</p>
              <h2 className="text-xl font-bold text-white">{exo.nom}</h2>
              <p className="text-gray-400 mt-1 text-sm">Combien de reps as-tu réussi ?</p>
              <p className="text-xs text-gray-600 mt-0.5">Objectif : {exo.reps} reps</p>
            </div>
            <input
              type="number"
              min={0}
              value={failReps}
              onChange={(e) => setFailReps(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-5 rounded-2xl bg-white/10 border border-white/20 text-white text-3xl font-bold text-center focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <button
              onClick={() => pushSet(false, parseInt(failReps) || 0)}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-white font-bold text-lg rounded-2xl transition"
            >
              Valider et continuer
            </button>
            <button onClick={() => setPhase('exercise')} className="text-sm text-gray-500 hover:text-gray-300">
              ← Retour
            </button>
          </div>
        )}

        {/* Phase repos */}
        {phase === 'rest' && (
          <div className="text-center w-full max-w-sm space-y-6">
            <p className="text-gray-400 text-sm uppercase tracking-widest">Repos</p>
            <Timer seconds={reposSec} onComplete={onRestDone} />
            <p className="text-gray-500 text-sm">
              {exoIdx < totExo - 1 || setIdx < totalSets
                ? `Prochain : ${jour.exercices[setIdx < totalSets ? exoIdx : exoIdx + 1]?.nom ?? '—'}`
                : 'Dernier exercice !'}
            </p>
            <button
              onClick={onRestDone}
              className="px-6 py-3 border border-white/20 text-gray-300 hover:text-white rounded-xl text-sm transition"
            >
              Passer le repos
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

export default function EntrainementPage() {
  // Config state
  const [userLevel, setUserLevel] = useState<UserLevel | ''>('');
  const [userXp, setUserXp] = useState(0);
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
  const [shareWorkoutId, setShareWorkoutId] = useState<string | null>(null);
  const [creationMode, setCreationMode] = useState(false);
  const [entrainementTab, setEntrainementTab] = useState<'config' | 'seances' | 'defis' | 'equipement'>('config');
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
  const [amis, setAmis] = useState<Ami[]>([]);
  const [shareSearch, setShareSearch] = useState('');

  // Saved workouts state
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<SavedWorkout | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [testSkipped, setTestSkipped] = useState(false);

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
        const msg = data.badgeLabel ? `🏅 Badge « ${data.badgeLabel} » obtenu !` : '✓ Défi relevé !';
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

  useEffect(() => { if (entrainementTab === 'defis') loadChallenges(); }, [entrainementTab, loadChallenges]);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectif: objectifs.join(', ') || 'general', frequence, joursSelectes, lieu, equipements, equipConfig, figuresSelectees, niveauxFigures, musclesCibles, tempsSeance, dureeProgramme }),
      });
      clearInterval(progressInterval);
      setGenProgress(95);
      const data = await res.json();
      if (data.programme) {
        setProgramme(data.programme);
        try {
          const raw = data.programme.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(raw) as ProgrammeData;
          // Support multi-week format: flatten semaines into jours for backward compatibility
          if (parsed.semaines?.length && !parsed.jours?.length) {
            parsed.jours = parsed.semaines.flatMap((s) =>
              s.jours.map((j) => ({ ...j, jour: `S${s.semaine} - ${j.jour}` }))
            );
          }
          if (parsed.jours?.length) setProgrammeData(parsed);
        } catch { setProgrammeData(null); }
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
    if (!programme) return;
    setSaveStatus('saving');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/workouts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `${objectifs.join(', ') || 'Programme'} — ${joursSelectes.join(', ') || new Date().toLocaleDateString('fr-FR')}`,
          rawText: programme,
          programme: programmeData ?? { jours: [] },
          config: { objectifs, frequence, joursSelectes, lieu, tempsSeance },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedWorkoutId(data.workout.id);
        setSaveStatus('saved');
        await loadSavedWorkouts();
      } else { setSaveStatus('error'); }
    } catch { setSaveStatus('error'); }
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

  const handleShare = (workoutId?: string) => { setShareOpen(true); setShareTarget(null); setShareSent(false); setShareSearch(''); setShareWorkoutId(workoutId ?? null); };
  const confirmShare = async () => {
    if (!shareTarget) return;
    const token = localStorage.getItem('token');
    try {
      let content: string;
      if (shareWorkoutId) {
        const w = savedWorkouts.find((sw) => sw.id === shareWorkoutId);
        if (w) {
          content = `__WORKOUT_SHARE__${JSON.stringify({ title: w.title, programme: w.programme })}`;
        } else {
          content = `📋 Programme partagé`;
        }
      } else if (programmeData) {
        const title = objectifs.length > 0 ? `Programme ${objectifs.join(' + ')}` : 'Programme partagé';
        content = `__WORKOUT_SHARE__${JSON.stringify({ title, programme: programmeData })}`;
      } else {
        content = `📋 Je partage mon programme d'entraînement avec toi !`;
      }
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiverId: shareTarget, content }),
      });
    } catch { /* silencieux */ }
    setShareSent(true);
    setTimeout(() => { setShareOpen(false); setShareSent(false); }, 2000);
  };
  const handleEdit = () => { setEditMode(true); setEditedProgramme(programme || ''); };
  const handleSaveEdit = () => { setProgramme(editedProgramme); setEditMode(false); };
  const handleCreationIA = () => { setCreationMode(true); setCustomProgramme(''); setIaFeedback(null); };
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
      const res = await fetch(`/api/wger-exercises?${params}`);
      const data = await res.json();
      setExoLibResults(data.exercises ?? []);
    } catch { setExoLibResults([]); } finally { setExoLibLoading(false); }
  };

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
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Entrainement</h1>
        <p className="text-sm text-gray-500 mt-1">Configurez votre programme et suivez vos performances.</p>
        {/* XP display */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
            <span className="text-sm">⚡</span>
            <span className="text-sm font-bold text-amber-700">{userXp} XP</span>
          </div>
          <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[200px]">
            <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (userXp % 500) / 5)}%` }} />
          </div>
          <span className="text-xs text-gray-400">Palier {Math.floor(userXp / 500) + 1}</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0.5 sm:gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit mb-5 sm:mb-6 overflow-x-auto">
        {([
          { key: 'config' as const, label: 'Générateur' },
          { key: 'equipement' as const, label: '🏋️ Équipement' },
          { key: 'seances' as const, label: `Mes séances${savedWorkouts.length > 0 ? ` (${savedWorkouts.length})` : ''}` },
          { key: 'defis' as const, label: '🏆 Défis' },
        ]).map((t) => (
          <button key={t.key} onClick={() => setEntrainementTab(t.key)}
            className={`flex-shrink-0 px-3 py-2 sm:px-5 rounded-lg text-xs sm:text-sm font-medium transition ${entrainementTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">

        {/* ═══════ TAB: GÉNÉRATEUR / CONFIGURATION ═══════ */}
        {entrainementTab === 'config' && (<>

        {/* ── TEST DE NIVEAU (en haut) ── */}
        {!testSkipped && (
          <section className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🎯</span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Test de niveau</h2>
                <p className="text-sm text-gray-600">Évaluez vos capacités pour générer des séances parfaitement adaptées à votre niveau.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <p className="text-sm text-amber-800 font-medium">Il est recommandé de passer ce test pour des séances personnalisées et optimales.</p>
            </div>
            <TestNiveau />
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
        {testSkipped && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
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

        {/* ── 0. NIVEAU UTILISATEUR ── */}
        {!userLevel && (
          <Section title="Votre niveau" subtitle="Choisissez votre niveau pour adapter l'interface.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { key: 'debutant' as UserLevel,       label: 'Débutant',       desc: 'Interface simplifiée' },
                { key: 'intermediaire' as UserLevel, label: 'Intermédiaire', desc: 'Accès complet' },
                { key: 'elite' as UserLevel,          label: 'Élite',           desc: 'Toutes les options' },
              ]).map((l) => (
                <button
                  key={l.key}
                  onClick={() => saveUserLevel(l.key)}
                  className="py-5 rounded-xl border-2 border-gray-200 text-sm font-semibold transition hover:border-emerald-400 bg-white text-gray-600 text-center"
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
        <Section title="Objectif" subtitle="Sélectionnez vos objectifs.">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['Force', 'Cardio', 'Endurance', 'Hypertrophie'] as Objectif[]).map((o) => (
              <button
                key={o}
                onClick={() => toggleObjectif(o)}
                className={`py-5 rounded-xl border-2 text-sm font-semibold transition ${
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
                ⚠️ Il n&apos;est pas judicieux de sélectionner plus d&apos;un objectif
              </p>
            </div>
          )}
        </Section>

        {/* ── 1b. TEMPS DE SÉANCE ── */}
        <Section title="Temps de séance" subtitle="Durée souhaitée par séance.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Temps par séance */}
            {([
              { key: '30min' as TempsSeance, label: '30 min' },
              { key: '1h' as TempsSeance, label: '1 heure' },
              { key: '1h30' as TempsSeance, label: '1h30' },
              { key: '2h' as TempsSeance, label: '2 heures' },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTempsSeance(t.key)}
                className={`py-4 rounded-xl border-2 text-sm font-semibold transition ${
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
        <Section title="Durée du programme" subtitle="Sur combien de temps souhaitez-vous planifier votre entraînement ?">
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
                className={`py-4 rounded-xl border-2 text-sm font-semibold transition ${
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

        {/* ── 2. RASCUES (figures statiques) — masqué pour débutants ── */}
        {userLevel !== 'debutant' && (
        <Section title="Rascues" subtitle="Selectionnez vos mouvements statiques de street workout.">
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
                className={`py-4 px-4 rounded-xl border-2 text-sm font-semibold transition text-left ${
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
        <Section title="Muscle a developper" subtitle="Selectionnez les muscles que vous souhaitez cibler.">
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
        <Section title="Frequence" subtitle="Definissez votre rythme hebdomadaire.">
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
        <Section title="Lieu d'entrainement" subtitle="Ou t'entraines-tu ?">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['Salle de sport', 'Maison', 'Street workout'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLieu(l)}
                className={`py-5 rounded-xl border-2 text-sm font-semibold transition ${
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

        {/* ── 7. GENERATEUR ── */}
        <Section title="Generateur d'entrainement" subtitle="Generez, modifiez ou creez un programme.">
          <div className="flex gap-3 mb-5 flex-wrap">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition min-w-[200px]"
            >
              {generating ? `Génération… ${genProgress}%` : 'Générer un entraînement'}
            </button>
            <button
              onClick={handleCreationIA}
              className="px-6 py-3 border-2 border-emerald-500 text-emerald-600 text-sm font-semibold rounded-lg hover:bg-emerald-50 transition"
            >
              Créer avec l&apos;IA
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

          {/* Creation mode */}
          {creationMode && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-5 space-y-4">
              <p className="text-sm font-medium text-emerald-800">Créez votre propre entraînement :</p>
              <textarea
                value={customProgramme}
                onChange={(e) => setCustomProgramme(e.target.value)}
                placeholder={"Jour 1 : Pompes 4x10, Tractions 3x8...\nJour 2 : Squats 4x12, Course 20min..."}
                rows={6}
                className="w-full px-4 py-3 rounded-lg border border-emerald-300 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
              />
              <div className="flex gap-3">
                <button onClick={handleAnalyseIA} className="px-5 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-400 transition">
                  Analyser par l&apos;IA
                </button>
                <button onClick={() => { setProgramme(customProgramme); setCreationMode(false); }} className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition">
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
                        <div className={`px-5 py-3 flex items-center justify-between ${done ? 'bg-emerald-500' : 'bg-gray-900'}`}>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            {done && <span>✓</span>}
                            {jour.jour}
                          </h3>
                          <span className="text-xs text-white/70 font-medium">{jour.focus}</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {jour.exercices.map((exo, ei) => (
                            <div key={ei} className="px-5 py-3.5 flex items-start gap-4">
                              <span className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                {ei + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900">{exo.nom}</p>
                                <div className="flex gap-3 mt-1">
                                  <span className="text-xs text-gray-500">{exo.series} séries</span>
                                  <span className="text-xs text-gray-400">×</span>
                                  <span className="text-xs text-gray-500">{exo.reps} reps</span>
                                  <span className="text-xs text-gray-400">|</span>
                                  <span className="text-xs text-gray-500">Repos {exo.repos}</span>
                                </div>
                                {exo.conseil && <p className="text-xs text-emerald-600 mt-1">{exo.conseil}</p>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Boutons Démarrer + Valider */}
                        {!done && (
                          <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                            {wid && (
                              <button
                                onClick={() => handleStartSession(jour, wid)}
                                className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition"
                              >
                                ▶ Démarrer la séance
                              </button>
                            )}
                            {wid && (
                              <button
                                onClick={() => handleValidateSession(wid, jour.jour)}
                                className="flex-1 py-2.5 border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 text-sm font-semibold rounded-lg transition"
                              >
                                ✓ Valider la séance
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
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{programme}</pre>
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
                  <p className="text-xs text-gray-400 mt-0.5">Sélectionnez un ami ou recherchez un utilisateur</p>
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
                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                  <button onClick={() => setShareOpen(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition">Annuler</button>
                  <button
                    onClick={confirmShare}
                    disabled={!shareTarget || shareSent}
                    className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition ${shareSent ? 'bg-emerald-500 text-white' : shareTarget ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    {shareSent ? 'Envoyé !' : 'Envoyer'}
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
              <table className="w-full text-sm border-separate border-spacing-y-1">
                <tbody>
                  {[
                    ['Objectif', objectifs.length ? objectifs.join(', ') : '--'],
                    ['Temps', tempsSeance || '--'],
                    ['Durée programme', dureeProgramme ? dureeProgramme.replace('_', ' ') : '--'],
                    ['Figures', figuresSelectees.length ? figuresSelectees.map((f) => `${f} (${niveauxFigures[f] || '?'})`).join(', ') : '--'],
                    ['Muscles', musclesCibles.length ? musclesCibles.join(', ') : '--'],
                    ['Fréquence', `${frequence}x / semaine`],
                    ['Jours', joursSelectes.length ? joursSelectes.join(', ') : '--'],
                    ['Lieu', lieu || '--'],
                    ['Équipement', equipements.length ? equipements.join(', ') : '--'],
                  ].map(([l, v]) => (
                    <tr key={l}>
                      <td className="text-gray-400 pr-6 w-28 py-0.5">{l}</td>
                      <td className="text-gray-900 font-medium py-0.5">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        </>)} {/* ── end tab génération ── */}

        {/* ═══════ TAB: MES SÉANCES ═══════ */}
        {entrainementTab === 'seances' && (<>

        {/* ── SÉANCES SAUVEGARDÉES ── */}
        {savedWorkouts.length > 0 && (
          <Section title="Mes séances sauvegardées" subtitle="Vos programmes enregistrés et leur progression.">
            <div className="space-y-4">
              {savedWorkouts.map((w) => {
                const total = w.programme?.jours?.length ?? 0;
                const done  = w.sessions.filter((s) => s.status === 'done').length;
                const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={w.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div
                      className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
                      onClick={() => setActiveWorkout(activeWorkout?.id === w.id ? null : w)}
                    >
                      <div>
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
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{w.title}</p>
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenamingId(w.id); setRenameValue(w.title); }}
                              className="text-gray-300 hover:text-gray-500 transition"
                              title="Renommer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(w.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {w.sharedBy && <span className="ml-2">· Partagé par <span className="font-semibold text-gray-500">{w.sharedBy}</span></span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleShare(w.id); }}
                          className="text-xs text-gray-400 hover:text-emerald-500 transition font-medium"
                        >
                          Partager
                        </button>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">{done}/{total} séances</p>
                          <div className="w-20 bg-gray-200 rounded-full h-1.5 mt-1">
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
                          return (
                            <div key={ji} className={`px-5 py-3.5 flex items-center justify-between ${dayDone ? 'bg-emerald-50' : ''}`}>
                              <div>
                                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                  {dayDone && <span className="text-emerald-500">✓</span>}
                                  {jour.jour}
                                </p>
                                <p className="text-xs text-gray-400">{jour.focus} · {jour.exercices.length} exercices</p>
                              </div>
                              {!dayDone ? (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleStartSession(jour, w.id)}
                                    className="px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition"
                                  >
                                    ▶ Démarrer
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
                <h4 className="font-bold text-gray-900 capitalize text-base">{exoDetail.name}</h4>
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
              {exoDetail.description && (
                <p className="text-xs text-gray-600 leading-relaxed"
                   dangerouslySetInnerHTML={{ __html: exoDetail.description.replace(/<[^>]+>/g, '').slice(0, 300) + (exoDetail.description.length > 300 ? '...' : '') }}
                />
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
                  <p className="text-sm font-semibold text-gray-900 capitalize leading-snug mb-1">{ex.name}</p>
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

        {/* ═══════ TAB: ÉQUIPEMENT ═══════ */}
        {entrainementTab === 'equipement' && (
          <section className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">🏋️</span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Équipement disponible</h2>
                <p className="text-sm text-gray-500">Sélectionnez votre matériel pour des séances adaptées. Sauvegardé automatiquement.</p>
              </div>
            </div>
            <div className="space-y-3">
              {(['Ceinture lestee', 'Gilet leste', 'Elastiques', 'Halteres', 'Barre de traction', 'Parallettes', 'Anneaux', 'Autre'] as Equipement[]).map((eq) => {
                const needsKg = ['Ceinture lestee', 'Gilet leste', 'Halteres'].includes(eq);
                const needsDetail = ['Elastiques', 'Autre'].includes(eq);
                const icon = eq === 'Ceinture lestee' ? '🏋️' : eq === 'Gilet leste' ? '🦺' : eq === 'Elastiques' ? '🔗' : eq === 'Halteres' ? '💪' : eq === 'Barre de traction' ? '🔩' : eq === 'Parallettes' ? '🤸' : eq === 'Anneaux' ? '⭕' : '📦';
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
        {entrainementTab === 'defis' && (
          <div className="space-y-4">
            {/* Header + create button */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">🏆 Défis sportifs</h2>
                <p className="text-sm text-gray-500">Défis de la semaine + vos défis personnels partagés avec vos amis.</p>
              </div>
              <button
                onClick={() => setShowCreateChallenge((v) => !v)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-xl transition shrink-0"
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
                  <div className="flex gap-2">
                    {([{ key: 'friends' as const, label: '👥 Amis', desc: 'Vos amis' }, { key: 'private' as const, label: '🔒 Privé', desc: 'Vous seul' }, { key: 'public' as const, label: '🌍 Public', desc: 'Tout le monde' }]).map((v) => (
                      <button key={v.key} onClick={() => setNewChallVisibility(v.key)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border-2 ${newChallVisibility === v.key ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
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
                    🔁 Défi circuit
                  </button>
                </div>

                {/* Difficulty selector */}
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Difficulté</p>
                  <div className="flex gap-2">
                    {([1, 2, 3] as const).map((d) => (
                      <button key={d} onClick={() => setNewChallDifficulty(d)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border-2 ${newChallDifficulty === d ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                        {'⭐'.repeat(d)} {d === 1 ? 'Facile' : d === 2 ? 'Moyen' : 'Difficile'} ({d === 1 ? '25' : d === 2 ? '50' : '100'} XP)
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
                  <div className="flex gap-2">
                    <input
                      type="text" placeholder="Exercice (ex: tractions)" value={newChallExercise} onChange={(e) => setNewChallExercise(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                    />
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
                )}

                {newChallType === 'circuit' && (
                  <div className="space-y-3 bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Exercices du circuit</p>
                    {circuitExercises.map((ex, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text" placeholder={`Exercice ${i + 1}`} value={ex.nom}
                          onChange={(e) => {
                            const updated = [...circuitExercises];
                            updated[i] = { ...updated[i], nom: e.target.value };
                            setCircuitExercises(updated);
                          }}
                          className="flex-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                        />
                        <input
                          type="number" min={1} value={ex.reps}
                          onChange={(e) => {
                            const updated = [...circuitExercises];
                            updated[i] = { ...updated[i], reps: parseInt(e.target.value) || 1 };
                            setCircuitExercises(updated);
                          }}
                          className="w-20 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-center"
                        />
                        <span className="text-xs text-gray-400">reps</span>
                        {circuitExercises.length > 1 && (
                          <button onClick={() => setCircuitExercises(circuitExercises.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-600 text-sm">✕</button>
                        )}
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
                    <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base">🏅</span>
                            <h3 className="text-sm font-bold text-gray-900">{c.title}</h3>
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">{'⭐'.repeat(c.difficulty || 1)}</span>
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
                    <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base">{c.challengeType === 'circuit' ? '🔁' : '🎯'}</span>
                            <h3 className="text-sm font-bold text-gray-900">{c.title}</h3>
                            {c.challengeType === 'circuit' && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold">Circuit</span>}
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">{'⭐'.repeat(c.difficulty || 1)}</span>
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
                                {c.submittedForReview && <span className="ml-2 text-amber-500">⏳ En attente de validation admin</span>}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">
                              Objectif : <span className="font-semibold text-gray-700">{c.target} {c.unit}</span>
                              &nbsp;•&nbsp; {c._count.completions} participant{c._count.completions !== 1 ? 's' : ''}
                              {c.submittedForReview && <span className="ml-2 text-amber-500">⏳ En attente de validation admin</span>}
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
                              🌍 Soumettre au public
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
