'use client';

/**
 * Local offline database using IndexedDB
 * Pre-populated with demo data for offline-first functionality
 */

export interface StorageUser {
  id: string;
  nom: string;
  email: string;
  level: string;
  xp: number;
  avatar?: string;
}

export interface StorageWorkout {
  id: string;
  nom: string;
  description: string;
  duree: number;
  exercises: string[];
  userId: string;
  createdAt: string;
}

export interface StorageExercise {
  id: string;
  nom: string;
  description: string;
  emoji: string;
  muscles: string;
  difficulty: 'facile' | 'normal' | 'difficile';
}

const DB_NAME = 'sport_app_offline';
const DB_VERSION = 1;

const STORES = {
  users: 'users',
  workouts: 'workouts',
  exercises: 'exercises',
  sessions: 'sessions',
  cache: 'api_cache',
};

class OfflineDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('✓ Offline DB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores
        if (!db.objectStoreNames.contains(STORES.users)) {
          db.createObjectStore(STORES.users, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.workouts)) {
          db.createObjectStore(STORES.workouts, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.exercises)) {
          db.createObjectStore(STORES.exercises, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.sessions)) {
          db.createObjectStore(STORES.sessions, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.cache)) {
          db.createObjectStore(STORES.cache, { keyPath: 'key' });
        }

        // Seed demo data
        this.seedDemoData(db);
      };
    });
  }

  private seedDemoData(db: IDBDatabase): void {
    // Seed user
    const userStore = db.transaction([STORES.users], 'readwrite').objectStore(STORES.users);
    userStore.add({
      id: 'demo_user',
      nom: 'Utilisateur',
      email: 'user@sport.app',
      level: 'intermediaire',
      xp: 1250,
      avatar: '👤',
    });

    // Seed exercises
    const exerciseStore = db.transaction([STORES.exercises], 'readwrite').objectStore(STORES.exercises);
    const exercises = [
      { id: '1', nom: 'Pompes', emoji: '💪', muscles: 'Poitrine', difficulty: 'normal' },
      { id: '2', nom: 'Squats', emoji: '🦵', muscles: 'Jambes', difficulty: 'normal' },
      { id: '3', nom: 'Abdos', emoji: '🏋️', muscles: 'Core', difficulty: 'facile' },
      { id: '4', nom: 'Burpees', emoji: '⚡', muscles: 'Full Body', difficulty: 'difficile' },
      { id: '5', nom: 'Planche', emoji: '📏', muscles: 'Core', difficulty: 'normal' },
    ];
    exercises.forEach(ex => exerciseStore.add(ex));

    // Seed workouts
    const workoutStore = db.transaction([STORES.workouts], 'readwrite').objectStore(STORES.workouts);
    workoutStore.add({
      id: '1',
      nom: 'Entraînement du matin',
      description: 'Circuit complet 30 minutes',
      duree: 30,
      exercises: ['1', '2', '3'],
      userId: 'demo_user',
      createdAt: new Date().toISOString(),
    });
  }

  async get<T>(store: string, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));

      const request = this.db
        .transaction([store], 'readonly')
        .objectStore(store)
        .get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAll<T>(store: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));

      const request = this.db
        .transaction([store], 'readonly')
        .objectStore(store)
        .getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async put<T>(store: string, value: T): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));

      const request = this.db
        .transaction([store], 'readwrite')
        .objectStore(store)
        .put(value);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string);
    });
  }

  async delete(store: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));

      const request = this.db
        .transaction([store], 'readwrite')
        .objectStore(store)
        .delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(store: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));

      const request = this.db
        .transaction([store], 'readwrite')
        .objectStore(store)
        .clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export const offlineDB = new OfflineDB();
