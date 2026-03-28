'use client';

import { useState, useEffect, useCallback } from 'react';

interface LeaderboardEntry {
 rank: number;
 userId: string;
 pseudo: string;
 score: number;
 unit: string;
 spotName: string;
 spotCity: string;
 performanceId: string;
}

interface LeaderboardResponse {
 exercise: string;
 total: number;
 leaderboard: LeaderboardEntry[];
 myEntry: LeaderboardEntry | null;
}

const EXERCISES = [
 { key: 'tractions', label: 'Tractions', emoji: '' },
 { key: 'pompes', label: 'Pompes', emoji: '' },
 { key: 'dips', label: 'Dips', emoji: '' },
 { key: 'squats', label: 'Squats', emoji: '' },
 { key: 'tractions_lestees', label: 'Tractions lestées', emoji: '' },
 { key: 'dips_lestes', label: 'Dips lestés', emoji: '' },
];

function RankBadge({ rank }: { rank: number }) {
 if (rank === 1) return <span className="text-2xl"></span>;
 if (rank === 2) return <span className="text-2xl"></span>;
 if (rank === 3) return <span className="text-2xl"></span>;
 return (
 <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm font-bold tabular-nums">
 {rank}
 </span>
 );
}

export default function ClassementPage() {
 const [selectedExercise, setSelectedExercise] = useState('tractions');
 const [data, setData] = useState<LeaderboardResponse | null>(null);
 const [loading, setLoading] = useState(false);
 const [myUserId, setMyUserId] = useState<string | null>(null);

 useEffect(() => {
 const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
 if (raw) {
 try { setMyUserId(JSON.parse(raw).id ?? null); } catch { /* */ }
 }
 }, []);

 const fetchLeaderboard = useCallback(async (exercise: string) => {
 const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
 if (!token) return;
 setLoading(true);
 try {
 const res = await fetch(`/api/performances/leaderboard?exercise=${exercise}&limit=50`, {
 headers: { Authorization: `Bearer ${token}` },
 });
 if (res.ok) setData(await res.json());
 } catch { /* */ } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => { fetchLeaderboard(selectedExercise); }, [selectedExercise, fetchLeaderboard]);

 const currentExercise = EXERCISES.find(e => e.key === selectedExercise)!;
 const isMyEntryInTop = data?.leaderboard.some(e => e.userId === myUserId);

 return (
 <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
 {/* Page header */}
 <div className="bg-white border-b border-gray-100 px-4 md:px-8 py-6">
 <h1 className="text-2xl font-black text-gray-900 tracking-tight">Classement</h1>
 <p className="text-sm text-gray-400 mt-0.5">Meilleures performances validées en France</p>
 </div>

 {/* Exercise tabs */}
 <div className="bg-white border-b border-gray-100 px-3 sm:px-4 md:px-8">
 <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:overflow-x-auto py-3 no-scrollbar sm:snap-x sm:snap-mandatory">
 {EXERCISES.map((ex) => (
 <button
 key={ex.key}
 onClick={() => setSelectedExercise(ex.key)}
 className={`sm:snap-start flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
 selectedExercise === ex.key
 ? 'bg-gray-900 text-white shadow-sm'
 : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
 }`}
 >
 <span>{ex.emoji}</span>
 <span>{ex.label}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Content */}
 <div className="max-w-2xl mx-auto w-full px-3 sm:px-4 md:px-8 py-5 sm:py-6 space-y-4 overflow-x-hidden">

 {/* Total count */}
 {data && !loading && (
 <p className="text-[11px] sm:text-xs text-gray-400 font-medium uppercase tracking-wide break-words pr-1">
 {data.total} athlète{data.total !== 1 ? 's' : ''} classé{data.total !== 1 ? 's' : ''} — {currentExercise.emoji} {currentExercise.label}
 </p>
 )}

 {/* Loading skeleton */}
 {loading && (
 <div className="space-y-3">
 {Array.from({ length: 8 }).map((_, i) => (
 <div key={i} className="bg-white rounded-2xl p-4 flex items-center gap-4 animate-pulse">
 <div className="w-8 h-8 bg-gray-200 rounded-full" />
 <div className="w-9 h-9 bg-gray-200 rounded-full" />
 <div className="flex-1 space-y-2">
 <div className="h-3.5 bg-gray-200 rounded w-32" />
 <div className="h-3 bg-gray-100 rounded w-24" />
 </div>
 <div className="h-6 bg-gray-200 rounded w-16" />
 </div>
 ))}
 </div>
 )}

 {/* Leaderboard list */}
 {!loading && data && data.leaderboard.length === 0 && (
 <div className="bg-white rounded-2xl p-10 text-center">
 <p className="text-4xl mb-3"></p>
 <p className="text-gray-500 font-medium">Aucune performance validée pour l&apos;instant</p>
 <p className="text-sm text-gray-400 mt-1">Sois le premier à te classer !</p>
 </div>
 )}

 {!loading && data && data.leaderboard.length > 0 && (
 <div className="space-y-2 w-full max-w-full">
 {data.leaderboard.map((entry) => {
 const isMe = entry.userId === myUserId;
 return (
 <div
 key={entry.performanceId}
 className={`bg-white rounded-2xl px-3 sm:px-4 py-3 sm:py-3.5 grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all min-w-0 max-w-full ${
 isMe ? 'ring-2 ring-blue-500 ring-offset-1' : ''
 }`}
 >
 {/* Rank */}
 <div className="flex-shrink-0 w-8 sm:w-9 flex items-center justify-center">
 <RankBadge rank={entry.rank} />
 </div>

 {/* Avatar */}
 <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
 isMe ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white'
 }`}>
 {entry.pseudo[0]?.toUpperCase() ?? '?'}
 </div>

 {/* Info */}
 <div className="min-w-0 overflow-hidden">
 <div className="flex items-baseline gap-1.5 min-w-0">
 <span className={`text-sm sm:text-base font-semibold truncate min-w-0 ${isMe ? 'text-blue-600' : 'text-gray-900'}`}>
 {entry.pseudo}
 </span>
 {isMe && (
 <span className="text-[11px] font-bold text-blue-500 flex-shrink-0">vous</span>
 )}
 </div>
 <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 break-all leading-4 pr-2">
 {entry.spotName}{entry.spotCity ? `, ${entry.spotCity}` : ''}
 </p>
 </div>

 {/* Score */}
 <div className="text-right w-[68px] sm:w-auto overflow-hidden">
 <div className="leading-none">
 <span className="text-base sm:text-lg font-black text-gray-900 tabular-nums truncate block">{entry.score}</span>
 </div>
 <span className="text-[11px] sm:text-xs text-gray-400 truncate block">{entry.unit}</span>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* "My rank" banner if outside top 50 */}
 {!loading && data?.myEntry && !isMyEntryInTop && (
 <div className="bg-blue-50 border border-blue-200 rounded-2xl px-3 sm:px-4 py-3.5 grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4 min-w-0 max-w-full">
 <div className="flex-shrink-0 w-8 sm:w-9 flex items-center justify-center">
 <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-bold tabular-nums">
 {data.myEntry.rank}
 </span>
 </div>
 <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
 {data.myEntry.pseudo[0]?.toUpperCase() ?? '?'}
 </div>
 <div className="min-w-0 overflow-hidden">
 <div className="flex items-baseline gap-1.5 min-w-0">
 <span className="text-sm font-semibold text-blue-600 truncate min-w-0">{data.myEntry.pseudo}</span>
 <span className="text-[11px] font-bold text-blue-400 flex-shrink-0">vous</span>
 </div>
 <p className="text-[11px] sm:text-xs text-blue-400 mt-0.5 break-all leading-4 pr-2">
 {data.myEntry.spotName}{data.myEntry.spotCity ? `, ${data.myEntry.spotCity}` : ''}
 </p>
 </div>
 <div className="text-right w-[68px] sm:w-auto overflow-hidden">
 <div className="leading-none">
 <span className="text-base sm:text-lg font-black text-blue-600 tabular-nums truncate block">{data.myEntry.score}</span>
 </div>
 <span className="text-[11px] sm:text-xs text-blue-400 truncate block">{data.myEntry.unit}</span>
 </div>
 </div>
 )}

 {/* Footer note */}
 <p className="text-xs text-center text-gray-400 pt-2 pb-6">
 Seules les performances validées par un admin sont comptabilisées.
 </p>
 </div>
 </div>
 );
}
