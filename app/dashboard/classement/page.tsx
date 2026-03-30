'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { UserAvatar } from '@/components/UserAvatar';

interface LeaderboardEntry {
 rank: number;
 elo: number;
 league: string;
 userId: string;
 pseudo: string;
 profileImageUrl?: string | null;
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

interface TeamLeaderboardEntry {
 rank: number;
 groupId: string;
 groupName: string;
 membersCount: number;
 totalScore: number;
 avgScore: number;
 isMember: boolean;
 topMember: { userId: string; pseudo: string; score: number } | null;
}

interface CityLeaderboardEntry {
 rank: number;
 city: string;
 totalScore: number;
 participants: number;
 topAthlete: { userId: string; pseudo: string; score: number } | null;
}

const EXERCISES = [
 { key: 'tractions', label: 'Tractions', emoji: '' },
 { key: 'pompes', label: 'Pompes', emoji: '' },
 { key: 'dips', label: 'Dips', emoji: '' },
 { key: 'squats', label: 'Squats', emoji: '' },
 { key: 'muscle_ups', label: 'Muscle-ups', emoji: '' },
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
 const [teams, setTeams] = useState<TeamLeaderboardEntry[]>([]);
 const [cities, setCities] = useState<CityLeaderboardEntry[]>([]);

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

 const fetchTeamsLeaderboard = useCallback(async () => {
 const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
 if (!token) return;
 try {
 const res = await fetch('/api/groups/leaderboard', {
 headers: { Authorization: `Bearer ${token}` },
 });
 if (!res.ok) return;
 const payload = await res.json();
 setTeams(payload.leaderboard ?? []);
 } catch {
 // noop
 }
 }, []);

 const fetchCitiesLeaderboard = useCallback(async () => {
 const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
 if (!token) return;
 try {
 const res = await fetch('/api/performances/cities/leaderboard', {
 headers: { Authorization: `Bearer ${token}` },
 });
 if (!res.ok) return;
 const payload = await res.json();
 setCities(payload.leaderboard ?? []);
 } catch {
 // noop
 }
 }, []);

 useEffect(() => { fetchLeaderboard(selectedExercise); }, [selectedExercise, fetchLeaderboard]);
 useEffect(() => { fetchTeamsLeaderboard(); }, [fetchTeamsLeaderboard]);
 useEffect(() => { fetchCitiesLeaderboard(); }, [fetchCitiesLeaderboard]);

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

 {/* Team leaderboard */}
 {teams.length > 0 && (
 <div className="grid gap-4 md:grid-cols-2">
 <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
 <div className="flex items-center justify-between">
 <h2 className="text-sm sm:text-base font-black text-gray-900">Top équipes</h2>
 <span className="text-[11px] text-gray-400 uppercase tracking-wide">Global</span>
 </div>
 <div className="mt-3 space-y-2">
 {teams.slice(0, 5).map((team) => (
 <div key={team.groupId} className={`rounded-xl border px-3 py-2.5 ${team.isMember ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
 <div className="flex items-center justify-between gap-2">
 <p className="text-sm font-semibold text-gray-900 truncate">#{team.rank} {team.groupName}</p>
 <p className="text-sm font-black text-gray-900 tabular-nums">{team.totalScore}</p>
 </div>
 <p className="mt-1 text-[11px] text-gray-500">
 {team.membersCount} membre{team.membersCount > 1 ? 's' : ''} · moyenne {team.avgScore} · top {team.topMember?.pseudo ?? 'n/a'}
 </p>
 </div>
 ))}
 </div>
 </div>
 {cities.length > 0 && (
 <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
 <div className="flex items-center justify-between">
 <h2 className="text-sm sm:text-base font-black text-gray-900">Villes en duel</h2>
 <span className="text-[11px] text-gray-400 uppercase tracking-wide">Inter-villes</span>
 </div>
 <div className="mt-3 space-y-2">
 {cities.map((city) => (
 <div key={city.city} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
 <div className="flex items-center justify-between gap-2">
 <p className="text-sm font-semibold text-gray-900 truncate">#{city.rank} {city.city}</p>
 <p className="text-sm font-black text-gray-900 tabular-nums">{city.totalScore}</p>
 </div>
 <p className="mt-1 text-[11px] text-gray-500">
 {city.participants} athlete{city.participants > 1 ? 's' : ''} · top {city.topAthlete?.pseudo ?? 'n/a'}
 </p>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
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
 <Link href={`/dashboard/profil/${entry.userId}`} className="flex-shrink-0">
 <UserAvatar src={entry.profileImageUrl} name={entry.pseudo} size="sm" className={isMe ? 'ring-2 ring-blue-500' : ''} />
 </Link>

 {/* Info */}
 <div className="min-w-0 overflow-hidden">
 <div className="flex items-baseline gap-1.5 min-w-0">
 <Link href={`/dashboard/profil/${entry.userId}`} className={`text-sm sm:text-base font-semibold truncate min-w-0 hover:underline ${isMe ? 'text-blue-600' : 'text-gray-900'}`}>
 {entry.pseudo}
 </Link>
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
 <span className="text-[11px] sm:text-xs text-gray-500 truncate block">Elo {entry.elo} · {entry.league}</span>
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
 <Link href={`/dashboard/profil/${data.myEntry.userId}`} className="flex-shrink-0">
 <UserAvatar src={data.myEntry.profileImageUrl} name={data.myEntry.pseudo} size="sm" className="ring-2 ring-blue-500" />
 </Link>
 <div className="min-w-0 overflow-hidden">
 <div className="flex items-baseline gap-1.5 min-w-0">
 <Link href={`/dashboard/profil/${data.myEntry.userId}`} className="text-sm font-semibold text-blue-600 truncate min-w-0 hover:underline">{data.myEntry.pseudo}</Link>
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
 <span className="text-[11px] sm:text-xs text-blue-500 truncate block">Elo {data.myEntry.elo} · {data.myEntry.league}</span>
 </div>
 </div>
 )}

 {/* Footer note */}
 <p className="text-xs text-center text-gray-400 pt-2 pb-6">
 Les ligues et les classements de villes reposent sur les performances validees par la communaute puis confirmees.
 </p>
 </div>
 </div>
 );
}
