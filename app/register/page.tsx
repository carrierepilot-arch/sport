'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createAndPersistOfflineSession, getStoredSession, persistSession } from '@/lib/clientRuntime';

export default function RegisterPage() {
 const router = useRouter();
 const [name, setName] = useState('');
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 const session = getStoredSession();
 const hasOfflineTokenWhileOnline =
 typeof window !== 'undefined' &&
 window.navigator.onLine &&
 Boolean(session?.token?.startsWith('offline-'));

 if (hasOfflineTokenWhileOnline) {
 return;
 }

 if (session?.token) {
 router.replace('/dashboard');
 }
 }, [router]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 if (password.length < 6) {
 setError('Le mot de passe doit contenir au moins 6 caractères');
 return;
 }
 setLoading(true);
 try {
 const canUseOfflineMode = typeof window !== 'undefined' && !window.navigator.onLine;
 const response = await fetch('/api/auth/register', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ email, password, name }),
 });
 const data = await response.json().catch(() => null);
 if (!response.ok) {
 if (canUseOfflineMode) {
 const offlineSession = await createAndPersistOfflineSession({ email, name });
 if (offlineSession.token) {
 router.push('/dashboard');
 return;
 }
 }
 setError(data?.error || 'Erreur lors de la creation du compte');
 return;
 }
 await persistSession(data.token, data.user);
 router.push('/dashboard');
 } catch {
 const canUseOfflineMode = typeof window !== 'undefined' && !window.navigator.onLine;
 if (canUseOfflineMode) {
 const offlineSession = await createAndPersistOfflineSession({ email, name });
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
 <div className="text-center mb-8">
 <Link href="/" className="inline-flex justify-center mb-4">
 <img src="/logo-levelflow.jpg" alt="Levelflow" className="h-14 w-auto object-contain" />
 </Link>
 <p className="text-gray-500">Creez votre compte gratuitement</p>
 </div>

 <form onSubmit={handleSubmit} className="space-y-5">
 <div>
 <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
 Nom complet
 </label>
 <input
 id="name"
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 required
 className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition"
 placeholder="Jean Dupont"
 />
 </div>

 <div>
 <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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

 <div>
 <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
 Mot de passe
 </label>
 <input
 id="password"
 type="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition"
 placeholder="Minimum 6 caractères"
 />
 </div>

 {error && (
 <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
 {error}
 </div>
 )}

 <button
 type="submit"
 disabled={loading}
 className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-gray-400 text-white font-bold py-3 rounded-2xl transition shadow-[0_10px_20px_rgba(2,132,199,0.35)]"
 >
 {loading ? 'Création du compte...' : "S'inscrire"}
 </button>
 </form>

 <div className="mt-6 pt-6 border-t border-gray-100 text-center">
 <p className="text-gray-500 text-sm">
 Déjà un compte ?{' '}
 <Link href="/login" className="text-sky-600 hover:text-sky-700 font-semibold">
 Se connecter
 </Link>
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}
