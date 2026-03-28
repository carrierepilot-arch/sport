'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/* ═══════════════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════════════ */
const ALL_EXERCISES = [
  { nom: 'Pompes', type: 'push', emoji: '💪', muscles: 'Pectoraux · Triceps' },
  { nom: 'Pompes larges', type: 'push', emoji: '💪', muscles: 'Pectoraux' },
  { nom: 'Pompes diamant', type: 'push', emoji: '💪', muscles: 'Triceps' },
  { nom: 'Tractions', type: 'pull', emoji: '🏋️', muscles: 'Dos · Biceps' },
  { nom: 'Tractions serrées', type: 'pull', emoji: '🏋️', muscles: 'Biceps' },
  { nom: 'Dips', type: 'dip', emoji: '🤸', muscles: 'Triceps · Épaules' },
  { nom: 'Squats', type: 'squat', emoji: '🦵', muscles: 'Quadriceps · Fessiers' },
  { nom: 'Fentes avant', type: 'squat', emoji: '🦵', muscles: 'Quadriceps · Fessiers' },
  { nom: 'Burpees', type: 'push', emoji: '🔥', muscles: 'Full body' },
  { nom: 'Gainage', type: 'core', emoji: '⚡', muscles: 'Abdos · Core' },
  { nom: 'Mountain Climbers', type: 'core', emoji: '⚡', muscles: 'Abdos · Cardio' },
  { nom: 'Crunchs', type: 'core', emoji: '⚡', muscles: 'Abdominaux' },
  { nom: 'Leg Raises', type: 'core', emoji: '⚡', muscles: 'Abdos bas' },
  { nom: 'Pompes decline', type: 'push', emoji: '💪', muscles: 'Épaules · Pectoraux' },
  { nom: 'Hip Thrust', type: 'squat', emoji: '🦵', muscles: 'Fessiers' },
  { nom: 'Pistol Squat', type: 'squat', emoji: '🦵', muscles: 'Quadriceps' },
];

const REP_OPTIONS = [5, 8, 10, 12, 15, 20, 25, 30];
const ROULETTE_COLORS = ['#f97316', '#3b82f6', '#a855f7', '#10b981', '#f43f5e', '#eab308', '#06b6d4', '#8b5cf6'];
const TC: Record<string, { bg: string; text: string; border: string }> = {
  push: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  pull: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  dip: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  squat: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  core: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
};

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function authHeader(): HeadersInit {
  const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

/* ═══════════════════════════════════════════════════
   SYSTÈME MULTIJOUEUR LOCAL
══════════════════════════════════════════════════ */
const PLAYER_COLORS = ['#f97316','#3b82f6','#a855f7','#10b981','#f43f5e','#eab308','#06b6d4','#ec4899'];

interface Player { name: string; color: string }
interface MultiState {
  players: Player[];
  mode: 'random' | 'turns';
  currentIdx: number;
  scores: Record<string, number>;
}

function MultiplayerSetup({ onStart }: { onStart: (players: Player[], mode: 'random' | 'turns') => void }) {
  const [players, setPlayers] = useState<Player[]>([
    { name: '', color: PLAYER_COLORS[0] },
    { name: '', color: PLAYER_COLORS[1] },
  ]);
  const [mode, setMode] = useState<'random' | 'turns'>('turns');

  const addPlayer = () => {
    if (players.length >= 8) return;
    setPlayers(p => [...p, { name: '', color: PLAYER_COLORS[p.length % PLAYER_COLORS.length] }]);
  };
  const removePlayer = (idx: number) => {
    if (players.length <= 2) return;
    setPlayers(p => p.filter((_, i) => i !== idx));
  };
  const setName = (idx: number, name: string) => {
    setPlayers(p => p.map((pl, i) => i === idx ? { ...pl, name } : pl));
  };
  const canStart = players.filter(p => p.name.trim()).length >= 2;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-black text-gray-900">Joueurs</h2>
        <p className="text-sm text-gray-500 mt-1">Ajoute les participants pour jouer ensemble</p>
      </div>
      <div className="space-y-2">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: p.color }}>
              {p.name.trim() ? p.name[0].toUpperCase() : (i + 1)}
            </div>
            <input
              value={p.name}
              onChange={e => setName(i, e.target.value)}
              placeholder={`Joueur ${i + 1}`}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
              maxLength={20}
            />
            {players.length > 2 && (
              <button onClick={() => removePlayer(i)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        ))}
      </div>
      {players.length < 8 && (
        <button onClick={addPlayer} className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-700 transition">
          + Ajouter un joueur
        </button>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">Mode de jeu</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setMode('turns')} className={`py-2.5 rounded-xl border-2 text-sm font-bold transition ${mode === 'turns' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            Tour par tour
          </button>
          <button onClick={() => setMode('random')} className={`py-2.5 rounded-xl border-2 text-sm font-bold transition ${mode === 'random' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            Aleatoire
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">{mode === 'turns' ? 'Chaque joueur passe a tour de role' : 'Un joueur est choisi au hasard a chaque tour'}</p>
      </div>
      <button
        onClick={() => onStart(players.filter(p => p.name.trim()), mode)}
        disabled={!canStart}
        className="w-full py-4 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 text-white font-black text-lg rounded-2xl transition shadow-lg"
      >
        Lancer la partie
      </button>
    </div>
  );
}

function PlayerBadge({ player, active }: { player: Player; active?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${active ? 'ring-2 ring-offset-1 ring-gray-900 shadow-sm' : ''}`} style={{ background: player.color + '20', color: player.color }}>
      <span className="w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center font-black" style={{ background: player.color }}>{player.name[0].toUpperCase()}</span>
      {player.name}
    </span>
  );
}

function MultiScoreboard({ players, scores, currentIdx }: { players: Player[]; scores: Record<string, number>; currentIdx?: number }) {
  const sorted = [...players].sort((a, b) => (scores[b.name] ?? 0) - (scores[a.name] ?? 0));
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Scores</p>
      <div className="space-y-1.5">
        {sorted.map((p, i) => (
          <div key={p.name} className={`flex items-center gap-2 p-1.5 rounded-lg ${currentIdx !== undefined && players[currentIdx]?.name === p.name ? 'bg-gray-100' : ''}`}>
            <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
            <span className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center font-black flex-shrink-0" style={{ background: p.color }}>{p.name[0].toUpperCase()}</span>
            <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{p.name}</span>
            <span className="text-sm font-black text-gray-900">{scores[p.name] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function useMultiplayer() {
  const [multi, setMulti] = useState<MultiState | null>(null);
  const start = useCallback((players: Player[], mode: 'random' | 'turns') => {
    const scores: Record<string, number> = {};
    players.forEach(p => { scores[p.name] = 0; });
    setMulti({ players, mode, currentIdx: 0, scores });
  }, []);
  const nextTurn = useCallback(() => {
    setMulti(prev => {
      if (!prev) return prev;
      if (prev.mode === 'random') {
        return { ...prev, currentIdx: Math.floor(Math.random() * prev.players.length) };
      }
      return { ...prev, currentIdx: (prev.currentIdx + 1) % prev.players.length };
    });
  }, []);
  const addScore = useCallback((name: string, pts: number) => {
    setMulti(prev => {
      if (!prev) return prev;
      return { ...prev, scores: { ...prev.scores, [name]: (prev.scores[name] ?? 0) + pts } };
    });
  }, []);
  const reset = useCallback(() => setMulti(null), []);
  const currentPlayer = multi ? multi.players[multi.currentIdx] : null;
  return { multi, start, nextTurn, addScore, reset, currentPlayer };
}

/* ═══════════════════════════════════════════════════
   OFFLINE 1 — ROULETTE
══════════════════════════════════════════════════ */
const REP_BY_DIFFICULTY: Record<string, number[]> = {
  facile: [3, 5, 6, 8],
  normal: [8, 10, 12, 15],
  difficile: [15, 20, 25, 30],
};

function RouletteCore({ onDone, difficulty = 'normal' }: { onDone?: (exo: typeof ALL_EXERCISES[0], reps: number) => void; difficulty?: string }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ exo: typeof ALL_EXERCISES[0]; reps: number } | null>(null);
  const [history, setHistory] = useState<{ exo: typeof ALL_EXERCISES[0]; reps: number; done: boolean }[]>([]);
  const [angle, setAngle] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const repOptions = REP_BY_DIFFICULTY[difficulty] || REP_OPTIONS;
  const segments = useMemo(() => ALL_EXERCISES.slice(0, 8), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width, cx = size / 2, cy = size / 2, r = size / 2 - 4;
    const segAngle = (2 * Math.PI) / segments.length;
    ctx.clearRect(0, 0, size, size);
    segments.forEach((seg, i) => {
      const s = i * segAngle + (angle * Math.PI) / 180, e = s + segAngle;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, s, e); ctx.closePath();
      ctx.fillStyle = ROULETTE_COLORS[i % ROULETTE_COLORS.length]; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(s + segAngle / 2);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui';
      ctx.fillText(seg.nom.length > 9 ? seg.nom.slice(0, 9) + '…' : seg.nom, r - 8, 4);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, 2 * Math.PI); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#111827'; ctx.fillText('▶', cx + 1, cy + 5);
  }, [angle, segments]);

  useEffect(() => () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const spin = () => {
    if (spinning) return;
    setSpinning(true); setResult(null);
    const totalSpin = 1440 + Math.random() * 1440, duration = 3200, start = performance.now(), startAngle = angle;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const newAngle = startAngle + totalSpin * easeOut(t);
      setAngle(newAngle);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
      else {
        const normalized = (360 - (newAngle % 360) + 270) % 360;
        const idx = Math.floor(normalized / (360 / segments.length)) % segments.length;
        setResult({ exo: segments[idx], reps: rand(repOptions) });
        setSpinning(false);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(animate);
  };

  const handleDone = () => {
    if (!result) return;
    setHistory(h => [{ ...result, done: true }, ...h.slice(0, 9)]);
    if (onDone) onDone(result.exo, result.reps);
    setResult(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <canvas ref={canvasRef} width={220} height={220} className="rounded-full shadow-xl" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5">
            <div style={{ width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '20px solid #111827' }} />
          </div>
        </div>
        <button onClick={spin} disabled={spinning} className="px-10 py-3.5 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white font-black text-lg rounded-2xl transition shadow-lg">
          {spinning ? '⟳ En cours...' : 'LANCER !'}
        </button>
      </div>
      {result && !spinning && (
        <div className={`rounded-2xl border-2 ${TC[result.exo.type]?.border ?? 'border-gray-200'} ${TC[result.exo.type]?.bg ?? 'bg-gray-50'} p-5 text-center`}>
          <p className="text-4xl mb-2">{result.exo.emoji}</p>
          <h3 className="text-2xl font-black text-gray-900">{result.exo.nom}</h3>
          <p className="text-gray-500 text-sm mt-1">{result.exo.muscles}</p>
          <div className="mt-3 inline-flex items-center gap-2 bg-white rounded-xl px-5 py-2 shadow-sm">
            <span className="text-3xl font-black text-gray-900">{result.reps}</span>
            <span className="text-sm text-gray-500 font-medium">repetitions</span>
          </div>
          <div className="flex gap-3 mt-4 justify-center">
            <button onClick={handleDone} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition">Fait !</button>
            <button onClick={() => setResult(null)} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 font-medium rounded-xl transition hover:bg-gray-50">Relancer</button>
          </div>
        </div>
      )}
      {history.length > 0 && (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Historique</p>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2"><span className="text-sm">{h.exo.emoji}</span><span className="text-sm font-medium text-gray-700">{h.exo.nom}</span><span className="text-sm text-gray-400">— {h.reps} reps</span><span className="ml-auto text-xs text-emerald-600 font-semibold">done</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Roulette() {
  const { multi, start, nextTurn, addScore, reset, currentPlayer } = useMultiplayer();
  const [gameMode, setGameMode] = useState<'solo' | 'multi'>('solo');
  const [difficulty, setDifficulty] = useState<'facile' | 'normal' | 'difficile'>('normal');

  const DifficultyPicker = () => (
    <div className="flex gap-1.5 justify-center mb-4">
      {(['facile', 'normal', 'difficile'] as const).map((d) => (
        <button key={d} onClick={() => setDifficulty(d)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${difficulty === d ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          {d === 'facile' ? 'Facile' : d === 'normal' ? 'Normal' : 'Difficile'}
        </button>
      ))}
    </div>
  );

  if (gameMode === 'multi' && !multi) return (
    <div>
      <button onClick={() => setGameMode('solo')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">&larr; Retour au solo</button>
      <MultiplayerSetup onStart={(p, m) => start(p, m)} />
    </div>
  );

  if (gameMode === 'multi' && multi) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => { reset(); setGameMode('solo'); }} className="text-sm text-gray-500 hover:text-gray-700">&larr; Quitter</button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Tour de :</span>
          {currentPlayer && <PlayerBadge player={currentPlayer} active />}
        </div>
      </div>
      <MultiScoreboard players={multi.players} scores={multi.scores} currentIdx={multi.currentIdx} />
      <DifficultyPicker />
      <RouletteCore difficulty={difficulty} onDone={(_exo, reps) => {
        if (currentPlayer) addScore(currentPlayer.name, reps);
        nextTurn();
      }} />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-center flex-1">
          <h2 className="text-xl font-black text-gray-900">Roulette d&apos;exercices</h2>
          <p className="text-sm text-gray-500 mt-1">Lancez la roulette — le destin decide !</p>
        </div>
        <button onClick={() => setGameMode('multi')} className="px-3 py-1.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 text-white text-xs font-bold transition hover:opacity-90 shadow-sm">
          Multijoueur
        </button>
      </div>
      <DifficultyPicker />
      <RouletteCore difficulty={difficulty} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OFFLINE 2 — DÉFI CHRONO (AMRAP)
══════════════════════════════════════════════════ */
function DefiChronoCore({ playerName, onFinish }: { playerName?: string; onFinish?: (rounds: number) => void }) {
  const [phase, setPhase] = useState<'setup' | 'countdown' | 'running' | 'done'>('setup');
  const [duration, setDuration] = useState(60);
  const [circuit, setCircuit] = useState<{ exo: typeof ALL_EXERCISES[0]; reps: number }[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [currentExoIdx, setCurrentExoIdx] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateCircuit = useCallback(() => {
    return shuffle(ALL_EXERCISES).slice(0, 4).map(exo => ({ exo, reps: [8, 10, 12][Math.floor(Math.random() * 3)] }));
  }, []);

  const start = () => { setCircuit(generateCircuit()); setCurrentExoIdx(0); setRounds(0); setCountdown(3); setPhase('countdown'); };

  useEffect(() => {
    if (phase === 'countdown') {
      if (countdown <= 0) {
        const t = setTimeout(() => { setPhase('running'); setTimeLeft(duration); }, 0);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [phase, countdown, duration]);

  useEffect(() => {
    if (phase === 'running') {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => { if (t <= 1) { clearInterval(intervalRef.current!); setPhase('done'); return 0; } return t - 1; });
      }, 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'done' && onFinish) {
      const t = setTimeout(() => onFinish(rounds), 100);
      return () => clearTimeout(t);
    }
  }, [phase, rounds, onFinish]);

  const nextExo = () => {
    if (currentExoIdx < circuit.length - 1) setCurrentExoIdx(i => i + 1);
    else { setCurrentExoIdx(0); setRounds(r => r + 1); }
  };

  if (phase === 'setup') return (
    <div className="space-y-5">
      {playerName && <div className="text-center"><span className="inline-block bg-gray-900 text-white text-sm font-bold px-4 py-1.5 rounded-full">Tour de {playerName}</span></div>}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Duree du defi</p>
        <div className="grid grid-cols-3 gap-3">
          {[60, 120, 180, 300, 420, 600].map(d => (
            <button key={d} onClick={() => setDuration(d)} className={`py-3 rounded-xl border-2 text-sm font-bold transition ${duration === d ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-200 text-gray-600 hover:border-emerald-300 bg-white'}`}>
              {d < 60 ? `${d}s` : `${d / 60} min`}
            </button>
          ))}
        </div>
      </div>
      <button onClick={start} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-black text-lg rounded-2xl transition shadow-lg">Demarrer le defi</button>
    </div>
  );

  if (phase === 'countdown') return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      {playerName && <p className="text-sm font-bold text-gray-700">{playerName} — pret ?</p>}
      <div className="text-9xl font-black text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{countdown || 'GO!'}</div>
    </div>
  );

  if (phase === 'running' && circuit.length > 0) {
    const cur = circuit[currentExoIdx];
    const progress = ((duration - timeLeft) / duration) * 100;
    const mins = Math.floor(timeLeft / 60), secs = timeLeft % 60;
    return (
      <div className="space-y-4">
        <div className="bg-gray-900 rounded-2xl p-5 text-white text-center">
          {playerName && <p className="text-xs font-bold text-emerald-400 mb-1">{playerName}</p>}
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Temps restant</p>
          <p className="text-5xl font-black tabular-nums">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</p>
          <div className="mt-3 w-full bg-gray-700 rounded-full h-2"><div className="h-2 rounded-full bg-emerald-400 transition-all duration-1000" style={{ width: `${progress}%` }} /></div>
        </div>
        <div className={`rounded-2xl border-2 ${TC[cur.exo.type]?.border ?? 'border-gray-200'} ${TC[cur.exo.type]?.bg ?? 'bg-gray-50'} p-5 text-center`}>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Tour {rounds + 1} · Exercice {currentExoIdx + 1}/{circuit.length}</p>
          <p className="text-3xl">{cur.exo.emoji}</p>
          <h3 className="text-2xl font-black text-gray-900 mt-1">{cur.exo.nom}</h3>
          <div className="inline-flex items-center gap-1 bg-white rounded-xl px-4 py-1.5 mt-2 shadow-sm"><span className="text-2xl font-black text-gray-900">{cur.reps}</span><span className="text-sm text-gray-500">reps</span></div>
        </div>
        <button onClick={nextExo} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xl rounded-2xl transition shadow-[0_8px_25px_rgba(16,185,129,0.3)]">Suivant</button>
      </div>
    );
  }

  if (phase === 'done') return (
    <div className="space-y-5 text-center">
      <div className="text-6xl">🏆</div>
      <h3 className="text-2xl font-black text-gray-900">{playerName ? `${playerName} — termine !` : 'Defi termine !'}</h3>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 grid grid-cols-2 gap-4">
        <div><p className="text-4xl font-black text-emerald-500">{rounds}</p><p className="text-xs text-gray-500 mt-1">Tours complets</p></div>
        <div><p className="text-4xl font-black text-amber-500">{duration / 60} min</p><p className="text-xs text-gray-500 mt-1">Duree</p></div>
      </div>
      {!onFinish && <button onClick={() => setPhase('setup')} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Relancer</button>}
    </div>
  );
  return null;
}

function DefiChrono() {
  const { multi, start, nextTurn, addScore, reset } = useMultiplayer();
  const [gameMode, setGameMode] = useState<'pick' | 'solo' | 'multi'>('pick');
  const [multiPhase, setMultiPhase] = useState<'playing' | 'results'>('playing');
  const [turnIdx, setTurnIdx] = useState(0);

  if (gameMode === 'pick') return (
    <div className="space-y-5">
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">Defi Chrono</h2><p className="text-sm text-gray-500 mt-1">Maximum de tours en temps imparti (AMRAP)</p></div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setGameMode('solo')} className="py-6 rounded-2xl bg-gray-900 text-white font-black text-base transition hover:bg-gray-700 shadow-lg">Solo</button>
        <button onClick={() => setGameMode('multi')} className="py-6 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white font-black text-base transition hover:opacity-90 shadow-lg">Jouer a plusieurs</button>
      </div>
    </div>
  );

  if (gameMode === 'multi' && !multi) return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <MultiplayerSetup onStart={(p, m) => { start(p, m); setMultiPhase('playing'); setTurnIdx(0); }} />
    </div>
  );

  if (gameMode === 'multi' && multi) {
    if (multiPhase === 'results') return (
      <div className="space-y-5">
        <h2 className="text-xl font-black text-gray-900 text-center">Resultats finaux</h2>
        <MultiScoreboard players={multi.players} scores={multi.scores} />
        <button onClick={() => { reset(); setGameMode('pick'); }} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Nouvelle partie</button>
      </div>
    );

    const player = multi.mode === 'turns' ? multi.players[turnIdx % multi.players.length] : multi.players[multi.currentIdx];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { reset(); setGameMode('pick'); }} className="text-sm text-gray-500 hover:text-gray-700">← Quitter</button>
          <span className="text-xs text-gray-400">{turnIdx + 1} / {multi.players.length}</span>
        </div>
        <MultiScoreboard players={multi.players} scores={multi.scores} currentIdx={multi.players.indexOf(player)} />
        <DefiChronoCore key={turnIdx} playerName={player.name} onFinish={(rounds) => {
          addScore(player.name, rounds);
          if (turnIdx + 1 >= multi.players.length) {
            setMultiPhase('results');
          } else {
            nextTurn();
            setTurnIdx(i => i + 1);
          }
        }} />
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <div className="text-center mb-4"><h2 className="text-xl font-black text-gray-900">Defi Chrono</h2><p className="text-sm text-gray-500 mt-1">Maximum de tours en temps imparti</p></div>
      <DefiChronoCore />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OFFLINE 3 — ESCALADE (PYRAMIDE)
══════════════════════════════════════════════════ */
function EscaladeCore({ playerName, onFinish }: { playerName?: string; onFinish?: (totalReps: number) => void }) {
  const [phase, setPhase] = useState<'setup' | 'running' | 'done'>('setup');
  const [exo, setExo] = useState(ALL_EXERCISES[0]);
  const [maxRound, setMaxRound] = useState(10);
  const [currentRound, setCurrentRound] = useState(1);
  const [repsPerRound, setRepsPerRound] = useState(2);
  const [scores, setScores] = useState<{ round: number; reps: number; done: boolean }[]>([]);
  const [inputReps, setInputReps] = useState('');
  const [inputMode, setInputMode] = useState(false);

  const totalReps = scores.filter(s => s.done).reduce((a, b) => a + b.reps, 0);
  const pyramidReps = (r: number) => r * repsPerRound;

  const start = () => { setExo(rand(ALL_EXERCISES)); setCurrentRound(1); setScores([]); setInputMode(false); setPhase('running'); };

  const markDone = () => {
    const newScores = [...scores, { round: currentRound, reps: pyramidReps(currentRound), done: true }];
    setScores(newScores);
    if (currentRound >= maxRound) {
      setPhase('done');
      const total = newScores.filter(s => s.done).reduce((a, b) => a + b.reps, 0);
      if (onFinish) onFinish(total);
    } else setCurrentRound(r => r + 1);
    setInputMode(false); setInputReps('');
  };

  const markFail = () => {
    const parsed = parseInt(inputReps) || 0;
    const newScores = [...scores, { round: currentRound, reps: parsed, done: false }];
    setScores(newScores);
    setPhase('done'); setInputMode(false);
    const total = newScores.filter(s => s.done).reduce((a, b) => a + b.reps, 0) + parsed;
    if (onFinish) onFinish(total);
  };

  if (phase === 'setup') return (
    <div className="space-y-5">
      {playerName && <div className="text-center"><span className="inline-block bg-gray-900 text-white text-sm font-bold px-4 py-1.5 rounded-full">Tour de {playerName}</span></div>}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div><p className="text-sm font-semibold text-gray-700 mb-2">Reps par palier</p><div className="grid grid-cols-4 gap-2">{[1, 2, 3, 5].map(r => (<button key={r} onClick={() => setRepsPerRound(r)} className={`py-2.5 rounded-xl border-2 text-sm font-bold transition ${repsPerRound === r ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-200 text-gray-600 hover:border-emerald-300'}`}>+{r}</button>))}</div></div>
        <div><p className="text-sm font-semibold text-gray-700 mb-2">Paliers max</p><div className="grid grid-cols-4 gap-2">{[5, 8, 10, 15].map(m => (<button key={m} onClick={() => setMaxRound(m)} className={`py-2.5 rounded-xl border-2 text-sm font-bold transition ${maxRound === m ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-200 text-gray-600 hover:border-emerald-300'}`}>{m}</button>))}</div></div>
      </div>
      <button onClick={start} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-black text-lg rounded-2xl transition">Demarrer</button>
    </div>
  );

  if (phase === 'running') {
    const reps = pyramidReps(currentRound);
    return (
      <div className="space-y-4">
        <div className="text-center">
          {playerName && <p className="text-xs font-bold text-gray-500 mb-1">{playerName}</p>}
          <p className="text-xs text-gray-400 uppercase tracking-widest">Palier {currentRound} / {maxRound}</p>
          <p className="text-3xl mt-1">{exo.emoji}</p>
          <h3 className="text-2xl font-black text-gray-900">{exo.nom}</h3>
          <div className="inline-flex items-center gap-2 bg-gray-900 text-white rounded-2xl px-6 py-2.5 mt-3"><span className="text-4xl font-black">{reps}</span><span className="text-sm font-medium opacity-75">reps</span></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-end gap-1.5 h-16 overflow-x-auto">
            {Array.from({ length: maxRound }, (_, i) => i + 1).map(r => {
              const done = scores.find(s => s.round === r);
              return (<div key={r} className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 24 }}><div style={{ height: Math.max(12, (r / maxRound) * 60), width: '100%', borderRadius: 4, background: done ? (done.done ? '#10b981' : '#f43f5e') : r === currentRound ? '#111827' : '#e5e7eb', transition: 'all 0.3s' }} /><p className="text-[9px] text-gray-400 mt-0.5">{r}</p></div>);
            })}
          </div>
        </div>
        {!inputMode ? (
          <div className="flex gap-3">
            <button onClick={markDone} className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg rounded-2xl transition">Reussi !</button>
            <button onClick={() => setInputMode(true)} className="flex-1 py-4 border border-gray-300 text-gray-600 font-bold rounded-2xl transition hover:bg-gray-50">Trop dur...</button>
          </div>
        ) : (
          <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-amber-800">Combien en as-tu fait ?</p>
            <input type="number" min={0} value={inputReps} onChange={e => setInputReps(e.target.value)} placeholder="0" className="w-full px-4 py-3 rounded-xl border border-amber-300 text-center text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500" autoFocus />
            <div className="flex gap-2"><button onClick={markFail} className="flex-1 py-2.5 bg-amber-500 text-white font-bold rounded-xl">Terminer</button><button onClick={() => { setInputMode(false); setInputReps(''); }} className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl">Annuler</button></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center">
      <div className="text-6xl">{currentRound > maxRound ? '🏔️' : '💪'}</div>
      <h3 className="text-2xl font-black text-gray-900">{playerName ? `${playerName} —` : ''} {currentRound > maxRound ? 'Sommet atteint !' : `Palier ${currentRound}`}</h3>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 grid grid-cols-2 gap-4">
        <div><p className="text-4xl font-black text-emerald-500">{totalReps}</p><p className="text-xs text-gray-500 mt-1">Reps totales</p></div>
        <div><p className="text-4xl font-black text-blue-500">{scores.filter(s => s.done).length}</p><p className="text-xs text-gray-500 mt-1">Paliers reussis</p></div>
      </div>
      {!onFinish && <button onClick={() => setPhase('setup')} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Recommencer</button>}
    </div>
  );
}

function Escalade() {
  const { multi, start, nextTurn, addScore, reset } = useMultiplayer();
  const [gameMode, setGameMode] = useState<'pick' | 'solo' | 'multi'>('pick');
  const [multiPhase, setMultiPhase] = useState<'playing' | 'results'>('playing');
  const [turnIdx, setTurnIdx] = useState(0);

  if (gameMode === 'pick') return (
    <div className="space-y-5">
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">Escalade</h2><p className="text-sm text-gray-500 mt-1">Defi pyramide — ajoutez des reps a chaque tour</p></div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setGameMode('solo')} className="py-6 rounded-2xl bg-gray-900 text-white font-black text-base transition hover:bg-gray-700 shadow-lg">Solo</button>
        <button onClick={() => setGameMode('multi')} className="py-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white font-black text-base transition hover:opacity-90 shadow-lg">Jouer a plusieurs</button>
      </div>
    </div>
  );

  if (gameMode === 'multi' && !multi) return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <MultiplayerSetup onStart={(p, m) => { start(p, m); setMultiPhase('playing'); setTurnIdx(0); }} />
    </div>
  );

  if (gameMode === 'multi' && multi) {
    if (multiPhase === 'results') return (
      <div className="space-y-5">
        <h2 className="text-xl font-black text-gray-900 text-center">Resultats finaux</h2>
        <MultiScoreboard players={multi.players} scores={multi.scores} />
        <button onClick={() => { reset(); setGameMode('pick'); }} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Nouvelle partie</button>
      </div>
    );
    const player = multi.mode === 'turns' ? multi.players[turnIdx % multi.players.length] : multi.players[multi.currentIdx];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { reset(); setGameMode('pick'); }} className="text-sm text-gray-500 hover:text-gray-700">← Quitter</button>
          <span className="text-xs text-gray-400">{turnIdx + 1} / {multi.players.length}</span>
        </div>
        <MultiScoreboard players={multi.players} scores={multi.scores} currentIdx={multi.players.indexOf(player)} />
        <EscaladeCore key={turnIdx} playerName={player.name} onFinish={(total) => {
          addScore(player.name, total);
          if (turnIdx + 1 >= multi.players.length) setMultiPhase('results');
          else { nextTurn(); setTurnIdx(i => i + 1); }
        }} />
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <div className="text-center mb-4"><h2 className="text-xl font-black text-gray-900">Escalade</h2><p className="text-sm text-gray-500 mt-1">Defi pyramide — ajoutez des reps a chaque tour</p></div>
      <EscaladeCore />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OFFLINE 4 — BINGO FITNESS
══════════════════════════════════════════════════ */
interface BingoCell { exo: typeof ALL_EXERCISES[0]; reps: number; done: boolean }
function BingoCore({ playerName, onFinish }: { playerName?: string; onFinish?: (doneCells: number) => void }) {
  const [card, setCard] = useState<BingoCell[]>([]);
  const [phase, setPhase] = useState<'setup' | 'playing' | 'won'>('setup');
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const start = () => { setCard(shuffle(ALL_EXERCISES).slice(0, 9).map(exo => ({ exo, reps: rand(REP_OPTIONS), done: false }))); setPhase('playing'); setLastChecked(null); };

  const check = (idx: number) => {
    if (card[idx].done) return;
    const c = card.map((c, i) => i === idx ? { ...c, done: true } : c);
    setCard(c); setLastChecked(idx);
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    if (lines.some(l => l.every(i => c[i].done))) {
      setTimeout(() => {
        setPhase('won');
        if (onFinish) onFinish(c.filter(x => x.done).length);
      }, 400);
    }
  };

  if (phase === 'setup') return (
    <div className="space-y-5">
      {playerName && <div className="text-center"><span className="inline-block bg-gray-900 text-white text-sm font-bold px-4 py-1.5 rounded-full">{playerName}</span></div>}
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">Bingo Fitness</h2><p className="text-sm text-gray-500 mt-1">Completez une ligne pour gagner !</p></div>
      <button onClick={start} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-black text-lg rounded-2xl transition">Nouvelle grille !</button>
    </div>
  );

  if (phase === 'won') return (
    <div className="space-y-5 text-center">
      <div className="text-6xl">{card.filter(c => c.done).length === 9 ? '🔥' : '🎉'}</div>
      <h3 className="text-2xl font-black text-gray-900">{playerName ? `${playerName} —` : ''} {card.filter(c => c.done).length === 9 ? 'FULL HOUSE !' : 'BINGO !'}</h3>
      {!onFinish && <button onClick={() => setPhase('setup')} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Nouvelle grille</button>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-900">{playerName ? `${playerName} —` : ''} Bingo</h2>
        <span className="text-sm text-gray-500">{card.filter(c => c.done).length}/9</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {card.map((cell, idx) => {
          const color = TC[cell.exo.type] ?? { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
          return (
            <button key={idx} onClick={() => check(idx)} className={`relative rounded-2xl border-2 p-3 text-center transition-all ${cell.done ? 'border-emerald-400 bg-emerald-50 scale-95' : `${color.border} ${color.bg} hover:scale-105`} ${lastChecked === idx ? 'ring-2 ring-emerald-400' : ''}`}>
              {cell.done && <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-emerald-500/20"><span className="text-3xl text-emerald-600 font-black">done</span></div>}
              <p className="text-xl">{cell.exo.emoji}</p>
              <p className={`text-[10px] font-bold mt-0.5 ${cell.done ? 'text-emerald-700' : color.text}`}>{cell.exo.nom}</p>
              <div className={`mt-1 text-xs font-black ${cell.done ? 'text-emerald-600' : 'text-gray-900'}`}>{cell.reps}<span className="font-normal text-[9px] text-gray-400"> reps</span></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BingoFitness() {
  const { multi, start, nextTurn, addScore, reset } = useMultiplayer();
  const [gameMode, setGameMode] = useState<'pick' | 'solo' | 'multi'>('pick');
  const [multiPhase, setMultiPhase] = useState<'playing' | 'results'>('playing');
  const [turnIdx, setTurnIdx] = useState(0);

  if (gameMode === 'pick') return (
    <div className="space-y-5">
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">Bingo Fitness</h2><p className="text-sm text-gray-500 mt-1">Completez une ligne pour gagner !</p></div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setGameMode('solo')} className="py-6 rounded-2xl bg-gray-900 text-white font-black text-base transition hover:bg-gray-700 shadow-lg">Solo</button>
        <button onClick={() => setGameMode('multi')} className="py-6 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-400 text-white font-black text-base transition hover:opacity-90 shadow-lg">Jouer a plusieurs</button>
      </div>
    </div>
  );

  if (gameMode === 'multi' && !multi) return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <MultiplayerSetup onStart={(p, m) => { start(p, m); setMultiPhase('playing'); setTurnIdx(0); }} />
    </div>
  );

  if (gameMode === 'multi' && multi) {
    if (multiPhase === 'results') return (
      <div className="space-y-5">
        <h2 className="text-xl font-black text-gray-900 text-center">Resultats finaux</h2>
        <MultiScoreboard players={multi.players} scores={multi.scores} />
        <button onClick={() => { reset(); setGameMode('pick'); }} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Nouvelle partie</button>
      </div>
    );
    const player = multi.mode === 'turns' ? multi.players[turnIdx % multi.players.length] : multi.players[multi.currentIdx];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { reset(); setGameMode('pick'); }} className="text-sm text-gray-500 hover:text-gray-700">← Quitter</button>
          <span className="text-xs text-gray-400">{turnIdx + 1} / {multi.players.length}</span>
        </div>
        <MultiScoreboard players={multi.players} scores={multi.scores} currentIdx={multi.players.indexOf(player)} />
        <BingoCore key={turnIdx} playerName={player.name} onFinish={(doneCells) => {
          addScore(player.name, doneCells);
          if (turnIdx + 1 >= multi.players.length) setMultiPhase('results');
          else { nextTurn(); setTurnIdx(i => i + 1); }
        }} />
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <BingoCore />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OFFLINE 5 — DÉ FITNESS
══════════════════════════════════════════════════ */
function DeFitnessCore({ onDone }: { onDone?: (reps: number) => void }) {
  const [rolling, setRolling] = useState(false);
  const [diceExo, setDiceExo] = useState(1);
  const [diceReps, setDiceReps] = useState(1);
  const [result, setResult] = useState<{ exo: typeof ALL_EXERCISES[0]; reps: number } | null>(null);
  const [total, setTotal] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const roll = () => {
    if (rolling) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRolling(true); setResult(null);
    let count = 0;
    intervalRef.current = setInterval(() => {
      setDiceExo(Math.ceil(Math.random() * 6));
      setDiceReps(Math.ceil(Math.random() * 6));
      count++;
      if (count > 15) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        const eIdx = Math.floor(Math.random() * 6);
        const rVal = Math.ceil(Math.random() * 6);
        setDiceExo(eIdx + 1);
        setDiceReps(rVal);
        const exo = ALL_EXERCISES[eIdx];
        const reps = rVal * 5;
        setResult({ exo, reps });
        setRolling(false);
      }
    }, 80);
  };

  const done = () => {
    if (result) {
      setTotal(t => t + result.reps);
      if (onDone) onDone(result.reps);
      setResult(null);
    }
  };

  const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <div className={`text-6xl transition-transform ${rolling ? 'animate-bounce' : ''}`}>{DICE_FACES[diceExo - 1]}</div>
          <p className="text-xs text-gray-400">Exercice</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className={`text-6xl transition-transform ${rolling ? 'animate-bounce' : ''}`}>{DICE_FACES[diceReps - 1]}</div>
          <p className="text-xs text-gray-400">Multiplicateur</p>
        </div>
      </div>
      <button onClick={roll} disabled={rolling} className="w-full py-4 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white font-black text-lg rounded-2xl transition shadow-lg">
        {rolling ? 'En cours...' : 'Lancer les des !'}
      </button>
      {result && (
        <div className={`rounded-2xl border-2 ${TC[result.exo.type]?.border ?? 'border-gray-200'} ${TC[result.exo.type]?.bg ?? 'bg-gray-50'} p-5 text-center`}>
          <p className="text-3xl mb-1">{result.exo.emoji}</p>
          <h3 className="text-xl font-black text-gray-900">{result.exo.nom}</h3>
          <div className="mt-2 inline-flex items-center gap-2 bg-white rounded-xl px-5 py-2 shadow-sm">
            <span className="text-3xl font-black text-gray-900">{result.reps}</span><span className="text-sm text-gray-500">reps</span>
          </div>
          <div className="flex gap-3 mt-4 justify-center">
            <button onClick={done} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition">Fait !</button>
            <button onClick={roll} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 font-medium rounded-xl">Relancer</button>
          </div>
        </div>
      )}
      {total > 0 && (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Total reps</p>
          <p className="text-3xl font-black text-gray-900">{total}</p>
        </div>
      )}
    </div>
  );
}

function DeFitness() {
  const { multi, start, nextTurn, addScore, reset, currentPlayer } = useMultiplayer();
  const [gameMode, setGameMode] = useState<'pick' | 'solo' | 'multi'>('pick');

  if (gameMode === 'pick') return (
    <div className="space-y-5">
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">De Fitness</h2><p className="text-sm text-gray-500 mt-1">Lance les des pour savoir quoi faire !</p></div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setGameMode('solo')} className="py-6 rounded-2xl bg-gray-900 text-white font-black text-base transition hover:bg-gray-700 shadow-lg">Solo</button>
        <button onClick={() => setGameMode('multi')} className="py-6 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-400 text-white font-black text-base transition hover:opacity-90 shadow-lg">Jouer a plusieurs</button>
      </div>
    </div>
  );

  if (gameMode === 'multi' && !multi) return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <MultiplayerSetup onStart={(p, m) => start(p, m)} />
    </div>
  );

  if (gameMode === 'multi' && multi) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => { reset(); setGameMode('pick'); }} className="text-sm text-gray-500 hover:text-gray-700">← Quitter</button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Tour de :</span>
          {currentPlayer && <PlayerBadge player={currentPlayer} active />}
        </div>
      </div>
      <MultiScoreboard players={multi.players} scores={multi.scores} currentIdx={multi.currentIdx} />
      <DeFitnessCore onDone={(reps) => {
        if (currentPlayer) addScore(currentPlayer.name, reps);
        nextTurn();
      }} />
    </div>
  );

  return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <div className="text-center mb-4"><h2 className="text-xl font-black text-gray-900">De Fitness</h2><p className="text-sm text-gray-500 mt-1">Lance les des pour savoir quoi faire !</p></div>
      <DeFitnessCore />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OFFLINE 6 — SHUFFLE HIIT
══════════════════════════════════════════════════ */
function ShuffleHIITCore({ playerName, onFinish }: { playerName?: string; onFinish?: (intervals: number) => void }) {
  const [phase, setPhase] = useState<'setup' | 'countdown' | 'work' | 'rest' | 'done'>('setup');
  const [intervals, setIntervals] = useState(8);
  const [workTime, setWorkTime] = useState(30);
  const [restTime, setRestTime] = useState(15);
  const [currentInterval, setCurrentInterval] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [exo, setExo] = useState(ALL_EXERCISES[0]);
  const [countdown, setCountdown] = useState(3);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => { setCountdown(3); setCurrentInterval(0); setExo(rand(ALL_EXERCISES)); setPhase('countdown'); };

  useEffect(() => {
    if (phase === 'countdown') {
      if (countdown <= 0) {
        const t = setTimeout(() => { setPhase('work'); setTimeLeft(workTime); }, 0);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [phase, countdown, workTime]);

  useEffect(() => {
    if (phase !== 'work' && phase !== 'rest') return;
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          if (phase === 'work') {
            if (currentInterval + 1 >= intervals) { setPhase('done'); return 0; }
            setPhase('rest'); return restTime;
          } else {
            setExo(rand(ALL_EXERCISES));
            setCurrentInterval(c => c + 1);
            setPhase('work'); return workTime;
          }
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, currentInterval, intervals, workTime, restTime]);

  useEffect(() => {
    if (phase === 'done' && onFinish) {
      const t = setTimeout(() => onFinish(intervals), 100);
      return () => clearTimeout(t);
    }
  }, [phase, intervals, onFinish]);

  if (phase === 'setup') return (
    <div className="space-y-5">
      {playerName && <div className="text-center"><span className="inline-block bg-gray-900 text-white text-sm font-bold px-4 py-1.5 rounded-full">{playerName}</span></div>}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div><p className="text-sm font-semibold text-gray-700 mb-2">Intervalles</p><div className="grid grid-cols-4 gap-2">{[4, 6, 8, 12].map(n => (<button key={n} onClick={() => setIntervals(n)} className={`py-2.5 rounded-xl border-2 text-sm font-bold transition ${intervals === n ? 'border-rose-500 bg-rose-500 text-white' : 'border-gray-200 text-gray-600'}`}>{n}</button>))}</div></div>
        <div><p className="text-sm font-semibold text-gray-700 mb-2">Travail (sec)</p><div className="grid grid-cols-4 gap-2">{[20, 30, 40, 45].map(n => (<button key={n} onClick={() => setWorkTime(n)} className={`py-2.5 rounded-xl border-2 text-sm font-bold transition ${workTime === n ? 'border-rose-500 bg-rose-500 text-white' : 'border-gray-200 text-gray-600'}`}>{n}s</button>))}</div></div>
        <div><p className="text-sm font-semibold text-gray-700 mb-2">Repos (sec)</p><div className="grid grid-cols-4 gap-2">{[10, 15, 20, 30].map(n => (<button key={n} onClick={() => setRestTime(n)} className={`py-2.5 rounded-xl border-2 text-sm font-bold transition ${restTime === n ? 'border-rose-500 bg-rose-500 text-white' : 'border-gray-200 text-gray-600'}`}>{n}s</button>))}</div></div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-800">
          Duree totale : {Math.ceil((intervals * (workTime + restTime)) / 60)} min
        </div>
      </div>
      <button onClick={start} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-black text-lg rounded-2xl transition">C&apos;est parti !</button>
    </div>
  );

  if (phase === 'countdown') return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      {playerName && <p className="text-sm font-bold text-gray-700">{playerName}</p>}
      <p className="text-gray-500 text-lg uppercase tracking-widest">Pret ?</p>
      <div className="text-9xl font-black text-gray-900">{countdown || 'GO!'}</div>
    </div>
  );

  if (phase === 'work' || phase === 'rest') return (
    <div className="space-y-4">
      {playerName && <p className="text-center text-xs font-bold text-gray-500">{playerName}</p>}
      <div className={`rounded-2xl p-6 text-center ${phase === 'work' ? 'bg-rose-500 text-white' : 'bg-gray-200 text-gray-900'}`}>
        <p className="text-xs uppercase tracking-widest mb-1 opacity-75">{phase === 'work' ? `Travail — ${currentInterval + 1}/${intervals}` : 'Repos'}</p>
        <p className="text-7xl font-black tabular-nums">{timeLeft}</p>
        <p className="text-sm opacity-75 mt-1">secondes</p>
      </div>
      {phase === 'work' && (
        <div className={`rounded-2xl border-2 ${TC[exo.type]?.border ?? 'border-gray-200'} ${TC[exo.type]?.bg ?? 'bg-gray-50'} p-5 text-center`}>
          <p className="text-4xl mb-1">{exo.emoji}</p>
          <h3 className="text-2xl font-black text-gray-900">{exo.nom}</h3>
          <p className="text-sm text-gray-500 mt-1">{exo.muscles}</p>
        </div>
      )}
      {phase === 'rest' && (
        <p className="text-center text-gray-500 text-sm">Prochain exercice : <span className="font-bold">{exo.nom}</span> {exo.emoji}</p>
      )}
      <div className="flex gap-1">
        {Array.from({ length: intervals }, (_, i) => (
          <div key={i} className={`flex-1 h-2 rounded-full ${i < currentInterval ? 'bg-emerald-400' : i === currentInterval ? (phase === 'work' ? 'bg-rose-400' : 'bg-gray-400') : 'bg-gray-200'}`} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 text-center">
      <div className="text-6xl">🔥</div>
      <h3 className="text-2xl font-black text-gray-900">{playerName ? `${playerName} —` : ''} HIIT termine !</h3>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 grid grid-cols-2 gap-4">
        <div><p className="text-4xl font-black text-rose-500">{intervals}</p><p className="text-xs text-gray-500 mt-1">Intervalles</p></div>
        <div><p className="text-4xl font-black text-amber-500">{Math.ceil((intervals * (workTime + restTime)) / 60)}</p><p className="text-xs text-gray-500 mt-1">Minutes</p></div>
      </div>
      {!onFinish && <button onClick={() => setPhase('setup')} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Relancer</button>}
    </div>
  );
}

function ShuffleHIIT() {
  const { multi, start, nextTurn, addScore, reset } = useMultiplayer();
  const [gameMode, setGameMode] = useState<'pick' | 'solo' | 'multi'>('pick');
  const [multiPhase, setMultiPhase] = useState<'playing' | 'results'>('playing');
  const [turnIdx, setTurnIdx] = useState(0);

  if (gameMode === 'pick') return (
    <div className="space-y-5">
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">Shuffle HIIT</h2><p className="text-sm text-gray-500 mt-1">Intervalles aleatoires avec exercices random</p></div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setGameMode('solo')} className="py-6 rounded-2xl bg-gray-900 text-white font-black text-base transition hover:bg-gray-700 shadow-lg">Solo</button>
        <button onClick={() => setGameMode('multi')} className="py-6 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-400 text-white font-black text-base transition hover:opacity-90 shadow-lg">Jouer a plusieurs</button>
      </div>
    </div>
  );

  if (gameMode === 'multi' && !multi) return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <MultiplayerSetup onStart={(p, m) => { start(p, m); setMultiPhase('playing'); setTurnIdx(0); }} />
    </div>
  );

  if (gameMode === 'multi' && multi) {
    if (multiPhase === 'results') return (
      <div className="space-y-5">
        <h2 className="text-xl font-black text-gray-900 text-center">Resultats finaux</h2>
        <MultiScoreboard players={multi.players} scores={multi.scores} />
        <button onClick={() => { reset(); setGameMode('pick'); }} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Nouvelle partie</button>
      </div>
    );
    const player = multi.mode === 'turns' ? multi.players[turnIdx % multi.players.length] : multi.players[multi.currentIdx];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { reset(); setGameMode('pick'); }} className="text-sm text-gray-500 hover:text-gray-700">← Quitter</button>
          <span className="text-xs text-gray-400">{turnIdx + 1} / {multi.players.length}</span>
        </div>
        <MultiScoreboard players={multi.players} scores={multi.scores} currentIdx={multi.players.indexOf(player)} />
        <ShuffleHIITCore key={turnIdx} playerName={player.name} onFinish={(iv) => {
          addScore(player.name, iv);
          if (turnIdx + 1 >= multi.players.length) setMultiPhase('results');
          else { nextTurn(); setTurnIdx(i => i + 1); }
        }} />
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <div className="text-center mb-4"><h2 className="text-xl font-black text-gray-900">Shuffle HIIT</h2><p className="text-sm text-gray-500 mt-1">Intervalles aleatoires avec exercices random</p></div>
      <ShuffleHIITCore />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OFFLINE 7 — MEMORY MUSCU
══════════════════════════════════════════════════ */
interface MemCard { id: number; exo: typeof ALL_EXERCISES[0]; flipped: boolean; matched: boolean }
function MemoryCore({ playerName, onFinish }: { playerName?: string; onFinish?: (moves: number) => void }) {
  const [cards, setCards] = useState<MemCard[]>([]);
  const [phase, setPhase] = useState<'setup' | 'playing' | 'won'>('setup');
  const [flippedIdx, setFlippedIdx] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [pendingExo, setPendingExo] = useState<typeof ALL_EXERCISES[0] | null>(null);

  const start = () => {
    const picks = shuffle(ALL_EXERCISES).slice(0, 6);
    const pairs = shuffle([...picks, ...picks].map((exo, i) => ({ id: i, exo, flipped: false, matched: false })));
    setCards(pairs); setMoves(0); setFlippedIdx([]); setPendingExo(null); setPhase('playing');
  };

  const flip = (idx: number) => {
    if (pendingExo || cards[idx].flipped || cards[idx].matched || flippedIdx.length >= 2) return;
    const newFlipped = [...flippedIdx, idx];
    setFlippedIdx(newFlipped);
    setCards(cs => cs.map((c, i) => i === idx ? { ...c, flipped: true } : c));
    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [a, b] = newFlipped;
      if (cards[a].exo.nom === cards[b].exo.nom) {
        setPendingExo(cards[a].exo);
        setTimeout(() => {
          setCards(cs => {
            const next = cs.map((c, i) => i === a || i === b ? { ...c, matched: true } : c);
            if (next.every(c => c.matched)) {
              setTimeout(() => {
                setPhase('won');
              }, 300);
            }
            return next;
          });
          setFlippedIdx([]);
          setPendingExo(null);
        }, 1500);
      } else {
        setTimeout(() => {
          setCards(cs => cs.map((c, i) => newFlipped.includes(i) ? { ...c, flipped: false } : c));
          setFlippedIdx([]);
        }, 800);
      }
    }
  };

  useEffect(() => {
    if (phase === 'won' && onFinish) {
      const t = setTimeout(() => onFinish(moves), 100);
      return () => clearTimeout(t);
    }
  }, [phase, moves, onFinish]);

  if (phase === 'setup') return (
    <div className="space-y-5">
      {playerName && <div className="text-center"><span className="inline-block bg-gray-900 text-white text-sm font-bold px-4 py-1.5 rounded-full">{playerName}</span></div>}
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">Memory Muscu</h2><p className="text-sm text-gray-500 mt-1">Trouve les paires — fais l&apos;exercice de la paire trouvee !</p></div>
      <button onClick={start} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-black text-lg rounded-2xl transition">Jouer !</button>
    </div>
  );

  if (phase === 'won') return (
    <div className="space-y-5 text-center">
      <div className="text-6xl">🧠</div>
      <h3 className="text-2xl font-black text-gray-900">{playerName ? `${playerName} —` : ''} Bravo !</h3>
      <p className="text-gray-500">Termine en <span className="font-black text-gray-900">{moves}</span> essais</p>
      {!onFinish && <button onClick={() => setPhase('setup')} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Rejouer</button>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-lg font-black text-gray-900">{playerName ? `${playerName} —` : ''} Memory</h2><span className="text-sm text-gray-500">{moves} essais</span></div>
      {pendingExo && (
        <div className={`rounded-2xl border-2 ${TC[pendingExo.type]?.border ?? 'border-gray-200'} ${TC[pendingExo.type]?.bg ?? 'bg-gray-50'} p-4 text-center animate-pulse`}>
          <p className="text-2xl">{pendingExo.emoji}</p>
          <p className="font-black text-gray-900">{pendingExo.nom}</p>
          <p className="text-xs text-gray-500">Paire trouvee ! Fais 10 reps</p>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {cards.map((card, idx) => (
          <button key={card.id} onClick={() => flip(idx)} className={`aspect-square rounded-xl border-2 flex items-center justify-center transition-all ${card.matched ? 'border-emerald-300 bg-emerald-50 scale-90' : card.flipped ? `${TC[card.exo.type]?.border ?? 'border-gray-300'} ${TC[card.exo.type]?.bg ?? 'bg-gray-100'}` : 'border-gray-200 bg-gray-100 hover:bg-gray-200'}`}>
            {(card.flipped || card.matched) ? (
              <div className="text-center"><p className="text-xl">{card.exo.emoji}</p><p className="text-[8px] font-bold leading-tight">{card.exo.nom.split(' ')[0]}</p></div>
            ) : (
              <span className="text-2xl text-gray-400">?</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function MemoryMuscu() {
  const { multi, start, nextTurn, addScore, reset } = useMultiplayer();
  const [gameMode, setGameMode] = useState<'pick' | 'solo' | 'multi'>('pick');
  const [multiPhase, setMultiPhase] = useState<'playing' | 'results'>('playing');
  const [turnIdx, setTurnIdx] = useState(0);

  if (gameMode === 'pick') return (
    <div className="space-y-5">
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">Memory Muscu</h2><p className="text-sm text-gray-500 mt-1">Trouve les paires !</p></div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setGameMode('solo')} className="py-6 rounded-2xl bg-gray-900 text-white font-black text-base transition hover:bg-gray-700 shadow-lg">Solo</button>
        <button onClick={() => setGameMode('multi')} className="py-6 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-400 text-white font-black text-base transition hover:opacity-90 shadow-lg">Jouer a plusieurs</button>
      </div>
    </div>
  );

  if (gameMode === 'multi' && !multi) return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <MultiplayerSetup onStart={(p, m) => { start(p, m); setMultiPhase('playing'); setTurnIdx(0); }} />
    </div>
  );

  if (gameMode === 'multi' && multi) {
    if (multiPhase === 'results') return (
      <div className="space-y-5">
        <h2 className="text-xl font-black text-gray-900 text-center">Resultats finaux</h2>
        <p className="text-xs text-gray-400 text-center">Moins d&apos;essais = meilleur score</p>
        <MultiScoreboard players={multi.players} scores={multi.scores} />
        <button onClick={() => { reset(); setGameMode('pick'); }} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Nouvelle partie</button>
      </div>
    );
    const player = multi.mode === 'turns' ? multi.players[turnIdx % multi.players.length] : multi.players[multi.currentIdx];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { reset(); setGameMode('pick'); }} className="text-sm text-gray-500 hover:text-gray-700">← Quitter</button>
          <span className="text-xs text-gray-400">{turnIdx + 1} / {multi.players.length}</span>
        </div>
        <MultiScoreboard players={multi.players} scores={multi.scores} currentIdx={multi.players.indexOf(player)} />
        <MemoryCore key={turnIdx} playerName={player.name} onFinish={(moves) => {
          addScore(player.name, Math.max(1, 50 - moves));
          if (turnIdx + 1 >= multi.players.length) setMultiPhase('results');
          else { nextTurn(); setTurnIdx(i => i + 1); }
        }} />
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <MemoryCore />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OFFLINE 8 — COMBO BREAKER
══════════════════════════════════════════════════ */
function ComboBreakerCore({ playerName, onFinish }: { playerName?: string; onFinish?: (score: number) => void }) {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'done'>('setup');
  const [chain, setChain] = useState<{ exo: typeof ALL_EXERCISES[0]; reps: number }[]>([]);
  const [score, setScore] = useState(0);
  const [showChain, setShowChain] = useState(true);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearScheduled = useCallback(() => {
    timeoutRefs.current.forEach(t => clearTimeout(t));
    timeoutRefs.current = [];
  }, []);

  const schedule = useCallback((cb: () => void, delay: number) => {
    const id = setTimeout(cb, delay);
    timeoutRefs.current.push(id);
  }, []);

  useEffect(() => () => {
    clearScheduled();
  }, [clearScheduled]);

  const addLink = () => {
    const newExo = { exo: rand(ALL_EXERCISES), reps: rand([5, 8, 10, 12, 15]) };
    setChain(c => {
      const next = [...c, newExo];
      schedule(() => setShowChain(false), 2000 + next.length * 300);
      return next;
    });
    setShowChain(true);
  };

  const startGame = () => {
    clearScheduled();
    setChain([]); setScore(0); setPhase('playing');
    schedule(() => {
      const first = { exo: rand(ALL_EXERCISES), reps: rand([5, 8, 10, 12, 15]) };
      setChain([first]); setShowChain(true);
      schedule(() => setShowChain(false), 2500);
    }, 300);
  };

  const success = () => { setScore(s => s + 1); addLink(); };
  const fail = () => setPhase('done');

  useEffect(() => {
    if (phase === 'done' && onFinish) {
      const t = setTimeout(() => onFinish(score), 100);
      return () => clearTimeout(t);
    }
  }, [phase, score, onFinish]);

  if (phase === 'setup') return (
    <div className="space-y-5">
      {playerName && <div className="text-center"><span className="inline-block bg-gray-900 text-white text-sm font-bold px-4 py-1.5 rounded-full">{playerName}</span></div>}
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">Combo Breaker</h2><p className="text-sm text-gray-500 mt-1">Memorise et enchaine les exercices — chaque round en ajoute un de plus !</p></div>
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 text-sm text-gray-700 space-y-2">
        <p>1. Un exercice apparait brievement</p>
        <p>2. Fais-le de memoire, puis valide</p>
        <p>3. Au tour suivant, un exercice de plus s&apos;ajoute a la chaine</p>
        <p>4. Tu dois refaire TOUTE la chaine depuis le debut !</p>
      </div>
      <button onClick={startGame} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-black text-lg rounded-2xl transition">Commencer !</button>
    </div>
  );

  if (phase === 'done') return (
    <div className="space-y-5 text-center">
      <div className="text-6xl">&#x1F517;</div>
      <h3 className="text-2xl font-black text-gray-900">{playerName ? `${playerName} —` : ''} Combo termine !</h3>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <p className="text-5xl font-black text-indigo-600">{score}</p>
        <p className="text-sm text-gray-500 mt-1">exercices enchaines</p>
      </div>
      {!onFinish && <button onClick={() => setPhase('setup')} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Recommencer</button>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-900">{playerName ? `${playerName} —` : ''} Round {chain.length}</h2>
        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">{score} combos</span>
      </div>
      {showChain ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 uppercase tracking-widest text-center mb-2">Memorise la chaine !</p>
          {chain.map((link, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${TC[link.exo.type]?.bg ?? 'bg-gray-50'} border ${TC[link.exo.type]?.border ?? 'border-gray-200'}`}>
              <span className="text-lg font-black text-gray-400 w-6">#{i + 1}</span>
              <span className="text-xl">{link.exo.emoji}</span>
              <span className="text-sm font-bold text-gray-900 flex-1">{link.exo.nom}</span>
              <span className="text-sm font-black text-gray-700">{link.reps} reps</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-900 text-white rounded-2xl p-6 text-center">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Execute la chaine !</p>
            <p className="text-3xl font-black">{chain.length} exercice{chain.length > 1 ? 's' : ''}</p>
            <p className="text-sm text-gray-400 mt-1">dans le bon ordre</p>
          </div>
          <div className="flex gap-3">
            <button onClick={success} className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg rounded-2xl transition">Reussi !</button>
            <button onClick={fail} className="flex-1 py-4 border border-gray-300 text-gray-600 font-bold rounded-2xl transition hover:bg-gray-50">Rate</button>
          </div>
          <button onClick={() => setShowChain(true)} className="w-full py-2 text-sm text-indigo-500 font-semibold hover:text-indigo-700">Revoir la chaine (penalite)</button>
        </div>
      )}
    </div>
  );
}

function ComboBreaker() {
  const { multi, start, nextTurn, addScore, reset } = useMultiplayer();
  const [gameMode, setGameMode] = useState<'pick' | 'solo' | 'multi'>('pick');
  const [multiPhase, setMultiPhase] = useState<'playing' | 'results'>('playing');
  const [turnIdx, setTurnIdx] = useState(0);

  if (gameMode === 'pick') return (
    <div className="space-y-5">
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">Combo Breaker</h2><p className="text-sm text-gray-500 mt-1">Enchaine les exercices de memoire !</p></div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setGameMode('solo')} className="py-6 rounded-2xl bg-gray-900 text-white font-black text-base transition hover:bg-gray-700 shadow-lg">Solo</button>
        <button onClick={() => setGameMode('multi')} className="py-6 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-400 text-white font-black text-base transition hover:opacity-90 shadow-lg">Jouer a plusieurs</button>
      </div>
    </div>
  );

  if (gameMode === 'multi' && !multi) return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <MultiplayerSetup onStart={(p, m) => { start(p, m); setMultiPhase('playing'); setTurnIdx(0); }} />
    </div>
  );

  if (gameMode === 'multi' && multi) {
    if (multiPhase === 'results') return (
      <div className="space-y-5">
        <h2 className="text-xl font-black text-gray-900 text-center">Resultats finaux</h2>
        <MultiScoreboard players={multi.players} scores={multi.scores} />
        <button onClick={() => { reset(); setGameMode('pick'); }} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Nouvelle partie</button>
      </div>
    );
    const player = multi.mode === 'turns' ? multi.players[turnIdx % multi.players.length] : multi.players[multi.currentIdx];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { reset(); setGameMode('pick'); }} className="text-sm text-gray-500 hover:text-gray-700">← Quitter</button>
          <span className="text-xs text-gray-400">{turnIdx + 1} / {multi.players.length}</span>
        </div>
        <MultiScoreboard players={multi.players} scores={multi.scores} currentIdx={multi.players.indexOf(player)} />
        <ComboBreakerCore key={turnIdx} playerName={player.name} onFinish={(sc) => {
          addScore(player.name, sc);
          if (turnIdx + 1 >= multi.players.length) setMultiPhase('results');
          else { nextTurn(); setTurnIdx(i => i + 1); }
        }} />
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setGameMode('pick')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <ComboBreakerCore />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ONLINE 1 — DUEL 1v1
══════════════════════════════════════════════════ */
function Duel1v1({ initialDuelId }: { initialDuelId?: string }) {
  const [phase, setPhase] = useState<'setup' | 'sending' | 'sent' | 'live'>('setup');
  const [friends, setFriends] = useState<{ id: string; pseudo: string }[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [exercise, setExercise] = useState('tractions');
  const [myScore, setMyScore] = useState('');
  const [lastSentFriendPseudo, setLastSentFriendPseudo] = useState('');
  const [error, setError] = useState('');
  const [duelId, setDuelId] = useState(initialDuelId || '');
  const [duelLoading, setDuelLoading] = useState(false);
  const [viewerId, setViewerId] = useState('');
  const [canAccept, setCanAccept] = useState(false);
  const [duel, setDuel] = useState<{
    id: string;
    status: 'pending' | 'accepted' | 'finished';
    exercises: string[];
    scores: Record<string, Record<string, number>>;
    inviter: { id: string; pseudo: string };
    invitee: { id: string; pseudo: string };
  } | null>(null);

  const ONLINE_EXERCISES = [
    { key: 'tractions', label: 'Tractions', unit: 'reps' },
    { key: 'pompes', label: 'Pompes', unit: 'reps' },
    { key: 'dips', label: 'Dips', unit: 'reps' },
    { key: 'squats', label: 'Squats', unit: 'reps' },
  ];

  const loadDuel = useCallback(async (id: string) => {
    if (!id) return;
    setDuelLoading(true);
    try {
      const res = await fetch(`/api/duels/${id}`, { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.duel) {
        setError(data.error || 'Duel introuvable');
        setDuelLoading(false);
        return;
      }
      setDuel(data.duel);
      setViewerId(String(data.viewerId || ''));
      setCanAccept(Boolean(data.canAccept));
      setPhase('live');
      setError('');
    } catch {
      setError('Erreur reseau');
    } finally {
      setDuelLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/friends/list', { headers: authHeader() });
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          const accepted = Array.isArray(d.amis) ? d.amis : [];
          setFriends(accepted.map((a: { friendId: string; pseudo: string }) => ({ id: a.friendId, pseudo: a.pseudo })));
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    if (!initialDuelId) return;
    void loadDuel(initialDuelId);
  }, [initialDuelId, loadDuel]);

  useEffect(() => {
    if (phase !== 'sent' || !duelId) return;
    const interval = setInterval(() => {
      void loadDuel(duelId);
    }, 3000);
    return () => clearInterval(interval);
  }, [phase, duelId, loadDuel]);

  useEffect(() => {
    if (phase !== 'live' || !duelId) return;
    const interval = setInterval(() => {
      void loadDuel(duelId);
    }, 4000);
    return () => clearInterval(interval);
  }, [phase, duelId, loadDuel]);

  const sendDuel = async () => {
    if (!selectedFriend || !myScore) return;
    const targetFriend = friends.find((f) => f.id === selectedFriend);
    const targetPseudo = targetFriend?.pseudo || 'ton ami';
    setPhase('sending');
    setError('');
    try {
      const res = await fetch('/api/duels/invite', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          friendId: selectedFriend,
          exercise,
          score: Number(myScore),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.duelId) {
        setError(data.error || 'Erreur');
        setPhase('setup');
        return;
      }
      setDuelId(data.duelId);
      setLastSentFriendPseudo(targetPseudo);
      setPhase('sent');
    } catch {
      setError('Erreur reseau');
      setPhase('setup');
    }
  };

  const acceptDuel = async () => {
    if (!duelId) return;
    setDuelLoading(true);
    try {
      const res = await fetch('/api/duels/accept', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ duelId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erreur acceptation duel');
        setDuelLoading(false);
        return;
      }
      await loadDuel(duelId);
    } catch {
      setError('Erreur reseau');
    } finally {
      setDuelLoading(false);
    }
  };

  const updateScore = async (exerciseKey: string, value: string) => {
    if (!duelId || !duel || !viewerId) return;
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) return;

    const prev = duel.scores[viewerId]?.[exerciseKey] ?? null;
    setDuel({
      ...duel,
      scores: {
        ...duel.scores,
        [viewerId]: {
          ...(duel.scores[viewerId] || {}),
          [exerciseKey]: next,
        },
      },
    });

    const res = await fetch(`/api/duels/${duelId}/score`, {
      method: 'PATCH',
      headers: authHeader(),
      body: JSON.stringify({ exercise: exerciseKey, score: next }),
    });

    if (!res.ok && prev !== null) {
      setDuel((current) => {
        if (!current) return current;
        return {
          ...current,
          scores: {
            ...current.scores,
            [viewerId]: {
              ...(current.scores[viewerId] || {}),
              [exerciseKey]: prev,
            },
          },
        };
      });
    }
  };

  if (phase === 'sent') {
    return (
      <div className="space-y-5 text-center">
        <div className="text-6xl">⚔️</div>
        <h3 className="text-2xl font-black text-gray-900">Invitation envoyee</h3>
        <p className="text-gray-500">{lastSentFriendPseudo ? `@${lastSentFriendPseudo}` : 'Ton ami'} doit accepter dans ses messages.</p>
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <p className="text-sm text-indigo-800">Duel en attente d&apos;acceptation...</p>
        </div>
        <button
          onClick={() => void loadDuel(duelId)}
          className="w-full py-3 bg-white border border-indigo-200 text-indigo-700 font-semibold rounded-2xl hover:bg-indigo-50 transition"
        >
          Rafraichir
        </button>
        <button onClick={() => { setPhase('setup'); setDuelId(''); setMyScore(''); setDuel(null); }} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Nouveau duel</button>
      </div>
    );
  }

  if (phase === 'sending' || duelLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500">Chargement du duel...</p>
      </div>
    );
  }

  if (phase === 'live' && duel) {
    const me = viewerId === duel.inviter.id ? duel.inviter : duel.invitee;
    const opp = viewerId === duel.inviter.id ? duel.invitee : duel.inviter;

    return (
      <div className="space-y-5">
        <div className="text-center">
          <h2 className="text-xl font-black text-gray-900">⚔️ Duel 1v1</h2>
          <p className="text-sm text-gray-500 mt-1">{duel.inviter.pseudo} vs {duel.invitee.pseudo}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
            <p className="text-xs text-indigo-500 font-semibold">Toi</p>
            <p className="text-sm font-black text-indigo-900">{me.pseudo}</p>
          </div>
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
            <p className="text-xs text-rose-500 font-semibold">Adversaire</p>
            <p className="text-sm font-black text-rose-900">{opp.pseudo}</p>
          </div>
        </div>

        {duel.status === 'pending' && canAccept && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p className="text-sm text-amber-800 font-semibold">Invitation recue. Accepte pour lancer le duel.</p>
            <button onClick={() => void acceptDuel()} className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition">Accepter le duel</button>
          </div>
        )}

        {duel.status === 'pending' && !canAccept && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-center text-sm text-indigo-800">
            En attente de l&apos;acceptation de ton adversaire...
          </div>
        )}

        {duel.status !== 'pending' && (
          <div className="space-y-3">
            {duel.exercises.map((ex) => {
              const mine = duel.scores[viewerId]?.[ex];
              const theirs = duel.scores[opp.id]?.[ex];
              return (
                <div key={ex} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className="text-sm font-bold text-gray-900 capitalize">{ex}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-2">
                      <p className="text-[11px] text-indigo-500">Ton score</p>
                      <input
                        type="number"
                        min={0}
                        defaultValue={typeof mine === 'number' ? mine : ''}
                        onBlur={(e) => void updateScore(ex, e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-indigo-200 text-sm font-bold text-indigo-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="rounded-xl border border-rose-100 bg-rose-50 p-2">
                      <p className="text-[11px] text-rose-500">Adversaire</p>
                      <p className="mt-1 text-lg font-black text-rose-900">{typeof theirs === 'number' ? theirs : '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {duel.status === 'finished' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-800 text-center font-semibold">
            Duel termine. Tous les scores ont ete saisis.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">⚔️ Duel 1v1</h2><p className="text-sm text-gray-500 mt-1">Defie un ami et lancez un duel multi-exercices.</p></div>
      {error && <p className="text-sm text-red-500 text-center bg-red-50 rounded-xl p-2 border border-red-200">{error}</p>}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Exercice de depart</p>
          <div className="grid grid-cols-2 gap-2">
            {ONLINE_EXERCISES.map((ex) => (
              <button key={ex.key} onClick={() => setExercise(ex.key)} className={`py-2.5 rounded-xl border-2 text-sm font-bold transition ${exercise === ex.key ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-200 text-gray-600'}`}>{ex.label}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Ton score sur {exercise}</p>
          <input type="number" min={1} value={myScore} onChange={(e) => setMyScore(e.target.value)} placeholder="Ex: 15" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Defier un ami (une seule personne)</p>
          {friends.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">Aucun ami detecte. Ajoute des amis dans Reseau.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {friends.map((f) => (
                <button key={f.id} onClick={() => setSelectedFriend(f.id)} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition ${selectedFriend === f.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">{(f.pseudo || '?')[0].toUpperCase()}</div>
                  <span className="text-sm font-medium text-gray-900">{f.pseudo}</span>
                  {selectedFriend === f.id && <span className="ml-auto text-indigo-600 text-xs font-bold">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <button onClick={() => void sendDuel()} disabled={!selectedFriend || !myScore} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-300 text-white font-black text-lg rounded-2xl transition shadow-lg">
        ⚔️ Envoyer l&apos;invitation
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ONLINE 2 — TOP SEMAINE
══════════════════════════════════════════════════ */
function TopSemaine() {
  const [exercise, setExercise] = useState('tractions');
  const [leaderboard, setLeaderboard] = useState<Array<{ rank: number; userId: string; pseudo: string; score: number; unit: string; spotName: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [myScore, setMyScore] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const EXOS = [
    { key: 'tractions', label: 'Tractions', unit: 'reps' },
    { key: 'pompes', label: 'Pompes', unit: 'reps' },
    { key: 'dips', label: 'Dips', unit: 'reps' },
    { key: 'squats', label: 'Squats', unit: 'reps' },
  ];

  const loadLB = useCallback(async (ex: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/performances/leaderboard?exercise=${ex}&limit=10`, { headers: authHeader() });
      if (r.ok) { const d = await r.json(); setLeaderboard(d.leaderboard ?? []); }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadLB(exercise);
    }, 0);
    return () => clearTimeout(t);
  }, [exercise, loadLB]);

  const submit = async () => {
    if (!myScore) return;
    setError('');
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          action: 'create',
          title: `Top Semaine: ${EXOS.find(e => e.key === exercise)?.label}`,
          description: `Mon record: ${myScore} ${EXOS.find(e => e.key === exercise)?.unit}`,
          exercise,
          target: parseInt(myScore),
          unit: EXOS.find(e => e.key === exercise)?.unit ?? 'reps',
          visibility: 'public',
        }),
      });
      if (res.ok) { setSubmitted(true); loadLB(exercise); }
      else { const d = await res.json(); setError(d.error || 'Erreur'); }
    } catch { setError('Erreur réseau'); }
  };

  return (
    <div className="space-y-5">
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">📊 Top Semaine</h2><p className="text-sm text-gray-500 mt-1">Le classement de la semaine — monte au sommet !</p></div>
      <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {EXOS.map(ex => (
          <button key={ex.key} onClick={() => { setExercise(ex.key); setSubmitted(false); }} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition ${exercise === ex.key ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{ex.label}</button>
        ))}
      </div>
      {/* Leaderboard */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : leaderboard.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Aucun score cette semaine</p>
      ) : (
        <div className="space-y-2">
          {leaderboard.map(e => (
            <div key={e.userId} className={`flex items-center gap-3 p-3 rounded-2xl ${e.rank <= 3 ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50 border border-gray-100'}`}>
              <span className="w-8 text-center flex-shrink-0">{e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : <span className="text-xs font-bold text-gray-500">#{e.rank}</span>}</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{(e.pseudo || '?')[0].toUpperCase()}</div>
              <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{e.pseudo}</span>
              <span className="text-sm font-black text-gray-900 flex-shrink-0">{e.score} <span className="text-xs font-normal text-gray-400">{e.unit}</span></span>
            </div>
          ))}
        </div>
      )}
      {/* Submit score */}
      {!submitted ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Soumettre ton score</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <input type="number" min={1} value={myScore} onChange={e => setMyScore(e.target.value)} placeholder="Ton score" className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <button onClick={submit} disabled={!myScore} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-300 text-white font-bold rounded-xl transition">Envoyer</button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <p className="text-sm text-emerald-700 font-bold">✓ Score soumis ! Reviens voir le classement.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ONLINE 3 — DÉFI AMI
══════════════════════════════════════════════════ */
function DefiAmi() {
  const [phase, setPhase] = useState<'create' | 'sending' | 'sent'>('create');
  const [friends, setFriends] = useState<{ id: string; pseudo: string }[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [exercise, setExercise] = useState(ALL_EXERCISES[0].nom);
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/friends', { headers: authHeader() });
        if (r.ok) { const d = await r.json(); setFriends(d.friends ?? []); }
      } catch { /* silent */ }
    })();
  }, []);

  const toggleFriend = (id: string) => {
    setSelectedFriends(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);
  };

  const send = async () => {
    if (!title.trim() || !target) return;
    setPhase('sending'); setError('');
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          action: 'create',
          title: title.trim(),
          description: desc.trim() || `Défi: ${target} ${exercise}`,
          exercise,
          target: parseInt(target),
          unit: 'reps',
          visibility: 'friends',
        }),
      });
      if (res.ok) {
        if (selectedFriends.length > 0) {
          await Promise.allSettled(
            selectedFriends.map(friendId =>
              fetch('/api/messages/send', {
                method: 'POST',
                headers: authHeader(),
                body: JSON.stringify({
                  receiverId: friendId,
                  content: `🎯 Nouveau défi ami: ${title.trim()} (${target} reps - ${exercise}). Viens le tenter !`,
                }),
              })
            )
          );
        }
        setPhase('sent');
      }
      else { const d = await res.json(); setError(d.error || 'Erreur'); setPhase('create'); }
    } catch { setError('Erreur réseau'); setPhase('create'); }
  };

  if (phase === 'sending') return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500">Envoi du défi…</p>
    </div>
  );

  if (phase === 'sent') return (
    <div className="space-y-5 text-center">
      <div className="text-6xl">🎯</div>
      <h3 className="text-2xl font-black text-gray-900">Défi créé !</h3>
      <p className="text-gray-500">Tes amis peuvent le voir et le relever !</p>
      <button onClick={() => { setPhase('create'); setTitle(''); setDesc(''); setTarget(''); setSelectedFriends([]); }} className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">Créer un autre défi</button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">🎯 Défi Ami</h2><p className="text-sm text-gray-500 mt-1">Crée un défi personnalisé pour tes amis</p></div>
      {error && <p className="text-sm text-red-500 text-center bg-red-50 rounded-xl p-2 border border-red-200">{error}</p>}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Nom du défi</p>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: 100 pompes en 5 min" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Description (optionnel)</p>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Détails du défi…" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Exercice</p>
            <select value={exercise} onChange={e => setExercise(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {ALL_EXERCISES.slice(0, 10).map(e => <option key={e.nom} value={e.nom}>{e.nom}</option>)}
            </select>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Objectif (reps)</p>
            <input type="number" min={1} value={target} onChange={e => setTarget(e.target.value)} placeholder="50" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Notifier des amis (optionnel)</p>
          <p className="text-xs text-gray-400 mb-2">Le défi reste visible par tous tes amis selon les règles actuelles de la plateforme.</p>
          {friends.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">Aucun ami pour le moment</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {friends.map(f => (
                <button key={f.id} onClick={() => toggleFriend(f.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${selectedFriends.includes(f.id) ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                  {f.pseudo}
                  {selectedFriends.includes(f.id) && ' ✓'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <button onClick={send} disabled={!title.trim() || !target} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-300 text-white font-black text-lg rounded-2xl transition shadow-lg">
        🎯 Créer le défi
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ONLINE 4 — RUSH CLASSEMENT
══════════════════════════════════════════════════ */
function RushClassement() {
  const [challenges, setChallenges] = useState<Array<{
    id: string; title: string; description: string; exercise: string; target: number; unit: string;
    creatorPseudo?: string; completionsCount?: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/challenges', { headers: authHeader() });
        if (r.ok) { const d = await r.json(); setChallenges(d.challenges ?? []); }
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  const complete = async (id: string) => {
    setCompleting(id);
    try {
      const r = await fetch('/api/challenges', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ action: 'complete', challengeId: id }),
      });
      if (r.ok) setDoneIds(s => new Set([...s, id]));
    } catch { /* silent */ }
    setCompleting(null);
  };

  return (
    <div className="space-y-5">
      <div className="text-center"><h2 className="text-xl font-black text-gray-900">🚀 Rush Classement</h2><p className="text-sm text-gray-500 mt-1">Relève les défis de la communauté et gagne des XP !</p></div>
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : challenges.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-5xl mb-3">🏖️</div>
          <p className="text-gray-400">Aucun défi disponible pour le moment</p>
          <p className="text-xs text-gray-300 mt-1">Crée un défi dans &quot;Défi Ami&quot; pour commencer !</p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.slice(0, 15).map(c => {
            const isDone = doneIds.has(c.id);
            return (
              <div key={c.id} className={`rounded-2xl border p-4 transition ${isDone ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-emerald-500' : 'bg-indigo-100'}`}>
                    {isDone ? <span className="text-white text-xl">✓</span> : <span className="text-lg">🎯</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 truncate">{c.title}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                        🎯 {c.target} {c.unit}
                      </span>
                      {c.creatorPseudo && <span className="text-xs text-gray-400">par {c.creatorPseudo}</span>}
                    </div>
                  </div>
                  {!isDone && (
                    <button onClick={() => complete(c.id)} disabled={completing === c.id} className="flex-shrink-0 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl transition">
                      {completing === c.id ? '…' : '✓ Fait'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OFFLINE 9 — PARIS (Multiplayer Bet Game)
══════════════════════════════════════════════════ */
interface ParisPlayer { name: string; color: string }
interface ParisTurnResult {
  performer: string;
  exercise: string;
  actual: number;
  guesses: Record<string, number>;
  scores: Record<string, number>;
}

function ParisGame() {
  const [phase, setPhase] = useState<'setup' | 'spin' | 'guess' | 'perform' | 'results' | 'final'>('setup');
  const [players, setPlayers] = useState<ParisPlayer[]>([
    { name: '', color: PLAYER_COLORS[0] },
    { name: '', color: PLAYER_COLORS[1] },
  ]);
  const [activePlayers, setActivePlayers] = useState<ParisPlayer[]>([]);
  const [totalScores, setTotalScores] = useState<Record<string, number>>({});
  const [currentPerformer, setCurrentPerformer] = useState<ParisPlayer | null>(null);
  const [currentExercise, setCurrentExercise] = useState<typeof ALL_EXERCISES[0] | null>(null);
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [actualScore, setActualScore] = useState('');
  const [turnResults, setTurnResults] = useState<ParisTurnResult[]>([]);
  const [playersRemaining, setPlayersRemaining] = useState<ParisPlayer[]>([]);
  const [spinning, setSpinning] = useState(false);

  const addPlayer = () => {
    if (players.length >= 8) return;
    setPlayers(p => [...p, { name: '', color: PLAYER_COLORS[p.length % PLAYER_COLORS.length] }]);
  };
  const removePlayer = (idx: number) => {
    if (players.length <= 2) return;
    setPlayers(p => p.filter((_, i) => i !== idx));
  };
  const setPlayerName = (idx: number, name: string) => {
    setPlayers(p => p.map((pl, i) => i === idx ? { ...pl, name } : pl));
  };

  const startGame = () => {
    const valid = players.filter(p => p.name.trim());
    if (valid.length < 2) return;
    const scores: Record<string, number> = {};
    valid.forEach(p => { scores[p.name] = 0; });
    setActivePlayers(valid);
    setTotalScores(scores);
    setPlayersRemaining([...valid]);
    setTurnResults([]);
    setPhase('spin');
  };

  const spinForPerformer = () => {
    if (playersRemaining.length === 0) {
      setPhase('final');
      return;
    }
    setSpinning(true);
    const idx = Math.floor(Math.random() * playersRemaining.length);
    setTimeout(() => {
      const performer = playersRemaining[idx];
      setCurrentPerformer(performer);
      setCurrentExercise(rand(ALL_EXERCISES));
      setGuesses({});
      setActualScore('');
      setSpinning(false);
      setPhase('guess');
    }, 1500);
  };

  const submitGuesses = () => {
    setPhase('perform');
  };

  const submitActual = () => {
    if (!currentPerformer || !currentExercise) return;
    const actual = parseInt(actualScore) || 0;
    const others = activePlayers.filter(p => p.name !== currentPerformer.name);

    // Calculate scores: closest guess gets most points
    const diffs = others.map(p => ({
      name: p.name,
      diff: Math.abs((parseInt(guesses[p.name]) || 0) - actual),
    })).sort((a, b) => a.diff - b.diff);

    const turnScores: Record<string, number> = {};
    const pointsByRank = [10, 7, 5, 3, 2, 1, 1];
    diffs.forEach((d, i) => {
      turnScores[d.name] = pointsByRank[i] || 1;
    });
    // Performer gets points for performing
    turnScores[currentPerformer.name] = Math.min(actual, 15);

    const newTotalScores = { ...totalScores };
    Object.entries(turnScores).forEach(([name, pts]) => {
      newTotalScores[name] = (newTotalScores[name] || 0) + pts;
    });
    setTotalScores(newTotalScores);

    setTurnResults(prev => [...prev, {
      performer: currentPerformer.name,
      exercise: currentExercise.nom,
      actual,
      guesses: Object.fromEntries(others.map(p => [p.name, parseInt(guesses[p.name]) || 0])),
      scores: turnScores,
    }]);

    setPlayersRemaining(prev => prev.filter(p => p.name !== currentPerformer.name));
    setPhase('results');
  };

  const nextTurn = () => {
    if (playersRemaining.length === 0) {
      setPhase('final');
    } else {
      setPhase('spin');
    }
  };

  const resetGame = () => {
    setPhase('setup');
    setActivePlayers([]);
    setTotalScores({});
    setTurnResults([]);
    setPlayersRemaining([]);
  };

  const sortedScores = [...activePlayers].sort((a, b) => (totalScores[b.name] || 0) - (totalScores[a.name] || 0));
  const medals = ['🥇', '🥈', '🥉'];

  // SETUP
  if (phase === 'setup') return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-black text-gray-900">Paris Sportif</h2>
        <p className="text-sm text-gray-500 mt-1">Estimez les performances de vos amis !</p>
      </div>
      <div className="space-y-2">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: p.color }}>
              {p.name.trim() ? p.name[0].toUpperCase() : (i + 1)}
            </div>
            <input
              value={p.name}
              onChange={e => setPlayerName(i, e.target.value)}
              placeholder={`Joueur ${i + 1}`}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
              maxLength={20}
            />
            {players.length > 2 && (
              <button onClick={() => removePlayer(i)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        ))}
      </div>
      {players.length < 8 && (
        <button onClick={addPlayer} className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-700 transition">
          + Ajouter un joueur
        </button>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">Comment ca marche ?</p>
        <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
          <li>La roue designe un joueur</li>
          <li>Un exercice est donne</li>
          <li>Les autres estiment combien de reps il va faire</li>
          <li>Le joueur realise l&apos;exercice et saisit son score</li>
          <li>Plus vous etes proche, plus vous gagnez de points</li>
        </ol>
      </div>
      <button
        onClick={startGame}
        disabled={players.filter(p => p.name.trim()).length < 2}
        className="w-full py-4 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 text-white font-black text-lg rounded-2xl transition shadow-lg"
      >
        Lancer la partie
      </button>
    </div>
  );

  // SPIN
  if (phase === 'spin') return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={resetGame} className="text-sm text-gray-500 hover:text-gray-700">&larr; Quitter</button>
        <span className="text-xs text-gray-400">{playersRemaining.length} joueur{playersRemaining.length > 1 ? 's' : ''} restant{playersRemaining.length > 1 ? 's' : ''}</span>
      </div>
      {/* Mini scoreboard */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Scores</p>
        <div className="space-y-1.5">
          {sortedScores.map((p, i) => (
            <div key={p.name} className="flex items-center gap-2 p-1.5 rounded-lg">
              <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
              <span className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center font-black flex-shrink-0" style={{ background: p.color }}>{p.name[0].toUpperCase()}</span>
              <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{p.name}</span>
              <span className="text-sm font-black text-gray-900">{totalScores[p.name] || 0}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="text-center py-8">
        {spinning ? (
          <div className="space-y-3">
            <div className="w-16 h-16 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold text-gray-700">La roue tourne...</p>
          </div>
        ) : (
          <button onClick={spinForPerformer} className="px-10 py-4 bg-gray-900 hover:bg-gray-700 text-white font-black text-lg rounded-2xl transition shadow-lg">
            Tourner la roue
          </button>
        )}
      </div>
    </div>
  );

  // GUESS
  if (phase === 'guess' && currentPerformer && currentExercise) return (
    <div className="space-y-5">
      <button onClick={resetGame} className="text-sm text-gray-500 hover:text-gray-700">&larr; Quitter</button>
      <div className="bg-gray-900 rounded-2xl p-5 text-center text-white">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">C&apos;est le tour de</p>
        <p className="text-2xl font-black">{currentPerformer.name}</p>
        <div className="mt-3 inline-flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
          <span className="text-xl">{currentExercise.emoji}</span>
          <span className="text-lg font-bold">{currentExercise.nom}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">{currentExercise.muscles}</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-bold text-gray-900">Estimations des autres joueurs</p>
        <p className="text-xs text-gray-500">Combien de reps va faire {currentPerformer.name} ?</p>
        {activePlayers.filter(p => p.name !== currentPerformer.name).map(p => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center font-black flex-shrink-0" style={{ background: p.color }}>{p.name[0].toUpperCase()}</span>
            <span className="text-sm font-medium text-gray-700 flex-1">{p.name}</span>
            <input
              type="number"
              min={0}
              placeholder="?"
              value={guesses[p.name] || ''}
              onChange={e => setGuesses(prev => ({ ...prev, [p.name]: e.target.value }))}
              className="w-20 px-3 py-2 rounded-xl border border-gray-200 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        ))}
      </div>
      <button
        onClick={submitGuesses}
        disabled={activePlayers.filter(p => p.name !== currentPerformer.name).some(p => !guesses[p.name])}
        className="w-full py-4 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 text-white font-black text-lg rounded-2xl transition shadow-lg"
      >
        Valider les estimations
      </button>
    </div>
  );

  // PERFORM
  if (phase === 'perform' && currentPerformer && currentExercise) return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-6 text-center text-white">
        <p className="text-xs uppercase tracking-widest text-emerald-100 mb-1">A toi de jouer</p>
        <p className="text-2xl font-black">{currentPerformer.name}</p>
        <div className="mt-3">
          <span className="text-4xl">{currentExercise.emoji}</span>
          <h3 className="text-2xl font-black mt-1">{currentExercise.nom}</h3>
          <p className="text-sm text-emerald-100 mt-1">Fais le maximum de repetitions !</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
        <p className="text-sm font-bold text-gray-900 mb-3">Combien de reps as-tu fait ?</p>
        <input
          type="number"
          min={0}
          value={actualScore}
          onChange={e => setActualScore(e.target.value)}
          placeholder="0"
          className="text-4xl font-black text-center text-gray-900 w-32 border-b-4 border-gray-300 focus:border-gray-900 outline-none transition py-2 mx-auto block"
        />
      </div>
      <button
        onClick={submitActual}
        disabled={!actualScore}
        className="w-full py-4 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 text-white font-black text-lg rounded-2xl transition shadow-lg"
      >
        Valider mon score
      </button>
    </div>
  );

  // RESULTS
  if (phase === 'results') {
    const lastTurn = turnResults[turnResults.length - 1];
    if (!lastTurn) { nextTurn(); return null; }
    const others = Object.entries(lastTurn.guesses).sort(
      (a, b) => Math.abs(a[1] - lastTurn.actual) - Math.abs(b[1] - lastTurn.actual),
    );
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Resultat</p>
          <p className="text-lg font-bold text-gray-900">{lastTurn.performer} a fait</p>
          <p className="text-5xl font-black text-gray-900 my-2">{lastTurn.actual}</p>
          <p className="text-sm text-gray-500">{lastTurn.exercise}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-sm font-bold text-gray-900 mb-3">Classement du tour</p>
          <div className="space-y-2">
            {others.map(([name, g], i) => {
              const diff = Math.abs(g - lastTurn.actual);
              const playerObj = activePlayers.find(p => p.name === name);
              return (
                <div key={name} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50">
                  <span className="text-lg">{medals[i] || `${i + 1}.`}</span>
                  <span className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center font-black flex-shrink-0" style={{ background: playerObj?.color || '#999' }}>{name[0].toUpperCase()}</span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">{name}</span>
                  <span className="text-xs text-gray-500">Pari: {g}</span>
                  <span className="text-xs text-gray-400">(ecart: {diff})</span>
                  <span className="text-sm font-black text-emerald-600">+{lastTurn.scores[name] || 0}</span>
                </div>
              );
            })}
          </div>
        </div>
        <button
          onClick={nextTurn}
          className="w-full py-4 bg-gray-900 hover:bg-gray-700 text-white font-black text-lg rounded-2xl transition shadow-lg"
        >
          {playersRemaining.length > 0 ? 'Tour suivant' : 'Voir le classement final'}
        </button>
      </div>
    );
  }

  // FINAL
  if (phase === 'final') return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl p-6 text-center text-white">
        <p className="text-5xl mb-2">🏆</p>
        <p className="text-xs uppercase tracking-widest text-amber-100 mb-1">Classement final</p>
        <p className="text-2xl font-black">{sortedScores[0]?.name || ''} gagne !</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="space-y-2">
          {sortedScores.map((p, i) => (
            <div key={p.name} className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
              <span className="text-2xl">{medals[i] || `${i + 1}.`}</span>
              <span className="w-8 h-8 rounded-full text-white text-sm flex items-center justify-center font-black flex-shrink-0" style={{ background: p.color }}>{p.name[0].toUpperCase()}</span>
              <span className="text-base font-bold text-gray-900 flex-1">{p.name}</span>
              <span className="text-xl font-black text-gray-900">{totalScores[p.name] || 0} pts</span>
            </div>
          ))}
        </div>
      </div>
      {/* Tour history */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-sm font-bold text-gray-900 mb-3">Historique des tours</p>
        <div className="space-y-2">
          {turnResults.map((t, i) => (
            <div key={i} className="text-xs text-gray-600 p-2 bg-gray-50 rounded-lg">
              <span className="font-bold text-gray-900">{t.performer}</span> — {t.exercise} : {t.actual} reps
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={resetGame} className="flex-1 py-3 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl transition">
          Nouvelle partie
        </button>
        <button onClick={() => setPhase('setup')} className="flex-1 py-3 border-2 border-gray-200 text-gray-700 font-bold rounded-2xl transition hover:bg-gray-50">
          Changer les joueurs
        </button>
      </div>
    </div>
  );

  return null;
}

/* ═══════════════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════════════ */
const OFFLINE_GAMES = [
  { id: 'roulette', label: 'Roulette', emoji: '🎰', desc: 'Laisse le hasard décider', color: 'from-orange-500 to-amber-400' },
  { id: 'chrono', label: 'Défi Chrono', emoji: '⏱', desc: 'AMRAP — max de tours', color: 'from-blue-500 to-cyan-400' },
  { id: 'escalade', label: 'Escalade', emoji: '🗻', desc: 'Pyramide de reps', color: 'from-emerald-500 to-teal-400' },
  { id: 'bingo', label: 'Bingo Fitness', emoji: '🎯', desc: 'Fais un bingo 3×3', color: 'from-purple-500 to-fuchsia-400' },
  { id: 'de', label: 'Dé Fitness', emoji: '🎲', desc: 'Lance les dés au hasard', color: 'from-yellow-500 to-orange-400' },
  { id: 'hiit', label: 'Shuffle HIIT', emoji: '🔥', desc: 'Intervalles aléatoires', color: 'from-rose-500 to-pink-400' },
  { id: 'memory', label: 'Memory Muscu', emoji: '🧠', desc: 'Trouve les paires', color: 'from-teal-500 to-cyan-400' },
  { id: 'combo', label: 'Combo Breaker', emoji: '🔗', desc: 'Chaîne de mémoire', color: 'from-indigo-500 to-violet-400' },
  { id: 'paris', label: 'Paris', emoji: '🤝', desc: 'Parie sur tes amis', color: 'from-pink-500 to-rose-400' },
];

const ONLINE_GAMES = [
  { id: 'duel', label: 'Duel 1v1', emoji: '⚔️', desc: 'Défie un ami', color: 'from-red-500 to-rose-400' },
  { id: 'topsemaine', label: 'Top Semaine', emoji: '📊', desc: 'Classement hebdo', color: 'from-amber-500 to-yellow-400' },
  { id: 'defiami', label: 'Défi Ami', emoji: '🎯', desc: 'Crée un défi custom', color: 'from-emerald-500 to-green-400' },
  { id: 'rush', label: 'Rush Classement', emoji: '🚀', desc: 'Relève les défis', color: 'from-blue-600 to-indigo-500' },
];

const COMPONENTS: Record<string, React.ComponentType> = {
  roulette: Roulette, chrono: DefiChrono, escalade: Escalade, bingo: BingoFitness,
  de: DeFitness, hiit: ShuffleHIIT, memory: MemoryMuscu, combo: ComboBreaker,
  duel: Duel1v1, topsemaine: TopSemaine, defiami: DefiAmi, rush: RushClassement,
  paris: ParisGame,
};

export default function MiniJeuxPage() {
  const [initialRouteState] = useState(() => {
    if (typeof window === 'undefined') {
      return { activeGame: null as string | null, tab: 'offline' as 'offline' | 'online', duelId: '' };
    }
    const params = new URLSearchParams(window.location.search);
    const requestedGame = (params.get('game') || '').trim().toLowerCase();
    const gameAliases: Record<string, string> = { circuit: 'chrono' };
    const game = gameAliases[requestedGame] || requestedGame;
    const duelId = (params.get('duelId') || '').trim();
    const isOffline = OFFLINE_GAMES.some((g) => g.id === game);
    const isOnline = ONLINE_GAMES.some((g) => g.id === game);

    if (isOffline || isOnline) {
      return {
        activeGame: game as string | null,
        tab: isOnline ? ('online' as const) : ('offline' as const),
        duelId: game === 'duel' ? duelId : '',
      };
    }

    return { activeGame: null as string | null, tab: 'offline' as 'offline' | 'online', duelId: '' };
  });

  const [activeGame, setActiveGame] = useState<string | null>(initialRouteState.activeGame);
  const [tab, setTab] = useState<'offline' | 'online'>(initialRouteState.tab);
  const [initialDuelId] = useState(initialRouteState.duelId);

  if (activeGame) {
    const allGames = [...OFFLINE_GAMES, ...ONLINE_GAMES];
    const game = allGames.find(g => g.id === activeGame);
    const Comp = COMPONENTS[activeGame];
    return (
      <main className="flex-1 px-3 py-6 sm:px-6 md:px-8 sm:py-10 w-full max-w-lg mx-auto overflow-x-hidden">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => setActiveGame(null)} className="p-2 rounded-xl hover:bg-gray-100 transition">
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="font-black text-gray-900">{game?.emoji} {game?.label}</h1>
          </div>
        </div>
        {activeGame === 'duel' ? <Duel1v1 initialDuelId={initialDuelId} /> : (Comp ? <Comp /> : null)}
      </main>
    );
  }

  const games = tab === 'offline' ? OFFLINE_GAMES : ONLINE_GAMES;

  return (
    <main className="flex-1 px-3 py-6 sm:px-6 md:px-8 sm:py-10 w-full max-w-2xl overflow-x-hidden">
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🎮 Mini Jeux</h1>
        <p className="text-sm text-gray-500 mt-1">Pimente ton entraînement avec des défis fun</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-6">
        <button
          onClick={() => setTab('offline')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${tab === 'offline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📴 Solo / Offline
        </button>
        <button
          onClick={() => setTab('online')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${tab === 'online' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          🌐 Online / Social
        </button>
      </div>

      {/* Games grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {games.map(game => (
          <button
            key={game.id}
            onClick={() => setActiveGame(game.id)}
            className="text-left rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className={`bg-gradient-to-br ${game.color} p-4 sm:p-5 text-white`}>
              <p className="text-3xl mb-1.5">{game.emoji}</p>
              <h3 className="text-sm sm:text-base font-black leading-tight">{game.label}</h3>
              <p className="text-[11px] sm:text-sm opacity-85 mt-0.5 leading-snug">{game.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Info */}
      <div className={`rounded-2xl p-4 border ${tab === 'offline' ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-200'}`}>
        <p className={`text-sm font-semibold mb-1 ${tab === 'offline' ? 'text-amber-800' : 'text-indigo-800'}`}>
          {tab === 'offline' ? '💡 Mode Solo' : '🌐 Mode Online'}
        </p>
        <p className={`text-xs ${tab === 'offline' ? 'text-amber-700' : 'text-indigo-700'}`}>
          {tab === 'offline'
            ? 'Ces jeux fonctionnent sans connexion. Parfait pour s\'entraîner n\'importe où !'
            : 'Défie tes amis, grimpe dans les classements et relève les défis de la communauté !'}
        </p>
      </div>
    </main>
  );
}
