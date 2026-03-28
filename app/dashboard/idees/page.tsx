'use client';

import { useCallback, useEffect, useState } from 'react';

type SuggestionRow = {
 id: string;
 text: string;
 category: string;
 status: string;
 createdAt: string;
};

const CATEGORIES = [
 { value: 'general', label: 'General' },
 { value: 'ui', label: 'Design / UI' },
 { value: 'fonctionnalite', label: 'Nouvelle fonctionnalite' },
 { value: 'bug', label: 'Probleme a corriger' },
 { value: 'performance', label: 'Vitesse / fluidite' },
];

function authHeader(): HeadersInit {
 const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
 return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function statusBadge(status: string) {
 if (status === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
 if (status === 'reviewed') return 'bg-amber-50 text-amber-700 border-amber-200';
 return 'bg-slate-50 text-slate-700 border-slate-200';
}

function statusLabel(status: string) {
 if (status === 'done') return 'Mis en place';
 if (status === 'reviewed') return 'En cours d etude';
 return 'Nouvelle idee';
}

export default function IdeesPage() {
 const [text, setText] = useState('');
 const [category, setCategory] = useState('general');
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState('');
 const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);

 const loadSuggestions = useCallback(async () => {
 setLoading(true);
 setError('');
 try {
 const res = await fetch('/api/suggestions', { headers: authHeader() });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 setError(data.error || 'Impossible de charger vos idees.');
 } else {
 setSuggestions(data.suggestions ?? []);
 if (data.unavailable) {
 setError('La rubrique est prete cote interface, mais la migration base de donnees doit encore etre appliquee.');
 }
 }
 } catch {
 setError('Erreur reseau');
 }
 setLoading(false);
 }, []);

 useEffect(() => {
 loadSuggestions();
 }, [loadSuggestions]);

 const submit = async (event: React.FormEvent) => {
 event.preventDefault();
 if (text.trim().length < 8) {
 setError('Decris un peu plus ton idee.');
 return;
 }
 setSubmitting(true);
 setError('');
 setSuccess('');
 try {
 const res = await fetch('/api/suggestions', {
 method: 'POST',
 headers: authHeader(),
 body: JSON.stringify({ text: text.trim(), category }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 setError(data.error || 'Impossible denvoyer ton idee.');
 } else {
 setText('');
 setCategory('general');
 setSuccess('Idee envoyee.');
 setSuggestions((prev) => [data.suggestion, ...prev]);
 }
 } catch {
 setError('Erreur reseau');
 }
 setSubmitting(false);
 };

 return (
 <div className="min-h-screen bg-gray-50">
 <div className="bg-white border-b border-gray-100 px-4 md:px-8 py-6">
 <h1 className="text-2xl font-black text-gray-900 tracking-tight">Vos idees</h1>
 <p className="text-sm text-gray-500 mt-1 max-w-2xl">
 Propose des ameliorations produit, des corrections ou de nouvelles fonctionnalites. Les idees arrivent dans l espace admin.
 </p>
 </div>

 <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
 <section className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
 <div className="mb-5">
 <h2 className="text-lg font-bold text-gray-900">Proposer une idee</h2>
 <p className="text-sm text-gray-500 mt-1">Explique ce qui bloque, ce qui manque ou ce qui pourrait rendre l appli meilleure.</p>
 </div>

 <form onSubmit={submit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Categorie</label>
 <select
 value={category}
 onChange={(event) => setCategory(event.target.value)}
 className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
 >
 {CATEGORIES.map((item) => (
 <option key={item.value} value={item.value}>{item.label}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Ton idee</label>
 <textarea
 value={text}
 onChange={(event) => setText(event.target.value)}
 rows={7}
 maxLength={1200}
 placeholder="Exemple : ajouter des filtres par ville dans le classement, rendre la carte plus fluide, pouvoir sauvegarder des spots favoris..."
 className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none resize-y focus:border-gray-400"
 />
 <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-400">
 <span>Minimum 8 caracteres.</span>
 <span>{text.length}/1200</span>
 </div>
 </div>

 {error && <p className="text-sm text-red-600">{error}</p>}
 {success && <p className="text-sm text-emerald-600">{success}</p>}

 <button
 type="submit"
 disabled={submitting}
 className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
 >
 {submitting ? 'Envoi...' : 'Envoyer mon idee'}
 </button>
 </form>
 </section>

 <section className="space-y-4">
 <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
 <h2 className="text-lg font-bold text-gray-900">Suivi</h2>
 <p className="text-sm text-gray-500 mt-1">Tu peux suivre ici le statut de tes dernieres propositions.</p>
 </div>

 <div className="space-y-3">
 {loading && Array.from({ length: 3 }).map((_, index) => (
 <div key={index} className="bg-white border border-gray-200 rounded-2xl p-4 animate-pulse">
 <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
 <div className="h-3 bg-gray-100 rounded w-full mb-2" />
 <div className="h-3 bg-gray-100 rounded w-4/5" />
 </div>
 ))}

 {!loading && suggestions.length === 0 && (
 <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-6 text-center text-sm text-gray-500">
 Aucune idee envoyee pour le moment.
 </div>
 )}

 {!loading && suggestions.map((suggestion) => (
 <article key={suggestion.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-[0_8px_25px_rgba(0,0,0,0.03)]">
 <div className="flex items-start justify-between gap-3 mb-3">
 <div>
 <p className="text-xs uppercase tracking-[0.18em] text-gray-400 font-semibold">{suggestion.category}</p>
 <p className="text-xs text-gray-400 mt-1">{new Date(suggestion.createdAt).toLocaleString('fr-FR')}</p>
 </div>
 <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadge(suggestion.status)}`}>
 {statusLabel(suggestion.status)}
 </span>
 </div>
 <p className="text-sm leading-6 text-gray-700 whitespace-pre-wrap break-words">{suggestion.text}</p>
 </article>
 ))}
 </div>
 </section>
 </div>
 </div>
 );
}