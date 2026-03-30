'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { clearStoredSession, getStoredSession } from '@/lib/clientRuntime';
import { UserAvatar } from '@/components/UserAvatar';

const PRIMARY_NAV_ITEMS = [
 { href: '/dashboard', label: 'Accueil', icon: 'M3 10.75L12 3l9 7.75M5.25 9.5V20a1 1 0 001 1h4.5v-6.5h2.5V21h4.5a1 1 0 001-1V9.5' },
 { href: '/dashboard/entrainement', label: 'Programmes', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
 { href: '/dashboard/analyse', label: 'Progression', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
 { href: '/dashboard/profil', label: 'Profil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

const SECONDARY_NAV_ITEMS = [
 { href: '/dashboard/social', label: 'Social', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z' },
 { href: '/dashboard/carte', label: 'Carte', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
 { href: '/dashboard/classement', label: 'Classement', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
 { href: '/dashboard/idees', label: 'Idees', icon: 'M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const MOBILE_TABS = [
 { href: '/dashboard', label: 'Accueil', icon: 'M3 10.75L12 3l9 7.75M5.25 9.5V20a1 1 0 001 1h4.5v-6.5h2.5V21h4.5a1 1 0 001-1V9.5' },
 { href: '/dashboard/entrainement', label: 'Programmes', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
 { href: '/dashboard/social', label: 'Social', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z' },
 { href: '/dashboard/analyse', label: 'Progress.', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
 { href: '/dashboard/profil', label: 'Profil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

type SectionStatusPayload = {
 key: string;
 label: string;
 paths: string[];
 status: 'active' | 'disabled' | 'standby' | 'stopped' | 'hidden';
 hidden: boolean;
 maintenanceMessage: string | null;
 updatedAt: string;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
 const pathname = usePathname();
 const router = useRouter();
 const [authChecked, setAuthChecked] = useState(false);
 const [isAuthenticated, setIsAuthenticated] = useState(false);
 const [userName, setUserName] = useState('');
 const [userPseudo, setUserPseudo] = useState('');
 const [userProfileImageUrl, setUserProfileImageUrl] = useState<string | null>(null);
 const [isAdmin, setIsAdmin] = useState(false);
 const [pendingCount, setPendingCount] = useState(0);
 const [unreadMessages, setUnreadMessages] = useState(0);
 const [unreadAdminMessages, setUnreadAdminMessages] = useState(0);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
 const [sectionControls, setSectionControls] = useState<SectionStatusPayload[]>([]);

 const applyUserFromStorage = useCallback((raw: string | null) => {
  if (!raw) return;
  try {
   const u = JSON.parse(raw);
   const t = setTimeout(() => {
    setUserName(u.name ?? u.email ?? '');
    setUserPseudo(u.pseudo ?? '');
    setUserProfileImageUrl(u.profileImageUrl ?? null);
    setIsAdmin(u.isAdmin === true);
   }, 0);
   return () => clearTimeout(t);
  } catch {
   return;
  }
 }, []);

 // Client-side auth guard for all dashboard routes.
 useEffect(() => {
  const t = setTimeout(() => {
     const token = getStoredSession()?.token ?? null;
   if (!token) {
    setIsAuthenticated(false);
    setAuthChecked(true);
    router.replace('/login');
    return;
   }

   if (typeof window !== 'undefined' && window.navigator.onLine && token.startsWith('offline-')) {
    clearStoredSession();
    setIsAuthenticated(false);
    setAuthChecked(true);
    router.replace('/login');
    return;
   }

   if (typeof window !== 'undefined' && window.navigator.onLine) {
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
     .then((r) => {
      if (!r.ok) throw new Error('invalid');
      return r.json();
     })
     .then((data) => {
      if (data?.user) {
       localStorage.setItem('user', JSON.stringify(data.user));
      }
      setIsAuthenticated(true);
      setAuthChecked(true);
     })
     .catch(() => {
      clearStoredSession();
      setIsAuthenticated(false);
      setAuthChecked(true);
      router.replace('/login');
     });
    return;
   }

   setIsAuthenticated(true);
   setAuthChecked(true);
  }, 0);
  return () => clearTimeout(t);
 }, [router]);

 useEffect(() => {
  const token = getStoredSession()?.token ?? null;
  if (!token) return;

  fetch('/api/sections/status', {
   headers: { Authorization: `Bearer ${token}` },
  })
   .then((r) => r.json())
   .then((data) => {
    if (Array.isArray(data.sections)) {
     setSectionControls(data.sections as SectionStatusPayload[]);
    }
   })
   .catch(() => {
    setSectionControls([]);
   });
 }, []);

 // Charger les infos utilisateur depuis localStorage
 useEffect(() => {
   const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
   const cleanup = applyUserFromStorage(raw);
   return () => {
    if (cleanup) cleanup();
   };
 }, [applyUserFromStorage]);

 // Synchroniser les infos si localStorage change (ex: après sauvegarde du profil)
 useEffect(() => {
 const onStorage = () => {
 const raw = localStorage.getItem('user');
 applyUserFromStorage(raw);
 };
 window.addEventListener('storage', onStorage);
 return () => window.removeEventListener('storage', onStorage);
 }, [applyUserFromStorage]);

 // Polling du compte de demandes d'amis en attente + messages non lus
 const fetchPending = useCallback(async () => {
 const token = getStoredSession()?.token ?? null;
 if (!token) return;
 try {
 const [friendRes, msgRes, inboxRes] = await Promise.all([
 fetch('/api/friends/pending-count', { headers: { Authorization: `Bearer ${token}` } }),
 fetch('/api/messages/conversations', { headers: { Authorization: `Bearer ${token}` } }),
 fetch('/api/messages/admin-inbox/unread-count', { headers: { Authorization: `Bearer ${token}` } }),
 ]);
 let directUnread = 0;
 let adminUnread = 0;
 if (friendRes.ok) {
 const data = await friendRes.json();
 setPendingCount(data.count ?? 0);
 }
 if (msgRes.ok) {
 const data = await msgRes.json();
 directUnread = (data.conversations ?? []).reduce((acc: number, c: { nonLu: number }) => acc + (c.nonLu ?? 0), 0);
 }
 if (inboxRes.ok) {
 const data = await inboxRes.json();
 adminUnread = Number(data.unreadCount ?? 0);
 }
 setUnreadAdminMessages(adminUnread);
 setUnreadMessages(directUnread + adminUnread);
 } catch { /* silencieux */ }
 }, []);

 useEffect(() => {
 const t = setTimeout(() => {
  void fetchPending();
 }, 0);
 const interval = setInterval(fetchPending, 8000);
 return () => {
  clearTimeout(t);
  clearInterval(interval);
 };
 }, [fetchPending]);

 const handleLogout = () => {
 // Clear local auth state then redirect to login.
 clearStoredSession();
 if (typeof window !== 'undefined') sessionStorage.clear();
 router.push('/login');
 };

 const findSectionForPath = useCallback((currentPath: string) => {
  const ranked = [...sectionControls]
   .flatMap((section) => section.paths.map((p) => ({ section, path: p })))
   .sort((a, b) => b.path.length - a.path.length);

  return ranked.find(({ path }) => currentPath === path || currentPath.startsWith(path + '/'))?.section ?? null;
 }, [sectionControls]);

 const currentSection = useMemo(() => findSectionForPath(pathname), [findSectionForPath, pathname]);
 const sectionBlockedForUser = useMemo(() => {
  if (!currentSection) return false;
  if (isAdmin) return false;
  return currentSection.status !== 'active';
 }, [currentSection, isAdmin]);

 const visiblePrimaryNavItems = useMemo(
  () => PRIMARY_NAV_ITEMS.filter((item) => findSectionForPath(item.href)?.status !== 'hidden'),
  [findSectionForPath],
 );

 const visibleSecondaryNavItems = useMemo(
  () => SECONDARY_NAV_ITEMS.filter((item) => findSectionForPath(item.href)?.status !== 'hidden'),
  [findSectionForPath],
 );

 const visibleMobileTabs = useMemo(
  () => MOBILE_TABS.filter((item) => findSectionForPath(item.href)?.status !== 'hidden'),
  [findSectionForPath],
 );

 if (!authChecked) {
  return (
   <div className="min-h-screen bg-[var(--ios-bg)] flex items-center justify-center">
	<div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" aria-label="Chargement" />
   </div>
  );
 }

 if (!isAuthenticated) {
  return (
   <div className="min-h-screen bg-[var(--ios-bg)]" aria-hidden="true" />
  );
 }

 if (sectionBlockedForUser && currentSection) {
  return (
   <div className="min-h-screen bg-[var(--ios-bg)] flex items-center justify-center p-6">
    <div className="w-full max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8 text-center shadow-sm">
     <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Maintenance</p>
     <h1 className="mt-2 text-2xl font-black text-amber-900">Rubrique indisponible</h1>
     <p className="mt-3 text-sm text-amber-800">
      {currentSection.maintenanceMessage || 'Cette rubrique est temporairement indisponible.'}
     </p>
     <button
      onClick={() => router.push('/dashboard')}
      className="mt-6 inline-flex items-center justify-center rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
     >
      Retour a l accueil
     </button>
    </div>
   </div>
  );
 }

 return (
 <div className="min-h-screen bg-[var(--ios-bg)] flex overflow-x-hidden apple-dashboard">

 {/* MOBILE HEADER */}
 <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 ios-nav-glass flex items-center px-4 gap-3 shadow-sm">
 <button
 onClick={() => setDrawerOpen(true)}
 className="p-2 -ml-1 rounded-xl hover:bg-gray-100/90 transition-colors"
 aria-label="Ouvrir le menu"
 >
 <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
 </svg>
 </button>
 <Link href="/dashboard">
 <img src="/logo-levelflow.png" alt="Levelflow" className="h-7 w-auto object-contain" />
 </Link>
 {(pendingCount + unreadMessages) > 0 && (
 <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs bg-red-500 text-white rounded-full font-bold">
 {(pendingCount + unreadMessages) > 9 ? '9+' : pendingCount + unreadMessages}
 </span>
 )}
 </header>

 {/* MOBILE DRAWER */}
 {drawerOpen && (
 <div className="md:hidden fixed inset-0 z-40 flex">
 {/* Backdrop */}
 <div
 className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
 onClick={() => setDrawerOpen(false)}
 />
 {/* Drawer panel */}
 <aside className="relative w-72 max-w-[85vw] bg-white/95 backdrop-blur-md flex flex-col h-full shadow-2xl">
 {/* Header */}
 <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
 <Link href="/dashboard">
 <img src="/logo-levelflow.png" alt="Levelflow" className="h-8 w-auto object-contain" />
 </Link>
 <button
 onClick={() => setDrawerOpen(false)}
 className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
 aria-label="Fermer"
 >
 <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 {/* User info */}
 <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
 <UserAvatar src={userProfileImageUrl} name={userName || userPseudo || 'Utilisateur'} size="sm" />
 <div className="min-w-0">
 <p className="text-sm font-semibold text-gray-900 truncate">{userName || 'Utilisateur'}</p>
 <p className="text-xs text-gray-400 truncate">{userPseudo ? `@${userPseudo}` : ''}</p>
 </div>
 </div>
 {/* Nav */}
 <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
 <div>
 <p className="px-2 pb-2 text-[11px] uppercase tracking-[0.14em] text-gray-400 font-semibold">Essentiels</p>
 <div className="space-y-1">
 {visiblePrimaryNavItems.map((item) => {
 const active = item.href === '/dashboard' ? pathname === '/dashboard' : (pathname === item.href || pathname.startsWith(item.href + '/'));
 return (
 <Link
 key={item.href}
 href={item.href}
 onClick={() => setDrawerOpen(false)}
 className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
 active
 ? 'bg-gray-900 text-white shadow-sm'
 : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
 }`}
 >
 <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
 </svg>
 {item.label}
 </Link>
 );
 })}
 </div>
 </div>
 <div>
 <p className="px-2 pb-2 text-[11px] uppercase tracking-[0.14em] text-gray-400 font-semibold">Plus</p>
 <div className="space-y-1">
 {visibleSecondaryNavItems.map((item) => {
 const active = item.href === '/dashboard' ? pathname === '/dashboard' : (pathname === item.href || pathname.startsWith(item.href + '/'));
 const isSocial = item.href === '/dashboard/social';
 const isInbox = item.href === '/dashboard/boite-reception';
 return (
 <Link
 key={item.href}
 href={item.href}
 onClick={() => setDrawerOpen(false)}
 className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
 active
 ? 'bg-gray-900 text-white shadow-sm'
 : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
 }`}
 >
 <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
 </svg>
 {item.label}
 {isSocial && (pendingCount + unreadMessages) > 0 && (
 <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs bg-red-500 text-white rounded-full font-bold">
 {(pendingCount + unreadMessages) > 9 ? '9+' : pendingCount + unreadMessages}
 </span>
 )}
 {isInbox && unreadAdminMessages > 0 && (
 <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs bg-red-500 text-white rounded-full font-bold">
 {unreadAdminMessages > 9 ? '9+' : unreadAdminMessages}
 </span>
 )}
 </Link>
 );
 })}
 </div>
 </div>
 {isAdmin && (
 <Link
 href="/dashboard/admin"
 className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
 pathname === '/dashboard/admin' || pathname.startsWith('/dashboard/admin/')
 ? 'bg-orange-600 text-white shadow-sm'
 : 'text-orange-600 hover:bg-orange-50'
 }`}
 >
 <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
 Admin
 </Link>
 )}
 </nav>
 {/* Logout */}
 <div className="border-t border-gray-100 p-4">
 <button
 onClick={handleLogout}
 className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
 </svg>
 Deconnexion
 </button>
 </div>
 </aside>
 </div>
 )}

 {/* SIDEBAR (desktop) */}
 <aside className={`hidden md:flex ${sidebarCollapsed ? 'w-16' : 'w-56'} bg-white/90 backdrop-blur-md border-r border-gray-100 flex-col fixed inset-y-0 left-0 z-10 transition-[width] duration-200 overflow-hidden`}>
 {/* Logo + hamburger toggle */}
 <div className="px-3 py-5 border-b border-gray-50 flex items-center gap-3 flex-shrink-0">
 <button
 onClick={() => setSidebarCollapsed(v => !v)}
 className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
 aria-label="Reduire le menu"
 >
 <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
 </svg>
 </button>
 {!sidebarCollapsed && (
 <Link href="/dashboard">
 <img src="/logo-levelflow.jpg" alt="Levelflow" className="h-7 w-auto object-contain" />
 </Link>
 )}
 </div>

 {/* Nav */}
 <nav className="flex-1 px-2 py-4 space-y-3 overflow-y-auto overflow-x-hidden">
 <div>
 {!sidebarCollapsed && <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.14em] text-gray-400 font-semibold">Essentiels</p>}
 <div className="space-y-0.5">
 {visiblePrimaryNavItems.map((item) => {
 const active = item.href === '/dashboard' ? pathname === '/dashboard' : (pathname === item.href || pathname.startsWith(item.href + '/'));
 return (
 <Link
 key={item.href}
 href={item.href}
 title={sidebarCollapsed ? item.label : undefined}
 className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm font-medium transition-all ${
 active
 ? 'bg-gray-900 text-white shadow-sm'
 : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
 }`}
 >
 <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
 </svg>
 {!sidebarCollapsed && (
 <>
 <span className="truncate">{item.label}</span>
 </>
 )}
 </Link>
 );
 })}
 </div>
 </div>
 <div>
 {!sidebarCollapsed && <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.14em] text-gray-400 font-semibold">Plus</p>}
 <div className="space-y-0.5">
 {visibleSecondaryNavItems.map((item) => {
 const active = item.href === '/dashboard' ? pathname === '/dashboard' : (pathname === item.href || pathname.startsWith(item.href + '/'));
 const isSocial = item.href === '/dashboard/social';
 const isInbox = item.href === '/dashboard/boite-reception';
 return (
 <Link
 key={item.href}
 href={item.href}
 title={sidebarCollapsed ? item.label : undefined}
 className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm font-medium transition-all ${
 active
 ? 'bg-gray-900 text-white shadow-sm'
 : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
 }`}
 >
 <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
 </svg>
 {!sidebarCollapsed && (
 <>
 <span className="truncate">{item.label}</span>
 {isSocial && (pendingCount + unreadMessages) > 0 && (
 <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs bg-red-500 text-white rounded-full font-bold">
 {(pendingCount + unreadMessages) > 9 ? '9+' : pendingCount + unreadMessages}
 </span>
 )}
 {isInbox && unreadAdminMessages > 0 && (
 <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs bg-red-500 text-white rounded-full font-bold">
 {unreadAdminMessages > 9 ? '9+' : unreadAdminMessages}
 </span>
 )}
 </>
 )}
 </Link>
 );
 })}
 </div>
 </div>
 {isAdmin && (
 <Link
 href="/dashboard/admin"
 title={sidebarCollapsed ? 'Admin' : undefined}
 className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm font-medium transition-all ${
 pathname === '/dashboard/admin' || pathname.startsWith('/dashboard/admin/')
 ? 'bg-orange-600 text-white shadow-sm'
 : 'text-orange-500 hover:bg-orange-50'
 }`}
 >
 <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
 {!sidebarCollapsed && <span className="truncate">Admin</span>}
 </Link>
 )}
 </nav>

 {/* User + Logout */}
 {!sidebarCollapsed ? (
 <div className="border-t border-gray-100 p-4 flex-shrink-0">
 <div className="flex items-center gap-3 mb-3">
 <UserAvatar src={userProfileImageUrl} name={userName || userPseudo || 'Utilisateur'} size="sm" />
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
 ) : (
 <div className="border-t border-gray-100 p-2 flex-shrink-0">
 <button
 onClick={handleLogout}
 title="Deconnexion"
 className="w-full flex items-center justify-center p-2.5 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
 </svg>
 </button>
 </div>
 )}
 </aside>

 {/* MAIN CONTENT */}
 <div className={`flex-1 min-w-0 mobile-content-offset ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'} flex flex-col min-h-screen pt-14 md:pt-0 transition-[margin] duration-200`}>
 {children}
 </div>

 {/* Mobile native-like tab bar */}
 <nav className="md:hidden ios-tabbar px-1 py-1.5">
 <div className="grid grid-cols-5 gap-0.5">
 {visibleMobileTabs.map((tab) => {
 const active = tab.href === '/dashboard' ? pathname === '/dashboard' : (pathname === tab.href || pathname.startsWith(tab.href + '/'));
 return (
 <Link
 key={tab.href}
 href={tab.href}
 className={`relative flex flex-col items-center justify-center h-13 text-[9px] font-semibold py-1.5 rounded-xl transition-all ${active ? 'ios-tabbar-active' : 'text-gray-500 hover:bg-white/80'}`}
 >
 <svg className="w-[17px] h-[17px] mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
 </svg>
 <span className="leading-tight truncate w-full text-center">{tab.label}</span>
 </Link>
 );
 })}
 </div>
 </nav>
 </div>
 );
}
