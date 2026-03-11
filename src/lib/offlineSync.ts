import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { db } from './firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';

export interface MatchEvent {
  id?: string;
  matchId: string;
  type: string;
  playerId: string;
  playerName?: string;
  team: 'home' | 'away';
  quarter: number;
  time: string;
  timestamp: number;
  coordinates?: { x: number; y: number };
  scoreState?: { home: number; away: number };
  synced: boolean;
}

interface HoopsDB extends DBSchema {
  events: {
    key: string;
    value: MatchEvent;
    indexes: {
      'by-match': string;
      'by-sync': number; // 0 for false, 1 for true
    };
  };
}

let dbPromise: Promise<IDBPDatabase<HoopsDB>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB<HoopsDB>('hoopsai-offline-db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('events')) {
        const store = db.createObjectStore('events', { keyPath: 'id' });
        store.createIndex('by-match', 'matchId');
        store.createIndex('by-sync', 'synced');
      }
    },
  });
}

/**
 * Generates a unique ID for events
 */
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Saves an event locally first (Offline-First) and adds it to the sync queue.
 */
export const logEvent = async (eventData: Omit<MatchEvent, 'id' | 'synced'>): Promise<MatchEvent> => {
  if (!dbPromise) throw new Error("IndexedDB not initialized");
  
  const event: MatchEvent = {
    ...eventData,
    id: generateId(),
    synced: false,
  };

  const idb = await dbPromise;
  await idb.put('events', event);
  
  // Trigger background sync attempt asynchronously
  triggerSync().catch(console.error);
  
  return event;
};

/**
 * Retrieves all events for a specific match, sorted by timestamp
 */
export const getMatchEvents = async (matchId: string): Promise<MatchEvent[]> => {
  if (!dbPromise) return [];
  const idb = await dbPromise;
  const events = await idb.getAllFromIndex('events', 'by-match', matchId);
  return events.sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Queue Manager: Attempts to push all unsynced events to Firebase and the server SSE.
 */
export let isSyncing = false;

export const triggerSync = async () => {
  if (isSyncing || !navigator.onLine || !dbPromise) return;
  
  isSyncing = true;
  const idb = await dbPromise;
  
  try {
    // Get all unsynced events
    const unsyncedEvents = await idb.getAllFromIndex('events', 'by-sync', 0); // 0 = false in index
    
    if (unsyncedEvents.length === 0) {
      isSyncing = false;
      return;
    }

    for (const event of unsyncedEvents) {
        try {
            // 1. Push to Firebase Document
            const eventRef = doc(collection(db, "events"));
            await setDoc(eventRef, { ...event, synced: true });
            
            // 2. Broadcast to Server / SSE for real-time app
            try {
                await fetch("/api/events", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(event)
                });
            } catch(e) { /* server broadcast failed, but firebase saved */ }

            // 3. Mark as synced locally
            event.synced = true;
            await idb.put('events', event);
        } catch (error) {
            console.error("Failed to sync event:", event.id, error);
            // Break loop on first total failure to maintain chronological order in next attempt
            break; 
        }
    }
  } catch (err) {
    console.error("Sync process error", err);
  } finally {
    isSyncing = false;
  }
};

// Listen for connection restoration to automatically sync
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        triggerSync().catch(console.error);
    });
}
