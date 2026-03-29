'use client';

import { useEffect } from 'react';
import { flushQueuedMutations, installOfflineRuntime } from '@/lib/clientRuntime';
import { offlineDB } from '@/lib/offlineDB';

installOfflineRuntime();

export default function OfflineRuntime() {
  useEffect(() => {
    void offlineDB.init().catch(() => undefined);
    void flushQueuedMutations();

    const handleOnline = () => {
      void flushQueuedMutations();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return null;
}