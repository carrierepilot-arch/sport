'use client';

import { useEffect, useState, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  effectiveType: string;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlowConnection: false,
    effectiveType: '4g',
  });

  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      console.log('✓ Back online');
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
      console.log('✗ Now offline');
    };

    if (typeof window === 'undefined') return;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection speed
    const connection = (navigator as any).connection;
    if (connection) {
      const updateConnectionSpeed = () => {
        const isSlowConnection = ['slow-2g', '2g', '3g'].includes(connection.effectiveType);
        setStatus(prev => ({
          ...prev,
          isSlowConnection,
          effectiveType: connection.effectiveType || '4g',
        }));
      };

      updateConnectionSpeed();
      connection.addEventListener('change', updateConnectionSpeed);

      return () => {
        connection.removeEventListener('change', updateConnectionSpeed);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}

/**
 * Hook pour faire des requêtes HTTP avec fallback offline
 */
export function useFetchWithOfflineFallback() {
  const networkStatus = useNetworkStatus();

  const fetchWithFallback = useCallback(
    async (url: string, options?: RequestInit) => {
      try {
        // Si online, faire la requête normalement
        if (networkStatus.isOnline) {
          // Créer AbortController pour le timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            // Cache la réponse pour usage offline
            if (typeof window !== 'undefined' && 'caches' in window) {
              const cache = await caches.open('api-cache-v1');
              cache.put(url, response.clone());
            }
            
            return response;
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        }

        // Si offline, essayer de charger du cache
        if (typeof window !== 'undefined' && 'caches' in window) {
          const cache = await caches.open('api-cache-v1');
          const cachedResponse = await cache.match(url);
          if (cachedResponse) {
            return cachedResponse;
          }
        }

        throw new Error('No internet and no cached response');
      } catch (error) {
        console.error(`Fetch failed for ${url}:`, error);
        throw error;
      }
    },
    [networkStatus.isOnline]
  );

  return { fetchWithFallback, ...networkStatus };
}
