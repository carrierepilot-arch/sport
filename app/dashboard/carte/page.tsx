'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ─── Types ──────────────────────────────────────────────────────────────── */
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
  { key: 'tractions',         label: 'Tractions',         unit: 'reps' },
  { key: 'pompes',            label: 'Pompes',            unit: 'reps' },
  { key: 'dips',              label: 'Dips',              unit: 'reps' },
  { key: 'squats',            label: 'Squats',            unit: 'reps' },
  { key: 'tractions_lestees', label: 'Tractions lestées', unit: 'kg' },
  { key: 'dips_lestes',       label: 'Dips lestés',       unit: 'kg' },
];

function authHeader(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

/* ─── Map Component (loaded client-side only) ─────────────────────────── */
function SpotMapInner({ spots, onSelectSpot, selectedSpotId }: { spots: SpotData[]; onSelectSpot: (id: string) => void; selectedSpotId: string | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(containerRef.current, {
        center: [48.8566, 2.3522],
        zoom: 11,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const L = LRef.current;
    if (!mapRef.current || !markersRef.current || !L) return;
    markersRef.current.clearLayers();

    const defaultIcon = L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });

    const activeIcon = L.divIcon({
      className: '',
      html: `<div style="width:36px;height:36px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
      </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    spots.forEach(spot => {
      if (spot.latitude == null || spot.longitude == null) return;
      const isActive = spot.id === selectedSpotId;
      const marker = L.marker([spot.latitude, spot.longitude], { icon: isActive ? activeIcon : defaultIcon });
      marker.bindTooltip(spot.name, { direction: 'top', offset: [0, -30] });
      marker.on('click', () => onSelectSpot(spot.id));
      markersRef.current!.addLayer(marker);
    });
  }, [spots, selectedSpotId, onSelectSpot]);

  // Pan to selected spot
  useEffect(() => {
    if (!mapRef.current || !selectedSpotId) return;
    const spot = spots.find(s => s.id === selectedSpotId);
    if (spot?.latitude && spot?.longitude) {
      mapRef.current.setView([spot.latitude, spot.longitude], 14, { animate: true });
    }
  }, [selectedSpotId, spots]);

  return <div ref={containerRef} className="w-full h-full rounded-xl" />;
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function CartePage() {
  const [spots, setSpots] = useState<SpotData[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [spotDetail, setSpotDetail] = useState<{
    spot: SpotData & { regularsCount: number; performancesCount: number };
    regulars: RegularUser[];
    isRegular: boolean;
    leaderboard: Record<string, LeaderEntry[]>;
    currentUserId: string;
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [addingFriend, setAddingFriend] = useState<string | null>(null);
  const [friendNotif, setFriendNotif] = useState('');
  const [leaderFilter, setLeaderFilter] = useState('tractions');

  const loadSpots = useCallback(async () => {
    try {
      const res = await fetch('/api/performances/spots', { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        setSpots(data.spots);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadSpots(); }, [loadSpots]);

  const selectSpot = useCallback(async (spotId: string) => {
    setSelectedSpotId(spotId);
    setLoadingDetail(true);
    setLeaderFilter('tractions');
    try {
      const res = await fetch(`/api/performances/spots/${spotId}`, { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        setSpotDetail(data);
      }
    } catch { /* silent */ }
    setLoadingDetail(false);
  }, []);

  const toggleRegular = async () => {
    if (!selectedSpotId) return;
    try {
      const res = await fetch(`/api/performances/spots/${selectedSpotId}/regulars`, {
        method: 'POST',
        headers: authHeader(),
      });
      if (res.ok) {
        await selectSpot(selectedSpotId);
      }
    } catch { /* silent */ }
  };

  const addFriend = async (pseudo: string) => {
    setAddingFriend(pseudo);
    setFriendNotif('');
    try {
      const res = await fetch('/api/friends/send', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ pseudo }),
      });
      const data = await res.json();
      if (res.ok) {
        setFriendNotif(`Demande envoyée à ${pseudo}`);
      } else {
        setFriendNotif(data.error || 'Erreur');
      }
    } catch {
      setFriendNotif('Erreur réseau');
    }
    setAddingFriend(null);
    setTimeout(() => setFriendNotif(''), 3000);
  };

  const filteredSpots = search.trim()
    ? spots.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.city?.toLowerCase().includes(search.toLowerCase()))
      )
    : spots;

  const closeSidebar = () => { setSelectedSpotId(null); setSpotDetail(null); };

  return (
    <main className="flex flex-col h-[calc(100vh-4rem)] sm:h-[calc(100vh-2rem)] overflow-hidden">
      {/* ── Search Bar ── */}
      <div className="px-3 sm:px-4 py-3 bg-white border-b flex items-center gap-2">
        <div className="relative flex-1 max-w-lg">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un street workout..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-gray-400 hidden sm:block">{spots.length} spots</span>
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        {/* ── Search Results Dropdown ── */}
        {search.trim() && (
          <div className="absolute top-0 left-3 right-3 sm:left-4 sm:right-auto sm:w-80 z-[1000] bg-white rounded-b-xl shadow-lg border max-h-64 overflow-y-auto">
            {filteredSpots.length === 0 ? (
              <p className="p-3 text-sm text-gray-400">Aucun résultat</p>
            ) : (
              filteredSpots.map(spot => (
                <button
                  key={spot.id}
                  onClick={() => { selectSpot(spot.id); setSearch(''); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b last:border-0 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{spot.name}</p>
                  <p className="text-xs text-gray-400">{spot.city} · {spot._count.performances} perfs · {spot._count.regulars} habitués</p>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Map ── */}
        <div className="flex-1">
          <SpotMapInner spots={spots} onSelectSpot={selectSpot} selectedSpotId={selectedSpotId} />
        </div>

        {/* ── Spot Detail Sidebar ── */}
        {selectedSpotId && (
          <div className="absolute inset-0 sm:static sm:w-96 bg-white sm:border-l z-[1001] flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-2 z-10">
              <button onClick={closeSidebar} className="p-1 hover:bg-gray-100 rounded-lg">
                <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 truncate">{spotDetail?.spot.name || '...'}</h2>
                <p className="text-xs text-gray-400">{spotDetail?.spot.city}</p>
              </div>
            </div>

            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : spotDetail ? (
              <div className="flex-1 overflow-y-auto">
                {/* Stats Row */}
                <div className="px-4 py-3 flex gap-4 border-b">
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">{spotDetail.spot.performancesCount}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Performances</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600">{spotDetail.regulars.length}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Habitués</p>
                  </div>
                </div>

                {/* Regular Toggle */}
                <div className="px-4 py-3 border-b">
                  <button
                    onClick={toggleRegular}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                      spotDetail.isRegular
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {spotDetail.isRegular ? '✓ Je fréquente ce street' : '+ Je fréquente ce street'}
                  </button>
                </div>

                {/* ── Regulars Section ── */}
                <div className="px-4 py-3 border-b">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">👥 Personnes habituées</h3>
                  {spotDetail.regulars.length === 0 ? (
                    <p className="text-xs text-gray-400">Aucun habitué pour le moment</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {spotDetail.regulars.map(r => (
                        <div key={r.userId} className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                            {(r.pseudo || r.name || '?')[0].toUpperCase()}
                          </div>
                          <span className="text-sm text-gray-800 truncate flex-1">{r.pseudo || r.name || 'Anonyme'}</span>
                          {r.isMe ? (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">Vous</span>
                          ) : r.isFriend ? (
                            <span className="text-[10px] text-emerald-500 flex-shrink-0">✓ Ami</span>
                          ) : (
                            <button
                              onClick={() => addFriend(r.pseudo || r.name || '')}
                              disabled={addingFriend === (r.pseudo || r.name)}
                              className="text-xs text-blue-600 hover:text-blue-800 flex-shrink-0 disabled:opacity-50"
                            >
                              {addingFriend === (r.pseudo || r.name) ? '...' : '+ Ami'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {friendNotif && <p className="text-xs text-blue-600 mt-2">{friendNotif}</p>}
                </div>

                {/* ── Performance Leaderboards ── */}
                <div className="px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">🏆 Top Performances</h3>

                  {/* Exercise filter pills */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {EXERCISES.map(ex => {
                      const hasData = spotDetail.leaderboard[ex.key]?.length > 0;
                      return (
                        <button
                          key={ex.key}
                          onClick={() => setLeaderFilter(ex.key)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            leaderFilter === ex.key
                              ? 'bg-blue-600 text-white'
                              : hasData
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-gray-50 text-gray-300'
                          }`}
                        >
                          {ex.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Leaderboard */}
                  {(() => {
                    const entries = spotDetail.leaderboard[leaderFilter] || [];
                    const exInfo = EXERCISES.find(e => e.key === leaderFilter);
                    if (entries.length === 0) {
                      return <p className="text-xs text-gray-400">Aucune performance en {exInfo?.label}</p>;
                    }
                    return (
                      <div className="space-y-1.5">
                        {entries.map((entry, i) => (
                          <div
                            key={`${entry.userId}-${i}`}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                              i === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-gray-200 text-gray-500'
                            }`}>
                              {i + 1}
                            </span>
                            <span className="text-sm text-gray-800 truncate flex-1">{entry.pseudo || entry.name || 'Anonyme'}</span>
                            <span className="text-sm font-bold text-gray-900 flex-shrink-0">{entry.score} {entry.unit}</span>
                            {entry.status === 'validated' && <span className="text-emerald-500 text-xs flex-shrink-0">✓</span>}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
