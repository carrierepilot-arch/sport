'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard/profil',        label: 'Profil',       icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { href: '/dashboard/entrainement',  label: 'Entrainement', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { href: '/dashboard/reseau',        label: 'Réseau',       icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/dashboard/carte',         label: 'Carte',        icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/dashboard/analyse',       label: 'Analyse',      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname     = usePathname();
  const router       = useRouter();
  const [userName,    setUserName]    = useState('');
  const [userPseudo,  setUserPseudo]  = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Charger les infos utilisateur depuis localStorage
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setUserName(u.name ?? u.email ?? '');
        setUserPseudo(u.pseudo ?? '');
      } catch { /* ignoré */ }
    }
  }, []);

  // Synchroniser les infos si localStorage change (ex: après sauvegarde du profil)
  useEffect(() => {
    const onStorage = () => {
      const raw = localStorage.getItem('user');
      if (raw) {
        try {
          const u = JSON.parse(raw);
          setUserName(u.name ?? u.email ?? '');
          setUserPseudo(u.pseudo ?? '');
        } catch { /* ignoré */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Polling du compte de demandes d'amis en attente + messages non lus
  const fetchPending = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    try {
      const [friendRes, msgRes] = await Promise.all([
        fetch('/api/friends/pending-count', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/messages/conversations', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (friendRes.ok) {
        const data = await friendRes.json();
        setPendingCount(data.count ?? 0);
      }
      if (msgRes.ok) {
        const data = await msgRes.json();
        const total = (data.conversations ?? []).reduce((acc: number, c: { nonLu: number }) => acc + (c.nonLu ?? 0), 0);
        setUnreadMessages(total);
      }
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 8000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const handleLogout = () => {
    // Nettoyer le token si présent et rediriger vers login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      sessionStorage.clear();
    }
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── SIDEBAR (desktop only) ── */}
      <aside className="hidden md:flex w-60 bg-white border-r border-gray-200 flex-col fixed inset-y-0 left-0 z-10">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <Link href="/dashboard" className="text-xl font-black tracking-tight text-gray-900">
            SPORT
          </Link>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">Performance platform</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const isReseau = item.href === '/dashboard/reseau';
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
                {isReseau && (pendingCount + unreadMessages) > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs bg-red-500 text-white rounded-full font-bold">
                    {(pendingCount + unreadMessages) > 9 ? '9+' : (pendingCount + unreadMessages)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {userName ? userName[0].toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{userName || 'Utilisateur'}</p>
              <p className="text-xs text-gray-400 truncate">{userPseudo ? `@${userPseudo}` : ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Deconnexion
          </button>
        </div>
      </aside>

      {/* ── CONTENU ── */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen pb-20 md:pb-0">
        {children}
      </div>

      {/* ── BOTTOM NAV (mobile only) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 flex items-stretch safe-area-bottom">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const isReseau = item.href === '/dashboard/reseau';
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative transition-colors ${
                active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
              {isReseau && (pendingCount + unreadMessages) > 0 && (
                <span className="absolute top-1.5 right-1/4 translate-x-1/2 inline-flex items-center justify-center w-4 h-4 text-[9px] bg-red-500 text-white rounded-full font-bold">
                  {(pendingCount + unreadMessages) > 9 ? '9+' : (pendingCount + unreadMessages)}
                </span>
              )}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="text-[10px] font-medium leading-none">Sortir</span>
        </button>
      </nav>
    </div>
  );
}
