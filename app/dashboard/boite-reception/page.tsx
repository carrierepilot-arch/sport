'use client';

import { useCallback, useEffect, useState } from 'react';

type InboxMessage = {
  id: string;
  content: string;
  read: boolean;
  createdAt: string;
  heure: string;
  sender: {
    id: string;
    display: string;
    adminLevel: number;
  };
};

function authHeader(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export default function BoiteReceptionPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const chargerInbox = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/admin-inbox', { headers: authHeader() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Impossible de charger vos messages admin.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setMessages((data.messages ?? []) as InboxMessage[]);
      setUnreadCount(Number(data.unreadCount ?? 0));
      setError('');
    } catch {
      setError('Erreur reseau.');
    } finally {
      setLoading(false);
    }
  }, []);

  const marquerToutLu = useCallback(async () => {
    if (busy || unreadCount <= 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/messages/admin-inbox', {
        method: 'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
        setUnreadCount(0);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, unreadCount]);

  const marquerMessageLu = useCallback(async (messageId: string) => {
    const target = messages.find((m) => m.id === messageId);
    if (!target || target.read) return;

    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, read: true } : m)));
    setUnreadCount((prev) => Math.max(0, prev - 1));

    const res = await fetch('/api/messages/admin-inbox', {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    });

    if (!res.ok) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, read: false } : m)));
      setUnreadCount((prev) => prev + 1);
    }
  }, [messages]);

  useEffect(() => {
    void chargerInbox();
    const interval = setInterval(() => {
      void chargerInbox();
    }, 10000);
    return () => clearInterval(interval);
  }, [chargerInbox]);

  return (
    <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">Messages officiels</p>
            <h1 className="mt-1 text-xl sm:text-2xl font-black text-gray-900">Boite de reception</h1>
            <p className="mt-2 text-sm text-gray-500">
              Retrouvez ici les messages envoyes par les administrateurs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-blue-50 text-blue-700 text-sm font-bold">
              {unreadCount}
            </span>
            <button
              onClick={() => void marquerToutLu()}
              disabled={busy || unreadCount === 0}
              className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              Tout marquer lu
            </button>
          </div>
        </div>
      </section>

      {loading && (
        <section className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500 text-center">
          Chargement de la boite de reception...
        </section>
      )}

      {!loading && error && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      )}

      {!loading && !error && messages.length === 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500 text-center">
          Aucun message admin pour le moment.
        </section>
      )}

      {!loading && !error && messages.length > 0 && (
        <section className="space-y-3">
          {messages.map((m) => (
            <article
              key={m.id}
              className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition ${
                m.read ? 'border-gray-200 bg-white' : 'border-blue-200 bg-blue-50/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{m.sender.display}</p>
                  <p className="text-xs text-gray-500">Admin niveau {m.sender.adminLevel}</p>
                </div>
                <div className="text-right">
                  {!m.read && (
                    <span className="inline-flex items-center rounded-full bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5">
                      Nouveau
                    </span>
                  )}
                  <p className="mt-1 text-xs text-gray-400">{m.heure}</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{m.content}</p>

              {!m.read && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => void marquerMessageLu(m.id)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    Marquer comme lu
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
