'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserAvatar } from '@/components/UserAvatar';
import LevelBadge from '@/app/components/LevelBadge';

interface BadgeItem {
 id: string;
 code: string;
 label: string;
 earnedAt: string;
}

interface BadgeProgress {
 unlockedCount: number;
 totalBadgesAvailable: number;
 profile: {
 level: string;
 xp: number;
 completedSessions: number;
 loginStreak: number;
 };
 nextMilestones: {
 sessions: number;
 streak: number;
 xp: number;
 };
}

interface SocialProfile {
 id: string;
 pseudo: string;
 name: string | null;
 profileImageUrl?: string | null;
 profileVisibility?: 'public' | 'private';
 level: string;
 xp: number;
 verified: boolean;
 isMe: boolean;
 followedByMe: boolean;
 counts: {
 followers: number;
 following: number;
 posts: number;
 weeklyPosts: number;
 weeklySessions: number;
 badges: number;
 validatedPerformances: number;
 };
 bestPerformances: Array<{
 exercise: string;
 score: number;
 unit: string;
 spotName: string;
 spotCity: string | null;
 }>;
}

interface AllBadgeDef {
 code: string;
 label: string;
 icon: string;
 description: string;
 condition: string;
}

const ALL_BADGES: AllBadgeDef[] = [
 // Sessions
 { code: 'first_session', label: 'Première séance', icon: '', description: 'Vous avez terminé votre première séance d\'entraînement !', condition: 'Terminer 1 séance' },
 { code: '5_sessions', label: '5 séances', icon: '', description: 'Vous êtes régulier ! 5 séances complétées.', condition: 'Terminer 5 séances' },
 { code: '10_sessions', label: '10 séances', icon: '', description: 'Votre persévérance paie. 10 séances au compteur !', condition: 'Terminer 10 séances' },
 { code: '25_sessions', label: '25 séances', icon: '', description: 'Un quart de centaine ! Vous êtes un athlète confirmé.', condition: 'Terminer 25 séances' },
 { code: '50_sessions', label: '50 séances', icon: '', description: 'Légende ! 50 séances d\'entraînement terminées.', condition: 'Terminer 50 séances' },
 { code: '100_sessions', label: '100 séances', icon: '', description: 'Centurion ! 100 séances d\'entraînement. Machine.', condition: 'Terminer 100 séances' },
 // Streaks
 { code: 'streak_7', label: '7 jours consécutifs', icon: '', description: 'Une semaine complète de connexion quotidienne.', condition: '7 jours d\'affilée' },
 { code: 'streak_14', label: '14 jours consécutifs', icon: '', description: 'Deux semaines sans relâche !', condition: '14 jours d\'affilée' },
 { code: 'streak_30', label: '30 jours consécutifs', icon: '', description: 'Un mois entier sans manquer un jour !', condition: '30 jours d\'affilée' },
 { code: 'streak_60', label: '60 jours consécutifs', icon: '', description: 'Deux mois de discipline pure !', condition: '60 jours d\'affilée' },
 { code: 'streak_90', label: '90 jours consécutifs', icon: '', description: 'Trois mois ! Habitude installée.', condition: '90 jours d\'affilée' },
 // Social
 { code: 'social', label: 'Sociable', icon: '', description: 'Vous avez construit un réseau de 5 amis.', condition: 'Avoir 5 amis' },
 { code: 'social_10', label: 'Populaire', icon: '', description: '10 amis dans votre réseau !', condition: 'Avoir 10 amis' },
 { code: 'social_25', label: 'Influenceur', icon: '', description: '25 amis ! Vous êtes une référence.', condition: 'Avoir 25 amis' },
 { code: 'messenger', label: 'Bavard', icon: '', description: 'Vous adorez communiquer ! 50 messages envoyés.', condition: 'Envoyer 50 messages' },
 { code: 'messenger_200', label: 'Orateur', icon: '', description: '200 messages ! Communication au top.', condition: 'Envoyer 200 messages' },
 // Workouts
 { code: 'first_workout', label: 'Créateur', icon: '', description: 'Vous avez créé votre premier programme.', condition: 'Créer 1 programme' },
 { code: '5_workouts', label: 'Planificateur', icon: '', description: '5 programmes créés !', condition: 'Créer 5 programmes' },
 { code: '10_workouts', label: 'Architecte', icon: '', description: '10 programmes ! Vous maîtrisez la planification.', condition: 'Créer 10 programmes' },
 // Level
 { code: 'elite', label: 'Élite', icon: '', description: 'Vous avez atteint le niveau Élite. Respect absolu.', condition: 'Niveau Élite' },
 // XP
 { code: 'xp_100', label: '100 XP', icon: '', description: 'Premiers 100 XP accumulés !', condition: 'Accumuler 100 XP' },
 { code: 'xp_500', label: '500 XP', icon: '', description: '500 XP ! Vous progressez vite.', condition: 'Accumuler 500 XP' },
 { code: 'xp_1000', label: '1 000 XP', icon: '', description: '1 000 XP ! Athlète accompli.', condition: 'Accumuler 1 000 XP' },
 { code: 'xp_5000', label: '5 000 XP', icon: '', description: '5 000 XP ! Niveau légendaire.', condition: 'Accumuler 5 000 XP' },
 // Challenges
 { code: 'first_challenge', label: 'Challenger', icon: '', description: 'Premier défi relevé avec succès !', condition: 'Relever 1 défi' },
 { code: '5_challenges', label: '5 défis', icon: '', description: '5 défis relevés !', condition: 'Relever 5 défis' },
 { code: '10_challenges', label: '10 défis', icon: '', description: '10 défis ! Machine à défis.', condition: 'Relever 10 défis' },
 { code: '25_challenges', label: '25 défis', icon: '', description: '25 défis ! Inarrêtable.', condition: 'Relever 25 défis' },
 { code: 'challenge_creator', label: 'Créateur de défi', icon: '', description: 'Vous avez créé votre premier défi.', condition: 'Créer 1 défi' },
 { code: 'challenge_creator_5', label: '5 défis créés', icon: '', description: '5 défis créés pour la communauté !', condition: 'Créer 5 défis' },
 // Groups
 { code: 'group_member', label: 'Membre', icon: '', description: 'Vous avez rejoint un groupe.', condition: 'Rejoindre 1 groupe' },
 { code: 'group_leader', label: 'Leader', icon: '', description: 'Vous avez créé votre propre groupe.', condition: 'Créer 1 groupe' },
];

export default function ProfilPage() {
 const [isAdmin, setIsAdmin] = useState(false);
 const [userEmail, setUserEmail] = useState('');
 const [pseudo, setPseudo] = useState('');
 const [name, setName] = useState('');
 const [level, setLevel] = useState('');
 const [xp, setXp] = useState(0);
 const [weight, setWeight] = useState('');
 const [height, setHeight] = useState('');
 const [goal, setGoal] = useState('Force');
 const [equipmentData, setEquipmentData] = useState<Record<string, unknown>>({});
 const [saving, setSaving] = useState(false);
 const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
 const [badges, setBadges] = useState<BadgeItem[]>([]);
 const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
 const [totalSessions, setTotalSessions] = useState(0);
 const [totalWorkouts, setTotalWorkouts] = useState(0);
 const [badgeProgress, setBadgeProgress] = useState<BadgeProgress | null>(null);
 const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
 const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
 const [profileVisibility, setProfileVisibility] = useState<'public' | 'private'>('public');
 const [uploadingAvatar, setUploadingAvatar] = useState(false);
 const formRef = useRef<HTMLFormElement>(null);
 const avatarInputRef = useRef<HTMLInputElement>(null);
 const router = useRouter();

 useEffect(() => {
 const token = localStorage.getItem('token');
 if (!token) return;

 // Load user info
 fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
 .then((r) => r.json())
 .then((data) => {
 if (data.user) {
 setIsAdmin(!!data.user.isAdmin);
 setName(data.user.name ?? '');
 setPseudo(data.user.pseudo ?? '');
 setUserEmail(data.user.email ?? '');
 setLevel(data.user.level ?? 'intermediaire');
 setXp(typeof data.user.xp === 'number' ? data.user.xp : 0);
 setProfileImageUrl(data.user.profileImageUrl ?? null);
 setProfileVisibility(data.user.profileVisibility === 'private' ? 'private' : 'public');
 localStorage.setItem('user', JSON.stringify(data.user));
 }
 })
 .catch(() => {
 const raw = localStorage.getItem('user');
 if (raw) {
 try {
 const u = JSON.parse(raw);
 setIsAdmin(!!u.isAdmin);
 setName(u.name ?? '');
 setPseudo(u.pseudo ?? '');
 setUserEmail(u.email ?? '');
 setLevel(u.level ?? 'intermediaire');
 } catch { /* ignoré */ }
 }
 });

 // Load badges (check + list)
 fetch('/api/badges', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
 .then(r => r.json())
 .then(data => { if (data.badges) setBadges(data.badges); })
 .catch(() => {});

 fetch('/api/badges', { headers: { Authorization: `Bearer ${token}` } })
 .then(r => r.json())
 .then(data => {
 if (data.badges) setBadges(data.badges);
 if (data.progress) setBadgeProgress(data.progress);
 })
 .catch(() => {});

 fetch('/api/social/profile', { headers: { Authorization: `Bearer ${token}` } })
 .then(r => r.json())
 .then(data => {
 if (data.profile) {
 setSocialProfile(data.profile);
 if (data.profile.isMe && (data.profile.profileVisibility === 'private' || data.profile.profileVisibility === 'public')) {
 setProfileVisibility(data.profile.profileVisibility);
 }
 }
 })
 .catch(() => {});

 // Load physical data
 fetch('/api/user/physical', { headers: { Authorization: `Bearer ${token}` } })
 .then(r => r.json())
 .then(data => {
 const latest = data.entries?.[0];
 if (latest) {
 if (latest.weight) setWeight(String(latest.weight));
 if (latest.height) setHeight(String(latest.height));
 }
 })
 .catch(() => {});

 // Load equipment/goal
 fetch('/api/user/equipment', { headers: { Authorization: `Bearer ${token}` } })
 .then(r => r.json())
 .then(data => {
 const ed = data.equipmentData ?? {};
 setEquipmentData(ed);
 if (ed.goal) setGoal(ed.goal as string);
 })
 .catch(() => {});

 // Load real stats
 fetch('/api/workouts/list', { headers: { Authorization: `Bearer ${token}` } })
 .then(r => r.json())
 .then(data => {
 const workouts = data.workouts ?? [];
 setTotalWorkouts(workouts.length);
 const sessions = workouts.reduce((acc: number, w: { sessions?: unknown[] }) => acc + (w.sessions?.length ?? 0), 0);
 setTotalSessions(sessions);
 })
 .catch(() => {});
 }, []);

 const triggerAvatarPicker = () => {
 if (!uploadingAvatar) avatarInputRef.current?.click();
 };

 const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (!file) return;
 const token = localStorage.getItem('token');
 if (!token) return;
 setUploadingAvatar(true);
 setFeedback(null);
 try {
 const formData = new FormData();
 formData.append('avatar', file);
 const response = await fetch('/api/user/avatar', {
 method: 'POST',
 headers: { Authorization: `Bearer ${token}` },
 body: formData,
 });
 const data = await response.json().catch(() => ({}));
 if (response.ok && data.user) {
 setProfileImageUrl(data.profileImageUrl ?? null);
 localStorage.setItem('user', JSON.stringify(data.user));
 setFeedback({ ok: true, msg: 'Photo de profil mise a jour' });
 } else {
 setFeedback({ ok: false, msg: data.error ?? 'Impossible de mettre a jour la photo' });
 }
 } catch {
 setFeedback({ ok: false, msg: 'Erreur reseau pendant l upload de la photo' });
 } finally {
 setUploadingAvatar(false);
 event.target.value = '';
 }
 };

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();
 setSaving(true);
 setFeedback(null);
 try {
 const token = localStorage.getItem('token');
 const [res] = await Promise.all([
 fetch('/api/user/update', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ pseudo, name, profileVisibility }),
 }),
 weight || height
 ? fetch('/api/user/physical', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ weight: weight ? parseFloat(weight) : undefined, height: height ? parseFloat(height) : undefined }),
 })
 : Promise.resolve(),
 fetch('/api/user/equipment', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ equipmentData: { ...equipmentData, goal } }),
 }),
 ]);
 const data = await res.json();
 if (res.ok) {
 setPseudo(data.user.pseudo ?? '');
 setName(data.user.name ?? '');
 const stored = localStorage.getItem('user');
 if (stored) {
 try {
 const u = JSON.parse(stored);
 localStorage.setItem('user', JSON.stringify({ ...u, ...data.user }));
 } catch { /* ignoré */ }
 }
 setFeedback({ ok: true, msg: 'Modifications enregistrées ✓' });
 setTimeout(() => setFeedback(null), 3000);
 } else {
 setFeedback({ ok: false, msg: data.error ?? 'Erreur lors de la sauvegarde' });
 }
 } catch {
 setFeedback({ ok: false, msg: 'Erreur réseau' });
 } finally {
 setSaving(false);
 }
 };

 return (
 <main className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
 <div className="max-w-4xl">
 <div className="mb-5">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <h1 className="ios-section-title text-gray-900">Profil</h1>
 <div className="flex flex-wrap gap-2">
 <button onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="px-4 py-2.5 rounded-xl bg-gray-900 text-sm font-semibold text-white hover:bg-gray-700 transition">Modifier le profil</button>
 <button onClick={triggerAvatarPicker} disabled={uploadingAvatar} className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-60">{uploadingAvatar ? 'Upload...' : 'Modifier la photo de profil'}</button>
 <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

 {/* Colonne gauche — avatar */}
 <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-5">
 <UserAvatar src={profileImageUrl} name={pseudo || name || userEmail} size="xl" />
 <div className="text-center">
 <p className="font-semibold text-gray-900">{pseudo || name || 'Utilisateur'}</p>
 <p className="text-xs text-gray-400 mt-0.5">{userEmail}</p>
 {socialProfile?.verified && (
 <span className="mt-2 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-700">
 Profil verifie
 </span>
 )}
 </div>
 <LevelBadge xp={badgeProgress?.profile.xp ?? xp} size="md" showProgress />
 <div className="w-full border-t border-gray-100 pt-4 space-y-2">
 {[
 { label: 'Programmes', value: String(totalWorkouts) },
 { label: 'Séances réalisées', value: String(totalSessions) },
 { label: 'Followers', value: String(socialProfile?.counts.followers ?? 0) },
 { label: 'Abonnements', value: String(socialProfile?.counts.following ?? 0) },
 { label: 'Publications', value: String(socialProfile?.counts.posts ?? 0) },
 ].map((s) => (
 <div key={s.label} className="flex justify-between text-sm">
 <span className="text-gray-500">{s.label}</span>
 <span className="font-semibold text-gray-900">{s.value}</span>
 </div>
 ))}
 </div>
 {isAdmin && (
 <button
 onClick={() => router.push('/dashboard/admin')}
 className="w-full mt-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
 </svg>
 Vue admin
 </button>
 )}
 </div>

 {/* Colonne droite — formulaire */}
 <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-6">
 <form ref={formRef} onSubmit={handleSave} className="space-y-0">

 {/* Section identite */}
 <div className="mb-6">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Identite</h2>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Pseudo <span className="text-xs font-normal text-gray-400 ml-1">Identifiant public sur la plateforme</span>
 </label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">@</span>
 <input
 type="text"
 value={pseudo}
 onChange={(e) => setPseudo(e.target.value)}
 className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition text-sm text-gray-900 bg-white"
 placeholder="votre_pseudo"
 />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Prénom / Nom</label>
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition text-sm text-gray-900 bg-white"
 placeholder="Votre prénom ou nom complet"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
 <input
 type="email"
 value={userEmail}
 disabled
 className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
 />
 <p className="text-xs text-gray-400 mt-1">L&apos;email ne peut pas être modifié ici.</p>
 </div>
 </div>
 </div>

 {/* Section physique */}
 <div className="mb-6">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Donnees physiques</h2>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Poids (kg)</label>
 <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="75" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition text-sm text-gray-900 bg-white" />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Taille (cm)</label>
 <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="180" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition text-sm text-gray-900 bg-white" />
 </div>
 </div>
 </div>

 {/* Section objectif */}
 <div className="mb-6">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Objectif sportif</h2>
 <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition text-sm text-gray-900 bg-white">
 <option>Force</option>
 <option>Cardio</option>
 <option>Endurance</option>
 <option>Perte de poids</option>
 <option>Prise de masse</option>
 <option>Bien-etre general</option>
 </select>
 </div>

 <div className="mb-6">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Confidentialite</h2>
 <label className="block text-sm font-medium text-gray-700 mb-1">Visibilite du profil</label>
 <select
 value={profileVisibility}
 onChange={(e) => setProfileVisibility(e.target.value === 'private' ? 'private' : 'public')}
 className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition text-sm text-gray-900 bg-white"
 >
 <option value="public">Public</option>
 <option value="private">Prive</option>
 </select>
 <p className="text-xs text-gray-400 mt-1">En mode prive, seuls vous, vos abonnes, vos amis et les admins peuvent voir vos publications.</p>
 </div>

 {/* Submit */}
 <div className="flex items-center gap-3 pt-2">
 <button
 type="submit"
 disabled={saving}
 className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
 feedback?.ok
 ? 'bg-emerald-600 text-white'
 : 'bg-gray-900 hover:bg-gray-700 text-white disabled:opacity-60'
 }`}
 >
 {saving ? 'Enregistrement…' : feedback?.ok ? feedback.msg : 'Enregistrer'}
 </button>
 <button type="button" className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition">
 Annuler
 </button>
 {feedback && !feedback.ok && (
 <p className="text-sm text-red-500">{feedback.msg}</p>
 )}
 </div>
 </form>
 </div>
 </div>

 <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="bg-white border border-gray-200 rounded-xl p-6">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Progression sociale et hebdo</h2>
 <div className="grid grid-cols-2 gap-3">
 <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
 <p className="text-xs text-gray-500">XP</p>
 <p className="mt-1 text-xl font-black text-gray-900">{badgeProgress?.profile.xp ?? socialProfile?.xp ?? 0}</p>
 </div>
 <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
 <p className="text-xs text-gray-500">Streak</p>
 <p className="mt-1 text-xl font-black text-gray-900">{badgeProgress?.profile.loginStreak ?? 0} j</p>
 </div>
 <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
 <p className="text-xs text-gray-500">Seances 7j</p>
 <p className="mt-1 text-xl font-black text-gray-900">{socialProfile?.counts.weeklySessions ?? 0}</p>
 </div>
 <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
 <p className="text-xs text-gray-500">Posts 7j</p>
 <p className="mt-1 text-xl font-black text-gray-900">{socialProfile?.counts.weeklyPosts ?? 0}</p>
 </div>
 </div>
 {badgeProgress && (
 <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
 <p className="font-semibold">Prochains paliers</p>
 <p className="mt-1">Sessions: {badgeProgress.nextMilestones.sessions} · Streak: {badgeProgress.nextMilestones.streak} · XP: {badgeProgress.nextMilestones.xp}</p>
 </div>
 )}
 </div>

 <div className="bg-white border border-gray-200 rounded-xl p-6">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Records publics</h2>
 <div className="space-y-3">
 {(socialProfile?.bestPerformances ?? []).length === 0 && (
 <p className="text-sm text-gray-500">Aucune performance publique validee pour le moment.</p>
 )}
 {(socialProfile?.bestPerformances ?? []).map((perf) => (
 <div key={perf.exercise} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
 <div className="flex items-center justify-between gap-3">
 <p className="text-sm font-semibold text-gray-900">{perf.exercise}</p>
 <p className="text-sm font-black text-gray-900">{perf.score} {perf.unit}</p>
 </div>
 <p className="mt-1 text-xs text-gray-500">{perf.spotName}{perf.spotCity ? `, ${perf.spotCity}` : ''}</p>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Badges */}
 <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
 Badges ({badges.length}/{ALL_BADGES.length})
 </h2>

 {/* Badge detail modal */}
 {selectedBadge && (() => {
 const def = ALL_BADGES.find((b) => b.code === selectedBadge);
 const earned = badges.find((b) => b.code === selectedBadge);
 if (!def) return null;
 return (
 <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-5 relative">
 <button
 onClick={() => setSelectedBadge(null)}
 className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg leading-none"
 >
 &times;
 </button>
 <div className="flex items-center gap-4 mb-3">
 <span className={`text-4xl ${earned ? '' : 'grayscale opacity-50'}`}>{def.icon}</span>
 <div>
 <p className="text-base font-bold text-gray-900">{def.label}</p>
 {earned ? (
 <p className="text-xs text-emerald-600 font-semibold">Obtenu le {new Date(earned.earnedAt).toLocaleDateString('fr-FR')}</p>
 ) : (
 <p className="text-xs text-gray-400 font-semibold">Non débloqué</p>
 )}
 </div>
 </div>
 <p className="text-sm text-gray-700 mb-2">{def.description}</p>
 <div className="flex items-center gap-2 mt-2">
 <span className="text-xs font-semibold text-gray-400 uppercase">Condition :</span>
 <span className={`text-xs font-medium px-2 py-1 rounded-full ${earned ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
 {def.condition}
 </span>
 </div>
 </div>
 );
 })()}

 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
 {ALL_BADGES.map((def) => {
 const earned = badges.find((b) => b.code === def.code);
 const isSelected = selectedBadge === def.code;
 return (
 <button
 key={def.code}
 onClick={() => setSelectedBadge(isSelected ? null : def.code)}
 className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition ${
 isSelected
 ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
 : earned
 ? 'bg-gray-50 border-gray-100 hover:border-gray-300'
 : 'bg-gray-50 border-gray-100 opacity-50 hover:opacity-75'
 }`}
 >
 <span className={`text-2xl ${earned ? '' : 'grayscale'}`}>{def.icon}</span>
 <div className="min-w-0">
 <p className={`text-sm font-medium truncate ${earned ? 'text-gray-900' : 'text-gray-400'}`}>{def.label}</p>
 {earned ? (
 <p className="text-xs text-emerald-600">{new Date(earned.earnedAt).toLocaleDateString('fr-FR')}</p>
 ) : (
 <p className="text-xs text-gray-400">Verrouillé</p>
 )}
 </div>
 </button>
 );
 })}
 </div>
 </div>
 </div>
 </main>
 );
}
