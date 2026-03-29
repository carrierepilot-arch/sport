'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createAndPersistOfflineSession, getStoredSession, persistSession } from '@/lib/clientRuntime';

export default function LoginPage() {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);

 const router = useRouter();

 useEffect(() => {
 const session = getStoredSession();
 if (session?.token) {
 router.replace('/dashboard');
 }
 }, [router]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setLoading(true);

 try {
 const canUseOfflineMode = typeof window !== 'undefined' && !window.navigator.onLine;
 const response = await fetch('/api/auth/login', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ email, password }),
 });

 const data = await response.json().catch(() => null);

 if (!response.ok) {
 if (canUseOfflineMode) {
 const offlineSession = await createAndPersistOfflineSession({ email });
 if (offlineSession.token) {
 router.push('/dashboard');
 return;
 }
 }
 setError(data?.error || 'Erreur de connexion');
 return;
 }

 await persistSession(data.token, data.user);
 router.push('/dashboard');
 } catch {
 const canUseOfflineMode = typeof window !== 'undefined' && !window.navigator.onLine;
 const session = getStoredSession();
 if (session?.token) {
 router.push('/dashboard');
 return;
 }
 if (canUseOfflineMode) {
 const offlineSession = await createAndPersistOfflineSession({ email });
 if (offlineSession.token) {
 router.push('/dashboard');
 return;
 }
 setError('Mode hors ligne indisponible.');
 } else {
 setError('Impossible de joindre le serveur.');
 }
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen flex items-center justify-center px-4 py-8 ios-screen">
 <div className="w-full max-w-md">
 <div className="ios-card p-6 sm:p-8">
 {/* Header */}
 <div className="text-center mb-8">
 <Link href="/" className="inline-block text-3xl font-black tracking-tight text-gray-900 mb-2 hover:text-sky-600 transition">SPORT</Link>
 <p className="text-gray-500">Retrouvez vos entrainements et votre progression en un coup d'oeil</p>
 </div>

 {/* Formulaire */}
 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Email */}
 <div>
 <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
 Email
 </label>
 <input
 id="email"
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition"
 placeholder="votre@email.com"
 />
 </div>

 {/* Mot de passe */}
 <div>
 <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
 Mot de passe
 </label>
 <input
 id="password"
 type="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition"
 placeholder="••••••••"
 />
 </div>

 {/* Erreur */}
 {error && (
 <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
 {error}
 </div>
 )}

 {/* Bouton Connexion */}
 <button
 type="submit"
 disabled={loading}
 className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-2xl transition duration-200 shadow-[0_10px_20px_rgba(2,132,199,0.35)]"
 >
 {loading ? 'Connexion en cours...' : 'Se connecter'}
 </button>
 </form>

 {/* Inscription */}
 <div className="mt-6 pt-6 border-t border-gray-200 text-center">
 <p className="text-gray-600 text-sm">
 Pas de compte ?{' '}
 <Link href="/register" className="text-sky-600 hover:text-sky-700 font-semibold">
 S'inscrire
 </Link>
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}
