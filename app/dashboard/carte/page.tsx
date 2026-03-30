'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface SpotData {
  id: string;
  name: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  _count: { performances: number; regulars: number };
}
interface RegularUser {
  userId: string;
  pseudo: string | null;
  name: string | null;
  isFriend: boolean;
  isMe: boolean;
}
interface LeaderEntry {
  userId: string;
  pseudo: string | null;
  name: string | null;
  score: number;
  unit: string;
  status: string;
}

const EXERCISES = [
  { key: 'tractions', label: 'Tractions', unit: 'reps' },
  { key: 'pompes', label: 'Pompes', unit: 'reps' },
  { key: 'dips', label: 'Dips', unit: 'reps' },
  { key: 'squats', label: 'Squats', unit: 'reps' },
  { key: 'muscle_ups', label: 'Muscle-ups', unit: 'reps' },
  { key: 'tractions_lestees', label: 'Tractions +lest', unit: 'kg' },
  { key: 'dips_lestes', label: 'Dips +lest', unit: 'kg' },
];

function authHeader(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function norm(v: string) {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/* ─── Map component ─────────────────────────────────────────────────────── */
function SpotMap({
  spots,
  onSelectSpot,
  selectedSpotId,
  onViewportChange,
}: {
  spots: SpotData[];
  onSelectSpot: (id: string) => void;
  selectedSpotId: string | null;
  onViewportChange?: (info: { zoom: number; count: number }) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);
  const [viewport, setViewport] = useState<{ north: number; south: number; east: number; west: number; zoom: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, { center: [48.8566, 2.3522], zoom: 11, zoomControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
        maxZoom: 19,
      }).addTo(map);
      const updateVP = () => {
        const b = map.getBounds();
        setViewport({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest(), zoom: map.getZoom() });
      };
      map.on('moveend zoomend', updateVP);
      updateVP();
      mapRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  const spotsInView = useMemo(() => {
    if (!viewport) return [] as SpotData[];
    return spots.filter(s =>
      s.latitude != null && s.longitude != null &&
      s.latitude <= viewport.north && s.latitude >= viewport.south &&
      s.longitude <= viewport.east && s.longitude >= viewport.west
    );
  }, [spots, viewport]);

  const shouldHide = useMemo(() => {
    if (!viewport) return true;
    if (viewport.zoom < 10) return true;
    return new Set(spotsInView.map(s => norm(s.city || 'x'))).size > 6;
  }, [viewport, spotsInView]);

  useEffect(() => {
    if (onViewportChange && viewport) {
      onViewportChange({ zoom: viewport.zoom, count: shouldHide ? 0 : spotsInView.length });
    }
  }, [viewport, spotsInView.length, shouldHide, onViewportChange]);

  useEffect(() => {
    const L = LRef.current;
    if (!mapRef.current || !markersRef.current || !L) return;
    markersRef.current.clearLayers();
    if (shouldHide) return;
    spotsInView.forEach(spot => {
      if (spot.latitude == null || spot.longitude == null) return;
      const active = spot.id === selectedSpotId;
      const html = active
        ? `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);border:3px solid white;box-shadow:0 4px 16px rgba(16,185,129,.55);display:flex;align-items:center;justify-content:center">
             <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
           </div>`
        : `<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#4f46e5);border:2.5px solid white;box-shadow:0 2px 8px rgba(99,102,241,.4);display:flex;align-items:center;justify-content:center">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
           </div>`;
      const icon = L.divIcon({ className: '', html, iconSize: active ? [40, 40] : [30, 30], iconAnchor: active ? [20, 40] : [15, 30] });
      const marker = L.marker([spot.latitude, spot.longitude], { icon });
      marker.bindTooltip(
        `<strong>${spot.name}</strong><br/><small>${spot.city || ''} · ${spot._count.performances} perfs</small>`,
        { direction: 'top', offset: [0, -36], className: 'spot-tip' }
      );
      marker.on('click', () => onSelectSpot(spot.id));
      markersRef.current!.addLayer(marker);
    });
  }, [spotsInView, selectedSpotId, shouldHide, onSelectSpot]);

  useEffect(() => {
    if (!mapRef.current || !selectedSpotId) return;
    const spot = spots.find(s => s.id === selectedSpotId);
    if (spot?.latitude != null && spot?.longitude != null) {
      mapRef.current.setView([spot.latitude, spot.longitude], 14, { animate: true });
    }
  }, [selectedSpotId, spots]);

  useEffect(() => {
    if (!mapRef.current || selectedSpotId) return;
    const coords = spots.filter(s => s.latitude != null && s.longitude != null)
      .map(s => [s.latitude as number, s.longitude as number] as [number, number]);
    if (!coords.length) return;
    if (coords.length === 1) { mapRef.current.setView(coords[0], 14, { animate: true }); return; }
    mapRef.current.fitBounds(coords, { padding: [40, 40], maxZoom: 13 });
  }, [spots, selectedSpotId]);

  const locateMe = () => {
    if (!mapRef.current) return;
    navigator.geolocation?.getCurrentPosition(pos =>
      mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 14, { animate: true })
    );
  };

  return (
    <div className="relative w-full h-full">
      <style>{`.spot-tip{background:#111827;border:none;color:white;border-radius:10px;padding:6px 10px;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,.3)}.spot-tip::before{border-top-color:#111827}`}</style>
      <div ref={containerRef} className="w-full h-full" />
      {/* zoom */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
        <button onClick={() => mapRef.current?.zoomIn()} className="w-9 h-9 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg flex items-center justify-center text-gray-700 font-bold text-xl hover:bg-white transition">+</button>
        <button onClick={() => mapRef.current?.zoomOut()} className="w-9 h-9 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg flex items-center justify-center text-gray-700 font-bold text-xl hover:bg-white transition">−</button>
      </div>
      {/* gps */}
      <button onClick={locateMe} className="absolute right-3 bottom-4 z-[1000] w-10 h-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg flex items-center justify-center text-indigo-600 hover:bg-white transition">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06z" /></svg>
      </button>
      {/* hint */}
      {shouldHide && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 text-white text-xs rounded-2xl px-4 py-2 shadow-lg backdrop-blur-sm pointer-events-none whitespace-nowrap">
          {viewport && viewport.zoom < 10 ? '🔍 Zoomez pour voir les spots' : '📍 Zoomez sur une zone précise'}
        </div>
      )}
    </div>
  );
}

/* ─── Spot list card ─────────────────────────────────────────────────────── */
function SpotCard({ spot, onClick, active }: { spot: SpotData; onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick} className={`w-full text-left flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${active ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-indigo-600' : 'bg-gray-100'}`}>
        <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-500'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
          <circle cx="12" cy="11" r="3" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${active ? 'text-indigo-900' : 'text-gray-900'}`}>{spot.name}</p>
        <p className="text-xs text-gray-400 truncate">{spot.city || '—'}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="text-xs font-bold text-gray-700">{spot._count.performances}</span>
        <span className="text-[10px] text-gray-400">perfs</span>
      </div>
    </button>
  );
}

/* ─── Medal icon ─────────────────────────────────────────────────────────── */
function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-xs font-bold text-gray-500">#{rank}</span>;
}

/* ─── Main page ─────────────────────────────────────────────────────────── */
type PanelView = 'none' | 'list' | 'spot' | 'global';

export default function CartePage() {
  const [spots, setSpots] = useState<SpotData[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [panelView, setPanelView] = useState<PanelView>('none');

  const [spotDetail, setSpotDetail] = useState<{
    spot: SpotData & { regularsCount: number; performancesCount: number };
    regulars: RegularUser[];
    isRegular: boolean;
    leaderboard: Record<string, LeaderEntry[]>;
    currentUserId: string;
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [spotError, setSpotError] = useState<string | null>(null);
  const [leaderFilter, setLeaderFilter] = useState('tractions');
  const [addingFriend, setAddingFriend] = useState<string | null>(null);
  const [friendNotif, setFriendNotif] = useState('');

  const [globalExercise, setGlobalExercise] = useState('tractions');
  const [globalLeaderboard, setGlobalLeaderboard] = useState<Array<{
    rank: number; userId: string; pseudo: string; score: number; unit: string; spotName: string; spotCity: string;
  }>>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const detailRequestSeq = useRef(0);

  // Lock body scroll on mobile when a panel is open
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    document.body.style.overflow = isMobile && panelView !== 'none' ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [panelView]);

  const loadSpots = useCallback(async () => {
    try {
      const res = await fetch('/api/performances/spots', { headers: authHeader() });
      if (res.ok) { const d = await res.json(); setSpots(d.spots ?? []); }
    } catch { /* silent */ }
  }, []);

  const loadGlobal = useCallback(async (ex: string) => {
    setLoadingGlobal(true);
    try {
      const res = await fetch(`/api/performances/leaderboard?exercise=${ex}&limit=20`, { headers: authHeader() });
      if (res.ok) { const d = await res.json(); setGlobalLeaderboard(d.leaderboard ?? []); }
    } catch { /* silent */ }
    setLoadingGlobal(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadSpots();
    }, 0);
    return () => clearTimeout(t);
  }, [loadSpots]);

  useEffect(() => {
    if (panelView !== 'global') return;
    const t = setTimeout(() => {
      void loadGlobal(globalExercise);
    }, 0);
    return () => clearTimeout(t);
  }, [panelView, globalExercise, loadGlobal]);

  const selectSpot = useCallback(async (spotId: string) => {
    const reqId = ++detailRequestSeq.current;
    setSelectedSpotId(spotId);
    setLoadingDetail(true);
    setSpotError(null);
    setLeaderFilter('tractions');
    setPanelView('spot');
    try {
      const res = await fetch(`/api/performances/spots/${spotId}`, { headers: authHeader() });
      if (detailRequestSeq.current !== reqId) return;
      if (res.ok) { setSpotDetail(await res.json()); }
      else { setSpotError('Impossible de charger ce spot'); setSpotDetail(null); }
    } catch {
      if (detailRequestSeq.current !== reqId) return;
      setSpotError('Erreur réseau');
      setSpotDetail(null);
    }
    if (detailRequestSeq.current === reqId) {
      setLoadingDetail(false);
    }
  }, []);

  const toggleRegular = async () => {
    if (!selectedSpotId) return;
    try {
      const res = await fetch(`/api/performances/spots/${selectedSpotId}/regulars`, { method: 'POST', headers: authHeader() });
      if (res.ok) await selectSpot(selectedSpotId);
    } catch { /* silent */ }
  };

  const addFriend = async (pseudo: string) => {
    setAddingFriend(pseudo);
    try {
      const res = await fetch('/api/friends/send', { method: 'POST', headers: authHeader(), body: JSON.stringify({ pseudo }) });
      const d = await res.json();
      setFriendNotif(res.ok ? `Demande envoyée à ${pseudo} ✓` : d.error || 'Erreur');
    } catch { setFriendNotif('Erreur réseau'); }
    setAddingFriend(null);
    setTimeout(() => setFriendNotif(''), 3000);
  };

  const closePanel = () => { setPanelView('none'); setSelectedSpotId(null); setSpotDetail(null); setSpotError(null); };

  const query = norm(search);
  const filteredSpots = useMemo(() =>
    query ? spots.filter(s => norm(s.name).includes(query) || norm(s.city || '').includes(query)) : spots,
    [spots, query]
  );
  const sortedSpots = useMemo(() => [...filteredSpots].sort((a, b) => b._count.performances - a._count.performances), [filteredSpots]);

  return (
    <div className="relative flex flex-col h-[calc(100dvh-3.5rem)] sm:h-screen overflow-hidden bg-gray-100">

      {/* ── Map fills the entire area ── */}
      <div className="absolute inset-0 z-0">
        <SpotMap
          spots={filteredSpots}
          onSelectSpot={selectSpot}
          selectedSpotId={selectedSpotId}
        />
      </div>

      {/* ── Floating top bar ── */}
      <div className="absolute top-0 inset-x-0 z-[1200] px-3 pt-3 pointer-events-none">
        <div className="flex gap-2 pointer-events-auto">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Spot, ville..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-white/97 backdrop-blur-md border border-gray-200 text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-300/80 flex items-center justify-center text-gray-600 hover:bg-gray-400/80">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          {/* List toggle */}
          <button
            onClick={() => setPanelView(v => v === 'list' ? 'none' : 'list')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition flex-shrink-0 ${panelView === 'list' ? 'bg-indigo-600 text-white' : 'bg-white/97 backdrop-blur-md text-gray-600 border border-gray-200 hover:bg-white'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          </button>
          {/* Global leaderboard toggle */}
          <button
            onClick={() => setPanelView(v => v === 'global' ? 'none' : 'global')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition flex-shrink-0 ${panelView === 'global' ? 'bg-amber-500 text-white' : 'bg-white/97 backdrop-blur-md text-gray-600 border border-gray-200 hover:bg-white'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
          </button>
        </div>

        {/* Search dropdown */}
        {search.trim() && filteredSpots.length > 0 && (
          <div className="pointer-events-auto mt-1.5 bg-white/98 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 max-h-52 overflow-y-auto">
            {filteredSpots.slice(0, 8).map(s => (
              <button key={s.id} onClick={() => { selectSpot(s.id); setSearch(''); }}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 border-b last:border-0 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.city} · {s._count.performances} perfs</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {search.trim() && filteredSpots.length === 0 && (
          <div className="pointer-events-auto mt-1.5 bg-white/98 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 px-4 py-3 text-sm text-gray-400 text-center">
            Aucun résultat
          </div>
        )}
      </div>

      {/* ── Spots count pill ── */}
      <div className="absolute bottom-[76px] left-1/2 -translate-x-1/2 z-[800] pointer-events-none">
        <div className="bg-gray-900/75 backdrop-blur-sm text-white text-xs font-medium rounded-full px-3 py-1.5 shadow-lg">
          {spots.length} spot{spots.length > 1 ? 's' : ''}{filteredSpots.length < spots.length ? ` · ${filteredSpots.length} affichés` : ''}
        </div>
      </div>

      {/* ── Backdrop for panels on mobile ── */}
      {panelView !== 'none' && (
        <button
          aria-label="Fermer"
          className="sm:hidden absolute inset-0 bg-black/30 z-[1000]"
          onClick={closePanel}
        />
      )}

      {/* ════════════════════════════════════════════
          LIST PANEL
      ════════════════════════════════════════════ */}
      {panelView === 'list' && (
        <div
          className="absolute inset-x-0 bottom-0 z-[1001] bg-white rounded-t-3xl shadow-2xl flex flex-col"
          style={{ maxHeight: '70%' }}
        >
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
            <div>
              <h2 className="font-bold text-gray-900 text-base">📍 Spots SW</h2>
              <p className="text-xs text-gray-400 mt-0.5">{sortedSpots.length} street workout{sortedSpots.length > 1 ? 's' : ''}</p>
            </div>
            <button onClick={closePanel} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 pb-safe">
            {sortedSpots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 text-gray-400">
                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/></svg>
                <p className="text-sm">Aucun spot</p>
              </div>
            ) : sortedSpots.map(s => (
              <SpotCard key={s.id} spot={s} active={s.id === selectedSpotId}
                onClick={() => { selectSpot(s.id); }} />
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          GLOBAL LEADERBOARD PANEL
      ════════════════════════════════════════════ */}
      {panelView === 'global' && (
        <div
          className="absolute inset-x-0 bottom-0 z-[1001] bg-white rounded-t-3xl shadow-2xl flex flex-col"
          style={{ maxHeight: '78%' }}
        >
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
            <div>
              <h2 className="font-bold text-gray-900 text-base">🏆 Classement Global</h2>
              <p className="text-xs text-gray-400">Meilleurs scores tous spots</p>
            </div>
            <button onClick={closePanel} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {/* Exercise filter */}
          <div className="px-4 py-3 border-b flex-shrink-0">
            <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {EXERCISES.map(ex => (
                <button key={ex.key} onClick={() => setGlobalExercise(ex.key)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${globalExercise === ex.key ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 pb-safe">
            {loadingGlobal ? (
              <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
            ) : globalLeaderboard.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">Aucune performance pour cet exercice</p>
            ) : (
              <div className="space-y-2">
                {globalLeaderboard.map(e => (
                  <div key={e.userId} className={`flex items-center gap-3 p-3 rounded-2xl ${e.rank <= 3 ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50 border border-gray-100'}`}>
                    <div className="w-8 flex items-center justify-center flex-shrink-0">
                      <Medal rank={e.rank} />
                    </div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {(e.pseudo || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/dashboard/profil/${e.userId}`} className="text-sm font-semibold text-gray-900 truncate hover:underline block">{e.pseudo}</Link>
                      <p className="text-[11px] text-gray-400 truncate">{e.spotName}, {e.spotCity}</p>
                    </div>
                    <span className="text-sm font-black text-gray-900 flex-shrink-0">{e.score} <span className="text-xs font-normal text-gray-400">{e.unit}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          SPOT DETAIL PANEL
      ════════════════════════════════════════════ */}
      {panelView === 'spot' && selectedSpotId && (
        <div
          className="absolute inset-x-0 bottom-0 z-[1001] bg-white rounded-t-3xl shadow-2xl flex flex-col"
          style={{ maxHeight: '82%' }}
        >
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">
            <button onClick={closePanel} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition flex-shrink-0">
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-gray-900 text-base truncate">
                {loadingDetail ? 'Chargement…' : spotDetail?.spot.name || '—'}
              </h2>
              {spotDetail && (
                <p className="text-xs text-gray-400 truncate">
                  📍 {spotDetail.spot.city || '—'}
                </p>
              )}
            </div>
            {spotDetail && (
              <button onClick={toggleRegular}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${spotDetail.isRegular ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
                {spotDetail.isRegular ? '✓ Habitué' : '+ Rejoindre'}
              </button>
            )}
          </div>

          {/* Loading */}
          {loadingDetail && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {spotError && !loadingDetail && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/></svg>
              </div>
              <p className="text-sm text-red-500 font-medium">{spotError}</p>
              <button onClick={() => selectSpot(selectedSpotId)} className="text-sm text-indigo-600 font-semibold hover:text-indigo-800">
                Réessayer
              </button>
            </div>
          )}

          {/* Content */}
          {spotDetail && !loadingDetail && (
            <div className="flex-1 overflow-y-auto">
              {/* Stats */}
              <div className="grid grid-cols-3 divide-x border-b">
                {[
                  { label: 'Performances', value: spotDetail.spot.performancesCount, icon: '📊', color: 'text-indigo-600' },
                  { label: 'Habitués', value: spotDetail.regulars.length, icon: '👥', color: 'text-emerald-600' },
                  { label: 'Exercices', value: EXERCISES.length, icon: '💪', color: 'text-orange-500' },
                ].map((s, i) => (
                  <div key={i} className="flex flex-col items-center py-4">
                    <span className="text-xl mb-1">{s.icon}</span>
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Regulars */}
              <div className="px-5 pt-5 pb-4 border-b">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">👥 Habitués du spot</h3>
                {spotDetail.regulars.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucun habitué — sois le premier !</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {spotDetail.regulars.map(r => (
                      <div key={r.userId} className="flex items-center gap-1.5 bg-gray-50 rounded-2xl px-2.5 py-1.5 border border-gray-100">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {(r.pseudo || r.name || '?')[0].toUpperCase()}
                        </div>
                        <Link href={`/dashboard/profil/${r.userId}`} className="text-xs font-medium text-gray-800 hover:underline">{r.pseudo || r.name || 'Anonyme'}</Link>
                        {r.isMe ? (
                          <span className="text-[10px] text-emerald-500 font-bold">Toi</span>
                        ) : r.isFriend ? (
                          <span className="text-[10px] text-emerald-400">✓ ami</span>
                        ) : (
                          <button onClick={() => addFriend(r.pseudo || r.name || '')} disabled={addingFriend === (r.pseudo || r.name)}
                            className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold disabled:opacity-40">
                            {addingFriend === (r.pseudo || r.name) ? '…' : '+ami'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {friendNotif && (
                  <p className="text-xs text-emerald-600 mt-2 font-medium">{friendNotif}</p>
                )}
              </div>

              {/* Leaderboard */}
              <div className="px-5 pt-5 pb-8">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">🏆 Top Performances</h3>
                {/* Exercise tabs */}
                <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1" style={{ scrollbarWidth: 'none' }}>
                  {EXERCISES.map(ex => {
                    const hasData = (spotDetail.leaderboard[ex.key]?.length ?? 0) > 0;
                    return (
                      <button key={ex.key} onClick={() => setLeaderFilter(ex.key)}
                        className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${leaderFilter === ex.key ? 'bg-indigo-600 text-white shadow-sm' : hasData ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-50 text-gray-300'}`}>
                        {ex.label}
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const entries = spotDetail.leaderboard[leaderFilter] ?? [];
                  const exInfo = EXERCISES.find(e => e.key === leaderFilter);
                  if (!entries.length) return (
                    <div className="flex flex-col items-center py-6 text-gray-400 gap-2">
                      <span className="text-3xl">🎯</span>
                      <p className="text-sm">Aucune perf pour {exInfo?.label}</p>
                    </div>
                  );
                  return (
                    <div className="space-y-2">
                      {entries.map((e, i) => (
                        <div key={`${e.userId}-${i}`} className={`flex items-center gap-3 p-3 rounded-2xl ${i === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-100'}`}>
                          <div className="w-8 flex items-center justify-center flex-shrink-0">
                            <Medal rank={i + 1} />
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(e.pseudo || e.name || '?')[0].toUpperCase()}
                          </div>
                          <Link href={`/dashboard/profil/${e.userId}`} className="flex-1 text-sm font-semibold text-gray-800 truncate hover:underline">{e.pseudo || e.name || 'Anonyme'}</Link>
                          <span className="text-sm font-black text-gray-900 flex-shrink-0">{e.score} <span className="text-xs font-normal text-gray-400">{e.unit}</span></span>
                          {e.status === 'validated' && <span className="text-emerald-500 text-xs flex-shrink-0">✓</span>}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
