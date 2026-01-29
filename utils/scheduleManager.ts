export type ScheduleItemType = 'song' | 'scripture' | 'media' | 'blank';

export type ScheduleItem = {
    id: string;
    type: ScheduleItemType;
    title: string;
    subtitle?: string;
    // For songs: slides are the verses/choruses
    // For scriptures: slides are the verses
    slides: {
        id: string;
        content: string;
        label?: string; // e.g., "Verse 1", "Chorus"
    }[];
    // Currently active slide index
    activeSlideIndex: number;
    // Metadata
    meta?: {
        version?: string;      // For scriptures
        author?: string;       // For songs
        ccli?: string;         // For songs
        background?: string;   // Custom background for this item
        imageMode?: 'contain' | 'cover' | 'stretch'; // For media
    };
};

export type ServiceSchedule = {
    id: string;
    name: string;
    date: string;
    items: ScheduleItem[];
};

// Create a blank schedule
export const createBlankSchedule = (): ServiceSchedule => ({
    id: Date.now().toString(),
    name: 'New Service',
    date: new Date().toISOString().split('T')[0],
    items: []
});

// Local Storage Key (Legacy)
const SCHEDULE_KEY = 'church-projector-schedule';
const DB_NAME = 'church-projector-db';
const STORE_NAME = 'schedules';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as any).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

// Save schedule to IndexedDB
export const saveSchedule = async (schedule: ServiceSchedule): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(schedule, SCHEDULE_KEY);
    } catch (e) {
        console.error('Failed to save schedule to DB', e);
    }
};

// Load schedule from IndexedDB (with migration)
export const loadSchedule = async (): Promise<ServiceSchedule | null> => {
    if (typeof window === 'undefined') return null;

    // 1. Try migration from LocalStorage first
    try {
        const localData = localStorage.getItem(SCHEDULE_KEY);
        if (localData) {
            console.log('Migrating schedule from LocalStorage to IndexedDB...');
            const schedule = JSON.parse(localData);
            await saveSchedule(schedule);
            localStorage.removeItem(SCHEDULE_KEY);
            return schedule;
        }
    } catch (e) {
        console.error('Migration failed', e);
    }

    // 2. Load from IndexedDB
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(SCHEDULE_KEY);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to load schedule from DB', e);
        return null;
    }
};
