'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulation — à connecter plus tard
    await new Promise((r) => setTimeout(r, 600));
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Link href="/" className="inline-block text-3xl font-black tracking-tight text-gray-900 mb-2 hover:text-blue-600 transition">
              SPORT
            </Link>
            <p className="text-gray-500">Réinitialisez votre mot de passe</p>
          </div>

          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📧</div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">Email envoyé !</h3>
              <p className="text-gray-500 text-sm mb-6">Vérifiez votre boîte mail pour réinitialiser votre mot de passe.</p>
              <Link href="/login" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Votre email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
                  placeholder="votre@email.com"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition"
              >
                Envoyer le lien
              </button>

              <div className="text-center mt-2">
                <Link href="/login" className="text-sm text-gray-500 hover:text-blue-600 transition">
                  ← Retour à la connexion
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
